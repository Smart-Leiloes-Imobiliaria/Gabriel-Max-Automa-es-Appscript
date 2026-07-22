
-- 1) Excluir videoconferências de teste
DELETE FROM public.video_conferences
WHERE client_name ILIKE '%teste%'
   OR client_name ILIKE '%test%'
   OR agency_id = 'ag_teste'
   OR protocol LIKE 'TEST-%';

-- 2) Excluir tratativas/contratos de teste
DELETE FROM public.property_treatments
WHERE client_name ILIKE '%teste%'
   OR protocol LIKE 'TEST-%'
   OR agency_id = 'ag_teste';

-- 3) Excluir usuários de teste (roles -> profiles -> auth.users)
DELETE FROM public.user_roles WHERE user_id IN (
  'dd2ab822-d34c-4836-be4f-0ddd36ffbb2a',
  '120da15d-e4c7-4f56-b08a-741c01ff8b83',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  'ae355b23-b386-4972-8e92-d169ddf76ab2'
);

DELETE FROM public.profiles WHERE id IN (
  'dd2ab822-d34c-4836-be4f-0ddd36ffbb2a',
  '120da15d-e4c7-4f56-b08a-741c01ff8b83',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  'ae355b23-b386-4972-8e92-d169ddf76ab2'
);

DELETE FROM auth.users WHERE id IN (
  'dd2ab822-d34c-4836-be4f-0ddd36ffbb2a',
  '120da15d-e4c7-4f56-b08a-741c01ff8b83',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  'ae355b23-b386-4972-8e92-d169ddf76ab2'
);
