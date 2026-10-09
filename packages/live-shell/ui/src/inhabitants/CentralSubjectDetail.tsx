import {useCallback, useEffect, useState} from 'react'

/** The Central subject detail — the detail-area craft §12 names (ticket L7
 * acceptance: "selecting a folder, note and day opens Central detail
 * craft").
 *
 * When the selected material is a Central subject, the detail area shows
 * Central's clip-view-grade editors: CAS identity, basis and the save
 * router's named outcomes are this world's warp markers — typed, honest,
 * per-material. The craft reads its subject through the owner's own file
 * route (`readFile` → `central.file-reading/v1`, CAS-revised); it performs
 * no write, so the save-router row shows the honest absent state until a
 * document device acts on the material (the Day die and Flow devices carry
 * the real router).
 *
 * A folder subject is read as a directory listing (`listFiles`) — its
 * identity is the listing itself; a file subject (note, day record) is read
 * as a file reading with its CAS revision. */

import {listFiles, readFile} from '../../../../../desktop/cradle/src/files/client'
import type {CentralLocation, KernelTransportStatus, NativeDirectory} from '../../../../../desktop/cradle/src/kernel/types'
import {casShort, subjectDayRef, type CentralSubjectBasis} from './centralDayNowModel'
import {SAVE_ROUTER_OUTCOMES} from './manifest.ts'
import './inhabitantDevices.css'

export type CentralSubjectSelection =
  | {kind: 'folder'; path: string}
  | {kind: 'note'; path: string}
  | {kind: 'day'; path: string}

export interface CentralSubjectDetailProps {
  readonly transport: KernelTransportStatus
  readonly subject: CentralSubjectSelection | null
  /** The ground root the subject path is Central-relative to. */
  readonly groundRoot?: string
}

interface DetailState {
  readonly basis: CentralSubjectBasis | null
  readonly directory: NativeDirectory | null
  readonly pending: boolean
  readonly fault: string | null
}

function location(groundRoot: string, path: string): CentralLocation {
  return {schema: 'central.path-ref/v1', ref: `central:path:${groundRoot}:${path}`, root: groundRoot, path}
}

