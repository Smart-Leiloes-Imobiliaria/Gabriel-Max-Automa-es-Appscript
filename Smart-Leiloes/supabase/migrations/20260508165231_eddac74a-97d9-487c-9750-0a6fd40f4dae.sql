-- 1) Restringir INSERT do notification_logs (não pode usar (true))
DROP POLICY IF EXISTS "Notif logs insert by authenticated" ON public.notification_logs;
CREATE POLICY "Notif logs insert by authenticated"
  ON public.notification_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 2) next_protocol: usar SECURITY INVOKER e dar GRANT na sequência
CREATE OR REPLACE FUNCTION public.next_protocol(prefix text)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
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

REVOKE EXECUTE ON FUNCTION public.next_protocol(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_protocol(text) TO authenticated;
GRANT USAGE ON SEQUENCE public.protocol_seq TO authenticated;