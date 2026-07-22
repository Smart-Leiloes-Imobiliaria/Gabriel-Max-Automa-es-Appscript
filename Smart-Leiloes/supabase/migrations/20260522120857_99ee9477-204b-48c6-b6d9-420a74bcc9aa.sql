
-- Helper: get agency_id of a user (SECURITY DEFINER to avoid recursion)
CREATE OR REPLACE FUNCTION public.get_user_agency(_user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT agency_id FROM public.profiles WHERE id = _user_id $$;

-- ===== profiles =====
DROP POLICY IF EXISTS "Profiles selectable by authenticated" ON public.profiles;
CREATE POLICY "Profiles select own or admin or gerente"
ON public.profiles FOR SELECT TO authenticated
USING (
  auth.uid() = id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gerente'::public.app_role)
);

-- ===== user_roles =====
DROP POLICY IF EXISTS "Roles readable by authenticated" ON public.user_roles;
CREATE POLICY "Roles select own or admin"
ON public.user_roles FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- ===== property_treatments =====
DROP POLICY IF EXISTS "PT viewable by authenticated" ON public.property_treatments;
CREATE POLICY "PT select owner agency admin"
ON public.property_treatments FOR SELECT TO authenticated
USING (
  auth.uid() = owner_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (public.has_role(auth.uid(), 'gerente'::public.app_role)
      AND agency_id IS NOT NULL
      AND agency_id = public.get_user_agency(auth.uid()))
);

-- ===== video_conferences =====
DROP POLICY IF EXISTS "VC viewable by authenticated" ON public.video_conferences;
CREATE POLICY "VC select owner agency admin"
ON public.video_conferences FOR SELECT TO authenticated
USING (
  auth.uid() = owner_id
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (public.has_role(auth.uid(), 'gerente'::public.app_role)
      AND agency_id = public.get_user_agency(auth.uid()))
);

-- Public RPC for slot availability without exposing other PII
CREATE OR REPLACE FUNCTION public.get_day_bookings(_agency_id text, _date date)
RETURNS TABLE(conference_time text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT conference_time FROM public.video_conferences
  WHERE agency_id = _agency_id AND conference_date = _date AND status <> 'Cancelada'
$$;

-- Public RPC for confirmation page (look up own/related schedule by protocol)
CREATE OR REPLACE FUNCTION public.get_schedule_by_protocol(_protocol text)
RETURNS SETOF public.video_conferences
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.video_conferences WHERE protocol = _protocol LIMIT 1
$$;

-- ===== notification_logs =====
DROP POLICY IF EXISTS "Notif logs viewable by authenticated" ON public.notification_logs;
CREATE POLICY "Notif logs select agency or admin"
ON public.notification_logs FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (public.has_role(auth.uid(), 'gerente'::public.app_role)
      AND agency_id = public.get_user_agency(auth.uid()))
);

-- ===== storage.objects (minutas bucket) =====
DROP POLICY IF EXISTS "minutas select authenticated" ON storage.objects;
DROP POLICY IF EXISTS "minutas insert authenticated" ON storage.objects;
DROP POLICY IF EXISTS "minutas update authenticated" ON storage.objects;
DROP POLICY IF EXISTS "minutas delete authenticated" ON storage.objects;
-- Drop any preexisting permissive policies (best effort by common names)
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname ILIKE '%minutas%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "minutas select owner or admin or gerente"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'minutas' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente'::public.app_role)
  )
);

CREATE POLICY "minutas insert own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'minutas'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "minutas update own folder or admin"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'minutas' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

CREATE POLICY "minutas delete own folder or admin"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'minutas' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);
