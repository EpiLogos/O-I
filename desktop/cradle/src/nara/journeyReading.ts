/** A journey launched as Reading (manual §24.4: "Launch a journey as Reading and it opens as an Expression: its cards and lines laid out in
 * a scene you can walk, with each card's codon and the entries it is linked to. Your writing stays in the journey's flow, which remains
 * where you write").
 *
 * The journey is read through its owner (`nara_journey` read: QL's `nara.journey.read`, kept on its Flow page, journey.ts) and composed as
 * one `oi.expression/v1` document — one Reading scene, an entity per card at its position, an entity per line cast, an entity per entry a
 * card is linked to, and a relation for each link — which the Expression owner opens (kernel `expression`): the Expression is a
 * presentation, never a second journey store, and every fact names the reading it came from. It is ported, not recreated:
 *   - the document from an owner's reading, entity per node, relation per edge, expression-local refs: contributions/factory/run-
 *     expression.ts composeRunExpression (:84), localSuffix (:52);
 *   - the entities' presentation parameters (glyph, x, y, scale) and the QL subject binding: instrument/nara-expression-adapter.ts
 *     naraCueExpression (:103);
 *   - opened once, then what a later reading adds through the owner's own edit (entity_add, subject_bind), never a second open:
 *     contributions/factory/live/liveObjects.ts ensureExpression (:191) and syncRunExpression (:168).
 * Launching again after a draw adds only the new cards, lines and links; nothing is removed, and the person's edits to the scene stand.
 * Nothing here writes the journey. */
import {kernelOp} from "../kernel/bridge";
import type {CentralLocation, KernelTransportStatus} from "../kernel/types";
import type {Change, Entity, ExpressionDocument, ExpressionRequest, ExpressionResult, Relation, ReadingRef, SubjectBinding} from "../expression/types";
import {naraJourney, type IChingReading, type JourneyReading, type PlacementView} from "./journey";

/** Who opens and edits the Reading's Expression: the desktop's own actor, as a page's launch is (practiceLaunch.ts DESKTOP_ACTOR). */
export const READING_ACTOR = "oi-desktop-user";

/** The kernel allows only expression-local ref suffixes of [A-Za-z0-9-_.] up to 128 characters (run-expression.ts localSuffix); a longer
 * one keeps its head and a digest of the whole, so two refs never meet. */
function localSuffix(nativeRef: string): string {
  const local = nativeRef.replace(/[^A-Za-z0-9-_.]/g, "-");
  if (local.length <= 96) return local;
  let hash = 0x811c9dc5;
  for (let i = 0; i < nativeRef.length; i++) hash = Math.imul(hash ^ nativeRef.charCodeAt(i), 0x01000193) >>> 0;
  return `${local.slice(0, 80)}-${hash.toString(16).padStart(8, "0")}`;
}

const readingRef = (ref: string, revision: string): ReadingRef => ({ref, revision, availability: "available"});
const parameter = (value: string | number) => ({value, automation: null});
const clamp = (value: number) => Math.round(Math.max(-1600, Math.min(1600, value)));

/** Where a position stands: P0 at the top, the six round the ring clockwise; a night position (P0′ …) on the ring within. A card with
 * no position (a single, a closing card, an assignment held unplaced) stands on the row beneath. */
