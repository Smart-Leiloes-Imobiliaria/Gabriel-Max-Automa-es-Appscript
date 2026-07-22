
-- 1) Restrict admin_audit_logs SELECT to admins only
DROP POLICY IF EXISTS "Users can read their own audit entries" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Actors can read their own audit entries" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Read own audit entries" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "select_own_audit" ON public.admin_audit_logs;

-- Drop any existing admin select policy to recreate cleanly
DROP POLICY IF EXISTS "Admins can read audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins can read audit logs"
ON public.admin_audit_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) Tighten minutas storage SELECT for gerentes — require an actual property_treatment
DROP POLICY IF EXISTS "Gerentes can read agency minutas" ON storage.objects;
DROP POLICY IF EXISTS "gerente_select_minutas" ON storage.objects;
DROP POLICY IF EXISTS "Gerente read minutas by agency" ON storage.objects;

CREATE POLICY "Gerentes can read minutas of their agency treatments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'minutas'
  AND public.has_role(auth.uid(), 'gerente'::public.app_role)
  AND EXISTS (
    SELECT 1
    FROM public.property_treatments pt
    WHERE pt.agency_id = public.get_user_agency(auth.uid())
      AND pt.agency_id IS NOT NULL
      AND (
        storage.objects.name = pt.minute_file_path
        OR storage.objects.name = pt.manager_minute_file_path
        OR storage.objects.name = pt.contract_file_path
        OR storage.objects.name = pt.manager_contract_file_path
      )
  )
);
