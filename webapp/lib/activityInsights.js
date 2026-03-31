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

function getMetricValue(activity, metric) {
  switch (metric) {
    case 'elevation':
      return metersToFeet(activity.total_elevation_gain);
    case 'hours':
      return secondsToHours(activity.moving_time);
    case 'count':
      return 1;
    case 'mileage':
    default:
      return metersToMiles(activity.distance);
  }
}

function formatBucketLabel(dateLike, withYear = false) {
  return new Date(dateLike).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

export function buildTrendSeries(activities = [], timeframe = 30, metric = 'mileage') {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (timeframe - 1));

  if (timeframe === 90) {
    const weekStart = new Date(start);
    const day = weekStart.getDay();
    const diff = (day + 6) % 7;
    weekStart.setDate(weekStart.getDate() - diff);

    const buckets = [];
    const cursor = new Date(weekStart);

    while (cursor <= now) {
      const bucketStart = new Date(cursor);
      const bucketEnd = new Date(cursor);
      bucketEnd.setDate(bucketEnd.getDate() + 6);

      const clampedStart = bucketStart < start ? new Date(start) : bucketStart;
      const clampedEnd = bucketEnd > now ? new Date(now) : bucketEnd;
      const daySpan = Math.max(
        1,
        Math.floor((clampedEnd.getTime() - clampedStart.getTime()) / (24 * 3600 * 1000)) + 1
      );

      buckets.push({
        key: bucketStart.toISOString().slice(0, 10),
        label: formatBucketLabel(clampedStart),
        periodLabel: `${formatBucketLabel(clampedStart)} - ${formatBucketLabel(clampedEnd)}`,
        rangeStart: clampedStart.toISOString().slice(0, 10),
        rangeEnd: clampedEnd.toISOString().slice(0, 10),
        value: 0,
        totalValue: 0,
        sessionCount: 0,
        daySpan,
        aggregation: 'weeklyAverage',
      });

      cursor.setDate(cursor.getDate() + 7);
    }

    const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

    activities.forEach((activity) => {
      const activityDate = new Date(activity.start_date);
      if (Number.isNaN(activityDate.getTime()) || activityDate < start || activityDate > now) return;

      const key = getWeekKey(activity.start_date);
      const bucket = bucketMap.get(key);
      if (!bucket) return;

      bucket.totalValue += getMetricValue(activity, metric);
      bucket.sessionCount += 1;
    });

    return buckets.map((bucket) => ({
      ...bucket,
      value: bucket.totalValue / bucket.daySpan,
    }));
  }

  const buckets = Array.from({ length: timeframe }).map((_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      key: date.toISOString().slice(0, 10),
      label: formatBucketLabel(date),
      periodLabel: formatBucketLabel(date, true),
      rangeStart: date.toISOString().slice(0, 10),
      rangeEnd: date.toISOString().slice(0, 10),
      value: 0,
      totalValue: 0,
      sessionCount: 0,
      daySpan: 1,
      aggregation: 'daily',
    };
  });

  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  activities.forEach((activity) => {
    const key = activity?.start_date?.slice(0, 10);
    const bucket = bucketMap.get(key);
    if (!bucket) return;

    const value = getMetricValue(activity, metric);
    bucket.value += value;
    bucket.totalValue += value;
    bucket.sessionCount += 1;
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

function getWeekKey(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return null;
  const day = date.getDay();
  const diff = (day + 6) % 7;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - diff);
  return date.toISOString().slice(0, 10);
}

function average(values = []) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildWeeklyMetrics(activities = []) {
  const weeks = new Map();

  activities.forEach((activity) => {
    const weekKey = getWeekKey(activity.start_date);
    if (!weekKey) return;

    if (!weeks.has(weekKey)) {
      weeks.set(weekKey, {
        key: weekKey,
        mileage: 0,
        elevation: 0,
        hours: 0,
        count: 0,
        runHours: 0,
        bikeHours: 0,
        otherHours: 0,
      });
    }

    const bucket = weeks.get(weekKey);
    const hours = secondsToHours(activity.moving_time);
    bucket.mileage += metersToMiles(activity.distance);
    bucket.elevation += metersToFeet(activity.total_elevation_gain);
    bucket.hours += hours;
    bucket.count += 1;

    const type = classifyActivityType(activity);
    if (type.family === 'run') bucket.runHours += hours;
    else if (type.family === 'bike') bucket.bikeHours += hours;
    else bucket.otherHours += hours;
  });

  return [...weeks.values()].sort((a, b) => new Date(a.key).getTime() - new Date(b.key).getTime());
}

export function buildTrainingComparisonCards(activities = [], interventions = []) {
  const weekly = buildWeeklyMetrics(activities);
  const recentWeeks = weekly.slice(-8);
  const lastFourWeeks = weekly.slice(-4);
  const priorFourWeeks = weekly.slice(-8, -4);

  const lastFourMileage = lastFourWeeks.reduce((sum, item) => sum + item.mileage, 0);
  const priorFourMileage = priorFourWeeks.reduce((sum, item) => sum + item.mileage, 0);
  const mileageDelta = lastFourMileage - priorFourMileage;

  const crossTrainingShare = average(
    recentWeeks.map((week) => (week.hours > 0 ? ((week.bikeHours + week.otherHours) / week.hours) * 100 : 0))
  );
  const peakWeek = recentWeeks.reduce(
    (best, week) => (week.mileage > (best?.mileage || 0) ? week : best),
    null
  );

  const interventionsByWeek = interventions.reduce((accumulator, intervention) => {
    const key = getWeekKey(intervention.date || intervention.inserted_at);
    if (!key) return accumulator;
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  const interventionWeeks = recentWeeks.filter((week) => interventionsByWeek[week.key] > 0);
  const nonInterventionWeeks = recentWeeks.filter((week) => !interventionsByWeek[week.key]);
  const interventionWeekMileage = average(interventionWeeks.map((week) => week.mileage));
  const nonInterventionWeekMileage = average(nonInterventionWeeks.map((week) => week.mileage));

  return [
    {
      title: 'Weekly Load Shift',
      body:
        priorFourWeeks.length > 0
          ? `Last 4 weeks averaged ${(lastFourMileage / Math.max(lastFourWeeks.length, 1)).toFixed(1)} mi/week, ${mileageDelta >= 0 ? 'up' : 'down'} ${Math.abs(mileageDelta).toFixed(1)} total miles from the prior 4-week block.`
          : 'Weekly load shift needs at least 8 weeks of history before it becomes meaningful.',
    },
    {
      title: 'Cross-Training Share',
      body:
        recentWeeks.length > 0
          ? `Cross-training currently makes up ${crossTrainingShare.toFixed(0)}% of total training time across the last ${recentWeeks.length} weeks.`
          : 'Cross-training share will appear after a few weeks of activity history.',
    },
    {
      title: 'Peak Week',
      body: peakWeek
        ? `Highest recent load was the week of ${peakWeek.key}: ${peakWeek.mileage.toFixed(1)} miles, ${peakWeek.elevation.toFixed(0)} ft, ${peakWeek.hours.toFixed(1)} hours.`
        : 'Peak-week detection needs more historical activity data.',
    },
    {
      title: 'Intervention Weeks',
      body:
        interventionWeeks.length > 0 && nonInterventionWeeks.length > 0
          ? `Weeks with interventions averaged ${interventionWeekMileage.toFixed(1)} miles versus ${nonInterventionWeekMileage.toFixed(1)} miles in weeks without logged interventions.`
          : 'Intervention-week comparison needs both intervention and non-intervention weeks in the current history window.',
    },
  ];
}

export function buildModalitySplitCards(activities = []) {
  const recent = activities.slice(0, 40);
  const grouped = recent.reduce(
    (accumulator, activity) => {
      const type = classifyActivityType(activity);
      const hours = secondsToHours(activity.moving_time);

      if (type.family === 'run') accumulator.run += hours;
      else if (type.family === 'bike') accumulator.bike += hours;
      else accumulator.other += hours;

      return accumulator;
    },
    { run: 0, bike: 0, other: 0 }
  );

  const total = grouped.run + grouped.bike + grouped.other;
  const longestRun = recent
    .filter((activity) => classifyActivityType(activity).family === 'run')
    .reduce((best, activity) => {
      const miles = metersToMiles(activity.distance);
      return miles > (best?.miles || 0) ? { miles, date: activity.start_date.slice(0, 10) } : best;
    }, null);

  return [
    {
      title: 'Run / Bike Mix',
      body:
        total > 0
          ? `Recent training time is ${(grouped.run / total * 100).toFixed(0)}% run, ${(grouped.bike / total * 100).toFixed(0)}% bike, and ${(grouped.other / total * 100).toFixed(0)}% other.`
          : 'Modality mix will appear once recent sessions are available.',
    },
    {
      title: 'Longest Run Marker',
      body: longestRun
        ? `Longest recent run was ${longestRun.miles.toFixed(1)} miles on ${longestRun.date}.`
        : 'No run sessions are present yet for longest-run tracking.',
    },
  ];
}

function buildAverageResponse(items = [], field) {
  const values = items
    .map((item) => Number(item[field]))
    .filter((value) => !Number.isNaN(value) && value > 0);
  return values.length ? average(values) : 0;
}

function getActivityLookup(activities = []) {
  return new Map(activities.map((activity) => [String(activity.id), activity]));
}

export function buildInterventionContextCards(activities = [], interventions = [], settings = {}) {
  if (!interventions.length) {
    return [
      {
        title: 'Phase Response',
        body: 'No intervention history is available yet for phase-based comparisons.',
      },
      {
        title: 'Workout Context',
        body: 'Workout-type comparisons start once interventions are linked to more sessions.',
      },
      {
        title: 'Race Target',
        body: 'Race-specific analysis appears once interventions accumulate against one recurring target.',
      },
    ];
  }

  const activityLookup = getActivityLookup(activities);
  const enriched = interventions.map((intervention) => {
    const activity = activityLookup.get(String(intervention.activity_id));
    return {
      ...intervention,
      linkedActivity: activity || null,
      linkedType: activity ? classifyActivityType(activity).label : null,
      linkedClassification: activity ? classifyActivity(activity, settings).label : null,
    };
  });

  const bestPhase = Object.entries(
    enriched.reduce((accumulator, intervention) => {
      if (!intervention.training_phase) return accumulator;
      accumulator[intervention.training_phase] = accumulator[intervention.training_phase] || [];
      accumulator[intervention.training_phase].push(intervention);
      return accumulator;
    }, {})
  )
    .filter(([, items]) => items.length >= 2)
    .map(([phase, items]) => ({
      phase,
      count: items.length,
      avgFeel: buildAverageResponse(items, 'subjective_feel'),
    }))
    .sort((a, b) => b.avgFeel - a.avgFeel)[0];

  const bestWorkoutContext = Object.entries(
    enriched.reduce((accumulator, intervention) => {
      if (!intervention.linkedClassification) return accumulator;
      accumulator[intervention.linkedClassification] = accumulator[intervention.linkedClassification] || [];
      accumulator[intervention.linkedClassification].push(intervention);
      return accumulator;
    }, {})
  )
    .filter(([, items]) => items.length >= 2)
    .map(([label, items]) => ({
      label,
      count: items.length,
      avgPhysical: buildAverageResponse(items, 'physical_response'),
    }))
    .sort((a, b) => b.avgPhysical - a.avgPhysical)[0];

  const crossTrainingLinked = enriched.filter((item) => item.linkedType && item.linkedType !== 'Road Run' && item.linkedType !== 'Trail Run');
  const runLinked = enriched.filter((item) => item.linkedType === 'Road Run' || item.linkedType === 'Trail Run');

  const raceLeader = Object.entries(
    enriched.reduce((accumulator, intervention) => {
      const key = intervention.races?.name || intervention.target_race;
      if (!key) return accumulator;
      accumulator[key] = accumulator[key] || [];
      accumulator[key].push(intervention);
      return accumulator;
    }, {})
  )
    .filter(([, items]) => items.length >= 2)
    .map(([race, items]) => ({
      race,
      count: items.length,
      avgFeel: buildAverageResponse(items, 'subjective_feel'),
    }))
    .sort((a, b) => b.count - a.count)[0];

  return [
    {
      title: 'Phase Response',
      body: bestPhase
        ? `${bestPhase.phase} currently has the best subjective response average at ${bestPhase.avgFeel.toFixed(1)}/10 across ${bestPhase.count} logged interventions.`
        : 'Phase-based comparisons need repeated interventions inside the same build phase before the signal is credible.',
    },
    {
      title: 'Workout Context',
      body: bestWorkoutContext
        ? `${bestWorkoutContext.label} is the strongest linked workout context so far, averaging ${bestWorkoutContext.avgPhysical.toFixed(1)}/10 physical response across ${bestWorkoutContext.count} interventions.`
        : 'Workout-context comparisons need more interventions linked to activities before they separate threshold, long-run, and easy-day responses.',
    },
    {
      title: 'Cross-Training Impact',
      body:
        crossTrainingLinked.length > 0 && runLinked.length > 0
          ? `Interventions linked to non-run sessions average ${buildAverageResponse(crossTrainingLinked, 'subjective_feel').toFixed(1)}/10 subjective feel versus ${buildAverageResponse(runLinked, 'subjective_feel').toFixed(1)}/10 when linked to runs.`
          : 'Cross-training impact needs interventions linked to both run and non-run sessions in the current dataset.',
    },
    {
      title: 'Race Target',
      body: raceLeader
        ? `${raceLeader.race} has the deepest intervention history so far with ${raceLeader.count} logs and an average subjective feel of ${raceLeader.avgFeel.toFixed(1)}/10.`
        : 'Race-specific analysis needs multiple interventions pointing at the same target race.',
    },
  ];
}

export function buildInterventionOverlay(interventions = [], timeframe = 30) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (timeframe - 1));

  return interventions.reduce((accumulator, intervention) => {
    const rawKey = (intervention.date || intervention.inserted_at || '').slice(0, 10);
    if (!rawKey) return accumulator;

    const timestamp = new Date(`${rawKey}T00:00:00`);
    if (Number.isNaN(timestamp.getTime()) || timestamp.getTime() < start.getTime()) return accumulator;

    const key = timeframe === 90 ? getWeekKey(rawKey) : rawKey;
    if (!key) return accumulator;

    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});
}

export function buildWeeklyTableRows(activities = [], interventions = []) {
  const weekly = buildWeeklyMetrics(activities);
  const interventionsByWeek = interventions.reduce((accumulator, intervention) => {
    const key = getWeekKey(intervention.date || intervention.inserted_at);
    if (!key) return accumulator;
    accumulator[key] = accumulator[key] || [];
    accumulator[key].push(intervention);
    return accumulator;
  }, {});

  return weekly.slice(-10).reverse().map((week) => ({
    ...week,
    interventions: interventionsByWeek[week.key]?.length || 0,
    runShare: week.hours > 0 ? (week.runHours / week.hours) * 100 : 0,
    bikeShare: week.hours > 0 ? (week.bikeHours / week.hours) * 100 : 0,
  }));
}

export function buildRaceFocusCards(interventions = []) {
  const grouped = Object.entries(
    interventions.reduce((accumulator, intervention) => {
      const key = intervention.races?.name || intervention.target_race;
      if (!key) return accumulator;
      accumulator[key] = accumulator[key] || [];
      accumulator[key].push(intervention);
      return accumulator;
    }, {})
  )
    .map(([race, items]) => ({
      race,
      count: items.length,
      avgFeel: buildAverageResponse(items, 'subjective_feel'),
      avgPhysical: buildAverageResponse(items, 'physical_response'),
      latestDate: items
        .map((item) => item.date || item.inserted_at)
        .filter(Boolean)
        .sort()
        .slice(-1)[0] || null,
    }))
    .sort((a, b) => b.count - a.count);

  const topRace = grouped[0];
  const secondRace = grouped[1];

  if (!topRace) {
    return [
      {
        title: 'Race Focus',
        body: 'Race-specific slices will appear once multiple interventions point at a target race.',
      },
    ];
  }

  return [
    {
      title: 'Primary Race Build',
      body: `${topRace.race} has ${topRace.count} logged interventions, averaging ${topRace.avgFeel.toFixed(1)}/10 subjective feel and ${topRace.avgPhysical.toFixed(1)}/10 physical response.`,
    },
    {
      title: 'Latest Race-linked Activity',
      body: topRace.latestDate
        ? `Most recent intervention tied to ${topRace.race} was logged on ${topRace.latestDate.slice(0, 10)}.`
        : `The ${topRace.race} block has race-linked interventions but no reliable date metadata yet.`,
    },
    ...(secondRace
      ? [
          {
            title: 'Secondary Race Build',
            body: `${secondRace.race} is the next-deepest target with ${secondRace.count} interventions and ${secondRace.avgFeel.toFixed(1)}/10 average feel.`,
          },
        ]
      : []),
  ];
}
