# UltraOS — AI Analysis Opportunities Roadmap

> This document tracks ideas for what the AI engine should be able to extract, analyze, and surface once the Claude API is connected. Each item includes the data source, what to extract, and the athlete-facing output. Check off items as they are built.

---

## Activity-Level Signal Extraction

These analyses run on individual Strava/Garmin activity files and extract signals that no wearable currently surfaces in plain English.

### [ ] Heart Rate Drift → Zone 2 Detection
**Data source:** HR time-series from a single activity (via Strava streams API or Garmin FIT file)
**What to extract:**
- Cardiac drift: the % increase in HR over the second half of a steady-state effort at the same pace
- Compare HR at miles 3-4 vs miles 8-9 on a long easy run — if HR climbs >5-7% at constant pace, the athlete is above Zone 2
- Cross-reference with athlete's stated Z2 ceiling from settings
**Athlete-facing output:**
> "On your Tuesday 12-mile run your HR rose from 138 bpm (miles 3-4) to 151 bpm (miles 9-10) at the same pace. That 9.4% drift suggests you were running above your aerobic threshold for most of the back half. Your logged Z2 ceiling is 148 bpm — consider slowing 10-15 sec/mile."
**Status:** Not built. Requires Strava Streams API endpoint (`/api/activities/{id}/streams?keys=heartrate,time,distance`).

---

### [ ] Decoupling Score per Workout
**Data source:** HR + pace streams from a single run
**What to extract:**
- Aerobic decoupling (Pa:HR or EF decoupling): compare Efficiency Factor in first half vs second half
- EF = pace (min/mi) / average HR per window
- Decoupling % = ((EF_first_half - EF_second_half) / EF_first_half) * 100
- <5% = well within aerobic zone; >7% = aerobic ceiling exceeded
**Athlete-facing output:**
> "Aerobic decoupling on your Sunday long run: 4.2%. Well within the 5% threshold — this was a legitimate Zone 2 session."
**Status:** Not built. Same stream data as HR drift.

---

### [ ] Training Load Spike Detection
**Data source:** Weekly mileage/elevation history from activities
**What to extract:**
- Week-over-week % change in total load (acute vs chronic workload ratio pattern)
- Flag if any week represents >10% jump over prior 4-week average
- Correlate spikes with subsequent intervention entries (did the athlete log recovery/BFR after a big week?)
**Athlete-facing output:**
> "Your load this week (68 miles) is 31% above your 4-week average (52 miles). That's above the recommended 10% ramp ceiling. No recovery interventions logged this week — consider logging BFR or a deliberate sleep extension entry."
**Status:** Not built. Uses existing activity data already in Supabase.

---

### [ ] Pace Variability in Long Runs
**Data source:** Pace stream from long run activities
**What to extract:**
- Standard deviation of pace per mile in the back half of runs >14 miles
- High variability = athlete struggling to hold effort late (fatigue or fueling gap)
- Cross-reference with gut training log entries — was this run during a gut training progression?
**Athlete-facing output:**
> "Your last three 20-mile runs show increasing pace variability in miles 14-20 (±38 sec/mi avg). On runs where you logged gut training in the prior week, variability dropped to ±22 sec/mi. Pattern suggests GI fueling is a limiting factor in late-run execution."
**Status:** Not built. Requires pace stream + cross-reference with intervention log.

---

## Intervention × Activity Correlation Analysis

These analyses cross the intervention log with the activity history to surface what the athletes are paying for.

### [ ] Heat Acclimation Block Effectiveness
**Data source:** Intervention log (heat sessions) + activity HR data within ±2 weeks of a heat block
**What to extract:**
- Compare average HR at a given pace in runs before vs after a 10-day+ heat block
- Cardiac output at same RPE should decrease if acclimation worked
- Note: need at least 3 heat sessions logged within a 21-day window to flag as a "block"
**Athlete-facing output:**
> "You completed 5 heat sessions over 18 days in June. In the 10 days after, your average HR at 8:30/mi dropped from 156 bpm to 149 bpm — a 4.5% reduction consistent with successful plasma volume expansion."
**Status:** Not built. High priority for Year 1 AI layer.

