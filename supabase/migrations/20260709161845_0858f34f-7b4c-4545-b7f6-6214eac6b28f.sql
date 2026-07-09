
-- 1. Tambah kolom di schools
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS package_type text NOT NULL DEFAULT 'payment',
  ADD COLUMN IF NOT EXISTS package_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS package_status_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_payment_activity_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS mandiri_monthly_rate bigint NOT NULL DEFAULT 1000;

-- 2. package_settings (1 baris global)
CREATE TABLE IF NOT EXISTS public.package_settings (
  id int PRIMARY KEY DEFAULT 1,
  grace_period_days int NOT NULL DEFAULT 90,
  disabled_features jsonb NOT NULL DEFAULT '["attendance_create","scan_qr","face_recognition","rfid"]'::jsonb,
  mandiri_monthly_rate bigint NOT NULL DEFAULT 1000,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

GRANT SELECT ON public.package_settings TO authenticated, anon;
GRANT ALL ON public.package_settings TO service_role;
ALTER TABLE public.package_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read package settings" ON public.package_settings;
CREATE POLICY "read package settings" ON public.package_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "super admin manage package settings" ON public.package_settings;
CREATE POLICY "super admin manage package settings" ON public.package_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

INSERT INTO public.package_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 3. package_audit_log
CREATE TABLE IF NOT EXISTS public.package_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  action text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  reason text,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.package_audit_log TO authenticated;
GRANT ALL ON public.package_audit_log TO service_role;
ALTER TABLE public.package_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super admin read all audit" ON public.package_audit_log;
CREATE POLICY "super admin read all audit" ON public.package_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "school admin read own audit" ON public.package_audit_log;
CREATE POLICY "school admin read own audit" ON public.package_audit_log FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()));

DROP POLICY IF EXISTS "authenticated insert audit" ON public.package_audit_log;
CREATE POLICY "authenticated insert audit" ON public.package_audit_log FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_package_audit_school ON public.package_audit_log(school_id, created_at DESC);

-- 4. Trigger untuk touch last_payment_activity_at
CREATE OR REPLACE FUNCTION public.touch_payment_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _school uuid;
BEGIN
  _school := NEW.school_id;
  IF _school IS NOT NULL THEN
    UPDATE public.schools
      SET last_payment_activity_at = now()
      WHERE id = _school;

    -- Auto-reactivate if pending
    UPDATE public.schools
      SET package_status = 'active', package_status_changed_at = now()
      WHERE id = _school AND package_status = 'pending_activation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_payment_invoice ON public.spp_invoices;
CREATE TRIGGER trg_touch_payment_invoice
  AFTER INSERT ON public.spp_invoices
  FOR EACH ROW EXECUTE FUNCTION public.touch_payment_activity();

DROP TRIGGER IF EXISTS trg_touch_payment_txn ON public.payment_transactions;
CREATE TRIGGER trg_touch_payment_txn
  AFTER INSERT ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.touch_payment_activity();

DROP TRIGGER IF EXISTS trg_touch_payment_settlement ON public.spp_settlements;
CREATE TRIGGER trg_touch_payment_settlement
  AFTER INSERT ON public.spp_settlements
  FOR EACH ROW EXECUTE FUNCTION public.touch_payment_activity();

-- 5. Function check_package_status (dipanggil cron)
CREATE OR REPLACE FUNCTION public.check_package_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _grace int;
  r RECORD;
BEGIN
  SELECT grace_period_days INTO _grace FROM public.package_settings WHERE id = 1;
  IF _grace IS NULL THEN _grace := 90; END IF;

  FOR r IN
    SELECT id, last_payment_activity_at
    FROM public.schools
    WHERE package_type = 'payment'
      AND package_status = 'active'
      AND (last_payment_activity_at IS NULL OR last_payment_activity_at < now() - (_grace || ' days')::interval)
  LOOP
    UPDATE public.schools
      SET package_status = 'pending_activation', package_status_changed_at = now()
      WHERE id = r.id;
    INSERT INTO public.package_audit_log (school_id, action, old_value, new_value, reason)
    VALUES (r.id, 'suspended',
      jsonb_build_object('package_status','active'),
      jsonb_build_object('package_status','pending_activation'),
      'Auto: tidak ada aktivitas pembayaran ' || _grace || ' hari');
  END LOOP;
END;
$$;
