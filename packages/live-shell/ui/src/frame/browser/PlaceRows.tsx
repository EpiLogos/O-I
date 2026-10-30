// The browser's Places, in every mode (manual §10.3, places.ts): You, Agents, Machines and Work, each read from its real owner through
// a read the shell already asks, held once for the window (owners/ownerCall.ts useOwnerOp, useHeldRead):
//   - You: Central's root disclosure (world_browse, central/centralWorlds.ts centralRoot), its day surface (files_list at
//     Control/user/day) and the identities the Studio's Nara chain keeps (nara_identity list);
//   - Agents: Central's agent profiles (the agent_definition roster, owners/readers.ts useRosterAgents) and AIKit's harnesses
//     (aikit_read harness-disclose);
//   - Machines: Workcell's status for this machine (workcell_status_read, owners/readers.ts useWorkcellAnswer) and the machines Workcell
//     declares (workcell_read machine-list);
//   - Work: Central's Work projects (world_browse), and Add folder… (Setup's Projects step for a folder, §10.11).
// A press selects a row and its preview stands at the foot of the list, with Live's seven colours to put it in a collection
// (CollectionRows.tsx CollectStrip). A double-click brings a world into today (the Worlds rows' own seat) or opens a Day. A read an owner
// refused says so in plain words, with its cause behind Why; a place whose owner has not answered says it is reading.
import {useState, type ReactNode} from 'react'
import {createPortal} from 'react-dom'
import type {KernelOp, KernelOutcome, KernelTransportStatus, RootWorld} from '../../../../../../desktop/cradle/src/kernel/types'
import {Refusal, refusalWords} from '../../../../../../desktop/cradle/src/shared/Refusal.tsx'
import {centralRoot, centralRootHeld} from '../../central/centralWorlds'
import {CENTRAL_DAYS_PATH, dayEntriesOf} from '../../central/daySurface'
import {useCentralDocumentOpener} from '../../central/documents/useOpenCentralDocument'
import {useWorkspace} from '../../shell/workspaceContext'
import {addFolderFromBrowser, seatWorldFromBrowser} from '../../shell/ModeBrowser'
import {chooseFolder} from '../../settings/folderChooser'
import {openSettings} from '../../settings/host'
import {useHeldRead, useOwnerOp} from '../../owners/ownerCall'
import type {OwnerReading} from '../../owners/ownerReading'
import {useRosterAgents, useWorkcellAnswer} from '../../owners/readers'
import {Icon} from '../../inhabitants/sdk/Icon'
import {KindMark} from '../../inhabitants/sdk/marks.tsx'
import type {ControlledBrowser} from './browserKinds'
import {CollectStrip} from './CollectionRows'
import {
  agentRows, dayRows, declaredMachineRows, harnessRows, identityRows, matching, thisMachineRows, workRows, yourWorldRow, type PlaceId, type PlaceRow,
} from './places'

/** Central's root disclosure (your world and your Work), held once for the window. */
const useRoot = (transport: KernelTransportStatus): OwnerReading<RootWorld> =>
  useHeldRead(transport.kind === 'unavailable' ? null : centralRootHeld(transport), () => centralRoot(transport))

/** One op's held answer, as the value `pick` takes out of its outcome. */
function useOpValue<R extends KernelOutcome['result'], T>(transport: KernelTransportStatus, op: KernelOp, expected: R, unavailable: string,
  pick: (outcome: Extract<KernelOutcome, {result: R}>) => T): OwnerReading<T> {
  const reading = useOwnerOp(transport, op, expected, unavailable).reading
  return reading.status === 'answered' && reading.value ? {...reading, value: pick(reading.value as Extract<KernelOutcome, {result: R}>)} : {...reading, value: null}
}

/** A part of a place: its rows, or why they are not here. */
interface Part {readonly rows: readonly PlaceRow[]; readonly waiting?: string; readonly refused?: {readonly said: string; readonly error: unknown}}
const partOf = <T,>(reading: OwnerReading<T>, said: string, rows: (value: T) => readonly PlaceRow[], waiting: string): Part =>
  reading.status === 'answered' && reading.value !== null ? {rows: rows(reading.value)}
    : reading.status === 'refused' ? {rows: [], refused: {said, error: reading.error}} : {rows: [], waiting}

