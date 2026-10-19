// The atlas's dreams, kept in your dream journal (manual §24.2: "Dreams are kept in the dream journal's page, in your ground. Nothing is
// kept in the window alone"; T-WORLDS §6, W4: "The atlas's practice store is re-bound at the host seam … its dreams read and write the
// dream journal; Amplify runs the ported pure practice/amplify.ts and lands Source entries").
//
// The seam is the store's own binding (src/practice/store.ts setPracticeStorage, a Storage): this module hands it a Storage whose dream
// collection (`aae.practice.v1.dreams`) is the dream journal — the Flow marked `meta.practice: "dreams"` in your practice world
// (desktop/cradle/src/nara/practiceWorld.ts) — and passes every other collection to the store it was bound to before. The ported code is
// unchanged. Reading is the journal read through its owner and held for the lens, which reads synchronously; each change the lens makes
// is planned at once (a dream the lens drops is refused before anything is written) and written in order as the journal's own entries,
// on the revision read (desktop/cradle/src/nara/dreamJournal.ts; flow/instances.ts writeFlowInstance: the source owner's CAS in a project's
// human ground). After each write the journal is read again, so what the lens holds is what the owner holds. The first dream kept makes
// the dream journal in the practice world, through Central's own creation door.
//
// Amplify: the lens's own Amplify — opening an image of a dream, the image buttons titled "Amplify this image" (src/lenses/dreams.ts,
// route #/dreams/<dream>/<image>, which reads the dream from the store as it opens) — runs the ported pure amplify over the field's model,
// and the places that image has stood before (its dreams and visions first) are laid on the dream as Source entries, each with the
// sources the field cites. The same image on the same dream lays nothing twice. It interprets nothing. The route is read when the lens
// reads its dream, so the binding adds no listener of its own to the window.
import type {CentralLocation, KernelTransportStatus} from '../../../../../../../desktop/cradle/src/kernel/types'
import type {AmplifiedPlace, DreamRecord, DreamWrite} from '../../../../../../../desktop/cradle/src/nara/dreamJournal'
import {findPracticePage, makePracticePage, practiceWorldOf, type PracticeWorldLike} from '../../../../../../../desktop/cradle/src/nara/practiceWorld'
import {readWorlds} from '../../../central/centralWorlds'
import type {Model} from '../src/data/model'
import {amplify} from '../src/practice/amplify'

/** The journal's own module and the Flow's file routes, loaded with the first read: they carry the Flow form's template, which the
 * atlas needs only once your dreams are read. */
type JournalModule = typeof import('../../../../../../../desktop/cradle/src/nara/dreamJournal')
const journalModule = (): Promise<JournalModule> => import('../../../../../../../desktop/cradle/src/nara/dreamJournal')
const flowRoutes = () => import('../../../../../../../desktop/cradle/src/flow/instances')

/** What the binding says when a dream would be erased (dreamJournal.ts DREAM_KEPT). */
export const DREAM_KEPT = 'A dream in your journal is kept: correct it rather than erase it. Nothing was removed.'

/** The dream collection's key in the store (src/practice/store.ts PREFIX + 'dreams'). */
export const DREAMS_KEY = 'aae.practice.v1.dreams'
/** How many places one amplification lays at most: the image's dreams and visions first, then its other instances. */
export const AMPLIFY_PLACES = 6

/** The journal's owners: given (tests give their own), else Central through the kernel. */
export interface DreamJournalOwners {
  readonly world: () => Promise<PracticeWorldLike>
  readonly find: (world: PracticeWorldLike) => Promise<CentralLocation | null>
  readonly make: (world: PracticeWorldLike) => Promise<CentralLocation>
  readonly read: (location: CentralLocation) => Promise<{html: string; revision: string; doc: Parameters<JournalModule['dreamsOfFlow']>[0]}>
  readonly write: (location: CentralLocation, revision: string, html: string) => Promise<{outcome: string}>
  readonly said: (text: string) => void
}

