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
 *
 * The same bundle carries the inhabited World when the owner selects it:
 * Positions from Central's `central.position.list` (`central.position-listing/v1`),
 * their occupancy and current work from AIKit's joined `aikit gateway who`
 * (`aikit.population-reading/v1` — AIKit joins Actuation and Factory; this
 * provider never re-joins them), and constellations from AIKit's own read
 * (`aikit wiki-construct inspect`, `aikit.constellation/v1`). Each is selected
 * explicitly; an occupancy detail travels only for a Position selected in
 * `occupancy` mode, and only the allow-listed fields ever leave.
 */
export const CENTRAL_WIKI_READING_SCHEMA = 'central.wiki-reading/v1';
export const CENTRAL_WIKI_SELECTION_SCHEMA = 'oi.central-wiki-selection/v1';
export const WORLD_PUBLICATION_SCHEMA = 'oi.world-publication/v1';
export const CENTRAL_POSITION_LISTING_SCHEMA = 'central.position-listing/v1';
export const CENTRAL_WORLD_POSITION_SCHEMA = 'central.world-position/v1';
export const AIKIT_POPULATION_READING_SCHEMA = 'aikit.population-reading/v1';
export const AIKIT_CONSTELLATION_SCHEMA = 'aikit.constellation/v1';
const AIKIT_PARTICIPATION = 'aikit.constellation-participation/v1';
/** Prefix of the Projection source revision when the World has more than wiki sources. */
export const WORLD_SOURCES_REVISION_PREFIX = 'oi.world-sources/v1:';
/**
 * Keys whose values in an inhabitation reading are private to the owner and
 * never leave, whatever the selection says: the AgentSession and SessionSpace
 * an occupant runs in, gateway addresses and tokens, attention text and
 * Communique bodies. Their values become default sentinels for every
 * publication built from these readings.
 */
export const WORLD_PROTECTED_KEYS = Object.freeze(['agent_session_ref', 'session_space_ref', 'gateway_address', 'address', 'ws', 'ws_token', 'token', 'attention', 'body']);
/** Shapes that must never appear in any outward payload of a World publication. */
export const WORLD_PROTECTED_PATTERNS = Object.freeze([
  { name: 'agent-session-ref', pattern: /(^|[^A-Za-z0-9])agent-session[:/]|[a-z0-9-]+:session:[0-9a-f]{8}/ },
  { name: 'gateway-address', pattern: /\bwss?:\/\/|\b(?:\d{1,3}\.){3}\d{1,3}:\d{2,5}\b/ },
  { name: 'gateway-token', pattern: /AIKIT_GATEWAY_TOKEN|\bBearer\s+\S{8,}/ },
]);
const EXPRESSIONS_PATH = /Control\/agents\/expressions(\/|$)/;

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

/** FNV-1a 64 over UTF-8, hex. Identifies a set of source revisions; it is not a secret. */
function fnv1a64(input) {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(input)) {
    hash ^= BigInt(byte);
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, '0');
}

/** A short lowercase vocabulary token (`occupied`, `none`, …) or undefined. */
function token(value) {
  return typeof value === 'string' && /^[a-z][a-z0-9-]{0,31}$/.test(value) ? value : undefined;
}

const LOOKS_LIKE_ADDRESS = /:\/\/|(?:\d{1,3}\.){3}\d{1,3}|:\d{2,5}(\/|$)|\s|@/;

/** `workcell:<label>` — a name, never a host or address. */
function workcellRef(value) {
  return typeof value === 'string' && /^workcell:[A-Za-z0-9._-]{1,64}$/.test(value) ? value : null;
}

/** `local` or `gateway:<gateway_ref>` — the gateway's name, never its address. */
function observedVia(value) {
  if (value === 'local') return value;
  if (typeof value === 'string' && /^gateway:[A-Za-z0-9._/-]{1,128}$/.test(value) && !LOOKS_LIKE_ADDRESS.test(value.slice('gateway:'.length))) return value;
  return undefined;
}

