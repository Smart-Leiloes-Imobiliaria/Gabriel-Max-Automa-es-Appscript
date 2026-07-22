ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _requested text;
  _role public.app_role;
  _has_admin boolean;
begin
  insert into public.profiles (id, full_name, agency_id, notary_office_name, uf, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'agency_id', ''),
    nullif(new.raw_user_meta_data->>'notary_office_name', ''),
    nullif(new.raw_user_meta_data->>'uf', ''),
    nullif(new.raw_user_meta_data->>'phone', '')
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
$function$;