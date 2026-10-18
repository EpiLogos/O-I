// The pool (manual §10.3, §16.7): under the browser in every mode, where Live keeps its Groove Pool, holding your workspaces.
// "A workspace keeps a way of working; it never holds the work." Each row: the workspace on its colour (the one you are in is
// lit), what it keeps — Panes, Instruments, Widgets, Layouts, each On or Off — the mode that comes forward after a launch, and
// its two acts, ▶ Launch and Keep, as a groove has hot-swap and Commit. The footer stands where Live's Global Amount does: On
// launch and Keep context. Drop a pane's tab here and the arrangement around it becomes a new workspace. In Live a switch at the
// pool's head shows the set's grooves instead (LiveGroovePool), as Live's own pool does. The pool shows nothing else.
//
// The book is the one writer (desktop/cradle/src/workspace/store.ts); every act is a pure change of it (continuity/workspacePool.ts).
import {useState, type DragEvent, type ReactNode} from 'react'
import {useOptionalContinuity} from '../../continuity/workspace'
import {keepsOf, launchWorkspace, keepIntoWorkspace, opensInOf, poolOf, setPoolSettings, setWorkspaceKeep, setWorkspaceOpensIn,
  workspaceFromFront} from '../../continuity/workspacePool'
import type {PoolSettings, Workspace, WorkspaceKeepPart, WorkspaceOpensIn} from '../../../../../../desktop/cradle/src/workspace/store'
import './workspacePool.css'

/** A pane's tab, dragged (the Workbench's own type, desktop/cradle/src/surface/Workbench.tsx). */
export const SURFACE_DRAG_TYPE = 'application/x-oi-surface'

const PARTS: readonly {part: WorkspaceKeepPart; label: string; does: string}[] = [
  {part: 'panes', label: 'Panes', does: 'Keeps the panes, how they are split and pinned, and what each holds.'},
  {part: 'instruments', label: 'Instruments', does: 'Keeps the instrument in each pane and its build.'},
  {part: 'widgets', label: 'Widgets', does: 'Keeps the widgets on the rail and their presets.'},
  {part: 'layouts', label: 'Layouts', does: 'Keeps the layout each mode opens with.'},
]

export const OPENS_IN: readonly {value: WorkspaceOpensIn; label: string}[] = [
  {value: 'last', label: 'Last mode'}, {value: 'base', label: 'Central'}, {value: 'factory', label: 'Factory'},
  {value: 'expressions', label: 'Expressions'}, {value: 'techne', label: 'Technē'}, {value: 'live', label: 'Live'},
]
const ON_LAUNCH: readonly {value: PoolSettings['onLaunch']; label: string}[] = [
  {value: 'all', label: 'Restore all modes'}, {value: 'open', label: 'Restore open mode'}, {value: 'nothing', label: 'Restore nothing'},
]
const KEEP_CONTEXT: readonly {value: PoolSettings['keepContext']; label: string}[] = [
  {value: 'change', label: 'On change'}, {value: 'leave', label: 'On leave'}, {value: 'manual', label: 'Manual'},
]

/** A workspace's colour: one of the shell's own colour tokens, chosen by its id, so it stays the same wherever it is drawn. */
const TINTS = ['var(--accent)', 'var(--sel)', 'var(--green)', 'var(--stall)', 'var(--w-field)', 'var(--w-satya)', 'var(--w-ariadne)', 'var(--w-kestrel)'] as const
export function workspaceTint(id: string): string {
  let hash = 2166136261
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619)
  return TINTS[(hash >>> 0) % TINTS.length]!
}

/** The name a dropped tab gives its new workspace: the tab's title, else the arrangement's mode. */
export function nameFromDrop(title: string | null | undefined, fallback: string): string {
  return title?.trim() ? title.trim() : fallback
}

export interface WorkspacePoolProps {
  /** The pool's other face (Live's grooves): drawn in place of the workspaces while its switch is on. */
  grooves?: {label: string; face: ReactNode} | null
}

