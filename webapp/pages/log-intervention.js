import { useEffect, useMemo, useState } from 'react';
import { classifyActivityType, sortActivitiesMostRecentFirst } from '../lib/activityInsights';
import {
  createProtocolPayload,
  defaultFavoriteInterventions,
  favoriteInterventionStorageKey,
  interventionCatalog,
} from '../lib/interventionCatalog';
import NavMenu from '../components/NavMenu';
import DashboardTabs from '../components/DashboardTabs';
import InterventionProtocolFields from '../components/InterventionProtocolFields';

const trainingPhases = ['Base', 'Build', 'Peak', 'Taper', 'Recovery', 'Race Week'];
const surfaceOptions = ['Trail', 'Road', 'Mixed', 'Track', 'Gravel', 'Treadmill'];
const defaultRaceStorageKey = 'ultraos-default-race';
const trainingPhaseStorageKey = 'ultraos-default-training-phase';

function createEmptyForm(defaultRace = {}) {
  return {
    race_id: defaultRace.race_id || '',
    activity_id: '',
    date: '',
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
    location: defaultRace.location || '',
    surface: defaultRace.surface || '',
    notes: defaultRace.notes || '',
  };
}

function formatMinutes(totalSeconds) {
  if (!totalSeconds) return '';
  return `${Math.round(totalSeconds / 60)} min`;
}

function formatFeet(value) {
  if (value === null || value === undefined) return 'N/A';
  return `${value.toLocaleString()} ft`;
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
  const storedRace = window.localStorage.getItem(defaultRaceStorageKey);
  if (!storedRace) return {};

  try {
    const parsedRace = JSON.parse(storedRace);
    if (!parsedRace.target_race || !parsedRace.target_race_date) {
      window.localStorage.removeItem(defaultRaceStorageKey);
      return {};
    }

    const raceDate = new Date(`${parsedRace.target_race_date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (Number.isNaN(raceDate.getTime()) || raceDate < today) {
      window.localStorage.removeItem(defaultRaceStorageKey);
      return {};
    }

    return parsedRace;
  } catch {
    window.localStorage.removeItem(defaultRaceStorageKey);
    return {};
  }
}

function getPersistedTrainingPhase() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(trainingPhaseStorageKey) || '';
}

function getPersistedFavorites() {
  if (typeof window === 'undefined') return defaultFavoriteInterventions;
  try {
    const stored = window.localStorage.getItem(favoriteInterventionStorageKey);
    if (!stored) return defaultFavoriteInterventions;
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.length ? parsed : defaultFavoriteInterventions;
  } catch {
    return defaultFavoriteInterventions;
  }
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
    location: race.location || '',
    surface: race.surface || '',
    notes: race.notes || '',
  };
}

function fieldClassName() {
  return 'w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-ink';
}

function cardClassName() {
  return 'rounded-[30px] border border-ink/10 bg-white p-6 shadow-[0_18px_40px_rgba(19,24,22,0.06)]';
}

function FavoriteTypeButtons({ favorites, selectedType, onSelect }) {
  if (!favorites.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {favorites.map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onSelect(type)}
          className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
            selectedType === type ? 'border-ink bg-ink text-paper' : 'border-ink/10 bg-white text-ink'
          }`}
        >
          {type}
        </button>
      ))}
    </div>
  );
}

