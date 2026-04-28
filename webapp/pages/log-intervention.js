import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { classifyActivityType, sortActivitiesMostRecentFirst } from '../lib/activityInsights';
import {
  createProtocolPayload,
  defaultFavoriteInterventions,
  favoriteInterventionStorageKey,
  legacyFavoriteInterventionStorageKey,
  getAllInterventionDefinitions,
  getInterventionDefinition,
  getInterventionIcon,
} from '../lib/interventionCatalog';
import { getStoredValue, removeStoredValue } from '../lib/browserStorage';
import NavMenu from '../components/NavMenu';
import DashboardTabs from '../components/DashboardTabs';
import InterventionProtocolFields from '../components/InterventionProtocolFields';
import {
  ActivityContextCard,
  cardClassName,
  CategoryGrid,
  countLast30Days,
  FavoriteTypeButtons,
  fieldClassName,
  getPersistedFavorites,
  getPersistedQuickLog,
  legacyQuickLogStorageKey,
  quickLogStorageKey,
  trainingPhases,
  StravaActivityPicker,
} from '../components/InterventionFormShared';
import { deriveRaceType, getRaceTypeLabel, raceTypeOptions } from '../lib/raceTypes';

const surfaceOptions = ['Trail', 'Road', 'Mixed', 'Track', 'Gravel', 'Treadmill'];
const defaultRaceStorageKey = 'threshold-default-race';
const legacyDefaultRaceStorageKey = 'ultraos-default-race';
const trainingPhaseStorageKey = 'threshold-default-training-phase';
const legacyTrainingPhaseStorageKey = 'ultraos-default-training-phase';

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function createEmptyForm(defaultRace = {}) {
  return {
    race_id: defaultRace.race_id || '',
    activity_id: '',
    activity_provider: '',
    date: getTodayDate(),
    intervention_type: '',
    protocol_payload: {},
    details: '',
    training_phase: defaultRace.training_phase || '',
    target_race: defaultRace.target_race || '',
    target_race_date: defaultRace.target_race_date || '',
    notes: '',
  };
}

function createRaceDraft(defaultRace = {}) {
  return {
    name: defaultRace.target_race || '',
    event_date: defaultRace.target_race_date || '',
    distance_miles: defaultRace.distance_miles || '',
    elevation_gain_ft: defaultRace.elevation_gain_ft || '',
    race_type: defaultRace.race_type || '',
    location: defaultRace.location || '',
    surface: defaultRace.surface || '',
    notes: defaultRace.notes || '',
  };
}

function formatFeet(value) {
  if (value === null || value === undefined) return 'N/A';
  return `${Number(value).toLocaleString()} ft`;
}

function formatDistanceMiles(value) {
  if (value === null || value === undefined || value === '') return 'N/A';
  return `${Number(value).toFixed(1)} mi`;
}

function getActivityDate(activity) {
  if (!activity?.start_date) return '';
  return activity.start_date.slice(0, 10);
}

