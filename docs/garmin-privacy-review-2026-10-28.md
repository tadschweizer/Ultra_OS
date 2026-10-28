# Garmin privacy review — local draft, not launch approval

## Authorized release in progress

Tad explicitly authorized publication of the durable conditional policy and all stated Garmin commitments, followed by application and later implementation before Garmin activation. No further content approval is pending for this wording. The page date is October 28, 2026. Independent review found no blocking wording issue; its draft-label finding is corrected. Existing user/provider disclosure text is preserved. No Garmin feature is enabled by this release. Publication/deployment completion will be recorded separately after verification. Earlier approval-pending and draft-only notes below are historical.

## Latest revision: durable conditional policy

The current proposal supersedes the project-status wording below. See [complete proposed policy](privacy-policy-proposed.md) and [other-provider investigation](integration-privacy-extension-review.md). Tad selected publication-before-application, with Garmin disabled until every commitment is implemented and verified. Exact revised wording remains pending approval; no publication has occurred. The policy now uses one availability condition and normal data-use/deletion terms. No universal promise was added. Latest local validation: 41 tests passed; privacy/layout JSX compiled; whitespace checks passed.

## Follow-up: complete proposed policy and claim verification

This update supersedes the earlier limited-draft status below. The complete proposed policy is [privacy-policy-proposed.md](privacy-policy-proposed.md), generated from the revised page. It preserves the live notification paragraph, including Twilio, Resend, consent records and STOP, alongside the existing disclosures. It includes all five planned APIs, directions and intended uses, a privacy-rights contact section, and explicit current limitations. `TrustLayout` now accepts an optional date/status label; only this draft replaces the old effective-date footer with an explicit unpublished draft label. Other trust pages retain their existing default. No unknown controls are represented as working.

### Updated official evidence

