# Fast-response pointer save repair

The parent requested porting only the library owner's fix from unpublished combined checkpoint `d13ec51f447a9872de5bae0659fba74fc9abc3fb` into existing draft PR #135. Starting head: `070624d8e1fd69d8d66a13488234fbf6956ec266`. The combined runtime, conflict resolutions, synthetic namespace change, other PRs and frozen hosted demo are not published or changed by this port.

## Exact runtime scope

The shared WorkoutEditor library-save handler now receives the pointer event and ignores `event.detail > 1` before preparing a new operation. A fast successful first save can release the asynchronous saving lock before click two; that second event still belongs to one double-click. Later deliberate single clicks and keyboard activation remain eligible for new operations. All F6/F7 load/retry/storage/receipt behavior remains intact.

The guard and its comments are copied exactly from the checkpoint. Complete WorkoutEditor source-region comparison, with CRLF normalized to LF, matches checkpoint SHA-256 **`23f10ab680e79c4917266ae006765fe5f622f6e400110aac99ee1be77ff78334`**. The three library helper files also match. [Comparison record](doubleclick-runtime-comparison.json). This matches the bounded library fix, not the entire combined TrainingCalendar: its account transport, copy and load integration remains separately owned/unpublished.

## Failed before and verification

On the old editor runtime, a real pointer double-click with a 200ms dispatch delay allowed its first signed SQL acknowledgement to finish. Desktop and mobile both failed the original one-write assertion with **two POSTs using different operation keys**. [Before output](doubleclick-before.txt). The server correctly considered them distinct operations; durable retry receipts alone cannot infer they came from one pointer sequence.

The checkpoint's standard `.dblclick()` regression is retained in the existing real metadata/save/reload/delete journey. A separate case deterministically completes the first actual signed SQL transaction before delivering only click two through native mouse down/up with clickCount2, verifies one row, then verifies later deliberate single-click and Enter saves create additional rows with fresh keys. It substitutes no fake library success. It runs desktop and 320px; the original metadata workflow runs desktop and 390px. F6 unavailable/cache/retry, F7 lost response and refresh, validation correction and uncertain-intent preservation remain in the same suite.

The extra race test initially used Locator.click({clickCount:2}), which emits an entire new two-click sequence rather than its second event. That incorrectly expected one row after a genuine additional first click. The installed runner's source confirmed this; native down/up now emits only the second event. The app guard did not change. No count/key assertions were removed. [Initial harness output](doubleclick-harness-initial.txt) remains available beside the corrected final output.

Final local checks and exact revised-head CI are recorded in the PR and final handoff. Commands from `webapp`: `npx playwright test e2e/workout-library.spec.mjs --workers=1`, `npm run build`; CI also runs `npm run test:auth:full`, integration checks and the complete critical browser suite. Use the documented Node22/isolated port3102 config locally. Before output has trailing whitespace normalized only.

[Final library browser run](doubleclick-final.txt): **12/12 PASS**, includes all prior F6/F7 cases plus native repeated-pointer and later intentional/keyboard saves. The normal production build result and exact-head CI remain separate from the parent's independent combined verdict.

[Normal production build](doubleclick-build.txt): **PASS**, no deployment. The only application-runtime delta in this port is the six-line shared-editor handler change; no helpers, APIs, schema or combined transport/copy/load logic were changed.

No API, migration, authentication, production data, remote schema, merge or manual deployment changes. The parent is independently testing exact combined checkpoint `d13ec51`; this port does not claim its acceptance result. Hosted PostgREST/concurrent connections and physical iPhone/Safari limits remain open.
