-- Table to track referral shares (pending verification)
CREATE TABLE public.referral_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  network TEXT NOT NULL,
  share_code TEXT NOT NULL UNIQUE,
  shared_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  verified_at TIMESTAMP WITH TIME ZONE,
  clicks_count INTEGER DEFAULT 0,
  likes_awarded BOOLEAN DEFAULT false
);

-- Table to track clicks on shared links
CREATE TABLE public.referral_clicks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  share_id UUID REFERENCES public.referral_shares(id) ON DELETE CASCADE,
  clicked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ip_hash TEXT,
  user_agent TEXT
);

-- Enable RLS
ALTER TABLE public.referral_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_clicks ENABLE ROW LEVEL SECURITY;

-- Policies for referral_shares
CREATE POLICY "Users can view own shares" ON public.referral_shares
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own shares" ON public.referral_shares
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can update shares" ON public.referral_shares
  FOR UPDATE USING (true);

-- Policies for referral_clicks (public insert for tracking, no auth needed)
CREATE POLICY "Anyone can insert clicks" ON public.referral_clicks
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Clicks viewable by share owner" ON public.referral_clicks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.referral_shares rs 
      WHERE rs.id = referral_clicks.share_id 
      AND rs.user_id = auth.uid()
    )
  );

-- Index for fast share_code lookups
CREATE INDEX idx_referral_shares_code ON public.referral_shares(share_code);
CREATE INDEX idx_referral_shares_user ON public.referral_shares(user_id);