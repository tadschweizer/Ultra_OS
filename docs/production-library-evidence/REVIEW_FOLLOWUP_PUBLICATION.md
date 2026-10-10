# PR135 messaging recovery follow-up

The parent authorized incorporating the reproduced PR137 follow-up into existing PR135, on top of prepared combined commit `d8c18818481a0231326353c921a9a981eaccce41`. Runtime/tests payload `042a949` was cherry-picked as `b147761`; script/evidence follow-up is `bdaf70a`. The merged PR137 branch was not amended and no new PR was created.

Against independent accepted combined QA `b10c309cf1a73563847658da0ffb7f3ad03ebac4`, the only application runtime changes are:

- `webapp/components/MessageWorkspace.js`: keep a retry selection only when an athlete is selected.
- `webapp/pages/messages.js`: normalize empty selection for explicit/background recovery; handle a rejected read-status POST through the existing read-status warning/retry rather than the inbox GET failure path.

Together these are seven inserted/two removed source lines including comments. Library prescriptions, calendar/copy scopes, signed handlers, private visibility/load behavior, API routes, migrations, authentication/RLS and dependency lockfiles match the accepted runtime. The accepted QA checkout's extra coach-demo local Playwright config is a test-only difference, not app behavior.

The two findings were proven on unchanged fresh main `5554087`: eight fault cases yielded four failures/four passes. Measured snapshots show empty desktop history, empty-athlete calendar link and disabled Send after recovery; rejected read acknowledgement falsely marked loaded messages stale on desktop/mobile. HTTP 503 read errors and mobile list/unread behavior already passed. After correction, 432 regressions, build and all 58 messaging/daily-loop browser cases passed. Original evidence remains on local review branch `a517b0e`; concise logs/observations are copied under messaging-review-followup/ here.

The test-script union is preserved. test:auth:full retains library, workspace-transport and calendar-gap suites. test:e2e:critical retains library, daily-loop and message-workspace suites and now includes message-review-faults.spec.mjs; test:e2e:messages also includes it. PR136's additional isolated calendar SQL-fixture CI step remains. No stale main-based package/workflow file was copied over this branch.

Fresh exact-head CI is required after the ordinary PR135 push; prior 99e9e94 CI does not validate this new head. Independent QA will retest changed recovery on the published head. Existing combined pre-follow-up acceptance is recorded separately (457 regressions, 60 native browser cases, 18 demo units and 28 demo browser cases). The source delta and its fault-specific tests are explicit; do not call the modified runtime byte-for-byte equal to b10c309.

Merge remains blocked until explicit approval/application/catalog verification of the four production schema sources. No production schema/application, participant messages, provider, secrets, email/billing, main merge or deployment was performed for this follow-up. Ordinary Git branch publication may trigger an automatic preview; it does not authorize production schema or a main merge.
