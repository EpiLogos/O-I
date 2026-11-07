import type {NativeEditorReply} from '../../../../expressions-boundary/src/editor';
import {WORK_ACCESS_RETIRED, WORK_ACTOR, WorkNotMade, makeWork, worksHomeLocation} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/nativeWorking';
import type {Journey} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/model';
import {requireExpressionOutcome} from '../../../../../desktop/cradle/src/knowledge/expressionOutcome';
import type {CentralLocation} from '../../../../../desktop/cradle/src/kernel/types';
import type {ExpressionResult} from '../../../../../desktop/cradle/src/expression/types';
import {noteWorksSolo, syncSoloSilenced} from '../native/frameSound';
import {readFrameTakeLink} from '../native/frameTakes';

/** Models for the Expressions file and library commands in the shell. The
 * one transport, the Clip side's Scene controls and the Expressions browser make the owner calls; this module
 * decides what is offered, why an action is not, and what a reply may claim, and
 * holds the one open sequence (create, save_as, open) the browser's rows run. */

export interface SaveInput {
  /** The retained editor is attached to the presented Expression. */
  attached: boolean;
  busy: boolean;
  standing: {dirty: boolean; pending: boolean} | null;
}
export interface SaveState {disabled: boolean; reason: string | null}

/** Save commits the working edit to the native Expression: the owner's `save`
 * operation (hostEditor.ts commit). A saved native file is a separate act and
 * is not offered here. */
export function saveState(input: SaveInput): SaveState {
  if (!input.attached || !input.standing) return {disabled: true, reason: 'No native Expression is open to save.'};
  if (input.busy || input.standing.pending) return {disabled: true, reason: 'The native owner is still answering the last request.'};
  if (!input.standing.dirty) return {disabled: true, reason: 'Nothing to save: this Expression matches the native owner.'};
  return {disabled: false, reason: null};
}

/** "Saved" is said only when the owner's own reading reports a clean draft after a successful save. */
export function saveNotice(reply: Extract<NativeEditorReply, {ok: true}>): string {
  return reply.reading.standing.dirty
    ? 'The native owner answered, but this draft still differs from it. Nothing is marked saved.'
    : 'Saved to the native Expression.';
}

export type CollectionGroup = 'Featured' | 'Material' | 'Composition' | 'Native' | 'Source studies';
export interface CollectionItem {id: string; name: string; description: string; group: CollectionGroup}
export interface CollectionRow {id: string; name: string; description: string}
export interface CollectionSection {id: 'featured' | 'starters' | 'presets'; title: string; rows: CollectionRow[]}

/** The app's own groups (expressions.ts startingPoints and featuredExpressions).
 * Starters are the starting material; presets are the built-in compositions and
 * factory configurations. Every row opens (openStarter below). */
export function collectionSections(items: readonly CollectionItem[], query: string): CollectionSection[] {
  const needle = query.trim().toLocaleLowerCase();
  const section = (id: CollectionSection['id'], title: string, groups: readonly CollectionGroup[]): CollectionSection => ({id, title,
    rows: items.filter(item => groups.includes(item.group) && (!needle || `${item.name} ${item.description}`.toLocaleLowerCase().includes(needle)))
      .map(item => ({id: item.id, name: item.name, description: item.description}))});
  return [section('featured', 'Featured', ['Featured']), section('starters', 'Starters', ['Material', 'Source studies']),
    section('presets', 'Built-in presets', ['Composition', 'Native'])];
}

/** --- Open: Featured, Starters, presets and New ----------------------------------------------------------------
 * The shell binds the native owner's operations; it never holds a document. Every write below is a kernel-expression
 * request (create, edit, save_as, open_file) whose reply is read back before it is believed. */

/** The kernel-expression owner channel: the Expressions panel's `owners.channels['kernel-expression']` bound to its
 * context (panels/expressions.tsx). The browser reaches the owner only through the panel that holds it. */
export type ExpressionChannel = (request: Record<string, unknown>) => Promise<unknown>;
let ownerChannel: ExpressionChannel | null = null;
/** The works home as the owner disclosed it on the last list (the `save_as` parent); a new channel lists it afresh. */
let listedHome: WorksHome | null = null;
/** The panel registers its channel while its native access stands, and withdraws it on teardown (precedent:
 * live/torusInstrument.ts setLiveInstrumentCommander). */
export function setExpressionOwner(channel: ExpressionChannel | null): void {ownerChannel = channel; listedHome = null;}
export function expressionOwner(): ExpressionChannel | null {return ownerChannel;}

/** The frame's own actor on every native write (nativeWorking.ts WORK_ACTOR, nativeMaterials.ts:43). */
export const OPEN_ACTOR = WORK_ACTOR;
export const OWNER_UNATTACHED = 'The native Expressions owner is not attached yet. Open Expressions once it has loaded, then try again.';
export const ACCESS_RETIRED = WORK_ACCESS_RETIRED;

