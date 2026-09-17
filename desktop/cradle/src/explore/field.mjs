/**
 * The open field as the desktop reads it — pure readings over the O:I-owned
 * field client's `oi.shared-field.snapshot/v1` and `oi.shared-field.reading/v1`
 * (SHARED-FIELD-DESKTOP §2, §3). Nothing here invents a neighbour, a
 * relation or a standing: entries, relations, projections, participants and
 * the caller's own authority/watch rows arrive from the client verbatim and
 * are only grouped, ranked and laid out for presentation.
 *
 * Entry search runs through the SAME surface-neutral Explore read model the
 * web and structured agents consume (`shared-field/explore-surface.mjs`), so
 * a human result and an agent result carry the same stable refs, eligible
 * presentation forms and field membership. Participant-Beings and
 * SharedFields are desktop presentations of the same snapshot rows, ranked
 * alongside — not a second index over the entries.
 *
 * Language-neutral so the desktop can unit-test search, grouping, primary
 * projection choice and the constellation layout outside a browser.
 */

import { createExploreSurfaceModelFromHostedSnapshot } from '../../../../shared-field/spacetimedb-explore-surface.mjs';
import { createExploreApplication } from '../../../../shared-field/explore.mjs';

const normalise = (value) => String(value ?? '').toLowerCase();

/** Group the field by projected world; participants present as Beings. */
export function fieldReading(snapshot) {
  if (!snapshot || snapshot.state === 'unavailable') return { state: 'unavailable', detail: snapshot?.detail ?? 'the field is unavailable', worlds: [], beings: [], fields: [], relations: [], counts: { entries: 0, worlds: 0, beings: 0 } };
  const entries = Array.isArray(snapshot.entries) ? snapshot.entries : [];
  const byWorld = new Map();
  for (const entry of entries) {
    const world = byWorld.get(entry.world_ref) ?? { world_ref: entry.world_ref, label: entry.world_ref, root: null, entries: [] };
    if (entry.kind === 'central-world' && entry.ref === entry.world_ref) { world.label = entry.label; world.root = entry; }
    else world.entries.push(entry);
    byWorld.set(entry.world_ref, world);
  }
  const worlds = [...byWorld.values()].map((world) => ({ ...world, label: world.root ? world.root.label : world.entries[0]?.label ?? world.world_ref }));
  const beings = (Array.isArray(snapshot.participants) ? snapshot.participants : []).map((participant) => ({ ref: participant.participant_ref, kind: 'participant', label: participant.presentation?.chosen_name ?? participant.participant_ref, world_ref: participant.presentation?.world_ref ?? null, field_ref: participant.field_ref, identity: participant.identity, participant }));
  return { state: 'available', target: snapshot.target, status: snapshot.status, worlds, beings, fields: Array.isArray(snapshot.fields) ? snapshot.fields : [], relations: Array.isArray(snapshot.relations) ? snapshot.relations : [], counts: { entries: entries.length, worlds: worlds.length, beings: beings.length } };
}

function score(query, texts) {
  const q = normalise(query).trim();
  if (!q) return 1;
  let best = 0;
  for (const [index, raw] of texts.entries()) {
    const text = normalise(raw);
    if (!text) continue;
    if (text === q) best = Math.max(best, 130 - index);
    else if (text.startsWith(q)) best = Math.max(best, 100 - index);
    else if (text.includes(q)) best = Math.max(best, 80 - index);
  }
  if (best === 0 && q.includes(' ')) {
    const words = q.split(/\s+/).filter(Boolean);
    const joined = texts.map(normalise).join('\n');
    if (words.every((word) => joined.includes(word))) best = 40;
  }
  return best;
}

// The shared read model is derived once per snapshot; queries reuse it. When
// presentation resolution cannot be built, the fault is disclosed — search
// degrades to plain entry addressability instead of failing the field.
let modelFault = undefined;
export function searchModelFault() {
  return modelFault;
}
const modelCache = new WeakMap();
function fieldModel(snapshot) {
  let model = modelCache.get(snapshot);
  if (model === undefined) {
    try {
      model = createExploreSurfaceModelFromHostedSnapshot(snapshot);
    } catch (error) {
      modelFault = String(error instanceof Error ? error.message : error);
      throw error;
    }
    modelCache.set(snapshot, model);
  }
  return model;
}

/** Rank the field's addressable subjects for a query: entries, Beings, fields. An empty query is the field itself. */
export function searchField(snapshot, query) {
  const reading = fieldReading(snapshot);
  if (reading.state !== 'available') return [];
  const worldLabel = new Map(reading.worlds.map((world) => [world.world_ref, world.label]));
  const results = [];
  // Entries through the shared application/read model: same refs, same
  // ranking family, same eligible-presentation reveal the web and agents see.
  let entryRows = [];
  try {
    entryRows = fieldModel(snapshot).search(query, { limit: 64 });
  } catch {
    // A presentation payload the model refuses degrades to the plain entry
    // index — addressability is never gated on presentation resolution.
    try {
      entryRows = createExploreApplication({
        entries: Array.isArray(snapshot?.entries) ? snapshot.entries : [],
        relations: Array.isArray(snapshot?.relations) ? snapshot.relations : [],
        ...(snapshot?.entry_fields && typeof snapshot.entry_fields === 'object'
          ? { membership: { entry_fields: snapshot.entry_fields, relation_fields: snapshot.relation_fields ?? {} } }
          : {}),
      }).search(query, { limit: 64 });
    } catch {
      entryRows = [];
    }
  }
  for (const result of entryRows) {
    results.push({
      kind: 'entry',
      ref: result.ref,
      label: result.label,
      summary: result.summary,
      subject_kind: result.kind,
      world_ref: result.world_ref,
      world_label: worldLabel.get(result.world_ref) ?? result.world_ref,
      ...(result.presentations ? { presentations: result.presentations } : {}),
      ...(result.field_refs ? { field_refs: result.field_refs } : {}),
      score: result.score,
    });
  }
  for (const being of reading.beings) {
    const s = score(query, [being.label, being.ref, being.identity?.ref, 'participant', 'being']);
    if (s > 0) results.push({ kind: 'being', ref: being.ref, label: being.label, summary: `${being.identity?.kind ?? 'participant'} · ${being.field_ref}`, subject_kind: 'participant', world_ref: being.world_ref, world_label: being.world_ref ?? being.field_ref, being, score: s });
  }
  for (const field of reading.fields) {
    const s = score(query, [field.title, field.field_ref, field.kind, 'field', 'shared field']);
    if (s > 0) results.push({ kind: 'field', ref: field.field_ref, label: field.title ?? field.field_ref, summary: `${field.kind} · ${field.visibility}`, subject_kind: 'shared-field', world_ref: null, world_label: 'SharedField', field, score: s });
  }
  return results.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
}

