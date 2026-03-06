
-- Fix increment_juiz_post_count search_path
CREATE OR REPLACE FUNCTION public.increment_juiz_post_count(p_juiz_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.juiz_posts_diarios (juiz_id, data, post_count)
  VALUES (p_juiz_id, CURRENT_DATE, 1)
  ON CONFLICT (juiz_id, data)
  DO UPDATE SET post_count = juiz_posts_diarios.post_count + 1;
END;
$$;

-- Fix notify_all_game_state search_path
CREATE OR REPLACE FUNCTION public.notify_all_game_state(p_game_on boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NULL;
END;
$$;

-- Fix send_mimo search_path
CREATE OR REPLACE FUNCTION public.send_mimo(p_juiz_id uuid, p_jogador_id uuid, p_likes integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id uuid;
BEGIN
  SELECT id INTO v_chat_id FROM public.chats WHERE juiz_id = p_juiz_id AND jogador_id = p_jogador_id LIMIT 1;
  IF v_chat_id IS NULL THEN
    INSERT INTO public.chats (juiz_id, jogador_id, likes_enviados) VALUES (p_juiz_id, p_jogador_id, p_likes) RETURNING id INTO v_chat_id;
  ELSE
    UPDATE public.chats SET likes_enviados = likes_enviados + p_likes WHERE id = v_chat_id;
  END IF;
  UPDATE public.profiles SET total_likes = GREATEST(0, total_likes - p_likes) WHERE user_id = p_juiz_id;
  UPDATE public.profiles SET total_likes = total_likes + p_likes WHERE user_id = p_jogador_id;
  INSERT INTO public.notifications (user_id, tipo, chat_id, from_user_id, mensagem)
  VALUES (p_jogador_id, 'mimo', v_chat_id, p_juiz_id, '💝 Você recebeu ' || p_likes || ' likes de mimo!');
  RETURN v_chat_id::text;
END;
$$;
