import { useEffect, useMemo, useState } from 'react';
import { classifyActivityType, sortActivitiesMostRecentFirst } from '../../lib/activityInsights';
import { createProtocolPayload, interventionCatalog } from '../../lib/interventionCatalog';
import NavMenu from '../../components/NavMenu';
import DashboardTabs from '../../components/DashboardTabs';
import InterventionProtocolFields from '../../components/InterventionProtocolFields';

const trainingPhases = ['Base', 'Build', 'Peak', 'Taper', 'Recovery', 'Race week'];

function fieldClassName() {
  return 'w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-ink';
}

function formatMinutes(totalSeconds) {
  if (!totalSeconds) return '';
  return `${Math.round(totalSeconds / 60)} min`;
}

function formatFeet(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A';
  return `${Math.round(value).toLocaleString()} ft`;
}

function interventionToForm(intervention) {
  return {
    id: intervention.id,
    race_id: intervention.race_id || '',
    activity_id: intervention.activity_id || '',
    date: intervention.date || '',
    intervention_type: intervention.intervention_type || '',
    protocol_payload: createProtocolPayload(
      intervention.intervention_type || '',
      intervention.protocol_payload || {}
    ),
    details: intervention.details || '',
    training_phase: intervention.training_phase || '',
    target_race: intervention.target_race || intervention.races?.name || '',
    target_race_date: intervention.target_race_date || intervention.races?.event_date || '',
    notes: intervention.notes || '',
  };
}

