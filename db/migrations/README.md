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
