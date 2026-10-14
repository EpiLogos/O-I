/** The selected Factory run, recovered through each projection (WORLD-SHELL-DESIGN §17.1 — the Factory vertical).
 *
 * The selection is the Factory desk's own (`useSelectedRun`, the Desk store); its run reading
 * (`RunEntry`, with the owner's inhabitation reading) is held there and read here, not copied. Each
 * row of the join (`factoryVertical.ts`) opens through the owner's existing door:
 * - Earth: the atlas handle's occurrences (`useAtlasHandle`), only while the Earth is mounted;
 * - Timeline: the World cut's temporal events; a clip selects the spine occasion (`selectOccasion`);
 * - Constellation: `oi:epi-open-knowledge` through `openConstellation`, only for a named node;
 * - Expressions: the desk's Run Live tab (`openRunLive`), which composes the run's Expression from owner reads;
 * - devices: the attempt's session selects its track in the agent shell;
 * - files: the owner's `central:path` file route (`readFile`); other refs are named with their seam.
 * Return readings are the owner's own (`readRunReturn`, `factory attempt return`) per attempt, read when a run is selected.
 *
 * Nothing is invented: an absent reading names its owner, op and remedy (factoryVertical.ts). */

import {useEffect, useState} from 'react'
import {readFile} from '../../../../../desktop/cradle/src/files/client'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {readRunReturn, type RunReturnTarget} from '../../../../../desktop/cradle/src/contributions/factory/desk/runReturnReading'
import {openRunLive, useDeskReading, useSelectedRun, type RunEntry} from '../../../../../desktop/cradle/src/contributions/factory/desk/deskStore'
import type {WorldTimelineView} from '../projections/useWorldTemporalReading'
import {useAtlasHandle} from '../projections/atlas/AtlasProjectionPanel'
import {openConstellation} from '../central/constellation'
import {useAgentShellOptional} from '../agent/AgentShellContext'
import {trackKey} from '../agent/agentRunModel'
import type {AgentSessionTrack} from '../agent/useAgencySessions'
import {
  factoryRunJoin,
  factsOf,
  identityBreaks,
  occupantsOfView,
  positionsOfView,
  returnFactsOf,
  type FactoryReturnFacts,
  type FactoryRunJoin,
  type FileRef,
} from './factoryVertical'

const MAX_ATTEMPT_READS = 6

