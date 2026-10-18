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
 * The page's own internal Save keeps its existing meaning (a portable HTML
 * copy inside the sandbox); only the host button sends writes to the owner.
 * The strip's save outcome renders as the router's named chip — five
 * outcomes, five visuals, detail verbatim in the title. */

import {embedDocument, type QlDoc} from '../../../../../desktop/cradle/src/flow/instance'
import {readFlowInstance, writeFlowInstance, type FlowInstance} from '../../../../../desktop/cradle/src/flow/instances'
import {documentPayloadSource, documentScripts, useDocumentFrame, useDocumentHostRead, type FrameIsland} from '../../../../../desktop/cradle/src/document/frame'
import type {KernelTransportStatus, CentralLocation} from '../../../../../desktop/cradle/src/kernel/types'
import {classifySaveFailure, savedOutcome, unchangedOutcome, type SaveRouterReading} from './documentDeviceModel'
import {SaveOutcomeChip} from './inhabitantCard.tsx'
import './inhabitantDevices.css'
import {DocumentPaneContext, documentStateWords, publishDocument, reachedDocument, revisionShort, withdrawDocument, type DocumentInPane} from '../central/documents/documentDoor'

export interface DocumentFlowFaceProps {
  readonly transport: KernelTransportStatus
  /** The flow instance's owner location (the aperture selects the document;
   * nothing here mints a flow identity — it comes from the document). */
  readonly location: CentralLocation
  /** In a pane the document is the face (the mockup's document pane): its head reads the revision and the save standing, and
   * Save / Re-read stand in the browser's aperture for the document reached (central/documents/documentDoor.ts). As a device
   * the face keeps its own action row. */
  readonly presentation?: 'device' | 'pane'
}

/** The hosted copy: payload read seam + the bounded host bridge, injected
 * the way the cradle's hosting surfaces do. */
function projectFlowDocument(html: string): string {
  const withSeam = documentPayloadSource(html)
  return withSeam.includes('<head>')
    ? withSeam.replace(/<head>/i, `<head>${documentScripts}`)
    : withSeam
}

