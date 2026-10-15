/**
 * lane-3 E21: the frame's "where does this subject stand in the wiki" request, answered by the owner that carries the
 * wiki. The owner is the one projection state (desktop/cradle/src/techne/wikiProjectionStore.ts, `wikiSubjectStandings`);
 * this module reads it, it does not keep a second index. The frame never reads that state itself.
 *
 * The answer is for one exact basis: the Expression and revision the host holds for the frame's Scene. Any other basis is
 * refused by name, as is a shell whose wiki registers cannot be loaded. Nothing partial or guessed is returned.
 *
 * The registers are loaded by the owner's own path, the one the Technē centre runs on open: the World's disclosed projects
 * (`world_read`) published as the registers (`publishWikiNativeRegisters`), each register's reading ensured through the
 * projection store (`ensureWikiStanding`, which is `ensureWikiProjection`). Nothing here reads wiki.json or keeps a loader.
 */
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import {boundedKnowledgeChain} from '../../../../../desktop/cradle/src/knowledge/client'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {publishWikiNativeRegisters, wikiNativeRegisters} from '../../../../../desktop/cradle/src/techne/wikiNativeExpression'
import {captureWikiProjectionAccess, ensureWikiStanding, getWikiProjectionState, wikiSubjectStandings, type ProjectedSubjectStanding} from '../../../../../desktop/cradle/src/techne/wikiProjectionStore'
import {WIKI_SUBJECT_STANDING_CHANNEL, type ChannelContext, type ExpressionsOwners, type WikiSubjectStandingReply, type WikiSubjectStandingRequest} from '@epilogos/expressions-boundary'
import {readShellConfig, shellTransport} from './application'

/** The owner's reading, as this answerer needs it. Injectable for tests; the live source is the one projection state. */
export interface WikiStandingSource {
  /** Ensure the World's wiki registers are disclosed and each one's reading stands. Once per owner access: concurrent asks
   * share the one load, a settled load is reused, and a failed load is forgotten so the next ask may try again. */
  loadRegisters(): Promise<void>
  registersLoaded(): boolean
  /** Registers whose reading could not be read. A standing across them would be partial, so the answer refuses by name. */
  unreadRegisters(): readonly {key: string; reason: string}[]
  revision(): number
  standingsOf(subjectRef: string): readonly ProjectedSubjectStanding[]
}

/** The owner's register load, as the Technē centre runs it: the World's projects are published as the registers (unless the
 * centre has already published them), then every register's reading is ensured through the store. Reads nothing twice.
 * Each register's reading — a listing, its wiki file and its AIKit relations, three owner reads — runs through the realm's
 * knowledge read coordinator (desktop/cradle/src/knowledge/client.ts `boundedKnowledgeChain`) with its bound, never all at once:
 * 17 registers fired 51 reads together (measured 15 Oct), past the kernel's five AIKit readers.
 * A slot is held while the register's reads run — until its standing settles, or REGISTER_SLOT_MS at most (the kernel bounds
 * the AIKit relations read at 20 s; the listing and the file are sub-second) — never for the whole wait on a standing held up
 * elsewhere: measured 15 Oct, four registers whose standing did not settle held all four slots for the full 120 s wait, and the
 * other thirteen waited behind them. The load still waits for every standing, as before. */
export async function loadWikiStandingRegisters(transport: KernelTransportStatus): Promise<void> {
  if (transport.kind === 'unavailable') throw new Error(transport.reason)
  if (getWikiProjectionState().registers.length === 0) {
    const reply = await kernelOp(transport, {op: 'world_read'})
    if (reply.error || reply.outcome?.result !== 'world_read') throw new Error(reply.error ?? 'The native World did not supply a snapshot')
    const projects = reply.outcome.snapshot.navigator?.root?.work.projects ?? []
    publishWikiNativeRegisters(projects.map(row => ({name: row.name, path: row.path})))
  }
  const access = captureWikiProjectionAccess().identity
  await Promise.all(wikiNativeRegisters().map(register => {
    let standing: Promise<unknown> | null = null
    return boundedKnowledgeChain(JSON.stringify(['wiki-register-standing', transport, register.key, access]), () => {
      standing = ensureWikiStanding(register, transport)
      const settled = standing.then(() => undefined, () => undefined)
      let timer: ReturnType<typeof setTimeout> | undefined
      const slot = new Promise<void>(resolve => { timer = setTimeout(resolve, REGISTER_SLOT_MS) })
      return Promise.race([settled, slot]).finally(() => clearTimeout(timer))
    }).then(() => standing)
  }))
}

