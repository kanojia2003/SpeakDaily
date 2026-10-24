-- Curated speaking bank, saved user filters and persistent seven-topic visit sets.
-- Apply after db/schema.sql and all existing migrations. Seeds never overwrite edits.
begin;

alter table public.speaking_topics
  add column if not exists scenario text not null default 'everyday',
  add column if not exists register text not null default 'neutral',
  add column if not exists keywords text[] not null default '{}';

do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint where conname = 'speaking_topics_scenario_check' and conrelid = 'public.speaking_topics'::regclass) then
    alter table public.speaking_topics add constraint speaking_topics_scenario_check
      check (scenario in ('everyday','interview','workplace','presentation','social','travel','learning','creative','opinion'));
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint where conname = 'speaking_topics_register_check' and conrelid = 'public.speaking_topics'::regclass) then
    alter table public.speaking_topics add constraint speaking_topics_register_check
      check (register in ('neutral','formal','informal'));
  end if;
end;
$$;

-- Enrich original starter rows only if untouched migration defaults remain.
update public.speaking_topics set scenario='everyday', register='informal', keywords=array['daily-life','small-moments','reflection']
where id='1b9e0a20-5d2a-4b67-8e11-000000000001' and scenario='everyday' and register='neutral' and cardinality(keywords)=0;
update public.speaking_topics set scenario='learning', keywords=array['learning','reflection','surprises']
where id='1b9e0a20-5d2a-4b67-8e11-000000000002' and scenario='everyday' and register='neutral' and cardinality(keywords)=0;
update public.speaking_topics set scenario='opinion', register='formal', keywords=array['ideas','skills','community']
where id='1b9e0a20-5d2a-4b67-8e11-000000000003' and scenario='everyday' and register='neutral' and cardinality(keywords)=0;

