# Plan 06 — Test the correlation engine (the product's moat has zero tests)

**Priority: 6 of 10. Cheap, pure-function work that protects the core product from silent regressions before plans 07–08 build on top of it.**

> **Status: IMPLEMENTED.** 15 tests in `tests/training-insights.test.mjs` covering every bullet (thresholds, deltas, group gates, 48h window incl. exact-boundary, zero-score exclusion, confidence tiers, sort order, malformed input, time series, summary trend). The `toTimestamp` timezone bug was REAL: local-noon parsing shifted the 48h boundary by 1h across DST (verified 49h gap under TZ=America/Denver for 2025-11-01→11-03); fixed with UTC-noon parsing, same API. Suite passes under TZ=UTC and TZ=America/Denver; `test:insights` script wired and file added to `test:auth:full`.

## Goal

`webapp/lib/trainingInsights.js` (the correlation engine — the thing athletes pay for), `webapp/lib/insightSystemContent.js`, and the insight builders in `pages/insights.js` have no test coverage. `tests/training-calculations.test.mjs` covers only `activityInsights`/`trainingLoad`. The correlation engine is all pure functions over arrays — ideal test territory. Also fix the one real bug class visible in the code: date handling that breaks across timezones/DST.

## Files to touch (exact)

1. `webapp/tests/training-insights.test.mjs` (new)
2. `webapp/lib/trainingInsights.js` — only if tests reveal bugs (one known suspect below)
3. `webapp/package.json` — add the new file to a `test:insights` script and to `test:auth:full` (or add a plain `test` script running `node --test tests/`)

## Steps in order

1. Read `lib/trainingInsights.js` fully (257 lines). The exports to cover: `buildTrainingResponseCorrelations`, `buildCheckInTimeSeries`, `buildCheckInSummary`.
2. Create a fixture builder in the test file:
   ```js
   function checkIn(date, { legs = 7, energy = 7 } = {}) {
     return { intervention_type: 'Workout Check-in', date, protocol_payload: { legs_feel: String(legs), energy_feel: String(energy) } };
   }
   function intervention(type, date) { return { intervention_type: type, date }; }
   ```
3. Write these tests for `buildTrainingResponseCorrelations`:
   - Below threshold: 3 check-ins → `correlations: []` and `needsMore = 1` (threshold is `MIN_GROUP_SIZE + 1 = 4`).
   - Positive correlation: 4+ check-ins the day after "Sauna" with legs 8–9, 4+ without at legs 5–6 → one card, `positive: true`, `interventionType: 'Sauna'`, delta ≈ +3, `metric: 'legs'`.
   - Delta below `MIN_DELTA` (0.4): groups averaging 7.0 vs 7.2 → no card.
   - Group-size gate: 6 check-ins WITH sauna, only 2 WITHOUT → no card (each side needs `MIN_GROUP_SIZE = 3`).
   - 48-hour window: intervention dated 3 days before a check-in does NOT tag it; same-day and 1-day-before DO (note `toTimestamp` pins both to 12:00, so "2 days before" = exactly 48h = inclusive — assert current behavior).
   - Zero-score handling: check-ins with `legs_feel: '0'` or missing payload are excluded (`hasScore` false).
   - Confidence tiers: 6+/6+ → `high`, 4/4 → `moderate`, 3/3 → `low`.
   - Sort order: positive cards before negative, then by `|delta|` descending.
   - Malformed input: `protocol_payload: null`, `date: null`, `legs_feel: 'abc'` — no throw, sensible exclusion.
4. Tests for `buildCheckInTimeSeries`: sorts ascending by date, respects `limit`, missing scores become `null` (note: `parseFloat('0')||null` → null — assert that).
5. Tests for `buildCheckInSummary`: empty → `null`; averages rounded to 1 decimal; 7-day vs prior-7-day trend math using dates relative to `new Date()` (build dates with `new Date(Date.now() - n*864e5).toISOString().slice(0,10)` so the test doesn't rot).
6. Known suspect to investigate while testing: `toTimestamp` builds `new Date(\`${dateStr}T12:00:00\`)` in the SERVER's local timezone. On Vercel (UTC) vs a dev laptop (e.g. UTC-7) the same data can tag differently at the window boundary. Since both check-in and intervention use the same noon convention, deltas cancel out for whole-day windows — verify with a boundary test (intervention exactly 2 calendar days before check-in) run under `TZ=America/Denver node --test` and `TZ=UTC node --test`. If results differ, replace with `Date.UTC(y, m-1, d, 12)` parsing inside `toTimestamp` (pure change, keeps all behavior otherwise).
7. Wire scripts in `package.json`:
   ```json
   "test:insights": "node --test tests/training-insights.test.mjs tests/training-calculations.test.mjs"
   ```
   and append the new file to the `test:auth:full` list (that's the de-facto full suite).
8. Run: `cd webapp && npm run test:insights && npm run test:auth:full`.

## Edge cases a weaker model would miss

- Scores arrive as **strings** from `protocol_payload` (`'7'`), sometimes empty strings — fixtures must use strings to match production data.
- `MIN_GROUP_SIZE` applies to BOTH groups independently; a type present in almost every window can never have 3 "without" check-ins and silently produces no card — that's intended, assert it.
- The engine filters unscored check-ins AFTER the first count gate, so 5 check-ins where 2 are unscored → second gate (`tagged.length < 4`) returns `needsMore` based on tagged count. Assert the actual behavior rather than what seems logical.
- Don't use the current date in fixtures for correlation tests (only the summary tests need relative dates); fixed historic dates keep tests deterministic.
- Node's test runner: files must be `.mjs` or the package must be ESM — follow the existing `.mjs` convention and `import ... from '../lib/trainingInsights.js'` (that lib uses `export`, which works because the existing tests already import sibling libs the same way).

## Acceptance criteria

1. `npm run test:insights` passes with ≥ 15 assertions covering every bullet in steps 3–5.
2. `TZ=UTC npm run test:insights` and `TZ=America/Denver npm run test:insights` both pass (timezone stability proven).
3. `npm run test:auth:full` includes and passes the new file.
4. If the timezone fix (step 6) was needed, `/insights` renders identically for a seeded account before/after (spot-check one correlation card's numbers).
5. No changes to `trainingInsights.js` public API (same exports, same return shapes).

## Out of scope

- New insight types (plans 07–08).
- UI tests for `pages/insights.js` rendering.
