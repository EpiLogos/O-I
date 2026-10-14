/**
 * Lane-5 T1–T3 glue (pure: no store, no DOM, no channel). The journey's beat
 * view model over a reading and the kernel document, and the two kernel edit
 * requests the journey may route: one `scene_create` (T2) and one
 * `scene_reorder` (T3). Nothing here persists. Every refusal is the floor's own
 * reason (compose.ts, sequence.ts), returned as data for a toast.
 *
 * Identity: a beat card's identity is the binding's `scene_ref`, verbatim. It is
 * never re-keyed, shortened or minted here, except the single new ref that
 * compose.ts mints under the substrate grammar.
 */
import type {DisclosureSelection, TechneActionRoute, TechneReading} from '../../../src/techne/contract';
import {beats, sceneTitle, type JourneyBeat, type JourneyBeatFrame} from '../../../src/techne/m0m5/journey/beats';
import {composeSceneProposal, type CompositionProposal} from '../../../src/techne/m0m5/journey/compose';
import {composeProposal, type SequenceDraft} from '../../../src/techne/m0m5/journey/sequence';
import type {CtKind} from '../../../src/techne/m0m5/journey/vak';
import type {KernelChange} from './kernelExpressions';

/** The kernel document as the journey reads it: identity, revision, scene refs. */
export interface JourneyKernelDocument {
  expression_ref: string;
  revision: number;
  scenes: readonly {scene_ref: string; title?: string}[];
}

/** One facet chip, in the reading's own vocabulary (time, place, source). */
export interface JourneyFacetChip {
  kind: 'time' | 'place' | 'source';
  /** The facet's own ref, verbatim (null only when the reading names none). */
  ref: string | null;
  label: string;
}

/** The reason a card's facets are not yet in hand: its own Scene reading is still in flight. */
export const SCENE_READING_PENDING = "this Scene's reading is pending";

/** One beat card. `scene_ref` is the identity; `onBasis` says the native document
 * holds this scene at the revision the reading disclosed. A card's chips come only
 * from its own Scene's reading (T13): `chipsReason` is present while that reading is
 * pending and when it cannot be read, and the chips are then empty. Never the whole
 * Expression's facets on every card. */
export interface JourneyBeatCard {
  scene_ref: string;
  expression_ref: string;
  revision: string | null;
  title: string;
  onBasis: boolean;
  chips: JourneyFacetChip[];
  chipsReason?: string;
}

export interface JourneyBeatView {
  cards: JourneyBeatCard[];
  /** Present exactly when there are no cards: the disclosure's honest reason, as data. */
  unavailableReason?: string;
}

/** A routable kernel edit: one `oi.expression` edit on the captured revision. */
export type JourneyEditRequest = {
  operation: 'edit';
  expression_ref: string;
  expected_revision: number;
  actor: string;
  changes: KernelChange[];
};

export type JourneyRouting =
  | {ok: true; route: TechneActionRoute; request: JourneyEditRequest}
  | {ok: false; reason: string};

const DEFAULT_ACTOR = 'human:expressions-app';

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function refuse(reason: string): {ok: false; reason: string} {
  return {ok: false, reason};
}

function selectorLabel(selector: NonNullable<JourneyBeatFrame['sources'][number]['selector']>): string {
  switch (selector.unit) {
    case 'text_span': return `characters ${selector.start}–${selector.end}`;
    case 'timestamp_range': return `${selector.from}–${selector.to}`;
    case 'image_region': return `region ${selector.x},${selector.y} ${selector.width}×${selector.height}`;
    case 'other': return `${selector.kind} ${selector.value}`;
  }
}

