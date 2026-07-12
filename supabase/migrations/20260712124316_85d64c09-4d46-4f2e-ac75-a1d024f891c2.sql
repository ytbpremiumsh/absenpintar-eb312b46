
-- ============= STORAGE: school-logos =============
DROP POLICY IF EXISTS "Authenticated users can upload school logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update school logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete school logos" ON storage.objects;

CREATE POLICY "School admins upload own school logo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'school-logos'
  AND (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (storage.foldername(name))[1] = public.get_user_school_id(auth.uid())::text
  )
);

CREATE POLICY "School admins update own school logo"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'school-logos'
  AND (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (storage.foldername(name))[1] = public.get_user_school_id(auth.uid())::text
  )
);

CREATE POLICY "School admins delete own school logo"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'school-logos'
  AND (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (storage.foldername(name))[1] = public.get_user_school_id(auth.uid())::text
  )
);

-- ============= STORAGE: student-photos =============
DROP POLICY IF EXISTS "Authenticated users can upload student photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update student photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete student photos" ON storage.objects;

CREATE POLICY "School members upload own school student photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'student-photos'
  AND (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (storage.foldername(name))[1] = public.get_user_school_id(auth.uid())::text
  )
);

CREATE POLICY "School members update own school student photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'student-photos'
  AND (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (storage.foldername(name))[1] = public.get_user_school_id(auth.uid())::text
  )
);

CREATE POLICY "School members delete own school student photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'student-photos'
  AND (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (storage.foldername(name))[1] = public.get_user_school_id(auth.uid())::text
  )
);

-- ============= STORAGE: teacher-photos =============
DROP POLICY IF EXISTS "Auth upload teacher photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth update teacher photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete teacher photos" ON storage.objects;

CREATE POLICY "Manage own or same-school teacher photos (insert)"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'teacher-photos'
  AND (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR (
      public.has_role(auth.uid(), 'school_admin'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id::text = (storage.foldername(name))[1]
          AND p.school_id = public.get_user_school_id(auth.uid())
      )
    )
  )
);

CREATE POLICY "Manage own or same-school teacher photos (update)"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'teacher-photos'
  AND (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR (
      public.has_role(auth.uid(), 'school_admin'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id::text = (storage.foldername(name))[1]
          AND p.school_id = public.get_user_school_id(auth.uid())
      )
    )
  )
);

CREATE POLICY "Manage own or same-school teacher photos (delete)"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'teacher-photos'
  AND (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR (
      public.has_role(auth.uid(), 'school_admin'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id::text = (storage.foldername(name))[1]
          AND p.school_id = public.get_user_school_id(auth.uid())
      )
    )
  )
);

-- ============= STORAGE: announcement-attachments =============
DROP POLICY IF EXISTS "Authenticated can upload announcement attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update announcement attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete announcement attachments" ON storage.objects;

CREATE POLICY "Admins upload announcement attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'announcement-attachments'
  AND (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'school_admin'::app_role)
  )
);

CREATE POLICY "Admins update announcement attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'announcement-attachments'
  AND (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'school_admin'::app_role)
  )
);

CREATE POLICY "Admins delete announcement attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'announcement-attachments'
  AND (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'school_admin'::app_role)
  )
);

-- ============= STORAGE: parent-attachments =============
DROP POLICY IF EXISTS "Authenticated upload parent attachments" ON storage.objects;

CREATE POLICY "Parent attachments upload restricted to leave prefix"
ON storage.objects FOR INSERT TO authenticated, anon
WITH CHECK (
  bucket_id = 'parent-attachments'
  AND (storage.foldername(name))[1] = 'leave'
);

-- ============= PUBLIC RLS cleanup =============

-- email_logs: service role bypasses RLS; remove overly permissive true policy
DROP POLICY IF EXISTS "Service can insert email_logs" ON public.email_logs;

-- short_link_clicks: written via SECURITY DEFINER RPC increment_shortlink_click
DROP POLICY IF EXISTS "Service insert click" ON public.short_link_clicks;

-- package_audit_log: restrict inserts to Super Admin only
DROP POLICY IF EXISTS "authenticated insert audit" ON public.package_audit_log;

CREATE POLICY "Super admin insert package audit"
ON public.package_audit_log FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));