/**
 * Accept an owner document as its owner emits it: a ctrl/AIKit `--json`
 * envelope (`{ok, data}`), AIKit's `wiki-construct inspect` result
 * (`{state: "read", file, reading}`), or the bare reading. Only the reading
 * itself is kept; envelope context (local paths, session ids) never is.
 */
export function unwrapOwnerReading(document) {
  let value = record(document, 'owner reading');
  if (typeof value.ok === 'boolean') {
    if (value.ok !== true) throw new TypeError(`owner reading is a refusal: ${value.error?.code ?? 'unknown'}${value.error?.message ? ` — ${value.error.message}` : ''}`);
    value = record(value.data, 'owner reading.data');
  }
  if (value.state === 'read' && value.reading !== undefined) value = record(value.reading, 'owner reading.reading');
  return value;
}

export function validatePositionListing(value) {
  const listing = record(value, 'position listing');
  if (listing.schema !== CENTRAL_POSITION_LISTING_SCHEMA) throw new TypeError(`Unsupported position listing schema: ${listing.schema}`);
  text(listing.world_ref, 'position listing.world_ref');
  for (const key of ['positions', 'inherited']) {
    const rows = listing[key] ?? [];
    if (!Array.isArray(rows)) throw new TypeError(`position listing.${key} must be an array`);
    for (const [index, row] of rows.entries()) {
      const name = `position listing.${key}[${index}]`;
      record(row, name);
      const position = record(row.record, `${name}.record`);
      if (position.schema !== CENTRAL_WORLD_POSITION_SCHEMA) throw new TypeError(`${name}.record has unsupported schema: ${position.schema}`);
      text(position.ref, `${name}.record.ref`);
      text(position.revision, `${name}.record.revision`);
      text(position.label, `${name}.record.label`);
      const source = record(row.source, `${name}.source`);
      text(source.ref, `${name}.source.ref`);
      text(source.revision, `${name}.source.revision`);
    }
  }
  return listing;
}

export function validatePopulationReading(value) {
  const reading = record(value, 'population reading');
  if (reading.schema !== AIKIT_POPULATION_READING_SCHEMA) throw new TypeError(`Unsupported population reading schema: ${reading.schema}`);
  text(reading.project_world_ref, 'population reading.project_world_ref');
  if (!Array.isArray(reading.positions)) throw new TypeError('population reading.positions must be an array');
  for (const [index, row] of reading.positions.entries()) {
    record(row, `population reading.positions[${index}]`);
    text(row.position_ref, `population reading.positions[${index}].position_ref`);
    for (const facet of ['occupancy', 'current_work', 'communiques']) {
      if (row[facet] !== undefined && row[facet] !== null) record(row[facet], `population reading.positions[${index}].${facet}`);
    }
  }
  if (reading.remotes !== undefined && !Array.isArray(reading.remotes)) throw new TypeError('population reading.remotes must be an array');
  return reading;
}

export function validateConstellationReading(value) {
  const reading = record(value, 'constellation reading');
  if (reading.schema !== AIKIT_CONSTELLATION_SCHEMA) throw new TypeError(`Unsupported constellation reading schema: ${reading.schema}`);
  const frame = record(reading.frame, 'constellation reading.frame');
  text(frame.ref, 'constellation reading.frame.ref');
  if (!Number.isSafeInteger(frame.revision) || frame.revision < 1) throw new TypeError('constellation reading.frame.revision must be an integer >= 1');
  if (!Array.isArray(frame.constellations) || frame.constellations.length !== 1) throw new TypeError('constellation reading.frame must hold exactly one constellation');
  const members = frame.constellations[0].members ?? [];
  if (!Array.isArray(members)) throw new TypeError('constellation reading members must be an array');
  for (const [index, member] of members.entries()) {
    record(member, `constellation member[${index}]`);
    text(member.ref, `constellation member[${index}].ref`);
    const participation = record(member[AIKIT_PARTICIPATION], `constellation member[${index}].participation`);
    text(participation.participation_ref, `constellation member[${index}].participation.participation_ref`);
  }
  const construction = record(reading.construction ?? frame[AIKIT_CONSTELLATION_SCHEMA], 'constellation reading.construction');
  text(construction.title, 'constellation reading.construction.title');
  if (reading.relations !== undefined && !Array.isArray(reading.relations)) throw new TypeError('constellation reading.relations must be an array');
  return reading;
}

