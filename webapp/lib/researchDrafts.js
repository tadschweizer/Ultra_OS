function joinTags(tags = []) {
  if (!tags.length) return 'endurance performance';
  if (tags.length === 1) return tags[0];
  if (tags.length === 2) return `${tags[0]} and ${tags[1]}`;
  return `${tags.slice(0, -1).join(', ')}, and ${tags[tags.length - 1]}`;
}

function sportRead(form = {}) {
  const scores = [
    { label: 'ultra-endurance athletes', score: Number(form.ultra_score || 0) },
    { label: 'gravel athletes', score: Number(form.gravel_score || 0) },
    { label: 'triathletes', score: Number(form.triathlon_score || 0) },
  ]
    .filter((item) => item.score >= 4)
    .map((item) => item.label);

  if (!scores.length) return 'long-endurance athletes';
  if (scores.length === 1) return scores[0];
  return `${scores.slice(0, -1).join(', ')} and ${scores[scores.length - 1]}`;
}

export function buildResearchDraft(form = {}) {
  const tags = joinTags(form.topic_tags || []);
  const audience = sportRead(form);
  const title = form.title || 'This study';
  const journal = form.journal ? ` in ${form.journal}` : '';
  const year = form.publication_year ? ` (${form.publication_year})` : '';

  return {
    plain_english_summary: `${title}${year}${journal} is relevant to ${audience} because it helps translate ${tags} into an actual training decision. The paper should be read as a signal about when this lever is worth using, what type of session or block it best fits, and where the downside or implementation cost might outweigh the upside.`,
    practical_takeaway: `Use this study to decide where ${tags.toLowerCase()} belongs in the build, then pressure-test it in training before treating it as race-day truth. The useful question is not just whether it works in principle, but whether it improves the sessions and race demands that matter for this athlete.`,
    commentary: `Editorial angle: explain where this finding is actionable for ${audience}, where the paper is too controlled to map cleanly onto real training, and what an athlete should test first before making it part of the default stack.`,
  };
}
