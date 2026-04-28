export const favoriteInterventionStorageKey = 'threshold-favorite-intervention-types';
export const legacyFavoriteInterventionStorageKey = 'ultraos-favorite-intervention-types';

export const defaultFavoriteInterventions = [
  'Sauna - Recovery',
  'Gut Training',
  'Sodium Bicarbonate - Loading Protocol',
  'Fueling - Mid-Effort',
];

export const interventionCatalog = [
  {
    phase: 'Check-in',
    types: [
      {
        label: 'Workout Check-in',
        fields: [
          {
            key: 'session_type',
            label: 'Session type',
            type: 'select',
            options: ['Easy Run', 'Long Run', 'Tempo / Threshold', 'Intervals', 'Strength', 'Bike', 'Hike', 'Race', 'Cross-train', 'Other'],
          },
          { key: 'duration_minutes', label: 'Duration (minutes)', type: 'number' },
          { key: 'legs_feel', label: 'Legs feel (1=dead, 10=fresh)', type: 'number', min: 1, max: 10 },
          { key: 'energy_feel', label: 'Energy level (1=wiped, 10=great)', type: 'number', min: 1, max: 10 },
          { key: 'perceived_effort', label: 'Perceived effort / RPE (1-10)', type: 'number', min: 1, max: 10 },
          { key: 'avg_hr', label: 'Avg HR (bpm, optional)', type: 'number' },
        ],
      },
    ],
  },
  {
    phase: 'Before',
    types: [
      {
        label: 'Heat Acclimation',
        fields: [
          { key: 'method', label: 'Method', type: 'select', options: ['Sauna', 'Hot Bath', 'Hot Room', 'Outdoor'] },
          { key: 'temperature_f', label: 'Temperature (F)', type: 'number' },
          { key: 'duration_minutes', label: 'Duration (minutes)', type: 'number' },
          { key: 'response', label: 'Response (1-10)', type: 'number', min: 1, max: 10 },
        ],
      },
      {
        label: 'Altitude Acclimatization',
        fields: [
          { key: 'method', label: 'Method', type: 'select', options: ['Tent', 'Training Camp', 'Actual Elevation'] },
          { key: 'elevation_ft', label: 'Elevation (feet)', type: 'number' },
          { key: 'exposure_hours_per_day', label: 'Exposure (hours/day)', type: 'number', step: '0.1' },
          { key: 'response', label: 'Response (1-10)', type: 'number', min: 1, max: 10 },
        ],
      },
      {
        label: 'Respiratory Training',
        fields: [
          { key: 'device', label: 'Device', type: 'select', options: ['POWERbreathe', 'Airofit', 'Elevation Mask', 'Other'] },
          { key: 'duration_minutes', label: 'Duration (minutes)', type: 'number' },
          { key: 'week_in_block', label: 'Week in block', type: 'number' },
          { key: 'perceived_benefit', label: 'Perceived benefit (1-10)', type: 'number', min: 1, max: 10 },
        ],
      },
      {
        label: 'Gut Training',
        fields: [
          { key: 'carb_target_g_per_hr', label: 'Carb target (g/hr)', type: 'number' },
          { key: 'carb_actual_g_per_hr', label: 'Carb actual (g/hr)', type: 'number' },
          { key: 'session_duration_hours', label: 'Session duration (hours)', type: 'number', step: '0.1' },
          { key: 'gi_response', label: 'GI response (1-10)', type: 'number', min: 1, max: 10 },
        ],
      },
      {
        label: 'Sodium Bicarbonate - Loading Protocol',
        fields: [
          { key: 'dose', label: 'Dose (grams or mg/kg)', type: 'text' },
          { key: 'timing_minutes_before_effort', label: 'Timing before effort (minutes)', type: 'number' },
          { key: 'delivery', label: 'Delivery', type: 'select', options: ['Capsules', 'Powder', 'Gel'] },
          { key: 'gi_response', label: 'GI response (1-10)', type: 'number', min: 1, max: 10 },
          { key: 'performance_feel', label: 'Performance feel (1-10)', type: 'number', min: 1, max: 10 },
        ],
      },
      {
        label: 'Caffeine Cycling / Washout',
        fields: [
          { key: 'days_caffeine_free', label: 'Days caffeine-free', type: 'number' },
          { key: 'usual_daily_intake_mg', label: 'Usual daily intake before washout (mg)', type: 'number' },
          { key: 'sleep_quality', label: 'Sleep quality during washout (1-10)', type: 'number', min: 1, max: 10 },
          { key: 'energy_impact', label: 'Energy impact (1-10)', type: 'number', min: 1, max: 10 },
        ],
      },
      {
        label: 'Carbohydrate Loading',
        fields: [
          { key: 'daily_carb_target_g_per_kg', label: 'Daily carb target (g/kg)', type: 'number', step: '0.1' },
          { key: 'daily_carb_actual_g_per_kg', label: 'Daily carb actual (g/kg)', type: 'number', step: '0.1' },
          { key: 'duration_days', label: 'Duration (days)', type: 'number' },
          { key: 'gi_response', label: 'GI response (1-10)', type: 'number', min: 1, max: 10 },
          { key: 'energy_feel', label: 'Energy feel (1-10)', type: 'number', min: 1, max: 10 },
        ],
      },
      {
        label: 'Cold Exposure - Adaptation Protocol',
        fields: [
          { key: 'method', label: 'Method', type: 'select', options: ['Cold Shower', 'Ice Bath', 'Cold Plunge'] },
          { key: 'temperature_f', label: 'Temperature (F)', type: 'number' },
          { key: 'duration_minutes', label: 'Duration (minutes)', type: 'number' },
          { key: 'timing', label: 'Timing', type: 'select', options: ['Morning', 'Post-Training'] },
          { key: 'response', label: 'Response (1-10)', type: 'number', min: 1, max: 10 },
        ],
      },
      {
        label: 'BFR - Strength Maintenance',
        fields: [
          { key: 'limb', label: 'Limb', type: 'select', options: ['Legs', 'Arms'] },
          { key: 'cuff_pressure', label: 'Cuff pressure', type: 'select', options: ['Low', 'Moderate', 'High'] },
          { key: 'protocol_sets_reps', label: 'Protocol (sets x reps)', type: 'text' },
          { key: 'perceived_effort', label: 'Perceived effort (1-10)', type: 'number', min: 1, max: 10 },
        ],
      },
      {
        label: 'Sleep Protocol',
        fields: [
          { key: 'hours_slept', label: 'Hours slept', type: 'number', step: '0.1' },
          { key: 'quality', label: 'Quality (1-10)', type: 'number', min: 1, max: 10 },
          { key: 'hrv', label: 'HRV (if measured)', type: 'number', step: '0.1' },
          {
            key: 'interventions_used',
            label: 'Interventions used',
            type: 'multiselect',
            options: ['Blackout', 'Mouth Tape', 'Cooling', 'Other'],
          },
        ],
      },
    ],
  },
  {
    phase: 'During',
    types: [
      {
        label: 'Fueling - Mid-Effort',
        fields: [
          { key: 'carb_intake_g_per_hr', label: 'Carb intake (g/hr)', type: 'number' },
          {
            key: 'sources',
            label: 'Sources',
            type: 'multiselect',
            options: ['Gel', 'Chew', 'Drink', 'Real Food', 'Mixed'],
          },
          { key: 'fructose_glucose_ratio', label: 'Fructose:glucose ratio', type: 'select', options: ['2:1', '1:1', 'Unknown'] },
          { key: 'gi_response', label: 'GI response (1-10)', type: 'number', min: 1, max: 10 },
          { key: 'energy_consistency', label: 'Energy consistency (1-10)', type: 'number', min: 1, max: 10 },
        ],
      },
      {
        label: 'Hydration and Electrolytes',
        fields: [
          { key: 'fluid_intake', label: 'Fluid intake (oz/hr or ml/hr)', type: 'text' },
          { key: 'sodium_intake_mg_per_hr', label: 'Sodium intake (mg/hr)', type: 'number' },
          { key: 'product_used', label: 'Product used', type: 'text' },
          { key: 'thirst_level', label: 'Thirst level (1-10)', type: 'number', min: 1, max: 10 },
          { key: 'cramping', label: 'Cramping?', type: 'boolean' },
        ],
      },
      {
        label: 'Caffeine - Mid-Effort',
        fields: [
          { key: 'dose_mg', label: 'Dose (mg)', type: 'number' },
          { key: 'timing_hour_of_effort', label: 'Timing (hour of effort taken)', type: 'number', step: '0.1' },
          { key: 'form', label: 'Form', type: 'select', options: ['Gel', 'Pill', 'Drink', 'Cola'] },
          { key: 'perceived_alertness_boost', label: 'Perceived alertness boost (1-10)', type: 'number', min: 1, max: 10 },
          { key: 'gi_response', label: 'GI response (1-10)', type: 'number', min: 1, max: 10 },
        ],
      },
      {
        label: 'Sodium Bicarbonate - Acute Race Use',
        fields: [
          { key: 'dose_grams', label: 'Dose (grams)', type: 'number', step: '0.1' },
          { key: 'timing_minutes_before_effort_start', label: 'Timing before effort start (minutes)', type: 'number' },
          { key: 'gi_response', label: 'GI response (1-10)', type: 'number', min: 1, max: 10 },
          { key: 'perceived_buffering_benefit', label: 'Perceived buffering benefit (1-10)', type: 'number', min: 1, max: 10 },
        ],
      },
      {
        label: 'Cooling Strategy',
        fields: [
          {
            key: 'method',
            label: 'Method',
            type: 'select',
            options: ['Ice Vest', 'Cold Towels', 'Ice Collar', 'Cold Sponging', 'Ice in Hat'],
          },
          { key: 'duration_of_use', label: 'Duration of use', type: 'text' },
          { key: 'ambient_temperature_f', label: 'Ambient temperature (F)', type: 'number' },
          { key: 'perceived_cooling_benefit', label: 'Perceived cooling benefit (1-10)', type: 'number', min: 1, max: 10 },
        ],
      },
      {
        label: 'Trekking Poles',
        fields: [
          {
            key: 'terrain_type',
            label: 'Terrain type',
            type: 'select',
            options: ['Steep Climb', 'Technical Trail', 'Rocky / Rooty', 'Descent', 'Mixed', 'Flat / Road'],
          },
          { key: 'duration_hours', label: 'Hours used', type: 'number', step: '0.1' },
          { key: 'effort_phase', label: 'Effort phase or section (e.g. miles 20–40)', type: 'text' },
          { key: 'avg_hr_bpm', label: 'Avg HR during pole use (bpm)', type: 'number' },
          { key: 'pace_or_grade', label: 'Pace or grade context (e.g. 20min/mi, 15% grade)', type: 'text' },
          { key: 'efficiency_feel', label: 'Movement efficiency feel (1=clunky, 10=fluid)', type: 'number', min: 1, max: 10 },
          { key: 'upper_body_fatigue', label: 'Upper body fatigue added (1=none, 10=significant)', type: 'number', min: 1, max: 10 },
        ],
      },
    ],
  },
  {
    phase: 'After',
    types: [
      {
        label: 'Massage Gun',
        fields: [
          { key: 'device', label: 'Device', type: 'text' },
          { key: 'attachment', label: 'Attachment', type: 'select', options: ['Ball', 'Fork', 'Flat'] },
          { key: 'body_region', label: 'Body region', type: 'select', options: ['Quads', 'Hamstrings', 'Calves', 'Back', 'Other'] },
          { key: 'duration_minutes', label: 'Duration (minutes)', type: 'number' },
          { key: 'intensity', label: 'Intensity', type: 'select', options: ['Low', 'Medium', 'High'] },
          { key: 'soreness_before', label: 'Soreness before (1-10)', type: 'number', min: 1, max: 10 },
          { key: 'soreness_after', label: 'Soreness after (1-10)', type: 'number', min: 1, max: 10 },
        ],
      },
      {
        label: 'Normatec / Pneumatic Compression',
        fields: [
          { key: 'region', label: 'Region', type: 'select', options: ['Legs', 'Hips', 'Arms', 'Full Leg'] },
          { key: 'pressure_setting', label: 'Pressure setting', type: 'text' },
          { key: 'duration_minutes', label: 'Duration (minutes)', type: 'number' },
          { key: 'timing_post_effort', label: 'Timing post-effort', type: 'select', options: ['Immediate', '2hr', 'Pre-Sleep'] },
          { key: 'recovery_feel', label: 'Recovery feel (1-10)', type: 'number', min: 1, max: 10 },
        ],
      },
      {
        label: 'Ice Bath / Cold Immersion',
        fields: [
          { key: 'temperature_f', label: 'Temperature (F)', type: 'number' },
          { key: 'duration_minutes', label: 'Duration (minutes)', type: 'number' },
          { key: 'timing_post_effort_minutes', label: 'Timing post-effort (minutes after finishing)', type: 'number' },
          { key: 'soreness_before', label: 'Soreness before (1-10)', type: 'number', min: 1, max: 10 },
          { key: 'soreness_after', label: 'Soreness after (1-10)', type: 'number', min: 1, max: 10 },
          { key: 'perceived_recovery', label: 'Perceived recovery (1-10)', type: 'number', min: 1, max: 10 },
        ],
      },
      {
        label: 'Contrast Therapy',
        fields: [
          { key: 'hot_protocol', label: 'Hot temperature / duration', type: 'text' },
          { key: 'cold_protocol', label: 'Cold temperature / duration', type: 'text' },
          { key: 'rounds_completed', label: 'Rounds completed', type: 'number' },
          { key: 'perceived_recovery', label: 'Perceived recovery (1-10)', type: 'number', min: 1, max: 10 },
        ],
      },
      {
        label: 'Sauna - Recovery',
        fields: [
          { key: 'temperature_f', label: 'Temperature (F)', type: 'number' },
          { key: 'duration_minutes', label: 'Duration (minutes)', type: 'number' },
          { key: 'timing_post_effort_hours', label: 'Timing post-effort (hours after)', type: 'number', step: '0.1' },
          { key: 'perceived_recovery', label: 'Perceived recovery (1-10)', type: 'number', min: 1, max: 10 },
          { key: 'sleep_quality_that_night', label: 'Sleep quality that night (1-10)', type: 'number', min: 1, max: 10 },
        ],
      },
      {
        label: 'Compression Garments',
        fields: [
          { key: 'type', label: 'Type', type: 'select', options: ['Socks', 'Tights', 'Full Leg Sleeves'] },
          { key: 'duration_worn_hours', label: 'Duration worn (hours)', type: 'number', step: '0.1' },
          { key: 'timing', label: 'Timing', type: 'select', options: ['Immediate Post', 'Overnight'] },
          { key: 'perceived_recovery', label: 'Perceived recovery (1-10)', type: 'number', min: 1, max: 10 },
        ],
      },
      {
        label: 'Elevation / Legs Up',
        fields: [
          { key: 'duration_minutes', label: 'Duration (minutes)', type: 'number' },
          { key: 'timing_post_effort', label: 'Timing post-effort', type: 'text' },
          { key: 'perceived_recovery', label: 'Perceived recovery (1-10)', type: 'number', min: 1, max: 10 },
        ],
      },
      {
        label: 'Stretching / Mobility',
        fields: [
          { key: 'type', label: 'Type', type: 'select', options: ['Static', 'Dynamic', 'PNF', 'Yoga'] },
          { key: 'duration_minutes', label: 'Duration (minutes)', type: 'number' },
          { key: 'focus_area', label: 'Focus area', type: 'text' },
          { key: 'perceived_benefit', label: 'Perceived benefit (1-10)', type: 'number', min: 1, max: 10 },
        ],
      },
      {
        label: 'Foam Rolling',
        fields: [
          { key: 'body_region', label: 'Body region', type: 'text' },
          { key: 'duration_minutes', label: 'Duration (minutes)', type: 'number' },
          { key: 'intensity', label: 'Intensity', type: 'select', options: ['Light', 'Moderate', 'Aggressive'] },
          { key: 'soreness_before', label: 'Soreness before (1-10)', type: 'number', min: 1, max: 10 },
          { key: 'soreness_after', label: 'Soreness after (1-10)', type: 'number', min: 1, max: 10 },
        ],
      },
      {
        label: 'Custom Intervention',
        fields: [
          { key: 'name', label: 'Name', type: 'text' },
          { key: 'phase', label: 'Phase', type: 'select', options: ['Before', 'During', 'After'] },
          { key: 'key_metric', label: 'Key metric', type: 'text' },
          { key: 'response', label: 'Response (1-10)', type: 'number', min: 1, max: 10 },
        ],
      },
    ],
  },
];