/**
 * Sort owner documents by the schema they carry. Wiki readings may be many
 * (root + project); one Position listing, one population reading and any
 * number of constellation readings.
 */
export function classifyWorldReadings(documents) {
  if (!Array.isArray(documents)) throw new TypeError('readings must be an array');
  const sorted = { wiki: [], positions: undefined, population: undefined, constellations: [] };
  for (const [index, document] of documents.entries()) {
    const reading = unwrapOwnerReading(document);
    switch (reading.schema) {
      case CENTRAL_WIKI_READING_SCHEMA: sorted.wiki.push(validateCentralWikiReading(reading)); break;
      case CENTRAL_POSITION_LISTING_SCHEMA:
        if (sorted.positions) throw new TypeError('more than one position listing was supplied');
        sorted.positions = validatePositionListing(reading);
        break;
      case AIKIT_POPULATION_READING_SCHEMA:
        if (sorted.population) throw new TypeError('more than one population reading was supplied');
        sorted.population = validatePopulationReading(reading);
        break;
      case AIKIT_CONSTELLATION_SCHEMA: {
        const constellation = validateConstellationReading(reading);
        if (sorted.constellations.some((held) => held.frame.ref === constellation.frame.ref)) throw new TypeError(`constellation ${constellation.frame.ref} was supplied twice`);
        sorted.constellations.push(constellation);
        break;
      }
      default: throw new TypeError(`Unsupported reading schema at readings[${index}]: ${reading.schema}`);
    }
  }
  return sorted;
}

/**
 * The owner's private inhabitation material, as sentinels: every value under a
 * protected key in the non-wiki readings, and every Position `purpose_ref`
 * naming ground under `Control/agents/expressions`. Values are labelled by the
 * key they came from so a refusal can name the kind without echoing it.
 */
export function worldProtectedSentinels(documents) {
  const found = new Map();
  const protectedKeys = new Set(WORLD_PROTECTED_KEYS);
  const visit = (value, key) => {
    if (typeof value === 'string') {
      if (protectedKeys.has(key) && value.trim().length >= 6) found.set(value, key);
      else if (key === 'purpose_ref' && EXPRESSIONS_PATH.test(value)) found.set(value, key);
      return;
    }
    if (Array.isArray(value)) { for (const item of value) visit(item, key); return; }
    if (value && typeof value === 'object') for (const [child, item] of Object.entries(value)) visit(item, child);
  };
  for (const document of documents ?? []) {
    let reading;
    try { reading = unwrapOwnerReading(document); } catch { continue; }
    if (reading.schema !== CENTRAL_WIKI_READING_SCHEMA) visit(reading, '');
  }
  return [...found.entries()].map(([value, key]) => ({ key, value }));
}

/**
 * Protected-material scan over every serialised outward payload: the default
 * sentinels derived from the readings, the protected patterns, and any extra
 * sentinels the publisher names. Returns `payload:label` — never the value.
 */
