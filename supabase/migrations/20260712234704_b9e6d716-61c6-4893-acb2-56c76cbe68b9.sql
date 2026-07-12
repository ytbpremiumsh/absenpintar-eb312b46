ALTER TABLE public.bendahara_bank_accounts
  ADD COLUMN IF NOT EXISTS doku_bank_account_settlement_id text,
  ADD COLUMN IF NOT EXISTS doku_response jsonb,
  ADD COLUMN IF NOT EXISTS doku_synced_at timestamptz;