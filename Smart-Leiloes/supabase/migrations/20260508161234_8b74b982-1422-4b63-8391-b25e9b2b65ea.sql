ALTER TABLE public.property_treatments
  ADD COLUMN IF NOT EXISTS contract_file_path text,
  ADD COLUMN IF NOT EXISTS contract_file_name text;