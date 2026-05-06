-- DMS review workflow: bulk assignment to workers and admin approval loop.

CREATE TABLE IF NOT EXISTS public.dms_document_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.dms_documents (id) ON DELETE CASCADE,
  assignee_backoffice_user_id uuid NOT NULL,
  assigned_by_backoffice_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'ASSIGNED',
  request_note text NOT NULL DEFAULT '',
  worker_note text NOT NULL DEFAULT '',
  requested_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  approved_by_backoffice_user_id uuid,
  approved_at timestamptz,
  rejection_reason text NOT NULL DEFAULT '',
  target_version_id uuid REFERENCES public.dms_document_versions (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dms_document_reviews_status_check
    CHECK (status IN ('ASSIGNED', 'SUBMITTED', 'APPROVED', 'CHANGES_REQUESTED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_dms_doc_review_assignee
  ON public.dms_document_reviews (document_id, assignee_backoffice_user_id);

CREATE INDEX IF NOT EXISTS idx_dms_doc_review_doc
  ON public.dms_document_reviews (document_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_dms_doc_review_assignee_status
  ON public.dms_document_reviews (assignee_backoffice_user_id, status, updated_at DESC);

DO $dms_review_fk$
BEGIN
  IF to_regclass('public.backoffice_users') IS NOT NULL THEN
    ALTER TABLE public.dms_document_reviews
      DROP CONSTRAINT IF EXISTS dms_document_reviews_assignee_fkey;
    ALTER TABLE public.dms_document_reviews
      ADD CONSTRAINT dms_document_reviews_assignee_fkey
      FOREIGN KEY (assignee_backoffice_user_id) REFERENCES public.backoffice_users (id) ON DELETE CASCADE;

    ALTER TABLE public.dms_document_reviews
      DROP CONSTRAINT IF EXISTS dms_document_reviews_assigned_by_fkey;
    ALTER TABLE public.dms_document_reviews
      ADD CONSTRAINT dms_document_reviews_assigned_by_fkey
      FOREIGN KEY (assigned_by_backoffice_user_id) REFERENCES public.backoffice_users (id) ON DELETE SET NULL;

    ALTER TABLE public.dms_document_reviews
      DROP CONSTRAINT IF EXISTS dms_document_reviews_approved_by_fkey;
    ALTER TABLE public.dms_document_reviews
      ADD CONSTRAINT dms_document_reviews_approved_by_fkey
      FOREIGN KEY (approved_by_backoffice_user_id) REFERENCES public.backoffice_users (id) ON DELETE SET NULL;
  END IF;
END;
$dms_review_fk$;

DO $dms_review_trig$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'set_updated_at'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgrelid = 'public.dms_document_reviews'::regclass
        AND tgname = 'tr_dms_document_reviews_updated_at'
    ) THEN
      CREATE TRIGGER tr_dms_document_reviews_updated_at
        BEFORE UPDATE ON public.dms_document_reviews
        FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
    END IF;
  END IF;
END;
$dms_review_trig$;

ALTER TABLE public.dms_document_reviews ENABLE ROW LEVEL SECURITY;

DO $dms_review_rls$
DECLARE
  has_bo boolean := to_regclass('public.backoffice_users') IS NOT NULL;
BEGIN
  DROP POLICY IF EXISTS "dms_reviews_select" ON public.dms_document_reviews;
  DROP POLICY IF EXISTS "dms_reviews_insert" ON public.dms_document_reviews;
  DROP POLICY IF EXISTS "dms_reviews_update" ON public.dms_document_reviews;
  DROP POLICY IF EXISTS "dms_reviews_delete" ON public.dms_document_reviews;
  DROP POLICY IF EXISTS "dms_reviews_authenticated_all" ON public.dms_document_reviews;

  IF NOT has_bo THEN
    CREATE POLICY "dms_reviews_authenticated_all"
      ON public.dms_document_reviews FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
    RETURN;
  END IF;

  CREATE POLICY "dms_reviews_select"
    ON public.dms_document_reviews FOR SELECT TO authenticated
    USING (public.dms_can_read_document(document_id));

  CREATE POLICY "dms_reviews_insert"
    ON public.dms_document_reviews FOR INSERT TO authenticated
    WITH CHECK (
      public.dms_can_admin_document(document_id)
      AND assigned_by_backoffice_user_id = public.dms_current_backoffice_user_id()
    );

  CREATE POLICY "dms_reviews_update"
    ON public.dms_document_reviews FOR UPDATE TO authenticated
    USING (
      public.dms_can_admin_document(document_id)
      OR assignee_backoffice_user_id = public.dms_current_backoffice_user_id()
    )
    WITH CHECK (
      public.dms_can_admin_document(document_id)
      OR assignee_backoffice_user_id = public.dms_current_backoffice_user_id()
    );

  CREATE POLICY "dms_reviews_delete"
    ON public.dms_document_reviews FOR DELETE TO authenticated
    USING (public.dms_can_admin_document(document_id));
END;
$dms_review_rls$;

ALTER TABLE public.dms_document_logs
  DROP CONSTRAINT IF EXISTS dms_log_action_check;

ALTER TABLE public.dms_document_logs
  ADD CONSTRAINT dms_log_action_check CHECK (
    action IN (
      'CREATE',
      'UPDATE_METADATA',
      'VERSION_UPLOAD',
      'DOWNLOAD',
      'DELETE',
      'PERMISSION_GRANT',
      'PERMISSION_REVOKE',
      'REVIEW_ASSIGN',
      'REVIEW_SUBMIT',
      'REVIEW_APPROVE',
      'REVIEW_CHANGES_REQUESTED'
    )
  );

GRANT ALL ON public.dms_document_reviews TO authenticated;

NOTIFY pgrst, 'reload schema';
