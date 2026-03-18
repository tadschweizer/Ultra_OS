import { useState, useEffect } from 'react';

const interventionTypes = [
  'Heat acclimation',
  'Sodium bicarbonate',
  'Gut training',
  'Sleep protocol',
  'Respiratory training',
  'BFR recovery',
  'Altitude',
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

/**
 * Page containing a form to log a new intervention. It fetches recent
 * activities for selection and posts the form data to the API.
 */
export default function LogIntervention() {
  const [activities, setActivities] = useState([]);
  const [form, setForm] = useState({
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
    target_race: '',
    notes: '',
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function fetchActivities() {
      const res = await fetch('/api/activities');
      if (res.ok) {
        const { activities } = await res.json();
        setActivities(activities);
      }
    }
    fetchActivities();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
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
      setMessage('Intervention logged!');
      setForm({
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
        target_race: '',
        notes: '',
      });
    } else {
      const { error } = await res.json();
      setMessage(`Error: ${error}`);
    }
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Log Intervention</h1>
      {message && <p className="mb-4 text-accent">{message}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1">Link to Strava Activity</label>
          <select
            name="activity_id"
            value={form.activity_id}
            onChange={handleChange}
            className="text-black w-full p-2 rounded"
          >
            <option value="">Select Activity</option>
            {activities.map((act) => (
              <option key={act.id} value={act.id}>
                {new Date(act.start_date).toLocaleDateString()} — {act.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block mb-1">Date</label>
          <input
            type="date"
            name="date"
            value={form.date}
            onChange={handleChange}
            className="text-black w-full p-2 rounded"
          />
        </div>
        <div>
          <label className="block mb-1">Intervention Type</label>
          <select
            name="intervention_type"
            value={form.intervention_type}
            onChange={handleChange}
            className="text-black w-full p-2 rounded"
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
          <label className="block mb-1">Protocol Details</label>
          <textarea
            name="details"
            value={form.details}
            onChange={handleChange}
            className="text-black w-full p-2 rounded"
          />
        </div>
        <div>
          <label className="block mb-1">Dose or Duration</label>
          <input
            type="text"
            name="dose_duration"
            value={form.dose_duration}
            onChange={handleChange}
            className="text-black w-full p-2 rounded"
          />
        </div>
        <div>
          <label className="block mb-1">Timing</label>
          <select
            name="timing"
            value={form.timing}
            onChange={handleChange}
            className="text-black w-full p-2 rounded"
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
          <label className="block mb-1">GI Response (1–10)</label>
          <input
            type="number"
            name="gi_response"
            value={form.gi_response}
            onChange={handleChange}
            min="1"
            max="10"
            className="text-black w-full p-2 rounded"
          />
        </div>
        <div>
          <label className="block mb-1">Physical Response (1–10)</label>
          <input
            type="number"
            name="physical_response"
            value={form.physical_response}
            onChange={handleChange}
            min="1"
            max="10"
            className="text-black w-full p-2 rounded"
          />
        </div>
        <div>
          <label className="block mb-1">Subjective Feel (1–10)</label>
          <input
            type="number"
            name="subjective_feel"
            value={form.subjective_feel}
            onChange={handleChange}
            min="1"
            max="10"
            className="text-black w-full p-2 rounded"
          />
        </div>
        <div>
          <label className="block mb-1">Training Phase</label>
          <select
            name="training_phase"
            value={form.training_phase}
            onChange={handleChange}
            className="text-black w-full p-2 rounded"
          >
            <option value="">Select Phase</option>
            {trainingPhases.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block mb-1">Target Race</label>
          <input
            type="text"
            name="target_race"
            value={form.target_race}
            onChange={handleChange}
            className="text-black w-full p-2 rounded"
          />
        </div>
        <div>
          <label className="block mb-1">Notes</label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            className="text-black w-full p-2 rounded"
          />
        </div>
        <button
          type="submit"
          className="bg-accent text-primary px-4 py-2 rounded font-semibold"
        >
          Submit
        </button>
      </form>
    </div>
  );
}
