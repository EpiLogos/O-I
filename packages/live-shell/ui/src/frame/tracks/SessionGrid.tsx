// The one Session view (manual §3, FOUNDATION F3): "the grid: tracks across, rows down, everything launchable, nothing in
// any fixed order." Every mode's tracks arrive through its adapter as one WorldTrackSet; this grid knows no mode. A clip
// shows its state (waiting, running, stopped, recording, stalled); a row's stop launches it whole; a track's square stops
// it. Launch, stop, retry and record run only through the set's actions port, so a set whose owner gives none stays
// read-only and says so; what an owner answers to a press is shown where it was pressed. Everything else comes from the
// set's data: a track under another (`parentId`) folds under it and steps in behind a rail per ancestor, a group's cells
// roll up its members' clips, a stalled lane lights its retry. Craft floor: world-shell-mockup.html `sessView` and
// `.sg/.trk/.cs`, agent-shell-mockup.html `.trk.grp/.cs.grp/.stoprow`; ported from agent/AgentSessionGrid.tsx.
// From the World cut presentation it replaced (git 09a573a1d:.../projections/worldTimelinePresentation.tsx): each clip carries
// its standing mark (trackMarks.ts), and the rows nest under the sections they stand in, each head in its section's atmosphere
// and folding as a group folds (trackSections.ts). A track the set marks read-only (one merged in from another reading, the
// spine's cron firings) is offered none of the set's actions.
// R3 (manual §16.6; lock §0.3 item 3): under each head the track's mixer row after Live's — activator, solo, arm, monitor In · Auto
// · Off, input and output — with what each means in the mode (trackLanes.ts mixerCells); a track flagged `main` is the Main
// track's own material and stands in the Main column at the end, which carries each row's launcher, Stop All and Back to
// Arrangement (lit when what plays differs from the ruler); an armed track's empty slots are record buttons (Live cap 35).
import {useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode} from 'react'
import type {WorldTrack, WorldTrackClip, WorldTrackColumn, WorldTrackSection, WorldTrackSet} from '../../timeline/worldTrackAdapter'
import {clipStandingAttributes, clipStandingEdge, clipStandingMark, clipStandingTag, clipStandingTitle} from './trackMarks'
import {sectionFoldKey, sessionRowLayout, shownRowLayout} from './trackSections'
import {mixerCells, type MixerCell} from './trackLanes'
import {CutIcon} from '../../agent/agentIcons'
import {useTracksMenu} from '../menu/TracksMenu'
import './tracks.css'

export interface TracksSelection {
  /** The selected ref (a clip's or a track's id), if it is in this set. */
  ref?: string
  select(target: {kind: 'clip' | 'track'; ref: string; title: string; track?: string}): void
}

export const STATUS_WORD: Record<string, string> = {waiting: 'Waiting', running: 'Running', stopped: 'Stopped', recording: 'Recording', stalled: 'Stalled', done: 'Done'}

/** The Main track's ref (Live's Main track: the stops column's head is a track you select, and the Device side then shows its chain).
 * One ref for every set: what a mode's Main track holds is its own detail's (shell/modeDetails.tsx), never a branch here. */
export const MAIN_TRACK_REF = 'main'

/** The Main track's head: a button that selects the Main track, as a track's head selects its track. */
export function MainHead({selection, title, children}: {selection: TracksSelection; title?: string; children: ReactNode}) {
  const selected = selection.ref === MAIN_TRACK_REF
  return <button type="button" className={`thd${selected ? ' sel' : ''}`} aria-pressed={selected} data-track-head="main"
    title={title ? `Main · ${title}` : 'Main · select the Main track: the Device side shows its chain'}
    onClick={() => selection.select({kind: 'track', ref: MAIN_TRACK_REF, title: 'Main'})}>{children}</button>
}

/** A track's colour as the views draw it: the one the set gives, else the shell's default. */
export const trackColour = (track: WorldTrack): string => track.color ?? 'var(--track-default, var(--bg-3))'

