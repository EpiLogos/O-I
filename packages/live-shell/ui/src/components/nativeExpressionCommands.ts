import type {NativeEditorReply} from '../../../../expressions-boundary/src/editor';
import {WORK_ACCESS_RETIRED, WORK_ACTOR, WorkNotMade, makeWork, saveIntoWorksHome, worksHomeLocation} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/nativeWorking';
import {blankJourney, type Journey} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/model';
import {requireExpressionOutcome} from '../../../../../desktop/cradle/src/knowledge/expressionOutcome';
import type {CentralLocation} from '../../../../../desktop/cradle/src/kernel/types';
import type {ExpressionRequest, ExpressionResult} from '../../../../../desktop/cradle/src/expression/types';
import {noteWorksSolo, syncSoloSilenced} from '../native/frameSound';
import {readFrameTakeLink} from '../native/frameTakes';
import type {InfoOffer} from '../frame/devices/deviceHost';
import {kernelPress} from '../../../../../desktop/cradle/src/kernel/bridge';
import type {KernelOp, KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types';
import type {DayReturnOffer} from '../../../../../desktop/cradle/src/expressions/naraChannel';

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
/** The person's press channel (O-I #747 round 895, DLW build ruling 2026-11-09, 0b.2): a Delete or a trigger's Run goes to the owner by the
 * desktop host's own press path (kernel lib.rs `person_press`, the host's `kernel_press`), the one way in the kernel carries the person's
 * token by. The frame's channel, the agents' socket and the bridge carry none, so a press never goes by the owner channel above. */
let pressChannelHeld: ExpressionChannel | null = null;
export function setExpressionPress(channel: ExpressionChannel | null): void {pressChannelHeld = channel;}
export function expressionPress(): ExpressionChannel | null {return pressChannelHeld;}
/** The press channel over a transport: the owner's answer to the press, or its refusal thrown in words (a browser stack has no press path). */
export function pressChannel(transport: KernelTransportStatus): ExpressionChannel {
  return async request => {
    const call = await kernelPress(transport, {op: 'expression', request} as KernelOp);
    if (call.error || !call.outcome || call.outcome.result !== 'expression') throw Error(call.error ?? 'The native owner did not answer the press.');
    return (call.outcome as unknown as {data: unknown}).data;
  };
}
/** The workspace's side of a work's track acts (Duplicate, Delete; round 894), registered by the Expressions panel beside its owner channel
 * and withdrawn with it: the works list as published, publishing a list read again, the one open door (Live reveals Expressions first, as a
 * works row does), and whether the native access that registered it still stands. */
export interface WorksDoor {works(): readonly NativeWorkRow[]; publish(works: NativeWorkRow[]): void; open(ref: string): void; current(): boolean
  /** A work the owner deleted to Central's trash: the panel closes it where it is presented or waits to open (round 895). */
  deleted(ref: string, words: string): void
  /** The person's Delete of `ref`, asked of the frame at the press (frameDeleteHold): whether it holds edits of that work its owner does not
   * hold yet, read afresh, with the work held in the frame from then; or why the frame could not say (0b.4; round 896, 0R-surface.2). */
  hold(ref: string): Promise<DeleteHold>
  /** The owner answered the Delete: the frame takes edits of the work again. */
  release(ref: string): void}
/** The frame's answer to a Delete's ask (expressions-boundary host.ts holdForDelete). */
export type DeleteHold = {readonly ok: true; readonly unsaved: boolean} | {readonly ok: false; readonly error: string}
/** The panel's side of a Delete's ask, over the frame it mounts (round 896, 0R-surface.2): the frame is asked afresh at the press, never its
 * last announcement; with no frame mounted no draft holds edits here, so nothing waits. */
export function frameDeleteHold(host: () => {holdForDelete(ref: string): Promise<DeleteHold>; releaseDelete(ref: string): void} | null | undefined): Pick<WorksDoor, 'hold' | 'release'> {
  return {
    hold: async ref => {const frame = host(); return frame ? frame.holdForDelete(ref) : {ok: true, unsaved: false}},
    release: ref => host()?.releaseDelete(ref),
  }
}
let worksDoor: WorksDoor | null = null;
export function setWorksDoor(door: WorksDoor | null): void {worksDoor = door;}
/** The ports a track act runs on, over the panel's owner channel and the workspace's door; null while no panel holds them. */
export function worksPorts(): {ports: OpenPorts; works: () => readonly NativeWorkRow[]} | null {
  const channel = ownerChannel, door = worksDoor;
  if (!channel || !door) return null;
  return {works: () => door.works(), ports: {expression: channel, press: pressChannelHeld, parent: () => worksHome(channel), uuid: () => crypto.randomUUID(), current: () => door.current(),
    refresh: () => enumerateWorks(channel, works => door.publish(works), () => door.current()), open: ref => door.open(ref), deleted: (ref, words) => door.deleted(ref, words),
    hold: ref => door.hold(ref), release: ref => door.release(ref)}};
}

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
  /** The panel's close of a work the owner deleted (WorksDoor.deleted); absent where no panel presents works. */
  deleted?(ref: string, words: string): void;
  /** The person's press channel (expressionPress), for a Delete; absent or null where the panel holds none. */
  press?: ExpressionChannel | null;
  /** A Delete's ask of the frame (WorksDoor.hold) and its release; absent: no frame holds edits here. */
  hold?(ref: string): Promise<DeleteHold>;
  release?(ref: string): void;
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
const refreshed = (ports: Pick<OpenPorts, 'refresh'>): Promise<string | null> =>
  ports.refresh().then(() => null, cause => `The works list could not be refreshed: ${failure(cause)}`);
/** A work made by New's one route (the frame's nativeWorking.ts makeWork: made, then saved into the works home `ports.parent`), then the
 * open door, then the works list read again. A refused file save does not take the work back: the owner holds a committed native
 * Expression (the frame keeps a native commit and a saved file as separate acts, ABOUT.kept), so the work opens and the row
 * carries the owner's refusal. A refused create or edit stops before the open, naming a work the owner may already hold. */
async function openMade(ports: OpenPorts, channel: ExpressionChannel, made: {journey: Journey}): Promise<OpenOutcome> {
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

/** New: an empty work of one Scene by New's one route (nativeWorking.ts makeWork), then save_as into the works home at once, so New is
 * listed again after a restart (FOUNDATION N1), then the open door. A refused file save leaves the work open with the owner's text, as in
 * openStarter. The work is the frame's blank Journey under `title`: its one Scene is the frame's blank scene, as a scene added in the
 * Clip panel is (expressions-boundary sceneEdits.ts `add`), so it keeps the blank scene's authored pacing with nothing placed and plays
 * (XF01, walk #857, O-I #747 round 893: the owner's bare create held no Scene material, and Play could not be pressed; manual §20.14,
 * an empty scene is still a scene). */
export async function newExpression(ports: OpenPorts, title: string): Promise<OpenOutcome> {
  const channel = ports.expression;
  if (!channel) return {ok: false, error: OWNER_UNATTACHED, expression_ref: null};
  return openMade(ports, channel, {journey: {...blankJourney(), name: title}});
}

/** --- A work's track acts: Duplicate and Delete ---------------------------------------------------------------------
 * Manual §10.9: a track's acts are Rename (⌘R), Duplicate (⌘D) and Delete (⌫); §20.1: in Expressions a track is an Expression. Both run
 * the owner's own operations (O-I #747 round 894, the port ledger's fork-saved and delete-saved). */

/** Duplicate: the owner's fork of the work under a fresh ref (`expression:authored-<id>`, as New mints), named a second of its title as the
 * browser names one (freshTitle), saved into the works home by save_as (the file name as New's: the title and the id's first eight
 * characters), then the open door and the works list again. A work listed only as its file is opened from it first (openListedWork), as
 * its row opens it. A refused step stops there with the owner's words, naming the copy where the owner already holds it; a refused file
 * save leaves the copy open with the owner's words, as New does. */
export async function duplicateWork(ports: OpenPorts, works: readonly NativeWorkRow[], ref: string): Promise<OpenOutcome> {
  const channel = ports.expression;
  if (!channel) return {ok: false, error: OWNER_UNATTACHED, expression_ref: null};
  let copy: string | null = null;
  try {
    const closed = closedWork(works, ref);
    if (closed) await openListedWork(channel, closed);
    const read = await channel({operation: 'inspect', expression_ref: ref}) as ExpressionResult;
    requireExpressionOutcome(read, 'Expression read');
    const source = read.document as {title?: unknown; revision?: unknown} | undefined;
    if (typeof source?.title !== 'string' || typeof source.revision !== 'number') throw Error('Expression read: the native owner returned no document to duplicate.');
    const id = ports.uuid(), fork = `expression:authored-${id}`;
    const forked = await channel({operation: 'fork', expression_ref: ref, expected_revision: source.revision, new_expression_ref: fork, actor: OPEN_ACTOR}) as ExpressionResult;
    requireExpressionOutcome(forked, 'Expression duplicate');
    const made = forked.document as {expression_ref?: unknown; revision?: unknown} | undefined;
    if (forked.state !== 'ready' || made?.expression_ref !== fork || typeof made.revision !== 'number') throw Error(`Expression duplicate: the native owner did not hold the copy (${forked.state ?? 'no state'}).`);
    copy = fork;
    const title = freshTitle(source.title, works.map(work => work.title));
    let revision = made.revision;
    if (title !== source.title) {
      const renamed = await channel({operation: 'edit', expression_ref: fork, expected_revision: revision, actor: OPEN_ACTOR, changes: [{change: 'rename', title}]}) as ExpressionResult;
      requireExpressionOutcome(renamed, 'Expression rename');
      revision = (renamed.document as {revision?: number} | undefined)?.revision ?? revision + 1;
    }
    if (!ports.current()) throw new WorkNotMade(ACCESS_RETIRED, fork);
    // Saved into the works home by New's route's own step (nativeWorking.ts saveIntoWorksHome): the one save_as of the route.
    const {saved, refused} = ports.parent ? await saveIntoWorksHome(channel, {expression_ref: fork, revision, title}, id, ports.parent) : {saved: null, refused: null};
    ports.open(fork);
    return {ok: true, expression_ref: fork, title, saved, refused, warning: await refreshed(ports)};
  } catch (cause) {
    await refreshed(ports);
    return {ok: false, error: failure(cause), expression_ref: cause instanceof WorkNotMade ? cause.expression_ref : copy};
  }
}

/** Delete: the owner's delete of the work (kernel expression.rs Request::Delete): its file leaves the works home for Central's trash on
 * the revision read, by the person's own press in their window (the press channel, `ports.press`: the host's own press path carries the
 * person's token, and no other way does; DLW build ruling 2026-11-09, 0b.2), and the owner lets go of it; the panel closes it where it is
 * presented or waits to open (`ports.deleted`), then the works list again. A work listed only as its file names its file and the revision
 * read. Delete never drops edits the owner does not hold yet (0b.4; round 896, 0R-surface.2): at the press the frame is asked afresh whether it
 * holds any of that work, whatever scene the field stands on (`ports.hold`), and a Delete it cannot ask, or one it answers yes, is refused in
 * words; from the ask until the owner answers, the frame takes no edit of the work (`ports.release` lets it go). The owner's refusal
 * (unsaved changes, a file outside the works home, a file that moved, Central's own) is said in its words, a conflict with the remedy the
 * owner names for it (an open work: close it and open it again). Central's file history brings it back (the answer's `recover`:
 * central.files.restore of the revision trashed), as a page's Delete says. */
export const UNSAVED_DELETE = 'Save or discard its changes first.';
/** A second Delete of a work whose Delete waits for Central's answer, in words (O-I #747 round 896, 1R-surface.4). */
export const DELETE_IN_FLIGHT = "is being deleted already: wait for Central's answer before you delete it again.";
/** The works whose Delete waits for the owner's answer: one Delete at a time per work (1R-surface.4). */
const deleting = new Set<string>();
export async function deleteWork(ports: Pick<OpenPorts, 'expression' | 'press' | 'refresh' | 'deleted' | 'hold' | 'release'>, works: readonly NativeWorkRow[], ref: string): Promise<{ok: true; note: string} | {ok: false; error: string}> {
  const channel = ports.press;
  if (!ports.expression || !channel) return {ok: false, error: OWNER_UNATTACHED};
  // The work's title is its document's: it stands quoted in the shell's sentences (1R-surface.8).
  const listed = works.find(work => work.expression_ref === ref)?.title;
  const named = listed ? quotedName(listed) : 'This Expression';
  if (deleting.has(ref)) return {ok: false, error: `${named} ${DELETE_IN_FLIGHT}`};
  deleting.add(ref);
  try {
    // The frame is asked afresh at the press, and holds the work from then until the owner answers (round 896, 0R-surface.2); every path
    // from the ask on lets the hold go, once (1R-surface.5).
    const held: DeleteHold = ports.hold ? await ports.hold(ref).catch((cause: unknown) => ({ok: false as const, error: failure(cause)})) : {ok: true, unsaved: false};
    let reply: Record<string, unknown> = {}, note: string | null = null;
    try {
      if (!held.ok) return {ok: false, error: `${named} was not deleted: ${held.error}`};
      if (held.unsaved) return {ok: false, error: `${named} holds changes in the field that are not saved. ${UNSAVED_DELETE}`};
      const closed = closedWork(works, ref);
      const request = {operation: 'delete', expression_ref: ref, actor: OPEN_ACTOR, actor_kind: 'human',
        ...(closed ? {location: closed.location, ...(closed.file_revision ? {expected_file_revision: closed.file_revision} : {})} : {})} satisfies ExpressionRequest;
      try {
        reply = (await channel(request) ?? {}) as Record<string, unknown>;
      } catch (cause) { return {ok: false, error: failure(cause)} }
      if (reply.state === 'deleted') {
        const title = typeof reply.title === 'string' ? quotedName(reply.title) : listed ? named : 'The Expression';
        const settled = (reply.settled as {detail?: unknown} | undefined)?.detail;
        note = `${title} left the works home for Central's trash: Central's file history brings it back.${typeof settled === 'string' ? ` ${settled}` : ''}`;
        // The frame lets go of the deleted work first, then of its hold (the frame's messages arrive in order). A panel that cannot close it
        // leaves the Delete done, and says so.
        try { ports.deleted?.(ref, note) } catch (cause) { note = `${note} The panel did not close it: ${failure(cause)}` }
      }
    } finally { ports.release?.(ref) }
    if (note !== null) {
      await ports.refresh().catch(() => undefined);
      return {ok: true, note};
    }
    return deleteRefusal(reply);
  } finally { deleting.delete(ref) }
}
/** The owner's answer to a Delete it did not do, in its words. */
function deleteRefusal(reply: Record<string, unknown>): {ok: false; error: string} {
  const owned = reply.failure as {message?: unknown} | undefined;
  const detail = typeof reply.detail === 'string' ? reply.detail : null;
  if (reply.state === 'delete_refused') return {ok: false, error: detail ?? `Central would not take it to the trash: ${typeof owned?.message === 'string' ? owned.message : 'it refused'}`};
  if (reply.state === 'file_revision_conflict') return {ok: false, error: `The work stays in the works home. ${detail ?? 'Its file changed since it was read: read the works list again.'}`};
  return {ok: false, error: detail ?? `Expression delete: ${String(reply.state ?? 'no answer')}.`};
}

/** The panel's close of a work the owner deleted (O-I #747 round 895, DLW build ruling 2026-11-08; tested by behaviour, 0b.7): an open of it
 * waiting in the panel is dropped and offers no Retry; the workspace binding names it no more (`surfaceEngine(…, undefined)`), so no reopen
 * brings it back; the selection that expected it expects none; its trigger offer goes; and the frame lets go of it, saying what was
 * deleted (host.ts closeDeleted, the frame's closeDeletedExpression). */
export interface DeletedWorkPorts {
  deletedWorks: Set<string>
  pendingOpen: {current: string | null}
  clearOpenFault(ref: string): void
  /** The workspace book: the current workspace's id and its expressions binding, and the binding's engine to set. */
  binding(): {workspaceId: string; id: string; expressionRef?: string} | null
  surfaceEngine(workspaceId: string, bindingId: string, engine: undefined): void
  selection: {current: {workspaceId: string; expected?: string}}
  forgetOffer(ref: string): void
  closeInFrame(ref: string, words: string): void
}
export function closeDeletedWork(ports: DeletedWorkPorts, ref: string, words: string): void {
  ports.deletedWorks.add(ref)
  if (ports.pendingOpen.current === ref) ports.pendingOpen.current = null
  ports.clearOpenFault(ref)
  const binding = ports.binding()
  if (binding?.expressionRef === ref) ports.surfaceEngine(binding.workspaceId, binding.id, undefined)
  if (ports.selection.current.expected === ref) ports.selection.current = {workspaceId: ports.selection.current.workspaceId, expected: undefined}
  ports.forgetOffer(ref)
  ports.closeInFrame(ref, words)
}

/** --- A Central file opened as an Expression ----------------------------------------------------------------------
 * Manual §10.3: "Expressions keeps an Expression as JSON", and a Material row opens on a double-click; §20.1: "Open an Expression | The
 * browser". O-I #747 round 894, the port ledger's native-open-file and native-retry-file. */

/** A Central file an Expression keeps: its name ends `.expression.json`, as every work the owner saves is named (reuse.ts materialFileName). */
export const isExpressionFile = (name: string): boolean => /\.expression\.json$/i.test(name);

/** Open a Central file as an Expression: the owner's own `open_file` at the file's location (kernel expression.rs Request::OpenFile reads and
 * decodes it and holds the work under the file's own identity, bound to that file), the works list again, then the open door. A draft of the
 * same work the owner already holds stands and opens (the owner never replaces an open draft implicitly). Any refusal is the owner's words,
 * named by the file; nothing opens, and the same call is the Retry. */
export async function openExpressionFile(ports: Pick<OpenPorts, 'expression' | 'current' | 'refresh' | 'open'>, location: CentralLocation, name: string): Promise<OpenOutcome> {
  const channel = ports.expression;
  if (!channel) return {ok: false, error: OWNER_UNATTACHED, expression_ref: null};
  const refused = (why: string, ref: string | null = null): OpenOutcome => ({ok: false, error: `${name} did not open as an Expression: ${why}`, expression_ref: ref});
  let reply: ExpressionResult & {document?: {expression_ref?: unknown; title?: unknown}; file?: {location?: CentralLocation; revision?: unknown}; expression_ref?: unknown};
  try {
    reply = await channel({operation: 'open_file', location, actor: OPEN_ACTOR}) as typeof reply;
    if (reply?.state === 'revision_conflict' && typeof reply.expression_ref === 'string') {
      if (!ports.current()) return refused(ACCESS_RETIRED, reply.expression_ref);
      const warning = await refreshed(ports);
      ports.open(reply.expression_ref);
      return {ok: true, expression_ref: reply.expression_ref, title: name, saved: null, refused: null,
        warning: `Its work is already open with changes of its own: that draft stands and opens; the file was not read over it.${warning ? ` ${warning}` : ''}`};
    }
    requireExpressionOutcome(reply, 'Expression open');
  } catch (cause) { await refreshed(ports); return refused(failure(cause)) }
  const ref = reply?.document?.expression_ref, title = reply?.document?.title;
  if (reply?.state !== 'ready' || typeof ref !== 'string' || !ref.startsWith('expression:')) {await refreshed(ports); return refused(`the native owner did not hold it (${String(reply?.state ?? 'no state')}).`)}
  if (!ports.current()) return refused(ACCESS_RETIRED, ref);
  const warning = await refreshed(ports);
  ports.open(ref);
  const file = reply.file;
  return {ok: true, expression_ref: ref, title: typeof title === 'string' ? title : name,
    saved: file?.location && typeof file.revision === 'string' ? {path: file.location.path, revision: file.revision} : null, refused: null, warning};
}

/** The field's answer to an open the panel asked for (expressions-boundary host.ts openExpression): its refusal in its own words, or null for
 * an open that stands or one a newer open superseded before the field was ready (no refusal of the person's). O-I #747 round 894,
 * native-retry-open: a refusal stands on the field's fault line, and the Studio's head offers Retry opening. */
export function openRefusal(result: {ok: boolean; error?: string}): string | null {
  if (result.ok || !result.error) return null;
  return /^A newer open superseded this one/.test(result.error) ? null : result.error;
}

/** --- A trigger's native Action, pressed --------------------------------------------------------------------------
 * A scene trigger fires without a press, so the owner runs only an Action it answers is a reading (kernel expression.rs Request::Trigger);
 * one that may write comes back withheld, and the owner records the offer it makes (DLW build ruling 2026-11-09, 0b.1: its id, the
 * Action, the target and the trigger's revision). The frame passes on the offer's id alone; the Info line reads the record from the owner
 * and says it in the shell's own words (the Action's title, then the target by name), never the frame's. One press by the person runs it
 * under their grant, by the press channel: the owner's trigger with `press` naming the recorded offer, which runs exactly what the record
 * holds; a trigger changed since, or an offer the owner does not hold, is refused by the owner in words (manual §20.1 Triggers, Target
 * "Run a native Action"). */
export interface TriggerOffer {readonly expression_ref: string; readonly offer_ref: string}
/** The owner's record of an offer (kernel expression.rs TriggerOffer), as the owner gave it back. */
export interface OfferRecord extends TriggerOffer {readonly scene_ref: string; readonly trigger_ref: string; readonly action_ref: string; readonly target_ref: string
  readonly action_title: string; readonly target_name: string; readonly reads_only: boolean; readonly authority_requirement: readonly string[]}
const offerText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 4096
/** The frame's offer, as the id of the owner's record and the work it was made for, or null. Anything else the frame says is not read. */
export function readTriggerOffer(raw: unknown): TriggerOffer | null {
  if (!raw || typeof raw !== 'object') return null
  const {expression_ref, offer_ref} = raw as Record<string, unknown>
  if (!offerText(expression_ref) || !expression_ref.startsWith('expression:') || !offerText(offer_ref)) return null
  return {expression_ref, offer_ref}
}
/** The owner's record of an offer, exactly, or null. */
export function readOfferRecord(raw: unknown): OfferRecord | null {
  const record = (raw as {state?: unknown; offer?: unknown} | null)?.state === 'offer' ? (raw as {offer?: unknown}).offer : null
  if (!record || typeof record !== 'object') return null
  const row = record as Record<string, unknown>
  const texts = ['expression_ref', 'offer_ref', 'scene_ref', 'trigger_ref', 'action_ref', 'target_ref', 'action_title', 'target_name'] as const
  if (texts.some(key => !offerText(row[key])) || typeof row.reads_only !== 'boolean' || !Array.isArray(row.authority_requirement)
    || row.authority_requirement.some(asked => !offerText(asked))) return null
  return {expression_ref: row.expression_ref as string, offer_ref: row.offer_ref as string, scene_ref: row.scene_ref as string, trigger_ref: row.trigger_ref as string,
    action_ref: row.action_ref as string, target_ref: row.target_ref as string, action_title: row.action_title as string, target_name: row.target_name as string,
    reads_only: row.reads_only, authority_requirement: row.authority_requirement as string[]}
}
/** Text a document wrote, made safe to stand inside the shell's own sentence (O-I #747 round 896, 0R-surface.3): control, format (zero
 * width, bidirectional overrides) and line or paragraph separators are taken out, runs of space become one, quotation marks become an
 * apostrophe so the name cannot close its own quotes, and it is cut to `cap` characters with an ellipsis. Pure. */
export function documentText(text: string, cap: number): string {
  // Blank-looking letters (the braille blank, the Hangul fillers) read as space, and a run of four or more combining marks is taken out, so
  // nothing stands in a name that the eye cannot see or that spills over the shell's words (1R-surface.8).
  const plain = Array.from(text.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\u2800\u3164\u115F\u1160\uFFA0]/gu, ' ').replace(/\p{M}{4,}/gu, '')
    .replace(/["\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, "'").replace(/\s+/g, ' ').trim())
  return plain.length > cap ? `${plain.slice(0, cap - 1).join('').trimEnd()}…` : plain.join('')
}
/** A document's text as a name in the shell's sentence (O-I #747 round 896, 1R-surface.8): made safe (documentText), capped, quoted, and
 * isolated (FSI … PDI), so a right-to-left name cannot reorder the shell's words around it. Pure. */
export function quotedName(text: string, cap: number = QUOTED_NAME_CAP): string {
  return `\u201C\u2068${documentText(text, cap)}\u2069\u201D`
}
/** The longest a document's name stands quoted in the shell's words. */
export const QUOTED_NAME_CAP = 80
/** The Info line's words for an offer, the shell's own, from the owner's record: the Action's title (the catalogue's), the target by the
 * name its document gave it, quoted and capped so it reads as a name and never as a sentence of the shell's, with its ref beside it where
 * the name is not the ref (0R-surface.3); and why the owner withheld it, by the cause the owner's record carries (0R-authority.9): an Action
 * that may write; one that asks for an authority; or a reading that is the person's own act, which runs only by their press. Pure. */
export function offerWords(record: OfferRecord): string {
  const why = !record.reads_only ? 'it may write, and a trigger runs only a reading'
    : record.authority_requirement.length ? `it asks for an authority (${record.authority_requirement.join('; ')}), and a trigger runs only what asks none`
    : 'it is an act of yours, and a trigger runs your acts only by your press'
  // The ref is the document's too: quoted, isolated and capped like the name (1R-surface.8).
  const name = documentText(record.target_name, QUOTED_NAME_CAP) || documentText(record.target_ref, QUOTED_NAME_CAP)
  const ref = documentText(record.target_ref, QUOTED_NAME_CAP)
  const target = name === ref ? quotedName(name) : `${quotedName(name)} (${quotedName(ref)})`
  return `${record.action_title} on ${target} was not run: ${why}. Run runs it once, as your own press.`
}
/** Whether the owner's document still keeps the offered trigger as offered: its scene holds the trigger, and it runs the offered Action on
 * the offered target. A trigger changed or gone takes the offer away (round 895: the offer stands until answered or its trigger changes). Pure. */
export function offerStands(document: unknown, offer: OfferRecord): boolean {
  const scenes = (document as {expression_ref?: unknown; scenes?: unknown} | null)?.scenes
  if ((document as {expression_ref?: unknown} | null)?.expression_ref !== offer.expression_ref || !Array.isArray(scenes)) return false
  const scene = scenes.find(row => (row as {scene_ref?: unknown})?.scene_ref === offer.scene_ref) as {triggers?: unknown} | undefined
  const trigger = Array.isArray(scene?.triggers) ? scene.triggers.find(row => (row as {trigger_ref?: unknown})?.trigger_ref === offer.trigger_ref) as {target?: Record<string, unknown>} | undefined : undefined
  return trigger?.target?.kind === 'native_action' && trigger.target.action_ref === offer.action_ref && trigger.target.target_ref === offer.target_ref
}
/** The person's press of a withheld trigger, by the press channel: the owner's trigger with `press: true`, naming the recorded offer, said
 * in one line. "As your own press" is said only where the owner ran it on the person's token (`as_person`; 0b.10). */
export async function pressTrigger(channel: ExpressionChannel | null, offer: OfferRecord): Promise<string> {
  if (!channel) return OWNER_UNATTACHED
  let reply: unknown
  try {
    reply = await channel({operation: 'trigger', expression_ref: offer.expression_ref, scene_ref: offer.scene_ref, trigger_ref: offer.trigger_ref, press: true,
      offer_ref: offer.offer_ref} satisfies ExpressionRequest)
  } catch (cause) { return `${offer.action_title} did not run: ${failure(cause)}` }
  const record = reply && typeof reply === 'object' ? reply as Record<string, unknown> : {}
  const dispatch = record.dispatch && typeof record.dispatch === 'object' ? record.dispatch as Record<string, unknown> : null
  if (record.state !== 'action_result' || !dispatch) return `${offer.action_title} did not run${typeof record.detail === 'string' ? `: ${record.detail}` : '.'}`
  if (dispatch.state === 'invoked') return record.as_person === true ? `${offer.action_title} ran, as your own press.` : `${offer.action_title} ran.`
  const why = [dispatch.message, dispatch.detail, dispatch.action].find(value => typeof value === 'string')
  return dispatch.state === 'owner_refused' ? `${offer.action_title} was refused: ${why}` : `${offer.action_title} did not run${why ? `: ${why}` : '.'}`
}

/** The work the frame presents now, as its reading names it (HostedAppState.nativeScene). */
export interface PresentedWork {readonly expression_ref: string; readonly revision: number}
/** The Info line's one trigger offer, as the Expressions panel holds it (O-I #747 round 895, DLW build ruling 2026-11-08). An offer is taken
 * only from the presented work, never another open work's, and only as the owner recorded it (0b.1): its words are the shell's, from the
 * owner's record. It stands until it is answered (pressed) or its trigger changes: a later plain word or toast leaves it. It goes when
 * another work, or none, is presented; when the presented work moves and the owner's document no longer keeps the trigger as offered
 * (offerStands); when its work is deleted; and when the panel goes. */
/** What came of a frame word's offer: it stands (its words are the shell's), it was not the presented work's (when asked or when the owner
 * answered), a newer word replaced it, or the owner's record of it could not be read. */
export type OfferTaken = {readonly state: 'standing'; readonly info: InfoOffer} | {readonly state: 'not-presented' | 'superseded' | 'unread'}
/** How long a frame word's offer waits for the frame to announce the work it was said for (1R-surface.9), in ms. */
export const ANNOUNCE_WAIT_MS = 1500
export function triggerOffers(ports: {show(offer: InfoOffer | null): void; shown(): InfoOffer | null; channel(): ExpressionChannel | null; press(): ExpressionChannel | null}) {
  let standing: {offer: OfferRecord; revision: number; info: InfoOffer} | null = null
  let asked = 0
  // A plain word said while an offer stands, waiting for the offer to go (1R-surface.3), and the takes waiting for the frame's next announce.
  let waiting: {word: string; say: (words: string) => void} | null = null
  let announced: (() => void)[] = []
  const gone = () => {standing = null; const word = waiting; waiting = null; if (word) word.say(word.word)}
  const withdraw = () => {const held = standing; gone(); if (held && ports.shown() === held.info) ports.show(null)}
  return {
    /** A plain frame word, while an offer stands: it does not take the line from the shell's words beside Run, and is said once the offer
     * goes (O-I #747 round 896, 1R-surface.3). Answers whether it waits; a newer plain word replaces one waiting. */
    hold(word: string, say: (words: string) => void): boolean {if (!standing) return false; waiting = {word, say}; return true},
    /** A frame word's offer: the owner's record of it is read, and it stands when it is the presented work's, as the frame presents it when
     * the owner answers (`presented` is read again after the round trip, never kept from before it: 0R-surface.6); any other word leaves the
     * standing offer as it is. Resolves once it stands, or is let go, saying which. */
    async take(raw: unknown, presented: () => PresentedWork | null | undefined): Promise<OfferTaken> {
      const offer = readTriggerOffer(raw), channel = ports.channel()
      if (!offer || !channel) return {state: 'unread'}
      let before = presented()
      if (!before || offer.expression_ref !== before.expression_ref) {
        // A word can come before the frame announces the work it was said for (1R-surface.9): the offer waits for the next announce, then
        // asks again which work is presented, and is let go only if it is not that work's.
        await new Promise<void>(resolve => {const timer = setTimeout(resolve, ANNOUNCE_WAIT_MS); announced.push(() => {clearTimeout(timer); resolve()})})
        before = presented()
        if (!before || offer.expression_ref !== before.expression_ref) return {state: 'not-presented'}
      }
      const turn = ++asked
      const record = readOfferRecord(await channel({operation: 'trigger_offer', offer_ref: offer.offer_ref}).catch(() => null))
      if (turn !== asked) return {state: 'superseded'}
      if (!record || record.offer_ref !== offer.offer_ref || record.expression_ref !== offer.expression_ref) return {state: 'unread'}
      const now = presented()
      if (!now || now.expression_ref !== record.expression_ref) return {state: 'not-presented'}
      const info: InfoOffer = {label: 'Expressions', words: offerWords(record), act: 'Run', run: () => {if (standing?.info === info) gone(); return pressTrigger(ports.press(), record)}}
      standing = {offer: record, revision: now.revision, info}
      ports.show(info)
      return {state: 'standing', info}
    },
    /** The presented work as the frame reads it now: another work, or none, takes the offer away; the same work at a new revision is read
     * from the owner, and the offer goes if its trigger changed (a read that fails leaves it: the owner still refuses a changed press). */
    async follow(presented: PresentedWork | null | undefined): Promise<void> {
      const waking = announced; announced = []
      for (const wake of waking) wake()
      const held = standing
      if (!held) return
      if (!presented || presented.expression_ref !== held.offer.expression_ref) {withdraw(); return}
      if (presented.revision === held.revision) return
      held.revision = presented.revision
      const channel = ports.channel()
      const reply = channel ? await channel({operation: 'inspect', expression_ref: held.offer.expression_ref}).catch(() => null) as {document?: unknown} | null : null
      if (reply?.document && standing === held && !offerStands(reply.document, held.offer)) withdraw()
    },
    /** The work `ref` was deleted: its offer goes. */
    forget(ref: string): void {if (standing?.offer.expression_ref === ref) withdraw()},
    /** The panel goes: so does its offer. */
    withdraw,
  }
}

/** Said when a frame's word carried an offer whose record the owner did not give back: the shell's words, never the frame's. */
export const OFFER_UNREAD = 'A scene trigger\u2019s Action was withheld for your press, but its owner did not give back its offer, so there is nothing to run. Fire the trigger again.'
/** A frame's word for the status bar's Info line (its `say` request; O-I #747 round 896, 0R-surface.1). A word that carries an offer is
 * never said in the frame's text, on the line or anywhere the person reads before pressing: the owner's record of the offer is read, and
 * once it stands the line says the shell's own words for it (offerWords) beside Run; a record the owner did not give back is said in the
 * shell's words (OFFER_UNREAD); an offer of a work no longer presented, or one a newer word replaced, is not said. Any other word is said
 * as the frame's, and leaves a standing offer as it is. */
export async function sayFrameWord(request: Readonly<Record<string, unknown>>, ports: {say(words: string): void
  offers: Pick<ReturnType<typeof triggerOffers>, 'take' | 'hold'>; presented(): PresentedWork | null | undefined}): Promise<void> {
  const text = request.text
  if (typeof text !== 'string' || !text.trim()) return
  if (request.offer === undefined || request.offer === null) {
    // The shell's words beside Run stand while the offer does: a plain word waits, and is said once the offer goes (1R-surface.3).
    if (!ports.offers.hold(text.slice(0, 2000), ports.say)) ports.say(text.slice(0, 2000))
    return
  }
  const taken = await ports.offers.take(request.offer, ports.presented)
  if (taken.state === 'standing') ports.say(taken.info.words)
  else if (taken.state === 'unread') ports.say(OFFER_UNREAD)
}

/** The frame the Expressions panel mounts, as its owner acts reach it (expressions-boundary host.ts ExpressionsHost). */
export interface FrameActHost {
  getState(): {readonly nativeScene?: PresentedWork | null} | null
  closeDeleted(ref: string, words: string): void
  holdForDelete(ref: string): Promise<DeleteHold>
  releaseDelete(ref: string): void
}
/** An open the frame refused, standing on the panel's fault line with Retry opening. */
export interface OpenFault {readonly ref: string; readonly text: string}
/** The panel's own state the wiring reads and sets: whether its mount still stands, the frame it mounts, the Info line, its open fault, and
 * the workspace's binding and selection a deleted work is let go of (closeDeletedWork). */
export interface FrameActPorts extends Pick<DeletedWorkPorts, 'pendingOpen' | 'binding' | 'surfaceEngine' | 'selection'> {
  live(): boolean
  frame(): FrameActHost | null | undefined
  say(words: string): void
  show(offer: InfoOffer | null): void
  shown(): InfoOffer | null
  openFault(fault: OpenFault | null | ((current: OpenFault | null) => OpenFault | null)): void
}
/** The Expressions panel's wiring of a frame it mounts to the owner's acts (O-I #747 round 896, 0R-surface.5: run by behaviour,
 * tests/frame-acts-896.test.mjs, where regexes over panels/expressions.tsx stood in for it before). The Info line holds one trigger offer,
 * the presented work's, read through the owner channel and pressed by the person's press channel (triggerOffers); a frame's word is said
 * there (sayFrameWord); each reading the frame announces is followed, so an offer of a work no longer presented goes; a refused open stands
 * with Retry, unless its work was deleted meanwhile. Once the panel attaches the owner: the browser's owner channel, the press channel over
 * the shell's transport (pressChannel), and the works door, whose Delete asks the frame afresh (frameDeleteHold) and whose deleted work is
 * closed in the panel and the frame (closeDeletedWork). All of it stands until dispose. */
export function frameActs(ports: FrameActPorts) {
  const deletedWorks = new Set<string>()
  const offers = triggerOffers({show: ports.show, shown: ports.shown, channel: expressionOwner, press: expressionPress})
  const dayReturns = dayReturnOffers({show: ports.show, shown: ports.shown})
  return {
    offers,
    /** Nara's Return to the Day, offered beside the Info line for the person's own press (1R-authority.3): the Nara relay's place to offer it. */
    dayReturns,
    /** An open of `ref` is asked again: its answer is heard, though the work was deleted before. */
    opening(ref: string): void {deletedWorks.delete(ref)},
    /** The frame's answer to an open of `ref`: a refusal stands with Retry; an open that stands clears it; a deleted work's answer offers no Retry. */
    heard: (ref: string) => (result: {ok: boolean; error?: string}): void => {
      if (!ports.live() || deletedWorks.has(ref)) return
      const text = openRefusal(result)
      ports.openFault(text ? {ref, text} : null)
    },
    /** A reading the frame announced: the offer follows the presented work. */
    follow(state: {readonly nativeScene?: PresentedWork | null} | null): void {void offers.follow(state?.nativeScene)},
    /** The frame's `say` request, on the Info line. */
    say(request: Readonly<Record<string, unknown>>): Promise<void> {
      return sayFrameWord(request, {say: ports.say, offers, presented: () => ports.frame()?.getState()?.nativeScene})
    },
    /** The owner is attached: the browser's owner channel, the person's press channel over `transport`, and the works door. */
    attach(owner: ExpressionChannel, transport: KernelTransportStatus, door: Pick<WorksDoor, 'works' | 'publish' | 'open' | 'current'>): void {
      setExpressionOwner(owner)
      // A Delete or a trigger's Run goes only by the host's own press path, which alone carries the person's token (0b.2).
      setExpressionPress(pressChannel(transport))
      setWorksDoor({works: door.works, publish: door.publish, open: door.open, current: door.current,
        // Deleting the presented work closes it (round 895, DLW build ruling 2026-11-08).
        deleted: (ref, words) => {
          if (!ports.live()) return
          closeDeletedWork({deletedWorks, pendingOpen: ports.pendingOpen, binding: ports.binding, surfaceEngine: ports.surfaceEngine, selection: ports.selection,
            clearOpenFault: gone => ports.openFault(current => current?.ref === gone ? null : current),
            forgetOffer: gone => offers.forget(gone), closeInFrame: (gone, said) => ports.frame()?.closeDeleted(gone, said)}, ref, words)
        },
        // A Delete asks the frame afresh at the press whether it holds edits of the work its owner does not, and the frame holds the work
        // from then until the owner answers (0b.4; round 896, 0R-surface.2).
        ...frameDeleteHold(ports.frame)})
    },
    /** The panel goes: its channels, its door and its offer go with it. */
    dispose(): void {setExpressionOwner(null); setExpressionPress(null); setWorksDoor(null); offers.withdraw(); dayReturns(null)},
  }
}

/** Said to the Nara relay when another act stands beside the Info line: its Return is not offered over it, and nothing was returned. */
export const OFFER_STANDS = 'Another act stands beside the Info line for your press: answer it there first, then ask the Return to the Day again.'
/** The words of a Return to the Day offered beside the Info line: the question, the Day's date and its field, quoted as names are. */
export function dayReturnOfferWords(offer: Pick<DayReturnOffer, 'question' | 'civil_date' | 'field'>): string {
  return `Return Nara's answer to ${quotedName(offer.question)} to your Day of ${documentText(offer.civil_date, 32)}, field ${quotedName(offer.field)}: Return sends it once to Inbox for review, as your own press.`
}
/** The place the Nara relay offers its Return to the Day (O-I #747 round 896, 1R-authority.3, F3): the frame's word asks, and the shell
 * offers the Return beside its Info line, where only the person's press runs it (the offer's run sends by the shell's own transport, so by
 * the shell window's channel). One offer stands at a time and never over another act's: a Return asked while another stands is refused in
 * words (OFFER_STANDS). Null withdraws the relay's offer, only if it is the one standing. Answers null when offered, else the refusal. */
export function dayReturnOffers(ports: {show(offer: InfoOffer | null): void; shown(): InfoOffer | null}): (offer: DayReturnOffer | null) => string | null {
  let standing: InfoOffer | null = null
  return offer => {
    if (!offer) {const held = standing; standing = null; if (held && ports.shown() === held) ports.show(null); return null}
    const shown = ports.shown()
    if (shown && shown !== standing) return OFFER_STANDS
    const info: InfoOffer = {label: 'Nara', words: dayReturnOfferWords(offer), act: 'Return', run: () => {if (standing === info) standing = null; return offer.run()}}
    standing = info
    ports.show(info)
    return null
  }
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
