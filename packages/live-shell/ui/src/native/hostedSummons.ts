/**
 * The hosted Expressions application's summons, answered by the new shell.
 *
 * The frame posts `{request:'summon', detail}` over the boundary's host channel. The boundary answers only
 * `kind:'instrument'`; every other summon reaches the shell here. The legacy desktop answers the same summons in
 * `desktop/cradle/src/expressions/PointCloudHost.tsx`: a source summon resolves through `resolveHostedSource`
 * (sourceHandoff.ts) and opens `oi:open-scene-source`; a graph summon opens `oi:techne-summon` kind graph. This module
 * ports those answers onto the new shell's own surfaces, and imports the legacy resolver and graph subject admission
 * rather than copying them:
 *
 *   source, resolved file     → SOURCE_PRESENT; App presents the Workbench, then hands the source to its receiver (receiveSources: it opens a file tab,
 *                               as its Explorer does)
 *                               carrying the passage the event discloses (lane-2 T19b): the Workbench reveals it, or names why it cannot
 *   source, resolved address  → oi:epi-open-knowledge  (the Knowledge panel: the Graph, or a source page)
 *   graph                     → oi:epi-open-knowledge  (the Graph plane, focused on the subject through view.nativeKnowledge)
 *
 * Every other kind is named as not handled. Frame data is untrusted: each field is bounded here, and the resolver
 * validates the native identity it is given. A stale answer (the frame, document, Scene or selection has moved) opens
 * nothing; a refusal is named through `fault`, the Expressions pane's own fault line.
 */
import {resolveHostedSource, type HostedSourceTarget, type PassageAnchor} from '../../../../../desktop/cradle/src/expressions/sourceHandoff'
import {resolveScenePortal} from '../../../../../desktop/cradle/src/expressions/scenePortal'
import {graphSummonSubject} from '../../../../../desktop/cradle/src/knowledge/nativeFocus'
import type {CentralLocation, KernelTransportStatus, KnowledgeAddress} from '../../../../../desktop/cradle/src/kernel/types'
import type {SurfaceBinding} from '../../../../../desktop/cradle/src/surface/types'
import type {HostedAppState} from '@epilogos/expressions-boundary'
import type {KnowledgeOpenInput} from './knowledgeOpen'
import {portalPlacing, PORTAL_WORDS, type PortalPlace} from './portalPlace'

/** The resolver's own reference bound (sourceHandoff.ts `reference`). */
const REFERENCE_LIMIT = 2048
const TEXT_LIMIT = 4096
/** A Timeline context is navigation identity only; a larger one is refused, never truncated. */
const CONTEXT_LIMIT = 65536
const SUMMON_KIND = /^[a-z][a-z-]{0,63}$/
const CONTROL = /[\u0000-\u001f\u007f]/
const LOCATION_SCHEMA = 'central.path-ref/v1'

const plain = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const bounded = (value: unknown, max: number): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max && !CONTROL.test(value)

/** Ask App to present the Workbench and then open a resolved file there (the Workbench acts only while presented). */
export const SOURCE_PRESENT = 'oi:candidate-source-present'

export type SummonReading =
  | {ok: true; kind: 'source'; detail: Record<string, unknown>}
  | {ok: true; kind: 'graph'; subject_ref: string; native_owner: string; project?: string}
  | {ok: true; kind: 'unhandled'; summonKind: string}
  | {ok: false; reason: string}

const refuse = (reason: string): {ok: false; reason: string} => ({ok: false, reason})

/** Read one frame summon. Every field is bounded before use; an unreadable summon is named, never guessed. */
export function readSummon(raw: unknown): SummonReading {
  if (!plain(raw) || raw.request !== 'summon') return refuse('The hosted application sent a request this shell cannot read.')
  const detail = raw.detail
  if (!plain(detail)) return refuse('The hosted application sent a summon with no detail.')
  const kind = detail.kind
  if (typeof kind !== 'string' || !SUMMON_KIND.test(kind)) return refuse('The hosted application sent a summon with no readable kind.')
  if (kind === 'source') {
    if (!bounded(detail.ref, REFERENCE_LIMIT)) return refuse('The source summon names no bounded source reference.')
    const subject = detail.subject
    if (!plain(subject)) return refuse('The source summon carries no native Scene basis.')
    if (!bounded(subject.ref, REFERENCE_LIMIT) || !bounded(subject.sceneRef, REFERENCE_LIMIT) || !Number.isSafeInteger(subject.revision) || (subject.revision as number) < 1)
      return refuse('The source summon carries no exact native Scene revision.')
    if (detail.context !== undefined && (!plain(detail.context) || contextTooLarge(detail.context)))
      return refuse("The source summon's Timeline context is malformed or too large to read.")
    return {ok: true, kind: 'source', detail}
  }
  if (kind === 'graph') {
    // The legacy admission (nativeFocus.ts graphSummonSubject) bounds the subject's ref, owner and project.
    const subject = graphSummonSubject(detail.subject)
    if (!subject.ok) return refuse(subject.reason)
    return {ok: true, kind: 'graph', subject_ref: subject.subject_ref, native_owner: subject.native_owner, ...(subject.project ? {project: subject.project} : {})}
  }
  return {ok: true, kind: 'unhandled', summonKind: kind}
}