/** The tracks' parent links, walked: what each track sits under and what sits under it (`parentId`). */
export interface TrackTree {
  byId: ReadonlyMap<string, WorldTrack>
  /** Direct children by parent id, in the set's order; a track with none has no entry. */
  children: ReadonlyMap<string, readonly WorldTrack[]>
  /** The groups above a track, outermost first (agent/AgentSessionGrid.tsx:101-111). A parent the set does not hold, or a
   * cycle in the links, ends the walk. */
  ancestorsOf(track: WorldTrack): WorldTrack[]
  /** Everything beneath a track, nearest first; a cycle in the links is walked once. */
  descendantsOf(track: WorldTrack): WorldTrack[]
}

export function trackTree(tracks: readonly WorldTrack[]): TrackTree {
  const byId = new Map(tracks.map(track => [track.id, track]))
  const children = new Map<string, WorldTrack[]>()
  for (const track of tracks) {
    if (track.parentId === undefined || track.parentId === track.id || !byId.has(track.parentId)) continue
    const siblings = children.get(track.parentId)
    if (siblings) siblings.push(track)
    else children.set(track.parentId, [track])
  }
  const ancestorsOf = (track: WorldTrack): WorldTrack[] => {
    const out: WorldTrack[] = []
    const seen = new Set([track.id])
    let parent = track.parentId === undefined ? undefined : byId.get(track.parentId)
    while (parent && !seen.has(parent.id)) {
      seen.add(parent.id)
      out.unshift(parent)
      parent = parent.parentId === undefined ? undefined : byId.get(parent.parentId)
    }
    return out
  }
  const descendantsOf = (track: WorldTrack): WorldTrack[] => {
    const out: WorldTrack[] = []
    const seen = new Set([track.id])
    const queue = [...(children.get(track.id) ?? [])]
    while (queue.length) {
      const next = queue.shift()!
      if (seen.has(next.id)) continue
      seen.add(next.id)
      out.push(next)
      queue.push(...(children.get(next.id) ?? []))
    }
    return out
  }
  return {byId, children, ancestorsOf, descendantsOf}
}

/** Which lanes have stalled. `own`: the lane says so (the track's flag, or one of its clips is stalled) — the Arrangement's
 * needle. `here`: those and every group above them — the Session's lit retry ("a lane in here has stalled",
 * agent/AgentSessionGrid.tsx:97-100). */
export function stalledLanes(set: WorldTrackSet, tree: TrackTree): {own: Set<string>; here: Set<string>} {
  const own = new Set<string>()
  for (const track of set.tracks) if (track.stalled === true) own.add(track.id)
  for (const clip of set.clips) if (clip.status === 'stalled' && tree.byId.has(clip.trackId)) own.add(clip.trackId)
  const here = new Set(own)
  for (const id of own) for (const above of tree.ancestorsOf(tree.byId.get(id)!)) here.add(above.id)
  return {own, here}
}

/** What the owner answered to a press, in its words. */
export interface ActionReceipt {
  ok: boolean
  text: string
}

/** The words of an owner's answer: `{ok, note}` or `{ok: false, error}` (agent/AgentShellRoot.tsx:29-32). Anything that is
 * not that shape says nothing, and nothing is made up for it. */
export function receiptOf(result: unknown): ActionReceipt | null {
  if (typeof result !== 'object' || result === null || typeof (result as {ok?: unknown}).ok !== 'boolean') return null
  const answer = result as {ok: boolean; note?: unknown; error?: unknown}
  const said = answer.ok ? answer.note : answer.error
  if (typeof said === 'string' && said) return {ok: answer.ok, text: said}
  return {ok: answer.ok, text: answer.ok ? 'The owner answered ok and gave no note.' : 'The owner refused and gave no reason.'}
}

/** Run an action and take its answer, whether it answers now or later; a throw or a rejection is a refusal, said as it was. */
export async function answerOf(run: () => unknown): Promise<ActionReceipt | null> {
  try {
    return receiptOf(await run())
  } catch (error) {
    return {ok: false, text: error instanceof Error ? error.message : String(error)}
  }
}

/** An answer, with the control it answers: `key` names the pressed element, `what` the press. */
export interface PressedReceipt extends ActionReceipt {
  key: string
  what: string
}