export default function InterventionDetail() {
  const [form, setForm] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');
  const navLinks = [
    { href: '/dashboard', label: 'UltraOS Home', description: 'Insights, trends, and recent training.' },
    { href: '/connections', label: 'Connections', description: 'Manage linked sources.' },
    { href: '/log-intervention', label: 'Log Intervention', description: 'Create a new intervention entry.' },
    { href: '/history', label: 'Intervention History', description: 'Review intervention records.' },
    { href: '/settings', label: 'Settings', description: 'Edit athlete baselines and zones.' },
    { href: '/content', label: 'Content', description: 'Track the content and community workstream.' },
    { href: '/', label: 'Landing Page', description: 'Return to the public entry page.' },
  ];

  useEffect(() => {
    async function loadData() {
      try {
        const interventionId = window.location.pathname.split('/').pop();
        const [interventionRes, activitiesRes] = await Promise.all([
          fetch(`/api/interventions?id=${interventionId}`),
          fetch('/api/activities'),
        ]);

        if (interventionRes.ok) {
          const interventionData = await interventionRes.json();
          setForm(interventionToForm(interventionData.intervention));
        }

        if (activitiesRes.ok) {
          const activityData = await activitiesRes.json();
          setActivities(sortActivitiesMostRecentFirst(activityData.activities || []));
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const selectedActivity = useMemo(
    () => activities.find((activity) => activity.id.toString() === form?.activity_id),
    [activities, form]
  );
  const activityType = useMemo(
    () => (selectedActivity ? classifyActivityType(selectedActivity) : null),
    [selectedActivity]
  );

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => {
      const next =
        name === 'intervention_type'
          ? { ...current, intervention_type: value, protocol_payload: createProtocolPayload(value) }
          : { ...current, [name]: value };
      if (name === 'target_race') {
        next.race_id = '';
      }
      if (name === 'activity_id') {
        const nextActivity = activities.find((activity) => activity.id.toString() === value);
        if (nextActivity) {
          next.date = nextActivity.start_date.slice(0, 10);
          if (!next.dose_duration) {
            next.dose_duration = formatMinutes(nextActivity.moving_time);
          }
        }
      }
      return next;
    });
  }

  function handleProtocolFieldChange(fieldKey, value) {
    setForm((current) => ({
      ...current,
      protocol_payload: {
        ...current.protocol_payload,
        [fieldKey]: value,
      },
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/interventions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`Error: ${data.error}`);
        return;
      }
      setForm(interventionToForm(data.intervention));
      setMessage('Intervention updated.');
    } catch (error) {
      console.error(error);
      setMessage('Error: Failed to update intervention.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!form) return;
    const confirmed = window.confirm('Delete this intervention? This cannot be undone.');
    if (!confirmed) return;

    setDeleting(true);
    setMessage('');
    try {
      const res = await fetch(`/api/interventions?id=${form.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`Error: ${data.error}`);
        return;
      }
      window.location.href = '/history';
    } catch (error) {
      console.error(error);
      setMessage('Error: Failed to delete intervention.');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (!form) {
    return (
      <main className="min-h-screen bg-paper px-4 py-6 text-ink">
        <div className="mx-auto max-w-4xl rounded-[30px] border border-ink/10 bg-white p-6">
          <p className="text-sm text-ink/70">Intervention not found.</p>
          <a href="/history" className="mt-4 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper">
            Back to History
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-accent">Intervention Detail</p>
          </div>
          <NavMenu
            label="Intervention detail navigation"
            links={navLinks}
            primaryLink={{ href: '/history', label: 'Back to History', variant: 'secondary' }}
          />
        </div>

        <DashboardTabs activeHref="/history" />

        <div className="mb-10 overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] p-6 md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-accent">Review + Edit</p>
              <h1 className="font-display mt-4 max-w-4xl text-5xl leading-tight md:text-7xl">
                Update the intervention instead of creating duplicates.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/80">
                History is now a real record. You can open an intervention, correct it, and delete it here rather than cluttering the main history table.
              </p>
            </div>

            <div className="rounded-[34px] bg-panel p-6 text-white shadow-[0_40px_100px_rgba(0,0,0,0.28)]">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Linked Activity</p>
              {selectedActivity ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                    <p className="text-sm font-semibold text-white">{selectedActivity.name}</p>
                    <p className="mt-1 text-sm text-white/70">{new Date(selectedActivity.start_date).toLocaleString()}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-accent">Activity Type</p>
                      <p className="mt-2 text-lg font-semibold text-white">{activityType?.label || 'Unknown'}</p>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-accent">Elevation</p>
                      <p className="mt-2 text-lg font-semibold text-white">{formatFeet(selectedActivity.total_elevation_gain * 3.28084)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-white/70">This intervention is not linked to an activity.</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <form onSubmit={handleSubmit} className="space-y-5 rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
            {message ? <p className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-ink">{message}</p> : null}

            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-ink">Linked Activity</label>
                <select name="activity_id" value={form.activity_id} onChange={handleChange} className={fieldClassName()}>
                  <option value="">No linked activity</option>
                  {activities.map((activity) => {
                    const type = classifyActivityType(activity);
                    return (
                      <option key={activity.id} value={activity.id}>
                        {new Date(activity.start_date).toLocaleDateString()} - {type.label} - {activity.name}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-ink">Date</label>
                <input type="date" name="date" value={form.date} onChange={handleChange} className={fieldClassName()} />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-ink">Intervention Type</label>
                <select name="intervention_type" value={form.intervention_type} onChange={handleChange} className={fieldClassName()}>
                  <option value="">Select Type</option>
                  {interventionCatalog.map((group) => (
                    <optgroup key={group.phase} label={group.phase}>
                      {group.types.map((type) => (
                        <option key={type.label} value={type.label}>
                          {type.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-ink">Target Race</label>
                <input type="text" name="target_race" value={form.target_race} onChange={handleChange} className={fieldClassName()} />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-ink">Race Date</label>
                <input type="date" name="target_race_date" value={form.target_race_date} onChange={handleChange} className={fieldClassName()} />
              </div>

              <div className="md:col-span-2">
                <InterventionProtocolFields
                  interventionType={form.intervention_type}
                  protocolPayload={form.protocol_payload}
                  onFieldChange={handleProtocolFieldChange}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-ink">Training Phase</label>
                <select name="training_phase" value={form.training_phase} onChange={handleChange} className={fieldClassName()}>
                  <option value="">Select Phase</option>
                  {trainingPhases.map((phase) => (
                    <option key={phase} value={phase}>{phase}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-ink">Additional Context</label>
                <textarea name="details" value={form.details} onChange={handleChange} rows={3} className={fieldClassName()} />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-ink">Notes</label>
                <textarea name="notes" value={form.notes} onChange={handleChange} rows={4} className={fieldClassName()} />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="submit" disabled={saving} className="rounded-full bg-ink px-6 py-3 font-semibold text-paper">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-full border border-red-300 bg-red-50 px-6 py-3 font-semibold text-red-700"
              >
                {deleting ? 'Deleting...' : 'Delete Intervention'}
              </button>
            </div>
          </form>

          <aside className="space-y-5">
            <div className="rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Why This Page Exists</p>
              <ul className="mt-4 space-y-3 text-sm text-ink/75">
                <li>Edit the original record instead of creating duplicate logs.</li>
                <li>Keep delete off the main history list so it is harder to do accidentally.</li>
                <li>Keep linked activity context visible while you revise the intervention.</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
