# Coach Pilot Readiness — what has to be true before a coach opens the link

Reviewed 19 Aug 2026 · 37 pages / 15,291 lines · `next build` PASS · `npm run test:auth:full` 172/172 PASS

Threshold builds cleanly, ships a genuinely good marketing site, and passes all of its own tests.
The problems are not stability problems. They are that the coach's first hour — sign up, add an
athlete, see that athlete's data — currently breaks in four places, and the athlete's daily habit
that feeds the whole product has no front door.

| Tier | Count |
| --- | --- |
| Ship-stoppers | 7 |
| Breaks trust | 15 |
| Polish | 12 |
| Already strong | 6 |

---

## Tier 1 — the pilot cannot physically work today

Each of these ends the coach's session. They are not degradations; they are dead ends with no path
forward from inside the product.

### B-01 · The coach's athlete-invite link is dead on arrival

The Command Center builds invite URLs as `/join?coach_invite=<token>`. The `/join` page only ever
reads `router.query.token`, so it falls straight through to **"Invalid invite link."** Separately,
`/api/coach/accept-invitation` is fully written and correct — and is called by nothing in the
codebase. Every invite a coach sends is inert. Reproduced in a browser, not just in the source.

- **Fix:** have `/join` read `coach_invite`, require sign-in, then POST the token to the accept endpoint that already exists.
- Evidence: `coach-command-center.js:105` builds the URL · `join.js:14` reads only `token` · grep `accept-invitation` → 0 callers

### B-02 · "Send invite" does not send anything

The button is labelled **Send invite** and the toast says **"Invitation created."** It writes a
database row. Resend is wired for exactly six auth emails — verification, welcome, password reset,
password changed — and nothing else. No invitation email, no new-message email, no coach-note email.
A coach has to notice the link in a read-only text field, select it by hand (there is no copy
button), and paste it into their own email client.

- **Fix:** send the invite through the existing `lib/email/transactional.js` helper, and add a copy button as the fallback.
- Evidence: `api/coach/invitations.js:66-88` inserts only · `lib/email/transactional.js` imported by 6 auth routes, 0 coach routes

### B-03 · The Command Center is paywalled against the free tier you advertise

`hasCoachFeatures` requires `subscription_tier === 'coach'`. Anything else renders an upgrade wall
instead of the roster. Meanwhile the signup screen promises *"Explore the Coach Command Center
free"*, the landing CTA says *"Get early access — free"*, and the pricing page closes with
*"Free during beta. No card needed."* A coach follows your copy, signs up, and hits a $48–69/mo wall
on the one screen they came to see.

- **Fix:** add a `coach_trial` state (or a beta flag) that unlocks the Command Center, or set tier by hand via `/api/admin/set-tier` for each pilot coach and change the copy to match.
- Evidence: `lib/subscriptionTiers.js` `hasCoachFeatures` · `coach-command-center.js:816` · `signup.js:189`, `index.js:644`, `pricing.js` all promise free

### B-04 · Free athletes are rate-limited on the exact data the coach dashboard runs on

Free tier is capped at **3 check-ins per week** and **15 interventions total**. The pitch to coaches
is roster triage driven by daily check-ins. An athlete on the plan you tell coaches is free runs out
of check-ins by Wednesday and the Triage tab stops updating. The pricing FAQ says athletes "can log
interventions and check-ins your coaching depends on" — the comparison table two sections above it
marks both as unavailable on Free.

- **Fix:** uncap check-ins for athletes attached to an active coach relationship. Check-ins are the coach's product, not the athlete's upsell.
- Evidence: `subscriptionTiers.js` `FREE_WEEKLY_CHECKIN_LIMIT = 3`, `FREE_INTERVENTION_LIMIT = 15`

### B-05 · Choosing "I'm a coach" at signup never reaches the server

The role picker writes to `localStorage` and a query string. The signup POST body carries name,
email, password — no role. The onboarding save payload carries sports and race — no role. So the
account has no idea it belongs to a coach. `lib/auth/roleGuards.js` exists to answer that question
and is imported by zero files. The consequence is everything downstream: no role-aware nav, no
role-aware defaults, no way to tell a coach from an athlete after signup.

- **Fix:** persist the role on the athlete row at signup, then actually use `roleGuards` for nav and page gating.
- Evidence: `signup.js:104` · `onboarding.js:651` · `roleGuards.js` 0 importers

### B-06 · No privacy policy, no terms, no contact address

There is no legal page anywhere in the app and no support email in the footer. You are about to ask
professional coaches to upload their clients' health and training data. The first question a coach
with a real roster asks is where that data goes and who can see it. This is also a hard requirement
of the Strava API agreement and of GDPR/CCPA the moment a European or Californian athlete joins.

