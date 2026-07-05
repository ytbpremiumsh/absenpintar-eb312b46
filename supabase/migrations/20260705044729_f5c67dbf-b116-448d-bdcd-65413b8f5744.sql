
-- 1) schools: restrict anon column access
REVOKE SELECT ON public.schools FROM anon;
GRANT SELECT (id, name, slug, logo, npsn, city) ON public.schools TO anon;

-- 2) ticket_replies: prevent is_admin spoofing
DROP POLICY IF EXISTS "Users create ticket replies" ON public.ticket_replies;
CREATE POLICY "Users create ticket replies"
ON public.ticket_replies
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (is_admin = false OR public.has_role(auth.uid(), 'super_admin'::app_role))
  AND ticket_id IN (
    SELECT support_tickets.id
    FROM public.support_tickets
    WHERE support_tickets.school_id = public.get_user_school_id(auth.uid())
      AND support_tickets.status <> 'resolved'
  )
);