export function worldPublicationLeaks(payloads, documents, extraSentinels = []) {
  record(payloads, 'publication payloads');
  const sentinels = [...worldProtectedSentinels(documents), ...strings(extraSentinels, 'sentinels').map((value) => ({ key: value, value }))];
  const leaks = [];
  for (const [name, payload] of Object.entries(payloads)) {
    const serialised = typeof payload === 'string' ? payload : JSON.stringify(payload);
    for (const { key, value } of sentinels) if (serialised.includes(value)) leaks.push(`${name}:${key}`);
    for (const { name: label, pattern } of WORLD_PROTECTED_PATTERNS) if (pattern.test(serialised)) leaks.push(`${name}:${label}`);
  }
  return [...new Set(leaks)];
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
  const positions = record(selection.positions ?? {}, 'central wiki selection.positions');
  for (const [ref, mode] of Object.entries(positions)) {
    if (!['address', 'occupancy'].includes(mode)) throw new TypeError(`central wiki selection.positions[${ref}] must be address or occupancy`);
  }
  strings(selection.constellations ?? [], 'central wiki selection.constellations');
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
 * Project the selected part of one or more native readings into a publication
 * bundle. `readings` carries the root wiki reading and any project readings
 * the selection addresses, and — when the selection names Positions or
 * constellations — the Position listing, the population reading and the
 * constellation readings (each recognised by its schema, bare or in its
 * owner's `--json` envelope). The subject world's wiki reading is the one
 * whose `world_ref` matches `selection.subject_world_ref` (default: the last
 * project reading, else the root).
 */
export function projectCentralWikiWorld(input) {
  record(input, 'central wiki projection input');
  const documents = Array.isArray(input.readings) ? input.readings : [input.reading];
  const sorted = classifyWorldReadings(documents);
  const readings = sorted.wiki;
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

  // Positions: an address is selected explicitly; occupancy travels only for a
  // Position selected in "occupancy" mode, and only its allow-listed fields.
  const positionModes = selection.positions ?? {};
  const selectedPositionRefs = Object.keys(positionModes);
  if (selectedPositionRefs.length && !sorted.positions) throw new TypeError('selected Positions need a central.position-listing/v1 reading (ctrl --json action run central.position.list)');
  const positionRows = new Map();
  for (const row of sorted.positions?.positions ?? []) positionRows.set(row.record.ref, { ...row, inherited: false });
  for (const row of sorted.positions?.inherited ?? []) if (!positionRows.has(row.record.ref)) positionRows.set(row.record.ref, { ...row, inherited: true });
  for (const ref of selectedPositionRefs) if (!positionRows.has(ref)) throw new TypeError(`selected Position not present in the position listing: ${ref}`);
  const occupancyRefs = selectedPositionRefs.filter((ref) => positionModes[ref] === 'occupancy');
  if (occupancyRefs.length && !sorted.population) throw new TypeError('Positions selected with mode "occupancy" need an aikit.population-reading/v1 reading (aikit gateway who --json)');
  if (occupancyRefs.length && sorted.positions && sorted.population.project_world_ref !== sorted.positions.world_ref) {
    throw new TypeError(`the population reading (${sorted.population.project_world_ref}) and the position listing (${sorted.positions.world_ref}) describe different worlds`);
  }
  const populationRow = (ref) => {
    const row = sorted.population.positions.find((candidate) => candidate.position_ref === ref);
    if (!row) throw new TypeError(`Position ${ref} is selected with mode "occupancy" but the population reading carries no row for it`);
    return row;
  };

  // Constellations: AIKit's own reading of each selected WikiFrame.
  const constellationByRef = new Map(sorted.constellations.map((reading) => [reading.frame.ref, reading]));
  const selectedConstellationRefs = [...new Set(selection.constellations ?? [])];
  for (const ref of selectedConstellationRefs) if (!constellationByRef.has(ref)) throw new TypeError(`selected constellation not present in any AIKit constellation reading: ${ref}`);

  const projected = new Set([worldRef, ...selectedSpaceRefs, ...selectedNodeRefs]);
  // Wiki refs are world-local (every Central has a `central:wiki:root`). In a
  // shared field they are qualified by the publication world so two
  // independently grounded worlds never collide on one semantic ref.
  const hosted = (ref) => (ref === worldRef ? worldRef : `${worldRef}/${ref}`);
  const locator = (ref) => [{ surface: 'web', locator: `/explore.html?ref=${encodeURIComponent(ref)}` }];
  const projectionRelationProvenance = (relationRef) => [{ kind: 'projection-relation', ref: relationRef, source_system: 'o-i', revision: `${selection.projection_ref}@${projectionRevision}` }];

  // The occupancy material that travels, per occupancy-mode Position, and the
  // attested Position → work relation. Nothing else from a population row does.
  const workTargets = new Set([...selectedNodeRefs, ...selectedConstellationRefs]);
  const occupancyByRef = new Map();
  const worksOnByRef = new Map();
  for (const ref of occupancyRefs) {
    const row = populationRow(ref);
    const occupancy = row.occupancy ?? {};
    const via = observedVia(occupancy.observed_via);
    occupancyByRef.set(ref, {
      occupancy: {
        state: token(occupancy.state) ?? 'unavailable',
        generation_ordinal: Number.isSafeInteger(occupancy.generation_ordinal) ? occupancy.generation_ordinal : null,
        workcell_ref: workcellRef(occupancy.workcell_ref),
        ...(via ? { observed_via: via } : {}),
      },
      current_work: { outcome: token(row.current_work?.outcome) ?? 'unavailable' },
      communiques: { undelivered: Number.isSafeInteger(row.communiques?.undelivered) && row.communiques.undelivered >= 0 ? row.communiques.undelivered : null },
    });
    const work = row.current_work ?? {};
    if (work.outcome === 'one' && typeof work.work_ref === 'string' && workTargets.has(work.work_ref) && typeof work.custody_ref === 'string' && work.custody_ref.trim() !== '') {
      worksOnByRef.set(ref, { work_ref: work.work_ref, custody_ref: work.custody_ref });
    }
  }

  // Every source this publication stands on, with its revision. The wiki
  // readings keep the owner's own revision; the Position listing, the
  // population and the constellations contribute a revision derived only
  // from what this publication carries of them, so an unselected Position
  // changing — or a never-published field such as attention — moves nothing.
  const sources = readings.map((reading) => ({ kind: 'central-wiki-reading', ref: reading.source.ref, source_system: 'central', revision: reading.source.revision }));
  if (selectedPositionRefs.length) {
    const basis = [...selectedPositionRefs].sort().map((ref) => [ref, positionRows.get(ref).record.revision, positionRows.get(ref).source.revision]);
    sources.push({ kind: 'central-position-listing', ref: `central:positions:${sorted.positions.world_ref}`, source_system: 'central', revision: `positions:${fnv1a64(JSON.stringify(basis))}` });
  }
  if (occupancyRefs.length) {
    const basis = [...occupancyRefs].sort().map((ref) => [ref, occupancyByRef.get(ref), worksOnByRef.get(ref) ?? null]);
    sources.push({ kind: 'aikit-population-reading', ref: `aikit:population:${sorted.population.project_world_ref}`, source_system: 'ai-kit', revision: `population:${fnv1a64(JSON.stringify(basis))}` });
  }
  for (const ref of selectedConstellationRefs) sources.push({ kind: 'aikit-constellation', ref, source_system: 'ai-kit', revision: String(constellationByRef.get(ref).frame.revision) });
  const composite = sources.length > readings.length;
  const sourceRevision = composite
    ? `${WORLD_SOURCES_REVISION_PREFIX}${fnv1a64(JSON.stringify(sources.map((source) => [source.kind, source.ref, source.revision])))}`
    : subjectReading.source.revision;
  const worldProvenance = sources.map(clone);

  const entries = [];
  entries.push(createExploreEntry({
    ref: worldRef,
    kind: 'central-world',
    world_ref: worldRef,
    label: selection.title,
    ...(selection.summary ? { summary: selection.summary } : {}),
    revision: sourceRevision,
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

  const constellationProvenance = (ref) => [{ kind: 'aikit-constellation', ref, source_system: 'ai-kit', revision: String(constellationByRef.get(ref).frame.revision) }];
  const participationsOf = (ref) => constellationByRef.get(ref).frame.constellations[0].members ?? [];
  for (const ref of selectedConstellationRefs) {
    const reading = constellationByRef.get(ref);
    const construction = reading.construction ?? reading.frame[AIKIT_CONSTELLATION_SCHEMA];
    const members = participationsOf(ref);
    const selectedMembers = members.filter((member) => projected.has(member.ref));
    entries.push(createExploreEntry({
      ref: hosted(ref),
      kind: 'constellation',
      world_ref: worldRef,
      label: construction.title,
      aliases: [ref],
      summary: `constellation · ${members.length} participation${members.length === 1 ? '' : 's'} · ${selectedMembers.length} in this World · revision ${reading.frame.revision}`,
      revision: String(reading.frame.revision),
      provenance: constellationProvenance(ref),
      locators: locator(hosted(ref)),
      meta: { standing: 'aikit-constellation', native_owner: 'ai-kit', local_ref: ref, participations: members.length },
    }));
  }

  const positionProvenance = (ref) => [{ kind: 'central-position', ref, source_system: 'central', revision: positionRows.get(ref).source.revision }];
  const positionText = (ref) => {
    const { record: position } = positionRows.get(ref);
    const parts = [position.handle, position.role_ref].filter((part) => typeof part === 'string' && part);
    const occupancy = occupancyByRef.get(ref)?.occupancy;
    if (occupancy) {
      const where = [occupancy.generation_ordinal !== null ? `generation #${occupancy.generation_ordinal}` : undefined, occupancy.workcell_ref ?? undefined].filter(Boolean).join(', ');
      parts.push(`${occupancy.state}${where ? ` (${where})` : ''}`);
    }
    return parts.join(' · ') || 'World Position';
  };
  for (const ref of selectedPositionRefs) {
    const { record: position, inherited } = positionRows.get(ref);
    const mode = positionModes[ref];
    const occupancy = occupancyByRef.get(ref);
    entries.push(createExploreEntry({
      ref: hosted(ref),
      kind: 'world-position',
      world_ref: worldRef,
      label: position.label,
      aliases: [ref, ...(typeof position.handle === 'string' && position.handle ? [position.handle] : [])],
      summary: `World Position · ${positionText(ref)}`,
      revision: position.revision,
      provenance: [
        ...positionProvenance(ref),
        ...(occupancy ? [clone(sources.find((source) => source.kind === 'aikit-population-reading'))] : []),
      ],
      locators: locator(hosted(ref)),
      meta: {
        standing: 'world-position',
        disclosure: mode,
        local_ref: ref,
        role_ref: position.role_ref ?? null,
        handle: position.handle ?? null,
        label: position.label,
        enclosing_world_ref: position.enclosing_world_ref ?? null,
        inherited,
        ...(occupancy ? clone(occupancy) : {}),
      },
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
      provenance: projectionRelationProvenance(relationRef),
    });
  }
  for (const ref of selectedConstellationRefs) {
    const relationRef = `${worldRef}#oi.world/constellation#${hosted(ref)}`;
    projectedRelations.push({ relation_ref: relationRef, from: worldRef, to: hosted(ref), relation: 'oi.world/constellation', origin: 'projection', provenance: projectionRelationProvenance(relationRef) });
    // A participation becomes a relation only when both the constellation and
    // the participating wiki node were selected; its note, sources and the
    // constellation's own participation-to-participation edges stay home.
    for (const member of participationsOf(ref)) {
      if (!selectedNodeRefs.includes(member.ref)) { excludedRelations += 1; continue; }
      const participation = member[AIKIT_PARTICIPATION];
      const relationRef = `${hosted(ref)}#aikit.constellation/participation#${hosted(member.ref)}#${participation.participation_ref}`;
      if (seenRelation.has(relationRef)) continue;
      seenRelation.add(relationRef);
      projectedRelations.push({
        relation_ref: relationRef,
        from: hosted(ref),
        to: hosted(member.ref),
        relation: 'aikit.constellation/participation',
        origin: 'aikit-knowledge',
        direction: 'forward',
        participation: {
          participation_ref: participation.participation_ref,
          role_ref: typeof participation.role_ref === 'string' ? participation.role_ref : null,
          position: Number.isSafeInteger(member.position) ? member.position : null,
          conjugate: member.conjugate === true,
        },
        provenance: [{ kind: 'aikit-participation', ref: participation.participation_ref, source_system: 'ai-kit', revision: String(constellationByRef.get(ref).frame.revision) }],
      });
    }
    excludedRelations += (constellationByRef.get(ref).relations ?? []).length;
  }
  for (const ref of selectedPositionRefs) {
    const relationRef = `${worldRef}#oi.world/position#${hosted(ref)}`;
    projectedRelations.push({ relation_ref: relationRef, from: worldRef, to: hosted(ref), relation: 'oi.world/position', origin: 'projection', provenance: projectionRelationProvenance(relationRef) });
  }
  for (const ref of selectedPositionRefs) {
    const work = worksOnByRef.get(ref);
    if (!work) continue;
    const relationRef = `${hosted(ref)}#oi.world/works-on#${hosted(work.work_ref)}`;
    projectedRelations.push({
      relation_ref: relationRef,
      from: hosted(ref),
      to: hosted(work.work_ref),
      relation: 'oi.world/works-on',
      origin: 'projection',
      provenance: [
        { kind: 'factory-custody', ref: work.custody_ref, source_system: 'factory', revision: sources.find((source) => source.kind === 'aikit-population-reading').revision },
        ...projectionRelationProvenance(relationRef),
      ],
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
    {
      region_ref: 'constellations',
      role: 'relation',
      label: 'Constellations',
      bindings: selectedConstellationRefs.map((ref) => {
        const reading = constellationByRef.get(ref);
        const title = (reading.construction ?? reading.frame[AIKIT_CONSTELLATION_SCHEMA]).title;
        const members = participationsOf(ref);
        const text = `constellation · ${members.length} participation${members.length === 1 ? '' : 's'} · revision ${reading.frame.revision}`;
        return {
          schema: 'oi.presentation-binding/v1',
          provenance: constellationProvenance(ref),
          binding_ref: `constellation:${slug(ref)}`,
          component_ref: 'oi.presentation/reference-card/v1',
          portable_renderer: 'oi.presentation/reference-card/v1',
          subject_ref: hosted(ref),
          props: { title, text, refs: [...new Set(members.filter((member) => selectedNodeRefs.includes(member.ref)).map((member) => hosted(member.ref)))] },
          fallback: { title, text },
        };
      }),
    },
    {
      region_ref: 'positions',
      role: 'relation',
      label: 'Positions',
      bindings: selectedPositionRefs.map((ref) => {
        const { record: position } = positionRows.get(ref);
        const text = positionText(ref);
        const work = worksOnByRef.get(ref);
        return {
          schema: 'oi.presentation-binding/v1',
          provenance: positionProvenance(ref),
          binding_ref: `position:${slug(ref)}`,
          component_ref: 'oi.presentation/reference-card/v1',
          portable_renderer: 'oi.presentation/reference-card/v1',
          subject_ref: hosted(ref),
          props: { title: position.label, text, refs: work ? [hosted(work.work_ref)] : [] },
          fallback: { title: position.label, text },
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
    source: { system: 'central', ref: subjectReading.source.ref, revision: sourceRevision },
    publisher_participant_ref: selection.publisher.participant_ref,
    published_at: publishedAt,
    audience: clone(selection.audience),
    provenance: [{ kind: 'human-publication', ref: selection.publisher.participant_ref, source_system: 'central', revision: sourceRevision }],
  };
  const projection = createWorldPresentationProjection({ presentation, projection: projectionInput });

  const field = createSharedField({
    field_ref: selection.field_ref,
    kind: 'explore',
    visibility: selection.audience.visibility,
    title: selection.field_title ?? selection.title,
    provenance: [{ kind: 'human-publication', ref: selection.publisher.participant_ref, source_system: 'central', revision: sourceRevision }],
  });

  const participant = createParticipant({
    participant_ref: selection.publisher.participant_ref,
    field_ref: selection.field_ref,
    identity: { kind: 'human', ref: selection.publisher.identity_ref },
    presentation: { world_ref: worldRef, ...(selection.publisher.chosen_name ? { chosen_name: selection.publisher.chosen_name } : {}) },
    provenance: { source_system: 'central', source_revision: sourceRevision, source_ref: subjectReading.source.ref },
  });

  const excluded = {
    spaces: spaceByRef.size - selectedSpaceRefs.length,
    nodes: nodeByRef.size - selectedNodeRefs.length,
    relations: excludedRelations,
    ...(sorted.positions ? { positions: positionRows.size - selectedPositionRefs.length } : {}),
    ...(sorted.constellations.length ? { constellations: sorted.constellations.length - selectedConstellationRefs.length } : {}),
  };

  const bundle = {
    schema: WORLD_PUBLICATION_SCHEMA,
    world_ref: worldRef,
    register: subjectReading.register,
    source: clone(projection.source),
    readings: readings.map((reading) => ({ register: reading.register, world_ref: reading.world_ref, source: clone(reading.source) })),
    sources: sources.map(clone),
    field,
    participant,
    projection,
    presentation,
    entries,
    relations: projectedRelations,
    excluded,
  };
  // The allow-lists above are the guard; this is the proof. A bundle that
  // would carry any protected inhabitation value or shape is refused whole.
  const leaks = worldPublicationLeaks({ bundle, hosted_args: hostedPublicationArgs(bundle), explore_seed: exploreSeedFromPublication(bundle) }, documents);
  if (leaks.length) throw new TypeError(`world publication would carry protected inhabitation material (${leaks.join(', ')}); nothing was built`);
  return bundle;
}

/**
 * Advance an existing publication's Projection to the next revision from a
 * fresh reading. The Projection lineage (projection_ref, presentation_ref,
 * subject) is preserved. When the source revision moved — for a World with
 * Positions or constellations that is any of its sources: a wiki reading, the
 * selected Positions, the occupancy and custody it carries, a selected
 * constellation — the new revision is a *source revision* (drift made visible
 * through `source.revision` and `supersedes`); when it did not, it is a
 * representation refinement and the source revision is copied verbatim.
 */
export function reprojectCentralWikiWorld(previousBundle, input) {
  const previous = validateProjection(record(previousBundle, 'previous publication').projection);
  const next = projectCentralWikiWorld({ ...input, projection_revision: previous.projection_revision + 1 });
  if (next.projection.projection_ref !== previous.projection_ref) throw new TypeError('re-projection must keep the Projection ref');
  if (next.projection.subject.ref !== previous.subject.ref) throw new TypeError('re-projection must keep the subject world');
  if (next.presentation.presentation_ref !== worldPresentationFromProjection(previous).presentation_ref) throw new TypeError('re-projection must keep the presentation ref');
  const key = (source) => `${source.kind}\u0000${source.ref}`;
  const before = new Map((Array.isArray(previousBundle.sources) ? previousBundle.sources : []).map((source) => [key(source), source.revision]));
  const after = new Map(next.sources.map((source) => [key(source), source.revision]));
  const movedSources = Array.isArray(previousBundle.sources)
    ? [...new Set([...before.keys(), ...after.keys()])].filter((id) => before.get(id) !== after.get(id)).map((id) => { const [kind, ref] = id.split('\u0000'); return { kind, ref, from: before.get(id) ?? null, to: after.get(id) ?? null }; })
    : [];
  // A World with more than wiki sources carries a composite source revision
  // over every source (wiki readings, Positions, population, constellations),
  // so comparing it compares each of them; a wiki-only publication keeps its
  // subject wiki revision exactly as before. `moved_sources` names which moved.
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
  return { ...next, projection, presentation: worldPresentationFromProjection(projection), source_moved: sourceMoved, moved_sources: movedSources };
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
