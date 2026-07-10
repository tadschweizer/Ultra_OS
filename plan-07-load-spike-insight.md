# Plan 07 — Training-load spike detection insight

**Priority: 7 of 10. First unbuilt item from AI_ANALYSIS_ROADMAP.md that needs NO new external APIs — it runs entirely on activity data already synced into Supabase plus the intervention log. Highest insight-value-per-effort on that roadmap.**

## Goal

Per AI_ANALYSIS_ROADMAP.md "Training Load Spike Detection": flag any week whose total load jumps >10% (roadmap threshold; use ramp bands below) over the prior 4-week average, and cross-reference whether the athlete logged recovery interventions that week. Output an insight card like:

> "Your load this week (68 mi) is 31% above your 4-week average (52 mi). That's above the recommended ~10% ramp ceiling. No recovery interventions logged this week — consider a recovery-focused entry."

The infrastructure exists: `webapp/lib/trainingLoad.js` already computes per-activity TRIMP and ATL/CTL/TSB series; `pages/insights.js` already renders rule-based insight cards (gut progression, heat block) from `lib/insightSystemContent.js` patterns.

## Files to touch (exact)

1. `webapp/lib/trainingLoad.js` — add `detectLoadSpikes(activities, settings, interventions)` (pure function)
2. `webapp/pages/insights.js` — render the card; read how the existing gut/heat cards get `interventions` and `activities` and reuse the same data
3. `webapp/tests/training-calculations.test.mjs` — add spike-detection tests
4. `webapp/lib/interventionCatalog.js` — read-only: find the canonical list of intervention types to classify which count as "recovery"

## Steps in order

1. Read `lib/trainingLoad.js` fully. Reuse `computeActivityTrimp` and the local-date helpers (`localDateKey`). Read `pages/insights.js` around the existing rule cards (lines ~25–90) to copy the card object shape exactly (`{ id, title, body, ... }` — match whatever fields the renderer uses, including tone/icon fields).
2. Implement `detectLoadSpikes(activities = [], settings = {}, interventions = [])`:
   - Bucket activities into ISO weeks (Mon–Sun) by local date using the existing `localDateKey` helper. Weekly load = sum of TRIMP; also track weekly mileage (`distance` meters → miles) for the human-readable message.
   - For the most recent COMPLETE-or-current week W: baseline = mean weekly TRIMP of the prior 4 weeks (require at least 3 non-zero weeks of history, else return null).
   - Ramp % = (W − baseline) / baseline × 100. Severity: `>30%` high, `>15%` moderate, `>10%` note; below → no card.
   - Recovery cross-ref: count interventions in week W whose type is in a `RECOVERY_TYPES` set. Build that set from real type names in `lib/interventionCatalog.js` (grep for names like sleep, massage, BFR, cold, sauna-recovery, stretching, nutrition/recovery — use the exact strings from the catalog, do not invent names).
   - Return `{ ramPct, weekLoad, baselineLoad, weekMiles, baselineMiles, severity, recoveryCount, narrative }` or `null`.
3. Add the card in `pages/insights.js` alongside gut/heat cards: only render when non-null; body text mirrors the roadmap's example, appending either "You logged N recovery-focused entries this week — good." or the nudge to log one.
4. Tests in `tests/training-calculations.test.mjs` (fixtures like the existing `run()` helper):
   - Flat 4 weeks then a +35% week → high severity, correct ramp % (assert within ±1 point, TRIMP math involves exponentials).
   - +5% week → null.
   - Only 2 weeks of history → null (insufficient baseline).
   - Recovery intervention logged in spike week → `recoveryCount > 0`.
   - Zero-activity baseline weeks handled (athlete returning from break: baseline near 0 → guard against division by ~0; if baseline TRIMP < some floor, return null rather than "+4000%").
5. Run `node --test tests/training-calculations.test.mjs` and `npm run build`.

## Edge cases a weaker model would miss

- **Division by near-zero baseline** (post-injury/off-season return). A tiny baseline makes absurd percentages; suppress the card when baseline weekly TRIMP is below a floor (e.g. < 50) — an athlete ramping from nothing needs different messaging, not a red alert.
- The current week is usually PARTIAL. Comparing a Tuesday-so-far against full prior weeks under-reports; comparing the last complete week is stale by up to 6 days. Do both: evaluate the last complete week, and ALSO evaluate the current week only if its load already exceeds the threshold (a partial week that's already 30% over baseline is a real spike).
- Weeks with no activities are zeros in the baseline mean only if the athlete was active before and after (true rest week) — simplest correct rule: include zero weeks in the 4-week mean but require ≥3 of the 4 weeks non-zero, else null.
- Use the SAME week convention everywhere (Monday start, athlete-local dates); mixing `getDay()` conventions off-by-ones the bucketing. Sunday's `getDay()` is 0 — Monday-start math is `(day + 6) % 7`.
- Activities without HR still produce TRIMP (duration fallback in `computeActivityTrimp`) — fine; but activities without `moving_time` should be skipped, not NaN-poison the sum. Add a `Number.isFinite` guard on each activity's TRIMP before summing.
- Don't call it "injury risk" — roadmap prompt rules forbid medical claims. Phrase as load-management observation.

## Acceptance criteria

1. New tests pass; existing `training-calculations` tests unchanged and passing.
2. Seed check: an account with 4 steady weeks (~50 TRIMP-mi equivalents) plus a big current week shows the spike card on `/insights` with plausible numbers; an account with steady load shows no card.
3. The card names actual recovery intervention types from the catalog when logged, and shows the nudge otherwise.
4. No card renders for a brand-new athlete with <3 weeks of history.
5. `npm run build` succeeds.
6. Tick the checkbox for "Training Load Spike Detection" in `AI_ANALYSIS_ROADMAP.md` (change `[ ]` to `[x]` and update its Status line).

## Out of scope

- ACWR (acute:chronic workload ratio) modeling beyond the 4-week mean — keep the roadmap's simple rule.
- Claude-API-generated narrative text (rule-based string is fine and consistent with the existing cards).
