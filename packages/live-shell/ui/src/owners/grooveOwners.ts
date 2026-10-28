// The pool's owner operations (manual §16.7 The pool; decision #709): taking a constellation's frame and lenses out into the pool, reading
// a clip through one, and Commit, which "writes the selected clip's reading into the wiki, through its owner, where the constellation
// keeps it for every mode". Owners write, faces read: every reading and the one write go through the owner that keeps the thing.
//   - The wiki register is the one Central discloses, read and decoded as the Canvas's construction reads it (desktop/cradle/src/
//     knowledge/construction.ts readRegister: Central's `projectcentral.wiki.read` / `central.wiki.read`, the native file through the
//     files seam). A constellation someone authored is its `aikit.constellation/v1` frame row; a space is read from the projection
//     (owners/constellations.ts), which carries the positions its nodes declare.
//   - QL's lenses are its registry (`ql mef lenses`, techne/devices/lensRegistry.ts); a clip read through a lens is QL's refraction of
//     its constellation (`ql wiki refract -`, the kernel's ql_read wiki-refract, QL-MEF #350).
//   - Commit through a frame is AIKit's construction action (`aikit.constellation.apply`: frame_set and role_set, on the frame's revision
//     and the register's file revision; construction.ts saveConstruction), read back by reading the register again.
//   - Commit through a lens has no owner operation yet: AIKit's construction action keeps no reading on a constellation. Its control
//     stands refused, naming the operation (the patch for AIKit is the ticket's, O-I #769).
import {detectTransport, kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {CONSTRUCTION, editConstruction, readRegister, saveConstruction, type NativeConstruction, type WikiRegister}
  from '../../../../../desktop/cradle/src/knowledge/construction'
import {ensureLensRegistry, lensRegistry} from '../techne/devices/lensRegistry'
import type {Constellation} from './constellations'
import {frameCommitChanges, frameReading, groovesOf, lensReadingOf, refractionRequest, snapshotHash, standsOfConstellation, standsOfConstruction,
  type Groove, type Stand} from '../frame/browser/grooves'

/** Commit through a lens: the operation AIKit lacks, in the shell's one sentence for it (frame/detail/clipBinding.ts missingOp). */
export const LENS_COMMIT_MISSING = 'Commit of a lens\'s reading: no owner operation carries it yet — missing op: aikit.constellation.apply reading_put (AIKit). '
  + 'AIKit\'s construction action keeps a constellation\'s frame, members, roles, relations and compositions, and no reading through a lens.'

const say = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause))
/** The project a constellation's register is scoped to, as its register says (owners/constellations.ts); none for your world's. */
const projectOf = (constellation: Pick<Constellation, 'project'>): string | undefined => constellation.project

/** A constellation as its owner keeps it: the authored construction where someone authored it, its members' stands either way. */
interface Kept {readonly register: WikiRegister | null; readonly construction: NativeConstruction | null; readonly stands: readonly Stand[]}
async function keptOf(constellation: Constellation, transport: KernelTransportStatus): Promise<Kept> {
  if (constellation.kind !== 'frame') return {register: null, construction: null, stands: standsOfConstellation(constellation)}
  const register = await readRegister(transport, projectOf(constellation))
  const construction = register.frames.find(frame => frame.constellations[0]?.anchor_ref === constellation.ref) ?? null
  return {register, construction, stands: construction ? standsOfConstruction(construction) : standsOfConstellation(constellation)}
}

/** QL's lens registry, read once through the kernel (or the list given, for a caller that holds it). */
async function lensesOf(given?: readonly unknown[]): Promise<readonly unknown[]> {
  if (given) return given
  await ensureLensRegistry()
  const reading = lensRegistry().lenses
  if (!reading.ok) throw new Error(`Quaternal Logic's lens registry was not read: ${reading.reason}`)
  return reading.list
}

export type Answer<T> = ({ok: true} & T) | {ok: false; error: string}

/** Take a constellation's frame and lenses out (§16.7: "drag the constellation … onto the pool: its frame and its lenses stand there").
 * Reads only. */
