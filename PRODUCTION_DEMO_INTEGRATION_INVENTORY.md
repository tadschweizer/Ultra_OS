# Production integration inventory and bounded split

Source audit: October 10, 2026. Online main is freshly verified at `fa8ebe2b377784007b4a40b4e982f92a11224075`; [PR #134](https://github.com/tadschweizer/Ultra_OS/pull/134) is draft/unmerged at `6f1d3f4f3633095a0aac9e83600b77b3ce2bb596`. The accepted demo remains runtime `54f2ab181848baf022c2fc59ce0c5c492f00da1d`, deployment `dpl_EtjWEJQQ4gY6xA7UW7aFvf8SeB2B`. Its immutable preview is a synthetic artifact, not current production. No runtime edit, deployment or database write accompanies this inventory.

Prepared isolated worktree: `C:\Users\BAS\Documents\Codex\2026-10-09\task-2\production-integration`. Branch: `feature/production-library-messages`. Base: PR #134 head `6f1d3f4f3633095a0aac9e83600b77b3ce2bb596`. A production follow-on based here is **stacked on PR #134** and must use `demo/synthetic-transfer` as its review base so demo changes are not silently presented as new production work. PR #134's accepted runtime/evidence and original checkout remain untouched.

## What already exists and what PR #134 would add

| Workflow | Current online-main source | Shared improvement from PR #134 | Remaining production gap |
| --- | --- | --- | --- |
| Calendar plan/create/edit/reschedule/library/copy/duplicate | `TrainingCalendar`, `/api/planned-workouts`, `/api/workout-library` already implement real authenticated planning | Mobile copy-week access; library step target-unit stamping; query-driven selection/close/refresh and dialog input identity | Library full metadata and assignment mapping; copy-week preservation/retries belong to the parallel backend task |
| Athlete log/correct/skip/undo, coach feedback and discussion | Real planned-workout/comment APIs and role-aware detail views already exist | Shared view uses injected transport with native fetch defaults; improved activity dialog focus | Backend mutation fixes remain separately owned; synthetic repeat/idempotency results do not establish production behavior |
| Planned vs completed review | Real completion fields, imported/matched activities and compliance helpers exist | Actual TSS uses recorded values and explicitly counts unknown load; weekly summary retains linked elevation/work without adding duration/distance/TSS twice | Independent demo acceptance verified elevation; measured work/kJ and physical-device branches remain unverified |
| Direct messages, drafts and unread | Real message, draft, read-summary and preference endpoints already exist on main | UI/hook/settings helpers accept a closed demo transport, while production defaults remain ordinary authenticated requests | PR #134 does **not** introduce the requested iPhone-style layout; UX-006 remains real production UI work |
| Roster, Today and daily check-in | Production coach/athlete pages and check-in APIs exist | PR #134's demo shell/triage/Today/check-in are adapted fixture views, not replacements for those production pages | Keep production pages and actual records; do not port fake shell behavior as a production backend |

PR #134's production-facing file changes are `components/TrainingCalendar.js`, `components/MessageNotificationSettings.js`, `pages/messages.js`, and `lib/WorkspaceTransport.js`, `calendarMutation.js`, `calendarSelection.js`, `calendarSummary.js`, `libraryWorkoutPayload.js`, `messageClient.js`, `useMessageDraft.js`, `workoutCompliance.js`. It does not change production API handlers, authentication, middleware, schema or provider configuration. Some shared calendar files overlap the parallel backend task and need merge coordination.

## Synthetic-only behaviors

- `coach-demo/adapter.js` supplies local fixtures, browser/tab session storage, fixed sample date, role switching, coherent local writes, deterministic reset and one-shot failure simulation. None is a production database or identity model.
- Library save/assign retains `objective`, separate `coach_instructions`, `planned_if`, `target_metric`, `visibility`, `planned_tss` and structured targets/units in the local adapter. The shared `libraryWorkoutPayload` currently sends the extra fields only under the demo opt-in flag.
- Main's library endpoint selects and normalizes only the narrower common fields. Its library schema does not persist the missing planning metadata. `/api/planned-workouts` also maps a library template into only sport/title/description/structure/duration/distance/unit/TSS/library ID; merely extending library storage will not fix assignment.
- Synthetic failure/retry/idempotency, activity imports, check-in/triage propagation, messages/unread and export checks are demo evidence. Production must continue to use real protected APIs and server/database behavior. No fake success or external-delivery claims transfer.

## Real messaging persistence already on main

| Capability | Existing source/contract | Preserve during UX-006 |
| --- | --- | --- |
| Authenticated role and active relationship | `messagingServer.js` actor/conversation checks, server-derived capabilities, same-origin JSON mutations | URL role/athlete hints never grant access; disconnected/revoked sessions fail honestly |
| Durable sends and lost-response retry | `/api/coach/messages` validates input and invokes `send_direct_message` with `client_message_id`; atomic SQL owns message/outbox/draft effects | One stable retry identity, no duplicate message/notification, clear draft only after acknowledged success |
| Per-owner/per-recipient draft | `/api/message-drafts`, `message_drafts`, `useMessageDraft` version fencing and serialized autosave | Role/recipient isolation, reload persistence, conflict/reload flow, failed-save text, no background-poll replacement |
| Historical unread, exact read acknowledgments | `/api/message-center`, inbox-summary SQL, `acknowledgeMessages` sends only loaded incoming IDs; failed acknowledgment keeps unread honest | Do not acknowledge a thread hidden behind the phone conversation list; no blanket unread zeroing |
| Conversation history and live refresh | Cursor-based older history, deduplicating merge, request versions/abort, online/focus/poll refresh | Preserve older-history anchor, thread identity, stale-response isolation and in-flight send locking |
| Notification preferences/status | `/api/message-preferences`, leased private email outbox, real returned pending/sent/failed/skipped status | Keep opt-in preferences and honest statuses; an in-app send is not proof of email delivery |
| Calendar/workout context | Message links already use athlete/role/template/body query hints; workout comments remain separate linked threads | Keep recipient/context through navigation; no contacts upload, SMS or iMessage integration |

The existing `message-lifecycle.test.mjs` and `e2e/message-database.spec.mjs` exercise real signed handlers and isolated SQL, including persistence, lost commit responses, relationship/session revocation and old unread counts. `e2e/messaging-critical.spec.mjs` uses a browser API mock and is supplementary UI coverage, not database proof. This inventory did not rerun those suites or verify actual external delivery.

## Why two bounded follow-on slices

The request combines a schema/API round-trip repair with a navigation/composer redesign. Full library assignment requires an edit to `/api/planned-workouts`, explicitly owned by task `01a12387-bc50-704a-b462-1c76314bf03a`. The phone layout also changes when a thread is visible, which affects the current page's automatic initial selection and read acknowledgment. Combining these without ownership sequencing would make the slice unsafe and the regression evidence harder to review. Return this inventory/split before broad edits, as requested.

### Slice A — production library metadata round-trip

Owned nonoverlapping files: `webapp/pages/api/workout-library.js`, `webapp/lib/libraryWorkoutPayload.js`, a CLI-generated `webapp/supabase/migrations/*_workout_library_plan_metadata.sql`, focused library handler/SQL tests and production library browser coverage. Preserve coach ownership and private visibility, validate metadata using the existing planning contract, return the same metadata on GET/POST/PATCH, retain explicit zero/null values and structured target units. Prepare additive migration only; do not execute it on any real database.

**Required coordinated overlap:** the backend owner extends the library-assignment mapping in `webapp/pages/api/planned-workouts.js` to preserve `objective`, `coach_instructions`, `planned_if`, `target_metric` and `visibility`, alongside existing planned TSS/duration/distance/structure/units. Keep owner-scoped lookup and existing planning validation/assignment guards. Copy-week parity remains that task's scope. Do not work around server mapping loss with extra client overrides.

Verification: signed real-handler + isolated SQL save → read → update → assign → athlete-read and coach-read tests; private template/assignment invisibility; foreign-coach/athlete/unauthenticated denial; invalid/null/zero metadata; structured HR/distance targets/units; desktop and mobile library round-trip/reload; auth regression/build. Migration must be reviewed/applied under separate release authorization **before** production code selecting its new columns is deployed. Until then the production change is not live-ready.

### Slice B — UX-006 production messaging page

Owned files: `webapp/pages/messages.js`, small shared presentation components under `webapp/components/messages/`, focused UI/view-state helpers if needed, `webapp/e2e/messaging-critical.spec.mjs`, `webapp/e2e/message-database.spec.mjs` and a focused UX-006 browser spec. Preserve current `useMessageDraft`, real APIs and signed-handler semantics; change their behavior only if a specific regression demonstrates a defect. No messaging database migration is expected for this slice.

Visual thesis: a calm native-feeling Threshold inbox, familiar thread proportions and one clear composer, using existing type/color tokens rather than decorative cards. Content plan: conversation list with sender/name/preview/unread → selected chronological thread and context → bottom composer; templates/preferences remain accessible secondary controls. Interaction thesis: two panes on desktop, list-to-thread/back navigation on phones; preserve scroll when loading older messages; reveal new messages without jumping someone reading history; reduced-motion support.

Acceptance: coach/athlete recipient switching and contextual deep links; phone Back/Forward, keyboard/focus and accessible labels; own/other sender bubbles; honest sent/read/email states; composer usable at 320/390px and desktop; hidden-thread unread retention; loaded-ID read acknowledgments; persisted per-recipient drafts on navigation/reload; autosave conflict and retry; lost-send-response idempotency; older messages plus polling; revoked relationship/no conversation and network errors; no fake production success. Run existing real-SQL message browser tests plus targeted desktop/mobile interactions and capture screenshots. Physical-device acceptance stays separate if unavailable.

## Sequencing and constraints

1. Coordinate the library-assignment mapper with the backend owner through the parent before that route is edited. Keep its planned-workouts/loadRollups/trainingLoad/`/api/me`/calendarMutation files untouched here.
2. Implement/review library round-trip and UX-006 as separate bounded PRs, explicitly stacked on PR #134 where they rely on its shared helpers; use current-main base for an independent slice only if dependency removal is deliberate and documented.
3. Preserve the accepted demo's immutable runtime and evidence. No merge, production deployment, credential creation, paid resource, actual migration execution, real email or provider action is authorized.
4. Mark completion only after each slice's relevant regression/build and desktop/mobile interaction evidence passes. Source audit and demo acceptance are not production acceptance.

At this checkpoint only this inventory and its roadmap status are edited. No API, UI, migration, fixture, runtime or test code is changed. The next required decision is ownership/sequencing of Slice A's assignment mapper, not a new publication/security approval.
