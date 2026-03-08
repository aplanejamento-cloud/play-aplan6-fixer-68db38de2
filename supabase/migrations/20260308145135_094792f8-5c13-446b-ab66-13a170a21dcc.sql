CREATE OR REPLACE FUNCTION public.approve_desafio(p_desafio_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_desafio RECORD;
  v_post_id uuid;
BEGIN
  -- Get the desafio
  SELECT * INTO v_desafio FROM desafios WHERE id = p_desafio_id AND aprovado = false AND rejeitado = false;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Desafio not found or already processed';
  END IF;

  -- Mark as approved
  UPDATE desafios SET aprovado = true WHERE id = p_desafio_id;

  -- Create the post with coroinha + raio (bypasses RLS)
  INSERT INTO posts (user_id, content, video_url, tipo, coroinha, raio, expires_at)
  VALUES (
    v_desafio.juiz_id,
    COALESCE(v_desafio.texto, '⚖️ Desafio aprovado!'),
    v_desafio.video_url,
    'normal',
    true,
    true,
    NOW() + INTERVAL '24 hours'
  )
  RETURNING id INTO v_post_id;

  -- Insert additional images if any
  IF v_desafio.image_urls IS NOT NULL AND jsonb_array_length(v_desafio.image_urls) > 0 THEN
    -- Set first image as main image
    UPDATE posts SET image_url = v_desafio.image_urls->>0 WHERE id = v_post_id;
    
    -- Insert remaining images
    IF jsonb_array_length(v_desafio.image_urls) > 1 THEN
      INSERT INTO post_images (post_id, image_url, position)
      SELECT v_post_id, elem::text, idx - 1
      FROM jsonb_array_elements_text(v_desafio.image_urls) WITH ORDINALITY AS t(elem, idx)
      WHERE idx > 1;
    END IF;
  END IF;

  RETURN v_post_id;
END;
$$;