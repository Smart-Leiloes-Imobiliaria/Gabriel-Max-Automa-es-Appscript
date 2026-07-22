
-- 1. Restrict profiles SELECT policy to authenticated role only
DROP POLICY IF EXISTS "Profiles select own or admin or gerente same agency" ON public.profiles;
CREATE POLICY "Profiles select own or admin or gerente same agency"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (auth.uid() = id)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    public.has_role(auth.uid(), 'gerente'::public.app_role)
    AND agency_id IS NOT NULL
    AND agency_id = public.get_user_agency(auth.uid())
  )
);

-- 2. Lock down admin_audit_logs writes — only service_role (edge functions) can insert; nobody can delete via API
DROP POLICY IF EXISTS "Deny insert audit logs to authenticated" ON public.admin_audit_logs;
CREATE POLICY "Deny insert audit logs to authenticated"
ON public.admin_audit_logs
AS RESTRICTIVE
FOR INSERT
TO authenticated, anon
WITH CHECK (false);

DROP POLICY IF EXISTS "Deny delete audit logs to authenticated" ON public.admin_audit_logs;
CREATE POLICY "Deny delete audit logs to authenticated"
ON public.admin_audit_logs
AS RESTRICTIVE
FOR DELETE
TO authenticated, anon
USING (false);

DROP POLICY IF EXISTS "Deny update audit logs to authenticated" ON public.admin_audit_logs;
CREATE POLICY "Deny update audit logs to authenticated"
ON public.admin_audit_logs
AS RESTRICTIVE
FOR UPDATE
TO authenticated, anon
USING (false)
WITH CHECK (false);

-- 3. Realtime: tighten gerente broadcast topic scoping — require agency-scoped topic
-- (App uses postgres_changes, which is governed by table RLS; broadcast topics are unused.)
DROP POLICY IF EXISTS "Realtime: gerente receives agency tables" ON realtime.messages;
CREATE POLICY "Realtime: gerente receives own agency topic"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'gerente'::public.app_role)
  AND realtime.topic() = ('agency:' || public.get_user_agency(auth.uid()))
);
