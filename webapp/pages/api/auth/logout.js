import { clearAthleteCookie } from '../../../lib/auth/sessionCookies.js';
import { assertAuthPostMethod } from '../../../lib/auth/contracts.js';

export default async function handler(req, res) {
  if (!assertAuthPostMethod(req, res)) return;

  clearAthleteCookie(res);
  res.status(200).json({ ok: true });
}