export function kernelDreamOwners(transport: KernelTransportStatus, said: (text: string) => void = () => {}): DreamJournalOwners {
  return {
    world: async () => {
      const worlds = await readWorlds(transport)
      if (worlds.state !== 'read') throw new Error(worlds.state === 'unavailable' ? worlds.reason : 'Central has not disclosed its worlds yet.')
      const practice = practiceWorldOf(worlds.worlds)
      if (!practice) throw new Error('Central discloses no world to keep your dreams in.')
      return practice.world
    },
    find: async world => (await findPracticePage(transport, world, 'dreams'))?.location ?? null,
    make: async world => (await makePracticePage(transport, world, 'dreams')).location,
    read: async location => (await flowRoutes()).readFlowInstance(transport, location),
    write: async (location, revision, html) => (await flowRoutes()).writeFlowInstance(transport, location, revision, html),
    said,
  }
}

export interface DreamJournalBinding {
  /** The Storage the practice store is bound to. */
  readonly storage: Storage
  /** Settles once the journal has been read (or found absent, or refused: the binding then says why). */
  readonly ready: Promise<void>
  /** Read the journal now, when the binding was made deferred. */
  start(): void
  /** Lay amplifications from the field's model: the lens's Amplify, by its route. */
  attach(model: Model): void
  /** Wait for every write asked so far. */
  settled(): Promise<void>
  /** Why the journal is not read or not written, when it is not. */
  fault(): string | null
  dispose(): void
}

