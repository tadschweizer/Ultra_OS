import { getSupabaseAdminClient } from './authServer';
import { searchPubMed, summarizePubMed } from './pubmed';

const DEFAULT_TIMEOUT_MS = 6500;

export const RESEARCH_TOPICS = [
  {
    key: 'heat-acclimation',
    label: 'Heat Acclimation',
    query: 'heat acclimation endurance athletes performance',
    aliases: ['heat', 'sauna', 'hot race', 'heat training'],
    summary: {
      confidence: 'High',
      bottomLine:
        'Heat acclimation is one of the most actionable pre-race interventions for hot or exposed endurance events. The best results come from repeated heat exposure that improves thermal control without reducing key workout quality.',
      agrees:
        'Most evidence supports 10 to 14 days of repeated heat exposure, with early plasma-volume changes and slower improvements in sweat response, perceived effort, and thermal tolerance.',
      uncertain:
        'The right dose depends on current heat exposure, training load, humidity, race duration, and how much the athlete can tolerate without compromising the rest of the block.',
      protocol:
        'Start 3 to 4 weeks before the target race. Add controlled heat exposure after easy sessions or as short passive sauna blocks, then maintain with lower-dose exposure while preserving long-run and race-specific quality.',
      avoid:
        'Avoid aggressive heat blocks during illness, dehydration, poor sleep, heavy race-specific sessions, or when heat stress causes missed quality work.',
      bestFit: 'Best fit for hot ultramarathons, exposed gravel races, long-course triathlon, and summer training blocks.',
    },
  },
  {
    key: 'gut-training',
    label: 'Gut Training',
    query: 'gut training carbohydrate intake endurance athletes',
    aliases: ['fueling', 'carbs', 'carbohydrate', 'stomach', 'gi distress'],
    summary: {
      confidence: 'High',
      bottomLine:
        'Gut training is a trainable performance lever, especially for races where carbohydrate intake is a limiter. It should be practiced during real movement, not only planned on paper.',
      agrees:
        'Repeated race-like carbohydrate intake improves tolerance and helps athletes move from lower intake ceilings toward higher hourly targets.',
      uncertain:
        'Exact intake targets vary by body size, intensity, product mix, heat, fluid tolerance, and past GI history.',
      protocol:
        'Begin 8 to 12 weeks out. Start near the athlete current tolerated intake, then add 5 to 10 g/hour every 1 to 2 weeks during long runs or rides until race targets are stable.',
      avoid:
        'Avoid big race-week jumps, untested products, high fiber before key sessions, and practicing only at easy intensity if race day will be harder.',
      bestFit: 'Best fit for ultras, gravel, Ironman, marathon, and any event where fueling failure can decide the outcome.',
    },
  },
  {
    key: 'sodium-bicarbonate',
    label: 'Sodium Bicarbonate',
    query: 'sodium bicarbonate exercise performance endurance athletes',
    aliases: ['bicarb', 'buffering'],
    summary: {
      confidence: 'Moderate-high',
      bottomLine:
        'Sodium bicarbonate is useful when the event or session has repeated hard surges, climbs, or threshold pressure. It is less compelling for steady aerobic racing.',
      agrees:
        'The performance upside is strongest when acidosis contributes to fatigue. GI tolerance is the main practical limiter.',
      uncertain:
        'Individual response varies widely, and some athletes cannot tolerate effective doses without GI cost.',
      protocol:
        'Test it in training first. Use key workouts that mimic race stress, start with conservative split doses, and record GI response before considering race-day use.',
      avoid:
        'Avoid first-time race use, aggressive dosing before long steady events, and use in athletes with repeated GI problems.',
      bestFit: 'Best fit for criterium-like gravel surges, hilly racing, middle-distance running, and late-race threshold pressure.',
    },
  },
  {
    key: 'caffeine',
    label: 'Caffeine',
    query: 'caffeine endurance performance position stand',
    aliases: ['coffee'],
    summary: {
      confidence: 'High',
      bottomLine:
        'Caffeine is one of the strongest evidence-backed endurance aids, but the best protocol is personal because sleep, anxiety, gut response, and timing matter.',
      agrees:
        'Moderate doses before or during endurance work can improve performance and perceived effort. Habitual caffeine use does not remove the benefit for most athletes.',
      uncertain:
        'Exact dose and timing depend on tolerance, event duration, start time, and whether late-race alertness or early-race output is the main target.',
      protocol:
        'Test 2 to 4 mg/kg before key sessions, then decide whether a smaller late-race top-up helps. Record sleep and GI effects, not only pace.',
      avoid:
        'Avoid high doses when sleep is already poor, anxiety is high, GI risk is elevated, or the event starts late in the day.',
      bestFit: 'Best fit for almost every endurance format when the athlete has tested dose and timing.',
    },
  },
  {
    key: 'sleep',
    label: 'Sleep',
    query: 'sleep restriction endurance performance athletes systematic review',
    aliases: ['sleep extension', 'sleep loss', 'recovery sleep'],
    summary: {
      confidence: 'High',
      bottomLine:
        'Sleep is a performance input, not just recovery decoration. In long endurance sport, sleep loss often appears first as worse perception, decision quality, and emotional control.',
      agrees:
        'Restricted sleep worsens endurance performance, mood, reaction time, and perceived effort. Sleep extension can improve readiness and consistency.',
      uncertain:
        'Wearable sleep scores can be useful trends but are not precise enough to make every training decision alone.',
      protocol:
        'Protect sleep during hard blocks and the 7 to 10 days before racing. Track sleep debt alongside subjective feel and RPE after sessions.',
      avoid:
        'Avoid adding extra interventions when the primary problem is under-sleeping. Fix sleep before interpreting weak training response as poor fitness.',
      bestFit: 'Best fit for all endurance athletes, especially high-volume athletes and ultra racers managing overnight fatigue.',
    },
  },
  {
    key: 'altitude',
    label: 'Altitude',
    query: 'altitude training live high train low endurance athletes performance',
    aliases: ['altitude tent', 'live high train low'],
    summary: {
      confidence: 'Moderate-high',
      bottomLine:
        'Altitude helps when the athlete can accumulate enough hypoxic exposure while keeping key workout quality intact. Exposure that replaces useful training is usually a poor trade.',
      agrees:
        'Live-high train-low models are more practical than forcing hard training at altitude, because high-quality workouts still matter.',
      uncertain:
        'Response varies by exposure duration, iron status, altitude dose, training history, and whether the race itself is at altitude.',
      protocol:
        'Plan altitude blocks or tent use around the race calendar, monitor workout quality, and check iron status before serious altitude exposure.',
      avoid:
        'Avoid altitude blocks when threshold work collapses, sleep worsens, illness risk rises, or race-specific work is sacrificed.',
      bestFit: 'Best fit for altitude races, elite preparation blocks, and athletes who can control recovery and training quality.',
    },
  },
  {
    key: 'hydration',
    label: 'Hydration',
    query: 'hydration endurance performance hyponatremia athletes consensus',
    aliases: ['sodium', 'electrolytes', 'hyponatremia', 'fluid'],
    summary: {
      confidence: 'High',
      bottomLine:
        'Hydration strategy is about avoiding both under-drinking and over-drinking. In long events, forced fluid schedules can be dangerous when they exceed sweat losses.',
      agrees:
        'Thirst-guided drinking is safer than rigid over-drinking in long events, and sodium helps most when paired with realistic fluid intake.',
      uncertain:
        'Sweat rate and sodium concentration vary widely by athlete, heat, intensity, clothing, and acclimation.',
      protocol:
        'Test fluid and sodium targets in long sessions. Track weight change, thirst, bloating, urine pattern, and perceived effort.',
      avoid:
        'Avoid drinking to gain weight during long races, using sodium as permission to over-drink, or copying another athlete fluid plan.',
      bestFit: 'Best fit for ultras, Ironman, hot gravel, and any race longer than 4 hours.',
    },
  },
  {
    key: 'taper',
    label: 'Taper',
    query: 'taper endurance performance training volume review athletes',
    aliases: ['race week', 'peaking'],
    summary: {
      confidence: 'High',
      bottomLine:
        'A good taper reduces fatigue without removing intensity. Athletes often feel restless, but fitness does not disappear just because volume drops.',
      agrees:
        'Reducing volume while maintaining some intensity commonly improves performance. Two weeks is a useful default for many endurance races.',
      uncertain:
        'Ideal taper length depends on event duration, athlete fatigue, age, training history, and how hard the final build was.',
      protocol:
        'Reduce volume meaningfully, keep short touches of intensity, and avoid adding last-minute work just to feel productive.',
      avoid:
        'Avoid long hard sessions too close to race day, panic training, and changing nutrition or recovery routines during taper.',
      bestFit: 'Best fit for every target race, with longer events usually needing more fatigue reduction.',
    },
  },
  {
    key: 'strength-training',
    label: 'Strength Training',
    query: 'strength training running economy endurance athletes review',
    aliases: ['strength', 'weights', 'resistance training', 'bfr'],
    summary: {
      confidence: 'Moderate-high',
      bottomLine:
        'Strength training can improve economy, durability, and late-race resilience, but it must be placed so it supports endurance training instead of competing with it.',
      agrees:
        'Heavy strength, plyometrics, and well-timed resistance work can help trained endurance athletes, especially through improved economy and tissue capacity.',
      uncertain:
        'The best plan depends on injury history, gym skill, race demands, and whether the athlete is in base, build, or race-specific training.',
      protocol:
        'Use 1 to 2 focused sessions per week, keep quality high, and separate heavy strength from key endurance sessions when possible.',
      avoid:
        'Avoid adding high soreness strength work during peak race-specific blocks or pairing heavy lifting tightly with the hardest endurance sessions.',
      bestFit: 'Best fit for runners needing durability, gravel athletes needing power, and triathletes managing high training volume.',
    },
  },
  {
    key: 'recovery',
    label: 'Recovery',
    query: 'post exercise recovery techniques endurance athletes meta analysis',
    aliases: ['cold immersion', 'ice bath', 'massage', 'foam rolling'],
    summary: {
      confidence: 'Moderate-high',
      bottomLine:
        'Recovery tools can reduce soreness and fatigue, but the right tool depends on whether the goal is feeling better soon or maximizing adaptation from the session.',
      agrees:
        'Active recovery, cold water immersion, massage, and compression can help perceived soreness and fatigue in specific contexts.',
      uncertain:
        'Some recovery tools may blunt desired adaptation if used aggressively after sessions where the training signal is the point.',
      protocol:
        'Use recovery tools after races, dense training blocks, or sessions where freshness for the next workout matters more than adaptation from the current one.',
      avoid:
        'Avoid treating recovery tools as a substitute for sleep, food, lower stress, and appropriate training load.',
      bestFit: 'Best fit for stage-race style demands, heavy blocks, race week, and athletes who need rapid turnaround.',
    },
  },
  {
    key: 'hrv',
    label: 'HRV',
    query: 'heart rate variability endurance training athletes readiness',
    aliases: ['readiness', 'heart rate variability'],
    summary: {
      confidence: 'Moderate',
      bottomLine:
        'HRV is useful as a trend signal, not a daily command. It works best when combined with sleep, subjective feel, training load, and recent stress.',
      agrees:
        'Sustained HRV suppression can indicate accumulated stress, while day-to-day noise should be interpreted carefully.',
      uncertain:
        'Device accuracy, measurement timing, illness, alcohol, travel, and stress can all change the signal.',
      protocol:
        'Track morning HRV trends over weeks. Use it to ask better questions before changing the plan.',
      avoid:
        'Avoid canceling or adding key sessions from one isolated HRV reading.',
      bestFit: 'Best fit for athletes with consistent measurement habits and enough training history to interpret trends.',
    },
  },
  {
    key: 'running-economy',
    label: 'Running Economy',
    query: 'running economy determinants endurance performance review',
    aliases: ['economy', 'technique', 'form'],
    summary: {
      confidence: 'Moderate-high',
      bottomLine:
        'Running economy is often the difference between similar athletes. It improves through strength, plyometrics, mechanics, footwear, and smart race-specific practice.',
      agrees:
        'Economy is affected by biomechanics, tendon stiffness, neuromuscular qualities, and fatigue resistance.',
      uncertain:
        'No single cue fixes everyone, and forcing form changes can backfire if they create tension or injury risk.',
      protocol:
        'Use hill sprints, strides, strength, cadence awareness, and occasional video review without overhauling everything at once.',
      avoid:
        'Avoid chasing perfect form during high fatigue or changing mechanics right before a race.',
      bestFit: 'Best fit for runners and triathletes seeking speed without simply adding more volume.',
    },
  },
  {
    key: 'lactate-threshold',
    label: 'Lactate Threshold',
    query: 'lactate threshold endurance performance training athletes review',
    aliases: ['threshold', 'tempo'],
    summary: {
      confidence: 'High',
      bottomLine:
        'Threshold is one of the most race-relevant performance markers for trained endurance athletes. Improving it usually matters more than chasing watch-estimated VO2max.',
      agrees:
        'Threshold pace or power reflects how much of the aerobic ceiling an athlete can sustain for long periods.',
      uncertain:
        'Field estimates vary, and lab lactate values need consistent protocols to be comparable.',
      protocol:
        'Use repeatable tempo, progression, and long interval sessions. Track threshold changes with consistent tests or workouts.',
      avoid:
        'Avoid turning every moderate workout into threshold work. Too much gray-zone load can flatten the training block.',
      bestFit: 'Best fit for marathon, gravel, triathlon, and any event with sustained pressure.',
    },
  },
  {
    key: 'vo2max',
    label: 'VO2max',
    query: 'VO2max endurance performance limiting factors review',
    aliases: ['vo2', 'aerobic capacity'],
    summary: {
      confidence: 'High',
      bottomLine:
        'VO2max sets part of the ceiling, but it is not the whole performance story. For trained athletes, threshold, economy, durability, and fueling often decide race results.',
      agrees:
        'High-intensity intervals and long-term aerobic volume can improve VO2max, especially when recovery supports the work.',
      uncertain:
        'Wearable VO2max estimates can move for reasons unrelated to true physiological change.',
      protocol:
        'Use 4 to 8 minute intervals near VO2max intensity sparingly inside a larger aerobic program.',
      avoid:
        'Avoid chasing VO2max at the expense of race-specific durability, fueling, or consistency.',
      bestFit: 'Best fit for athletes needing to raise aerobic ceiling while preserving endurance-specific work.',
    },
  },
  {
    key: 'carbohydrate-loading',
    label: 'Carbohydrate Loading',
    query: 'carbohydrate loading endurance performance athletes review',
    aliases: ['carb loading', 'glycogen'],
    summary: {
      confidence: 'High',
      bottomLine:
        'Carbohydrate loading is useful for events long enough for glycogen availability to matter. It should be practiced, not improvised.',
      agrees:
        'Higher carbohydrate intake before long races can increase glycogen availability and improve endurance performance.',
      uncertain:
        'Best food choices depend on gut tolerance, body size, race timing, and travel constraints.',
      protocol:
        'Use 1 to 3 days of higher carbohydrate intake before long events, paired with reduced training volume and familiar low-risk foods.',
      avoid:
        'Avoid extreme fiber, unfamiliar foods, or forcing huge intake for events too short to benefit.',
      bestFit: 'Best fit for marathons, ultras, long gravel, and long-course triathlon.',
    },
  },
  {
    key: 'creatine',
    label: 'Creatine',
    query: 'creatine supplementation endurance athletes safety performance review',
    aliases: ['creatine monohydrate'],
    summary: {
      confidence: 'Moderate-high',
      bottomLine:
        'Creatine is not a direct endurance booster for steady efforts, but it may support strength, repeated surges, training quality, and muscle maintenance.',
      agrees:
        'Creatine monohydrate is the best-supported form and is safe for healthy athletes at normal doses.',
      uncertain:
        'Endurance-specific payoff depends on event demands and whether small weight changes matter.',
      protocol:
        'Use 3 to 5 g/day of creatine monohydrate and judge it over weeks, not single workouts.',
      avoid:
        'Avoid loading or race-week starts if weight, GI response, or water retention concerns matter.',
      bestFit: 'Best fit for gravel surges, strength-supported runners, masters athletes, and heavy training blocks.',
    },
  },
  {
    key: 'nitrates',
    label: 'Nitrates',
    query: 'dietary nitrate beetroot endurance performance athletes review',
    aliases: ['beetroot', 'beet juice'],
    summary: {
      confidence: 'Moderate',
      bottomLine:
        'Nitrates can improve efficiency for some athletes, but response is inconsistent and may be smaller in highly trained athletes.',
      agrees:
        'Beetroot or nitrate intake can reduce oxygen cost and support performance in some endurance contexts.',
      uncertain:
        'Responder status, mouthwash use, diet background, and event type all change the effect.',
      protocol:
        'Test acute nitrate dosing before key workouts, then decide whether multi-day loading is worth it.',
      avoid:
        'Avoid first-time race use and antibacterial mouthwash around nitrate protocols.',
      bestFit: 'Best fit for time trials, sustained hard efforts, and athletes who respond clearly in training.',
    },
  },
  {
    key: 'beta-alanine',
    label: 'Beta-Alanine',
    query: 'beta alanine supplementation exercise performance endurance athletes',
    aliases: ['beta alanine'],
    summary: {
      confidence: 'Moderate',
      bottomLine:
        'Beta-alanine is most relevant when high-intensity buffering matters. It is less central for long steady endurance work.',
      agrees:
        'Chronic supplementation can increase muscle carnosine and help efforts where acidosis contributes to fatigue.',
      uncertain:
        'Payoff for long endurance races is context-dependent and often smaller than caffeine, fueling, or training quality.',
      protocol:
        'Use daily split dosing over several weeks if the race or training includes repeated hard efforts.',
      avoid:
        'Avoid prioritizing it before higher-return basics like fueling, sleep, caffeine testing, and heat preparation.',
      bestFit: 'Best fit for surgy races, middle-distance events, climbs, and repeated high-intensity intervals.',
    },
  },
];