insert into public.speaking_topics
(id,title,description,prompt,difficulty,category,scenario,register,keywords)
values
('2b9e0a20-5d2a-4b67-8e11-000000000001','A helpful habit','Describe a small habit that makes an ordinary day easier.','What is one small habit that helps your day go well, and how did you develop it?','beginner','Daily life','everyday','neutral',array['daily-life','habits','routines']),
('2b9e0a20-5d2a-4b67-8e11-000000000002','A meal worth sharing','Talk about a meal you enjoy making or sharing.','What meal do you like to share with people, and what makes it special to you?','beginner','Food','social','informal',array['food','cooking','friends']),
('2b9e0a20-5d2a-4b67-8e11-000000000003','A place to unwind','Describe a place where you feel comfortable.','Where do you go when you want a quiet break, and what do you like about that place?','beginner','Places','everyday','neutral',array['places','wellbeing','daily-life']),
('2b9e0a20-5d2a-4b67-8e11-000000000004','A memorable journey','Put a travel experience in order and explain what stood out.','Describe a journey you remember. Where did you go, and what was the most interesting part?','beginner','Travel','travel','neutral',array['travel','storytelling','places']),
('2b9e0a20-5d2a-4b67-8e11-000000000005','A skill in progress','Explain how you are learning or would like to learn a skill.','What skill would you like to improve, and what is one practical step you could take?','beginner','Learning','learning','neutral',array['learning','skills','goals']),
('2b9e0a20-5d2a-4b67-8e11-000000000006','An object with a story','Explain why an everyday object matters to you.','Choose an object you use often. What is its story, and why do you keep it?','beginner','Daily life','everyday','informal',array['objects','storytelling','daily-life']),
('2b9e0a20-5d2a-4b67-8e11-000000000007','A useful recommendation','Give a friend a clear recommendation and a reason.','What book, film, place, or activity would you recommend to a friend, and why?','beginner','Friends','social','informal',array['recommendations','friends','entertainment']),
('2b9e0a20-5d2a-4b67-8e11-000000000008','A weekend plan','Describe a relaxed plan and what you look forward to.','How would you plan a good weekend with a free afternoon?','beginner','Daily life','everyday','informal',array['weekend','plans','daily-life']),
('2b9e0a20-5d2a-4b67-8e11-000000000009','A small act of kindness','Tell a short story about kindness without private details.','Describe a small act of kindness you have seen or experienced and how it affected the moment.','beginner','Community','social','neutral',array['kindness','community','storytelling']),
('2b9e0a20-5d2a-4b67-8e11-000000000010','A surprising discovery','Explain something you learned that changed how you see a familiar subject.','What is something you learned recently that surprised you, and what made it memorable?','beginner','Learning','learning','neutral',array['learning','surprises','reflection']),
('2b9e0a20-5d2a-4b67-8e11-000000000011','A favourite season','Compare activities you enjoy in different seasons.','Which season suits you best, and what do you enjoy doing then?','beginner','Daily life','everyday','neutral',array['seasons','preferences','daily-life']),
('2b9e0a20-5d2a-4b67-8e11-000000000012','A useful app or tool','Explain how a tool helps with a practical task.','What app or tool do you find useful, and how does it make one task simpler?','beginner','Technology','everyday','neutral',array['technology','tools','work']),
('2b9e0a20-5d2a-4b67-8e11-000000000013','A celebration you enjoy','Describe a celebration, its activities and atmosphere.','What kind of celebration do you enjoy, and what usually makes it feel enjoyable?','beginner','Culture','social','informal',array['celebrations','culture','friends']),
('2b9e0a20-5d2a-4b67-8e11-000000000014','A good conversation','Reflect on what makes a conversation comfortable.','What helps you feel comfortable in a conversation with someone new?','beginner','Communication','social','neutral',array['communication','friends','confidence']),
('2b9e0a20-5d2a-4b67-8e11-000000000015','A place to visit','Suggest a destination and explain what a visitor could enjoy.','What place would you suggest someone visit in your region, and what could they do there?','beginner','Travel','travel','neutral',array['travel','places','recommendations']),
('2b9e0a20-5d2a-4b67-8e11-000000000016','A project you completed','Summarize a project, your role, and what you learned.','Tell us about a project you completed. What was your goal, and what did you learn?','intermediate','Interview','interview','formal',array['interview','projects','achievements']),
('2b9e0a20-5d2a-4b67-8e11-000000000017','A strength at work','Support a professional strength with a concrete example.','What strength do you bring to a team, and when have you used it effectively?','intermediate','Interview','interview','formal',array['interview','strengths','work']),
('2b9e0a20-5d2a-4b67-8e11-000000000018','A thoughtful disagreement','Practise disagreeing politely and explaining your reasoning.','How would you respond respectfully if a colleague suggested an approach you disagreed with?','intermediate','Workplace','workplace','formal',array['work','communication','teamwork']),
('2b9e0a20-5d2a-4b67-8e11-000000000019','A meeting update','Give a concise update with progress, a challenge, and a next step.','Give a short update about a project: what moved forward, what is blocking progress, and what comes next?','intermediate','Workplace','workplace','formal',array['work','meetings','projects']),
('2b9e0a20-5d2a-4b67-8e11-000000000020','Learning from a challenge','Describe a manageable challenge and the steps you took.','Describe a challenge you faced at work or in a project and how you approached it.','intermediate','Interview','interview','formal',array['interview','challenges','problem-solving']),
('2b9e0a20-5d2a-4b67-8e11-000000000021','Explaining a decision','State context and reasons to make a decision easy to follow.','Describe a decision you made after weighing a few options. What factors mattered most?','intermediate','Workplace','workplace','formal',array['work','decisions','reasoning']),
('2b9e0a20-5d2a-4b67-8e11-000000000022','A helpful piece of feedback','Explain how feedback can be used constructively.','What kind of feedback helps you improve, and how do you put it into practice?','intermediate','Workplace','workplace','formal',array['work','feedback','learning']),
('2b9e0a20-5d2a-4b67-8e11-000000000023','A professional introduction','Introduce your experience and interests concisely.','Imagine meeting a new professional contact. How would you introduce your work or studies?','beginner','Workplace','workplace','formal',array['work','introductions','networking']),
('2b9e0a20-5d2a-4b67-8e11-000000000024','A question for an interviewer','Practise asking a concise question in an interview setting.','At the end of an interview, what would you like to ask about the role or team, and why?','intermediate','Interview','interview','formal',array['interview','questions','work']),
('2b9e0a20-5d2a-4b67-8e11-000000000025','A short project proposal','Present an idea with purpose, benefits, and a practical first step.','Propose a small improvement for a team or organisation. What problem would it solve?','intermediate','Presentation','presentation','formal',array['work','ideas','presentations']),
('2b9e0a20-5d2a-4b67-8e11-000000000026','Explaining a process','Describe a process in an order a new colleague can follow.','Explain how to complete a familiar task at work or school, step by step.','intermediate','Workplace','workplace','formal',array['work','instructions','teaching']),
('2b9e0a20-5d2a-4b67-8e11-000000000027','A team contribution','Describe a contribution and connect it to a shared goal.','Tell a short story about a time you helped a group make progress toward a goal.','intermediate','Interview','interview','formal',array['interview','teamwork','achievements']),
('2b9e0a20-5d2a-4b67-8e11-000000000028','A clear presentation opening','Open a short presentation by introducing its subject and purpose.','Give a brief opening for a presentation about a skill or subject you know well.','intermediate','Presentation','presentation','formal',array['presentations','introductions','ideas']),
('2b9e0a20-5d2a-4b67-8e11-000000000029','A customer request','Respond professionally to a reasonable customer request.','A customer asks for help understanding a service. How would you clarify their need and explain the next step?','intermediate','Workplace','workplace','formal',array['work','customer-service','communication']),
('2b9e0a20-5d2a-4b67-8e11-000000000030','A useful workplace change','Explain a practical change and how you would introduce it.','What small change could make a shared workplace or study routine more effective?','intermediate','Workplace','workplace','formal',array['work','improvements','ideas']),
('2b9e0a20-5d2a-4b67-8e11-000000000031','A friendly invitation','Invite someone to an activity and make the plan clear.','Invite a friend to do something together this weekend. What would you suggest and when?','beginner','Friends','social','informal',array['friends','invitations','plans']),
('2b9e0a20-5d2a-4b67-8e11-000000000032','Catching up with a friend','Share a recent highlight in a relaxed conversation.','Imagine a friend asks, “What have you been up to?” What would you tell them?','beginner','Friends','social','informal',array['friends','daily-life','storytelling']),
('2b9e0a20-5d2a-4b67-8e11-000000000033','Choosing a group activity','Suggest an activity while considering different preferences.','Your friends have different ideas for a group outing. Suggest a plan that could work for everyone.','intermediate','Friends','social','informal',array['friends','plans','negotiation']),
('2b9e0a20-5d2a-4b67-8e11-000000000034','A polite change of plans','Explain a change clearly and suggest another option.','You need to reschedule a casual plan. What would you say to your friend?','beginner','Friends','social','informal',array['friends','communication','plans']),
('2b9e0a20-5d2a-4b67-8e11-000000000035','A hobby to try together','Describe a hobby and invite someone to try it.','What activity would you like to try with a friend, and how would you encourage them to join?','beginner','Friends','social','informal',array['friends','hobbies','invitations']),
('2b9e0a20-5d2a-4b67-8e11-000000000036','A memorable local event','Recount an event by describing its atmosphere and one highlight.','Talk about a public event, market, or performance you enjoyed or would like to attend.','intermediate','Culture','social','neutral',array['culture','events','community']),
('2b9e0a20-5d2a-4b67-8e11-000000000037','Asking for directions','Practise a polite request for directions and a confirming question.','You are visiting an unfamiliar area. How would you ask someone for directions to a nearby place?','beginner','Travel','travel','formal',array['travel','directions','politeness']),
('2b9e0a20-5d2a-4b67-8e11-000000000038','Checking into accommodation','Explain a booking and ask about a practical detail.','You arrive at a hotel or guesthouse. What would you say at check-in and what might you ask?','beginner','Travel','travel','formal',array['travel','accommodation','customer-service']),
('2b9e0a20-5d2a-4b67-8e11-000000000039','A day-trip itinerary','Plan a simple itinerary and explain why its order makes sense.','Plan a day trip for a visitor. Where would you go first, and how would you spend the day?','intermediate','Travel','travel','neutral',array['travel','planning','places']),
('2b9e0a20-5d2a-4b67-8e11-000000000040','A travel preference','Compare two ways of travelling and explain your preference.','For a short trip, would you rather plan each detail or explore as you go? Explain your choice.','intermediate','Travel','travel','neutral',array['travel','preferences','comparison']),
('2b9e0a20-5d2a-4b67-8e11-000000000041','A language-learning routine','Describe a realistic routine for practising a language.','What short, repeatable activity could help someone practise a language during a busy week?','intermediate','Learning','learning','neutral',array['learning','languages','routines']),
('2b9e0a20-5d2a-4b67-8e11-000000000042','A skill you can teach','Break a familiar skill into clear steps for a beginner.','Choose something you know how to do and explain the first steps to someone learning it.','intermediate','Learning','learning','neutral',array['learning','teaching','skills']),
('2b9e0a20-5d2a-4b67-8e11-000000000043','An idea that stayed with you','Summarize an idea and explain why it stayed in your mind.','Describe an idea from a book, article, lesson, or conversation that you still think about.','intermediate','Learning','learning','neutral',array['learning','books','ideas']),
('2b9e0a20-5d2a-4b67-8e11-000000000044','Learning from a mistake','Reflect on a low-stakes mistake and the practical lesson it offered.','Describe a small mistake that taught you a useful lesson. What would you do differently now?','intermediate','Reflection','learning','neutral',array['learning','reflection','problem-solving']),
('2b9e0a20-5d2a-4b67-8e11-000000000045','A useful question','Explain how a thoughtful question can improve understanding.','What question do you ask when you want to understand a new topic more clearly?','intermediate','Learning','learning','neutral',array['learning','communication','curiosity']),
('2b9e0a20-5d2a-4b67-8e11-000000000046','An idea for a short talk','Organise a short talk around one idea and two supporting points.','Give a one-minute talk about an everyday skill you think is worth learning.','intermediate','Presentation','presentation','formal',array['presentations','skills','ideas']),
('2b9e0a20-5d2a-4b67-8e11-000000000047','A balanced recommendation','Recommend an option and note who may prefer another choice.','Recommend a way to spend a free afternoon, and mention who might enjoy it most.','intermediate','Ideas','opinion','neutral',array['recommendations','reasoning','leisure']),
('2b9e0a20-5d2a-4b67-8e11-000000000048','A change in your community','Suggest a modest improvement to a shared public space or service.','What small improvement could make a neighbourhood or community space more welcoming?','intermediate','Community','opinion','formal',array['community','improvements','ideas']),
('2b9e0a20-5d2a-4b67-8e11-000000000049','A useful technology habit','Discuss a practical way to use technology with intention.','What is one technology habit that helps you stay focused or organised?','intermediate','Technology','opinion','neutral',array['technology','habits','focus']),
('2b9e0a20-5d2a-4b67-8e11-000000000050','A public transport improvement','Make a reasoned suggestion about a transport experience.','What change could make public transport easier for people in a city or town?','advanced','Community','opinion','formal',array['community','transport','policy']),
('2b9e0a20-5d2a-4b67-8e11-000000000051','A fair meeting format','Propose a meeting structure that gives people room to contribute.','How could a team meeting stay focused and give everyone a chance to speak?','advanced','Workplace','workplace','formal',array['work','meetings','facilitation']),
('2b9e0a20-5d2a-4b67-8e11-000000000052','A project setback','Explain a setback, its impact, and a responsible recovery plan.','A project has fallen behind schedule. Give a calm update and describe the next steps you would propose.','advanced','Workplace','workplace','formal',array['work','projects','problem-solving']),
('2b9e0a20-5d2a-4b67-8e11-000000000053','A proposal with trade-offs','Present a proposal while acknowledging a reasonable limitation.','Suggest a new approach to a recurring task. What benefit would it bring, and what trade-off should the team consider?','advanced','Presentation','presentation','formal',array['work','presentations','reasoning']),
('2b9e0a20-5d2a-4b67-8e11-000000000054','A difficult interview question','Answer directly, give context, and keep a professional tone.','In an interview, you are asked about an area you are still developing. How would you answer honestly and constructively?','advanced','Interview','interview','formal',array['interview','confidence','communication']),
('2b9e0a20-5d2a-4b67-8e11-000000000055','Explaining a complex idea','Make a complex subject understandable with an example.','Choose a subject you know and explain one of its ideas to someone encountering it for the first time.','advanced','Presentation','presentation','formal',array['presentations','teaching','clarity']),
('2b9e0a20-5d2a-4b67-8e11-000000000056','A respectful boundary','Practise a polite, clear response when you need to decline a request.','Someone asks you to take on a task you cannot fit in. How would you explain that and offer an alternative if possible?','advanced','Workplace','workplace','formal',array['work','communication','boundaries']),
('2b9e0a20-5d2a-4b67-8e11-000000000057','A cultural custom','Describe a custom as an observation, not a universal rule.','Talk about a custom or tradition you have encountered. What might a visitor find interesting?','intermediate','Culture','social','neutral',array['culture','traditions','travel']),
('2b9e0a20-5d2a-4b67-8e11-000000000058','A creative solution','Explain how you might approach a practical problem in a new way.','A shared space is often noisy when people need to focus. Suggest a few practical improvements.','advanced','Ideas','creative','neutral',array['creativity','problem-solving','community']),
('2b9e0a20-5d2a-4b67-8e11-000000000059','A product improvement','Describe a product improvement and who would benefit.','Choose an everyday product or service and suggest one change that would make it easier to use.','advanced','Ideas','creative','formal',array['creativity','products','improvements']),
('2b9e0a20-5d2a-4b67-8e11-000000000060','A plan for a group decision','Help a group compare options and agree on a practical next step.','A group needs to choose between several activities with a limited budget. How would you help them decide?','advanced','Friends','social','informal',array['friends','planning','negotiation']),
('2b9e0a20-5d2a-4b67-8e11-000000000061','Why this role interests you','Connect a role''s responsibilities with your experience and interests.','In an interview, how would you explain why this kind of role interests you?','beginner','Interview','interview','formal',array['interview','career','goals']),
('2b9e0a20-5d2a-4b67-8e11-000000000062','A presentation with a clear takeaway','Summarize a subject and leave listeners with one memorable point.','Give a short presentation about a subject you know. What is the one idea you want listeners to remember?','intermediate','Presentation','presentation','formal',array['presentations','communication','clarity']),
('2b9e0a20-5d2a-4b67-8e11-000000000063','Comparing two proposals','Compare options using clear criteria and a reasoned conclusion.','A team is considering two ways to organise a task. How would you compare the options and recommend one?','advanced','Presentation','presentation','formal',array['presentations','work','reasoning']),
('2b9e0a20-5d2a-4b67-8e11-000000000064','Ordering at a local café','Practise a polite order and a simple follow-up question.','You are at a café in an unfamiliar place. How would you order a drink and ask about a menu item?','beginner','Travel','travel','formal',array['travel','food','politeness']),
('2b9e0a20-5d2a-4b67-8e11-000000000065','A more useful waiting room','Suggest a thoughtful change to a shared waiting space.','How could a waiting room be made more comfortable or useful for different visitors?','intermediate','Design','creative','neutral',array['creativity','design','community']),
('2b9e0a20-5d2a-4b67-8e11-000000000066','A rainy-day activity','Invent an enjoyable activity using ordinary materials or spaces.','Plan an indoor activity for a rainy afternoon that a small group could enjoy together.','beginner','Creative practice','creative','informal',array['creativity','friends','leisure']),
('2b9e0a20-5d2a-4b67-8e11-000000000067','An event with a theme','Create a simple theme for a community event and explain its appeal.','Suggest a theme for a small community event. What could people do there, and who might enjoy it?','intermediate','Creative practice','creative','neutral',array['creativity','events','community']),
('2b9e0a20-5d2a-4b67-8e11-000000000068','A clearer set of instructions','Rework confusing instructions into a simple explanation.','Choose a familiar task and explain how you would make its instructions easier for a beginner to follow.','intermediate','Creative practice','creative','neutral',array['creativity','teaching','clarity']),
('2b9e0a20-5d2a-4b67-8e11-000000000069','A new use for an underused space','Imagine a practical new use for a shared space.','A public room is rarely used. What welcoming activity or purpose could make better use of it?','advanced','Creative practice','creative','formal',array['creativity','community','ideas']),
('2b9e0a20-5d2a-4b67-8e11-000000000070','A balanced view of remote work','Discuss benefits and trade-offs without treating one choice as right for everyone.','What are some benefits and challenges of remote work, and what might help people choose what suits them?','advanced','Work','opinion','formal',array['work','opinions','comparison']),
('2b9e0a20-5d2a-4b67-8e11-000000000071','A practical library service','Suggest a library service that could help more people use it.','What service or activity could help a local library welcome people with different interests?','intermediate','Community','opinion','formal',array['community','learning','ideas'])
on conflict (id) do nothing;

