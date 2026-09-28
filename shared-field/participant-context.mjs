/**
 * A participant's scoped context for one shared undertaking
 * (`oi.shared-field-participant-context/v1`), composed from the
 * participant's own caller-visible field reading: the undertaking's purpose
 * (FieldNow child NOW), the shared sources (curated artifact Projections
 * with their source revisions), the World's projected constituents and the
 * contribution basis each source offers. Nothing the participant cannot
 * read enters it; nothing about how its work will be judged enters it.
 */
export const PARTICIPANT_CONTEXT_SCHEMA = 'oi.shared-field-participant-context/v1';

const text = (html) => String(html ?? '')
  .replace(/<\/(p|h[1-6]|li)>/g, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
  .replace(/\n{3,}/g, '\n\n').trim();

export function participantContext({ snapshot, field_ref, participant_ref, prepared_at }) {
  const field = (snapshot.fields ?? []).find((row) => row.field_ref === field_ref);
  if (!field) throw new TypeError(`the field ${field_ref} is not in this participant's reading`);
  const authority = (snapshot.my_authority ?? []).find((row) => row.field_ref === field_ref && row.participant_ref === participant_ref && !row.revoked);
  if (!authority) throw new TypeError(`${participant_ref} holds no authority in ${field_ref}`);
  const inField = (ref) => snapshot.entry_fields?.[ref] === field_ref;
  const entries = (snapshot.entries ?? []).filter((entry) => inField(entry.ref));
  const now = (snapshot.field_now ?? []).find((row) => row.field_ref === field_ref)?.contract ?? null;
  const projections = (snapshot.projections ?? []).filter((projection) => projection.state === 'published');
  const sources = entries.filter((entry) => entry.kind === 'curated-artifact').map((entry) => {
    const projection = projections.find((row) => row.projection_ref === entry.meta?.projection_ref) ?? projections.find((row) => row.subject?.ref === entry.ref);
    const regions = projection?.representation?.payload?.regions ?? [];
    const sections = regions.flatMap((region) => region.bindings ?? []).filter((binding) => binding.component_ref === 'oi.presentation/prose/v1').map((binding) => ({ ref: binding.subject_ref, title: binding.props?.title ?? '', text: text(binding.props?.html ?? binding.fallback?.text) }));
    return {
      artifact_ref: entry.ref,
      title: entry.label,
      source_ref: projection?.source?.ref ?? null,
      source_revision: projection?.source?.revision ?? null,
      projection_ref: projection?.projection_ref ?? null,
      projection_revision: projection?.projection_revision ?? null,
      sections,
    };
  });
  const constituents = entries.filter((entry) => entry.kind !== 'curated-artifact').map((entry) => ({ ref: entry.ref, kind: entry.kind, label: entry.label, summary: entry.summary ?? null }));
  const relations = (snapshot.relations ?? []).filter((relation) => inField(relation.from) || inField(relation.to)).map((relation) => ({ from: relation.from, to: relation.to, relation: relation.relation }));
  const undertaking = (now?.projected_child_now_refs ?? []).map((child) => ({ now_ref: child.now_ref, workcell_ref: child.workcell_ref, state: child.state, purpose: child.purpose_summary ?? null, projected_by: child.projected_by }));
  return {
    schema: PARTICIPANT_CONTEXT_SCHEMA,
    field_ref,
    field_title: field.title ?? field_ref,
    participant_ref,
    role: authority.role,
    prepared_at,
    basis: { target: snapshot.target?.name ?? null, transport_identity: snapshot.transport_identity, field_now_revision: now?.revision ?? null },
    undertaking,
    sources,
    constituents,
    relations,
    contribution: {
      body_kinds: ['prose', 'relation-proposal'],
      law: 'A contribution is an attributable difference proposed to a source at the revision you read; it enters quarantine and the source owner decides.',
    },
  };
}

export function participantContextMarkdown(context) {
  const lines = [`# Shared undertaking — ${context.field_title}`, '', `You take part as \`${context.participant_ref}\` (${context.role}). This is what the field shares with you.`, ''];
  lines.push('## What the undertaking is for', '');
  for (const item of context.undertaking) lines.push(`- ${item.purpose ?? item.now_ref} — NOW \`${item.now_ref}\` on \`${item.workcell_ref}\` (${item.state})`);
  if (!context.undertaking.length) lines.push('- No NOW is projected into this field.');
  lines.push('', '## Shared sources', '');
  for (const source of context.sources) {
    lines.push(`### ${source.title}`, '', `Source \`${source.source_ref}\` at revision \`${source.source_revision}\` (Projection \`${source.projection_ref}\` r${source.projection_revision}).`, '');
    for (const section of source.sections) lines.push(`#### ${section.title || section.ref}`, '', section.text, '');
  }
  lines.push('## The world around it', '');
  for (const item of context.constituents) lines.push(`- ${item.kind}: ${item.label} (\`${item.ref}\`)${item.summary ? ` — ${item.summary}` : ''}`);
  lines.push('', '## Relations', '');
  for (const item of context.relations) lines.push(`- \`${item.from}\` —${item.relation}→ \`${item.to}\``);
  lines.push('', '## Contributing', '', context.contribution.law, `Body kinds you can offer here: ${context.contribution.body_kinds.join(', ')}.`, '');
  return `${lines.join('\n')}\n`;
}
