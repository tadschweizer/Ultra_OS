export const dataCategories = [
  {
    title: 'Interventions',
    subtitle: 'Primary AI subject',
    body:
      'Deliberate protocol blocks the athlete chooses to drive an adaptation: heat acclimation, sodium bicarbonate loading, gut training, respiratory training, BFR recovery, altitude acclimatization, probiotic trials, and targeted supplementation.',
  },
  {
    title: 'Baseline variables',
    subtitle: 'Universal signal layer',
    body:
      'Sleep, nutrition quality, daily carbohydrate intake, body weight trend, resting heart rate, and HRV trend. These variables matter for every athlete and should generate useful signals even before a race-specific intervention history exists.',
  },
  {
    title: 'Training load variables',
    subtitle: 'Context, not the headline',
    body:
      'Weekly mileage, vertical gain, doubles, cross-training, and long run length arrive through Garmin and Strava sync plus manual logging. UltraOS uses them to frame insight confidence and timing without trying to replace Garmin, Strava, or TrainingPeaks.',
  },
];

export const tierDefinitions = [
  {
    tier: 'Tier 1',
    title: 'Proactive AI insights',
    body:
      'These appear automatically when the system detects a meaningful, actionable pattern. A trigger requires at least three directional data points, a physiologically sensible time window, and an outcome variable that changed in the same direction.',
  },
  {
    tier: 'Tier 2',
    title: 'Race-linked retrospectives',
    body:
      'Whenever an athlete logs a race outcome, UltraOS looks back over the eight-week prep window, compares it to prior similar race cycles, and surfaces only two or three differences that matter.',
  },
  {
    tier: 'Tier 3',
    title: 'Self-selection explorer',
    body:
      'The athlete or coach chooses two variables, sees the personal history plotted, and gets a plain-English description of the relationship. This stays simple on purpose. It is a correlation explorer, not a lab dashboard.',
  },
];

export const proactiveInsightCategories = [
  {
    category: 'Protocol compliance drift',
    trigger:
      'Assigned intervention with a defined block length, at least 3 expected sessions in the current block, completion under 70% of planned volume, and race date within 6 weeks.',
    action:
      'Surface when the athlete can still change the block: session frequency, spacing, or protocol priority.',
    minimumData: '1 assigned protocol + 3 logged or missed checkpoints',
  },
  {
    category: 'Intervention-to-outcome match',
    trigger:
      'At least 3 comparable preps or sub-blocks show the same intervention direction and the same outcome direction. Example: more heat sessions paired with lower GI distress or steadier late-race pace.',
    action:
      'Tell the athlete whether the current prep is above, on, or below the range linked to their better outcomes.',
    minimumData: '3 comparable intervention cycles with linked outcome scores',
  },
  {
    category: 'Intervention recovery cost',
    trigger:
      'At least 3 repeated intervention exposures show slower-than-baseline recovery in HRV, resting heart rate, or perceived fatigue over the following 24 to 72 hours.',
    action:
      'Recommend a concrete spacing or sequencing decision such as 48 hours between heat sessions instead of 24.',
    minimumData: '3 intervention entries + 3 next-day recovery data points',
  },
  {
    category: 'Sleep readiness',
    trigger:
      'At least 7 sleep entries in a 10-day or 14-day lookback, plus either a race countdown, next-day RPE, or HRV. Surface only when sleep duration or timing consistency moves enough to matter and the paired outcome also changes.',
    action:
      'Frame a decision around bedtime consistency, travel, or recovery spacing rather than generic “sleep more” advice.',
    minimumData: '7 sleep logs + 3 paired outcome points',
  },
  {
    category: 'Nutrition underfueling',
    trigger:
      'At least 7 days of carbohydrate logs paired with training load context. Surface when carbohydrate intake is repeatedly below the athlete’s own build-phase range or below minimum fueling needs on key days.',
    action:
      'Turn the signal into a training-week decision: increase carbs on long-run days, recover harder after doubles, or protect race-week glycogen.',
    minimumData: '7 nutrition logs + 3 training-context pairings',
  },
  {
    category: 'Manual-entry confidence calibration',
    trigger:
      'Any insight generated without Garmin or Strava context should carry an early-signal badge unless the athlete has enough manual logs to meet the same 3-point rule and time-window rule.',
    action:
      'Tell the athlete clearly whether the signal is strong or whether more logging is needed to confirm it.',
    minimumData: 'Same category minimums, but confidence reduced when sync data is absent',
  },
];

