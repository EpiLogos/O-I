// The browser's Collections (manual §10.3: "Down the browser's left side stand Live's three groups: Collections, the coloured
// favourites you make; the four kinds above, as Live's categories; and Places, where your ground lies"). Central keeps them, per
// world (ctrl collections.rs, O-I #749): Live's seven coloured collections, Favourites first, each holding the things you put in it
// by the ref its own owner gives the thing and the words it stands under here. Three acts reach Central through the kernel's
// invoke_action: central.collections.read, .add and .remove. Your own world (control:root) keeps the browser's.
//
// The column shows Favourites always, and every other collection once it holds something, as Live shows the collections you use.
// The reading is held once for the window (collectionsHeld): the Keeper reads it while the browser stands, every act answers
// with the reading after it, and the column and the rows follow the one reading. Pure but for that holder.
import type {KernelOp} from '../../../../../../desktop/cradle/src/kernel/types'
import type {KernelOpCall} from '../../../../../../desktop/cradle/src/kernel/bridge'
import {actionAnswerOf, centralActionOp} from '../../central/devices/centralActions'

/** The world whose collections the browser shows: your own. */
export const COLLECTIONS_WORLD = 'control:root'
export const COLLECTIONS_READ = 'central.collections.read'
export const COLLECTIONS_ADD = 'central.collections.add'
export const COLLECTIONS_REMOVE = 'central.collections.remove'

/** Live's collection colours, as Central names them. */
export type CollectionColour = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'grey'
const COLOURS: readonly CollectionColour[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'grey']

export interface CollectedItem {
  readonly ref: string
  readonly label: string
  readonly kind?: string
  readonly added_at_unix_seconds: number
}
export interface Collection {
  readonly id: string
  readonly name: string
  readonly colour: CollectionColour
  readonly items: readonly CollectedItem[]
}
/** `central.collections/v1` as Central reads it. */
export interface CollectionsReading {
  readonly schema: 'central.collections/v1'
  readonly world: string
  readonly kept: boolean
  readonly revision: string | null
  readonly source_path: string
  readonly collections: readonly Collection[]
}

/** A thing the browser can put in a collection: its ref as its owner gives it, its words, what sort of thing it is. */
export interface Collectable {
  readonly ref: string
  readonly label: string
  readonly kind?: string
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0

/** Central's reading, or null for anything that is not one. Pure. */
export function collectionsReadingOf(value: unknown): CollectionsReading | null {
  if (!isRecord(value) || value.schema !== 'central.collections/v1' || !text(value.world) || typeof value.kept !== 'boolean'
    || !text(value.source_path) || !Array.isArray(value.collections)) return null
  const collections: Collection[] = []
  for (const entry of value.collections) {
    if (!isRecord(entry) || !text(entry.id) || !text(entry.name) || !COLOURS.includes(entry.colour as CollectionColour) || !Array.isArray(entry.items)) return null
    const items: CollectedItem[] = []
    for (const item of entry.items) {
      if (!isRecord(item) || !text(item.ref) || !text(item.label) || typeof item.added_at_unix_seconds !== 'number') return null
      items.push({ref: item.ref, label: item.label, ...(text(item.kind) ? {kind: item.kind} : {}), added_at_unix_seconds: item.added_at_unix_seconds})
    }
    collections.push({id: entry.id, name: entry.name, colour: entry.colour as CollectionColour, items})
  }
  return {schema: 'central.collections/v1', world: value.world, kept: value.kept, revision: text(value.revision) ? value.revision : null,
    source_path: value.source_path, collections}
}

/** The collections the column shows: Favourites always, every other one once it holds something, in Live's order. Pure. */
export function shownCollections(reading: CollectionsReading | null): readonly Collection[] {
  if (!reading) return [FAVOURITES]
  return reading.collections.filter((collection, index) => index === 0 || collection.items.length > 0)
}

/** Favourites before Central has answered: what the column stands on while the reading is asked. */
export const FAVOURITES: Collection = {id: 'favourites', name: 'Favourites', colour: 'red', items: []}

/** The collections holding a thing, by its ref. Pure. */
export function collectionsHolding(reading: CollectionsReading | null, ref: string): ReadonlySet<string> {
  return new Set((reading?.collections ?? []).filter(collection => collection.items.some(item => item.ref === ref)).map(collection => collection.id))
}

/** What a collected thing is, in words, for its preview. Pure. */
export function collectedWords(item: CollectedItem, collection: Pick<Collection, 'name'>): string {
  const added = new Date(item.added_at_unix_seconds * 1000)
  const day = Number.isFinite(added.getTime()) ? added.toLocaleDateString(undefined, {day: 'numeric', month: 'short', year: 'numeric'}) : null
  return `${item.label}${item.kind ? ` — ${item.kind}` : ''}, in ${collection.name}${day ? ` since ${day}` : ''}. Its ref is ${item.ref}.`
}

type Call = (op: KernelOp) => Promise<KernelOpCall>

/** One act's answer: Central's reading after it, or its refusal thrown in its words. */
async function asked(call: Call, action: string, input: Readonly<Record<string, unknown>>, after: (data: unknown) => unknown): Promise<CollectionsReading> {
  const answer = await call(centralActionOp(action, input))
  const act = actionAnswerOf({status: answer.error ? 'refused' : 'answered', value: answer.outcome?.result === 'action_dispatched' ? answer.outcome : null,
    error: answer.error ?? null}, action)
  if (act.status === 'refused') throw new Error(act.error)
  if (act.status !== 'answered') throw new Error('Central did not answer for your collections.')
  const reading = collectionsReadingOf(after(act.value))
  if (!reading) throw new Error('Central answered something other than your collections.')
  return reading
}

/** Your world's collections, read. */
export const readCollections = (call: Call, world = COLLECTIONS_WORLD): Promise<CollectionsReading> =>
  asked(call, COLLECTIONS_READ, {world}, data => data)

/** Put a thing in a collection; answers the reading after. */
export const addToCollection = (call: Call, collection: string, item: Collectable, world = COLLECTIONS_WORLD): Promise<CollectionsReading> =>
  asked(call, COLLECTIONS_ADD, {world, collection, item: {ref: item.ref, label: item.label, ...(item.kind ? {kind: item.kind} : {})}},
    data => isRecord(data) ? data.reading : null)

/** Take a thing out of a collection; answers the reading after. */
export const removeFromCollection = (call: Call, collection: string, ref: string, world = COLLECTIONS_WORLD): Promise<CollectionsReading> =>
  asked(call, COLLECTIONS_REMOVE, {world, collection, ref}, data => isRecord(data) ? data.reading : null)

/** The window's one held reading of your collections, and whether it is read, refused or not yet asked. */
export type CollectionsStanding =
  | {readonly status: 'unread'}
  | {readonly status: 'read'; readonly reading: CollectionsReading}
  | {readonly status: 'refused'; readonly error: string}

/** The holder the column, the rows and every act share. */
export function collectionsHolder() {
  let standing: CollectionsStanding = {status: 'unread'}
  let version = 0
  const listeners = new Set<() => void>()
  return {
    standing: (): CollectionsStanding => standing,
    reading: (): CollectionsReading | null => standing.status === 'read' ? standing.reading : null,
    version: (): number => version,
    hold(next: CollectionsStanding) {
      standing = next
      version++
      for (const listener of [...listeners]) listener()
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}
export type CollectionsHolder = ReturnType<typeof collectionsHolder>

export const collectionsHeld: CollectionsHolder = collectionsHolder()