function chipsOf(frame: JourneyBeatFrame): JourneyFacetChip[] {
  const chips: JourneyFacetChip[] = [];
  for (const facet of frame.temporal) {
    const from = facet.interval?.from ?? '';
    const to = facet.interval?.to ?? '';
    // T13: a facet the reading does not value says so; it is never labelled with its own kind, and an open end is named.
    const value = facet.instant ?? facet.day_ref ?? (from || to ? `${from || 'undisclosed'} → ${to || 'undisclosed'}` : 'undated');
    chips.push({kind: 'time', ref: facet.facet_ref ?? null, label: `${facet.kind} · ${value}`});
  }
  for (const place of frame.places) {
    const name = place.names.join(' · ') || place.place_ref;
    chips.push({kind: 'place', ref: place.place_ref, label: `${name} · ${place.precision}`});
  }
  for (const source of frame.sources) {
    const revision = source.source_revision ? ` · ${source.source_revision}` : '';
    const selector = source.selector ? ` · ${selectorLabel(source.selector)}` : '';
    chips.push({kind: 'source', ref: source.source_ref, label: `${source.source_ref}${revision}${selector}`});
  }
  return chips;
}

function cardOf(beat: JourneyBeat, doc: JourneyKernelDocument): JourneyBeatCard {
  const onBasis = beat.expression_ref === doc.expression_ref
    && beat.revision === String(doc.revision)
    && doc.scenes.some((scene) => scene.scene_ref === beat.scene_ref);
  return {
    scene_ref: beat.scene_ref,
    expression_ref: beat.expression_ref,
    revision: beat.revision,
    title: beat.title,
    onBasis,
    // T13: the Expression-wide reading names every Scene but attributes no facet to any of them. Chips come from each
    // Scene's own reading (journeyBeatView), never from the whole.
    chips: [],
  };
}

/** The beat surface's model: one card per scene-bearing binding, in binding
 * order. A reading with no scene-bearing binding yields no cards and the
 * disclosure's own reason. Nothing is invented.
 *
 * `sceneFrames` (optional) carries each Scene's OWN reading, keyed by scene_ref,
 * or the owner's reason it could not be read. The Expression-wide reading names
 * every Scene but attributes no facets to any of them, so a card's chips come
 * only from its own Scene's reading. Without an entry the card is pending
 * (SCENE_READING_PENDING) and carries no chips: the Expression-wide facets are
 * never shown on a card (T13). */
export function journeyBeatView(
  reading: TechneReading,
  doc: JourneyKernelDocument,
  sceneFrames?: ReadonlyMap<string, TechneReading | string>,
): JourneyBeatView {
  const model = beats(reading);
  const cards = model.beats.map((beat): JourneyBeatCard => {
    const card = cardOf(beat, doc);
    const frame = sceneFrames?.get(beat.scene_ref);
    if (frame === undefined) return {...card, chipsReason: SCENE_READING_PENDING};
    if (typeof frame === 'string') return {...card, chips: [], chipsReason: frame};
    const own = beats(frame).beats.find((row) => row.scene_ref === beat.scene_ref && row.expression_ref === beat.expression_ref);
    if (!own) return {...card, chips: [], chipsReason: 'the Scene reading names no beat for this Scene'};
    return {...card, chips: chipsOf(own.frame)};
  });
  if (cards.length) return {cards};
  return {cards, unavailableReason: model.unavailableReason ?? 'the reading discloses no scene beats'};
}

/** T11, pure: the status line for a return that restored a beat, and whether the native Scene moves to it. The beat is named by its
 * title, never an index. A beat the native Scene already presents is named and nothing moves. A beat this Journey can present on the
 * native basis as it stands (`focusable`) moves the Scene by ref. Any other restored beat is a miss: the Scene stays where it was, and
 * nothing is claimed as restored. */
export function restoredBeatNotice(restoredRef: string, basisSceneRef: string, focusable: boolean): {moves: boolean; notice: string} {
  const title = sceneTitle(restoredRef);
  if (restoredRef === basisSceneRef) return {moves: false, notice: `Back in this Journey at "${title}".`};
  if (focusable) return {moves: true, notice: `Back in this Journey at "${title}".`};
  return {
    moves: false,
    notice: `The return named the beat "${title}", but this Journey cannot present it on the native Expression as it stands, so the Scene stays where it was.`,
  };
}

/** T2: mint one scene through the floor and route exactly one `scene_create`,
 * CAS-gated on the disclosed revision. The reading must name the same Expression
 * at the document's current revision; a colliding ref is refused with the floor's
 * reason. Nothing persists. */
