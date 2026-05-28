import { useEffect, useRef, useState } from 'react';

export default function RaceSearchInput({ value, onChange, onSelect, placeholder = 'Search races…', className = '' }) {
  const [catalogResults, setCatalogResults] = useState([]);
  const [webResults, setWebResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const hasResults = catalogResults.length > 0 || webResults.length > 0;

  useEffect(() => {
    const q = (value || '').trim();
    if (q.length < 2) {
      setCatalogResults([]);
      setWebResults([]);
      setOpen(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    async function doSearch() {
      try {
        const catalogRes = await fetch(`/api/race-catalog?q=${encodeURIComponent(q)}`);
        const catalog = catalogRes.ok ? (await catalogRes.json()).races || [] : [];
        if (!cancelled) setCatalogResults(catalog);

        // Only call Exa when catalog has sparse results
        if (!cancelled && catalog.length < 4) {
          try {
            const exaRes = await fetch(`/api/exa/race-search?q=${encodeURIComponent(q + ' race')}&num=6`);
            const web = exaRes.ok ? (await exaRes.json()).races || [] : [];
            if (!cancelled) setWebResults(web);
          } catch (_) {
            // Exa is an optional fallback — silently skip on error
          }
        } else if (!cancelled) {
          setWebResults([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setOpen(true);
        }
      }
    }

    const timer = setTimeout(doSearch, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value]);

  useEffect(() => {
    function onMouseDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  function handleCatalogSelect(race) {
    setOpen(false);
    onChange(race.name);
    onSelect({
      source: 'catalog',
      catalog_id: race.id,
      name: race.name,
      event_date: race.event_date,
      distance_miles: race.distance_miles,
      location: [race.city, race.state, race.country].filter(Boolean).join(', '),
      race_type: race.sport_type,
      elevation_gain_ft: race.elevation_gain_ft || null,
      terrain: race.terrain || null,
      avg_temp_f: race.avg_temp_f || null,
      url: race.url || null,
    });
  }

  function handleWebSelect(result) {
    setOpen(false);
    const name = result.title || '';
    onChange(name);
    onSelect({
      source: 'web',
      name,
      url: result.url,
      event_date: result.event_date || null,
      distance_miles: result.distance_miles || null,
      location: result.location || null,
      race_type: null,
      elevation_gain_ft: result.elevation_gain_ft || null,
      terrain: result.terrain || null,
      highlights: result.highlights || [],
    });
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => hasResults && setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink placeholder-ink/30 focus:outline-none focus:ring-2 focus:ring-accent/30"
          autoComplete="off"
        />
        {loading && (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-ink/35">
            Searching…
          </span>
        )}
      </div>

      {open && hasResults && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-80 overflow-y-auto rounded-[20px] border border-ink/10 bg-white shadow-[0_16px_40px_rgba(19,24,22,0.14)]">
          {catalogResults.length > 0 && (
            <div className="pb-1">
              <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-ink/35">
                In catalog
              </p>
              {catalogResults.map((race) => (
                <button
                  key={race.id}
                  type="button"
                  onMouseDown={() => handleCatalogSelect(race)}
                  className="w-full px-4 py-2.5 text-left transition-colors hover:bg-paper"
                >
                  <p className="text-sm font-semibold text-ink">{race.name}</p>
                  <p className="mt-0.5 text-xs text-ink/50">
                    {[
                      race.sport_type,
                      race.event_date,
                      race.distance_miles ? `${race.distance_miles} mi` : null,
                      [race.city, race.state, race.country].filter(Boolean).join(', '),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </button>
              ))}
            </div>
          )}

          {webResults.length > 0 && (
            <div className={`pb-1 ${catalogResults.length > 0 ? 'border-t border-ink/6' : ''}`}>
              <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-ink/35">
                From the web
              </p>
              {webResults.map((result, i) => (
                <button
                  key={i}
                  type="button"
                  onMouseDown={() => handleWebSelect(result)}
                  className="w-full px-4 py-2.5 text-left transition-colors hover:bg-paper"
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{result.title}</p>
                      {result.highlights?.[0] && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-ink/50">{result.highlights[0]}</p>
                      )}
                    </div>
                    <span className="mt-0.5 shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                      Web
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="h-1.5" />
        </div>
      )}
    </div>
  );
}
