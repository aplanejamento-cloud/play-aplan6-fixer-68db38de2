
-- Add eliminated_at column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS eliminated_at timestamptz DEFAULT NULL;

-- Create trigger function: auto-eliminate when total_likes <= 0
CREATE OR REPLACE FUNCTION public.check_elimination()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If likes dropped to 0 or below AND user is jogador AND not already eliminated
  IF NEW.total_likes <= 0 AND NEW.user_type = 'jogador' AND OLD.eliminated_at IS NULL THEN
    NEW.eliminated_at := NOW();
  END IF;
  
  -- If likes went back above 0 and was eliminated, clear elimination
  IF NEW.total_likes > 0 AND OLD.eliminated_at IS NOT NULL THEN
    NEW.eliminated_at := NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on profiles
DROP TRIGGER IF EXISTS trigger_check_elimination ON public.profiles;
CREATE TRIGGER trigger_check_elimination
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_elimination();
