import {useCallback, useEffect, useMemo, useRef, useState} from 'react'

/** The Day die document device — central family, face `day-die`.
 *
 * The DayDieFace pattern (desktop/cradle/src/receiving/DayDieFace.tsx)
 * composed onto the shell rack over the SAME owners, none reimplemented:
 * - the retained form (ql-daily-die.html) is read through Central's own file
 *   route and projected with `projectDieDocument` (the supplied editor's own
 *   closure/serialization seam, with its snapshot bridge and CSP);
 * - the body is the sandboxed opaque-origin iframe; the only host↔frame
 *   traffic is the bounded snapshot request and the dirty announcement;
 * - edits stage in a `DayFormSession` (imported, not copied); Save is one
 *   explicit native write per mapped field through the owner's receiving
 *   contract (`mutate-field`), CAS-checked per field;
 * - the rack strip discloses the save router's named outcomes
 *   (saved | unchanged | stale | conflict | refused) via the pure model.
 *
 * A message from the sandbox may stage material but never authorizes a
 * native write. Drafts are retained in the session, same-basis, while the
 * device is docked; explicit Review re-reads the owner before any save. */

import {
  DayFormSession,
  isObject,
  projectDieDocument,
  unmappedChanges,
  validateDocumentBasis,
  type DayDocumentField,
} from '../../../../../desktop/cradle/src/central/dayForm'
import {receiving} from '../../../../../desktop/cradle/src/receiving/client'
import {readFile} from '../../../../../desktop/cradle/src/files/client'
import {DOCUMENT_FORMS, resolveDocumentForm} from '../../../../../desktop/cradle/src/flow/documentForms'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {classifySaveFailure, outcomeLabel, savedOutcome, unchangedOutcome, type SaveRouterReading} from './documentDeviceModel'
import './inhabitantDevices.css'

const DIE_SHELL = DOCUMENT_FORMS.find(form => form.kind === 'document-42' && form.file === 'ql-daily-die.html')

export interface DocumentDayDieFaceProps {
  readonly transport: KernelTransportStatus
  /** The Central project the day belongs to (null = the cradle's own ground). */
  readonly project: string | null
  readonly sourceRef: string
  readonly documentId: string
  /** The projects listing from the navigator root, when the host holds one
   * (the form resolver's owner path); absent, the resolver falls back to the
   * cradle's canonical Work/O-I path. */
  readonly projects?: readonly {name?: string; path?: string}[]
  /** Compact shows the strip only; expanded docks the body under it. */
  readonly expanded?: boolean
}

interface DieBasis {sourceRef: string; documentId: string; revision: string; payload: unknown; fields: DayDocumentField[]}

