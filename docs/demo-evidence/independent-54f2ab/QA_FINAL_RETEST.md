# Threshold independent exact-build retest — 54f2ab

**Outcome: PASS for the agreed synthetic daily-coaching demo scope. F1–F5 are cleared in the tested paths. No remaining observed launch blocker in that scope.** This is limited runtime acceptance, not full Threshold parity, production-library acceptance, or verification on physical phones. No code changes, merge, deployment, production settings or real data writes were performed.

Test window: **2026-10-10 01:47:49–01:53:51 UTC**. Windows host, real headless Chromium155.0.8059.39, Playwright CLI0.1.22. Isolated `thresholdfinalqa` browser session, synthetic seed/QA records only. Desktop1440×1000, responsive390×844 and320×740/844. Seed restored; pending failure disarmed; only QA session closed. All prior failed and passing evidence remains unchanged.

## Served identity

Frozen preview: https://ultra-os-tb77-fbct852gc-tadschweizers-projects.vercel.app

Runtime `54f2ab181848baf022c2fc59ce0c5c492f00da1d`; supplied READY deployment `dpl_EtjWEJQQ4gY6xA7UW7aFvf8SeB2B`; evidence head `cb3136fd2d0d252526bfb1316e695373ebaf864e`; [draft PR134](https://github.com/tadschweizer/Ultra_OS/pull/134).

Fetched all four served files independently. Every SHA-256 and byte length matches [the manifest pinned at cb3136fd](https://github.com/tadschweizer/Ultra_OS/blob/cb3136fd2d0d252526bfb1316e695373ebaf864e/coach-demo/preview-identity.json). No moving branch or alias was used. HTTP itself does not independently expose a Git commit or deployment ID; matching bytes bind the served artifact to the immutable manifest.

| Hosted file | Bytes | Independently measured SHA-256 |
|---|---:|---|
| index.html |763|0c15249c47c10ea7c8ed7e5d5189758a7e348de99837c8ea3620690107c3ac52|
| assets/index-BQKfX-nn.js |277141|f16b6b4af513cfe9c6350a04383aafd3fb14714127f6856ccd287a6f5a6824d1|
| assets/index-BixaqdIL.css |28859|2c3679c0f147d82e28eed0386cbb8f746e669a2b827a4ed7240b3aef6714e3dd|
| favicon.svg |182|fb03e23aee5c008f20ba4a3fc5a10092be5dbb9a7f85e8e397f9560c97315bf8|

Evidence: [host fetch/probes](host-evidence.json), [pinned manifest](pinned-manifest.json), [automatic byte/hash comparison](identity-comparison.json), fetched assets. [Repair handoff](https://github.com/tadschweizer/Ultra_OS/blob/cb3136fd2d0d252526bfb1316e695373ebaf864e/DEMO_QA_FIXES.md) was reference only. Implementer's17/21/432 passing counts were not accepted as independent evidence or rerun.

## Original failures: expected and observed

**F4 / formerly P2 — PASS at1440/390/320,01:48:35–37 UTC.** Exact seeded reproduction: Athlete River → Today → Steady trail run → Close → calendar Recovery run → refresh. Expected Recovery with consistent selection/URL. Observed `workout=seed-0-2`, Recovery before and after refresh; no return to Steady. Close removes workout query while retaining athlete/role; refresh after close has no dialog.

Also entered unsaved111min/notes on Steady,222min/notes/discussion on Recovery. Same-calendar shallow-link switches to Steady and back show the selected item's blank actuals and blank discussion, not another item's draft. No synthetic completion was submitted in this check. At320px Back returns Today and Forward restores Recovery; Escape clears selection. Imported Ridge activity similarly updates `activity=demo-activity`, survives refresh, and Close removes selection; refresh then has no dialog. Keyboard Plan opens with Close focused;22Tabs stay in dialog; Escape restores Plan focus.

Evidence: [Recovery before](01-recovery-before-refresh-320.png), [Recovery after](02-recovery-after-refresh-320.png), `f4-nav-inputs.txt`, `history-keyboard-activity.txt`. These contain exact URLs, timestamps, expected data and observed values, plus replayable real UI steps.

**F5 / formerly P2 — PASS at1440/390/320,01:49:26–29 UTC.** Exact seeded reproduction: River's October5 week → Steady → match October7 Ridge exploration → Confirm → Close → refresh → unlink. Expected weekly duration/distance/TSS/elevation retained with no second contribution.

Before match, after match, after repeated Confirm, after refresh and after unlink: **Actual2h28m,21.5km,58TSS,620m**. Only attribution changes from imported to completed. Detail60min/8.2km/109% is consistent. Repeated confirmation does not double620m or58TSS. Unknown-TSS count remains2 for the two manually completed seed sessions. Desktop has `El.620m`; both narrow summaries display620m.

Evidence: [unlinked320](03-unlinked-elevation-320.png), [linked320](04-linked-elevation-320.png), [linked390](04-linked-elevation-390.png), [linked desktop](04-linked-elevation-1440.png), `f5-matching.txt`. No fixture with recorded mechanical work/kJ was exposed in the exercised UI; the separate work/kJ repair claim remains **NOT RUN**, rather than inferred from elevation or implementer unit tests.

**F1 / formerly P1 — PASS smoke.** At320px created50min/8km progression, description/objective/separate instructions/primary duration/IF0.72, warm-up15,3×5 Tempo with HR145–155**bpm** and recovery notes, cool-down20. Save library/source, assignOctober10, switch athlete, refresh: complete tested prescription remains. Also recreated private primary-distance25min/4km/IF0.6 template; assignedOctober15 retains metadata/private visibility in coach editor, athlete sees zero private cards after refresh. Repeated library save produces one template.

Evidence: `f1-create.txt`, [assigned prescription](06-library-prescription-320.png), `f1-f2-loop.txt`, `f1-private-create.txt`, `f1-private-retention.txt`.

**Production limitation:** The manifest/repair handoff explicitly describe full library metadata persistence as **demo-adapter-only**. Production library API/database schema is unchanged. This clears demo fidelity; it does not claim the production persistence defect is fixed.

**F2 / formerly P2 — PASS smoke.** Partial32min/4.7km/RPE7 gives64% compliance, coach sees exact same data, weekly ActualTSS0 with unknown1. A second50-minute planned session marked complete with RPE5 and blank duration/distance leaves Actual32min/4.7km/TSS0; unknown count becomes2. Refresh preserves actual blanks. Undo returns unknown1; skip/undo returns planned without fabricated actual metrics. Recorded58TSS remained known through matching.

Evidence: `f1-f2-loop.txt`, `f2-blank-skip-undo.txt`, `f5-matching.txt`.

**F3 / formerly P3 — PASS smoke.** At390px arm Fail next save, save coach feedback. Correct failure alert, entered feedback retained, no armed status remains; retry returns Saved. Navigate and continue editing without stale notice. Reset while separately armed also clears notice.

Evidence: [consumed failure alert](07-consumed-failure-390.png), `core-loop-f3.txt`, `isolation-reset.txt`. This new-build smoke uses feedback; every calendar/message failure branch was not rerun.

## Core acceptance and final matrix

PASS entries below were exercised on this exact build; older passing evidence is not substituted. No failing check was observed. NOT RUN remains a limitation, not a passing claim.

| Workflow/check | Result | Expected / observed |
|---|---|---|
| Exact asset identity |PASS|All4byte/hash pairs match pinned manifest.|
| Anonymous, synthetic-only demo |PASS|No login; fiction/sample-date/local-delivery labels; no real identity/provider/payment request.|
| Coach selects athlete and builds structured run |PASS|Robin realistic50min/8km,3×5HR-target prescription with full instructions.|
| Library reuse visible/private cases |PASS|Full tested metadata retained; private distance template remains hidden.|
| Athlete prescription and actual logging |PASS|32min/4.7km/RPE7/context,64%; data consistent in coach view.|
| Coach feedback and role-correct session discussion |PASS|Athlete sees feedback and coach comment.|
| Duplicate/reschedule/revise next session |PASS|Duplicate clears actuals; revised2×5/30min/5km movedOct12, IF/unit retained.|
| Athlete revision/reply after refresh |PASS|Revised instructions/steps persist; athlete sends acknowledgment.|
| Blank actuals / unknown load / skip / undo |PASS|No plannedTSS credited as actual; blanks persist; unknown count changes honestly.|
| Match/repeated confirm/reload/unlink |PASS|Duration/distance/TSS/elevation consistent, no double count.|
| Workout selection/close/refresh |PASS|F4exact seeded repro atall3widths; no stale selection.|
| Unsaved completion/notes/comment across items |PASS|Shallow-link switching resets fields to correct item's values.|
| Imported detail selection/close/refresh |PASS|Correct Ridge detail retained, Close removesactivity, reload no modal.|
| Back/Forward and keyboard |PASS|BackToday/ForwardRecovery; Escape clears; editor22Tabtrap and focus restoration.|
| Copy-week repeat and field retention |PASS|Oct12→19 copies once; repeat unchanged counts; revisedHRbpm/IF/objective/instructions retained, actuals/discussion cleared.|
| Local messages/roles/unread |PASS|Coach sends, athlete replies; coach2→1unread leavesSage; Email alert skipped.|
| Role/recipient draft separation/reload |PASS|Robin/Jules draft isolation; athleteRobin blank; coachRobin draft restored after reload.|
| Check-in updates coach |PASS|5.5h,energy2,soreness4/context update review/roster.|
| Failed feedback save/retry and armed reset |PASS|Correct alert, retained input, Saved retry, consumed/disarmed notice.|
| Responsive1440/390/320 |PASS|F4/F5interaction all3widths; five screens×3 widths document=viewport;320editor/private/messages and390revision.|
| Fresh no-opener tab isolation |PASS|CleanRobin seed; original session byte-identical; cookies/localStorage empty, sessionStorage ownkey.|
| Reset cancel/Escape/keyboard restore |PASS|Cancel/Escape preserve state; Cancelinitialfocus, TabRestore; QAdata removed, seed restored, pendingfailureoff.|
| Interaction network/JS errors |PASS|188recordedmain-page requests,0API/external,0pageerrors; CLI193staticGETs, console0warnings/errors.|
| Protected-shaped endpoint probes |PASS bounded|Five harmlessGETs404; CSPconnect-srcnone; no exhaustive auth/route audit claim.|
| Recorded mechanical work/kJ retention |NOT RUN|No measuredworkfixture exercised; elevation result does not prove this branch.|
| Physical phone / Safari / Firefox |NOT RUN|Unavailable; responsive viewport is not a physical-phone test.|
| Production library persistence / production regression suite |NOT RUN|Unchangedschema; no productionwrite/test/rebuild proof.|
| All target types / automatic match approval / adversarial duplicate races |NOT RUN|HR/open targets, manualmatching and one directduplicate exercised.|
| Calendar/message/copy mutation failure branches / log-form cancellation / local export |NOT RUN in this retest|Focusedfailurefeedback/reset; old-build evidence retained but not recounted as currentpass.|

## Scope, safety and recommendation

The meaningful daily coach/athlete loop is carried over, including prescription/reuse, logging, review, adjustment and reply. Single-tab role simulation is declared; fresh tabs have independent state. No cross-device/multi-tab synchronization claim. Runtime recorder covers01:48:01.741–01:53:50.680UTC on mainQApage; auxiliary isolation tab has separate requests. Tested requests were same-origin static only, with0API/external; protected-shapedGET probes are separately recorded. No real messages/email/providers/data were used.

Declared exclusions remain signup/invitations, external delivery/integrations/imports, billing/deletion, groups, protocols/interventions, race management, shared docs/research/calculators, profile and deeper analytics. These are deliberate limitations, not newly discovered bugs; this demo is not full-app parity. The unverified mechanical-work branch and physical devices are explicit limitations, not blockers observed in the agreed tested loop.

14supported Playwright screenshots accompany exact replayable steps and expected/observed data. `screenshots.json` records captureUTC/hash/bytes; browser and viewport are specified above. One exploratory library-date locator matched two fields; it was corrected to the inspected first template row before action. This is a harness ambiguity, not a product failure.

**Recommendation: limited PASS; the observed F1–F5 launch holds can be cleared for this exact synthetic-demo artifact.** Preserve scope disclosures and production-library limitation. Do not describe this as complete Threshold parity or physical-phone verification. This report does not authorize merge/deploy or changes to an existing public site.
