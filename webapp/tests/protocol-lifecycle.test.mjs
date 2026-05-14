import test from 'node:test';
import assert from 'node:assert/strict';

import { hasDateWindowOverlap, isActiveProtocolStatus, validateProtocolWindow } from '../lib/coachProtocols.js';

test('validateProtocolWindow enforces valid date ranges', () => {
  assert.equal(validateProtocolWindow('2026-05-01', '2026-05-21').valid, true);
  assert.equal(validateProtocolWindow('2026-05-21', '2026-05-01').valid, false);
  assert.equal(validateProtocolWindow('bad', '2026-05-01').valid, false);
});

test('hasDateWindowOverlap detects assignment conflicts', () => {
  assert.equal(hasDateWindowOverlap('2026-05-01', '2026-05-14', '2026-05-14', '2026-05-28'), true);
  assert.equal(hasDateWindowOverlap('2026-05-01', '2026-05-13', '2026-05-14', '2026-05-28'), false);
});

test('isActiveProtocolStatus only flags active lifecycle states', () => {
  assert.equal(isActiveProtocolStatus('assigned'), true);
  assert.equal(isActiveProtocolStatus('in_progress'), true);
  assert.equal(isActiveProtocolStatus('active'), true);
  assert.equal(isActiveProtocolStatus('completed'), false);
  assert.equal(isActiveProtocolStatus('abandoned'), false);
});