create index if not exists speaking_topics_filter_rotation_idx
  on public.speaking_topics (scenario, register, difficulty)
  where is_active;
create index if not exists speaking_sessions_user_topic_idx
  on public.speaking_sessions (user_id, topic_id)
  where topic_id is not null;

create table if not exists public.user_topic_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  scenario text not null default 'any' check (scenario in ('any','everyday','interview','workplace','presentation','social','travel','learning','creative','opinion')),
  register text not null default 'any' check (register in ('any','neutral','formal','informal')),
  difficulty text not null default 'any' check (difficulty in ('any','beginner','intermediate','advanced')),
  interests text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_topic_preferences_interests_limit check (cardinality(interests) <= 5)
);
drop trigger if exists user_topic_preferences_set_updated_at on public.user_topic_preferences;
create trigger user_topic_preferences_set_updated_at before update on public.user_topic_preferences
for each row execute function public.set_updated_at();

alter table public.user_topic_preferences enable row level security;
revoke all on table public.user_topic_preferences from public, anon, authenticated;
grant select on table public.user_topic_preferences to authenticated;
grant insert (user_id, scenario, register, difficulty, interests) on table public.user_topic_preferences to authenticated;
-- PostgREST upsert includes user_id in its ON CONFLICT UPDATE target list.
-- The owner-only UPDATE policy below prevents changing it to another user's id.
grant update (user_id, scenario, register, difficulty, interests) on table public.user_topic_preferences to authenticated;
drop policy if exists user_topic_preferences_select_own on public.user_topic_preferences;
create policy user_topic_preferences_select_own on public.user_topic_preferences for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists user_topic_preferences_insert_own on public.user_topic_preferences;
create policy user_topic_preferences_insert_own on public.user_topic_preferences for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists user_topic_preferences_update_own on public.user_topic_preferences;
create policy user_topic_preferences_update_own on public.user_topic_preferences for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

