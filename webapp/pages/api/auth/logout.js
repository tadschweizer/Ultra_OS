import { clearAthleteCookie } from '../../../lib/authServer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  clearAthleteCookie(res);
  res.status(200).json({ ok: true });
}
