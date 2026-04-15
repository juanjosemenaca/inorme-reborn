-- Personas de contacto generales vs destinatarios de facturación (varios por cliente).
ALTER TABLE public.client_contact_persons
  ADD COLUMN IF NOT EXISTS contact_purpose text NOT NULL DEFAULT 'GENERAL';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'client_contact_persons_contact_purpose_check'
  ) THEN
    ALTER TABLE public.client_contact_persons
      ADD CONSTRAINT client_contact_persons_contact_purpose_check
      CHECK (contact_purpose IN ('GENERAL', 'INVOICE'));
  END IF;
END $$;

COMMENT ON COLUMN public.client_contact_persons.contact_purpose IS
  'GENERAL: interlocutor habitual; INVOICE: persona a la que se dirigen las facturas.';

CREATE INDEX IF NOT EXISTS idx_client_contacts_purpose
  ON public.client_contact_persons (client_id, contact_purpose);