function placeOf(position: string | null, unplaced: number): {x: number; y: number} {
  const match = position ? /^P([0-5])(['′])?$/.exec(position) : null;
  if (!match) return {x: clamp(-660 + unplaced * 220), y: -820};
  const angle = (Number(match[1]) / 6) * 2 * Math.PI, radius = match[2] ? 300 : 560;
  return {x: clamp(radius * Math.sin(angle)), y: clamp(radius * Math.cos(angle))};
}

/** A card's words: its position and name, as the Deck draws them (a night position with its prime). Pure. */
export function cardTitle(placement: PlacementView): string {
  return `${placement.position ? `${placement.position.replace("'", "′")} · ` : ""}${placement.card.name}${placement.reversed ? " (reversed)" : ""}`;
}

interface Recognition {source: {source_ref: string; revision: string; standing_ref?: string}; entry_selector: string | null; via?: string}
const recognitionsOf = (placement: PlacementView): Recognition[] => (placement.recognitions as Recognition[]).filter(r =>
  !!r && typeof r === "object" && typeof r.source?.source_ref === "string" && typeof r.source?.revision === "string");

/** The journey's reading as an Expression document: one Reading scene; each card at its position with its codon, the entries it is linked
 * to beside it, each line cast at the centre related to the cards it was cast for. The spreads stand one behind another in the order they
 * were drawn, so a card keeps its place when a later draw is added; a Klein night stands within the day it completes. Pure. */
export function composeJourneyExpression(reading: JourneyReading, page: CentralLocation): ExpressionDocument {
  const expressionRef = `expression:${localSuffix(reading.journey_ref)}`;
  const sceneRef = `${expressionRef}:scene:reading`;
  const eRef = (suffix: string) => `${expressionRef}:entity:${localSuffix(suffix)}`;
  const rRef = (suffix: string) => `${expressionRef}:relation:${localSuffix(suffix)}`;
  const revision = String(reading.journey_revision);
  const basis = [readingRef(reading.journey_ref, revision), readingRef(page.ref, `journey:${revision}`)];
  const entities: Record<string, Entity> = {};
  const relations: Record<string, Relation> = {};
  const order: string[] = [];
  const add = (ref: string, title: string, subject: SubjectBinding, at: {x: number; y: number; z: number}, glyph: string) => {
    if (entities[ref]) return;
    // Every entity is born with the document (kernel law: entity revision ≤ document revision).
    entities[ref] = {entity_ref: ref, revision: 1, title, subject,
      parameters: {glyph: parameter(glyph.slice(0, 128)), x: parameter(at.x), y: parameter(at.y), z: parameter(at.z), scale: parameter(1)}};
    order.push(ref);
  };
  const relate = (key: string, from: string, to: string, kind: string) => {
    const binding = rRef(key);
    if (!relations[binding]) relations[binding] = {binding_ref: binding, relation: readingRef(kind, revision), from_entity_ref: from, to_entity_ref: to, provenance: basis};
  };
  // The spreads in the order drawn, each further back: a Klein night stands with the day it completes.
  const depthOf = new Map<string, number>();
  const days = reading.spreads.filter(spread => spread.kind.kind !== "klein-night");
  days.forEach((spread, index) => depthOf.set(spread.spread_ref, clamp(-index * 240)));
  for (const spread of reading.spreads) if (spread.kind.kind === "klein-night") depthOf.set(spread.spread_ref, depthOf.get(spread.kind.day_spread_ref) ?? 0);
  const cardOf = new Map<string, string>();
  let unplaced = 0, entries = 0;
  const lay = (placement: PlacementView, z: number) => {
    const ref = eRef(`card-${placement.placement_ref}`);
    const at = placeOf(placement.position, placement.position ? 0 : unplaced++);
    const codons = placement.card.codons ?? [];
    add(ref, cardTitle(placement), {subject_ref: placement.placement_ref, native_owner: "ql", presentation_role: "thing", sources: basis,
      readings: [readingRef(placement.card.token_ref, revision), ...(placement.card.kernel_card_ref ? [readingRef(placement.card.kernel_card_ref, revision)] : [])], actions: []},
    {...at, z}, codons.length ? `codon ${codons.join("·")}` : "no codon");
    cardOf.set(placement.placement_ref, ref);
    // The entries the card is linked to, beside it, outward; one entry linked from two cards stands once.
    recognitionsOf(placement).forEach((recognition, index) => {
      const subject = recognition.entry_selector ? `${recognition.source.source_ref}#${recognition.entry_selector}` : recognition.source.source_ref;
      const entry = eRef(`entry-${subject}`);
      const name = recognition.source.source_ref.split(/[/:]/).pop() || recognition.source.source_ref;
      add(entry, `${recognition.entry_selector ?? "The page"} · ${name}`, {subject_ref: subject, native_owner: "central", presentation_role: "thing",
        sources: [readingRef(recognition.source.source_ref, recognition.source.revision)], readings: [], actions: []},
      {x: clamp(at.x * 1.5 + index * 90), y: clamp(at.y * 1.5 - index * 90 - (at.y === 0 ? 120 : 0)), z}, "entry");
      relate(`link-${placement.placement_ref}-${entries++}-${subject}`, ref, entry, `nara.journey/link/${recognition.via ?? "related"}`);
    });
  };
  for (const spread of reading.spreads) for (const placement of spread.placements) lay(placement, depthOf.get(spread.spread_ref) ?? 0);
  for (const placement of reading.symbolic_assignments) lay(placement, 0);
  // The lines: each cast at the centre, one above another in the order cast, related to the cards it was cast for.
  reading.iching.forEach((cast: IChingReading, index) => {
    const ref = eRef(`lines-${cast.reading_ref}`);
    const resulting = typeof cast.resulting === "number" ? ` → ${cast.resulting}` : "";
    add(ref, `Hexagram ${cast.primary}${resulting}`, {subject_ref: cast.reading_ref, native_owner: "ql", presentation_role: "thing", sources: basis, readings: [], actions: []},
      {x: 0, y: clamp(index * 130), z: 0}, cast.lines.join(" "));
    const related = Array.isArray(cast.related_placement_refs) ? cast.related_placement_refs as string[] : [];
    for (const placementRef of related) {
      const card = cardOf.get(placementRef);
      if (card) relate(`cast-${cast.reading_ref}-${placementRef}`, ref, card, "nara.journey/cast-for");
    }
  });
  return {schema: "oi.expression/v1", expression_ref: expressionRef, revision: 1, title: `Journey · ${reading.concern.title}`,
    scenes: [{scene_ref: sceneRef, revision: 1, title: `Reading · ${reading.concern.title}`, entity_refs: order}],
    entities, relations, selection: {scene_ref: sceneRef, entity_ref: null}, provenance: basis, representations: [], refinements: []};
}

async function expression(transport: KernelTransportStatus, request: ExpressionRequest): Promise<ExpressionResult> {
  const reply = await kernelOp(transport, {op: "expression", request});
  if (reply.error || !reply.outcome || reply.outcome.result !== "expression") throw new Error(reply.error ?? "The Expression owner did not answer.");
  return reply.outcome.data as ExpressionResult;
}

/** The Expression the owner holds under this ref, or none (liveObjects.ts inspectExpression). */
async function held(transport: KernelTransportStatus, expressionRef: string): Promise<ExpressionDocument | undefined> {
  try { return (await expression(transport, {operation: "inspect", expression_ref: expressionRef})).document ?? undefined } catch { return undefined }
}

/** What a later reading adds to the Expression the owner holds: the scene if it is gone, each new entity with its subject and its
 * placement, each new link; nothing the person changed or removed is restored, and nothing is removed (liveObjects.ts syncRunExpression).
 * Pure. */
export function readingChanges(holding: ExpressionDocument, composed: ExpressionDocument): Change[] {
  const changes: Change[] = [];
  const scene = composed.scenes[0]!;
  if (!holding.scenes.some(row => row.scene_ref === scene.scene_ref)) changes.push({change: "scene_create", scene_ref: scene.scene_ref, title: scene.title});
  for (const ref of scene.entity_refs) {
    if (holding.entities[ref]) continue;
    const entity = composed.entities[ref]!;
    changes.push({change: "entity_add", scene_ref: scene.scene_ref, entity_ref: ref, title: entity.title});
    if (entity.subject) changes.push({change: "subject_bind", entity_ref: ref, binding: entity.subject});
    for (const [key, value] of Object.entries(entity.parameters)) changes.push({change: "parameter_set", entity_ref: ref, parameter: key, value: value.value});
  }
  for (const relation of Object.values(composed.relations)) {
    if (holding.relations[relation.binding_ref]) continue;
    const ends = [relation.from_entity_ref, relation.to_entity_ref];
    // A link whose card or entry the person removed from the scene is not restored with it.
    if (ends.every(ref => holding.entities[ref] || changes.some(change => change.change === "entity_add" && change.entity_ref === ref))) changes.push({change: "relation_bind", binding: relation});
  }
  return changes;
}

/** Show an Expression in the shell: the Expressions mode, opening it by its ref (the Library's own door, library/LibraryHost.tsx). */
export function showExpression(ref: string): void {
  window.dispatchEvent(new CustomEvent("oi:host-workspace-mode", {detail: {mode: "expressions", ref}}));
}

/** Launch a journey as Reading: read it through its owner, open its Expression through the Expression owner (once; a later launch adds
 * what is new), and show it. */
export async function openJourneyReading(transport: KernelTransportStatus, location: CentralLocation,
  options: {show?: (ref: string) => void; actor?: string} = {}): Promise<{expression_ref: string; opened: boolean; added: number}> {
  const actor = options.actor ?? READING_ACTOR, show = options.show ?? showExpression;
  const read = await naraJourney(transport, {operation: "read", location});
  const composed = composeJourneyExpression(read.reading, read.page.location);
  let holding = await held(transport, composed.expression_ref);
  if (!holding) {
    const opened = await expression(transport, {operation: "open", document: composed, actor});
    if (!opened.document) throw new Error(opened.state ? `The Expression owner did not open the journey's Reading: ${opened.state}.` : "The Expression owner did not open the journey's Reading.");
    show(composed.expression_ref);
    return {expression_ref: composed.expression_ref, opened: true, added: Object.keys(composed.entities).length};
  }
  let added = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const changes = readingChanges(holding, composed);
    if (!changes.length) break;
    const edited = await expression(transport, {operation: "edit", expression_ref: holding.expression_ref, expected_revision: holding.revision, actor, changes});
    if (edited.document) { added = changes.filter(change => change.change === "entity_add").length; break; }
    if (edited.state !== "revision_conflict" || attempt) throw new Error(`The Expression owner did not take what the journey added: ${edited.state ?? "no answer"}.`);
    holding = await held(transport, composed.expression_ref);
    if (!holding) throw new Error("The journey's Reading closed while it was added to.");
  }
  show(composed.expression_ref);
  return {expression_ref: composed.expression_ref, opened: false, added};
}
