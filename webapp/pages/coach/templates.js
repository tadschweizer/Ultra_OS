import { useEffect, useMemo, useState } from 'react';
import ProtocolTemplateEditor from '../../components/ProtocolTemplateEditor';
import { getAllInterventionDefinitions } from '../../lib/interventionCatalog';
import { createTemplateDraft } from '../../lib/protocolAssignmentEngine';

function TemplateCard({ template, onUse, onDelete }) {
  const weeklyBlocks = template.instructions?.weekly_blocks || [];

  return (
    <article className="ui-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-ink">{template.name}</p>
          <p className="mt-1 text-sm text-ink/60">
            {template.protocol_type} · {template.duration_weeks || 0} weeks
          </p>
          <p className="mt-3 text-sm leading-7 text-ink/70">{template.description || 'No description yet.'}</p>
        </div>
        <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink/70">
          {template.is_shared ? `Shared by ${template.coach_name}` : 'Private'}
        </span>
      </div>

      <div className="mt-5 space-y-2">
        {weeklyBlocks.slice(0, 3).map((block) => (
          <div key={`${template.id}-${block.week_number}`} className="rounded-[18px] bg-paper px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-accent">Week {block.week_number}</p>
            <p className="mt-1 text-sm text-ink/70">{block.instruction_text || 'No instruction text yet.'}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button onClick={() => onUse(template)} className="ui-button-primary py-2">
          Use for Assignment
        </button>
        {onDelete ? (
          <button onClick={() => onDelete(template)} className="ui-button-secondary py-2">
            Delete
          </button>
        ) : null}
      </div>
    </article>
  );
}

export default function CoachTemplatesPage() {
  const interventionTypes = useMemo(
    () => getAllInterventionDefinitions().map((definition) => definition.label),
    []
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(createTemplateDraft());
  const [templates, setTemplates] = useState([]);
  const [sharedTemplates, setSharedTemplates] = useState([]);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function loadTemplates() {
      try {
        const response = await fetch('/api/coach/templates');
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Could not load templates.');
        }
        setTemplates(data.templates || []);
        setSharedTemplates(data.sharedTemplates || []);
      } catch (error) {
        setStatus(error.message);
      } finally {
        setLoading(false);
      }
    }

    loadTemplates();
  }, []);

  const filteredOwnTemplates = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return templates;
    return templates.filter((template) =>
      [template.name, template.protocol_type, template.description]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [search, templates]);

  const filteredSharedTemplates = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sharedTemplates;
    return sharedTemplates.filter((template) =>
      [template.name, template.protocol_type, template.description, template.coach_name]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [search, sharedTemplates]);

  async function saveTemplate(event) {
    event.preventDefault();
    setSaving(true);
    setStatus('');

    try {
      const response = await fetch('/api/coach/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not save template.');
      }

      setTemplates((current) => [data.template, ...current]);
      setForm(createTemplateDraft());
      setStatus('Template saved.');
    } catch (error) {
      setStatus(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate(template) {
    setStatus('');
    const response = await fetch(`/api/coach/templates?id=${template.id}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) {
      setStatus(data.error || 'Could not delete template.');
      return;
    }

    setTemplates((current) => current.filter((item) => item.id !== template.id));
    setStatus(`Deleted ${template.name}.`);
  }

  function loadTemplateIntoForm(template) {
    setForm(createTemplateDraft(template));
    setStatus(`Loaded ${template.name} into the builder.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <main className="ui-shell text-ink">
      <section className="ui-hero">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Templates</p>
        <h1 className="font-display mt-4 text-4xl md:text-6xl">Protocol Template Builder</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-ink/68">
          Build reusable intervention protocols once, then assign them to athletes with athlete-specific dates and targets.
        </p>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <form onSubmit={saveTemplate} className="ui-card space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">New Template</p>
              <p className="mt-1 text-sm text-ink/60">
                This creates a reusable protocol coaches can assign again later.
              </p>
            </div>
            <button type="submit" disabled={saving} className="ui-button-primary">
              {saving ? 'Saving…' : 'Save Template'}
            </button>
          </div>

          {status ? (
            <div className="rounded-[18px] border border-border-subtle bg-paper px-4 py-3 text-sm text-ink/70">
              {status}
            </div>
          ) : null}

          <ProtocolTemplateEditor
            form={form}
            onChange={setForm}
            interventionTypes={interventionTypes}
          />
        </form>

        <div className="space-y-6">
          <section className="ui-card">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Template Library</p>
                <p className="mt-1 text-sm text-ink/60">Search your templates and the shared coach library.</p>
              </div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="ui-input md:max-w-xs"
                placeholder="Search by name or protocol type"
              />
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">My templates</p>
              <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink/68">
                {filteredOwnTemplates.length}
              </span>
            </div>
            {loading ? (
              <div className="ui-card text-sm text-ink/60">Loading templates…</div>
            ) : filteredOwnTemplates.length ? (
              filteredOwnTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onUse={loadTemplateIntoForm}
                  onDelete={deleteTemplate}
                />
              ))
            ) : (
              <div className="ui-card text-sm text-ink/60">You have not saved a template yet.</div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">Shared coach templates</p>
              <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink/68">
                {filteredSharedTemplates.length}
              </span>
            </div>
            {filteredSharedTemplates.length ? (
              filteredSharedTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onUse={loadTemplateIntoForm}
                />
              ))
            ) : (
              <div className="ui-card text-sm text-ink/60">No shared templates matched that search.</div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
