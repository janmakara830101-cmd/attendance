-- ============================================================
-- schema_v2.sql  —  Self-contained Migration
-- Run this directly in Supabase SQL Editor
-- (No need to run schema.sql first)
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Shared trigger function (safe to re-create) ──────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── Shared new-user trigger function ─────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 1. PROFILES table  (extends auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  role          text NOT NULL DEFAULT 'employee' CHECK (role IN ('admin','employee')),
  phone         text,
  base_salary   numeric(12,2) NOT NULL DEFAULT 0,
  active_status boolean NOT NULL DEFAULT true,
  telegram_chat_id text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Auto-create profile on sign-up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read all profiles"    ON public.profiles;
DROP POLICY IF EXISTS "Employees read own profile"  ON public.profiles;
DROP POLICY IF EXISTS "Admins manage profiles"      ON public.profiles;
DROP POLICY IF EXISTS "Employees update own profile" ON public.profiles;

CREATE POLICY "Admins read all profiles"
  ON public.profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Employees read own profile"
  ON public.profiles FOR SELECT USING (id = auth.uid());

CREATE POLICY "Admins manage profiles"
  ON public.profiles FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Employees update own profile"
  ON public.profiles FOR UPDATE USING (id = auth.uid());

-- ============================================================
-- 2. SETTINGS table  (office GPS + check-in rules)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.settings (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  office_name           text         NOT NULL DEFAULT 'ការិយាល័យ',
  office_lat            numeric(10,6) NOT NULL DEFAULT 11.556400,
  office_lng            numeric(10,6) NOT NULL DEFAULT 104.928200,
  allowed_radius_meters numeric       NOT NULL DEFAULT 50,
  check_in_limit        time          NOT NULL DEFAULT '08:00:00',
  work_end              time          NOT NULL DEFAULT '17:30:00',
  late_deduction_usd    numeric(6,2)  NOT NULL DEFAULT 5,
  absent_deduction_usd  numeric(6,2)  NOT NULL DEFAULT 15,
  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS settings_updated_at ON public.settings;
CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read settings" ON public.settings;
DROP POLICY IF EXISTS "Admins manage settings"   ON public.settings;

CREATE POLICY "Anyone can read settings"
  ON public.settings FOR SELECT USING (true);

CREATE POLICY "Admins manage settings"
  ON public.settings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

-- Default Phnom Penh office seed
INSERT INTO public.settings
  (office_name, office_lat, office_lng, allowed_radius_meters, check_in_limit)
SELECT 'ការិយាល័យ – Phnom Penh', 11.556400, 104.928200, 50, '08:00:00'
WHERE NOT EXISTS (SELECT 1 FROM public.settings);

-- ============================================================
-- 3. ATTENDANCE table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date           date NOT NULL DEFAULT CURRENT_DATE,
  check_in_time  timestamptz,
  check_out_time timestamptz,
  status         text NOT NULL DEFAULT 'Absent'
                   CHECK (status IN ('Present','Late','Absent')),
  location_lat   numeric,
  location_lng   numeric,
  check_in_lat   numeric,
  check_in_lng   numeric,
  check_out_lat  numeric,
  check_out_lng  numeric,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON public.attendance(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date          ON public.attendance(date);

DROP TRIGGER IF EXISTS attendance_updated_at ON public.attendance;
CREATE TRIGGER attendance_updated_at
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage attendance"       ON public.attendance;
DROP POLICY IF EXISTS "Employees read own attendance"  ON public.attendance;
DROP POLICY IF EXISTS "Employees insert own attendance" ON public.attendance;

CREATE POLICY "Admins manage attendance"
  ON public.attendance FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Employees read own attendance"
  ON public.attendance FOR SELECT USING (employee_id = auth.uid());

CREATE POLICY "Employees insert own attendance"
  ON public.attendance FOR INSERT WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Employees update own attendance"
  ON public.attendance FOR UPDATE USING (employee_id = auth.uid());

-- ============================================================
-- 4. PAYROLL table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payroll (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month              smallint NOT NULL CHECK (month BETWEEN 1 AND 12),
  year               smallint NOT NULL CHECK (year >= 2000),
  base_salary        numeric(12,2) NOT NULL DEFAULT 0,
  deductions         numeric(12,2) NOT NULL DEFAULT 0,
  deduction_reasons  text,
  bonuses            numeric(12,2) NOT NULL DEFAULT 0,
  bonus_reasons      text,
  total_salary       numeric(12,2) GENERATED ALWAYS AS
                       (base_salary - deductions + bonuses) STORED,
  payment_status     text NOT NULL DEFAULT 'Pending'
                       CHECK (payment_status IN ('Pending','Paid')),
  processed_at       timestamptz,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_payroll_employee   ON public.payroll(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_month_year ON public.payroll(month, year);

DROP TRIGGER IF EXISTS payroll_updated_at ON public.payroll;
CREATE TRIGGER payroll_updated_at
  BEFORE UPDATE ON public.payroll
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage payroll"    ON public.payroll;
DROP POLICY IF EXISTS "Employees read own payroll" ON public.payroll;

CREATE POLICY "Admins manage payroll"
  ON public.payroll FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Employees read own payroll"
  ON public.payroll FOR SELECT USING (employee_id = auth.uid());

-- ============================================================
-- Done!  All tables, triggers, RLS policies created.
-- ============================================================