const allInterventionDefinitions = interventionCatalog.flatMap((group) =>
  group.types.map((type) => ({ ...type, phase: group.phase }))
);

const interventionIcons = {
  'Workout Check-in': '📋',
  'Heat Acclimation': '🔥',
  'Altitude Acclimatization': '⛰️',
  'Respiratory Training': '🫁',
  'Gut Training': '🥤',
  'Sodium Bicarbonate - Loading Protocol': '🧪',
  'Caffeine Cycling / Washout': '☕',
  'Carbohydrate Loading': '🍚',
  'Cold Exposure - Adaptation Protocol': '🧊',
  'BFR - Strength Maintenance': '🩸',
  'Sleep Protocol': '🌙',
  'Fueling - Mid-Effort': '⚡',
  'Hydration and Electrolytes': '💧',
  'Caffeine - Mid-Effort': '🚀',
  'Sodium Bicarbonate - Acute Race Use': '🧫',
  'Cooling Strategy': '❄️',
  'Trekking Poles': '🥢',
  'Massage Gun': '🔧',
  'Normatec / Pneumatic Compression': '🦵',
  'Ice Bath / Cold Immersion': '🛁',
  'Contrast Therapy': '♨️',
  'Sauna - Recovery': '🧖',
  'Compression Garments': '🧦',
  'Elevation / Legs Up': '🛋️',
  'Stretching / Mobility': '🤸',
  'Foam Rolling': '🌀',
  'Custom Intervention': '✍️',
};

