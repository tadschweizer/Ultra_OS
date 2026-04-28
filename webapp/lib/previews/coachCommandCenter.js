function isoDaysFromToday(offsetDays) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString();
}

function dateOnlyFromToday(offsetDays) {
  return isoDaysFromToday(offsetDays).slice(0, 10);
}

const coachCommandCenterPreview = {
  profile: {
    id: 'coach-preview-1',
    display_name: 'Sage Holloway Performance',
    coach_code: 'SAGE-24',
    bio: 'High-touch ultra and mountain endurance coaching studio with a bias toward race execution, heat prep, and protocol compliance.',
    specialties: ['Ultrarunning', 'Trail', 'Heat adaptation'],
    certifications: ['USATF Level 2', 'CTS Ultra Specialist'],
    subscription_tier: 'coach_annual',
    subscription_status: 'active',
  },
  summary: {
    total_athletes: 5,
    active_protocols: 4,
    athletes_needing_attention: 2,
    upcoming_races: 3,
  },
  relationships: [
    {
      id: 'rel-preview-1',
      athlete_id: 'ath-preview-1',
      status: 'active',
      alertLevel: 'red',
      daysSinceLog: 4,
      group_name: 'Leadville Build',
      athlete: {
        id: 'ath-preview-1',
        name: 'Maya Chen',
        email: 'maya.preview@example.com',
      },
      nextRace: {
        id: 'race-preview-1',
        name: 'Leadville 100',
        event_date: dateOnlyFromToday(18),
      },
    },
    {
      id: 'rel-preview-2',
      athlete_id: 'ath-preview-2',
      status: 'active',
      alertLevel: 'yellow',
      daysSinceLog: 2,
      group_name: 'Western States',
      athlete: {
        id: 'ath-preview-2',
        name: 'Jordan Alvarez',
        email: 'jordan.preview@example.com',
      },
      nextRace: {
        id: 'race-preview-2',
        name: 'Western States',
        event_date: dateOnlyFromToday(42),
      },
    },
    {
      id: 'rel-preview-3',
      athlete_id: 'ath-preview-3',
      status: 'active',
      alertLevel: 'green',
      daysSinceLog: 0,
      group_name: 'Gravel A',
      athlete: {
        id: 'ath-preview-3',
        name: 'Theo Brooks',
        email: 'theo.preview@example.com',
      },
      nextRace: {
        id: 'race-preview-3',
        name: 'Unbound 200',
        event_date: dateOnlyFromToday(27),
      },
    },
    {
      id: 'rel-preview-4',
      athlete_id: 'ath-preview-4',
      status: 'active',
      alertLevel: 'green',
      daysSinceLog: 1,
      group_name: 'Cohort B',
      athlete: {
        id: 'ath-preview-4',
        name: 'Rina Patel',
        email: 'rina.preview@example.com',
      },
      nextRace: null,
    },
    {
      id: 'rel-preview-5',
      athlete_id: 'ath-preview-5',
      status: 'active',
      alertLevel: 'yellow',
      daysSinceLog: 6,
      group_name: 'Leadville Build',
      athlete: {
        id: 'ath-preview-5',
        name: 'Cole Harper',
        email: 'cole.preview@example.com',
      },
      nextRace: {
        id: 'race-preview-5',
        name: 'Javelina 100K',
        event_date: dateOnlyFromToday(74),
      },
    },
  ],
  protocols: [
    {
      id: 'protocol-preview-1',
      athlete_id: 'ath-preview-1',
      athlete: { name: 'Maya Chen' },
      protocol_name: 'Leadville Heat Block',
      protocol_type: 'Heat Acclimation',
      status: 'in_progress',
      compliance_target: 85,
      start_date: dateOnlyFromToday(-10),
      end_date: dateOnlyFromToday(12),
    },
    {
      id: 'protocol-preview-2',
      athlete_id: 'ath-preview-2',
      athlete: { name: 'Jordan Alvarez' },
      protocol_name: 'Race Week Fuel Rehearsal',
      protocol_type: 'Gut Training',
      status: 'assigned',
      compliance_target: 80,
      start_date: dateOnlyFromToday(-3),
      end_date: dateOnlyFromToday(21),
    },
    {
      id: 'protocol-preview-3',
      athlete_id: 'ath-preview-3',
      athlete: { name: 'Theo Brooks' },
      protocol_name: 'Bicarb Tolerance Ramp',
      protocol_type: 'Sodium Bicarbonate',
      status: 'in_progress',
      compliance_target: 75,
      start_date: dateOnlyFromToday(-7),
      end_date: dateOnlyFromToday(14),
    },
    {
      id: 'protocol-preview-4',
      athlete_id: 'ath-preview-5',
      athlete: { name: 'Cole Harper' },
      protocol_name: 'Sleep Extension Mini-Block',
      protocol_type: 'Sleep Extension',
      status: 'assigned',
      compliance_target: 90,
      start_date: dateOnlyFromToday(1),
      end_date: dateOnlyFromToday(19),
    },
  ],
  invitations: [
    {
      id: 'invite-preview-1',
      email: 'newathlete@example.com',
      token: 'preview-token-1',
      status: 'pending',
      expires_at: isoDaysFromToday(5),
    },
    {
      id: 'invite-preview-2',
      email: 'acceptedathlete@example.com',
      token: 'preview-token-2',
      status: 'accepted',
      expires_at: isoDaysFromToday(-3),
    },
  ],
  templates: [
    {
      id: 'template-preview-1',
      name: '3-Week Heat Builder',
      protocol_type: 'Heat Acclimation',
      duration_weeks: 3,
      description: 'Progressive sauna exposure for hot-weather race prep.',
      is_shared: false,
    },
    {
      id: 'template-preview-2',
      name: 'Race Week Gut Tune-Up',
      protocol_type: 'Gut Training',
      duration_weeks: 2,
      description: 'Short gut-training template with one race-day simulation.',
      is_shared: true,
    },
  ],
  sharedTemplates: [
    {
      id: 'template-preview-3',
      name: 'Sleep Rescue Protocol',
      protocol_type: 'Sleep Extension',
      duration_weeks: 2,
      description: 'Used when recovery markers dip during heavy build weeks.',
      is_shared: true,
    },
  ],
  notesMap: {
    'ath-preview-1': [
      {
        id: 'note-preview-1',
        note_type: 'flag',
        content: 'Missed two sauna sessions and reported heavy legs after back-to-back hill work. Follow up before the weekend long run.',
        is_pinned: true,
        created_at: isoDaysFromToday(-1),
      },
      {
        id: 'note-preview-2',
        note_type: 'observation',
        content: 'Responds well to short heat exposures after easy aerobic days.',
        is_pinned: false,
        created_at: isoDaysFromToday(-6),
      },
    ],
    'ath-preview-2': [
      {
        id: 'note-preview-3',
        note_type: 'reminder',
        content: 'Review carb/hr target before final simulation long run.',
        is_pinned: false,
        created_at: isoDaysFromToday(-2),
      },
    ],
    'ath-preview-3': [
      {
        id: 'note-preview-4',
        note_type: 'observation',
        content: 'Compliance is high and GI tolerance has improved across the last two sessions.',
        is_pinned: false,
        created_at: isoDaysFromToday(-3),
      },
    ],
  },
};

export function getCoachCommandCenterPreview(previewKey = 'coach-demo') {
  if (previewKey === 'coach-demo') {
    return {
      key: 'coach-demo',
      label: 'Coach Demo Roster',
      ...coachCommandCenterPreview,
    };
  }

  return null;
}
