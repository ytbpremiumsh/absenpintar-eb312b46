ALTER TABLE public.students ADD COLUMN IF NOT EXISTS rfid_uid text;
CREATE UNIQUE INDEX IF NOT EXISTS students_school_rfid_uid_key ON public.students(school_id, rfid_uid) WHERE rfid_uid IS NOT NULL;