import {useContext, useCallback, useEffect, useRef, useState} from 'react'

/** The Flow document device — central family, face `flow-document`.
 *
 * The 0/1 Flow (Dialogue · Flow · Journal) hosted over the EXISTING path:
 * - the instance is read through the flow owner's own routes
 *   (`readFlowInstance` — Central file read; the document is its own file in
 *   `Control/user/flows/`, never copied into a shell store);
 * - the body is the sandboxed iframe carrying the page with its payload
 *   island; the only host↔frame traffic is the bounded island read
 *   (`oi:document-host-request/response` — the document host bridge the
 *   cradle's frames already carry). Under Tauri the iframe is the native
 *   document frame written with the projection (a srcdoc document inherits
 *   the window's CSP, which refuses the form's own scripts); elsewhere it is
 *   srcdoc — `useDocumentFrame`, one switch by transport;
 * - Save is the document's own revision-checked CAS write
 *   (`writeFlowInstance`): the host reads the island, embeds it with the
 *   owner's `embedDocument`, and the owner CAS-checks `expected_revision`.
 *   A moved revision returns the owner's current bytes — the strip names it
 *   `conflict` and keeps the draft; a basis that moved before the write is
 *   `stale`; the owner's own `unchanged` outcome passes through named.
 *
 * An @ typed in an entry (or typed over a selected passage, which the form then
 * keeps selected) reaches the host as `oi:at-search` (ql-flow.html): the host
 * opens the shell's search line at the caret with the passage and where it
 * came from — this Flow, the link back (central/searchLineDoor.ts; DLW §18.4,
 * O-I #820) — and on close asks the form to put the caret and the selection
 * back (`oi:at-search-closed`).
 *
 * A link the page follows (⌘-click in an entry, a click elsewhere) reaches the
 * host as `oi:page-link` (ql-flow.html); the host opens it in the shell
 * (`openLink`: a page of a world as its page, an http(s) address in the Web
 * widget), or says why not. The frame grants the page no popups and no
 * navigation of its own, so a followed link never takes the Flow's place.
 *
 * A Flow whose island is the form's current schema (`ql-dialogue-flow v0.4`)
 * is drawn by this shell's own form from that island (`currentFlow`), as a
 * Being's or a Thing's page is (DocumentPageFace.tsx currentPage): a Flow made
 * from an earlier copy of the form carries that copy's runtime, so its look
 * and its links stayed as they were made. Save still embeds the island into
 * the file's own bytes. A Flow of an earlier schema is hosted as it is.
 *
 * The page's own internal Save keeps its existing meaning (a portable HTML
 * copy inside the sandbox, in the form's menu); only the host's Save sends
 * writes to the owner — its head's button, and ⌘S pressed inside the page
 * (useSaveKey: the frame's document-save-key.js hands the chord to its host
 * before the form's own ⌘S can download the copy).
 *
 * A draft is never dropped when the pane closes (central/documents/
 * keptDrafts.ts): the face keeps it on this device whenever its poll reads
 * one, and once more before its pane closes; opened again, the Flow comes back
 * with the draft in it, named, until a save is acknowledged or Re-read sets
 * it aside. A draft kept on a revision the Flow has since moved from is put
 * back, and Save names it stale rather than write over the newer Flow.
 * The strip's save outcome renders as the router's named chip — five
 * outcomes, five visuals, detail verbatim in the title.
 *
 * Autosave (DLW §17.8: "Saves a short time after you stop"; central/
 * documents/autosave.ts, after VS Code's files.autoSave afterDelay): the page
 * tells the face each edit as it happens (document-edit.js, which the frame
 * carries; the bridge stays read-only), and a second after the last one the
 * face reads its island once and, when it holds a draft, runs this same
 * Save. A save the router names stale, conflict or refused holds autosave,
 * with its reason, until Save or Re-read; the glyph beside the save state
 * shows saved, saving or held. A save the owner takes leaves the page in its
 * frame, so what was typed while it was in flight stays and is the next
 * draft; only an owner that holds other bytes than were sent is read again. */

