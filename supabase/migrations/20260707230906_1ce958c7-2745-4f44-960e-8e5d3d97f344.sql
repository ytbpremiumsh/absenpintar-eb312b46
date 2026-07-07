-- 1) schools: restrict anon column-level access to safe public columns only
REVOKE SELECT ON public.schools FROM anon;
GRANT SELECT (
  id, name, slug, logo, timezone,
  holiday_mode, holiday_mode_label, holiday_days,
  group_id, rfid_mode
) ON public.schools TO anon;

-- 2) student_grades: require teacher/school_admin/staff role for writes
DROP POLICY IF EXISTS "School staff manage grades" ON public.student_grades;
CREATE POLICY "School staff manage grades"
ON public.student_grades
FOR ALL
TO authenticated
USING (
  school_id = public.get_user_school_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'teacher'::app_role)
    OR public.has_role(auth.uid(), 'school_admin'::app_role)
    OR public.has_role(auth.uid(), 'staff'::app_role)
  )
)
WITH CHECK (
  school_id = public.get_user_school_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'teacher'::app_role)
    OR public.has_role(auth.uid(), 'school_admin'::app_role)
    OR public.has_role(auth.uid(), 'staff'::app_role)
  )
);

-- 3) teacher_attendance_logs: restrict UPDATE to owner or admin/staff role
DROP POLICY IF EXISTS "School staff update teacher attendance" ON public.teacher_attendance_logs;
CREATE POLICY "School staff update teacher attendance"
ON public.teacher_attendance_logs
FOR UPDATE
TO authenticated
USING (
  school_id = public.get_user_school_id(auth.uid())
  AND (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'school_admin'::app_role)
    OR public.has_role(auth.uid(), 'staff'::app_role)
  )
)
WITH CHECK (
  school_id = public.get_user_school_id(auth.uid())
  AND (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'school_admin'::app_role)
    OR public.has_role(auth.uid(), 'staff'::app_role)
  )
);

-- 4) Set search_path on pgmq wrapper functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;