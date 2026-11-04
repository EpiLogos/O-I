// The point in the reading of a Central page held in a pane (DLW §10.7 Going back: "You return to the same place, the same page and the
// same point in the reading"; §23.5 Trail, Return). The page's frame tells where its reader stands (desktop/cradle/src/context/
// document-point.js, carried by every hosted document frame: document/frame.ts useDocumentFrame); this relays it to the trail as an
// occasion of the page through the pane's own encounter (the spine bridge's readOnTrail: reading on in the page you stand on is where you
// stand, another page is a move), named by the page's ref and title — never a word of it. A walk on the trail that lands where the book
// holds this page at another point sends the frame that point, and a frame drawn again (a Re-read, a restart) is sent the point the book
// holds for it.
//
// The page's ref is the one THE selection names it by — the Central-relative path of its file (ModeBrowser's Flows, Beings and Things
// rows select `location.path`) — so reading a selected page refines the selection's own stop. A page drawn outside a pane (a device's
// card) has no encounter, and tells nothing.
import {createContext, useContext, useEffect, useRef, type RefObject} from 'react'
import type {EncounterBridge, EncounterSnapshot} from '../../../../../../desktop/cradle/src/surface/projectionModules'
import {DOCUMENT_POINT_GO, documentPointOf} from '../../../../../../desktop/cradle/src/document/frame'

/** The encounter of the pane a page is read in (CentralDocumentPane.tsx gives it); null where a page is drawn outside a pane. */
export const ReadingEncounterContext = createContext<EncounterBridge | null>(null)

/** A page as the trail names it: its ref and its title. */
export interface ReadingPage {readonly ref: string; readonly title?: string}

/** A Day's page, named by its date. Your world's Day is its file's path (the owner's source ref `central:source:control:root:<path>`), the
 * path its Days row selects it by (central/daySurface.ts dayEntriesOf: `Control/user/day/<date>/day.md`), so reading a selected Day refines
 * the selection's stop; a project's Day, which no Days row selects, keeps the owner's whole ref. Pure. */
export function dayReadingOf(sourceRef: string, documentId: string): ReadingPage {
  const path = /^central:source:control:root:(.+)$/.exec(sourceRef)?.[1] ?? sourceRef
  const date = /(\d{4}-\d{2}-\d{2})/.exec(documentId)?.[1]
  return {ref: path, title: date ? `Day ${date}` : documentId}
}

/** One page's point in the reading, between its frame and the trail: `told` takes the frame's messages, `read` each publication of the
 * encounter; `send` hands the frame a point. It keeps the point the frame stands at (the last it told, or was sent) and the point the
 * book holds for the page, so nothing is sent twice and nothing told is sent back. Pure over its three channels. */
export function createReadingPoint(page: () => ReadingPage, encounter: Pick<EncounterBridge, 'transition'>, send: (position: string) => void) {
  let at: string | null = null, held: string | null = null
  return {
    told(data: unknown): void {
      const said = documentPointOf(data)
      if (said === 'ready') {
        // A frame drawn again stands at its top: the point the book holds for the page is sent to it.
        at = held
        if (held) send(held)
        return
      }
      if (!said) return
      at = said.position
      const {ref, title} = page()
      encounter.transition({kind: 'occasion', ref, position: said.position, ...(title ? {title} : {})})
    },
    read(snapshot: Pick<EncounterSnapshot, 'reading'>): void {
      const reading = snapshot.reading
      held = reading && reading.ref === page().ref && reading.position ? reading.position : null
      if (held && held !== at) { at = held; send(held) }
    },
  }
}

/** A hosted page's point in the reading, kept on the trail through the pane it is held in. `page` is null while the page is unknown. */
export function useReadingPoint(frame: RefObject<HTMLIFrameElement | null>, page: ReadingPage | null): void {
  const encounter = useContext(ReadingEncounterContext)
  const named = useRef(page)
  named.current = page
  const ref = page?.ref
  useEffect(() => {
    if (!encounter || !ref) return
    const point = createReadingPoint(() => named.current ?? {ref}, encounter,
      position => frame.current?.contentWindow?.postMessage({type: DOCUMENT_POINT_GO, position}, '*'))
    const receive = (event: MessageEvent) => { if (frame.current && event.source === frame.current.contentWindow) point.told(event.data) }
    window.addEventListener('message', receive)
    const stop = encounter.subscribe(snapshot => point.read(snapshot))
    return () => { window.removeEventListener('message', receive); stop() }
  }, [encounter, ref, frame])
}
