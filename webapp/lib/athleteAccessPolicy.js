// One explicit release switch. Disabling it restores the existing paid tiers;
// it never changes authentication, coaching relationships, or deferred features.
export function athleteOpenAccess() {
  return process.env.NEXT_PUBLIC_ATHLETE_OPEN_ACCESS === 'true';
}