const receiptMark = (receipt: PressedReceipt | null, key: string): 'ok' | 'refused' | undefined =>
  receipt?.key === key ? (receipt.ok ? 'ok' : 'refused') : undefined

/** A track's mixer row (manual §16.6), as Live draws it under the slots' head: the switches and the monitor on one line, the routes
 * on the next. A control with no owner write stands disabled, its title naming the op it lacks; an unread value is drawn unread. */
export function MixerRow({cells, shown, routes: withRoutes = true, trackId, receipt, onPress}: {cells: readonly MixerCell[]; shown: boolean; routes?: boolean
  trackId: string; receipt: PressedReceipt | null; onPress(key: string, what: string, run: () => unknown): void}) {
  if (!shown) return null
  // A column with no row of its own (the Main column, a track read from another reading) keeps the row's height, so the slots align.
  if (!cells.length) return <div className="trk-mix" aria-hidden="true" />
  const switches = cells.filter(cell => cell.state !== 'route' && cell.id !== 'input' && cell.id !== 'output')
  const routes = withRoutes ? cells.filter(cell => cell.id === 'input' || cell.id === 'output') : []
  return <div className={withRoutes ? 'trk-mix' : 'tl-mix'} role="group" aria-label="Mixer" data-mixer={trackId}>
    {switches.length > 0 && <div className="mx-row">{switches.map(cell => {
      const key = `mix:${cell.id}:${trackId}`
      const press = cell.press
      return <button key={cell.id} type="button" className={`mx mx-${cell.id}`} data-mix={cell.id} data-state={cell.state}
        aria-label={cell.label} aria-pressed={cell.state === 'on' ? true : cell.state === 'off' ? false : undefined} disabled={!press}
        data-receipt={receiptMark(receipt, key)} title={cell.title}
        onClick={() => { if (press) onPress(key, press.what, press.run) }}>{cell.id === 'arm' ? <CutIcon name="rec" size={9} /> : cell.text}</button>
    })}</div>}
    {routes.length > 0 && <div className="mx-io">{routes.map(cell => <span key={cell.id} className={`mx-route mx-${cell.id}`} data-mix={cell.id} data-state={cell.state} title={cell.title}>
      <small>{cell.id === 'input' ? 'in' : 'out'}</small>{cell.text}</span>)}</div>}
  </div>
}

/** The Main column's status row (Live cap 35, 41): Stop All, and Back to Arrangement — lit when what plays differs from the ruler.
 * Each runs only through the set's owner op; without one it stands disabled and says so. */
export function MainFoot({set, receipt, onPress}: {set: WorldTrackSet; receipt: PressedReceipt | null; onPress(key: string, what: string, run: () => unknown): void}) {
  const stopAll = set.actions?.stopAll, back = set.actions?.backToArrangement
  const differs = set.main?.differs
  return <div className="trk-foot main-foot" role="group" aria-label="Main status">
    <button type="button" className="sa" aria-label="Stop All" disabled={!stopAll} data-receipt={receiptMark(receipt, 'stop-all')}
      title={stopAll ? `Stop All: every clip stops (${stopAll.op}). Pressed twice, it cancels at once.` : 'Stop All: the owner gives no op that stops every clip here'}
      onClick={() => { if (stopAll) onPress('stop-all', 'Stop All', () => stopAll.run()) }}><CutIcon name="stop" size={10} /></button>
    <button type="button" className={`ba${differs ? ' lit' : ''}`} aria-label="Back to Arrangement" disabled={!back} data-receipt={receiptMark(receipt, 'back')}
      data-differs={differs === undefined ? 'unread' : String(differs)}
      title={`Back to Arrangement${differs === undefined ? ' · the owner reports no play state to compare with the ruler' : differs ? ' · lit: what plays differs from the ruler' : ' · what plays is the ruler'}${back ? ` (${back.op})` : ' · the owner gives no op that plays the ruler again'}`}
      onClick={() => { if (back) onPress('back', 'Back to Arrangement', () => back.run()) }}><CutIcon name="arrangement" size={10} /></button>
  </div>
}