function contextTooLarge(context: Record<string, unknown>): boolean {
  try {return JSON.stringify(context).length > CONTEXT_LIMIT} catch {return true}
}

/** lane-2 T19b: the passage a file open carries. `passage` is a text span of the opened file, proved by the resolver at its revision. */
export interface SourceOpenCarry {passage?: PassageAnchor; note?: string; portal?: SourcePortalCarry}
/** A portal's file open (O-I #747 round 895, OPEN 4): the place its placement opens in, and the answer once the Workbench has placed it
 * (an error when it opened nothing; a note naming what it could not honour as asked). */
export interface SourcePortalCarry {place: PortalPlace; complete(error?: string, note?: string): void}

export type SourceOpenPlan =
  | {ok: true; kind: 'file'; location: CentralLocation; passage?: PassageAnchor; refusal?: string}
  | {ok: true; kind: 'knowledge'; address: KnowledgeAddress; title: string; project?: string; refusal?: string}
  | {ok: false; reason: string}

const MALFORMED_PASSAGE = 'The Timeline passage is malformed; the source opens at its top.'

/** A carried passage the editor can reveal: a text span of `sourceRef` with the revision it was proved at. Anything else is undefined. */
export function passageSpanOf(value: unknown, sourceRef: string): {start: number; end: number; revision: string} | undefined {
  if (!plain(value) || value.source_ref !== sourceRef || !plain(value.selector) || value.selector.unit !== 'text_span') return undefined
  const {start, end} = value.selector
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || (start as number) < 0 || (end as number) <= (start as number)) return undefined
  if (!bounded(value.revision, 256)) return undefined
  return {start: start as number, end: end as number, revision: value.revision}
}

/** A source open's portal, as App and the Workbench receive it in an event's detail, or null. */
function sourcePortalOf(raw: unknown): SourcePortalCarry | null {
  return plain(raw) && typeof raw.complete === 'function' && ['beside', 'full', 'detached', 're_dock'].includes(raw.place as string) ? raw as unknown as SourcePortalCarry : null
}

/** The Workbenches' receivers of a source open, each while it is mounted (Workbench.tsx; O-I #747 round 896, 1R-surface.9). The Workbench
 * is drawn lazily: a source handed before one is mounted waits for it, and App hands it again when a receiver comes. */
const sourceReceivers = new Set<(detail: unknown) => void>()
const receiverWatchers = new Set<() => void>()
export function receiveSources(take: (detail: unknown) => void): () => void {
  sourceReceivers.add(take); receiverWatchers.forEach(watch => watch())
  return () => {if (sourceReceivers.delete(take)) receiverWatchers.forEach(watch => watch())}
}
/** How many receivers are mounted, and a watch of it (App re-runs its hand-over when one comes: useSyncExternalStore). */
export function sourceReceiverCount(): number {return sourceReceivers.size}
export function watchSourceReceivers(watch: () => void): () => void {receiverWatchers.add(watch); return () => {receiverWatchers.delete(watch)}}
/** How long App holds a source for the Workbench before its portal is told it was not shown (1R-surface.9). */
export const SOURCE_HOLD_MS = 10_000
export interface SourceHoldPorts<T> {
  timer?: {set(run: () => void, ms: number): unknown; clear(id: unknown): void}
  ms?: number
  /** The source held past its deadline, answered and let go: App forgets it too. */
  expired?(intent: T): void
}
/** The source App holds for the Workbench until it is presented (App.tsx, SOURCE_PRESENT; round 896, 0R-surface.8): a newer one replaces
 * it, and the portal of the one replaced is answered in words, never left waiting. `give` hands it to the mounted receivers and lets it go;
 * with none mounted it stays held. One not handed by its deadline is let go, its portal answered that the Workbench was not shown
 * (1R-surface.9): no source waits for good. */
