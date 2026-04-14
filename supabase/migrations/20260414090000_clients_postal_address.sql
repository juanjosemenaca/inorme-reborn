ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS postal_address text NOT NULL DEFAULT '';

UPDATE public.clients
SET postal_address = COALESCE(NULLIF(postal_address, ''), fiscal_address)
WHERE COALESCE(postal_address, '') = '';

COMMENT ON COLUMN public.clients.postal_address IS
  'Dirección principal/operativa del cliente; puede coincidir con la dirección fiscal.';
