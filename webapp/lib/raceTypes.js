// Running
export const RACE_TYPE_RUNNING = [
  '1 Mile / 1500m',
  '3K / 5K',
  '10K',
  'Half Marathon',
  'Marathon',
  '50K+',
];

// Cycling
export const RACE_TYPE_CYCLING = [
  'Gravel',
  'Road Cycling',
  'Mountain Bike',
  'Cyclocross',
];

// Multi-sport
export const RACE_TYPE_MULTISPORT = [
  'Sprint Triathlon',
  'Olympic Triathlon',
  'Half-Distance Triathlon',
  'Full-Distance Triathlon',
  'XTERRA Triathlon',
  'Duathlon',
  'Aquabike',
];

// Aquatic
export const RACE_TYPE_AQUATIC = [
  'Pool Swim (Sprint)',
  'Pool Swim (Middle Distance)',
  'Pool Swim (Distance)',
  'Open Water Swim (1K-3K)',
  'Open Water Swim (5K)',
  'Open Water Swim (10K+)',
  'Rowing (500m)',
  'Rowing (1K)',
  'Rowing (2K)',
  'Rowing (Head Race)',
  'Paddling Race',
];

// Winter / Ice
export const RACE_TYPE_WINTER = [
  'Speed Skating (Sprint)',
  'Speed Skating (Middle)',
  'Speed Skating (Long)',
  'Speed Skating (Mass Start)',
  'Nordic Ski Race (Sprint)',
  'Nordic Ski Race (10K-15K)',
  'Nordic Ski Race (30K-50K)',
  'Biathlon Race',
  'Alpine Ski Race',
  'Snowshoe Race',
];

// Team / field sports
export const RACE_TYPE_TEAM = [
  'Soccer Season',
  'Lacrosse Season',
  'Basketball Season',
  'Volleyball Season',
  'Team Sport Tournament',
];

export const raceTypeOptions = [
  ...RACE_TYPE_RUNNING,
  ...RACE_TYPE_CYCLING,
  ...RACE_TYPE_MULTISPORT,
  ...RACE_TYPE_AQUATIC,
  ...RACE_TYPE_WINTER,
  ...RACE_TYPE_TEAM,
  'Other',
];

export function deriveRaceType(distanceMiles, surface = '') {
  const distance = Number(distanceMiles);
  const normalizedSurface = String(surface || '').toLowerCase();

  if (normalizedSurface === 'gravel') return 'Gravel';
  if (normalizedSurface === 'mountain bike' || normalizedSurface === 'mtb') return 'Mountain Bike';
  if (normalizedSurface === 'cyclocross') return 'Cyclocross';
  if (Number.isNaN(distance) || distance <= 0) return '';
  if (distance <= 1.2) return '1 Mile / 1500m';
  if (distance <= 3.5) return '3K / 5K';
  if (distance <= 10) return '10K';
  if (distance <= 13.5) return 'Half Marathon';
  if (distance <= 27) return 'Marathon';
  return '50K+';
}

export function getRaceTypeLabel(race = {}) {
  return race.race_type || deriveRaceType(race.distance_miles, race.surface) || 'Not set';
}
