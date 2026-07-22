CREATE POLICY "PT delete by owner or admin"
ON public.property_treatments FOR DELETE
USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'::public.app_role));