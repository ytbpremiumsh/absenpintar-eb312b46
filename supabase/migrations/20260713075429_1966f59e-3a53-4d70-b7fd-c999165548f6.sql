
ALTER TABLE public.bendahara_settings
  ADD COLUMN IF NOT EXISTS withdraw_fee_default integer NOT NULL DEFAULT 3000,
  ADD COLUMN IF NOT EXISTS min_payout integer NOT NULL DEFAULT 10000;

ALTER TABLE public.bendahara_bank_accounts
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.spp_settlements
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid,
  ADD COLUMN IF NOT EXISTS cancel_reason text;
