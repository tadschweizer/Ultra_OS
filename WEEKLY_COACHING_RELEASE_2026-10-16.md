# Weekly coaching workflow release — October 16, 2026

Owner authorized deploying this workflow in the existing owner-account environment. Release branch `codex/weekly-coaching-release` is isolated from the dirty working checkout and based on production main `2930618`. Implementation: `1724314`. [PR #141](https://github.com/tadschweizer/Ultra_OS/pull/141).

## Database

Applied the reviewed additive migration through Supabase to project `jzfctjaaowdvubhqswpa`. Remote history recorded **20261017012725_weekly_coaching_workflow**, corresponding to local file `20261017003222_weekly_coaching_workflow.sql`. Do not replay either name. Existing security and owner-review migrations were not reapplied.

Live read-only catalog checks passed: both workout columns, three RLS tables with direct client access denied, four service-only invoker functions, and two enabled triggers. Review queue/count functions executed successfully against existing data. No synthetic production workouts, feedback, messages or participant records were created.

## Verification

- Current-main release: 482 existing regression tests and six new PostgreSQL workflow scenarios passed.
- Production build passed locally after installing dependencies inside the isolated release checkout. An initial dependency junction failed Turbopack workspace resolution; a normal install resolved it without application changes.
- All 10 new desktop/mobile workflow browser checks passed against that production build.
- Hosted production-target build is READY: `dpl_25p8bnJyUKtC5M7DNrm4JyoJx81t`.
- Staged calendar requires login, and unsigned review requests return a sign-in error.
- Full CI and main-domain promotion results are recorded below after completion.

Physical-phone, mailbox and real-participant acceptance remain separate. No time-saving claim is made. Provider status is unchanged: Strava/COROS/Suunto in progress, Garmin next.

## Recovery

If a release problem requires rollback, restore the previous application deployment `dpl_4fGYaDK4NmihKAt1bXxD5kQuDT7o` and retain additive database tables and retry receipts. Do not drop user history or replay migration history.

## Owner access check

Existing Google sign-in succeeded on `mythreshold.co`. Before promotion, the existing calendar access gate rejected this owner account: athlete tier is free, coach subscription is cancelled, and no pilot grant exists. The release does not bypass those rules. The owner was asked separately whether to enable the normal no-charge pilot approval. Signed-in planning/review acceptance is not claimed while that remains unresolved.

Supabase security advisor found only the expected RLS-without-policy INFO notices for the three new service-only tables; catalog checks confirmed clients have no direct privileges. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). Other existing warning-level findings do not involve this migration.

## Initial CI result and correction

[Initial CI](https://github.com/tadschweizer/Ultra_OS/actions/runs/38990891351) passed 488 regression tests, integration checks and build; browser stage passed 190 with three intentional skips and one failure in the existing copy-week retry fixture. Its trace proves the injected GET 503 occurred before the acknowledged POST 200, followed by a successful GET 200. The fixture armed its failure when the button became visible, while initial reload requests were still pending. The fixture now arms the failure only when the copy POST is acknowledged. Application code is unchanged by this correction. Corrected-run evidence follows below.
