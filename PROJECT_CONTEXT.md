# Threshold Project Context

This file replaces the older business, content, and platform context files.

## Product

Threshold is a performance intelligence platform for endurance athletes.

It is not meant to be a generic training log. The core idea is to track and learn from interventions such as:

- heat acclimation
- gut training
- sodium bicarbonate
- sleep changes
- altitude exposure
- supplement use
- recovery protocols

Positioning line:

`Performance intelligence for athletes who go long.`

## Target User

The main user is a serious, science-forward amateur endurance athlete who already uses tools like Strava, Garmin, or TrainingPeaks and wants to understand what actually helps performance.

## Revenue Direction

Current pricing direction:

- Research Feed Only
- Individual Monthly
- Individual Annual
- Coach Monthly
- Coach Annual

## Product Modules

1. Intervention log
2. Race blueprint / race plan tools
3. Research library and digest
4. Insight engine
5. Coach dashboard

## Current Technical Stack

- Next.js
- Supabase
- Stripe
- Vercel

## Current Repo Reality

- The active app lives in `webapp/`
- Vercel is the active deployment path
- Old Cloudflare deployment files were removed during cleanup

## Current Priorities

- keep authentication and data isolation safe
- improve onboarding and admin workflows
- continue building insights from intervention + activity data
- keep docs simple and current

## Provider Integration Readiness

- Strava is the first working activity provider.
- Garmin and COROS API access is in progress.
- Threshold must maintain a public Login Portal and Support Page on the website or support center so users can access integrations and request technical support.
- Direct wearable integrations should not be publicly advertised as live until official API approval, production credentials, sync testing, and user support paths are complete.

## Brand Voice

- peer-to-peer
- direct
- science-respecting
- no hype language

Avoid words like:

- revolutionary
- game-changing
- unlock your potential

## Content / Community Direction

Focus content around real endurance questions, for example:

- heat acclimation for long races
- gut training and carb intake
- sodium bicarbonate protocols
- sleep and endurance performance
- alternatives to workout-only tools

## Important Rule For Future Docs

If a document is no longer being used, merge the useful parts into this file or `README.md` instead of creating another standalone roadmap at the repo root.
