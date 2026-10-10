export const TODAY = "2026-10-09";
export const KEY = "threshold-synthetic-v3";
export function seed() {
  const athletes = [
    {
      id: "demo-river",
      name: "River Lane",
      focus: "Trail 50 km · Nov 14",
      context:
        "Building climbing endurance. Compare RPE with the previous hill session.",
    },
    {
      id: "demo-jules",
      name: "Jules West",
      focus: "Road half marathon · Nov 1",
      context:
        "Returning after a busy week. One missed session and incomplete run metrics.",
    },
    {
      id: "demo-sage",
      name: "Sage Brooks",
      focus: "Mountain 80 km · Dec 5",
      context:
        "Experienced trail runner. Fatigue is elevated; review before adding intensity.",
    },
    {
      id: "demo-robin",
      name: "Robin Vale",
      focus: "New athlete · no race set",
      context:
        "No training history yet. Start with an easy plan and a check-in.",
    },
  ];
  const steps = [
    {
      type: "warmup",
      repeat: 1,
      duration_min: 10,
      intensity: "easy",
      target_type: "open",
      notes: "Easy jog",
    },
    {
      type: "work",
      repeat: 4,
      duration_min: 5,
      intensity: "threshold",
      target_type: "heart_rate",
      target_min: "155",
      target_max: "165",
      target_units: "bpm",
      notes: "Uphill, controlled effort",
    },
    {
      type: "recovery",
      repeat: 4,
      duration_min: 2,
      intensity: "easy",
      target_type: "open",
      notes: "Walk downhill",
    },
    {
      type: "cooldown",
      repeat: 1,
      duration_min: 7,
      intensity: "easy",
      target_type: "open",
      notes: "Relaxed finish",
    },
  ];
  const workouts = [];
  for (const [i, a] of athletes.slice(0, 3).entries())
    for (const [j, day] of [
      "2026-10-05",
      "2026-10-06",
      "2026-10-08",
      "2026-10-09",
      "2026-10-11",
    ].entries())
      workouts.push({
        id: `seed-${i}-${j}`,
        athlete_id: a.id,
        coach_id: "demo-coach",
        title: [
          "Easy aerobic run",
          "Hill repetitions",
          "Recovery run",
          "Steady trail run",
          "Long trail run",
        ][j],
        sport: "run",
        workout_date: day,
        planned_duration_min: [40, 45, 30, 55, 100][j] + i * 5,
        planned_distance_km: [6, 7, 4, 9, 15][j],
        planned_distance_unit: "km",
        planned_tss: [32, 55, 20, 45, 80][j],
        planned_if: 0.7,
        description:
          j === 1
            ? "Controlled climbing. Finish with plenty left."
            : "Keep effort conversational. Adjust for terrain.",
        objective: "Consistent aerobic work",
        coach_instructions: "Report effort and how your legs feel.",
        target_metric: "duration",
        visibility: "athlete_visible",
        structure: j === 1 ? structuredClone(steps) : [],
        status:
          j < 2 ? "completed" : i === 1 && j === 2 ? "skipped" : "planned",
        activity_match_mode: "manual",
        completed_duration_min:
          j < 2 ? (j === 1 && i === 2 ? 28 : [42, 46][j]) : null,
        completed_distance_km:
          j < 2 ? (i === 1 && j === 0 ? null : [6.2, 7.1][j]) : null,
        athlete_rpe: j < 2 ? (i === 2 ? 8 : 4 + j) : null,
        athlete_comment:
          j === 1
            ? i === 2
              ? "Legs exhausted on the last climb; stopped early."
              : "Good control on the climbs."
            : null,
        coach_feedback: null,
        updated_at: "2026-10-09T08:00:00.000Z",
      });
  return {
    schema: 3,
    revision: 0,
    athletes,
    workouts,
    notes: [],
    events: [],
    library: [
      {
        id: "lib-easy",
        name: "Easy run + strides",
        sport: "run",
        planned_duration_min: 40,
        planned_distance_km: 6,
        planned_distance_unit: "km",
        planned_tss: 30,
        description: "Easy aerobic running, then 4 relaxed strides.",
        structure: [],
      },
    ],
    activities: [
      {
        id: "demo-activity",
        athlete_id: "demo-river",
        name: "Ridge exploration",
        sport: "run",
        sport_type: "TrailRun",
        type: "Run",
        activity_date: "2026-10-07",
        local_date: "2026-10-07",
        start_date: "2026-10-07T07:00:00Z",
        start_date_local: "2026-10-07T07:00:00",
        moving_time: 3600,
        distance: 8200,
        duration_min: 60,
        distance_km: 8.2,
        elevation_gain_m: 620,
        total_elevation_gain: 620,
        average_heartrate: 148,
        max_heartrate: 169,
        tss: 58,
        source: "Synthetic fixture",
        description: "Fictional trail activity; no device sync occurred.",
      },
    ],
    checkins: {
      "demo-river": {
        sleep: 7.5,
        energy: 4,
        soreness: 2,
        note: "Ready for a steady run.",
        date: TODAY,
      },
      "demo-jules": {
        sleep: 6,
        energy: 3,
        soreness: 3,
        note: "Busy week, missed Thursday.",
        date: TODAY,
      },
      "demo-sage": {
        sleep: 5.5,
        energy: 2,
        soreness: 5,
        note: "Heavy legs; would prefer an easy day.",
        date: TODAY,
      },
    },
    messages: [
      {
        id: "seed-message",
        athlete_id: "demo-sage",
        sender_role: "athlete",
        message_body: "Can we lower the next run after those hills?",
        created_at: "2026-10-09T09:00:00Z",
        read_at: null,
        email_notification: "skipped",
      },
    ],
    comments: [],
    drafts: {},
    preferences: {
      coach: { badge_enabled: true, email_enabled: false },
      athlete: { badge_enabled: true, email_enabled: false },
    },
    requests: {},
  };
}
