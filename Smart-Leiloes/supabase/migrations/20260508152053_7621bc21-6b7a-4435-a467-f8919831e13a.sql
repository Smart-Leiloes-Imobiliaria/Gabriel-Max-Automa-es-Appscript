
ALTER TABLE public.video_conferences
  ADD COLUMN IF NOT EXISTS client_cpf text,
  ADD COLUMN IF NOT EXISTS property_registration text,
  ADD COLUMN IF NOT EXISTS meet_link text,
  ADD COLUMN IF NOT EXISTS meet_event_id text;
