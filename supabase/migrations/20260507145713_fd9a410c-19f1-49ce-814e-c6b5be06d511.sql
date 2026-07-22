-- Bucket privado para minutas
INSERT INTO storage.buckets (id, name, public)
VALUES ('minutas', 'minutas', false)
ON CONFLICT (id) DO NOTHING;

-- Coluna para armazenar caminho do arquivo
ALTER TABLE public.property_treatments
ADD COLUMN IF NOT EXISTS minute_file_path TEXT,
ADD COLUMN IF NOT EXISTS minute_file_name TEXT;

-- Políticas de Storage: usuários autenticados podem ler/enviar minutas
CREATE POLICY "Authenticated can view minutas"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'minutas');

CREATE POLICY "Authenticated can upload minutas"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'minutas');

CREATE POLICY "Owners can update their minutas"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'minutas' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners can delete their minutas"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'minutas' AND auth.uid()::text = (storage.foldername(name))[1]);