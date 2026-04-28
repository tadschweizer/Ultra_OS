import path from 'path';
import { getSupabaseAdminClient } from '../../../lib/authServer';
import { getAuthenticatedAthlete } from '../../../lib/coachServer';

function decodeBase64Payload(value) {
  const raw = String(value || '');
  const normalized = raw.includes(',') ? raw.split(',').pop() : raw;
  return Buffer.from(normalized, 'base64');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const athlete = await getAuthenticatedAthlete(req);
  if (!athlete) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }

  const { filename, contentType, base64Data } = req.body || {};
  if (!filename || !contentType || !base64Data) {
    res.status(400).json({ error: 'filename, contentType, and base64Data are required.' });
    return;
  }

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
    res.status(400).json({ error: 'Only JPG, PNG, and WebP images are allowed.' });
    return;
  }

  const buffer = decodeBase64Payload(base64Data);
  if (buffer.length > 5 * 1024 * 1024) {
    res.status(400).json({ error: 'Avatar must be 5 MB or smaller.' });
    return;
  }

  const admin = getSupabaseAdminClient();
  await admin.storage.createBucket('coach-avatars', {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  }).catch(() => {});

  const extension = path.extname(filename || '').toLowerCase() || '.jpg';
  const objectPath = `${athlete.id}/avatar${extension}`;
  const { error } = await admin.storage
    .from('coach-avatars')
    .upload(objectPath, buffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error('[coach/avatar] upload failed:', error);
    res.status(500).json({ error: 'Could not upload avatar.' });
    return;
  }

  const { data } = admin.storage.from('coach-avatars').getPublicUrl(objectPath);
  res.status(200).json({ avatarUrl: data.publicUrl, objectPath });
}