/** The longest one register's reading holds a knowledge read slot: the kernel's AIKit read bound (20 s) and its two file reads. */
export const REGISTER_SLOT_MS = 30_000

let sharedLoad: {identity: string; load: Promise<void>} | null = null

/** One register load per owner access for the session: concurrent asks share the in-flight load, and a failure is forgotten. */
export function ensureWikiStandingRegisters(transportOf: () => Promise<KernelTransportStatus>): Promise<void> {
  const identity = captureWikiProjectionAccess().identity
  if (sharedLoad?.identity === identity) return sharedLoad.load
  const load = transportOf().then(loadWikiStandingRegisters)
  const entry = {identity, load}
  sharedLoad = entry
  load.catch(() => { if (sharedLoad === entry) sharedLoad = null })
  return load
}

export const liveWikiStandingSource: WikiStandingSource = {
  loadRegisters: () => ensureWikiStandingRegisters(async () => shellTransport(await readShellConfig())),
  registersLoaded: () => getWikiProjectionState().registers.length > 0,
  unreadRegisters: () => {
    const state = getWikiProjectionState()
    return state.registers.flatMap(register => {
      const standing = state.standings[register.key]
      return standing?.phase === 'unavailable' ? [{key: register.key, reason: standing.reason}] : []
    })
  },
  revision: () => getWikiProjectionState().revision,
  standingsOf: subjectRef => wikiSubjectStandings(subjectRef),
}

/** The bound on rows one reply carries; a larger standing is refused by name, never truncated. */
export const WIKI_STANDING_ROW_LIMIT = 512

/** The basis the host holds for the frame's Scene (the frame's own announced nativeScene), or nothing when none is held. */
export interface HeldBasis {expression_ref: string; revision: number}

/** Answer one exact request. Every refusal is a named Error; the boundary replies it to the frame as the refusal.
 * The basis is checked before any owner is asked; then the registers the standing reads are loaded (once), and only a
 * settled, complete set of registers answers. */
export async function answerWikiSubjectStanding(
  request: WikiSubjectStandingRequest,
  held: HeldBasis | null | undefined,
  source: WikiStandingSource = liveWikiStandingSource,
): Promise<WikiSubjectStandingReply> {
  if (!held || held.expression_ref !== request.expression_ref || held.revision !== request.revision) {
    throw new Error('The open Expression moved before its wiki standing was read; reopen the Library to read where this subject stands now.')
  }
  try {
    await source.loadRegisters()
  } catch (cause) {
    throw new Error(`The wiki registers were not loaded, so where this subject stands in the wiki is not read: ${cause instanceof Error ? cause.message : String(cause)}`)
  }
  if (!source.registersLoaded()) {
    throw new Error('No wiki register is loaded in this shell, and the World discloses none to load, so where this subject stands in the wiki is not read.')
  }
  const unread = source.unreadRegisters()
  if (unread.length > 0) {
    throw new Error(`The wiki register ${unread[0].key} could not be read (${unread[0].reason}), so this subject's standing would be partial; no standing is shown.`)
  }
  const standings = source.standingsOf(request.subject_ref)
  if (standings.length > WIKI_STANDING_ROW_LIMIT) {
    throw new Error(`This subject stands in ${standings.length} wiki scenes, more than the Library shows; no standing is shown.`)
  }
  return {
    subject_ref: request.subject_ref,
    expression_ref: request.expression_ref,
    revision: request.revision,
    standing_revision: source.revision(),
    rows: standings.map(row => ({
      register_key: row.registerKey,
      expression_ref: row.expression_ref,
      scene_ref: row.scene_ref,
      scene_title: row.scene_title,
      entity_ref: row.entity_ref,
      entity_title: row.entity_title,
      subject_ref: row.subject_ref,
    })),
  }
}

/** The channel owner. The boundary has already read the request exactly; the basis is the one the host announced for the frame. */
export function wikiStandingChannel(source: WikiStandingSource = liveWikiStandingSource) {
  return async (request: unknown, context: ChannelContext): Promise<WikiSubjectStandingReply> =>
    answerWikiSubjectStanding(request as WikiSubjectStandingRequest, context.state?.nativeScene, source)
}

/** The Expressions pane's owners with this one channel added. Every other channel is the qualified owner's, unchanged. */
export function withWikiSubjectStanding(owners: ExpressionsOwners, source: WikiStandingSource = liveWikiStandingSource): ExpressionsOwners {
  return {...owners, channels: {...owners.channels, [WIKI_SUBJECT_STANDING_CHANNEL]: wikiStandingChannel(source)}}
}