/** The places an image has stood before in the field: the ported pure amplify (dreams and visions first), each with its cites. Pure. */
export function placesOf(model: Model, familyId: string, limit = AMPLIFY_PLACES): {name: string; places: AmplifiedPlace[]} | null {
  const found = amplify(model, familyId)
  if (!found) return null
  const order = [...new Set([...found.dreams, ...found.instances])].slice(0, limit)
  return {name: found.family.name, places: order.map(index => {
    const occ = model.occ[index]!
    return {occurrenceId: occ.id, title: occ.title, when: occ.dated === false ? 'undated' : occ.yearDisplay, place: occ.place, kind: occ.locusType,
      sources: occ.cites.map(cite => ({ref: `atlas:cite:${cite.work}${cite.locator ? `#${cite.locator}` : ''}`, label: `${cite.workTitle}${cite.locator ? `, ${cite.locator}` : ''}`}))}
  })}
}

/** The dream and image a lens route amplifies (#/dreams/<dream>/<image>), or null. Pure. */
export function amplifiedRoute(hash: string): {dreamId: string; familyId: string} | null {
  const path = hash.replace(/^#\/?/, '').split('?')[0]!.split('/').filter(Boolean)
  let parts: string[]
  try { parts = path.map(part => decodeURIComponent(part)) } catch { return null }
  if (parts[0] !== 'dreams' || parts.length !== 3 || parts[1] === 'new' || parts[2] === 'edit') return null
  return {dreamId: parts[1]!, familyId: parts[2]!}
}

/** Bind the dream collection to the dream journal, every other collection to `base`. */
export function bindDreamJournal(input: {base: Storage; owners: DreamJournalOwners;
  /** Read the journal only once `start` is called (or the dreams are first asked for). */
  deferred?: boolean
  /** Where the lens's route is read (the window's location; tests give their own). */
  location?: {readonly hash: string} | null;
  /** The field's model while the atlas is mounted (the pane's own handle); `attach` gives one too. */
  model?: () => Model | null}): DreamJournalBinding {
  const {base, owners} = input
  let dreams: DreamRecord[] = []
  let world: PracticeWorldLike | null = null
  let journal: CentralLocation | null = null
  let reason: string | null = null
  let queue: Promise<void> = Promise.resolve()
  let model: Model | null = null
  let lib: JournalModule | null = null
  let disposed = false
  const amplified = new Set<string>()
  const fail = (what: string, cause: unknown) => {
    reason = `${what}: ${cause instanceof Error ? cause.message : String(cause)}`
    owners.said(reason)
  }

  const reread = async () => {
    if (!journal) { dreams = []; return }
    dreams = lib!.dreamsOfFlow((await owners.read(journal)).doc)
  }
  // The journal is read once the binding is started (the pane starts it when the Earth has mounted, so the Earth's own owner reads come
  // first), or when the dreams are first asked for, whichever is sooner.
  let begin!: () => void
  const started = new Promise<void>(resolve => { begin = resolve })
  let starting = false
  const start = () => { if (!starting) { starting = true; begin() } }
  const ready = started.then(async () => {
    try {
      lib = await journalModule()
      world = await owners.world()
      journal = await owners.find(world)
      await reread()
      reason = null
    } catch (cause) { fail('Your dream journal is not read', cause) }
  })
  if (!input.deferred) start()
  // Every write waits for the first read: a dream kept before the journal is read is written on it, never beside it.
  queue = ready

  /** Apply `change` to the journal on the revision read, again when the journal moved meanwhile (each change appends, so it applies
   * to the newer revision as it did to the older). */
  const write = (change: (html: string) => string, what: string) => {
    queue = queue.then(async () => {
      try {
        if (!world) throw new Error(reason ?? 'no practice world is read')
        if (!journal) journal = await owners.make(world)
        for (let attempt = 0; ; attempt++) {
          const held = await owners.read(journal)
          const next = change(held.html)
          if (next === held.html) break
          const written = await owners.write(journal, held.revision, next)
          if (written.outcome !== 'conflict') break
          if (attempt >= 2) throw new Error('the journal kept moving while it was written; nothing was overwritten')
        }
        reason = null
      } catch (cause) { fail(`${what} was not kept in your dream journal`, cause) }
      try { await reread() } catch (cause) { fail('Your dream journal was not read again', cause) }
    })
    return queue
  }

  const planned = (items: unknown[]) => {
    if (!lib || (reason && !world)) throw new Error(reason ?? 'Your dream journal is not read yet: nothing is kept in the window alone.')
    const writes = lib.planDreamWrites(dreams, items)
    if (!writes.length) return
    // What the lens now keeps stands at once (it reads back what it wrote); the owner's reading replaces it after the write.
    dreams = items.filter((item): item is DreamRecord => !!item && typeof item === 'object' && typeof (item as {id?: unknown}).id === 'string') as DreamRecord[]
    const at = new Date()
    const journalLib = lib
    void write(html => writes.reduce((next: string, one: DreamWrite) => journalLib.applyDreamWrite(next, one, at), html), writes.length === 1 && writes[0]!.op === 'dream' ? 'The dream' : 'The change')
  }

  const storage: Storage = {
    get length() { return base.length },
    key: index => base.key(index),
    getItem: key => {
      if (key !== DREAMS_KEY) return base.getItem(key)
      start()
      // The lens reads its dream as it opens a route: an image's route is its Amplify (laid after the read, never inside it).
      queueMicrotask(onRoute)
      return JSON.stringify(dreams)
    },
    setItem: (key, value) => {
      if (key !== DREAMS_KEY) { base.setItem(key, value); return }
      const items = JSON.parse(value) as unknown
      if (!Array.isArray(items)) throw new Error('The dream collection is a list of dreams.')
      planned(items)
    },
    removeItem: key => {
      if (key !== DREAMS_KEY) { base.removeItem(key); return }
      if (dreams.length) throw new Error(DREAM_KEPT)
    },
    clear: () => {
      if (dreams.length) throw new Error(DREAM_KEPT)
      base.clear()
    },
  }

  function onRoute() {
    const at = input.location === undefined ? (globalThis as {location?: {hash?: string}}).location : input.location
    const route = typeof at?.hash === 'string' ? amplifiedRoute(at.hash) : null
    const field = disposed ? null : model ?? input.model?.() ?? null
    if (!route || !field) return
    const key = `${route.dreamId}:${route.familyId}`
    if (amplified.has(key) || !dreams.some(dream => dream.id === route.dreamId)) return
    const found = placesOf(field, route.familyId)
    if (!found || !found.places.length) return
    amplified.add(key)
    const journalLib = lib
    if (!journalLib) return
    void write(html => journalLib.applyAmplification(html, route.dreamId, {familyId: route.familyId, name: found.name}, found.places).html, `The amplification of ${found.name}`)
  }

  return {
    storage,
    ready,
    start,
    attach(next) { model = next; onRoute() },
    settled: () => queue,
    fault: () => reason,
    dispose() { model = null; disposed = true },
  }
}
