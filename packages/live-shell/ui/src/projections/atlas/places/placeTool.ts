// The Place tool of the M4′ World / Places plate (T-PLACES-ONTO-ATLAS; lane-4 T17 click to create, T18 the owner's basis law, T19
// refine with honest precision; manual §2 "place things on it and name them"). Ported from the frame map's authoring surface, which
// retires (psychogeographic/PsychogeographicMap.tsx's context menu and marker drag, researchInstruments.tsx:1496-1527's route): the
// pure draft contract is the frame's own, used in place (vendor psychogeographic/placeAuthoring.ts — prefillFromClick,
// moveProposal, placeDraftForAdd/Move, validatePlaceDraft, the route notices), and the owner call is the one the frame's route
// reached: the Wiki's time-and-place editor, offered the draft for the subject (desktop/cradle/src/knowledge/WikiFactsEditor.tsx:24
// offerConstellationRoute, as desktop/cradle/src/CradleFrame.tsx:1134 offered it), which answers on `oi:constellation-result`
// (WikiFactsEditor.tsx:65 reportRoute).
//
// Laws kept from the frame map: the atlas never writes a coordinate — it offers a draft, and only the owner's editor saves it, with a
// source basis the person chooses; a click claims no more than "approximate"; a move keeps the place's own precision, never
// upgrades it, and needs the place's disclosed evidence; the owner's refusal is shown in its own words.
//
// The tool is armed on the plate (✎ Place) for one subject, the one the Earth has selected; the next click on the globe is the
// draft's point (placesHost.ts reads the point under the click). Pure state and a store; the owner calls are bound by the host.
//
// [T-WORLDS §5 W3 phase B] Places on your own body: while the globe draws your world's body, a click's draft stands on that body (the
// place facet's body_ref, AIKit PlaceFacet; absent for the Earth) and carries the name the World suggests from its seed (globe/body.ts
// suggestName); the same editor saves it through PlaceSet on the revision read. And landings: armed for a world of today's set, the next
// click on your planet is that world's landing, which its own body owner writes (one BodySet on its register, on the revision read,
// system/SystemReadings.tsx landWorld): the landing is the world's body record, never a place facet, and nothing of a place moves.

import {
  addRouteNotice, constellationResultNotice, formatCoordinate, moveProposal, moveRouteNotice, placeDraftForAdd, placeDraftForMove,
  prefillFromClick, validatePlaceDraft,
} from '../../../../../../../desktop/cradle/expressions-app/vendor/research-canvas/packages/canvas/src/psychogeographic/placeAuthoring';
import type {MapPlaceDraft} from '../../../../../../../desktop/cradle/src/knowledge/WikiFactsEditor';
import {suggestName} from '../src/globe/body';

/** [T-WORLDS §5 W3] The draft a click offers: the vendor's own (validated as it always was), and, on a body other than the Earth, the
 * body it stands on (the facet's body_ref, absent for the Earth) and the name the World suggests from that body's seed. */
export type PlaceDraft = MapPlaceDraft;

/** The body the globe draws under a click: your world's body (its ref and its seed), or null for the Earth. */
export interface DrawnBody {
  readonly body_ref: string;
  readonly seed: number;
}

/** A world of your system the next click lands on your planet (system/systemModel.ts SystemBody: its key and its name). */
export interface LandingTarget {
  readonly key: string;
  readonly name: string;
}

/** A place the subject already declares, which a press of the tool proposes to move (T19). */
export interface PlaceToolMove {
  readonly place_ref: string;
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  readonly precision: string;
  /** the evidence the facet cites: a move without one has nothing to cite, and the owner refuses it */
  readonly evidence?: string;
}

/** The subject a placed point is declared for: the owner's ref, its title, and the place it moves when one is chosen. */
export interface PlaceToolSubject {
  readonly ref: string;
  readonly title: string;
  readonly moving?: PlaceToolMove;
}

