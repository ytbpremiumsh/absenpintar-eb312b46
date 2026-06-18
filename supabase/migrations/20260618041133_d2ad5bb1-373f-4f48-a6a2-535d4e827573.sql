ALTER TABLE public.spp_invoices
  ADD COLUMN IF NOT EXISTS bill_type text NOT NULL DEFAULT 'spp',
  ADD COLUMN IF NOT EXISTS bill_category text;

CREATE INDEX IF NOT EXISTS idx_spp_invoices_school_bill_type
  ON public.spp_invoices (school_id, bill_type);