function getPersistedRace() {
  if (typeof window === 'undefined') return {};
  const storedRace = getStoredValue(defaultRaceStorageKey, legacyDefaultRaceStorageKey);
  if (!storedRace) return {};

  try {
    const parsedRace = JSON.parse(storedRace);
    if (!parsedRace.target_race || !parsedRace.target_race_date) {
      removeStoredValue(defaultRaceStorageKey, legacyDefaultRaceStorageKey);
      return {};
    }

    const raceDate = new Date(`${parsedRace.target_race_date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (Number.isNaN(raceDate.getTime()) || raceDate < today) {
      removeStoredValue(defaultRaceStorageKey, legacyDefaultRaceStorageKey);
      return {};
    }

    return parsedRace;
  } catch {
    removeStoredValue(defaultRaceStorageKey, legacyDefaultRaceStorageKey);
    return {};
  }
}

function getPersistedTrainingPhase() {
  if (typeof window === 'undefined') return '';
  return getStoredValue(trainingPhaseStorageKey, legacyTrainingPhaseStorageKey) || '';
}

function applyRaceToForm(currentForm, race) {
  return {
    ...currentForm,
    race_id: race.id || '',
    target_race: race.name || '',
    target_race_date: race.event_date || '',
  };
}

function mapRaceToDraft(race) {
  if (!race) return createRaceDraft();
  return {
    name: race.name || '',
    event_date: race.event_date || '',
    distance_miles: race.distance_miles ?? '',
    elevation_gain_ft: race.elevation_gain_ft ?? '',
    race_type: race.race_type || deriveRaceType(race.distance_miles, race.surface),
    location: race.location || '',
    surface: race.surface || '',
    notes: race.notes || '',
  };
}

export default function LogIntervention() {
  const [activities, setActivities] = useState([]);
  const [interventions, setInterventions] = useState([]);
  const [form, setForm] = useState(createEmptyForm());
  const [message, setMessage] = useState('');
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [activityDetails, setActivityDetails] = useState(null);
  const [loadingActivityDetails, setLoadingActivityDetails] = useState(false);
  const [raceOptions, setRaceOptions] = useState([]);
  const [loadingRaces, setLoadingRaces] = useState(false);
  const [raceProfile, setRaceProfile] = useState(null);
  const [raceDraft, setRaceDraft] = useState(createRaceDraft());
  const [raceDraftOpen, setRaceDraftOpen] = useState(false);
  const [raceStatus, setRaceStatus] = useState('');
  const [savingRace, setSavingRace] = useState(false);
  const [favoriteTypes, setFavoriteTypes] = useState(defaultFavoriteInterventions);
  const [quickLog, setQuickLog] = useState(false);
  const [activitySearch, setActivitySearch] = useState('');
  const [stravaConnected, setStravaConnected] = useState(true);
  const router = useRouter();
  const navLinks = [
    { href: '/dashboard', label: 'Threshold Home', description: 'Insights, trends, and recent training.' },
    { href: '/guide', label: 'Guide', description: 'Learn how to use the intervention log.' },
    { href: '/connections', label: 'Connections', description: 'Manage linked sources.' },
    { href: '/log-intervention', label: 'Log Intervention', description: 'Create a new intervention entry.' },
    { href: '/history', label: 'Intervention History', description: 'Review intervention records.' },
    { href: '/settings', label: 'Athlete Settings', description: 'Edit athlete baselines and zones.' },
    { href: '/content', label: 'Research', description: 'Browse the research library.' },
    { href: '/', label: 'Landing Page', description: 'Return to the public entry page.' },
  ];

  const interventionDefinitions = useMemo(() => getAllInterventionDefinitions(), []);
  const selectedDefinition = useMemo(
    () => getInterventionDefinition(form.intervention_type),
    [form.intervention_type]
  );
  const recentCategoryCounts = useMemo(() => countLast30Days(interventions), [interventions]);

  useEffect(() => {
    async function fetchActivities() {
      try {
        const res = await fetch('/api/activities');
        if (!res.ok) {
          setStravaConnected(false);
          setActivities([]);
          return;
        }
        const { activities: fetchedActivities } = await res.json();
        setStravaConnected(true);
        setActivities(sortActivitiesMostRecentFirst(fetchedActivities || []));
      } catch (err) {
        console.error(err);
        setStravaConnected(false);
        setActivities([]);
      } finally {
        setLoadingActivities(false);
      }
    }

    async function fetchInterventions() {
      try {
        const res = await fetch('/api/interventions');
        if (!res.ok) return;
        const data = await res.json();
        setInterventions(data.interventions || []);
      } catch (err) {
        console.error(err);
      }
    }

    const persistedRace = getPersistedRace();
    const persistedTrainingPhase = getPersistedTrainingPhase();
    setFavoriteTypes(getPersistedFavorites());
    setQuickLog(getPersistedQuickLog());

    setForm((currentForm) => ({
      ...currentForm,
      ...persistedRace,
      training_phase: persistedTrainingPhase,
    }));
    setRaceProfile(persistedRace.race_profile || null);
    setRaceDraft(mapRaceToDraft(persistedRace.race_profile || persistedRace));

    fetchActivities();
    fetchInterventions();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(favoriteInterventionStorageKey, JSON.stringify(favoriteTypes));
    window.localStorage.removeItem(legacyFavoriteInterventionStorageKey);
  }, [favoriteTypes]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(quickLogStorageKey, quickLog ? 'true' : 'false');
    window.localStorage.removeItem(legacyQuickLogStorageKey);
  }, [quickLog]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!form.target_race || !form.target_race_date) {
      removeStoredValue(defaultRaceStorageKey, legacyDefaultRaceStorageKey);
      return;
    }

    const raceDate = new Date(`${form.target_race_date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (Number.isNaN(raceDate.getTime()) || raceDate < today) {
      removeStoredValue(defaultRaceStorageKey, legacyDefaultRaceStorageKey);
      return;
    }

    window.localStorage.setItem(
      defaultRaceStorageKey,
      JSON.stringify({
        race_id: form.race_id,
        target_race: form.target_race,
        target_race_date: form.target_race_date,
        race_type: raceProfile?.race_type || raceDraft.race_type || deriveRaceType(raceDraft.distance_miles, raceDraft.surface),
        race_profile: raceProfile || {
          ...raceDraft,
          race_type: raceDraft.race_type || deriveRaceType(raceDraft.distance_miles, raceDraft.surface),
        },
      })
    );
  }, [form.race_id, form.target_race, form.target_race_date, raceDraft, raceProfile]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!form.training_phase) {
      removeStoredValue(trainingPhaseStorageKey, legacyTrainingPhaseStorageKey);
      return;
    }

    window.localStorage.setItem(trainingPhaseStorageKey, form.training_phase);
    window.localStorage.removeItem(legacyTrainingPhaseStorageKey);
  }, [form.training_phase]);

  // Pre-select intervention type from ?type= query param (e.g. linked from dashboard)
  useEffect(() => {
    if (!router.isReady) return;
    const typeParam = router.query.type;
    if (typeParam && typeof typeParam === 'string') {
      const decoded = decodeURIComponent(typeParam);
      // Only apply if the type actually exists in the catalog
      const def = getInterventionDefinition(decoded);
      if (def) {
        selectInterventionType(decoded);
        // Scroll the type selector into view smoothly
        setTimeout(() => {
          const el = document.getElementById('type-selector-section');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.type]);

  useEffect(() => {
    if (!router.isReady) return;
    const activityParam = router.query.activity;
    if (!activityParam || typeof activityParam !== 'string' || loadingActivities) return;

    const matchingActivity = activities.find(
      (activity) => String(activity.id) === String(activityParam)
    );

    setForm((currentForm) => {
      if (String(currentForm.activity_id || '') === String(activityParam)) {
        if (currentForm.activity_provider || !router.query.provider) {
          return currentForm;
        }

        return {
          ...currentForm,
          activity_provider: String(router.query.provider),
        };
      }

      return {
        ...currentForm,
        activity_id: String(activityParam),
        activity_provider: String(router.query.provider || matchingActivity?.provider || 'strava'),
        date: getActivityDate(matchingActivity) || currentForm.date,
      };
    });
  }, [activities, loadingActivities, router.isReady, router.query.activity, router.query.provider]);

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

  const selectedActivity = useMemo(
    () => activities.find((activity) => activity.id.toString() === form.activity_id),
    [activities, form.activity_id]
  );

  useEffect(() => {
    async function fetchActivityDetails() {
      if (!form.activity_id) {
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
  }, [form.activity_id]);

  useEffect(() => {
    let cancelled = false;

    async function fetchRaces() {
      const query = String(form.target_race || '').trim();
      if (!query && !raceDraftOpen) {
        setRaceOptions([]);
        return;
      }

      setLoadingRaces(true);
      try {
        const url = query ? `/api/races?q=${encodeURIComponent(query)}` : '/api/races';
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setRaceOptions(data.races || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) {
          setLoadingRaces(false);
        }
      }
    }

    const timeoutId = setTimeout(fetchRaces, 180);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [form.target_race, raceDraftOpen]);

  function selectInterventionType(type) {
    setForm((currentForm) => ({
      ...currentForm,
      intervention_type: type,
      protocol_payload: createProtocolPayload(type),
    }));
  }

  const handleChange = (event) => {
    const { name, value } = event.target;

    if (name === 'target_race') {
      setForm((currentForm) => ({
        ...currentForm,
        target_race: value,
        race_id: raceProfile?.name === value ? currentForm.race_id : '',
      }));
      setRaceStatus('');
      setRaceDraft((currentDraft) => ({ ...currentDraft, name: value }));
      if (!raceProfile || raceProfile.name !== value) {
        setRaceProfile(null);
      }
      return;
    }

    if (name === 'target_race_date') {
      setForm((currentForm) => ({ ...currentForm, target_race_date: value }));
      setRaceDraft((currentDraft) => ({ ...currentDraft, event_date: value }));
      return;
    }

    if (name === 'intervention_type') {
      selectInterventionType(value);
      return;
    }

    setForm((currentForm) => ({ ...currentForm, [name]: value }));
  };

  const handleActivitySelect = (activityId) => {
    const nextActivity = activities.find((activity) => activity.id.toString() === activityId);
    setForm((currentForm) => ({
      ...currentForm,
      activity_id: activityId,
      activity_provider: nextActivity?.provider || currentForm.activity_provider || 'strava',
      date: nextActivity ? getActivityDate(nextActivity) : currentForm.date,
    }));
  };

  const handleProtocolFieldChange = (fieldKey, value) => {
    setForm((currentForm) => ({
      ...currentForm,
      protocol_payload: {
        ...currentForm.protocol_payload,
        [fieldKey]: value,
      },
    }));
  };

  const handleRaceDraftChange = (event) => {
    const { name, value } = event.target;
    setRaceDraft((currentDraft) => {
      const nextDraft = { ...currentDraft, [name]: value };
      if ((name === 'distance_miles' || name === 'surface') && !currentDraft.race_type) {
        nextDraft.race_type = deriveRaceType(
          name === 'distance_miles' ? value : nextDraft.distance_miles,
          name === 'surface' ? value : nextDraft.surface
        );
      }
      return nextDraft;
    });
  };

  const selectRace = (race) => {
    const normalizedRace = {
      ...race,
      race_type: race.race_type || deriveRaceType(race.distance_miles, race.surface),
    };
    setRaceProfile(normalizedRace);
    setRaceDraft(mapRaceToDraft(normalizedRace));
    setRaceDraftOpen(false);
    setRaceStatus(`Selected ${normalizedRace.name}.`);
    setForm((currentForm) => applyRaceToForm(currentForm, normalizedRace));
  };

  const handleRaceSave = async (event) => {
    event.preventDefault();
    setSavingRace(true);
    setRaceStatus('');

    try {
      const res = await fetch('/api/races', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(raceDraft),
      });
      const data = await res.json();

      if (!res.ok) {
        setRaceStatus(`Error: ${data.error}`);
        return;
      }

      selectRace({
        ...data.race,
        race_type: raceDraft.race_type || deriveRaceType(raceDraft.distance_miles, raceDraft.surface),
      });
    } catch (err) {
      console.error(err);
      setRaceStatus('Error: Failed to save race.');
    } finally {
      setSavingRace(false);
    }
  };

  const toggleFavoriteType = () => {
    if (!form.intervention_type) return;
    setFavoriteTypes((currentFavorites) => {
      if (currentFavorites.includes(form.intervention_type)) {
        return currentFavorites.filter((item) => item !== form.intervention_type);
      }
      return [form.intervention_type, ...currentFavorites];
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    const latestType = form.intervention_type;
    const res = await fetch('/api/log-intervention', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      const persistedRace = getPersistedRace();
      const persistedPhase = getPersistedTrainingPhase();
      setMessage('Intervention logged.');
      setForm(createEmptyForm({ ...persistedRace, training_phase: persistedPhase }));
      setRaceProfile(persistedRace.race_profile || raceProfile);
      setInterventions((current) => [{ date: new Date().toISOString().slice(0, 10), intervention_type: latestType }, ...current]);
    } else {
      const { error } = await res.json();
      setMessage(`Error: ${error}`);
    }
  };

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between rounded-full border border-ink/10 bg-white/70 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-accent">Threshold Intervention Log</p>
          </div>
          <NavMenu
            label="Intervention navigation"
            links={navLinks}
            primaryLink={{ href: '/history', label: 'History' }}
          />
        </div>

        <DashboardTabs activeHref="/log-intervention" />

        <div className="ui-hero mb-10">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="min-w-0">
              <p className="text-sm uppercase tracking-[0.35em] text-accent">Intervention Capture</p>
              <h1 className="font-display mt-4 max-w-4xl break-words text-5xl leading-tight md:text-7xl">
                Log Intervention
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-ink/72">
                Build clean intervention data fast. Pick the protocol, attach the workout if it exists, and save the session while it is still fresh.
              </p>
            </div>

            <div className="ui-card-dark min-w-0">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Ready</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-card border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Quick Mode</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {quickLog ? 'Core fields only' : 'Full protocol detail'}
                  </p>
                </div>
                <div className="rounded-card border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent">Recent Categories</p>
                  <p className="mt-2 text-sm font-semibold text-white">{Object.keys(recentCategoryCounts).length} active in 30 days</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <form onSubmit={handleSubmit} className={cardClassName()}>
            {message ? (
              <p className="mb-5 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-ink">{message}</p>
            ) : null}

            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-ink/10 bg-paper px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-ink">Quick Log</p>
                <p className="mt-1 text-sm text-ink/65">Hide optional fields when you just need to save the essentials.</p>
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

            <div id="type-selector-section" className="grid gap-5">
              {/* When a type is selected, collapse the picker to a compact chip */}
              {form.intervention_type ? (
                <div className="flex items-center justify-between rounded-[24px] border border-ink/10 bg-paper px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{getInterventionIcon(form.intervention_type)}</span>
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-accent">Selected</p>
                      <p className="text-sm font-semibold text-ink">{form.intervention_type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleFavoriteType}
                      className="rounded-full border border-ink/10 px-3 py-1.5 text-xs font-semibold text-ink"
                    >
                      {favoriteTypes.includes(form.intervention_type) ? '★ Saved' : '☆ Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => selectInterventionType('')}
                      className="rounded-full bg-ink/8 px-3 py-1.5 text-xs font-semibold text-ink"
                    >
                      Change
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {interventions.length > 0 ? (
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-ink">Fast repeat</label>
                      <FavoriteTypeButtons favorites={favoriteTypes} selectedType={form.intervention_type} onSelect={selectInterventionType} />
                    </div>
                  ) : null}
                  <div>
                    <label className="mb-3 block text-sm font-semibold text-ink">Choose intervention</label>
                    <CategoryGrid
                      definitions={interventionDefinitions}
                      selectedType={form.intervention_type}
                      counts={recentCategoryCounts}
                      onSelect={selectInterventionType}
                    />
                  </div>
                </>
              )}

              <StravaActivityPicker
                activities={filteredActivities}
                activitySearch={activitySearch}
                selectedActivityId={form.activity_id}
                onSearchChange={setActivitySearch}
                onSelect={handleActivitySelect}
                loading={loadingActivities}
                stravaConnected={stravaConnected}
              />

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
                  <label className="mb-1 block text-sm font-semibold text-ink">Primary Target Race</label>
                  <input
                    type="text"
                    name="target_race"
                    value={form.target_race}
                    onChange={handleChange}
                    placeholder="Leadville 100"
                    className={fieldClassName()}
                  />
                  <div className="mt-3 space-y-2">
                    {loadingRaces ? <p className="text-xs text-ink/60">Searching saved races...</p> : null}
                    {!loadingRaces && raceOptions.length > 0 ? (
                      <div className="rounded-[22px] border border-ink/10 bg-paper/70 p-2 shadow-sm">
                        {raceOptions.map((race) => (
                          <button
                            key={race.id}
                            type="button"
                            onClick={() => selectRace(race)}
                            className={`flex w-full items-center justify-between rounded-[16px] px-3 py-3 text-left transition hover:bg-white ${
                              form.race_id === race.id ? 'bg-white' : ''
                            }`}
                          >
                            <span>
                              <span className="block text-sm font-semibold text-ink">{race.name}</span>
                              <span className="block text-xs text-ink/55">
                                {race.event_date || 'Date TBD'}
                                {race.location ? ` - ${race.location}` : ''}
                                {deriveRaceType(race.distance_miles, race.surface)
                                  ? ` - ${deriveRaceType(race.distance_miles, race.surface)}`
                                  : ''}
                              </span>
                            </span>
                            <span className="text-[11px] uppercase tracking-[0.2em] text-accent">
                              {form.race_id === race.id ? 'Selected ✓' : 'Use'}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setRaceDraftOpen((current) => !current)}
                      className="text-xs font-semibold uppercase tracking-[0.2em] text-accent"
                    >
                      {raceDraftOpen ? 'Hide race profile editor' : 'Create race profile'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-ink">Race Date</label>
                  <input type="date" name="target_race_date" value={form.target_race_date} onChange={handleChange} className={fieldClassName()} />
                </div>
              </div>

              {raceDraftOpen ? (
                <div className="rounded-[24px] bg-paper p-4">
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-ink">Race Profile</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-ink">Race Name</label>
                      <input type="text" name="name" value={raceDraft.name} onChange={handleRaceDraftChange} className={fieldClassName()} />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-ink">Location</label>
                      <input type="text" name="location" value={raceDraft.location} onChange={handleRaceDraftChange} className={fieldClassName()} />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-ink">Distance (mi)</label>
                      <input type="number" step="0.1" name="distance_miles" value={raceDraft.distance_miles} onChange={handleRaceDraftChange} className={fieldClassName()} />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-ink">Elevation Gain (ft)</label>
                      <input type="number" name="elevation_gain_ft" value={raceDraft.elevation_gain_ft} onChange={handleRaceDraftChange} className={fieldClassName()} />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-ink">Race Type</label>
                      <select name="race_type" value={raceDraft.race_type} onChange={handleRaceDraftChange} className={fieldClassName()}>
                        <option value="">Select Race Type</option>
                        {raceTypeOptions.map((raceType) => (
                          <option key={raceType} value={raceType}>
                            {raceType}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-ink">Surface</label>
                      <select name="surface" value={raceDraft.surface} onChange={handleRaceDraftChange} className={fieldClassName()}>
                        <option value="">Select Surface</option>
                        {surfaceOptions.map((surface) => (
                          <option key={surface} value={surface}>
                            {surface}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-ink">Event Date</label>
                      <input type="date" name="event_date" value={raceDraft.event_date} onChange={handleRaceDraftChange} className={fieldClassName()} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-sm font-semibold text-ink">Race Notes</label>
                      <textarea name="notes" value={raceDraft.notes} onChange={handleRaceDraftChange} rows={3} className={fieldClassName()} />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button type="button" onClick={handleRaceSave} disabled={savingRace} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper">
                      {savingRace ? 'Saving...' : 'Save Race Profile'}
                    </button>
                    {raceStatus ? <p className="text-sm text-ink/65">{raceStatus}</p> : null}
                  </div>
                </div>
              ) : null}

              {!quickLog ? (
                <div>
                  <label className="mb-1 block text-sm font-semibold text-ink">Notes</label>
                  <p className="mb-2 text-xs text-ink/50">Anything else worth capturing — how you felt, context, observations.</p>
                  <textarea name="notes" value={form.notes} onChange={handleChange} rows={4} className={fieldClassName()} />
                </div>
              ) : null}
            </div>

            <button type="submit" className="mt-6 rounded-full bg-ink px-6 py-3 font-semibold text-paper">
              Save Intervention
            </button>
          </form>

          <aside className="space-y-5">
            <ActivityContextCard
              selectedActivity={selectedActivity}
              activityDetails={activityDetails}
              loadingActivityDetails={loadingActivityDetails}
            />

            <div className={cardClassName()}>
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Race Context</p>
              {raceProfile ? (
                <div className="mt-4 space-y-3 text-sm text-ink/75">
                  <div className="rounded-2xl bg-paper p-4">
                    <p className="text-base font-semibold text-ink">{raceProfile.name}</p>
                    <p className="mt-1 text-ink/60">
                      {raceProfile.event_date || 'Date TBD'}
                      {raceProfile.location ? ` - ${raceProfile.location}` : ''}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-paper p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-accent">Race Type</p>
                      <p className="mt-1 text-lg font-semibold text-ink">{getRaceTypeLabel(raceProfile)}</p>
                    </div>
                    <div className="rounded-2xl bg-paper p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-accent">Distance</p>
                      <p className="mt-1 text-lg font-semibold text-ink">{formatDistanceMiles(raceProfile.distance_miles)}</p>
                    </div>
                    <div className="rounded-2xl bg-paper p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-accent">Elevation Gain</p>
                      <p className="mt-1 text-lg font-semibold text-ink">{formatFeet(raceProfile.elevation_gain_ft)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl bg-paper p-4 text-sm text-ink/75">
                  Add a race profile to tie this intervention to a real target.
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
