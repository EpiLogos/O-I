/**
 * A participant's scoped context for one shared undertaking
 * (`oi.shared-field-participant-context/v1`), composed from the
 * participant's own caller-visible field reading: the undertaking's purpose
 * (FieldNow child NOW), the shared sources (curated artifact Projections
 * with their source revisions), the World's projected constituents and the
 * contribution basis each source offers. Nothing the participant cannot
 * read enters it; nothing about how its work will be judged enters it.
 */
import * as CONTRIBUTION_MODULE from './contribution-return.mjs';
import * as SOCIAL_MODULE from './social.mjs';

export const PARTICIPANT_CONTEXT_SCHEMA = 'oi.shared-field-participant-context/v1';

const text = (html) => String(html ?? '')
  .replace(/<\/(p|h[1-6]|li)>/g, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
  .replace(/\n{3,}/g, '\n\n').trim();

export function participantContext({ snapshot, field_ref, participant_ref, prepared_at }) {
  const field = (snapshot.fields ?? []).find((row) => row.field_ref === field_ref);
  if (!field) throw new TypeError(`the field ${field_ref} is not in this participant's reading`);
  const preparedMs = Date.parse(prepared_at);
  const nowMicros = BigInt(Number.isFinite(preparedMs) ? preparedMs : Date.now()) * 1000n;
  const live = (row) => {
    const expires = row.expires_at_micros === undefined || row.expires_at_micros === null ? 0n : BigInt(row.expires_at_micros);
    return expires === 0n || nowMicros < expires;
  };
  const authority = (snapshot.my_authority ?? []).find((row) => row.field_ref === field_ref && row.participant_ref === participant_ref && !row.revoked && live(row));
  if (!authority) throw new TypeError(`${participant_ref} holds no authority in ${field_ref}`);
  const inField = (ref) => snapshot.entry_fields?.[ref] === field_ref;
  const entries = (snapshot.entries ?? []).filter((entry) => inField(entry.ref));
  const now = (snapshot.field_now ?? []).find((row) => row.field_ref === field_ref)?.contract ?? null;
  // Only this field's Projections can be a source's basis: by the field the
  // hosted row names, else by the field of its publisher. Each lineage is read
  // at its latest revision, and a withdrawn latest revision is no basis.
  const publisherFields = new Map((snapshot.participants ?? []).map((row) => [row.participant_ref, row.field_ref]));
  const projectionInField = (projection) => (snapshot.projection_fields
    ? snapshot.projection_fields[projection.projection_ref] === field_ref
    : publisherFields.get(projection.publisher_participant_ref) === field_ref);
  const latestByRef = new Map();
  for (const projection of snapshot.projections ?? []) {
    if (!projectionInField(projection)) continue;
    const prior = latestByRef.get(projection.projection_ref);
    if (!prior || Number(projection.projection_revision) > Number(prior.projection_revision)) latestByRef.set(projection.projection_ref, projection);
  }
  const projections = [...latestByRef.values()].filter((projection) => projection.state === 'published');
  const sources = entries.filter((entry) => entry.kind === 'curated-artifact').map((entry) => {
    const named = entry.meta?.projection_ref ?? entry.projection_ref;
    const projection = named
      ? projections.find((row) => row.projection_ref === named)
      : projections.find((row) => row.subject?.ref === entry.ref);
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
  // Admitted work in this field is part of what it shares: a later
  // participant meets what earlier participants contributed and the owner
  // accepted, with its contributor and basis.
  const accepted = (snapshot.contributions ?? []).map((row) => row.contract ?? row).filter((contract) => contract?.field_ref === field_ref).map((contract) => {
    const body = contract.representation?.payload ?? {};
    const content = body.kind === 'prose' ? String(body.content ?? '') : body.kind === 'relation-proposal' ? `${body.content?.from?.ref} —${body.content?.relation?.ref}→ ${body.content?.to?.ref}${body.content?.summary ? `: ${body.content.summary}` : ''}` : JSON.stringify(body.content ?? null);
    return { contribution_ref: contract.contribution_ref, contributor: contract.contributor_participant_ref, agent: contract.agency?.ref ?? null, body_kind: body.kind ?? null, target: contract.target?.ref ?? null, basis: body.basis ?? null, content };
  });
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
    accepted,
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
  lines.push('', '## Accepted work in this undertaking', '');
  for (const item of context.accepted ?? []) lines.push(`### ${item.body_kind} by ${item.contributor}${item.agent ? ` (${item.agent})` : ''} → \`${item.target}\``, '', item.content, '');
  if (!(context.accepted ?? []).length) lines.push('Nothing has been accepted here yet.', '');
  lines.push('', '## Contributing', '', context.contribution.law, `Body kinds you can offer here: ${context.contribution.body_kinds.join(', ')}.`, '');
  return `${lines.join('\n')}\n`;
}

/**
 * A participant Agent's result as attributable Contributions (quarantined on
 * submission): the explanation as `prose` proposed to the `from` record, and
 * the typed relation as `relation-proposal` between the two records. Each is
 * pinned to the basis the Agent read — the source revision and the artifact
 * Projection revision from the prepared context — and names the Agent
 * (agency.ref) and its session (agency.execution_ref) that did the work.
 */
export function participantContributions({ context, result, agent_ref, execution_ref, created_at }) {
  const { createContributionBody } = CONTRIBUTION_MODULE;
  const { createContribution } = SOCIAL_MODULE;
  const byRecord = (id) => {
    const source = context.sources.find((row) => row.source_ref === `central:source:corpus:${id}` || row.artifact_ref.endsWith(`corpus:${id}`));
    if (!source) throw new TypeError(`the result names ${id}, which is not a source shared in this context`);
    return source;
  };
  const proposal = result.relation_proposal ?? {};
  if (typeof result.explanation_markdown !== 'string' || !result.explanation_markdown.trim()) throw new TypeError('the result carries no explanation_markdown');
  if (!/^[a-z][a-z0-9-]{1,40}$/.test(String(proposal.relation_kind ?? ''))) throw new TypeError('relation_proposal.relation_kind must be a short kebab-case kind');
  const from = byRecord(proposal.from);
  const to = byRecord(proposal.to);
  const basis = (source) => ({ source_ref: source.source_ref, source_revision: source.source_revision, projection_ref: source.projection_ref, projection_revision: source.projection_revision });
  const node = (id) => ({ kind: 'central.wiki-node', ref: `wiki:node:record/${id}` });
  const slug = String(context.participant_ref).replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
  const digest = (value) => { let h = 2166136261; for (const ch of JSON.stringify(value)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16).padStart(8, '0'); };
  const provenance = [{ kind: 'participant-agent', ref: agent_ref, source_system: 'shared-field', ...(execution_ref ? { revision: execution_ref } : {}) }];
  const agency = { ref: agent_ref, ...(execution_ref ? { execution_ref } : {}) };
  const make = (kind, target, relation, content, sourceBasis, attachments) => {
    const body = createContributionBody({ kind, basis: basis(sourceBasis), content, attachments });
    return createContribution({
      contribution_ref: `contribution:${slug}:${kind}:${digest([kind, target, content])}`,
      field_ref: context.field_ref,
      contributor_participant_ref: context.participant_ref,
      created_at,
      mode: kind === 'prose' ? 'reply' : 'correction',
      target: { ...target, revision: sourceBasis.source_revision },
      relation: { kind: relation },
      representation: { kind: 'oi.contribution-body/v1', payload: body },
      provenance,
      agency,
    });
  };
  const read = (Array.isArray(result.sections_read) ? result.sections_read : []).filter((ref) => typeof ref === 'string').map((ref) => ({ kind: 'artifact-section', ref }));
  return [
    make('prose', node(proposal.from), 'proposes_difference_to', result.explanation_markdown.trim(), from, read),
    make('relation-proposal', node(proposal.from), 'proposes_difference_to', {
      relation: { kind: 'wiki-relation-kind', ref: proposal.relation_kind },
      from: { kind: 'central.wiki-node', ref: `wiki:node:record/${proposal.from}`, revision: from.source_revision },
      to: { kind: 'central.wiki-node', ref: `wiki:node:record/${proposal.to}`, revision: to.source_revision },
      ...(proposal.summary ? { summary: String(proposal.summary) } : {}),
    }, from, []),
  ];
}
