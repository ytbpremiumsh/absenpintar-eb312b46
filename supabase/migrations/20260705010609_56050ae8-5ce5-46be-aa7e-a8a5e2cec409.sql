
-- New slugs may only contain lowercase letters and digits (no dashes).
CREATE OR REPLACE FUNCTION public.slugify(_input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT regexp_replace(lower(coalesce(_input,'')), '[^a-z0-9]+', '', 'g')
$function$;
