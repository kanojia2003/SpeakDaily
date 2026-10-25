# Session history migration

Apply `20261023_session_history.sql` in the Supabase SQL Editor for project `ebxnyxplenwmkssjxqgc`. It depends on the existing `speaking_sessions` and `speaking_topics` tables, so apply `db/schema.sql` first if the foundation has not been installed. The migration is safe to rerun: it adds the snapshot column only when missing, replaces one named trigger, and backfills only missing titles. It does not overwrite a saved title.

To verify after applying, run:

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'speaking_sessions'
  and column_name = 'topic_title';

select count(*) as sessions_missing_title
from public.speaking_sessions
where topic_id is not null and topic_title is null;
```

The first query should return `topic_title`. The second should return zero for existing sessions whose topic still exists in the catalog. New session titles are populated by a database trigger; authenticated clients have no insert/update privilege for that field. The migration changes local source only until run in the remote SQL Editor.

## Personalized topic rotation

After all earlier migrations, apply `20261024_personalized_topic_rotation.sql` in the SQL Editor. It adds 71 stable-ID curated prompts and metadata for conversation situation, formality, difficulty, and interest keywords. Existing sample rows receive metadata only when they still have the original defaults; seed ID conflicts do not replace edited content.

The migration creates `user_topic_preferences` with owner-only RLS and `practice_topic_visits`, whose rows can only be changed through the authenticated, ownership-scoped `get_practice_topic_set(uuid)` function. Private rotation state is keyed by user and normalized filters. The first cycle uses the user's existing submitted-session history; later cycles use their own start time. The RPC returns at most seven active prompts, preserves the same set for a browser-tab visit, removes prompts after a recording has been submitted, and begins another cycle only after every matching prompt has been practised in the current cycle. If fewer than seven unpractised matches remain, it returns those remaining prompts. A filter combination with no active matches returns an empty set.

Verify the columns, RLS and function after applying:

```sql
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'speaking_topics'
  and column_name in ('scenario', 'register', 'keywords');

select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('user_topic_preferences', 'practice_topic_visits');

select routine_name, security_type
from information_schema.routines
where routine_schema = 'public' and routine_name = 'get_practice_topic_set';

select count(*) as active_curated_topics
from public.speaking_topics where is_active;
```

Expected: three topic metadata columns, RLS enabled for both user tables, the function listed as `DEFINER`, and the active topic count increased by 71 where those stable seed IDs were not already present. SQL files are not applied remotely until executed in the target project's SQL Editor.

## Daily communication practice

After the personalized-topic migration, apply `20261025_communication_practice.sql`. It creates owner-readable generated lesson rows and a server-only two-per-UTC-day question-generation quota. The `reserve_communication_practice_run` RPC serializes requests by user and request key before Gemini is called; repeating a key returns the original lesson rather than generating another set. The `finish_communication_practice_run` RPC stores exactly four validated questions or a safe failure state. Generated answers reference the stored lesson and question index from `speaking_sessions`; the existing `evaluate-speaking` function loads the question from that owner-scoped lesson before asking Gemini to assess the recording. Each answer uses the existing five-per-user-per-UTC-day evaluation quota and private recording workflow.

After applying, verify the private lesson table and session link columns:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('communication_practice_runs', 'communication_practice_generation_usage');

select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'speaking_sessions'
  and column_name in ('communication_practice_run_id', 'communication_question_index');

select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('reserve_communication_practice_run', 'finish_communication_practice_run');
```

Expected: RLS enabled on both tables; both session link columns exist; both reservation/finalization functions are `DEFINER` and executable only by `service_role`. Deploy `generate-communication-practice` and redeploy `evaluate-speaking` after applying the migration. The lesson generation endpoint uses the existing server-only `GEMINI_API_KEY` and `GEMINI_MODEL`; it receives the selected scenario/style/difficulty and optional context. The request is limited to four short questions and has a 30-second provider timeout. Generated question sets are persisted; generation failures are terminal for that idempotency key so a retry cannot silently trigger another paid request. SQL files are not applied remotely until run in the target project's SQL Editor.
