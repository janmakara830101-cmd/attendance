-- ============================================================
-- schema_v2.sql  –  Migration (run AFTER schema.sql)
-- Supabase SQL Editor
-- ============================================================

-- 1. Add telegram_chat_id to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id text;

-- ============================================================
-- 2. SETTINGS table  (office GPS + rules)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.settings (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  office_name           text NOT NULL DEFAULT 'ការិយាល័យ',
  office_lat            numeric(10,6) NOT NULL DEFAULT 11.556400,
  office_lng            numeric(10,6) NOT NULL DEFAULT 104.928200,
  allowed_radius_meters numeric        NOT NULL DEFAULT 50,
  check_in_limit        time           NOT NULL DEFAULT '08:00:00',
  work_end              time           NOT NULL DEFAULT '17:30:00',
  late_deduction_usd    numeric(6,2)   NOT NULL DEFAULT 5,
  absent_deduction_usd  numeric(6,2)   NOT NULL DEFAULT 15,
  created_at            timestamptz    NOT NULL DEFAULT now(),
  updated_at            timestamptz    NOT NULL DEFAULT now()
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

-- Seed default settings (Phnom Penh office)
INSERT INTO public.settings
  (office_name, office_lat, office_lng, allowed_radius_meters, check_in_limit)
SELECT 'ការិយាល័យ – Phnom Penh', 11.556400, 104.928200, 50, '08:00:00'
WHERE NOT EXISTS (SELECT 1 FROM public.settings);

-- ============================================================
-- 3. Update ATTENDANCE  (add per-event GPS columns)
-- ============================================================
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS check_in_lat  numeric,
  ADD COLUMN IF NOT EXISTS check_in_lng  numeric,
  ADD COLUMN IF NOT EXISTS check_out_lat numeric,
  ADD COLUMN IF NOT EXISTS check_out_lng numeric;

-- Back-fill from existing location columns if any
UPDATE public.attendance
  SET check_in_lat = location_lat, check_in_lng = location_lng
WHERE check_in_lat IS NULL AND location_lat IS NOT NULL;

-- ============================================================
-- 4. Update PAYROLL  (add reason fields + payment tracking)
-- ============================================================
ALTER TABLE public.payroll
  ADD COLUMN IF NOT EXISTS bonus_reasons      text,
  ADD COLUMN IF NOT EXISTS deduction_reasons  text,
  ADD COLUMN IF NOT EXISTS payment_status     text NOT NULL DEFAULT 'Pending'
    CHECK (payment_status IN ('Pending', 'Paid')),
  ADD COLUMN IF NOT EXISTS processed_at       timestamptz;

-- Sync legacy status → payment_status
UPDATE public.payroll
  SET payment_status = 'Paid'
WHERE status = 'paid' AND payment_status = 'Pending';

-- ============================================================
-- 5. MOCK EMPLOYEES  (3 demo profiles)
-- NOTE: These require matching rows in auth.users.
-- Use Supabase Dashboard > Auth > Users > "Invite User" or
-- run the commented INSERT below with real auth user UUIDs.
-- ============================================================

/*
-- Replace <uuid_1/2/3> with UUIDs from auth.users
INSERT INTO public.profiles (id, name, role, phone, base_salary, active_status)
VALUES
  ('<uuid_1>', 'សុខ ដារ៉ា',    'employee', '012-111-111', 500.00, true),
  ('<uuid_2>', 'ចាន់ ស្រីមុន', 'employee', '012-222-222', 450.00, true),
  ('<uuid_3>', 'វង្ស ពិសី',    'admin',    '012-333-333', 700.00, true)
ON CONFLICT (id) DO NOTHING;
*/

-- ============================================================
-- Done!  Run schema.sql first, then this file.
-- ============================================================
