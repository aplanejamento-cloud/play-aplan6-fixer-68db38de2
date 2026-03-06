
-- Fix duels FKs to point to profiles instead of auth.users
ALTER TABLE public.duels DROP CONSTRAINT duels_challenger_id_fkey;
ALTER TABLE public.duels DROP CONSTRAINT duels_challenged_id_fkey;
ALTER TABLE public.duels ADD CONSTRAINT duels_challenger_id_fkey FOREIGN KEY (challenger_id) REFERENCES public.profiles(user_id);
ALTER TABLE public.duels ADD CONSTRAINT duels_challenged_id_fkey FOREIGN KEY (challenged_id) REFERENCES public.profiles(user_id);

-- Fix comments FK
ALTER TABLE public.comments DROP CONSTRAINT comments_juiz_id_fkey;
ALTER TABLE public.comments ADD CONSTRAINT comments_juiz_id_fkey FOREIGN KEY (juiz_id) REFERENCES public.profiles(user_id);
