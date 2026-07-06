
-- 1) Drop the permissive anon policy that granted row-level SELECT on all columns
DROP POLICY IF EXISTS "Anon tenant lookup" ON public.schools;

-- 2) Ensure anon has no direct table access to schools
REVOKE ALL ON public.schools FROM anon;

-- 3) Public, safe-only view for tenant/slug resolution and school finder
CREATE OR REPLACE VIEW public.schools_public
WITH (security_invoker = true) AS
SELECT id, name, slug, logo, npsn, city
FROM public.schools;

-- 4) Allow both anon and authenticated to read the view
GRANT SELECT ON public.schools_public TO anon, authenticated;

-- 5) Because the view is security_invoker, we need an RLS policy on schools that
--    permits SELECT of these safe columns via the view. Add a minimal anon SELECT
--    policy scoped to safe columns using column privileges.
CREATE POLICY "Anon safe tenant lookup"
ON public.schools
FOR SELECT
TO anon
USING (true);

-- Column-level privileges: anon may only read the safe tenant-resolution columns.
REVOKE SELECT ON public.schools FROM anon;
GRANT SELECT (id, name, slug, logo, npsn, city) ON public.schools TO anon;
