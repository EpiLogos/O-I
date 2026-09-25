/**
 * The Palace composition floor (L5 Technē T6) — the mnemonic/artistic/
 * pedagogical composition surface over the reading's real Expression refs
 * (QL-MEF wayfinder §10, §18 T6).
 *
 * Laws carried here:
 *   - elements ARE the reading's `expressions[]` entries, verbatim —
 *     expression_ref, scene_ref, revision are never minted, re-keyed or
 *     shortened;
 *   - the arrangement (grid rooms and loci) is LOCAL presentation state of
 *     one surface: moving an element asserts no semantic relation, mutates
 *     nothing in the reading, and persists nowhere (no localStorage, no
 *     IndexedDB, no Palace record) until composed;
 *   - there is no second knowledge graph, no second Scene type and no
 *     second store of any kind — not even a JSON blob riding inside an
 *     existing field. A DURABLE Palace region is a real Scene of the
 *     Palace's own Expression (O:I #352 ES1A/ES1B substrate); a region's
 *     primary contained Expression is disclosed as that Scene's own body
 *     (`scene_body_set`, carrier `expression_ref`); the guided path is the
 *     Palace's own scene order (`scene_reorder`); independent opening is a
 *     declarative Portal trigger (`scene_trigger_attach`). This is NEVER
 *     `composition_set`/`shared.values` (a second store in disguise — the
 *     rejected design) and NEVER `scene_compose` on an Expression ref (that
 *     change takes a Scene's own `entity_refs`, a different object).
 *     FINDING (kernel `expression.rs` Entity-subject validation, proven in
 *     `kernel/tests/palace_composition_native.rs`): an Entity's own
 *     `subject_bind` explicitly REFUSES a `subject_ref` starting with
 *     `expression:` ("Subject must remain native") — so a contained
 *     Expression can never be disclosed by binding an Entity to it, and a
 *     Scene has exactly one body — so a region Scene discloses EXACTLY ONE
 *     contained Expression, never several. There is no marker-Entity
 *     fallback for a second member: identity encoded into a minted ref's own
 *     id string is a second store in disguise, and such members are not
 *     independently addressable through the substrate anyway. A region that
 *     wants a second Expression is a second region — the UI refuses adding
 *     past one member with a plain reason and offers "Add as new region"
 *     instead;
 *   - a region's removal is an explicit act, never inferred from a region
 *     simply going unmentioned: `planRegions`'s `removedRegionNames` is the
 *     only path to `scene_remove`;
 *   - every plan is diffed against a live document snapshot before it is
 *     returned, so replaying the same composition twice emits NO changes
 *     the second time (no duplicate Scenes or triggers) — this module never
 *     invents identity a snapshot doesn't already disclose;
 *   - the proposal always carries the CAS basis (`revision`, the snapshot's
 *     own document revision) so execution can be gated on the exact
 *     revision this proposal was derived from — never a freshly
 *     re-inspected one;
 *   - no stochastic identity: every derivation is a pure function of its
 *     inputs, so re-deriving yields the same elements in the same order.
 *
 * Erasable TypeScript: loadable by the renderer, Vite, and `node --test`.
 */
import type { NativeActionRef, TechneExpressionBinding, TechneReading } from "../../contract.ts";

/** One palace element: a verbatim Expression binding from the reading. */
export type PalaceElement = TechneExpressionBinding;

/** One room of the bounded memory space, addressed column-major by index. */
export interface PalaceRoom {
  column: number;
  row: number;
}

/** One locus: a slot inside a room where exactly one element may stand. */
export interface PalaceLocus {
  room: PalaceRoom;
  locus: number;
}

/** One placement: which expression stands at which locus. Presentation only. */
export interface PalacePlacement {
  expression_ref: string;
  locus: PalaceLocus;
}

/** The arrangement of elements over the bounded memory space. Local state of
 * one Palace surface; never written back into a reading or anywhere else. */
export interface PalaceArrangement {
  rooms: { columns: number; rows: number };
  loci_per_room: number;
  placements: PalacePlacement[];
}

/** The shape of the bounded memory space. Fixed, so every surface derives
 * the same walk from the same arrangement. */
export const PALACE_ROOMS: { columns: number; rows: number } = { columns: 3, rows: 2 };
export const PALACE_LOCI_PER_ROOM = 4;
/** Loci inside a room sit on a square span (2×2 for 4 loci). */
export const PALACE_LOCUS_SPAN = 2;

