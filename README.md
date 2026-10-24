# SpeakDaily

Two minutes a day. Speak with more confidence.

SpeakDaily is a React, TypeScript, and Vite application backed by Supabase. It supports email authentication, topic selection, private audio recording and upload, server-side Gemini evaluation, saved results, practice history, privacy information, and account deletion.

## Local setup

Requirements: Node.js compatible with Vite 7, npm, and a Supabase project. The configured project reference is `ebxnyxplenwmkssjxqgc`.

```sh
npm ci
```

Copy `.env.example` to `.env` and set the frontend values:

```dotenv
VITE_SUPABASE_URL=https://ebxnyxplenwmkssjxqgc.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-Supabase-publishable-key
```

Use the Supabase project's publishable key (or legacy anon key if that is what the project provides). Never place a service-role key, Gemini key, or other secret in a `VITE_` variable. Root `.env*` files are ignored by Git; `.env.example` is intentionally tracked. Restart Vite after editing environment variables.

```sh
npm run dev
```

Open the HTTP URL printed by Vite. Do not open `index.html` with a `file://` URL; browser module loading requires the Vite HTTP server. Microphone capture requires a secure browser context (localhost is treated as secure by modern browsers) and user permission.

## Database migrations

The SQL files are source migrations; having them in this repository does not mean they have been run against Supabase. In the Supabase dashboard, open the configured project, then **SQL Editor → New query**. Run each file's complete contents in this order, one at a time, and retain a record of which files were applied:

1. [`db/schema.sql`](db/schema.sql) — base tables, profile trigger, sample topic seeds, RLS and private audio bucket policies.
2. [`db/migrations/20261023_recording_path_workflow.sql`](db/migrations/20261023_recording_path_workflow.sql) — session recording path and scoped upload workflow. This is safe to run after the base schema, even when the base already has the path field.
3. [`db/migrations/20261023_gemini_evaluation.sql`](db/migrations/20261023_gemini_evaluation.sql) — server-only atomic quota and evaluation claim function.
4. [`db/migrations/20261023_session_history.sql`](db/migrations/20261023_session_history.sql) — durable session topic-title snapshot and history support.
5. [`db/migrations/20261024_personalized_topic_rotation.sql`](db/migrations/20261024_personalized_topic_rotation.sql) — curated topics with scenario/style/keyword metadata, private preferences, and a persisted seven-topic visit rotation.

Do not re-run SQL blindly on a project with a different/older schema. Review the SQL and current database first. The scripts are designed to be rerunnable for this application's expected schema; seed conflicts do not overwrite existing topic content. The personalized-topic migration adds 71 curated prompts (plus the original starter prompts), and creates the preference and visit tables and the authenticated `get_practice_topic_set` function. User filters are situation, speaking style, difficulty, and up to five comma-separated interest tags.

After applying, use the verification queries in [`docs/security-privacy-review.md`](docs/security-privacy-review.md) to check RLS, policies, and that `speaking-audio` is private. Verify the `speaking_evaluation_usage` table and `claim_speaking_evaluation` function exist and that the function is executable only by `service_role`. RLS and SQL in the repository have not been verified against the remote database unless these steps are run there.

## Supabase Auth and email confirmation

In **Authentication → URL Configuration**, set the local site URL to `http://localhost:5173` (or the actual Vite origin) and add it to the allowed redirect URLs. Add the production site URL and any required auth callback paths when deploying. The signup flow handles both immediate sessions and confirmation-required signup: when email confirmation is enabled, users must follow Supabase's confirmation email and then sign in. Configure the SMTP/email sender and confirmation policy in Supabase Auth for the intended environment; verify both confirmation and password-reset links from the deployed host before launch.

Profiles are created by the database Auth trigger; optional display-name metadata may be absent. Client profile updates are restricted by grants and RLS. The frontend protected routes are convenience only: database RLS and Edge Function ownership checks remain the security boundary.

## Storage and audio retention

The migration creates/configures the `speaking-audio` bucket as private with a 10 MiB file limit. Storage object names are scoped as `<authenticated-user-uuid>/<session-uuid>/<random-file-name>.<extension>`. Policies restrict client access to the user's UUID folder. No public recording URL is created. Keep these policies and the bucket private; do not add public read access.

