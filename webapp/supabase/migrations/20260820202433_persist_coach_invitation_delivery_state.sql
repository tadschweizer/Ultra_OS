-- Invitation lifecycle (pending/accepted/expired/revoked) and email delivery
-- are independent. Existing rows predate delivery tracking, so they are
-- explicitly "unknown" instead of being backfilled as sent.
ALTER TABLE public.coach_invitations
  ADD COLUMN delivery_status text NOT NULL DEFAULT 'unknown'
    CHECK (delivery_status IN ('unknown', 'pending', 'sent', 'failed', 'skipped')),
  ADD COLUMN delivery_attempted_at timestamptz,
  ADD COLUMN delivery_sent_at timestamptz,
  ADD COLUMN delivery_failure_category text
    CHECK (
      delivery_failure_category IS NULL
      OR delivery_failure_category IN (
        'not_configured',
        'provider_rejected',
        'provider_unavailable',
        'provider_error'
      )
    );

COMMENT ON COLUMN public.coach_invitations.delivery_status IS
  'Email delivery state, separate from invitation acceptance lifecycle status.';
COMMENT ON COLUMN public.coach_invitations.delivery_failure_category IS
  'Safe application category only; never a provider response, credential, or message body.';