/** The fallback Expression-owner action when the reading discloses none. */
export const FALLBACK_EXPRESSION_ACTION = "oi.expression.edit";

// ---------------------------------------------------------------------------
// Native ref minting — Expression-local refs, valid under the kernel's own
// `id(value, prefix)` charset (alnumeric plus `-_.` after the prefix).
// ---------------------------------------------------------------------------

/** Sanitise a region NAME (a free-form label, never another native ref) into
 * a safe Expression-local suffix for its Scene/trigger refs. This never
 * carries a target object's own identity — a region's contained Expression
 * is disclosed only through its Scene's own body (`scene_body_set`), read
 * back from the document itself, never decoded from a ref string. */
function sanitiseSuffix(value: string): string {
  const escaped = value.replace(/[^A-Za-z0-9\-_.]/g, "-");
  if (escaped.length > 0 && escaped.length <= 120) return escaped;
  let a = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    a = Math.imul(a ^ value.charCodeAt(index), 16777619) >>> 0;
  }
  return `region-${a.toString(16)}`;
}

// ---------------------------------------------------------------------------
// Elements — the reading's own Expression bindings, verbatim
// ---------------------------------------------------------------------------

/** The reading's Expression bindings, verbatim and in reading order. An
 * absent or empty facet is data, not an error: zero elements is an honest
 * empty palace. */
export function palaceElements(reading: TechneReading): PalaceElement[] {
  return (reading.expressions ?? []).map((binding) => ({ ...binding }));
}

/** Capability honesty for the pane: the Palace is available exactly when the
 * reading binds at least one Expression; the reason for absence is the
 * reading's own disclosure, never an invented one. */
export function palaceAvailability(reading: TechneReading | null): { available: boolean; reason: string | null } {
  if (!reading) return { available: false, reason: null };
  if (palaceElements(reading).length > 0) return { available: true, reason: null };
  const entry = reading.disclosure.instruments.find((candidate) => candidate.instrument === "palace");
  return { available: false, reason: entry && entry.available === false ? entry.reason ?? null : null };
}

// ---------------------------------------------------------------------------
// Arrangement — local presentation state over the bounded memory space
// ---------------------------------------------------------------------------

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** A locus clamped into the bounded space. */
export function clampLocus(locus: PalaceLocus): PalaceLocus {
  return {
    room: {
      column: clamp(Math.trunc(locus.room.column), 0, PALACE_ROOMS.columns - 1),
      row: clamp(Math.trunc(locus.room.row), 0, PALACE_ROOMS.rows - 1),
    },
    locus: clamp(Math.trunc(locus.locus), 0, PALACE_LOCI_PER_ROOM - 1),
  };
}

/** Spatial sort key: rooms walk row-major, loci in locus order inside the
 * room. The walk order is a pure function of the positions — never of
 * insertion order, never of a stochastic source. */
export function locusKey(locus: PalaceLocus): string {
  return `${locus.room.row}:${locus.room.column}:${locus.locus}`;
}

/** The deterministic initial arrangement: elements stand at the loci of the
 * bounded space in reading order, walking rooms row-major. */
export function defaultArrangement(elements: readonly PalaceElement[]): PalaceArrangement {
  const placements: PalacePlacement[] = elements.map((element, index) => {
    const roomIndex = Math.floor(index / PALACE_LOCI_PER_ROOM);
    return {
      expression_ref: element.expression_ref,
      locus: clampLocus({
        room: {
          column: roomIndex % PALACE_ROOMS.columns,
          row: Math.floor(roomIndex / PALACE_ROOMS.columns),
        },
        locus: index % PALACE_LOCI_PER_ROOM,
      }),
    };
  });
  return { rooms: { ...PALACE_ROOMS }, loci_per_room: PALACE_LOCI_PER_ROOM, placements: sortPlacements(placements) };
}

/** Spatial order: rooms walk row-major, loci in locus order inside the room.
 * Numeric, so the walk is identical for any bounds. */
export function locusOrder(a: PalaceLocus, b: PalaceLocus): number {
  if (a.room.row !== b.room.row) return a.room.row - b.room.row;
  if (a.room.column !== b.room.column) return a.room.column - b.room.column;
  return a.locus - b.locus;
}

function sortPlacements(placements: readonly PalacePlacement[]): PalacePlacement[] {
  return [...placements].sort((a, b) => locusOrder(a.locus, b.locus));
}

/** Move one element to a locus. Pure: returns a new arrangement; the reading
 * and every other surface are untouched. A move asserts no semantic relation
 * — positions are presentation. The locus stands in the bounded space; if
 * another element already stands there, the two swap loci. */
