CREATE POLICY "Partners can read manager files of their treatments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'minutas'
  AND EXISTS (
    SELECT 1 FROM public.property_treatments pt
    WHERE pt.owner_id = auth.uid()
      AND (
        objects.name = pt.manager_minute_file_path
        OR objects.name = pt.manager_contract_file_path
      )
  )
);