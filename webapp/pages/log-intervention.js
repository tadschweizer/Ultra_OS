import { useEffect, useMemo, useState } from 'react';

const interventionTypes = [
  'Heat acclimation',
  'Sodium bicarbonate',
  'Gut training',
  'Sleep protocol',
  'Respiratory training',
  'BFR recovery',
  'Altitude Tent',
  'Probiotic',
  'Supplement',
  'Custom',
];
const timingOptions = [
  'Morning',
  'Pre-workout',
  'During workout',
  'Post-workout',
  'Race week',
  'Race morning',
];
const trainingPhases = ['Base', 'Build', 'Peak', 'Taper', 'Recovery', 'Race week'];
const defaultRaceStorageKey = 'ultraos-default-race';
const trainingPhaseStorageKey = 'ultraos-default-training-phase';

function createEmptyForm(defaultRace = {}) {
  return {
    activity_id: '',
    date: '',
    intervention_type: '',
    details: '',
    dose_duration: '',
    timing: '',
    gi_response: '',
    physical_response: '',
    subjective_feel: '',
    training_phase: '',
    target_race: defaultRace.target_race || '',
    target_race_date: defaultRace.target_race_date || '',
    notes: '',
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

/**
 * Page containing a form to log a new intervention. It fetches recent
 * activities for selection and posts the form data to the API.
 */
export default function LogIntervention() {
  const [activities, setActivities] = useState([]);
  const [form, setForm] = useState(createEmptyForm());
  const [message, setMessage] = useState('');
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [activityDetails, setActivityDetails] = useState(null);
  const [loadingActivityDetails, setLoadingActivityDetails] = useState(false);

  useEffect(() => {
    async function fetchActivities() {
      try {
        const res = await fetch('/api/activities');
        if (res.ok) {
          const { activities: fetchedActivities } = await res.json();
          const sortedActivities = [...fetchedActivities].sort(
            (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
          );
          setActivities(sortedActivities);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingActivities(false);
      }
    }

    setForm((currentForm) => ({
      ...currentForm,
      ...getPersistedRace(),
      training_phase: getPersistedTrainingPhase(),
    }));

    fetchActivities();
  }, []);

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
        target_race: form.target_race,
        target_race_date: form.target_race_date,
      })
    );
  }, [form.target_race, form.target_race_date]);

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

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'activity_id') {
      const nextActivity = activities.find((activity) => activity.id.toString() === value);
      setForm((currentForm) => ({
        ...currentForm,
        activity_id: value,
        date: nextActivity ? getActivityDate(nextActivity) : currentForm.date,
        dose_duration:
          nextActivity && !currentForm.dose_duration
            ? formatMinutes(nextActivity.moving_time)
            : currentForm.dose_duration,
      }));
      return;
    }

    setForm((currentForm) => ({ ...currentForm, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    const res = await fetch('/api/log-intervention', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const persistedRace = getPersistedRace();
      setMessage('Intervention logged.');
      setForm(createEmptyForm(persistedRace));
    } else {
      const { error } = await res.json();
      setMessage(`Error: ${error}`);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-accent">Intervention Intelligence</p>
          <h1 className="text-3xl font-bold text-white">Log Intervention</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Record the protocol, attach it to a workout when relevant, and preserve the race
            context that gives the entry meaning later.
          </p>
        </div>
        <div className="flex gap-3">
          <a href="/dashboard" className="rounded-full border border-slate-600 px-4 py-2 text-sm text-slate-200">
            Back to Dashboard
          </a>
          <a href="/history" className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-primary">
            View History
          </a>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <form onSubmit={handleSubmit} className="space-y-5 rounded-[28px] border border-slate-700 bg-secondary/60 p-6 shadow-2xl shadow-black/30">
          {message && <p className="rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent">{message}</p>}

          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-slate-100">Link to Strava Activity</label>
              <select
                name="activity_id"
                value={form.activity_id}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-600 bg-slate-950 px-4 py-3 text-white"
              >
                <option value="">{loadingActivities ? 'Loading activities...' : 'Select Activity'}</option>
                {activities.map((act) => (
                  <option key={act.id} value={act.id}>
                    {new Date(act.start_date).toLocaleDateString()} - {act.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-100">Date</label>
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-600 bg-slate-950 px-4 py-3 text-white"
              />
              <p className="mt-2 text-xs text-slate-400">
                If you link an activity, this defaults to the Strava activity date.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-100">Intervention Type</label>
              <select
                name="intervention_type"
                value={form.intervention_type}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-600 bg-slate-950 px-4 py-3 text-white"
              >
                <option value="">Select Type</option>
                {interventionTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-100">Primary Target Race</label>
              <input
                type="text"
                name="target_race"
                value={form.target_race}
                onChange={handleChange}
                placeholder="Leadville 100"
                className="w-full rounded-2xl border border-slate-600 bg-slate-950 px-4 py-3 text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-100">Race Date</label>
              <input
                type="date"
                name="target_race_date"
                value={form.target_race_date}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-600 bg-slate-950 px-4 py-3 text-white"
              />
              <p className="mt-2 text-xs text-slate-400">
                This race stays as the default target until the date passes.
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-slate-100">Protocol Details</label>
              <textarea
                name="details"
                value={form.details}
                onChange={handleChange}
                rows={4}
                className="w-full rounded-2xl border border-slate-600 bg-slate-950 px-4 py-3 text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-100">Dose or Duration</label>
              <input
                type="text"
                name="dose_duration"
                value={form.dose_duration}
                onChange={handleChange}
                placeholder="40 min, 0.3 g/kg, 3 nights"
                className="w-full rounded-2xl border border-slate-600 bg-slate-950 px-4 py-3 text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-100">Timing</label>
              <select
                name="timing"
                value={form.timing}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-600 bg-slate-950 px-4 py-3 text-white"
              >
                <option value="">Select Timing</option>
                {timingOptions.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-100">GI Response (1-10)</label>
              <input
                type="number"
                name="gi_response"
                value={form.gi_response}
                onChange={handleChange}
                min="1"
                max="10"
                className="w-full rounded-2xl border border-slate-600 bg-slate-950 px-4 py-3 text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-100">Physical Response (1-10)</label>
              <input
                type="number"
                name="physical_response"
                value={form.physical_response}
                onChange={handleChange}
                min="1"
                max="10"
                className="w-full rounded-2xl border border-slate-600 bg-slate-950 px-4 py-3 text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-100">Subjective Feel (1-10)</label>
              <input
                type="number"
                name="subjective_feel"
                value={form.subjective_feel}
                onChange={handleChange}
                min="1"
                max="10"
                className="w-full rounded-2xl border border-slate-600 bg-slate-950 px-4 py-3 text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-100">Training Phase</label>
              <select
                name="training_phase"
                value={form.training_phase}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-600 bg-slate-950 px-4 py-3 text-white"
              >
                <option value="">Select Phase</option>
                {trainingPhases.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-slate-100">Notes</label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={4}
                className="w-full rounded-2xl border border-slate-600 bg-slate-950 px-4 py-3 text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            className="rounded-full bg-accent px-5 py-3 font-semibold text-primary transition hover:brightness-110"
          >
            Submit
          </button>
        </form>

        <aside className="space-y-5">
          <div className="rounded-[28px] border border-slate-700 bg-slate-950/80 p-6">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">Linked Activity Context</p>
            {selectedActivity ? (
              <div className="mt-4 space-y-3 text-sm text-slate-200">
                <div>
                  <p className="font-semibold text-white">{selectedActivity.name}</p>
                  <p className="text-slate-400">{new Date(selectedActivity.start_date).toLocaleString()}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Duration</p>
                    <p className="mt-1 text-lg font-semibold text-white">{formatMinutes(selectedActivity.moving_time) || 'N/A'}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Distance</p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {selectedActivity.distance ? `${(selectedActivity.distance / 1609.34).toFixed(1)} mi` : 'N/A'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3 sm:col-span-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Elevation Gain</p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {selectedActivity.total_elevation_gain
                        ? `${Math.round(selectedActivity.total_elevation_gain * 3.28084)} ft`
                        : 'Not provided by this Strava summary'}
                    </p>
                  </div>
                </div>
                {loadingActivityDetails ? (
                  <p className="text-xs text-slate-400">Loading deeper altitude details...</p>
                ) : activityDetails ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Start Altitude</p>
                      <p className="mt-1 text-lg font-semibold text-white">{formatFeet(activityDetails.start_altitude_ft)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">End Altitude</p>
                      <p className="mt-1 text-lg font-semibold text-white">{formatFeet(activityDetails.end_altitude_ft)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Average Altitude</p>
                      <p className="mt-1 text-lg font-semibold text-white">{formatFeet(activityDetails.average_altitude_ft)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Peak Altitude</p>
                      <p className="mt-1 text-lg font-semibold text-white">
                        {formatFeet(activityDetails.peak_altitude_ft ?? activityDetails.elev_high_ft)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Lowest Altitude</p>
                      <p className="mt-1 text-lg font-semibold text-white">
                        {formatFeet(activityDetails.low_altitude_ft ?? activityDetails.elev_low_ft)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Acclimation Use</p>
                      <p className="mt-1 text-sm text-slate-300">
                        Compare this workout altitude against your stored sleep and training baselines in athlete settings.
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    Activity streams were not available for this workout, so only summary elevation data could be shown.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-400">
                Select a recent Strava activity to auto-fill the intervention date and attach workout context.
              </p>
            )}
          </div>

          <div className="rounded-[28px] border border-slate-700 bg-secondary/40 p-6">
            <p className="text-sm uppercase tracking-[0.25em] text-accent">Data Direction</p>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              <li>Target race and race date persist until the race passes.</li>
              <li>Rest-day interventions still work because activity linking remains optional.</li>
              <li>Altitude context is only partially available from the current Strava endpoint.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
