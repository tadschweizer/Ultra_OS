/**
 * Shared client-side cache for /api/me.
 *
 * Every consumer (OnboardingGate, usePlan, dashboard, calendar pages) reads
 * the same cached payload, so the session profile — including the
 * subscription tier — is fetched once per page load and is available
 * synchronously on every navigation after that. This removes the
 * "locked, then unlocked" flash on plan-gated pages and the duplicate
 * /api/me round-trips that delayed first paint.
 */

const STORAGE_KEY = 'threshold.me.v1';

let memoryCache = null;
let inflight = null;
const listeners = new Set();

function readStorage() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStorage(data) {
  if (typeof window === 'undefined') return;
  try {
    if (data) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage may be unavailable (private mode); memory cache still works.
  }
}

function notify() {
  listeners.forEach((listener) => {
    try {
      listener(memoryCache);
    } catch {
      // A bad listener should not break the others.
    }
  });
}

/** Synchronously returns the cached /api/me payload, or null. */
export function getCachedMe() {
  if (memoryCache) return memoryCache;
  memoryCache = readStorage();
  return memoryCache;
}

/** Seeds the cache (e.g. right after a billing sync) and notifies hooks. */
export function primeMe(data) {
  memoryCache = data || null;
  writeStorage(memoryCache);
  notify();
}

/** Clears the cache — call on logout, login, or when billing changes. */
export function clearMe() {
  memoryCache = null;
  inflight = null;
  writeStorage(null);
  notify();
}

export function subscribeMe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Fetches /api/me, deduping concurrent callers. Resolves with the payload,
 * or null when the session is not authenticated (and clears the cache so
 * stale entitlements never linger past a logout/expiry).
 */
export function fetchMe({ force = false } = {}) {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!force && inflight) return inflight;

  inflight = (async () => {
    try {
      const response = await fetch('/api/me');
      if (!response.ok) {
        if (response.status === 401) clearMe();
        return null;
      }
      const data = await response.json();
      primeMe(data);
      return data;
    } catch {
      // Network hiccup: keep whatever cache we have rather than flickering.
      return getCachedMe();
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
