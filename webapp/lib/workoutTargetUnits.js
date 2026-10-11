const KM_PER_MILE = 1.609344;

export function targetUnitLabel(targetType, distanceUnit = 'mi') {
  switch (targetType) {
    case 'pace': return distanceUnit === 'km' ? 'min/km' : 'min/mi';
    case 'heart_rate': return 'bpm';
    case 'power': return 'W';
    case 'zone': return 'zone';
    case 'rpe': return 'RPE';
    default: return '';
  }
}

// A prescription owns its units. Only legacy steps without the property need
// an initial default; explicit null, empty, custom units and numeric bounds survive.
export function initializeTargetUnits(structure, distanceUnit) {
  return (structure || []).map(step => Object.hasOwn(step, 'target_units') ? step :
    {...step, target_units: targetUnitLabel(step.target_type || 'open', distanceUnit)});
}

function paceMinutes(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === 'string') {
    const text = value.trim();
    if (/^\d+(?:\.\d+)?$/.test(text)) return Number(text);
    const clock = /^(\d+):([0-5]\d(?:\.\d+)?)$/.exec(text);
    if (clock) return Number(clock[1]) + Number(clock[2]) / 60;
  }
  throw new Error('Enter a numeric pace or minutes:seconds before converting its unit.');
}

// This is a deliberate conversion of the pace itself, independent of the
// planned total distance. Decimal minutes avoid rounding a stored prescription.
export function convertPaceTarget(step, nextUnit) {
  if (step.target_units === nextUnit) return step;
  const units = ['min/km', 'min/mi'];
  if (step.target_type !== 'pace' || !units.includes(step.target_units) || !units.includes(nextUnit)) {
    throw new Error('This pace unit cannot be converted automatically.');
  }
  const factor = nextUnit === 'min/mi' ? KM_PER_MILE : 1 / KM_PER_MILE;
  const convert = value => {
    if (value == null || value === '') return value;
    const converted = paceMinutes(value) * factor;
    if (!Number.isFinite(converted)) throw new Error('Enter a finite pace before converting its unit.');
    return converted;
  };
  return {...step, target_units: nextUnit, target_min: convert(step.target_min), target_max: convert(step.target_max)};
}
