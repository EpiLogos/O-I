// Beings and Things in reading, walks and sky (T-WORLDS §4 W2; manual §18.1 Launch panel: "Opens as … Page · Reading · Walk · Sky
// for a being or thing"). Each page projects one occurrence into the Earth's field through its one admission path
// (projections/occurrence.ts checkOccurrence → admitOccurrences), as the QL family places the Sun (inhabitants/qlSkyEarthAdapter.ts
// admitSubsolar). From the page owner's reading (kernel/src/page.rs read; desktop/cradle/src/personal/pageOwner.ts):
//   - a family per page kind, untied to archetypes so it admits after mount: `figure` for a Being, `object` for a Thing, each
//     coloured by its own ref (provider/suiteReading.ts paletteOfRef) — no colour is invented here;
//   - locusType `artifact`; subject_ref the page's own ref; basis the revision the page was read at;
//   - body the opening and the sections, as plain paragraphs (Reading draws body and cites, ui/deep.ts); cites the page's sources,
//     each at the revision it is read at;
//   - its place the page's anchor (bindings.anchor, a real place on Earth); a page with none stands unplaced, (0,0) at precision
//     `none`, as the contract has it;
//   - its date the day the page was made (meta.created); a page with none is undated, an honest state.
// The page's notes are its reader's, and stay out. A page re-read replaces its occurrence, never adds a second. Pure apart from
// `readWorldPagesForEarth`, which reads the pages through their owner.
import type {Cite, Family, Field, Occurrence} from '../projections/atlas/src/types/field'
import {admitOccurrences, checkOccurrence, refuse, type AdmissionRefusal, type Checked} from '../projections/occurrence'
import {paletteOfRef} from '../projections/atlas/provider/suiteReading'
import {listWorldPages, readPageOwned, type PageReading} from '../../../../../desktop/cradle/src/personal/pageOwner'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {readWorlds} from './centralWorlds'

export type PageOccurrenceKind = 'being' | 'thing'

/** The families pages project under, by their kind. */
export const PAGE_FAMILY_IDS: Readonly<Record<PageOccurrenceKind, string>> = {being: 'oi-page-being', thing: 'oi-page-thing'}

const family = (kind: PageOccurrenceKind): Family => ({
  id: PAGE_FAMILY_IDS[kind],
  name: kind === 'being' ? 'Beings' : 'Things',
  subtype: kind === 'being' ? 'figure' : 'object',
  aliases: [],
  oneLine: kind === 'being' ? 'A presence and its world, as its page holds it.' : 'A thing and its world, as its page holds it.',
  archetypes: [],
  spectrum: {position: kind === 'being' ? 0.35 : 0.65},
  palette: paletteOfRef(PAGE_FAMILY_IDS[kind]),
  body: [],
  occurrenceIds: [],
  synthesised: true,
})

/** The two page families, declared by this module when a field does not already declare them. */
export const PAGE_FAMILIES: Readonly<Record<PageOccurrenceKind, Family>> = {being: family('being'), thing: family('thing')}

/** A page's occurrence id: its file ref, under the pages' own prefix. */
export const pageOccurrenceId = (ref: string): string => `page:${ref}`
const isPageOccurrence = (id: string): boolean => id.startsWith('page:')

const object = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {})
const words = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null)
const clip = (text: string, length: number): string => (text.length <= length ? text : `${text.slice(0, length - 1).trimEnd()}…`)
const baseName = (path: string): string => (path.split('/').filter(Boolean).pop() ?? path).replace(/\.html$/i, '')

/** One page as its occurrence, checked against the Earth's contract, or why it is none. `undatedYear` is the placeholder an undated
 * occurrence carries (the field's yearMax: the contract's convention, which no code reads as a date). */
