# P0-014 / P0-015 / P0-016 daily-loop implementation

Date: 2026-10-05

Base: production main `2841ac8` (PR #127). Branch: `feature/p0-daily-loop-reliability`.

This is a locally verified implementation slice, not production acceptance or completion
of the three parent roadmap items. No deployment, production database write, service
configuration change, paid staging resource, or new migration is included.

## Delivered behavior

### P0-014: workout persistence and correction

- Completion errors remain visible beside retained actuals, notes and RPE. Pending
  requests cannot be submitted twice. Successful writes show a saved state.
- Planned targets no longer populate actual duration/distance. Blank actuals remain
  unknown; a shorter session can be logged using its actual values. Explicit zero
  actuals count as zero compliance instead of unknown completion.
- Athletes can correct completion and undo manual completion/skip. Unplanned sessions
  can be created as completed directly from Log workout, without fabricated planned totals.
- Workout creation has an owner-scoped durable UUID retry key using the existing
  primary key. An identical retry returns the original row. Changed payloads using
  the same key require reviewing the existing save instead of silently duplicating it.
- Server validation rejects impossible dates, blank titles, negative/nonfinite totals,
  invalid completion states and out-of-range RPE.
- Later imports cannot fill unknown manual values or reuse an explicitly linked
  activity for a second plan. Athlete-local activity dates remain in use.
- Calendar note/event/library failures are surfaced; library additions and other
  equivalent pending mutations are guarded. Calendar state is refreshed in place.
- Workout panels have labelled primary fields, keyboard focus containment, Escape
  dismissal, restored focus, and pending-save dismissal protection.

### P0-015: direct messaging reliability

- Floating direct conversations open the canonical inbox with recipient and role
  selected. Session-discussion calendar links remain available.
- Open inboxes poll every four seconds and refresh on reconnect/focus. Hidden pages
  do not poll; overlapping background requests cannot repeatedly invalidate a slow
  response. Superseded conversation responses are ignored.
- Per-recipient drafts and retry IDs survive conversation switching during the mounted
  inbox session. A failed send keeps the draft; successful sends clear only that draft.
- Durable message retry IDs return the original persisted message without another row.
  Replay requires the same coach, athlete, sender role and body, plus a currently active
  relationship. Message bodies are bounded to 5,000 characters.
- History uses 50-message cursor pages ordered by timestamp and UUID, including tied
  timestamps. Loading older history preserves it across background refreshes.
- Read acknowledgements name only loaded incoming message IDs, require an active
  relationship, check database errors, and refresh the floating unread summary after
  success. A reply arriving between load and acknowledgement remains unread.
- New athlete-message notification previews omit message content.

### P0-016: athlete entry points

- Mobile tabs are Today, Calendar, Log workout, Messages and Profile. Coach tabs retain
  Roster/Calendar/Messages/Train/Profile. Daily check-in remains on Today and in the menu.
- Today displays planned sessions with direct detail links, a Log workout action,
  and the latest coach reply. Loading, failed loading/retry and empty states are explicit.
- Existing phone calendar agenda and non-drag editing are retained.

## Verification

- Node.js 22 full regression: **394/394** passed.
- Critical desktop/390 px Chromium suite: **89 passed, 3 intentional viewport skips**.
- Expanded daily-loop suite: **16/16** passed, including correction/undo, retained
  failures, unplanned completion, per-recipient drafts, retry identity, incoming replies,
  loaded-ID acknowledgement, floating recipient selection, history retention, Today and
  mobile navigation and one-time triage templates. Workout detail axe checks cover WCAG 2 A/AA rules excluding contrast;
  this is not a claim of complete accessibility conformance.
- Real isolated local Supabase: **6/6 groups** passed using signed application handlers
  and actual PostgREST writes. Includes workout create/retry/correction/undo/validation,
  unplanned completion, message replay, 62-message pagination with timestamp ties,
  read acknowledgement limited to 50 loaded rows, and revoked-relationship denials for
  message read/send/retry/acknowledgement and workout edits. Disposable records cleaned.
- Node 22 production build: **passed**, 41 generated pages. `git diff --check`: passed.

Reproduce from `webapp/` using Node.js 22:

```powershell
npm run test:auth:full
npm run test:e2e:critical
npm run build
```

The additional local database script is deliberately restricted to the existing
`output/p010-012-supabase` disposable stack:

```powershell
node scripts/verify-local-daily-loop.mjs
```

It requires that stack to be running and bootstrapped according to the earlier
local acceptance runbook. It has no production fallback. Browser fixtures establish
UI behavior only; the separate signed-handler checks establish real local persistence
and authorization. Neither establishes production acceptance.

## Remaining parent acceptance

- P0-014: explicit correction/rejection of automatic device matches and full manual-to-device
  reconciliation still need a persistent decision model. Manual sessions and subsequently
  imported activities can remain separate; automatic deduplication is not claimed. Separate
  partial-status semantics, ambiguous-response retries for every library/batch action, and
  actual-phone completion within 30 seconds remain open.
- P0-015: durable drafts across reload/sign-out, full notification preferences/delivery
  lifecycle, and real two-account deployed acceptance remain open. Existing conversation
  summary queries retain their legacy row limits; all-history unread counts at larger scale
  need a shared aggregate implementation. Session-discussion refresh/read semantics are
  unchanged by this direct-message slice.
- P0-016: broader surface convergence and complete accessibility/input verification remain
  open. Today is a refreshed entry section within the existing dashboard, not a full dashboard
  redesign.
- Earlier production coach-message/shared-document schema repair and release authorization
  are separate gates. This batch neither repairs production tables nor marks those gates passed.
