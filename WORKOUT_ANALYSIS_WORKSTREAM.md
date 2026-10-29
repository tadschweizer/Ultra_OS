# Workout analysis and coach review

Created: 2026-10-29 (America/Denver)
Priority: High — owner-prioritized dedicated workstream.
Status: Requirements and sequencing defined; implementation and acceptance remain open.
Execution authority: PRODUCT_EXECUTION_ROADMAP.md. Extends ANA-001/003/004 and backlog F12.

## Outcome before features

A coach opening a completed workout should be able to understand its purpose, inspect what
happened, isolate meaningful sections, compare efforts, explain a finding, and decide what to
change next without reconstructing the session in another tool. Whole-session averages alone
cannot establish whether an interval workout achieved its purpose.

The owner's Intervals.icu screenshot is an interaction reference: aligned sensor tracks,
visible interval boundaries and summaries, and tools for dividing the recording into sections.
It is not evidence of Threshold's current screen or a requirement to reproduce every metric.
The benchmark is depth and usefulness of review, not visual similarity or metric count.

## Coaching questions and required evidence

| Question | Evidence needed | Interaction needed |
| --- | --- | --- |
| What was this session meant to accomplish? | Assigned steps and targets, session purpose, athlete comments and RPE | Plan and actual recording visible together; unassigned activities clearly identified |
| Where did execution differ? | Time-aligned pace/speed, HR, power when recorded, cadence and elevation | Shared cursor, zoom, selection, target overlays and visible missing samples |
| Were repetitions consistent? | Work and recovery boundaries, duration/distance, averages and coverage | Name/group repetitions; compare multiple selections side by side and by time within each repetition |
| What happened on this climb or late in the run? | Selected range, elevation profile, measured effort and available route | Select arbitrary sections; inspect local statistics and relate terrain to the timeline |
| Was the effort appropriate for the intention? | Targets, actual distribution, recovery behavior, athlete-reported context | Distinguish target execution from physiological interpretation; inspect the supporting samples |
| Is this different from previous comparable work? | Eligible historical sessions with compatible units, sport, definitions and thresholds | Explicitly choose comparisons; show differences in terrain, duration and data completeness |
| What should the athlete do next? | Coach interpretation linked to the exact section | Save a section-specific comment, share it, mark review state and navigate to a future workout adjustment |

These questions define scope. They do not authorize automated training prescriptions or causal
claims about fatigue, dehydration, fitness or injury from a single chart.

## Inspected foundation and gaps

Read-only source inspection on October 29 covered the local calendar, SessionAnalysis component,
sessionAnalysis calculations and session-analysis API, plus cached origin/main (5464b24).
The working checkout contains extensive pre-existing changes and differs from that remote-tracking
snapshot. This is source evidence, not a fresh production audit or a diagnosis of the owner's session.

- Both completed assignments and unassigned imports have analysis entry points.
- Existing analysis includes synchronized cursor tracks, numeric time-range selection, selected
  statistics, distance splits, recorded laps, limited planned-step alignment, a few peak windows,
  HR bands and total duration/distance comparison. Reuse this foundation.
- Analysis is embedded in workout details. There is no complete dedicated investigation workspace
  in the inspected component, no chart brushing, persistent named sections or multi-repetition comparison.
- Planned-step alignment currently accepts fixed-duration non-repeating steps only. It cannot
  establish repeated/distance/open-step execution or compensate for late starts and pauses.
- The inspected API retrieves detailed streams for Strava; other provider paths can return summary-only
  states. Never promise equal analysis depth merely because an activity is imported.
- Current settings expose a limited HR-band scheme. Full sport-specific zone definitions and historical
  threshold provenance need an explicit contract before wider zone or load interpretation.
- Existing workout feedback is a foundation for communication, but section-linked discussion needs
  stable section identity, save/conflict handling and permission rules.

