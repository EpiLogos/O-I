import type {NativeEditorReply} from '../../../../expressions-boundary/src/editor';
import {NativeWorking} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/nativeWorking';
import type {Journey} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/model';
import {materialFileName} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/reuse';
import {requireExpressionOutcome} from '../../../../../desktop/cradle/src/knowledge/expressionOutcome';
import {requireSavedExpression} from '../../../../../desktop/cradle/src/knowledge/expressionSaveReceipt';
import type {CentralLocation} from '../../../../../desktop/cradle/src/kernel/types';
import type {ExpressionResult} from '../../../../../desktop/cradle/src/expression/types';

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

/** The frame's own actor on every native write (nativeWorking.ts:380, nativeMaterials.ts:43). */
export const OPEN_ACTOR = 'human:expressions-app';
export const OWNER_UNATTACHED = 'The native Expressions owner is not attached yet. Open Expressions once it has loaded, then try again.';
export const ACCESS_RETIRED = 'The native access changed before this finished. Nothing further was written; read the works list before trying again.';

/** One row of the owner's `list` (oi.expression-list/v1). An open work is held by the owner. A closed one (`open: false`) lives
 * only as its file in the owner's works home (kernel expression_home.rs WORKS_HOME, FOUNDATION N1) and opens from that file
 * (openListedWork). A home file the owner could not read is a closed row under the file's own ref and name with the owner's
 * `error`, so the browser shows it rather than dropping it. */
export interface NativeWorkRow {expression_ref: string; title: string; revision: number; open?: boolean; location?: CentralLocation; file_revision?: string; error?: string}
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
  return works;
}

/** The parent every new or opened work is saved into: the works home's location as the owner disclosed it on its last list
 * (the home is named once, in the kernel), listed afresh when none is held. A home the owner could not list refuses with
 * the owner's own reason. */