---

### [ ] Gut Training Progression Compliance
**Data source:** Gut training intervention log entries (carb_target_g_per_hr vs carb_actual_g_per_hr)
**What to extract:**
- Week-by-week trend of actual vs target carb intake during gut training runs
- % sessions where athlete hit target ≥90%
- GI response score trend over the block
**Athlete-facing output:**
> "Gut training block: 8 sessions over 6 weeks. Carb target compliance: 62%. GI response improved from 4.2/10 to 7.1/10 over the block — tolerating roughly 82 g/hr by session 7. You're on track for a 90 g/hr race target."
**Status:** Not built. Uses existing intervention data already in Supabase.

---

### [ ] Sleep vs Next-Day Performance
**Data source:** Sleep intervention log + next-day activity data (pace, HR, duration)
**What to extract:**
- On nights where sleep < athlete's baseline (from settings: `typical_sleep_hours`), what happened to next-day run HR at the same pace?
- Flag sessions where HR was elevated >5 bpm above 30-day average the day after a short sleep entry
**Athlete-facing output:**
> "On 6 of your sessions logged the day after <6 hrs sleep, your HR at your easy pace averaged 7 bpm above baseline. Resting HR was also elevated. This is consistent with autonomic stress from sleep debt."
**Status:** Not built. Requires sleep intervention log correlation with activity streams.

---

### [ ] Sodium Bicarb Protocol Optimization
**Data source:** Bicarb intervention log (dose, timing, delivery, GI response, performance feel)
**What to extract:**
- Which dose × timing combination produced best performance feel with lowest GI response
- Minimum dose for performance benefit (threshold analysis across logged entries)
- Identify if capsule vs powder delivery correlates with GI outcome differences for this athlete
**Athlete-facing output:**
> "Across 7 bicarb trials, your best performance feel (8+/10) with GI response below 5/10 came from 0.3g/kg capsule form, 90 minutes before effort. Powder delivery at the same dose produced GI response averaging 7.2/10."
**Status:** Not built. High priority — this is a pure data analysis from the intervention log.

---

## Population-Level (Year 2+)

These require sufficient anonymized aggregate data across multiple athletes.

### [ ] Event-Type Completion Rate by Prep Profile
- Among athletes who completed progressive gut training (5+ sessions in 8 weeks before a 50K+), what % had GI-related issues in their race outcome logs vs those who did not?
- Segment by race distance, heat index, and surface type.

### [ ] Heat Acclimation ROI by Race Condition
- For hot races (>75°F predicted), what was the performance difference between athletes who completed 4+ heat sessions vs those who did not?
- Controls needed: training volume, altitude, race type.

### [ ] Optimal Taper Length by Athlete Profile
- Cross-reference taper length (from training phase log) with race performance ratings
- Segment by weekly training hours band (from settings)

---

## Implementation Notes

**Strava Streams API** — needed for HR, pace, time, altitude per activity. Currently not called. Add to `/api/activity-details.js` to fetch streams alongside metadata.

**Minimum data thresholds before any AI output:**
- Personal correlations: 10+ intervention entries of the same type
- Heat block analysis: 3+ heat sessions within 21 days
- Gut training progression: 4+ gut training entries with carb fields filled
- Sleep analysis: 5+ sleep entries with prior-night sleep hours logged

**Prompt engineering principle:** For every AI output, the prompt must include:
1. The raw data array being analyzed
2. The athlete's baseline settings (HR zones, weight, fueling anchors)
3. The race type and days until race
4. An instruction to state confidence level and minimum sample size caveat
5. An instruction to never suggest a medical diagnosis — only performance correlations

**Context window management:** Use Claude claude-sonnet-4-6 for standard insight cards. Reserve claude-opus-4-6 for race prep blueprint generation where full history context is needed.

---

*Last updated: March 2026 | Maintained in UltraOS repo root*
