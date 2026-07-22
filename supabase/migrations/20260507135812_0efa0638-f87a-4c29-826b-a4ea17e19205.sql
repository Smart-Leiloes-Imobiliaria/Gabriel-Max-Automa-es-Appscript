
CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin'::public.app_role)
$$;

GRANT EXECUTE ON FUNCTION public.admin_exists() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  _requested text;
  _role public.app_role;
  _has_admin boolean;
begin
  insert into public.profiles (id, full_name, agency_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'agency_id', '')
  );

  _requested := coalesce(new.raw_user_meta_data->>'role', 'parceiro');

  IF _requested = 'admin' THEN
    SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin'::public.app_role) INTO _has_admin;
    IF _has_admin THEN
      _role := 'parceiro'::public.app_role;
    ELSE
      _role := 'admin'::public.app_role;
    END IF;
  ELSE
    _role := _requested::public.app_role;
  END IF;

  insert into public.user_roles (user_id, role) values (new.id, _role);
  return new;
end;
$$;

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view all audit logs"
  ON public.admin_audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR auth.uid() = actor_id);

CREATE POLICY "Authenticated can insert own audit"
  ON public.admin_audit_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = actor_id);

DROP POLICY IF EXISTS "VC update by owner or manager" ON public.video_conferences;
CREATE POLICY "VC update by owner manager or admin"
  ON public.video_conferences FOR UPDATE TO authenticated
  USING (
    auth.uid() = owner_id
    OR public.has_role(auth.uid(), 'gerente'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "PT update by owner or manager" ON public.property_treatments;
CREATE POLICY "PT update by owner manager or admin"
  ON public.property_treatments FOR UPDATE TO authenticated
  USING (
    auth.uid() = owner_id
    OR public.has_role(auth.uid(), 'gerente'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );
