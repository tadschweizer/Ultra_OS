import { getAthleteIdFromRequest, getSupabaseAdminClient } from '../../../lib/authServer';
import { ensureCoachProfile } from '../../../lib/coachServer';
import {
  buildInstructionsPayload,
  createTemplateDraft,
  normalizeWeeklyBlocks,
} from '../../../lib/protocolAssignmentEngine';

function sanitizeTemplatePayload(body = {}) {
  const draft = createTemplateDraft(body);
  const durationWeeks = Math.max(1, Number(body.duration_weeks || draft.duration_weeks || 1));

  return {
    name: String(body.name || draft.name).trim(),
    protocol_type: String(body.protocol_type || draft.protocol_type).trim(),
    description: String(body.description || '').trim() || null,
    duration_weeks: durationWeeks,
    instructions: buildInstructionsPayload(
      normalizeWeeklyBlocks(body.instructions?.weekly_blocks || draft.instructions.weekly_blocks, durationWeeks)
    ),
    is_shared: body.is_shared === true,
  };
}

export default async function handler(req, res) {
  const athleteId = getAthleteIdFromRequest(req);
  if (!athleteId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const admin = getSupabaseAdminClient();

  try {
    const { data: athlete, error: athleteError } = await admin
      .from('athletes')
      .select('id, name, email')
      .eq('id', athleteId)
      .maybeSingle();

    if (athleteError) throw athleteError;
    if (!athlete) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const profile = await ensureCoachProfile(admin, athlete);

    if (req.method === 'GET') {
      const [ownResult, sharedResult] = await Promise.all([
        admin
          .from('protocol_templates')
          .select('id, coach_id, name, protocol_type, description, instructions, duration_weeks, is_shared, created_at')
          .eq('coach_id', profile.id)
          .order('created_at', { ascending: false }),
        admin
          .from('protocol_templates')
          .select('id, coach_id, name, protocol_type, description, instructions, duration_weeks, is_shared, created_at')
          .eq('is_shared', true)
          .neq('coach_id', profile.id)
          .order('created_at', { ascending: false }),
      ]);

      if (ownResult.error) throw ownResult.error;
      if (sharedResult.error) throw sharedResult.error;

      const coachIds = [
        ...new Set([...(ownResult.data || []), ...(sharedResult.data || [])].map((item) => item.coach_id)),
      ];
      const { data: coaches, error: coachesError } = coachIds.length
        ? await admin
            .from('coach_profiles')
            .select('id, display_name')
            .in('id', coachIds)
        : { data: [], error: null };

      if (coachesError) throw coachesError;

      const coachNameById = new Map((coaches || []).map((item) => [item.id, item.display_name]));

      const decorate = (template) => ({
        ...template,
        coach_name: coachNameById.get(template.coach_id) || 'Coach',
      });

      res.status(200).json({
        templates: (ownResult.data || []).map(decorate),
        sharedTemplates: (sharedResult.data || []).map(decorate),
        profile,
      });
      return;
    }

    if (req.method === 'POST') {
      const payload = sanitizeTemplatePayload(req.body || {});
      if (!payload.name) {
        res.status(400).json({ error: 'Template name is required.' });
        return;
      }
      if (!payload.protocol_type) {
        res.status(400).json({ error: 'Protocol type is required.' });
        return;
      }

      const { data, error } = await admin
        .from('protocol_templates')
        .insert({
          coach_id: profile.id,
          ...payload,
        })
        .select('id, coach_id, name, protocol_type, description, instructions, duration_weeks, is_shared, created_at')
        .single();

      if (error) throw error;
      res.status(200).json({
        template: {
          ...data,
          coach_name: profile.display_name,
        },
      });
      return;
    }

    if (req.method === 'PUT') {
      const templateId = req.body?.id;
      if (!templateId) {
        res.status(400).json({ error: 'Template id is required.' });
        return;
      }

      const payload = sanitizeTemplatePayload(req.body || {});

      const { data, error } = await admin
        .from('protocol_templates')
        .update(payload)
        .eq('id', templateId)
        .eq('coach_id', profile.id)
        .select('id, coach_id, name, protocol_type, description, instructions, duration_weeks, is_shared, created_at')
        .single();

      if (error) throw error;
      res.status(200).json({
        template: {
          ...data,
          coach_name: profile.display_name,
        },
      });
      return;
    }

    if (req.method === 'DELETE') {
      const templateId = typeof req.query.id === 'string' ? req.query.id : req.body?.id;
      if (!templateId) {
        res.status(400).json({ error: 'Template id is required.' });
        return;
      }

      const { error } = await admin
        .from('protocol_templates')
        .delete()
        .eq('id', templateId)
        .eq('coach_id', profile.id);

      if (error) throw error;
      res.status(200).json({ success: true });
      return;
    }

    res.status(405).end();
  } catch (error) {
    console.error('[coach/templates] failed:', error);
    res.status(500).json({ error: error.message || 'Could not load templates.' });
  }
}