- **Fix:** a privacy page, a terms page, a `hello@` address in the footer, and a one-paragraph "who can see my data" note on the athlete's coach-link screen.
- Evidence: grep `privacy|terms` across `pages/` → 0 matches

### B-07 · Four "Connect" buttons return a raw JSON error naming your env vars

Garmin, COROS, Oura and Ultrahuman are all listed as **"Placeholder ready"** with live Connect
buttons. A signed-in user who clicks one gets a bare 503 JSON body listing `GARMIN_CLIENT_ID`,
`GARMIN_CLIENT_SECRET`, `GARMIN_REDIRECT_URI` — no page, no styling, no way back. Garmin is the most
common device among serious endurance athletes, so this is the button coaches press first.

- **Fix:** show unconfigured connectors as a disabled "Notify me" card. Never route a user to an unconfigured OAuth start.
- Evidence: `lib/connectorOAuth.js:29-39` · `connections.js:11-45`

---

## Both journeys, walked end to end

### Coach

| Step | State | What actually happens |
| --- | --- | --- |
| Land on the site | Good | Coach-first positioning, honest copy, strong product illustration. Only gap: "How it works" goes to a Guide with zero coach content. |
| Sign up as a coach | Rough | Role picker works visually, but the choice is thrown away before it reaches the server (B-05). |
| Coach onboarding | Good | Two steps, generates a coach code, offers a copy button. Genuinely tight. |
| Open Command Center | **Blocked** | Upgrade wall for anyone not already on the Coach tier (B-03). |
| Add first athlete | **Blocked** | Invitations buried under Advanced → Invitations; empty state points at an "Invitations tab" that doesn't exist; invite sends no email and the link 404s (B-01, B-02). |
| Athlete accepts | **Blocked** | No accept path wired to any UI. The coach-code route on `/account` works, but nothing tells the athlete it's there. |
| See athlete data | Rough | Solid content, but a read-only cul-de-sac: "Assign protocol / add note" bounces back to the Command Center with no athlete selected. |
| Assign a protocol | Rough | Works from the roster drawer. Group assignment is sold on the pricing page but `/coach/groups` has zero inbound links. |
| Message the athlete | Rough | Sends and stores correctly with unread badges. No email or push fires, so the athlete only sees it if they open the app. |
| Check the roster on a phone | **Blocked** | Mobile bottom nav is Home / Log / History / Research / Profile — athlete-only. No sidebar under 1024px. A coach on a phone cannot reach the Command Center at all. |

### Athlete

| Step | State | What actually happens |
| --- | --- | --- |
| Receive the invite | **Blocked** | No email arrives; a manually pasted link renders "Invalid invite link" — behind a full logged-in app sidebar, to a total stranger. |
| Sign up + connect coach | Rough | The coach-code onboarding step is well built. If skipped, onboarding says "from Settings" and the Command Center says "on the connections page" — the field is on neither. It lives on `/account`. |
| Connect Strava | Good | Real OAuth, clean screen, skippable. No "Powered by Strava" attribution anywhere. |
| Do a daily check-in | **Blocked** | The single most important habit has no front door. See U-01. |
| See their own value | Rough | Insights need several check-ins; the dashboard shows a hardcoded "Connections: 1" tile and a checklist whose step 2 points at a 617-line settings page. |
| Hear from their coach | Rough | Unread badges work well. Nothing reaches them outside the app, and the conversation header shows the athlete their own name. |

---

## Tier 2 — the deepest design problem

The entire coach value proposition — triage, trend changes, correlations, the review queue — is
computed from athlete check-ins. Everything in Tier 1 is a wiring problem fixable in a day. This one
is a product-shape problem, and it is why a pilot would go quiet in week two even with every blocker
fixed.

### U-01 · "Workout Check-in" is item one of twenty-five in a category grid

Check-in lives inside `/log-intervention` as one intervention type among heat acclimation, altitude,
bicarb loading, respiratory training and the rest. To do the 30-second thing the landing page
promises, an athlete taps **Log**, scrolls past a full-screen marketing hero, finds "Workout
Check-in" in a grid of pills, then fills six fields. There is no daily prompt, no dashboard nudge
when today is missing, no reminder, no streak. Nothing in the product asks them to do it.

- **Fix:** promote check-in to its own screen and its own bottom-nav slot. Four fields, today's date prefilled, one tap from the home screen. Add a "you haven't checked in today" card at the top of the dashboard.
- Evidence: `lib/interventionCatalog.js:10-29` · `MobileBottomNav.js`

### U-02 · The one fast path that exists produces unusable data