export interface SessionGridViewProps {
  set: WorldTrackSet
  selection: TracksSelection
  /** The groups folded shut, by track id. */
  folded: Readonly<Record<string, boolean>>
  onFold(trackId: string): void
  receipt: PressedReceipt | null
  /** An action pressed: `key` names the control, `what` the press, `run` calls the owner. */
  onPress(key: string, what: string, run: () => unknown): void
  onDismiss(): void
  /** Why there are no tracks yet, said where they will stand. */
  empty?: string
  /** The object menu's handlers on the view (frame/menu/TracksMenu.tsx): its root, the right button and the menu key. */
  menu?: {rootRef: (element: HTMLDivElement | null) => void; onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void; onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void}
}

/** A section's rails: one per section it sits under and its own, each in that section's atmosphere, else the strong line. */
const sectionRails = (chain: readonly WorldTrackSection[]) => chain.length > 0 &&
  <span className="rails" aria-hidden="true">{chain.map(section => <i key={section.id} style={{background: section.atmosphere ?? 'var(--line-strong)'}} />)}</span>

/** The stops an empty Session shows, as a new Live set does. */
const EMPTY_STOPS: readonly WorldTrackColumn[] = Array.from({length: 8}, (_, i) => ({id: `empty:${i}`, name: String(i + 1)}))

