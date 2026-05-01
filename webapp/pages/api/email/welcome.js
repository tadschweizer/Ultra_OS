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

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    res.status(200).json({ ok: true, skipped: true });
    return;
  }

  const firstName = name?.split(' ')[0] || 'there';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://mythreshold.co';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Threshold <hello@mythreshold.co>',
        to: email,
        subject: 'Welcome to Threshold',
        html: `
          <div style="font-family: Arial, sans-serif; background:#F7F2EA; padding:32px;">
            <div style="max-width:560px; margin:0 auto; background:white; border-radius:16px; border:1px solid #E5E7EB; overflow:hidden;">
              <div style="background:#1C2B24; color:#F59E0B; padding:20px 28px; font-size:12px; letter-spacing:.28em; font-weight:700;">THRESHOLD</div>
              <div style="padding:28px;">
                <p style="font-size:24px; font-weight:700; color:#131816; margin:0 0 12px;">Welcome, ${firstName}.</p>
                <p style="font-size:15px; line-height:1.7; color:#555F5A; margin:0 0 16px;">Your account is ready. Start by logging an intervention, adding a workout check-in, and watching your first patterns emerge.</p>
                <p style="font-size:14px; line-height:1.7; color:#555F5A; margin:0 0 24px;">Free accounts can explore the platform with 15 intervention logs and 3 check-ins per week.</p>
                <a href="${siteUrl}/dashboard" style="display:inline-block; background:#131816; color:white; text-decoration:none; border-radius:999px; padding:14px 24px; font-size:14px; font-weight:600;">Open Threshold</a>
              </div>
            </div>
          </div>
        `.trim(),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[welcome email] Resend error:', response.status, body);
      res.status(500).json({ error: 'Failed to send welcome email.' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[welcome email] send failed:', error);
    res.status(500).json({ error: 'Failed to send welcome email.' });
  }
}