"Lightweight session" mode saves with `intervention_type: 'Workout Check-in'` but captures only
`session_type` and `session_load`. It drops `legs_feel`, `energy_feel` and `perceived_effort` — the
three numbers the correlation engine and the coach's triage queue are built on. The quickest way to
log a check-in creates a row that looks like a check-in, counts as a check-in, and tells the coach
nothing.

- **Fix:** make legs / energy / RPE the fast path; push session type and load into the optional section.
- Evidence: `log-intervention.js:507-516`

### U-03 · Two overlapping mode toggles in one box

The log screen offers **Intervention / Lightweight session** and, in the same panel, **Quick Log:
On / Off**. Both claim to hide optional fields. Nothing explains how they interact, and one silently
changes what gets saved. (`log-intervention.js:590-600`)

### U-04 · Navigation is one flat list shown to everybody

The sidebar renders all 18 links to every account. A self-coached athlete sees **Coach Command
Center** and **Coach Tools** and can click into a paywall for a product they'll never buy. A coach
wades past Log Intervention, Intervention History, Progress and Explorer to reach the one screen
they use daily. On mobile the coach gets no coach navigation at all.

- **Fix:** two nav sets driven by the role persisted in B-05, plus a coach bottom nav: Roster / Messages / Calendar / Profile.
- Evidence: `lib/siteNavigation.js` single `sidebarSections` array · `MobileBottomNav.js` hardcoded athlete tabs

---

## Tier 2 — the product tells people to go to places that don't exist

| ID | Finding | Evidence |
| --- | --- | --- |
| R-01 | "Send invitations in the **Invitations tab**" — there is no Invitations tab. Tabs are Triage / Load Trends / Notes / Alerts. Invitations sit behind a "Screen depth: Advanced" toggle, then an "Advanced workspace" chip row. This is the first thing a brand-new coach sees. | `coach-command-center.js:989` |
| R-02 | "Open an athlete from the **Roster tab**" — there is no Roster tab either. | `coach-command-center.js:1245` |
| R-03 | Onboarding says connect a coach "from Settings"; the Command Center says "on the connections page." The coach-code field is on **neither** — it's on `/account`. | `onboarding.js:393`, `coach-command-center.js:1307`, field at `account.js:224` |
| R-04 | `/coach/groups` has zero inbound links from any page, nav or menu — yet group protocol assignment is a bullet on the Coach pricing card. | grep → 0 references |
| R-05 | Athlete detail is a dead end: "Assign protocol / add note" is a plain link back to `/coach-command-center` with no athlete context. | `coach/athletes/[athleteId].js:89` |
| R-06 | The Guide has no coach content at all — six athlete sections. "How it works" in the landing nav sends coaches here. Its "Add a target race" button points at `/log-intervention`. | `guide.js:5-40` |
| R-07 | Logged-out visitors on `/join` get the full internal sidebar — Dashboard, Coach Command Center, everything — before they have an account. | `lib/siteNavigation.js:48` omits `/join` and `/invite` |
| R-08 | Athletes see their own name where their coach's should be: `conversationName()` returns the athlete name for both roles. | `messages.js:36-40` |
| R-09 | Onboarding's Continue button silently does nothing on incomplete forms — early return, no message, no field highlighting. | `onboarding.js:669-684` |

---

## Tier 2 — screens that show things that aren't true

Coaches are professional skeptics about data. One number they can prove is invented costs you the
rest of the dashboard.

| ID | Finding | Evidence |
| --- | --- | --- |
| F-01 | The dashboard "Connections" tile is a literal `1` in the JSX. It says 1 whether or not anything is connected. | `dashboard.js:1155` |
| F-02 | The Connections page tells every user *"Historical workouts and key metadata imported from TrainingPeaks"* from a hardcoded array, regardless of whether an import ever ran. The real import-health component exists and is used correctly on the coach's athlete detail page. | `connections.js:123-135` |
| F-03 | Oura and Ultrahuman each appear twice in the same grid — once "Placeholder ready" with a live Connect button, once "Coming soon" disabled. | `connections.js:5-77` |
| F-04 | The pricing page contradicts itself three ways about the free tier: the comparison table says no logging and no check-ins, the FAQ says both are included, the code allows 15 and 3/week. | `pricing.js` vs `subscriptionTiers.js` |
| F-05 | Seven notification toggles save correctly and are read by nothing. No email or push is ever sent for any of the seven events. | `api/notifications.js:10-18` |

---

## Tier 3 — visual and craft

The landing and pricing pages are genuinely well designed. Inside the app, the same design language
is applied at marketing scale to working screens, and the design system that exists is mostly
bypassed.

