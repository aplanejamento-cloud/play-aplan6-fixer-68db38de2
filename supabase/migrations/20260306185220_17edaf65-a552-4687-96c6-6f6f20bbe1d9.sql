
-- App role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- User roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name text NOT NULL,
  sex text,
  whatsapp text,
  show_whatsapp boolean DEFAULT false,
  avatar_url text,
  bio text,
  video_url text,
  music_url text,
  profile_text text,
  total_likes integer DEFAULT 1000,
  user_type text DEFAULT 'jogador',
  is_blocked boolean DEFAULT false,
  blocked_until timestamptz,
  birth_date text,
  is_bot boolean DEFAULT false,
  tema_id uuid,
  multiplicador_ativo numeric DEFAULT 1.0,
  multiplicador_end timestamptz,
  premium_active boolean DEFAULT false,
  premium_end timestamptz,
  ultima_doacao timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Game state
CREATE TABLE public.game_state (
  id integer PRIMARY KEY DEFAULT 1,
  game_on boolean DEFAULT true,
  start_date timestamptz,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.game_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Game state viewable by all" ON public.game_state FOR SELECT USING (true);
CREATE POLICY "Admins can update game state" ON public.game_state FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.game_state (id, game_on) VALUES (1, true) ON CONFLICT DO NOTHING;

-- Home config
CREATE TABLE public.home_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prize_value text DEFAULT '0',
  prize_enabled boolean DEFAULT false,
  promo_text text DEFAULT '',
  promo_text_2 text DEFAULT '',
  video_loop_url text,
  video_rules_url text,
  video_prize_url text,
  secondary_prizes jsonb DEFAULT '[]'::jsonb,
  sponsors jsonb DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.home_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Home config viewable by all" ON public.home_config FOR SELECT USING (true);
CREATE POLICY "Admins can update home config" ON public.home_config FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.home_config (prize_value, promo_text) VALUES ('0', 'Bem-vindo ao PlayLike!') ON CONFLICT DO NOTHING;

-- Posts
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content text,
  image_url text,
  video_url text,
  music_url text,
  likes_count integer DEFAULT 0,
  remix_count integer DEFAULT 0,
  tipo text DEFAULT 'normal',
  categoria text,
  boost_likes integer DEFAULT 0,
  deletado boolean DEFAULT false,
  denuncias_improprio integer DEFAULT 0,
  dislikes_tema integer DEFAULT 0,
  coroinha boolean DEFAULT false,
  raio boolean DEFAULT false,
  expires_at timestamptz DEFAULT (now() + interval '24 hours'),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Posts viewable by all" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Users can create posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON public.posts FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Post images
CREATE TABLE public.post_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  image_url text NOT NULL,
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.post_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Post images viewable by all" ON public.post_images FOR SELECT USING (true);
CREATE POLICY "Users can insert post images" ON public.post_images FOR INSERT WITH CHECK (true);

-- Post interactions
CREATE TABLE public.post_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  interaction_type text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(post_id, user_id)
);
ALTER TABLE public.post_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Interactions viewable by all" ON public.post_interactions FOR SELECT USING (true);
CREATE POLICY "Auth users can interact" ON public.post_interactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own interactions" ON public.post_interactions FOR DELETE USING (auth.uid() = user_id);

-- Follows
CREATE TABLE public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  following_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(follower_id, following_id)
);
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Follows viewable by all" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users can follow" ON public.follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow" ON public.follows FOR DELETE USING (auth.uid() = follower_id);

-- Duels
CREATE TABLE public.duels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  challenged_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'pending',
  winner_id uuid,
  challenger_votes integer DEFAULT 0,
  challenged_votes integer DEFAULT 0,
  stake_amount integer DEFAULT 100,
  duel_type text DEFAULT 'normal',
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.duels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Duels viewable by all" ON public.duels FOR SELECT USING (true);
CREATE POLICY "Auth users can create duels" ON public.duels FOR INSERT WITH CHECK (auth.uid() = challenger_id);
CREATE POLICY "Duel participants can update" ON public.duels FOR UPDATE USING (auth.uid() = challenger_id OR auth.uid() = challenged_id OR public.has_role(auth.uid(), 'admin'));

