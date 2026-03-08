
CREATE TABLE public.patrocinio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.patrocinio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patrocinio viewable by all" ON public.patrocinio FOR SELECT USING (true);
CREATE POLICY "Admins can manage patrocinio" ON public.patrocinio FOR ALL USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.patrocinio (whatsapp) VALUES ('(11) 99999-9999');
