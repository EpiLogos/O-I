// The pool's workspaces (manual §10.3, §16.7): "A workspace is a way of working on something, kept: which panes are open and
// what they hold, which instruments and builds, which widgets on the rail, and the layout each mode opens with. Launch one and
// all of it comes back." The book (desktop/cradle/src/workspace/store.ts) holds the workspaces; these are the pool's pure acts
// over it — Launch, Keep, a new workspace from what is in front of you, and the named sets that became workspaces. Each
// returns a new book; the store is the one writer.
//
// The reading of the columns: Panes keeps the tree of the mode that comes forward (its splits, pins and what each pane holds);
// Layouts keeps the trees the other modes open with; Instruments keeps each pane's instrument build (Off: an instrument comes
// back on its default build); Widgets keeps the rail. A part a workspace does not keep stays as it is in front of you.
// "Launching a workspace changes no page, no world and no Day": the selection and the world context are never a workspace's.
import {KEEPS_ALL, POOL_DEFAULTS, layoutModeField, sharedAcrossModes, type KeptContext, type NamedSet, type PoolSettings, type Workspace,
  type WorkspaceBook, type WorkspaceKeepPart, type WorkspaceKeeps, type WorkspaceOpensIn} from '../../../../../desktop/cradle/src/workspace/store'
import {WORKSPACE_MODES, type WorkspaceMode} from '../../../../../desktop/cradle/src/workspace/mode'
import type {LayoutState} from '../../../../../desktop/cradle/src/surface/types'

export const keepsOf = (workspace: Workspace): WorkspaceKeeps => workspace.keeps ?? KEEPS_ALL
export const poolOf = (book: WorkspaceBook): PoolSettings => book.pool ?? POOL_DEFAULTS
export const opensInOf = (workspace: Workspace): WorkspaceOpensIn => workspace.opensIn ?? 'last'
const modeOf = (layout: LayoutState): WorkspaceMode => layout.mode ?? 'base'

/** What is in front of you in a workspace record: its trees by mode and its rail. */
export function contextOf(workspace: Workspace, at: number): KeptContext {
  return {layout: workspace.layout, ...(workspace.modeLayouts ? {modeLayouts: workspace.modeLayouts} : {}), ...(workspace.widgets ? {widgets: workspace.widgets} : {}), keptAt: at}
}

/** A context's tree for one mode, or null when it holds none for that mode. */
function treeOf(context: Pick<KeptContext, 'layout' | 'modeLayouts'>, mode: WorkspaceMode): LayoutState | null {
  return modeOf(context.layout) === mode ? context.layout : context.modeLayouts?.[mode] ?? null
}

/** Every instrument in a tree back on its default build (Instruments Off). */
function withoutBuilds(tree: LayoutState): LayoutState {
  const surfaces = Object.fromEntries(Object.entries(tree.surfaces).map(([id, binding]) => {
    const projection = binding.projection
    if (!projection?.build) return [id, binding]
    const {build: _build, ...rest} = projection
    return [id, {...binding, projection: rest}]
  }))
  return {...tree, surfaces}
}

/** The source a launch restores from: the kept context when the footer keeps by hand or on leaving, else the record as it
 * stands (keeping on every change makes the record the kept context). */
function sourceOf(book: WorkspaceBook, workspace: Workspace, at: number): KeptContext {
  return poolOf(book).keepContext !== 'change' && workspace.kept ? workspace.kept : contextOf(workspace, at)
}

/** Launch a workspace (▶): the workspace you leave keeps per Keep context, the target's kept parts come back in the modes On
 * launch says, and its Opens in mode comes forward. Launching the workspace you are in brings back what it last kept. Pure. */
export function launchWorkspace(book: WorkspaceBook, targetId: string, at: number = Date.now()): WorkspaceBook {
  const target = book.workspaces.find(w => w.id === targetId)
  const leaving = book.workspaces.find(w => w.id === book.active)
  if (!target || !leaving) return book
  const pool = poolOf(book)
  const front = contextOf(leaving, at)
  const source = target.id === leaving.id ? (target.kept ?? front) : sourceOf(book, target, at)
  const keeps = keepsOf(target)
  const opensIn = opensInOf(target)
  const forward: WorkspaceMode = opensIn === 'last' ? modeOf(source.layout) : opensIn
  // Each mode's tree: the target's where On launch and its columns restore it, else the one in front of you.
  const restores = (mode: WorkspaceMode): boolean => pool.onLaunch === 'all' ? (mode === forward ? keeps.panes : keeps.layouts)
    : pool.onLaunch === 'open' ? mode === forward && keeps.panes : false
  const trees = new Map<WorkspaceMode, LayoutState>()
  for (const mode of WORKSPACE_MODES) {
    const restored = restores(mode) ? treeOf(source, mode) : null
    const tree = restored ? (keeps.instruments ? restored : withoutBuilds(restored)) : treeOf(front, mode)
    if (tree) trees.set(mode, {...tree, mode: layoutModeField(mode)})
  }
  const frontLayout = leaving.layout
  const ahead: LayoutState = {...(trees.get(forward) ?? frontLayout), ...sharedAcrossModes(frontLayout),
    detached: frontLayout.detached, windowBounds: frontLayout.windowBounds, mode: layoutModeField(forward)}
  trees.delete(forward)
  const widgets = pool.onLaunch !== 'nothing' && keeps.widgets ? source.widgets ?? leaving.widgets : leaving.widgets
  // The kept context of the workspace you leave: on leaving, it keeps what is in front of you; by hand, what it last kept.
  const left: Workspace = pool.keepContext === 'leave' ? {...leaving, kept: front} : leaving
  const launched: Workspace = {...target, layout: ahead, modeLayouts: Object.fromEntries(trees) as Workspace['modeLayouts'],
    ...(widgets ? {widgets} : {widgets: undefined}), context: leaving.context, lastVisitedAt: at}
  return {...book, active: target.id, workspaces: book.workspaces.map(w => w.id === target.id ? launched : w.id === leaving.id && target.id !== leaving.id ? left : w)}
}

