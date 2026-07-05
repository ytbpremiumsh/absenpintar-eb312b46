ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rfid_uid TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_rfid_uid_unique ON public.profiles (rfid_uid) WHERE rfid_uid IS NOT NULL;