/** One row of the owner's `list` (oi.expression-list/v1). An open work is held by the owner. A closed one (`open: false`) lives
 * only as its file in the owner's works home (kernel expression_home.rs WORKS_HOME, FOUNDATION N1) and opens from that file
 * (openListedWork). A home file the owner could not read is a closed row under the file's own ref and name with the owner's
 * `error`, so the browser shows it rather than dropping it. */
export interface NativeWorkRow {expression_ref: string; title: string; revision: number; open?: boolean; location?: CentralLocation; file_revision?: string; error?: string
  /** An open work its document keeps soloed (O-I #747 round 886: the owner's list says `solo: true`; absent otherwise). */
  solo?: boolean}
/** A work that lives only as its file in the works home. */
export type ClosedWork = NativeWorkRow & {open: false; location: CentralLocation}
interface WorksHome {path?: string; state?: string; location?: CentralLocation; error?: string}
interface WorksReading {expressions?: NativeWorkRow[]; unreadable?: {name: string; location: CentralLocation; error: string}[]; home?: WorksHome}

/** Lists the owner's works and publishes them (workspace.publishWorks), so the browser's works and Technē's Sources
 * show them while any work is open: the works the owner holds, then the works that live only as files in its works home,
 * then the home files it could not read. A retired access publishes nothing (the panel's former inline `enumerate`). */
export async function enumerateWorks(channel: ExpressionChannel, publish: (works: NativeWorkRow[]) => void, current: () => boolean): Promise<NativeWorkRow[]> {
  const inventory = await channel({operation: 'list'}) as WorksReading | null;
  if (!current()) return [];
  listedHome = inventory?.home ?? null;
  const unreadable: NativeWorkRow[] = (inventory?.unreadable ?? []).map(file => ({expression_ref: file.location.ref, title: file.name, revision: 0, open: false, location: file.location, error: file.error}));
  const works = [...(inventory?.expressions ?? []), ...unreadable];
  publish(works);
  // Which open works are soloed (round 886): the open Expression's frame hears itself silenced while another is (frameSound.ts).
  noteWorksSolo(works);
  void syncSoloSilenced(readFrameTakeLink()).catch(() => {});
  return works;
}

/** The parent every new or opened work is saved into: the works home's location as the owner disclosed it on its last list
 * (the home is named once, in the kernel), listed afresh when none is held. A home the owner could not list refuses with
 * the owner's own reason. */
export async function worksHome(channel: ExpressionChannel): Promise<CentralLocation> {
  return worksHomeLocation(listedHome?.location ? listedHome : (await channel({operation: 'list'}) as WorksReading | null)?.home)
}

/** The row the published works list holds for `ref` when that work lives only as its file in the works home, else null. */
export function closedWork(works: readonly object[], ref: string): ClosedWork | null {
  const work = works.find(row => (row as NativeWorkRow).expression_ref === ref) as NativeWorkRow | undefined;
  return work?.open === false && work.location ? work as ClosedWork : null;
}

/** Open a work that lives only as its file in the works home: the owner's own `open_file` at the listed location and file
 * revision (the port of knowledge/constructionProjection.ts:180 reopenComposition), so the owner holds the work before a
 * door presents it by ref. A live draft of the same work the owner already holds stands (the owner never replaces an open
 * draft implicitly, expression.rs `open`). Any refusal, a file changed since the list among them, throws the owner's own
 * text; a home file the owner could not read throws its listed error and sends nothing. */
export async function openListedWork(channel: ExpressionChannel, work: ClosedWork): Promise<void> {
  if (work.error) throw Error(`${work.title} could not be read from the works home: ${work.error}`);
  const reply = await channel({operation: 'open_file', location: work.location, ...(work.file_revision ? {expected_file_revision: work.file_revision} : {}),
    actor: OPEN_ACTOR}) as ExpressionResult | null;
  if (reply?.state === 'revision_conflict' && reply.expression_ref === work.expression_ref) return;
  requireExpressionOutcome(reply as ExpressionResult, 'Expression open');
  if (reply?.state !== 'ready' || reply.document?.expression_ref !== work.expression_ref) throw Error(`Expression open: the native owner did not open ${work.title} from its file (${reply?.state ?? 'no state'}).`);
}

/** A presented work the published list does not hold is listed once per distinct ref: a work made after boot (New, an
 * opened starter, a frame Save) reaches the list without a loop on a ref the owner does not list. */
export function needsListing(presented: string | null | undefined, listedFor: string | null, works: readonly {expression_ref: string}[]): boolean {
  return !!presented && presented !== listedFor && !works.some(work => work.expression_ref === presented);
}

