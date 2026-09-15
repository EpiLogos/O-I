import { addressedContribution, validateParticipantAddress } from './addressing.mjs';
import { createContribution, validateContribution } from './social.mjs';

export const CONTRIBUTION_BODY_SCHEMA = 'oi.contribution-body/v1';
export const CONTRIBUTION_RETURN_SCHEMA = 'oi.contribution-return/v1';
export const CONTRIBUTION_BODY_KINDS = Object.freeze([
  'prose', 'relation-proposal', 'source-proposal', 'thing', 'expression-revision',
  'expression-scene', 'file', 'reference', 'method',
]);

const KINDS = new Set(CONTRIBUTION_BODY_KINDS);
const record = (value, name) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
};
const text = (value, name) => {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} must be a non-empty string`);
  return value;
};
const positive = (value, name) => {
  if (!Number.isInteger(value) || value < 1) throw new TypeError(`${name} must be a positive integer`);
  return value;
};
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

const readingRef = (value, name) => {
  const item = record(value, name);
  return {
    kind: text(item.kind, `${name}.kind`),
    ref: text(item.ref, `${name}.ref`),
    ...(item.revision !== undefined ? { revision: typeof item.revision === 'number' ? positive(item.revision, `${name}.revision`) : text(item.revision, `${name}.revision`) } : {}),
  };
};
const readingRefs = (value, name) => {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
  return value.map((item, index) => readingRef(item, `${name}[${index}]`));
};

function contributionContent(kind, input, basis) {
  if (kind === 'prose') return text(input, 'prose content');
  const value = record(input, `${kind} content`);
  if (kind === 'relation-proposal') return {
    relation: readingRef(value.relation, 'relation-proposal content.relation'),
    from: readingRef(value.from, 'relation-proposal content.from'),
    to: readingRef(value.to, 'relation-proposal content.to'),
    ...(value.summary !== undefined ? { summary: text(value.summary, 'relation-proposal content.summary') } : {}),
  };
  if (kind === 'source-proposal') {
    const operation = text(value.operation, 'source-proposal content.operation');
    if (!['entry.add', 'entry.append', 'field.append'].includes(operation)) throw new TypeError('source-proposal content.operation must be entry.add, entry.append, or field.append');
    if (operation === 'entry.add') return { operation, entry_id: text(value.entry_id, 'source-proposal content.entry_id'), contribution_id: text(value.contribution_id, 'source-proposal content.contribution_id'), html: text(value.html, 'source-proposal content.html') };
    if (operation === 'entry.append') return { operation, entry_id: text(value.entry_id, 'source-proposal content.entry_id'), contribution_id: text(value.contribution_id, 'source-proposal content.contribution_id'), html: text(value.html, 'source-proposal content.html') };
    return { operation, field_id: text(value.field_id, 'source-proposal content.field_id'), contribution_id: text(value.contribution_id, 'source-proposal content.contribution_id'), html: text(value.html, 'source-proposal content.html') };
  }
  if (kind === 'thing') return { thing: readingRef(value.thing, 'thing content.thing'), ...(value.representation !== undefined ? { representation: clone(record(value.representation, 'thing content.representation')) } : {}) };
  if (kind === 'expression-revision' || kind === 'expression-scene') {
    if (!basis.expression_ref || basis.expression_revision === undefined) throw new TypeError(`${kind} requires an Expression ref and revision in its basis`);
    if (!Array.isArray(value.changes) || value.changes.length === 0) throw new TypeError(`${kind} content.changes must be a non-empty EX1 Change array`);
    return { summary: text(value.summary, `${kind} content.summary`), changes: value.changes.map((change, index) => clone(record(change, `${kind} content.changes[${index}]`))), method_refs: readingRefs(value.method_refs ?? [], `${kind} content.method_refs`), evidence_refs: readingRefs(value.evidence_refs ?? [], `${kind} content.evidence_refs`) };
  }
  if (kind === 'file' || kind === 'reference' || kind === 'method') return readingRef(value, `${kind} content`);
  throw new TypeError(`Unsupported contribution body kind: ${kind}`);
}

function revisionBasis(input) {
  const basis = record(input, 'contribution body.basis');
  return {
    source_ref: text(basis.source_ref, 'contribution body.basis.source_ref'),
    source_revision: text(basis.source_revision, 'contribution body.basis.source_revision'),
    projection_ref: text(basis.projection_ref, 'contribution body.basis.projection_ref'),
    projection_revision: positive(basis.projection_revision, 'contribution body.basis.projection_revision'),
    ...(basis.world_presentation_ref ? { world_presentation_ref: text(basis.world_presentation_ref, 'contribution body.basis.world_presentation_ref') } : {}),
    ...(basis.world_presentation_revision !== undefined ? { world_presentation_revision: positive(basis.world_presentation_revision, 'contribution body.basis.world_presentation_revision') } : {}),
    ...(basis.expression_ref ? { expression_ref: text(basis.expression_ref, 'contribution body.basis.expression_ref') } : {}),
    ...(basis.expression_revision !== undefined ? { expression_revision: positive(basis.expression_revision, 'contribution body.basis.expression_revision') } : {}),
  };
}

export function createContributionBody(input) {
  record(input, 'contribution body');
  const kind = text(input.kind, 'contribution body.kind');
  if (!KINDS.has(kind)) throw new TypeError(`contribution body.kind must be one of ${CONTRIBUTION_BODY_KINDS.join(', ')}`);
  if (!Object.hasOwn(input, 'content')) throw new TypeError('contribution body.content is required');
  const basis = revisionBasis(input.basis);
  const content = contributionContent(kind, input.content, basis);
  const attachments = (input.attachments ?? []).map((item, index) => {
    const ref = record(item, `contribution body.attachments[${index}]`);
    return { kind: text(ref.kind, `contribution body.attachments[${index}].kind`), ref: text(ref.ref, `contribution body.attachments[${index}].ref`), ...(ref.revision ? { revision: text(ref.revision, `contribution body.attachments[${index}].revision`) } : {}) };
  });
  return { schema: CONTRIBUTION_BODY_SCHEMA, kind, basis, content, attachments };
}

export function validateContributionBody(value) {
  record(value, 'contribution body');
  if (value.schema !== CONTRIBUTION_BODY_SCHEMA) throw new TypeError(`Unsupported Contribution body schema: ${value.schema}`);
  return createContributionBody(value);
}

/** Compose an attributable difference without collapsing its identity into any source revision. */
export function createAttachedContribution(input) {
  record(input, 'attached contribution');
  const body = createContributionBody(input.body);
  let contribution = createContribution({
    contribution_ref: text(input.contribution_ref, 'attached contribution.contribution_ref'),
    field_ref: text(input.field_ref, 'attached contribution.field_ref'),
    contributor_participant_ref: text(input.contributor_participant_ref, 'attached contribution.contributor_participant_ref'),
    created_at: text(input.created_at, 'attached contribution.created_at'),
    mode: input.mode ?? (body.kind === 'prose' ? 'reply' : 'correction'),
    target: clone(record(input.target, 'attached contribution.target')),
    relation: clone(input.relation ?? { kind: input.target.kind === 'oi.contribution' ? 'responds_to' : 'proposes_difference_to' }),
    representation: { kind: CONTRIBUTION_BODY_SCHEMA, payload: body },
    provenance: clone(input.provenance),
  });
  if (input.addressing) contribution = addressedContribution(contribution, validateParticipantAddress(input.addressing));
  return contribution;
}

export function contributionBody(contribution) {
  const value = validateContribution(contribution);
  if (value.representation.kind !== CONTRIBUTION_BODY_SCHEMA) throw new TypeError('Contribution does not carry an oi.contribution-body/v1 representation');
  return validateContributionBody(value.representation.payload);
}

/** Refuse a Return if any owner reading has advanced beyond the contributed basis. */
export function inspectContributionBasis(contribution, current) {
  const value = validateContribution(contribution);
  const body = contributionBody(value);
  record(current, 'current owner revisions');
  const checks = [
    ['source_ref', body.basis.source_ref, current.source_ref],
    ['source_revision', body.basis.source_revision, current.source_revision],
    ['projection_ref', body.basis.projection_ref, current.projection_ref],
    ['projection_revision', body.basis.projection_revision, current.projection_revision],
    ...(body.basis.expression_ref === undefined ? [] : [['expression_ref', body.basis.expression_ref, current.expression_ref]]),
    ...(body.basis.expression_revision === undefined ? [] : [['expression_revision', body.basis.expression_revision, current.expression_revision]]),
    ...(body.basis.world_presentation_ref === undefined ? [] : [['world_presentation_ref', body.basis.world_presentation_ref, current.world_presentation_ref]]),
    ...(body.basis.world_presentation_revision === undefined ? [] : [['world_presentation_revision', body.basis.world_presentation_revision, current.world_presentation_revision]]),
  ];
  const stale = checks.filter(([, expected, actual]) => expected !== actual).map(([kind, expected, actual]) => ({ kind, expected, actual: actual ?? null }));
  return { contribution_ref: value.contribution_ref, body, current: clone(current), stale, returnable: stale.length === 0 };
}

/** Build Central's native receiving.submit input; the caller invokes the owner Action. */
export function nativeReturnSubmission(contribution, owner, options = {}) {
  const inspection = inspectContributionBasis(contribution, owner);
  if (!inspection.returnable) {
    const error = new Error(`Contribution basis is stale: ${inspection.stale.map(item => `${item.kind} expected ${item.expected}, current ${item.actual}`).join('; ')}`);
    error.code = 'stale_contribution_basis';
    error.stale = inspection.stale;
    throw error;
  }
  const value = validateContribution(contribution);
  const body = inspection.body;
  if (!['prose', 'source-proposal'].includes(body.kind)) {
    throw new TypeError(`${body.kind} requires its native owner Return operation; Central document receiving cannot apply it`);
  }
  const proposal = body.kind === 'source-proposal'
    ? clone(record(body.content, 'source proposal content'))
    : {
        operation: options.operation ?? 'entry.add',
        entry_id: options.entry_id ?? `entry:${value.contribution_ref}`,
        contribution_id: value.contribution_ref,
        html: options.html ?? `<p>${escapeHtml(body.content)}</p>`,
      };
  text(proposal.operation, 'native source proposal.operation');
  return {
    schema: CONTRIBUTION_RETURN_SCHEMA,
    action_ref: 'central.receiving.submit',
    contribution_ref: value.contribution_ref,
    input: {
      project: options.project ?? null,
      producer_key: options.producer_key ?? `shared-field:${value.contribution_ref}`,
      source_ref: body.basis.source_ref,
      document_id: text(options.document_id, 'Return document_id'),
      expected_source_revision: body.basis.source_revision,
      occurred_at_unix_seconds: options.occurred_at_unix_seconds ?? Math.floor(Date.parse(value.created_at) / 1000),
      task_ref: options.task_ref ?? body.basis.projection_ref,
      proposal: {
        ...proposal,
        shared_field: {
          contribution_ref: value.contribution_ref,
          field_ref: value.field_ref,
          projection_ref: body.basis.projection_ref,
          projection_revision: body.basis.projection_revision,
          source_revision: body.basis.source_revision,
          ...(body.basis.expression_ref ? { expression_ref: body.basis.expression_ref, expression_revision: body.basis.expression_revision } : {}),
          ...(body.basis.world_presentation_ref ? { world_presentation_ref: body.basis.world_presentation_ref, world_presentation_revision: body.basis.world_presentation_revision } : {}),
        },
      },
    },
  };
}

/** Exact Expression owner proposal. Review/accept/refuse remains with EX1's native review operation. */
export function nativeExpressionReturnProposal(contribution, owner, options = {}) {
  const inspection = inspectContributionBasis(contribution, owner);
  if (!inspection.returnable) {
    const error = new Error(`Contribution basis is stale: ${inspection.stale.map(item => `${item.kind} expected ${item.expected}, current ${item.actual}`).join('; ')}`);
    error.code = 'stale_contribution_basis';
    throw error;
  }
  const body = inspection.body;
  if (!['expression-revision', 'expression-scene'].includes(body.kind)) throw new TypeError(`${body.kind} is not an Expression Return`);
  const content = record(body.content, 'Expression contribution content');
  if (!Array.isArray(content.changes)) throw new TypeError('Expression contribution content.changes must be an EX1 Change array');
  const localProposalId = contribution.contribution_ref.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return { action_ref: 'oi.expression.propose', request: { operation: 'propose', expression_ref: body.basis.expression_ref, expected_revision: body.basis.expression_revision, proposal_ref: options.proposal_ref ?? `${body.basis.expression_ref}:proposal:${localProposalId}`, actor: options.actor ?? contribution.contributor_participant_ref, activity_ref: options.activity_ref ?? null, continues_proposal_ref: options.continues_proposal_ref ?? null, summary: text(content.summary, 'Expression contribution content.summary'), changes: clone(content.changes), method_refs: clone(content.method_refs ?? []), evidence_refs: clone(content.evidence_refs ?? []) } };
}

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
