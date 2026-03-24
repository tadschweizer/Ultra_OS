import { getInterventionDefinition } from '../lib/interventionCatalog';

function fieldClassName() {
  return 'w-full rounded-2xl border border-ink/10 bg-paper px-4 py-3 text-ink';
}

function MultiSelectField({ field, value = [], onChange }) {
  const selectedValues = Array.isArray(value) ? value : [];

  function toggle(option) {
    if (selectedValues.includes(option)) {
      onChange(field.key, selectedValues.filter((item) => item !== option));
      return;
    }
    onChange(field.key, [...selectedValues, option]);
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-ink">{field.label}</label>
      <div className="flex flex-wrap gap-2">
        {field.options.map((option) => {
          const active = selectedValues.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggle(option)}
              className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                active ? 'border-ink bg-ink text-paper' : 'border-ink/10 bg-white text-ink'
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BooleanField({ field, value, onChange }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-ink">{field.label}</label>
      <div className="flex gap-2">
        {[
          { label: 'Yes', value: true },
          { label: 'No', value: false },
        ].map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => onChange(field.key, option.value)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              value === option.value ? 'border-ink bg-ink text-paper' : 'border-ink/10 bg-white text-ink'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function DefaultField({ field, value, onChange }) {
  if (field.type === 'select') {
    return (
      <div>
        <label className="mb-1 block text-sm font-semibold text-ink">{field.label}</label>
        <select
          value={value ?? ''}
          onChange={(event) => onChange(field.key, event.target.value)}
          className={fieldClassName()}
        >
          <option value="">Select</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-ink">{field.label}</label>
      <input
        type={field.type === 'number' ? 'number' : 'text'}
        value={value ?? ''}
        min={field.min}
        max={field.max}
        step={field.step}
        onChange={(event) => onChange(field.key, event.target.value)}
        className={fieldClassName()}
      />
    </div>
  );
}

export default function InterventionProtocolFields({
  interventionType,
  protocolPayload,
  onFieldChange,
}) {
  const definition = getInterventionDefinition(interventionType);

  if (!definition) {
    return (
      <div className="rounded-[24px] bg-paper p-4 text-sm text-ink/65">
        Choose an intervention type to load the protocol-specific fields.
      </div>
    );
  }

  return (
    <div className="rounded-[24px] bg-paper p-4">
      <div className="mb-4">
        <p className="text-sm uppercase tracking-[0.22em] text-accent">{definition.phase}</p>
        <p className="mt-2 text-lg font-semibold text-ink">{definition.label}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {definition.fields.map((field) => {
          const value = protocolPayload?.[field.key];

          if (field.type === 'multiselect') {
            return (
              <div key={field.key} className="md:col-span-2">
                <MultiSelectField field={field} value={value} onChange={onFieldChange} />
              </div>
            );
          }

          if (field.type === 'boolean') {
            return (
              <div key={field.key}>
                <BooleanField field={field} value={value} onChange={onFieldChange} />
              </div>
            );
          }

          return <DefaultField key={field.key} field={field} value={value} onChange={onFieldChange} />;
        })}
      </div>
    </div>
  );
}

