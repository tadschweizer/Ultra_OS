export const favoriteInterventionStorageKey = 'ultraos-favorite-intervention-types';

export const defaultFavoriteInterventions = [
  'Sauna - Recovery',
  'Gut Training',
  'Sodium Bicarbonate - Loading Protocol',
  'Fueling - Mid-Effort',
];

export const interventionCatalog = [
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

export function getInterventionDefinition(interventionType) {
  return allInterventionDefinitions.find((type) => type.label === interventionType) || null;
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
    protocolPayload.response,
    protocolPayload.energy_feel,
    protocolPayload.sleep_quality,
    protocolPayload.energy_impact,
    protocolPayload.perceived_alertness_boost,
    protocolPayload.sleep_quality_that_night,
  ];

  const physicalCandidates = [
    protocolPayload.performance_feel,
    protocolPayload.perceived_benefit,
    protocolPayload.energy_consistency,
    protocolPayload.perceived_buffering_benefit,
    protocolPayload.perceived_cooling_benefit,
    protocolPayload.recovery_feel,
    protocolPayload.perceived_recovery,
    protocolPayload.perceived_effort,
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

