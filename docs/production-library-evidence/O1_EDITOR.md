# O1 saved workout template editor

PR #135 repair delta starts at `fc6ad787a12d8647008b5a70beb6319f4b8dc3c0`.
Independent combined `d13ec51` QA found no in-place browser editor despite a
working PATCH API. A local signed-handler browser test reproduced the missing
Edit control before implementation (`o1-before.log`).

Each saved library card now opens the shared workout editor in template mode.
It edits existing name/sport, description, objective, separate instructions,
duration/distance/unit, IF/TSS, primary target, visibility, structure and tags.
Date and Save-to-library create controls are absent. The UI explains that already
assigned workouts retain their prescription; this edit updates the saved template.

The existing validated, owner-scoped PATCH API handles updates. The editor writes
only deliberately changed fields, preserving untouched nulls/zeroes, exact km,
stored step units/ranges/repeats/notes and opaque attributes. Unit changes avoid
display-rounding writes; intentional distance edits use exact unit conversion.
Blank edited nullable fields clear to null. Fractional targets/durations remain
editable. TSS is explicit in template mode rather than silently recalculated.
Known steps keep their units when other fields change; changing a step's target
type sets its matching unit. Empty legacy structure displays an empty builder
and stays omitted from PATCH until intentionally changed. The existing SQL
constraint requires non-null structure; no constraint is weakened here.

Save locks the form, uses a 15-second request timeout and keeps input on failed
or lost acknowledgements. Retry PATCHes the same owned row; no create request or
new receipt is used. Success updates the card and refreshes the library; the
existing truthful cached-refresh behavior remains. Cancel sends no write.
Role/account transport changes close the template editor. Existing durable create
receipts, uncertain-create retry and pointer double-click guard remain unchanged.

## Reproduce and evidence

From `webapp`, Node 22 with installed Chromium:

```sh
node --test tests/workout-library.test.mjs
npx playwright test e2e/workout-library.spec.mjs --workers=1
npm run test:auth:full
npm run build
# From coach-demo (local build only):
npm ci
npm run build
npm run test
npm run test:browser
```

Windows uses an untracked local config for port 3102 and Chromium 1217; normal
committed config is used by CI. Browser transport invokes actual signed PATCH/GET
handlers with real disposable SQL, not fabricated persistence. No external
credentials, production rows, provider/email/payment calls or remote migrations.

Evidence includes initial failing reproduction, final browser/regression/build
outputs and desktop/320px screenshots. The full library browser suite covers
O1 cancellation, metadata edits, lost committed acknowledgement/retry, reload,
zero/null/units/tags, validation correction, opaque structure and repeated clicks,
plus existing F6/F7 and native create double-click/fresh keyboard-operation checks.
The signed SQL tests retain foreign-owner, unauthenticated, athlete, revoked
session, origin, validation and create-receipt protections.

The existing pure field normalizer is now in `webapp/lib/libraryValidation.js`,
with its prior API export retained. Auth, identifiers, origin checks and SQL
remain in the server handler. The same browser-safe normalizer validates a new
synthetic adapter PATCH for the existing template fields. It updates only the
current browser store, preserves its ID and create fingerprint, denies athlete
editing and unknown IDs, and leaves existing assigned workouts unchanged. Local
synthetic tests verify repeated PATCH, reload, separate store isolation, reset,
validation errors and assignment using the revised metadata. The frozen hosted
static preview is not rebuilt or published; this adapter addition affects only
the future combined source build.

Final transfer edge case: a template with duration 40 and explicitly cleared TSS
was incorrectly assigned with calculated TSS 33 by the old synthetic adapter.
`o1-null-transfer-before.log` reproduces that failure. Library assignment now
copies the saved prescription exactly, including explicit null duration,
distance, IF and TSS; directly planned workouts still derive their existing
totals. The extended synthetic browser case verifies a second assignment keeps
null TSS and the first assignment retains its previous zero. No native backend
owner file or API behavior changes in this follow-up.

Final native checks: **16/16** library browser cases, **442/442** production/auth
regressions and production build PASS. Shared-validator native/synthetic tests:
**28/28** (10 signed-library tests + 18 adapter tests). Built local synthetic O1
browser transfer: **2/2** at 1440/320, editing the seed template, refreshing,
assigning its revised prescription and viewing instructions as the athlete;
no API/provider network requests or browser errors. Full built synthetic suite
**23/23** PASS (including the 2 new O1 cases), retaining complete daily loops,
reset/isolation, F1-F5, copy/duplicate, missing data, accessibility and mobile
navigation. Static build PASS. Final
source-head CI and combined independent verdict are reported separately in
the PR description/transfer manifest, not inferred from previous heads.

`o1-source-boundary.json` verifies LF-normalized source identity with base
`fc6ad787`: the extracted pure normalizer, signed API handler body and complete
guarded Save-to-library click handler are unchanged. The earlier whole-editor
hash is historical because template mode intentionally expands that component.

Final independent combined QA must exercise assignment of an edited template
through PR #136's real planned-workout mapper and athlete view, plus full loop,
privacy and F8. This PR alone does not contain that backend owner's integration.
Local Chromium is not physical-phone/Safari acceptance. Existing two PR #135
migrations remain release prerequisites; O1 adds no migration or API/auth change.
No frozen preview rebuild, combined publication, merge or production deployment.

Log copies only normalize trailing whitespace/EOF. Intermediate failed assertions
in local `output/o1-browser*.log` exposed PostgreSQL numeric-string assertions;
the final test normalizes non-null numeric columns and preserves raw nulls. No
runtime workaround or schema change was made for those test-harness failures.
An intermediate pure-validator extraction briefly omitted the native identifier
error helper; the existing negative SQL regression caught it. It was restored
before final 28/28 and 442/442 checks; original intermediate local output remains.