First investigation must distinguish: planned but not completed, suggested but unconfirmed match,
confirmed recording, unassigned import, manual completion, provider summary only, stream retrieval
failure, missing sensor channels and wrong entry point. Each requires a useful, different state.
Coordinate with existing matching work (including merged PR #158 / 8fd599e); do not duplicate it or treat a suggested
match as confirmed.

## Proposed workspace

### October 29 owner clarification — analysis first, completion card removed

The owner reports that the review surface displays Suggested completion and Session review actions
without plots. Remove the standalone Completion card in the replacement workflow. The review screen
must lead with the recording and analysis; feedback/review controls belong alongside that evidence.
Preserve manual result entry, corrections, match confirmation/rejection and undo through clear actions
in the session header or recording controls. Removing the card must not remove those capabilities.

Analysis availability depends on an accessible recording, not on having an assigned workout or a
completed assignment status. Assigned and unassigned recordings use the same charts, selection,
sections and comparison tools. A suggested match must offer an explicit way to open the candidate
recording for analysis without confirming it. Its charts describe that recording, not a confirmed
completion of the plan. Do not auto-confirm links or silently choose among multiple candidates.

Local source explains a possible route to the reported experience: assigned-workout analysis is
conditional on completed status, whereas the unassigned activity detail already mounts analysis.
WorkoutReview itself supplies review actions rather than plots and uses workout_id. This is a source
finding, not confirmation of the live session's cause. Verify current main and the real entry path in WA-01.

Unassigned activities also need an explicit session review lifecycle and section-linked feedback for
authorized active coaches. Reuse existing activity discussions; extend review identity and permissions
to an activity subject instead of manufacturing a planned workout. Keep viewed, reviewed and response
requested distinct. Self-directed athletes must not see an implied coach awaiting review.

### Assigned-value compliance scale

Use the user-facing label **Plan completion**, with separate distance and duration scales. This describes
how much assigned volume was recorded, not a grade for workout quality or whether doing more was better.

| Case | Required display |
| --- | --- |
| 8 km recorded against 10 km assigned | Distance: 80% · 8 / 10 km |
| 66 minutes recorded against 60 assigned | Duration: 110% · 66 / 60 min; visibly beyond the 100% target marker |
| Both distance and time assigned | Two scales; no unexplained combined average |
| No assigned workout or no assigned volume | No assigned target; analysis remains available, no compliance score |
| Actual value unavailable | Actual unavailable; never display 0% |
| Known actual zero and positive target | 0%, clearly distinguished from unavailable |
| Zero/negative/invalid target | No valid target; do not divide or generate a percentage |
| Suggested but unconfirmed activity | Recording analysis available; plan completion awaits match confirmation |

For positive valid targets, percentage = actual / assigned × 100. Calculate in normalized units and
round only for display. Preserve values above 100%; do not reward over-completion with a better colour
or truncate the text to 100%. Show a labelled target marker and understandable over/under difference.
For prescribed ranges, show the actual relative to the lower/upper band rather than inventing a midpoint
target. Define the duration basis (moving or elapsed) for both actual and plan and disclose it consistently.
Manual results can support these scales with a manual-source label, even when no plotted recording exists.

HR, pace and power target execution require separate time-in-target measures with valid alignment,
thresholds and coverage; actual HR divided by target HR is not a compliance percentage. Implement those
in WA-03. Do not automatically mark a workout reviewed, resolve a response request or change its match
because a volume scale reaches 100%.

Use a dedicated, directly addressable analysis view reachable from workout details and completed
calendar entries. Preserve athlete, date and calendar return position. The existing detail view can
remain useful for quick edits and summaries.

1. Compact session header: athlete, date, sport, source, recording status, intended session, actual
   duration/distance and relevant available metrics. Distinguish elapsed time from moving time.
2. Main investigation area: aligned tracks with readable axes, shared cursor, lap/section boundaries,
   selectable channels, time/distance axis, zoom/pan and reset. Display smoothing must be labelled
   and must not change calculations or conceal gaps.
3. Selection inspector: exact start/end, duration, distance, pace/speed, HR, power, cadence, elevation
   change and per-channel coverage where available. Support drag selection plus precise keyboard
   and touch alternatives; allow boundary adjustment and snapping to recorded laps.
4. Sections and comparisons: recorded laps, distance splits, planned steps and coach-created sections
   stay distinguishable. Select several repetitions; inspect work separately from recovery.
5. Coaching context: plan targets, athlete comments/RPE, section-linked discussion and review state.
   A selected section remains selected when opening feedback.

On phones, prioritize one readable chart and its selection inspector at a time, with access to every
track and comparison. Do not compress a desktop grid into unreadable miniature charts. Keyboard users
must be able to perform the same analysis tasks; colour cannot be the only interval identifier.

## Data and calculation contract before advanced metrics

- Preserve raw recording identity and stable timestamps. Separate original laps from user annotations.
  Editing/deleting a section must never alter the original recording.
- Normalize units and provider semantics explicitly, including cadence conventions, sport and clocks.
  Show source and coverage for every metric. Null, zero, stationary and missing must remain distinct.
- Define elapsed/moving/observed duration, distance accumulation, pause handling, weighting, interval
  endpoints, elevation gain/loss processing, spike handling and incomplete-window behavior.
- Use full-resolution eligible samples for calculations. Chart reduction must preserve meaningful
  extremes and gaps; label any analysis truncation. Long trail recordings need explicit performance tests.
- Store zone/threshold definition and effective-date provenance. Changes to settings must not silently
  rewrite the meaning of a past target or historical result.
- Version derived calculations and invalidate affected results after recording, match or threshold
  corrections. Define whether historical recalculation is requested or automatic and make it visible.
- Keep normalized stream ingestion independent of a single provider. Establish each provider's actual
  channel availability and permitted coach access before enabling its path; this brief does not change
  any provider configuration or establish contractual permission.
- Persistent sections need owner/session ID, start/end, label/type, author, version and sharing scope.
  Feedback references the section and revision. Handle concurrent edits, revoked coach access, source
  deletion/reimport and changed recording boundaries without silently relocating a comment.
- No inferred sensor traces. Manual and summary-only sessions retain plan comparison and feedback,
  with a specific explanation of why detailed analysis is unavailable.

## Delivery sequence and acceptance

These are incremental deliverables within one workstream. Finishing the first slice does not establish
top-tier analysis or close ANA-003.

### WA-01 — Recording audit and first complete investigation (next implementation slice)

- [ ] Replace the standalone Completion card with the assigned-value Plan completion scales defined
  above and compact recording/match actions. Put plots before review actions; preserve manual entry,
  correction, undo and explicit matching. Verify that removing the card does not remove these controls.
- [ ] Open unassigned recordings directly with full available analysis and no assignment requirement.
  From a suggested match, open candidate analysis without mutating completion or matching state.
- [ ] Verify 80%, 100%, over-target, missing actual, known zero, invalid target, target ranges and unit
  conversions. Unassigned and unconfirmed cases must never receive a fabricated compliance score.
- [ ] Reproduce entry states for assigned/unassigned/manual/suggested/summary-only/failed recordings
  using safe fixtures; verify the actual affected session read-only when an identifiable example is available.
- [ ] Produce a channel and calculation inventory against current main; inspect existing matching work.
- [ ] Build the dedicated workspace with aligned tracks, shared cursor, drag/touch/keyboard range selection,
  zoom/reset, exact boundary editing and coverage-aware selected statistics.
- [ ] Prove that selecting the third work repetition updates every chart and statistic, that reset restores
  the full recording, and that returning to the calendar preserves context.
- [ ] Prove useful states for missing HR/power and unavailable recordings without fake traces or endless loading.

### WA-02 — Sections, repetitions and durable coaching feedback

- [ ] Support activity-based review and feedback for unassigned recordings, including active-coach
  authorization, review/request lifecycle, queue access and self-directed athlete states. No synthetic
  assignment is required. Verify both workout and activity subjects end to end.
- [ ] Create, rename, resize, split and merge user sections; undo mistakes and preserve source laps.
- [ ] Group work/recovery sections, compare multiple repetitions and show absolute plus relative differences.
- [ ] Support overlay by elapsed time within each repetition; optional percentage alignment must be labelled
  because it can conceal duration differences. Summaries must use appropriate weighting.
- [ ] Save sections and section-linked feedback, recover failed saves, handle edit conflicts, and enforce
  athlete/active-coach/private-note visibility on the server.
- [ ] For an eight-repetition fixture, compare first/last efforts and all work sections while excluding
  recoveries; reload and recover the same boundaries and feedback as the authorized athlete/coach.

### WA-03 — Planned execution and terrain context

- [ ] Align repeat, time, distance and open steps with actual sections; show uncertain alignment and allow
  manual correction. Keep a plan offset distinct from changing the recording.
- [ ] Show actual versus target per work step, time in the applicable target and recovery statistics,
  including units, threshold basis and coverage. Missing samples cannot improve compliance.
- [ ] Add route/timeline linkage when permitted coordinates exist, with location privacy and unavailable
  states; terrain analysis remains useful from elevation alone.
- [ ] Verify pauses, warm-up extensions, missed laps, short/extra repetitions and changed target settings.
  No single opaque workout score substitutes for the underlying comparison.

### WA-04 — Deeper interpretation and historical comparison

- [ ] Expand sport-appropriate effort curves and configurable HR/pace/power distributions for selected
  sections and whole sessions. Distinguish within-session peaks from historical records.
- [ ] Compare explicitly selected similar sessions and sections with visible comparability limits.
- [ ] Specify eligibility, formulas and validation fixtures before introducing drift/decoupling,
  grade-adjusted pace, normalized power or threshold-relative load. Suppress unsupported interpretations
  for intervals, changing terrain, inadequate coverage or absent thresholds as appropriate to the metric.
- [ ] Connect findings to coach-written next steps and existing planning/review workflow. AI advice remains deferred.

## Verification and definition of done

Use synthetic reference recordings with independently calculated expected results: steady running,
8 x 2-minute repetitions with recoveries, hilly trail running, cycling, pauses, irregular samples,
sensor gaps, summary-only and long recordings. Include real recordings only with appropriate access.
Test boundaries, partial intervals, unit conversions, weighting, channel dropouts and provider semantics.

Browser acceptance covers both calendar entry paths, coach and athlete roles, keyboard and phone
selection, saved section reload, concurrency/retry, relationship revocation and clear unavailable states.
Benchmark short intervals and long recordings on documented desktop/phone profiles. Initial engineering
targets: cached selection feedback within 100 ms and a usable cached workspace within 2 seconds at p95;
measure and revise against evidence, not marketing promises. Provider fetch time is measured separately.

Final observed coach task: open a workout, find a problematic repetition or climb, select and compare
it, identify the evidence and uncertainty, save a specific comment and reach the next training adjustment
without exporting. Record success, time, confusion and data limitations; the owner reviews the result.

Release record must link exact commit/PR, calculation tests, browser checks, performance profile,
deployment evidence when authorized, and real coach/athlete acceptance separately. Existing pilot,
physical-phone, mailbox and provider acceptance gates remain open. No release or production change
is authorized by this planning document.

## Current handoff

Next: WA-01, starting with current-main and recording-path verification, then the interactive workspace.
Keep development isolated from the mixed working checkout and coordinate existing calendar work.
Requirements are prepared for the owner-authorized documentation release on codex/workout-analysis-workstream. No application implementation or new application test results are claimed. Consult its pull request for hosted checks and merge evidence.