import {embedDocument, parseInstance, type QlDoc} from '../../../../../desktop/cradle/src/flow/instance'
import {TEMPLATE_V4} from '../../../../../desktop/cradle/src/flow/plural'
import flowForm from '../../../../../desktop/cradle/documents/ql-flow.html?raw'
import {readFlowInstance, writeFlowInstance, type FlowInstance} from '../../../../../desktop/cradle/src/flow/instances'
import {documentPayloadSource, documentScripts, useDocumentFrame, useDocumentHostRead, type FrameIsland} from '../../../../../desktop/cradle/src/document/frame'
import type {KernelTransportStatus, CentralLocation} from '../../../../../desktop/cradle/src/kernel/types'
import {classifySaveFailure, FLOW_DRAFT_POLL_MS, FLOW_FIRST_READ_MS, flowSaveBaseline, savedOutcome, unchangedOutcome, type SaveRouterReading} from './documentDeviceModel'
import {SaveOutcomeChip} from './inhabitantCard.tsx'
import {linkTarget, PAGE_LINK_MESSAGE, type PageLinkTarget} from './DocumentPageFace'
import './inhabitantDevices.css'
import {DocumentPaneContext, documentStateWords, publishDocument, reachedDocument, revisionShort, withdrawDocument, type DocumentInPane} from '../central/documents/documentDoor'
import {openSearchLine} from '../central/searchLineDoor'
import {flowPacketOf, type PagePacketItem} from '../central/devices/pageReadings'
import {followDocumentPacket} from '../central/devices/documentPacketContext'
import {keepDraft, keptDraftMoved, keptDraftNotice, keptDraftOf, keptDraftRefusal, releaseKeptDraft, useDraftKeeping} from '../central/documents/keptDrafts'
import {useSaveKey} from '../central/documents/useSaveKey'
import {useAutosave} from '../central/documents/useAutosave'
import {autosaveHeldOf} from '../central/documents/autosave'
import {AutosaveGlyph} from '../central/documents/AutosaveGlyph'

/** The message the Flow's form sends its host when an @ is typed in an entry (ql-flow.html), and the one the host answers when the line
 * closes, so the form puts the caret and the selection back. */
export const AT_SEARCH_MESSAGE = 'oi:at-search'
export const AT_SEARCH_CLOSED_MESSAGE = 'oi:at-search-closed'

export interface DocumentFlowFaceProps {
  readonly transport: KernelTransportStatus
  /** The flow instance's owner location (the aperture selects the document;
   * nothing here mints a flow identity — it comes from the document). */
  readonly location: CentralLocation
  /** In a pane the document is the face (the mockup's document pane): its head reads the revision and the save standing, and
   * Save / Re-read stand in the browser's aperture for the document reached (central/documents/documentDoor.ts). As a device
   * the face keeps its own action row. */
  readonly presentation?: 'device' | 'pane'
  /** Open a followed link in the shell (the pane host gives it: a page in a pane, an address in the Web widget). */
  readonly openLink?: (target: PageLinkTarget) => void
}

/** The Flow as this shell's form draws it from its own island, when the island is the form's current schema; any other file as it is. */
export function currentFlow(html: string): string {
  try {
    const doc = parseInstance(html)
    return doc.meta?.template === TEMPLATE_V4 ? embedDocument(flowForm, doc) : html
  } catch { return html }
}

/** The hosted copy: payload read seam + the bounded host bridge, injected
 * the way the cradle's hosting surfaces do. */
function projectFlowDocument(html: string): string {
  const withSeam = documentPayloadSource(html)
  return withSeam.includes('<head>')
    ? withSeam.replace(/<head>/i, `<head>${documentScripts}`)
    : withSeam
}

