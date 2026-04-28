
import { sendWelcomeEmail } from '../../../lib/emailServer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { name, email } = req.body || {};
  if (!email) {
    res.status(400).json({ error: 'Email is required.' });
    return;
  }

  const firstName = name?.split(' ')[0] || 'there';

  try {
    const result = await sendWelcomeEmail({ to: email, firstName, req });
    res.status(200).json({ ok: true, skipped: Boolean(result.skipped) });
  } catch (error) {
    console.error('[welcome email] send failed:', error);
    res.status(500).json({ error: 'Failed to send welcome email.' });
  }
}
