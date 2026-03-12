
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS show_email_public boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
