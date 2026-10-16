import crypto from 'node:crypto';
export async function readBoundedBody(req, maxBytes) {
  const chunks = []; let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > maxBytes) throw new Error('Payload too large');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}
// Candidate signature format from the provider example; live interoperability is unverified.
export function verifyStravaSignature(raw, header, secret, now = Date.now()) {
  if (!Buffer.isBuffer(raw) || typeof header !== 'string' || header.length > 512
    || typeof secret !== 'string' || !secret) return false;
  const parts = header.split(',').map(part => part.trim().split('='));
  if (parts.length !== 2 || parts.some(p => p.length !== 2)) return false;
  const fields = Object.fromEntries(parts);
  if (!/^\d{1,12}$/.test(fields.t || '') || !/^[a-f0-9]{64}$/i.test(fields.v1 || '')) return false;
  if (Math.abs(now / 1000 - Number(fields.t)) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${fields.t}.`).update(raw).digest();
  return crypto.timingSafeEqual(Buffer.from(fields.v1, 'hex'), expected);
}
