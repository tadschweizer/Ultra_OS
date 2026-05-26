import Exa from 'exa-js';

function getClient() {
  const key = process.env.EXA_API_KEY;
  if (!key) throw new Error('EXA_API_KEY is not set');
  return new Exa(key);
}

function mapResult(r) {
  return {
    title: r.title || null,
    url: r.url,
    publishedDate: r.publishedDate || null,
    highlights: r.highlights || [],
  };
}

/**
 * Discover races not yet in the database.
 * @param {string} query  e.g. "ultramarathon 100 mile Colorado 2026"
 * @param {{ numResults?: number }} [options]
 */
export async function searchRaces(query, options = {}) {
  const exa = getClient();
  const numResults = options.numResults ?? 10;
  const results = await exa.search(query, {
    type: 'auto',
    numResults,
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
    contents: { highlights: true },
  });
  return results.results.map(mapResult);
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
    contents: { highlights: true },
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
