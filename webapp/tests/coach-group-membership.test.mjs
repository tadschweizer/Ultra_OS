import test from 'node:test';
import assert from 'node:assert/strict';

import { applyMembershipTransition, countGroupMembers } from '../lib/coach/groupMembership.js';

test('group membership transition adds without duplication', () => {
  const next = applyMembershipTransition(['group-a'], 'group-b', 'add');
  assert.deepEqual(next, ['group-a', 'group-b']);

  const duplicateAdd = applyMembershipTransition(next, 'group-a', 'add');
  assert.deepEqual(duplicateAdd, ['group-a', 'group-b']);
});

test('group membership transition removes target group and keeps others', () => {
  const next = applyMembershipTransition(['group-a', 'group-b', 'group-c'], 'group-b', 'remove');
  assert.deepEqual(next, ['group-a', 'group-c']);
});

test('membership transition handles empty and missing inputs safely', () => {
  assert.deepEqual(applyMembershipTransition([], 'group-a', 'remove'), []);
  assert.deepEqual(applyMembershipTransition(['group-a'], '', 'add'), ['group-a']);
});

test('group member counts are computed consistently for dashboard and groups page', () => {
  const groups = [
    { id: 'g1', name: 'A', coach_group_members: [{ athlete_id: '1' }, { athlete_id: '2' }] },
    { id: 'g2', name: 'B', coach_group_members: [] },
    { id: 'g3', name: 'C' },
  ];

  const counted = countGroupMembers(groups);
  assert.equal(counted[0].member_count, 2);
  assert.equal(counted[1].member_count, 0);
  assert.equal(counted[2].member_count, 0);
});
