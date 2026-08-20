/**
 * Server-only transactional email.
 *
 * These used to be reachable as `POST /api/email/welcome`, which required no
 * authentication — anyone could send a branded Threshold email to any address.
 * The HTTP route is gone; callers import these functions directly so there is
 * no public send surface at all.
 *
 * Every sender is best-effort: a missing RESEND_API_KEY or a provider outage
 * must never fail the signup/reset request that triggered it.
 */

const FROM = 'Threshold <hello@mythreshold.co>';

export function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://mythreshold.co').replace(/\/$/, '');
}

function layout(bodyHtml) {
  return `
    <div style="font-family: Arial, sans-serif; background:#F7F2EA; padding:32px;">
      <div style="max-width:560px; margin:0 auto; background:white; border-radius:16px; border:1px solid #E5E7EB; overflow:hidden;">
        <div style="background:#1C2B24; color:#F59E0B; padding:20px 28px; font-size:12px; letter-spacing:.28em; font-weight:700;">THRESHOLD</div>
        <div style="padding:28px;">${bodyHtml}</div>
      </div>
    </div>
  `.trim();
}

function button(href, label) {
  return `<a href="${href}" style="display:inline-block; background:#131816; color:white; text-decoration:none; border-radius:999px; padding:14px 24px; font-size:14px; font-weight:600;">${label}</a>`;
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const HEADING = 'font-size:24px; font-weight:700; color:#131816; margin:0 0 12px;';
const BODY = 'font-size:15px; line-height:1.7; color:#555F5A; margin:0 0 16px;';
const FINE = 'font-size:13px; line-height:1.7; color:#8A938F; margin:16px 0 0;';

async function send({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: true, skipped: true };

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });

    if (!response.ok) {
      // Never log the body: verification and reset links live in it.
      console.error('[email] Resend rejected the send:', response.status, subject);
      return {
        ok: false,
        failureCategory: response.status >= 500 ? 'provider_unavailable' : 'provider_rejected',
      };
    }
    return { ok: true };
  } catch (error) {
    console.error('[email] send failed:', subject, error?.message);
    return { ok: false, failureCategory: 'provider_unavailable' };
  }
}

export async function sendWelcomeEmail({ name, email }) {
  if (!email) return { ok: false };
  const firstName = name?.split(' ')[0] || 'there';
  return send({
    to: email,
    subject: 'Welcome to Threshold',
    html: layout(`
      <p style="${HEADING}">Welcome, ${firstName}.</p>
      <p style="${BODY}">Your account is ready. Start by logging an intervention, adding a workout check-in, and watching your first patterns emerge.</p>
      <p style="${BODY}">Free accounts can explore the platform with 15 intervention logs and 3 check-ins per week.</p>
      ${button(`${getSiteUrl()}/dashboard`, 'Open Threshold')}
    `),
  });
}

export async function sendVerificationEmail({ name, email, verifyUrl }) {
  if (!email || !verifyUrl) return { ok: false };
  const firstName = name?.split(' ')[0] || 'there';
  return send({
    to: email,
    subject: 'Confirm your Threshold email',
    html: layout(`
      <p style="${HEADING}">Confirm your email, ${firstName}.</p>
      <p style="${BODY}">Tap the button to confirm this address belongs to you. Until you do, this account can't be linked to any existing Threshold data.</p>
      ${button(verifyUrl, 'Confirm my email')}
      <p style="${FINE}">If you didn't create a Threshold account, ignore this email — nothing was changed and no data was shared.</p>
    `),
  });
}

export async function sendPasswordResetEmail({ name, email, resetUrl }) {
  if (!email || !resetUrl) return { ok: false };
  const firstName = name?.split(' ')[0] || 'there';
  return send({
    to: email,
    subject: 'Reset your Threshold password',
    html: layout(`
      <p style="${HEADING}">Reset your password, ${firstName}.</p>
      <p style="${BODY}">Tap the button below to choose a new password. This link expires in one hour and can only be used once.</p>
      ${button(resetUrl, 'Choose a new password')}
      <p style="${FINE}">If you didn't ask for this, you can ignore this email — your password stays as it is. Setting a new password signs you out everywhere.</p>
    `),
  });
}

export async function sendPasswordChangedEmail({ name, email }) {
  if (!email) return { ok: false };
  const firstName = name?.split(' ')[0] || 'there';
  return send({
    to: email,
    subject: 'Your Threshold password was changed',
    html: layout(`
      <p style="${HEADING}">Password changed, ${firstName}.</p>
      <p style="${BODY}">The password on your Threshold account was just changed, and every signed-in device was signed out.</p>
      <p style="${BODY}">If this was you, there's nothing to do.</p>
      ${button(`${getSiteUrl()}/forgot-password`, 'This wasn’t me — reset it')}
    `),
  });
}

export async function sendCoachInvitationEmail({ coachName, email, inviteUrl, expiresAt }) {
  if (!coachName || !email || !inviteUrl || !expiresAt) return { ok: false };

  const safeCoachName = escapeHtml(coachName);
  const safeInviteUrl = escapeHtml(inviteUrl);
  const expiry = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(expiresAt));

  return send({
    to: email,
    subject: `${coachName} invited you to Threshold`,
    html: layout(`
      <p style="${HEADING}">${safeCoachName} invited you to Threshold.</p>
      <p style="${BODY}">Accept this invitation to connect your Threshold athlete account with ${safeCoachName}. Once connected, your coach can view the training and check-in information you share in Threshold.</p>
      ${button(safeInviteUrl, 'Accept coach invitation')}
      <p style="${FINE}">This invitation expires ${escapeHtml(expiry)} UTC. If you were not expecting it, you can ignore this email and no connection will be created.</p>
    `),
  });
}
