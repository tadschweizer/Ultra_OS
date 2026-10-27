// One explicit release switch. Disabling it restores the existing paid tiers;
// it never changes authentication, coaching relationships, or deferred features.
export function athleteOpenAccess() {
  return process.env.NEXT_PUBLIC_ATHLETE_OPEN_ACCESS === 'true';
}

// Public explanations follow the same release switch as the entitlement checks.
// This is copy only; it does not grant access or alter billing.
export function athleteAccessMessage() {
  return athleteOpenAccess()
    ? 'All currently available athlete features are free during early access. No subscription or payment card is needed.'
    : 'Free accounts include 15 intervention logs and 3 check-ins per rolling seven days. Daily check-ins are included with an eligible pilot or paid coach. See access and pricing for paid features.';
}
