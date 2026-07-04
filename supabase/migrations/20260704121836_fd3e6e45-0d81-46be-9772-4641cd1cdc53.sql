
-- 1. STUDENTS card_number
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS card_number TEXT UNIQUE;

CREATE OR REPLACE FUNCTION public.generate_student_card_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  candidate TEXT;
  i INT := 0;
BEGIN
  LOOP
    -- 16 random digits, first digit 1-9
    candidate := (1 + floor(random()*9))::int::text;
    FOR i IN 1..15 LOOP
      candidate := candidate || floor(random()*10)::int::text;
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.students WHERE card_number = candidate);
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_students_set_card_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.card_number IS NULL OR NEW.card_number = '' THEN
    NEW.card_number := public.generate_student_card_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS students_set_card_number ON public.students;
CREATE TRIGGER students_set_card_number
BEFORE INSERT ON public.students
FOR EACH ROW EXECUTE FUNCTION public.trg_students_set_card_number();

-- Backfill existing students
UPDATE public.students SET card_number = public.generate_student_card_number() WHERE card_number IS NULL;

-- 2. SCHOOLS holiday_mode
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS holiday_mode BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS holiday_mode_label TEXT;

-- 3. SCHOOL HOLIDAYS
CREATE TABLE IF NOT EXISTS public.school_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, date)
);

GRANT SELECT ON public.school_holidays TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_holidays TO authenticated;
GRANT ALL ON public.school_holidays TO service_role;

ALTER TABLE public.school_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view holidays"
ON public.school_holidays FOR SELECT
USING (true);

CREATE POLICY "School admins manage own holidays"
ON public.school_holidays FOR ALL
TO authenticated
USING (
  school_id = public.get_user_school_id(auth.uid())
  AND (public.has_role(auth.uid(), 'school_admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
)
WITH CHECK (
  school_id = public.get_user_school_id(auth.uid())
  AND (public.has_role(auth.uid(), 'school_admin'::app_role) OR public.has_role(auth.uid(), 'super_admin'::app_role))
);

CREATE POLICY "Super admin all holidays"
ON public.school_holidays FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));
