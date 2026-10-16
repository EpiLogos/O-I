import {useCallback, useEffect, useState} from 'react'

/** The impact device — central family, face `impact` (L2's declared face;
 * L7 gives it its body — ticket L7 commission 2).
 *
 * Select a folder or note: its Central-web neighbourhood (`op graph`), its
 * references (`op files_list` for a folder; the wiki projection where the
 * owner answers), and the sessions touching it (`op now` kind:list, the
 * register's own work references). Every leg names its boundary operation;
 * a refused leg shows the refusal verbatim — the sessions-touching leg that
 * L2's note marked as waiting rides the register's own listing, so it is
 * admitted here only as far as the owner answers. */

import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {readFilesLeg, readGraphLeg, readNowLeg} from '../central/devices/groundDevices'
import {
  assembleImpact,
  impactSummary,
  type ImpactReading,
  type ImpactSubject,
} from './centralImpactModel'
import {KindMark} from './sdk/marks.tsx'
import './inhabitantDevices.css'

export interface CentralImpactDeviceProps {
  readonly transport: KernelTransportStatus
  readonly subject: ImpactSubject | null
  readonly expanded?: boolean
}

interface ReadState {
  readonly reading: ImpactReading | null
  readonly pending: boolean
}

export function CentralImpactDevice({transport, subject, expanded = false}: CentralImpactDeviceProps) {
  const [state, setState] = useState<ReadState>({reading: null, pending: false})

  // The three legs are the chain's own (central/devices/groundDevices.ts readGraphLeg, readFilesLeg, readNowLeg — ported from this
  // body, lane BC2): one implementation of each owner read, so this body and the designed Impact read the subject alike.
  const read = useCallback(async (target: ImpactSubject) => {
    setState({reading: null, pending: true})
    const [graph, files, now] = await Promise.all([readGraphLeg(transport, target), readFilesLeg(transport, target), readNowLeg(transport)])
    setState({reading: assembleImpact({subject: target, graph, files, now}), pending: false})
  }, [transport])

  useEffect(() => {
    if (subject) void read(subject)
  }, [subject, read])

  const summary = state.reading ? impactSummary(state.reading) : subject ? 'not read yet' : 'no subject selected'

  return (
    <article
      className="inhabitant-device"
      data-central-device="impact"
      data-subject={subject?.path ?? ''}
      /* The subject the RENDERED reading actually read — stamped on
       * completion, so a consumer can bind to this subject's own facts and
       * never mistake the previous subject's standing for this one's. */
      data-impact-read-subject={state.reading?.subject.path ?? ''}>
      <header className="inhabitant-device-head">
        <span className={`inhabitant-light${state.reading ? ' is-admitted' : ''}`} title={state.reading ? 'The owners answered or refused — the reading stands' : 'No impact reading yet'} />
        <span className="inhabitant-device-mark"><KindMark kind="expression" size={12} title="impact — the Central-web neighbourhood"/></span>
        <strong>Impact</strong>
        <span className="inhabitant-device-sub">{subject ? `${subject.kind} · ${subject.path}` : 'select a folder or note'}</span>
        <span className="inhabitant-device-save" role="status" data-impact-standing={state.pending ? 'reading' : state.reading ? 'read' : 'unread'}>{state.pending ? 'reading the owners…' : summary}</span>
      </header>
      {expanded && state.reading && (
        <div className="inhabitant-device-body" data-impact-body>
          <ul className="inhabitant-reading-list" data-impact-legs>
            {state.reading.legs.map(leg => (
              <li key={leg.name} className="inhabitant-reading" data-impact-leg={leg.name} data-refused={leg.refusal ? 'true' : 'false'}>
                <span className="inhabitant-reading-op" title={`${leg.boundaryOp} at ${leg.at}`}>{leg.name} · {leg.boundaryOp}</span>
                {leg.refusal
                  ? <span className="inhabitant-reading-refusal" data-refusal-text>{leg.refusal}</span>
                  : <span className="inhabitant-reading-ok">answered</span>}
              </li>
            ))}
          </ul>
          <ul className="inhabitant-reading-list" data-impact-neighbourhood>
            {state.reading.nodes.length === 0 && <li className="inhabitant-reading"><span className="inhabitant-reading-standing">no neighbourhood nodes — the graph owner names nothing at this subject (or refused; see the legs)</span></li>}
            {state.reading.nodes.map(node => (
              <li key={node.ref} className="inhabitant-reading" data-impact-node data-node-role={node.role}>
                <span className="inhabitant-reading-op">{node.role}</span>
                <span className="inhabitant-reading-standing">{node.ref}</span>
              </li>
            ))}
            {state.reading.edges.map((edge, index) => (
              <li key={`edge:${index}`} className="inhabitant-reading" data-impact-edge data-edge-direct={edge.direct ? 'true' : 'false'}>
                <span className="inhabitant-reading-op">{edge.relation}{edge.direct ? '' : ' (indirect)'}</span>
                <span className="inhabitant-reading-standing">{edge.fromRef} → {edge.toRef}{edge.provenance ? ` · ${edge.provenance}` : ''}</span>
              </li>
            ))}
          </ul>
          <ul className="inhabitant-reading-list" data-impact-sessions>
            {state.reading.sessions.length === 0 && <li className="inhabitant-reading"><span className="inhabitant-reading-standing">no NOW record names this subject's project — absence, not silence</span></li>}
            {state.reading.sessions.map(session => (
              <li key={session.nowRef} className="inhabitant-reading" data-impact-session>
                <span className="inhabitant-reading-op">{session.lifecycle} · {session.boundaryOp}</span>
                <span className="inhabitant-reading-standing">{session.purpose}</span>
                <span className="inhabitant-reading-tender">{session.work.join(' · ')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  )
}
