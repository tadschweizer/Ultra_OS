import { assertAuthPostMethod } from '../../../lib/auth/contracts.js';
import {
  normalizeSignupRoleIntent,
  setSignupRoleIntent,
} from '../../../lib/auth/signupRoleIntent.js';
import { primaryRoleForSignupRole } from '../../../lib/auth/roleGuards.js';

export default function handler(req, res) {
  if (!assertAuthPostMethod(req, res)) return;

  const { role, next } = req.body || {};
  const normalized = normalizeSignupRoleIntent(role, next);
  if (!normalized) {
    res.status(400).json({ error: 'role must be coach, athlete-with-coach, or individual.' });
    return;
  }

  setSignupRoleIntent(res, normalized);
  res.status(200).json({ role: normalized, primaryRole: primaryRoleForSignupRole(normalized) });
}
