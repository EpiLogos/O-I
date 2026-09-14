import { createParticipant, reviseProjection, validateProjection } from './index.mjs';
import { createSharedField } from './social.mjs';
import { createExploreEntry, createExploreApplication } from './explore.mjs';
import { WORLD_PRESENTATION_SCHEMA, createWorldPresentation } from './presentation.mjs';
import { createWorldPresentationProjection, refineWorldPresentationProjection, worldPresentationFromProjection } from './presentation-projection.mjs';
import { projectionStorageKey, relationStorageRef } from './spacetimedb.mjs';

/**
 * Central wiki → Projection provider.
 *
 * Input is the native owner's own reading of its wiki topology — the
 * `central.wiki-reading/v1` envelope returned by Central's `central.wiki.read`
 * and `projectcentral.wiki.read` Actions — plus an explicit owner selection.
 *
 * The provider never reads Central's filesystem itself, never reads node bodies,
 * and never emits anything that was not named in the selection. Availability of
 * a reading does not imply disclosure of its contents: a WikiSpace, WikiNode or
 * relation enters the Projection only when the selection names it, and a
 * relation survives only when both of its endpoints were selected.
 *
 * The result is a publication bundle: one `oi.projection/v1` carrying an
 * `oi.world-presentation/v1`, the Explore entries and relations that make the
 * projected world addressable, and the hosted reducer arguments derived from
 * them. The Wiki stays the Wiki; the Projection is a selected outward
 * representation of it, never a writable replica.
 */
export const CENTRAL_WIKI_READING_SCHEMA = 'central.wiki-reading/v1';
export const CENTRAL_WIKI_SELECTION_SCHEMA = 'oi.central-wiki-selection/v1';
export const WORLD_PUBLICATION_SCHEMA = 'oi.world-publication/v1';