export function composeSceneRequest(input: {
  reading: TechneReading;
  doc: JourneyKernelDocument;
  /** The focused native refs the composed scene stands on (verbatim). */
  focus_refs: string[];
  /** The disclosed selection's ref, when the caller holds one. */
  selection_ref?: string;
  title: string;
  ct?: CtKind;
  actor?: string;
}): JourneyRouting {
  const {reading, doc} = input;
  const bound = reading.expressions?.[0];
  if (!bound) return refuse('no Expression is bound to this reading, so there is no native Expression to compose a scene into');
  if (bound.expression_ref !== doc.expression_ref) {
    return refuse(`the reading discloses ${bound.expression_ref}, not the open native Expression ${doc.expression_ref}; refresh the reading`);
  }
  if (bound.revision !== String(doc.revision)) {
    return refuse(`the reading was disclosed at revision ${bound.revision ?? 'none'}; ${doc.expression_ref} is at revision ${doc.revision}. Refresh the reading before composing`);
  }
  // composeSceneProposal reads only focus_refs and an optional selection_ref.
  const selection = {
    focus_refs: [...input.focus_refs],
    reading_ref: reading.reading_ref,
    ...(input.selection_ref !== undefined ? {selection_ref: input.selection_ref} : {}),
  } as unknown as DisclosureSelection;
  let proposal: CompositionProposal;
  try {
    proposal = composeSceneProposal({reading, selection, title: input.title, ct: input.ct});
  } catch (cause) {
    return refuse(message(cause));
  }
  const sceneRef = proposal.input.change.scene_ref;
  if (doc.scenes.some((scene) => scene.scene_ref === sceneRef)) {
    return refuse(`scene ${sceneRef} already exists in ${doc.expression_ref}; composition proposes new scenes, never re-names the owner's`);
  }
  return {
    ok: true,
    route: proposal.route,
    request: {
      operation: 'edit',
      expression_ref: doc.expression_ref,
      expected_revision: doc.revision,
      actor: input.actor ?? DEFAULT_ACTOR,
      changes: [{change: 'scene_create', scene_ref: sceneRef, title: proposal.input.change.title}],
    },
  };
}

/** T3: route exactly one `scene_reorder` naming the disclosed refs in the draft's
 * order. The draft is local; its per-scene pace never enters the request. The
 * kernel reorders every scene of the document at once, so a draft that leaves a
 * native scene unnamed is refused rather than widened. */
export function reorderSceneRequest(input: {
  reading: TechneReading;
  doc: JourneyKernelDocument;
  draft: SequenceDraft;
  actor?: string;
}): JourneyRouting {
  const {reading, doc, draft} = input;
  if (draft.expression_ref !== doc.expression_ref) {
    return refuse(`the draft orders ${draft.expression_ref}, not the open native Expression ${doc.expression_ref}`);
  }
  if (draft.revision !== String(doc.revision)) {
    return refuse(`the draft was taken at revision ${draft.revision ?? 'none'}; ${doc.expression_ref} is at revision ${doc.revision}. Refresh the reading before reordering`);
  }
  let route: TechneActionRoute;
  try {
    route = composeProposal(draft, reading);
  } catch (cause) {
    return refuse(message(cause));
  }
  const native = doc.scenes.map((scene) => scene.scene_ref);
  const foreign = draft.scene_order.find((ref) => !native.includes(ref));
  if (foreign !== undefined) return refuse(`scene ${foreign} is not held by ${doc.expression_ref} at revision ${doc.revision}`);
  const unnamed = native.filter((ref) => !draft.scene_order.includes(ref));
  if (unnamed.length) {
    return refuse(`the kernel reorders every scene of ${doc.expression_ref} at once, and this reading names ${draft.scene_order.length} of its ${native.length} scenes; no beat order is routed`);
  }
  if (native.every((ref, index) => ref === draft.scene_order[index])) {
    return refuse('the draft keeps the authored scene order; there is nothing to route');
  }
  return {
    ok: true,
    route,
    request: {
      operation: 'edit',
      expression_ref: doc.expression_ref,
      expected_revision: doc.revision,
      actor: input.actor ?? DEFAULT_ACTOR,
      changes: [{change: 'scene_reorder', scene_refs: [...draft.scene_order]}],
    },
  };
}
