import cookie from 'cookie';
import { supabase } from '../../../lib/supabaseClient';
import {
  evaluateProtocolRules,
  generateCoachCode,
  validateProtocolWindow,
  isActiveProtocolStatus,
  hasDateWindowOverlap,
} from '../../../lib/coachProtocols';

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

    if (req.method === 'GET') {
      let query = supabase
        .from('coach_protocol_assignments')
        .select('id, athlete_id, protocol_name, intervention_type, description, protocol_payload, start_date, target_completion_date, status, planned_sessions, created_at, updated_at, target_race_id')
        .eq('coach_id', profile.id)
        .order('start_date', { ascending: false });

      if (typeof req.query.athlete_id === 'string') query = query.eq('athlete_id', req.query.athlete_id);
      if (typeof req.query.status === 'string') query = query.eq('status', req.query.status);

      const { data, error } = await query;
      if (error) { res.status(500).json({ error: error.message }); return; }

      const ids = [...new Set((data || []).map((p) => p.athlete_id))];
      const { data: athletes } = ids.length ? await supabase.from('athletes').select('id, name').in('id', ids) : { data: [] };
      const protocols = (data || []).map((p) => ({
        ...p,
        protocol_type: p.intervention_type,
        end_date: p.target_completion_date,
        compliance_target: p.planned_sessions,
        athlete: (athletes || []).find((a) => a.id === p.athlete_id) || null,
      }));

      const interventionLogs = ids.length
        ? await supabase.from('interventions').select('athlete_id, intervention_type, date, subjective_feel, dose_duration').in('athlete_id', ids)
        : { data: [] };

      const logs = interventionLogs.data || [];
      const adherenceByAthlete = ids.map((id) => {
        const athleteProtocols = protocols.filter((p) => p.athlete_id === id && ['assigned', 'in_progress', 'completed', 'active'].includes(p.status));
        const athleteLogs = logs.filter((l) => l.athlete_id === id);
        const completedProtocols = athleteProtocols.filter((p) => athleteLogs.some((l) => l.intervention_type === p.intervention_type)).length;
        return { athlete_id: id, adherence_pct: athleteProtocols.length ? Math.round((completedProtocols / athleteProtocols.length) * 100) : 0 };
      });

      const adherenceByInterventionType = Object.values(logs.reduce((acc, log) => {
        const key = log.intervention_type || 'unspecified';
        if (!acc[key]) acc[key] = { intervention_type: key, logged: 0, subjective: [] };
        acc[key].logged += 1;
        const subj = toNumber(log.subjective_feel);
        if (subj !== null) acc[key].subjective.push(subj);
        return acc;
      }, {})).map((row) => ({ intervention_type: row.intervention_type, adherence_pct: Math.min(100, row.logged * 10), avg_subjective_feel: row.subjective.length ? Number(mean(row.subjective).toFixed(2)) : null }));

      const subjectiveTrendVsDose = logs.filter((l) => l.subjective_feel !== null && l.subjective_feel !== undefined).map((l) => ({ athlete_id: l.athlete_id, intervention_type: l.intervention_type, date: l.date, dose_duration: toNumber(l.dose_duration), subjective_feel: l.subjective_feel }));

      res.status(200).json({ protocols, profile, adherenceByAthlete, adherenceByInterventionType, subjectiveTrendVsDose });
      return;
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const required = ['athlete_id', 'start_date', 'end_date'];

      let template = null;
      if (body.template_id) {
        const { data: tpl } = await supabase.from('protocol_templates').select('id, name, protocol_type, description, instructions').eq('id', body.template_id).maybeSingle();
        template = tpl || null;
      }
      const protocolName = (body.protocol_name || template?.name || '').trim();
      const protocolType = body.protocol_type || template?.protocol_type;
      const mergedInstructions = { ...(template?.instructions || {}), ...(body.instructions || {}) };
      const missing = required.filter((k) => !body[k]).concat(!protocolName ? ['protocol_name'] : []).concat(!protocolType ? ['protocol_type'] : []);
      if (missing.length) { res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` }); return; }

      const windowValidation = validateProtocolWindow(body.start_date, body.end_date);
      if (!windowValidation.valid) { res.status(400).json({ error: windowValidation.error }); return; }

      const { data: relationship } = await supabase.from('coach_athlete_relationships').select('id').eq('coach_id', profile.id).eq('athlete_id', body.athlete_id).eq('status', 'active').maybeSingle();
      if (!relationship) { res.status(403).json({ error: 'Athlete is not in your active roster' }); return; }

      const { data: existingActive } = await supabase
        .from('coach_protocol_assignments')
        .select('id, start_date, target_completion_date, status')
        .eq('coach_id', profile.id)
        .eq('athlete_id', body.athlete_id)
        .in('status', ['assigned', 'in_progress', 'active']);

      if (!body.allow_parallel_active && (existingActive || []).some((row) => hasDateWindowOverlap(body.start_date, body.end_date, row.start_date, row.target_completion_date))) {
        res.status(409).json({ error: 'Conflicting active protocol already exists for this athlete and date window' });
        return;
      }

      const rulesResult = evaluateProtocolRules({
        interventionType: protocolType,
        frequencyType: mergedInstructions?.frequency_type || 'weekly',
        plannedSessions: mergedInstructions?.planned_sessions ?? null,
        responseMetrics: body.response_metrics || {},
        currentLoad: body.current_load || {},
        coachOverrideReason: body.coach_override_reason || null,
      });

      const { data, error } = await supabase.from('coach_protocol_assignments').insert({
        coach_id: profile.id,
        athlete_id: body.athlete_id,
        protocol_name: protocolName,
        intervention_type: protocolType,
        description: body.description?.trim() || template?.description || null,
        protocol_payload: { ...mergedInstructions, rules_engine: rulesResult, why_this_next_step: rulesResult.recommendationText, confidence: rulesResult.confidence },
        target_race_id: body.target_race_id || null,
        start_date: body.start_date,
        target_completion_date: body.end_date,
        status: body.status || 'assigned',
        planned_sessions: body.compliance_target ?? mergedInstructions?.planned_sessions ?? 1,
      }).select('*').single();

      if (error) { res.status(500).json({ error: error.message }); return; }
      res.status(200).json({
        protocol: {
          ...data,
          protocol_type: data.intervention_type,
          end_date: data.target_completion_date,
          compliance_target: data.planned_sessions,
        },
        profile,
      });
      return;
    }

    if (req.method === 'PUT') {
      const body = req.body || {};
      if (!body.id) { res.status(400).json({ error: 'id is required' }); return; }

      const { data: existing, error: existingErr } = await supabase.from('coach_protocol_assignments').select('*').eq('id', body.id).eq('coach_id', profile.id).maybeSingle();
      if (existingErr) { res.status(500).json({ error: existingErr.message }); return; }
      if (!existing) { res.status(404).json({ error: 'Protocol assignment not found' }); return; }

      const startDate = body.start_date ?? existing.start_date;
      const endDate = body.end_date ?? existing.target_completion_date;
      const validation = validateProtocolWindow(startDate, endDate);
      if (!validation.valid) { res.status(400).json({ error: validation.error }); return; }

      const protocolType = body.protocol_type ?? existing.intervention_type;
      const mergedInstructions = { ...(existing.protocol_payload || {}), ...(body.instructions || {}) };
      const rulesResult = evaluateProtocolRules({
        interventionType: protocolType,
        frequencyType: mergedInstructions?.frequency_type || 'weekly',
        plannedSessions: mergedInstructions?.planned_sessions ?? null,
        responseMetrics: body.response_metrics || {},
        currentLoad: body.current_load || {},
        coachOverrideReason: body.coach_override_reason || null,
      });

      const updates = {};
      if (body.protocol_name !== undefined) updates.protocol_name = body.protocol_name;
      if (body.protocol_type !== undefined) updates.intervention_type = body.protocol_type;
      if (body.description !== undefined) updates.description = body.description;
      if (body.target_race_id !== undefined) updates.target_race_id = body.target_race_id;
      if (body.start_date !== undefined) updates.start_date = body.start_date;
      if (body.end_date !== undefined) updates.target_completion_date = body.end_date;
      if (body.status !== undefined) updates.status = body.status;
      updates.protocol_payload = { ...mergedInstructions, rules_engine: rulesResult, why_this_next_step: rulesResult.recommendationText, confidence: rulesResult.confidence };

      if ((body.start_date !== undefined || body.end_date !== undefined || body.status !== undefined) && isActiveProtocolStatus(updates.status ?? existing.status) && !body.allow_parallel_active) {
        const { data: siblingActive } = await supabase.from('coach_protocol_assignments').select('id, start_date, target_completion_date, status').eq('coach_id', profile.id).eq('athlete_id', existing.athlete_id).in('status', ['assigned', 'in_progress', 'active']).neq('id', existing.id);
        if ((siblingActive || []).some((row) => hasDateWindowOverlap(startDate, endDate, row.start_date, row.target_completion_date))) {
          res.status(409).json({ error: 'Updated assignment overlaps another active assignment for this athlete' });
          return;
        }
      }

      const { data, error } = await supabase.from('coach_protocol_assignments').update(updates).eq('id', body.id).eq('coach_id', profile.id).select('*').single();
      if (error) { res.status(500).json({ error: error.message }); return; }
      res.status(200).json({ protocol: data });
      return;
    }

    if (req.method === 'DELETE') {
      const id = req.query.id || req.body?.id;
      if (!id) { res.status(400).json({ error: 'id is required' }); return; }

      const { error } = await supabase.from('coach_protocol_assignments').update({ status: 'abandoned' }).eq('id', id).eq('coach_id', profile.id);
      if (error) { res.status(500).json({ error: error.message }); return; }
      res.status(200).json({ success: true });
      return;
    }

    res.status(405).end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