const HUMAN_AUTHORED_PREFIXES = ['Control/user/', 'Control/relations/', 'ProjectCentral/user/'];

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function record(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} must be a non-empty string`);
  return value;
}

function strings(value, name) {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
  return value.map((entry, index) => text(entry, `${name}[${index}]`));
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Standing of an authored path inside a Central/ProjectCentral tree. */
export function sourceStanding(path) {
  return HUMAN_AUTHORED_PREFIXES.some((prefix) => path.startsWith(prefix)) ? 'human-authored' : 'agent-maintained';
}

export function validateCentralWikiReading(value) {
  const reading = record(value, 'central wiki reading');
  if (reading.schema !== CENTRAL_WIKI_READING_SCHEMA) throw new TypeError(`Unsupported wiki reading schema: ${reading.schema}`);
  if (!['root', 'project'].includes(reading.register)) throw new TypeError('central wiki reading.register must be root or project');
  text(reading.world_ref, 'central wiki reading.world_ref');
  const source = record(reading.source, 'central wiki reading.source');
  text(source.ref, 'central wiki reading.source.ref');
  text(source.revision, 'central wiki reading.source.revision');
  const spaces = Array.isArray(reading.spaces) ? reading.spaces : [];
  const nodes = Array.isArray(reading.nodes) ? reading.nodes : [];
  const relations = Array.isArray(reading.relations) ? reading.relations : [];
  for (const [index, space] of spaces.entries()) {
    record(space, `central wiki reading.spaces[${index}]`);
    text(space.ref, `central wiki reading.spaces[${index}].ref`);
    text(space.title, `central wiki reading.spaces[${index}].title`);
  }
  for (const [index, node] of nodes.entries()) {
    record(node, `central wiki reading.nodes[${index}]`);
    text(node.ref, `central wiki reading.nodes[${index}].ref`);
    text(node.title, `central wiki reading.nodes[${index}].title`);
  }
  for (const [index, relation] of relations.entries()) {
    record(relation, `central wiki reading.relations[${index}]`);
    text(relation.from_ref, `central wiki reading.relations[${index}].from_ref`);
    text(relation.to_ref, `central wiki reading.relations[${index}].to_ref`);
    text(relation.kind, `central wiki reading.relations[${index}].kind`);
  }
  return reading;
}

export function validateCentralWikiSelection(value) {
  const selection = record(value, 'central wiki selection');
  if (selection.schema !== CENTRAL_WIKI_SELECTION_SCHEMA) throw new TypeError(`Unsupported wiki selection schema: ${selection.schema}`);
  text(selection.world_ref, 'central wiki selection.world_ref');
  text(selection.field_ref, 'central wiki selection.field_ref');
  text(selection.projection_ref, 'central wiki selection.projection_ref');
  text(selection.presentation_ref, 'central wiki selection.presentation_ref');
  text(selection.title, 'central wiki selection.title');
  const audience = record(selection.audience, 'central wiki selection.audience');
  if (!['public', 'restricted', 'private'].includes(audience.visibility)) throw new TypeError('central wiki selection.audience.visibility must be public, restricted or private');
  const publisher = record(selection.publisher, 'central wiki selection.publisher');
  text(publisher.participant_ref, 'central wiki selection.publisher.participant_ref');
  text(publisher.identity_ref, 'central wiki selection.publisher.identity_ref');
  const spaces = record(selection.spaces ?? {}, 'central wiki selection.spaces');
  for (const [ref, mode] of Object.entries(spaces)) {
    if (!['address', 'nodes'].includes(mode)) throw new TypeError(`central wiki selection.spaces[${ref}] must be address or nodes`);
  }
  strings(selection.node_refs ?? [], 'central wiki selection.node_refs');
  if (selection.disclose_source_refs !== undefined && typeof selection.disclose_source_refs !== 'boolean') throw new TypeError('central wiki selection.disclose_source_refs must be boolean');
  return selection;
}

function selectedSpaceMode(selection, ref) {
  return selection.spaces?.[ref];
}

function bindingProvenance(reading, ref) {
  return [{ kind: 'agent-wiki', ref, source_system: 'central', revision: reading.source.revision }];
}

function nodeProvenance(reading, node, disclose) {
  const provenance = bindingProvenance(reading, node.ref);
  if (!disclose) return provenance;
  for (const path of node.source_refs ?? []) {
    provenance.push({ kind: `${sourceStanding(path)}-source`, ref: path, source_system: 'central', revision: reading.source.revision });
  }
  return provenance;
}

function nodeStanding(node) {
  const paths = node.source_refs ?? [];
  if (paths.length === 0) return 'agent-maintained';
  return paths.every((path) => sourceStanding(path) === 'human-authored') ? 'human-authored' : 'agent-maintained';
}

/**
 * Project the selected part of one or more native wiki readings into a
 * publication bundle. `readings` carries the root reading and any project
 * readings the selection addresses; the subject world's reading is the one
 * whose `world_ref` matches `selection.subject_world_ref` (default: the last
 * project reading, else the root).
 */
export function projectCentralWikiWorld(input) {
  record(input, 'central wiki projection input');
  const readings = (Array.isArray(input.readings) ? input.readings : [input.reading]).map(validateCentralWikiReading);
  if (readings.length === 0) throw new TypeError('at least one central wiki reading is required');
  const selection = validateCentralWikiSelection(input.selection);
  const publishedAt = text(input.published_at ?? new Date().toISOString(), 'published_at');
  const projectionRevision = Number.isInteger(input.projection_revision) && input.projection_revision > 0 ? input.projection_revision : 1;
  const disclose = selection.disclose_source_refs === true;
  const worldRef = selection.world_ref;

  const subjectReading = readings.find((reading) => reading.world_ref === (selection.subject_world_ref ?? readings.at(-1).world_ref)) ?? readings.at(-1);
  const readingBySpace = new Map();
  const spaceByRef = new Map();
  const nodeByRef = new Map();
  const relations = [];
  for (const reading of readings) {
    for (const space of reading.spaces) { spaceByRef.set(space.ref, space); readingBySpace.set(space.ref, reading); }
    for (const node of reading.nodes) nodeByRef.set(node.ref, { node, reading });
    for (const relation of reading.relations) relations.push({ relation, reading });
  }

  const selectedSpaceRefs = Object.keys(selection.spaces ?? {}).filter((ref) => spaceByRef.has(ref));
  const missingSpaces = Object.keys(selection.spaces ?? {}).filter((ref) => !spaceByRef.has(ref));
  if (missingSpaces.length) throw new TypeError(`selected WikiSpace not present in any reading: ${missingSpaces.join(', ')}`);
  const selectedNodeRefs = [];
  for (const ref of selection.node_refs ?? []) {
    const found = nodeByRef.get(ref);
    if (!found) throw new TypeError(`selected WikiNode not present in any reading: ${ref}`);
    const inSelectedSpace = (found.node.space_refs ?? []).some((spaceRef) => selectedSpaceMode(selection, spaceRef) === 'nodes');
    if (!inSelectedSpace) throw new TypeError(`selected WikiNode ${ref} is not inside a WikiSpace selected with mode "nodes"`);
    selectedNodeRefs.push(ref);
  }
  const projected = new Set([worldRef, ...selectedSpaceRefs, ...selectedNodeRefs]);
  // Wiki refs are world-local (every Central has a `central:wiki:root`). In a
  // shared field they are qualified by the publication world so two
  // independently grounded worlds never collide on one semantic ref.
  const hosted = (ref) => (ref === worldRef ? worldRef : `${worldRef}/${ref}`);

  const worldProvenance = readings.map((reading) => ({ kind: 'central-wiki-reading', ref: reading.source.ref, source_system: 'central', revision: reading.source.revision }));
  const locator = (ref) => [{ surface: 'web', locator: `/explore.html?ref=${encodeURIComponent(ref)}` }];

  const entries = [];
  entries.push(createExploreEntry({
    ref: worldRef,
    kind: 'central-world',
    world_ref: worldRef,
    label: selection.title,
    ...(selection.summary ? { summary: selection.summary } : {}),
    revision: subjectReading.source.revision,
    aliases: selection.aliases ?? [],
    provenance: worldProvenance,
    locators: locator(worldRef),
    meta: { register: subjectReading.register, standing: 'projection', projection_ref: selection.projection_ref },
  }));

  for (const ref of selectedSpaceRefs) {
    const space = spaceByRef.get(ref);
    const reading = readingBySpace.get(ref);
    const mode = selectedSpaceMode(selection, ref);
    const selectedHere = (space.node_refs ?? []).filter((nodeRef) => projected.has(nodeRef));
    entries.push(createExploreEntry({
      ref: hosted(ref),
      kind: 'wiki-space',
      world_ref: worldRef,
      label: space.title,
      aliases: [ref],
      summary: mode === 'nodes'
        ? `WikiSpace at the ${reading.register} register · ${selectedHere.length} of ${(space.node_refs ?? []).length} nodes selected`
        : `WikiSpace at the ${reading.register} register · addressable only; no nodes selected`,
      revision: String(space.revision ?? reading.source.revision),
      provenance: bindingProvenance(reading, ref),
      locators: locator(hosted(ref)),
      meta: { register: reading.register, standing: 'agent-maintained', disclosure: mode, local_ref: ref },
    }));
  }

  for (const ref of selectedNodeRefs) {
    const { node, reading } = nodeByRef.get(ref);
    const standing = nodeStanding(node);
    entries.push(createExploreEntry({
      ref: hosted(ref),
      kind: 'wiki-node',
      world_ref: worldRef,
      label: node.title,
      aliases: [ref],
      summary: `${node.node_type ?? 'node'} · ${standing} · revision ${node.revision ?? 1}`,
      revision: String(node.revision ?? 1),
      provenance: nodeProvenance(reading, node, disclose),
      locators: locator(hosted(ref)),
      meta: { register: reading.register, standing, node_type: node.node_type ?? null, local_ref: ref, ...(node.ql ? { ql: clone(node.ql) } : {}) },
    }));
  }

  const projectedRelations = [];
  let excludedRelations = 0;
  const seenRelation = new Set();
  const relationKinds = { 'space-child-space': 'wiki.contains', 'space-node': 'wiki.contains' };
  for (const { relation, reading } of relations) {
    const kind = relationKinds[relation.kind];
    if (!kind) { excludedRelations += 1; continue; }
    if (!projected.has(relation.from_ref) || !projected.has(relation.to_ref)) { excludedRelations += 1; continue; }
    const relationRef = `${hosted(relation.from_ref)}#${kind}#${hosted(relation.to_ref)}`;
    if (seenRelation.has(relationRef)) continue;
    seenRelation.add(relationRef);
    projectedRelations.push({
      relation_ref: relationRef,
      from: hosted(relation.from_ref),
      to: hosted(relation.to_ref),
      relation: kind,
      origin: 'wiki',
      direction: 'forward',
      provenance: [{ kind: 'wiki-relation', ref: relationRef, source_system: 'central', revision: reading.source.revision }],
    });
  }
  for (const ref of selectedSpaceRefs) {
    const relationRef = `${worldRef}#oi.world/wiki-space#${hosted(ref)}`;
    projectedRelations.push({
      relation_ref: relationRef,
      from: worldRef,
      to: hosted(ref),
      relation: 'oi.world/wiki-space',
      origin: 'projection',
      provenance: [{ kind: 'projection-relation', ref: relationRef, source_system: 'o-i', revision: `${selection.projection_ref}@${projectionRevision}` }],
    });
  }
  createExploreApplication({ entries, relations: projectedRelations });

  const bindingBase = (ref, reading) => ({ schema: 'oi.presentation-binding/v1', provenance: bindingProvenance(reading, ref) });
  const regions = [
    {
      region_ref: 'lede',
      role: 'lede',
      bindings: [{
        ...bindingBase(worldRef, subjectReading),
        binding_ref: 'lede',
        component_ref: 'oi.presentation/lede/v1',
        portable_renderer: 'oi.presentation/lede/v1',
        subject_ref: worldRef,
        props: { title: selection.title, ...(selection.summary ? { text: selection.summary } : {}) },
        fallback: { title: selection.title, ...(selection.summary ? { text: selection.summary } : {}) },
      }],
    },
    {
      region_ref: 'wiki',
      role: 'relation',
      label: 'Wiki topology',
      bindings: selectedSpaceRefs.map((ref) => {
        const space = spaceByRef.get(ref);
        const reading = readingBySpace.get(ref);
        const refs = [
          ...(space.child_space_refs ?? []).filter((child) => projected.has(child)),
          ...(space.node_refs ?? []).filter((nodeRef) => projected.has(nodeRef)),
        ].map(hosted);
        return {
          ...bindingBase(ref, reading),
          binding_ref: `space:${slug(ref)}`,
          component_ref: 'oi.presentation/wiki-reading/v1',
          portable_renderer: 'oi.presentation/wiki-reading/v1',
          subject_ref: hosted(ref),
          props: { title: space.title, text: `${ref} · ${reading.register} register`, refs },
          fallback: { title: space.title, text: ref },
        };
      }),
    },
    {
      region_ref: 'nodes',
      role: 'reading',
      label: 'Selected nodes',
      bindings: selectedNodeRefs.map((ref) => {
        const { node, reading } = nodeByRef.get(ref);
        const standing = nodeStanding(node);
        return {
          ...bindingBase(ref, reading),
          binding_ref: `node:${slug(ref)}`,
          component_ref: 'oi.presentation/reference-card/v1',
          portable_renderer: 'oi.presentation/reference-card/v1',
          subject_ref: hosted(ref),
          props: {
            title: node.title,
            text: `${node.node_type ?? 'node'} · ${standing}`,
            refs: disclose ? clone(node.source_refs ?? []) : [],
          },
          fallback: { title: node.title, text: `${node.node_type ?? 'node'} · ${standing}` },
        };
      }),
    },
  ].filter((region) => region.bindings.length > 0);

  const presentation = createWorldPresentation({
    schema: 'oi.world-presentation/v1',
    presentation_ref: selection.presentation_ref,
    world_ref: worldRef,
    revision: projectionRevision,
    title: selection.title,
    ...(selection.summary ? { summary: selection.summary } : {}),
    theme: { tokens: {} },
    regions,
    provenance: worldProvenance,
  });

  const projectionInput = {
    projection_ref: selection.projection_ref,
    projection_revision: projectionRevision,
    state: 'published',
    subject: { kind: 'central-world', ref: worldRef },
    source: { system: 'central', ref: subjectReading.source.ref, revision: subjectReading.source.revision },
    publisher_participant_ref: selection.publisher.participant_ref,
    published_at: publishedAt,
    audience: clone(selection.audience),
    provenance: [{ kind: 'human-publication', ref: selection.publisher.participant_ref, source_system: 'central', revision: subjectReading.source.revision }],
  };
  const projection = createWorldPresentationProjection({ presentation, projection: projectionInput });

  const field = createSharedField({
    field_ref: selection.field_ref,
    kind: 'explore',
    visibility: selection.audience.visibility,
    title: selection.field_title ?? selection.title,
    provenance: [{ kind: 'human-publication', ref: selection.publisher.participant_ref, source_system: 'central', revision: subjectReading.source.revision }],
  });

  const participant = createParticipant({
    participant_ref: selection.publisher.participant_ref,
    field_ref: selection.field_ref,
    identity: { kind: 'human', ref: selection.publisher.identity_ref },
    presentation: { world_ref: worldRef, ...(selection.publisher.chosen_name ? { chosen_name: selection.publisher.chosen_name } : {}) },
    provenance: { source_system: 'central', source_revision: subjectReading.source.revision, source_ref: subjectReading.source.ref },
  });

  const excluded = {
    spaces: spaceByRef.size - selectedSpaceRefs.length,
    nodes: nodeByRef.size - selectedNodeRefs.length,
    relations: excludedRelations,
  };

  return {
    schema: WORLD_PUBLICATION_SCHEMA,
    world_ref: worldRef,
    register: subjectReading.register,
    source: clone(projection.source),
    readings: readings.map((reading) => ({ register: reading.register, world_ref: reading.world_ref, source: clone(reading.source) })),
    field,
    participant,
    projection,
    presentation,
    entries,
    relations: projectedRelations,
    excluded,
  };
}