export function arrangeAt(arrangement: PalaceArrangement, expression_ref: string, locus: PalaceLocus): PalaceArrangement {
  const target = clampLocus(locus);
  const moved = arrangement.placements.find((placement) => placement.expression_ref === expression_ref);
  if (!moved) return arrangement;
  if (locusKey(moved.locus) === locusKey(target)) return arrangement;
  const displaced = arrangement.placements.find(
    (placement) => placement.expression_ref !== expression_ref && locusKey(placement.locus) === locusKey(target),
  );
  const placements = arrangement.placements.map((placement): PalacePlacement => {
    if (placement.expression_ref === expression_ref) return { expression_ref, locus: target };
    if (displaced && placement.expression_ref === displaced.expression_ref) {
      return { expression_ref: placement.expression_ref, locus: moved.locus };
    }
    return placement;
  });
  return { ...arrangement, placements: sortPlacements(placements) };
}

/** The element refs in arrangement order — the spatial walk over occupied
 * loci. This is the order the composition carries and recall follows. */
export function arrangementOrder(arrangement: PalaceArrangement): string[] {
  return sortPlacements(arrangement.placements).map((placement) => placement.expression_ref);
}

// ---------------------------------------------------------------------------
// Composition — the native proposal routed to the Expression owner
// ---------------------------------------------------------------------------

/** The reading's disclosed Expression-owner Action — the first disclosed
 * action in the Expression-owner namespace (`oi.expression.*`). Returns null
 * when the reading discloses none, in which case the proposal names the
 * fallback owner action and honest routing may refuse it. */
export function expressionOwnerAction(actions: readonly NativeActionRef[] | undefined): NativeActionRef | null {
  return (actions ?? []).find((action) => action.action_ref.startsWith("oi.expression.")) ?? null;
}

// ---------------------------------------------------------------------------
// Kernel Change shapes this module emits — the exact substrate primitives
// (O:I #352 ES1A/ES1B), never a Palace-invented shape. Typed narrowly to
// what the Palace actually uses; the kernel's own Change union is wider.
// ---------------------------------------------------------------------------

export interface PalaceReadingRef { ref: string; revision: string; availability: "available" | "unavailable" | "withheld" | "stale" }
export type PalaceChange =
  | { change: "scene_create"; scene_ref: string; title: string }
  | { change: "scene_rename"; scene_ref: string; title: string }
  | { change: "scene_remove"; scene_ref: string }
  | {
      change: "scene_body_set";
      scene_ref: string;
      body: {
        carrier: "expression_ref";
        subject_ref: string;
        native_owner: string;
        reading: PalaceReadingRef;
        provenance: PalaceReadingRef[];
        actions: { action_ref: string; target_ref: string; authority_requirement: string }[];
        presentation: "live" | "inline" | "preview" | "degraded";
        capability: { state: "renderable" } | { state: "degrades_to_thing"; reason: string } | { state: "unavailable"; reason: string };
        recursion: { host_expression_ref: string; max_depth: number };
      };
    }
  | { change: "scene_trigger_detach"; trigger_ref: string }
  | {
      change: "scene_trigger_attach";
      scene_ref: string;
      trigger: { trigger_ref: string; occasion: "activate"; target: { kind: "portal"; placement: "beside"; subject_ref: string } };
    }
  | { change: "scene_reorder"; scene_refs: string[] };

/** One region as the Palace intends it: a name, its ONE contained Expression
 * (or null for an empty, not-yet-filled region), and the region's own Scene
 * ref when it already exists (from a prior readback) — null for a region not
 * yet created. A region discloses AT MOST ONE Expression — the kernel's own
 * Entity-subject validation refuses an Entity bound to another Expression
 * ("Subject must remain native"; `kernel/tests/palace_composition_native.rs`
 * proves it), and a Scene has exactly one body, so one Scene can durably
 * disclose exactly one contained Expression. No marker Entities, no ref
 * encoded into an id string — an object's containment is read from the
 * Scene's own body, never decoded from anywhere. */
export interface PalaceRegionSpec {
  name: string;
  scene_ref: string | null;
  member: { expression_ref: string; title: string; revision?: string | null } | null;
}

/** The live document facts this module diffs against — exactly what a
 * kernel `inspect`/`edit` reply discloses, never a second reading of it. */
