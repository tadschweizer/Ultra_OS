import { useEffect, useMemo, useState } from 'react';
import ProtocolTemplateEditor from './ProtocolTemplateEditor';
import {
  buildInstructionsPayload,
  createTemplateDraft,
  getCurrentWeekBlock,
  normalizeWeeklyBlocks,
  protocolSourceOptions,
} from '../lib/protocolAssignmentEngine';

function formatDate(value) {
  if (!value) return 'Not set';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildAssignmentFromTemplate(template, today, defaultRaceId) {
  const durationWeeks = Number(template?.duration_weeks || 4);
  return {
    protocol_name: template?.name || '',
    protocol_type: template?.protocol_type || '',
    description: template?.description || '',
    instructions: buildInstructionsPayload(
      normalizeWeeklyBlocks(template?.instructions?.weekly_blocks, durationWeeks)
    ),
    duration_weeks: durationWeeks,
    start_date: today,
    end_date: addDays(today, durationWeeks * 7 - 1),
    compliance_target: 80,
    target_race_id: defaultRaceId || '',
  };
}

export default function ProtocolAssignmentDrawer({
  open,
  onClose,
  athleteName,
  athleteId,
  races = [],
  templates = [],
  interventionTypes = [],
  onAssigned,
}) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const defaultRaceId = races.find((race) => race.days_until >= 0)?.id || races[0]?.id || '';
  const [step, setStep] = useState(1);
  const [source, setSource] = useState(protocolSourceOptions[0]);
  const [search, setSearch] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [form, setForm] = useState(buildAssignmentFromTemplate(null, today, defaultRaceId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setSource('template');
    setSearch('');
    setSelectedTemplateId('');
    setError('');
    setForm(buildAssignmentFromTemplate(null, today, defaultRaceId));
  }, [open, today, defaultRaceId]);

  const filteredTemplates = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return templates;
    return templates.filter((template) => {
      const haystack = [
        template.name,
        template.protocol_type,
        template.description,
        template.coach_name,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [search, templates]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || null,
    [selectedTemplateId, templates]
  );

  const currentWeekBlock = getCurrentWeekBlock({
    ...form,
    instructions: form.instructions,
  });

  if (!open) return null;

  async function submitAssignment() {
    setSaving(true);
    setError('');

    try {
      const response = await fetch('/api/coach/protocols', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          athlete_id: athleteId,
          ...form,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Could not assign protocol.');
      }

      onAssigned(data.protocol);
      onClose();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  }

  function moveToCustomize() {
    if (source === 'template') {
      if (!selectedTemplate) {
        setError('Choose a template first.');
        return;
      }
      setForm(buildAssignmentFromTemplate(selectedTemplate, today, defaultRaceId));
    } else {
      const customDraft = createTemplateDraft({
        protocol_type: form.protocol_type,
        duration_weeks: form.duration_weeks || 4,
        instructions: form.instructions,
      });
      setForm((current) => ({
        ...current,
        protocol_name: current.protocol_name || customDraft.name,
        protocol_type: current.protocol_type || customDraft.protocol_type,
        description: current.description || customDraft.description,
        instructions: current.instructions?.weekly_blocks?.length ? current.instructions : customDraft.instructions,
        duration_weeks: current.duration_weeks || customDraft.duration_weeks,
        start_date: current.start_date || today,
        end_date: current.end_date || addDays(today, (current.duration_weeks || customDraft.duration_weeks) * 7 - 1),
      }));
    }

    setError('');
    setStep(2);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/35 backdrop-blur-sm" onClick={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <aside className="h-full w-full max-w-3xl overflow-y-auto bg-white p-6 shadow-[0_24px_80px_rgba(19,24,22,0.18)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-accent">Assign Protocol</p>
            <h2 className="font-display mt-3 text-3xl text-ink">{athleteName}</h2>
            <p className="mt-2 text-sm text-ink/60">
              Build the protocol, customize it for this athlete, then review before assigning it.
            </p>
          </div>
          <button onClick={onClose} className="ui-button-secondary py-2">
            Close
          </button>
        </div>

        <div className="mt-6 flex gap-3">
          {[1, 2, 3].map((item) => (
            <div key={`step-${item}`} className="flex items-center gap-2">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${step >= item ? 'bg-ink text-paper' : 'bg-paper text-ink/55'}`}>
                {item}
              </span>
              <span className="text-xs uppercase tracking-[0.18em] text-ink/45">
                {item === 1 ? 'Source' : item === 2 ? 'Customize' : 'Review'}
              </span>
            </div>
          ))}
        </div>

        {error ? (
          <div className="mt-5 rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="mt-6 space-y-5">
            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setSource('template')}
                className={`rounded-[22px] border px-5 py-5 text-left ${source === 'template' ? 'border-ink bg-paper' : 'border-border-subtle bg-white'}`}
              >
                <p className="text-sm font-semibold text-ink">From Template</p>
                <p className="mt-2 text-sm text-ink/60">
                  Start from a saved protocol and adjust it for this athlete.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setSource('custom')}
                className={`rounded-[22px] border px-5 py-5 text-left ${source === 'custom' ? 'border-ink bg-paper' : 'border-border-subtle bg-white'}`}
              >
                <p className="text-sm font-semibold text-ink">Create Custom</p>
                <p className="mt-2 text-sm text-ink/60">
                  Build a one-off protocol inline without saving a reusable template first.
                </p>
              </button>
            </div>

            {source === 'template' ? (
              <div className="rounded-[24px] border border-border-subtle bg-surface-light p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ink">Template Library</p>
                    <p className="mt-1 text-sm text-ink/60">
                      Search your saved templates and shared templates from other coaches.
                    </p>
                  </div>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="ui-input md:max-w-xs"
                    placeholder="Search templates"
                  />
                </div>

                <div className="mt-5 space-y-3">
                  {filteredTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedTemplateId(template.id)}
                      className={`w-full rounded-[20px] border px-4 py-4 text-left ${selectedTemplateId === template.id ? 'border-ink bg-white shadow-sm' : 'border-border-subtle bg-white/60'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-ink">{template.name}</p>
                          <p className="mt-1 text-sm text-ink/62">
                            {template.protocol_type} · {template.duration_weeks || 0} weeks
                          </p>
                          <p className="mt-2 text-sm text-ink/60">{template.description || 'No description yet.'}</p>
                        </div>
                        <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink/70">
                          {template.coach_name}
                        </span>
                      </div>
                    </button>
                  ))}
                  {!filteredTemplates.length ? (
                    <div className="rounded-[20px] border border-dashed border-border-subtle px-4 py-8 text-sm text-ink/58">
                      No templates matched that search.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="rounded-[24px] border border-border-subtle bg-surface-light p-5">
                <ProtocolTemplateEditor
                  form={{
                    name: form.protocol_name,
                    protocol_type: form.protocol_type,
                    description: form.description,
                    duration_weeks: form.duration_weeks,
                    instructions: form.instructions,
                    is_shared: false,
                  }}
                  onChange={(next) => setForm((current) => ({
                    ...current,
                    protocol_name: next.name,
                    protocol_type: next.protocol_type,
                    description: next.description,
                    duration_weeks: next.duration_weeks,
                    instructions: next.instructions,
                  }))}
                  interventionTypes={interventionTypes}
                  showShareToggle={false}
                />
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={moveToCustomize} className="ui-button-primary">
                Continue to Customize
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-6 space-y-5">
            <div className="rounded-[24px] border border-border-subtle bg-surface-light p-5">
              <ProtocolTemplateEditor
                form={{
                  name: form.protocol_name,
                  protocol_type: form.protocol_type,
                  description: form.description,
                  duration_weeks: form.duration_weeks,
                  instructions: form.instructions,
                  is_shared: false,
                }}
                onChange={(next) => setForm((current) => ({
                  ...current,
                  protocol_name: next.name,
                  protocol_type: next.protocol_type,
                  description: next.description,
                  duration_weeks: next.duration_weeks,
                  instructions: next.instructions,
                  end_date: current.start_date ? addDays(current.start_date, next.duration_weeks * 7 - 1) : current.end_date,
                }))}
                interventionTypes={interventionTypes}
                showShareToggle={false}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-ink">Start date</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    start_date: event.target.value,
                    end_date: event.target.value ? addDays(event.target.value, current.duration_weeks * 7 - 1) : current.end_date,
                  }))}
                  className="ui-input"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-ink">End date</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value }))}
                  className="ui-input"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-ink">Compliance target (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.compliance_target}
                  onChange={(event) => setForm((current) => ({ ...current, compliance_target: Number(event.target.value || 0) }))}
                  className="ui-input"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-ink">Target race (optional)</label>
                <select
                  value={form.target_race_id}
                  onChange={(event) => setForm((current) => ({ ...current, target_race_id: event.target.value }))}
                  className="ui-input"
                >
                  <option value="">No linked race</option>
                  {races.map((race) => (
                    <option key={race.id} value={race.id}>
                      {race.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="ui-button-secondary">
                Back
              </button>
              <button onClick={() => setStep(3)} className="ui-button-primary">
                Review Assignment
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-6 space-y-5">
            <div className="rounded-[24px] border border-border-subtle bg-surface-light p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Summary</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-[20px] bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Protocol</p>
                  <p className="mt-2 text-lg font-semibold text-ink">{form.protocol_name}</p>
                  <p className="mt-1 text-sm text-ink/60">{form.protocol_type}</p>
                </div>
                <div className="rounded-[20px] bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Window</p>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    {formatDate(form.start_date)} to {formatDate(form.end_date)}
                  </p>
                  <p className="mt-1 text-sm text-ink/60">{form.duration_weeks} weeks</p>
                </div>
                <div className="rounded-[20px] bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Compliance Target</p>
                  <p className="mt-2 text-lg font-semibold text-ink">{form.compliance_target}%</p>
                </div>
                <div className="rounded-[20px] bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-ink/45">Current Week Focus</p>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    {currentWeekBlock?.instruction_text || 'No weekly focus written yet.'}
                  </p>
                  <p className="mt-1 text-sm text-ink/60">
                    {currentWeekBlock?.frequency_per_week ? `${currentWeekBlock.frequency_per_week}x/week` : ''}
                    {currentWeekBlock?.frequency_per_week && currentWeekBlock?.target_metric ? ' · ' : ''}
                    {currentWeekBlock?.target_metric || ''}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-border-subtle bg-white p-5">
              <p className="text-sm font-semibold text-ink">Full Multi-Week Plan</p>
              <div className="mt-4 space-y-3">
                {normalizeWeeklyBlocks(form.instructions?.weekly_blocks, form.duration_weeks).map((block) => (
                  <div key={`review-week-${block.week_number}`} className="rounded-[18px] bg-paper px-4 py-3">
                    <p className="text-sm font-semibold text-ink">Week {block.week_number}</p>
                    <p className="mt-1 text-sm text-ink/65">{block.instruction_text || 'No instruction text yet.'}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-ink/42">
                      {block.frequency_per_week ? `${block.frequency_per_week}x/week` : 'Frequency not set'}
                      {block.target_metric ? ` · ${block.target_metric}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="ui-button-secondary">
                Back
              </button>
              <button onClick={submitAssignment} disabled={saving} className="ui-button-primary">
                {saving ? 'Assigning…' : 'Assign Protocol'}
              </button>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