export function sourceIntents<T extends {location?: unknown; passage?: unknown; note?: unknown; portal?: unknown}>(ports: SourceHoldPorts<T> = {}) {
  const timer = ports.timer ?? {set: (run: () => void, ms: number) => setTimeout(run, ms), clear: (id: unknown) => clearTimeout(id as ReturnType<typeof setTimeout>)}
  let held: T | null = null, deadline: unknown = null
  const letGo = () => {held = null; if (deadline !== null) timer.clear(deadline); deadline = null}
  return {
    hold(next: T): T {
      const before = held
      letGo(); held = next
      if (before && before !== next) sourcePortalOf(before.portal)?.complete(PORTAL_WORDS.replaced)
      deadline = timer.set(() => {if (held !== next) return; letGo(); sourcePortalOf(next.portal)?.complete(PORTAL_WORDS.notPresented); ports.expired?.(next)}, ports.ms ?? SOURCE_HOLD_MS)
      return next
    },
    /** Hands the held source to every mounted receiver and lets it go; false when none is mounted (it stays held) or it is held no more. */
    give(intent: T | null): boolean {
      if (!intent || held !== intent || !sourceReceivers.size) return false
      letGo()
      const detail = {location: intent.location, passage: intent.passage, note: intent.note, portal: intent.portal}
      sourceReceivers.forEach(take => take(detail))
      return true
    },
    held: (): T | null => held,
  }
}

/** The Workbench's side of a source open (oi:epi-open-source; native/Workbench.tsx): its book, its pane tree and its doors. */
export interface SourceReceiver {
  /** This Workbench is the one shown. */
  presented(): boolean
  /** The book's current state is taken before the open (Workbench capture). */
  capture(): void
  /** The file's tab the book already holds for this project, if any, and whether it stands in its own window. */
  held(ref: string, project: string | undefined): {binding: SurfaceBinding; away: boolean} | null
  insert(binding: SurfaceBinding): void
  /** A portal's place for the source just opened (portalPlace.ts placeOpenedPortal over the Workbench's tree and doors). */
  place(binding: SurfaceBinding, place: PortalPlace, away: boolean): Promise<string | undefined>
  /** A disclosed passage of the file, revealed and selected once its tab is laid out. */
  reveal(binding: SurfaceBinding, span: {start: number; end: number; revision: string}): void
  report(cause: unknown): void
  uuid(): string
}
/** A source open, as the Workbench takes it (moved here from Workbench.tsx in round 896, 0R-surface.5, so it runs by behaviour): the file
 * opens as a tab, or the one already held is shown; a portal's source is placed where its placement says, and the portal answered with what
 * could not be honoured (round 895, OPEN 4); a source held in its own window is never opened twice. Every portal is answered (0R-surface.8):
 * where the Workbench is not shown or the request names no Central file, its portal is told why; any other open the Workbench takes
 * nothing from is left, as before. */
export function receiveSourceOpen(detail: unknown, ports: SourceReceiver): void {
  const request = plain(detail) ? detail : {}
  const portal = sourcePortalOf(request.portal)
  const failed = (cause: unknown) => cause instanceof Error ? cause.message : String(cause)
  if (!ports.presented()) {portal?.complete(PORTAL_WORDS.notPresented); return}
  const location = request.location
  if (!plain(location) || location.schema !== LOCATION_SCHEMA || typeof location.ref !== 'string' || typeof location.path !== 'string') {
    portal?.complete(PORTAL_WORDS.noFile); return
  }
  const file = location as unknown as CentralLocation, project = typeof request.project === 'string' ? request.project : undefined
  try {
    ports.capture()
    const held = ports.held(file.ref, project)
    const binding: SurfaceBinding = held?.binding ?? {id: ports.uuid(), kind: 'file', title: file.path.split('/').pop() ?? file.ref, ref: file.ref, location: file, project}
    const away = !!held?.away
    // A source held in its own window: Re-dock returns it; any other placement leaves it there, never opened twice.
    if (portal && away && portal.place !== 're_dock') {portal.complete(undefined, PORTAL_WORDS.ownWindow); return}
    if (portal && away) {void ports.place(binding, portal.place, true).then(note => portal.complete(undefined, note), cause => portal.complete(failed(cause))); return}
    // lane-2 T19b: a disclosed passage opens revealed and selected in its source. Only a text span of this file is carried; any other shape
    // was refused upstream and arrives as `note`, which names why the file opens at its top.
    const span = passageSpanOf(request.passage, file.ref)
    ports.insert(binding)
    if (portal) void ports.place(binding, portal.place, false).then(note => portal.complete(undefined, note), cause => portal.complete(failed(cause)))
    if (span) ports.reveal(binding, span)
    if (typeof request.note === 'string' && request.note) ports.report(request.note)
  } catch (cause) {portal ? portal.complete(failed(cause)) : ports.report(cause)}
}

