function isoDaysFromToday(offsetDays, hour = 12) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString();
}

function createActivity({
  id,
  offsetDays,
  name,
  miles,
  hours,
  elevationFeet,
  sportType = 'Run',
  averageHeartrate = null,
}) {
  return {
    id,
    name,
    start_date: isoDaysFromToday(offsetDays, 6),
    distance: miles * 1609.34,
    moving_time: Math.round(hours * 3600),
    total_elevation_gain: elevationFeet / 3.28084,
    sport_type: sportType,
    type: sportType,
    average_heartrate: averageHeartrate,
  };
}

const dashboardPreview = {
  athlete: {
    id: 'athlete-preview-dashboard',
    name: 'Maya Chen',
    email: 'maya.preview@example.com',
    onboarding_complete: true,
  },
  settings: {
    hr_zone_3_min: 148,
    sweat_sodium_concentration_mg_l: 870,
    supplements: [
      { id: 'supp-1', supplement_name: 'Electrolyte mix', amount: '1 serving / long run' },
      { id: 'supp-2', supplement_name: 'Caffeine', amount: '100mg pre-key session' },
    ],
  },
  activities: [
    createActivity({ id: 'act-1', offsetDays: -1, name: 'Tempo climb session', miles: 9.2, hours: 1.4, elevationFeet: 1450, averageHeartrate: 154 }),
    createActivity({ id: 'act-2', offsetDays: -3, name: 'Sauna + easy aerobic run', miles: 6.4, hours: 0.95, elevationFeet: 420, averageHeartrate: 136 }),
    createActivity({ id: 'act-3', offsetDays: -5, name: 'Long trail run', miles: 18.7, hours: 3.4, elevationFeet: 4100, averageHeartrate: 142 }),
    createActivity({ id: 'act-4', offsetDays: -8, name: 'Double threshold day', miles: 11.5, hours: 1.8, elevationFeet: 980, averageHeartrate: 151 }),
    createActivity({ id: 'act-5', offsetDays: -11, name: 'Recovery spin', miles: 22, hours: 1.2, elevationFeet: 550, sportType: 'Ride' }),
    createActivity({ id: 'act-6', offsetDays: -14, name: 'Back-to-back long run', miles: 20.2, hours: 3.7, elevationFeet: 3600, averageHeartrate: 145 }),
    createActivity({ id: 'act-7', offsetDays: -18, name: 'VO2 hill reps', miles: 8.1, hours: 1.1, elevationFeet: 1200, averageHeartrate: 158 }),
    createActivity({ id: 'act-8', offsetDays: -23, name: 'Aerobic volume day', miles: 14.4, hours: 2.1, elevationFeet: 1750, averageHeartrate: 141 }),
    createActivity({ id: 'act-9', offsetDays: -29, name: 'Leadville course simulation', miles: 24.8, hours: 4.6, elevationFeet: 5200, averageHeartrate: 147 }),
    createActivity({ id: 'act-10', offsetDays: -37, name: 'Steady state run', miles: 10.4, hours: 1.5, elevationFeet: 900, averageHeartrate: 149 }),
    createActivity({ id: 'act-11', offsetDays: -45, name: 'Mountain long day', miles: 21.3, hours: 4.0, elevationFeet: 4700, averageHeartrate: 143 }),
    createActivity({ id: 'act-12', offsetDays: -58, name: 'Fuel rehearsal run', miles: 15.1, hours: 2.4, elevationFeet: 2100, averageHeartrate: 144 }),
  ],
  interventions: [
    {
      id: 'int-1',
      intervention_type: 'Heat Acclimation',
      date: isoDaysFromToday(-1, 18),
      inserted_at: isoDaysFromToday(-1, 18),
      target_race: 'Leadville 100',
      details: '30 minutes dry sauna after tempo session. RPE stayed controlled.',
    },
    {
      id: 'int-2',
      intervention_type: 'Workout Check-in',
      date: isoDaysFromToday(-3, 19),
      inserted_at: isoDaysFromToday(-3, 19),
      target_race: 'Leadville 100',
      details: 'Easy day felt flat at first, then improved after hydration and fueling.',
    },
    {
      id: 'int-3',
      intervention_type: 'Gut Training',
      date: isoDaysFromToday(-5, 17),
      inserted_at: isoDaysFromToday(-5, 17),
      target_race: 'Leadville 100',
      details: 'Practiced 85g carb/hr with no GI blowback on long trail run.',
    },
    {
      id: 'int-4',
      intervention_type: 'Sleep',
      date: isoDaysFromToday(-8, 8),
      inserted_at: isoDaysFromToday(-8, 8),
      target_race: 'Leadville 100',
      details: '8.5 hours average for three nights before double threshold session.',
    },
    {
      id: 'int-5',
      intervention_type: 'Sodium Bicarbonate',
      date: isoDaysFromToday(-14, 9),
      inserted_at: isoDaysFromToday(-14, 9),
      target_race: 'Leadville 100',
      details: 'Split-dose test before hard long run. Mild GI sensation only.',
    },
    {
      id: 'int-6',
      intervention_type: 'Heat Acclimation',
      date: isoDaysFromToday(-20, 18),
      inserted_at: isoDaysFromToday(-20, 18),
      target_race: 'Leadville 100',
      details: 'Shorter sauna exposure after recovery block to rebuild consistency.',
    },
  ],
  interventionCount: 6,
  unreadMessageCount: 2,
  currentRace: {
    id: 'race-preview-dashboard',
    name: 'Leadville 100',
    event_date: isoDaysFromToday(39).slice(0, 10),
    distance_miles: 100,
    race_type: 'Mountain Ultra',
    location: 'Leadville, CO',
  },
  protocolSummary: {
    daysUntilRace: 39,
    phase: 'Specific Prep',
    protocolStatus: '2 active protocols with good compliance and one coach message pending.',
    activeAssignments: [
      {
        id: 'assignment-1',
        coach_name: 'Sage Holloway',
        protocol_name: 'Leadville Heat Block',
        protocol_type: 'Heat Acclimation',
        compliance: 84,
        current_week: 2,
        actual_entries: 4,
        expected_entries: 5,
        current_week_summary: 'Complete 4 sauna exposures this week after aerobic days. Keep total exposure under 35 minutes.',
        start_date: isoDaysFromToday(-7).slice(0, 10),
        end_date: isoDaysFromToday(14).slice(0, 10),
        instructions: {
          weekly_blocks: [
            { week_number: 1, instruction_text: 'Start with 20 to 25 minute exposures after easy runs.', frequency_per_week: 3, target_metric: '20-25 min' },
            { week_number: 2, instruction_text: 'Build to 30 to 35 minute exposures. Track perceived recovery next morning.', frequency_per_week: 5, target_metric: '30-35 min' },
            { week_number: 3, instruction_text: 'Maintain frequency but reduce duration if long-run fatigue accumulates.', frequency_per_week: 4, target_metric: '25-30 min' },
          ],
        },
        context_messages: [
          {
            id: 'msg-1',
            sender_role: 'coach',
            created_at: isoDaysFromToday(-2, 14),
            content: 'You are adapting well. Keep the post-sauna hydration tighter before the weekend simulation.',
          },
        ],
      },
      {
        id: 'assignment-2',
        coach_name: 'Sage Holloway',
        protocol_name: 'Race Fuel Rehearsal',
        protocol_type: 'Gut Training',
        compliance: 91,
        current_week: 1,
        actual_entries: 2,
        expected_entries: 2,
        current_week_summary: 'Repeat 85 to 90g carb/hr on the next long run and capture flavor fatigue notes.',
        start_date: isoDaysFromToday(-3).slice(0, 10),
        end_date: isoDaysFromToday(11).slice(0, 10),
        instructions: {
          weekly_blocks: [
            { week_number: 1, instruction_text: 'Two long-run rehearsals at race fuel targets.', frequency_per_week: 2, target_metric: '85-90g carb/hr' },
            { week_number: 2, instruction_text: 'Back off volume but keep race-day breakfast identical.', frequency_per_week: 1, target_metric: 'Breakfast rehearsal' },
          ],
        },
        context_messages: [],
      },
    ],
  },
};

export function getDashboardPreview(previewKey = 'athlete-demo') {
  if (previewKey === 'athlete-demo') {
    return {
      key: 'athlete-demo',
      label: 'Athlete Dashboard Demo',
      ...dashboardPreview,
    };
  }

  return null;
}
