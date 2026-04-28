import {
  buildInstructionsPayload,
  createEmptyWeeklyBlock,
  normalizeWeeklyBlocks,
} from '../lib/protocolAssignmentEngine';

function updateWeeklyBlocks(form, updater) {
  const currentBlocks = normalizeWeeklyBlocks(form.instructions?.weekly_blocks, form.duration_weeks);
  const nextBlocks = normalizeWeeklyBlocks(updater(currentBlocks), form.duration_weeks);
  return {
    ...form,
    instructions: buildInstructionsPayload(nextBlocks),
  };
}

export default function ProtocolTemplateEditor({
  form,
  onChange,
  interventionTypes,
  showShareToggle = true,
  showName = true,
}) {
  const weeklyBlocks = normalizeWeeklyBlocks(form.instructions?.weekly_blocks, form.duration_weeks);

  function setField(key, value) {
    const nextForm = {
      ...form,
      [key]: value,
    };

    if (key === 'duration_weeks') {
      nextForm.instructions = buildInstructionsPayload(
        normalizeWeeklyBlocks(form.instructions?.weekly_blocks, value)
      );
    }

    onChange(nextForm);
  }

  function updateBlock(index, key, value) {
    onChange(
      updateWeeklyBlocks(form, (blocks) =>
        blocks.map((block, blockIndex) =>
          blockIndex === index ? { ...block, [key]: value } : block
        )
      )
    );
  }

  function moveBlock(index, direction) {
    onChange(
      updateWeeklyBlocks(form, (blocks) => {
        const nextBlocks = [...blocks];
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= nextBlocks.length) return nextBlocks;
        [nextBlocks[index], nextBlocks[targetIndex]] = [nextBlocks[targetIndex], nextBlocks[index]];
        return nextBlocks;
      })
    );
  }

  function removeBlock(index) {
    onChange(
      updateWeeklyBlocks(form, (blocks) => {
        if (blocks.length === 1) return [createEmptyWeeklyBlock(1)];
        return blocks.filter((_, blockIndex) => blockIndex !== index);
      })
    );
  }

  function addWeek() {
    const nextDuration = Math.max(Number(form.duration_weeks || 1), weeklyBlocks.length + 1);
    onChange({
      ...updateWeeklyBlocks(form, (blocks) => [...blocks, createEmptyWeeklyBlock(blocks.length + 1)]),
      duration_weeks: nextDuration,
    });
  }

  return (
    <div className="space-y-5">
      {showName ? (
        <div>
          <label className="mb-1 block text-sm font-semibold text-ink">Protocol Name</label>
          <input
            value={form.name}
            onChange={(event) => setField('name', event.target.value)}
            className="ui-input"
            placeholder="4-Week Progressive Heat Acclimation"
          />
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-semibold text-ink">Protocol Type</label>
          <select
            value={form.protocol_type}
            onChange={(event) => setField('protocol_type', event.target.value)}
            className="ui-input"
          >
            <option value="">Select protocol type</option>
            {interventionTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-ink">Duration (weeks)</label>
          <input
            type="number"
            min="1"
            max="24"
            value={form.duration_weeks}
            onChange={(event) => setField('duration_weeks', Number(event.target.value || 1))}
            className="ui-input"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold text-ink">Description</label>
        <textarea
          value={form.description}
          onChange={(event) => setField('description', event.target.value)}
          rows={3}
          className="ui-input"
          placeholder="What this protocol is for, who it helps, and how the progression works."
        />
      </div>

      <div className="rounded-[24px] border border-border-subtle bg-surface-light p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Weekly Instructions</p>
            <p className="mt-1 text-sm text-ink/60">
              Add one block per week. Each block should say what to do, how often, and what metric matters.
            </p>
          </div>
          <button type="button" onClick={addWeek} className="ui-button-secondary py-2">
            + Add Week
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {weeklyBlocks.map((block, index) => (
            <div key={`week-block-${index}`} className="rounded-[20px] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-ink">Week {index + 1}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => moveBlock(index, -1)}
                    className="rounded-full border border-ink/10 px-3 py-1 text-xs font-semibold text-ink"
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBlock(index, 1)}
                    className="rounded-full border border-ink/10 px-3 py-1 text-xs font-semibold text-ink"
                  >
                    Down
                  </button>
                  <button
                    type="button"
                    onClick={() => removeBlock(index)}
                    className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-700"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(160px,0.7fr)_minmax(0,1.3fr)]">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">
                    Instruction text
                  </label>
                  <textarea
                    value={block.instruction_text}
                    onChange={(event) => updateBlock(index, 'instruction_text', event.target.value)}
                    rows={2}
                    className="ui-input"
                    placeholder="20-minute sauna sessions after easy runs"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">
                    Frequency / week
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="14"
                    value={block.frequency_per_week}
                    onChange={(event) => updateBlock(index, 'frequency_per_week', event.target.value === '' ? '' : Number(event.target.value))}
                    className="ui-input"
                    placeholder="3"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">
                    Target metric
                  </label>
                  <input
                    value={block.target_metric}
                    onChange={(event) => updateBlock(index, 'target_metric', event.target.value)}
                    className="ui-input"
                    placeholder="Core temp 38.5C"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showShareToggle ? (
        <label className="flex items-center gap-3 rounded-[18px] border border-border-subtle bg-white px-4 py-3">
          <input
            type="checkbox"
            checked={form.is_shared === true}
            onChange={(event) => setField('is_shared', event.target.checked)}
          />
          <span>
            <span className="block text-sm font-semibold text-ink">Share with other coaches</span>
            <span className="block text-sm text-ink/60">
              Turn this on if you want this template to appear in the shared platform library.
            </span>
          </span>
        </label>
      ) : null}
    </div>
  );
}