export function WorkspacePool({grooves = null}: WorkspacePoolProps) {
  const continuity = useOptionalContinuity()
  const [face, setFace] = useState<'workspaces' | 'grooves'>('workspaces')
  const [over, setOver] = useState(false)
  const showGrooves = grooves !== null && face === 'grooves'
  if (!continuity) return null
  const {book, changeBook} = continuity
  const pool = poolOf(book)
  const surfaces = continuity.current.layout.surfaces
  const drop = (event: DragEvent) => {
    const id = event.dataTransfer.getData(SURFACE_DRAG_TYPE)
    setOver(false)
    if (!id) return
    event.preventDefault()
    const title = surfaces[id]?.title
    changeBook(next => workspaceFromFront(next, nameFromDrop(title, `${continuity.current.name} · kept`), crypto.randomUUID()))
  }
  const accepts = (event: DragEvent) => event.dataTransfer.types.includes(SURFACE_DRAG_TYPE)
  return <section className={`workspace-pool${over ? ' is-over' : ''}`} aria-label="Pool" data-pool-face={showGrooves ? 'grooves' : 'workspaces'}
    onDragOver={event => { if (!showGrooves && accepts(event)) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setOver(true) } }}
    onDragLeave={() => setOver(false)} onDrop={event => { if (!showGrooves) drop(event) }}>
    <header className="workspace-pool-head">
      <span className="workspace-pool-title" data-i={showGrooves ? `${grooves!.label}|The set's grooves, read from the set and written into it.`
        : 'Pool|Your workspaces: each keeps a way of working, never the work. Drop a pane\'s tab here to make a new one.'}>{showGrooves ? grooves!.label : 'Workspaces'}</span>
      {grooves && <button type="button" className="workspace-pool-switch" aria-pressed={showGrooves} data-action="pool-face"
        data-i={`${grooves.label}|Show the set's grooves in the pool, as Live's pool does; press again for your workspaces.`}
        onClick={() => setFace(showGrooves ? 'workspaces' : 'grooves')}>{grooves.label}</button>}
    </header>
    {showGrooves ? grooves!.face : <>
      <div className="workspace-pool-columns" role="row">
        <span role="columnheader" data-i="Workspace|The workspace, on its colour. The one you are in is lit.">Workspace</span>
        {PARTS.map(({part, label, does}) => <span key={part} role="columnheader" data-i={`${label}|${does} On or Off.`}>{label}</span>)}
        <span role="columnheader" data-i="Opens in|The mode that comes forward after a launch.">Opens in</span>
        <span role="columnheader" aria-label="Acts" />
      </div>
      <ul className="workspace-pool-rows" role="rowgroup">
        {book.workspaces.map(workspace => <PoolRow key={workspace.id} workspace={workspace} here={workspace.id === book.active}
          launch={() => changeBook(next => launchWorkspace(next, workspace.id))}
          keep={() => changeBook(next => keepIntoWorkspace(next, workspace.id))}
          setKeep={(part, on) => changeBook(next => setWorkspaceKeep(next, workspace.id, part, on))}
          setOpensIn={opensIn => changeBook(next => setWorkspaceOpensIn(next, workspace.id, opensIn))} />)}
      </ul>
      <p className="workspace-pool-drop" data-i="Drop|Drop a pane's tab here and the arrangement around it becomes a new workspace.">Drop a pane's tab here to keep what is in front of you</p>
      <footer className="workspace-pool-footer">
        <label data-i="On launch|What comes back when you launch a workspace.">
          <span>On launch</span>
          <select value={pool.onLaunch} onChange={event => changeBook(next => setPoolSettings(next, {onLaunch: event.target.value as PoolSettings['onLaunch']}))}>
            {ON_LAUNCH.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label data-i="Keep context|When the workspace you are in stores your context.">
          <span>Keep context</span>
          <select value={pool.keepContext} onChange={event => changeBook(next => setPoolSettings(next, {keepContext: event.target.value as PoolSettings['keepContext']}))}>
            {KEEP_CONTEXT.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </footer>
    </>}
  </section>
}

function PoolRow({workspace, here, launch, keep, setKeep, setOpensIn}: {workspace: Workspace; here: boolean; launch: () => void; keep: () => void;
  setKeep: (part: WorkspaceKeepPart, on: boolean) => void; setOpensIn: (opensIn: WorkspaceOpensIn) => void}) {
  const keeps = keepsOf(workspace)
  const tint = workspaceTint(workspace.id)
  const kept = workspace.kept ? new Date(workspace.kept.keptAt).toLocaleString() : null
  return <li className={`workspace-pool-row${here ? ' is-here' : ''}`} role="row" data-workspace={workspace.id}>
    <span className="workspace-pool-name" role="cell" style={{['--workspace-tint' as string]: tint}}
      data-i={`${workspace.name}|${here ? 'The workspace you are in.' : 'A workspace you can launch.'}${kept ? ` Last kept ${kept}.` : ''}`}>{workspace.name}</span>
    {PARTS.map(({part, label, does}) => <button key={part} type="button" role="cell" className="workspace-pool-part" aria-pressed={keeps[part]}
      aria-label={`${label} for ${workspace.name}`} data-part={part} data-i={`${label}|${does} ${keeps[part] ? 'On' : 'Off'}: press to turn it ${keeps[part] ? 'off' : 'on'}.`}
      onClick={() => setKeep(part, !keeps[part])}>{keeps[part] ? 'On' : 'Off'}</button>)}
    <span role="cell" className="workspace-pool-opens">
      <select aria-label={`Opens in for ${workspace.name}`} value={opensInOf(workspace)} onChange={event => setOpensIn(event.target.value as WorkspaceOpensIn)}
        data-i="Opens in|The mode that comes forward after a launch.">
        {OPENS_IN.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </span>
    <span role="cell" className="workspace-pool-acts">
      <button type="button" data-action="launch" aria-label={`Launch ${workspace.name}`} onClick={launch}
        data-i={`Launch|Bring ${workspace.name}'s context back, in the modes On launch says.`}>▶</button>
      <button type="button" data-action="keep" aria-label={`Keep into ${workspace.name}`} onClick={keep}
        data-i={`Keep|Store what is in front of you now into ${workspace.name}.`}>Keep</button>
    </span>
  </li>
}
