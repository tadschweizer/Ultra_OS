import { useMemo, useState } from 'react';
import { getCoachGroupsPageData } from '../../lib/coachAnalytics';
import { COACH_GROUP_COLOR_OPTIONS, DEFAULT_GROUP_COLOR, getCoachGroupColorStyle } from '../../lib/coachGroups';

function AthleteCard({ athlete, onDragStart }) {
  return (
    <div
      draggable
      onDragStart={(event) => onDragStart(event, athlete)}
      className="cursor-grab rounded-[18px] border border-border-subtle bg-white px-4 py-4 shadow-sm active:cursor-grabbing"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{athlete.athleteName}</p>
          <p className="mt-1 text-xs text-ink/52">{athlete.upcomingRace?.name || 'No race linked yet'}</p>
        </div>
        <span className="rounded-full bg-surface-light px-3 py-1 text-xs font-semibold text-ink/72">
          {athlete.readinessScore}
        </span>
      </div>
    </div>
  );
}

function GroupColumn({ title, color, athletes, onDropAthlete, onDragOver, onDelete, onRename, onRecolor, isUngrouped = false, saving }) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(title);

  return (
    <section
      onDrop={(event) => onDropAthlete(event, title)}
      onDragOver={onDragOver}
      className="rounded-[24px] border border-border-subtle bg-surface-light p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          {editing && !isUngrouped ? (
            <div className="flex flex-wrap items-center gap-2">
              <input value={draftName} onChange={(event) => setDraftName(event.target.value)} className="ui-input w-[180px]" />
              <button type="button" onClick={() => { onRename(draftName); setEditing(false); }} className="ui-button-primary py-2 text-xs">Save</button>
              <button type="button" onClick={() => { setDraftName(title); setEditing(false); }} className="ui-button-secondary py-2 text-xs">Cancel</button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold" style={getCoachGroupColorStyle(color, isUngrouped ? 'outline' : 'soft')}>
                {title}
              </span>
              {!isUngrouped ? (
                <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-accent">Rename</button>
              ) : null}
            </div>
          )}
          <p className="mt-3 text-sm text-ink/58">{athletes.length} athlete{athletes.length === 1 ? '' : 's'}</p>
        </div>

        {!isUngrouped ? (
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap justify-end gap-1.5">
              {COACH_GROUP_COLOR_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onRecolor(option)}
                  className={`h-6 w-6 rounded-full border ${color === option ? 'border-ink' : 'border-white'}`}
                  style={{ backgroundColor: option }}
                  aria-label={`Choose color ${option}`}
                />
              ))}
            </div>
            <button type="button" onClick={onDelete} disabled={saving} className="text-xs font-semibold text-red-700">
              Delete
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-4 min-h-[180px] space-y-3 rounded-[18px] border border-dashed border-border-default/70 px-2 py-2">
        {athletes.length ? athletes.map((athlete) => (
          <AthleteCard key={athlete.relationshipId} athlete={athlete} onDragStart={(event, payload) => onDropAthlete(event, null, payload, true)} />
        )) : (
          <div className="rounded-[16px] bg-white/70 px-4 py-6 text-sm text-ink/48">
            Drag an athlete card here.
          </div>
        )}
      </div>
    </section>
  );
}

