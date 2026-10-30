// The browser's Collections, in every mode (manual §10.3: "Down the browser's left side stand Live's three groups: Collections, the
// coloured favourites you make …"): the column's first group, one category per collection the column shows (each you chose to show;
// unchosen, Favourites and each other colour once it holds something), each counting what it holds; its rows are the things in it, a
// press previews one at the foot of the list and the preview's Remove takes it out, and a double-click or Enter opens it as its place's
// row opens it (placeActs.ts: a world comes into today, a Day opens). As Live's labels, each collection has Rename (⌘R) and Hide in its
// menu, and Edit on the group's heading lists all seven, each ticked where the column shows it. Central keeps them (collections.ts; ctrl
// collections.rs): the Keeper reads them while the browser stands, and every act answers with the reading after it, so the column and
// the rows follow the one reading.
//
// A thing is put in a collection from its preview (CollectStrip): Live's seven colours stand there, each pressed when the collection
// holds the thing; a press puts it in or takes it out. The Places' previews carry the strip (PlaceRows.tsx).
import {useContext, useEffect, useState, useSyncExternalStore} from 'react'
import {createPortal} from 'react-dom'
import {kernelOp} from '../../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelOp, KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {Refusal, refusalWords} from '../../../../../../desktop/cradle/src/shared/Refusal.tsx'
import {Workspace} from '../../shell/workspaceContext'
import {seatWorldFromBrowser} from '../../shell/ModeBrowser'
import {heldCall} from '../../owners/ownerCall'
import {useOwnerReading} from '../../owners/ownerReading'
import {useSpineEpoch} from '../../owners/spine'
import {centralRoot} from '../../central/centralWorlds'
import {CENTRAL_DAYS_PATH, dayEntriesOf} from '../../central/daySurface'
import {useCentralDocumentOpener} from '../../central/documents/useOpenCentralDocument'
import type {BrowserCategory, BrowserSource, ControlledBrowser, EditEntry} from './browserKinds'
import {
  COLLECTIONS_WORLD, addToCollection, collectedWords, collectionShows, collectionsCall, collectionsHeld, collectionsHolding, collectionsReach, readCollections,
  removeFromCollection, renameCollection, showCollection, shownCollections, type CollectedItem, type Collectable, type Collection, type CollectionColour,
  type CollectionsReading,
} from './collections'
import {openPlaceRow, placeRowOf, type PlaceReads} from './placeActs'

/** A collection's colour, as a swatch: the colour's token (browser.css `[data-collection-colour]`). */
export function CollectionSwatch({colour, size = 8}: {colour: CollectionColour; size?: number}) {
  return <span className="collection-swatch" data-collection-colour={colour} style={{width: size, height: size}} aria-hidden="true" />
}

const callOf = (transport: KernelTransportStatus) => (op: KernelOp) => kernelOp(transport, op)
const useTransport = (): KernelTransportStatus | null => useContext(Workspace)?.transport ?? null
const useHeld = () => useSyncExternalStore(collectionsHeld.subscribe, collectionsHeld.standing, collectionsHeld.standing)

/** Holds your collections while the browser stands: Central's reading, under the window's epoch, into the one holder. */
function CollectionsKeeper() {
  const transport = useTransport()
  const epoch = useSpineEpoch()
  const usable = transport && transport.kind !== 'unavailable' ? transport : null
  const {reading} = useOwnerReading<CollectionsReading>(usable ? JSON.stringify(['central.collections.read', usable, COLLECTIONS_WORLD]) : null,
    async () => {
      try { return {value: await readCollections(callOf(usable!))} } catch (cause) { return {error: cause instanceof Error ? cause.message : String(cause)} }
    }, epoch)
  useEffect(() => {
    if (reading.status === 'answered' && reading.value) collectionsHeld.hold({status: 'read', reading: reading.value})
    else if (reading.status === 'refused') collectionsHeld.hold({status: 'refused', error: reading.error ?? 'Central did not answer'})
  }, [reading])
  // The column's acts on a collection (Rename, Hide, Edit's ticks) reach Central through this window's kernel while the browser stands.
  useEffect(() => {
    collectionsReach(usable ? callOf(usable) : null)
    return () => collectionsReach(null)
  }, [usable ? JSON.stringify(usable) : null]) // eslint-disable-line react-hooks/exhaustive-deps -- the transport is its value
  return null
}

