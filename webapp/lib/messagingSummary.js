import { normalizeSport } from './workoutCompliance.js';

export async function loadMessagingSummary(admin, actorId, role) {
  const { data, error } = await admin.rpc('messaging_summary', { p_actor_id: actorId, p_mode: role });
  if (error || !data) throw error || new Error('Messaging summary unavailable');
  return { ...data, workout_threads: (data.workout_threads || []).map(thread => ({ ...thread, sport: normalizeSport(thread.sport) })) };
}

export function inboxConversations(summary) {
  return summary.conversations.map(conversation => ({ ...conversation,
    athlete: { id: conversation.athlete_id, name: conversation.name }, unread_count: conversation.unread,
  }));
}