export function SessionGridView({set, selection, folded, onFold, receipt, onPress, onDismiss, empty, menu}: SessionGridViewProps) {
  const hands = menu ? {ref: menu.rootRef, onContextMenu: menu.onContextMenu, onKeyDown: menu.onKeyDown} : {}
  const rows = set.columns
  const inRow = new Map<string, WorldTrackClip>()
  for (const clip of set.clips) if (clip.columnId) inRow.set(`${clip.trackId}\u0000${clip.columnId}`, clip)
  // Grouped lanes (sight and sound of one Expression) are one track in the Session grid: the visual lane stands for it.
  // The Main track's own material (a track flagged `main`) stands in the Main column, not among the tracks.
  const lanes = set.tracks.filter(track => !track.main && (!track.groupId || !track.lane || track.lane === 'visual'))
  const mainTrack = set.tracks.find(track => track.main)
  const tree = trackTree(set.tracks)
  // A group's members fold away with it (agent/AgentSessionGrid.tsx:92-96); every ancestor folded hides them, not only the parent.
  const tracks = lanes.filter(track => !tree.ancestorsOf(track).some(above => folded[above.id]))
  const {here: stalledHere} = stalledLanes(set, tree)
  const launch = set.actions?.launch, launchStop = set.actions?.launchStop, stopTrack = set.actions?.stopTrack, retry = set.actions?.retry, seat = set.actions?.seat
  const removeTrack = set.actions?.removeTrack
  const recordSlot = set.actions?.recordSlot, launchTrack = set.actions?.launchTrack
  const mainName = set.main?.name
  const mainTitle = set.main ? `${mainName} · its chain: ${set.main.chain.length ? set.main.chain.join(', ') : 'none named'}` : undefined
  // The rows, nested under the sections they stand in (a set with no sections lays them as they come), less what is folded.
  const layout = shownRowLayout(sessionRowLayout(set), folded)
  const spanWords = (section: WorldTrackSection) => {
    const say = set.ruler?.label ?? ((at: number) => String(Math.round(at * 10) / 10))
    return `${say(section.span.start)} – ${say(section.span.end)}`
  }
  // A row whose every clip sits on a read-only track is not the owner's to launch (the spine's firings row).
  const readOnlyTrack = new Set(set.tracks.filter(track => track.readOnly).map(track => track.id))
  const readOnlyRow = (rowId: string) => { const held = set.clips.filter(clip => clip.columnId === rowId); return held.length > 0 && held.every(clip => readOnlyTrack.has(clip.trackId)) }
  // What the owner's ops act on when it is coarser than a control looks, said on each control and over the stops.
  const grain = set.actions?.grain ? ` (${set.actions.grain})` : ''
  // An empty work draws Live's empty Session: the stops down the right and the drop area where tracks will stand, with the
  // reason in it — never a blank box (world-shell-mockup.html .sg; Live's "Drop Files and Devices Here").
  if (!lanes.length && !mainTrack) return <div className="sg-pane" data-tracks-view="session" data-empty="true" {...hands}>
    <div className="sg" role="grid" aria-label="Session">
      <div className="sg-drop" role="status">{empty ?? 'No tracks in this work yet.'}</div>
      <div className="trk trk-main" role="row" aria-label="Stops">
        <MainHead selection={selection}>Main</MainHead>
        {(rows.length ? rows : EMPTY_STOPS).map((row, index) => <div key={row.id} className="cs" role="gridcell">
          <button type="button" className="stop-launch" disabled title="No row launch: this work has no tracks yet">▸</button>
          <span className="cs-label">{row.name || index + 1}</span>
        </div>)}
        <MainFoot set={set} receipt={receipt} onPress={onPress} />
      </div>
    </div>
  </div>
  return <div className="sg-pane" data-tracks-view="session" {...hands}>
    <div className="sg" role="grid" aria-label="Session">
      {tracks.map((track, column) => {
        const style = {'--tc': trackColour(track)} as CSSProperties
        const selectedTrack = selection.ref === track.id
        const ancestors = tree.ancestorsOf(track)
        const level = Math.max(track.depth ?? 0, ancestors.length)
        // One rail per ancestor, in that ancestor's colour (agent/AgentSessionGrid.tsx:180-183); a level the set declares
        // with no parent to name is a rail in the track's own colour.
        const rails = [...ancestors.map(trackColour), ...Array.from({length: level - ancestors.length}, () => trackColour(track))]
        const foldable = tree.children.has(track.id)
        const open = !folded[track.id]
        const members = foldable ? tree.descendantsOf(track) : []
        const lit = stalledHere.has(track.id)
        // A track merged from another reading takes none of the set's actions.
        const owned = !track.readOnly
        const trackLaunch = owned ? launch : undefined, trackStop = owned ? stopTrack : undefined
        return <div key={track.id} className={`trk${level ? ' sub' : ''}`} role="row" style={{...style, ...(rails.length ? {'--rails': rails.length} : {})} as CSSProperties}
          data-track={track.id} data-depth={level || undefined} data-group={foldable ? 'true' : undefined} data-stalled={lit ? 'true' : undefined}>
          {rails.length > 0 && <span className="rails" aria-hidden="true">{rails.map((colour, i) => <i key={i} style={{background: colour}} />)}</span>}
          {foldable && <button type="button" className="gf" aria-expanded={open} aria-label={`${open ? 'Fold' : 'Unfold'} ${track.name}`}
            title={`${open ? 'Fold' : 'Unfold'} the ${members.length} under ${track.name}`} onClick={() => onFold(track.id)}>{open ? '▼' : '▶'}</button>}
          <button type="button" className={`thd${selectedTrack ? ' sel' : ''}`} title={`${track.name} · ${track.kind}${removeTrack && owned ? ' · select it and press Delete to take it out of the set' : ''}`} aria-pressed={selectedTrack}
            // the head takes focus as it is selected, so its keys reach it: WebKit (the native candidate) focuses no button on a click,
            // and its Backspace then stepped the shell back a page instead of taking the track out (r20)
            onClick={event => { event.currentTarget.focus(); selection.select({kind: 'track', ref: track.id, title: track.name}) }}
            onKeyDown={removeTrack && owned ? event => { if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); onPress(`remove:${track.id}`, `Remove ${track.name}`, () => removeTrack.run(track.id)) } } : undefined}>{track.name}</button>
          {/* Live's Delete on a selected track, also under the pointer: the selected track's own way out of the set (the inverse of a
              drop on the empty track). What it holds stays where its owner keeps it. */}
          {removeTrack && owned && selectedTrack && <button type="button" className="trk-remove" aria-label={`Take ${track.name} out of the set`} data-receipt={receiptMark(receipt, `remove:${track.id}`)}
            title={`Take ${track.name} out of the set (${removeTrack.op})`} onClick={() => onPress(`remove:${track.id}`, `Remove ${track.name}`, () => removeTrack.run(track.id))}>×</button>}
          {launchTrack && owned && <button type="button" className="trk-launch" aria-label={`Launch ${track.name}`} data-receipt={receiptMark(receipt, `track:${track.id}`)}
            title={`Launch ${track.name} (${launchTrack.op})`} onClick={() => onPress(`track:${track.id}`, `Launch ${track.name}`, () => launchTrack.run(track.id))}>▸</button>}
          <MixerRow cells={mixerCells(set, track, column)} shown={!!set.mixer} trackId={track.id} receipt={receipt} onPress={onPress} />
          {layout.map((item, at) => {
            // A section's head row: a band in the section's atmosphere across every track (its name stands in the stops column).
            // The first track's band carries the section's name too, so the head reads from the left however wide the grid is.
            if (item.kind === 'head') return <div key={`head:${at}:${item.section.id}`} className="cs sect-band" role="presentation" aria-hidden="true"
              data-section-head={item.section.id} style={item.section.atmosphere ? {'--atm': item.section.atmosphere} as CSSProperties : undefined}>
              {column === 0 && <span className="cs-label">{item.section.name}</span>}</div>
            const row = item.column
            const clip = inRow.get(`${track.id}\u0000${row.id}`) ?? (track.groupId ? set.clips.find(c => c.columnId === row.id && set.tracks.find(t => t.id === c.trackId)?.groupId === track.groupId) : undefined)
            if (clip) {
              const selected = selection.ref === clip.id
              const word = clip.status ? STATUS_WORD[clip.status] : 'State not disclosed'
              const key = `clip:${clip.id}`
              // Its standing, as the source discloses it (trackMarks.ts); a clip with no standing reading draws none.
              const mark = clipStandingMark(clip)
              return <div key={row.id} role="gridcell" className={`cs clip${clip.status ? ` ${clip.status}` : ''}${selected ? ' sel' : ''}`} data-clip={clip.id} data-clip-status={clip.status ?? 'undisclosed'}
                data-receipt={receiptMark(receipt, key)}
                title={`${clip.label} · ${word}${clip.launch?.quantize ? ` · launches ${clip.launch.quantize}` : ''}${clip.launch?.follow ? ` · then ${clip.launch.follow}` : ''}${clip.takes?.length ? ` · ${clip.takes.length} takes` : ''}${clip.note ? ` · ${clip.note}` : ''}${clipStandingTitle(mark)}`}
                {...clipStandingAttributes(mark)} style={mark ? {borderLeft: clipStandingEdge(mark)} : undefined}
                onClick={() => selection.select({kind: 'clip', ref: clip.id, title: clip.label, track: clip.trackId})}>
                <button type="button" className="tri" aria-label={`Launch ${clip.label}${grain}`} disabled={!trackLaunch} title={trackLaunch ? `Launch (${trackLaunch.op})` : owned ? 'No launch: the owner discloses no launch for this clip' : 'No launch: this track is read, not launched'}
                  onClick={event => { event.stopPropagation(); if (trackLaunch) onPress(key, `Launch ${clip.label}`, () => trackLaunch.run(clip.id)) }} />
                <span className="cs-label">{clip.label}{clipStandingTag(mark)}</span>
                {clip.status === 'recording' && <i className="cs-rec" role="img" aria-label="Recording" />}
                {clip.note && <span className="cs-note" role="img" aria-label={clip.note} title={clip.note}>⚑</span>}
                {!!clip.takes?.length && <span className="cs-takes" aria-label={`${clip.takes.length} takes`}>{clip.takes.length}</span>}
              </div>
            }
            // A group with no clip of its own in this row rolls up its members': one cell per member's clip, by its status
            // (agent/AgentSessionGrid.tsx:214-229). A read of the members, not a clip: nothing here launches.
            const rolled = members.flatMap(member => { const c = inRow.get(`${member.id}\u0000${row.id}`); return c ? [c] : [] })
            if (rolled.length) {
              const stalledCount = rolled.filter(c => c.status === 'stalled').length
              return <div key={row.id} role="gridcell" className="cs roll" data-rollup={rolled.length}
                title={`${rolled.length} ${rolled.length === 1 ? 'clip' : 'clips'} from the ${members.length} under ${track.name} in this row${stalledCount ? ` · ${stalledCount} stalled` : ''}`}>
                {rolled.map(c => <i key={c.id} data-status={c.status ?? 'undisclosed'} />)}
              </div>
            }
            // An armed track's empty slots are record buttons, as Live draws them (cap 35); every other empty slot is a stop square.
            if (track.mix?.arm === true && owned) {
              const recordKey = `rec:${track.id}:${row.id}`
              return <div key={row.id} className="cs" role="gridcell" data-receipt={receiptMark(receipt, recordKey)} title="Empty slot · the track is armed: its button records here"
                data-slot-track={track.id} data-slot-row={row.id}>
                <button type="button" className="sg-rec" aria-label={`Record on ${track.name}${grain}`} disabled={!recordSlot}
                  title={recordSlot ? `Record into this slot (${recordSlot.op})` : 'No record: the owner gives no op that records into a slot'}
                  onClick={() => { if (recordSlot) onPress(recordKey, `Record on ${track.name}`, () => recordSlot.run(track.id, row.id)) }}><CutIcon name="rec" size={9} /></button>
              </div>
            }
            const key = `stop:${track.id}:${row.id}`
            return <div key={row.id} className="cs" role="gridcell" data-receipt={receiptMark(receipt, key)} title={trackStop ? 'Empty slot · its square stops the track' : 'Empty slot'}
              data-slot-track={track.id} data-slot-row={row.id}>
              <button type="button" className="sg2" aria-label={`Stop ${track.name}${trackStop && trackStop.grain !== undefined ? (trackStop.grain ? ` (${trackStop.grain})` : '') : grain}`} disabled={!trackStop} title={trackStop ? `Stop ${track.name} (${trackStop.op})` : owned ? 'No stop: the owner discloses no stop for this track' : 'No stop: this track is read, not stopped'}
                onClick={() => { if (trackStop) onPress(key, `Stop ${track.name}`, () => trackStop.run(track.id)) }} />
            </div>
          })}
          {retry && owned && <div className="trk-foot">
            <button type="button" className={`rt${lit ? ' lit' : ''}`} aria-label={`Retry ${track.name}${grain}`} data-receipt={receiptMark(receipt, `retry:${track.id}`)}
              title={`Retry ${track.name} (${retry.op})${lit ? ' · lit: a lane in here has stalled' : ''}`}
              onClick={() => onPress(`retry:${track.id}`, `Retry ${track.name}`, () => retry.run(track.id))}>↻</button>
          </div>}
        </div>
      })}
      {/* The empty track: what the set can seat is dropped here (Live: drop onto the empty area to make a track). */}
      <div className="sg-fill" data-seat-drop={seat ? 'open' : undefined} data-receipt={receiptMark(receipt, 'seat')}
        title={seat ? `Drop here to seat it on a new track (${seat.op})` : undefined} aria-label={seat ? 'Empty track: drop to seat' : undefined}
        onDragOver={seat ? event => { if (event.dataTransfer.types.includes(seat.accepts)) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' } } : undefined}
        onDrop={seat ? event => { const payload = event.dataTransfer.getData(seat.accepts); if (!payload) return; event.preventDefault(); onPress('seat', 'Seat', () => seat.run(payload)) } : undefined} />
      <div className="trk trk-main" role="row" aria-label="Stops">
        <MainHead selection={selection} title={[mainTitle, grain ? `every control here acts on the${grain.replace(/[()]/g, '')}: the owner takes nothing finer` : undefined].filter(Boolean).join(' · ') || undefined}>{mainName ?? 'Main'}{grain && <span className="sg-grain">{set.actions?.grain}</span>}</MainHead>
        <MixerRow cells={[]} shown={!!set.mixer} trackId="main" receipt={receipt} onPress={onPress} />
        {layout.map((item, at) => {
          // A section's head: its rails, its fold, its name — the rows under it carry its rail (worldTimelinePresentation.tsx:418-430).
          if (item.kind === 'head') {
            const {section} = item
            const open = !folded[sectionFoldKey(section.id)]
            return <div key={`head:${at}:${section.id}`} className="cs sect-head" role="gridcell" data-section={section.id} data-depth={item.depth}
              style={{'--rails': item.chain.length, ...(section.atmosphere ? {'--atm': section.atmosphere} : {})} as CSSProperties}
              title={`${section.name} · ${item.rows} ${item.rows === 1 ? 'stop stands' : 'stops stand'} in it · ${spanWords(section)}`}>
              {sectionRails(item.chain)}
              <button type="button" className="sect-fold" aria-expanded={open} aria-label={`${open ? 'Fold' : 'Unfold'} ${section.name}`}
                onClick={() => onFold(sectionFoldKey(section.id))}>{open ? '▼' : '▶'}</button>
              <span className="cs-label">{section.name}</span>
            </div>
          }
          const {column: row, index} = item
          const key = `row:${row.id}`
          const rowLaunch = readOnlyRow(row.id) ? undefined : launchStop
          // The Main track's own clip in this row (Central: the day's face) stands beside the row's launcher, as its name.
          const own = mainTrack ? inRow.get(`${mainTrack.id}\u0000${row.id}`) : undefined
          return <div key={row.id} className={`cs${own ? ' main-clip' : ''}${own && selection.ref === own.id ? ' sel' : ''}`} role="gridcell" data-row={row.id} data-receipt={receiptMark(receipt, key)}
            style={item.chain.length ? {'--rails': item.chain.length} as CSSProperties : undefined} data-section-rails={item.chain.length || undefined} data-clip={own?.id}>
            {sectionRails(item.chain)}
            <button type="button" className="stop-launch" disabled={!rowLaunch} title={rowLaunch ? `Launch the row: every clip in it (${rowLaunch.op})` : launchStop ? 'No row launch: every clip in this row is read, not launched' : 'No row launch: the owner discloses none'}
              onClick={() => { if (rowLaunch) onPress(key, `Launch row ${row.name || index + 1}`, () => rowLaunch.run(row.id)) }}>▸</button>
            {own
              ? <button type="button" className="cs-label main-face" title={`${own.label} · on ${mainTrack!.name}${own.note ? ` · ${own.note}` : ''}`}
                onClick={() => selection.select({kind: 'clip', ref: own.id, title: own.label, track: own.trackId})}>{own.label}</button>
              : <span className="cs-label">{row.name || index + 1}</span>}
          </div>
        })}
        <MainFoot set={set} receipt={receipt} onPress={onPress} />
      </div>
    </div>
    {receipt && <p className="sg-receipt" role="status" data-ok={receipt.ok}>
      <b>{receipt.what}</b>
      <span>{receipt.text}</span>
      <button type="button" aria-label="Dismiss" onClick={onDismiss}>×</button>
    </p>}
  </div>
}

/** The Session grid: the view, with the state a grid keeps — which groups are folded shut, and the owner's last answer. */
export function SessionGrid({set, selection, empty}: {set: WorldTrackSet; selection: TracksSelection; empty?: string}) {
  const [folded, setFolded] = useState<Record<string, boolean>>({})
  const [receipt, setReceipt] = useState<PressedReceipt | null>(null)
  const latest = useRef(0)
  const press = (key: string, what: string, run: () => unknown) => {
    const turn = ++latest.current
    setReceipt(null)
    void answerOf(run).then(answer => { if (answer && turn === latest.current) setReceipt({key, what, ...answer}) })
  }
  const fold = (id: string) => setFolded(current => ({...current, [id]: !current[id]}))
  // Every object's acts, after Live's: its menu, Live's keys on the selection, rename in place (frame/menu/TracksMenu.tsx).
  const menu = useTracksMenu({set, selection, view: 'session', press, folded: id => folded[id], fold})
  return <><SessionGridView set={set} selection={selection} folded={folded} receipt={receipt} onPress={press} empty={empty}
    menu={{rootRef: element => { menu.rootRef.current = element }, onContextMenu: menu.onContextMenu, onKeyDown: menu.onKeyDown}}
    onFold={fold} onDismiss={() => { latest.current += 1; setReceipt(null) }} />{menu.layer}</>
}
