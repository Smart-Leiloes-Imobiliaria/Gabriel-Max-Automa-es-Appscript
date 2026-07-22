ALTER TABLE public.property_treatments
  ADD COLUMN IF NOT EXISTS manager_contract_file_path text,
  ADD COLUMN IF NOT EXISTS manager_contract_file_name text,
  ADD COLUMN IF NOT EXISTS manager_contract_uploaded_at timestamptz;