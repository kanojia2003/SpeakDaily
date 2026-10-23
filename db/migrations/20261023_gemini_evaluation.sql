-- Secure, persistent evaluation quota and atomic session claim.
-- Apply after schema.sql and 20261023_recording_path_workflow.sql.
begin;

create table if not exists public.speaking_evaluation_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  request_count integer not null default 0 check (request_count between 0 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.speaking_evaluation_usage enable row level security;
revoke all on table public.speaking_evaluation_usage from public, anon, authenticated;
grant all on table public.speaking_evaluation_usage to service_role;

-- Duration comes from the recorder's elapsed capture time and is bounded before analysis.
revoke insert (duration_seconds) on table public.speaking_sessions from public, anon, authenticated;
grant insert (duration_seconds) on table public.speaking_sessions to authenticated;
drop policy if exists speaking_sessions_insert_own_pending on public.speaking_sessions;
create policy speaking_sessions_insert_own_pending
  on public.speaking_sessions for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'pending'
    and duration_seconds between 1 and 120
  );

drop function if exists public.claim_speaking_evaluation(uuid);

create or replace function public.claim_speaking_evaluation(p_session_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.speaking_sessions%rowtype;
  v_request_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_session
  from public.speaking_sessions
  where id = p_session_id
  for update;

  if not found then
    return pg_catalog.jsonb_build_object('outcome', 'not_found');
  end if;

  if v_session.user_id <> p_user_id then
    return pg_catalog.jsonb_build_object('outcome', 'not_found');
  end if;

  if v_session.status = 'completed' then
    return pg_catalog.jsonb_build_object('outcome', 'completed');
  elsif v_session.status = 'processing' then
    return pg_catalog.jsonb_build_object('outcome', 'processing');
  elsif v_session.status = 'failed' then
    return pg_catalog.jsonb_build_object('outcome', 'failed');
  end if;

  if v_session.status <> 'pending'
    or v_session.recording_path is null
    or v_session.duration_seconds < 1
    or v_session.duration_seconds > 120
    or pg_catalog.split_part(v_session.recording_path, '/', 1) <> v_session.user_id::text
    or pg_catalog.split_part(v_session.recording_path, '/', 2) <> v_session.id::text
    or pg_catalog.cardinality(pg_catalog.string_to_array(v_session.recording_path, '/')) <> 3
  then
    return pg_catalog.jsonb_build_object('outcome', 'ineligible');
  end if;

  -- Serializes different session claims by the same user as well as each session row.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_session.user_id::text, 0)
  );

  insert into public.speaking_evaluation_usage (user_id, usage_date, request_count)
  values (v_session.user_id, (pg_catalog.now() at time zone 'utc')::date, 1)
  on conflict (user_id, usage_date) do update
    set request_count = public.speaking_evaluation_usage.request_count + 1,
        updated_at = pg_catalog.now()
    where public.speaking_evaluation_usage.request_count < 5
  returning request_count into v_request_count;

  if not found then
    return pg_catalog.jsonb_build_object('outcome', 'quota_exceeded');
  end if;

  update public.speaking_sessions
  set status = 'processing', error_message = null
  where id = v_session.id;

  return pg_catalog.jsonb_build_object(
    'outcome', 'claimed',
    'user_id', v_session.user_id,
    'session_id', v_session.id,
    'recording_path', v_session.recording_path,
    'duration_seconds', v_session.duration_seconds,
    'topic_id', v_session.topic_id,
    'request_count', v_request_count
  );
end;
$$;

revoke all on function public.claim_speaking_evaluation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_speaking_evaluation(uuid, uuid) to service_role;

commit;
