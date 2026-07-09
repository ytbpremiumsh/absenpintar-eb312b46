
-- Extend school_holidays into an academic calendar
ALTER TABLE public.school_holidays
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'holiday',
  ADD COLUMN IF NOT EXISTS is_holiday boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS description text;

-- Allow multiple events per date (previous logic assumed one row per date).
-- Existing rows keep is_holiday=true so attendance-blocking behavior is unchanged.

-- Index to speed up per-date + is_holiday lookups used by attendance flow
CREATE INDEX IF NOT EXISTS school_holidays_school_date_idx
  ON public.school_holidays (school_id, date);