-- Duel votes
CREATE TABLE public.duel_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  duel_id uuid REFERENCES public.duels(id) ON DELETE CASCADE NOT NULL,
  voter_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  voted_for uuid NOT NULL,
  vote_type text,
  vote_value integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  UNIQUE(duel_id, voter_id)
);
ALTER TABLE public.duel_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Duel votes viewable by all" ON public.duel_votes FOR SELECT USING (true);
CREATE POLICY "Auth users can vote" ON public.duel_votes FOR INSERT WITH CHECK (auth.uid() = voter_id);

-- Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tipo text NOT NULL,
  post_id uuid,
  chat_id uuid,
  from_user_id uuid,
  mensagem text,
  lido boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Auth users can create notifications" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE USING (auth.uid() = user_id);

-- Comments
CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  juiz_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  texto text,
  midia_url text,
  midia_type text,
  likes integer DEFAULT 0,
  bombas integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments viewable by all" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Auth users can comment" ON public.comments FOR INSERT WITH CHECK (auth.uid() = juiz_id);
CREATE POLICY "Users can delete own comments" ON public.comments FOR DELETE USING (auth.uid() = juiz_id OR public.has_role(auth.uid(), 'admin'));

-- Comment reactions
CREATE TABLE public.comment_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reaction_type text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(comment_id, user_id)
);
ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reactions viewable by all" ON public.comment_reactions FOR SELECT USING (true);
CREATE POLICY "Auth users can react" ON public.comment_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own reactions" ON public.comment_reactions FOR DELETE USING (auth.uid() = user_id);

-- Chats
CREATE TABLE public.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  juiz_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  jogador_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  likes_enviados integer DEFAULT 0,
  data_inicio timestamptz DEFAULT now(),
  data_fim timestamptz,
  ativa boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Chat participants can view" ON public.chats FOR SELECT USING (auth.uid() = juiz_id OR auth.uid() = jogador_id);
CREATE POLICY "Auth users can create chats" ON public.chats FOR INSERT WITH CHECK (auth.uid() = juiz_id);

-- Chat messages
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid REFERENCES public.chats(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content text,
  media_url text,
  media_type text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Chat msg participants can view" ON public.chat_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.chats WHERE id = chat_id AND (juiz_id = auth.uid() OR jogador_id = auth.uid()))
);
CREATE POLICY "Auth users can send messages" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Blacklist
CREATE TABLE public.blacklist_palavras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  palavra text NOT NULL UNIQUE,
  categoria text DEFAULT 'outro',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.blacklist_palavras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Blacklist viewable by all" ON public.blacklist_palavras FOR SELECT USING (true);
CREATE POLICY "Admins can manage blacklist" ON public.blacklist_palavras FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Temas
CREATE TABLE public.temas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  midia_url text,
  fator numeric DEFAULT 2.0,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.temas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Temas viewable by all" ON public.temas FOR SELECT USING (true);
CREATE POLICY "Admins can manage temas" ON public.temas FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Assets marketing
CREATE TABLE public.assets_marketing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  titulo text,
  arquivo_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.assets_marketing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Assets viewable by all" ON public.assets_marketing FOR SELECT USING (true);
CREATE POLICY "Admins can manage assets" ON public.assets_marketing FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Premios
CREATE TABLE public.premios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_prateleira integer DEFAULT 1,
  midia_url text,
  titulo text,
  descricao text,
  likes_custo integer DEFAULT 0,
  estoque integer DEFAULT 1,
  aprovado boolean DEFAULT false,
  quantidade integer DEFAULT 1,
  estado text,
  cidade text,
  bairro text,
  endereco text,
  numero text,
  complemento text,
  finalist_only boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.premios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Premios viewable by all" ON public.premios FOR SELECT USING (true);
CREATE POLICY "Admins can manage premios" ON public.premios FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth users can insert premios" ON public.premios FOR INSERT WITH CHECK (true);