/**
 * Advance an existing publication's Projection to the next revision from a
 * fresh reading. The Projection lineage (projection_ref, presentation_ref,
 * subject) is preserved. When the native source revision moved, the new
 * revision is a *source revision* (drift made visible through
 * `source.revision` and `supersedes`); when it did not, it is a representation
 * refinement and the source revision is copied verbatim.
 */
export function reprojectCentralWikiWorld(previousBundle, input) {
  const previous = validateProjection(record(previousBundle, 'previous publication').projection);
  const next = projectCentralWikiWorld({ ...input, projection_revision: previous.projection_revision + 1 });
  if (next.projection.projection_ref !== previous.projection_ref) throw new TypeError('re-projection must keep the Projection ref');
  if (next.projection.subject.ref !== previous.subject.ref) throw new TypeError('re-projection must keep the subject world');
  if (next.presentation.presentation_ref !== worldPresentationFromProjection(previous).presentation_ref) throw new TypeError('re-projection must keep the presentation ref');
  const sourceMoved = next.projection.source.revision !== previous.source.revision;
  const projection = sourceMoved
    ? reviseProjection(previous, {
        source_revision: next.projection.source.revision,
        published_at: next.projection.published_at,
        representation: { kind: WORLD_PRESENTATION_SCHEMA, payload: next.presentation },
        provenance: [...previous.provenance, ...next.projection.provenance],
      })
    : refineWorldPresentationProjection(previous, next.presentation, {
        publisher_participant_ref: next.projection.publisher_participant_ref,
        published_at: next.projection.published_at,
        provenance: input.editor_provenance ?? [{ kind: 'human-refinement', ref: next.projection.publisher_participant_ref, source_system: 'central', revision: next.projection.source.revision }],
      });
  return { ...next, projection, presentation: worldPresentationFromProjection(projection), source_moved: sourceMoved };
}