export const athleteInsightExamples = [
  {
    type: 'Intervention',
    headline: 'Your current heat block is behind the range that matched your better hot-weather races.',
    body:
      'In your last three hot-race preps, you completed 5, 6, and 6 heat sessions in the final 6 weeks and finished with GI distress scores of 2, 1, and 2. This build is at 2 completed sessions with 4 weeks remaining. If you want this prep to look like the cycles that held up best in the heat, the next two weeks need to carry the block.',
    action: 'Decision point: keep heat as a priority twice per week now, or treat this race as a lower-heat adaptation cycle.',
    confidence: 'Based on 3 race-prep cycles',
  },
  {
    type: 'Intervention',
    headline: 'Your HRV has taken longer to rebound after stacked heat sessions than it does after single sessions.',
    body:
      'Across your last 4 heat exposures, single-session days returned to baseline HRV within 24 hours, but back-to-back heat days stayed suppressed for 48 to 72 hours and were followed by higher next-day fatigue scores. The pattern is consistent enough to change how you space the block.',
    action: 'Decision point: leave 48 hours between heat sessions this week instead of stacking them on consecutive days.',
    confidence: 'Based on 4 heat exposures',
  },
  {
    type: 'Sleep',
    headline: 'Your sleep is trending below the range that matched your steadier high-load weeks.',
    body:
      'During your last 3 build weeks with next-day RPE under 7, you averaged 7.4, 7.6, and 7.8 hours of sleep. The current 10-day average is 6.2 hours, and your last 3 harder days all landed at RPE 8 or higher. This is not noise anymore. It is changing how the work feels.',
    action: 'Decision point: protect sleep timing for the next 5 nights or reduce the number of demanding sessions you expect to absorb this week.',
    confidence: 'Based on 10 sleep entries and 3 paired hard days',
  },
  {
    type: 'Nutrition',
    headline: 'Your carbohydrate intake is low for the training you are trying to absorb this week.',
    body:
      'On your last 3 long-run or double days, you logged 240 g, 255 g, and 248 g of carbohydrate while training load rose above your recent average. In the two build weeks where you reported your best recovery, those same days were 330 g or higher. The current pattern points to underfueling, not just fatigue.',
    action: 'Decision point: raise carbohydrate intake on key load days this week or expect recovery quality to stay limited.',
    confidence: 'Based on 9 nutrition logs and 3 key-session pairings',
  },
  {
    type: 'Race-linked',
    headline: 'This prep looked different in the 8 weeks before your race, and the differences lined up with a better finish.',
    body:
      'Compared with your prior two mountain ultras, this cycle included 4 gut-training sessions instead of 1, a steadier final 10-day sleep average at 7.3 hours instead of 6.4, and less late-block fatigue spillover after long runs. Your race GI distress score dropped from 5 and 4 to 2 this time.',
    action: 'Decision point: keep gut training and sleep protection as fixed parts of the next mountain-ultra prep rather than optional add-ons.',
    confidence: 'Based on 3 comparable race cycles',
  },
];

export const coachFlagExample = {
  type: 'Coach flag',
  headline: 'Sarah M. - heat block 40% complete, 4 weeks to race.',
  body:
    'Assigned 6-week protocol is off track versus expected session count. Sleep is also down to a 6.1-hour 10-day average, which increases the risk that missed heat sessions stay missed.',
  action: 'Next step: review compliance barriers in the next check-in and decide whether to rescue the block or simplify it.',
  confidence: 'Based on 5 protocol checkpoints and 10 sleep entries',
};

export const activationRequirements = [
  {
    category: 'Intervention insights',
    requirement: '3 intervention exposures or 3 comparable race-prep cycles, plus at least 1 outcome variable that moved with the intervention.',
  },
  {
    category: 'Sleep insights',
    requirement: '7 sleep logs in the current window plus 3 paired next-day outcomes such as RPE, HRV, or race countdown context.',
  },
  {
    category: 'Nutrition insights',
    requirement: '7 nutrition logs including daily carbohydrate intake plus 3 training-load context pairings.',
  },
  {
    category: 'Race-linked retrospectives',
    requirement: '1 completed race outcome plus an 8-week prep history. Stronger comparisons activate after 3 similar race cycles.',
  },
  {
    category: 'Coach compliance flags',
    requirement: '1 assigned protocol, a target race date, and at least 3 completion checkpoints.',
  },
  {
    category: 'Coach cohort trends',
    requirement: '3 connected athletes with at least 7 days of sleep or nutrition data each.',
  },
];

export const newAthleteValue = [
  {
    title: 'Sleep consistency checks',
    body:
      'This is the fastest route to day-one value because most athletes can log it immediately and it matters for everyone, not just elites.',
  },
  {
    title: 'Carbohydrate-to-load checks',
    body:
      'Underfueling is common, actionable, and visible within the first training week when carbohydrate intake and key sessions are logged together.',
  },
  {
    title: 'Protocol compliance tracking',
    body:
      'If a new athlete starts one structured intervention block, the app can immediately show whether the block is actually happening before it is too late to matter.',
  },
];

export const newCoachValue = [
  {
    title: 'Roster triage feed',
    body:
      'Show which of the first three athletes is falling behind on an assigned protocol, which race date is approaching, and who needs an actual conversation this week.',
  },
  {
    title: 'Cohort sleep and fueling drift',
    body:
      'Aggregate sleep and carbohydrate trend lines across the roster so the coach can see if multiple athletes are under-recovered or under-fueled at the same time.',
  },
  {
    title: 'Recent race pattern prompts',
    body:
      'If one athlete has already logged a race, surface the two or three prep differences worth reviewing in the next call so the coach sees immediate analytical value.',
  },
];

export const coachDashboardSections = [
  {
    title: 'Needs attention now',
    body:
      'Coach-facing insight summaries stay one line, third person, and triage-first. The goal is speed: who is off-track, what changed, and how close they are to race day.',
  },
  {
    title: 'Protocol compliance',
    body:
      'Assigned blocks show expected sessions, completed sessions, current week progress, and race countdown. Compliance misses become coach flags before they become race-day regrets.',
  },
  {
    title: 'Cohort trends',
    body:
      'Sleep and nutrition trends are visible across the full roster so the coach can spot system-wide fatigue or underfueling patterns instead of reviewing every athlete one by one.',
  },
];
