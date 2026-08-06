-- Adventure Quest — initial schema
-- Pack-agnostic quest engine: events reference quest_packs; "Brew at the Zoo"
-- is seed content, not a special case in the code.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- users
-- Mirrors auth.users; created automatically by trigger on signup.
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, display_name)
  values (new.id, new.email, split_part(coalesce(new.email, 'friend'), '@', 1))
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------- quest packs
create table public.quest_packs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  version int not null default 1,
  is_public boolean not null default true
);

create table public.quests (
  id uuid primary key default gen_random_uuid(),
  quest_pack_id uuid not null references public.quest_packs (id) on delete cascade,
  title text not null,
  description text,
  category text not null default 'general',
  points int not null default 10,
  is_legendary boolean not null default false,
  requires_photo boolean not null default false,
  requires_verification boolean not null default false,
  requires_voting boolean not null default false
);
create index on public.quests (quest_pack_id);

-- --------------------------------------------------------------- events
create type public.event_status as enum ('draft', 'active', 'ended');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.users (id) on delete cascade,
  quest_pack_id uuid not null references public.quest_packs (id),
  name text not null,
  location text,
  event_date date,
  description text,
  cover_photo_url text,
  participant_limit int not null default 20,
  invite_code text not null unique,
  status public.event_status not null default 'draft',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.events (host_id);
create index on public.events (invite_code);

create type public.participant_role as enum ('host', 'participant');

create table public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role public.participant_role not null default 'participant',
  joined_at timestamptz not null default now(),
  unique (event_id, user_id)
);
create index on public.event_participants (event_id);
create index on public.event_participants (user_id);

-- ---------------------------------------------------- participant quests
create type public.pq_status as enum ('drawn', 'active', 'queued', 'completed', 'locked');

create table public.participant_quests (
  id uuid primary key default gen_random_uuid(),
  event_participant_id uuid not null references public.event_participants (id) on delete cascade,
  quest_id uuid not null references public.quests (id),
  status public.pq_status not null default 'drawn',
  drawn_at timestamptz not null default now(),
  activated_at timestamptz,
  unique (event_participant_id, quest_id)
);
create index on public.participant_quests (event_participant_id);

create table public.quest_completions (
  id uuid primary key default gen_random_uuid(),
  participant_quest_id uuid not null unique references public.participant_quests (id) on delete cascade,
  photo_url text,
  screenshot_url text,
  text_note text,
  verified_by uuid references public.users (id),
  completed_at timestamptz not null default now(),
  synced_at timestamptz default now()
);

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  quest_completion_id uuid not null references public.quest_completions (id) on delete cascade,
  voter_id uuid not null references public.users (id) on delete cascade,
  value int not null default 1,
  unique (quest_completion_id, voter_id)
);

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  quest_completion_id uuid not null references public.quest_completions (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  emoji text not null,
  unique (quest_completion_id, user_id, emoji)
);

-- ------------------------------------------------ scrapbook & time capsule
create table public.scrapbooks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events (id) on delete cascade,
  generated_at timestamptz not null default now(),
  stats_json jsonb not null default '{}'::jsonb,
  champion_user_id uuid references public.users (id)
);

create table public.time_capsules (
  id uuid primary key default gen_random_uuid(),
  event_participant_id uuid not null unique references public.event_participants (id) on delete cascade,
  favorite_beer text,
  favorite_brewery text,
  funniest_moment text,
  biggest_surprise text,
  favorite_animal text,
  prediction_next_year text,
  personal_goal text,
  unlock_at timestamptz not null
);

-- ---------------------------------------------------------- achievements
create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  icon text
);

create table public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  earned_at timestamptz not null default now(),
  unique (user_id, achievement_id)
);

insert into public.achievements (code, name, description, icon) values
  ('first_quest',     'First Tracks',      'Complete your first quest.', '🐾'),
  ('ten_quests',      'Pack Animal',       'Complete 10 quests across all events.', '🦁'),
  ('legendary',       'Legend of the Zoo', 'Complete a Legendary Quest.', '⭐'),
  ('champion',        'Champion',          'Finish an event with the most points.', '🏆'),
  ('time_traveler',   'Time Traveler',     'Seal a Time Capsule.', '⏳'),
  ('regular',         'Season Regular',    'Attend 3 events.', '🎪');

-- ------------------------------------------------------------ storage
insert into storage.buckets (id, name, public) values ('photos', 'photos', true)
  on conflict (id) do nothing;

-- ----------------------------------------------------------------- RLS
alter table public.users enable row level security;
alter table public.quest_packs enable row level security;
alter table public.quests enable row level security;
alter table public.events enable row level security;
alter table public.event_participants enable row level security;
alter table public.participant_quests enable row level security;
alter table public.quest_completions enable row level security;
alter table public.votes enable row level security;
alter table public.reactions enable row level security;
alter table public.scrapbooks enable row level security;
alter table public.time_capsules enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;

-- helper: is the current user a participant of this event?
create or replace function public.is_event_member(p_event_id uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.event_participants
    where event_id = p_event_id and user_id = auth.uid()
  );
$$;

-- users: read anyone (display names in scrapbooks), edit only yourself
create policy "users readable" on public.users for select using (true);
create policy "users self-update" on public.users for update using (auth.uid() = id);

-- packs & quests are readable by any signed-in user (needed for pre-caching)
create policy "packs readable" on public.quest_packs for select using (auth.uid() is not null);
create policy "quests readable" on public.quests for select using (auth.uid() is not null);

-- events: members read; hosts insert/update their own
create policy "events member read" on public.events for select
  using (host_id = auth.uid() or public.is_event_member(id));
create policy "events host insert" on public.events for insert
  with check (host_id = auth.uid());
create policy "events host update" on public.events for update
  using (host_id = auth.uid());

-- participants: members of the same event can see each other
create policy "participants member read" on public.event_participants for select
  using (user_id = auth.uid() or public.is_event_member(event_id));

-- participant_quests / completions: readable by event members
create policy "pq member read" on public.participant_quests for select
  using (exists (
    select 1 from public.event_participants ep
    where ep.id = event_participant_id
      and (ep.user_id = auth.uid() or public.is_event_member(ep.event_id))
  ));

create policy "completions member read" on public.quest_completions for select
  using (exists (
    select 1 from public.participant_quests pq
    join public.event_participants ep on ep.id = pq.event_participant_id
    where pq.id = participant_quest_id and public.is_event_member(ep.event_id)
  ));

create policy "votes member read" on public.votes for select using (auth.uid() is not null);
create policy "votes self insert" on public.votes for insert with check (voter_id = auth.uid());
create policy "reactions member read" on public.reactions for select using (auth.uid() is not null);
create policy "reactions self insert" on public.reactions for insert with check (user_id = auth.uid());

create policy "scrapbooks member read" on public.scrapbooks for select
  using (public.is_event_member(event_id));

-- time capsules: only your own, and only after unlock_at (sealed until then)
create policy "capsule owner read when unlocked" on public.time_capsules for select
  using (
    exists (
      select 1 from public.event_participants ep
      where ep.id = event_participant_id and ep.user_id = auth.uid()
    ) and unlock_at <= now()
  );

create policy "achievements readable" on public.achievements for select using (true);
create policy "user achievements readable" on public.user_achievements for select using (true);

-- Writes for joins, drawing, completions, capsules, scrapbooks go through the
-- API layer using the service role, where business rules are enforced
-- (event active, pool of 5, idempotency, legendary trigger, etc).

-- storage: anyone can view photos; uploads go through the API (service role)
create policy "photos public read" on storage.objects for select
  using (bucket_id = 'photos');
