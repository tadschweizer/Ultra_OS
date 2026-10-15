# Threshold — Business direction

Last updated: 2026-10-15

## What Threshold is

Threshold is a coaching platform for athletes and the coaches who support them. It brings training plans, completed workouts, check-ins, communication, and progress review into one workspace so people can make better decisions about what to do next.

Our ambition is to build the best coaching platform for athletes, from someone starting a couch-to-5K plan to an experienced endurance athlete preparing for a demanding event. "Best" is a goal we must earn through useful workflows, reliability, and feedback from real users.

Threshold is the product name. UltraOS / Ultra_OS remains the repository and legacy technical name; this positioning update does not require renaming existing identifiers.

## Positioning

**A shared workspace for coaches and athletes to plan training, stay connected, and make progress.**

Short description for introductions:

> Threshold helps coaches and athletes work together throughout the training week. Coaches can plan sessions, review completed work, and give feedback. Athletes can understand their plan, record how training went, and keep their coach informed. We are building first for athletic coaching, with the long-term ambition to support other coaching disciplines.

This describes the product direction. Availability and launch claims must follow the [execution roadmap](PRODUCT_EXECUTION_ROADMAP.md), whose acceptance gates remain open.

## The problem we are solving

Coaching depends on a repeated conversation: what is the goal, what is the plan, what actually happened, and what should change? When those answers are scattered across calendars, activity apps, spreadsheets, and messages, coaches spend time reconstructing context and athletes can be unsure what to do next. This is our problem hypothesis to validate with pilot participants.

Threshold should make that weekly loop easier:

1. Coach and athlete establish goals and practical constraints.
2. The coach plans training the athlete can understand and follow.
3. The athlete completes sessions and shares results and how they felt.
4. The coach reviews progress and gives timely, specific feedback.
5. They adjust the next week together.

## Who we serve

- **Coaches:** initially independent coaches and small coaching teams managing athletic training. They need reliable planning, athlete context, and communication tied to the work.
- **Athletes:** beginners through experienced competitors, including people seeking consistency, a first 5K, a marathon, or a longer endurance goal. Experience, race distance, income, and an interest in sports science are not prerequisites for belonging here.
- **Self-directed athletes:** the athlete workspace should remain useful without a coach, while making it straightforward to work with one when desired.

The initial pilot is deliberately small: one approved coach and up to five athletes. Endurance training is the starting product context, not a requirement that every user be an ultrarunner. Demand, willingness to pay, and the most useful first customer segment still need validation.

## Product priorities

1. **Dependable coaching basics:** onboarding, relationships, calendars, workout planning and assignment, completion review, check-ins, and messaging.
2. **An effective weekly workspace:** reusable plans and workouts, clear athlete context, useful progress summaries, and less repeated administrative work.
3. **Trustworthy training information:** understandable calculations, clear data sources, honest missing-data states, and integrations that work reliably.
4. **A sustainable service:** understandable access and billing, data privacy, supportable workflows, and retention earned through regular use.

Research, educational content, protocols, and intervention tracking can support coaching when they help a coach or athlete make a decision. They are supporting capabilities, not the primary product, required onboarding journey, or reason to subscribe. Existing data and useful workflows remain valuable; the pivot is not authorization to remove them.

AI-generated advice and plans remain deferred under the execution roadmap. The product must deliver value through human coaching and dependable software without relying on future AI.

## Business model and current pricing reference

The working model is subscriptions for coach workspaces and optional paid athlete features, with a useful Free athlete experience. Coach adoption may bring athletes onto the platform; whether that produces sustainable acquisition and retention is a hypothesis to measure.

These prices are displayed in local source on 2026-10-15. They are a reference, not a new pricing decision or proof that paid checkout is accepted in production.

| Plan | Monthly | Annual total | Current packaging reference |
| --- | --- | --- | --- |
| Free | $0 | $0 | Athlete entry plan; no card required |
| Athlete Core | $7 | $60 | Expanded logging/check-ins and volume trends |
| Athlete Pro | $18 | $159 | Core plus deterministic training analytics and additional tools |
| Coach Essentials | $29 | $290 | Coach workspace, up to 10 athletes |
| Coach Pro | $79 | $790 | Up to 25 athletes and advanced coach metrics |

Sources: [pricing page](webapp/pages/pricing.js), [feature tiers](webapp/lib/subscriptionTiers.js), and [billing plan mappings](webapp/lib/billingPlans.js). Athletes linked to a paid coach receive Core features. Pilot grants are separate from paid subscriptions. Coach pricing currently leads to the pilot; public coach billing is not established by this table. Preserve the legacy tier mappings in code during later packaging changes.

The existing planning aspiration is a sustainable owner-operated business. Revenue, owner income, margin, and valuation are different measures. Any revenue target needs a plan mix, annual/monthly split, retention assumptions, and operating costs. The old claim that 400–500 subscribers necessarily yields $120,000 ARR is not a valid forecast at these prices.

## How we will judge progress

Track evidence before making growth or performance claims:

- Activation: a coach and athlete complete their first plan, workout review, and feedback loop.
- Weekly use: coaches plan and review; athletes see their sessions and share completion/context.
- Usability: time to plan a week, review an athlete, and resolve a question on desktop and phone.
- Reliability: saved work persists, permissions hold, and messages and billing behave as expected.
- Retention and value: participants keep using the workflow and can explain what it helps them do.
- Business health: paying accounts by plan, recurring revenue, churn, support effort, and costs.

These are proposed measures, not reported results. Use the roadmap's pilot observations and acceptance criteria first. No subscriber count, revenue, margin, or customer outcome is asserted here.

## Differentiation and growth

Earn preference through planning clarity, responsive communication, useful review, and low administrative effort. TrainingPeaks-level daily workflow usefulness is an internal benchmark; replacement claims require the roadmap's parity acceptance tests. Avoid unsupported claims about competitors' limitations, market size, acquisition interest, or an exclusive dataset.

Start with a small coach pilot, observe actual use, fix broken journeys, and then expand through coach referrals and practical demonstrations. Public trial promotion waits for the release gates. Educational content supports this work; a recurring research publication is not a prerequisite.

## Future coaching disciplines

The long-term direction is to support coaching beyond athletic training. The reusable foundation is the coach-client relationship, goals, plans, progress, and feedback. No next discipline or launch date is committed. Expansion should follow evidence of a reliable athletic coaching product, repeat use, and discovery with coaches and clients in the proposed discipline.

Keep new design decisions open to that future where practical, but do not build a generic multi-discipline platform or dilute the athlete experience before the current coaching loop works.

## Guidance and document ownership

- This file owns business positioning, audience, and strategic intent.
- [PRODUCT_EXECUTION_ROADMAP.md](PRODUCT_EXECUTION_ROADMAP.md) owns execution order, release gates, and completion evidence. Its current M0 work remains the implementation priority.
- [README-PLATFORM.md](README-PLATFORM.md) translates the direction into product/build guidance.
- [README-CONTENT.md](README-CONTENT.md) governs communication and content priorities.
- [AGENTS.md](AGENTS.md) sets repository working rules.

Use plain, specific, respectful language. Lead with the coaching job someone can accomplish. Distinguish vision, implemented functionality, and verified availability in every pitch or demo. Older intervention-first strategy and exported pitch documents are historical material and need reconciliation with these sources before reuse.
