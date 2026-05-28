import Exa from 'exa-js';

function getClient() {
  const key = process.env.EXA_API_KEY;
  if (!key) throw new Error('EXA_API_KEY is not set');
  return new Exa(key);
}

// ─── Parsing helpers ──────────────────────────────────────────────────────────

function parseEventDate(text) {
  if (!text) return null;
  const t = text.replace(/\n/g, ' ');

  // "June 27, 2026" / "Jun 27, 2026" / "June 27 2026" — any year 2010–2039
  const m1 = t.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})[,\s]+(20[1-3]\d)\b/i
  );
  if (m1) {
    const d = new Date(`${m1[1]} ${m1[2]}, ${m1[3]}`);
    if (!isNaN(d)) return d.toISOString().split('T')[0];
  }

  // ISO "2026-06-27" — any year 2010–2039
  const m2 = t.match(/\b(20[1-3]\d)-(\d{2})-(\d{2})\b/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;

  // "06/27/2026" — any year 2010–2039
  const m3 = t.match(/\b(\d{1,2})\/(\d{1,2})\/(20[1-3]\d)\b/);
  if (m3) {
    const d = new Date(`${m3[3]}-${m3[1].padStart(2, '0')}-${m3[2].padStart(2, '0')}`);
    if (!isNaN(d)) return d.toISOString().split('T')[0];
  }

  return null;
}

function parseDistanceMiles(text) {
  if (!text) return null;

  // "100 miles" / "100-mile" / "100 Mile"
  const milesMatch = text.match(/\b(\d+(?:\.\d+)?)\s*[-–]?\s*miles?\b/i);
  if (milesMatch) {
    const v = parseFloat(milesMatch[1]);
    if (v > 0 && v < 1000) return v;
  }

  // "100km" / "50km" — convert to miles
  const kmMatch = text.match(/\b(\d+(?:\.\d+)?)\s*km\b/i) || text.match(/\b(\d+(?:\.\d+)?)\s*K\b/);
  if (kmMatch) {
    const v = parseFloat(kmMatch[1]) * 0.621371;
    if (v > 0 && v < 700) return Math.round(v * 10) / 10;
  }

  // Named distances
  if (/\bhalf[- ]marathon\b/i.test(text)) return 13.1;
  if (/\bmarathon\b/i.test(text) && !/\bhalf\b/i.test(text)) return 26.2;

  return null;
}

function parseElevationGain(text) {
  if (!text) return null;
  const patterns = [
    /\b([\d,]+)\s*(?:feet|ft|foot|')\s+(?:of\s+)?(?:gain|climbing|vert(?:ical)?|elevation\s+gain)\b/i,
    /(?:gain|climbing|vert(?:ical)?|elevation\s+gain)\s+(?:of\s+)?([\d,]+)\s*(?:feet|ft|foot|')\b/i,
    /\b([\d,]+)\s*(?:feet|ft|foot|')\s+(?:total\s+)?(?:of\s+)?(?:ascent)\b/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const raw = (m[1] || m[2] || '').replace(/,/g, '');
      const v = parseFloat(raw);
      if (!isNaN(v) && v > 100 && v < 60000) return Math.round(v);
    }
  }
  return null;
}

function parseTerrain(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  const trailScore = (lower.match(/\b(?:trail|single\s*track|dirt|mountain|technical)\b/g) || []).length;
  const roadScore = (lower.match(/\b(?:road|pavement|paved|street|tarmac|asphalt)\b/g) || []).length;
  if (trailScore > 0 && roadScore === 0) return 'trail';
  if (roadScore > 0 && trailScore === 0) return 'road';
  if (trailScore > 0 || roadScore > 0) return 'mixed';
  return null;
}

function parseLocation(text) {
  if (!text) return null;
  // "City, ST" pattern — US states only
  const m = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*([A-Z]{2})\b/);
  if (m) return `${m[1]}, ${m[2]}`;
  return null;
}

// Normalize a title to a short key for deduplication
function normalizeTitle(title) {
  if (!title) return '';
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 5)
    .join(' ');
}

