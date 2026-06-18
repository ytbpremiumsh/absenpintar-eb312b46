
-- 1. Add slug column
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS slug text;

-- 2. Slugify helper
CREATE OR REPLACE FUNCTION public.slugify(_input text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT trim(both '-' from regexp_replace(
    regexp_replace(lower(coalesce(_input,'')), '[^a-z0-9]+', '-', 'g'),
    '-+', '-', 'g'
  ))
$$;

-- 3. Reserved slug check
CREATE OR REPLACE FUNCTION public.is_reserved_slug(_slug text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT _slug = ANY(ARRAY[
    'www','app','api','admin','super','superadmin','affiliate','parent',
    'support','help','docs','blog','mail','email','wa','whatsapp','cdn',
    'static','assets','dashboard','login','register','auth','panduan',
    'pricing','fitur','presentation','penawaran','proposal','pitch',
    'monitoring','scan','public','test','dev','staging','demo','root',
    'absen','absenpintar','atskolla','smk','sma','smp','sd','tk','paud'
  ])
$$;

-- 4. Backfill existing schools
DO $$
DECLARE r record; base text; candidate text; n int;
BEGIN
  FOR r IN SELECT id, name FROM public.schools WHERE slug IS NULL OR slug = '' LOOP
    base := public.slugify(r.name);
    IF base = '' OR public.is_reserved_slug(base) THEN
      base := 'sekolah-' || substr(r.id::text, 1, 8);
    END IF;
    candidate := base; n := 1;
    WHILE EXISTS (SELECT 1 FROM public.schools WHERE slug = candidate AND id <> r.id) LOOP
      n := n + 1; candidate := base || '-' || n;
    END LOOP;
    UPDATE public.schools SET slug = candidate WHERE id = r.id;
  END LOOP;
END $$;

-- 5. Constraints
ALTER TABLE public.schools ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS schools_slug_key ON public.schools(slug);
ALTER TABLE public.schools DROP CONSTRAINT IF EXISTS schools_slug_format_chk;
ALTER TABLE public.schools ADD CONSTRAINT schools_slug_format_chk
  CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$');

-- 6. Auto-generate slug on insert if NULL
CREATE OR REPLACE FUNCTION public.schools_autoslug()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE base text; candidate text; n int;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base := public.slugify(NEW.name);
    IF base = '' OR public.is_reserved_slug(base) THEN
      base := 'sekolah-' || substr(coalesce(NEW.id::text, gen_random_uuid()::text), 1, 8);
    END IF;
    candidate := base; n := 1;
    WHILE EXISTS (SELECT 1 FROM public.schools WHERE slug = candidate) LOOP
      n := n + 1; candidate := base || '-' || n;
    END LOOP;
    NEW.slug := candidate;
  ELSE
    NEW.slug := lower(NEW.slug);
    IF public.is_reserved_slug(NEW.slug) THEN
      RAISE EXCEPTION 'Subdomain "%" sudah dipesan sistem', NEW.slug;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_schools_autoslug ON public.schools;
CREATE TRIGGER trg_schools_autoslug
  BEFORE INSERT OR UPDATE OF slug ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.schools_autoslug();

-- 7. Restrict slug updates to super admin only
CREATE OR REPLACE FUNCTION public.schools_protect_slug()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.slug IS DISTINCT FROM NEW.slug THEN
    IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'super_admin'::app_role) THEN
      RAISE EXCEPTION 'Hanya Super Admin yang dapat mengubah subdomain sekolah';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_schools_protect_slug ON public.schools;
CREATE TRIGGER trg_schools_protect_slug
  BEFORE UPDATE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.schools_protect_slug();

-- 8. Allow anon to read minimal school info by slug (for tenant resolver on login & public pages)
DROP POLICY IF EXISTS "Public can view schools for tenant resolution" ON public.schools;
CREATE POLICY "Public can view schools for tenant resolution"
  ON public.schools FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.schools TO anon;
