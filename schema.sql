-- ============================================================
-- Employee Attendance & Payroll Management System
-- Supabase PostgreSQL Schema
-- ============================================================

-- EXTENSIONS
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLE: profiles (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  name          text not null,
  role          text not null default 'employee' check (role in ('admin', 'employee')),
  phone         text,
  base_salary   numeric(12, 2) not null default 0,
  active_status boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Auto-create profile when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'employee')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auto-update updated_at on any table
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================
-- TABLE: attendance
-- ============================================================
create table public.attendance (
  id             uuid primary key default uuid_generate_v4(),
  employee_id    uuid not null references public.profiles(id) on delete cascade,
  date           date not null default current_date,
  check_in_time  timestamptz,
  check_out_time timestamptz,
  status         text not null default 'absent'
                   check (status in ('present', 'late', 'absent')),
  location_lat   double precision,
  location_lng   double precision,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (employee_id, date)
);

create index idx_attendance_employee_date on public.attendance(employee_id, date);
create index idx_attendance_date          on public.attendance(date);

create trigger attendance_updated_at
  before update on public.attendance
  for each row execute function public.set_updated_at();

-- ============================================================
-- TABLE: payroll
-- ============================================================
create table public.payroll (
  id           uuid primary key default uuid_generate_v4(),
  employee_id  uuid not null references public.profiles(id) on delete cascade,
  month        smallint not null check (month between 1 and 12),
  year         smallint not null check (year >= 2000),
  base_salary  numeric(12, 2) not null default 0,
  deductions   numeric(12, 2) not null default 0,
  bonuses      numeric(12, 2) not null default 0,
  total_salary numeric(12, 2) generated always as
                 (base_salary - deductions + bonuses) stored,
  status       text not null default 'pending'
                 check (status in ('pending', 'approved', 'paid')),
  paid_at      timestamptz,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (employee_id, month, year)
);

create index idx_payroll_employee   on public.payroll(employee_id);
create index idx_payroll_month_year on public.payroll(month, year);

create trigger payroll_updated_at
  before update on public.payroll
  for each row execute function public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
alter table public.profiles   enable row level security;
alter table public.attendance  enable row level security;
alter table public.payroll     enable row level security;

-- profiles: admins see all, employees see only themselves
create policy "Admins read all profiles"
  on public.profiles for select
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Employees read own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Admins manage profiles"
  on public.profiles for all
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Employees update own profile"
  on public.profiles for update
  using (id = auth.uid());

-- attendance: admins manage all, employees manage their own
create policy "Admins manage attendance"
  on public.attendance for all
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Employees read own attendance"
  on public.attendance for select
  using (employee_id = auth.uid());

create policy "Employees insert own attendance"
  on public.attendance for insert
  with check (employee_id = auth.uid());

-- payroll: admins manage all, employees read own
create policy "Admins manage payroll"
  on public.payroll for all
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Employees read own payroll"
  on public.payroll for select
  using (employee_id = auth.uid());
