
-- 1. AFFILIATES: remove broad SELECT for anon and authenticated
DROP POLICY IF EXISTS "Anon can read affiliates by code" ON public.affiliates;
DROP POLICY IF EXISTS "Public can read affiliates by code" ON public.affiliates;

-- 2. DISMISSAL_SETTINGS: remove "USING true" SELECT, replace with scoped policy
DROP POLICY IF EXISTS "Users view school dismissal settings" ON public.dismissal_settings;
CREATE POLICY "Users view own school dismissal settings"
ON public.dismissal_settings FOR SELECT
TO authenticated
USING (school_id = public.get_user_school_id(auth.uid()) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- 3. NOTIFICATIONS: remove OR school_id IS NULL from non-super-admin policies
DROP POLICY IF EXISTS "Users view own school notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users mark own notifications read" ON public.notifications;
CREATE POLICY "Users view own school notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (school_id = public.get_user_school_id(auth.uid()));
CREATE POLICY "Users mark own school notifications read"
ON public.notifications FOR UPDATE
TO authenticated
USING (school_id = public.get_user_school_id(auth.uid()))
WITH CHECK (school_id = public.get_user_school_id(auth.uid()));

-- 4. PARENT-ATTACHMENTS bucket: restrict INSERT to authenticated
DROP POLICY IF EXISTS "Anyone upload parent attachments" ON storage.objects;
CREATE POLICY "Authenticated upload parent attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'parent-attachments');

-- 5. PLATFORM_SETTINGS: restrict anon SELECT to whitelist of public keys
DROP POLICY IF EXISTS "Anyone can view platform settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Public can view platform settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Anon read platform settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Anyone view platform_settings" ON public.platform_settings;

-- Find existing permissive SELECT policies and replace
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='platform_settings' AND cmd='SELECT' LOOP
    EXECUTE format('DROP POLICY %I ON public.platform_settings', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Anon read public platform settings"
ON public.platform_settings FOR SELECT
TO anon
USING (key IN (
  'login_logo_url','header_logo_url','favicon_url','hero_shadow_shapes_enabled',
  'landing_theme','meta_pixel_enabled','meta_pixel_id','ga_measurement_id',
  'addon_custom_domain_enabled','addon_idcard_enabled','addon_wa_credit_enabled',
  'wa_credit_price','wa_credit_per_pack','google_client_id'
));

CREATE POLICY "Authenticated read platform settings"
ON public.platform_settings FOR SELECT
TO authenticated
USING (true);

-- 6. SPP_LOGS: restrict null-school rows to super_admin
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='spp_logs' AND cmd='SELECT' LOOP
    EXECUTE format('DROP POLICY %I ON public.spp_logs', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users view spp_logs"
ON public.spp_logs FOR SELECT
TO authenticated
USING (
  school_id = public.get_user_school_id(auth.uid())
  OR (school_id IS NULL AND public.has_role(auth.uid(), 'super_admin'::public.app_role))
);

-- 7. USER_ROLES: prevent school_admin from escalating roles
DROP POLICY IF EXISTS "School admins insert school user roles" ON public.user_roles;
CREATE POLICY "School admins insert school user roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'school_admin'::public.app_role)
  AND user_id IN (SELECT p.user_id FROM public.profiles p WHERE p.school_id = public.get_user_school_id(auth.uid()))
  AND role NOT IN ('super_admin'::public.app_role, 'school_admin'::public.app_role)
);

DROP POLICY IF EXISTS "School admins delete school user roles" ON public.user_roles;
CREATE POLICY "School admins delete school user roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'school_admin'::public.app_role)
  AND user_id IN (SELECT p.user_id FROM public.profiles p WHERE p.school_id = public.get_user_school_id(auth.uid()))
  AND role NOT IN ('super_admin'::public.app_role, 'school_admin'::public.app_role)
);

-- 8. FUNCTION EXECUTE PRIVILEGES: revoke from anon where not needed
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_user_school_id(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_school_id(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

REVOKE EXECUTE ON FUNCTION public.notify_admin_wa(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_admin_wa(text, jsonb) TO service_role;

-- 9. SET SEARCH_PATH on _fmt_idr
ALTER FUNCTION public._fmt_idr(bigint) SET search_path = public;

-- 10. EMAIL_LOGS: restrict INSERT to service_role (edge function uses service role)
DROP POLICY IF EXISTS "Service can insert email_logs" ON public.email_logs;
CREATE POLICY "Service can insert email_logs"
ON public.email_logs FOR INSERT
TO service_role
WITH CHECK (true);

-- 11. SHORT_LINK_CLICKS: revoke direct INSERT; only SECURITY DEFINER RPC inserts
DROP POLICY IF EXISTS "Public insert click" ON public.short_link_clicks;
CREATE POLICY "Service insert click"
ON public.short_link_clicks FOR INSERT
TO service_role
WITH CHECK (true);