/** Keep (the row's second act): what is in front of you now goes into the workspace, its kept parts only; a part it does not
 * keep stays as it last kept it. Pure. */
export function keepIntoWorkspace(book: WorkspaceBook, targetId: string, at: number = Date.now()): WorkspaceBook {
  const target = book.workspaces.find(w => w.id === targetId)
  const front = book.workspaces.find(w => w.id === book.active)
  if (!target || !front) return book
  const keeps = keepsOf(target)
  const now = contextOf(front, at)
  const before = target.kept ?? contextOf(target, at)
  const forward = modeOf(now.layout)
  const trees = new Map<WorkspaceMode, LayoutState>()
  for (const mode of WORKSPACE_MODES) {
    const take = mode === forward ? keeps.panes : keeps.layouts
    const tree = take ? treeOf(now, mode) : treeOf(before, mode)
    if (tree) trees.set(mode, keeps.instruments || !take ? tree : withoutBuilds(tree))
  }
  const layout = trees.get(forward) ?? before.layout
  trees.delete(forward)
  const widgets = keeps.widgets ? now.widgets : before.widgets
  const kept: KeptContext = {layout, ...(trees.size ? {modeLayouts: Object.fromEntries(trees)} : {}), ...(widgets ? {widgets} : {}), keptAt: at}
  return {...book, workspaces: book.workspaces.map(w => w.id === target.id ? {...w, kept} : w)}
}

/** A new workspace from what is in front of you (a pane's tab dropped on the pool): it keeps the whole arrangement and becomes
 * the workspace you are in; the one you were in keeps per the footer. Pure. */
export function workspaceFromFront(book: WorkspaceBook, name: string, id: string, at: number = Date.now()): WorkspaceBook {
  const front = book.workspaces.find(w => w.id === book.active)
  const label = name.trim()
  if (!front || !label) return book
  const pool = poolOf(book)
  const created: Workspace = {id, name: label, writing: '', layout: front.layout, ...(front.modeLayouts ? {modeLayouts: front.modeLayouts} : {}),
    ...(front.widgets ? {widgets: front.widgets} : {}), context: front.context, kept: contextOf(front, at), lastVisitedAt: at}
  const left: Workspace = pool.keepContext === 'leave' ? {...front, kept: contextOf(front, at)} : front
  return {...book, active: id, workspaces: [...book.workspaces.map(w => w.id === front.id ? left : w), created]}
}

/** A named set (the browser's Sets, manual §10.2 before 18 Oct) becomes a workspace of its own: its arrangement is that
 * workspace's tree in the set's mode, and it opens in that mode. The sets leave the record they were kept in. Pure. */
export function setsAsWorkspaces(book: WorkspaceBook, mint: () => string = () => crypto.randomUUID()): WorkspaceBook {
  const sets = book.workspaces.flatMap(w => (w.sets ?? []).map(set => ({owner: w, set})))
  if (!sets.length) return book
  const fromSet = ({owner, set}: {owner: Workspace; set: NamedSet}): Workspace => {
    const layout: LayoutState = {...set.layout, ...sharedAcrossModes(owner.layout), mode: layoutModeField(set.mode), appliedSet: undefined}
    return {id: mint(), name: set.name, writing: '', layout, opensIn: set.mode, kept: {layout, keptAt: set.savedAt}, lastVisitedAt: set.savedAt}
  }
  return {...book, workspaces: [...book.workspaces.map(w => w.sets ? {...w, sets: undefined} : w), ...sets.map(fromSet)]}
}

/** One workspace's column, On or Off. Pure. */
export function setWorkspaceKeep(book: WorkspaceBook, id: string, part: WorkspaceKeepPart, on: boolean): WorkspaceBook {
  return {...book, workspaces: book.workspaces.map(w => {
    if (w.id !== id) return w
    const keeps = {...keepsOf(w), [part]: on}
    return Object.values(keeps).every(Boolean) ? {...w, keeps: undefined} : {...w, keeps}
  })}
}

/** One workspace's Opens in. Pure. */
export function setWorkspaceOpensIn(book: WorkspaceBook, id: string, opensIn: WorkspaceOpensIn): WorkspaceBook {
  return {...book, workspaces: book.workspaces.map(w => w.id === id ? {...w, opensIn: opensIn === 'last' ? undefined : opensIn} : w)}
}

/** The footer's two settings. Pure. */
export function setPoolSettings(book: WorkspaceBook, change: Partial<PoolSettings>): WorkspaceBook {
  const pool = {...poolOf(book), ...change}
  return pool.onLaunch === POOL_DEFAULTS.onLaunch && pool.keepContext === POOL_DEFAULTS.keepContext ? {...book, pool: undefined} : {...book, pool}
}