/** What a resolved source opens as. A file must be a Central path reference, or the Workbench would ignore it silently. */
export function sourcePlan(target: HostedSourceTarget): SourceOpenPlan {
  if (target.location) {
    const location = target.location
    if (location.schema !== LOCATION_SCHEMA || !bounded(location.ref, REFERENCE_LIMIT) || typeof location.path !== 'string')
      return refuse('The resolved source is not a Central file location, so it is not opened.')
    // The resolver carries a passage only for a file it proved; the shell checks its shape again before it is carried on.
    const span = target.anchor === undefined ? undefined : passageSpanOf(target.anchor, location.ref)
    const passage: PassageAnchor | undefined = target.anchor && span
      ? {source_ref: location.ref, selector: {unit: 'text_span', start: span.start, end: span.end}, revision: span.revision}
      : undefined
    const refusal = passage ? undefined : target.anchorRefusal ?? (target.anchor === undefined ? undefined : MALFORMED_PASSAGE)
    return {ok: true, kind: 'file', location, ...(passage ? {passage} : {}), ...(refusal ? {refusal} : {})}
  }
  if (target.address) {
    const title = bounded(target.title, TEXT_LIMIT) ? target.title : 'Source'
    return {ok: true, kind: 'knowledge', address: target.address, title, ...(target.project ? {project: target.project} : {}), ...(target.anchorRefusal ? {refusal: target.anchorRefusal} : {})}
  }
  return refuse('The resolved source names neither a file nor a knowledge address.')
}

/** Whether the frame asked for a passage (its event discloses one). An open that asked for none is silent about passages. */
function passageAsked(detail: Record<string, unknown>): boolean {
  const context = plain(detail.context) ? detail.context : undefined
  return !!context && plain(context.anchor) && context.anchor.state === 'passage'
}

/** The frame state an answer is bound to: the same frame, host, document, Scene and selection (legacy PointCloudHost isCurrent). */
export interface SummonBasis {
  frame: unknown
  host: unknown
  document: string | undefined
  sceneIndex: number | undefined
  selection: string
}

export function summonBasis(frame: unknown, host: unknown, state: HostedAppState | null | undefined): SummonBasis {
  return {
    frame,
    host,
    document: state?.document?.id,
    sceneIndex: state?.sceneIndex,
    selection: JSON.stringify(state?.selection?.map(item => item.id) ?? []),
  }
}

export function sameSummonBasis(a: SummonBasis, b: SummonBasis): boolean {
  return a.frame === b.frame && a.host === b.host && a.document === b.document && a.sceneIndex === b.sceneIndex && a.selection === b.selection
}

export interface HostedSummonDeps {
  /** The kernel transport the shell's owners use (the resolver reads the native Scene, file and wiki through it). */
  transport: KernelTransportStatus
  /** True while the answer still stands on the basis the summon arrived on. */
  current(): boolean
  /** The shell's current project, the register a graph summon is shown in when the summon names none. */
  project(): string | undefined
  /** Opens the file; `carry` holds the passage it opens at, or the named reason it opens at its top. */
  openFile(location: CentralLocation, carry: SourceOpenCarry): void
  openKnowledge(input: KnowledgeOpenInput): void
  /** Name a refusal in the Expressions pane's fault line. */
  fault(reason: string): void
  /** Clear the fault line once a summon is accepted. */
  clear(): void
  /** Injectable for tests; the default is the legacy resolver, unchanged. */
  resolveSource?(detail: Record<string, unknown>): Promise<HostedSourceTarget>
}

const named = (deps: HostedSummonDeps) => (error?: string) => {if (error) deps.fault(error)}

