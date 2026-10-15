# Threshold — Product and technical guidance

Last updated: 2026-10-15

## Direction and authority

Build a dependable coaching platform for athletes and coaches. Read [README-BUSINESS.md](README-BUSINESS.md) for positioning and [PRODUCT_EXECUTION_ROADMAP.md](PRODUCT_EXECUTION_ROADMAP.md) for the current work queue, acceptance criteria, and release evidence. This guide replaces the old intervention-first MVP plan, phased vendor budget, and historical parity table as current build guidance.

The current milestone remains M0: make the closed coach pilot work end to end. A coaching-first business direction does not close pilot gates or establish public launch readiness. Consult the roadmap header and its linked verification records for current implementation priorities and remaining acceptance. Separate local reliability/billing work must be reconciled before release. This documentation change does not re-verify deployment state.

## Core product loop

**Set a goal → plan training → complete and record → review and communicate → adjust.**

The coach and athlete are both primary users. A coach needs to understand the roster, plan work, review results, and follow up. An athlete needs a clear next session, an easy way to share what happened, and useful feedback. Design for beginners as well as experienced athletes.

The local application includes coach/athlete calendars, workout assignment and libraries, completion matching, check-ins, messages, coach reporting, settings, activity imports, and billing code. Presence in source is implementation evidence only. The roadmap and linked verification records determine which workflows are accepted locally, deployed, or proven with participants.

| Area | Source entry point |
| --- | --- |
| Athlete planning | `webapp/pages/calendar.js` |
| Coach planning | `webapp/pages/coach/training-calendar.js` |
| Coach overview | `webapp/pages/coach-command-center.js` |
| Athlete review | `webapp/pages/coach/athletes/[athleteId].js` |
| Communication | `webapp/pages/messages.js`, `webapp/pages/api/message-center.js` |
| Athlete settings | `webapp/pages/settings.js` |
| Plan access | `webapp/lib/subscriptionTiers.js`, `webapp/lib/billingPlans.js` |

## Product decisions

1. The shared coaching workflow is the center of product value. Planning, completed work, check-ins, and conversations provide context for the next coaching decision.
2. Coach dashboards, workout calendars, and phone usability are core scope. They are not later additions after a research or intervention product launches.
3. Research, protocols, and intervention records support specific coaching needs. Preserve existing records and permissions; do not make them a prerequisite for onboarding or daily use.
4. Deterministic calculations and coach-written feedback remain useful. AI-generated advice, summaries, and plans stay deferred according to the roadmap. No placeholder should promise a working feature or imply that an algorithm replaces the coach's judgment.
5. TrainingPeaks is a daily-workflow benchmark. Use roadmap acceptance tests rather than a historical feature-presence table to decide whether parity is achieved.
6. Future coaching disciplines are a strategic option. Reuse relationship, permission, goal, scheduling, and communication patterns where practical. Keep sport-specific measurements explicit; do not rename every athlete concept or redesign the schema speculatively.

## How to choose and design work

Follow the roadmap's Current milestone and Next item unless the owner changes priority. For each proposed feature, identify the user, the coaching task, the friction removed, and the evidence that would demonstrate improvement. Fix broken end-to-end workflows before adding breadth.

- Keep the next action clear, including when there is no plan, no activity, or no connected coach.
- Preserve entered work, show save/failure states, and make retries understandable.
- Distinguish planned, completed, imported, estimated, and missing training information.
- Show the data behind summaries; never imply that a correlation establishes causation.
- Use practical layouts, readable labels, and useful charts. Prefer solid neutral surfaces and clear rows over decorative effects, nested cards, or AI terminology.
- Make every introduced coach and athlete workflow usable on a phone as well as desktop.
- Enforce role/relationship access on the server and keep private coaching context private.

## Current implementation foundation

The application is in `webapp/`: Next.js and React, Supabase-backed data, Stripe billing code, and Vercel deployment configuration. Check [package.json](webapp/package.json) and the implementation before naming versions or claiming an integration works. The current session and API authorization model is described in [auth guidance](webapp/docs-auth-stability.md).

The previous Airtable/Notion/Stripe-payment-link plan was an early concept, not the current application architecture. Vendor budgets, future contractors, and proposed analytics/email services from that concept are not established operating configuration.

Integrations must be described by verified behavior: connecting an account, importing activity, and delivering a workout are separate capabilities. A provider name or configuration field is not evidence that its integration is available. Consult the roadmap's integration gates.

## Verification and release

Follow [AGENTS.md](AGENTS.md). Run commands from `webapp/` and select checks appropriate to the change. Record actual results and limits; do not copy old test counts as fresh evidence.

- Keep local tests, simulated browser evidence, deployed checks, and real participant acceptance distinct. A successful build or READY deployment does not complete a coaching journey.
- Preserve historical progress evidence and leave parent milestones open until their criteria pass.
- No production deployment or production configuration change without explicit owner authorization.
- Inspect applied database history before proposing a migration. Do not replay recorded migrations or use a broad push to resolve mismatched local/remote migration names.

For implementation details and setup, start with [webapp/README.md](webapp/README.md), then the relevant verification document. Historical roadmaps are background, not an independent queue.
