import { useEffect, useMemo, useState } from 'react';
import { classifyActivityType, sortActivitiesMostRecentFirst } from '../../lib/activityInsights';
import {
  createProtocolPayload,
  defaultFavoriteInterventions,
  favoriteInterventionStorageKey,
  getAllInterventionDefinitions,
  getInterventionDefinition,
} from '../../lib/interventionCatalog';
import NavMenu from '../../components/NavMenu';
import DashboardTabs from '../../components/DashboardTabs';
import {
  ActivityContextCard,
  cardClassName,
  CategoryGrid,
  countLast30Days,
  FavoriteTypeButtons,
  fieldClassName,
  getPersistedFavorites,
  getPersistedQuickLog,
  quickLogStorageKey,
  StravaActivityPicker,
  trainingPhases,
} from '../../components/InterventionFormShared';
import InterventionProtocolFields from '../../components/InterventionProtocolFields';

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
  const [interventions, setInterventions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [loadingActivityDetails, setLoadingActivityDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');
  const [activityDetails, setActivityDetails] = useState(null);
  const [favoriteTypes, setFavoriteTypes] = useState(defaultFavoriteInterventions);
  const [quickLog, setQuickLog] = useState(false);
  const [activitySearch, setActivitySearch] = useState('');
  const [stravaConnected, setStravaConnected] = useState(true);
  const navLinks = [
    { href: '/dashboard', label: 'UltraOS Home', description: 'Insights, trends, and recent training.' },
    { href: '/guide', label: 'Guide', description: 'Learn how intervention history works.' },
    { href: '/connections', label: 'Connections', description: 'Manage linked sources.' },
    { href: '/log-intervention', label: 'Log Intervention', description: 'Create a new intervention entry.' },
    { href: '/history', label: 'Intervention History', description: 'Review intervention records.' },
    { href: '/settings', label: 'Settings', description: 'Edit athlete baselines and zones.' },
    { href: '/content', label: 'Research', description: 'Browse the research library.' },
    { href: '/', label: 'Landing Page', description: 'Return to the public entry page.' },
  ];

  const interventionDefinitions = useMemo(() => getAllInterventionDefinitions(), []);
  const selectedDefinition = useMemo(
    () => getInterventionDefinition(form?.intervention_type),
    [form?.intervention_type]
  );
  const recentCategoryCounts = useMemo(() => countLast30Days(interventions), [interventions]);

  useEffect(() => {
    async function loadData() {
      try {
        const interventionId = window.location.pathname.split('/').pop();
        const [interventionRes, activitiesRes, interventionsRes] = await Promise.all([
          fetch(`/api/interventions?id=${interventionId}`),
          fetch('/api/activities'),
          fetch('/api/interventions'),
        ]);

        if (interventionRes.ok) {
          const interventionData = await interventionRes.json();
          setForm(interventionToForm(interventionData.intervention));
        }

        if (activitiesRes.ok) {
          const activityData = await activitiesRes.json();
          setActivities(sortActivitiesMostRecentFirst(activityData.activities || []));
          setStravaConnected(true);
        } else {
          setActivities([]);
          setStravaConnected(false);
        }

        if (interventionsRes.ok) {
          const interventionList = await interventionsRes.json();
          setInterventions(interventionList.interventions || []);
        }
      } catch (error) {
        console.error(error);
        setStravaConnected(false);
      } finally {
        setFavoriteTypes(getPersistedFavorites());
        setQuickLog(getPersistedQuickLog());
        setLoading(false);
        setLoadingActivities(false);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(favoriteInterventionStorageKey, JSON.stringify(favoriteTypes));
  }, [favoriteTypes]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(quickLogStorageKey, quickLog ? 'true' : 'false');
  }, [quickLog]);

  useEffect(() => {
    async function fetchActivityDetails() {
      if (!form?.activity_id) {
        setActivityDetails(null);
        return;
      }

      setLoadingActivityDetails(true);
      try {
        const res = await fetch(`/api/activity-details?id=${form.activity_id}`);
        if (res.ok) {
          const data = await res.json();
          setActivityDetails(data.activity);
        } else {
          setActivityDetails(null);
        }
      } catch (err) {
        console.error(err);
        setActivityDetails(null);
      } finally {
        setLoadingActivityDetails(false);
      }
    }

    fetchActivityDetails();
  }, [form?.activity_id]);

  const selectedActivity = useMemo(
    () => activities.find((activity) => activity.id.toString() === form?.activity_id),
    [activities, form?.activity_id]
  );

  const filteredActivities = useMemo(() => {
    const query = activitySearch.trim().toLowerCase();
    if (!query) return activities.slice(0, 24);

    return activities.filter((activity) => {
      const activityType = classifyActivityType(activity).label.toLowerCase();
      const searchable = [
        activity.name,
        activityType,
        new Date(activity.start_date).toLocaleDateString(),
      ]
        .join(' ')
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [activities, activitySearch]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => {
      if (!current) return current;
      const next =
        name === 'intervention_type'
          ? { ...current, intervention_type: value, protocol_payload: createProtocolPayload(value) }
          : { ...current, [name]: value };
      if (name === 'target_race') {
        next.race_id = '';
      }
      return next;
    });
  }

  function selectInterventionType(type) {
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        intervention_type: type,
        protocol_payload: createProtocolPayload(type),
      };
    });
  }

  function handleActivitySelect(activityId) {
    const nextActivity = activities.find((activity) => activity.id.toString() === activityId);
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        activity_id: activityId,
        date: nextActivity ? nextActivity.start_date.slice(0, 10) : current.date,
      };
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

  function toggleFavoriteType() {
    if (!form?.intervention_type) return;
    setFavoriteTypes((currentFavorites) => {
      if (currentFavorites.includes(form.intervention_type)) {
        return currentFavorites.filter((item) => item !== form.intervention_type);
      }
      return [form.intervention_type, ...currentFavorites];
    });
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
      setInterventions((current) => current.map((item) => (item.id === data.intervention.id ? data.intervention : item)));
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
                Edit Intervention
              </h1>
            </div>

            <div className="rounded-[34px] bg-panel p-6 text-white shadow-[0_40px_100px_rgba(0,0,0,0.28)]">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Current Entry</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Quick Mode</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {quickLog ? 'Core fields only' : 'Full protocol detail'}
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Date</p>
                  <p className="mt-2 text-sm font-semibold text-white">{form.date || 'Not set'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <form onSubmit={handleSubmit} className={cardClassName()}>
            {message ? <p className="mb-5 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-ink">{message}</p> : null}

            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-ink/10 bg-paper px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-ink">Quick Log</p>
                <p className="mt-1 text-sm text-ink/65">Hide optional fields while you clean up the essentials.</p>
              </div>
              <button
                type="button"
                onClick={() => setQuickLog((current) => !current)}
                className={`inline-flex items-center gap-3 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  quickLog ? 'bg-panel text-paper' : 'border border-ink/10 bg-white text-ink'
                }`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${quickLog ? 'bg-accent' : 'bg-ink/25'}`} />
                {quickLog ? 'On' : 'Off'}
              </button>
            </div>

            <div className="grid gap-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-ink">Fast repeat</label>
                <FavoriteTypeButtons favorites={favoriteTypes} selectedType={form.intervention_type} onSelect={selectInterventionType} />
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <label className="block text-sm font-semibold text-ink">Choose intervention</label>
                  {form.intervention_type ? (
                    <button
                      type="button"
                      onClick={toggleFavoriteType}
                      className="rounded-full border border-ink/10 px-3 py-1.5 text-xs font-semibold text-ink"
                    >
                      {favoriteTypes.includes(form.intervention_type) ? 'Remove Favorite' : 'Add Favorite'}
                    </button>
                  ) : null}
                </div>

                <CategoryGrid
                  definitions={interventionDefinitions}
                  selectedType={form.intervention_type}
                  counts={recentCategoryCounts}
                  onSelect={selectInterventionType}
                />
              </div>

              <div>
                <InterventionProtocolFields
                  interventionType={form.intervention_type}
                  protocolPayload={form.protocol_payload}
                  onFieldChange={handleProtocolFieldChange}
                  quickMode={quickLog}
                />
                {quickLog && selectedDefinition && selectedDefinition.fields.length > 2 ? (
                  <p className="mt-3 text-sm text-ink/60">
                    Quick Log is showing the core protocol fields first. Turn it off if you want the full category form.
                  </p>
                ) : null}
              </div>

              <StravaActivityPicker
                activities={filteredActivities}
                activitySearch={activitySearch}
                selectedActivityId={form.activity_id}
                onSearchChange={setActivitySearch}
                onSelect={handleActivitySelect}
                loading={loadingActivities}
                stravaConnected={stravaConnected}
              />

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-ink">Date</label>
                  <input type="date" name="date" value={form.date} onChange={handleChange} className={fieldClassName()} />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-ink">Training Phase</label>
                  <select name="training_phase" value={form.training_phase} onChange={handleChange} className={fieldClassName()}>
                    <option value="">Select Phase</option>
                    {trainingPhases.map((phase) => (
                      <option key={phase} value={phase}>
                        {phase}
                      </option>
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
              </div>

              {!quickLog ? (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-ink">Additional Context</label>
                    <textarea name="details" value={form.details} onChange={handleChange} rows={3} className={fieldClassName()} />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold text-ink">Notes</label>
                    <textarea name="notes" value={form.notes} onChange={handleChange} rows={4} className={fieldClassName()} />
                  </div>
                </>
              ) : null}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
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
            <ActivityContextCard
              selectedActivity={selectedActivity}
              activityDetails={activityDetails}
              loadingActivityDetails={loadingActivityDetails}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}
