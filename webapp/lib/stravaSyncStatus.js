// Shared public messages. Never persist or expose Axios errors, request headers,
// provider response bodies, token values or a provider's raw error message.
export const STRAVA_SYNC_MESSAGES = {
  reconnect_required: 'Reconnect Strava to resume importing activities.',
  rate_limited: 'Strava has paused requests temporarily. Your saved training is still available.',
  history_limit: 'This history is too large for one import. Contact support for help importing your history.',
  error: 'Activities could not be refreshed. Your saved training is still available. Try again shortly.',
};
export function classifyStravaSyncError(error) {
  const status = error?.response?.status;
  const code = status === 401 || status === 403 ? 'reconnect_required'
    : status === 429 ? 'rate_limited' : error?.code === 'history_limit' ? 'history_limit' : 'error';
  const retry = Number(error?.response?.headers?.['retry-after']);
  return { code, message: STRAVA_SYNC_MESSAGES[code], retrySeconds: code === 'rate_limited'
    ? Math.max(60, Math.min(Number.isFinite(retry) && retry > 0 ? retry : 900, 86400))
    : code === 'reconnect_required' ? 3600 : code === 'history_limit' ? 86400 : 30 };
}
export function publicStravaSyncStatus(athlete) {
  const storedCode = athlete?.last_activity_sync_error;
  const errorCode = storedCode ? (Object.hasOwn(STRAVA_SYNC_MESSAGES, storedCode) ? storedCode : 'error') : null;
  return { connected: Boolean(athlete?.strava_id), lastSyncedAt: athlete?.last_activity_sync_at || null,
    historyImported: Boolean(athlete?.activity_backfill_completed_at), errorCode,
    message: errorCode ? STRAVA_SYNC_MESSAGES[errorCode] : null };
}
