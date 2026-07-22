
ALTER TABLE public.video_conferences
  ADD COLUMN IF NOT EXISTS client_present boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_phone text,
  ADD COLUMN IF NOT EXISTS client_email text,
  ADD COLUMN IF NOT EXISTS client_whatsapp_status text,
  ADD COLUMN IF NOT EXISTS client_whatsapp_error text,
  ADD COLUMN IF NOT EXISTS client_email_status text,
  ADD COLUMN IF NOT EXISTS client_email_error text;