export default function CoachGroupsPage({ initialData }) {
  const [groups, setGroups] = useState(initialData?.groups || []);
  const [athletes, setAthletes] = useState(initialData?.athletes || []);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState(DEFAULT_GROUP_COLOR);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const groupedAthletes = useMemo(() => {
    const columns = new Map();
    groups.forEach((group) => columns.set(group.name, []));
    columns.set('Ungrouped', []);

    athletes.forEach((athlete) => {
      const key = athlete.groupName && columns.has(athlete.groupName) ? athlete.groupName : 'Ungrouped';
      columns.get(key).push(athlete);
    });

    return columns;
  }, [athletes, groups]);

  async function createGroup(event) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const response = await fetch('/api/coach/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGroupName, color: newGroupColor }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create group.');
      setGroups((current) => [...current, data.group]);
      setNewGroupName('');
      setNewGroupColor(DEFAULT_GROUP_COLOR);
    } catch (groupError) {
      setError(groupError.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateRelationshipGroup(relationshipId, nextGroupName) {
    const response = await fetch('/api/coach/relationships', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: relationshipId, group_name: nextGroupName === 'Ungrouped' ? null : nextGroupName }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Could not move athlete.');
    }
    return data.relationship;
  }

  function handleDragOver(event) {
    event.preventDefault();
  }

  function handleDragStart(event, athlete) {
    event.dataTransfer.setData('application/json', JSON.stringify(athlete));
  }

  async function handleDrop(event, targetGroupName, suppliedAthlete = null, isDragStartProxy = false) {
    if (isDragStartProxy) {
      handleDragStart(event, suppliedAthlete);
      return;
    }

    event.preventDefault();
    setError('');

    try {
      const athlete = suppliedAthlete || JSON.parse(event.dataTransfer.getData('application/json'));
      const relationship = await updateRelationshipGroup(athlete.relationshipId, targetGroupName);
      setAthletes((current) => current.map((item) => (
        item.relationshipId === athlete.relationshipId
          ? { ...item, groupName: relationship.group_name || 'Ungrouped' }
          : item
      )));
    } catch (dropError) {
      setError(dropError.message);
    }
  }

  async function renameGroup(group, nextName) {
    setError('');
    try {
      const response = await fetch('/api/coach/groups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: group.id, name: nextName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not rename group.');

      setGroups((current) => current.map((item) => item.id === group.id ? data.group : item));
      setAthletes((current) => current.map((item) => item.groupName === group.name ? { ...item, groupName: data.group.name } : item));
    } catch (renameError) {
      setError(renameError.message);
    }
  }

  async function recolorGroup(group, nextColor) {
    setError('');
    try {
      const response = await fetch('/api/coach/groups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: group.id, color: nextColor }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not update group color.');
      setGroups((current) => current.map((item) => item.id === group.id ? data.group : item));
    } catch (colorError) {
      setError(colorError.message);
    }
  }

  async function deleteGroup(group) {
    setError('');
    try {
      const response = await fetch(`/api/coach/groups?id=${group.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not delete group.');
      setGroups((current) => current.filter((item) => item.id !== group.id));
      setAthletes((current) => current.map((item) => item.groupName === group.name ? { ...item, groupName: 'Ungrouped' } : item));
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  if (!initialData) {
    return <main className="ui-shell"><div className="ui-card">Could not load groups.</div></main>;
  }

  return (
    <main className="ui-shell text-ink">
      <div className="space-y-6">
        <section className="ui-card">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.26em] text-accent">Group management</p>
              <h1 className="font-display mt-3 text-4xl text-ink md:text-5xl">Coach groups</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-ink/62">
                Create named squads, set a consistent color for each group, and drag athletes between them to organize race cohorts or training phases.
              </p>
            </div>
          </div>

          <form onSubmit={createGroup} className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto]">
            <input
              value={newGroupName}
              onChange={(event) => setNewGroupName(event.target.value)}
              className="ui-input"
              placeholder="Type a group name, for example Leadville 2026"
            />
            <select value={newGroupColor} onChange={(event) => setNewGroupColor(event.target.value)} className="ui-input">
              {COACH_GROUP_COLOR_OPTIONS.map((color) => (
                <option key={color} value={color}>{color}</option>
              ))}
            </select>
            <button type="submit" disabled={saving} className="ui-button-primary">
              {saving ? 'Creating…' : 'Create Group'}
            </button>
          </form>

          {error ? (
            <div className="mt-4 rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 xl:grid-cols-4">
          {groups.map((group) => (
            <GroupColumn
              key={group.id}
              title={group.name}
              color={group.color}
              athletes={groupedAthletes.get(group.name) || []}
              onDropAthlete={handleDrop}
              onDragOver={handleDragOver}
              onDelete={() => deleteGroup(group)}
              onRename={(name) => renameGroup(group, name)}
              onRecolor={(color) => recolorGroup(group, color)}
              saving={saving}
            />
          ))}

          <GroupColumn
            title="Ungrouped"
            color="#A8A29E"
            athletes={groupedAthletes.get('Ungrouped') || []}
            onDropAthlete={handleDrop}
            onDragOver={handleDragOver}
            onDelete={() => {}}
            onRename={() => {}}
            onRecolor={() => {}}
            isUngrouped
            saving={saving}
          />
        </section>
      </div>
    </main>
  );
}

export async function getServerSideProps(context) {
  try {
    const data = await getCoachGroupsPageData({ req: context.req });

    if (!data.authenticated) {
      return {
        redirect: {
          destination: '/login?next=/coach/groups',
          permanent: false,
        },
      };
    }

    return {
      props: {
        initialData: data,
      },
    };
  } catch (error) {
    console.error('[coach groups page] failed:', error);
    return {
      props: {
        initialData: null,
      },
    };
  }
}
