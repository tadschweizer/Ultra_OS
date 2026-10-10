# F9 target units and P3 synthetic assignment provenance

Repair delta starts at PR #135 head `18fa73008538b4a630bb0f1dc33a614dcd7f2583`.
Independent combined checkpoint `4a9cdec096e7d514763c13ce1fb423a30cf60339`
passed F8/O1 but found a remaining transfer failure: an ordinary assigned-plan
duration/date/instructions edit changed `6.2–7.4 min/km` to `6.2–7.4 min/mi`
without converting the bounds. The signed SQL browser regression reproduces
that exact payload difference before the repair (`f9-before.log`). The synthetic
assignment source-ID assertion also failed before the repair (`p3-before.log`).

## Behavior and transfer mapping

| Workflow | Revised behavior | Coverage / gate |
| --- | --- | --- |
| Coach edits an assigned workout's duration, date or instructions | Existing target units, numeric bounds, null bounds, repeats, notes and opaque step attributes survive unchanged | Actual shared editor, signed coach PATCH, local PostgreSQL readback, athlete GET and reload |
| Change total planned distance unit | Step pace/HR/power/RPE/zone units stay independent | Signed and synthetic browser assertions |
| Save assigned prescription to library | Same unchanged step prescription reaches signed library create and SQL | Signed create/readback plus synthetic browser |
| Deliberately convert a pace target | Explicit per-step control converts km/mile bounds with 1.609344; decimal minutes and minutes:seconds supported | Signed and synthetic UI, pure numeric/clock/roundtrip/zero/null tests |
| Invalid/custom pace input or unit | Unsupported conversions fail without changing the prescription; cancel discards edits | Pure tests and signed browser cancellation |
| Zero-valued target | Preserved in storage and rendered as zero in athlete details | Signed and synthetic athlete UI |
| Synthetic library assignment | `library_workout_id` identifies the actual selected template and survives edits/reload/athlete view | Adapter and browser regressions |
| Hosted/Safari/physical phone/concurrent clients | Not established by these local checks | Excluded from this verification; independent combined acceptance still required |

The shared editor now displays the stored step unit and saves its structure
without restamping every step from total-distance preference. Legacy steps with
no unit property receive an initial default once; explicit null/empty/custom
units remain untouched. New target-type selections deliberately initialize the
appropriate unit. Explicit pace conversion is separate from total distance.
Fractional step minutes and displayed fractional planned distance no longer
block unrelated edits through artificial HTML increments. No rounding is added
to pace conversion. Ordinary total-distance conversion retains its existing
rounding policy; this repair concerns target prescriptions.

The existing save busy guard, fast-response pointer double-click guard,
coach-scoped durable create receipt, null/zero template PATCH semantics and
template-to-assigned snapshot behavior remain. No production API, auth, account
access, assignment/copy backend, migration, grant, provider or service config was
modified. P3 changes only synthetic mapping. The hosted `54f2ab` static preview
was not rebuilt or republished.

## Reproducible checks

| Local check | Final result |
| --- | --- |
| Signed library + conversion + synthetic adapter unit tests | 29/29 pass |
| Full auth/critical regression suite | 443/443 pass |
| Integration availability | 4/4 pass |
| Signed library/editor browser scenarios | 18/18 pass, desktop and 320px mobile project |
| Complete synthetic browser suite | 26/26 pass, including 1440/390/320px F9/P3 cases |
| Native production build / local static build | Both pass |
| Protected source / pointer guard / whitespace audit | Pass |

Results: [units](f9-units.log), [auth](f9-auth-full.log),
[integrations](f9-integrations.log), [native browser](f9-native-browser.log),
[synthetic browser](f9-synthetic-browser.log), [native build](f9-native-build.log),
[static build](f9-static-build.log), [source boundaries](f9-boundaries.txt).
Screenshots: [signed desktop](f9-athlete-desktop-chromium.png),
[signed phone viewport](f9-athlete-mobile-chromium.png),
[synthetic 320px](f9-synthetic-athlete-320.png),
[synthetic 390px](f9-synthetic-athlete-390.png).

In `webapp`, with locked dependencies:

```sh
node --test tests/workout-library.test.mjs ../coach-demo/tests/adapter.test.mjs
npm run test:auth:full
npm run test:integrations
npx playwright test e2e/workout-library.spec.mjs --workers=1
npm run build
```

The F9 scenario is included in the existing CI critical library file, with no
package script or workflow change. The browser test runs real signed plan and
library handlers against isolated SQL and actual migrations. Its HTTP adapter
serializes PostgreSQL DATE as a date key, as PostgREST does. The outer Me/roster
envelopes are fictional local UI fixtures. It verifies anonymous denial and
athlete inability to replace coach planning fields; it is not a hosted Data API
test. Native fixture dates use the test process's current UTC date; synthetic
fixtures retain their deterministic `2026-10-09` sample date.

In `coach-demo`:

```sh
npm run build
npm test
npm run test:browser -- --workers=1
```

Browser coverage includes 1440, 390 and 320 pixels, preserving units through
assignment, unrelated edit, library save, explicit conversion and athlete
refresh. The complete previous coach/athlete loop, drafts, privacy, reset,
missing data, retry, navigation, copy and closed-network checks run alongside it.
All identities, provider-shaped activities, sessions and SQL rows are invented.
No real email, payment, synchronization or production data was used.

Local native execution uses the same verified Node22/Chromium/port3102 setup
documented in [README](README.md); the committed CI config runs normally.
Raw results and mobile/desktop screenshots accompany this document. Exact final
head/tree, CI run and locally built asset hashes are in the worker handoff
manifest. Passing self-checks does not close the independent combined gate.

## Manual retest

1. Start from unpublished combined checkpoint `4a9cdec`, retain its account
   transport/library-owner/backend fixes, and merge this delta from `18fa730`.
2. Assign a template with total-distance unit miles and pace `6.2–7.4 min/km`,
   a second mile pace, and HR/power/RPE/zone steps.
3. Change only assigned duration/date/instructions. Check persisted structure
   byte values and athlete reload: the first target remains `min/km`.
4. Change only total-distance unit, save to library and save plan. Check both
   stored structures; original assigned template provenance remains.
5. Use the first step's explicit pace unit control to convert to miles. Expect
   bounds `9.9779328–11.9091456 min/mi`; other steps retain their values. Reload
   the athlete view, then test invalid pace conversion and cancel.
6. Repeat synthetic assignment/edit/reload, confirm `library_workout_id`, and
   rerun the full coaching/messaging/reset/privacy/network regression.

Report independent acceptance against the exact resulting combined commit.
Hosted readiness, physical devices, Safari, real mailbox, fresh accounts and
independent-connection concurrency remain separate acceptance gates.
