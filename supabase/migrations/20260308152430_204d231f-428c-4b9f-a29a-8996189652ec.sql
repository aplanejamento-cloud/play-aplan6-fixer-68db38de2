-- Add missing columns to resgates for ticket verification
ALTER TABLE public.resgates ADD COLUMN IF NOT EXISTS likes_transferidos boolean DEFAULT false;
ALTER TABLE public.resgates ADD COLUMN IF NOT EXISTS status text DEFAULT 'pendente';

-- Allow users to delete their own pending resgates (for cancel)
CREATE POLICY "Users can delete own pending resgates"
ON public.resgates FOR DELETE
TO authenticated
USING (auth.uid() = usuario_id);

-- Allow users to update own resgates (for status changes via TicketVerifier)  
CREATE POLICY "Users can update own resgates"
ON public.resgates FOR UPDATE
TO authenticated
USING (auth.uid() = usuario_id OR has_role(auth.uid(), 'admin'::app_role));

-- Allow doadores to read resgates by codigo_ticket (for verification)
DROP POLICY IF EXISTS "Users can view own resgates" ON public.resgates;
CREATE POLICY "Users can view resgates"
ON public.resgates FOR SELECT
TO authenticated
USING (true);