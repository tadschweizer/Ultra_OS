# UltraOS — Next Steps & UX Review

---

## Part 1: From Current State → Others Collecting Data

### Milestone 1: Security hardening (1–2 days) — DO THIS FIRST
Nothing goes to other users until this is done.

- Audit all Supabase RLS policies — every table must have `USING (auth.uid() = athlete_id)` for SELECT/INSERT/UPDATE/DELETE
- Remove any hardcoded `athlete_id` fallbacks from API routes — only trust the server-side session cookie
- Confirm `SUPABASE_SERVICE_ROLE_KEY` is never in client-side code
- Test that logging in as Athlete A cannot access Athlete B's data at all

### Milestone 2: Invite system (2–3 days)
- Create `invites` table (email + token + used_at)
- Build `/invite` admin page to generate invite links (protected behind `is_admin`)
- Build `/join` page: validates token → Strava OAuth → create account
- Add `is_admin` boolean column to `athletes` table, set your row to true

### Milestone 3: Admin dashboard (1–2 days)
- `/admin` page listing all athletes, last active, total log count
- Per-athlete read-only view (impersonate without modifying their data)
- Simple data health view: who's active, who hasn't logged in a week

### Milestone 4: Basic onboarding (1 day)
- After Strava connect, a 3-step onboarding: set target race → first intervention → view insights placeholder
- This dramatically improves first-session data quality

**Target: 2 weeks of work for a clean, safe first cohort launch**

---

## Part 2: Mobile App — How It Works Now

The PWA (Progressive Web App) is already set up and deployed. Here's what that means and what comes next.

### What users can do right now
On iPhone: open the app in Safari → tap the Share button → "Add to Home Screen" → UltraOS installs as a full-screen app with the amber icon. No App Store required.

On Android: Chrome will show an "Install" banner automatically, or use the browser menu → "Add to Home Screen."

This is a real app install. It opens full-screen, has a loading icon on the home screen, works offline for previously loaded pages, and gets app shortcuts (long-press the icon → Log Intervention / Dashboard).

### Path to App Store (when you're ready)

