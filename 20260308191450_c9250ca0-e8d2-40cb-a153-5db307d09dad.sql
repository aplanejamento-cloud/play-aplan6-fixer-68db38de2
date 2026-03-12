
-- Trigger function: handle interaction INSERT
-- Updates posts.likes_count and profiles.total_likes
-- Applies multiplicador_ativo from the POST AUTHOR for likes/love
-- For bombs: bomber LOSES likes (10 * bomber's own multiplier... no, just flat 10)
-- Also creates notification for bombs

CREATE OR REPLACE FUNCTION public.handle_interaction_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_post_owner_id uuid;
  v_base_value integer;
  v_multiplier numeric;
  v_final_value integer;
  v_interactor_name text;
BEGIN
  -- Get the post owner
  SELECT user_id INTO v_post_owner_id FROM posts WHERE id = NEW.post_id;
  IF v_post_owner_id IS NULL THEN RETURN NEW; END IF;

  -- Determine base value
  CASE NEW.interaction_type
    WHEN 'like' THEN v_base_value := 1;
    WHEN 'love' THEN v_base_value := 10;
    WHEN 'bomb' THEN v_base_value := 10;
    ELSE v_base_value := 1;
  END CASE;

  IF NEW.interaction_type IN ('like', 'love') THEN
    -- Get post owner's multiplier (turbo)
    SELECT COALESCE(multiplicador_ativo, 1) INTO v_multiplier
    FROM profiles WHERE user_id = v_post_owner_id
      AND (multiplicador_end IS NULL OR multiplicador_end > NOW());
    
    -- If multiplier expired, reset it
    IF v_multiplier IS NULL THEN v_multiplier := 1; END IF;

    v_final_value := (v_base_value * v_multiplier)::integer;

    -- Update post likes_count
    UPDATE posts SET likes_count = COALESCE(likes_count, 0) + v_final_value WHERE id = NEW.post_id;

    -- Update post owner total_likes
    UPDATE profiles SET total_likes = COALESCE(total_likes, 0) + v_final_value WHERE user_id = v_post_owner_id;

  ELSIF NEW.interaction_type = 'bomb' THEN
    -- Bomb: subtract from post likes_count
    UPDATE posts SET likes_count = COALESCE(likes_count, 0) - v_base_value WHERE id = NEW.post_id;

    -- Bomb: the BOMBER loses likes
    UPDATE profiles SET total_likes = GREATEST(0, COALESCE(total_likes, 0) - v_base_value) WHERE user_id = NEW.user_id;

    -- Create notification for the post owner
    SELECT name INTO v_interactor_name FROM profiles WHERE user_id = NEW.user_id;
    
    INSERT INTO notifications (user_id, tipo, post_id, from_user_id, mensagem)
    VALUES (v_post_owner_id, 'bomba', NEW.post_id, NEW.user_id, 
      '💣 BOMBA! ' || COALESCE(v_interactor_name, 'Alguém') || ' bombou seu post! -' || v_base_value || ' likes no post');
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger function: handle interaction DELETE (undo)
CREATE OR REPLACE FUNCTION public.handle_interaction_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_post_owner_id uuid;
  v_base_value integer;
  v_multiplier numeric;
  v_final_value integer;
BEGIN
  SELECT user_id INTO v_post_owner_id FROM posts WHERE id = OLD.post_id;
  IF v_post_owner_id IS NULL THEN RETURN OLD; END IF;

  CASE OLD.interaction_type
    WHEN 'like' THEN v_base_value := 1;
    WHEN 'love' THEN v_base_value := 10;
    WHEN 'bomb' THEN v_base_value := 10;
    ELSE v_base_value := 1;
  END CASE;

  IF OLD.interaction_type IN ('like', 'love') THEN
    -- Get multiplier that was active (use current, best effort)
    SELECT COALESCE(multiplicador_ativo, 1) INTO v_multiplier
    FROM profiles WHERE user_id = v_post_owner_id
      AND (multiplicador_end IS NULL OR multiplicador_end > NOW());
    IF v_multiplier IS NULL THEN v_multiplier := 1; END IF;

    v_final_value := (v_base_value * v_multiplier)::integer;

    -- Reverse: subtract from post
    UPDATE posts SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - v_final_value) WHERE id = OLD.post_id;

    -- Reverse: subtract from owner
    UPDATE profiles SET total_likes = GREATEST(0, COALESCE(total_likes, 0) - v_final_value) WHERE user_id = v_post_owner_id;

  ELSIF OLD.interaction_type = 'bomb' THEN
    -- Reverse bomb: add back to post
    UPDATE posts SET likes_count = COALESCE(likes_count, 0) + v_base_value WHERE id = OLD.post_id;

    -- Reverse bomb: give back likes to bomber
    UPDATE profiles SET total_likes = COALESCE(total_likes, 0) + v_base_value WHERE user_id = OLD.user_id;
  END IF;

  RETURN OLD;
END;
$$;

-- Create the triggers
CREATE TRIGGER on_interaction_insert
  AFTER INSERT ON public.post_interactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_interaction_insert();

CREATE TRIGGER on_interaction_delete
  AFTER DELETE ON public.post_interactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_interaction_delete();
