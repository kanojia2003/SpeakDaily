-- SpeakDaily database foundation for Supabase.
-- Safe to re-run: tables/indexes use IF NOT EXISTS; managed triggers and policies
-- are replaced by name; topic seeds use stable IDs and never overwrite edits.

begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.speaking_topics (
  id uuid primary key,
  title text not null,
  description text not null,
  prompt text not null,
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  category text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.speaking_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_id uuid references public.speaking_topics (id) on delete set null,
  topic_title text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  transcript text,
  feedback jsonb,
  error_message text,
  recording_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint speaking_sessions_recording_path_scope_check check (
    recording_path is null or (
      split_part(recording_path, '/', 1) = user_id::text
      and split_part(recording_path, '/', 2) = id::text
      and split_part(recording_path, '/', 3) <> ''
      and pg_catalog.cardinality(pg_catalog.string_to_array(recording_path, '/')) = 3
    )
  )
);

-- Also upgrades databases where the original Task 2 schema is already present.
alter table public.speaking_sessions
  add column if not exists recording_path text;
alter table public.speaking_sessions
  add column if not exists topic_title text;

-- Session titles are historical snapshots and are populated by trusted SQL only.
create or replace function public.snapshot_speaking_session_topic_title()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.topic_id is not null then
    select t.title into new.topic_title
    from public.speaking_topics as t
    where t.id = new.topic_id;
  else
    new.topic_title := null;
  end if;
  return new;
end;
$$;
revoke all on function public.snapshot_speaking_session_topic_title() from public, anon, authenticated;
drop trigger if exists speaking_sessions_snapshot_topic_title on public.speaking_sessions;
create trigger speaking_sessions_snapshot_topic_title
before insert on public.speaking_sessions
for each row execute function public.snapshot_speaking_session_topic_title();

update public.speaking_sessions as s
set topic_title = t.title
from public.speaking_topics as t
where s.topic_id = t.id and s.topic_title is null;

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

create index if not exists speaking_topics_active_category_idx
  on public.speaking_topics (category, difficulty)
  where is_active;
create index if not exists speaking_sessions_user_created_idx
  on public.speaking_sessions (user_id, created_at desc);
create index if not exists speaking_sessions_topic_id_idx
  on public.speaking_sessions (topic_id);
create index if not exists speaking_sessions_status_idx
  on public.speaking_sessions (status);

-- Shared updated-at handler for rows that are changed by trusted server code.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists speaking_sessions_set_updated_at on public.speaking_sessions;
create trigger speaking_sessions_set_updated_at
before update on public.speaking_sessions
for each row execute function public.set_updated_at();

-- Auth metadata is optional and user supplied. Empty or absent values become NULL.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'name'), '')
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_speakdaily on auth.users;
create trigger on_auth_user_created_speakdaily
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.speaking_topics enable row level security;
alter table public.speaking_sessions enable row level security;

-- Explicit grants keep table access narrow even when project default grants differ.
revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.speaking_topics from public, anon, authenticated;
revoke all on table public.speaking_sessions from public, anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;
grant select on table public.speaking_topics to authenticated;
grant select on table public.speaking_sessions to authenticated;
-- Ordinary clients may create only a pending session for themselves. All processing
-- fields (including status, transcript, feedback, error and duration) are server-owned.
grant insert (user_id, topic_id, duration_seconds) on table public.speaking_sessions to authenticated;
-- A client can attach one user/session-scoped recording to its own pending row, then
-- delete only an empty pending row to clean up failed submissions.
grant update (recording_path) on table public.speaking_sessions to authenticated;
grant delete on table public.speaking_sessions to authenticated;

-- Trusted backend code uses the service-role credential only on the server.
grant all on table public.profiles to service_role;
grant all on table public.speaking_topics to service_role;
grant all on table public.speaking_sessions to service_role;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists speaking_topics_read_active on public.speaking_topics;
create policy speaking_topics_read_active
  on public.speaking_topics for select to authenticated
  using (is_active);

drop policy if exists speaking_sessions_select_own on public.speaking_sessions;
create policy speaking_sessions_select_own
  on public.speaking_sessions for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists speaking_sessions_insert_own_pending on public.speaking_sessions;
create policy speaking_sessions_insert_own_pending
  on public.speaking_sessions for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'pending' and duration_seconds between 1 and 120);

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

insert into public.speaking_topics
  (id, title, description, prompt, difficulty, category)
values
  ('1b9e0a20-5d2a-4b67-8e11-000000000001', 'A small bright spot', 'Practice describing a moment that made an ordinary day feel a little better.', 'Tell a story about a small thing that made your day better.', 'beginner', 'Everyday life'),
  ('1b9e0a20-5d2a-4b67-8e11-000000000002', 'A useful lesson', 'Explain a recent lesson and why it stayed with you.', 'What is something you learned recently that surprised you?', 'beginner', 'Reflection'),
  ('1b9e0a20-5d2a-4b67-8e11-000000000003', 'Make your case', 'Organize a short argument with a clear point and supporting reasons.', 'What everyday skill should everyone learn, and why?', 'intermediate', 'Ideas')
on conflict (id) do nothing;

-- Private object storage. Object names must begin with the authenticated user's UUID.
insert into storage.buckets (id, name, public, file_size_limit)
values ('speaking-audio', 'speaking-audio', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

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

commit;