export type PlaceToolTone = 'said' | 'refused' | 'saved'

export type PlaceToolState =
  | {readonly phase: 'idle'; readonly notice: string | null; readonly tone: PlaceToolTone | null}
  | {readonly phase: 'armed'; readonly subject: PlaceToolSubject}
  | {readonly phase: 'offered'; readonly subject: PlaceToolSubject; readonly draft: PlaceDraft; readonly notice: string}
  /** [T-WORLDS §5 W3] armed to land a world of your system on your planet: the next click on your planet is its landing */
  | {readonly phase: 'landing'; readonly target: LandingTarget}
  /** the landing went to its owner and the answer is awaited */
  | {readonly phase: 'saving'; readonly target: LandingTarget};

/** The owner calls the tool makes, bound by the host: offer the draft to the subject's time-and-place editor, open the subject where
 * that editor stands, and read the world again after the owner saved. */
export interface PlaceOwner {
  offer(subjectRef: string, draft: PlaceDraft): void;
  open(subject: PlaceToolSubject): void;
  reread(subjectRef: string): void;
  /** [T-WORLDS §5 W3] land a world of your system on your planet: one BodySet on that world's register, on the revision read
   * (system/SystemReadings.tsx landWorld). Resolves with the owner's acknowledgement; rejects with its refusal. */
  land?(target: LandingTarget, lat: number, lon: number): Promise<string>;
}

const IDLE: PlaceToolState = {phase: 'idle', notice: null, tone: null};
let state: PlaceToolState = IDLE;
let owner: PlaceOwner | null = null;
const listeners = new Set<() => void>();

function set(next: PlaceToolState): void {
  state = next;
  for (const listener of [...listeners]) listener();
}

export function placeToolState(): PlaceToolState {
  return state;
}

export function subscribePlaceTool(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener) };
}

/** Bind (or, with null, release) the owner calls. Unbound, the tool refuses to arm and says why. */
export function bindPlaceOwner(next: PlaceOwner | null): void {
  owner = next;
  if (!next && (state.phase === 'armed' || state.phase === 'landing')) set(IDLE);
}

// ── the place kind: what the next click on the body places (manual §17.2 "Place kind: Place · Palace · Portal · Route") ──────────
//
// The view's own choice, as the body choice is (body/worldBody.ts chooseBody): it moves no owner state, and the M4 plate's Kind and the
// World device's Locations read and set the same one. A place and a palace are placed by the tool (a palace stands where its rooms'
// subjects are placed); a portal and a route have no owner that makes them from a click, and the tool says so when it is armed for one.

export const PLACE_KINDS = ['place', 'palace', 'portal', 'route'] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];
/** Why a kind is not placed by a click, in its owner's terms; null for the kinds the tool places. */
export const PLACE_KIND_WAITS: Readonly<Record<PlaceKind, string | null>> = {
  place: null,
  palace: null,
  portal: 'A portal leads through to another world: no owner opens one yet.',
  route: 'A route is the walk of a subject\'s TRAVELLED_TO places, each declared as a place: place its stops one by one.',
};
let kind: PlaceKind = 'place';
export const placeKindChoice = (): PlaceKind => kind;
export function choosePlaceKind(next: PlaceKind): void {
  if (next === kind || !(PLACE_KINDS as readonly string[]).includes(next)) return;
  kind = next;
  for (const listener of [...listeners]) listener();
}

/** The words the plate says when the tool cannot be armed for anything: no subject is chosen. */
export const NO_SUBJECT = 'Choose a subject on the Earth first: a place is declared by a subject, in its own time-and-place facts.';
export const NO_OWNER = 'The Earth is not open in this session, so there is no globe to place on.';