/** A document a listed work moved to (O-I #747 round 890): its work and the revision it stands at now. */
export interface MovedWork {readonly expression_ref: string; readonly revision: number}

/** The documents the kernel's receipts say moved: each `expression_changed` receipt's work and revision (kernel events.rs
 * ExpressionChanged {expression_ref, revision}). Any other receipt, or one not of that shape, says nothing. Pure. */
export function movedWorks(receipts: readonly {readonly event?: unknown; readonly expression_ref?: unknown; readonly revision?: unknown}[]): MovedWork[] {
  return receipts.flatMap(receipt => receipt.event === 'expression_changed' && typeof receipt.expression_ref === 'string'
    && Number.isSafeInteger(receipt.revision) ? [{expression_ref: receipt.expression_ref, revision: receipt.revision as number}] : [])
}

/** The Works list is a reading that follows the documents it lists (round 890): the moved documents whose row stands behind them, each
 * not yet asked for at that revision (`asked`), so a list that lags its document is asked once per revision told, never in a loop. Pure. */
export function worksBehind(works: readonly {readonly expression_ref: string; readonly revision: number}[], moved: readonly MovedWork[],
  asked: ReadonlyMap<string, number> = new Map()): MovedWork[] {
  return moved.filter(work => asked.get(work.expression_ref) !== work.revision
    && works.some(row => row.expression_ref === work.expression_ref && row.revision < work.revision))
}