export function DocumentDayDieFace({transport, project, sourceRef, documentId, projects, expanded = false}: DocumentDayDieFaceProps) {
  const session = useMemo(() => new DayFormSession({sourceRef, documentId, revision: '', payload: undefined, fields: []}), [sourceRef, documentId])
  const [basis, setBasis] = useState<DieBasis>()
  const [face, setFace] = useState<string>()
  const [failure, setFailure] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [dirty, setDirty] = useState(false)
  const [pending, setPending] = useState(false)
  const [save, setSave] = useState<SaveRouterReading>()
  const [review, setReview] = useState<DieBasis>()
  const [revision, setRevision] = useState<string>('')
  const frame = useRef<HTMLIFrameElement>(null)
  const snapshot = useRef<{nonce: string; resolve: (value: unknown) => void; reject: (reason: Error) => void; timer: number}>()
  const templateRef = useRef<string>()
  const editEpoch = useRef(0)

  // Load: the owner's document reading, then the retained form, then the projection.
  useEffect(() => {
    let alive = true
    setFailure(undefined)
    setFace(undefined)
    ;(async () => {
      try {
        if (!DIE_SHELL) throw new Error('The original form roster entry is unavailable')
        const reading = await receiving<unknown>(transport, project, {kind: 'document', source_ref: sourceRef, document_id: documentId})
        const validated = validateDocumentBasis(reading, sourceRef, documentId)
        if (!alive) return
        setBasis(validated)
        session.basis = validated
        setRevision(validated.revision)
        const location = await resolveDocumentForm(transport, DIE_SHELL, projects)
        const original = await readFile(transport, location)
        if (!alive) return
        templateRef.current = original.content
        const projected = projectDieDocument(original.content, validated.payload)
        if (!projected) throw new Error('Original editor snapshot seam is unavailable; its source remains intact')
        if (alive) setFace(projected)
      } catch (error) {
        if (alive) setFailure(String(error))
      }
    })()
    return () => {alive = false}
  }, [transport, project, sourceRef, documentId, projects, session])

  // The bounded host↔frame bridge: dirty announcements and one snapshot at a time.
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || !isObject(event.data) || event.data.source !== 'oi-cradle-die-face') return
      if (event.data.type === 'dirty') {
        session.markDirty()
        editEpoch.current++
        setDirty(true)
        return
      }
      const held = snapshot.current
      if (!held || event.data.nonce !== held.nonce) return
      if (event.data.type !== 'snapshot' && event.data.type !== 'snapshot-error') return
      clearTimeout(held.timer)
      snapshot.current = undefined
      if (event.data.type === 'snapshot-error') held.reject(new Error(String(event.data.error)))
      else held.resolve(event.data.payload)
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [session])

  const capture = useCallback(async (): Promise<unknown> => {
    if (snapshot.current || !frame.current?.contentWindow) throw new Error('Day snapshot is not available')
    const nonce = crypto.randomUUID()
    const value = await new Promise<unknown>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        snapshot.current = undefined
        reject(new Error('Original form did not acknowledge the requested snapshot; no writes sent'))
      }, 5000)
      snapshot.current = {nonce, resolve, reject, timer}
      frame.current?.contentWindow?.postMessage({source: 'oi-day-host', type: 'snapshot', nonce}, '*')
    })
    return value
  }, [])

  const saveToNative = useCallback(async () => {
    if (!basis) return
    setPending(true)
    setNotice(undefined)
    try {
      if (!session.edited && session.draft === undefined) {
        setSave(unchangedOutcome())
        return
      }
      const value = await capture()
      const epoch = editEpoch.current
      session.stage(value)
      setDirty(session.edited || session.draft !== undefined)
      const unmapped = unmappedChanges(session.basis, value)
      await session.save(async input => {
        const result = await receiving<unknown>(transport, project, {kind: 'mutate-field', ...input})
        return result
      })
      if (editEpoch.current !== epoch) {
        session.markDirty()
        setSave(classifySaveFailure('Edits arrived while the save was in flight; the retained draft needs review'))
        return
      }
      setSave(savedOutcome(unmapped.length ? `${unmapped.length} unmapped region(s) remain only in the original form` : undefined))
      setDirty(session.edited || session.draft !== undefined)
      // Re-read the owner so the strip's basis names the revision the owner holds now.
      const reread = await receiving<unknown>(transport, project, {kind: 'document', source_ref: sourceRef, document_id: documentId})
      const next = validateDocumentBasis(reread, sourceRef, documentId)
      if (editEpoch.current === epoch && !unmappedChanges(next, session.draft ?? next.payload).length) {
        session.basis = next
        session.draft = undefined
        session.edited = false
        setBasis(next)
        setRevision(next.revision)
        setDirty(false)
        if (templateRef.current) setFace(projectDieDocument(templateRef.current, next.payload) ?? undefined)
      }
    } catch (error) {
      setSave(classifySaveFailure(error))
      setDirty(session.edited || session.draft !== undefined)
    } finally {
      setPending(false)
    }
  }, [basis, capture, documentId, project, session, sourceRef, transport])

  const reviewNative = useCallback(async () => {
    setPending(true)
    setNotice(undefined)
    try {
      const reading = await receiving<unknown>(transport, project, {kind: 'document', source_ref: sourceRef, document_id: documentId})
      const current = validateDocumentBasis(reading, sourceRef, documentId)
      // The session's own guard decides: a clean basis adopts the current
      // revision; a retained draft blocks on the moved source and keeps its
      // edits — the stale standing, in the owner's own words.
      session.observe(current)
      setBasis(session.basis)
      setRevision(session.basis.revision)
      if (templateRef.current && !session.blocked) setFace(projectDieDocument(templateRef.current, session.basis.payload) ?? undefined)
      if (session.blocked) setReview(current)
      setNotice(session.blocked
        ? `The native source moved to revision ${current.revision} while edits stood. ${session.blocked} Review the source, then carry the draft or discard it — nothing was overwritten.`
        : `Reviewed the native source at revision ${current.revision}. Save remains a separate action.`)
    } catch (error) {
      setSave(classifySaveFailure(error))
    } finally {
      setPending(false)
    }
  }, [documentId, project, session, sourceRef, transport])

  /** The reviewed-basis recovery: the draft re-stands on the reviewed
   * revision (the DayDieFace pattern's reviewOnto), which also clears a
   * save-failure block — the owner's own words stay in the notice. */
  const keepDraftOnReview = useCallback(() => {
    if (!review) return
    try {
      session.reviewOnto(review)
      setBasis(session.basis)
      setRevision(session.basis.revision)
      setReview(undefined)
      setSave(undefined)
      setNotice(`Draft edits retained on the reviewed revision ${session.basis.revision}. Save remains a separate action.`)
    } catch (error) {
      setNotice(`The draft needs manual review: ${String(error)}`)
    }
  }, [review, session])

  const blocked = session.blocked !== undefined

  return (
    <article className="inhabitant-device inhabitant-document" data-document-device="ql-daily-die" data-save-outcome={save?.outcome ?? ''} data-dirty={dirty ? 'true' : 'false'}>
      <header className="inhabitant-device-head">
        <span className={`inhabitant-light${dirty ? ' is-engaged' : ''}`} title={dirty ? 'Unsaved form edits — Native Save is explicit' : 'No unsaved edits'} />
        <strong>Day die</strong>
        <span className="inhabitant-device-sub">document · {documentId}{revision ? ` · ${revision}` : ''}</span>
        <span className="inhabitant-device-save" role="status" aria-live="polite" data-save-outcome-label={save?.outcome ?? ''}>{outcomeLabel(save) ?? (pending ? 'waiting for the native operation…' : blocked ? `blocked — ${session.blocked}` : 'no save attempted')}</span>
      </header>
      <div className="inhabitant-device-actions">
        <button type="button" data-action="save" disabled={!face || pending || blocked} onClick={() => void saveToNative()}>Save to native source</button>
        <button type="button" data-action="review" disabled={pending || !face} onClick={() => void reviewNative()}>Review current native source</button>
      </div>
      {failure && <p className="inhabitant-device-fault" role="alert">Day die original source unavailable: {failure}</p>}
      {notice && <p className="inhabitant-device-notice" role="status">{notice}</p>}
      {review && <div className="inhabitant-device-actions">
        <button type="button" data-action="keep-draft" onClick={keepDraftOnReview}>Keep draft edits on revision {review.revision}</button>
      </div>}
      {expanded && (face === undefined
        ? <p role="status">Reading the original Daily Die source…</p>
        : <iframe ref={frame} className="inhabitant-document-body" title="Day die — the document's supplied form, projected from its native payload" sandbox="allow-scripts allow-forms allow-downloads" referrerPolicy="no-referrer" srcDoc={face}/>)}
    </article>
  )
}
