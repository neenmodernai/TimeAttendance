-- supabase/migrations/002_hr_features.sql
-- Run once in Supabase Dashboard > SQL Editor, after 001_init.sql.

alter table leave_requests add column if not exists hr_notified_at timestamptz;

-- Prevents the same reminder being emailed twice for the same person/day/kind
create table if not exists notification_log (
  id           bigint generated always as identity primary key,
  kind         text not null check (kind in ('morning','evening')),
  employee_id  uuid not null references employees(id) on delete cascade,
  for_date     date not null,
  sent_at      timestamptz not null default now(),
  unique (kind, employee_id, for_date)
);

insert into settings (key, value) values
  ('hr_email', '""'),
  ('remind_enabled', 'true')
on conflict (key) do nothing;

alter table notification_log enable row level security;
revoke all on notification_log from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

notify pgrst, 'reload schema';
