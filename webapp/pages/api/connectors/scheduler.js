export const runtime = 'edge';

const P1_PROVIDERS = ['oura', 'garmin', 'coros'];
const P2_PROVIDERS = ['ultrahuman'];
const P3_PROVIDERS = ['trainingpeaks', 'zwift'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const mode = req.query.mode || 'hourly_incremental';
  const providers = mode === 'nightly_full' ? [...P1_PROVIDERS, ...P2_PROVIDERS, ...P3_PROVIDERS] : [...P1_PROVIDERS, ...P2_PROVIDERS];

  res.status(200).json({
    status: 'placeholder_scheduler',
    mode,
    providers,
    retry_queue: 'connector_sync_jobs where status=retry ordered by run_after asc',
    dead_letter: 'connector_sync_jobs where status=dead_letter',
    note: 'Wire this endpoint to a cron/worker and Supabase job runner.',
  });
}
