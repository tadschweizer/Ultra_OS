export function sortActivitiesMostRecentFirst(activities = []) {
  return [...activities].sort(
    (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
  );
}

export function metersToMiles(value) {
  if (!value) return 0;
  return value / 1609.34;
}

export function metersToFeet(value) {
  if (!value) return 0;
  return value * 3.28084;
}

export function secondsToHours(value) {
  if (!value) return 0;
  return value / 3600;
}

function includesAny(text, fragments) {
  return fragments.some((fragment) => text.includes(fragment));
}

export function classifyActivity(activity, settings = {}) {
  const text = `${activity?.name || ''} ${activity?.description || ''}`.toLowerCase();
  const avgHr = activity?.average_heartrate || 0;
  const movingHours = secondsToHours(activity?.moving_time);
  const distanceMiles = metersToMiles(activity?.distance);
  const elevationFeet = metersToFeet(activity?.total_elevation_gain);

  const hrZone2Max = settings?.hr_zone_2_max || 0;
  const hrZone3Min = settings?.hr_zone_3_min || 0;
  const hrZone4Min = settings?.hr_zone_4_min || 0;

  if (
    includesAny(text, ['threshold', 'tempo', 'cruise']) ||
    (avgHr >= hrZone3Min && avgHr < hrZone4Min && movingHours >= 0.5)
  ) {
    return {
      label: 'Threshold',
      reason: 'Tempo/threshold language or sustained HR in your middle-high zones.',
    };
  }

  if (
    includesAny(text, ['interval', 'repeat', 'repetition', 'track', 'vo2']) ||
    avgHr >= hrZone4Min
  ) {
    return {
      label: 'Intervals',
      reason: 'Intervals/repeats language or average HR in your high-intensity zone.',
    };
  }

  if (includesAny(text, ['hill', 'stride', 'climb']) || elevationFeet >= 1500) {
    return {
      label: 'Hill Session',
      reason: 'Detected hill/stride language or materially elevated vertical gain.',
    };
  }

  if (distanceMiles >= 13 || movingHours >= 2) {
    return {
      label: 'Long Run',
      reason: 'Duration or distance reads like a long aerobic session.',
    };
  }

  if (avgHr > 0 && avgHr <= hrZone2Max) {
    return {
      label: 'Easy / Aerobic',
      reason: 'Average HR sits inside your lower aerobic range.',
    };
  }

  return {
    label: 'General Endurance',
    reason: 'No stronger signal yet. Future versions can add workout-description parsing from linked platforms.',
  };
}

export function summarizeRecentTraining(activities = []) {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;
  const recent = activities.filter(
    (activity) => new Date(activity.start_date).getTime() >= sevenDaysAgo
  );

  return recent.reduce(
    (summary, activity) => ({
      activityCount: summary.activityCount + 1,
      mileage: summary.mileage + metersToMiles(activity.distance),
      elevation: summary.elevation + metersToFeet(activity.total_elevation_gain),
      hours: summary.hours + secondsToHours(activity.moving_time),
    }),
    { activityCount: 0, mileage: 0, elevation: 0, hours: 0 }
  );
}

export function buildInsightCards(activities = [], interventionCount = 0, settings = {}) {
  const classified = activities.slice(0, 12).map((activity) => ({
    ...activity,
    classification: classifyActivity(activity, settings),
  }));

  const thresholdCount = classified.filter(
    (activity) => activity.classification.label === 'Threshold'
  ).length;
  const intervalCount = classified.filter(
    (activity) => activity.classification.label === 'Intervals'
  ).length;
  const hillCount = classified.filter(
    (activity) => activity.classification.label === 'Hill Session'
  ).length;

  return [
    {
      title: 'Intervention Coverage',
      body:
        interventionCount > 0
          ? `${interventionCount} interventions are logged. As paired activity + intervention coverage grows, the insight engine can start comparing prep blocks instead of isolated workouts.`
          : 'No interventions are paired yet. The insight engine needs actual protocol coverage before it can make credible claims.',
    },
    {
      title: 'Workout Intent Detection',
      body:
        thresholdCount + intervalCount + hillCount > 0
          ? `Recent sessions show ${thresholdCount} threshold, ${intervalCount} interval, and ${hillCount} hill-oriented workouts by title + HR heuristics.`
          : 'Workout intent is still mostly unclassified. Connecting planned workout descriptions later will make this far more reliable.',
    },
    {
      title: 'Future Parsing Path',
      body:
        'Next layer: ingest planned workout text from connected platforms and merge it with HR, duration, and terrain so UltraOS can distinguish threshold work from easy mileage and hill strides from generic climbs.',
    },
  ];
}