export async function extractGroovesFrom(constellation: Constellation, options: {transport?: KernelTransportStatus; lenses?: readonly unknown[]} = {}): Promise<Answer<{grooves: Groove[]; said: string[]}>> {
  try {
    const transport = options.transport ?? detectTransport()
    const [kept, lenses] = await Promise.all([keptOf(constellation, transport), lensesOf(options.lenses)])
    const from = {ref: constellation.ref, title: constellation.title, register: constellation.register}
    return {ok: true, ...groovesOf({from, frame: kept.construction?.[CONSTRUCTION].frame ?? null, stands: kept.stands, lenses})}
  } catch (cause) {
    return {ok: false, error: `${constellation.title} was not read: ${say(cause)}`}
  }
}

/** A clip's constellation read through a groove (§16.5: "The clip is read through what you choose, and its source stays as it is"):
 * a frame by its roles, a lens by QL's refraction, at the sublens it is turned to. Reads only. */
export async function readThrough(input: {constellation: Constellation; groove: Groove; sublens: number | null; transport?: KernelTransportStatus}): Promise<Answer<{words: string}>> {
  try {
    const transport = input.transport ?? detectTransport()
    const kept = await keptOf(input.constellation, transport)
    if (input.groove.kind === 'frame') return {ok: true, words: frameReading(input.groove, kept.stands).words}
    const frameRef = kept.construction?.ref, revision = kept.construction?.revision
    const hash = await snapshotHash({ref: input.constellation.ref, frameRef, revision, stands: kept.stands})
    const request = refractionRequest({constellation: input.constellation, stands: kept.stands, lens: input.groove, sublens: input.sublens, hash, frameRef, revision})
    const answer = await kernelOp(transport, {op: 'ql_read', request: {kind: 'wiki-refract', request}})
    if (answer.outcome == null) return {ok: false, error: answer.error ?? 'Quaternal Logic did not answer `ql wiki refract`.'}
    const outcome = answer.outcome as {result?: string; data?: unknown}
    if (outcome.result !== 'owner_route_reading') return {ok: false, error: `The kernel answered \`${outcome.result ?? 'unknown'}\`, not \`ql wiki refract\`.`}
    const read = lensReadingOf(outcome.data)
    return read.ok ? {ok: true, words: read.reading.words} : {ok: false, error: read.why}
  } catch (cause) {
    return {ok: false, error: say(cause)}
  }
}

/** Commit (§16.7): the clip's reading written into the wiki through AIKit, where the constellation keeps it for every mode, and read back
 * from AIKit. Through a frame, the constellation takes the frame's form and each member the role at its address; through a lens, refused
 * with the operation AIKit lacks. Nothing else writes. */
export async function commitReading(input: {constellation: Constellation; groove: Groove; sublens: number | null; transport?: KernelTransportStatus}): Promise<Answer<{note: string; revision: number}>> {
  const {constellation, groove} = input
  if (groove.kind === 'lens') return {ok: false, error: LENS_COMMIT_MISSING}
  if (constellation.kind !== 'frame') return {ok: false, error: `${constellation.title} is a space of your wiki, not a constellation someone authored round a question: `
    + 'the wiki keeps a form only on an authored constellation (AIKit\'s frame_set acts on its aikit.constellation/v1 frame).'}
  try {
    const transport = input.transport ?? detectTransport()
    const project = projectOf(constellation)
    const kept = await keptOf(constellation, transport)
    if (!kept.register || !kept.construction) return {ok: false, error: `${constellation.title} is not in the register Central discloses now: read the wiki again and Commit again.`}
    const request = editConstruction(kept.construction, frameCommitChanges(groove, kept.construction))
    const saved = await saveConstruction(transport, project, kept.register, request, [])
    // Read back from the owner: the register again, and the constellation as AIKit now keeps it.
    const after = await keptOf(constellation, transport)
    const frame = after.construction?.[CONSTRUCTION].frame
    if (!after.construction || after.construction.revision !== saved.revision || frame?.shape_ref !== groove.frame.shape_ref)
      return {ok: false, error: `AIKit saved ${constellation.title} (revision ${saved.revision}), but reading the wiki back does not show it in ${groove.name}. Read the wiki again before you Commit again.`}
    const read = frameReading(groove, after.stands)
    return {ok: true, revision: saved.revision, note: `${constellation.title} now stands in ${groove.name} in the wiki (revision ${saved.revision}): ${read.filled} of ${read.roles.length} roles filled.`}
  } catch (cause) {
    return {ok: false, error: `Commit did not land: ${say(cause)}`}
  }
}
