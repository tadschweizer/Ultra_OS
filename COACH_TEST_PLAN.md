# Coach Manual Test Plan (Beginner-Friendly)

This plan walks through the core coach workflow from account creation to athlete monitoring.

## Before You Start
1. Open the app in a browser.
2. Prepare two test accounts:
   - Coach account email.
   - Athlete account email (different email).
3. Keep both accounts logged in in separate browsers/profiles (or one normal window + one incognito window).

---

## 1) Coach Signup / Login
1. Go to `/signup`.
2. Create a new coach account.
3. Confirm you are redirected into the app.
4. Log out.
5. Go to `/login` and sign back in.

**Expected result**
- Signup succeeds.
- Login succeeds.
- Coach can access coach screens after login.

---

## 2) Coach Profile
1. Go to the coach profile/settings screen.
2. Add or update profile fields (name, coaching context, specialties if available).
3. Save changes.
4. Refresh the page.

**Expected result**
- Save confirmation appears.
- Updated fields persist after refresh.

---

## 3) Invite Athlete
1. Open coach command center.
2. Use the invite athlete action.
3. Copy invite link/token.

**Expected result**
- Invite creation succeeds.
- Invite appears in coach list/history (if shown).

---

## 4) Athlete Accepts Invite
1. In athlete browser/account, open invite link.
2. Accept invitation.
3. Return to coach account and refresh roster.

**Expected result**
- Athlete appears in coach roster.
- Relationship status is active/connected.

---

## 5) Assign Protocol
1. Open athlete detail from coach roster.
2. Assign a protocol (name, dates, type, compliance target).
3. Save.

**Expected result**
- Protocol appears in athlete’s current protocol list.
- No error message shown.

---

## 6) Create Protocol Template
1. Go to coach templates screen.
2. Create a new protocol template.
3. Add realistic structure (type, duration, notes).
4. Save template.

**Expected result**
- Template is listed after save.
- Template can be selected for assignment.

---

## 7) Assign Template
1. From athlete detail or groups screen, choose the saved template.
2. Assign start and end dates.
3. Confirm assignment.

**Expected result**
- Template assignment appears as active protocol(s).
- Athlete is linked to assigned template output.

---

## 8) Add Coach Note
1. Open athlete detail.
2. Add a coach note (observation or reminder).
3. Save note.

**Expected result**
- Note appears in notes list with timestamp.
- If share toggle exists, visibility status is accurate.

---

## 9) Send Message
1. Open coach messaging screen.
2. Send a message to athlete.
3. Open athlete account and verify receipt.

**Expected result**
- Message sends without error.
- Athlete can read message.

---

## 10) View Athlete Detail
1. Open `/coach/athletes/[athleteId]` via roster.
2. Confirm detail sections load:
   - Upcoming race context
   - Current protocols
   - Compliance summary
   - Recent signals/check-ins

**Expected result**
- All sections render with clear empty-state text when data is missing.
- No crash if one section has no data.

---

## 11) View Race Readiness or Weekly Report
1. On athlete detail (or dedicated readiness route), open race readiness report.
2. Validate the report includes:
   - Days until race
   - Current protocols
   - Protocol compliance
   - Heat/gut/fueling/sleep/recovery readiness (if data exists)
   - Recent workout/check-in signals
   - Red/yellow/green status
   - Suggested next action
   - Missing data needed for confidence
   - Confidence label (low/medium/high)

**Expected result**
- Report language is careful and non-medical.
- Confidence label changes logically with available data.
- Suggested next action is practical and coach-friendly.

---

## Suggested Coach Pages to Open and Test After UX Polish
1. `/coach-command-center`
2. `/coach/athletes/[athleteId]`
3. `/coach/groups`
4. `/messages`
5. `/pricing` (coach positioning copy)
6. `/` (homepage coach section)
