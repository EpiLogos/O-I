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
//   - Commit through a lens is the same action's reading_put (ai-kit f2c6ae59, knowledge_construction.rs Change::ReadingPut): QL's reading
//     through the lens at the sublens it is turned to, as QL's provider disclosed it, kept on the constellation as a proposal on the
//     construction revision it read, replacing one with the same reading ref; read back by reading the register again.
import {detectTransport, kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {CONSTRUCTION, editConstruction, readRegister, saveConstruction, type NativeConstruction, type WikiRegister}
  from '../../../../../desktop/cradle/src/knowledge/construction'
import {ensureLensRegistry, lensRegistry} from '../techne/devices/lensRegistry'
import type {Constellation} from './constellations'
import {frameCommitChanges, frameReading, groovesOf, lensReadingOf, refractionRequest, snapshotHash, standsOfConstellation, standsOfConstruction,
  type Groove, type LensGroove, type LensReading, type Stand} from '../frame/browser/grooves'

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

/** QL's reading of a constellation as its owner keeps it, through a lens at a sublens (`ql wiki refract -`, the kernel's ql_read
 * wiki-refract), with the provider QL names for it (its WikiReading's provider.provider_ref). Reads only. */
async function refract(constellation: Constellation, kept: Kept, lens: LensGroove, sublens: number | null, transport: KernelTransportStatus): Promise<Answer<{reading: LensReading; provider: string | null}>> {
  const frameRef = kept.construction?.ref, revision = kept.construction?.revision
  const hash = await snapshotHash({ref: constellation.ref, frameRef, revision, stands: kept.stands})
  const request = refractionRequest({constellation, stands: kept.stands, lens, sublens, hash, frameRef, revision})
  const answer = await kernelOp(transport, {op: 'ql_read', request: {kind: 'wiki-refract', request}})
  if (answer.outcome == null) return {ok: false, error: answer.error ?? 'Quaternal Logic did not answer `ql wiki refract`.'}
  const outcome = answer.outcome as {result?: string; data?: unknown}
  if (outcome.result !== 'owner_route_reading') return {ok: false, error: `The kernel answered \`${outcome.result ?? 'unknown'}\`, not \`ql wiki refract\`.`}
  const read = lensReadingOf(outcome.data)
  if (!read.ok) return {ok: false, error: read.why}
  const readings = (outcome.data as {readings?: unknown}).readings
  const found = Array.isArray(readings) ? readings.find(row => (row as {reading_ref?: unknown} | null)?.reading_ref === read.reading.readingRef) as {provider?: {provider_ref?: unknown}} | undefined : undefined
  const provider = typeof found?.provider?.provider_ref === 'string' && found.provider.provider_ref ? found.provider.provider_ref : null
  return {ok: true, reading: read.reading, provider}
}

/** A clip's constellation read through a groove (§16.5: "The clip is read through what you choose, and its source stays as it is"):
 * a frame by its roles, a lens by QL's refraction, at the sublens it is turned to. Reads only. */
export async function readThrough(input: {constellation: Constellation; groove: Groove; sublens: number | null; transport?: KernelTransportStatus}): Promise<Answer<{words: string}>> {
  try {
    const transport = input.transport ?? detectTransport()
    const kept = await keptOf(input.constellation, transport)
    if (input.groove.kind === 'frame') return {ok: true, words: frameReading(input.groove, kept.stands).words}
    const read = await refract(input.constellation, kept, input.groove, input.sublens, transport)
    return read.ok ? {ok: true, words: read.reading.words} : read
  } catch (cause) {
    return {ok: false, error: say(cause)}
  }
}

/** The change that keeps QL's reading through a lens on a constellation (AIKit's reading_put): the reading as QL's provider disclosed it,
 * a proposal on the construction revision it read. Pure. */
export function lensCommitChange(reading: LensReading, provider: string, basisRevision: number): Record<string, unknown> {
  return {change: 'reading_put', reading: {reading_ref: reading.readingRef, lens_ref: reading.lensRef, ...(reading.sublensRef ? {sublens_ref: reading.sublensRef} : {}),
    disclosure: reading.words, result_class: reading.resultClass, provider_ref: provider, basis_revision: basisRevision, standing: 'proposed'}}
}

/** The readings AIKit keeps on a construction (`aikit.constellation/v1` readings; none where it keeps none). */
const keptReadings = (construction: NativeConstruction | null): readonly {reading_ref?: unknown; disclosure?: unknown}[] => {
  const readings = (construction?.[CONSTRUCTION] as {readings?: unknown} | undefined)?.readings
  return Array.isArray(readings) ? readings : []
}

/** Commit (§16.7): the clip's reading written into the wiki through AIKit, where the constellation keeps it for every mode, and read back
 * from AIKit. Through a frame, the constellation takes the frame's form and each member the role at its address; through a lens, the
 * constellation keeps QL's reading at the sublens turned, as a proposal. Nothing else writes. */
export async function commitReading(input: {constellation: Constellation; groove: Groove; sublens: number | null; transport?: KernelTransportStatus}): Promise<Answer<{note: string; revision: number}>> {
  const {constellation, groove} = input
  const keeps = groove.kind === 'lens' ? {what: 'a reading', change: 'reading_put'} : {what: 'a form', change: 'frame_set'}
  if (constellation.kind !== 'frame') return {ok: false, error: `${constellation.title} is a space of your wiki, not a constellation someone authored round a question: `
    + `the wiki keeps ${keeps.what} only on an authored constellation (AIKit's ${keeps.change} acts on its aikit.constellation/v1 frame).`}
  try {
    const transport = input.transport ?? detectTransport()
    const project = projectOf(constellation)
    const kept = await keptOf(constellation, transport)
    if (!kept.register || !kept.construction) return {ok: false, error: `${constellation.title} is not in the register Central discloses now: read the wiki again and Commit again.`}
    if (groove.kind === 'lens') return await commitLens({constellation, groove, sublens: input.sublens, register: kept.register, construction: kept.construction, stands: kept.stands}, project, transport)
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

/** Commit through a lens: QL's reading of the constellation as AIKit keeps it now, kept on it by AIKit's reading_put, and read back. */
async function commitLens(input: {constellation: Constellation; groove: LensGroove; sublens: number | null; register: WikiRegister; construction: NativeConstruction; stands: readonly Stand[]},
  project: string | undefined, transport: KernelTransportStatus): Promise<Answer<{note: string; revision: number}>> {
  const {constellation, groove, sublens, register, construction} = input
  const read = await refract(constellation, {register, construction, stands: input.stands}, groove, sublens, transport)
  if (!read.ok) return {ok: false, error: `Commit did not land: ${read.error}`}
  if (!read.provider) return {ok: false, error: `Commit did not land: Quaternal Logic named no provider for its reading of ${constellation.title}, and AIKit keeps a reading only with the provider that disclosed it.`}
  const request = editConstruction(construction, [lensCommitChange(read.reading, read.provider, construction.revision)])
  const saved = await saveConstruction(transport, project, register, request, [])
  // Read back from the owner: the register again, and the reading as AIKit now keeps it on the constellation.
  const after = await keptOf(constellation, transport)
  const keptNow = keptReadings(after.construction).find(row => row.reading_ref === read.reading.readingRef)
  if (!after.construction || after.construction.revision !== saved.revision || keptNow?.disclosure !== read.reading.words)
    return {ok: false, error: `AIKit saved ${constellation.title} (revision ${saved.revision}), but reading the wiki back does not show its reading through ${groove.name}. Read the wiki again before you Commit again.`}
  const through = sublens === null ? groove.name : `${groove.name}, ${groove.sublenses[sublens]?.label ?? `sublens ${sublens}`},`
  return {ok: true, revision: saved.revision, note: `${constellation.title} keeps its reading through ${through} in the wiki (revision ${saved.revision}), as a proposal: ${read.reading.words}`}
}
