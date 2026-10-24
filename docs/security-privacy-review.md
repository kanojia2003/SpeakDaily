# SpeakDaily security and privacy review

Reviewed 2026-10-23. This is an implementation review, not a security audit, penetration test, or compliance determination.

## Current controls inspected

- `profiles`, `speaking_topics`, and `speaking_sessions` have RLS enabled in `db/schema.sql`. Users can read their own profile and sessions, edit only their profile display name, create only their own pending session, and attach a recording only to an eligible owned pending session. Session status, transcript, feedback, and processing errors are backend-owned.
- `speaking_evaluation_usage` is created with RLS enabled and no client policy or grants in `db/migrations/20261023_gemini_evaluation.sql`; service role is the only granted role.
- `user_topic_preferences` is owner-scoped with RLS; users can read and change only their own filters. `practice_topic_visits` is owner-readable and writable only through the authenticated, ownership-scoped RPC. `user_topic_rotation_state` has RLS enabled and no ordinary client grants or policies. These objects are created by `db/migrations/20261024_personalized_topic_rotation.sql`.
- The `speaking-audio` bucket is explicitly private, size-limited to 10 MiB, and has owner-prefix Storage policies. The evaluation function additionally requires `{authenticated-user-uuid}/{session-uuid}/{random-uuid}.{supported-extension}`.
- `evaluate-speaking` verifies the bearer token with Auth, scopes session claims and updates to that user, validates request JSON (2 KiB limit and one allowed field), validates the UUID, duration range, stored path, file size, MIME and file signature, and atomically claims a pending session before calling Gemini. Its persistent limit is five claims per user per UTC day. Processing and completed records are idempotent; failed attempts are terminal.
- Gemini and service-role credentials are read only inside Edge Functions. No `VITE_` secret is used. `.gitignore` excludes real `.env*` files and preserves `.env.example`.
- Logs in the evaluation function contain operational status, session ID, and safe error codes; they do not log request audio, transcript, provider response, or API key. User-facing errors are generic.
- Evaluation success and handled failure paths attempt to remove audio. If removal fails, a safe cleanup marker is stored and the object remains private. Account deletion also enumerates the authenticated user's Storage prefix, removes files in chunks, then deletes only that user's sessions, quota rows, profile, and Auth account. It does not accept a user ID or arbitrary path from the caller.

## Retention and operational limits

- Audio is temporary by design: cleanup is attempted immediately after the evaluation finishes. A cleanup error leaves the object private and records a cleanup-needed marker. The current project does **not** have a scheduled stale-session/audio cleanup worker. If an Edge Function process terminates before its cleanup handler runs, a pending/processing recording can remain until account deletion or operator cleanup. This is a known launch blocker for a strict bounded audio-retention promise.
- Transcript, feedback, topic snapshot, status, and session timing are retained in Supabase until account deletion or operator deletion. Account deletion removes live data and objects but does not purge Google-side logs or historical database backups.
- Supabase's current documentation says Free projects have no automatic database backups and recommends operator-managed exports. The pricing page currently lists 500 MB database, 1 GB file storage, 5 GB egress, and automatic pausing after a week of inactivity. Free projects can also be paused after low activity. Verify the current project plan, region, storage/egress usage, log retention, backup and restore requirements, and pause behavior before launch. Do not use the Free plan as a backup strategy.
- Supabase documents automatic daily backups for Pro (7 days), Team (14 days), and Enterprise (up to 30 days); these are database backups and do not include Storage object contents. A restore to a point before deletion can restore old database records. Confirm the plan-specific terms and deletion/backup retention with Supabase before making a user-facing retention commitment.
- This code does not independently decode media containers to prove the audio's encoded duration. It enforces a server-side 1–120 second value, but that value originates from the authenticated client. File size, format extension, MIME and leading signature are checked server-side. This should be independently tested and the duration claim hardened before relying on it for billing, abuse prevention, or strict retention.
- The quota is per authenticated user, not a global spend cap or Sybil-resistant limit. Account creation controls, provider billing alerts/caps, and abuse monitoring remain operational responsibilities.
- The account-deletion function lists and removes objects under one user prefix. Deploy it together with the required quota migration and test accounts with many objects, partial Storage failures, database failures, and Auth deletion failures before public launch. On partial failure the endpoint returns a generic error; it may already have removed some audio or records, and a retry should finish remaining steps.

## Gemini terms to verify before launch

The function sends audio plus a prompt to the Gemini Developer API. Google's currently published [Additional Terms](https://ai.google.dev/gemini-api/terms) distinguish paid and unpaid service data handling. They state that unpaid-service content may be used to improve/develop Google products and may be subject to human review; paid-service prompts and responses are not used for product improvement but may still be logged for abuse monitoring. Regional terms may change which section applies. The terms also specify age and permitted-use conditions. Confirm the project's billing status, audience/age policy, region, intended consumer-facing use, applicable terms/DPA, logging settings, and any needed user consent with Google/legal counsel before launch. Do not send sensitive or confidential speech until this is resolved.

Official references:

- [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms)
- [Gemini API abuse monitoring and data logging](https://ai.google.dev/gemini-api/docs/usage-policies)
- [Gemini API logging and sharing](https://ai.google.dev/gemini-api/docs/logs-policy)
- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase pricing and quotas](https://supabase.com/pricing)
- [Supabase Free project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)

## Deployment

Set `GEMINI_API_KEY`, `GEMINI_MODEL`, and `SPEAKDAILY_ALLOWED_ORIGINS` only in Supabase Edge Function secrets. Supabase provides its service-role credential to functions automatically; never copy it into Vite variables. Deploy both authenticated functions:

```sh
supabase functions deploy evaluate-speaking --project-ref ebxnyxplenwmkssjxqgc
supabase functions deploy delete-account --project-ref ebxnyxplenwmkssjxqgc
```

Apply `db/schema.sql`, `db/migrations/20261023_recording_path_workflow.sql`, `db/migrations/20261023_gemini_evaluation.sql`, `db/migrations/20261023_session_history.sql`, and `db/migrations/20261024_personalized_topic_rotation.sql` in order in the Supabase SQL Editor when they have not already been applied. These source files do not update the remote project by themselves.

## Remote verification queries

Run in the Supabase SQL Editor. The first query should return no application tables without RLS. The second should show `speaking-audio` with `public = false` and `file_size_limit = 10485760`. Review the listed policies against the code above.

```sql
select n.nspname as schema_name, c.relname as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and c.relname in ('profiles', 'speaking_topics', 'speaking_sessions', 'speaking_evaluation_usage', 'user_topic_preferences', 'practice_topic_visits', 'user_topic_rotation_state')
  and not c.relrowsecurity
order by c.relname;

select id, public, file_size_limit
from storage.buckets
where id = 'speaking-audio';

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where (schemaname = 'public' and tablename in
  ('profiles', 'speaking_topics', 'speaking_sessions', 'speaking_evaluation_usage', 'user_topic_preferences', 'practice_topic_visits', 'user_topic_rotation_state'))
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;
```

## Checks and remaining verification

Local validation of output shape, score bounds, transcript-correction matching, audio signatures, scoped paths, and duration range is in `supabase/functions/evaluate-speaking/validation_test.ts`. Remote RLS isolation, private-bucket cross-user denial, secret placement, Gemini usage terms, provider-side retention, backups, and account deletion have not been verified against the configured Supabase project. They require deployment access and test accounts. The Edge Function source imports Supabase JS over HTTPS; Deno type checking requires network access to resolve that dependency.
