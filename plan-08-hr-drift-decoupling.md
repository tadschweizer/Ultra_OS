# Plan 08 — HR drift + aerobic decoupling per activity (Strava streams)

**Priority: 8 of 10. The top two items on AI_ANALYSIS_ROADMAP.md. The streams plumbing already exists (`getActivityStreams` in `lib/strava.js` is already called for altitude) — this extends it to heartrate/time/distance and computes the two signature analyses.**

## Goal

For a steady run, compute and display:
- **Cardiac drift**: % HR rise in the second half at comparable pace, vs the athlete's stated Z2 ceiling from settings.
- **Aerobic decoupling (Pa:HR)**: Efficiency Factor (speed ÷ HR) first half vs second half; `<5%` = solid aerobic session, `>7%` = above aerobic ceiling.

Surface both on the activity detail view with the roadmap's plain-English phrasing.

## Files to touch (exact)

1. `webapp/lib/streamAnalysis.js` (new) — pure functions, no I/O: `computeHrDrift(streams)`, `computeDecoupling(streams)`, `analyzeSteadyState(streams, settings)`
2. `webapp/pages/api/activity-details.js` — request `['altitude', 'heartrate', 'time', 'distance', 'velocity_smooth']` streams instead of just altitude; attach analysis to the response
3. `webapp/lib/strava.js` — read-only (confirm `getActivityStreams(accessToken, id, keys)` passes arbitrary keys; adjust only if it hardcodes altitude)
4. The activity detail UI — find the consumer of `/api/activity-details` (`grep -rn "activity-details" webapp/pages webapp/components`; likely `pages/history.js`, `interventions/[id].js`, or a component) and add the analysis panel there
5. `webapp/tests/stream-analysis.test.mjs` (new)
6. `webapp/pages/api/settings.js` / settings schema — read-only: find the athlete's Z2 ceiling / HR zone field names (grep `hr_zone` in migrations and `lib/activityInsights.js`, which already reads zones)

## Steps in order

1. Confirm `getActivityStreams` signature in `lib/strava.js` accepts a keys array (activity-details already calls it with `['altitude']`). Strava returns `{ heartrate: { data: [...] }, time: { data: [...] }, distance: { data: [...] } }` aligned by sample index.
2. Build `lib/streamAnalysis.js`:
   - `resample(streams)` → array of `{ t, d, hr, v }` points, skipping indices where hr or distance is missing.
   - `computeDecoupling(points)`: split by elapsed distance (not array index — samples aren't uniform) into halves; EF_half = mean(speed) / mean(hr); decoupling % = (EF1 − EF2) / EF1 × 100. Return `{ decouplingPct, ef1, ef2, valid }`.
   - `computeHrDrift(points)`: mean HR in the 20–35% distance window vs the 70–85% window (avoids warmup and finish surge); driftPct = (hr2 − hr1)/hr1 × 100. Also return mean pace of each window so the UI can say "at similar pace" only when true (pace windows within ~5%).
   - `analyzeSteadyState(streams, settings)`: gate on suitability — duration ≥ 40 min, moving mostly continuous, pace variability between windows < 10%, sport is a run (caller passes sport). Returns `null` when unsuitable (intervals/races must not be scored). Compares drift window HR to the athlete's Z2 ceiling if present in settings; include `z2Ceiling` and `aboveZ2` in the result.
3. Wire into `pages/api/activity-details.js`: extend the streams call, run `analyzeSteadyState`, attach as `response.analysis` (or `null`). Keep the altitude summary behavior identical. Keep the `.catch(() => ({}))` so activities without streams still return metadata.
4. UI: in the activity-detail consumer, when `analysis` is non-null render two lines with a status tone:
   - "Aerobic decoupling: 4.2% — well within the 5% aerobic threshold." (green <5, amber 5–7, red >7)
   - "HR drift: +9.4% at steady pace (138 → 151 bpm). Your logged Z2 ceiling is 148 bpm — consider easing 10–15 sec/mi." (only mention Z2 when settings provide it)
   When `analysis` is null render nothing (no empty panel).
5. Tests with synthetic streams (arrays generated in the test):
   - Constant pace, constant HR → drift ≈ 0, decoupling ≈ 0.
   - Constant pace, HR ramping 140→155 → positive drift ≈ 10%, positive decoupling.
   - Interval-shaped pace (alternating fast/slow) → `analyzeSteadyState` returns null (variability gate).
   - 20-minute activity → null (too short).
   - Streams with gaps/missing hr samples → no NaN, still computes.
6. `node --test tests/stream-analysis.test.mjs`, then `npm run build`, then manual check against a real activity.

## Edge cases a weaker model would miss

- **Strava streams are index-aligned but not time-uniform** (variable sampling). Split halves by cumulative DISTANCE, and compute mean speed as (distance covered / time elapsed) per half — never `mean(velocity samples)` unweighted.
- Stopped time: `time` stream includes pauses in some fetch modes. Filter samples where instantaneous speed < ~0.5 m/s before computing HR means (standing at a light with high HR poisons the drift).
- `distance` stream is cumulative meters — window selection uses fractions of TOTAL distance, and hr window means must be time-weighted or at least sample-count-guarded (require ≥ 30 samples per window else return null).
- Treadmill/manual activities have no distance or velocity stream → `analyzeSteadyState` returns null, not a crash. Guard every stream access with existence checks.
- Rate limits: this endpoint now requests 5 streams in ONE call (Strava returns them together — one API call, same as before; do NOT loop per-key).
- Downhill-heavy trail runs legitimately show negative drift; display negative values as "HR drift: −2% (well controlled)" rather than clamping to 0.
- The Z2 ceiling field: use the exact settings column found in step 6-read (`activityInsights.js` already reads HR zones — reuse its field names/fallbacks; don't invent `z2_ceiling`).
- EF for runs uses speed (m/s)/HR; don't use pace (min/mi)/HR as the roadmap text loosely says — pace is inverse, which flips the sign of decoupling. The <5%/>7% thresholds assume speed-based EF.

## Acceptance criteria

1. `node --test tests/stream-analysis.test.mjs` passes all five synthetic cases.
2. On a real steady long run with HR data, the activity detail shows both metrics with believable values (drift within −5%..+20%, decoupling within −5%..+15%).
3. On an interval workout, no analysis panel appears.
4. On an activity without HR (or a non-run), no panel and no error; altitude summary still renders exactly as before.
5. An athlete with HR zones configured sees the Z2 comparison sentence; one without zones sees the metrics without the Z2 clause.
6. `npm run build` succeeds; tick both roadmap checkboxes ("Heart Rate Drift → Zone 2 Detection", "Decoupling Score per Workout") in `AI_ANALYSIS_ROADMAP.md`.

## Out of scope

- Persisting analyses to Supabase or trending them across activities (do later; compute-on-view is fine at current scale).
- Pace-variability late-run analysis and sleep/heat correlations (later roadmap items).