Evaluation attempts to remove audio after processing. If cleanup fails, the session records a safe cleanup marker and the object remains private for operator cleanup. A process crash or platform interruption before the cleanup code runs can leave an object behind. There is no scheduled stale-object cleanup job in this repository. Account deletion removes objects under the verified user's prefix and their app records before deleting the Auth user; interrupted deletion can be partial and is designed to be retried while the user can still authenticate. Transcripts and evaluation feedback remain in sessions until account deletion or authorized database retention operations. Database backup retention and Storage object retention are separate concerns.

Read the user-facing [`privacy notice`](src/components/PrivacyNoticePage.tsx) and the engineering [`security and privacy review`](docs/security-privacy-review.md). The review documents unresolved backup, retention, provider, quota, and launch checks; do not treat this code as a security or compliance certification.

## Edge Functions and Gemini

Install the [Supabase CLI](https://supabase.com/docs/guides/cli) and authenticate/link the project from a trusted terminal:

```sh
supabase login
supabase link --project-ref ebxnyxplenwmkssjxqgc
```

In **Supabase Dashboard → Edge Functions → Secrets**, configure:

- `GEMINI_API_KEY` — secret from Google AI Studio / Gemini API.
- `GEMINI_MODEL` — currently `gemini-3.8-flash` (stable, audio input and structured outputs per [Google's model reference](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash) and [audio guide](https://ai.google.dev/gemini-api/docs/generate-content/audio), checked 2026-10-23). Confirm model availability, pricing, limits, and terms for the target Google account and region before launch.
- `SPEAKDAILY_ALLOWED_ORIGINS` — comma-separated exact browser origins, e.g. `https://speakdaily.example`. Add local Vite origin only to a development function environment; do not broadly allow arbitrary origins.

Supabase injects its function credentials, including the service-role credential, into the server runtime. Do not configure those as frontend variables, print them, or commit them. Deploy the functions from the repository root:

```sh
supabase functions deploy evaluate-speaking --project-ref ebxnyxplenwmkssjxqgc
supabase functions deploy delete-account --project-ref ebxnyxplenwmkssjxqgc
```

Both functions require JWT verification in [`supabase/config.toml`](supabase/config.toml) and perform authorization checks. Evaluation applies an atomic limit of five claimed analyses per user per UTC day. Repeated calls against processing/completed sessions are idempotent; failed attempts are terminal, so a new recording is needed and counts against quota. This is a per-account limit, not a global spend cap or protection from multiple-account abuse. Set billing alerts and independent provider/project budget controls where available.

Google's Gemini API terms and data handling depend on paid/unpaid service status and can change. Verify current Gemini terms, abuse-monitoring/logging behavior, region, age/audience requirements, consent, and any contractual requirements for the intended product before sending real user recordings. SpeakDaily does not establish provider compliance on your behalf.

## Checks

```sh
npm run typecheck
npm run build
deno test supabase/functions/evaluate-speaking/validation_test.ts
deno fmt --check supabase/functions/evaluate-speaking/index.ts supabase/functions/evaluate-speaking/validation.ts supabase/functions/evaluate-speaking/validation_test.ts supabase/functions/delete-account/index.ts
deno check --no-lock supabase/functions/evaluate-speaking/index.ts
```

The repository currently has no lint script or frontend test runner configured. The Deno validation tests are local unit tests; they do not call Supabase or Gemini. Deno type checking requires network access to resolve the Supabase JS import. See the function README for coverage and remote test cases.

## Production deployment

1. Apply and verify the SQL migrations and Storage policies in the target Supabase project.
2. Configure Auth site/redirect URLs, confirmation email behavior, and production email delivery.
3. Set Edge Function secrets and deploy both functions. Verify function logs contain no credentials, audio, or transcript content.
4. Configure production `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the frontend build environment.
5. Build with `npm ci && npm run build`; deploy the contents of `dist/` to a static HTTPS host. Configure SPA history fallback so routes such as `/app/history` and `/app/sessions/<id>` serve `index.html`.
6. Configure the exact production origin in `SPEAKDAILY_ALLOWED_ORIGINS`, Supabase Auth redirect allowlist, and hosting settings. Exercise the full journey with dedicated test accounts and real provider credentials before release.

The deployment target is not configured by this repository. Remote database application, live authentication, cross-user RLS checks, Storage isolation, Gemini calls/quotas, account deletion, backup behavior, and production hosting therefore require manual setup and verification.
