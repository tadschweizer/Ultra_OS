export function getStoredValue(primaryKey, legacyKey = null) {
  if (typeof window === 'undefined') return null;

  const primaryValue = window.localStorage.getItem(primaryKey);
  if (primaryValue !== null) return primaryValue;

  if (!legacyKey) return null;

  const legacyValue = window.localStorage.getItem(legacyKey);
  if (legacyValue !== null) {
    window.localStorage.setItem(primaryKey, legacyValue);
  }
  return legacyValue;
}

export function removeStoredValue(primaryKey, legacyKey = null) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(primaryKey);
  if (legacyKey) {
    window.localStorage.removeItem(legacyKey);
  }
}
