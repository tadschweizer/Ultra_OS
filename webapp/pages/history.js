import { useEffect, useState } from 'react';

/**
 * Page showing a table of all logged interventions for the current athlete.
 */
export default function History() {
  const [interventions, setInterventions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInterventions() {
      try {
        const res = await fetch('/api/interventions');
        if (res.ok) {
          const data = await res.json();
          setInterventions(data.interventions);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchInterventions();
  }, []);

  if (loading) return <p className="p-4">Loading…</p>;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">My Interventions</h1>
      {interventions.length === 0 ? (
        <p>No interventions logged yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr>
                <th className="py-2 px-2">Date</th>
                <th className="py-2 px-2">Type</th>
                <th className="py-2 px-2">Activity ID</th>
                <th className="py-2 px-2">GI</th>
                <th className="py-2 px-2">Physical</th>
                <th className="py-2 px-2">Feel</th>
              </tr>
            </thead>
            <tbody>
              {interventions.map((item) => (
                <tr key={item.id} className="border-t border-secondary">
                  <td className="py-2 px-2">{item.date}</td>
                  <td className="py-2 px-2">{item.intervention_type}</td>
                  <td className="py-2 px-2">{item.activity_id || '-'}</td>
                  <td className="py-2 px-2">{item.gi_response ?? '-'}</td>
                  <td className="py-2 px-2">{item.physical_response ?? '-'}</td>
                  <td className="py-2 px-2">{item.subjective_feel ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
