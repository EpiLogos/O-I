// Templates (manual §10.3 Sets, files and media: "A set you want to start from again is a template. Choose Save Set as Template… in the
// File menu, and the template stands in the browser with your sets. A new set started from it takes its tracks and its layout"; §16.7:
// "Start from a template — Open a template from the browser — A new set starts with the template's tracks and its layout"; "An arrangement
// to start from again is a template in the browser"; decision #709: "A workspace's layout is kept by its set; reusable arrangements are
// templates in the browser").
//
// The book (desktop/cradle/src/workspace/store.ts) is the one writer and keeps the arrangements: the record you stand in is your set,
// and every other record is an arrangement kept to start from again — what the pool's workspace rows were, now a template. Starting from
// one gives your set its arrangement (the trees of every mode and the rail) and leaves the template as it was; Save Set as Template…
// keeps the arrangement in front of you as a new one and leaves you in your set. Ported from the pool's acts (continuity/workspacePool.ts
// launchWorkspace's restore, workspaceFromFront's keep), which this replaces in the face. Pure.
import {sharedAcrossModes, type Workspace, type WorkspaceBook} from '../../../../../../desktop/cradle/src/workspace/store'
import {contextOf, poolOf} from '../../continuity/workspacePool'

/** The templates in the book: every kept arrangement but the set you stand in. */
export const templatesOf = (book: WorkspaceBook): readonly Workspace[] => book.workspaces.filter(workspace => workspace.id !== book.active)

/** Start from a template: your set takes the template's arrangement — its trees in every mode and its rail — keeping the frame's own
 * widths, its window and its world; the template is unchanged. Pure. */
export function startFromTemplate(book: WorkspaceBook, templateId: string, at: number = Date.now()): WorkspaceBook {
  const template = book.workspaces.find(workspace => workspace.id === templateId)
  const front = book.workspaces.find(workspace => workspace.id === book.active)
  if (!template || !front || template.id === front.id) return book
  const source = poolOf(book).keepContext !== 'change' && template.kept ? template.kept : contextOf(template, at)
  const layout = {...source.layout, ...sharedAcrossModes(front.layout), detached: front.layout.detached, windowBounds: front.layout.windowBounds}
  const started: Workspace = {...front, layout, modeLayouts: source.modeLayouts, widgets: source.widgets ?? front.widgets, lastVisitedAt: at}
  return {...book, workspaces: book.workspaces.map(workspace => (workspace.id === front.id ? started : workspace))}
}

/** Save Set as Template…: the arrangement in front of you kept as a new template under `name`; you stay in your set. Pure. */
export function saveAsTemplate(book: WorkspaceBook, name: string, id: string, at: number = Date.now()): WorkspaceBook {
  const front = book.workspaces.find(workspace => workspace.id === book.active)
  const label = name.trim()
  if (!front || !label) return book
  const kept: Workspace = {id, name: label, writing: '', layout: front.layout, ...(front.modeLayouts ? {modeLayouts: front.modeLayouts} : {}),
    ...(front.widgets ? {widgets: front.widgets} : {}), context: front.context, kept: contextOf(front, at), lastVisitedAt: at}
  return {...book, workspaces: [...book.workspaces, kept]}
}

/** What a template keeps, in words: the modes it has an arrangement for and the widgets on its rail. Pure. */
export function templateWords(template: Workspace): string {
  const modes = [template.layout.mode ?? 'base', ...Object.keys(template.modeLayouts ?? {})]
  const named = [...new Set(modes)].map(mode => ({base: 'Central', live: 'Live', factory: 'Factory', expressions: 'Expressions', techne: 'Technē', settings: 'Settings'} as Record<string, string>)[mode] ?? mode)
  const panes = Object.keys(template.layout.surfaces ?? {}).length
  const widgets = template.widgets?.open.length ?? 0
  return `${template.name} — an arrangement for ${named.join(', ')}: ${panes} pane${panes === 1 ? '' : 's'} in front${widgets ? `, ${widgets} widget${widgets === 1 ? '' : 's'} on the rail` : ''}. `
    + 'Double-click it to start your set from it; the template stays as it is.'
}