-- Doacoes premios
CREATE TABLE public.doacoes_premios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  midia_url text NOT NULL,
  titulo text,
  descricao text,
  likes_recebidos integer DEFAULT 0,
  aprovado boolean DEFAULT false,
  tipo_prateleira integer DEFAULT 1,
  quantidade integer DEFAULT 1,
  estado text,
  cidade text,
  bairro text,
  endereco text,
  numero text,
  complemento text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.doacoes_premios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Doacoes viewable by all" ON public.doacoes_premios FOR SELECT USING (true);
CREATE POLICY "Auth users can create doacoes" ON public.doacoes_premios FOR INSERT WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "Admins can update doacoes" ON public.doacoes_premios FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete doacoes" ON public.doacoes_premios FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Resgates
CREATE TABLE public.resgates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  premio_id uuid REFERENCES public.premios(id) ON DELETE CASCADE NOT NULL,
  likes_gastos integer DEFAULT 0,
  codigo_ticket text,
  endereco_completo text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.resgates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own resgates" ON public.resgates FOR SELECT USING (auth.uid() = usuario_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth users can create resgates" ON public.resgates FOR INSERT WITH CHECK (auth.uid() = usuario_id);

-- Daily stats
CREATE TABLE public.daily_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  streak_dias integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, data)
);
ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own stats" ON public.daily_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Auth users can insert stats" ON public.daily_stats FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Compras pix
CREATE TABLE public.compras_pix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  valor numeric DEFAULT 0,
  likes_adquiridos integer DEFAULT 0,
  pix_copia text,
  comprovante_url text,
  status text DEFAULT 'pendente',
  tipo text DEFAULT 'likes',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.compras_pix ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own compras" ON public.compras_pix FOR SELECT USING (auth.uid() = usuario_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth users can create compras" ON public.compras_pix FOR INSERT WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "Admins can update compras" ON public.compras_pix FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- User referrals
CREATE TABLE public.user_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  network text NOT NULL,
  used_first_time boolean DEFAULT false,
  friends_invited integer DEFAULT 0,
  likes_earned integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.user_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own referrals" ON public.user_referrals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Auth users can create referrals" ON public.user_referrals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own referrals" ON public.user_referrals FOR UPDATE USING (auth.uid() = user_id);

-- Remixes
CREATE TABLE public.remixes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_original_id uuid REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  remixador_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  remix_post_id uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.remixes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Remixes viewable by all" ON public.remixes FOR SELECT USING (true);
CREATE POLICY "Auth users can remix" ON public.remixes FOR INSERT WITH CHECK (auth.uid() = remixador_id);

-- Desafios
CREATE TABLE public.desafios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  juiz_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  video_url text,
  texto text,
  image_urls jsonb,
  aprovado boolean DEFAULT false,
  rejeitado boolean DEFAULT false,
  likes_pago integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.desafios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Desafios viewable by all" ON public.desafios FOR SELECT USING (true);
CREATE POLICY "Auth users can create desafios" ON public.desafios FOR INSERT WITH CHECK (auth.uid() = juiz_id);
CREATE POLICY "Admins can update desafios" ON public.desafios FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Juiz posts diarios
CREATE TABLE public.juiz_posts_diarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  juiz_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  post_count integer DEFAULT 0,
  UNIQUE(juiz_id, data)
);
ALTER TABLE public.juiz_posts_diarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own juiz stats" ON public.juiz_posts_diarios FOR SELECT USING (auth.uid() = juiz_id);

-- Increment juiz post count function
CREATE OR REPLACE FUNCTION public.increment_juiz_post_count(p_juiz_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.juiz_posts_diarios (juiz_id, data, post_count)
  VALUES (p_juiz_id, CURRENT_DATE, 1)
  ON CONFLICT (juiz_id, data)
  DO UPDATE SET post_count = juiz_posts_diarios.post_count + 1;
END;
$$;

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.duels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.duel_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.desafios;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.doacoes_premios;
