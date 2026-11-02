-- supabase/migrations/001_init.sql
-- Run once in Supabase Dashboard > SQL Editor.
-- All access goes through the Next.js server (service-role key). RLS is ON with no policies,
-- and anon/authenticated roles are revoked, so the public API key can read/write nothing.

create table if not exists employees (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  pin_hash    text not null,
  dept        text check (dept in ('SA','SR','ACC','Trainee','Others')),
  contact     text,
  email       text,
  active      boolean not null default true,
  started_on  date not null default ((now() at time zone 'Asia/Bangkok')::date),
  ended_on    date,
  created_at  timestamptz not null default now()
);

create table if not exists sites (
  id        uuid primary key default gen_random_uuid(),
  name      text not null unique,
  lat       double precision not null,
  lng       double precision not null,
  radius_m  int not null default 150 check (radius_m between 20 and 5000),
  active    boolean not null default true
);

create table if not exists punches (
  id           bigint generated always as identity primary key,
  employee_id  uuid not null references employees(id) on delete cascade,
  kind         text not null check (kind in ('check_in','check_out','lunch_begin','lunch_end')),
  punched_at   timestamptz not null default now(),
  work_date    date generated always as ((punched_at at time zone 'Asia/Bangkok')::date) stored,
  lat          double precision,
  lng          double precision,
  accuracy_m   real,
  site_id      uuid references sites(id) on delete set null,
  distance_m   int,
  gps_ok       boolean not null default false,
  note         text,
  source       text not null default 'app' check (source in ('app','legacy')),
  legacy_key   text unique,
  legacy_gps   text
);
create index if not exists punches_emp_date on punches (employee_id, work_date);
create index if not exists punches_date on punches (work_date);

create table if not exists leave_requests (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references employees(id) on delete cascade,
  dept          text check (dept in ('SA','SR','ACC','Trainee','Others')),
  leave_type    text not null check (leave_type in ('sick','personal','vacation')),
  start_date    date not null,
  days          numeric(4,1) not null check (days > 0 and days <= 60),
  contact       text,
  email         text,
  reason        text,
  status        text not null default 'pending' check (status in ('pending','approved','denied')),
  requested_at  timestamptz not null default now(),
  decided_at    timestamptz,
  decided_by    text,
  source        text not null default 'app' check (source in ('app','legacy')),
  legacy_key    text unique,
  legacy_id     text
);
create index if not exists leave_emp_start on leave_requests (employee_id, start_date);
create index if not exists leave_status on leave_requests (status);

create table if not exists settings (
  key    text primary key,
  value  jsonb not null
);
-- late_from: a check-in at or after this time (Bangkok) counts as late.
-- work_days: ISO weekdays that everyone is expected to work, Mon=1 ... Sun=7 (people who do punch on other days are still counted as present).
-- holidays: dates ('YYYY-MM-DD') that are never counted as "no record".
insert into settings (key, value) values
  ('late_from', '"09:15"'),
  ('work_days', '[1,2,3,4,5]'),
  ('holidays', '[]')
on conflict (key) do nothing;

create table if not exists login_attempts (
  id            bigint generated always as identity primary key,
  employee_id   uuid references employees(id) on delete cascade,
  ok            boolean not null,
  attempted_at  timestamptz not null default now()
);
create index if not exists login_attempts_emp on login_attempts (employee_id, attempted_at desc);

-- Lock everything down
alter table employees      enable row level security;
alter table sites          enable row level security;
alter table punches        enable row level security;
alter table leave_requests enable row level security;
alter table settings       enable row level security;
alter table login_attempts enable row level security;

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

notify pgrst, 'reload schema';
