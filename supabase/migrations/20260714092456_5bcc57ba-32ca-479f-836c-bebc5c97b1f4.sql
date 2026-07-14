
-- ============================================================
-- Guard sensitive column updates via BEFORE INSERT/UPDATE triggers
-- Fix: privilege escalation on affiliates (insert), profiles, schools
-- ============================================================

-- 1) AFFILIATES: also guard INSERT (existing trigger only handles UPDATE)
CREATE OR REPLACE FUNCTION public.affiliates_guard_financial_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;
  -- Force safe defaults on self-insert; ignore any inflated client values
  NEW.current_balance := 0;
  NEW.total_earned := 0;
  NEW.total_withdrawn := 0;
  NEW.commission_rate := COALESCE((SELECT commission_rate FROM public.affiliates LIMIT 0), 50);
  -- Use table default for commission_rate by nulling and relying on default is risky; hardcode platform default
  NEW.commission_rate := 50;
  NEW.status := COALESCE(NEW.status, 'active');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_affiliates_guard_financial_insert ON public.affiliates;
CREATE TRIGGER trg_affiliates_guard_financial_insert
BEFORE INSERT ON public.affiliates
FOR EACH ROW EXECUTE FUNCTION public.affiliates_guard_financial_insert();

-- 2) PROFILES: block self-mutation of sensitive columns
CREATE OR REPLACE FUNCTION public.profiles_guard_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Super admin bypasses
  IF public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Non-self edits are governed by RLS; this trigger only guards self-updates.
  -- If it's not the profile owner, let RLS decide — but still lock sensitive cols.
  IF TG_OP = 'INSERT' THEN
    -- On insert (typically via handle_new_user trigger, which runs as SECURITY DEFINER
    -- and has no auth.uid() when triggered by system, so the super_admin/NULL check
    -- above returns; if a real user is creating their own row, force safe defaults).
    IF auth.uid() IS NOT NULL THEN
      NEW.current_points := 0;
      NEW.lifetime_points := 0;
      NEW.rfid_uid := NULL;
      NEW.qr_code := NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE path
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Tidak diizinkan mengubah user_id profil';
  END IF;

  IF NEW.school_id IS DISTINCT FROM OLD.school_id THEN
    RAISE EXCEPTION 'Perpindahan sekolah harus dilakukan oleh admin sekolah/super admin';
  END IF;

  IF NEW.current_points IS DISTINCT FROM OLD.current_points
     OR NEW.lifetime_points IS DISTINCT FROM OLD.lifetime_points THEN
    RAISE EXCEPTION 'Poin reward tidak dapat diubah manual oleh pengguna';
  END IF;

  IF NEW.rfid_uid IS DISTINCT FROM OLD.rfid_uid
     OR NEW.qr_code IS DISTINCT FROM OLD.qr_code THEN
    RAISE EXCEPTION 'Identifier RFID/QR hanya dapat diubah oleh admin sekolah';
  END IF;

  IF NEW.referral_code IS DISTINCT FROM OLD.referral_code
     OR NEW.referred_by IS DISTINCT FROM OLD.referred_by THEN
    RAISE EXCEPTION 'Kode referral tidak dapat diubah setelah dibuat';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_guard_sensitive_fields ON public.profiles;
CREATE TRIGGER trg_profiles_guard_sensitive_fields
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_sensitive_fields();

-- 3) SCHOOLS: block school_admin self-update of billing/suspension columns
CREATE OR REPLACE FUNCTION public.schools_guard_billing_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;

  -- Super admin bypasses
  IF public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- System/service-role calls (auth.uid() is null) also bypass
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.is_suspended IS DISTINCT FROM OLD.is_suspended
     OR NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
     OR NEW.suspended_reason IS DISTINCT FROM OLD.suspended_reason
     OR NEW.package_type IS DISTINCT FROM OLD.package_type
     OR NEW.package_status IS DISTINCT FROM OLD.package_status
     OR NEW.package_status_changed_at IS DISTINCT FROM OLD.package_status_changed_at
     OR NEW.mandiri_monthly_rate IS DISTINCT FROM OLD.mandiri_monthly_rate
     OR NEW.last_payment_activity_at IS DISTINCT FROM OLD.last_payment_activity_at
     OR NEW.group_id IS DISTINCT FROM OLD.group_id THEN
    RAISE EXCEPTION 'Kolom penagihan/status paket hanya dapat diubah oleh Super Admin';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_schools_guard_billing_fields ON public.schools;
CREATE TRIGGER trg_schools_guard_billing_fields
BEFORE UPDATE ON public.schools
FOR EACH ROW EXECUTE FUNCTION public.schools_guard_billing_fields();