export default function LogIntervention() {
  const [activities, setActivities] = useState([]);
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
  const navLinks = [
    { href: '/dashboard', label: 'UltraOS Home', description: 'Insights, trends, and recent training.' },
    { href: '/connections', label: 'Connections', description: 'Manage linked sources.' },
    { href: '/log-intervention', label: 'Log Intervention', description: 'Create a new intervention entry.' },
    { href: '/history', label: 'Intervention History', description: 'Review intervention records.' },
    { href: '/settings', label: 'Athlete Settings', description: 'Edit athlete baselines and zones.' },
    { href: '/content', label: 'Content', description: 'Track the content and community workstream.' },
    { href: '/', label: 'Landing Page', description: 'Return to the public entry page.' },
  ];

  useEffect(() => {
    async function fetchActivities() {
      try {
        const res = await fetch('/api/activities');
        if (res.ok) {
          const { activities: fetchedActivities } = await res.json();
          setActivities(sortActivitiesMostRecentFirst(fetchedActivities));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingActivities(false);
      }
    }

    const persistedRace = getPersistedRace();
    const persistedTrainingPhase = getPersistedTrainingPhase();
    setFavoriteTypes(getPersistedFavorites());

    setForm((currentForm) => ({
      ...currentForm,
      ...persistedRace,
      training_phase: persistedTrainingPhase,
    }));
    setRaceProfile(persistedRace.race_profile || null);
    setRaceDraft(mapRaceToDraft(persistedRace.race_profile || persistedRace));

    fetchActivities();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(favoriteInterventionStorageKey, JSON.stringify(favoriteTypes));
  }, [favoriteTypes]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!form.target_race || !form.target_race_date) {
      window.localStorage.removeItem(defaultRaceStorageKey);
      return;
    }

    const raceDate = new Date(`${form.target_race_date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (Number.isNaN(raceDate.getTime()) || raceDate < today) {
      window.localStorage.removeItem(defaultRaceStorageKey);
      return;
    }

    window.localStorage.setItem(
      defaultRaceStorageKey,
      JSON.stringify({
        race_id: form.race_id,
        target_race: form.target_race,
        target_race_date: form.target_race_date,
        race_profile: raceProfile,
      })
    );
  }, [form.race_id, form.target_race, form.target_race_date, raceProfile]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!form.training_phase) {
      window.localStorage.removeItem(trainingPhaseStorageKey);
      return;
    }

    window.localStorage.setItem(trainingPhaseStorageKey, form.training_phase);
  }, [form.training_phase]);

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
      const query = form.target_race.trim();
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

    if (name === 'activity_id') {
      const nextActivity = activities.find((activity) => activity.id.toString() === value);
      setForm((currentForm) => ({
        ...currentForm,
        activity_id: value,
        date: nextActivity ? getActivityDate(nextActivity) : currentForm.date,
      }));
      return;
    }

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
    setRaceDraft((currentDraft) => ({ ...currentDraft, [name]: value }));
  };

  const selectRace = (race) => {
    setRaceProfile(race);
    setRaceDraft(mapRaceToDraft(race));
    setRaceDraftOpen(false);
    setRaceStatus(`Selected ${race.name}.`);
    setForm((currentForm) => applyRaceToForm(currentForm, race));
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

      selectRace(data.race);
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
            <p className="text-xs uppercase tracking-[0.35em] text-accent">UltraOS Intervention Log</p>
          </div>
          <NavMenu
            label="Intervention navigation"
            links={navLinks}
            primaryLink={{ href: '/history', label: 'History' }}
          />
        </div>

        <DashboardTabs activeHref="/log-intervention" />

        <div className="mb-10 overflow-hidden rounded-[40px] border border-ink/10 bg-[linear-gradient(135deg,#f7f2ea_0%,#ebe1d4_55%,#dcc9b0_100%)] p-6 md:p-10">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-accent">Intervention Capture</p>
              <h1 className="font-display mt-4 max-w-4xl text-5xl leading-tight md:text-7xl">
                Log the protocol with the race it was meant to improve.
              </h1>
            </div>

            <div className="rounded-[34px] bg-panel p-6 text-white shadow-[0_40px_100px_rgba(0,0,0,0.28)]">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Form Flow</p>
              <div className="mt-5 space-y-4">
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">Choose the protocol first.</p>
                  <p className="mt-2 text-sm text-white/75">The form only shows fields that matter for that intervention.</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">Favorite the repeat protocols.</p>
                  <p className="mt-2 text-sm text-white/75">Repeated items stay at the top so weekly logging is faster.</p>
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

            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-ink">Favorites</label>
                <FavoriteTypeButtons favorites={favoriteTypes} selectedType={form.intervention_type} onSelect={selectInterventionType} />
              </div>

              <div className="md:col-span-2">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="block text-sm font-semibold text-ink">Intervention Type</label>
                  {form.intervention_type ? (
                    <button type="button" onClick={toggleFavoriteType} className="rounded-full border border-ink/10 px-3 py-1.5 text-xs font-semibold text-ink">
                      {favoriteTypes.includes(form.intervention_type) ? 'Remove Favorite' : 'Add Favorite'}
                    </button>
                  ) : null}
                </div>
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

              <div className="md:col-span-2">
                <InterventionProtocolFields
                  interventionType={form.intervention_type}
                  protocolPayload={form.protocol_payload}
                  onFieldChange={handleProtocolFieldChange}
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-ink">Link to Activity</label>
                <select name="activity_id" value={form.activity_id} onChange={handleChange} className={fieldClassName()}>
                  <option value="">{loadingActivities ? 'Loading activities...' : 'Select Activity'}</option>
                  {activities.map((activity) => {
                    const activityType = classifyActivityType(activity);
                    return (
                      <option key={activity.id} value={activity.id}>
                        {new Date(activity.start_date).toLocaleDateString()} - {activityType.label} - {activity.name}
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
                    <div className="rounded-[22px] border border-ink/10 bg-paper/70 p-2">
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

              {raceDraftOpen ? (
                <div className="md:col-span-2 rounded-[24px] bg-paper p-4">
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

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-ink">Additional Context</label>
                <textarea name="details" value={form.details} onChange={handleChange} rows={3} className={fieldClassName()} />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-ink">Notes</label>
                <textarea name="notes" value={form.notes} onChange={handleChange} rows={4} className={fieldClassName()} />
              </div>
            </div>

            <button type="submit" className="mt-5 rounded-full bg-ink px-6 py-3 font-semibold text-paper">
              Save Intervention
            </button>
          </form>

          <aside className="space-y-5">
            <div className="rounded-[30px] bg-[linear-gradient(135deg,#1b2421_0%,#29302d_100%)] p-6 text-white">
              <p className="text-sm uppercase tracking-[0.25em] text-accent">Linked Activity Context</p>
              {selectedActivity ? (
                <div className="mt-4 space-y-3 text-sm text-white/85">
                  <div>
                    <p className="font-semibold text-white">{selectedActivity.name}</p>
                    <p className="text-white/65">{new Date(selectedActivity.start_date).toLocaleString()}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-accent">Activity Type</p>
                    <p className="mt-1 text-lg font-semibold text-white">{classifyActivityType(selectedActivity).label}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-accent">Duration</p>
                      <p className="mt-1 text-lg font-semibold text-white">{formatMinutes(selectedActivity.moving_time) || 'N/A'}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-accent">Distance</p>
                      <p className="mt-1 text-lg font-semibold text-white">
                        {selectedActivity.distance ? `${(selectedActivity.distance / 1609.34).toFixed(1)} mi` : 'N/A'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:col-span-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-accent">Elevation Gain</p>
                      <p className="mt-1 text-lg font-semibold text-white">
                        {selectedActivity.total_elevation_gain
                          ? `${Math.round(selectedActivity.total_elevation_gain * 3.28084)} ft`
                          : 'Not provided by this activity summary'}
                      </p>
                    </div>
                  </div>
                  {loadingActivityDetails ? (
                    <p className="text-xs text-white/60">Loading deeper altitude details...</p>
                  ) : activityDetails ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-accent">Start Altitude</p>
                        <p className="mt-1 text-lg font-semibold text-white">{formatFeet(activityDetails.start_altitude_ft)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-accent">End Altitude</p>
                        <p className="mt-1 text-lg font-semibold text-white">{formatFeet(activityDetails.end_altitude_ft)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-accent">Average Altitude</p>
                        <p className="mt-1 text-lg font-semibold text-white">{formatFeet(activityDetails.average_altitude_ft)}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-accent">Peak Altitude</p>
                        <p className="mt-1 text-lg font-semibold text-white">{formatFeet(activityDetails.peak_altitude_ft ?? activityDetails.elev_high_ft)}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-white/60">Activity streams were not available for this workout.</p>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-sm text-white/70">Select a recent activity to attach workout context.</p>
              )}
            </div>

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
                  Save a race once and keep using it until race day without retyping it for every protocol.
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
