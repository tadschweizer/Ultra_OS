export const MESSAGE_REFRESH_EVENT = 'threshold:messages-changed';
export function notifyMessagesChanged() {
  window.dispatchEvent(new Event(MESSAGE_REFRESH_EVENT));
}

// Acknowledge only messages actually loaded, never a reply arriving in between
// the GET and acknowledgement. Failed writes must leave unread indicators intact.
export async function acknowledgeMessages(messages, role, athleteId) {
  const ids = messages.filter((m) => m.sender_role !== role && !m.read_at).map((m) => m.id);
  if (!ids.length || document.visibilityState === 'hidden') return 0;
  try {
    const response = await fetch('/api/message-center', {
      method: 'POST', signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_read', scope: 'conversation', mode: role, athlete_id: athleteId, message_ids: ids }),
    });
    if (!response.ok) return false;
    const data = await response.json();
    notifyMessagesChanged();
    return Array.isArray(data.conversations) ? { conversations: data.conversations } : ids.length;
  } catch { return false; }
}

export async function acknowledgeComments(comments, role, subject) {
  const ids = comments.filter(c => c.sender_role !== role && !c.read_at).map(c => c.id);
  if (document.visibilityState === 'hidden') return true;
  try {
    for (let offset = 0; offset < ids.length; offset += 100) {
      const response = await fetch('/api/message-center', {
        method: 'POST', signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read', scope: 'workout', mode: role, ...subject, comment_ids: ids.slice(offset, offset + 100) }),
      });
      if (!response.ok) return false;
    }
    if (ids.length) notifyMessagesChanged();
    return true;
  } catch { return false; }
}

export function mergeMessages(previous, incoming) {
  return [...new Map([...previous, ...incoming].map((message) => [message.id, message])).values()]
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || String(a.id).localeCompare(String(b.id)));
}