**Step 1 — Capacitor (wraps your existing web app in a native shell)**
Capacitor by Ionic takes your existing Next.js site and packages it for iOS/Android app stores. No rewriting, no new codebase.

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init UltraOS com.ultraos.app --web-dir=out
npx cap add ios
npx cap add android
```

The key limitation: the web app runs in a WebView, which is ~98% identical to the browser experience. For 99% of what UltraOS needs, this is fine.

**Step 2 — Apple Developer Account**
$99/year. Required to submit to the App Store. You create the account, I handle all the build and submission configuration.

**Step 3 — Build and submit**
I handle Xcode configuration, signing certificates, App Store Connect listing (screenshots, description, category). You just need to hit "Submit for Review."

**Timeline: 1 day of work + 1–3 days for Apple review**

### Native features you'd gain with Capacitor
- Push notifications (for weekly training summaries, streak reminders)
- Background sync (log an intervention offline, sync when back online)
- Haptic feedback on form submission
- Camera access (for race photos attached to outcomes)

---

## Part 3: UX/UI Review — Every Major Page

### Log Intervention (`/log-intervention`) — Fixed today
**Before:** Category grid (25+ pills) stayed visible after picking a type, pushing form fields below the fold. Users had to scroll past all the pills to fill in the actual data.

**After (deployed):** Picking a type collapses the grid to a compact chip ("🥢 Trekking Poles [Change] [★ Save]"). Form fields appear immediately below. This is likely a 30–50% reduction in time-to-submit.

**Remaining issues:**
- The Strava activity picker appears *after* the protocol fields, which is a logical mismatch — you should pick *what workout this is associated with* before filling in the protocol details. Recommended: move StravaActivityPicker above the protocol fields.
- The hero section (big "Log Intervention" heading + stat cards) takes up ~40% of the screen before you even see the form. On mobile this means scrolling before you can do anything. Consider a more compact header or hiding the hero when an intervention type is pre-selected via `?type=` param.
- Date field defaults to empty — it should default to today. Most interventions are logged same-day.
- "Training Phase" and race fields feel secondary to actually logging the intervention. Consider moving them into an expandable "Context" section that's collapsed by default.

---

### Dashboard (`/dashboard`)
**Good:** The tabbed layout (Overview / Insights / Research) is clean and appropriately scoped.

**Issues:**
- If an athlete has 0 interventions logged, the dashboard is mostly empty space with no strong prompt to log something. The empty state should be a single bold CTA: "Start by logging your first workout check-in →"
- The "recent interventions" list shows raw data without much visual hierarchy. Consider showing the icon, type name, and one key metric (e.g., "Legs 7/10") per row, not just the type name and date.
- HRV/sleep trend panels are present but likely empty for most new users. Hide panels that have no data instead of showing empty charts — empty charts feel like broken UI.

---

### Insights (`/insights`)
**Good:** The correlation engine output is genuinely valuable and well-presented. Dual-metric cards (legs + energy together) are a real UX win.

**Issues:**
- "MIN_GROUP_SIZE=3" means users need 3+ workout check-ins before any correlation appears. New users see nothing. Add an explicit progress bar: "3 more workout check-ins needed to see your first insight."
- The "keep logging" footer CTA is good but the copy is generic. Make it specific: "You have 1 correlation. Log 2 more check-ins to unlock your next insight."
- No way to filter by training phase or time range. An athlete preparing for a race wants to see correlations *just from race-prep blocks*, not from recovery weeks.
- Correlation cards don't show when the last contributing data point was. If your last check-in was 3 weeks ago, the correlation may be stale.

---

### Research Library (`/content`)
**Good:** 72 studies, all 19 topic filters populated, plain-English summaries.

**Issues:**
- No search. With 72+ entries, users can't find "does X study say anything about Y." Add a text search bar.
- The "ultra score / gravel score / triathlon score" system isn't explained anywhere on the page. New users don't know what a "9.2 ultra score" means.
- Studies open in place with no link to the actual PubMed entry. The `pubmed_url` field exists — add a small "View source →" link per study.
- Mobile: topic filter chips overflow into a horizontal scroll on small screens. Consider a dropdown selector on mobile.

---

### Race Plan (`/race-plan`)
**Untested — needs first-run review.**

**Likely issues:**
- Multi-section form can feel overwhelming. Consider a wizard (one section at a time) rather than a full-page form.
- No preview of what the final plan looks like before saving. Users want to see the output before committing.

---

### Race Outcome (`/race-outcome`)
**Good:** 23 fields captures everything meaningful.

**Issues:**
- All 23 fields on one page is too much. Group into sections: Race Details → Execution → Nutrition → Recovery → Reflection. Use accordions or tabs.
- "Overall rating (1–10)" appears before any context fields — you're asking for a judgment before they've reflected. Move this to the end.
- Consider pre-filling "race name" and "race date" from the linked race profile (if one exists) rather than asking them to re-type it.

---

### Pricing (`/pricing`)
**Good:** 5 tiers, real Stripe links, comparison table.

**Issues:**
- "Research Feed" at $7/mo is positioned as the entry tier but the value prop ("access to the research library") isn't compelling when the research library is arguably free to view. Make it clear what the upgrade actually unlocks.
- No free tier or trial is mentioned. Athletes need to try before they buy. Even a 14-day free trial of Individual would remove significant conversion friction.
- The comparison table has 9 rows — this is too many for most people to parse. Reduce to 4–5 most differentiated features.

---

### Landing Page (`/`)
**Good:** Correlation mockup widget, feature cards, comparison table vs TrainingPeaks.

**Issues:**
- The hero headline is functional but not emotionally resonant. "Performance intelligence for athletes who go long" doesn't answer "why should I care today." Something like "Finally understand what actually works in your training" tests better for this audience.
- The 12-pill protocol strip mid-page has no explanation of what these protocols mean to a first-time visitor.
- Social proof is missing entirely. Even a single quote from an early user (you) would help. "After 3 months of logging, I discovered that sauna sessions 12–24 hours before a long run increased my legs feel score by 1.4 points on average."
- The CTA buttons say "Get Started" but clicking through to sign up requires Strava — that friction isn't mentioned upfront. Warn people: "Sign up requires a free Strava account."

---

### Settings (`/settings`)
**Good:** Baseline zones (HR, pace) are critical data for the correlation engine.

**Issues:**
- The page is long and fields are in an undefined order. Group them: Identity → Training Zones → Race Context → Notifications.
- No confirmation on save — after clicking save, there's no visible indication anything happened unless there's a success message, which is easy to miss.
- "Danger zone" / delete account is missing. This needs to exist before you share with others (per GDPR/privacy expectations).

---

### Navigation (all pages)
- The `DashboardTabs` (Overview / Insights / etc.) and `NavMenu` overlap in purpose on some pages — the nav has links to pages that the tabs also cover. Consider whether both are needed or if one should be primary.
- On mobile, the bottom nav is good. But the tab bar + bottom nav + page-level header creates 3 navigation elements on some pages — that's one too many.
- "Guide" page is linked but rarely surfaced. Consider integrating inline tips (tooltip icons next to complex fields) rather than a separate guide page that few people will find.

---

## Priority Order for All Remaining Work

**Week 1 (before any external users):**
1. Security audit + RLS verification
2. Invite system (email → token → Strava → account)
3. Admin page with `is_admin` flag
4. Date field defaults to today on Log Intervention
5. Delete account in Settings

**Week 2 (first cohort launch):**
6. Empty state CTAs on Dashboard and Insights
7. Insights progress bar ("X more check-ins to unlock")
8. Research library search + PubMed links
9. Race Outcome — grouped sections, move rating to end
10. Move Strava picker above protocol fields on Log Intervention

**Week 3–4 (polish and App Store):**
11. Capacitor setup for App Store submission
12. Onboarding wizard (3 steps, post-Strava connect)
13. Push notifications (weekly summary, streak)
14. Landing page headline and social proof
15. Free trial / trial tier on pricing page
