import {useRef, useState} from 'react'
import {listFiles} from '../../../../../desktop/cradle/src/files/client'
import {featuredExpressions, forkExpression, startingPoints, type Expression} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/expressions'
import {blankJourney} from '../../../../../desktop/cradle/expressions-app/field-studies-journeys/src/model'
import {useWorkspace} from '../shell/workspaceContext'
import {collectionSections, enumerateWorks, expressionOwner, freshTitle, newExpression, openStarter, WORKS_FOLDER,
  type CollectionItem, type CollectionRow, type CollectionSection, type OpenOutcome, type OpenPorts} from './nativeExpressionCommands'
import './NativeExpressionCollections.css'

let collectionItems: readonly CollectionItem[] | null = null
let collectionSources: ReadonlyMap<string, Expression> | null = null
/** The app's own collections, read once: featuredExpressions() and startingPoints(). Both are pure data constructions. */
export function appCollectionItems(): readonly CollectionItem[] {
  if (!collectionItems) {
    const featured: CollectionItem[] = featuredExpressions().map(expression => ({id: expression.id, name: expression.name,
      description: expression.description ?? '', group: 'Featured'}))
    const starters: CollectionItem[] = startingPoints().map(point => ({id: point.id, name: point.expression.name,
      description: point.expression.description ?? '', group: point.group}))
    collectionItems = [...featured, ...starters]
  }
  return collectionItems
}

/** A fresh fork of one row's starter document (the frame's open-featured and start-mode, app.ts:1746-1747, fork the same
 * source with forkExpression). Every call is a new identity; the shared source is never handed out. */
export function appCollectionJourney(id: string): Expression | undefined {
  if (!collectionSources) collectionSources = new Map<string, Expression>([
    ...featuredExpressions().map(expression => [expression.id, expression] as const),
    ...startingPoints().map(point => [point.id, point.expression] as const)])
  const source = collectionSources.get(id)
  return source && forkExpression(source)
}

export const NEW_ROW: CollectionRow = {id: 'new', name: 'New Expression', description: 'An empty work: one Scene, nothing placed.'}
/** What a row says about its last run: the owner's refusal verbatim, or the status that follows a success. */
export interface RowReport {id: string; kind: 'error' | 'status'; text: string}

/** The report a settled run leaves on its row. A stopped sequence and a refused file save carry the owner's own text; a save says where the
 * file went; a bare success says nothing unless the works list could not refresh. */
export function reportOf(id: string, outcome: OpenOutcome): RowReport | null {
  if (!outcome.ok) return {id, kind: 'error', text: outcome.error}
  const text = [outcome.refused ? `Opened, but not saved to a file. ${outcome.refused}` : '', outcome.saved ? `Opened, and saved to ${outcome.saved.path}.` : '', outcome.warning ?? ''].filter(Boolean).join(' ')
  return text ? {id, kind: outcome.refused ? 'error' : 'status', text} : null
}

/** The rows and their state, with no owner access: New, then Featured, Starters and Built-in presets. */
export function CollectionList({sections, query, busy, report, onOpen, onNew}: {
  sections: readonly CollectionSection[]; query: string; busy: string | null; report: RowReport | null
  onOpen: (id: string) => void; onNew: () => void
}) {
  // Manual 10.3: a row opens by double-click; the button is the same act, for the keyboard and the pointer.
  const row = (item: CollectionRow, label: string, name: string, act: () => void) => <li key={item.id} className="world-collection-row" data-collection-row={item.id} onDoubleClick={busy === null ? act : undefined}>
    <span className="world-collection-name">{item.name}</span>
    {item.description && <small className="world-collection-description">{item.description}</small>}
    <button type="button" data-browser-row disabled={busy !== null} aria-busy={busy === item.id ? 'true' : undefined} aria-label={name} onClick={act}>{busy === item.id ? 'Opening…' : label}</button>
    {report?.id === item.id && (report.kind === 'error'
      ? <p className="native-error" role="alert">{report.text}</p>
      : <p className="native-empty" role="status">{report.text}</p>)}
  </li>
  return <div className="native-expression-collections">
    <section className="world-collection" aria-label="New"><h3>New</h3><ul>{row(NEW_ROW, 'New', NEW_ROW.name, onNew)}</ul></section>
    {sections.map(section => <section key={section.id} className="world-collection" aria-label={section.title}>
      <h3>{section.title}</h3>
      {section.rows.length
        ? <ul>{section.rows.map(item => row(item, 'Open', `Open ${item.name}`, () => onOpen(item.id)))}</ul>
        : <p className="native-empty">{query.trim() ? 'No collections match this search.' : 'None disclosed.'}</p>}
    </section>)}
  </div>
}

/** Featured, Starters, Built-in presets and New in the Expressions browser. Open and New run the owner sequence
 * (nativeExpressionCommands.ts openStarter and newExpression) through the Expressions panel's kernel-expression channel,
 * then ask the panel's open door for the result. */
export function NativeExpressionCollections({query}: {query: string}) {
  const workspace = useWorkspace()
  const origin = useRef(workspace)
  origin.current = workspace
  const [busy, setBusy] = useState<string | null>(null)
  const [report, setReport] = useState<RowReport | null>(null)
  // One run at a time: a click and a double-click in the same gesture start one sequence, never two.
  const running = useRef(false)
  const sections = collectionSections(appCollectionItems(), query)
  async function run(id: string, start: (ports: OpenPorts) => Promise<OpenOutcome>) {
    if (running.current) return
    running.current = true
    const epoch = workspace.accessEpoch, workspaceId = workspace.workspaceId, channel = expressionOwner()
    const current = () => origin.current.workspaceId === workspaceId && origin.current.nativeAccessCurrent(epoch)
    setBusy(id); setReport(null)
    let outcome: OpenOutcome
    try {
      outcome = await start({
        expression: channel,
        parent: WORKS_FOLDER === null ? null : async () => (await listFiles(origin.current.transport, WORKS_FOLDER, true)).location,
        uuid: () => crypto.randomUUID(),
        current,
        refresh: () => channel ? enumerateWorks(channel, works => origin.current.publishWorks(works), current) : Promise.resolve([]),
        // The same door as a works row (WorldBrowser.tsx openWork): Live reveals Expressions first.
        open: ref => {const shell = origin.current; if (shell.mode === 'audio') shell.setMode('expressions'); shell.requestExpression(ref)},
      })
    } catch (cause) {
      outcome = {ok: false, error: cause instanceof Error ? cause.message : String(cause), expression_ref: null}
    } finally {
      running.current = false
      setBusy(null)
    }
    setReport(reportOf(id, outcome))
  }
  const open = (id: string) => {
    const journey = appCollectionJourney(id)
    if (!journey) setReport({id, kind: 'error', text: 'This starting point is not in the app collections.'})
    else void run(id, ports => openStarter(ports, journey))
  }
  const create = () => void run(NEW_ROW.id, ports => newExpression(ports, freshTitle(blankJourney().name, origin.current.nativeWorks.map(work => work.title))))
  return <CollectionList sections={sections} query={query} busy={busy} report={report} onOpen={open} onNew={create} />
}