/** Hosted reducer arguments derived from a publication bundle, in publish order. */
export function hostedPublicationArgs(bundle) {
  const value = record(bundle, 'publication bundle');
  if (value.schema !== WORLD_PUBLICATION_SCHEMA) throw new TypeError(`Unsupported publication schema: ${value.schema}`);
  const { field, participant, projection, entries, relations } = value;
  return {
    putSharedField: { fieldRef: field.field_ref, kind: field.kind, visibility: field.visibility, contractJson: JSON.stringify(field) },
    putParticipant: {
      participantRef: participant.participant_ref,
      fieldRef: participant.field_ref,
      identityKind: participant.identity.kind,
      identityRef: participant.identity.ref,
      sourceSystem: participant.provenance.source_system,
      sourceRevision: participant.provenance.source_revision,
      contractJson: JSON.stringify(participant),
    },
    putProjection: {
      projectionKey: projectionStorageKey(projection.projection_ref, projection.projection_revision),
      fieldRef: field.field_ref,
      projectionRef: projection.projection_ref,
      projectionRevision: projection.projection_revision,
      sourceRevision: projection.source.revision,
      publisherParticipantRef: projection.publisher_participant_ref,
      state: projection.state,
      contractJson: JSON.stringify(projection),
    },
    putExploreEntries: entries.map((entry) => ({
      semanticRef: entry.ref,
      fieldRef: field.field_ref,
      worldRef: entry.world_ref,
      kind: entry.kind,
      label: entry.label,
      revision: entry.revision ?? '',
      entryJson: JSON.stringify(entry),
    })),
    putExploreRelations: relations.map((relation) => ({
      relationRef: relationStorageRef(relation),
      fieldRef: field.field_ref,
      fromRef: relation.from,
      toRef: relation.to,
      relation: relation.relation,
      origin: relation.origin,
      relationJson: JSON.stringify(relation),
    })),
  };
}

/** Explore Surface seed carrying exactly the published material. */
export function exploreSeedFromPublication(bundle) {
  const value = record(bundle, 'publication bundle');
  return {
    schema: 'oi.explore-browser-seed/v1',
    entries: clone(value.entries),
    relations: clone(value.relations),
    presentations: [],
    presentation_projections: [clone(value.projection)],
  };
}

/**
 * Sentinel scan over every serialised outward payload of a publication. Returns
 * the payload names in which any sentinel appears; an honest publication returns [].
 */
export function publicationSentinelLeaks(payloads, sentinels) {
  record(payloads, 'publication payloads');
  const leaks = [];
  for (const [name, payload] of Object.entries(payloads)) {
    const serialised = typeof payload === 'string' ? payload : JSON.stringify(payload);
    for (const sentinel of strings(sentinels, 'sentinels')) {
      if (serialised.includes(sentinel)) leaks.push(`${name}:${sentinel}`);
    }
  }
  return leaks;
}
