export const raceTypeOptions = [
  '1 Mile / 1500m',
  '3K / 5K',
  '10K',
  'Half Marathon',
  'Marathon',
  '50K+',
  'Gravel',
  'Triathlon',
  'Other',
];

export function deriveRaceType(distanceMiles, surface = '') {
  const distance = Number(distanceMiles);
  const normalizedSurface = String(surface || '').toLowerCase();

  if (normalizedSurface === 'gravel') return 'Gravel';
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
