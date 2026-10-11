import { validWorkoutRequestId } from './workoutValidation.js';

const STORAGE_KEY = 'threshold.calendar-copy.v1';
// Keep an uncertain operation across reloads. Only a confirmed successful write
// releases its key; the next deliberate click then starts a new copy operation.
export function createCopyWeekRequests({ storage, randomUUID = () => crypto.randomUUID(), scope } = {}) {
  let pending = {};
  try { pending = JSON.parse(storage?.getItem(STORAGE_KEY) || '{}'); } catch { /* Memory still fences retries. */ }
  if (!pending || Array.isArray(pending) || typeof pending !== 'object') pending = {};
  const save = () => { try { storage?.setItem(STORAGE_KEY, JSON.stringify(pending)); } catch { /* Keep memory state. */ } };
  const key = (body) => JSON.stringify([scope, body.athlete_id || 'self', body.from_week_start, body.to_week_start]);
  return {
    begin(body) {
      const k = key(body);
      if (!validWorkoutRequestId(pending[k])) { pending[k] = randomUUID(); save(); }
      return { ...body, client_request_id: pending[k] };
    },
    complete(body) { const k=key(body); if (pending[k] === body.client_request_id) { delete pending[k]; save(); } },
  };
}
