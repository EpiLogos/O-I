// How a field device writes: one `apply` on the reading's basis, with the numeric edits held in the private input owner
// while the owner has not answered. This is NativeFieldHandle's own direct commit (components/NativeFieldHandle.tsx `commitDirect`,
// lines 53-65) for a value that arrives by Send rather than by a drag: retain the gesture, apply, clear it on an ok reply,
// retain it again with the owner's refusal on a refused one, and leave it to the recovery panel when the work moved on. The
// target key is the handle's own (`fieldInputTarget`), so the recovery panel shows one copy however the value was entered.
import type {NativeEditorBasis, NativeEditorChange, NativeEditorReading, NativeEditorReply} from '@epilogos/expressions-boundary/editor'
import type {StageCommand} from '@epilogos/expressions-boundary'
import {NATIVE_BINDINGS} from '@epilogos/expressions-boundary/parameters'
import type {ModeSetAct, ModeSetStudio} from '../../../../../../desktop/cradle/src/kernel/types'
import type {NativeInputAperture} from '../../continuity/nativeInputContext'
import type {PrivateNativeInputReceipt} from '../../continuity/nativeInputs'
import {handleGestureMaterial} from '../NativeFieldHandle'
import {NativeDeviceInputCustody, type Apply, type CaptureCurrent} from '../nativeDeviceCustody'
import {LIVE_INTERVAL_MS, REAL_CLOCK, type LiveRun, type LiveSessionClock} from '../nativeBarSession'
import {STAGE_LIVE_RELEASE, stageAutomationResumeOne, stageLiveHold, stageLiveSet} from '../../native/stageCommands'
import {runAct, type SetActRunner} from '../../frame/tracks/kernelSet'
import {studioWriteOf, type FieldDeviceDrag, type FieldDeviceSend, type NumericEdit, type StudioWrite} from './expressionsDevice'

export interface FieldDeviceHost {
  /** The rack's (or the pool's) one apply: in-flight lock and basis included. */
  readonly apply: Apply
  readonly captureCurrent: CaptureCurrent
  /** The private input owner, read when a change is sent (its object changes with every render of its provider). */
  readonly aperture: () => NativeInputAperture | null
}

interface Held {readonly custody: NativeDeviceInputCustody; readonly receipt: PrivateNativeInputReceipt; readonly edit: NumericEdit}

const messageOf = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause)

function materialOf(family: string, basis: NativeEditorBasis, edit: NumericEdit, refusal?: string) {
  const material = handleGestureMaterial({pointer: -1, basis: {...basis}, value: edit.value, initial: edit.initial, offset: 0}, edit.id, family)
  return refusal ? {...material, refusal} : material
}

/** The host's write as the model asks for it. The family names the device in the retained copy's target, as the handle's does. */
export function fieldDeviceSend(family: string, host: FieldDeviceHost): FieldDeviceSend {
  return async (edits: readonly NativeEditorChange[], numeric: readonly NumericEdit[], basis: NativeEditorBasis): Promise<NativeEditorReply> => {
    const current = host.captureCurrent()
    if (!current()) return {ok: false, error: 'The native work moved on; your values are kept.'}
    const aperture = host.aperture()
    const held: Held[] = []
    if (aperture) {
      try {
        for (const edit of numeric) {
          const material = materialOf(family, basis, edit)
          const custody = new NativeDeviceInputCustody(aperture, {basis: material.basis, target: material.target}, 'gesture')
          held.push({custody, receipt: custody.retain(material), edit})
        }
      } catch (cause) {
        // Nothing is sent that the private owner could not keep: the legacy handle's rule, stated in the owner's words.
        return {ok: false, error: messageOf(cause)}
      }
    }
    let reply: NativeEditorReply
    try { reply = await host.apply(edits, basis) } catch (cause) { reply = {ok: false, error: messageOf(cause)} }
    if (!current(reply)) return reply
    for (const entry of held) {
      try {
        if (reply.ok) entry.custody.clear(entry.receipt)
        else entry.custody.retain(materialOf(family, basis, entry.edit, reply.error))
      } catch { /* the original copy stays in the recovery panel, which names it */ }
    }
    return reply
  }
}

// ---------------------------------------------------------------------------
// the Studio's act (O-I ticket 1008): the one write of a field device, and what a drag sends before it

/** The Studio the kernel's Set gives a work: its Scene's values and settings and the act that writes them, whether a take records on its
 * Scene, the track's Re-enable, and the runner of its acts. */