export interface PalaceSceneSnapshot {
  scene_ref: string;
  title: string;
  body?: { carrier?: string; subject_ref?: string } | null;
  triggers?: readonly { trigger_ref: string; target?: { kind?: string; subject_ref?: string } }[];
}
export interface PalaceDocumentSnapshot {
  expression_ref: string;
  revision: number;
  scenes: readonly PalaceSceneSnapshot[];
}

const PALACE_PRESENTATION = "preview" as const;
const PALACE_RECURSION_DEPTH = 1;

function findScene(snapshot: PalaceDocumentSnapshot, sceneRef: string | null): PalaceSceneSnapshot | undefined {
  return sceneRef ? snapshot.scenes.find((scene) => scene.scene_ref === sceneRef) : undefined;
}

/** Mint the region's own Scene ref, deterministic from the region name. */
export function regionSceneRef(paletteExpressionRef: string, regionName: string): string {
  return `${paletteExpressionRef}:scene:region-${sanitiseSuffix(regionName)}`;
}
/** Mint the region's Portal trigger ref — flat under the Palace Expression
 * (kernel `id()` requires `<expression_ref>:trigger:<suffix>`, never nested
 * under the region's own scene ref). */
export function regionTriggerRef(paletteExpressionRef: string, regionName: string): string {
  return `${paletteExpressionRef}:trigger:region-${sanitiseSuffix(regionName)}-portal`;
}

/** Plan the exact kernel Changes to bring the live document to the composed
 * regions — diffed against `snapshot` FIRST, so nothing already disclosed is
 * re-emitted: a region whose Scene, body and trigger already match composes
 * to zero changes for that region (replay-idempotent, no duplicate Scenes or
 * triggers). `removedRegionNames` names regions the caller explicitly
 * decided to remove — NEVER inferred from a region simply being absent from
 * `regions` (an omission is not a deletion): only a name listed here emits
 * `scene_remove`. Returns null when there is nothing to compose (no regions,
 * no removals, or every region already matches the snapshot exactly).
 * Nothing is executed here — planning is pure over the snapshot given. */
export function planRegions(
  snapshot: PalaceDocumentSnapshot,
  regions: readonly PalaceRegionSpec[],
  removedRegionNames: readonly string[] = [],
): PalaceChange[] | null {
  const changes: PalaceChange[] = [];
  const anchor = snapshot.expression_ref;
  const guidedSceneRefs: string[] = [];

  for (const removedName of removedRegionNames) {
    const sceneRef = regionSceneRef(anchor, removedName);
    if (findScene(snapshot, sceneRef)) changes.push({ change: "scene_remove", scene_ref: sceneRef });
  }
  const removedSceneRefs = new Set(removedRegionNames.map((name) => regionSceneRef(anchor, name)));

  for (const region of regions) {
    const sceneRef = region.scene_ref ?? regionSceneRef(anchor, region.name);
    if (removedSceneRefs.has(sceneRef)) continue; // an explicit removal always wins over a stale kept-region entry
    guidedSceneRefs.push(sceneRef);
    const existingScene = findScene(snapshot, sceneRef);

    if (!existingScene) {
      changes.push({ change: "scene_create", scene_ref: sceneRef, title: region.name });
    } else if (existingScene.title !== region.name) {
      changes.push({ change: "scene_rename", scene_ref: sceneRef, title: region.name });
    }

    // The region's ONE contained Expression: the only object a Scene can
    // durably disclose (its own body) — the kernel-Entity-subject-bind
    // refusal above is exactly why this is one member, never several.
    const member = region.member;
    if (member) {
      const desiredBody = {
        carrier: "expression_ref" as const,
        subject_ref: member.expression_ref,
        native_owner: "oi",
        reading: { ref: member.expression_ref, revision: member.revision ?? "1", availability: "available" as const },
        provenance: [],
        actions: [],
        presentation: PALACE_PRESENTATION,
        capability: { state: "renderable" as const },
        recursion: { host_expression_ref: anchor, max_depth: PALACE_RECURSION_DEPTH },
      };
      const bodyMatches = existingScene?.body?.carrier === "expression_ref" && existingScene.body.subject_ref === member.expression_ref;
      if (!bodyMatches) changes.push({ change: "scene_body_set", scene_ref: sceneRef, body: desiredBody });

      const triggerRef = regionTriggerRef(anchor, region.name);
      const existingTrigger = existingScene?.triggers?.find((trigger) => trigger.trigger_ref === triggerRef);
      const triggerMatches = existingTrigger?.target?.kind === "portal" && existingTrigger.target.subject_ref === member.expression_ref;
      if (!triggerMatches) {
        if (existingTrigger) changes.push({ change: "scene_trigger_detach", trigger_ref: triggerRef });
        changes.push({
          change: "scene_trigger_attach",
          scene_ref: sceneRef,
          trigger: { trigger_ref: triggerRef, occasion: "activate", target: { kind: "portal", placement: "beside", subject_ref: member.expression_ref } },
        });
      }
    }
  }

  // Guided path: the Palace's own region Scenes in the given order, any
  // other Scene in the document (e.g. the Expression's own main Scene) kept
  // in its existing relative position, appended after the regions, and any
  // explicitly removed Scene dropped. Safe to name a region Scene not yet
  // in the snapshot: its `scene_create` (pushed above) always precedes this
  // `scene_reorder` in the SAME changes array, and the kernel applies
  // changes sequentially — by the time reorder runs, every named Scene
  // already exists (and every removed one is already gone).
  const managedRefs = new Set(guidedSceneRefs);
  const otherRefs = snapshot.scenes
    .map((scene) => scene.scene_ref)
    .filter((ref) => !managedRefs.has(ref) && !removedSceneRefs.has(ref));
  const desiredOrder = [...otherRefs, ...guidedSceneRefs];
  const currentOrder = snapshot.scenes.map((scene) => scene.scene_ref).filter((ref) => !removedSceneRefs.has(ref));
  if (currentOrder.length !== desiredOrder.length || currentOrder.some((ref, index) => ref !== desiredOrder[index])) {
    changes.push({ change: "scene_reorder", scene_refs: desiredOrder });
  }

  return changes.length > 0 ? changes : null;
}

