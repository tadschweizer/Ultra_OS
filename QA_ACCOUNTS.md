# Dedicated QA coach and athlete

The owner explicitly approved a clearly labeled production QA pair on October 1, 2026.
This is a narrow exception to the no-synthetic-production rule in `PILOT_ACCESS_RUNBOOK.md`.
Only these accounts may receive test check-ins, relationship changes, workouts, and messages.
Other users, billing, research administration, and production schema/configuration changes
remain outside this authorization.

The pair is named `TEST ONLY - Codex QA coach` and `TEST ONLY - Codex QA athlete`.
Both are free, non-admin accounts flagged `is_demo`. The coach has a separate pilot grant
expiring October 31, 2026. There are no Stripe subscriptions or payments. The `.test` email
addresses cannot receive email, so this pair cannot validate real invitation-email delivery.
These accounts were manually provisioned with confirmed email; they do not establish signup
or email-verification acceptance. Existing admin demo reset/delete actions target `is_demo`
records and could remove this pair; do not use those actions to renew QA access.

Credentials and provisioning recovery information live only in the ignored file
`webapp/.qa-private/accounts.json`. Do not commit, print, screenshot, or attach that file
or browser authentication state. Subsequent agents can read it locally without asking the
owner to log in. Losing this file requires account recovery; do not silently recreate or
delete an existing pair. Renew pilot access only when separately authorized.

## Open both accounts automatically

Open PowerShell, paste these two lines, and press Enter:

```powershell
Set-Location 'C:\Users\BAS\Desktop\UltraOS\Ultra_OS\webapp'
.\scripts\qa-browser.ps1
```

The script uses Node 22 and Playwright CLI, signs in with the normal email/password form,
and verifies each account ID and server role. Each account has its own browser session.
The browsers remain available to the agent for further checks. For 390 px mobile layouts:

```powershell
.\scripts\qa-browser.ps1 -Mobile
```

To open only one role, use `-Role coach` or `-Role athlete`. If PowerShell blocks the script,
run it with a policy override scoped to that one process:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\qa-browser.ps1 -Mobile
```

## Evidence from October 1

- Real production UI logins routed coach to Command Center and athlete to Dashboard.
- Athlete entered the QA coach code in Account Settings; coach approved the request in
  Command Center. Read-only database verification confirmed their active relationship.
- Athlete submitted the dedicated daily check-in with legs 7, energy 8, RPE 4, and a
  `TEST ONLY` note. The UI reported success; a subsequent `/api/me` read returned
  `lastCheckInDate: 2026-10-01`.
- This is automated QA activity, not the returning-human 30-second acceptance criterion.
- Messaging is blocked: `/api/coach/messages?mode=coach` returns 500 because production
  lacks `public.coach_messages`. No test message was sent.
- Athlete Dashboard also returns 500 from `/api/athlete/shared-docs` because
  `public.coach_shared_docs` is missing, and from `/api/current-protocol-assignment`
  because its query references nonexistent `athletes.target_race`.

Investigate migration/schema history before preparing a narrowly scoped repair. Do not run
a broad migration push. The production schema was not changed during these checks.