export function FlowFace({transport, location, presentation = 'device', openLink}: DocumentFlowFaceProps) {
  const inPane = presentation === 'pane'
  const [instance, setInstance] = useState<FlowInstance>()
  const [face, setFace] = useState<string>()
  const [failure, setFailure] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [dirty, setDirty] = useState(false)
  const [pending, setPending] = useState(false)
  const [save, setSave] = useState<SaveRouterReading>()
  const [revision, setRevision] = useState<string>('')
  const [baselined, setBaselined] = useState(false)
  /** The page's own packet as the form holds it now: the owner's read, then each bounded read of the island (To packet lands there first). */
  const [packet, setPacket] = useState<readonly PagePacketItem[]>()
  const holdPacket = useCallback((doc: QlDoc) => {
    const next = flowPacketOf(doc)
    setPacket(was => (was && JSON.stringify(was) === JSON.stringify(next) ? was : next))
  }, [])
  const frame = useRef<HTMLIFrameElement>(null)
  const frameProps = useDocumentFrame(frame, face, transport)
  const readIsland = useDocumentHostRead(frame, true)
  /** The basis the current draft was taken against; a moved basis is stale. */
  const draftBasis = useRef<string>()
  /** The first bounded read after docking — the baseline a save compares
   * against. The page's own boot writes belong to the document, not a draft. */
  const baselineText = useRef<string>()
  /** The revision a draft put back from this device was written against (keptDrafts.ts), while it stands: a save on a Flow that moved
   * from it since is stale, never a write over the newer Flow. */
  const keptBasis = useRef<string>()
  /** The draft last kept on this device, so an unchanged poll writes nothing. */
  const keptText = useRef<string>()
  /** Which page the frame holds: a Re-read begins a new one. A read of the page set aside, answered after it, is never the new basis (it
   * would stand as a draft of the Flow just re-read, and autosave would save it). */
  const frameGeneration = useRef(0)

  /** Read the Flow from its owner; `fresh` (the person's Re-read) asks the owner again whatever the window holds. A draft kept on this
   * device for this Flow (its pane closed on it, or a save met a newer Flow) is put back in the page, and named. */
  const load = useCallback(async (fresh = false) => {
    setFailure(undefined)
    try {
      const read = await readFlowInstance(transport, location, fresh)
      setInstance(read)
      setRevision(read.revision)
      const kept = inPane ? keptDraftOf('Flow', location.ref) : null
      let doc: QlDoc | null = null
      if (kept) { try { doc = JSON.parse(kept.draft) as QlDoc } catch { doc = null } }
      if (kept && doc) {
        // The owner's page as read is the basis the draft is told from; the draft is what the page shows.
        baselineText.current = JSON.stringify(read.doc)
        setBaselined(true)
        keptBasis.current = keptDraftMoved(kept, read.revision) ? kept.basis : undefined
        keptText.current = kept.draft
        draftBasis.current = read.revision
        setDirty(true)
        setNotice(keptDraftNotice(kept, read.revision))
        holdPacket(doc)
        setFace(projectFlowDocument(currentFlow(embedDocument(read.html, doc))))
        return
      }
      holdPacket(read.doc)
      setFace(projectFlowDocument(currentFlow(read.html)))
    } catch (error) {
      setFailure(String(error))
    }
  }, [location, transport, holdPacket, inPane])

  /** Keep the draft the page holds on this device (keptDrafts.ts), or say why it could not be kept; `strict` (the pane closing) throws
   * instead, so the close is refused and the draft stays in its pane. */
  const keepHeld = useCallback((text: string, strict = false) => {
    if (!inPane || !instance || keptText.current === text) return
    try {
      keepDraft({form: 'Flow', ref: location.ref, basis: keptBasis.current ?? instance.revision, draft: text,
        title: instance.doc.meta?.title || instance.doc.meta?.documentId || location.path})
      keptText.current = text
    } catch (error) {
      if (strict) throw error
      setNotice(keptDraftRefusal('Flow', instance.doc.meta?.title))
    }
  }, [inPane, instance, location.path, location.ref])
  const letGo = useCallback((text?: string) => {
    releaseKeptDraft('Flow', location.ref, text)
    if (text === undefined || keptText.current === text) keptText.current = undefined
  }, [location.ref])

  useEffect(() => {void load()}, [load])

  const captureIsland = useCallback(async (): Promise<QlDoc> => {
    const island: FrameIsland | null = await readIsland()
    if (!island || typeof island.text !== 'string') throw new Error('The document island did not answer the bounded read; no writes sent')
    const doc = JSON.parse(island.text) as QlDoc
    holdPacket(doc)
    return doc
  }, [readIsland, holdPacket])

  const saveToOwner = useCallback(async () => {
    if (!instance) return
    setPending(true)
    setNotice(undefined)
    try {
      const doc = await captureIsland()
      // The router names the outcome from the captured fact: the bounded
      // read is what the save would embed, and "changed" means changed
      // since the face docked (the baseline is the first bounded read —
      // the page's own boot writes are the document's, not a draft). Before
      // that first read the owner's page is the basis, never the form's own
      // text, which would read every edit as unchanged.
      const text = JSON.stringify(doc)
      const changed = text !== flowSaveBaseline(baselineText.current, instance.doc)
      if (!changed) {
        // Nothing staged: the host sends nothing. The unchanged outcome is
        // still named, because the router's law is to disclose every save
        // attempt's result.
        setSave(unchangedOutcome())
        setDirty(false)
        letGo(text)
        return
      }
      // A draft put back from this device on a revision the Flow has moved from since: stale, kept, never written over the newer Flow.
      const basis = keptBasis.current ?? draftBasis.current
      if (basis !== undefined && basis !== instance.revision) {
        keepHeld(text)
        setSave(classifySaveFailure(`the document moved from ${basis} to ${instance.revision} after the draft was taken; review before saving`))
        return
      }
      const content = embedDocument(instance.html, doc)
      const result = await writeFlowInstance(transport, instance.location, instance.revision, content)
      if (result.outcome === 'conflict') {
        // The owner named the outcome itself (its CAS refusal): the router
        // carries that name directly — the owner's words are the detail.
        // The draft is kept on this device against the revision it was
        // written on, and the re-read Flow comes back with it in the page.
        keepHeld(text)
        setSave({outcome: 'conflict', detail: `the owner holds revision ${result.current?.revision ?? 'unknown'}; its current bytes are retained for review`, at: new Date().toISOString()})
        if (!inPane) setNotice('The native source moved while this draft stood. Review the current document, then carry the draft or discard it — nothing was overwritten.')
        baselineText.current = undefined
        setBaselined(false)
        await load()
        return
      }
      if (result.outcome === 'unchanged') {
        setSave(unchangedOutcome())
        setDirty(false)
        letGo(text)
        return
      }
      setSave(savedOutcome(`revision ${result.revision ?? instance.revision}`))
      setDirty(false)
      letGo(text)
      draftBasis.current = undefined
      keptBasis.current = undefined
      // The owner holds the bytes sent: the page stays in its frame — an edit typed while the save was in flight stays in it, the next
      // draft (autosave saves while you write) — and the page as saved is the new basis. An owner that holds something else is read again.
      if (result.revision && !result.current) {
        setInstance({...instance, html: content, revision: result.revision, doc})
        setRevision(result.revision)
        baselineText.current = text
        return
      }
      // The owner holds other bytes: its page replaces this one, as a Re-read's does (a read of this page is not the new basis).
      frameGeneration.current++
      setFace(undefined)
      baselineText.current = undefined
      setBaselined(false)
      await load()
    } catch (error) {
      setSave(classifySaveFailure(error))
    } finally {
      setPending(false)
    }
  }, [captureIsland, instance, load, transport, keepHeld, letGo, inPane])

  // A re-read takes the owner's page as it now stands, and that page is the new baseline: the one read before would make the
  // owner's own change (a title written from Clip view, an entry appended by the Flow device) read as a draft. Re-reading is how
  // the person sets a draft aside (the page family's refusals say "save or re-read them first"), so the draft fact clears too.
  const reread = useCallback(() => {
    // A new page: the old one leaves the frame until the owner's stands in it (WebKit answers a read from the old page until a new srcdoc
    // commits), and a read of it still in flight is dropped.
    frameGeneration.current++
    setFace(undefined)
    baselineText.current = undefined
    draftBasis.current = undefined
    keptBasis.current = undefined
    // Re-reading sets the draft aside: a draft kept on this device for this Flow goes with it (keptDrafts.ts).
    releaseKeptDraft('Flow', location.ref)
    keptText.current = undefined
    setNotice(undefined)
    setBaselined(false)
    setDirty(false)
    // The outcome of a save of the draft set aside goes with it: a stale or conflicting one no longer holds autosave (VS Code: a revert
    // ends a document's conflict and error), as the Being's and the Thing's Re-read already clears it.
    setSave(undefined)
    void load(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `load` follows the location this lets go of
  }, [load])

  const markDraft = useCallback(() => {
    draftBasis.current = revision
    setDirty(true)
  }, [revision])

  // What the page holds reaches the host only through the island read (the
  // page tells that an edit happened, never what: document-edit.js); a draft
  // exists when the host has taken a read and the island differs from the
  // owner's last known content. The bridge is read-only by construction — the
  // host never pushes content into the sandbox. The poll keeps the draft fact
  // standing between edits; autosave reads it at the pause after each.
  const refreshDraftStanding = useCallback(async () => {
    if (!instance || !face || pending) return
    const generation = frameGeneration.current
    try {
      const doc = await captureIsland()
      if (generation !== frameGeneration.current) return
      if (baselineText.current === undefined) {
        baselineText.current = JSON.stringify(doc)
        setBaselined(true)
        return
      }
      const text = JSON.stringify(doc)
      if (text !== baselineText.current) {
        markDraft()
        // The draft is kept on this device as it stands, so a pane that closes (or a window that goes) never takes it with it.
        keepHeld(text)
      }
    } catch {
      // Absence of an answer is not a draft; the strip keeps its last state. Three silent polls after the form stood (7.5 s)
      // mean its own scripts never started in this window: say so, rather than show blank paper (the native pass at
      // 14cb8a1bb showed the Flow pane blank while the same document draws its entries standalone).
      unanswered.current += 1
      if (unanswered.current === SILENT_POLLS && baselineText.current === undefined) setNotice('The Flow\'s form has not started in this window: its own scripts did not answer the host\'s read, so nothing is drawn and nothing can be saved.')
    }
  }, [captureIsland, face, instance, markDraft, pending, keepHeld])
  /** The draft fact now, for autosave's read at the pause. */
  const dirtyNow = useRef(dirty)
  dirtyNow.current = dirty
  /** Autosave's read at the pause (useAutosave): the island against the basis, a draft marked and kept as the poll keeps it; true when the
   * page holds one. Before the form's first answer there is no basis to tell a draft from, so nothing is saved. */
  const settle = useCallback(async () => {
    if (!instance || !face || baselineText.current === undefined) return false
    const generation = frameGeneration.current
    const text = JSON.stringify(await captureIsland())
    if (generation !== frameGeneration.current) return false
    if (text !== baselineText.current) { markDraft(); keepHeld(text); return true }
    return dirtyNow.current
  }, [captureIsland, face, instance, markDraft, keepHeld])
  const unanswered = useRef(0)
  /** Silent first reads before the face says the form never started: 7.5 s, as when it was asked every 2.5 s. */
  const SILENT_POLLS = 7500 / FLOW_FIRST_READ_MS

  // A new form starts its count afresh; the poll below re-arms whenever its callback changes, which must not reset it.
  useEffect(() => { unanswered.current = 0 }, [face])
  // Until the form first answers, ask it often: that answer is the baseline, and an edit made before it would become the
  // baseline and never be saved. Once it stands, the slower poll keeps the draft standing.
  useEffect(() => {
    if (!face) return
    const timer = window.setInterval(() => void refreshDraftStanding(), baselined ? FLOW_DRAFT_POLL_MS : FLOW_FIRST_READ_MS)
    return () => window.clearInterval(timer)
  }, [face, refreshDraftStanding, baselined])

  // A link the page follows reaches its host as a message from this frame only; the host opens it in the shell, or says why not.
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || (event.data as {type?: unknown})?.type !== PAGE_LINK_MESSAGE) return
      const target = linkTarget((event.data as {href?: unknown}).href)
      if (target.kind === 'none') { setNotice(target.why); return }
      if (!openLink) { setNotice('No pane tree is mounted to open the link in.'); return }
      setNotice(undefined)
      openLink(target)
    }
    window.addEventListener('message', listener)
    return () => window.removeEventListener('message', listener)
  }, [openLink])

  const documentLabel = instance?.doc.meta.title || instance?.doc.meta.documentId || location.path

  // An @ in an entry: the search line opens at the caret, over this pane, with the passage selected (if any) and where it came from.
  const labelNow = useRef(documentLabel)
  labelNow.current = documentLabel
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const host = frame.current
      if (!host || event.source !== host.contentWindow || (event.data as {type?: unknown})?.type !== AT_SEARCH_MESSAGE) return
      const data = event.data as {passage?: unknown; at?: {x?: unknown; y?: unknown}}
      const box = host.getBoundingClientRect()
      const x = typeof data.at?.x === 'number' ? box.left + data.at.x : box.left, y = typeof data.at?.y === 'number' ? box.top + data.at.y : box.top
      const text = typeof data.passage === 'string' && data.passage.trim() ? data.passage : null
      openSearchLine({door: 'flow', at: {x, y}, passage: text ? {text, from: `Flow — ${labelNow.current}`, path: location.path} : null,
        restore: () => { host.focus(); host.contentWindow?.postMessage({type: AT_SEARCH_CLOSED_MESSAGE}, '*') }})
    }
    window.addEventListener('message', listener)
    return () => window.removeEventListener('message', listener)
  }, [location.path])
  const key = useRef(`flow:${Math.random().toString(36).slice(2)}`).current
  const paneId = useContext(DocumentPaneContext) ?? undefined
  // The door carries the Flow's own location, draft fact and last save outcome, so the page family's devices read the reached
  // Flow's file and its save standing from the face that holds it (central/devices/pageDevices.tsx), never a second copy.
  const standing: DocumentInPane = {key, paneId, form: 'Flow', title: documentLabel, revision: revision || undefined,
    state: face && !baselined && !save ? 'form not answered yet' : documentStateWords({pending, dirty, save}), save: face && !pending ? () => void saveToOwner() : undefined,
    reread: pending ? undefined : reread, rereadLabel: 'Re-read', location: instance?.location ?? location, dirty,
    ...(save ? {outcome: save.outcome} : {}), ...(packet ? {packet} : {})}
  // The aperture follows the document the hand reached (the first one standing until then); a change of standing reaches it.
  useEffect(() => { if (inPane) publishDocument(standing, !reachedDocument()) })
  // While a Flow stands in a pane, a Send brings AIKit's prepared context to the reached document's packet first (lane AA's proposal,
  // O-I #745): the Send carries what the Packet shows (central/devices/documentPacketContext.ts).
  useEffect(() => (inPane ? followDocumentPacket() : undefined), [inPane])
  useEffect(() => () => withdrawDocument(key), [key])
  // ⌘S pressed inside the page is this Save (§10.9, §17.8), not the form's portable copy.
  useSaveKey(frame, standing.save)
  // Autosave (§17.8): this same Save a second after you stop, held while a save stands stale, in conflict or refused.
  const autosave = useAutosave(frame, {settle, save: standing.save ? saveToOwner : undefined, pending, dirty, held: autosaveHeldOf(save)})
  // Before the pane closes (or splits, or moves), the page is read once more and its draft kept; a page as read lets any kept one go.
  useDraftKeeping(inPane ? paneId : undefined, async () => {
    if (!instance || !face || pending) return
    let doc: QlDoc
    try { doc = await captureIsland() } catch { return } // the form never answered: nothing was written in it to keep
    const text = JSON.stringify(doc)
    if (text !== flowSaveBaseline(baselineText.current, instance.doc) || keptBasis.current !== undefined) keepHeld(text, true)
    else letGo()
  })

  return (
    <div
      onPointerDownCapture={inPane ? () => publishDocument(standing, true) : undefined}
      onFocusCapture={inPane ? () => publishDocument(standing, true) : undefined}
      className="inhabitant-face-body inhabitant-document"
      data-document-device="ql-flow"
      data-save-outcome={save?.outcome ?? ''}
      data-dirty={dirty ? 'true' : 'false'}
      data-baselined={baselined ? 'true' : 'false'}
      data-basis-revision={revision}
    >
      {inPane ? <div className="document-pane-head" data-document-head="flow">
        <span className="document-pane-form">Flow</span>
        <span className="document-pane-state" role="status" aria-live="polite">{revision ? `r${revisionShort(revision)} · ` : ''}{standing.state}</span>
        <AutosaveGlyph glyph={autosave.glyph} />
        <span className="document-pane-acts">
          <button type="button" data-action="save" disabled={!standing.save} onClick={() => standing.save?.()}
            data-i="Save to Central|The owner's revision-checked write of the Flow as it stands in its pane.">Save</button>
          <button type="button" data-action="reread" disabled={!standing.reread} onClick={() => standing.reread?.()}
            data-i="Re-read|Read the Flow again from its owner; a draft not saved is set aside.">Re-read</button>
        </span>
      </div> : <div className="inhabitant-body-actions">
        <button type="button" className="inhabitant-act" data-action="save" disabled={!face || pending} onClick={() => void saveToOwner()}>Save to native source</button>
        <button type="button" className="inhabitant-act" data-action="reread" disabled={pending} onClick={() => void load(true)}>Re-read current document</button>
        <span className="inhabitant-device-save" role="status" aria-live="polite" data-save-outcome-label={save?.outcome ?? ''}>
          {save
            ? <SaveOutcomeChip outcome={save.outcome} detail={save.detail}/>
            : <span className="inhabitant-quiet">{pending ? 'waiting for the native operation…' : 'no save attempted'}</span>}
        </span>
        <AutosaveGlyph glyph={autosave.glyph} />
      </div>}
      {failure && <p className="inhabitant-device-fault" role="alert">Flow document unavailable: {failure}</p>}
      {notice && <p className="inhabitant-device-notice" role="status">{notice}</p>}
      {face === undefined || !frameProps
        ? <p role="status" className="inhabitant-quiet">Reading the flow instance…</p>
        : <iframe key={frameProps.key} ref={frame} className="inhabitant-document-frame" title={`Flow — Dialogue · Flow · Journal · ${documentLabel}`} sandbox="allow-scripts allow-forms allow-downloads" referrerPolicy="no-referrer" src={frameProps.src} srcDoc={frameProps.srcDoc}/>}
    </div>
  )
}

/** The island read shape, re-exported for the fixture harness. */
export type {FrameIsland}

/** The name the manifest grammar uses (the §5.2 face kind), kept as the
 * component's export alias for hosts that compose the face directly. */
export {FlowFace as DocumentFlowFace}
