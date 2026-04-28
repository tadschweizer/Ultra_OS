export const DEFAULT_GROUP_COLOR = '#B8752A';

export const COACH_GROUP_COLOR_OPTIONS = [
  '#B8752A',
  '#D4893A',
  '#0F766E',
  '#2563EB',
  '#7C3AED',
  '#BE185D',
  '#D97706',
  '#4D7C0F',
];

function normalizeHexColor(value) {
  const input = String(value || '').trim();
  if (!/^#([0-9a-fA-F]{6})$/.test(input)) {
    return DEFAULT_GROUP_COLOR;
  }
  return input.toUpperCase();
}

function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex).replace('#', '');
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

export function sanitizeCoachGroupName(value) {
  return String(value || '').trim().slice(0, 60);
}

export function sanitizeCoachGroupColor(value) {
  return normalizeHexColor(value);
}

export function getCoachGroupColorStyle(color, variant = 'solid') {
  const safeColor = normalizeHexColor(color);
  const { r, g, b } = hexToRgb(safeColor);

  if (variant === 'soft') {
    return {
      backgroundColor: `rgba(${r}, ${g}, ${b}, 0.14)`,
      borderColor: `rgba(${r}, ${g}, ${b}, 0.24)`,
      color: safeColor,
    };
  }

  if (variant === 'outline') {
    return {
      backgroundColor: 'transparent',
      borderColor: `rgba(${r}, ${g}, ${b}, 0.55)`,
      color: safeColor,
    };
  }

  return {
    backgroundColor: safeColor,
    borderColor: safeColor,
    color: '#FFFFFF',
  };
}

export function decorateCoachGroups(groups = []) {
  return groups.map((group, index) => ({
    ...group,
    name: sanitizeCoachGroupName(group.name),
    color: sanitizeCoachGroupColor(group.color),
    sort_order: Number.isFinite(group.sort_order) ? group.sort_order : index,
  }));
}