export function CentralSubjectDetail({transport, subject, groundRoot = '/Users/admin/Central'}: CentralSubjectDetailProps) {
  const [state, setState] = useState<DetailState>({basis: null, directory: null, pending: false, fault: null})

  const read = useCallback(async (selection: CentralSubjectSelection) => {
    setState({basis: null, directory: null, pending: true, fault: null})
    const at = new Date().toISOString()
    try {
      if (selection.kind === 'folder') {
        const directory = await listFiles(transport, selection.path)
        setState({
          basis: {
            ref: directory.location?.ref ?? `central:path:${groundRoot}:${selection.path}`,
            revision: 'directory listing (no single CAS revision — the entries carry their own)',
            byteLen: directory.entries.reduce((total, entry) => total + (entry.byte_len ?? 0), 0),
            project: null,
            dayRef: null,
            timePolicyRevision: null,
            saveOutcome: null,
            boundaryOp: 'op files_list (central.directory-reading/v1)',
            at,
          },
          directory,
          pending: false,
          fault: null,
        })
        return
      }
      const reading = await readFile(transport, location(groundRoot, selection.path))
      setState({
        basis: {
          ref: reading.location?.ref ?? `central:path:${groundRoot}:${selection.path}`,
          revision: reading.revision,
          byteLen: reading.byte_len,
          project: reading.project?.name ?? null,
          dayRef: selection.kind === 'day' ? subjectDayRef(selection.path) : subjectDayRef(selection.path),
          timePolicyRevision: null,
          saveOutcome: null,
          boundaryOp: 'op file_read (central.file-reading/v1)',
          at,
        },
        directory: null,
        pending: false,
        fault: null,
      })
    } catch (error) {
      setState({basis: null, directory: null, pending: false, fault: String(error)})
    }
  }, [groundRoot, transport])

  useEffect(() => {
    if (subject) void read(subject)
  }, [subject, read])

  if (!subject) {
    return (
      <section className="inhabitant-device" data-central-detail data-subject-selected="false">
        <header className="inhabitant-device-head"><strong>Central detail</strong></header>
        <p className="inhabitant-device-note" role="status">Select a folder, note or day in the browser's ground and its craft opens here: CAS identity, basis, save-router standing.</p>
      </section>
    )
  }

  return (
    <section className="inhabitant-device" data-central-detail data-subject-selected="true" data-subject-kind={subject.kind} data-subject-path={subject.path}>
      <header className="inhabitant-device-head">
        <span className={`inhabitant-light${state.basis ? ' is-admitted' : ''}`} title={state.basis ? 'The owner disclosed the subject' : 'No reading yet'} />
        <strong>Central detail</strong>
        <span className="inhabitant-device-sub">{subject.kind} · {subject.path}</span>
        <span className="inhabitant-device-save" role="status" data-detail-standing={state.pending ? 'reading' : state.fault ? 'refused' : state.basis ? 'read' : 'unread'}>
          {state.pending ? 'reading the owner…' : state.fault ? 'read refused' : state.basis ? 'read' : 'not read'}
        </span>
      </header>
      {state.fault && <p className="inhabitant-device-fault" role="alert" data-detail-fault>{state.fault}</p>}
      {state.basis && (
        <div className="inhabitant-device-body" data-detail-body>
          {/* The warp markers: identity, basis, standing — typed rows, mono values. */}
          <ul className="inhabitant-reading-list" data-detail-craft>
            <li className="inhabitant-reading" data-craft-row="cas-identity">
              <span className="inhabitant-reading-op" title="CAS identity — the owner's content revision (this world's warp marker)">CAS identity</span>
              <span className="inhabitant-reading-standing mono" title={state.basis.revision}>{casShort(state.basis.revision)}</span>
            </li>
            <li className="inhabitant-reading" data-craft-row="basis">
              <span className="inhabitant-reading-op">basis</span>
              <span className="inhabitant-reading-standing" title={state.basis.ref}>{state.basis.ref}</span>
            </li>
            {state.basis.byteLen !== null && (
              <li className="inhabitant-reading" data-craft-row="size">
                <span className="inhabitant-reading-op">size</span>
                <span className="inhabitant-reading-standing mono">{state.basis.byteLen} B</span>
              </li>
            )}
            {state.basis.project && (
              <li className="inhabitant-reading" data-craft-row="project">
                <span className="inhabitant-reading-op">project</span>
                <span className="inhabitant-reading-standing">{state.basis.project}</span>
              </li>
            )}
            {state.basis.dayRef && (
              <li className="inhabitant-reading" data-craft-row="civil-day">
                <span className="inhabitant-reading-op">civil day</span>
                <span className="inhabitant-reading-standing mono">{state.basis.dayRef}</span>
              </li>
            )}
            <li className="inhabitant-reading" data-craft-row="read-via">
              <span className="inhabitant-reading-op">read via</span>
              <span className="inhabitant-reading-standing" title={state.basis.at}>{state.basis.boundaryOp}</span>
            </li>
            <li className="inhabitant-reading" data-craft-row="save-router" title="The save router's five named outcomes — the document devices carry the live state; this row holds the honest absent state until one acts">
              <span className="inhabitant-reading-op">save router</span>
              <span className="inhabitant-reading-standing" data-save-router-states>
                {SAVE_ROUTER_OUTCOMES.map(outcome => (
                  <span key={outcome} data-outcome={outcome} data-reached={state.basis?.saveOutcome?.outcome === outcome ? 'true' : 'false'}>{outcome}</span>
                ))}
                {' — none reached (no write performed by the detail craft)'}
              </span>
            </li>
          </ul>
          {state.directory && (
            <ul className="inhabitant-reading-list" data-detail-entries>
              {state.directory.entries.map(entry => (
                <li key={entry.name} className="inhabitant-reading" data-detail-entry data-entry-kind={entry.kind}>
                  <span className="inhabitant-reading-op">{entry.kind}</span>
                  <span className="inhabitant-reading-standing">{entry.name}</span>
                  <span className="inhabitant-reading-tender mono">{entry.byte_len} B</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
