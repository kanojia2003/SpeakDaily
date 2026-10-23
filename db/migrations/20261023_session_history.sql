-- Persist a topic title with each session so history remains readable if a
-- topic is later deactivated, edited, or deleted. Safe to apply more than once.
begin;

alter table public.speaking_sessions
  add column if not exists topic_title text;

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

commit;
