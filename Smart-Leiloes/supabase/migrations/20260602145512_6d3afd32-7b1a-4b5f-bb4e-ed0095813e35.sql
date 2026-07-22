ALTER TABLE public.property_treatments REPLICA IDENTITY FULL;
ALTER TABLE public.video_conferences REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.user_roles REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.property_treatments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_conferences;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;