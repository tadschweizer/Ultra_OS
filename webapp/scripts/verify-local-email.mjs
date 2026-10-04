// Supabase's real local SMTP/Auth check. Application Resend and Google OAuth
// still require separate isolated provider configuration and human sign-in.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const status = JSON.parse(execFileSync(process.platform === 'win32' ? 'supabase.exe' : 'supabase',
  ['status', '--workdir', '../output/p010-012-supabase', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
assert.equal(new URL(status.API_URL).hostname, '127.0.0.1');
const email = `local-email-${crypto.randomUUID()}@example.com`;
const client = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const sent = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: 'http://localhost:3100/auth/callback' } });
assert.equal(sent.error, null);
let message;
for (let attempt=0; attempt<20; attempt++) {
  const mailbox = await (await fetch('http://127.0.0.1:54324/api/v1/messages')).json();
  message = mailbox.messages?.find(item => item.To?.some(to => to.Address === email));
  if (message) break;
  await new Promise(resolve=>setTimeout(resolve,250));
}
assert.ok(message, 'Real local SMTP email received in Mailpit');
const details = await (await fetch(`http://127.0.0.1:54324/api/v1/message/${message.ID}`)).json();
const href = details.HTML.match(/href="([^"]*\/auth\/v1\/verify[^\"]*)"/)?.[1]?.replaceAll('&amp;', '&');
assert.ok(href, 'Email contains real Supabase verification endpoint');
const url = new URL(href); assert.equal(url.hostname, '127.0.0.1');
assert.equal(url.searchParams.get('redirect_to'), 'http://localhost:3100/auth/callback');
const verified = await fetch(url, { redirect: 'manual' });
assert.equal(verified.status, 303);
const callback = new URL(verified.headers.get('location'));
assert.equal(callback.origin, 'http://localhost:3100'); assert.equal(callback.pathname, '/auth/callback');
assert.ok(new URLSearchParams(callback.hash.slice(1)).get('access_token'));
await mkdir('.qa-private', { recursive: true });
await writeFile('.qa-private/local-email-callback.json', JSON.stringify({ email, callback: callback.href }));
await writeFile('../output/p010-012-local-email-acceptance.json', JSON.stringify({ passed: true,
  date: new Date().toISOString(), environment: 'Local Supabase Auth and captured SMTP',
  redirectOrigin: callback.origin, redirectPath: callback.pathname, verifiedStatus: verified.status,
  limits: 'Does not establish application Resend delivery or external Google OAuth acceptance.' }, null, 2));
console.log('PASS: real local Auth email captured, verification consumed, exact callback origin and session returned.');
