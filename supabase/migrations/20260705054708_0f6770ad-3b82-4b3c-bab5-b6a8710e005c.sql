
ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS service_fee INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_channel TEXT;

ALTER TABLE public.spp_invoices
  ADD COLUMN IF NOT EXISTS service_fee INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_channel TEXT;