function mapResult(r) {
  const fullText = [r.title || '', r.text || '', ...(r.highlights || [])].join(' ');
  return {
    title: r.title || null,
    url: r.url,
    publishedDate: r.publishedDate || null,
    highlights: r.highlights || [],
    event_date: parseEventDate(fullText),
    distance_miles: parseDistanceMiles(fullText),
    elevation_gain_ft: parseElevationGain(fullText),
    terrain: parseTerrain(fullText),
    location: parseLocation(fullText),
  };
}

// ─── Public functions ─────────────────────────────────────────────────────────

/**
 * Discover races not yet in the database.
 * Fetches extra results to allow title-based deduplication.
 * @param {string} query  e.g. "ultramarathon 100 mile Colorado 2026"
 * @param {{ numResults?: number }} [options]
 */
export async function searchRaces(query, options = {}) {
  const exa = getClient();
  const numResults = options.numResults ?? 6;
  // Fetch 3× requested to absorb duplicates and filtered-out past events, capped at 30
  const fetchNum = Math.min(numResults * 3, 30);

  // Append current year to bias Exa toward upcoming races
  const year = new Date().getFullYear();
  const futureQuery = query.includes(String(year)) ? query : `${query} ${year}`;

  const results = await exa.search(futureQuery, {
    type: 'auto',
    numResults: fetchNum,
    includeDomains: [
      'ultrasignup.com',
      'runningintheusa.com',
      'athlinks.com',
      'bikereg.com',
      'active.com',
      'triathlon.org',
      'ironman.com',
      'worldathletics.org',
      'theathletesvillage.com',
      'ultrarunning.com',
    ],
    contents: {
      highlights: true,
      text: { maxCharacters: 2000 },
    },
  });

  const today = new Date().toISOString().split('T')[0];

  // Deduplicate, map, then drop any result whose parsed date is in the past
  const seen = new Set();
  return results.results
    .filter((r) => {
      const key = normalizeTitle(r.title);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(mapResult)
    .filter((r) => !r.event_date || r.event_date >= today)
    .slice(0, numResults);
}

/**
 * Enrich an existing race with course details, elevation, cutoffs, etc.
 * @param {string} raceName  e.g. "Western States 100"
 * @param {string} [location] e.g. "California"
 */
export async function enrichRace(raceName, location = '') {
  const exa = getClient();
  const q = location
    ? `${raceName} ${location} race course elevation cutoffs aid stations`
    : `${raceName} race course elevation cutoffs aid stations`;
  const results = await exa.search(q, {
    type: 'auto',
    numResults: 6,
    contents: {
      highlights: true,
      text: { maxCharacters: 2000 },
    },
  });
  return results.results.map(mapResult);
}

/**
 * Surface training articles, race reports, and guides for a given sport/distance.
 * @param {string} sport  e.g. "ultramarathon" | "cycling" | "triathlon"
 * @param {string} [distance]  e.g. "100 mile" | "Ironman" | "sprint"
 * @param {string} [topic]  optional focus e.g. "nutrition" | "taper" | "race report"
 */
export async function searchTrainingContent(sport, distance = '', topic = '') {
  const exa = getClient();
  const parts = [sport, distance, topic, 'training tips guide'].filter(Boolean);
  const results = await exa.search(parts.join(' '), {
    type: 'auto',
    numResults: 10,
    contents: { highlights: true },
  });
  return results.results.map(mapResult);
}

/**
 * Pull recent news and upcoming event announcements for a sport.
 * @param {string} sport  e.g. "ultramarathon" | "cycling" | "triathlon" | "running"
 * @param {{ numResults?: number }} [options]
 */
export async function fetchNewsFeed(sport, options = {}) {
  const exa = getClient();
  const numResults = options.numResults ?? 10;
  const year = new Date().getFullYear();
  const results = await exa.search(`${sport} race events news ${year}`, {
    type: 'auto',
    numResults,
    contents: { highlights: true },
  });
  return results.results.map(mapResult);
}
