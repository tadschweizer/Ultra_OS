// Release policy shared by server guards and pilot presentation. No account,
// subscription, query parameter or environment flag enables deferred assistance.
// Re-enabling it requires a reviewed release with its own acceptance evidence.
export const RELEASE_CAPABILITIES = Object.freeze({ automatedAssistance: false });

export class DeferredAssistanceError extends Error {
  constructor() {
    super('Automatic assistance is deferred during the closed pilot. Use manual entry.');
    this.code = 'FEATURE_DEFERRED';
  }
}

export function assertAutomatedAssistance() {
  if (!RELEASE_CAPABILITIES.automatedAssistance) throw new DeferredAssistanceError();
}

export function requireAutomatedAssistance(res) {
  if (RELEASE_CAPABILITIES.automatedAssistance) return true;
  res.setHeader('Cache-Control', 'private, no-store');
  const error = new DeferredAssistanceError();
  res.status(403).json({ code: error.code, error: error.message });
  return false;
}