export function FlowFace({transport, location, presentation = 'device'}: DocumentFlowFaceProps) {
  const [instance, setInstance] = useState<FlowInstance>()
  const [face, setFace] = useState<string>()
  const [failure, setFailure] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [dirty, setDirty] = useState(false)
  const [pending, setPending] = useState(false)
  const [save, setSave] = useState<SaveRouterReading>()
  const [revision, setRevision] = useState<string>('')
  const [baselined, setBaselined] = useState(false)
  const frame = useRef<HTMLIFrameElement>(null)
  const frameProps = useDocumentFrame(frame, face, transport)
  const readIsland = useDocumentHostRead(frame, true)
  /** The basis the current draft was taken against; a moved basis is stale. */
  const draftBasis = useRef<string>()
  /** The first bounded read after docking — the baseline a save compares
   * against. The page's own boot writes belong to the document, not a draft. */
  const baselineText = useRef<string>()

  const load = useCallback(async () => {
    setFailure(undefined)
    try {
      const read = await readFlowInstance(transport, location)
      setInstance(read)
      setRevision(read.revision)
      setFace(projectFlowDocument(read.html))
    } catch (error) {
      setFailure(String(error))
    }
  }, [location, transport])

  useEffect(() => {void load()}, [load])

  const captureIsland = useCallback(async (): Promise<QlDoc> => {
    const island: FrameIsland | null = await readIsland()
    if (!island || typeof island.text !== 'string') throw new Error('The document island did not answer the bounded read; no writes sent')
    return JSON.parse(island.text) as QlDoc
  }, [readIsland])

  const saveToOwner = useCallback(async () => {
    if (!instance) return
    setPending(true)
    setNotice(undefined)
    try {
      const doc = await captureIsland()
      // The router names the outcome from the captured fact: the bounded
      // read is what the save would embed, and "changed" means changed
      // since the face docked (the baseline is the first bounded read —
      // the page's own boot writes are the document's, not a draft).
      const baseline = baselineText.current ?? JSON.stringify(doc)
      baselineText.current = baseline
      const changed = JSON.stringify(doc) !== baseline
      if (!changed) {
        // Nothing staged: the host sends nothing. The unchanged outcome is
        // still named, because the router's law is to disclose every save
        // attempt's result.
        setSave(unchangedOutcome())
        setDirty(false)
        return
      }
      if (draftBasis.current !== undefined && draftBasis.current !== instance.revision) {
        setSave(classifySaveFailure(`the document moved from ${draftBasis.current} to ${instance.revision} after the draft was taken; review before saving`))
        return
      }
      const result = await writeFlowInstance(transport, instance.location, instance.revision, embedDocument(instance.html, doc))
      if (result.outcome === 'conflict') {
        // The owner named the outcome itself (its CAS refusal): the router
        // carries that name directly — the owner's words are the detail.
        setSave({outcome: 'conflict', detail: `the owner holds revision ${result.current?.revision ?? 'unknown'}; its current bytes are retained for review`, at: new Date().toISOString()})
        setNotice('The native source moved while this draft stood. Review the current document, then carry the draft or discard it — nothing was overwritten.')
        baselineText.current = undefined
        setBaselined(false)
        await load()
        return
      }
      if (result.outcome === 'unchanged') {
        setSave(unchangedOutcome())
        setDirty(false)
        return
      }
      setSave(savedOutcome(`revision ${result.revision ?? instance.revision}`))
      setDirty(false)
      draftBasis.current = undefined
      baselineText.current = undefined
      setBaselined(false)
      await load()
    } catch (error) {
      setSave(classifySaveFailure(error))
    } finally {
      setPending(false)
    }
  }, [captureIsland, instance, load, transport])

  // A re-read takes the owner's page as it now stands, and that page is the new baseline: the one read before would make the
  // owner's own change (a title written from Clip view, an entry appended by the Flow device) read as a draft. Re-reading is how
  // the person sets a draft aside (the page family's refusals say "save or re-read them first"), so the draft fact clears too.
  const reread = useCallback(() => {
    baselineText.current = undefined
    draftBasis.current = undefined
    setBaselined(false)
    setDirty(false)
    void load()
  }, [load])

  const markDraft = useCallback(() => {
    draftBasis.current = revision
    setDirty(true)
  }, [revision])

  // The page announces intent only through the island read; a draft exists
  // when the host has taken a read and the island differs from the owner's
  // last known content. The bridge is read-only by construction — the host
  // never pushes content into the sandbox.
  const refreshDraftStanding = useCallback(async () => {
    if (!instance || !face || pending) return
    try {
      const doc = await captureIsland()
      if (baselineText.current === undefined) {
        baselineText.current = JSON.stringify(doc)
        setBaselined(true)
        return
      }
      if (JSON.stringify(doc) !== baselineText.current) markDraft()
    } catch {
      // Absence of an answer is not a draft; the strip keeps its last state. Three silent polls after the form stood (7.5 s)
      // mean its own scripts never started in this window: say so, rather than show blank paper (the native pass at
      // 14cb8a1bb showed the Flow pane blank while the same document draws its entries standalone).
      unanswered.current += 1
      if (unanswered.current === 3 && baselineText.current === undefined) setNotice('The Flow\'s form has not started in this window: its own scripts did not answer the host\'s read, so nothing is drawn and nothing can be saved.')
    }
  }, [captureIsland, face, instance, markDraft, pending])
  const unanswered = useRef(0)

  // A new form starts its count afresh; the poll below re-arms whenever its callback changes, which must not reset it.
  useEffect(() => { unanswered.current = 0 }, [face])
  useEffect(() => {
    if (!face) return
    const timer = window.setInterval(() => void refreshDraftStanding(), 2500)
    return () => window.clearInterval(timer)
  }, [face, refreshDraftStanding])

  const documentLabel = instance?.doc.meta.title || instance?.doc.meta.documentId || location.path
  const inPane = presentation === 'pane'
  const key = useRef(`flow:${Math.random().toString(36).slice(2)}`).current
  const paneId = useContext(DocumentPaneContext) ?? undefined
  // The door carries the Flow's own location, draft fact and last save outcome, so the page family's devices read the reached
  // Flow's file and its save standing from the face that holds it (central/devices/pageDevices.tsx), never a second copy.
  const standing: DocumentInPane = {key, paneId, form: 'Flow', title: documentLabel, revision: revision || undefined,
    state: face && !baselined && !save ? 'form not answered yet' : documentStateWords({pending, dirty, save}), save: face && !pending ? () => void saveToOwner() : undefined,
    reread: pending ? undefined : reread, rereadLabel: 'Re-read', location: instance?.location ?? location, dirty,
    ...(save ? {outcome: save.outcome} : {})}
  // The aperture follows the document the hand reached (the first one standing until then); a change of standing reaches it.
  useEffect(() => { if (inPane) publishDocument(standing, !reachedDocument()) })
  useEffect(() => () => withdrawDocument(key), [key])

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
        <span className="document-pane-acts">
          <button type="button" data-action="save" disabled={!standing.save} onClick={() => standing.save?.()}
            data-i="Save to Central|The owner's revision-checked write of the Flow as it stands in its pane.">Save</button>
          <button type="button" data-action="reread" disabled={!standing.reread} onClick={() => standing.reread?.()}
            data-i="Re-read|Read the Flow again from its owner; a draft not saved is set aside.">Re-read</button>
        </span>
      </div> : <div className="inhabitant-body-actions">
        <button type="button" className="inhabitant-act" data-action="save" disabled={!face || pending} onClick={() => void saveToOwner()}>Save to native source</button>
        <button type="button" className="inhabitant-act" data-action="reread" disabled={pending} onClick={() => void load()}>Re-read current document</button>
        <span className="inhabitant-device-save" role="status" aria-live="polite" data-save-outcome-label={save?.outcome ?? ''}>
          {save
            ? <SaveOutcomeChip outcome={save.outcome} detail={save.detail}/>
            : <span className="inhabitant-quiet">{pending ? 'waiting for the native operation…' : 'no save attempted'}</span>}
        </span>
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
