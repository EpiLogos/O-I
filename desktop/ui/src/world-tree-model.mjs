// World tree presentation model (01 §2, 02 §3 WorldService).
//
// The K2 WorldService lands the World tree as a Projection read
// (`oi.world-tree/v1`), the live composition (`oi.composition-reading/v1`) and
// the subject reading (`oi.subject-reading/v1`). This module builds render-only
// models from those readings so the desktop can disclose the World without
// inventing desktop-local semantics. It is pure: reading in, deterministic model
// out, no native bridge, no authority, no state.
//
// Two laws shape everything below:
// - **Verbatim.** Treatments, Wiki refs, owner World refs, access facts and
//   warnings are carried exactly as the owner's reading declared them. An
//   omitted fact stays omitted (01 §2: omission is the default); nothing is
//   derived from anything else here.
// - **Selection is kernel focus, never a tree access fact.** A fresh
//   `world_tree` read never projects the kernel's selection, so `access.selected`
//   is absent on a focused node in a fresh read. What is rendered as selected is
//   therefore taken from the focus relation alone (K2 review F-M2) — this module
//   never reads `access.selected` at all.

export const WORLD_TREE_SCHEMA = 'oi.world-tree/v1';
export const COMPOSITION_READING_SCHEMA = 'oi.composition-reading/v1';
export const SUBJECT_READING_SCHEMA = 'oi.subject-reading/v1';

/** The Cradle's tree-ref grammar (01 §2), used only for labelling. */
export const PERSONAL_WORLD_REF = 'world:personal';
export const PROJECT_WORLD_PREFIX = 'world:project:';

/** The seven distinct access facts (01 §2), in disclosure-ladder order. */
export const ACCESS_FACTS = Object.freeze([
  'exists',
  'readable',
  'indexable',
  'retrievable',
  'selected',
  'projected',
  'public',
]);

const PRESENCE_WORDS = Object.freeze({
  present: 'present',
  degraded: 'degraded',
  absent: 'absent',
});

function text(value, fallback = '') {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  return fallback;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function records(value) {
  return list(value).filter((entry) => !!entry && typeof entry === 'object' && !Array.isArray(entry));
}

/** The access facts the reading actually asserted — never the ones it omitted. */
export function accessFacts(access) {
  if (!access || typeof access !== 'object') return [];
  return ACCESS_FACTS.filter((fact) => access[fact] === true);
}

/** One access fact exactly as observed: `true`, `false` or `undefined` (omitted). */
export function accessFact(access, fact) {
  if (!access || typeof access !== 'object') return undefined;
  return access[fact];
}

function refSummary(value) {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.ref !== 'string' || value.ref === '') return null;
  return {
    ref: value.ref,
    kind: text(value.kind),
    native_owner: text(value.native_owner),
    provenance: value.provenance && typeof value.provenance === 'object' ? { ...value.provenance } : null,
  };
}

function groundModel(ground) {
  if (!ground || typeof ground !== 'object') return null;
  return {
    native_owner: text(ground.native_owner),
    contract: text(ground.contract),
    path: ground.path ?? null,
    present: ground.present === true,
    owner_world_ref: ground.owner_world_ref ?? null,
  };
}

/** The Wiki a node carries, verbatim; absent stays absent (01 §2). */
function wikiReading(wiki) {
  if (!wiki || typeof wiki !== 'object') return null;
  return {
    profile: text(wiki.profile),
    wiki_ref: wiki.wiki_ref ?? null,
    source: wiki.source ?? null,
    federates: list(wiki.federates).map((entry) => text(entry)),
  };
}

function sourceModel(source) {
  if (!source || typeof source !== 'object') return null;
  return {
    ref: text(source.ref),
    path: source.path ?? null,
    /** The owner's declared treatment, verbatim — never re-classified (02 §9.3). */
    treatment: text(source.treatment),
    provenance: text(source.provenance),
    standing: text(source.standing),
    roles: list(source.roles).map((role) => text(role)),
    agent_retrieval_allowed: source.agent_retrieval_allowed === true,
    revision: source.revision ?? null,
    access: source.access && typeof source.access === 'object' ? { ...source.access } : {},
    access_facts: accessFacts(source.access),
  };
}