export function getInterventionDefinition(interventionType) {
  return allInterventionDefinitions.find((type) => type.label === interventionType) || null;
}

export function getAllInterventionDefinitions() {
  return allInterventionDefinitions;
}

export function getInterventionIcon(interventionType) {
  return interventionIcons[interventionType] || '•';
}

export function createProtocolPayload(interventionType, existingPayload = {}) {
  const definition = getInterventionDefinition(interventionType);
  if (!definition) return existingPayload || {};

  return definition.fields.reduce((payload, field) => {
    const existingValue = existingPayload?.[field.key];
    if (field.type === 'multiselect') {
      payload[field.key] = Array.isArray(existingValue) ? existingValue : [];
      return payload;
    }

    if (field.type === 'boolean') {
      payload[field.key] = typeof existingValue === 'boolean' ? existingValue : '';
      return payload;
    }

    payload[field.key] = existingValue ?? '';
    return payload;
  }, {});
}

export function normalizeProtocolPayload(interventionType, payload = {}) {
  const definition = getInterventionDefinition(interventionType);
  if (!definition) return {};

  return definition.fields.reduce((normalized, field) => {
    const value = payload?.[field.key];

    if (field.type === 'multiselect') {
      normalized[field.key] = Array.isArray(value) ? value : [];
      return normalized;
    }

    if (field.type === 'boolean') {
      normalized[field.key] = typeof value === 'boolean' ? value : value === '' ? '' : Boolean(value);
      return normalized;
    }

    normalized[field.key] = value ?? '';
    return normalized;
  }, {});
}

