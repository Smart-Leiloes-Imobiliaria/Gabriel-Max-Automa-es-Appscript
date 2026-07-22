
-- Fix overpermissive UPDATE on property_treatments
DROP POLICY IF EXISTS "PT update by owner manager or admin" ON public.property_treatments;
CREATE POLICY "PT update by owner manager or admin"
ON public.property_treatments
FOR UPDATE
TO authenticated
USING (
  (auth.uid() = owner_id)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (public.has_role(auth.uid(), 'gerente'::public.app_role)
      AND agency_id IS NOT NULL
      AND agency_id = public.get_user_agency(auth.uid()))
);

-- Fix overpermissive UPDATE on video_conferences
DROP POLICY IF EXISTS "VC update by owner manager or admin" ON public.video_conferences;
CREATE POLICY "VC update by owner manager or admin"
ON public.video_conferences
FOR UPDATE
TO authenticated
USING (
  (auth.uid() = owner_id)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (public.has_role(auth.uid(), 'gerente'::public.app_role)
      AND agency_id = public.get_user_agency(auth.uid()))
);

-- Restrict notification_logs INSERT to gerente/admin within their own agency
DROP POLICY IF EXISTS "Notif logs insert by authenticated" ON public.notification_logs;
CREATE POLICY "Notif logs insert by gerente or admin"
ON public.notification_logs
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (public.has_role(auth.uid(), 'gerente'::public.app_role)
      AND agency_id = public.get_user_agency(auth.uid()))
);

-- Restrict storage 'minutas' SELECT so gerente only sees files from users in their agency
DROP POLICY IF EXISTS "minutas select owner or admin or gerente" ON storage.objects;
CREATE POLICY "minutas select owner or admin or gerente"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'minutas'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      public.has_role(auth.uid(), 'gerente'::public.app_role)
      AND public.get_user_agency(
        NULLIF((storage.foldername(name))[1], '')::uuid
      ) IS NOT NULL
      AND public.get_user_agency(
        NULLIF((storage.foldername(name))[1], '')::uuid
      ) = public.get_user_agency(auth.uid())
    )
  )
);

-- Secure Supabase Realtime: enforce RLS on realtime.messages so subscribers
-- only receive events for rows their per-table RLS already allows them to read.
-- Topics used by the app are the table names themselves
-- (e.g. 'property_treatments', 'video_conferences', 'profiles', 'user_roles').
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Realtime: admins receive all" ON realtime.messages;
CREATE POLICY "Realtime: admins receive all"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Realtime: gerente receives agency tables" ON realtime.messages;
CREATE POLICY "Realtime: gerente receives agency tables"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'gerente'::public.app_role)
  AND realtime.topic() IN (
    'property_treatments',
    'video_conferences',
    'profiles',
    'user_roles'
  )
);

DROP POLICY IF EXISTS "Realtime: parceiro receives own topics" ON realtime.messages;
CREATE POLICY "Realtime: parceiro receives own topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'parceiro'::public.app_role)
  AND realtime.topic() = ('user:' || auth.uid()::text)
);
