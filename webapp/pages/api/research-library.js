import cookie from 'cookie';
import { supabase } from '../../lib/supabaseClient';

const ALL_SCORE_COLUMNS =
  'ultra_score, gravel_score, triathlon_score, running_score, cycling_score, swimming_score, rowing_score, skating_score, ski_score, team_sport_score';

// Maps each onboarding sport name to the score column it should rank against.
// Kept in-process so the page stays fast without a sports_registry round-trip.
const SPORT_TO_SCORE_COLUMN = {
  Ultrarunner:              'ultra_score',
  'Trail Runner':           'ultra_score',
  Marathoner:               'running_score',
  'Half Marathoner':        'running_score',
  'Road Racer (5K-10K)':    'running_score',
  'Gravel Cyclist':         'gravel_score',
  'Road Cyclist':           'cycling_score',
  'Mountain Biker':         'cycling_score',
  'Long-Course Triathlete': 'triathlon_score',
  'Short-Course Triathlete':'triathlon_score',
  'Open-Water Swimmer':     'swimming_score',
  'Pool Swimmer':           'swimming_score',
  Rower:                    'rowing_score',
  'Paddler (Kayak / Canoe)':'rowing_score',
  'Speed Skater':           'skating_score',
  'Cross-Country Skier':    'ski_score',
  Biathlete:                'ski_score',
  'Soccer Player':          'team_sport_score',
  'Lacrosse Player':        'team_sport_score',
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  // Best-effort: read athlete sports to personalise the filter pre-selection.
  // Failure is non-fatal — the page works fine without personalisation.
  let athleteSportKeys = [];
  try {
    const cookies = cookie.parse(req.headers.cookie || '');
    const athleteId = cookies.athlete_id;
    if (athleteId) {
      const { data: athlete } = await supabase
        .from('athletes')
        .select('primary_sports')
        .eq('id', athleteId)
        .single();
      if (athlete?.primary_sports?.length) {
        const columns = new Set(
          athlete.primary_sports
            .map((s) => SPORT_TO_SCORE_COLUMN[s])
            .filter(Boolean)
        );
        athleteSportKeys = [...columns];
      }
    }
  } catch (_) {}

  const { data, error } = await supabase
    .from('research_library_entries')
    .select(
      `id, pubmed_id, title, authors, journal, publication_year, publication_date,
       pubmed_url, topic_tags, plain_english_summary, practical_takeaway, commentary,
       published, ${ALL_SCORE_COLUMNS}`
    )
    .eq('published', true)
    .order('publication_date', { ascending: false, nullsFirst: false })
    .order('publication_year', { ascending: false, nullsFirst: false });

  if (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ entries: data || [], athleteSportKeys });
}
