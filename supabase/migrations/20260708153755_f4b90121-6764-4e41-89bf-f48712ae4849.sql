
DROP VIEW IF EXISTS public.schools_public;

CREATE VIEW public.schools_public
WITH (security_invoker = true) AS
SELECT id, slug, name, logo, city
FROM public.schools;

GRANT SELECT ON public.schools_public TO anon, authenticated;

DROP POLICY IF EXISTS "Anon safe tenant lookup" ON public.schools;
REVOKE SELECT ON public.schools FROM anon;

-- Retain a permissive anon row policy so security_invoker view still works for anon.
CREATE POLICY "Anon read via schools_public view only"
ON public.schools
FOR SELECT
TO anon
USING (true);
