
-- Fix profiles RLS: gerente sees only profiles within their own agency
DROP POLICY IF EXISTS "Profiles select own or admin or gerente" ON public.profiles;
CREATE POLICY "Profiles select own or admin or gerente same agency"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (
    has_role(auth.uid(), 'gerente'::app_role)
    AND agency_id IS NOT NULL
    AND agency_id = public.get_user_agency(auth.uid())
  )
);

-- Remove user-writable audit log INSERT; audit writes must come from service role
DROP POLICY IF EXISTS "Authenticated can insert own audit" ON public.admin_audit_logs;
