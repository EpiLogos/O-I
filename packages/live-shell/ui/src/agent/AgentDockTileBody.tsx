import {useEffect, useMemo, useState} from 'react'
import {kernelRead} from '../../../../../desktop/cradle/src/kernel/bridge'
import {NativeContextPanel} from '../components/NativeContextPanel'
import {useWorkspace} from '../shell/workspaceContext'
import {scalarEntries, safeJson} from './RefusalCard'
import {useAgentShellOptional, type AgentTileId} from './AgentShellContext'
import {DEVICE_WIDGET_PREFIX} from '../frame/devices/deviceDoor'
import {deviceWidget} from '../frame/widgets/deviceWidgets'
import {FRAMES_ID} from './devices/mainTrackBindings'
import {APPROVALS_ID, LEDGER_ID} from './devices/receiptBindings'
import {tileTitle} from './agentDockTiles'
import {useAgentSessionsOptional} from './AgentSessionsProvider'
import {gitRepositoryAbsence, placeWord, projectOfSession} from './worldScope'
import {attendedKeys, trackKey, type AgentSessionTrack} from './agentRunModel'
import {useAttemptTakes} from '../owners/attemptTakes'
import {ROOT_REGISTER} from './worldScope'
import {collectWorld, useWorkcellRead} from './devices/workcellReads'
import {worldsOf} from './devices/workcellMaterial'
import {RESULTS_SHOW, RESULTS_SHOW_WORDS, resultsOf, type ResultsShow} from './devices/taskBindings'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'

const NONE_SOLOED: ReadonlySet<string> = new Set()

// The tiles' marks, titles and the rail widgets the Main track's devices claim stand in agentDockTiles.ts, so the rail has them
// before this body's code loads.
export {TILE_ICONS, tileTitle} from './agentDockTiles'

/** An owner reading as designed rows: scalar fields one level deep as kv
 * rows, the full document folded as the receipt. The raw JSON is never the
 * surface — it is the receipt. */
function ReadingRows({label, text, loading}: {label: string; text: string | null; loading?: boolean}) {
  let document: unknown = null
  if (text && (text.startsWith('{') || text.startsWith('['))) {
    try { document = JSON.parse(text) } catch { document = null }
  }
  const rows = scalarEntries(document)
  return (
    <section className="native-context-panel" aria-label={label}>
      <h4>{label}</h4>
      {loading
        ? <p role="status" className="agent-disclosed">Reading…</p>
        : rows.length > 0
          ? (
            <>
              {rows.map(([key, value]) => (
                <div className="agent-kv" key={key} style={{padding: '1px 0'}}>
                  <span>{key}</span>
                  <span>{String(value)}</span>
                </div>
              ))}
              <details className="agent-fold" style={{borderTop: 'none', marginTop: 2}}>
                <summary>Receipt</summary>
                <pre style={{fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--text-dim)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '4px 0 0', maxHeight: 140, overflow: 'auto'}}>{text}</pre>
              </details>
            </>
          )
          : (
            <>
              <p className="agent-disclosed" style={{margin: '0 0 4px'}}>{text ?? '—'}</p>
              {text && (text.startsWith('{') || text.startsWith('[')) && (
                <details className="agent-fold" style={{borderTop: 'none'}}>
                  <summary>Receipt</summary>
                  <pre style={{fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--text-dim)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '4px 0 0', maxHeight: 140, overflow: 'auto'}}>{text}</pre>
                </details>
              )}
            </>
          )}
    </section>
  )
}

