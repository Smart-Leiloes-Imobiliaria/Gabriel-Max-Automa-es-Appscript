ALTER TABLE public.property_treatments
ADD COLUMN IF NOT EXISTS notary_office_name text,
ADD COLUMN IF NOT EXISTS property_registration text;