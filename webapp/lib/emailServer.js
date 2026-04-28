import { getCanonicalSiteUrl } from './coachServer';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderThresholdEmailShell({ eyebrow = 'THRESHOLD', title, intro, body, ctaLabel, ctaHref, footer }) {
  return `
    <div style="font-family: Arial, sans-serif; background:#F7F2EA; padding:32px;">
      <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:16px; border:1px solid #E5E7EB; overflow:hidden;">
        <div style="background:#1C2B24; color:#D79A3E; padding:20px 28px; font-size:12px; letter-spacing:.28em; font-weight:700;">
          ${escapeHtml(eyebrow)}
        </div>
        <div style="padding:28px;">
          <p style="font-size:28px; font-weight:700; color:#131816; margin:0 0 12px;">${escapeHtml(title)}</p>
          <p style="font-size:15px; line-height:1.7; color:#555F5A; margin:0 0 16px;">${intro}</p>
          ${body ? `<div style="font-size:14px; line-height:1.8; color:#555F5A; margin:0 0 24px;">${body}</div>` : ''}
          ${ctaHref && ctaLabel ? `
            <a href="${escapeHtml(ctaHref)}" style="display:inline-block; background:#131816; color:#ffffff; text-decoration:none; border-radius:999px; padding:14px 24px; font-size:14px; font-weight:600;">
              ${escapeHtml(ctaLabel)}
            </a>
          ` : ''}
          ${footer ? `<p style="font-size:12px; line-height:1.7; color:#7A847F; margin:24px 0 0;">${footer}</p>` : ''}
        </div>
      </div>
    </div>
  `.trim();
}

export async function sendResendEmail({ to, subject, html, text, from = 'Threshold <hello@mythreshold.co>' }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, skipped: true, error: 'Missing RESEND_API_KEY.' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend returned ${response.status}: ${body}`);
  }

  const payload = await response.json();
  return { ok: true, skipped: false, id: payload.id || null };
}

export async function sendCoachInviteEmail({ to, coachName, inviteUrl, req }) {
  const safeCoachName = escapeHtml(coachName || 'Your coach');
  const siteUrl = getCanonicalSiteUrl(req);
  const html = renderThresholdEmailShell({
    eyebrow: 'THRESHOLD COACHING',
    title: `${coachName || 'A coach'} invited you to Threshold`,
    intro: `${safeCoachName} wants to coach you inside Threshold.`,
    body: `
      <p style="margin:0 0 14px;">Open the invite to create your account or accept the connection.</p>
      <p style="margin:0 0 14px;">Once you join, your coach can start sharing protocols, structure, and communication inside the app.</p>
      <div style="margin:0 0 14px; padding:14px 16px; border-radius:14px; background:#F7F2EA; color:#3F4743;">
        ${escapeHtml(inviteUrl)}
      </div>
    `,
    ctaLabel: 'Accept Invitation',
    ctaHref: inviteUrl,
    footer: `If the button does not open, paste this link into your browser: ${inviteUrl}. Visit ${siteUrl} if you need help.`,
  });

  const text = [
    `${coachName || 'A coach'} invited you to Threshold.`,
    '',
    'Open this invitation to create your account or accept the connection:',
    inviteUrl,
    '',
    `Need help? Visit ${siteUrl}.`,
  ].join('\n');

  return sendResendEmail({
    to,
    subject: `${coachName || 'A coach'} invited you to Threshold`,
    html,
    text,
    from: 'Threshold Coaching <invite@mythreshold.co>',
  });
}

export async function sendWelcomeEmail({ to, firstName, req }) {
  const siteUrl = getCanonicalSiteUrl(req);
  const html = renderThresholdEmailShell({
    title: `Welcome, ${firstName || 'there'}.`,
    intro: 'Your account is ready. Start by logging an intervention, adding a workout check-in, and watching your first patterns emerge.',
    body: '<p style="margin:0;">Free accounts can explore the platform with 15 intervention logs and 3 check-ins per week.</p>',
    ctaLabel: 'Open Threshold',
    ctaHref: `${siteUrl}/dashboard`,
  });

  const text = [
    `Welcome, ${firstName || 'there'}.`,
    '',
    'Your account is ready.',
    `Open Threshold: ${siteUrl}/dashboard`,
  ].join('\n');

  return sendResendEmail({
    to,
    subject: 'Welcome to Threshold',
    html,
    text,
  });
}
