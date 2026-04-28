CREATE TABLE IF NOT EXISTS public.coach_athlete_messages (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content      text        NOT NULL,
  context_type text        CHECK (context_type IN ('intervention', 'protocol', 'race', 'general')),
  context_id    uuid,
  is_read      boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_athlete_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_athlete_messages: participants read"
  ON public.coach_athlete_messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "coach_athlete_messages: sender creates"
  ON public.coach_athlete_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "coach_athlete_messages: recipient marks read"
  ON public.coach_athlete_messages FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

CREATE INDEX IF NOT EXISTS idx_coach_athlete_messages_sender_id
  ON public.coach_athlete_messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_coach_athlete_messages_recipient_unread
  ON public.coach_athlete_messages(recipient_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coach_athlete_messages_context
  ON public.coach_athlete_messages(context_type, context_id, created_at DESC);
