import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migrationUrl = new URL(
  '../supabase/migrations/20260820202433_persist_coach_invitation_delivery_state.sql',
  import.meta.url
);

test('coach invitation delivery migration keeps lifecycle and delivery state separate', () => {
  const migration = fs.readFileSync(migrationUrl, 'utf8');

  assert.match(migration, /ALTER TABLE public\.coach_invitations/);
  assert.match(migration, /delivery_status text NOT NULL DEFAULT 'unknown'/);
  assert.match(migration, /'unknown', 'pending', 'sent', 'failed', 'skipped'/);
  assert.match(migration, /delivery_attempted_at timestamptz/);
  assert.match(migration, /delivery_sent_at timestamptz/);
  assert.match(migration, /delivery_failure_category text/);
  assert.match(migration, /'not_configured'/);
  assert.match(migration, /'provider_rejected'/);
  assert.match(migration, /'provider_unavailable'/);
  assert.doesNotMatch(migration, /ALTER COLUMN status/);
  assert.doesNotMatch(migration, /RESEND_API_KEY|Authorization|provider response body/i);
});
