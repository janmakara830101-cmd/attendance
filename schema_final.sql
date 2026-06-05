-- ============================================================
-- schema_final.sql  —  CLEAN SLATE (Run this ONE file only)
-- Drops old tables and recreates everything correctly
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Drop existing tables (safe - CASCADE removes dependencies) ─
DROP TABLE IF EXISTS public.payroll    CASCADE;
DROP TABLE IF EXISTS public.attendance CASCADE;
DROP TABLE IF EXISTS public.settings   CASCADE;
DROP TABLE IF EXISTS public.profiles   CASCADE;

-- ── Drop old triggers on auth.users ──────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- ── Shared functions ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

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
-- TABLE 1: profiles
-- ============================================================
CREATE TABLE public.profiles (
  id               uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  role             text        NOT NULL DEFAULT 'employee'
                                 CHECK (role IN ('admin','employee')),
  phone            text,
  base_salary      numeric(12,2) NOT NULL DEFAULT 0,
  active_status    boolean     NOT NULL DEFAULT true,
  telegram_chat_id text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read all profiles"
  ON public.profiles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

CREATE POLICY "Employees read own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Admins manage profiles"
  ON public.profiles FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

CREATE POLICY "Employees update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- Re-insert profiles for existing auth users (if any)
INSERT INTO public.profiles (id, name, role)
SELECT
  id,
  COALESCE(raw_user_meta_data->>'name', email),
  COALESCE(raw_user_meta_data->>'role', 'employee')
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- TABLE 2: settings
-- ============================================================
CREATE TABLE public.settings (
  id                    uuid         PRIMARY KEY DEFAULT uuid_generate_v4(),
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

CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings"
  ON public.settings FOR SELECT USING (true);

CREATE POLICY "Admins manage settings"
  ON public.settings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

-- Seed: Phnom Penh office
INSERT INTO public.settings
  (office_name, office_lat, office_lng, allowed_radius_meters, check_in_limit)
VALUES
  ('ការិយាល័យ – Phnom Penh', 11.556400, 104.928200, 50, '08:00:00');

-- ============================================================
-- TABLE 3: attendance
-- ============================================================
CREATE TABLE public.attendance (
  id             uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date           date        NOT NULL DEFAULT CURRENT_DATE,
  check_in_time  timestamptz,
  check_out_time timestamptz,
  status         text        NOT NULL DEFAULT 'Absent'
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

CREATE INDEX idx_attendance_employee_date ON public.attendance(employee_id, date);
CREATE INDEX idx_attendance_date          ON public.attendance(date);

CREATE TRIGGER attendance_updated_at
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage attendance"
  ON public.attendance FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

CREATE POLICY "Employees read own attendance"
  ON public.attendance FOR SELECT
  USING (employee_id = auth.uid());

CREATE POLICY "Employees insert own attendance"
  ON public.attendance FOR INSERT
  WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Employees update own attendance"
  ON public.attendance FOR UPDATE
  USING (employee_id = auth.uid());

-- ============================================================
-- TABLE 4: payroll
-- ============================================================
CREATE TABLE public.payroll (
  id                 uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id        uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month              smallint      NOT NULL CHECK (month BETWEEN 1 AND 12),
  year               smallint      NOT NULL CHECK (year >= 2000),
  base_salary        numeric(12,2) NOT NULL DEFAULT 0,
  deductions         numeric(12,2) NOT NULL DEFAULT 0,
  deduction_reasons  text,
  bonuses            numeric(12,2) NOT NULL DEFAULT 0,
  bonus_reasons      text,
  total_salary       numeric(12,2) GENERATED ALWAYS AS
                       (base_salary - deductions + bonuses) STORED,
  payment_status     text          NOT NULL DEFAULT 'Pending'
                       CHECK (payment_status IN ('Pending','Paid')),
  processed_at       timestamptz,
  notes              text,
  created_at         timestamptz   NOT NULL DEFAULT now(),
  updated_at         timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (employee_id, month, year)
);

CREATE INDEX idx_payroll_employee   ON public.payroll(employee_id);
CREATE INDEX idx_payroll_month_year ON public.payroll(month, year);

CREATE TRIGGER payroll_updated_at
  BEFORE UPDATE ON public.payroll
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage payroll"
  ON public.payroll FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  ));

CREATE POLICY "Employees read own payroll"
  ON public.payroll FOR SELECT
  USING (employee_id = auth.uid());

-- ============================================================
-- ✅ Done! Tables created: profiles, settings, attendance, payroll
-- ============================================================
