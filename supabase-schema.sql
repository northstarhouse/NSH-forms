-- Run this in the Supabase SQL Editor (supabase.com → your project → SQL Editor)

create table events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  date text,
  time text,
  description text,
  created_at timestamptz default now()
);

create table event_responses (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references events(id) on delete cascade,
  name text not null,
  response text not null,
  created_at timestamptz default now()
);

create table polls (
  id uuid default gen_random_uuid() primary key,
  question text not null,
  options text[] not null,
  created_at timestamptz default now()
);

create table poll_votes (
  id uuid default gen_random_uuid() primary key,
  poll_id uuid references polls(id) on delete cascade,
  name text not null,
  option text not null,
  created_at timestamptz default now()
);

create table shifts (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  date text,
  time text,
  duration text,
  role text,
  spots integer,
  created_at timestamptz default now()
);

create table shift_signups (
  id uuid default gen_random_uuid() primary key,
  shift_id uuid references shifts(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

-- Row Level Security (allow public read/write — suitable for an internal volunteer tool)
alter table events enable row level security;
alter table event_responses enable row level security;
alter table polls enable row level security;
alter table poll_votes enable row level security;
alter table shifts enable row level security;
alter table shift_signups enable row level security;

create policy "public read"   on events           for select using (true);
create policy "public insert" on events           for insert with check (true);
create policy "public delete" on events           for delete using (true);

create policy "public read"   on event_responses  for select using (true);
create policy "public insert" on event_responses  for insert with check (true);

create policy "public read"   on polls            for select using (true);
create policy "public insert" on polls            for insert with check (true);
create policy "public delete" on polls            for delete using (true);

create policy "public read"   on poll_votes       for select using (true);
create policy "public insert" on poll_votes       for insert with check (true);

create policy "public read"   on shifts           for select using (true);
create policy "public insert" on shifts           for insert with check (true);
create policy "public delete" on shifts           for delete using (true);

create policy "public read"   on shift_signups    for select using (true);
create policy "public insert" on shift_signups    for insert with check (true);

-- Enable realtime on all tables
alter publication supabase_realtime add table event_responses;
alter publication supabase_realtime add table poll_votes;
alter publication supabase_realtime add table shift_signups;