// No Diff tile (ticket 804): the seat's working diff is read on Files' Diff page (§23.4 "Reading what changed before you approve it … is
// the Diff page of Files"; widgets/railDevices.tsx useDiffReading, kernel git_diff_read through Central's central.git.diff).
export function AgentDockTileBody({id, sessionRef}: {id: AgentTileId; sessionRef: string | null}) {
  const {transport} = useWorkspace()
  const [gitNote, setGitNote] = useState<string | null>(null)
  // The tile's register: the selected session's own (agent/worldScope.ts), else your world's root register.
  const sessions = useAgentSessionsOptional()
  const project = projectOfSession(sessions?.rows ?? [], sessionRef)
  // The tiles show only what you attend to (§19.1 the session's Solo row: "the views, the tiles and the instruments show only them"),
  // over the same tracks the views read; with nothing soloed, every session.
  const shell = useAgentShellOptional()
  const attended = useMemo(() => attendedKeys(sessions?.tracks ?? [], shell?.soloed ?? NONE_SOLOED), [sessions?.tracks, shell?.soloed])
  const attends = useMemo(() => attended ? (row: {spaceRef: string; sessionRef: string}) => attended.has(trackKey(row)) : undefined, [attended])

  useEffect(() => {
    if (id !== 'files') return
    let live = true
    void (async () => {
      if (transport.kind === 'unavailable') {
        if (live) setGitNote(transport.reason ?? 'Unavailable')
        return
      }
      const words = gitRepositoryAbsence(sessionRef, project)
      if (words) { if (live) setGitNote(words); return }
      const git = await kernelRead(transport, {op: 'git_repository_read', project})
      if (!live) return
      setGitNote(git.error ?? safeJson(git.outcome?.result === 'git_repository_reading' ? git.outcome.document : git.outcome))
    })()
    return () => { live = false }
  }, [id, transport, sessionRef, project])

  if (id === 'sessions') return <NativeContextPanel project={project} attends={attends} />
  if (id === 'agents') return <NativeContextPanel project={project} initialTab="agents" attends={attends} />
  if (id === 'ledger' || id === 'approvals') { const Device = deviceWidget(`${DEVICE_WIDGET_PREFIX}${id === 'ledger' ? LEDGER_ID : APPROVALS_ID}`).Body; return <Device subject={sessionRef} pinned={false} /> }
  if (id === 'frames') { const Frames = deviceWidget(`${DEVICE_WIDGET_PREFIX}${FRAMES_ID}`).Body; return <Frames subject={sessionRef} pinned={false} /> }
  if (id === 'files') return <ReadingRows label={`git_repository_read · ${placeWord(project)}`} text={gitNote} />
  if (id === 'graph') return <ReadingRows label="Graph" text="Open Bimba / knowledge graph from the world browser; no kernel graph_read in this shell yet." />
  if (id === 'web') return <ReadingRows label="Web" text="Browser surfaces live in the workbench; agent shell exposes git and harness readings here." />
  if (id === 'terminal') return <ReadingRows label="Terminal" text="Terminal tiles reconcile through workbench terminal_reconcile; use Workbench Terminal for live PTY." />
  return <ReadingRows label={tileTitle(id)} text="No native inspector registered for this tile." />
}

/** The Results tile (DLW §19.1 On the rail; O-I 745, carried from 772; BD round 25): the takes of the selected run of the selected
 * session (taskBindings.ts resultsOf), each with its author and its standing; Accept sends a returned take to review in Approvals through
 * Factory's AttemptReceiving (owners/attemptTakes.ts choose: its Return proposed to Central's receiving field, which Approvals lists);
 * beside them the outputs Workcell collected from each take's world, and Collect asks Workcell again. Run and Show are the tile's own. */
