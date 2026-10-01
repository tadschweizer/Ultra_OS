import { useEffect, useState } from 'react';
import {
  getFeatureList,
  getSubscriptionTierLabel,
  normalizeSubscriptionTier,
} from './subscriptionTiers';
import { fetchMe, getCachedMe, subscribeMe } from './meClient';

/**
 * Features the server granted this account (`/api/me` account.features), which
 * include coach-derived grants. Falls back to the stored tier alone.
 */
export function getMeFeatures(me) {
  if (Array.isArray(me?.account?.features)) return me.account.features;
  return getFeatureList(me?.athlete?.subscription_tier);
}

export function meHasFeature(me, feature) {
  return getMeFeatures(me).includes(feature);
}

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
  const features = getMeFeatures(me);

  return {
    planId,
    loading,
    // True once we know the real plan (from cache or network); pages should
    // never render a "locked" state before this flips to true.
    planReady: !loading || Boolean(me),
    planLabel: getPlanLabel(planId),
    entitlementError: me?.entitlementError || null,
    coachAccess: me?.account?.coach_access || null,
    features,
    hasFeature: (feature) => features.includes(feature),
    explorerUnlocked: features.includes('explorer'),
    coachFeatures: me?.account?.capabilities?.coach === true && me?.account?.coach_access?.eligible === true,
  };
}
