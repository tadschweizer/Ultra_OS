export function sortActivitiesMostRecentFirst(activities = []) {
  return [...activities].sort(
    (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
  );
}

function normalizeText(value) {
  return (value || '').toString().toLowerCase();
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

export function classifyActivityType(activity = {}) {
  const sportType = normalizeText(activity?.sport_type || activity?.type);
  const text = `${normalizeText(activity?.name)} ${normalizeText(activity?.description)}`;
  const elevationFeet = metersToFeet(activity?.total_elevation_gain);
  const distanceMiles = metersToMiles(activity?.distance);

  if (sportType.includes('virtualride')) {
    return {
      label: 'Virtual Ride',
      family: 'bike',
      reason: 'Strava marked the session as a virtual ride.',
    };
  }

  if (sportType.includes('ride') || sportType.includes('ecycle')) {
    return {
      label: 'Bike Ride',
      family: 'bike',
      reason: 'Strava marked the session as a ride.',
    };
  }

  if (sportType.includes('hike') || sportType.includes('walk')) {
    return {
      label: 'Hike',
      family: 'hike',
      reason: 'Strava marked the session as a hike or walk.',
    };
  }

  if (sportType.includes('trailrun')) {
    return {
      label: 'Trail Run',
      family: 'run',
      reason: 'Strava marked the session as a trail run.',
    };
  }

  if (sportType.includes('run')) {
    if (
      includesAny(text, ['trail', 'singletrack', 'mountain']) ||
      (elevationFeet >= 800 && distanceMiles <= 15)
    ) {
      return {
        label: 'Trail Run',
        family: 'run',
        reason: 'Run activity with trail language or terrain-heavy elevation profile.',
      };
    }

    return {
      label: 'Road Run',
      family: 'run',
      reason: 'Run activity without strong trail signals.',
    };
  }

  return {
    label: activity?.sport_type || activity?.type || 'General Activity',
    family: 'other',
    reason: 'Activity type is being passed through from the source.',
  };
}

export function classifyActivity(activity, settings = {}) {
  const activityType = classifyActivityType(activity);
  const text = `${activity?.name || ''} ${activity?.description || ''}`.toLowerCase();
  const avgHr = activity?.average_heartrate || 0;
  const movingHours = secondsToHours(activity?.moving_time);
  const distanceMiles = metersToMiles(activity?.distance);
  const elevationFeet = metersToFeet(activity?.total_elevation_gain);

  const hrZone2Max = settings?.hr_zone_2_max || 0;
  const hrZone3Min = settings?.hr_zone_3_min || 0;
  const hrZone4Min = settings?.hr_zone_4_min || 0;

  if (activityType.family === 'run') {
    const longRunDistance = activityType.label === 'Trail Run' ? 18 : 13;
    const longRunHours = activityType.label === 'Trail Run' ? 2.75 : 2;

    if (distanceMiles >= longRunDistance || movingHours >= longRunHours) {
      return {
        label: 'Long Run',
        reason: 'Run modality plus duration or distance signals a long run.',
      };
    }
  }

  if (activityType.family === 'bike') {
    if (
      includesAny(text, ['interval', 'repeat', 'vo2', 'over-under']) ||
      avgHr >= hrZone4Min
    ) {
      return {
        label: 'Intervals',
        reason: 'Bike session with repeat language or high average HR.',
      };
    }

    if (
      includesAny(text, ['threshold', 'tempo', 'sweet spot']) ||
      (avgHr >= hrZone3Min && avgHr < hrZone4Min && movingHours >= 0.5)
    ) {
      return {
        label: 'Threshold',
        reason: 'Bike session with threshold language or sustained mid-high HR.',
      };
    }

    if (distanceMiles >= 40 || movingHours >= 2.5) {
      return {
        label: 'Long Ride',
        reason: 'Bike session duration or distance reads like an endurance ride.',
      };
    }

    return {
      label: 'Easy / Aerobic',
      reason: 'Bike session without intensity signals.',
    };
  }

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

export function buildTrendSeries(activities = [], timeframe = 30, metric = 'mileage') {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (timeframe - 1));

  const buckets = Array.from({ length: timeframe }).map((_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      key: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      value: 0,
    };
  });

  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  activities.forEach((activity) => {
    const key = activity?.start_date?.slice(0, 10);
    const bucket = bucketMap.get(key);
    if (!bucket) return;

    switch (metric) {
      case 'elevation':
        bucket.value += metersToFeet(activity.total_elevation_gain);
        break;
      case 'hours':
        bucket.value += secondsToHours(activity.moving_time);
        break;
      case 'count':
        bucket.value += 1;
        break;
      case 'mileage':
      default:
        bucket.value += metersToMiles(activity.distance);
        break;
    }
  });

  return buckets;
}

export function buildInsightCards(activities = [], interventionCount = 0, settings = {}) {
  const classified = activities.slice(0, 12).map((activity) => ({
    ...activity,
    classification: classifyActivity(activity, settings),
    activityType: classifyActivityType(activity),
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
  const trailRunCount = classified.filter(
    (activity) => activity.activityType.label === 'Trail Run'
  ).length;
  const bikeRideCount = classified.filter(
    (activity) => activity.activityType.family === 'bike'
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
      title: 'Activity Type Read',
      body:
        trailRunCount + bikeRideCount > 0
          ? `Recent training includes ${trailRunCount} trail runs and ${bikeRideCount} bike-oriented sessions, so intervention review can start separating modality instead of treating everything like generic mileage.`
          : 'Activity modality is now being inferred from Strava sport type plus terrain signals. The next step is making this durable across every connected platform.',
    },
    {
      title: 'Future Parsing Path',
      body:
        'Next layer: ingest planned workout text from connected platforms and merge it with HR, duration, and terrain so UltraOS can distinguish threshold work from easy mileage and hill strides from generic climbs.',
    },
  ];
}

export function buildProtocolTrendCards(interventions = [], supplements = []) {
  const completeInterventions = interventions.filter((item) => item.intervention_type);
  const supplementCount = supplements.filter((item) => item.supplement_name || item.amount).length;

  if (completeInterventions.length === 0) {
    return [
      {
        title: 'Protocol Signal',
        body: 'No intervention history is available yet. Once entries accumulate, UltraOS can compare type, timing, and subjective response instead of only counting logs.',
      },
      {
        title: 'Baseline Stack',
        body:
          supplementCount > 0
            ? `${supplementCount} baseline supplements are tracked. Trend detection will use that stack as the non-intervention background state.`
            : 'No baseline supplements are tracked yet, so future supplement-vs-intervention comparisons still lack a default stack.',
      },
    ];
  }

  const groupedByType = completeInterventions.reduce((accumulator, intervention) => {
    const key = intervention.intervention_type;
    accumulator[key] = accumulator[key] || [];
    accumulator[key].push(intervention);
    return accumulator;
  }, {});

  const bestType = Object.entries(groupedByType)
    .filter(([, items]) => items.length >= 2)
    .map(([type, items]) => ({
      type,
      count: items.length,
      avgFeel:
        items.reduce((sum, item) => sum + Number(item.subjective_feel || 0), 0) /
        Math.max(items.filter((item) => item.subjective_feel !== null && item.subjective_feel !== undefined).length, 1),
    }))
    .sort((a, b) => b.avgFeel - a.avgFeel)[0];

  const bestTiming = Object.entries(
    completeInterventions.reduce((accumulator, intervention) => {
      if (!intervention.timing) return accumulator;
      accumulator[intervention.timing] = accumulator[intervention.timing] || [];
      accumulator[intervention.timing].push(intervention);
      return accumulator;
    }, {})
  )
    .filter(([, items]) => items.length >= 2)
    .map(([timing, items]) => ({
      timing,
      avgPhysical:
        items.reduce((sum, item) => sum + Number(item.physical_response || 0), 0) /
        Math.max(items.filter((item) => item.physical_response !== null && item.physical_response !== undefined).length, 1),
    }))
    .sort((a, b) => b.avgPhysical - a.avgPhysical)[0];

  return [
    {
      title: 'Best Early Signal',
      body: bestType
        ? `${bestType.type} is the strongest early signal so far, averaging ${bestType.avgFeel.toFixed(1)}/10 subjective feel across ${bestType.count} logs.`
        : 'You have intervention history, but no protocol type has enough repeated entries yet to rank credibly.',
    },
    {
      title: 'Timing Read',
      body: bestTiming
        ? `${bestTiming.timing} currently has the best physical-response average at ${bestTiming.avgPhysical.toFixed(1)}/10.`
        : 'Timing data is still too sparse to distinguish pre-workout, post-workout, or race-week effects.',
    },
    {
      title: 'Baseline Stack',
      body:
        supplementCount > 0
          ? `${supplementCount} baseline supplements are tracked. That baseline is now available for separating routine intake from one-off interventions.`
          : 'No baseline supplement stack is saved yet, so supplement-related patterns are still mixed with intervention events.',
    },
  ];
}