function normalizeText(value = '') {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function slugify(value = '') {
  return normalizeText(value).replace(/\s+/g, '-');
}

function paperKey(paper = {}) {
  return (
    paper.doi ||
    paper.pubmed_id ||
    paper.semantic_scholar_id ||
    paper.openalex_id ||
    normalizeText(paper.title)
  );
}

function getAbortSignal(timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

function reconstructAbstract(index = null) {
  if (!index || typeof index !== 'object') return null;
  const entries = [];
  Object.entries(index).forEach(([word, positions]) => {
    if (!Array.isArray(positions)) return;
    positions.forEach((position) => {
      entries[position] = word;
    });
  });
  return entries.filter(Boolean).join(' ') || null;
}

function parseYear(value) {
  const match = String(value || '').match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

function topicMatches(topic, query) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return false;
  const haystack = [topic.label, topic.key, topic.query, ...(topic.aliases || [])]
    .map(normalizeText)
    .join(' ');
  return haystack.includes(normalizedQuery) || normalizedQuery.includes(normalizeText(topic.label));
}

export function resolveResearchTopic(query = '') {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return RESEARCH_TOPICS[0];
  return (
    RESEARCH_TOPICS.find((topic) => topicMatches(topic, normalizedQuery)) ||
    RESEARCH_TOPICS.find((topic) => normalizedQuery.includes(normalizeText(topic.label).split(' ')[0])) ||
    null
  );
}

export function buildStaticTopicSummary(query = '', papers = []) {
  const topic = resolveResearchTopic(query);
  if (topic) {
    return {
      topicKey: topic.key,
      topicLabel: topic.label,
      query: query || topic.query,
      source: 'prebuilt',
      updatedAt: new Date().toISOString(),
      paperCount: papers.length,
      ...topic.summary,
    };
  }

  const cleanQuery = String(query || 'endurance performance').trim();
  const topTitles = papers.slice(0, 3).map((paper) => paper.title).filter(Boolean);
  return {
    topicKey: slugify(cleanQuery),
    topicLabel: cleanQuery,
    query: cleanQuery,
    source: 'generated',
    updatedAt: new Date().toISOString(),
    paperCount: papers.length,
    confidence: papers.length >= 8 ? 'Moderate' : 'Early',
    bottomLine: papers.length
      ? `The current evidence set for "${cleanQuery}" is strongest as a practical briefing rather than a final answer. The useful move is to identify repeatable protocols, test them in training, and track response against real sessions.`
      : `Threshold does not have enough indexed research for "${cleanQuery}" yet. Use this as a research queue item rather than a recommendation.`,
    agrees: topTitles.length
      ? `The strongest matching papers include: ${topTitles.join('; ')}. These should anchor the first review pass.`
      : 'No strong agreement can be inferred until more relevant papers are imported.',
    uncertain:
      'Individual response, sport format, training phase, and event duration will determine how much this topic matters for a specific athlete.',
    protocol:
      'Treat this as a testable protocol: define the dose, attach it to specific sessions, record subjective response, and compare outcomes over multiple exposures.',
    avoid:
      'Avoid race-day first use, changing multiple variables at once, or treating a weak evidence set as a universal rule.',
    bestFit: 'Best fit will be clearer after the research engine imports and scores more papers for this topic.',
  };
}

function normalizeResearchPaper(raw = {}, source = 'local') {
  const title = raw.title || raw.display_name || 'Untitled study';
  const doi = raw.doi ? String(raw.doi).replace(/^https:\/\/doi.org\//, '') : null;
  const publicationYear =
    raw.publication_year || raw.year || parseYear(raw.publicationDate || raw.publication_date || raw.pubdate);

  return {
    id: raw.id || null,
    source,
    pubmed_id: raw.pubmed_id || raw.pmid || raw.externalIds?.PubMed || null,
    doi,
    openalex_id: raw.openalex_id || (source === 'openalex' ? raw.id : null),
    semantic_scholar_id: raw.semantic_scholar_id || raw.paperId || null,
    title,
    authors: raw.authors || raw.authorships?.map((item) => item.author?.display_name).filter(Boolean).join(', ') || null,
    journal:
      raw.journal ||
      raw.primary_location?.source?.display_name ||
      raw.venue ||
      raw.publicationName ||
      raw.source ||
      null,
    publication_year: publicationYear,
    publication_date: raw.publication_date || raw.publicationDate || null,
    url:
      raw.pubmed_url ||
      raw.url ||
      raw.openAccessPdf?.url ||
      raw.primary_location?.landing_page_url ||
      raw.doi ||
      raw.paperUrl ||
      null,
    abstract: raw.abstract || reconstructAbstract(raw.abstract_inverted_index) || null,
    citation_count: raw.cited_by_count ?? raw.citationCount ?? raw.citedByCount ?? 0,
    topic_tags: raw.topic_tags || [],
    plain_english_summary: raw.plain_english_summary || null,
    practical_takeaway: raw.practical_takeaway || null,
    ultra_score: raw.ultra_score || 0,
    gravel_score: raw.gravel_score || 0,
    triathlon_score: raw.triathlon_score || 0,
    raw,
  };
}

function scorePaper(paper, query) {
  const normalizedQuery = normalizeText(query);
  const title = normalizeText(paper.title);
  const abstract = normalizeText(paper.abstract || paper.plain_english_summary || '');
  const queryWords = normalizedQuery.split(' ').filter((word) => word.length > 2);
  const textScore = queryWords.reduce((score, word) => {
    if (title.includes(word)) return score + 8;
    if (abstract.includes(word)) return score + 3;
    return score;
  }, 0);
  const year = Number(paper.publication_year || 0);
  const recency = year >= 2020 ? 12 : year >= 2015 ? 8 : year >= 2005 ? 4 : 1;
  const citationSignal = Math.min(20, Math.log10(Number(paper.citation_count || 0) + 1) * 8);
  const sportSignal = Number(paper.ultra_score || 0) + Number(paper.gravel_score || 0) + Number(paper.triathlon_score || 0);
  return Math.round(textScore + recency + citationSignal + sportSignal);
}

function dedupePapers(papers = [], query = '') {
  const map = new Map();
  papers.forEach((paper) => {
    const normalized = normalizeResearchPaper(paper, paper.source || 'local');
    const key = paperKey(normalized);
    if (!key) return;
    const existing = map.get(key);
    const scored = { ...normalized, relevance_score: scorePaper(normalized, query) };
    if (!existing || scored.relevance_score > existing.relevance_score) {
      map.set(key, scored);
    }
  });
  return Array.from(map.values()).sort((a, b) => b.relevance_score - a.relevance_score);
}

async function safeJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.headers || {}),
    },
    signal: options.signal || getAbortSignal(),
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function fetchOpenAlexPapers(query, limit = 12) {
  const url = new URL('https://api.openalex.org/works');
  url.searchParams.set('search', query);
  url.searchParams.set('per-page', String(Math.min(limit, 25)));
  url.searchParams.set('filter', 'type:article');
  url.searchParams.set('sort', 'cited_by_count:desc');
  if (process.env.NCBI_CONTACT_EMAIL) {
    url.searchParams.set('mailto', process.env.NCBI_CONTACT_EMAIL);
  }
  const data = await safeJson(url.toString());
  return (data.results || []).map((item) => normalizeResearchPaper(item, 'openalex'));
}

export async function fetchEuropePmcPapers(query, limit = 12) {
  const url = new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
  url.searchParams.set('query', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('pageSize', String(Math.min(limit, 25)));
  url.searchParams.set('sort', 'CITED desc');
  const data = await safeJson(url.toString());
  return (data.resultList?.result || []).map((item) =>
    normalizeResearchPaper(
      {
        pmid: item.pmid,
        doi: item.doi,
        title: item.title,
        authors: item.authorString,
        journal: item.journalTitle,
        publicationDate: item.firstPublicationDate,
        year: item.pubYear,
        abstract: item.abstractText,
        url: item.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${item.pmid}/` : item.fullTextUrlList?.fullTextUrl?.[0]?.url,
        citationCount: item.citedByCount,
      },
      'europepmc'
    )
  );
}

export async function fetchSemanticScholarPapers(query, limit = 12) {
  const url = new URL('https://api.semanticscholar.org/graph/v1/paper/search');
  url.searchParams.set('query', query);
  url.searchParams.set('limit', String(Math.min(limit, 20)));
  url.searchParams.set('fields', 'title,abstract,authors,year,venue,citationCount,externalIds,url,openAccessPdf');
  const headers = {};
  if (process.env.SEMANTIC_SCHOLAR_API_KEY) {
    headers['x-api-key'] = process.env.SEMANTIC_SCHOLAR_API_KEY;
  }
  const data = await safeJson(url.toString(), { headers });
  return (data.data || []).map((item) =>
    normalizeResearchPaper(
      {
        ...item,
        authors: (item.authors || []).map((author) => author.name).filter(Boolean).join(', '),
      },
      'semantic_scholar'
    )
  );
}

export async function fetchPubMedPapers(query, limit = 12) {
  const lower = String(query || '').toLowerCase();
  const hasSportContext = ['exercise', 'athlete', 'endurance', 'sport', 'performance', 'running', 'cycling', 'triathlon'].some((term) =>
    lower.includes(term)
  );
  const phrase = String(query || '').trim().replace(/"/g, '');
  const topicClause = `"${phrase}"[Title/Abstract] OR ${phrase}`;
  const sportClause =
    '"Exercise"[Mesh] OR exercise[Title/Abstract] OR athlete*[Title/Abstract] OR endurance[Title/Abstract] OR sport*[Title/Abstract] OR running[Title/Abstract] OR cycling[Title/Abstract] OR triathlon[Title/Abstract]';
  const searchTerm = hasSportContext
    ? query
    : `(${topicClause}) AND (${sportClause})`;
  const ids = await searchPubMed(searchTerm, Math.min(limit, 25));
  const summaries = await summarizePubMed(ids);
  return summaries.map((item) => normalizeResearchPaper(item, 'pubmed'));
}

export async function fetchExternalResearchPapers(query, limit = 12) {
  const sourceLimit = Math.max(4, Math.ceil(limit / 2));
  const settled = await Promise.allSettled([
    fetchPubMedPapers(query, sourceLimit),
    fetchOpenAlexPapers(query, sourceLimit),
    fetchEuropePmcPapers(query, sourceLimit),
    fetchSemanticScholarPapers(query, sourceLimit),
  ]);

  const sources = ['pubmed', 'openalex', 'europepmc', 'semantic_scholar'];
  const errors = [];
  const papers = [];
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      papers.push(...result.value);
    } else {
      errors.push({ source: sources[index], error: result.reason?.message || 'Source failed' });
    }
  });

  return {
    papers: dedupePapers(papers, query).slice(0, limit),
    errors,
  };
}

export async function getLocalResearchPapers({ admin = getSupabaseAdminClient(), query = '', limit = 50 } = {}) {
  const normalizedQuery = String(query || '').trim();
  const localPapers = [];

  try {
    const { data } = await admin
      .from('research_papers')
      .select('*')
      .or(`title.ilike.%${normalizedQuery}%,abstract.ilike.%${normalizedQuery}%`)
      .limit(limit);
    localPapers.push(...(data || []).map((item) => normalizeResearchPaper(item, 'library')));
  } catch (error) {
    // The migration may not be applied yet. Existing library fallback below keeps the UI working.
  }

  try {
    let queryBuilder = admin
      .from('research_library_entries')
      .select(
        'id, pubmed_id, title, authors, journal, publication_year, publication_date, pubmed_url, topic_tags, plain_english_summary, practical_takeaway, ultra_score, gravel_score, triathlon_score, published'
      )
      .eq('published', true)
      .limit(limit);

    if (normalizedQuery) {
      queryBuilder = queryBuilder.or(
        `title.ilike.%${normalizedQuery}%,plain_english_summary.ilike.%${normalizedQuery}%,practical_takeaway.ilike.%${normalizedQuery}%`
      );
    }

    const { data } = await queryBuilder;
    localPapers.push(...(data || []).map((item) => normalizeResearchPaper(item, 'curated')));
  } catch (error) {
    // If Supabase is unavailable, callers can still render static summaries.
  }

  return dedupePapers(localPapers, normalizedQuery).slice(0, limit);
}

export async function getResearchTopicSummary({ admin = getSupabaseAdminClient(), query = '', papers = [] } = {}) {
  const topic = resolveResearchTopic(query);
  const topicKey = topic?.key || slugify(query || 'endurance-performance');

  try {
    const { data } = await admin
      .from('research_topic_summaries')
      .select('*')
      .eq('topic_key', topicKey)
      .eq('published', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      return {
        topicKey: data.topic_key,
        topicLabel: data.topic_label,
        query: data.query,
        confidence: data.confidence,
        bottomLine: data.bottom_line,
        agrees: data.evidence_agrees,
        uncertain: data.uncertain_or_individual,
        protocol: data.practical_protocol,
        avoid: data.when_to_avoid,
        bestFit: data.best_fit,
        source: 'database',
        updatedAt: data.updated_at,
        paperCount: data.paper_count || papers.length,
      };
    }
  } catch (error) {
    // Migration may not exist yet.
  }

  const summary = buildStaticTopicSummary(query || topic?.label || '', papers);

  try {
    await admin.from('research_topic_summaries').upsert(
      {
        topic_key: summary.topicKey,
        topic_label: summary.topicLabel,
        query: summary.query,
        confidence: summary.confidence,
        bottom_line: summary.bottomLine,
        evidence_agrees: summary.agrees,
        uncertain_or_individual: summary.uncertain,
        practical_protocol: summary.protocol,
        when_to_avoid: summary.avoid,
        best_fit: summary.bestFit,
        paper_count: papers.length,
        generation_source: summary.source,
        published: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'topic_key' }
    );
  } catch (error) {
    // Ignore when the migration has not been applied.
  }

  return summary;
}

export async function searchResearch({ admin = getSupabaseAdminClient(), query = '', limit = 18, includeExternal = true } = {}) {
  const topic = resolveResearchTopic(query);
  const effectiveQuery = String(query || topic?.query || RESEARCH_TOPICS[0].query).trim();
  const local = await getLocalResearchPapers({ admin, query: effectiveQuery, limit });
  let external = { papers: [], errors: [] };

  if (includeExternal) {
    external = await fetchExternalResearchPapers(effectiveQuery, limit);
  }

  const papers = dedupePapers([...local, ...(external.papers || [])], effectiveQuery).slice(0, limit);
  const summary = await getResearchTopicSummary({ admin, query: effectiveQuery, papers });

  return {
    query: effectiveQuery,
    topic: summary.topicLabel,
    summary,
    papers,
    sourceErrors: external.errors || [],
  };
}

export async function upsertImportedResearchPapers(admin, { query, papers = [], runId = null } = {}) {
  const imported = [];
  for (const paper of dedupePapers(papers, query)) {
    const payload = {
      canonical_key: paperKey(paper),
      title: paper.title,
      abstract: paper.abstract,
      doi: paper.doi,
      pubmed_id: paper.pubmed_id,
      openalex_id: paper.openalex_id,
      semantic_scholar_id: paper.semantic_scholar_id,
      journal: paper.journal,
      authors: paper.authors,
      publication_year: paper.publication_year,
      publication_date: paper.publication_date,
      primary_url: paper.url,
      source_count: 1,
      citation_count: paper.citation_count || 0,
      raw_payload: paper.raw || paper,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await admin
      .from('research_papers')
      .upsert(payload, { onConflict: 'canonical_key' })
      .select('id, canonical_key, title')
      .single();
    if (error) throw error;
    imported.push(data);

    if (runId && data?.id) {
      await admin.from('research_paper_scores').upsert(
        {
          paper_id: data.id,
          query,
          relevance_score: paper.relevance_score || scorePaper(paper, query),
          sport_relevance: {
            ultra: paper.ultra_score || 0,
            gravel: paper.gravel_score || 0,
            triathlon: paper.triathlon_score || 0,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'paper_id,query' }
      );
    }
  }
  return imported;
}
