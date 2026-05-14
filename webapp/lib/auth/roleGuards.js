export function hasRole(athlete, role) {
  if (!athlete) return false;
  if (role === 'admin') return Boolean(athlete.is_admin);
  if (role === 'coach') return athlete.subscription_tier === 'coach';
  if (role === 'athlete') return !athlete.is_admin;
  return false;
}

export function requireRole(athlete, role) {
  return hasRole(athlete, role)
    ? { allowed: true }
    : { allowed: false, error: `Requires ${role} access.` };
}
