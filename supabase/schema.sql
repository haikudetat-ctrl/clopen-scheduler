create extension if not exists "pgcrypto";

-- Core entities
create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  roles text[] not null default '{}',
  skill_level int not null check (skill_level between 1 and 5),
  active boolean not null default true
);

create table if not exists public.availability (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (start_time < end_time)
);

create table if not exists public.shift_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_time time not null,
  end_time time not null,
  check (start_time < end_time)
);

create table if not exists public.shift_requirements (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.shift_templates(id) on delete cascade,
  role text not null,
  required_count int not null check (required_count > 0)
);

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique
);

create table if not exists public.schedule_assignments (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  day int not null check (day between 0 and 6),
  template_id uuid not null references public.shift_templates(id) on delete restrict,
  role text not null,
  staff_id uuid references public.staff(id) on delete set null
);

-- Lookup indexes
create index if not exists idx_availability_staff_day on public.availability(staff_id, day_of_week);
create index if not exists idx_schedule_assignments_schedule_day on public.schedule_assignments(schedule_id, day);
create index if not exists idx_schedule_assignments_staff on public.schedule_assignments(staff_id);
