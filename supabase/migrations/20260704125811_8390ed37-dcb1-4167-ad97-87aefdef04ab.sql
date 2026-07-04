
-- Add WITH CHECK to prevent cross-tenant reassignment on UPDATE

DROP POLICY IF EXISTS "Staff update attendance" ON public.attendance_logs;
CREATE POLICY "Staff update attendance" ON public.attendance_logs
  FOR UPDATE
  USING (school_id = get_user_school_id(auth.uid()))
  WITH CHECK (school_id = get_user_school_id(auth.uid()));

DROP POLICY IF EXISTS "School staff can update own school bank accounts" ON public.bendahara_bank_accounts;
CREATE POLICY "School staff can update own school bank accounts" ON public.bendahara_bank_accounts
  FOR UPDATE
  USING ((school_id = get_user_school_id(auth.uid())) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK ((school_id = get_user_school_id(auth.uid())) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Staff update dismissal logs" ON public.dismissal_logs;
CREATE POLICY "Staff update dismissal logs" ON public.dismissal_logs
  FOR UPDATE
  USING ((school_id = get_user_school_id(auth.uid())) OR has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK ((school_id = get_user_school_id(auth.uid())) OR has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Teachers update own subject attendance" ON public.subject_attendance;
CREATE POLICY "Teachers update own subject attendance" ON public.subject_attendance
  FOR UPDATE
  USING (teacher_id = auth.uid())
  WITH CHECK ((teacher_id = auth.uid()) AND (school_id = get_user_school_id(auth.uid())));

DROP POLICY IF EXISTS "Users update own tickets" ON public.support_tickets;
CREATE POLICY "Users update own tickets" ON public.support_tickets
  FOR UPDATE
  USING (school_id = get_user_school_id(auth.uid()))
  WITH CHECK (school_id = get_user_school_id(auth.uid()));

-- teacher_attendance_logs update policy
DROP POLICY IF EXISTS "School staff update teacher attendance" ON public.teacher_attendance_logs;
CREATE POLICY "School staff update teacher attendance" ON public.teacher_attendance_logs
  FOR UPDATE
  USING (school_id = get_user_school_id(auth.uid()))
  WITH CHECK (school_id = get_user_school_id(auth.uid()));

-- Restrict school_holidays read to authenticated users of the same school
DROP POLICY IF EXISTS "Anyone can view holidays" ON public.school_holidays;
CREATE POLICY "Authenticated view own school holidays" ON public.school_holidays
  FOR SELECT
  TO authenticated
  USING (school_id = get_user_school_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));