/** The reads a collected thing's row is made from again (placeActs.ts placeRowOf): Central's root disclosure, your Days as listed. */
const placeReads = (transport: KernelTransportStatus): PlaceReads => ({
  root: () => centralRoot(transport),
  days: async () => {
    const call = await heldCall(transport, {op: 'files_list', path: CENTRAL_DAYS_PATH})
    // A world that has kept no Day yet has no day folder: that is no Days (PlaceRows.tsx reads it so).
    if (call.error) { if (/No such file or directory/i.test(call.error)) return []; throw new Error(call.error) }
    return call.outcome?.result === 'directory_read' ? dayEntriesOf(call.outcome.directory.entries ?? []) : []
  },
})

/** Put a thing in a collection, or take it out, through Central; the reading after it is held. Throws Central's refusal in words. */
async function toggle(transport: KernelTransportStatus, reading: CollectionsReading | null, collection: string, item: Collectable): Promise<void> {
  const call = callOf(transport)
  const held = collectionsHolding(reading, item.ref).has(collection)
  const after = held ? await removeFromCollection(call, collection, item.ref) : await addToCollection(call, collection, item)
  collectionsHeld.hold({status: 'read', reading: after})
}

/** Live's seven colours for one thing: each pressed when its collection holds the thing; a press puts it in or takes it out. */
export function CollectStrip({item}: {item: Collectable}) {
  const transport = useTransport()
  const held = useHeld()
  const reading = held.status === 'read' ? held.reading : null
  const [fault, setFault] = useState<{readonly said: string; readonly error: unknown} | null>(null)
  const [busy, setBusy] = useState(false)
  if (!transport || transport.kind === 'unavailable') return <p className="browser-empty" role="status">Collections are kept by Central, which this window cannot reach yet.</p>
  if (held.status === 'refused') return <p className="native-error" role="alert">{refusalWords('Your collections are not read, so nothing can be put in one.', held.error)}</p>
  if (!reading) return <p className="browser-empty" role="status">Reading your collections…</p>
  const holding = collectionsHolding(reading, item.ref)
  return <div className="collect-strip" data-collect={item.ref}>
    <span className="collect-strip-words">Collections</span>
    {reading.collections.map(collection => {
      const has = holding.has(collection.id)
      const words = has ? `${item.label} is in ${collection.name}: press to take it out.` : `Put ${item.label} in ${collection.name}.`
      return <button key={collection.id} type="button" className="collect-strip-colour" aria-pressed={has} disabled={busy} data-collection={collection.id}
        aria-label={words} title={words} data-i={`${collection.name}|${words}`}
        onClick={() => {
          setBusy(true); setFault(null)
          void toggle(transport, reading, collection.id, item)
            .catch(cause => setFault({said: `${item.label} was not ${has ? 'taken out of' : 'put in'} ${collection.name}.`, error: cause}))
            .finally(() => setBusy(false))
        }}><CollectionSwatch colour={collection.colour} size={10} /></button>
    })}
    {fault && <Refusal said={fault.said} error={fault.error} className="oi-refusal collect-strip-refusal" />}
  </div>
}

