# P0-017: pilot assistance deferral and product claims

Date: 2026-10-08. Branch: `feature/p0-017-ai-deferral`, stacked on P0-015 PR #131 at `46c5492`. Implementation: [draft PR #132](https://github.com/tadschweizer/Ultra_OS/pull/132), code `6af6629`. This checkpoint covers code and isolated verification, not a production release.

## Release policy

`webapp/lib/releaseCapabilities.js` defines one immutable, disabled `automatedAssistance` capability. Server endpoints and direct library entry points enforce it. Account roles, subscription tiers, client payloads and environment variables cannot enable it. A future release must deliberately change this policy and supply acceptance evidence.

Authenticated requests to all deferred endpoints return HTTP 403 with `FEATURE_DEFERRED` and `Cache-Control: private, no-store`. Existing anonymous and method boundaries remain 401/405. The guard executes before provider initialization, input processing or automatic draft construction.

## Source inventory and disposition

| Surface | Actual implementation | Pilot disposition |
| --- | --- | --- |
| `/api/exa/race-search`, `/api/exa/race-enrich` | External Exa web search and metadata parsing; not an LLM training planner | Server blocked; race search uses saved catalog only, with editable manual entry |
| `/api/exa/training-content`, `/api/exa/news-feed` | External Exa retrieval | Server blocked; direct Exa library calls also fail closed |
| `/api/research-library/draft` and `buildResearchDraft` | Template generated from title/tags, without reading a paper | Server and library blocked; Generate Draft removed; existing records and human editor retained |
| Research PubMed search and admin editor | User requested metadata lookup and human authored content | Retained, including existing canonical administrator authorization |
| `/race-plan` | Local rule based fueling, supplement and timeline recommendations | Direct URL shows deferral notice; builder never mounts; navigation and calendar launch buttons removed |
| Insights intervention recommendations | Local rules suggesting heat/gut/bicarbonate changes and race readiness | Capability disabled; recommendation cards and decision badges absent |
| Dashboard labels and race score | Deterministic calculations; old race score was a log-count heuristic | AI labels removed; race panel shows actual record count; data coverage explicitly described as a heuristic |
| Workout totals, HR zones, CTL/ATL/TSB, load spike, drift, correlations, classifications, descriptive averages | Formulas, rules and logged data | Retained, with clearer limits; no automatic training plan or causal inference claimed |
| Coach tools | Manual input calculators, including pace and race-time formula projections | Retained as deterministic tools, not AI generation |
| Landing, pricing, guide, invitation, settings, race outcome | Marketing/instructional copy | Manual pilot loop described; overlay positioning, generated plan benefits, speculative research counts and causal claims removed |
| `lib/insightSystemContent.js`, historical AI roadmap | Unused prototype/reference material | Preserved as historical material, not an active pilot route |
| Repository schedules | Auth Smoke CI; connector scheduler placeholder; activity refresh and message delivery work | No AI schedule found. Legitimate imports/message work retained. Exa library guard covers a future direct scheduled caller |

No OpenAI/Anthropic model call was found in the active application. Deferral includes local automated recommendations and speculative templates, not just model requests. The inventory was checked across pages, components, libraries, API routes, workflows and Wrangler configuration. Hosted cron configuration was not changed or inspected in this checkpoint.

Reserved subscription feature identifiers remain for compatibility. No tier grants `ai_analysis` or `coach_ai`; the retained `race_blueprint` identifier cannot bypass the release policy. This change does not alter subscription pricing, entitlement persistence or saved data.

## Verification

- Node 22 full regression: **418/418 passed**, including three new actual-handler/provider guard tests and the existing deterministic calculation, auth, billing and SQL suites.
- Integration suite: **4/4 passed**.
- Next.js production build: **passed**.
- Focused browser checks: **12/12 passed**, six journeys on desktop Chromium and mobile Chromium (390 × 844).
- Expanded critical browser suite: **127 passed / 3 existing viewport skips**, 130 journeys total.
- Landing page Axe scan: **zero violations** on both viewports; contrast findings discovered during implementation were fixed.
- `git diff --check`: passed.

The new browser checks cover manual race entry after an empty catalog, failed save preserving fields, successful retry and reload; keyboard catalog selection and corrections; direct deferred planner retaining saved local storage; editing an existing human research summary; paid pilot dashboard/insights/guide request monitoring; and public scope/pricing claims. All these journeys observe **zero** requests to Exa endpoints or research draft generation.

Server tests call the actual API handlers with signed session cookies and attempt role/tier/payload/environment overrides. Direct Exa functions reject before any network call, and research draft construction rejects before generating a summary. Browser API responses are isolated fixtures; the unchanged manual persistence APIs and deterministic calculation logic remain covered by their existing regression suites. No synthetic production records or real provider requests are used.

## Release and remaining work

Review and merge PR #131 first, then retarget this stacked PR to main and verify the resulting head. P0-015's documented migration and delivery-worker prerequisites still apply to the combined release. P0-017 adds no database migration or service configuration. A controlled release must check the deployed guard, absence of deferred requests and preservation of existing participant data before P0-017's parent checkbox is closed.

Next roadmap item is P0-018: the expanded build/regression/critical journeys already run in CI, but required-check configuration, measured task times, two-week real coach/athlete observation and TrainingPeaks task comparisons remain open. P0-014/015/016 release and physical-phone acceptance and the earlier M0 external gates remain open. See the roadmap and P0-015 verification document for the complete remaining P0 list.
