DROP POLICY IF EXISTS "minutas select owner or admin or gerente" ON storage.objects;
CREATE POLICY "minutas select owner or admin"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'minutas'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);