/** The relations that touch one ref, with the other endpoint named. */
export function relationsOf(relations, ref) {
  return (Array.isArray(relations) ? relations : []).filter((relation) => relation.from === ref || relation.to === ref).map((relation) => ({ relation: relation.relation, origin: relation.origin, direction: relation.from === ref ? 'out' : 'in', other: relation.from === ref ? relation.to : relation.from }));
}

/**
 * The projection to present for one hosted reading: the projection the
 * entry names as its current one, else the latest whose subject is the
 * entry itself, else the projection of the entry's world. Never invents one.
 */
export function primaryProjection(reading) {
  if (!reading || reading.state !== 'hosted') return null;
  const projections = Array.isArray(reading.projections) ? reading.projections : [];
  const entry = reading.entry;
  const named = entry?.meta?.projection_ref ?? entry?.projection_ref;
  const latest = (rows) => rows.slice().sort((a, b) => b.projection_revision - a.projection_revision)[0] ?? null;
  return latest(projections.filter((projection) => named && projection.projection_ref === named))
    ?? latest(projections.filter((projection) => projection.subject?.ref === entry?.ref))
    ?? latest(projections.filter((projection) => projection.subject?.ref === entry?.world_ref))
    ?? latest(projections);
}

/**
 * A deterministic constellation: worlds on a ring around the centre, each
 * world's entries on a small ring around it (golden-angle spread), Beings
 * along the lower arc. Positions are presentation only; distance carries
 * no standing.
 */
export function constellation(reading, extent) {
  const width = Math.max(240, extent?.width ?? 800);
  const height = Math.max(200, extent?.height ?? 520);
  const positions = {};
  if (!reading || reading.state !== 'available') return positions;
  const worlds = reading.worlds;
  const beingsRow = reading.beings.length ? 44 : 0;
  const fieldHeight = height - beingsRow;
  const golden = Math.PI * (3 - Math.sqrt(5));
  // Each world takes a share of the width proportional to its size, so a
  // dense world is not crushed beside a sparse one; its entries sit on a ring
  // whose radius grows with their count, bounded by the world's own cell.
  const weights = worlds.map((world) => 1 + Math.sqrt(world.entries.length));
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  let cursor = 0;
  worlds.forEach((world, wi) => {
    const cell = (weights[wi] / total) * width;
    const wx = cursor + cell / 2;
    const wy = fieldHeight * 0.5;
    cursor += cell;
    if (world.root) positions[world.root.ref] = { x: wx, y: wy, world: true };
    const count = world.entries.length;
    const radius = Math.min(cell * 0.42, fieldHeight * 0.38, Math.max(44, 26 + 15 * count));
    world.entries.forEach((entry, ei) => {
      // Two rings for busy worlds so labels have room; golden-angle spread keeps neighbours apart.
      const ring = count > 6 && ei % 2 ? 0.62 : 1;
      const a = -Math.PI / 2 + ei * golden;
      positions[entry.ref] = { x: wx + Math.cos(a) * radius * ring, y: wy + Math.sin(a) * radius * ring, world: false };
    });
  });
  reading.beings.forEach((being, bi) => {
    const t = (bi + 1) / (reading.beings.length + 1);
    positions[being.ref] = { x: width * 0.2 + t * width * 0.6, y: height - 22, world: false, being: true };
  });
  return positions;
}

/** Whether the caller may Watch or already Watches this entry, from the client's own rows. */
export function watchStanding(reading) {
  if (!reading || reading.state !== 'hosted') return { available: false, reason: 'no hosted reading' };
  const authority = (reading.my_authority ?? []).find((row) => !row.revoked && ['observer', 'contact', 'contributor'].includes(row.role));
  const watch = (reading.my_watches ?? []).find((row) => row.target_ref === reading.entry.ref);
  if (watch) return { available: true, watching: watch.state === 'active', watch, participant_ref: authority?.participant_ref ?? watch.watcher_participant_ref ?? null, field_ref: reading.field_ref };
  if (!reading.field_ref) return { available: false, reason: 'the entry names no SharedField' };
  if (!authority) return { available: false, reason: `no authority in ${reading.field_ref} for this identity` };
  return { available: true, watching: false, participant_ref: authority.participant_ref, field_ref: reading.field_ref };
}

/** The Watch target kind the contract admits for a hosted entry kind. */
export function watchTargetKind(entryKind) {
  if (entryKind === 'central-world') return 'world';
  if (entryKind === 'wiki-space' || entryKind === 'wiki-node') return entryKind;
  if (entryKind === 'participant') return 'agent';
  return 'object';
}