/** Arm the tool for a subject: the next click on the globe is its point. */
export function armPlaceTool(subject: PlaceToolSubject | null): void {
  if (!owner) { set({phase: 'idle', notice: NO_OWNER, tone: 'refused'}); return }
  const waits = PLACE_KIND_WAITS[kind];
  if (waits) { set({phase: 'idle', notice: waits, tone: 'refused'}); return }
  if (!subject) { set({phase: 'idle', notice: NO_SUBJECT, tone: 'refused'}); return }
  set({phase: 'armed', subject});
}

export function disarmPlaceTool(): void {
  if (state.phase !== 'idle' && state.phase !== 'saving') set(IDLE);
}

/** The words the plate says when a world cannot be landed: none is chosen, or the owner cannot take a landing in this pane. */
export const NO_LANDING_OWNER = 'Your system’s owners are not bound in this pane, so no world can be landed from here.';
export const LAND_ON_YOURS = 'A world lands on your planet: choose Your world as the body, then land it.';

/** Arm the tool to land a world of today's set on your planet: the next click on your planet is its landing. */
export function armLanding(target: LandingTarget | null): void {
  if (!owner?.land) { set({phase: 'idle', notice: NO_LANDING_OWNER, tone: 'refused'}); return }
  if (!target) { set({phase: 'idle', notice: 'Choose a world of today’s set to land.', tone: 'refused'}); return }
  set({phase: 'landing', target});
}

/** The draft a click at (lat, lon) offers for the armed subject, or the reason it offers none: on the body the globe draws, the body it
 * stands on and the name the World suggests from its seed ride with it. Pure. */
export function draftAt(subject: PlaceToolSubject, lat: number, lon: number, on: DrawnBody | null = null): {ok: true; draft: PlaceDraft; notice: string} | {ok: false; reason: string} {
  const made = earthDraftAt(subject, lat, lon, on);
  if (!made.ok || !on) return made;
  return {ok: true, draft: {...made.draft, body_ref: on.body_ref, name: suggestName(on, lat, lon)}, notice: made.notice};
}

function earthDraftAt(subject: PlaceToolSubject, lat: number, lon: number, on: DrawnBody | null): {ok: true; draft: PlaceDraft; notice: string} | {ok: false; reason: string} {
  if (subject.moving && on) return {ok: false, reason: `${subject.moving.name} stands on the Earth: choose Earth as the body to move it.`};
  if (subject.moving) {
    const moving = subject.moving;
    const proposed = moveProposal({graphNodeId: moving.place_ref, title: moving.name, precision: moving.precision, geometry: 'point',
      from: {latitude: moving.lat, longitude: moving.lon}, to: {latitude: lat, longitude: lon}, source_ref: moving.evidence});
    if (!proposed.ok) return {ok: false, reason: proposed.reason};
    const checked = validatePlaceDraft(placeDraftForMove(proposed.proposal));
    return checked.ok ? {ok: true, draft: checked.draft, notice: moveRouteNotice(proposed.proposal)} : {ok: false, reason: checked.reason};
  }
  const prefill = prefillFromClick({latitude: lat, longitude: lon});
  if (!prefill.ok) return {ok: false, reason: prefill.reason};
  const checked = validatePlaceDraft(placeDraftForAdd(prefill));
  return checked.ok ? {ok: true, draft: checked.draft, notice: addRouteNotice(prefill)} : {ok: false, reason: checked.reason};
}

/** Where the person goes on from an offered draft: the subject's own page, where the time-and-place editor stands. */
export function editorDirection(subject: PlaceToolSubject): string {
  return `Open ${subject.title} in Graph and source and choose Edit time and place: the draft is waiting there for ten minutes.`;
}

/** A click on the globe while the tool is armed: the draft is offered to the owner's editor, never written; on your body it stands on
 * your body (`on`, the body the globe draws). While a landing is armed, the click is the world's landing on your planet, written by its
 * owner. Off the globe (no point) nothing is drafted, and the plate says so. */
