
CREATE OR REPLACE FUNCTION public.schools_protect_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _is_super boolean;
  _is_admin_of_school boolean;
  _days_left int;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.slug IS DISTINCT FROM NEW.slug THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Tidak diizinkan mengubah subdomain';
    END IF;

    _is_super := public.has_role(auth.uid(), 'super_admin'::app_role);
    _is_admin_of_school :=
      public.has_role(auth.uid(), 'school_admin'::app_role)
      AND public.get_user_school_id(auth.uid()) = OLD.id;

    IF NOT (_is_super OR _is_admin_of_school) THEN
      RAISE EXCEPTION 'Hanya Super Admin atau Admin Sekolah terkait yang dapat mengubah subdomain';
    END IF;

    -- Enforce 14-day cooldown for school admins (super admin bypasses).
    IF NOT _is_super AND OLD.slug_updated_at IS NOT NULL THEN
      _days_left := CEIL(EXTRACT(EPOCH FROM (OLD.slug_updated_at + INTERVAL '14 days') - now()) / 86400);
      IF _days_left > 0 THEN
        RAISE EXCEPTION 'Subdomain baru bisa diubah lagi dalam % hari', _days_left;
      END IF;
    END IF;

    -- Stamp change time so cooldown works even if the client forgets to send it.
    NEW.slug_updated_at := now();
  END IF;
  RETURN NEW;
END $function$;