export function ResultsTile({transport, track}: {transport: KernelTransportStatus; track: AgentSessionTrack | null}) {
  const [run, setRun] = useState<string | null>(null)
  const [show, setShow] = useState<ResultsShow>('both')
  const [said, setSaid] = useState<{ok: boolean; line: string} | null>(null)
  const [collected, setCollected] = useState<Record<string, {value?: unknown; error?: string}>>({})
  const sessions = useMemo(() => (track ? [track.sessionRef] : []), [track])
  const takes = useAttemptTakes(transport, sessions, track?.project ?? ROOT_REGISTER)
  const worlds = useWorkcellRead(transport, track && transport.kind !== 'unavailable' ? {kind: 'worlds'} : null).answer
  const listed = worlds.status === 'answered' ? worldsOf(worlds.value)?.worlds ?? null : null
  const worldsWhy = worlds.status === 'refused' ? worlds.error ?? 'Workcell refused `workcell worlds`.'
    : listed === null ? (worlds.status === 'reading' ? 'Workcell has not answered `workcell worlds` yet.' : 'Workcell\'s answer is not its listing of worlds.') : null
  const sessionTakes = takes === undefined ? undefined : track ? takes.of(track.sessionRef) : null
  const reading = resultsOf({session: track, takes: sessionTakes, run, worlds: listed, worldsWhy, collected})
  const accept = async (attempt: string) => {
    const take = sessionTakes?.find(one => one.attemptRef === attempt)
    if (!take || !takes) return
    const answer = await takes.choose(take) as {ok?: boolean; note?: string; error?: string}
    setSaid(answer.ok ? {ok: true, line: answer.note ?? 'Factory took it.'} : {ok: false, line: answer.error ?? 'Factory did not receive the take.'})
  }
  const collect = async (attempt: string, receipt: string) => {
    try { const value = await collectWorld(transport, receipt); setCollected(held => ({...held, [attempt]: {value}})) }
    catch (cause) { setCollected(held => ({...held, [attempt]: {error: cause instanceof Error ? cause.message : String(cause)}})) }
  }
  const named = new Map(reading.results.map(row => [row.attempt, row.name]))
  return <section className="native-context-panel" aria-label="Results" data-results-run={reading.run ?? undefined}>
    <div className="agent-kv" style={{display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap'}}>
      <label>Run <select className="native-control" aria-label="Run" title="The run whose results show." disabled={reading.runs.length < 2}
        value={reading.run ?? ''} onChange={event => setRun(event.target.value || null)}>
        {reading.runs.map(row => <option key={row.ref} value={row.ref}>{row.name}</option>)}
      </select></label>
      <label>Show <select className="native-control" aria-label="Show" title="Chooses what the tile lists." value={show} onChange={event => setShow(event.target.value as ResultsShow)}>
        {RESULTS_SHOW.map(value => <option key={value} value={value}>{RESULTS_SHOW_WORDS[value]}</option>)}
      </select></label>
    </div>
    {said && <p role="status" className="agent-disclosed" data-ok={said.ok}>{said.line}</p>}
    {reading.why !== null && <p role="status" className="agent-disclosed">{reading.why}</p>}
    {show !== 'diffs' && reading.results.map(row => <div key={row.attempt} className="agent-kv" data-results-row={row.attempt} data-stands={row.stands || undefined}>
      <b>{row.name}</b> · {row.author} · {row.state}
      {row.summary && <div>{row.summary}</div>}
      <button type="button" className="native-control" disabled={!row.accept.ok} title={row.accept.ok ? 'Sends this result to review in Approvals (Software Factory\'s attempt receiving).' : row.accept.why}
        onClick={() => { void accept(row.attempt) }}>Accept</button>
    </div>)}
    {show !== 'results' && reading.why === null && <p className="agent-disclosed" data-results-diffs>{reading.diffs}</p>}
    {show !== 'diffs' && reading.outputs.map(row => <div key={row.attempt} className="agent-kv" data-results-outputs={row.attempt}>
      <span>Outputs of {named.get(row.attempt) ?? row.attempt}</span>
      {row.collected && (row.collected.outputs as {ref: string; locator?: string}[]).map(out => <div key={out.ref}>{out.ref}{out.locator ? ` — ${out.locator}` : ''}</div>)}
      {row.collected && (row.collected.omitted as {requirement: string; reason?: string}[]).map(out => <div key={out.requirement} className="agent-disclosed">Left out: {out.requirement}{out.reason ? ` — ${out.reason}` : ''}</div>)}
      {row.why && <div className="agent-disclosed">{row.why}</div>}
      <button type="button" className="native-control" disabled={!row.receipt} title={row.receipt ? 'Asks Workcell to gather this take\'s outputs again (`workcell collect`).' : row.why ?? 'No receipt names this take\'s world.'}
        onClick={() => { if (row.receipt) void collect(row.attempt, row.receipt) }}>Collect</button>
    </div>)}
  </section>
}