export interface WorkStudio {
  readonly expression_ref: string
  readonly studio: ModeSetStudio
  readonly recording: boolean
  readonly reenable: ModeSetAct | null
  readonly runner: SetActRunner
}

/** Why a device does not write: the Set has given no Studio of the work, or gives the Studio of another Scene than the one the field shows. */
export const STUDIO_UNREAD = 'The kernel\'s Set has not given this Expression\'s Studio yet, so nothing here writes: wait for it, or open the Expression again.'
export const STUDIO_ELSEWHERE = 'The Studio the kernel gives this Expression is another Scene\'s than the one the field shows: select that Scene to write it.'

/** A field device's write (O-I ticket 1008): each value and setting of the Studio through the Studio's act, as one Action; what the Studio
 * does not take (a palette's stops, a route: the editor's own edits) through the editor's apply. Refused in words where the Set gives no
 * Studio of the Scene written. The reply carries the reading as it stands: the field reads the work again once the kernel says it moved. */
export async function studioApply(host: {readonly reading: NativeEditorReading | null; readonly apply: Apply}, work: WorkStudio | null,
  changes: readonly NativeEditorChange[], basis: NativeEditorBasis): Promise<NativeEditorReply> {
  const writes: StudioWrite[] = [], edits: NativeEditorChange[] = []
  for (const change of changes) {
    const write = studioWriteOf(change)
    if (write) writes.push(write); else edits.push(change)
  }
  if (edits.length) {
    const reply = await host.apply(edits, basis)
    if (!reply.ok || !writes.length) return reply
  }
  const reading = host.reading
  if (!work || !reading) return {ok: false, error: STUDIO_UNREAD}
  if (!writes.length) return {ok: true, reading}
  if (work.expression_ref !== basis.expression_ref || work.studio.scene_ref !== basis.scene_ref) return {ok: false, error: STUDIO_ELSEWHERE}
  const receipt = await runAct(work.runner, work.studio.act, writes.length === 1 ? writes[0] : {changes: writes})
  return receipt.ok ? {ok: true, reading} : {ok: false, error: receipt.error}
}

/** The values the kernel holds off their lanes on the Scene a basis presents (the Set's Studio `held`), each with the value it holds there
 * (the Studio's value at its bind). None where the Set gives the Studio of another Scene, or none at all. Pure. */
export function studioHolds(work: WorkStudio | null, basis: Pick<NativeEditorBasis, 'scene_ref'> | null): {target: string; value: number}[] {
  if (!work || !basis || work.studio.scene_ref !== basis.scene_ref) return []
  return (work.studio.held ?? []).flatMap(target => {
    const binding = NATIVE_BINDINGS.find(row => `field.${row.key}` === target)
    const value = binding ? work.studio.values[binding.bind] : undefined
    return typeof value === 'number' && Number.isFinite(value) ? [{target, value}] : []
  })
}

/** What the frame does to hold what the kernel holds (O-I ticket 1008): each value the kernel holds that the frame does not hold at that value
 * is held there (`live hold`), and each value the frame holds that the kernel does not is given back to its lane (`automation resume`).
 * Run where the kernel's holds move (a release, a Re-enable) or the frame presents another Scene, never on the frame's own move. Pure. */
export function holdsToFollow(kernel: readonly {target: string; value: number}[], frame: readonly {target: string; value: number}[]): StageCommand[] {
  const commands: StageCommand[] = []
  for (const hold of kernel) if (!frame.some(there => there.target === hold.target && there.value === hold.value)) commands.push(stageLiveHold(hold.target, hold.value))
  for (const there of frame) if (!kernel.some(hold => hold.target === there.target)) commands.push(stageAutomationResumeOne(there.target))
  return commands
}

/** What a drag of a field device reaches: the frame's stage, for the preview; the work's Studio, for a take's samples; and whether an
 * enabled lane plays a target, whose value the frame then holds when the hand lets go, as the kernel holds it. */
export interface StudioDragHost {
  readonly run: LiveRun | null
  readonly work: WorkStudio | null
  readonly automated: (target: string) => boolean
  /** The revision of the work the field shows (null: none known). The preview is let go once the field reads the release's write, so
   * the field never draws the old value between the two. */
  readonly revision?: () => number | null
}

/** How long a release waits for the field to read its write before the preview is let go all the same. */
export const SHOWN_WITHIN_MS = 1500