function useYouParts(transport: KernelTransportStatus): Part[] {
  const root = useRoot(transport)
  const days = useOpValue(transport, {op: 'files_list', path: CENTRAL_DAYS_PATH}, 'directory_read', 'Central did not list your Days.', outcome => outcome.directory)
  const identities = useOpValue(transport, {op: 'nara_identity', request: {operation: 'list'}}, 'nara_identity', 'The identity owner did not answer.',
    outcome => outcome.data as unknown)
  // A world that has kept no Day yet has no day folder: Central says the folder is not there, and that is no Days, not a refusal
  // (the walk of 30 Oct on a new world; central/centralWorlds.ts readWorldPages reads a missing folder the same way).
  const noDaysYet = days.status === 'refused' && /No such file or directory/i.test(days.error ?? '')
  return [
    partOf(root, 'Central did not disclose your world.', value => [yourWorldRow(value)], 'Reading your world…'),
    noDaysYet ? {rows: []} : partOf(days, 'Your Days are not listed.', value => dayRows(dayEntriesOf(value.entries ?? [])), 'Reading your Days…'),
    partOf(identities, 'Your identity is not read.', identityRows, 'Reading your identity…'),
  ]
}

function useAgentParts(transport: KernelTransportStatus): Part[] {
  const roster = useRosterAgents(transport)
  const harnesses = useOpValue(transport, {op: 'aikit_read', request: {kind: 'harness-disclose'}}, 'owner_route_reading',
    'AIKit did not answer aikit harness disclose.', outcome => outcome.data as unknown)
  const agents: Part = roster.state === 'ready' ? {rows: agentRows(roster.agents)}
    : roster.state === 'error' ? {rows: [], refused: {said: 'Your roster is not read.', error: roster.error}} : {rows: [], waiting: 'Reading your roster…'}
  return [agents, partOf(harnesses, 'AIKit did not say which harnesses it reads.', harnessRows, 'Reading the harnesses…')]
}

function useMachineParts(transport: KernelTransportStatus): Part[] {
  const status = useWorkcellAnswer(transport).reading
  const declared = useOpValue(transport, {op: 'workcell_read', request: {kind: 'machine-list'}}, 'owner_route_reading',
    'Workcell did not answer its machine list.', outcome => outcome.data as unknown)
  return [
    partOf(status, 'Workcell did not say which workcell this machine holds.', thisMachineRows, 'Reading this machine…'),
    partOf(declared, 'Workcell did not list the machines it declares.', declaredMachineRows, 'Reading the declared machines…'),
  ]
}

function useWorkParts(transport: KernelTransportStatus): Part[] {
  return [partOf(useRoot(transport), 'Central did not disclose your Work.', workRows, 'Reading your Work…')]
}

const PARTS: Readonly<Record<PlaceId, (transport: KernelTransportStatus) => Part[]>> = {you: useYouParts, agents: useAgentParts, machines: useMachineParts, work: useWorkParts}

const MARKS: Readonly<Record<PlaceRow['kind'], ReactNode>> = {
  world: <KindMark kind="world" size={12} />, day: <KindMark kind="day" size={12} />, identity: <Icon name="bind" size={12} />,
  agent: <KindMark kind="agent" size={12} />, harness: <Icon name="chain" size={12} />, machine: <Icon name="hex" size={12} />,
  workcell: <Icon name="hex" size={12} />, project: <KindMark kind="world" size={12} />,
}

/** What a place says when it has no row: its own words. */
const EMPTY: Readonly<Record<PlaceId, string>> = {
  you: 'Nothing of yours is disclosed yet.', agents: 'Your roster holds no agent yet, and AIKit reads no harness.',
  machines: 'Workcell names no machine yet.', work: 'Your Work holds no project yet: Add folder… brings one in.',
}

