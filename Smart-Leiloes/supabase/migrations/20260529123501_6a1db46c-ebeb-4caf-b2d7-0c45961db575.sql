
ALTER TABLE public.video_conferences
  ADD COLUMN IF NOT EXISTS partner_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS partner_confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS manager_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS manager_confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE OR REPLACE FUNCTION public.vc_sync_completion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'Cancelada' THEN
    RETURN NEW;
  END IF;

  IF NEW.partner_confirmed_at IS NOT NULL AND NEW.manager_confirmed_at IS NOT NULL THEN
    NEW.status := 'Concluída';
    IF NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;
  ELSIF NEW.partner_confirmed_at IS NOT NULL OR NEW.manager_confirmed_at IS NOT NULL THEN
    IF NEW.status IS DISTINCT FROM 'Concluída' THEN
      NEW.status := 'Aguardando confirmação';
    END IF;
    NEW.completed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vc_sync_completion ON public.video_conferences;
CREATE TRIGGER trg_vc_sync_completion
BEFORE INSERT OR UPDATE OF partner_confirmed_at, manager_confirmed_at ON public.video_conferences
FOR EACH ROW EXECUTE FUNCTION public.vc_sync_completion();