/** Answer one frame summon. Refusals and unhandled kinds are named; a stale answer opens nothing. */
export async function answerHostedSummon(raw: unknown, deps: HostedSummonDeps): Promise<void> {
  const read = readSummon(raw)
  if (!read.ok) {deps.fault(read.reason); return}
  if (read.kind === 'unhandled') {deps.fault(`The hosted application asked for a "${read.summonKind}" summon, which the new shell does not open yet.`); return}
  if (read.kind === 'graph') {
    if (!deps.current()) return
    const project = read.project ?? deps.project()
    if (!project) {deps.fault("This subject's register has no wiki graph to show it in."); return}
    deps.clear()
    deps.openKnowledge({title: 'Graph', project, plane: 'graph', subject_ref: read.subject_ref, native_owner: read.native_owner, complete: named(deps)})
    return
  }
  let target: HostedSourceTarget
  try {
    target = await (deps.resolveSource ?? (detail => resolveHostedSource(deps.transport, detail)))(read.detail)
  } catch (cause) {
    if (deps.current()) deps.fault(cause instanceof Error ? cause.message : String(cause))
    return
  }
  if (!deps.current()) return
  const plan = sourcePlan(target)
  if (!plan.ok) {deps.fault(plan.reason); return}
  deps.clear()
  // A passage the frame asked for is either carried, or named here; an open that asked for none carries nothing.
  const asked = passageAsked(read.detail)
  if (plan.kind === 'file') {
    deps.openFile(plan.location, {...(plan.passage ? {passage: plan.passage} : {}), ...(asked && plan.refusal ? {note: plan.refusal} : {})})
    return
  }
  if (asked && plan.refusal) deps.fault(plan.refusal)
  deps.openKnowledge({title: plan.title, ...(plan.project ? {project: plan.project} : {}), address: plan.address, complete: named(deps)})
}

/** What a scene's portal trigger needs of the shell (O-I #747 round 893): the summon's owners, and the answer back to the frame. */
export interface ScenePortalDeps extends Omit<HostedSummonDeps, 'resolveSource'> {
  /** Answers the frame's request: opened (no error), or why it was not; `note` names what its placement could not honour as asked. */
  answer(requestId: string, error?: string, note?: string): void
  /** Injectable for tests; the default is the legacy admission (desktop/cradle scenePortal.ts resolveScenePortal), which re-reads the
   * trigger, and its placement, from the native authored Scene: the frame supplies pointers only. */
  resolvePortal?(detail: unknown): Promise<{target: HostedSourceTarget; placement?: unknown}>
}

/** A scene's portal trigger, on whatever occasion it ran (the frame's scenePortal.ts `scene-portal` request): its source opens where
 * the shell opens a source — a file in the Workbench, a knowledge address in the Knowledge panel — and the frame is answered, opened or
 * why not; a refusal is also named on the fault line. A request without its id is not answered (nothing waits on it). */
export async function answerScenePortal(raw: unknown, deps: ScenePortalDeps): Promise<void> {
  const request = plain(raw) ? raw : {}
  const id = request.request_id
  if (!bounded(id, 128)) return
  const refused = (reason: string) => {deps.answer(id, reason); deps.fault(reason)}
  let portal: {target: HostedSourceTarget; placement?: unknown}
  try {
    portal = await (deps.resolvePortal ?? (detail => resolveScenePortal(deps.transport, detail)))(request.detail)
  } catch (cause) {
    if (deps.current()) refused(cause instanceof Error ? cause.message : String(cause)); else deps.answer(id, 'The Expression is no longer presented.')
    return
  }
  if (!deps.current()) {deps.answer(id, 'The Expression is no longer presented.'); return}
  const plan = sourcePlan(portal.target)
  if (!plan.ok) {refused(plan.reason); return}
  deps.clear()
  // Where it opens is the trigger's placement (round 895, OPEN 4): the Workbench places a file and answers; a knowledge page opens as a tab.
  const placing = portalPlacing(portal.placement)
  // The frame is answered once (round 896, 0R-surface.8): a second complete, from any path, is a no-op.
  let answered = false
  const once = (answer: () => void) => {if (answered) return; answered = true; answer()}
  if (plan.kind === 'file') {
    deps.openFile(plan.location, {...(plan.passage ? {passage: plan.passage} : {}), portal: {place: placing.place, complete: (error, note) => once(() => {
      const said = [placing.note, note].filter(Boolean).join(' ')
      deps.answer(id, error, error ? undefined : said || undefined); if (error) deps.fault(error)
    })}})
    return
  }
  deps.openKnowledge({title: plan.title, ...(plan.project ? {project: plan.project} : {}), address: plan.address,
    complete: error => once(() => {deps.answer(id, error, error ? undefined : PORTAL_WORDS.knowledge); if (error) deps.fault(error)})})
}