/** A field device's drag, with the release's write told to it (`settled`) so the preview is let go only once that write has answered. */
export type StudioDrag = FieldDeviceDrag & {settled(write: Promise<unknown>): void}

/** A drag of a field device (O-I ticket 1008). While the hand moves, each value previews on the field (the frame's `live set`, which writes
 * nothing) and, while a take records on the Scene, lands in the take as a sample (the Studio's act with `gesture: "sample"`: it writes no
 * Scene and lays no receipt) — each at most once every 50 ms, the last move always sent. The release writes once, through the device's
 * send (the Studio's act: one Action, one receipt). Once that write has answered, the frame lets the preview go, or holds the value where
 * an enabled lane plays it (the kernel holds it there too). */
export function studioDrag(host: () => StudioDragHost, clock: LiveSessionClock = REAL_CLOCK, interval = LIVE_INTERVAL_MS): StudioDrag {
  let pending = new Map<string, {bind: string; value: number}>()
  let last = new Map<string, number>()
  let lastAt = -Infinity, timer: unknown = null, previewed = false, writing: {write: Promise<unknown>; from: number | null} | null = null
  // Each gesture's own release: one that begins while the last one's write is still answering takes the preview over, and the older
  // release lets nothing go.
  let gesture = 0, released = false
  const quiet = (answer: Promise<unknown> | undefined) => { void answer?.catch(() => {}) }
  const stop = () => { if (timer !== null) { clock.clear(timer); timer = null } }
  const flush = (sample: boolean) => {
    stop()
    const points = [...pending].map(([target, point]) => ({target, ...point}))
    pending = new Map()
    if (!points.length) return
    lastAt = clock.now()
    const {run, work} = host()
    if (run) for (const point of points) { try { quiet(run(stageLiveSet(point.target, point.value))); previewed = true } catch { /* the frame refused: nothing moved */ } }
    if (sample && work?.recording) {
      const writes = points.map(point => ({bind: point.bind, value: point.value}))
      quiet(runAct(work.runner, work.studio.act, writes.length === 1 ? {...writes[0], gesture: 'sample'} : {changes: writes, gesture: 'sample'}))
    }
  }
  /** Resolves once the field shows a revision past `from`, or SHOWN_WITHIN_MS passes. */
  const shown = (from: number) => new Promise<void>(resolve => {
    const until = clock.now() + SHOWN_WITHIN_MS
    const look = () => {
      const now = host().revision?.() ?? null
      if (now === null || now > from || clock.now() >= until) resolve()
      else clock.after(interval, look)
    }
    look()
  })
  const end = async (mine: number, ending: {write: Promise<unknown>; from: number | null} | null, values: Map<string, number>) => {
    if (ending) {
      const ok = await ending.write.then(reply => (reply as {ok?: unknown} | null)?.ok !== false, () => false)
      if (ok && ending.from !== null) await shown(ending.from)
    }
    if (mine !== gesture) return
    const {run} = host()
    if (!run || !previewed) return
    previewed = false
    for (const [target, value] of values) {
      if (!host().automated(target)) continue
      try { await run(stageLiveHold(target, value)) } catch { /* released below */ }
    }
    try { quiet(run(STAGE_LIVE_RELEASE)) } catch { /* the frame also lets go on a Scene change */ }
  }
  const drag = ((edits: readonly NativeEditorChange[] | null) => {
    if (edits === null) {
      // The last move previews; the release's write records it on the take.
      flush(false)
      released = true
      const mine = gesture, values = last
      last = new Map()
      clock.after(0, () => { const ending = writing; writing = null; void end(mine, ending, values) })
      return
    }
    if (released) { released = false; gesture += 1 }
    for (const edit of edits) {
      const write = studioWriteOf(edit), target = (edit as {target?: unknown}).target, value = (edit as {value?: unknown}).value
      if (!write || !('bind' in write) || typeof target !== 'string' || typeof value !== 'number' || !Number.isFinite(value)) continue
      pending.set(target, {bind: write.bind, value})
      last.set(target, value)
    }
    if (!pending.size) return
    const wait = interval - (clock.now() - lastAt)
    if (wait <= 0) flush(true)
    else if (timer === null) timer = clock.after(wait, () => { timer = null; flush(true) })
  }) as StudioDrag
  drag.settled = write => { writing = {write, from: host().revision?.() ?? null} }
  return drag
}