Also found and read the [Garmin International developer agreement](https://developerportal.garmin.com/sites/default/files/Garmin%20Connect%20Developer%20Program%20Agreement.pdf), 14 pages, FRM-0952 Rev. B. Sections 4.5 and 15.4 address transfer notice/consent and data rights; 15.2 describes Garmin as an independent controller; 15.9 addresses international transfers/SCCs. It has no section 15.10. The separately hosted 19-page China version includes AI language. Both carry the same revision label despite different content. Neither proves the version offered to Threshold today. The browser showed only a login link and footer at the public NDA-acceptance URL; no terms, login or acceptance occurred. Do not infer confidential terms from third-party policy examples.

The official program overview was rechecked and still lists the five APIs for business access. Because the account-specific current agreement remains unavailable, this is alignment with publicly verifiable requirements, not a guaranteed compliance finding. Have qualified privacy counsel review the applicable agreement, launch policy and consent design before publication or Garmin activation.

### Tad's proposed claims: verified status and proposed commitments

| Claim | Finding | Implementation/review gate |
| --- | --- | --- |
| Garmin prohibits all external AI training, fine-tuning or operation on its data | Not established. The China PDF section 15.10 expressly addresses AI processing/training with transparency and consent; the International PDF has no such section. Do not describe a blanket prohibition as a verified Garmin requirement. | Enforce the confirmed exclusion of third-party AI/ML training, fine-tuning and operation, including inference; establish coverage for derived metrics, embeddings, vendor diagnostic AI and subprocessors. Current AI assistance is disabled; that is narrower than a verified organization-wide prohibition. |
| No sale, brokering or advertising | Both reviewed agreements' section 15.5 conditions sale on lawful consent; this is not an unconditional contractual no-sale rule. Source review found no identified Garmin sale/broker/advertising path, but source absence cannot verify all business practices. | The owner has approved the stricter business commitment; review recipient/vendor contracts, advertising/analytics SDKs, exports, aggregated/derived data and future commercial use. Do not conflate ordinary subscription fees with selling personal data. |
| Disconnect removes tokens and historical data | Not implemented for Garmin. Login/callback stop before token exchange; sync is a placeholder. Current generic account deletion/export is not a Garmin lifecycle. | The owner has required disconnect to delete historical Garmin data as well as tokens. Implement revocation, token destruction, sync stop and retry protection, derived/cache/file deletion, export coverage, backup expiry and handling of provider notifications. Verify with isolated lifecycle tests. |
| Map data to uses | High-level proposed mapping is in the policy: Activity → training review; Health → viewing wellness alongside training; Women's Health → prospective cycle/pregnancy information with coaching scope undecided; Courses/Training → sending selected routes/workouts/plans. | Approve exact field allowlists, minimum required fields, retention, recipient matrix and explicit optional sensitive-data choices. Merely selecting all five APIs does not authorize every field or every use. |

### Confirmed owner direction (supersedes alternatives)

Tad clarified that disconnect must delete stored Garmin tokens **and historical data**. He also expressly selected the no-third-party-AI/ML and no-sale/licensing/ad-network/broker/monetization commitments. The complete proposed policy now includes those exact intended commitments under a planned-integration heading and states that the controls are not available yet. These are Threshold design requirements, not represented as blanket Garmin terms. No additional choice between retaining and deleting history is needed.

Tad subsequently requested notification when the page is complete and deployed. Publication remains pending approval of the exact consequential wording and required release checks. No deployment has occurred. A pre-launch policy may accurately state future requirements while Garmin remains unavailable; it must not present those requirements as implemented controls.

The live URL was rechecked in-browser and still matches the preserved current sections, including the complete notification paragraph. No intervening policy changes were observed.

### Remaining decisions and release gates

1. Obtain the actual current account agreement and authorized API schemas; establish approved territories, ages and API permissions. Determine whether additional health/reproductive notices or consent are needed for those territories.
2. Approve exact input/output fields and purposes, especially Women's Health purpose, optionality and coach access. Keep reproductive fields out of generic coach access until separately designed and tested.
3. Enforce the owner-approved third-party-AI/ML and no-sale/licensing/advertising/broker/monetization commitments. Implement data lineage/allowlists and provider restrictions so raw data and derived metrics cannot reach unintended services. Confirm Sentry replay, error payloads, analytics and notification paths do not undermine the decision.
4. Implement the owner-selected deletion of tokens and historical Garmin data on disconnect; implement easy withdrawal, revocation, deletion, correction and complete export, including provider-side events and retries. Prove those controls with tests before describing them as available.
5. Confirm processor inventory, recipient roles, storage locations, cross-border safeguards, retention and deletion schedules for active records, backups, logs and files. Do not assert SCCs, DPF certification, encryption guarantees or vendor no-training contracts without evidence.
6. Before publication: review latest live source and any intervening user changes, approve an effective date and complete policy, obtain legal review, then seek separately authorized release. Future policy edits do not cure absent consent at the time data is collected.

### Follow-up validation

Re-ran the same four existing suites after the expanded draft: **23 passed, 0 failed**. Compiled both privacy page and TrustLayout with Next's Babel preset; checked the generated full text for preserved notification details, all five APIs, diagnostics and privacy rights; `git diff --check` passed (Git only noted normal LF/CRLF conversion). No production data or services were changed. No new remote PR, commit, push, merge or deployment. No browser visual test or production build was performed. Five files now comprise the local draft: privacy page, TrustLayout, roadmap, this review and the complete policy Markdown.

## Earlier review record (historical; follow-up above governs)

Reviewed October 28, 2026. No publication, deployment, agreement acceptance, production data access, push, or pull request creation was performed. User scope is local edits only.

## Outcome

The current privacy notice is not sufficient evidence that a five-API Garmin integration is ready. It describes current account/training practices reasonably specifically, but has no Garmin-specific transfer notice, reproductive-data explanation, or AI transparency section. The connector is unfinished. Updating prose cannot establish implemented consent, withdrawal, retention, or contractual compliance.

`webapp/pages/privacy.js` contains an additive proposed notice. It labels all five APIs as planned, identifies sensitive categories, links Garmin's privacy notice, and distinguishes deferred AI assistance from future plans. It deliberately does not claim live Garmin collection, approved access, implemented Garmin user controls, AI model-training restrictions, or verified retention periods. The exact proposed wording is in that file's `garmin-privacy` and `ai-privacy` sections. This is a limited pre-launch clarification, not a complete launch policy.

## Live policy and source baseline

- Read https://mythreshold.co/privacy in the browser on October 28. Title: Privacy — Threshold. It identifies Threshold LLC, a Utah limited liability company, and tad.s@mythreshold.co. It covers storage, uses, coach sharing, vendors, export exclusions, account deletion limits, and retained copies. Footer says October 1, 2026.
- The live page also includes **Optional email and text alerts**, naming Resend and Twilio, phone verification/consent/opt-out timestamps, delivery records, Notifications controls and STOP. That section is absent from local `origin/main`. Do not overwrite the live page with this older file: reconcile the latest source first and preserve that disclosure verbatim unless actual notification behavior changes. This patch only adds sections; it does not intentionally remove live disclosures.
- Isolated worktree: `C:\Users\BAS\Documents\Codex\2026-10-28\task-3\Ultra_OS`; branch `codex/garmin-privacy-review-main`; base `fbeb164c3794ce01a54d80c76aba26fdfe3202a1` (locally available origin/main). Remote freshness and the deployed commit were not verified. Original D-drive checkout has extensive unrelated changes, preserved untouched.
- Initial worktree branch `codex/garmin-privacy-review` remains at original HEAD `a8117d1`; no edits were made there before switching the clean worktree to the main-based branch. Failed fast-forward attempts did not merge anything.

## Official requirements and limits

[Garmin's current program overview](https://developer.garmin.com/gc-developer-program/overview/) lists Activity, Courses, Health, Training and Women's Health for business access. The current page has Starter/Enterprise tiers; do not rely on older reports that applications are paused.

[Published developer agreement, FRM-0952 Rev. B](https://www8.garmin.com/en-US/GARMINCONNECTDEVELOPERPROGRAMAGREEMENT/GARMINCONNECTDEVELOPERPROGRAMAGREEMENT_EN.pdf):

- Section 4.5: outgoing transfers require conspicuous data/purpose/method notice, Garmin privacy link, express consent, and a warning against prohibited uploads.
- Section 15.4: notice before collection, lawful processing, easy consent withdrawal, and applicable access/correction/deletion/export rights.
- Sections 15.7–15.8: compliance evidence and Garmin's authorized access mechanism; no collecting Garmin passwords.
- Section 15.10: AI processing or training needs a conspicuous explanation, explicit consent before processing, and easy withdrawal.
- Section 15.9/Annex A concerns China cross-border transfers.

**Applicability limitation:** This public PDF names Garmin China Shanghai RHQ and has a China-specific annex. It is a useful documented checklist, not proof of the agreement governing Threshold's Utah business. Obtain the actual agreement and portal requirements for the application before asserting compliance. The public portal page did not expose its terms to the web reader; no agreement was accepted.

[Garmin Connect privacy link](https://www.garmin.com/privacy/connect) opens Garmin's current privacy landing page, with a full-policy link. This explains Garmin's practices, not Threshold's obligations or vendor arrangements.

The older individual Activity/Health/Courses/Training/Women's Health API documentation URLs returned 404 in the web reader. A search-index excerpt of Garmin's Women's Health API describes menstrual-cycle and pregnancy tracking. Confirm current field schemas and transfer directions in authorized portal documentation before finalizing collection purposes. Do not copy an exhaustive health-field list from historical marketing into the policy.

## Repository evidence and gaps

| Area | Evidence | Consequence for proposed language |
| --- | --- | --- |
| Garmin access | `webapp/lib/connectorOAuth.js`: signed-in login returns 501; callback stops before token exchange. `integrationAvailability.js` enables only configured Strava. | No claim of live Garmin OAuth, token storage, background collection or usable disconnect control. |
| Garmin sync | `webapp/pages/api/garmin/sync.js` normalizes caller payload and echoes a cursor; explicitly a placeholder without provider fetch/persistence. | Not an implemented Garmin data pipeline; do not infer health ingestion or sync deletion from its name. |
| Permissions | `webapp/lib/connectors.js` has a default Garmin scope of `activity` and placeholder endpoints/configuration. | Selecting five APIs is an application request, not verified granted scopes or implemented access. |
| Export | `webapp/lib/accountExport.js` exports scoped tables and redacts credentials; excludes coach-private records/file contents. No Garmin-specific dataset exists in its list. | Current export description is limited; Garmin coverage needs a future implementation and tests. |
| Deletion | `webapp/pages/api/delete-account.js` authenticates, stops billing, removes records and attempts auth cleanup; files/backups are separate. | No promise that disconnect deletes imports or that all copies disappear immediately. No Garmin revocation lifecycle verified. |
| AI | `webapp/lib/releaseCapabilities.js` freezes automated assistance false; `tests/ai-deferral.test.mjs` verifies routes/direct entry points fail closed without provider traffic. | Describe deferred assistance, not a broad promise that every vendor never uses AI or trains models. No Garmin AI pipeline or consent controls verified. |
| Hosting and storage | Supabase authentication/database clients and Vercel configuration are present. | Names are source-supported; actual regions, transfer safeguards and retention schedules require operational confirmation. No secrets or environment files were read. |
| Notifications and diagnostics | `webapp/lib/email/transactional.js` sends through Resend; `webapp/sentry.client.config.js` configures tracing and session replay. Live notice additionally names Twilio. | Preserve existing disclosures. Verify exclusion/masking of future health/reproductive data and routes from telemetry, replay, email and SMS before launch. Vendor contracts/configuration were not inspected. |
| Coach access | Existing notice and coach relationship routes cover training and check-ins. | Do not silently extend coach visibility to reproductive information. Confirm a field-level sharing design before promising it. |

## Decisions required before a launch-ready rewrite

1. Which Garmin agreement/version and business access tier apply to Threshold? Which five API permissions have actually been approved?
2. For each API, exactly which fields will be read or sent, for what user-visible purpose? For Women's Health, is the purpose display only, coaching context, or something else? Which fields can coaches see, and under what separate choice?
3. What will the user see before import and before sending courses/workouts? Where is explicit authorization recorded? How can they revoke it, stop sync, remove previously imported data, and obtain/correct/export all Garmin records? How will provider-side revocation/deletion notifications be handled?
4. Will any Garmin information or derived metrics reach an AI provider? If yes, which provider, fields, purpose, inference versus training, retention, and opt-in/withdrawal implementation? If no, identify the enforced boundary, including diagnostics and service-provider processing.
5. Which vendors actually receive each sensitive category, in which countries/regions, with what contractual safeguards? Are mainland China users in scope? What are the approved operational retention/deletion periods for raw data, derived records, files, logs and backups?
6. Confirm intended age eligibility, support ownership, and any sale/advertising/research uses before adding categorical promises. Repository absence is not proof of organizational policy.

Until those facts and controls are settled, hold the final Garmin launch notice. Do not implement the missing controls as part of this copy-only task. Before any eventual publication, reconcile the live notification section, set an approved effective date (the shared layout currently retains October 1), review the precise copy, and obtain separate release authorization.

## Validation

- Existing tests: `node --test tests/integration-availability.test.mjs tests/ai-deferral.test.mjs tests/account-data.test.mjs tests/delete-account.test.mjs` from `webapp/`: **23 passed, 0 failed**. Tests use isolated/mocked data; no production records changed.
- Privacy JSX compiled successfully with the installed Next Babel preset. `git diff --check` passed.
- Changes remain uncommitted for local review in the three files shown by `git status`: the privacy page, this review, and the roadmap. No remote PR was opened because local-only scope excludes publishing a branch or PR.
- Reused installed dependencies with a local `webapp/node_modules` junction to the original checkout. No package files or environment configuration changed. Initial test attempt lacked dependencies; that environment issue was resolved before the passing run.
- Live policy and the newly added Garmin privacy destination both loaded in the browser. Garmin destination redirected to `/en-US/privacy/connect/` and exposed its full policy. Existing mailto target matches `supportContact.js`; no email sent.
- Official program overview and published agreement loaded in the web reader; five historical per-API documentation URLs failed with 404, as recorded above. Local shell DNS lookup of the live domain failed; browser access succeeded.
- No full production build, interactive local-page visual review, hosted CI, provider authorization, real data lifecycle, region verification or legal certification performed. These tests support implementation observations, not Garmin acceptance.

## Local PR description draft (not submitted)

**Title:** Clarify planned Garmin data scope in privacy notice

The privacy notice does not distinguish the requested five-API Garmin integration from currently available integrations. Add explicit planned/unavailable status, sensitive health/reproductive/location context, the Garmin privacy link, and the current AI deferral status. Keep current export/deletion limits and avoid unimplemented consent or retention promises.

Validation: 23 existing integration/AI/export/deletion tests pass; JSX compilation and whitespace checks pass; new external privacy link opens. Hold publication: reconcile the newer live notification disclosure and confirm the agreement, fields, sharing, AI, retention and controls listed in this review. This change is a pre-launch clarification, not Garmin integration approval.

## Independent review

A separate review agent found no blocking wording issue for presenting the unpublished draft. It verified preservation of all eight original policy sections, the live notification paragraph, all five planned APIs, future-only commitments, and unchanged default dates on other trust pages. It flagged stale deletion questions in the audit record; these were removed/replaced with the confirmed token-and-history deletion requirement. Release and enforcement gates remain open.