/** The owner's Return for each attempt the run's inhabitation names, read through `factory attempt return`. A refusal is kept per attempt. */
function useRunReturns(transport: KernelTransportStatus, entry: RunEntry | undefined, attemptRefs: readonly string[]) {
  const [state, setState] = useState<{returns: FactoryReturnFacts[]; refused: {attemptRef: string; message: string}[]; done: boolean}>({returns: [], refused: [], done: false})
  const key = entry ? `${entry.card.key}|${attemptRefs.join(',')}` : ''
  useEffect(() => {
    if (!entry) return
    let alive = true
    const source = entry.card.source
    const refs = attemptRefs.slice(0, MAX_ATTEMPT_READS)
    setState({returns: [], refused: [], done: false})
    Promise.all(refs.map(attemptRef => {
      const target: RunReturnTarget = {statePath: source.statePath, projectRef: source.projectRef, runRef: entry.run.runRef, attemptRef}
      return readRunReturn(transport, target, () => alive)
        .then(reading => ({ok: true as const, attemptRef, reading}))
        .catch((error: unknown) => ({ok: false as const, attemptRef, message: error instanceof Error ? error.message : String(error)}))
    })).then(results => {
      if (!alive) return
      const returns: FactoryReturnFacts[] = []
      const refused: {attemptRef: string; message: string}[] = []
      for (const result of results) {
        if (!result.ok) { refused.push({attemptRef: result.attemptRef, message: result.message}); continue }
        const fact = returnFactsOf(result.attemptRef, result.reading.attempt.record as Parameters<typeof returnFactsOf>[1])
        if (fact) returns.push(fact)
      }
      setState({returns, refused, done: true})
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the run and its attempts, not by object identity
  }, [transport, key])
  return state
}

const Seam = ({label, owner, op, remedy}: {label: string; owner: string; op: string; remedy: string}) => (
  <span className="inhabitant-device-notice" data-seam={label}>
    <span className="inhabitant-reading-standing">{label} waits</span> — owner: {owner} · op: <span className="mono">{op}</span> · {remedy}
  </span>
)

/** One file the owner's file route opens: read on the press, drawn as a preview. */
function FileOpener({transport, file}: {transport: KernelTransportStatus; file: FileRef}) {
  const [text, setText] = useState<string | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)
  return (
    <span className="inhabitant-device-note" data-file-ref={file.ref}>
      <button type="button" className="inhabitant-act" data-action="open-file" onClick={() => {
        setRefusal(null)
        readFile(transport, {schema: 'central.path-ref/v1', ref: file.ref, root: file.root, path: file.path})
          .then(reading => setText(reading.content))
          .catch((error: unknown) => setRefusal(error instanceof Error ? error.message : String(error)))
      }}>Read {file.path}</button>
      {refusal && <span className="inhabitant-device-fault" role="alert" data-file-refusal> The owner refused the file: {refusal}</span>}
      {text !== null && <pre className="inhabitant-device-note" data-file-content style={{whiteSpace: 'pre-wrap', maxHeight: 180, overflow: 'auto'}}>{text.length > 2000 ? `${text.slice(0, 2000)}…` : text}</pre>}
    </span>
  )
}

export interface FactoryRunJoinProps {
  readonly transport: KernelTransportStatus
  readonly world: WorldTimelineView | null
  readonly tracks: readonly AgentSessionTrack[]
}

/** The Factory run join, drawn beneath the Factory task log. Nothing draws when no run is selected on the desk. */
export function FactoryRunJoinDetail({transport, world, tracks}: FactoryRunJoinProps) {
  const selectedKey = useSelectedRun()
  const reading = useDeskReading()
  const entry: RunEntry | undefined = selectedKey ? reading?.runs[selectedKey] : undefined
  // The desk's run view (its custody keeps the owner's full work ref; the tail is a label only). The join reads it, not the raw row.
  const view = entry?.inhabitation
  const readView = view && view.state === 'read' ? view : undefined
  const positions = readView ? positionsOfView(readView) : []
  const occupants = readView ? occupantsOfView(readView) : []
  const returns = useRunReturns(transport, entry, occupants.map(item => item.attemptRef))
  const handle = useAtlasHandle()
  const shell = useAgentShellOptional()

  if (!entry) {
    return (
      <section className="inhabitant-device" data-factory-run="none">
        <p className="inhabitant-device-notice">No Factory run is selected on the Desk. Select a run card; its identity, subject and projections open here.</p>
      </section>
    )
  }

  const join: FactoryRunJoin = factoryRunJoin({
    run: factsOf(entry.run.runRef, entry.card.source.projectRef ?? null, positions, occupants, returns.done ? returns.returns : []),
    events: world?.source.events ?? [],
    occurrences: handle ? handle.model.occ.map(item => ({id: String(item.id), subject_ref: item.subject_ref})) : null,
    sessionRefs: tracks.map(track => track.sessionRef),
  })
  const breaks = identityBreaks(join)
  const timelineEvent = join.timeline.state === 'selected' ? join.timeline.event : null
  const selectTrackFor = (sessionRef: string) => {
    const track = tracks.find(item => item.sessionRef === sessionRef)
    if (track && shell) shell.setSelectedTrackId(trackKey(track))
  }

  return (
    <section className="inhabitant-device" data-factory-run={join.runRef} data-factory-identity={breaks.length ? 'broken' : 'one'}>
      <header className="inhabitant-device-head">
        <strong>Factory · run</strong>
        <span className="inhabitant-device-sub mono">{join.runRef}</span>
        <span className="inhabitant-device-save">{join.projectRef ?? 'no project ref'}</span>
      </header>
      {breaks.length > 0 && <p className="inhabitant-device-fault" role="alert" data-identity-break>{breaks.join('; ')}</p>}
      {view && view.state !== 'read' && <p className="inhabitant-device-notice" data-inhabitation="unavailable">The owner's inhabitation reading is unavailable: {view.reason}</p>}

      <ul className="inhabitant-reading-list" data-factory-rows>
        <li className="inhabitant-reading" data-row="subject"><span className="inhabitant-reading-op">subject</span>
          <span className="inhabitant-reading-standing">{join.subjects.length
            ? join.subjects.map(subject => <span key={subject.ref} className="mono" data-subject-ref={subject.ref} data-subject-kind={subject.kind}>{subject.ref} ({subject.kind}, {subject.custodyState}) </span>)
            : 'no in-custody work ref disclosed'}</span></li>

        <li className="inhabitant-reading" data-row="earth"><span className="inhabitant-reading-op">earth</span>
          <span className="inhabitant-reading-standing">{join.earth.map((row, index) => row.state === 'placed'
            ? <span key={index} data-earth-state="placed" data-occurrence={row.occurrenceId}>placed at occurrence {row.occurrenceId} </span>
            : row.state === 'absent'
              ? <Seam key={index} label={`earth · ${row.subject.ref}`} owner={row.seam.owner} op={row.seam.op} remedy={row.seam.remedy}/>
              : <Seam key={index} label="earth" owner={row.seam.owner} op={row.seam.op} remedy="the Earth is not mounted, so no occurrence reading is held for it"/>)}</span></li>

        <li className="inhabitant-reading" data-row="timeline"><span className="inhabitant-reading-op">timeline</span>
          <span className="inhabitant-reading-standing">{join.timeline.state === 'selected'
            ? <button type="button" className="inhabitant-act" data-action="select-run-moment" onClick={() => { if (world && timelineEvent) world.selectOccasion(timelineEvent) }}>Select the run's moment ({join.timeline.event.stream ?? 'stream'})</button>
            : <Seam label="timeline" owner={join.timeline.seam.owner} op={join.timeline.seam.op} remedy={join.timeline.seam.remedy}/>}</span></li>

        <li className="inhabitant-reading" data-row="constellation"><span className="inhabitant-reading-op">constellation</span>
          <span className="inhabitant-reading-standing">{!returns.done ? 'waiting for the owner\'s Return, which names the wiki nodes'
            : join.constellation.state === 'named'
            ? join.constellation.refs.map(ref => <button key={ref} type="button" className="inhabitant-act" data-action="open-constellation" data-subject-ref={ref} onClick={() => openConstellation(ref, ref)}>Open {ref}</button>)
            : <Seam label="constellation" owner={join.constellation.seam.owner} op={join.constellation.seam.op} remedy={join.constellation.seam.remedy}/>}</span></li>

        <li className="inhabitant-reading" data-row="expressions"><span className="inhabitant-reading-op">expressions</span>
          <span className="inhabitant-reading-standing"><button type="button" className="inhabitant-act" data-action="open-run-expression" onClick={() => { if (selectedKey) openRunLive(selectedKey) }}>Open the run's Expression (Run Live)</button></span></li>

        <li className="inhabitant-reading" data-row="devices"><span className="inhabitant-reading-op">devices</span>
          <span className="inhabitant-reading-standing">{join.devices.length ? join.devices.map(row => row.state === 'selected'
            ? <button key={row.attemptRef} type="button" className="inhabitant-act" data-action="select-agent-track" data-attempt-ref={row.attemptRef} data-session-ref={row.sessionRef} onClick={() => selectTrackFor(row.sessionRef)}>{row.attemptRef} · {row.sessionRef}</button>
            : <Seam key={row.attemptRef} label={`device · ${row.attemptRef}`} owner={row.seam.owner} op={row.seam.op} remedy={row.seam.remedy}/>)
            : 'no attempt is placed in this run'}</span></li>

        <li className="inhabitant-reading" data-row="files"><span className="inhabitant-reading-op">files</span>
          <span className="inhabitant-reading-standing">{join.files.openable.map(file => <FileOpener key={file.ref} transport={transport} file={file}/>)}
            {join.files.unopenable.map(item => <Seam key={item.ref} label={`file · ${item.ref}`} owner={item.seam.owner} op={item.seam.op} remedy={item.seam.remedy}/>)}
            {join.files.openable.length + join.files.unopenable.length === 0 && 'no artifact, evidence or subject ref to open'}</span></li>

        <li className="inhabitant-reading" data-row="returns"><span className="inhabitant-reading-op">return</span>
          <span className="inhabitant-reading-standing">{!returns.done ? 'reading the owner\'s attempt returns…'
            : returns.returns.length ? `${returns.returns.length} readable return(s): ${returns.returns.map(item => item.summary).join(' · ')}`
            : 'no readable return at this reading'}
            {returns.refused.map(item => <span key={item.attemptRef} className="inhabitant-device-fault" role="alert" data-return-refusal={item.attemptRef}> {item.attemptRef}: the owner refused — {item.message}</span>)}</span></li>
      </ul>
    </section>
  )
}
