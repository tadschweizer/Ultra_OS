import { classifyActivityType } from '../lib/activityInsights';
import {
  defaultFavoriteInterventions,
  favoriteInterventionStorageKey,
  legacyFavoriteInterventionStorageKey,
  getInterventionIcon,
} from '../lib/interventionCatalog';
import { getStoredValue } from '../lib/browserStorage';

export const trainingPhases = ['Base', 'Build', 'Peak', 'Taper', 'Recovery', 'Race Week'];
export const quickLogStorageKey = 'threshold-quick-log';
export const legacyQuickLogStorageKey = 'ultraos-quick-log';

export function fieldClassName() {
  return 'ui-input';
}

export function cardClassName() {
  return 'ui-card';
}

export function formatMinutes(totalSeconds) {
  if (!totalSeconds) return '';
  const totalMinutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes} min`;
  return `${hours}h ${minutes}m`;
}

export function formatFeet(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'N/A';
  return `${Math.round(Number(value)).toLocaleString()} ft`;
}

export function getPersistedFavorites() {
  if (typeof window === 'undefined') return defaultFavoriteInterventions;
  try {
    const stored = getStoredValue(favoriteInterventionStorageKey, legacyFavoriteInterventionStorageKey);
    if (!stored) return defaultFavoriteInterventions;
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.length ? parsed : defaultFavoriteInterventions;
  } catch {
    return defaultFavoriteInterventions;
  }
}

export function getPersistedQuickLog() {
  if (typeof window === 'undefined') return false;
  return getStoredValue(quickLogStorageKey, legacyQuickLogStorageKey) === 'true';
}

export function FavoriteTypeButtons({ favorites, selectedType, onSelect }) {
  if (!favorites.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {favorites.map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onSelect(type)}
          className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
            selectedType === type ? 'border-ink bg-ink text-paper' : 'border-border-subtle bg-white text-ink'
          }`}
        >
          {type}
        </button>
      ))}
    </div>
  );
}

export function countLast30Days(interventions) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  return interventions.reduce((counts, item) => {
    if (!item?.intervention_type || !item?.date) return counts;
    const entryDate = new Date(`${item.date}T00:00:00`);
    if (Number.isNaN(entryDate.getTime()) || entryDate < cutoff) return counts;
    counts[item.intervention_type] = (counts[item.intervention_type] || 0) + 1;
    return counts;
  }, {});
}

export function CategoryGrid({ definitions, selectedType, counts, onSelect }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {definitions.map((definition) => {
        const isSelected = selectedType === definition.label;
        const recentCount = counts[definition.label] || 0;
        return (
          <button
            key={definition.label}
            type="button"
            onClick={() => onSelect(definition.label)}
            className={`rounded-[26px] border px-4 py-4 text-left transition ${
              isSelected
                ? 'border-ink bg-panel text-paper shadow-panel'
                : 'border-border-subtle bg-paper text-ink hover:border-border hover:bg-surface-light'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-2xl" aria-hidden="true">
                {getInterventionIcon(definition.label)}
              </span>
              <span
                className={`ui-badge px-2.5 py-1 ${
                  isSelected ? 'bg-white/10 text-paper/80' : 'bg-white text-ink/60'
                }`}
              >
                {recentCount} in 30D
              </span>
            </div>
            <p className="mt-4 text-base font-semibold leading-snug">{definition.label}</p>
            <p className={`mt-2 text-xs uppercase tracking-[0.18em] ${isSelected ? 'text-paper/70' : 'text-accent'}`}>
              {definition.phase}
            </p>
          </button>
        );
      })}
    </div>
  );
}

export function StravaActivityPicker({
  activities,
  activitySearch,
  selectedActivityId,
  onSearchChange,
  onSelect,
  loading,
  stravaConnected,
  emptyCopy = 'Connect Strava to link workouts directly to intervention entries.',
  helperCopy = 'Optional. Pull a recent workout into this intervention log.',
}) {
  if (!stravaConnected) {
    return (
    <div className="rounded-card border border-dashed border-border-subtle bg-paper/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Link Strava Activity</p>
            <p className="mt-1 text-sm text-ink/65">{emptyCopy}</p>
          </div>
          <a href="/connections" className="text-sm font-semibold text-accent">
            Connect Strava to link activities →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-border-subtle bg-paper p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <label className="block text-sm font-semibold text-ink">Link Strava Activity</label>
          <p className="mt-1 text-sm text-ink/65">{helperCopy}</p>
        </div>
        {selectedActivityId ? (
          <button
            type="button"
            onClick={() => onSelect('')}
            className="ui-button-secondary px-3 py-1.5 text-xs"
          >
            Clear link
          </button>
        ) : null}
      </div>

      <input
        type="text"
        value={activitySearch}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search by workout name, date, or type"
        className="ui-input mt-4 bg-white"
      />

      <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
        {loading ? <p className="text-sm text-ink/60">Loading recent activities…</p> : null}
        {!loading && activities.length === 0 ? (
          <p className="text-sm text-ink/60">No recent Strava activities found.</p>
        ) : null}
        {!loading
          ? activities.map((activity) => {
              const active = selectedActivityId === activity.id.toString();
              return (
                <button
                  key={activity.id}
                  type="button"
                  onClick={() => onSelect(activity.id.toString())}
                  className={`w-full rounded-[22px] border px-4 py-3 text-left transition ${
                    active ? 'border-ink bg-white shadow-warm' : 'border-border-subtle bg-white/70 hover:bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{activity.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-accent">
                        {classifyActivityType(activity).label}
                      </p>
                    </div>
                    {active ? <span className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Linked</span> : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink/60">
                    <span>{new Date(activity.start_date).toLocaleDateString()}</span>
                    <span>{activity.distance ? `${(activity.distance / 1609.34).toFixed(1)} mi` : 'Distance N/A'}</span>
                    <span>{formatMinutes(activity.elapsed_time || activity.moving_time) || 'Time N/A'}</span>
                  </div>
                </button>
              );
            })
          : null}
      </div>
    </div>
  );
}

export function ActivityContextCard({
  selectedActivity,
  activityDetails,
  loadingActivityDetails,
  emptyCopy = 'Choose a Strava activity if this intervention belongs to a specific workout.',
}) {
  return (
    <div className="ui-card-dark">
      <p className="ui-eyebrow">Linked Activity Context</p>
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
            <p className="text-xs text-white/60">Additional activity details are unavailable for this workout.</p>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-white/70">{emptyCopy}</p>
      )}
    </div>
  );
}
