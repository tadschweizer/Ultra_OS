# UltraOS - AI Context File (Business)
ALWAYS read this file before any UltraOS task. This is the ground truth.

## What UltraOS Is
Performance intelligence platform for serious long-endurance athletes - ultrarunners, gravel cyclists, and long-course triathletes. NOT a training log. NOT a social network. The first platform purpose-built to track, correlate, and surface insights from the full stack of interventions that determine race-day outcomes: heat acclimation, gut training, sodium bicarbonate protocols, sleep manipulation, respiratory training, altitude loading, supplement stacking, probiotic trials, BFR recovery, and every other deliberate action an athlete takes in preparation for a long event.

TrainingPeaks logs your workouts. UltraOS tells you what's actually working.

## Positioning Line
"Performance intelligence for athletes who go long."

## The Problem We Solve
TrainingPeaks (founded 1999) is architected around workout data only. It has no answer for: Did my heat acclimation block actually improve my August race performance? Which bicarb protocol produced the best results with the least GI distress in my body specifically? Is my gut trained to absorb 90g/hr carbs? My last two 100-milers fell apart after mile 60 - what did my prep have in common? No platform answers these questions. UltraOS does.

## Target Subscriber
Science-forward serious amateur endurance athlete. Races 2-4 times/year at 50k-100 mile, Ironman, or major gravel distances (Unbound, Belgian Waffle Ride). Already uses TrainingPeaks or Garmin Connect. Reads PubMed occasionally. Willing to pay $240/year for a platform that makes their prep measurably better. Household income $120k+. Spends $5k-20k/year on their sport.

## Revenue Target
400-500 paying subscribers = ~$120k ARR = owner salary replacement at ~85% gross margin.

## Pricing Tiers
Feature gating lives in `webapp/lib/subscriptionTiers.js`; prices in `webapp/pages/pricing.js`.

Athletes:
- Free: $0. Strava sync, coach connection, activity log, coach messaging, this week's totals, 3 check-ins/week (daily when coach-linked), 15 intervention logs, research library.
- Athlete Core: $7/month or $60/year. 12-week distance/time/elevation trends, 4-week block comparison, longest session, unlimited check-ins and logging. Free for athletes coached on a paid Coach plan.
- Athlete Pro: $18/month or $159/year. CTL/ATL/TSB, training load, ramp rate, monotony, HR drift and aerobic decoupling, training-response correlations, Explorer, Race Blueprint. AI review and suggestions are added later at no extra cost.

Coaches (billing opens after the closed pilot):
- Coach Essentials: $29/month or $290/year, up to 10 athletes. Command Center, calendar and assignments, protocols, compliance views, messaging, coach tools; roster athletes get Core.
- Coach Pro: $79/month or $790/year, up to 25 athletes. Adds per-athlete load trends, the CTL ramp planner, and Athlete Pro for the coach's own training. AI triage and drafted summaries are added later.

Legacy subscribers keep their price: Research Feed → Core, Individual → Pro, Coach → Coach Pro.

## Current Phase
Phase 1 - Intervention Intelligence MVP

## Current Metrics
- Subscriber count: [UPDATE]
- MRR: $[UPDATE]
- Churn rate: [UPDATE]
- NPS: [UPDATE]
- Email list size: [UPDATE]

## The 5 Platform Modules
1. Intervention Intelligence Log - structured queryable log of all non-training performance actions. Core differentiator. No competitor has this.
2. Race Architecture Builder - input any target race, output a complete personalized preparation blueprint (fueling, hydration, protocol stack, pacing, race week).
3. Research Intelligence Feed - monthly plain-English digest of peer-reviewed sports science. Included in subscription. The retention engine.
4. AI Pattern Recognition Engine - personal N=1 insights + anonymized population trends across all users. Year 2+ feature. The data moat.
5. Coach Command Center - multi-athlete dashboard, protocol assignment, cohort comparison. The revenue multiplier.

## Key Competitors
- TrainingPeaks: $120/yr, 26 years old, built for cycling/tri, workout logger only, no intervention tracking. Architecturally unable to build what we're building without a full rebuild. Most likely acquirer.
- Strava: social network, 135M users, $80/yr, no performance intelligence. TAM forces them toward mass market - our niche is too small for them to build for.
- Vert.run: VC-backed, ultra plan delivery tool, different problem (training plans vs. protocol intelligence).
- Garmin Connect: hardware-first, partner not competitor. Integration target.
- Whoop/Oura: hardware-dependent, captures body response not intervention inputs.

## The Moat (Why We're Defensible)
1. The intervention dataset - every logged entry is irreplaceable, unpurchaseable, time-stamped proof of what athletes did and how they performed. After 3 years, largest structured long-endurance intervention database in the world.
2. Protocol knowledge base - indexed, athlete-outcome-linked, living content library that a new entrant cannot replicate without years of publishing.
3. Coach network - once 50+ coaches manage athletes on the platform, switching costs are prohibitive.
4. Community trust - earned in tight endurance communities over years, cannot be bought.
5. Academic credibility - Year 3 dataset enables co-authored peer-reviewed research with sports science departments (CU Boulder, University of Utah, St. Mary's UK targets).

## Brand Voice
Peer-to-peer. Science-respecting. No corporate language. No hype. No words like "revolutionary," "game-changing," or "unlock your potential." Writes like a smart athlete who built the tool they wished existed. Direct. Specific. Confident without arrogance.

## Exit Scenarios
- Lifestyle business: $120k-$200k+ annual owner income indefinitely. Completely viable.
- Strategic acquisition ($2M-$10M): TrainingPeaks, Garmin, Wahoo, Whoop, or a nutrition conglomerate at 4-8x ARR. Most likely Year 4-5.
- Growth round ($5M-$20M+): At $1M+ ARR with proven AI engine and academic publications.

## Owner Profile
Mechanical engineer. Comfortable directing AI tools (Cursor, Claude) and following tutorials. Not a developer. 5-10 hrs/week available. $500-1k/month tool + contractor budget. Building part-time toward salary replacement. Target timeline: 3-4 years to full $120k replacement income.
