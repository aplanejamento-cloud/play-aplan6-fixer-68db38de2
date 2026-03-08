
-- Create ebooks table
CREATE TABLE public.ebooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  pdf_url text NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ebooks ENABLE ROW LEVEL SECURITY;

-- Anyone can view ebooks
CREATE POLICY "Ebooks viewable by all" ON public.ebooks FOR SELECT USING (true);

-- Auth users can insert own ebooks
CREATE POLICY "Users can insert own ebooks" ON public.ebooks FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete own ebooks, admins can delete any
CREATE POLICY "Users can delete own ebooks" ON public.ebooks FOR DELETE USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for ebooks
INSERT INTO storage.buckets (id, name, public) VALUES ('ebooks', 'ebooks', true);

-- Storage policies
CREATE POLICY "Anyone can view ebooks files" ON storage.objects FOR SELECT USING (bucket_id = 'ebooks');
CREATE POLICY "Auth users can upload ebooks" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'ebooks' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete own ebook files" ON storage.objects FOR DELETE USING (bucket_id = 'ebooks' AND auth.uid()::text = (storage.foldername(name))[1]);
