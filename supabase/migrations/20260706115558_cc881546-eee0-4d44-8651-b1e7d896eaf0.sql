
-- payment_types
CREATE TABLE public.payment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'lainnya',
  amount integer NOT NULL DEFAULT 0,
  applies_to text NOT NULL DEFAULT 'all',
  period text NOT NULL DEFAULT 'once',
  is_active boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_types TO authenticated;
GRANT ALL ON public.payment_types TO service_role;

ALTER TABLE public.payment_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_types super admin all"
ON public.payment_types FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "payment_types school members select"
ON public.payment_types FOR SELECT TO authenticated
USING (school_id = public.get_user_school_id(auth.uid()));

CREATE POLICY "payment_types school admin bendahara write"
ON public.payment_types FOR ALL TO authenticated
USING (
  school_id = public.get_user_school_id(auth.uid())
  AND (public.has_role(auth.uid(), 'school_admin'::app_role) OR public.has_role(auth.uid(), 'bendahara'::app_role))
)
WITH CHECK (
  school_id = public.get_user_school_id(auth.uid())
  AND (public.has_role(auth.uid(), 'school_admin'::app_role) OR public.has_role(auth.uid(), 'bendahara'::app_role))
);

CREATE TRIGGER trg_payment_types_updated
BEFORE UPDATE ON public.payment_types
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_payment_types_school ON public.payment_types(school_id);

-- cash_book_entries
CREATE TABLE public.cash_book_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  direction text NOT NULL CHECK (direction IN ('in','out')),
  category text NOT NULL DEFAULT 'lainnya',
  amount integer NOT NULL DEFAULT 0,
  description text,
  reference text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_book_entries TO authenticated;
GRANT ALL ON public.cash_book_entries TO service_role;

ALTER TABLE public.cash_book_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash_book super admin all"
ON public.cash_book_entries FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "cash_book school members select"
ON public.cash_book_entries FOR SELECT TO authenticated
USING (school_id = public.get_user_school_id(auth.uid()));

CREATE POLICY "cash_book school admin bendahara write"
ON public.cash_book_entries FOR ALL TO authenticated
USING (
  school_id = public.get_user_school_id(auth.uid())
  AND (public.has_role(auth.uid(), 'school_admin'::app_role) OR public.has_role(auth.uid(), 'bendahara'::app_role))
)
WITH CHECK (
  school_id = public.get_user_school_id(auth.uid())
  AND (public.has_role(auth.uid(), 'school_admin'::app_role) OR public.has_role(auth.uid(), 'bendahara'::app_role))
);

CREATE TRIGGER trg_cash_book_updated
BEFORE UPDATE ON public.cash_book_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_cash_book_school_date ON public.cash_book_entries(school_id, entry_date DESC);
