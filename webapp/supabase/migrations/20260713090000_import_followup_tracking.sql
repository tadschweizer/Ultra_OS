-- Plan 09: coach follow-up workflow for unmapped TrainingPeaks import items.
-- Tracks that a follow-up message was sent for a given import job so the
-- action is idempotent (atomic claim on followup_sent_at) and auditable.
ALTER TABLE public.trainingpeaks_import_jobs
  ADD COLUMN IF NOT EXISTS followup_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS followup_message_id uuid;
