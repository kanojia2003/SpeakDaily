# `evaluate-speaking`

This function analyzes one authenticated user's private speaking session. It is deployed with JWT verification enabled and independently validates the bearer token with Supabase Auth. The service-role client is created only inside the Edge Function; it is never included in the frontend.

## Database setup

In the Supabase dashboard for project `ebxnyxplenwmkssjxqgc`, open **SQL Editor** and run these files in order:

1. `db/schema.sql` (skip only if the SpeakDaily foundation is already installed).
2. `db/migrations/20261023_recording_path_workflow.sql` (skip if the Task 5 migration is already installed).
3. `db/migrations/20261023_gemini_evaluation.sql`.

The evaluation migration adds an RLS-protected quota table and a service-role-only atomic claim function. It allows at most five claims per authenticated user per UTC day; repeated calls for a processing or completed session do not consume another claim or make another Gemini request. Failed provider evaluations are terminal for that session, so a new session is required and remains subject to the daily quota.

## Gemini model and secrets

`gemini-3.8-flash` is the configured model. Google's current model reference marks it stable, with audio input and structured outputs. The function sends one inline audio `generateContent` request; the browser-enforced 10 MB upload limit keeps audio plus the prompt within Google's 20 MB inline-request limit. See [Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash), [Audio understanding](https://ai.google.dev/gemini-api/docs/generate-content/audio), and [Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output).

Set secrets in **Supabase Dashboard → Edge Functions → Secrets**, or use a temporary ignored `.env.functions` file in the project root with these entries:

```sh
GEMINI_API_KEY=your-Gemini-API-key
GEMINI_MODEL=gemini-3.8-flash
SPEAKDAILY_ALLOWED_ORIGINS=https://your-app.example
```

The root `.gitignore` excludes `.env*` files. From a trusted terminal, upload the values and deploy the function:

```sh
supabase secrets set --env-file .env.functions --project-ref ebxnyxplenwmkssjxqgc
supabase functions deploy evaluate-speaking --project-ref ebxnyxplenwmkssjxqgc
```

Remove the temporary secret file after the upload succeeds. Do not commit it, print its contents, or use `VITE_` names for these values.

For local development, include `http://localhost:5173` or `http://127.0.0.1:5173` in `SPEAKDAILY_ALLOWED_ORIGINS` if using a different Vite port. Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to deployed functions. Never put Gemini or service-role secrets in a `VITE_` variable.

The function rejects origins outside its local-development allowlist and the comma-separated `SPEAKDAILY_ALLOWED_ORIGINS` secret. Configure the exact origins serving the application.

## Recording retention

Audio remains in the private `speaking-audio` bucket only until evaluation finishes. The function attempts to remove it on successful and failed evaluations. On successful deletion it clears `recording_path`; if deletion fails, the session keeps a safe `audio_cleanup_pending` error marker and the object remains private for an administrator to clean up. The function never creates a public URL. Transcript and feedback are retained with the session.

## Local checks and remote tests

Run local checks from the project root:

```sh
npm run typecheck
npm run build
deno check --no-lock supabase/functions/evaluate-speaking/index.ts
deno test supabase/functions/evaluate-speaking/validation_test.ts
```

The validation tests cover output shape and score bounds, empty/unassessable speech, corrections that do not quote the transcript, WebM signature/MIME matching, scoped paths, and duration limits. They do not call Gemini or Supabase.

After the migration and function deployment, use authenticated sessions to verify: unauthenticated calls return 401; another user's session is not found; an owned pending session with a private recording completes; concurrent/repeated calls do not issue duplicate provider requests; more than five claims in one UTC day are rate-limited; provider quota/timeouts/malformed output become safe failed states without fabricated feedback; and the audio object is removed after processing. Confirm the bucket remains private and that a different user cannot read or delete an object. These checks require the deployed Supabase project, valid user sessions, `GEMINI_API_KEY`, and a working Gemini model entitlement.
