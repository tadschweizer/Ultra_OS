# UltraOS - AI Context File (Platform / Technical)
Update this file every time a meaningful build or architecture decision is made.

## Current Build Phase
Phase 1 Platform - Intervention Intelligence MVP

## Phase 0 Stack (Months 1-6) - ~$80-150/month
- Database/log: Airtable Pro ($20/month) - intervention log schema, form view for subscriber entry
- Research digest: Substack (free) - builds email list simultaneously, doubles as SEO content
- Billing: Stripe payment link - $39/month "UltraOS Early Access" before any platform exists
- Subscriber access: Manual Notion/Airtable workspace sharing after payment confirmed
- AI tools: Claude Pro ($20/month) for all content, prompts, analysis
- Communication: Loom (free) for onboarding walkthroughs
- Project management: Notion free tier

## Phase 1 Target Stack (Months 6-14) - ~$300-600/month
- Frontend framework: Next.js (free, React-based, SEO-friendly, Vercel-native)
- Database + auth: Supabase Pro ($25/month - PostgreSQL + authentication + REST API)
- Hosting: Vercel Pro ($20/month - zero-config deployment, GitHub integration)
- Billing: Stripe + Stripe Billing (subscription management, trials, upgrades)
- Transactional email: Resend ($20/month, 50k emails)
- Product analytics: PostHog (free tier, up to 1M events/month)
- Dev task tracking: Linear (free for small teams)
- AI-assisted coding: Cursor Pro ($20/month)
- Developer: Part-time contract, 15 hrs/week, $40-60/hr via Upwork

## Phase 1 MVP Scope
1. Intervention Log: form-based entry, searchable/filterable table, calendar view, race tagging
2. Research Feed: in-platform delivery of monthly digest + email
3. User auth: Supabase auth, email/password + Google OAuth
4. Subscription billing: Stripe, monthly and annual plans, upgrade/downgrade
5. Basic dashboard: recent entries, upcoming race countdown, usage summary

OUT OF SCOPE FOR CURRENT MVP: Mobile app, coach dashboard, social features, population AI, full workout logging/calendar

## Phase 2 Additions (Months 14-24)
- Garmin Connect API integration (highest retention priority - build first)
- Strava API integration refinement and deeper activity detail pulls
- Race Architecture Builder (hero marketing feature - build second)
- Coach Dashboard: multi-athlete view, protocol assignment, compliance tracking (build third)
- Annual plan push system: in-app prompts + email nudge at Day 45
- Designer: contract 2-week sprint for Figma mockups of RAB and Coach Dashboard ($800-1,200)

## Phase 3 Additions (Months 24-36)
- AI pattern recognition engine: personal insights + population insights dashboard
- Anonymized data pipeline (consent, GDPR, minimum dataset thresholds)
- LLM approach: structured prompt engineering with Anthropic Claude API first, then evaluate RAG or fine-tuning at scale
- Analytics upgrade: PostHog expanded, cohort analysis
- Academic data export tools
- B2B API layer (for data licensing)
- Developer upgrade: senior full-stack with LLM integration experience

## Automation Stack
- Make.com ($9-29/month): Stripe to Airtable to Email automations (Phase 0-1)
- n8n self-hosted: evaluate for Phase 2+ (more powerful, more setup)
- Anthropic API (usage-based ~$5-20/month): AI features in platform Phase 3

## Key Architectural Decisions
DECISION: Intervention logging is the core system of record for product value - REASON: the business moat is the intervention dataset, not generic workout history - DATE: 2026-03-21
DECISION: Strava activity context is in scope before AI features - REASON: linked activity context improves intervention data quality and reduces logging friction - DATE: 2026-03-21
DECISION: AI insight blocks remain placeholder UI only until higher-quality intervention and race context data is captured - REASON: shipping analysis before the dataset is structured would create low-trust output - DATE: 2026-03-21
DECISION: TrainingPeaks migration must include a migration completeness surface (transferred vs manual mapping) before broad athlete onboarding - REASON: migration transparency is required for data trust and supportability - DATE: 2026-04-30
DECISION: Parity matrix gates roadmap priority; table-stakes parity ships before advanced differentiation features - REASON: execution quality on core coaching workflows is a prerequisite for retention - DATE: 2026-04-30

## TrainingPeaks Parity Matrix (Table-Stakes)
Legend: ✅ parity-ready · 🟡 partial/in progress · ❌ missing

| Domain | Capability | Status | Notes / Next Action |
|---|---|---|---|
| Planning | Athlete history ingestion | 🟡 | Initial import flow in connections; needs production API + job monitoring. |
| Planning | Planned workouts / protocol mapping | 🟡 | Core mapping pass exists; custom TP fields still need manual mapping support. |
| Planning | Migration completeness visibility | ✅ | UI exists to show transferred vs manual mapping requirements. |
| Execution Tracking | Session execution logging | ✅ | Intervention log supports per-session outcomes today. |
| Execution Tracking | Planned vs completed reconciliation | ❌ | Build daily/weekly reconciliation views tied to mapped workout IDs. |
| Coach Reporting | Multi-athlete import health | ❌ | Add coach/admin dashboard cards for migration completion by athlete. |
| Coach Reporting | Compliance and adherence rollups | 🟡 | Basic coach dashboard exists; adherence and completion exports not complete. |
| Athlete Communication | Import issue prompts | 🟡 | Migration completeness UI highlights manual mapping needs; add outbound notifications. |
| Athlete Communication | Coach-athlete follow-up workflows | ❌ | Add coach tasks/messages tied to missing mapping rows. |

Roadmap rule: any ❌ in this matrix is prioritized before advanced differentiation work (AI personalization, novel analytics, or premium visualizations).

## Current Developer / Contractor
[NAME, ROLE, HOURLY RATE, HOURS/WEEK, START DATE, CONTRACT TERMS]

## GitHub Repository
https://github.com/tadschweizer/Ultra_OS

## Staging / Production URLs
- Staging: not configured
- Production: https://ultra-os-tb77.vercel.app

## Known Technical Debt or Issues
- Race auto-lookup provider not chosen yet.
- Athlete settings model not implemented yet for baseline altitude, heart rate zones, and other personal defaults.
- Current Strava integration uses summary activity data only; average altitude and richer acclimation metrics require deeper activity/detail pulls.

## Website/Platform Builder
Builder choice is already made for the current product path: Next.js + Supabase + Vercel.
