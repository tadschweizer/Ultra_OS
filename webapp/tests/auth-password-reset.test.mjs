import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SESSION_COOKIE_SECRET = process.env.SESSION_COOKIE_SECRET || 'test-session-secret';

import {
  PASSWORD_MIN_LENGTH,
  scorePassword,
  validatePassword,
} from '../lib/auth/contracts.js';
import { safeNextPath } from '../lib/auth/redirects.js';
import {
  RATE_LIMITS,
  getClientIp,
  normalizeIdentifier,
} from '../lib/auth/rateLimit.js';

// ─── Password policy ─────────────────────────────────────────────────────────

test('password policy rejects the passwords that get guessed first', () => {
  assert.equal(validatePassword('short'), `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  assert.match(validatePassword('password123'), /too common/);
  assert.match(validatePassword('aaaaaaaaaaaa'), /repeated character/);
  assert.equal(validatePassword(''), 'Enter a password.');
  assert.equal(validatePassword(null), 'Enter a password.');
  assert.match(validatePassword('x'.repeat(500)), /or fewer/);
});

test('a password cannot contain the email it protects', () => {
  assert.match(
    validatePassword('tadschweizer2026', { email: 'tadschweizer@gmail.com' }),
    /cannot contain your email/
  );
  // A short local part is not treated as a substring rule — too many false
  // positives on ordinary passwords.
  assert.equal(validatePassword('correct horse battery', { email: 'ab@example.com' }), null);
});

test('a long passphrase passes', () => {
  assert.equal(validatePassword('correct horse battery staple'), null);
});

test('strength score rises with length and variety', () => {
  assert.equal(scorePassword(''), 0);
  assert.ok(scorePassword('abcdefghijklmnop') > scorePassword('abcdefghij'));
  assert.equal(scorePassword('Abcdefghijklmn1!'), 4);
});

// ─── Redirect safety ─────────────────────────────────────────────────────────

test('next= only accepts same-site paths', () => {
  assert.equal(safeNextPath('/calendar'), '/calendar');
  assert.equal(safeNextPath('/log-intervention'), '/log-intervention');
  assert.equal(safeNextPath('/interventions/abc?tab=notes'), '/interventions/abc?tab=notes');
});

test('next= refuses to send anyone off-site', () => {
  // Without these checks, /login?next=... is an open redirect: a link on the
  // real domain that lands on someone else's copy of the sign-in form.
  for (const hostile of [
    'https://evil.example/login',
    '//evil.example',
    '/\\evil.example',
    '/\tevil',
    'javascript:alert(1)',
    'evil.example',
    '',
    null,
    undefined,
  ]) {
    assert.equal(safeNextPath(hostile), '/dashboard', `should reject ${JSON.stringify(hostile)}`);
  }
});

test('next= cannot bounce back into the auth screens', () => {
  // Otherwise a successful login can loop straight back to the login page.
  for (const loop of ['/login', '/signup', '/auth/callback', '/forgot-password', '/reset-password']) {
    assert.equal(safeNextPath(loop), '/dashboard');
  }
});

// ─── Rate limiting ───────────────────────────────────────────────────────────

test('every rate-limited action has both an identifier and an IP budget', () => {
  for (const [kind, policy] of Object.entries(RATE_LIMITS)) {
    assert.ok(policy.identifier?.limit > 0, `${kind} needs a per-identifier limit`);
    assert.ok(policy.ip?.limit > 0, `${kind} needs a per-IP limit`);
    // The IP budget must be the looser of the two, or a shared office NAT
    // would lock out before a single targeted account did.
    assert.ok(policy.ip.limit >= policy.identifier.limit, `${kind} IP limit should not be tighter`);
  }
});

test('identifiers are bucketed case-insensitively', () => {
  // Otherwise TAD@x.com and tad@x.com would each get their own budget.
  assert.equal(normalizeIdentifier('  TAD@Example.COM '), 'tad@example.com');
  assert.equal(normalizeIdentifier(null), '');
});

test('client IP prefers the proxy headers in order', () => {
  assert.equal(getClientIp({ headers: { 'cf-connecting-ip': '1.1.1.1' } }), '1.1.1.1');
  // First entry of x-forwarded-for is the original client.
  assert.equal(getClientIp({ headers: { 'x-forwarded-for': '2.2.2.2, 3.3.3.3' } }), '2.2.2.2');
  assert.equal(getClientIp({ headers: {}, socket: { remoteAddress: '4.4.4.4' } }), '4.4.4.4');
  assert.equal(getClientIp({ headers: {} }), null);
});