/** A fresh title that does not repeat one the works list already shows. */
export function freshTitle(base: string, taken: readonly string[]): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base} ${n}`)) return `${base} ${n}`;
}

export interface OpenPorts {
  /** The owner channel, or null while the panel has not attached it. */
  expression: ExpressionChannel | null;
  /** The owner's works home for a saved work (worksHome: the location the owner's list discloses), or null: the open then
   * commits and opens the work and saves no file. */
  parent: (() => Promise<CentralLocation>) | null;
  uuid(): string;
  /** False once the native access that began this open is retired. */
  current(): boolean;
  /** List the owner's works and publish them. */
  refresh(): Promise<unknown>;
  /** The panel's open door (workspace.requestExpression). */
  open(ref: string): void;
}
/** ok: the work is a native Expression the owner holds and the open door was asked for it. `saved` is the file the owner wrote
 * and read back; `refused` is the owner's own text when it would not save the file (the work still stands, unsaved to a file);
 * `warning` is a works list that could not refresh. !ok: the sequence stopped before the open; `expression_ref` names a work
 * the owner may already hold. */
export type OpenOutcome =
  | {ok: true; expression_ref: string; title: string; saved: {path: string; revision: string} | null; refused: string | null; warning: string | null}
  | {ok: false; error: string; expression_ref: string | null};

const failure = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause);
/** A list refresh that follows a settled outcome: its failure is a warning beside the outcome, never a replacement for it. */
const refreshed = (ports: OpenPorts): Promise<string | null> =>
  ports.refresh().then(() => null, cause => `The works list could not be refreshed: ${failure(cause)}`);
/** A work made by New's one route (the frame's nativeWorking.ts makeWork: made, then saved into the works home `ports.parent`), then the
 * open door, then the works list read again. A refused file save does not take the work back: the owner holds a committed native
 * Expression (the frame keeps a native commit and a saved file as separate acts, ABOUT.kept), so the work opens and the row
 * carries the owner's refusal. A refused create or edit stops before the open, naming a work the owner may already hold. */
async function openMade(ports: OpenPorts, channel: ExpressionChannel, made: {journey: Journey} | {title: string}): Promise<OpenOutcome> {
  try {
    const {document, saved, refused} = await makeWork(channel, made, {id: ports.uuid(), home: ports.parent, current: () => ports.current()})
    if (!ports.current()) throw new WorkNotMade(ACCESS_RETIRED, document.expression_ref)
    ports.open(document.expression_ref)
    return {ok: true, expression_ref: document.expression_ref, title: document.title, saved, refused, warning: await refreshed(ports)}
  } catch (cause) {
    await refreshed(ports)
    return {ok: false, error: failure(cause), expression_ref: cause instanceof WorkNotMade ? cause.expression_ref : null}
  }
}

/** Open on a Featured, Starter or preset row: the starter is made a work by New's one route — the frame's own native commit of the forked
 * starter (nativeWorking.ts commitRecorded: create, then the composition edit built by kernelComposition.ts prepareCompositionEdit), then
 * save_as into the owner's works home (actPanel.ts:132-136, nativeMaterials.ts:271), so the work is listed again after a restart — then
 * the open door. `journey` is the starter already forked (expressions.ts:42 forkExpression), so its identity is fresh. fork is not used
 * here: its source must be a document the owner already holds, and a starter is the frame's own Journey, not an owner document. */
export async function openStarter(ports: OpenPorts, journey: Journey): Promise<OpenOutcome> {
  const channel = ports.expression;
  if (!channel) return {ok: false, error: OWNER_UNATTACHED, expression_ref: null};
  return openMade(ports, channel, {journey});
}

/** New: an empty work of one Scene by New's one route — one create with a fresh ref and title (nativeWorking.ts makeWork), then save_as
 * into the works home at once, so New is listed again after a restart (FOUNDATION N1) — then the open door. A refused file save leaves
 * the work open with the owner's text, as in openStarter. */
export async function newExpression(ports: OpenPorts, title: string): Promise<OpenOutcome> {
  const channel = ports.expression;
  if (!channel) return {ok: false, error: OWNER_UNATTACHED, expression_ref: null};
  return openMade(ports, channel, {title});
}

/** Shell help copy. The quick guide is the app's own text (field-studies-journeys/src/shell.ts, the guide dialog): Help › Expressions Guide,
 * in the DLW manual's words (§20.1 Expressions: tracks and clips; round 869). */
export const QUICK_GUIDE: readonly {heading: string; text: string}[] = [
  {heading: 'Start an Expression', text: 'Each Expression is a track, and its scenes are its clips. Start one in the browser, from nothing or from a composition: the library and its starters. Name and describe it on its track’s head.'},
  {heading: 'Shape a scene in Clip view', text: 'Select a scene and Clip view opens its sequence, each symbol in its own lane and the scene’s sound beneath it. The Expression tab shapes one symbol: its formation, force, voice and meaning. The Sequence tab sets the scene’s symbols step by step, and Envelopes move parameters over the scene by themselves.'},
  {heading: 'Play the Studio in Device view', text: 'Device view holds the Studio: the controls you chose to play, as its macros, the same in every scene, and its four chains, Material, Motion, Body and Nara. + Parameter on the Studio chooses a control to play. After the Studio stands the Acts device, for the parts a scene’s objects play.'},
  {heading: 'Launch scenes and keep takes', text: 'Launch, layer and stop scenes in Session view: a row of the Main track is a stop. Arm the Expression and press Play to record a take. Takes lie under its track in Arrangement view, where you lay scenes in order. Capture in the transport keeps your last gestures as a new scene.'},
  {heading: 'Show and export the field', text: 'Present, in the View menu, gives the field the whole screen; Esc brings the window back. Export, in the File menu, writes a picture, a film or the Expression itself to a file.'},
];
export const QUICK_GUIDE_STANDING = 'Sound and picture are two sides of one state. Edit one and the other follows.';

/** The shortcuts the shell binds, each with the handler that binds it. */
export const BOUND_SHORTCUTS: readonly {keys: string; action: string; source: string}[] = [
  {keys: 'Space', action: 'Play or pause the working Scene, when no control has focus', source: 'useExpressionsTransport.tsx'},
  {keys: 'Ctrl or ⌘ S', action: 'Save the open Expression to the native owner', source: 'sceneKeepers.ts'},
  {keys: '← → ↑ ↓ Home End', action: 'Seek the working Scene on the position slider (Shift steps 1 s)', source: 'useExpressionsTransport.tsx'},
  {keys: 'Tab', action: 'Switch Session and Arrangement in the Expressions, session and arrangement views, outside text fields', source: 'App.tsx'},
  {keys: '⌘ Option B', action: 'Show or hide the browser', source: 'App.tsx'},
  {keys: '⌘ Option L', action: 'Show or hide the detail panel', source: 'App.tsx'},
  {keys: '⌘ ,', action: 'Open Preferences', source: 'App.tsx'},
  {keys: '↑ ↓ Home End', action: 'Move between browser rows; Esc clears the browser search', source: 'WorldBrowser.tsx'},
  {keys: 'Space, then Enter', action: 'Preview a saved work, then open it', source: 'WorldBrowser.tsx'},
];

/** About copy, from the app's About section (expressions.ts libraryHTML). */
export const ABOUT = {
  title: 'A field to inhabit. A space to compose.',
  lede: 'Place, shape, relate, animate, capture. An expression holds the whole composition: its scenes, material, relationships and passage through time.',
  living: 'The native GPU engine carries persistent particles through shared forces, local sequences and continuous resonance. Selecting an object inspects it; it does not tune the field.',
  editable: 'Every starting point opens as editable composition data. Branch an expression, change its entities, or shape a completely different performance.',
  kept: 'Browser draft / autosave stays in this browser. A saved Scene is a named composition snapshot. A committed native Expression and a saved native file are separate durable acts. Publication is another step again.',
};
