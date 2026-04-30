# UltraOS → Multi-User Roadmap

The goal: let other athletes sign up, log in to their own account, and have their data be completely private to them — while you retain admin visibility to verify things look correct.

---

## What's already in place

- Supabase Row-Level Security (RLS) on all tables — every row is scoped to `athlete_id`
- Strava OAuth as the login mechanism — athletes already authorize via Strava and a record is created in the `athletes` table
- `athletes` table is the identity anchor for all data

The main gaps are: (1) no email/password fallback or invite-gated signup, (2) no admin role that can see across accounts, and (3) no user-facing account management.

---

## Task List

### Phase 1 — Lock down the current app (do this before sharing with anyone)

1. **Audit RLS policies across all tables**
   Check every table — `athletes`, `interventions`, `race_outcomes`, `research_library_entries`, etc. — and confirm all SELECT / INSERT / UPDATE / DELETE policies require `auth.uid()` to match the row's `athlete_id`. The research library is intentionally public (published=true), which is correct.

2. **Remove any hardcoded athlete_id fallbacks**
   Search the codebase for any place that falls back to a static UUID or accepts an `athlete_id` from a query param without validation. Every API route should derive `athlete_id` from the server-side session cookie, never from the client.

3. **Add Supabase `anon` key restrictions**
   In Supabase → API settings, confirm the `anon` key cannot call any function or access any table without a valid JWT. All sensitive tables should have `USING (auth.uid() = athlete_id)` — not `USING (true)`.

4. **Environment variable audit**
   Confirm `SUPABASE_SERVICE_ROLE_KEY` is only used in server-side API routes (never exposed to the browser), and `NEXT_PUBLIC_SUPABASE_ANON_KEY` is the only key in client-side code.

---

### Phase 2 — Invite-gated signup

This keeps the early cohort small and intentional while you're collecting data.

5. **Create an `invites` table in Supabase**
   ```sql
   CREATE TABLE invites (
     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
     email text UNIQUE NOT NULL,
     token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
     used_at timestamptz,
     created_at timestamptz DEFAULT now()
   );
   ```
   Only you (admin) can insert rows. RLS: no public read/write.

6. **Build `/invite` admin page** (protected behind an `is_admin` check)
   Simple form: enter an email → inserts a row in `invites` → sends the athlete an email with a magic link like `ultraos.app/join?token=xxx` using Resend or SendGrid (both have free tiers; Resend is simpler to set up).

7. **Build `/join` signup page**
   - Validates the token against the `invites` table
   - If valid, shows "Connect with Strava to create your account"
   - On Strava OAuth success, marks the invite `used_at` and creates the `athletes` row
   - If token is invalid or already used, shows an error

8. **Gate the main app on invite validation**
   In the onboarding flow, after Strava connect, check that the athlete's email (returned by Strava) matches a valid invite. If not, show a waitlist screen.

---

### Phase 3 — Admin dashboard

9. **Add `is_admin` flag to `athletes` table**
   ```sql
   ALTER TABLE athletes ADD COLUMN is_admin boolean NOT NULL DEFAULT false;
   ```
   Set your own row to `true` directly in Supabase. This column should NOT be writable via RLS by normal users.

10. **Create `/admin` page (server-side auth check)**
    Accessible only when `is_admin = true`. Show:
    - List of all athletes (name, Strava ID, joined date, last active)
    - Per-athlete: total interventions logged, total check-ins, last check-in date
    - Flag / suspend / remove an athlete
    - View an athlete's data in read-only mode (impersonate view)

11. **Admin impersonation / read-only view**
    Add a query param `?view_as=<athlete_id>` that, when you're logged in as admin, lets you see exactly what that athlete sees — without being able to modify their data. Useful for debugging and verifying data looks correct.

12. **Data health dashboard for admin**
    Show aggregate stats: how many athletes are active, average check-ins per week, which intervention types are most logged, any athletes with suspiciously missing data. This is what lets you verify "things look correct on their end."

---

### Phase 4 — Account management for athletes

13. **`/settings` page improvements**
    - Display name and email (currently from Strava)
    - Option to delete account (wipes all their rows via CASCADE, removes auth session)
    - Export their own data as JSON or CSV

14. **Session management**
    - Implement proper Supabase Auth session refresh (currently the app may rely on a long-lived cookie)
    - Add a "Sign out" button that clears the Supabase session and redirects to landing page
    - Protect all pages in `siteNavigation.protectedRoutes` with a server-side session check, not just client-side redirect

---

### Phase 5 — Coach role (already partially in DB)

The DB already has coach-related tables. When you're ready:

15. **Coach can see their assigned athletes' data**
    - RLS: a coach can SELECT rows from `interventions` / `race_outcomes` where the athlete is in their roster
    - Coach dashboard shows each athlete's recent check-ins, trends, upcoming races

16. **Coach cannot modify athlete data**
    - INSERT / UPDATE / DELETE remains athlete-only
    - Coach can add notes/comments on athlete sessions (separate `coach_notes` table)

---

## Recommended order

**Right now (before sharing):** Phase 1 (security audit) — non-negotiable.
**Before first external users:** Phase 2 (invite system) + Phase 3 tasks 9–10 (admin flag + basic admin page).
**Once you have 5+ athletes:** Phase 3 tasks 11–12 (impersonation + health dashboard).
**Ongoing:** Phase 4 (athlete self-service), Phase 5 (coach role).

---

## TrainingPeaks Migration + Parity Gate (New)

### Immediate build scope on Connections
1. Initial TrainingPeaks import flow:
   - athlete history ingestion
   - planned workouts/protocol mapping
2. Migration completeness screen:
   - explicit "transferred" vs "needs manual mapping" state
   - visible before imported data powers planning or coach reports

### Product parity matrix enforcement
Use the parity matrix in `README-PLATFORM.md` as a release gate across:
- planning
- execution tracking
- coach reporting
- athlete communication

Rule: prioritize all table-stakes parity gaps before advanced differentiation features.

---

## Key technical decisions

**Why keep Strava as the only auth method (for now)?**
Your target users are athletes — they all have Strava. It avoids building password reset flows, email verification, and the security surface that comes with storing credentials. The invite gate is the access control layer.

**Why not use Supabase Auth's built-in email/password?**
You can add it later as a fallback, but for an early cohort of athletes who you personally invite, Strava OAuth + invite token is simpler and more secure.

**Data isolation guarantee:**
With RLS enforced at the database level, even a bug in your API code cannot leak one athlete's data to another — the database will reject the query. This is the right architecture for health/performance data.
