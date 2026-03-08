
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
  SELECT user_id INTO v_post_owner_id FROM posts WHERE id = NEW.post_id;
  IF v_post_owner_id IS NULL THEN RETURN NEW; END IF;

  CASE NEW.interaction_type
    WHEN 'like' THEN v_base_value := 1;
    WHEN 'love' THEN v_base_value := 10;
    WHEN 'bomb' THEN v_base_value := 10;
    ELSE v_base_value := 1;
  END CASE;

  IF NEW.interaction_type IN ('like', 'love') THEN
    -- Post owner's multiplier for likes/love
    SELECT COALESCE(multiplicador_ativo, 1) INTO v_multiplier
    FROM profiles WHERE user_id = v_post_owner_id
      AND (multiplicador_end IS NULL OR multiplicador_end > NOW());
    IF v_multiplier IS NULL THEN v_multiplier := 1; END IF;

    v_final_value := (v_base_value * v_multiplier)::integer;

    UPDATE posts SET likes_count = COALESCE(likes_count, 0) + v_final_value WHERE id = NEW.post_id;
    UPDATE profiles SET total_likes = COALESCE(total_likes, 0) + v_final_value WHERE user_id = v_post_owner_id;

  ELSIF NEW.interaction_type = 'bomb' THEN
    -- BOMBER's own multiplier for bomb damage
    SELECT COALESCE(multiplicador_ativo, 1) INTO v_multiplier
    FROM profiles WHERE user_id = NEW.user_id
      AND (multiplicador_end IS NULL OR multiplicador_end > NOW());
    IF v_multiplier IS NULL THEN v_multiplier := 1; END IF;

    v_final_value := (v_base_value * v_multiplier)::integer;

    -- Subtract from post
    UPDATE posts SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - v_final_value) WHERE id = NEW.post_id;

    -- Bomber loses likes
    UPDATE profiles SET total_likes = GREATEST(0, COALESCE(total_likes, 0) - v_final_value) WHERE user_id = NEW.user_id;

    -- Notification with actual damage
    SELECT name INTO v_interactor_name FROM profiles WHERE user_id = NEW.user_id;
    
    INSERT INTO notifications (user_id, tipo, post_id, from_user_id, mensagem)
    VALUES (v_post_owner_id, 'bomba', NEW.post_id, NEW.user_id, 
      '💣 BOMBA! ' || COALESCE(v_interactor_name, 'Alguém') || ' bombou seu post! -' || v_final_value || ' likes no post');
  END IF;

  RETURN NEW;
END;
$$;

-- Also update delete trigger for bomb reversal with multiplier
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
    SELECT COALESCE(multiplicador_ativo, 1) INTO v_multiplier
    FROM profiles WHERE user_id = v_post_owner_id
      AND (multiplicador_end IS NULL OR multiplicador_end > NOW());
    IF v_multiplier IS NULL THEN v_multiplier := 1; END IF;

    v_final_value := (v_base_value * v_multiplier)::integer;

    UPDATE posts SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - v_final_value) WHERE id = OLD.post_id;
    UPDATE profiles SET total_likes = GREATEST(0, COALESCE(total_likes, 0) - v_final_value) WHERE user_id = v_post_owner_id;

  ELSIF OLD.interaction_type = 'bomb' THEN
    -- Reverse bomb using bomber's multiplier
    SELECT COALESCE(multiplicador_ativo, 1) INTO v_multiplier
    FROM profiles WHERE user_id = OLD.user_id
      AND (multiplicador_end IS NULL OR multiplicador_end > NOW());
    IF v_multiplier IS NULL THEN v_multiplier := 1; END IF;

    v_final_value := (v_base_value * v_multiplier)::integer;

    UPDATE posts SET likes_count = COALESCE(likes_count, 0) + v_final_value WHERE id = OLD.post_id;
    UPDATE profiles SET total_likes = COALESCE(total_likes, 0) + v_final_value WHERE user_id = OLD.user_id;
  END IF;

  RETURN OLD;
END;
$$;