- **V-01 — Every internal page opens with a 72px marketing hero.** Nineteen app pages use
  `text-5xl md:text-7xl`. "Notification preferences" is set at 72 points above the fold; so are
  "Athlete Settings", "Explorer", "Guide", "Manage your account". This pushes the actual working
  content of every screen below the fold. **Single highest-leverage visual change.** Cap in-app page
  titles around 28–32px; keep 72px for the marketing pages where it earns its space.
- **V-02 — The design system exists and is used eight times.** `globals.css` defines `ui-card`,
  `ui-hero`, `ui-eyebrow`, `ui-button-primary` and a token set. `ui-card` is used **8** times;
  `border-ink/10 bg-white` is hand-rolled **284** times. Corner radii have drifted to **16 distinct
  values** (30px ×79, 24px ×58, 28px ×54, 22px ×42, down to 4px). Pick three radii and convert the
  top-traffic screens.
- **V-03 — Five layers of navigation on the coach page:** fixed sidebar, page-level pill bar with
  hamburger, DashboardTabs row, a four-item tab bar, and a "Screen depth: basic/advanced" switch —
  before any roster content. The floating message bubble is pinned at `top-4 right-5`, directly over
  the pill bar's menu button on desktop.
- **V-04 — No link preview when you text or email the URL.** `og:image` points at `/og-image.svg`;
  iMessage, LinkedIn, Slack and most email clients don't render SVG OG images. Export a 1200×630 PNG
  before sending anyone the link.
- **V-05 — Naming is inconsistent.** Repo `Ultra_OS`, package `threshold`, UI "Threshold", planning
  docs "UltraOS", localStorage key `ultraos-favorite-intervention-types`. The PWA manifest still
  carries the old athlete positioning while the site sells coaching intelligence.
- **V-06 — No Strava attribution anywhere.** Their API agreement requires the "Powered by Strava"
  mark on any view displaying their data plus "View on Strava" links. Neither string appears in the
  codebase. Compliance risk against the API key half the product depends on.

---

## Already better than it needs to be

- **The landing page.** Coach-first, specific, honest about limits.
- **Auth and security.** Signed session cookies, HMAC-verified impersonation blocked at middleware, service-role isolation, password reset, sign-out-everywhere.
- **Test coverage.** 172 tests across auth, billing, protocols, compliance, insights, comments, reconciliation. Clean build.
- **The message center.** Polling, per-conversation unread counts, activity-backed threads, badge rollups. Best-built component in the app.
- **Coach onboarding.** Two steps, code generated automatically, copy button, clear next action.
- **The demo seeder.** `lib/adminDemo.js` already builds a coach/athlete pair with weeks of realistic check-ins — the best pilot asset you have, surfaced nowhere.

---

## Recommended sequence

### Block 1 — make the pilot physically possible

1. Fix the invite link end to end: `/join` reads `coach_invite` → sign-in → `accept-invitation` (B-01)
2. Actually email the invitation, add a copy button next to the link (B-02)
3. Unlock the Command Center for pilot coaches — beta flag, or set tiers by hand and fix the copy (B-03)
4. Uncap check-ins for athletes attached to a coach (B-04)
5. Turn off the four unconfigured connector buttons (B-07)
6. Move invitations out of "Advanced" and fix the two phantom-tab instructions (R-01, R-02)

### Block 2 — make it survive contact

7. Give check-in its own screen and bottom-nav slot; add a "no check-in today" dashboard card (U-01, U-02)
8. Persist the signup role and split the nav, including a coach bottom nav on mobile (B-05, U-04)
9. Publish privacy policy, terms, support address (B-06)
10. One canonical place to link a coach; point every reference at it (R-03)
11. Delete or wire up the hardcoded tiles and the fake TrainingPeaks migration block (F-01, F-02, F-03)
12. Make the pricing page agree with itself and with the code (F-04)
13. Link `/coach/groups`; let athlete detail assign in place (R-04, R-05)

### Block 3 — make it feel finished

14. Cap in-app hero type at ~30px across all nineteen pages (V-01)
15. Converge on three corner radii; move top screens onto `ui-card` (V-02)
16. Strip a nav layer off the coach page; move the message bubble off the menu button (V-03)
17. Ship a PNG OG image (V-04)
18. Add Strava attribution and "View on Strava" links (V-06)
19. Write a coach section into the Guide; point "How it works" at it (R-06)
20. Send an email or push for new messages, or the loop never closes (F-05)

---

## Before any of this

Seed the demo coach and demo athlete from `lib/adminDemo.js` into a real account and walk it yourself
on a phone. Every blocker in Tier 1 was findable inside ten minutes of following the product's own
instructions — which means nobody has yet done the thing you are about to ask two coaches to do.

Then send it to **one** coach, not two. Watch that first session over their shoulder or on a call.
The second coach is far more valuable after you've seen where the first one hesitates.