export function pageOccurrence(reading: PageReading, undatedYear: number): Checked<Occurrence> {
  if (reading.form !== 'being' && reading.form !== 'thing') return refuse(`${reading.location.path} is a ${reading.form}, not a Being or a Thing`)
  const meta = object(reading.island.meta), page = object(reading.island.page), bindings = object(reading.island.bindings)
  const title = words(meta.title) ?? words(reading.title) ?? baseName(reading.location.path)
  const sections = Array.isArray(page.sections) ? page.sections.map(object) : []
  const body = [words(page.subtitle), words(page.introduction), ...sections.flatMap(section => [words(section.heading), words(section.text)])]
    .filter((paragraph): paragraph is string => paragraph !== null)
  const cites: Cite[] = (Array.isArray(bindings.sources) ? bindings.sources.map(object) : []).flatMap(source => {
    const ref = words(source.ref), revision = words(source.revision)
    return ref && revision ? [{work: ref, workTitle: baseName(ref.replace(/^central:path:[^:]*:/, '')), year: '', locator: `at ${revision}`}] : []
  })
  const anchor = object(bindings.anchor)
  const placed = typeof anchor.lat === 'number' && typeof anchor.lon === 'number'
  const made = words(meta.created)
  const madeAt = made ? new Date(made) : null
  const dated = !!madeAt && Number.isFinite(madeAt.getTime())
  return checkOccurrence({
    id: pageOccurrenceId(reading.location.ref),
    subject_ref: reading.location.ref,
    title,
    label: clip(title, 48),
    familyId: PAGE_FAMILY_IDS[reading.form],
    coFamilyIds: [],
    locusType: 'artifact',
    cultureIds: [],
    place: placed ? `Where ${title} is anchored` : '',
    lat: placed ? anchor.lat : 0,
    lon: placed ? anchor.lon : 0,
    geoPrecision: placed ? 'place' : 'none',
    year: dated ? madeAt!.getUTCFullYear() : undatedYear,
    yearDisplay: dated ? made!.slice(0, 10) : 'undated',
    ...(dated ? {} : {dated: false}),
    cites,
    body,
    parallelIds: [],
    basis: {ref: reading.location.ref, revision: reading.revision},
  })
}

/** The field without its pages' occurrences, the families' lists and the count kept in step. The same field when it holds none. */
export function withoutPages(field: Field): Field {
  if (!field.occurrences.some(item => isPageOccurrence(item.id))) return field
  const occurrences = field.occurrences.filter(item => !isPageOccurrence(item.id))
  const families = field.families.map(entry => entry.occurrenceIds.some(isPageOccurrence) ? {...entry, occurrenceIds: entry.occurrenceIds.filter(id => !isPageOccurrence(id))} : entry)
  return {...field, families, occurrences, meta: {...field.meta, counts: {...field.meta.counts, occurrences: occurrences.length}}}
}

/** Admit the pages read now into a field, through the one admission path: the pages already there are replaced (a page re-read is
 * one occurrence, never two), the families declared when the field does not, and every refusal kept by name. */
export function admitPages(field: Field, readings: readonly PageReading[]): {field: Field; admitted: Occurrence[]; refused: AdmissionRefusal[]} {
  const base = withoutPages(field)
  const undatedYear = field.meta?.yearMax ?? new Date().getUTCFullYear()
  const checked = readings.map(reading => ({reading, checked: pageOccurrence(reading, undatedYear)}))
  const refused: AdmissionRefusal[] = checked.flatMap(({checked: item}, index) => item.ok ? [] : [{index, reason: item.reason}])
  const kinds = new Set(checked.flatMap(({reading, checked: item}) => item.ok && (reading.form === 'being' || reading.form === 'thing') ? [reading.form] : []))
  const declared = new Set(base.families.map(entry => entry.id))
  const families = [...base.families, ...[...kinds].filter(kind => !declared.has(PAGE_FAMILY_IDS[kind])).map(kind => PAGE_FAMILIES[kind])]
  const admitted = admitOccurrences({...base, families}, checked.flatMap(({checked: item}) => item.ok ? [item.value] : []))
  return {field: admitted.field, admitted: admitted.admitted, refused: [...refused, ...admitted.refused]}
}

/** How many pages one world gives the Earth (the page owner's own listing bound). */
export const PAGES_PER_WORLD = 200

/** The Beings and Things of every world Central discloses, each read through the page owner at its present revision, with the
 * owner's own words for each world or page that did not answer. A world whose listing refuses is named, never dropped silently. */
export async function readWorldPagesForEarth(transport: KernelTransportStatus): Promise<{readings: PageReading[]; unread: string[]}> {
  const worlds = await readWorlds(transport)
  if (worlds.state !== 'read') return {readings: [], unread: [worlds.state === 'unavailable' ? worlds.reason : 'Central\'s worlds are still being read']}
  const readings: PageReading[] = [], unread: string[] = []
  for (const world of worlds.worlds) {
    try {
      const listing = await listWorldPages(transport, world.folder, PAGES_PER_WORLD)
      for (const page of listing.pages.filter(item => item.form === 'being' || item.form === 'thing')) {
        try { readings.push(await readPageOwned(transport, page.location)) } catch (cause) { unread.push(`${page.location.path}: ${cause instanceof Error ? cause.message : String(cause)}`) }
      }
    } catch (cause) { unread.push(`${world.name}: ${cause instanceof Error ? cause.message : String(cause)}`) }
  }
  return {readings, unread}
}

