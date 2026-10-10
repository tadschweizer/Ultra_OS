// Every calendar caller receives a result, including transport and invalid-body
// failures. A successful write and a failed refresh are separate outcomes.
export async function calendarMutation(url, { method = 'POST', body, request = fetch } = {}) {
  try {
    const response = await request(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: data.error || 'Could not save. Please try again.' };
    return { ok: true, ...data };
  } catch {
    return { ok: false, error: 'Connection lost. Your changes are still here. Check your connection and retry.' };
  }
}