/** A place's rows under the browser's control: grouped, searchable; a press previews, a double-click seats a world or opens a Day. */
function PlaceRowsOf({place, controlled, transport}: {place: PlaceId; controlled: ControlledBrowser; transport: KernelTransportStatus}) {
  // The place's own reads: the component is keyed by its place, so the reads it asks stay the same for its life.
  const parts = PARTS[place](transport)
  const {openDay} = useCentralDocumentOpener()
  const [selected, select] = useState<string | null>(null)
  const [said, setSaid] = useState<{readonly ok: boolean; readonly words: string} | null>(null)
  const rows = parts.flatMap(part => matching(part.rows, controlled.query))
  const chosen = parts.flatMap(part => part.rows).find(row => row.key === selected) ?? null
  const act = (row: PlaceRow) => {
    setSaid(null)
    if (row.seat) {
      const world = row.seat
      void seatWorldFromBrowser(world).then(answer => setSaid(answer.ok ? {ok: true, words: answer.note ?? `${world.name} is in today's set.`}
        : {ok: false, words: refusalWords(`${world.name} did not come into today.`, answer.error)}))
    } else if (row.day) {
      const path = row.day.location?.path ?? `${CENTRAL_DAYS_PATH}/${row.day.name}`
      void openDay(row.day, path).catch(cause => setSaid({ok: false, words: refusalWords(`${row.label} did not open.`, cause)}))
    }
  }
  let group: string | undefined
  return <section className="mode-browser-rows place-rows" aria-label={place} data-place={place}>
    <div className="browser-list-heading">Name <span /></div>
    <ul>{rows.map(row => {
      const heading = row.group !== group ? row.group : undefined
      group = row.group
      return <li key={row.key}>
        {heading && <h4 className="place-rows-group">{heading}</h4>}
        <button type="button" className={`mode-browser-row${row.key === selected ? ' selected' : ''}`} aria-pressed={row.key === selected}
          data-place-row={row.ref} data-i={`${row.label}|${row.words}`} title={row.words}
          onClick={() => select(row.key)} onDoubleClick={() => act(row)}
          onKeyDown={event => { if (event.key === 'Enter' && !event.altKey && !event.metaKey && !event.ctrlKey) { event.preventDefault(); act(row) } }}>
          <span aria-hidden="true">{MARKS[row.kind]}</span><span>{row.label}</span><span className="mode-browser-row-meta">{row.meta}</span>
        </button>
      </li>
    })}</ul>
    {parts.map((part, index) => part.refused
      ? <Refusal key={index} said={part.refused.said} error={part.refused.error} className="oi-refusal place-rows-refusal" />
      : part.waiting ? <p key={index} className="browser-empty" role="status">{part.waiting}</p> : null)}
    {!rows.length && parts.every(part => !part.waiting && !part.refused) && <p className="browser-empty">{controlled.query.trim() ? 'Nothing here matches.' : EMPTY[place]}</p>}
    {place === 'work' && <button type="button" className="mode-browser-row" data-add-folder
      data-i="Add folder…|Choose a folder of your work: Setup's Projects step opens for it, to bring it into your ground's Work. Nothing moves until you accept."
      title="Choose a folder of your work: Setup's Projects step opens for it, to bring it into your ground's Work. Nothing moves until you accept."
      onClick={() => { setSaid(null); void addFolderFromBrowser(() => chooseFolder('work'), openSettings).then(fault => { if (fault) setSaid({ok: false, words: refusalWords('The folder chooser did not open.', fault)}) }) }}>Add folder…</button>}
    {said && <p className={said.ok ? 'browser-empty' : 'native-error'} role={said.ok ? 'status' : 'alert'}>{said.words}</p>}
    {controlled.previewHost && chosen && createPortal(<div className="place-preview" role="status" data-place-preview={chosen.ref}>
      <p>{chosen.words}</p>
      <CollectStrip item={{ref: chosen.ref, label: chosen.label, kind: chosen.kind}} />
    </div>, controlled.previewHost)}
  </section>
}

/** The Places' body: the place the browser shows. */
export function PlaceRows({controlled}: {controlled: ControlledBrowser}) {
  const {transport} = useWorkspace()
  const place = (['you', 'agents', 'machines', 'work'] as const).find(id => id === controlled.category)
  if (!place) return <p className="browser-empty">This place is not among yours.</p>
  // Each place reads its own owners: keyed by the place, so a change of place starts its reads afresh.
  return <PlaceRowsOf key={place} place={place} controlled={controlled} transport={transport} />
}
