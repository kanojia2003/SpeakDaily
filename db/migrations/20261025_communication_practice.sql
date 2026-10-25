-- Separate, AI-generated communication lessons whose answers reuse speaking_sessions.
-- Apply after all existing schema migrations, including personalized topic rotation.
begin;

create table if not exists public.communication_practice_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  request_key uuid not null,
  scenario text not null check (scenario in ('everyday','interview','workplace','presentation','social','travel','learning','creative','opinion')),
  register text not null check (register in ('neutral','formal','informal')),
  difficulty text not null check (difficulty in ('beginner','intermediate','advanced')),
  context text,
  status text not null default 'generating' check (status in ('generating','ready','failed')),
  questions jsonb not null default '[]'::jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint communication_practice_questions_shape check (
    jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) <= 4
  ),
  constraint communication_practice_context_length check (context is null or char_length(context) <= 300),
  unique (user_id, request_key),
  unique (id, user_id)
);

create table if not exists public.communication_practice_generation_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  request_count integer not null default 0 check (request_count between 0 and 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.communication_practice_runs enable row level security;
alter table public.communication_practice_generation_usage enable row level security;
revoke all on table public.communication_practice_runs from public, anon, authenticated;
revoke all on table public.communication_practice_generation_usage from public, anon, authenticated;
grant select on table public.communication_practice_runs to authenticated;
grant all on table public.communication_practice_runs to service_role;
grant all on table public.communication_practice_generation_usage to service_role;

drop policy if exists communication_practice_runs_select_own on public.communication_practice_runs;
create policy communication_practice_runs_select_own
  on public.communication_practice_runs for select to authenticated
  using ((select auth.uid()) = user_id);

drop trigger if exists communication_practice_runs_set_updated_at on public.communication_practice_runs;
create trigger communication_practice_runs_set_updated_at before update on public.communication_practice_runs
for each row execute function public.set_updated_at();

alter table public.speaking_sessions
  add column if not exists communication_practice_run_id uuid,
  add column if not exists communication_question_index smallint;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint where conname='speaking_sessions_communication_run_fkey' and conrelid='public.speaking_sessions'::regclass) then
    alter table public.speaking_sessions add constraint speaking_sessions_communication_run_fkey
      foreign key (communication_practice_run_id,user_id)
      references public.communication_practice_runs(id,user_id) on delete cascade;
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint where conname='speaking_sessions_communication_question_check' and conrelid='public.speaking_sessions'::regclass) then
    alter table public.speaking_sessions add constraint speaking_sessions_communication_question_check
      check ((communication_practice_run_id is null and communication_question_index is null)
        or (communication_practice_run_id is not null and communication_question_index between 0 and 3 and topic_id is null));
  end if;
end;
$$;

create unique index if not exists speaking_sessions_communication_question_uidx
  on public.speaking_sessions (communication_practice_run_id, communication_question_index)
  where communication_practice_run_id is not null;
create index if not exists communication_practice_runs_user_created_idx
  on public.communication_practice_runs (user_id, created_at desc);

-- Session title and evaluation prompt are snapshotted from the server-generated lesson.
create or replace function public.snapshot_speaking_session_topic_title()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_question jsonb;
begin
  if new.communication_practice_run_id is not null then
    select r.questions -> new.communication_question_index into v_question
    from public.communication_practice_runs r
    where r.id = new.communication_practice_run_id
      and r.user_id = new.user_id and r.status = 'ready';
    if v_question is null or pg_catalog.jsonb_typeof(v_question) <> 'object'
      or pg_catalog.jsonb_typeof(v_question -> 'title') <> 'string'
      or pg_catalog.jsonb_typeof(v_question -> 'prompt') <> 'string' then
      raise exception 'communication_question_unavailable' using errcode = '23514';
    end if;
    new.topic_title := v_question ->> 'title';
  elsif new.topic_id is not null then
    select t.title into new.topic_title from public.speaking_topics t where t.id = new.topic_id;
  else
    new.topic_title := null;
  end if;
  return new;
end;
$$;
revoke all on function public.snapshot_speaking_session_topic_title() from public, anon, authenticated;

revoke insert (communication_practice_run_id, communication_question_index) on table public.speaking_sessions from public, anon, authenticated;
grant insert (communication_practice_run_id, communication_question_index) on table public.speaking_sessions to authenticated;

drop policy if exists speaking_sessions_insert_own_pending on public.speaking_sessions;
create policy speaking_sessions_insert_own_pending
  on public.speaking_sessions for insert to authenticated
  with check (
    (select auth.uid()) = user_id and status = 'pending'
    and duration_seconds between 1 and 120
    and (
      (communication_practice_run_id is null and communication_question_index is null)
      or (
        topic_id is null and communication_practice_run_id is not null
        and communication_question_index between 0 and 3
        and exists (
          select 1 from public.communication_practice_runs r
          where r.id = communication_practice_run_id and r.user_id = user_id
            and r.status = 'ready'
            and communication_question_index < pg_catalog.jsonb_array_length(r.questions)
        )
      )
    )
  );

