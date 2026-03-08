ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS tema_id uuid REFERENCES public.temas(id) DEFAULT NULL;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS multiplicador numeric DEFAULT NULL;