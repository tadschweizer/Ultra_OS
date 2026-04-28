import { useEffect, useState } from 'react';
import {
  canAccessExplorer,
  getSubscriptionTierLabel,
  hasCoachFeatures,
  normalizeSubscriptionTier,
} from './subscriptionTiers';

export const planOptions = [
  { id: 'free', label: 'Free', price: '$0' },
  { id: 'research', label: 'Research Feed', price: '$7/mo' },
  { id: 'individual', label: 'Individual', price: '$29/mo' },
  { id: 'coach', label: 'Coach', price: '$59.99/mo' },
];

export function getPlanLabel(planId) {
  return getSubscriptionTierLabel(planId);
}

export function usePlan() {
  const [planId, setPlanId] = useState('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadPlan() {
      try {
        const response = await fetch('/api/me');
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) {
          setPlanId(normalizeSubscriptionTier(data.athlete?.subscription_tier));
        }
      } catch (error) {
        console.warn('[usePlan] Failed to load plan:', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPlan();
    return () => {
      cancelled = true;
    };
  }, []);

  const athlete = { subscription_tier: planId };
  return {
    planId,
    setPlanId,
    loading,
    planLabel: getPlanLabel(planId),
    explorerUnlocked: canAccessExplorer(athlete).allowed,
    coachFeatures: hasCoachFeatures(athlete).allowed,
  };
}
