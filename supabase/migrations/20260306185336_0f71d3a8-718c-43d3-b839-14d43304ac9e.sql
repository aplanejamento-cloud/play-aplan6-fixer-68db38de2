
-- Fix user_roles: add policy for admins to manage
CREATE POLICY "Admins can manage user_roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Fix overly permissive INSERT policies
DROP POLICY IF EXISTS "Users can insert post images" ON public.post_images;
CREATE POLICY "Users can insert own post images" ON public.post_images FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND user_id = auth.uid())
);

DROP POLICY IF EXISTS "Auth users can create notifications" ON public.notifications;
CREATE POLICY "Auth users can create notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth users can insert premios" ON public.premios;
CREATE POLICY "Auth users can insert premios via doacoes" ON public.premios FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
