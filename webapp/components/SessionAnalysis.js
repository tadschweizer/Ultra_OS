import { useEffect, useMemo, useState } from 'react';
import { useWorkspaceTransport } from '../lib/WorkspaceTransport';
import { distanceSplits, hrDistribution, planComparison, rangeStats, peakEfforts, plannedTimeSegments } from '../lib/sessionAnalysis';

const clock = seconds => { if (seconds == null || !Number.isFinite(seconds)) return '—'; const s = Math.round(seconds); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const value = (n, digits = 1) => n == null || !Number.isFinite(n) ? '—' : n.toFixed(digits);
const tracks = [['speed', 'Speed', '#0369a1'], ['hr', 'Heart rate', '#be123c'], ['power', 'Power', '#7e22ce'], ['cadence', 'Cadence', '#047857'], ['elevation', 'Elevation', '#92400e']];

export default function SessionAnalysis({ workout = null, activity = null, distanceUnit = 'mi' }) {
  const { request, getAccountScope } = useWorkspaceTransport();
  const [data, setData] = useState(null), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const [range, setRange] = useState(null), [cursor, setCursor] = useState(0), [tab, setTab] = useState('splits');
  const subject = workout ? `workout_id=${encodeURIComponent(workout.id)}` : `activity_id=${encodeURIComponent(activity.id)}`;
  const scope = getAccountScope?.();
  useEffect(() => {
    let current = true;
    setData(null); setError(''); setRange(null); setCursor(0);
    request(`/api/session-analysis?${subject}`).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not load analysis.');
      if (current) setData(body);
    }).catch(e => { if (current) setError(e.message); });
    return () => { current = false; };
  }, [request, subject, scope, retry, workout?.updated_at]);
  const points = data?.points || [];
  const paceSport = /run|walk|hik/i.test(workout?.sport || activity?.sport || data?.activity?.sport || '');
  const chartPoints = useMemo(() => points.map(p => ({ ...p, pace: p.speed > 0 ? 1000 / p.speed : null })), [data]);
  const chartTracks = tracks.map(track => track[0] === 'speed' && paceSport ? ['pace', 'Pace', track[2]] : track);
  const first = points[0]?.t || 0, last = points.at(-1)?.t || 0;
  const start = range?.[0] ?? first, end = range?.[1] ?? last;
  const unitMeters = distanceUnit === 'mi' ? 1609.344 : 1000;
  const stats = useMemo(() => rangeStats(points, start, end), [data, start, end]);
  const splits = useMemo(() => distanceSplits(points, unitMeters), [data, unitMeters]);
  const laps = useMemo(() => (data?.laps || []).map(lap => ({ ...lap, ...rangeStats(points, lap.start, lap.end) })), [data]);
  const distribution = useMemo(() => hrDistribution(points, data?.settings), [data]);
  const peaks = useMemo(() => peakEfforts(points, points.some(p => p.power != null) ? 'power' : 'speed'), [data]);
  const planned = useMemo(() => plannedTimeSegments(workout, points), [data, workout]);
  const rows = tab === 'laps' ? laps : tab === 'plan' ? planned : splits;
  const selected = chartPoints[Math.min(cursor, points.length - 1)];
  const pace = seconds => `${clock(seconds == null ? null : seconds * unitMeters / 1000)} /${distanceUnit}`;
  const channelValue = (key, n) => key === 'pace' ? pace(n) : key === 'speed' ? `${value(n == null ? null : n * 3600 / unitMeters)} ${distanceUnit}/h` : key === 'elevation' ? `${value(n == null ? null : n * (distanceUnit === 'mi' ? 3.28084 : 1), 0)} ${distanceUnit === 'mi' ? 'ft' : 'm'}` : `${value(n, 0)} ${{ hr: 'bpm', power: 'W', cadence: 'rpm' }[key]}`;
  const comparison = planComparison(workout, data?.activity);
  return <section aria-label="Workout analysis" className="mt-5 overflow-hidden rounded-2xl border border-ink/20 bg-white text-ink">
    <div className="border-b border-ink/10 p-4 sm:p-5">
      <p className="text-xs uppercase tracking-widest text-sky-800">Completed session</p>
      <h4 className="mt-1 text-xl font-semibold">Workout analysis</h4>
      <p className="mt-1 text-sm text-ink/70">{workout ? 'Review execution against the assigned plan.' : 'Explore how the session unfolded. No assigned targets.'}</p>
    </div>
    {workout && <div className="p-4 sm:p-5">
      <h5 className="font-semibold">Planned vs completed</h5>
      <div className="overflow-x-auto"><table className="mt-2 w-full text-left text-sm"><thead><tr className="border-b"><th className="py-2">Measure</th><th>Planned</th><th>Actual</th><th>Difference</th></tr></thead><tbody>
        {comparison.map(row => { const factor = row.unit === 'km' && distanceUnit === 'mi' ? 1000 / 1609.344 : 1; const unit = row.unit === 'km' ? distanceUnit : row.unit; return <tr key={row.label} className="border-b border-ink/10"><th className="py-3 font-normal">{row.label} ({unit})</th><td>{value(row.planned == null ? null : row.planned * factor)}</td><td>{value(row.actual == null ? null : row.actual * factor)}</td><td>{row.delta > 0 ? '+' : ''}{value(row.delta == null ? null : row.delta * factor)}</td></tr>; })}
      </tbody></table></div>
      <p className="mt-2 text-xs text-ink/60">A difference describes volume, not workout quality. Missing values stay unknown.</p>
    </div>}
    <div className="p-4 pt-0 sm:p-5 sm:pt-0">
      {!data && !error && <p role="status" className="py-4">Loading recorded session…</p>}
      {error && <p role="alert" className="py-3 text-red-700">{error}</p>}
      {data && <p className="my-3 text-xs leading-5 text-ink/65">{data.recording}</p>}
      {(error || data && points.length < 2) && <button onClick={() => setRetry(n => n + 1)} className="min-h-11 rounded border border-ink/20 px-3">Retry analysis</button>}
      {points.length > 1 && <>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4"><h5 className="font-semibold">Session timeline</h5><button className="min-h-11 rounded border px-3 text-sm" onClick={() => setRange(null)}>Full session</button></div>
        <p className="mb-3 text-xs text-ink/65">Select a split or lap, or set a time range below. Each channel uses its own vertical scale.</p>
        {chartTracks.filter(([key]) => chartPoints.some(p => p[key] != null)).map(([key, label, color]) => {
          const visible = chartPoints.filter(p => p.t >= start && p.t <= end);
          let low = Infinity, high = -Infinity;
          for (const p of visible) if (p[key] != null) { low = Math.min(low, p[key]); high = Math.max(high, p[key]); }
          // Render at most ~1200 points per channel; calculations use all samples.
          const stride = Math.max(1, Math.ceil(visible.length / 1200));
          let path = '', connected = false;
          visible.forEach((p, i) => {
            if (p[key] == null || i > 0 && p.t - visible[i - 1].t > 30) connected = false;
            if (p[key] == null || i % stride !== 0 && i !== visible.length - 1) return;
            const x = (p.t - start) / Math.max(1, end - start) * 800;
            const scaled = (p[key] - low) / Math.max(1, high - low) * 60;
            const y = key === 'pace' ? 10 + scaled : 70 - scaled;
            path += `${connected ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)} `; connected = true;
          });
          return <div key={key} className="border-b border-ink/10 py-2">
            <div className="flex flex-wrap justify-between gap-1 text-xs"><strong style={{ color }}>{label}</strong><span>{channelValue(key, selected?.[key])} · range {channelValue(key, Number.isFinite(low) ? low : null)}–{channelValue(key, Number.isFinite(high) ? high : null)}</span></div>
            <svg role="img" aria-label={`${label} over elapsed time`} viewBox="0 0 800 80" className="h-20 w-full" preserveAspectRatio="none" onPointerMove={event => {
              const rect = event.currentTarget.getBoundingClientRect(); const t = start + (event.clientX - rect.left) / rect.width * (end - start);
              let lo = 0, hi = points.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (points[mid].t < t) lo = mid + 1; else hi = mid; } setCursor(lo);
            }}>
              <path d="M0 70H800 M0 40H800 M0 10H800" stroke="#e5e7eb" fill="none"/><path d={path} stroke={color} strokeWidth="1.7" fill="none" vectorEffect="non-scaling-stroke"/>
              {selected && selected.t >= start && selected.t <= end && <line x1={(selected.t - start) / Math.max(1, end - start) * 800} x2={(selected.t - start) / Math.max(1, end - start) * 800} y1="0" y2="80" stroke="#334155" strokeDasharray="3 3"/>}
            </svg>
          </div>;
        })}
        <div className="mt-1 flex justify-between text-xs tabular-nums"><span>{clock(start)}</span><span>Elapsed time</span><span>{clock(end)}</span></div>
        <label className="mt-3 block text-xs">Inspect recording at {clock(selected?.t)}<input aria-label="Inspect recording" type="range" min="0" max={points.length - 1} value={cursor} onChange={e => setCursor(Number(e.target.value))} className="block min-h-11 w-full"/></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">Start (seconds)<input aria-label="Analysis start seconds" type="number" min={first} max={end - 1} value={Math.round(start)} onChange={e => { if (e.target.value !== '') setRange([Math.max(first, Math.min(end - 1, Number(e.target.value))), end]); }} className="mt-1 min-h-11 w-full rounded border p-2"/></label>
          <label className="text-sm">End (seconds)<input aria-label="Analysis end seconds" type="number" min={start + 1} max={last} value={Math.round(end)} onChange={e => { if (e.target.value !== '') setRange([start, Math.min(last, Math.max(start + 1, Number(e.target.value)))]); }} className="mt-1 min-h-11 w-full rounded border p-2"/></label>
        </div>
        <div aria-label="Selected range statistics" className="my-4 border-y bg-slate-50 p-3 text-sm">
          <strong>{range ? 'Selected range' : 'Full session'} · {clock(stats.duration)}</strong>
          <p className="mt-1 leading-6">{value(stats.distance == null ? null : stats.distance / unitMeters, 2)} {distanceUnit} · {pace(stats.pace)} · {channelValue('hr', stats.hr)} · {channelValue('power', stats.power)}</p>
          <p className="text-xs text-ink/60">Observed {clock(stats.observed)} of {clock(stats.duration)}. HR coverage {clock(stats.coverage.hr || 0)}; power coverage {clock(stats.coverage.power || 0)}. Averages use recorded time, including stops.</p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Interval table options">{[['splits', `${distanceUnit} splits`], ['laps', 'Recorded laps'], ...(workout ? [['plan', 'Planned steps']] : [])].map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)} className={`min-h-11 rounded border px-3 text-sm ${tab === id ? 'bg-panel text-white' : ''}`}>{label}</button>)}</div>
        {tab === 'plan' && <p className="mt-3 text-xs text-ink/65">Planned steps are aligned from the start of elapsed recording time. Stops or a late start shift this comparison; these are not detected interval boundaries or compliance scores.</p>}
        {tab === 'plan' && planned.map((row, i) => <p key={i} className="mt-1 text-xs">{row.label}: {row.target || 'Open effort'}</p>)}
        {rows.length ? <div className="mt-3 max-h-80 overflow-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th>Interval</th><th>Time</th><th>Pace</th><th>HR</th><th>Power</th></tr></thead><tbody>
          {rows.map((row, i) => <tr key={i} className="border-b border-ink/10"><td><button aria-label={`Analyze ${tab === 'laps' ? row.label : `split ${row.label}`}`} className="min-h-11 px-2 text-sky-800 underline" onClick={() => { setRange([row.start, row.end]); setCursor(points.findIndex(p => p.t >= row.start)); }}>{row.label}</button></td><td>{clock(row.duration)}</td><td className="whitespace-nowrap">{clock(row.pace == null ? null : row.pace * unitMeters / 1000)}</td><td>{value(row.hr, 0)}</td><td>{value(row.power, 0)}</td></tr>)}
        </tbody></table></div> : <p className="my-3 text-sm text-ink/65">{tab === 'laps' ? 'No recorded lap boundaries available.' : tab === 'plan' ? 'Only fixed-duration, non-repeating steps can be aligned here. Use recorded laps to review distance, repeated or open steps.' : 'Continuous distance samples are required to calculate splits.'}</p>}
        <h5 className="mt-5 font-semibold">Best recorded efforts</h5>
        <p className="mt-1 text-xs text-ink/60">Highest average power, or speed when power is absent. Windows begin at recorded samples and require complete coverage. Select one to inspect it.</p>
        <div className="mt-2 flex flex-wrap gap-2">{peaks.map(peak => <button key={peak.duration} className="min-h-11 rounded border px-3 py-2 text-left text-sm" onClick={() => setRange([peak.start, peak.end])}><strong>{clock(peak.duration)}</strong><span className="block">{channelValue(peak.channel, peak.average)}</span></button>)}</div>
        {!peaks.length && <p className="mt-2 text-sm">No complete effort windows available.</p>}
        <h5 className="mt-5 font-semibold">Heart-rate distribution · full session</h5>
        <p className="mt-1 text-xs text-ink/60">Bands use this athlete’s saved thresholds. Unknown heart-rate time is excluded.</p>
        {distribution ? distribution.map(bin => <div key={bin.label} className="mt-3"><div className="flex justify-between text-xs"><span>{bin.label}</span><span>{clock(bin.seconds)}</span></div><div className="mt-1 h-2 bg-slate-100"><div className="h-2 bg-rose-700" style={{ width: `${bin.seconds / Math.max(1, last - first) * 100}%` }}/></div></div>) : <p className="mt-3 text-sm text-ink/65">Set ordered heart-rate thresholds in athlete settings to see time in bands. No default zones are assumed.</p>}
      </>}
    </div>
  </section>;
}
