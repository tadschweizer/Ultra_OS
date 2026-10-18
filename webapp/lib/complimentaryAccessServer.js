import { isCoachTier } from './subscriptionTiers.js';

// Server-managed permanent grants, independent of the temporary open-access
// switch and Stripe history. Only the confirmed primary Auth email is trusted.
export async function applyComplimentaryAccess(admin, athlete) {
  const emails = (process.env.COMPLIMENTARY_ATHLETE_EMAILS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  if (!emails.length || !athlete?.supabase_user_id) return athlete;
  const { data, error } = await admin.auth.admin.getUserById(athlete.supabase_user_id);
  if (error || !data?.user) throw new Error('Complimentary access could not be verified. Please retry.');
  const user = data.user;
  if (!user.email_confirmed_at || !emails.includes(String(user.email || '').toLowerCase())) return athlete;
  return { ...athlete, subscription_tier: isCoachTier(athlete.subscription_tier) ? athlete.subscription_tier : 'pro', complimentary_access: true };
}
