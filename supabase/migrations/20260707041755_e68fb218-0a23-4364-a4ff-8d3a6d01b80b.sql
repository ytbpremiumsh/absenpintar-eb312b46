-- Kepala Sekolah (principal) dapat melihat profil & role guru/staff di sekolahnya
CREATE POLICY "Principals view school profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  school_id = public.get_user_school_id(auth.uid())
  AND public.has_role(auth.uid(), 'principal'::app_role)
);

CREATE POLICY "Principals view school user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'principal'::app_role)
  AND user_id IN (
    SELECT p.user_id FROM public.profiles p
    WHERE p.school_id = public.get_user_school_id(auth.uid())
  )
);