-- A visit UUID is retained in sessionStorage so refreshes return the same set.
create table if not exists public.practice_topic_visits (
  user_id uuid not null references auth.users (id) on delete cascade,
  visit_id uuid not null,
  topic_ids uuid[] not null default '{}',
  cycle_started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id,visit_id),
  constraint practice_topic_visits_limit check (cardinality(topic_ids)<=7)
);
alter table public.practice_topic_visits add column if not exists cycle_started_at timestamptz not null default now();
alter table public.practice_topic_visits enable row level security;
revoke all on table public.practice_topic_visits from public, anon, authenticated;
grant select on table public.practice_topic_visits to authenticated;
grant all on table public.practice_topic_visits to service_role;
drop policy if exists practice_topic_visits_select_own on public.practice_topic_visits;
create policy practice_topic_visits_select_own on public.practice_topic_visits for select to authenticated using ((select auth.uid())=user_id);

create table if not exists public.user_topic_rotation_state (
  user_id uuid not null references auth.users (id) on delete cascade,
  filter_key text not null,
  cycle_started_at timestamptz not null default now(),
  primary key (user_id,filter_key)
);
alter table public.user_topic_rotation_state enable row level security;
revoke all on table public.user_topic_rotation_state from public,anon,authenticated;
grant all on table public.user_topic_rotation_state to service_role;

