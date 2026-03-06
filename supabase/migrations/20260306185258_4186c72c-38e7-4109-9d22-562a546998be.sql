
-- User media
CREATE TABLE public.user_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  media_type text NOT NULL,
  media_url text NOT NULL,
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.user_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User media viewable by all" ON public.user_media FOR SELECT USING (true);
CREATE POLICY "Users can manage own media" ON public.user_media FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own media" ON public.user_media FOR DELETE USING (auth.uid() = user_id);

-- Ajuda tickets
CREATE TABLE public.ajuda_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  texto text NOT NULL,
  foto_url text,
  status text DEFAULT 'pendente',
  resposta text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.ajuda_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own tickets" ON public.ajuda_tickets FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can create tickets" ON public.ajuda_tickets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can update tickets" ON public.ajuda_tickets FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete tickets" ON public.ajuda_tickets FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Regras content
CREATE TABLE public.regras_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_url text NOT NULL,
  media_type text NOT NULL DEFAULT 'image',
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.regras_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Regras viewable by all" ON public.regras_content FOR SELECT USING (true);
CREATE POLICY "Admins can manage regras" ON public.regras_content FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- notify_all_game_state function (stub)
CREATE OR REPLACE FUNCTION public.notify_all_game_state(p_game_on boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Placeholder: could insert notifications for all users
  NULL;
END;
$$;

-- send_mimo function
CREATE OR REPLACE FUNCTION public.send_mimo(p_juiz_id uuid, p_jogador_id uuid, p_likes integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id uuid;
BEGIN
  -- Create or find chat
  SELECT id INTO v_chat_id FROM public.chats WHERE juiz_id = p_juiz_id AND jogador_id = p_jogador_id LIMIT 1;
  IF v_chat_id IS NULL THEN
    INSERT INTO public.chats (juiz_id, jogador_id, likes_enviados) VALUES (p_juiz_id, p_jogador_id, p_likes) RETURNING id INTO v_chat_id;
  ELSE
    UPDATE public.chats SET likes_enviados = likes_enviados + p_likes WHERE id = v_chat_id;
  END IF;

  -- Deduct from juiz
  UPDATE public.profiles SET total_likes = GREATEST(0, total_likes - p_likes) WHERE user_id = p_juiz_id;
  -- Add to jogador
  UPDATE public.profiles SET total_likes = total_likes + p_likes WHERE user_id = p_jogador_id;

  -- Notify
  INSERT INTO public.notifications (user_id, tipo, chat_id, from_user_id, mensagem)
  VALUES (p_jogador_id, 'mimo', v_chat_id, p_juiz_id, '💝 Você recebeu ' || p_likes || ' likes de mimo!');

  RETURN v_chat_id::text;
END;
$$;
