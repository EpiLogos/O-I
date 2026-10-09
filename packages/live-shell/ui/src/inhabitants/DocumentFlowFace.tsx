import {useCallback, useEffect, useRef, useState} from 'react'

/** The Flow document device — central family, face `flow-document`.
 *
 * The 0/1 Flow (Dialogue · Flow · Journal) hosted over the EXISTING path:
 * - the instance is read through the flow owner's own routes
 *   (`readFlowInstance` — Central file read; the document is its own file in
 *   `Control/user/flows/`, never copied into a shell store);
 * - the body is the sandboxed iframe carrying the page with its payload
 *   island; the only host↔frame traffic is the bounded island read
 *   (`oi:document-host-request/response` — the document host bridge the
 *   cradle's frames already carry);
 * - Save is the document's own revision-checked CAS write
 *   (`writeFlowInstance`): the host reads the island, embeds it with the
 *   owner's `embedDocument`, and the owner CAS-checks `expected_revision`.
 *   A moved revision returns the owner's current bytes — the strip names it
 *   `conflict` and keeps the draft; a basis that moved before the write is
 *   `stale`; the owner's own `unchanged` outcome passes through named.
 *
 * The page's own internal Save keeps its existing meaning (a portable HTML
 * copy inside the sandbox); only the host button sends writes to the owner. */

import {embedDocument, type QlDoc} from '../../../../../desktop/cradle/src/flow/instance'
import {readFlowInstance, writeFlowInstance, type FlowInstance} from '../../../../../desktop/cradle/src/flow/instances'
import {documentPayloadSource, documentScripts, useDocumentHostRead, type FrameIsland} from '../../../../../desktop/cradle/src/document/frame'
import type {KernelTransportStatus, CentralLocation} from '../../../../../desktop/cradle/src/kernel/types'
import {classifySaveFailure, outcomeLabel, savedOutcome, unchangedOutcome, type SaveRouterReading} from './documentDeviceModel'
import './inhabitantDevices.css'

export interface DocumentFlowFaceProps {
  readonly transport: KernelTransportStatus
  /** The flow instance's owner location (the aperture selects the document;
   * nothing here mints a flow identity — it comes from the document). */
  readonly location: CentralLocation
  /** Compact shows the strip only; expanded docks the body under it. */
  readonly expanded?: boolean
}

/** The hosted copy: payload read seam + the bounded host bridge, injected
 * the way the cradle's hosting surfaces do. */
function projectFlowDocument(html: string): string {
  const withSeam = documentPayloadSource(html)
  return withSeam.includes('<head>')
    ? withSeam.replace(/<head>/i, `<head>${documentScripts}`)
    : withSeam
}

export function DocumentFlowFace({transport, location, expanded = false}: DocumentFlowFaceProps) {
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
  const readIsland = useDocumentHostRead(frame, expanded)
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

  const markDraft = useCallback(() => {
    draftBasis.current = revision
    setDirty(true)
  }, [revision])

  // The page announces intent only through the island read; a draft exists
  // when the host has taken a read and the island differs from the owner's
  // last known content. The bridge is read-only by construction — the host
  // never pushes content into the sandbox.
  const refreshDraftStanding = useCallback(async () => {
    if (!instance || !expanded || pending) return
    try {
      const doc = await captureIsland()
      if (baselineText.current === undefined) {
        baselineText.current = JSON.stringify(doc)
        setBaselined(true)
        return
      }
      if (JSON.stringify(doc) !== baselineText.current) markDraft()
    } catch {
      // Absence of an answer is not a draft; the strip keeps its last state.
    }
  }, [captureIsland, expanded, instance, markDraft, pending])

  useEffect(() => {
    if (!expanded) return
    const timer = window.setInterval(() => void refreshDraftStanding(), 2500)
    return () => window.clearInterval(timer)
  }, [expanded, refreshDraftStanding])

  const documentLabel = instance?.doc.meta.title || instance?.doc.meta.documentId || location.path

  return (
    <article className="inhabitant-device inhabitant-document" data-document-device="ql-flow" data-save-outcome={save?.outcome ?? ''} data-dirty={dirty ? 'true' : 'false'} data-baselined={baselined ? 'true' : 'false'}>
      <header className="inhabitant-device-head">
        <span className={`inhabitant-light${dirty ? ' is-engaged' : ''}`} title={dirty ? 'Draft edits not yet sent to the owner' : 'No unsent draft'} />
        <strong>Flow</strong>
        <span className="inhabitant-device-sub">document · {documentLabel}{revision ? ` · ${revision}` : ''}</span>
        <span className="inhabitant-device-save" role="status" aria-live="polite" data-save-outcome-label={save?.outcome ?? ''}>{outcomeLabel(save) ?? (pending ? 'waiting for the native operation…' : 'no save attempted')}</span>
      </header>
      <div className="inhabitant-device-actions">
        <button type="button" data-action="save" disabled={!face || pending} onClick={() => void saveToOwner()}>Save to native source</button>
        <button type="button" data-action="reread" disabled={pending} onClick={() => void load()}>Re-read current document</button>
      </div>
      {failure && <p className="inhabitant-device-fault" role="alert">Flow document unavailable: {failure}</p>}
      {notice && <p className="inhabitant-device-notice" role="status">{notice}</p>}
      {expanded && (face === undefined
        ? <p role="status">Reading the flow instance…</p>
        : <iframe ref={frame} className="inhabitant-document-body" title="Flow — Dialogue · Flow · Journal, the document's own form" sandbox="allow-scripts allow-forms allow-downloads" referrerPolicy="no-referrer" srcDoc={face}/>)}
    </article>
  )
}

/** The island read shape, re-exported for the fixture harness. */
export type {FrameIsland}
