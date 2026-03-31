/**
 * POST /api/email/welcome
 *
 * Sends the welcome email to a newly signed-up athlete via Resend.
 * Called internally by /api/auth/signup and /api/auth/session after
 * a new athlete record is created. Non-blocking — failures are logged
 * but do not affect the signup flow.
 *
 * Body: { athleteId, name, email }
 *
 * Requires env var: RESEND_API_KEY
 * Set NEXT_PUBLIC_SITE_URL to override the base URL in links.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { athleteId, name, email } = req.body || {};
  if (!email) {
    res.status(400).json({ error: 'email is required' });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Resend not configured yet — log and return gracefully
    console.warn('[welcome email] RESEND_API_KEY not set. Skipping welcome email for', email);
    res.status(200).json({ ok: true, skipped: true });
    return;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ultraos.app';
  const firstName = name?.split(' ')[0] || 'there';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F7F2EA; margin: 0; padding: 40px 16px;">
  <div style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; border: 1px solid #E5E7EB;">
    <div style="background: #1C2B24; padding: 20px 32px;">
      <p style="color: #F59E0B; font-size: 12px; font-weight: 700; letter-spacing: 0.25em; text-transform: uppercase; margin: 0;">ULTRAOS</p>
    </div>
    <div style="padding: 32px;">
      <p style="font-size: 22px; font-weight: 700; color: #131816; margin: 0 0 12px;">Welcome, ${firstName}.</p>
      <p style="font-size: 15px; color: #555F5A; line-height: 1.7; margin: 0 0 24px;">
        You're in. UltraOS is built to answer the question every serious endurance athlete eventually asks: <strong>what's actually working?</strong>
      </p>
      <p style="font-size: 15px; color: #555F5A; line-height: 1.7; margin: 0 0 24px;">
        Three things to do in your first session:
      </p>
      <ol style="color: #131816; font-size: 15px; line-height: 1.9; margin: 0 0 24px; padding-left: 20px;">
        <li><strong>Log your first intervention</strong> — a heat session, foam roll, ice bath, or sleep note.</li>
        <li><strong>Check in after your next workout</strong> — legs feel, energy, RPE. 60 seconds.</li>
        <li><strong>Watch the pattern emerge</strong> — after a few entries, UltraOS starts correlating the two.</li>
      </ol>
      <a href="${siteUrl}/dashboard" style="display: inline-block; background: #131816; color: #fff; border-radius: 100px; padding: 14px 28px; font-size: 14px; font-weight: 600; text-decoration: none; margin-bottom: 24px;">
        Go to Dashboard →
      </a>
      <p style="font-size: 13px; color: #9CA3AF; line-height: 1.7; margin: 0;">
        You're on the free tier. You can log up to 15 interventions and 3 check-ins per week to explore the platform.
        <a href="${siteUrl}/pricing" style="color: #B45309;">Upgrade anytime</a> for unlimited logging and full pattern analysis.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'UltraOS <hello@ultraos.app>',
        to: email,
        subject: 'Welcome to UltraOS — your first three steps',
        html,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[welcome email] Resend API error:', response.status, body);
      res.status(500).json({ error: 'Failed to send welcome email' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[welcome email] Fetch error:', err);
    res.status(500).json({ error: 'Failed to send welcome email' });
  }
}
