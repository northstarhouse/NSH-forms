-- Run this in the Supabase SQL Editor
-- If you ran a previous version, drop old tables first:
--   drop table if exists vol_slot_signups cascade;
--   drop table if exists vol_shift_slots cascade;
--   drop table if exists vol_shift_boards cascade;
--   drop table if exists vol_event_responses cascade;
--   drop table if exists vol_events cascade;
--   drop table if exists vol_poll_votes cascade;
--   drop table if exists vol_polls cascade;

-- Events (both RSVP and shift signup — same table, different type)
create table if not exists vol_events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  date text,
  time text,
  description text,
  event_type text default 'rsvp',  -- 'rsvp' or 'shift'
  created_at timestamptz default now()
);

-- RSVP responses (used when event_type = 'rsvp')
create table if not exists vol_event_responses (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references vol_events(id) on delete cascade,
  name text not null,
  response text not null,
  created_at timestamptz default now()
);

-- Shift slots (used when event_type = 'shift')
create table if not exists vol_shift_slots (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references vol_events(id) on delete cascade,
  time_label text,
  duration text,
  role text,
  spots integer,
  sort_order integer default 0
);

create table if not exists vol_slot_signups (
  id uuid default gen_random_uuid() primary key,
  slot_id uuid references vol_shift_slots(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

-- Polls
create table if not exists vol_polls (
  id uuid default gen_random_uuid() primary key,
  question text not null,
  options text[] not null,
  created_at timestamptz default now()
);

create table if not exists vol_poll_votes (
  id uuid default gen_random_uuid() primary key,
  poll_id uuid references vol_polls(id) on delete cascade,
  name text not null,
  option text not null,
  created_at timestamptz default now()
);

-- RLS
alter table vol_events enable row level security;
alter table vol_event_responses enable row level security;
alter table vol_shift_slots enable row level security;
alter table vol_slot_signups enable row level security;
alter table vol_polls enable row level security;
alter table vol_poll_votes enable row level security;

create policy "public read"   on vol_events           for select using (true);
create policy "public insert" on vol_events           for insert with check (true);
create policy "public delete" on vol_events           for delete using (true);
create policy "public read"   on vol_event_responses  for select using (true);
create policy "public insert" on vol_event_responses  for insert with check (true);
create policy "public read"   on vol_shift_slots      for select using (true);
create policy "public insert" on vol_shift_slots      for insert with check (true);
create policy "public delete" on vol_shift_slots      for delete using (true);
create policy "public read"   on vol_slot_signups     for select using (true);
create policy "public insert" on vol_slot_signups     for insert with check (true);
create policy "public read"   on vol_polls            for select using (true);
create policy "public insert" on vol_polls            for insert with check (true);
create policy "public delete" on vol_polls            for delete using (true);
create policy "public read"   on vol_poll_votes       for select using (true);
create policy "public insert" on vol_poll_votes       for insert with check (true);

-- Realtime
alter publication supabase_realtime add table vol_event_responses;
alter publication supabase_realtime add table vol_slot_signups;
alter publication supabase_realtime add table vol_poll_votes;
