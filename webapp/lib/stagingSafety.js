const productionRef = 'jzfctjaaowdvubhqswpa';
export function canSeedDemo(env = process.env) {
  if (env.ALLOW_DEMO_SEED !== 'true' || env.VERCEL_ENV === 'production') return false;
  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
    if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return true;
    const ref = env.SUPABASE_STAGING_PROJECT_REF;
    return env.APP_ENV === 'staging' && /^[a-z0-9]{20}$/.test(ref || '')
      && ref !== productionRef && url.protocol === 'https:' && url.hostname === `${ref}.supabase.co`;
  } catch { return false; }
}
