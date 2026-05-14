export function applyMembershipTransition(currentGroupIds = [], targetGroupId, action = 'add') {
  const normalized = Array.from(new Set((currentGroupIds || []).filter(Boolean)));
  if (!targetGroupId) return normalized;

  if (action === 'remove') {
    return normalized.filter((id) => id !== targetGroupId);
  }

  if (normalized.includes(targetGroupId)) return normalized;
  return [...normalized, targetGroupId];
}

export function countGroupMembers(groups = []) {
  return (groups || []).map((group) => ({
    ...group,
    member_count: (group?.coach_group_members || []).length,
  }));
}
