export const MESSAGE_PAGE_SIZE = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseMessageCursor(value) {
  if (!value) return null;
  if (typeof value !== 'string') throw new Error('Invalid message cursor');
  const parts = value.split('|');
  if (parts.length !== 2) throw new Error('Invalid message cursor');
  const [time, id] = parts;
  if (!/^\d{4}-\d{2}-\d{2}T[0-9:.+-]+Z?$/.test(time) || !Number.isFinite(Date.parse(time)) || !UUID.test(id)) throw new Error('Invalid message cursor');
  return { time, id };
}

export async function loadMessagePage(admin, coachId, athleteId, before) {
  const cursor = parseMessageCursor(before);
  let query = admin.from('coach_messages').select('*').eq('coach_id', coachId).eq('athlete_id', athleteId)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(MESSAGE_PAGE_SIZE + 1);
  if (cursor) query = query.or(`created_at.lt.${cursor.time},and(created_at.eq.${cursor.time},id.lt.${cursor.id})`);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data || []).slice(0, MESSAGE_PAGE_SIZE);
  const last = rows.at(-1);
  return { messages: rows.reverse(), next_cursor: data?.length > MESSAGE_PAGE_SIZE ? `${last.created_at}|${last.id}` : null };
}

export function validMessageId(value) { return typeof value === 'string' && UUID.test(value); }

// The existing UUID primary key is the durable retry key. The caller must
// authorize the current relationship before this function, including retries.
export async function insertMessageOnce(admin, payload, clientId) {
  const insert = { ...payload, ...(clientId ? { id: clientId } : {}) };
  const result = await admin.from('coach_messages').insert(insert).select('*').single();
  if (result.error?.code !== '23505' || !clientId) return result;
  const { data, error } = await admin.from('coach_messages').select('*').eq('id', clientId)
    .eq('coach_id', payload.coach_id).eq('athlete_id', payload.athlete_id).eq('sender_role', payload.sender_role).maybeSingle();
  if (error || !data || data.message_body !== payload.message_body) return { data: null, error: error || { message: 'Retry does not match the original message.' } };
  return { data, error: null, replayed: true };
}