export function inferLegacyScores(interventionType, protocolPayload = {}) {
  const giResponse =
    protocolPayload.gi_response === '' || protocolPayload.gi_response === undefined
      ? null
      : Number(protocolPayload.gi_response);

  const subjectiveCandidates = [
    protocolPayload.energy_feel,
    protocolPayload.response,
    protocolPayload.sleep_quality,
    protocolPayload.energy_impact,
    protocolPayload.perceived_alertness_boost,
    protocolPayload.sleep_quality_that_night,
  ];

  const physicalCandidates = [
    protocolPayload.legs_feel,
    protocolPayload.performance_feel,
    protocolPayload.perceived_benefit,
    protocolPayload.energy_consistency,
    protocolPayload.perceived_buffering_benefit,
    protocolPayload.perceived_cooling_benefit,
    protocolPayload.recovery_feel,
    protocolPayload.perceived_recovery,
    protocolPayload.perceived_effort,
    protocolPayload.efficiency_feel,
  ];

  const subjectiveFeel =
    subjectiveCandidates.find((value) => value !== '' && value !== undefined && value !== null) ?? null;
  const physicalResponse =
    physicalCandidates.find((value) => value !== '' && value !== undefined && value !== null) ?? null;

  let doseDuration = '';
  let timing = '';
  let details = '';

  if (interventionType === 'Sauna - Recovery' || interventionType === 'Heat Acclimation') {
    doseDuration = protocolPayload.duration_minutes ? `${protocolPayload.duration_minutes} min` : '';
    timing = protocolPayload.timing || '';
    details = [protocolPayload.method, protocolPayload.temperature_f ? `${protocolPayload.temperature_f}F` : '']
      .filter(Boolean)
      .join(' - ');
  } else if (interventionType === 'Altitude Acclimatization') {
    doseDuration = protocolPayload.exposure_hours_per_day ? `${protocolPayload.exposure_hours_per_day} hr/day` : '';
    details = [protocolPayload.method, protocolPayload.elevation_ft ? `${protocolPayload.elevation_ft} ft` : '']
      .filter(Boolean)
      .join(' - ');
  } else if (interventionType?.includes('Sodium Bicarbonate')) {
    doseDuration = protocolPayload.dose || protocolPayload.dose_grams || '';
    timing =
      protocolPayload.timing_minutes_before_effort ||
      protocolPayload.timing_minutes_before_effort_start
        ? `${protocolPayload.timing_minutes_before_effort || protocolPayload.timing_minutes_before_effort_start} min`
        : '';
    details = protocolPayload.delivery || '';
  } else if (interventionType === 'Fueling - Mid-Effort') {
    doseDuration = protocolPayload.carb_intake_g_per_hr ? `${protocolPayload.carb_intake_g_per_hr} g/hr` : '';
    timing = 'During workout';
    details = Array.isArray(protocolPayload.sources) ? protocolPayload.sources.join(', ') : '';
  }

  return {
    gi_response: Number.isNaN(giResponse) ? null : giResponse,
    physical_response:
      physicalResponse === null || Number.isNaN(Number(physicalResponse)) ? null : Number(physicalResponse),
    subjective_feel:
      subjectiveFeel === null || Number.isNaN(Number(subjectiveFeel)) ? null : Number(subjectiveFeel),
    dose_duration: doseDuration || null,
    timing: timing || null,
    details: details || null,
  };
}

