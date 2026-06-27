-- NSH Volunteer Hub — full schema reset
-- Safe to run multiple times. Drops and recreates everything cleanly.

drop table if exists vol_slot_signups      cascade;
drop table if exists vol_shift_slots       cascade;
drop table if exists vol_shift_boards      cascade;
drop table if exists vol_event_responses   cascade;
drop table if exists vol_events            cascade;
drop table if exists vol_poll_votes        cascade;
drop table if exists vol_polls             cascade;

-- Events (RSVP or Shift Sign-up)
create table vol_events (
  id          uuid default gen_random_uuid() primary key,
  title       text not null,
  date        text,
  time        text,
  description text,
  event_type  text default 'rsvp',
  created_at  timestamptz default now()
);

-- RSVP responses
create table vol_event_responses (
  id         uuid default gen_random_uuid() primary key,
  event_id   uuid references vol_events(id) on delete cascade,
  name       text not null,
  response   text not null,
  created_at timestamptz default now()
);

-- Shift time slots
create table vol_shift_slots (
  id          uuid default gen_random_uuid() primary key,
  event_id    uuid references vol_events(id) on delete cascade,
  time_label  text,
  duration    text,
  role        text,
  spots       integer,
  sort_order  integer default 0
);

-- Shift signups
create table vol_slot_signups (
  id         uuid default gen_random_uuid() primary key,
  slot_id    uuid references vol_shift_slots(id) on delete cascade,
  name       text not null,
  created_at timestamptz default now()
);

-- Polls
create table vol_polls (
  id         uuid default gen_random_uuid() primary key,
  question   text not null,
  options    text[] not null,
  created_at timestamptz default now()
);

-- Poll votes
create table vol_poll_votes (
  id         uuid default gen_random_uuid() primary key,
  poll_id    uuid references vol_polls(id) on delete cascade,
  name       text not null,
  option     text not null,
  created_at timestamptz default now()
);

-- Row Level Security
alter table vol_events           enable row level security;
alter table vol_event_responses  enable row level security;
alter table vol_shift_slots      enable row level security;
alter table vol_slot_signups     enable row level security;
alter table vol_polls            enable row level security;
alter table vol_poll_votes       enable row level security;

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
do $$ begin alter publication supabase_realtime add table vol_event_responses; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table vol_slot_signups;    exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table vol_poll_votes;      exception when others then null; end $$;

-- ─── Custom Forms ──────────────────────────────────────────────────────────────
-- Run this block independently if the vol_* tables already exist.

drop table if exists nsh_form_responses cascade;
drop table if exists nsh_forms cascade;

-- Form definitions: title, optional description, and a JSONB array of field definitions
-- Each field: { id, type, label, required, options? }
-- Field types: short_text | long_text | multiple_choice | checkboxes | yes_no | rating | date
create table nsh_forms (
  id          uuid default gen_random_uuid() primary key,
  title       text not null,
  description text,
  fields      jsonb not null default '[]',
  created_at  timestamptz default now()
);

-- Form responses: one row per submission, answers stored as { fieldId: value }
create table nsh_form_responses (
  id         uuid default gen_random_uuid() primary key,
  form_id    uuid references nsh_forms(id) on delete cascade,
  answers    jsonb not null default '{}',
  created_at timestamptz default now()
);

alter table nsh_forms          enable row level security;
alter table nsh_form_responses enable row level security;

create policy "public read"   on nsh_forms          for select using (true);
create policy "public insert" on nsh_forms          for insert with check (true);
create policy "public delete" on nsh_forms          for delete using (true);
create policy "public read"   on nsh_form_responses for select using (true);
create policy "public insert" on nsh_form_responses for insert with check (true);
