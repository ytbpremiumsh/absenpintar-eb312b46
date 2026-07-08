
CREATE TABLE IF NOT EXISTS public.spp_tariff_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  tariff_id UUID NOT NULL REFERENCES public.spp_tariffs(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'Potongan',
  amount INTEGER NOT NULL DEFAULT 0 CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tariff_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_spp_tariff_discounts_tariff ON public.spp_tariff_discounts(tariff_id);
CREATE INDEX IF NOT EXISTS idx_spp_tariff_discounts_student ON public.spp_tariff_discounts(student_id);
CREATE INDEX IF NOT EXISTS idx_spp_tariff_discounts_school ON public.spp_tariff_discounts(school_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.spp_tariff_discounts TO authenticated;
GRANT ALL ON public.spp_tariff_discounts TO service_role;

ALTER TABLE public.spp_tariff_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School users view tariff discounts" ON public.spp_tariff_discounts
  FOR SELECT TO authenticated USING (school_id = get_user_school_id(auth.uid()));

CREATE POLICY "Bendahara admin manage tariff discounts" ON public.spp_tariff_discounts
  FOR ALL TO authenticated
  USING (school_id = get_user_school_id(auth.uid()) AND (has_role(auth.uid(),'bendahara'::app_role) OR has_role(auth.uid(),'school_admin'::app_role)))
  WITH CHECK (school_id = get_user_school_id(auth.uid()) AND (has_role(auth.uid(),'bendahara'::app_role) OR has_role(auth.uid(),'school_admin'::app_role)));

CREATE POLICY "Super admin manage tariff discounts" ON public.spp_tariff_discounts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'super_admin'::app_role));

CREATE TRIGGER trg_spp_tariff_discounts_updated
  BEFORE UPDATE ON public.spp_tariff_discounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
