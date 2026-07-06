
ALTER TABLE public.spp_settlements
  ADD COLUMN IF NOT EXISTS disbursement_method text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS disbursement_status text,
  ADD COLUMN IF NOT EXISTS doku_reference_id text,
  ADD COLUMN IF NOT EXISTS doku_partner_reference_no text UNIQUE,
  ADD COLUMN IF NOT EXISTS disbursement_response jsonb,
  ADD COLUMN IF NOT EXISTS disbursement_error text,
  ADD COLUMN IF NOT EXISTS disbursement_callback_at timestamptz;

ALTER TABLE public.bendahara_bank_accounts
  ADD COLUMN IF NOT EXISTS doku_bank_code text;

CREATE INDEX IF NOT EXISTS idx_spp_settlements_partner_ref
  ON public.spp_settlements(doku_partner_reference_no);