/** One collection's things, under the browser's control: a press previews one; its preview's Remove takes it out. */
function CollectionRows({controlled}: {controlled: ControlledBrowser}) {
  const transport = useTransport()
  const held = useHeld()
  const [selected, select] = useState<string | null>(null)
  const [fault, setFault] = useState<{readonly said: string; readonly error: unknown} | null>(null)
  const [said, setSaid] = useState<string | null>(null)
  const {openDay} = useCentralDocumentOpener()
  // A collected thing opens as its place's row does: its row read again from its owner, then the row's own act.
  const open = (item: CollectedItem) => {
    if (!transport || transport.kind === 'unavailable') return
    setFault(null); setSaid(null)
    void placeRowOf(item, placeReads(transport))
      .then(row => row ? openPlaceRow(row, {seat: world => seatWorldFromBrowser(world), openDay}) : null)
      .then(answer => { if (answer?.ok) setSaid(answer.words); else if (answer) setFault({said: answer.words, error: null}) },
        cause => setFault({said: `${item.label} did not open.`, error: cause}))
  }
  if (held.status === 'refused') return <p className="native-error" role="alert">{refusalWords('Your collections are not read.', held.error)}</p>
  if (held.status === 'unread') return <p className="browser-empty" role="status">Reading your collections…</p>
  const collection = held.reading.collections.find(entry => entry.id === controlled.category)
  if (!collection) return <p className="browser-empty">This collection is not among yours.</p>
  const needle = controlled.query.trim().toLocaleLowerCase()
  const items = needle ? collection.items.filter(item => `${item.label} ${item.kind ?? ''} ${item.ref}`.toLocaleLowerCase().includes(needle)) : collection.items
  const chosen = collection.items.find(item => item.ref === selected) ?? null
  const remove = (ref: string, label: string) => {
    if (!transport || transport.kind === 'unavailable') return
    setFault(null)
    void removeFromCollection(callOf(transport), collection.id, ref)
      .then(after => { collectionsHeld.hold({status: 'read', reading: after}); select(null) })
      .catch(cause => setFault({said: `${label} was not taken out of ${collection.name}.`, error: cause}))
  }
  return <div className="browser-results" data-browser-collection={collection.id}>
    <div className="browser-list-heading">Name <span /></div>
    {items.map(item => <button key={item.ref} type="button" className="browser-item" aria-pressed={item.ref === selected} data-collected={item.ref}
      title={collectedWords(item, collection)} data-i={`${item.label}|${collectedWords(item, collection)}`}
      onClick={() => select(item.ref)} onDoubleClick={() => open(item)}
      onKeyDown={event => {
        if (event.key === 'Backspace' || event.key === 'Delete') { event.preventDefault(); remove(item.ref, item.label) }
        else if (event.key === 'Enter' && !event.altKey && !event.metaKey && !event.ctrlKey) { event.preventDefault(); open(item) }
      }}>
      <CollectionSwatch colour={collection.colour} /><span>{item.label}</span><span className="mode-browser-row-meta">{item.kind ?? ''}</span>
    </button>)}
    {!collection.items.length && <p className="browser-empty">{collection.name} holds nothing yet: select a row of a place and press this colour in its preview.</p>}
    {collection.items.length > 0 && !items.length && <p className="browser-empty">Nothing in {collection.name} matches.</p>}
    {fault && <Refusal said={fault.said} error={fault.error} />}
    {said && <p className="browser-empty" role="status">{said}</p>}
    {controlled.previewHost && chosen && createPortal(<div className="collected-preview" role="status">
      <p>{collectedWords(chosen, collection)}</p>
      <button type="button" className="native-control" data-action="remove-collected"
        data-i={`Remove|Takes ${chosen.label} out of ${collection.name}; it stays where it is.`}
        onClick={() => remove(chosen.ref, chosen.label)}>Remove from {collection.name}</button>
    </div>, controlled.previewHost)}
  </div>
}

/** An act on a collection through Central, the reading after it held. Rejects with Central's refusal, or why Central is out of reach. */
async function onCollection(act: (call: ReturnType<typeof collectionsCall>) => Promise<CollectionsReading>): Promise<void> {
  const after = await act(collectionsCall())
  collectionsHeld.hold({status: 'read', reading: after})
}

const categoryOf = (collection: Collection, counted: boolean): BrowserCategory => ({
  id: collection.id, label: collection.name, kind: 'collection', mark: <CollectionSwatch colour={collection.colour} />,
  hint: `what you put in ${collection.name}`,
  info: `${collection.name}: a collection of yours, kept by Central. What you put in it stands here; select a row of a place and press this colour in its preview to put it in. Its menu renames it (⌘R) or hides it; Edit on the heading shows it again.`,
  ...(counted ? {count: collection.items.length} : {}),
  // Before Central answers, Favourites stands with no acts: there is nothing yet to rename or hide.
  ...(counted ? {acts: {
    rename: (name: string) => onCollection(call => renameCollection(call, collection.id, name)),
    hide: () => onCollection(call => showCollection(call, collection.id, false)),
  }} : {}),
})

/** Live's Edit on the Collections heading: all seven, each ticked where the column shows it; a tick shows or hides it through Central. */
const editEntries = (): readonly EditEntry[] => (collectionsHeld.reading()?.collections ?? []).map((collection, index) => ({
  id: collection.id, label: collection.name, mark: <CollectionSwatch colour={collection.colour} />, shown: collectionShows(collection, index),
  show: (shown: boolean) => onCollection(call => showCollection(call, collection.id, shown)),
}))

/** The Collections as a row source: its categories follow your collections (collections.ts collectionShows), each with Rename and Hide;
 * its heading's Edit lists all seven. */
export const COLLECTIONS_SOURCE: BrowserSource = {
  id: 'collections',
  get categories(): readonly BrowserCategory[] {
    const reading = collectionsHeld.reading()
    return shownCollections(reading).map(collection => categoryOf(collection, reading !== null))
  },
  Body: CollectionRows,
  moves: {subscribe: collectionsHeld.subscribe, version: collectionsHeld.version},
  Keeper: CollectionsKeeper,
  edit: {kind: 'collection', entries: editEntries},
}
