import cookie from 'cookie';
import { supabase } from '../../../lib/supabaseClient';
import { evaluateProtocolRules, generateCoachCode } from '../../../lib/coachProtocols';

export const runtime = 'edge';

function getAthleteId(req) {
  return cookie.parse(req.headers.cookie || '').athlete_id;
}

async function ensureCoachProfile(athleteId) {
  const { data: athlete } = await supabase
    .from('athletes')
    .select('id, name')
    .eq('id', athleteId)
    .single();

  const { data: existing } = await supabase
    .from('coach_profiles')
    .select('id, athlete_id, display_name, coach_code')
    .eq('athlete_id', athleteId)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from('coach_profiles')
    .insert({
      athlete_id: athleteId,
      display_name: athlete?.name || 'Coach',
      coach_code: generateCoachCode(athlete?.name || 'Coach'),
    })
    .select('id, athlete_id, display_name, coach_code')
    .single();

  if (error) throw error;
  return data;
}



function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mean(values) {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export default async function handler(req, res) {
  const athleteId = getAthleteId(req);
  if (!athleteId) { res.status(401).json({ error: 'Not authenticated' }); return; }

  try {
    const profile = await ensureCoachProfile(athleteId);

    // ── GET: list protocols, optionally filtered by athlete_id ──────────────
    if (req.method === 'GET') {
      let query = supabase
        .from('assigned_protocols')
        .select(`
          id, athlete_id, protocol_name, protocol_type, description,
          instructions, target_race_id, start_date, end_date,
          status, compliance_target, created_at, updated_at,
          races(id, name, event_date, race_type)
        `)
        .eq('coach_id', profile.id)
        .order('start_date', { ascending: false });

      if (typeof req.query.athlete_id === 'string') {
        query = query.eq('athlete_id', req.query.athlete_id);
      }
      if (typeof req.query.status === 'string') {
        query = query.eq('status', req.query.status);
      }

      const { data, error } = await query;
      if (error) { res.status(500).json({ error: error.message }); return; }

      // Attach athlete names
      const ids = [...new Set((data || []).map((p) => p.athlete_id))];
      const { data: athletes } = ids.length
        ? await supabase.from('athletes').select('id, name').in('id', ids)
        : { data: [] };

      const protocols = (data || []).map((p) => ({
        ...p,
        athlete: (athletes || []).find((a) => a.id === p.athlete_id) || null,
      }));

      const interventionLogs = ids.length
        ? await supabase
          .from('interventions')
          .select('athlete_id, intervention_type, date, subjective_feel, dose_duration')
          .in('athlete_id', ids)
        : { data: [] };

      const logs = interventionLogs.data || [];
      const adherenceByAthlete = ids.map((id) => {
        const athleteProtocols = protocols.filter((p) => p.athlete_id === id && ['assigned', 'in_progress', 'completed'].includes(p.status));
        const athleteLogs = logs.filter((l) => l.athlete_id === id);
        const completedProtocols = athleteProtocols.filter((p) => {
          const count = athleteLogs.filter((l) => l.intervention_type === p.protocol_type).length;
          return count > 0;
        }).length;
        return {
          athlete_id: id,
          adherence_pct: athleteProtocols.length ? Math.round((completedProtocols / athleteProtocols.length) * 100) : 0,
        };
      });

      const adherenceByInterventionType = Object.values(logs.reduce((acc, log) => {
        const key = log.intervention_type || 'unspecified';
        if (!acc[key]) acc[key] = { intervention_type: key, logged: 0, subjective: [] };
        acc[key].logged += 1;
        const subj = toNumber(log.subjective_feel);
        if (subj !== null) acc[key].subjective.push(subj);
        return acc;
      }, {})).map((row) => ({
        intervention_type: row.intervention_type,
        adherence_pct: Math.min(100, row.logged * 10),
        avg_subjective_feel: row.subjective.length ? Number(mean(row.subjective).toFixed(2)) : null,
      }));

      const subjectiveTrendVsDose = logs
        .filter((l) => l.subjective_feel !== null && l.subjective_feel !== undefined)
        .map((l) => ({
          athlete_id: l.athlete_id,
          intervention_type: l.intervention_type,
          date: l.date,
          dose_duration: toNumber(l.dose_duration),
          subjective_feel: l.subjective_feel,
        }));

      res.status(200).json({ protocols, profile, adherenceByAthlete, adherenceByInterventionType, subjectiveTrendVsDose });
      return;
    }

    // ── POST: assign a new protocol ─────────────────────────────────────────
    if (req.method === 'POST') {
      const body = req.body || {};
      const required = ['athlete_id', 'start_date', 'end_date'];

      let template = null;
      if (body.template_id) {
        const { data: tpl } = await supabase
          .from('protocol_templates')
          .select('id, name, protocol_type, description, instructions')
          .eq('id', body.template_id)
          .maybeSingle();
        template = tpl || null;
      }
      const protocolName = (body.protocol_name || template?.name || '').trim();
      const protocolType = body.protocol_type || template?.protocol_type;
      const mergedInstructions = { ...(template?.instructions || {}), ...(body.instructions || {}) };
      const missing = required.filter((k) => !body[k]).concat(!protocolName ? ['protocol_name'] : []).concat(!protocolType ? ['protocol_type'] : []);
      if (missing.length) {
        res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
        return;
      }

      const rulesResult = evaluateProtocolRules({
        interventionType: body.protocol_type,
        frequencyType: body.instructions?.frequency_type || 'weekly',
        plannedSessions: body.instructions?.planned_sessions ?? null,
        responseMetrics: body.response_metrics || {},
        currentLoad: body.current_load || {},
        coachOverrideReason: body.coach_override_reason || null,
      });

      const { data, error } = await supabase
        .from('assigned_protocols')
        .insert({
          coach_id: profile.id,
          athlete_id: body.athlete_id,
          protocol_name: protocolName,
          protocol_type: protocolType,
          description: body.description?.trim() || template?.description || null,
          instructions: {
            ...mergedInstructions,
            rules_engine: rulesResult,
            why_this_next_step: rulesResult.recommendationText,
            confidence: rulesResult.confidence,
          },
          target_race_id: body.target_race_id || null,
          start_date: body.start_date,
          end_date: body.end_date,
          status: body.status || 'assigned',
          compliance_target: body.compliance_target ?? 80,
          coach_override_reason: rulesResult.override.reason,
        })
        .select('*')
        .single();

      if (error) { res.status(500).json({ error: error.message }); return; }
      res.status(200).json({ protocol: data, profile });
      return;
    }

    // ── PUT: update an existing protocol ────────────────────────────────────
    if (req.method === 'PUT') {
      const body = req.body || {};
      if (!body.id) { res.status(400).json({ error: 'id is required' }); return; }

      const rulesResult = evaluateProtocolRules({
        interventionType: protocolType,
        frequencyType: mergedInstructions?.frequency_type || 'weekly',
        plannedSessions: mergedInstructions?.planned_sessions ?? null,
        responseMetrics: body.response_metrics || {},
        currentLoad: body.current_load || {},
        coachOverrideReason: body.coach_override_reason || null,
      });

      const updates = {};
      const updatable = [
        'protocol_name', 'protocol_type', 'description', 'instructions',
        'target_race_id', 'start_date', 'end_date', 'status', 'compliance_target',
      ];
      for (const key of updatable) {
        if (body[key] !== undefined) updates[key] = body[key];
      }
      if (updates.instructions || body.instructions === undefined) {
        updates.instructions = {
          ...(updates.instructions || body.instructions || {}),
          rules_engine: rulesResult,
          why_this_next_step: rulesResult.recommendationText,
          confidence: rulesResult.confidence,
        };
      }
      updates.coach_override_reason = rulesResult.override.reason;

      const { data, error } = await supabase
        .from('assigned_protocols')
        .update(updates)
        .eq('id', body.id)
        .eq('coach_id', profile.id)
        .select('*')
        .single();

      if (error) { res.status(500).json({ error: error.message }); return; }
      res.status(200).json({ protocol: data });
      return;
    }

    // ── DELETE: abandon a protocol ───────────────────────────────────────────
    if (req.method === 'DELETE') {
      const id = req.query.id || req.body?.id;
      if (!id) { res.status(400).json({ error: 'id is required' }); return; }

      const { error } = await supabase
        .from('assigned_protocols')
        .update({ status: 'abandoned' })
        .eq('id', id)
        .eq('coach_id', profile.id);

      if (error) { res.status(500).json({ error: error.message }); return; }
      res.status(200).json({ success: true });
      return;
    }

    res.status(405).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