function nodeModel(node, depth, parentRef) {
  if (!node || typeof node !== 'object') return null;
  const world = refSummary(node.world);
  if (!world) return null;
  const children = list(node.children)
    .map((child) => nodeModel(child, depth + 1, world.ref))
    .filter(Boolean);
  return {
    ...world,
    depth,
    parent_ref: parentRef ?? null,
    ground: groundModel(node.ground),
    wiki: wikiReading(node.wiki),
    sources: list(node.sources).map(sourceModel).filter(Boolean),
    access: node.access && typeof node.access === 'object' ? { ...node.access } : {},
    access_facts: accessFacts(node.access),
    children,
  };
}

function flatten(node, into) {
  if (!node) return into;
  into.push(node);
  for (const child of node.children) flatten(child, into);
  return into;
}

/**
 * Build the render model of one `oi.world-tree/v1` reading.
 *
 * Returns null when the reading is not a World tree reading — the caller
 * renders the absence honestly rather than a fabricated tree.
 */
export function buildWorldTreeModel(reading) {
  if (!reading || typeof reading !== 'object') return null;
  if (text(reading.schema) !== WORLD_TREE_SCHEMA) return null;
  const root = nodeModel(reading.root, 0, null);
  const nodes = flatten(root, []);
  return {
    schema: text(reading.schema),
    provider: {
      class: text(reading.provider?.class, 'unobserved'),
      seam: text(reading.provider?.seam),
      detail: reading.provider?.detail ?? null,
    },
    warnings: list(reading.warnings).map((warning) => text(warning)),
    root,
    nodes,
    summary: {
      projects: nodes.filter((node) => node.parent_ref != null).length,
      sources: nodes.reduce((count, node) => count + node.sources.length, 0),
      wikis: nodes.filter((node) => node.wiki != null).length,
      grounds: nodes.filter((node) => node.ground != null).length,
    },
  };
}

/**
 * The refs the kernel's one focus relation currently names (02 §7).
 *
 * Selection is rendered from this and from nothing else: not from a tree
 * node's access facts, not from what a surface happened to click.
 */
export function focusRefs(focus) {
  if (!focus || typeof focus !== 'object') return { world: null, project: null, subject: null };
  const slot = (value) => (value && typeof value === 'object' && typeof value.ref === 'string' ? value.ref : null);
  return {
    world: slot(focus.world),
    project: slot(focus.project),
    subject: slot(focus.subject),
  };
}

/** Whether the kernel focus names this tree node (a World or Project relation). */
export function nodeIsFocused(node, focus) {
  if (!node) return false;
  const refs = focusRefs(focus);
  return node.ref === refs.world || node.ref === refs.project;
}

/** Whether the kernel focus names this source as the current subject. */
export function sourceIsFocused(source, focus) {
  if (!source) return false;
  return source.ref === focusRefs(focus).subject;
}

/** The whole ref a tree node is opened/selected under — the kernel's own mint. */
export function subjectRefForNode(node) {
  if (!node) return null;
  return {
    ref: node.ref,
    kind: node.kind,
    native_owner: node.native_owner,
    provenance: node.provenance ?? { source: WORLD_TREE_SCHEMA },
  };
}

/**
 * The whole ref a World source is opened under.
 *
 * `kind` is a Cradle-side naming for the ref it addresses — the kernel routes
 * by native owner and resolves the source through its own Projection; no
 * relation is ever inferred from the kind string (02 §9.3).
 */
export function subjectRefForSource(source, node) {
  if (!source) return null;
  return {
    ref: source.ref,
    kind: 'world-source',
    native_owner: 'central',
    provenance: { source: node ? `${WORLD_TREE_SCHEMA} via ${node.ref}` : WORLD_TREE_SCHEMA, revision: source.revision ?? undefined },
  };
}

/**
 * The project World node that disclosed `sourceRef`, found by walking the
 * composed Projection — never by parsing the ref or its kind (K2 ruling 3).
 *
 * This is the node a cold host must open first: the first open of a SOURCE
 * cannot bind the Project relation, while opening the project World node both
 * enriches the tree and binds it (K2 review, concern 2).
 */
export function projectNodeForSource(reading, sourceRef) {
  const model = buildWorldTreeModel(reading);
  if (!model) return null;
  for (const node of model.nodes) {
    if (node.parent_ref == null) continue;
    if (node.sources.some((source) => source.ref === sourceRef)) return node;
  }
  return null;
}

