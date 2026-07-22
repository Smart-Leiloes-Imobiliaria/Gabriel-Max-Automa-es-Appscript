-- Adicionar campos a video_conferences
ALTER TABLE public.video_conferences
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid;

-- Adicionar campos a property_treatments
ALTER TABLE public.property_treatments
  ADD COLUMN IF NOT EXISTS observations text,
  ADD COLUMN IF NOT EXISTS signature_type text,
  ADD COLUMN IF NOT EXISTS minute_status text NOT NULL DEFAULT 'Pendente de validação',
  ADD COLUMN IF NOT EXISTS manager_validated boolean,
  ADD COLUMN IF NOT EXISTS manager_validation_reason text,
  ADD COLUMN IF NOT EXISTS manager_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS manager_minute_file_path text,
  ADD COLUMN IF NOT EXISTS manager_minute_file_name text;

-- Tabela notification_logs
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  related_type text NOT NULL,
  related_id text NOT NULL,
  agency_id text NOT NULL,
  channel text NOT NULL DEFAULT 'mock',
  message text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  sent_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notif logs viewable by authenticated"
  ON public.notification_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Notif logs insert by authenticated"
  ON public.notification_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Sequência + função next_protocol
CREATE SEQUENCE IF NOT EXISTS public.protocol_seq START 1;

CREATE OR REPLACE FUNCTION public.next_protocol(prefix text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n bigint;
  yr int;
BEGIN
  n := nextval('public.protocol_seq');
  yr := extract(year from now())::int;
  RETURN prefix || '-' || yr || '-' || lpad(n::text, 6, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_protocol(text) TO authenticated;