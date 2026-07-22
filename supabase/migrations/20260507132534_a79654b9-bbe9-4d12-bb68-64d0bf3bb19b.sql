
CREATE TABLE public.video_conferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  protocol TEXT NOT NULL UNIQUE,
  property_state TEXT NOT NULL,
  agency_id TEXT NOT NULL,
  agency_name TEXT NOT NULL,
  notary_office_name TEXT NOT NULL,
  partner_responsible_name TEXT NOT NULL,
  conference_date DATE NOT NULL,
  conference_time TEXT NOT NULL,
  client_name TEXT NOT NULL,
  property_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Videoconferência agendada',
  owner_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX video_conferences_unique_active_slot
  ON public.video_conferences (agency_id, conference_date, conference_time)
  WHERE status <> 'Cancelada';

ALTER TABLE public.video_conferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "VC viewable by authenticated"
  ON public.video_conferences FOR SELECT TO authenticated USING (true);

CREATE POLICY "VC insert by owner"
  ON public.video_conferences FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "VC update by owner or manager"
  ON public.video_conferences FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'gerente'));

CREATE TABLE public.property_treatments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  protocol TEXT NOT NULL UNIQUE,
  uf TEXT NOT NULL,
  property_code TEXT NOT NULL,
  client_name TEXT NOT NULL,
  minute_sent_at DATE NOT NULL,
  demand_status TEXT NOT NULL,
  agency_id TEXT,
  agency_name TEXT,
  owner_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.property_treatments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PT viewable by authenticated"
  ON public.property_treatments FOR SELECT TO authenticated USING (true);

CREATE POLICY "PT insert by owner"
  ON public.property_treatments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "PT update by owner or manager"
  ON public.property_treatments FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'gerente'));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_vc_updated BEFORE UPDATE ON public.video_conferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_pt_updated BEFORE UPDATE ON public.property_treatments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
