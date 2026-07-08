ALTER TABLE public.spp_installments
  ADD COLUMN IF NOT EXISTS gateway text,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz,
  ADD COLUMN IF NOT EXISTS mayar_invoice_id text;

CREATE INDEX IF NOT EXISTS idx_spp_installments_mayar_txn
  ON public.spp_installments (mayar_transaction_id)
  WHERE mayar_transaction_id IS NOT NULL;