/** The full composition proposal: the plan (if any) plus the routing Action
 * and CAS basis. Returns null when there is nothing to compose (every
 * region already matches the snapshot — an honest idempotent no-op). */
export function composeRegions(
  snapshot: PalaceDocumentSnapshot,
  regions: readonly PalaceRegionSpec[],
  actions?: readonly NativeActionRef[],
  removedRegionNames?: readonly string[],
): { action_ref: string; input: { expression_ref: string; revision: string; changes: PalaceChange[] } } | null {
  const changes = planRegions(snapshot, regions, removedRegionNames);
  if (!changes) return null;
  const disclosed = expressionOwnerAction(actions);
  return {
    action_ref: disclosed ? disclosed.action_ref : FALLBACK_EXPRESSION_ACTION,
    input: { expression_ref: snapshot.expression_ref, revision: String(snapshot.revision), changes },
  };
}

/** Recover one region's ONE member from its own Scene — read from the
 * Scene's own body, authoritative and lossless. Never a marker Entity, never
 * a ref decoded from an id string: containment is only ever what the
 * document's own body discloses. */
function regionMemberFromScene(scene: PalaceSceneSnapshot): PalaceRegionSpec["member"] {
  if (scene.body?.carrier !== "expression_ref" || !scene.body.subject_ref) return null;
  return { expression_ref: scene.body.subject_ref, title: scene.body.subject_ref };
}

/** Read the composed regions back from a live document snapshot, by their
 * already-known names — the readback half of `planRegions`/`composeRegions`,
 * over the document's OWN scenes/bodies, never a second reading. "Composition
 * survives reopening" is this round trip, not an assertion. */
export function readPalaceRegions(snapshot: PalaceDocumentSnapshot, regionNames: readonly string[]): PalaceRegionSpec[] {
  return regionNames.map((name) => {
    const sceneRef = regionSceneRef(snapshot.expression_ref, name);
    const scene = findScene(snapshot, sceneRef);
    if (!scene) return { name, scene_ref: null, member: null };
    return { name, scene_ref: sceneRef, member: regionMemberFromScene(scene) };
  });
}

/** Discover every Palace region a live document already carries, with no
 * name known in advance: every Scene minted by `regionSceneRef` (its own
 * ref prefix names it as a Palace region — never a guess, never a second
 * index) becomes one region, named from the Scene's own title. This is how
 * the mounted Palace instrument rehydrates its region list on reopen. */
export function discoverRegions(snapshot: PalaceDocumentSnapshot): PalaceRegionSpec[] {
  const prefix = `${snapshot.expression_ref}:scene:region-`;
  return snapshot.scenes
    .filter((scene) => scene.scene_ref.startsWith(prefix))
    .map((scene) => ({ name: scene.title, scene_ref: scene.scene_ref, member: regionMemberFromScene(scene) }));
}
