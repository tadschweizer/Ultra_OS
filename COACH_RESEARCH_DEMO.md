# Coach research demo

This branch contains a standalone, public research prototype in `coach-demo/`. It does not import the real app, bypass its authentication, or connect to its database. The six athletes and all training history and conversations are fictional. It represents coaching workflows for research, not verified availability of every illustrated feature in the live product.

**Public demo:** [Open Threshold coach research demo](https://threshold-coach-research.tadschweizer.chatgpt.site). Sites version 2 deployment succeeded on October 9, 2026, preserving public access. This URL opens without a Threshold account.

October 9 update: the demo follows the current product’s grouped navigation, amber mountain logo, cream sidebar, pill buttons, rounded cards, race countdown, and Coach Command Center structure. The fidelity reference is remote main `1830b14`, including `DesktopSidebar.js`, `siteNavigation.js`, `globals.css`, and the current coach page source. This remains a static demo with local sample data; it is not the real app with its authentication disabled.

## Use it with coaches

1. Send the public demo link supplied with this branch. Coaches open it in a normal browser; there is no account or password.
2. Ask them to explore as they normally would. The optional **How to explore** link gives starting points.
3. Ask them to open **Share your take**, describe their current tools, and say which areas they would actually use.
4. They click **Download feedback** and send the downloaded `threshold-coach-feedback.txt` file back to you by email or message. Answers are not sent automatically. The file is plain text; double-click it to read it.
5. **Reset demo** restores the original fictional workspace after confirmation. It also clears their local answers; download those first.

Suggested message to copy and paste, after inserting the public URL:

> I’m researching how coaches manage training and athlete communication. Here’s a short, clickable demo with fictional athletes: https://threshold-coach-research.tadschweizer.chatgpt.site. No login needed. Try a few things you would normally do, then use “Your feedback” to tell me what you use today, what you would use here, and what you would skip. You can download your answers and send the file back to me. Honest criticism is useful. This is an early prototype, not a live athlete account.

## A small first research round

Start with 4–8 coaches across the audiences you want to serve. Include beginner-focused coaches and experienced endurance coaches rather than relying only on friends or ultra specialists. Repeat a small round after changing the demo. The range and iterative approach follow the [GOV.UK guidance on planning user research](https://www.gov.uk/service-manual/user-research/plan-user-research-for-your-service).

For a 15–20 minute call, first ask which tools they use and about their last real plan change. Then present a realistic task without explaining the navigation: “Maya says Thursday no longer works. Show me how you would adjust her week and follow up.” Observe where they look, where they hesitate, and whether they can finish. Ask for their reasoning after the task. This combines an interview with prototype testing, as described in [GOV.UK’s interview guidance](https://www.gov.uk/service-manual/user-research/using-in-depth-interviews) and [moderated usability testing guidance](https://www.gov.uk/service-manual/user-research/using-moderated-usability-testing).

Record, per coach: current tool and job, task attempted, completed without help or with help, friction, feature they would use, feature they would skip, essential missing feature, and exact reason to move one task. Look for repeated needs. Page visits and clicks show exploration, not proof of demand or willingness to pay. The optional local usage export is a supplement to what they say and demonstrate.

## Working interactions

- Overview triage and reviewed state; roster search and group filter.
- Individual athlete history, sample check-ins, locally editable coach notes.
- Calendar athlete selection, week navigation, workout creation and editing, completion state.
- Workout comments; conversation threads and editable message starters.
- Reusable workout templates assigned to the calendar.
- Sample distance history and coach-assigned protocols.
- Athlete perspective with session completion reflected in the coach calendar.
- Autosaved feedback, feature-use ratings, optional local exploration counts, readable download.
- Browser Back/Forward and direct links such as `/#calendar` and `/#athlete/maya`.

The October 9 version adds Command Center Triage / Load Trends / Notes / Alerts, Basic / Advanced depth, protocol status and compliance targets, invitation previews, shared text documents, group membership and batch assignments, seven Coach Tools calculators, athlete readiness and sample import reports, Dashboard, Race Calendar / Blueprint, Daily Check-in, intervention logging/history, Progress, Explorer, Research saved-reading workflow, Connections, account and athlete settings, notification preferences, pricing reference, and support. Mobile has the product’s bottom navigation and a full Navigation menu.

These pages preserve the product’s workflows at demo depth. Calculator formulas are adapted from the current `webapp/pages/coach/tools.js`. Imports, study entries, service connections, invitation delivery, and account entitlements remain explicitly illustrative. The demo does not execute email, billing, device OAuth, live research search, or AI generation.

Sample distances, sleep, adherence percentages, and historical charts are seeded examples. They do not recalculate when editing a future workout. Connections are clearly labeled illustrations, with no device integration. There are no automatic athlete replies, email delivery, billing, AI generation, or real accounts.

## How data works

`app.js` stores demo changes under `threshold-coach-research-v1` in localStorage on the demo’s own origin. Each browser gets its own workspace. Changes persist on refresh when storage is available. Storage failures fall back to in-memory use and show a notice. No API requests or analytics leave the demo; feedback and local visit/action counts leave only if the coach downloads the file and sends it themselves. Hosting providers still operate their normal hosting infrastructure and request logs.

Use fictional details while trying the demo. A coach may optionally include contact details in the feedback file they choose to share. This design deliberately avoids requiring a separate feedback service or introducing credentials.

## Run it locally, step by step

You can also double-click `coach-demo/index.html` for a quick look. For consistent browser storage and testing, use the local server:

1. Open **PowerShell** from the Start menu.
2. Copy and paste the following commands, pressing Enter after each line:

```powershell
cd "C:\Users\BAS\Desktop\UltraOS\coach-research-demo"
node scripts/serve-coach-demo.mjs
```

3. Open your browser and go to `http://127.0.0.1:4173`.
4. Leave PowerShell running while exploring. Press **Ctrl+C** in that PowerShell window to stop the server.

The static demo has no dependency install or build step. The existing `webapp/` is unchanged.

## Update or host it elsewhere

The current public link is hosted by Sites. Future edits should reuse the project in `coach-demo/site-hosting.json` and the existing publishing checkout, then synchronize and package a new version with the Sites skill. Ask Codex to “update the existing coach research demo and republish it at the same URL”; no new Site registration is needed. The canonical editable copy remains on this GitHub branch. Copy only the six runtime files (`index.html`, `app.js`, `threshold.js`, `styles.css`, `threshold.css`, `favicon.svg`) into the publishing checkout’s `dist/` before source synchronization; do not copy secrets, repository metadata, or local participant data. Revalidate changed workflows before publication.

Edit `coach-demo/app.js` for the original daily-loop data and interactions; `threshold.js` contains the expanded product workflows and navigation. `styles.css` supplies the original base styles and `threshold.css` reconciles them to the current product. `index.html` supplies the outer layout. Only the runtime contents of `coach-demo/` need hosting. Hash-based navigation means there is no special server routing to configure. `vercel.json` adds security and no-index headers on Vercel. No-index discourages search indexing; it is not access control, and the public URL can be forwarded.

For a managed Vercel project later, select this branch and set the **Root Directory** to `coach-demo`, **Framework Preset** to **Other**, and leave build/install commands empty. Public access must be enabled on the separate demo project; do not change protection on the real application. You can attach a custom demo domain later without rebuilding the demo. Keep the published URL stable when running the same research round.

The branch is based on remote main at `a9d83c2`, isolating this research work from the pending workout-match work. There are no changes to live authentication, service configuration, or production data.
