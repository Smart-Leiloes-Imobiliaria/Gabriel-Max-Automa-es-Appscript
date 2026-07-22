ALTER TABLE public.video_conferences
ADD COLUMN IF NOT EXISTS meeting_type text NOT NULL DEFAULT 'Meet';