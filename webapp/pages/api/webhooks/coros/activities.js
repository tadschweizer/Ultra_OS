// COROS is unavailable until the partner verification and ingestion contract is tested.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  return res.status(503).json({ error: 'COROS activity delivery is not enabled.' });
}
// Do not parse or buffer unverified bodies.
export const config = { api: { bodyParser: false } };