create or replace function public.get_practice_topic_set(p_visit_id uuid)
returns setof public.speaking_topics
language plpgsql security definer set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
  v_scenario text := 'any';
  v_register text := 'any';
  v_difficulty text := 'any';
  v_interests text[] := array[]::text[];
  v_filter_key text;
  v_cycle_started_at timestamptz;
  v_visit_cycle_started_at timestamptz;
  v_matching_count bigint := 0;
  v_practised_count bigint := 0;
  v_ids uuid[] := array[]::uuid[];
  v_kept uuid[] := array[]::uuid[];
  v_remaining bigint := 0;
begin
  if v_user_id is null or p_visit_id is null then
    raise exception 'authentication_required' using errcode='42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text,0));

  select p.scenario,p.register,p.difficulty,p.interests into v_scenario,v_register,v_difficulty,v_interests
  from public.user_topic_preferences p where p.user_id=v_user_id;
  if not found then
    v_scenario := 'any';
    v_register := 'any';
    v_difficulty := 'any';
    v_interests := array[]::text[];
  end if;

  select coalesce(pg_catalog.array_agg(distinct pg_catalog.lower(pg_catalog.btrim(item)) order by pg_catalog.lower(pg_catalog.btrim(item))),array[]::text[])
  into v_interests from pg_catalog.unnest(v_interests) as input(item);
  v_filter_key := v_scenario||'|'||v_register||'|'||v_difficulty||'|'||pg_catalog.array_to_string(v_interests,',');

  insert into public.user_topic_rotation_state(user_id,filter_key,cycle_started_at)
  values(
    v_user_id,
    v_filter_key,
    coalesce((
      select pg_catalog.min(s.created_at) from public.speaking_sessions s
      where s.user_id=v_user_id and (s.status<>'pending' or s.recording_path is not null)
    ),pg_catalog.now())
  )
  on conflict(user_id,filter_key) do nothing;
  select state.cycle_started_at into v_cycle_started_at
  from public.user_topic_rotation_state state
  where state.user_id=v_user_id and state.filter_key=v_filter_key for update;

  select pg_catalog.count(*) into v_matching_count from public.speaking_topics t
  where t.is_active and (v_scenario='any' or t.scenario=v_scenario)
    and (v_register='any' or t.register=v_register) and (v_difficulty='any' or t.difficulty=v_difficulty)
    and (pg_catalog.cardinality(v_interests)=0 or t.keywords && v_interests or pg_catalog.lower(t.category)=any(v_interests));
  select pg_catalog.count(distinct t.id) into v_practised_count from public.speaking_topics t
  where t.is_active and (v_scenario='any' or t.scenario=v_scenario)
    and (v_register='any' or t.register=v_register) and (v_difficulty='any' or t.difficulty=v_difficulty)
    and (pg_catalog.cardinality(v_interests)=0 or t.keywords && v_interests or pg_catalog.lower(t.category)=any(v_interests))
    and exists(select 1 from public.speaking_sessions s where s.user_id=v_user_id and s.topic_id=t.id
      and s.created_at>=v_cycle_started_at and (s.status<>'pending' or s.recording_path is not null));
  if v_matching_count>0 and v_practised_count=v_matching_count then
    update public.user_topic_rotation_state set cycle_started_at=pg_catalog.now()
    where user_id=v_user_id and filter_key=v_filter_key returning cycle_started_at into v_cycle_started_at;
  end if;

  insert into public.practice_topic_visits(user_id,visit_id) values(v_user_id,p_visit_id)
  on conflict(user_id,visit_id) do nothing;
  select v.topic_ids,v.cycle_started_at into v_ids,v_visit_cycle_started_at from public.practice_topic_visits v
  where v.user_id=v_user_id and v.visit_id=p_visit_id for update;
  if v_visit_cycle_started_at is distinct from v_cycle_started_at then v_ids:=array[]::uuid[]; end if;

  select coalesce(pg_catalog.array_agg(x.topic_id order by x.position),array[]::uuid[]) into v_kept
  from pg_catalog.unnest(v_ids) with ordinality x(topic_id,position)
  join public.speaking_topics t on t.id=x.topic_id and t.is_active
  where (v_scenario='any' or t.scenario=v_scenario)
    and (v_register='any' or t.register=v_register)
    and (v_difficulty='any' or t.difficulty=v_difficulty)
    and (pg_catalog.cardinality(v_interests)=0 or t.keywords && v_interests or pg_catalog.lower(t.category)=any(v_interests))
    and not exists(select 1 from public.speaking_sessions s where s.user_id=v_user_id and s.topic_id=t.id
      and s.created_at>=v_cycle_started_at and (s.status<>'pending' or s.recording_path is not null));

  select pg_catalog.count(*) into v_remaining from public.speaking_topics t
  where t.is_active and (v_scenario='any' or t.scenario=v_scenario)
    and (v_register='any' or t.register=v_register) and (v_difficulty='any' or t.difficulty=v_difficulty)
    and (pg_catalog.cardinality(v_interests)=0 or t.keywords && v_interests or pg_catalog.lower(t.category)=any(v_interests))
    and not exists(select 1 from public.speaking_sessions s where s.user_id=v_user_id and s.topic_id=t.id
      and s.created_at>=v_cycle_started_at and (s.status<>'pending' or s.recording_path is not null));

  v_ids:=v_kept;
  if v_remaining>0 and pg_catalog.cardinality(v_ids)<7 then
    v_ids:=v_ids||coalesce((
      select pg_catalog.array_agg(c.id order by c.sort_key) from (
        select t.id,pg_catalog.md5(t.id::text||p_visit_id::text||v_cycle_started_at::text) sort_key
        from public.speaking_topics t
        where t.is_active and (v_scenario='any' or t.scenario=v_scenario)
          and (v_register='any' or t.register=v_register) and (v_difficulty='any' or t.difficulty=v_difficulty)
          and (pg_catalog.cardinality(v_interests)=0 or t.keywords && v_interests or pg_catalog.lower(t.category)=any(v_interests))
          and not(t.id=any(v_ids))
          and not exists(select 1 from public.speaking_sessions s where s.user_id=v_user_id and s.topic_id=t.id
            and s.created_at>=v_cycle_started_at and (s.status<>'pending' or s.recording_path is not null))
        order by sort_key limit (7-pg_catalog.cardinality(v_ids))
      ) c
    ),array[]::uuid[]);
  end if;

  update public.practice_topic_visits set topic_ids=v_ids,cycle_started_at=v_cycle_started_at,updated_at=pg_catalog.now()
  where user_id=v_user_id and visit_id=p_visit_id;
  return query
  select t.* from pg_catalog.unnest(v_ids) with ordinality a(topic_id,position)
  join public.speaking_topics t on t.id=a.topic_id and t.is_active
  order by a.position;
end;
$$;
revoke all on function public.get_practice_topic_set(uuid) from public,anon,authenticated;
grant execute on function public.get_practice_topic_set(uuid) to authenticated;

commit;
