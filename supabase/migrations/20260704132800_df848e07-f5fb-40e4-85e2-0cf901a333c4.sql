ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS bendahara_wa_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS bendahara_offline_enabled boolean NOT NULL DEFAULT true;