import { useEffect, useState } from 'react';

export const planOptions = [
  { id: 'research_feed', label: 'Research Feed Only', price: '$7/mo' },
  { id: 'individual_monthly', label: 'Individual Monthly', price: '$29/mo' },
  { id: 'individual_annual', label: 'Individual Annual', price: '$240/yr' },
  { id: 'coach_monthly', label: 'Coach Monthly', price: '$69/mo' },
  { id: 'coach_annual', label: 'Coach Annual', price: '$580/yr' },
];

export const planStorageKey = 'ultraos-plan-tier';

export function getStoredPlan() {
  if (typeof window === 'undefined') return 'individual_monthly';
  return window.localStorage.getItem(planStorageKey) || 'individual_monthly';
}

export function setStoredPlan(planId) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(planStorageKey, planId);
}

export function getPlanLabel(planId) {
  return planOptions.find((plan) => plan.id === planId)?.label || 'Individual Monthly';
}

export function isExplorerUnlocked(planId) {
  return planId === 'individual_annual' || planId === 'coach_monthly' || planId === 'coach_annual';
}

export function hasCoachFeatures(planId) {
  return planId === 'coach_monthly' || planId === 'coach_annual';
}

export function usePlan() {
  const [planId, setPlanId] = useState('individual_monthly');

  useEffect(() => {
    setPlanId(getStoredPlan());
  }, []);

  function updatePlan(nextPlanId) {
    setPlanId(nextPlanId);
    setStoredPlan(nextPlanId);
  }

  return {
    planId,
    setPlanId: updatePlan,
    planLabel: getPlanLabel(planId),
    explorerUnlocked: isExplorerUnlocked(planId),
    coachFeatures: hasCoachFeatures(planId),
  };
}
