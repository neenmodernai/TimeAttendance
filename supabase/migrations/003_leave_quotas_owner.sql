-- supabase/migrations/003_leave_quotas_owner.sql
-- Run once in Supabase Dashboard > SQL Editor, after 001 and 002.
-- Adds editable leave types with yearly limits, per-employee overrides, and owner approval of HR policy changes.

-- 1) Leave types (replaces the fixed sick/personal/vacation list)
create table if not exists leave_types (
  code         text primary key check (code ~ '^[a-z0-9_]{2,20}$'),
  name_th      text not null,
  annual_days  numeric(5,1) check (annual_days is null or annual_days >= 0),  -- null = no limit
  allow_over   boolean not null default false,  -- true: staff may still submit past the limit (flagged to HR)
  active       boolean not null default true,
  sort         int not null default 100
);
-- Defaults follow the Thai Labour Protection Act minimums; HR should confirm against company policy.
insert into leave_types (code, name_th, annual_days, allow_over, sort) values
  ('sick',     'ลาป่วย',    30, true,  1),
  ('personal', 'ลากิจ',      3, false, 2),
  ('vacation', 'ลาพักร้อน',  6, false, 3)
on conflict (code) do nothing;

alter table leave_requests drop constraint if exists leave_requests_leave_type_check;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'leave_requests_leave_type_fkey') then
    alter table leave_requests add constraint leave_requests_leave_type_fkey
      foreign key (leave_type) references leave_types(code) on update cascade;
  end if;
end $$;
alter table leave_requests add column if not exists over_quota boolean not null default false;

-- 2) Per-employee limit that replaces the type's default (e.g. more vacation days with seniority)
create table if not exists employee_leave_quotas (
  employee_id  uuid not null references employees(id) on delete cascade,
  leave_type   text not null references leave_types(code) on update cascade on delete cascade,
  annual_days  numeric(5,1) not null check (annual_days >= 0),
  primary key (employee_id, leave_type)
);

-- 3) Changes HR submits for owner approval
create table if not exists change_requests (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('leave_type','employee_quota')),
  payload       jsonb not null,
  summary       text not null,
  requested_by  text not null,
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  owner_note    text,
  created_at    timestamptz not null default now(),
  decided_at    timestamptz,
  decided_by    text
);
create index if not exists change_requests_status on change_requests (status, created_at desc);

alter table leave_types           enable row level security;
alter table employee_leave_quotas enable row level security;
alter table change_requests       enable row level security;
revoke all on leave_types, employee_leave_quotas, change_requests from anon, authenticated;

notify pgrst, 'reload schema';
