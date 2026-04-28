CREATE TABLE IF NOT EXISTS public.user_notifications (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_athlete_id uuid       NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  source_type         text        NOT NULL,
  source_key          text        NOT NULL,
  title               text        NOT NULL,
  body                text        NOT NULL,
  href                text,
  badge               text,
  occurred_at         timestamptz NOT NULL,
  is_read             boolean     NOT NULL DEFAULT false,
  is_archived         boolean     NOT NULL DEFAULT false,
  metadata            jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recipient_athlete_id, source_type, source_key)
);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_notifications: athlete reads own"
  ON public.user_notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.athletes
      WHERE athletes.id = user_notifications.recipient_athlete_id
        AND athletes.supabase_user_id = auth.uid()
    )
  );

CREATE POLICY "user_notifications: athlete updates own"
  ON public.user_notifications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.athletes
      WHERE athletes.id = user_notifications.recipient_athlete_id
        AND athletes.supabase_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.athletes
      WHERE athletes.id = user_notifications.recipient_athlete_id
        AND athletes.supabase_user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_user_notifications_recipient_read_archived
  ON public.user_notifications(recipient_athlete_id, is_archived, is_read, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_notifications_occurred_at
  ON public.user_notifications(occurred_at DESC);

CREATE TRIGGER trg_user_notifications_updated_at
  BEFORE UPDATE ON public.user_notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
