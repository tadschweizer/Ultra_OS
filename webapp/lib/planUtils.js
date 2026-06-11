import { useEffect, useState } from 'react';
import {
  canAccessExplorer,
  getSubscriptionTierLabel,
  hasCoachFeatures,
  normalizeSubscriptionTier,
} from './subscriptionTiers';
import { fetchMe, getCachedMe, subscribeMe } from './meClient';

export const planOptions = [
  { id: 'free', label: 'Free', price: '$0' },
  { id: 'research', label: 'Research Feed', price: '$7/mo' },
  { id: 'individual', label: 'Individual', price: '$15/mo' },
  { id: 'coach', label: 'Coach', price: '$69/mo' },
];

export function getPlanLabel(planId) {
  return getSubscriptionTierLabel(planId);
}

/**
 * Returns the cached /api/me payload (instantly available after the first
 * load in a session) and keeps it fresh with a background revalidation.
 */
export function useMe() {
  const [me, setMe] = useState(() => getCachedMe());
  const [loading, setLoading] = useState(() => !getCachedMe());

  useEffect(() => {
    const unsubscribe = subscribeMe((next) => {
      setMe(next);
    });
    fetchMe().finally(() => setLoading(false));
    return unsubscribe;
  }, []);

  return { me, loading };
}

export function usePlan() {
  const { me, loading } = useMe();

  const planId = normalizeSubscriptionTier(me?.athlete?.subscription_tier);
  const athlete = { subscription_tier: planId };

  return {
    planId,
    loading,
    // True once we know the real plan (from cache or network); pages should
    // never render a "locked" state before this flips to true.
    planReady: !loading || Boolean(me),
    planLabel: getPlanLabel(planId),
    explorerUnlocked: canAccessExplorer(athlete).allowed,
    coachFeatures: hasCoachFeatures(athlete).allowed,
  };
}