/** The project node this node hangs under, by the same Projection walk. */
export function projectNodeOfNode(model, node) {
  if (!model || !node || node.parent_ref == null) return null;
  return model.nodes.find((candidate) => candidate.ref === node.parent_ref) ?? null;
}

// ---------------------------------------------------------------------------
// Live composition (02 §2, §11 Retire)
// ---------------------------------------------------------------------------

/**
 * Build the render model of one `oi.composition-reading/v1` reading: what is
 * present / degraded / absent, as observed (02 §10).
 *
 * `capabilities` are the owner's capability descriptors (02 §9.1). They are
 * rendered as descriptors and can never become presence: presence comes from
 * `state` alone (K2 fix, S3 residual).
 */
export function buildCompositionModel(reading) {
  if (!reading || typeof reading !== 'object') return null;
  if (text(reading.schema) !== COMPOSITION_READING_SCHEMA) return null;
  const constituents = records(reading.constituents).map((constituent) => ({
    native_owner: text(constituent.native_owner),
    /** The observed presence, verbatim: `present | degraded | absent`. */
    state: text(constituent.state, 'absent'),
    state_word: PRESENCE_WORDS[text(constituent.state, 'absent')] ?? text(constituent.state),
    provider_class: text(constituent.provider_class, 'unobserved'),
    /** Descriptor truth only — never read as presence. */
    capabilities: list(constituent.capabilities).map((capability) => text(capability)),
    detail: constituent.detail ?? null,
  }));
  return {
    schema: text(reading.schema),
    condition: text(reading.condition, 'empty'),
    constituents,
    warnings: list(reading.warnings).map((warning) => text(warning)),
    counts: {
      present: constituents.filter((constituent) => constituent.state === 'present').length,
      degraded: constituents.filter((constituent) => constituent.state === 'degraded').length,
      absent: constituents.filter((constituent) => constituent.state === 'absent').length,
    },
  };
}

// ---------------------------------------------------------------------------
// Structured write failures (K2 fix F-M4)
// ---------------------------------------------------------------------------

/**
 * The conflict a failed save carries, as data.
 *
 * `save_subject` fails with a structured failure; a conflict names the revision
 * the owner holds now, so a re-read is a plain data read. Returns null for any
 * failure that is not a conflict — the renderer never parses prose.
 */
export function conflictFromFailure(failure) {
  if (!failure || typeof failure !== 'object') return null;
  if (failure.reason !== 'conflict') return null;
  return {
    source_ref: text(failure.source_ref),
    expected_revision: text(failure.expected_revision),
    current_revision: text(failure.current_revision),
  };
}

/** Why a non-conflict write did not happen, as the structured reason names it. */
export function failureReason(failure) {
  if (!failure || typeof failure !== 'object') return null;
  if (failure.reason === 'conflict') return 'conflict';
  return { reason: text(failure.reason), detail: text(failure.detail) };
}

// ---------------------------------------------------------------------------
// Subject readings
// ---------------------------------------------------------------------------

/**
 * Build the render model of one `oi.subject-reading/v1`.
 *
 * A subject the owner did not serve is disclosed as exactly that: an unobserved
 * provider reading with the owner's reason. It is never rendered as content.
 */
export function buildSubjectModel(reading) {
  if (!reading || typeof reading !== 'object') return null;
  if (text(reading.schema) !== SUBJECT_READING_SCHEMA) return null;
  const source = reading.source && typeof reading.source === 'object' ? sourceModel(reading.source) : null;
  return {
    schema: text(reading.schema),
    subject: refSummary(reading.subject),
    access: reading.access && typeof reading.access === 'object' ? { ...reading.access } : {},
    access_facts: accessFacts(reading.access),
    source,
    /** Owner-disclosed content, present only when the source was retrievable. */
    content: typeof reading.content === 'string' ? reading.content : null,
    revision: reading.revision ?? null,
    provider: {
      class: text(reading.provider?.class, 'unobserved'),
      seam: text(reading.provider?.seam),
      detail: reading.provider?.detail ?? null,
    },
    warnings: list(reading.warnings).map((warning) => text(warning)),
    /** The kernel's structured why-it-is-unserved, carried verbatim — the
     * desktop gates advice on this, never on warning prose (K3 fix 1). */
    unserved_reason: typeof reading.unserved_reason === 'string' && reading.unserved_reason ? reading.unserved_reason : null,
  };
}