export function buildProtocolSummary(interventionType, protocolPayload = {}) {
  if (!interventionType) return 'No protocol details';

  const payload = protocolPayload || {};
  const parts = [];

  switch (interventionType) {
    case 'Workout Check-in':
      if (payload.session_type) parts.push(payload.session_type);
      if (payload.duration_minutes) parts.push(`${payload.duration_minutes} min`);
      if (payload.legs_feel) parts.push(`Legs ${payload.legs_feel}/10`);
      if (payload.energy_feel) parts.push(`Energy ${payload.energy_feel}/10`);
      break;
    case 'Heat Acclimation':
      if (payload.method) parts.push(payload.method);
      if (payload.temperature_f) parts.push(`${payload.temperature_f}F`);
      if (payload.duration_minutes) parts.push(`${payload.duration_minutes} min`);
      break;
    case 'Altitude Acclimatization':
      if (payload.method) parts.push(payload.method);
      if (payload.elevation_ft) parts.push(`${payload.elevation_ft} ft`);
      if (payload.exposure_hours_per_day) parts.push(`${payload.exposure_hours_per_day} hr/day`);
      break;
    case 'Respiratory Training':
      if (payload.device) parts.push(payload.device);
      if (payload.duration_minutes) parts.push(`${payload.duration_minutes} min`);
      if (payload.week_in_block) parts.push(`Week ${payload.week_in_block}`);
      break;
    case 'Gut Training':
      if (payload.carb_actual_g_per_hr) parts.push(`${payload.carb_actual_g_per_hr} g/hr`);
      if (payload.session_duration_hours) parts.push(`${payload.session_duration_hours} hr`);
      if (payload.gi_response) parts.push(`GI ${payload.gi_response}`);
      break;
    case 'Sodium Bicarbonate - Loading Protocol':
    case 'Sodium Bicarbonate - Acute Race Use':
      if (payload.dose || payload.dose_grams) parts.push(`${payload.dose || payload.dose_grams}`);
      if (payload.timing_minutes_before_effort || payload.timing_minutes_before_effort_start) {
        parts.push(
          `${payload.timing_minutes_before_effort || payload.timing_minutes_before_effort_start} min pre`
        );
      }
      if (payload.delivery) parts.push(payload.delivery);
      break;
    case 'Caffeine Cycling / Washout':
      if (payload.days_caffeine_free) parts.push(`${payload.days_caffeine_free} days off`);
      if (payload.usual_daily_intake_mg) parts.push(`${payload.usual_daily_intake_mg} mg baseline`);
      break;
    case 'Carbohydrate Loading':
      if (payload.daily_carb_actual_g_per_kg) parts.push(`${payload.daily_carb_actual_g_per_kg} g/kg`);
      if (payload.duration_days) parts.push(`${payload.duration_days} days`);
      break;
    case 'Cold Exposure - Adaptation Protocol':
      if (payload.method) parts.push(payload.method);
      if (payload.temperature_f) parts.push(`${payload.temperature_f}F`);
      if (payload.duration_minutes) parts.push(`${payload.duration_minutes} min`);
      break;
    case 'BFR - Strength Maintenance':
      if (payload.limb) parts.push(payload.limb);
      if (payload.cuff_pressure) parts.push(payload.cuff_pressure);
      if (payload.protocol_sets_reps) parts.push(payload.protocol_sets_reps);
      break;
    case 'Sleep Protocol':
      if (payload.hours_slept) parts.push(`${payload.hours_slept} hr`);
      if (payload.quality) parts.push(`Quality ${payload.quality}`);
      if (Array.isArray(payload.interventions_used) && payload.interventions_used.length) {
        parts.push(payload.interventions_used.join(', '));
      }
      break;
    case 'Fueling - Mid-Effort':
      if (payload.carb_intake_g_per_hr) parts.push(`${payload.carb_intake_g_per_hr} g/hr`);
      if (Array.isArray(payload.sources) && payload.sources.length) parts.push(payload.sources.join(', '));
      if (payload.energy_consistency) parts.push(`Energy ${payload.energy_consistency}`);
      break;
    case 'Hydration and Electrolytes':
      if (payload.fluid_intake) parts.push(payload.fluid_intake);
      if (payload.sodium_intake_mg_per_hr) parts.push(`${payload.sodium_intake_mg_per_hr} mg/hr`);
      if (payload.cramping !== '' && payload.cramping !== undefined) parts.push(payload.cramping ? 'Cramping' : 'No cramping');
      break;
    case 'Caffeine - Mid-Effort':
      if (payload.dose_mg) parts.push(`${payload.dose_mg} mg`);
      if (payload.form) parts.push(payload.form);
      if (payload.timing_hour_of_effort) parts.push(`Hour ${payload.timing_hour_of_effort}`);
      break;
    case 'Cooling Strategy':
      if (payload.method) parts.push(payload.method);
      if (payload.ambient_temperature_f) parts.push(`${payload.ambient_temperature_f}F`);
      if (payload.duration_of_use) parts.push(payload.duration_of_use);
      break;
    case 'Trekking Poles':
      if (payload.terrain_type) parts.push(payload.terrain_type);
      if (payload.duration_hours) parts.push(`${payload.duration_hours} hr`);
      if (payload.avg_hr_bpm) parts.push(`${payload.avg_hr_bpm} bpm`);
      if (payload.efficiency_feel) parts.push(`Efficiency ${payload.efficiency_feel}/10`);
      break;
    case 'Massage Gun':
      if (payload.body_region) parts.push(payload.body_region);
      if (payload.duration_minutes) parts.push(`${payload.duration_minutes} min`);
      if (payload.intensity) parts.push(payload.intensity);
      break;
    case 'Normatec / Pneumatic Compression':
      if (payload.region) parts.push(payload.region);
      if (payload.duration_minutes) parts.push(`${payload.duration_minutes} min`);
      if (payload.timing_post_effort) parts.push(payload.timing_post_effort);
      break;
    case 'Ice Bath / Cold Immersion':
      if (payload.temperature_f) parts.push(`${payload.temperature_f}F`);
      if (payload.duration_minutes) parts.push(`${payload.duration_minutes} min`);
      if (payload.perceived_recovery) parts.push(`Recovery ${payload.perceived_recovery}`);
      break;
    case 'Contrast Therapy':
      if (payload.hot_protocol) parts.push(`Hot ${payload.hot_protocol}`);
      if (payload.cold_protocol) parts.push(`Cold ${payload.cold_protocol}`);
      if (payload.rounds_completed) parts.push(`${payload.rounds_completed} rounds`);
      break;
    case 'Sauna - Recovery':
      if (payload.temperature_f) parts.push(`${payload.temperature_f}F`);
      if (payload.duration_minutes) parts.push(`${payload.duration_minutes} min`);
      if (payload.perceived_recovery) parts.push(`Recovery ${payload.perceived_recovery}`);
      break;
    case 'Compression Garments':
      if (payload.type) parts.push(payload.type);
      if (payload.duration_worn_hours) parts.push(`${payload.duration_worn_hours} hr`);
      if (payload.timing) parts.push(payload.timing);
      break;
    case 'Elevation / Legs Up':
      if (payload.duration_minutes) parts.push(`${payload.duration_minutes} min`);
      if (payload.timing_post_effort) parts.push(payload.timing_post_effort);
      break;
    case 'Stretching / Mobility':
      if (payload.type) parts.push(payload.type);
      if (payload.duration_minutes) parts.push(`${payload.duration_minutes} min`);
      if (payload.focus_area) parts.push(payload.focus_area);
      break;
    case 'Foam Rolling':
      if (payload.body_region) parts.push(payload.body_region);
      if (payload.duration_minutes) parts.push(`${payload.duration_minutes} min`);
      if (payload.intensity) parts.push(payload.intensity);
      break;
    case 'Custom Intervention':
      if (payload.name) parts.push(payload.name);
      if (payload.phase) parts.push(payload.phase);
      if (payload.key_metric) parts.push(payload.key_metric);
      break;
    default:
      break;
  }

  if (!parts.length) {
    const fallback = [payload.method, payload.device, payload.type, payload.dose, payload.duration_minutes]
      .filter(Boolean)
      .map((value) => String(value));
    return fallback.join(' / ') || 'No protocol details';
  }

  return parts.join(' / ');
}