-- Server-only, serialized idempotency + daily generation quota reservation.
create or replace function public.reserve_communication_practice_run(
  p_user_id uuid, p_request_key uuid, p_scenario text, p_register text,
  p_difficulty text, p_context text
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_run public.communication_practice_runs%rowtype;
  v_request_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 19));
  select * into v_run from public.communication_practice_runs
    where user_id=p_user_id and request_key=p_request_key;
  if found then
    return pg_catalog.jsonb_build_object('outcome','existing','run_id',v_run.id,'status',v_run.status,'questions',v_run.questions,'error_code',v_run.error_code);
  end if;
  insert into public.communication_practice_generation_usage(user_id,usage_date,request_count)
  values(p_user_id,(pg_catalog.now() at time zone 'utc')::date,1)
  on conflict(user_id,usage_date) do update
    set request_count=public.communication_practice_generation_usage.request_count+1,updated_at=pg_catalog.now()
    where public.communication_practice_generation_usage.request_count < 2
  returning request_count into v_request_count;
  if not found then return pg_catalog.jsonb_build_object('outcome','quota_exceeded'); end if;
  insert into public.communication_practice_runs(user_id,request_key,scenario,register,difficulty,context)
  values(p_user_id,p_request_key,p_scenario,p_register,p_difficulty,nullif(pg_catalog.btrim(p_context),''))
  returning * into v_run;
  return pg_catalog.jsonb_build_object('outcome','claimed','run_id',v_run.id,'status',v_run.status);
end;
$$;

create or replace function public.finish_communication_practice_run(
  p_run_id uuid, p_user_id uuid, p_questions jsonb, p_error_code text
)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_questions is not null and (pg_catalog.jsonb_typeof(p_questions)<>'array' or pg_catalog.jsonb_array_length(p_questions)<>4) then
    raise exception 'invalid_questions' using errcode = '22023';
  end if;
  update public.communication_practice_runs
    set status=case when p_questions is null then 'failed' else 'ready' end,
        questions=coalesce(p_questions,'[]'::jsonb), error_code=p_error_code
    where id=p_run_id and user_id=p_user_id and status='generating';
  return found;
end;
$$;

revoke all on function public.reserve_communication_practice_run(uuid,uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.finish_communication_practice_run(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.reserve_communication_practice_run(uuid,uuid,text,text,text,text) to service_role;
grant execute on function public.finish_communication_practice_run(uuid,uuid,jsonb,text) to service_role;

-- Extend the existing atomic evaluation claim with the generated question reference.
create or replace function public.claim_speaking_evaluation(p_session_id uuid, p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_session public.speaking_sessions%rowtype;
  v_request_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
  select * into v_session from public.speaking_sessions where id=p_session_id for update;
  if not found or v_session.user_id<>p_user_id then return pg_catalog.jsonb_build_object('outcome','not_found'); end if;
  if v_session.status='completed' then return pg_catalog.jsonb_build_object('outcome','completed');
  elsif v_session.status='processing' then return pg_catalog.jsonb_build_object('outcome','processing');
  elsif v_session.status='failed' then return pg_catalog.jsonb_build_object('outcome','failed'); end if;
  if v_session.status<>'pending' or v_session.recording_path is null
    or v_session.duration_seconds<1 or v_session.duration_seconds>120
    or pg_catalog.split_part(v_session.recording_path,'/',1)<>v_session.user_id::text
    or pg_catalog.split_part(v_session.recording_path,'/',2)<>v_session.id::text
    or pg_catalog.cardinality(pg_catalog.string_to_array(v_session.recording_path,'/'))<>3 then
    return pg_catalog.jsonb_build_object('outcome','ineligible');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_session.user_id::text,0));
  insert into public.speaking_evaluation_usage(user_id,usage_date,request_count)
  values(v_session.user_id,(pg_catalog.now() at time zone 'utc')::date,1)
  on conflict(user_id,usage_date) do update
    set request_count=public.speaking_evaluation_usage.request_count+1,updated_at=pg_catalog.now()
    where public.speaking_evaluation_usage.request_count<5
  returning request_count into v_request_count;
  if not found then return pg_catalog.jsonb_build_object('outcome','quota_exceeded'); end if;
  update public.speaking_sessions set status='processing',error_message=null where id=v_session.id;
  return pg_catalog.jsonb_build_object(
    'outcome','claimed','user_id',v_session.user_id,'session_id',v_session.id,
    'recording_path',v_session.recording_path,'duration_seconds',v_session.duration_seconds,
    'topic_id',v_session.topic_id,'communication_practice_run_id',v_session.communication_practice_run_id,
    'communication_question_index',v_session.communication_question_index,'request_count',v_request_count
  );
end;
$$;
revoke all on function public.claim_speaking_evaluation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_speaking_evaluation(uuid,uuid) to service_role;

commit;
