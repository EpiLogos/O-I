// What a practice page's Launch opens (manual §18.1 "The Launch panel", §24.4, §24.6; T-WORLDS §6, W4), told by the page owner once a
// page's moment is open (desktop/cradle/src/personal/pageOwner.ts onPageLaunched):
//   a journey's page   opens its Deck journey (qlDeck.ts openDeckJourney), once: launching it again while the Deck holds it reads
//                      nothing again, and the read never deals — reopening a journey never deals again (kernel/src/nara_journey.rs);
//                      a journey's page made from New… that holds no journey yet opens on the Deck asking for its theme. Launched as
//                      Reading (its launch's Opens as, kernel/src/page.rs), a journey opens as an Expression: its cards and lines laid
//                      out in a Reading scene through the Expression owner (desktop/cradle/src/nara/journeyReading.ts, §24.4);
//   a Being page       launched as Sky gives the Sky its natal source: the Being's Subject's saved identity, read through nara_identity
//                      (desktop/cradle/src/nara/beingIdentity.ts), its own natal chart; absent, the Sky says why. The page opens in
//                      a pane of its own (central/documents/centralDocuments.ts `page`), beside what is open.
// Nothing here writes: the launch is the page owner's, the journey the kernel's, the identity the identity owner's.
import {dayRead} from '../../../../../../../desktop/cradle/src/day/client'
import type {CentralLocation, KernelTransportStatus} from '../../../../../../../desktop/cradle/src/kernel/types'
import {readBeingIdentity} from '../../../../../../../desktop/cradle/src/nara/beingIdentity'
import {openJourneyReading} from '../../../../../../../desktop/cradle/src/nara/journeyReading'
import {currentIdentity} from '../../../../../../../desktop/cradle/src/nara/identity/current'
import {findPracticePage, makePracticePage, practiceOfIsland, practiceWorldOf} from '../../../../../../../desktop/cradle/src/nara/practiceWorld'
import {detectTransport} from '../../../../../../../desktop/cradle/src/kernel/bridge'
import {readWorlds} from '../../../central/centralWorlds'
import {onPageLaunched, readPageOwned, type PageLaunch} from '../../../../../../../desktop/cradle/src/personal/pageOwner'
/** The document pane's opener, loaded when a page opens (it carries the Flow form's own template). */
const openInPane = (target: {form: 'flow'; location: CentralLocation} | {form: 'page'; kind: 'being'; location: CentralLocation}) =>
  import('../../../central/documents/centralDocuments').then(({openCentralDocumentAt}) => { documentLayoutWriter()?.(layout => openCentralDocumentAt(layout, target)) })
import {documentLayoutWriter} from '../../../central/documents/documentDoor'
import {openDeckJourney, qlDeckState} from './qlDeck'
import {setQlSkyNatal} from './qlSky'

/** The desktop's own actor, as its file writes attribute the person's acts (kernel/src/files.rs `oi-desktop-user`). */
const DESKTOP_ACTOR = 'oi-desktop-user'

const record = (value: unknown): Record<string, unknown> | null => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null)

/** The Day the acts of a journey happen on: today's, as Central reads it. */
async function todayRef(transport: KernelTransportStatus): Promise<string> {
  const day = await dayRead(transport)
  return day.today?.day_ref ?? day.day_ref
}

/** Open the Deck on a journey's page, once. */
export async function openJourneyOfPage(transport: KernelTransportStatus, location: CentralLocation, island: unknown, title: string | null): Promise<void> {
  const held = qlDeckState().journey
  if (held && held.location.ref === location.ref) return
  const person = currentIdentity()?.reading.person_ref ?? null
  await openDeckJourney({location, actor_ref: person ?? DESKTOP_ACTOR, subject_ref: person, day_ref: await todayRef(transport),
    ...(title ? {title} : {}), unopened: !record(record(record(island)?.meta)?.journey)})
}

