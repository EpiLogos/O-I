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
 * - the strip discloses the save router's named outcomes
 *   (saved | unchanged | stale | conflict | refused) as outcome chips —
 *   each with its own visual, the detail carried verbatim in the title.
 *
 * The device's compact face draws the die NET — the icon-cut Day-die
 * drawing (four faces across, one above, one below, fold dashes between;
 * the open face inked) — as a READING of the die's own face position from
 * the payload (`meta.face`, exactly the state the form's own dots turn).
 * The ‹ › affordance is drawn but named-unfireable: the die turns inside
 * its own form, and the host declares no turn channel — the honest
 * disabled/soon law, not a dead button.
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
import {classifySaveFailure, savedOutcome, unchangedOutcome, type SaveRouterReading} from './documentDeviceModel'
import {SaveOutcomeChip} from './inhabitantCard.tsx'
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
}

interface DieBasis {sourceRef: string; documentId: string; revision: string; payload: unknown; fields: DayDocumentField[]}

/** The die's positions — the form's own POS list (the owners' names). */
const DIE_POSITIONS: readonly {readonly n: number; readonly name: string; readonly role: string}[] = [
  {n: 0, name: 'Ground', role: 'Capture'},
  {n: 1, name: 'Definition', role: 'Tasks'},
  {n: 2, name: 'Operation', role: 'Sessions'},
  {n: 3, name: 'Pattern', role: 'Observations'},
  {n: 4, name: 'Context', role: 'Structure'},
  {n: 5, name: 'Synthesis', role: 'Crystallization'},
]

/** The die's open face, as the payload holds it (the form's own state). */
function dieFaceOf(payload: unknown): number {
  const face = isObject(payload) && isObject((payload as {meta?: unknown}).meta)
    ? (payload as {meta: {face?: unknown}}).meta.face
    : undefined
  return typeof face === 'number' && Number.isInteger(face) && face >= 0 && face <= 5 ? face : 0
}

export function DocumentDayDieFace({transport, project, sourceRef, documentId, projects}: DocumentDayDieFaceProps) {
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
  const openFace = dieFaceOf(basis?.payload)
  const open = DIE_POSITIONS[openFace]

  return (
    <div
      className="inhabitant-face-body inhabitant-document"
      data-document-device="ql-daily-die"
      data-save-outcome={save?.outcome ?? ''}
      data-dirty={dirty ? 'true' : 'false'}
      data-basis-revision={revision}
    >
      {/* The die net — the device's compact face, a reading of the die's own
          face position (icon-cut's Day-die drawing, the open face inked). */}
      <div className="inhabitant-die-net" data-die-face={openFace}
        title={`The die's own face position, read from the payload: #${open.n} ${open.name} — ${open.role}. The die turns inside its own form; the host declares no turn channel, so ‹ › stand named and unfireable.`}>
        <svg width="140" height="72" viewBox="0 0 140 72" aria-label="Day die — six positions, the open face inked">
          <path d="M55 22V26M38 36H42M68 36H72M98 36H102M55 46V50" stroke="var(--inh-faint)" strokeWidth="1" strokeDasharray="1.5 1.5"/>
          {DIE_POSITIONS.map(pos => {
            const x = pos.n === 0 ? 42 : pos.n === 5 ? 42 : [12, 42, 72, 102][pos.n - 1]
            const y = pos.n === 0 ? 2 : pos.n === 5 ? 50 : 26
            const isOpen = pos.n === openFace
            return (
              <g key={pos.n}>
                <rect x={x} y={y} width={26} height={20} rx={1.5}
                  fill={isOpen ? 'var(--inh-ink)' : 'var(--inh-paper)'}
                  stroke={isOpen ? 'var(--inh-ink)' : '#b9b9b3'}/>
                <text x={x + 13} y={y + 13} textAnchor="middle" fontSize="8.5"
                  fill={isOpen ? 'var(--inh-paper)' : '#6e6e6a'} fontFamily="var(--inh-mono)">
                  #{pos.n}
                </text>
              </g>
            )
          })}
        </svg>
        <span className="inhabitant-die-net-caption" data-die-face-label>
          #{open.n} {open.name} — {open.role}
        </span>
        <span className="inhabitant-die-turn" data-die-turn aria-hidden="true">
          <button type="button" className="inhabitant-die-turn-btn" disabled
            title="‹ › turn the die inside its own form. The hosted form owns its dots and no host turn channel is declared — the affordance holds its place, named and unfireable.">‹</button>
          <button type="button" className="inhabitant-die-turn-btn" disabled
            title="‹ › turn the die inside its own form. The hosted form owns its dots and no host turn channel is declared — the affordance holds its place, named and unfireable.">›</button>
        </span>
      </div>
      <div className="inhabitant-body-actions">
        <button type="button" className="inhabitant-act" data-action="save" disabled={!face || pending || blocked} onClick={() => void saveToNative()}>Save to native source</button>
        <button type="button" className="inhabitant-act" data-action="review" disabled={pending || !face} onClick={() => void reviewNative()}>Review current native source</button>
        <span className="inhabitant-device-save" role="status" aria-live="polite" data-save-outcome-label={save?.outcome ?? ''}>
          {save
            ? <SaveOutcomeChip outcome={save.outcome} detail={save.detail}/>
            : <span className="inhabitant-quiet">{pending ? 'waiting for the native operation…' : blocked ? `blocked — ${session.blocked}` : 'no save attempted'}</span>}
        </span>
      </div>
      {failure && <p className="inhabitant-device-fault" role="alert">Day die original source unavailable: {failure}</p>}
      {notice && <p className="inhabitant-device-notice" role="status">{notice}</p>}
      {review && (
        <div className="inhabitant-body-actions">
          <button type="button" className="inhabitant-act" data-action="keep-draft" onClick={keepDraftOnReview}>Keep draft edits on revision {review.revision}</button>
        </div>
      )}
      {face === undefined
        ? <p role="status" className="inhabitant-quiet">Reading the original Daily Die source…</p>
        : <iframe ref={frame} className="inhabitant-document-frame" title="Day die — the document's supplied form, projected from its native payload" sandbox="allow-scripts allow-forms allow-downloads" referrerPolicy="no-referrer" srcDoc={face}/>}
    </div>
  )
}