export function placeAt(point: {lat: number; lon: number} | null, on: DrawnBody | null = null): void {
  if (state.phase === 'landing') { void landAt(state.target, point, on); return }
  if (state.phase !== 'armed') return;
  const subject = state.subject;
  if (!point) { set({phase: 'idle', notice: 'The click was off the globe, so nothing was drafted. Press Place again and click the Earth.', tone: 'refused'}); return }
  const made = draftAt(subject, point.lat, point.lon, on);
  if (!made.ok) { set({phase: 'idle', notice: made.reason, tone: 'refused'}); return }
  if (!owner) { set({phase: 'idle', notice: NO_OWNER, tone: 'refused'}); return }
  try {
    owner.offer(subject.ref, made.draft);
  } catch (error) {
    set({phase: 'idle', notice: error instanceof Error ? error.message : String(error), tone: 'refused'});
    return;
  }
  set({phase: 'offered', subject, draft: made.draft, notice: `${made.notice} ${editorDirection(subject)}`});
}

/** The landing click: on your planet only, written through the landed world's owner, its answer said in its own words. */
async function landAt(target: LandingTarget, point: {lat: number; lon: number} | null, on: DrawnBody | null): Promise<void> {
  if (!point) { set({phase: 'idle', notice: `The click was off the globe, so ${target.name} did not land. Press Land again and click your planet.`, tone: 'refused'}); return }
  if (!on) { set({phase: 'idle', notice: LAND_ON_YOURS, tone: 'refused'}); return }
  if (!owner?.land) { set({phase: 'idle', notice: NO_LANDING_OWNER, tone: 'refused'}); return }
  set({phase: 'saving', target});
  try {
    const said = await owner.land(target, point.lat, point.lon);
    set({phase: 'idle', notice: said, tone: 'saved'});
  } catch (error) {
    set({phase: 'idle', notice: error instanceof Error ? error.message : String(error), tone: 'refused'});
  }
}

/** Open the offered subject where its editor stands (the plate's "Open the editor"). */
export function openOfferedEditor(): void {
  if (state.phase === 'offered' && owner) owner.open(state.subject);
}

/** The owner's answer to a route the tool offered (`oi:constellation-result` from the time-and-place editor): its words, verbatim on a
 * refusal; a save reads the world again so the place is drawn from the owner's own facts. An answer for another subject is not ours. */
export function placeAnswered(answer: {target?: {frame_ref?: unknown}; kind?: unknown; reason?: unknown}): void {
  if (state.phase !== 'offered' || answer.target?.frame_ref !== state.subject.ref) return;
  const subject = state.subject;
  const notice = constellationResultNotice(answer.kind === 'saved' ? {kind: 'saved'} : {kind: 'refused', reason: typeof answer.reason === 'string' ? answer.reason : null});
  set({phase: 'idle', notice: notice.text, tone: answer.kind === 'saved' ? 'saved' : 'refused'});
  if (notice.reload) owner?.reread(subject.ref);
}

/** A word from the tool's owner calls outside its own states (the editor could not be reached, the Earth could not redraw a saved
 * place in place): said on the plate, after whatever the tool last said. */
export function notePlaceTool(text: string): void {
  const before = state.phase === 'idle' ? state.notice : null;
  set({phase: 'idle', notice: before ? `${before} ${text}` : text, tone: state.phase === 'idle' ? state.tone ?? 'said' : 'said'});
}

/** The draft's point as the plate reads it. */
export function draftLine(draft: PlaceDraft): string {
  const named = draft.name ? `${draft.name}, ` : '';
  const body = draft.body_ref ? ` on your body (${draft.body_ref})` : '';
  return `${named}${draft.precision} point at ${formatCoordinate({latitude: draft.lat, longitude: draft.lon})}${body}${draft.from ? ` (moved from ${formatCoordinate({latitude: draft.from.lat, longitude: draft.from.lon})})` : ''}`;
}

/** For the tests: forget the tool's state and its owner. */
export function resetPlaceTool(): void {
  owner = null;
  kind = 'place';
  set(IDLE);
}