export async function worksHome(channel: ExpressionChannel): Promise<CentralLocation> {
  const home = listedHome?.location ? listedHome : (await channel({operation: 'list'}) as WorksReading | null)?.home;
  if (home?.location) return home.location;
  throw Error(home?.error ? `The works home ${home.path ?? ''} is unavailable: ${home.error}` : 'The native owner disclosed no works home.');
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
const unusedFile = (): Promise<never> => Promise.reject(Error('The shell saves through the kernel-expression save_as, not the frame file port.'));
/** A list refresh that follows a settled outcome: its failure is a warning beside the outcome, never a replacement for it. */
const refreshed = (ports: OpenPorts): Promise<string | null> =>
  ports.refresh().then(() => null, cause => `The works list could not be refreshed: ${failure(cause)}`);
/** save_as into the works home (`ports.parent`): the file the owner wrote and read back, or the owner's own refusal. A
 * refused save does not take the work back: the owner holds a committed native Expression (the frame keeps a native commit
 * and a saved file as separate acts, QUICK_GUIDE_STANDING). */
async function saveIntoHome(ports: OpenPorts, channel: ExpressionChannel, document: {expression_ref: string; revision: number}, name: string, id: string): Promise<{saved: {path: string; revision: string} | null; refused: string | null}> {
  if (!ports.parent) return {saved: null, refused: null};
  try {
    const parent = await ports.parent();
    const reply = await channel({operation: 'save_as', expression_ref: document.expression_ref, expected_revision: document.revision, parent,
      name: materialFileName(name), operation_ref: `operation:expression:${id}`, actor: OPEN_ACTOR, actor_kind: 'human'}) as ExpressionResult;
    requireSavedExpression(reply);
    return {saved: {path: reply.file.location.path, revision: reply.file.revision}, refused: null};
  } catch (cause) {return {saved: null, refused: failure(cause)};}
}

/** Open on a Featured, Starter or preset row. The sequence is the frame's own native commit of a forked starter
 * (field-studies-journeys/src/nativeWorking.ts:367 commitRecorded: create, then the composition edit built by
 * kernelComposition.ts:55 prepareCompositionEdit), then save_as into the owner's works home (actPanel.ts:132-136,
 * nativeMaterials.ts:271), so the work is listed again after a restart, then the open door. `journey` is the starter already forked (expressions.ts:42
 * forkExpression), so its identity is fresh. A refusal of the create or the edit stops the sequence with the owner's own
 * text. A refusal of the file save does not take the work back: the owner holds a committed native Expression (the frame
 * keeps a native commit and a saved file as separate acts, QUICK_GUIDE_STANDING), so the work opens and the row carries
 * the owner's refusal. fork is not used here: its source must be a document the owner already holds, and a starter is the
 * frame's own Journey, not an owner document. */
export async function openStarter(ports: OpenPorts, journey: Journey): Promise<OpenOutcome> {
  const channel = ports.expression;
  if (!channel) return {ok: false, error: OWNER_UNATTACHED, expression_ref: null};
  const id = ports.uuid(), ref = `expression:authored-${id}`;
  const working = new NativeWorking({expression: channel, file: unusedFile, checkpoint: async () => undefined, mint: () => ref});
  try {
    const document = await working.commit({journey, sceneId: journey.scenes[0].id, entityId: null});
    if (!ports.current()) throw Error(ACCESS_RETIRED);
    const {saved, refused} = await saveIntoHome(ports, channel, document, `${journey.name} ${id.slice(0, 8)}`, id);
    if (!ports.current()) throw Error(ACCESS_RETIRED);
    ports.open(document.expression_ref);
    return {ok: true, expression_ref: document.expression_ref, title: document.title, saved, refused, warning: await refreshed(ports)};
  } catch (cause) {
    await refreshed(ports);
    return {ok: false, error: failure(cause), expression_ref: working.state?.view?.document.expression_ref ?? null};
  }
}

/** New: one create with a fresh ref and title (nativeWorking.ts:380 is the frame's create), then save_as into the works
 * home at once, so New is listed again after a restart (FOUNDATION N1), then the open door. The work is one empty Scene. A
 * refused file save leaves the work open with the owner's text, as in openStarter. */
export async function newExpression(ports: OpenPorts, title: string): Promise<OpenOutcome> {
  const channel = ports.expression;
  if (!channel) return {ok: false, error: OWNER_UNATTACHED, expression_ref: null};
  const id = ports.uuid(), ref = `expression:authored-${id}`;
  try {
    const created = await channel({operation: 'create', expression_ref: ref, title, actor: OPEN_ACTOR}) as ExpressionResult;
    requireExpressionOutcome(created, 'Expression create');
    if (created?.state !== 'ready' || created.document?.expression_ref !== ref) throw Error(`Expression create: the native owner did not return the new Expression (${created?.state ?? 'no state'}).`);
    if (!ports.current()) throw Error(ACCESS_RETIRED);
    const {saved, refused} = await saveIntoHome(ports, channel, created.document, `${title} ${id.slice(0, 8)}`, id);
    if (!ports.current()) throw Error(ACCESS_RETIRED);
    ports.open(ref);
    return {ok: true, expression_ref: ref, title: created.document.title, saved, refused, warning: await refreshed(ports)};
  } catch (cause) {
    await refreshed(ports);
    return {ok: false, error: failure(cause), expression_ref: null};
  }
}

/** Shell help copy. The quick guide is the app's own text (field-studies-journeys/src/shell.ts, the guide dialog). */
export const QUICK_GUIDE: readonly {heading: string; text: string}[] = [
  {heading: 'Shape the setup', text: 'Place a formation. Edit its glyph sequence on the left. Use the framed image icon at top right to create image or ASCII states. Pin useful controls to the expression’s shared toolbelt on the right.'},
  {heading: 'Save a scene', text: 'Open Scenes, give this setup a name, then Save scene. This fixes a saved version of its settings, formations and camera. Later edits remain a draft until you save again.'},
  {heading: 'Make the next scene', text: 'Save & make next copies this setup. Tweak the copy; your previous saved scene stays intact. In Formation sequence, “Add state to earlier scene” folds a refined object back into a sequence. Set duration and the incoming transition, then save.'},
  {heading: 'Play and keep the expression', text: 'Play saved scenes in order. Glyph sequences run inside each scene. The library keeps browser drafts in this browser; a saved Scene is not yet a committed native Expression. Export JSON or living HTML for a portable copy; commit/save native separately when hosted.'},
];
export const QUICK_GUIDE_STANDING = 'Browser draft ≠ saved Scene ≠ committed native Expression ≠ saved native file ≠ publication.';

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
