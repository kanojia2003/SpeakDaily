-- Allow a signed-in user to attach one private recording to their own pending session.
-- Safe to re-run. Run after the original db/schema.sql foundation migration.
begin;

alter table public.speaking_sessions
  add column if not exists recording_path text;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'speaking_sessions_recording_path_scope_check'
      and conrelid = 'public.speaking_sessions'::regclass
  ) then
    alter table public.speaking_sessions
      add constraint speaking_sessions_recording_path_scope_check check (
        recording_path is null or (
          split_part(recording_path, '/', 1) = user_id::text
          and split_part(recording_path, '/', 2) = id::text
          and split_part(recording_path, '/', 3) <> ''
          and pg_catalog.cardinality(pg_catalog.string_to_array(recording_path, '/')) = 3
        )
      );
  end if;
end;
$$;

-- Reset client grants and then grant only the columns used by the recording workflow.
revoke all on table public.speaking_sessions from public, anon, authenticated;
revoke insert (id, user_id, topic_id, status, duration_seconds, transcript, feedback, error_message, recording_path, created_at, updated_at)
  on table public.speaking_sessions from public, anon, authenticated;
revoke update (id, user_id, topic_id, status, duration_seconds, transcript, feedback, error_message, recording_path, created_at, updated_at)
  on table public.speaking_sessions from public, anon, authenticated;

grant select on table public.speaking_sessions to authenticated;
grant insert (user_id, topic_id) on table public.speaking_sessions to authenticated;
grant update (recording_path) on table public.speaking_sessions to authenticated;
grant delete on table public.speaking_sessions to authenticated;

-- Enforce the same 10 MB ceiling at Storage, not only in the browser.
insert into storage.buckets (id, name, public, file_size_limit)
values ('speaking-audio', 'speaking-audio', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

-- Keep the bucket private and scope all client object access to the owner's UUID folder.
drop policy if exists speaking_audio_read_own on storage.objects;
create policy speaking_audio_read_own
  on storage.objects for select to authenticated
  using (
    bucket_id = 'speaking-audio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists speaking_audio_upload_own on storage.objects;
create policy speaking_audio_upload_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'speaking-audio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists speaking_audio_delete_own on storage.objects;
create policy speaking_audio_delete_own
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'speaking-audio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists speaking_sessions_attach_recording on public.speaking_sessions;
create policy speaking_sessions_attach_recording
  on public.speaking_sessions for update to authenticated
  using (
    (select auth.uid()) = user_id
    and status = 'pending'
    and recording_path is null
  )
  with check (
    (select auth.uid()) = user_id
    and status = 'pending'
    and recording_path is not null
    and split_part(recording_path, '/', 1) = user_id::text
    and split_part(recording_path, '/', 2) = id::text
  );

drop policy if exists speaking_sessions_delete_empty_pending on public.speaking_sessions;
create policy speaking_sessions_delete_empty_pending
  on public.speaking_sessions for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and status = 'pending'
    and recording_path is null
  );

commit;