/** Give the Sky the Being's birth sky, or the reason it has none; open the page beside what is open. */
export async function skyOfBeing(transport: KernelTransportStatus, location: CentralLocation, island: unknown): Promise<void> {
  const read = await readBeingIdentity(transport, island)
  if (!read.ok) setQlSkyNatal(null, read.reason)
  else if (!read.identity.natal) setQlSkyNatal(null, read.identity.natalWhy ?? 'This identity carries no birth sky.')
  else setQlSkyNatal({person_ref: read.identity.person_ref, name: read.identity.name, source: read.identity.source, bodies: read.identity.natal})
  await openInPane({form: 'page', kind: 'being', location})
}

/** What a page's launch reaches: the page through its owner, a journey's Reading and its Deck (tests give their own). */
export interface LaunchSteps {
  readonly read: (location: CentralLocation) => Promise<{location: CentralLocation; island: unknown; title: string | null}>
  readonly reading: (location: CentralLocation) => Promise<unknown>
  readonly deck: (location: CentralLocation, island: unknown, title: string | null) => Promise<void>
}

/** The answer to one page's launch. A journey launched as Reading opens its Reading scene (a journey with none read yet has nothing to
 * lay out, and opens its Deck, which asks for its theme); otherwise it opens its Deck. */
export async function answerLaunch(launched: PageLaunch, transport: KernelTransportStatus, steps: Partial<LaunchSteps> = {}): Promise<void> {
  if (launched.form !== 'flow' && launched.form !== 'being') return
  const s: LaunchSteps = {read: location => readPageOwned(transport, location), reading: location => openJourneyReading(transport, location),
    deck: (location, island, title) => openJourneyOfPage(transport, location, island, title), ...steps}
  const reading = await s.read(launched.location)
  if (launched.form === 'flow') {
    if (practiceOfIsland(reading.island) !== 'journey') return
    const opensAs = record(record(record(reading.island)?.meta)?.launch)?.opensAs
    if (opensAs === 'reading' && record(record(record(reading.island)?.meta)?.journey)) await s.reading(reading.location)
    else await s.deck(reading.location, reading.island, reading.title)
    return
  }
  const opensAs = record(record(record(reading.island)?.meta)?.launch)?.opensAs
  if (opensAs === 'sky') await skyOfBeing(transport, reading.location, reading.island)
}

/** The practice pages made from New… (manual §24.1 the practice world's clips; §24.4): a journal and a dream journal open the one your
 * practice world keeps, made the first time — Nara keeps no second journal — and a journey is made for each concern, its Deck opened to
 * ask for its theme (the journey opens there, with consent to chance: qlDeck.ts openJourneyByTheme). */
export const PRACTICE_OPENERS: readonly {readonly practice: 'journal' | 'dreams' | 'journey'; readonly title: string; readonly hint: string}[] = [
  {practice: 'journal', title: 'Journal', hint: 'your journal, in your practice world: a flow you write in alone, one page a day'},
  {practice: 'dreams', title: 'Dream journal', hint: 'your dream journal, in your practice world: a flow whose entries are dreams'},
  {practice: 'journey', title: 'Journey', hint: 'a concern you carry, read with one deck: its page in your practice world, its Deck asking for its theme'},
]

/** Make (or, for a journal, open) one practice page in the practice world, open it in a pane, and for a journey open its Deck. */
export async function openPractice(practice: 'journal' | 'dreams' | 'journey', transport: KernelTransportStatus = detectTransport(),
  open: (location: CentralLocation) => void = location => { void openInPane({form: 'flow', location}) }): Promise<CentralLocation> {
  const worlds = await readWorlds(transport)
  if (worlds.state !== 'read') throw new Error(worlds.state === 'unavailable' ? worlds.reason : 'Central has not disclosed its worlds yet.')
  const world = practiceWorldOf(worlds.worlds)
  if (!world) throw new Error('Central discloses no world to keep your practice in.')
  const held = practice === 'journey' ? null : await findPracticePage(transport, world.world, practice)
  const location = held?.location ?? (await makePracticePage(transport, world.world, practice)).location
  open(location)
  if (practice === 'journey') await openJourneyOfPage(transport, location, null, null)
  return location
}

let installed: (() => void) | null = null
/** Answer every page's launch from here on (idempotent). */
export function installPracticeLaunch(): void {
  installed ??= onPageLaunched(answerLaunch)
}
installPracticeLaunch()
