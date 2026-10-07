const PREFIX = 'threshold:message-draft:v1:';
const TTL = 30 * 24 * 60 * 60 * 1000;

// Identity comes from the authenticated conversation response, never the URL.
export function messageDraftKey(actorId, role, conversation) {
  if (!actorId || !['coach', 'athlete'].includes(role) || !conversation?.coach_id || !conversation?.athlete_id) return null;
  return PREFIX + [actorId, role, conversation.coach_id, conversation.athlete_id].map(encodeURIComponent).join(':');
}

export function readMessageDraft(storage, key, now = Date.now()) {
  if (!key) return { draft: null, ok: false };
  try {
    const raw = storage.getItem(key);
    if (!raw) return { draft: null, ok: true };
    const draft = JSON.parse(raw);
    if (typeof draft.body !== 'string' || draft.body.length > 5000 || typeof draft.templateKey !== 'string' ||
        !Number.isFinite(draft.savedAt) || now - draft.savedAt > TTL) {
      storage.removeItem(key); return { draft: null, ok: true };
    }
    if (draft.retry && (typeof draft.retry.id !== 'string' || typeof draft.retry.signature !== 'string')) draft.retry = null;
    return { draft, ok: true };
  } catch { return { draft: null, ok: false }; }
}

export function writeMessageDraft(storage, key, draft, now = Date.now()) {
  if (!key) return false;
  try {
    if (!draft.body && !draft.retry) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify({ ...draft, savedAt: now }));
    return true;
  } catch { return false; }
}

export function browserDraftStorage() {
  try { return window.localStorage; } catch { return null; }
}

export function clearSentDraft(storage, key, retryId) {
  const { draft, ok } = readMessageDraft(storage, key);
  // Another tab may have saved newer text while this request was in flight.
  if (!ok || draft?.retry?.id !== retryId) return false;
  return writeMessageDraft(storage, key, { body: '', templateKey: draft.templateKey, retry: null });
}
