// The constellations of your wiki in the one browser (manual §10.3: Material holds "the constellations of your wiki"; "Select a row once
// and its preview shows at the foot of the list … A constellation's preview is what this mode makes of it … Drag it onto a track and this
// mode makes its own clip of it"; §16.7's Preview, Make this mode's clip and Show in Browser rows).
//
// A row body under the browser's control (browserKinds.ts ControlledBrowser): the rows are the owner's reading (owners/constellations.ts),
// a press selects one (the browser's own selection, kept across modes: constellationFocus.ts), a drag carries its ref (CONSTELLATION_DRAG)
// to a track, and the selected one's preview is portalled to the foot of the list, drawn by the mode's registration (the preview it is
// handed: shell/constellationPreviews.tsx), never a branch here. Show in Browser brings its row into view.
//
// The selected constellation opens to what it holds, as a folder of Live's browser opens to its contents (O-I #742): its members (a
// passage gathered from a source, with its span), its connections and the Expressions returned to it. Each row's menu (right-click, the
// menu key or ⇧F10; manual §10.9) holds that thing's acts, each the Wiki owner's (constellationActs.ts): New constellation on a space,
// Rename and Edit question, a member's Open and its time and place and Remove, a connection's meaning, direction, standing and
// retraction, a returned Expression's Open. An inline row takes the words an act needs: Enter writes them, Esc lets them go.
import {useCallback, useContext, useEffect, useRef, useState, type ComponentType, type KeyboardEvent, type MouseEvent} from 'react'
import {createPortal} from 'react-dom'
import type {ControlledBrowser} from './browserKinds'
import {CONSTELLATION_DRAG, selectConstellation, useConstellationFocus} from './constellationFocus'
import {constellationNamed, useConstellations, type Constellation} from '../../owners/constellations'
import {Icon} from '../../inhabitants/sdk/Icon'
import {useObjectMenu, type ObjectMenuItem} from '../menu/useObjectMenu'
import {ObjectMenu} from '../menu/ObjectMenu'
import {detectTransport} from '../../../../../../desktop/cradle/src/kernel/bridge'
import {actOn, connectionRequest, createConstellation, inquiryRequest, readConstruction, removeRequest, reopenReturned,
  type ConstructionMember} from '../../../../../../desktop/cradle/src/knowledge/constellationActs'
import {getWikiProjectionState, refreshWikiProjectionReading} from '../../../../../../desktop/cradle/src/techne/wikiProjectionStore'
import {Workspace} from '../../shell/workspaceContext'
import {connectionMenu, connectionWords, constellationMenu, memberMenu, memberWords, openInReader, returnedMenu,
  type ConstructionState, type RowActs, type RowEdit} from './constellationActs'

export interface ConstellationPreviewProps {readonly constellation: Constellation}

/** What a row says of its constellation on hover: what it is, what it gathers, and the three acts. Pure. */
export function constellationRowWords(row: Constellation): string {
  const gathered = row.members.length ? `gathers ${row.members.length}: ${row.members.slice(0, 4).map(member => member.title).join(', ')}${row.members.length > 4 ? '…' : ''}` : 'gathers nothing yet'
  return `${row.title} — ${row.kind === 'frame' ? 'a constellation' : 'a world\'s own constellation'} of ${row.registerTitle}'s wiki; ${gathered}. `
    + 'Select it to preview what this mode makes of it; drag it onto a track and this mode makes its own clip of it. Its menu holds its acts.'
}

const said = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** The selected constellation's construction, read from its register when it is selected and after each act (`generation`). */
function useConstruction(row: Constellation | null, generation: number): ConstructionState {
  const [state, setState] = useState<ConstructionState>({state: 'reading'})
  // A change of what the register discloses for this whole (its members, its title) reads it again.
  const shape = row ? JSON.stringify([row.title, row.question ?? '', row.members.map(member => [member.ref, member.position, member.face])]) : ''
  useEffect(() => {
    if (!row) return
    let alive = true
    setState(was => (was.state === 'read' && was.reading.whole === row.ref ? was : {state: 'reading'}))
    readConstruction(detectTransport(), row.project, row.ref).then(read => { if (alive) setState(read ? {state: 'read', reading: read.reading} : {state: 'none'}) },
      error => { if (alive) setState({state: 'unread', reason: said(error)}) })
    return () => { alive = false }
  }, [row?.ref, row?.project, shape, generation])
  return state
}

/** Read the constellation's register again, so every reader of the projection (the rows, the Form, the reader) reads what it holds now. */
async function reread(row: Pick<Constellation, 'register'>): Promise<void> {
  const register = getWikiProjectionState().registers.find(candidate => candidate.key === row.register)
  if (register) await refreshWikiProjectionReading(register, detectTransport())
}

/** The inline row an act's words are typed in: one field, or a title and a question for a new constellation. */
function EditRow({edit, initial, onDone}: {edit: RowEdit; initial: {title: string; question: string}; onDone: (words: {title: string; question: string} | null) => void}) {
  const [title, setTitle] = useState(initial.title)
  const [question, setQuestion] = useState(initial.question)
  const first = useRef<HTMLInputElement>(null), second = useRef<HTMLInputElement>(null)
  useEffect(() => { first.current?.focus(); first.current?.select() }, [])
  const both = edit.kind === 'new'
  const key = (event: KeyboardEvent<HTMLInputElement>, field: 'first' | 'second') => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onDone(null); return }
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (both && field === 'first') { second.current?.focus(); return }
    onDone({title, question})
  }
  const label = edit.kind === 'new' ? 'Title' : edit.kind === 'question' ? 'Question' : edit.kind === 'meaning' ? 'Meaning' : 'Title'
  const value = edit.kind === 'question' ? question : title
  const change = (text: string) => (edit.kind === 'question' ? setQuestion(text) : setTitle(text))
  return <div className="browser-item browser-edit" role="group" aria-label={edit.kind === 'new' ? `New constellation in ${edit.row.title}` : `${label} of ${edit.kind === 'meaning' ? 'the connection' : edit.row.title}`}
    data-i={`${label}|Enter writes it through the owner; Esc lets it go and nothing is written.`}>
    <input ref={first} aria-label={label} placeholder={label} value={value} maxLength={edit.kind === 'meaning' ? 256 : 512} onChange={event => change(event.target.value)}
      onKeyDown={event => key(event, 'first')} onBlur={event => { if (!both && !event.currentTarget.parentElement?.contains(event.relatedTarget as Node)) onDone(null) }} />
    {both && <input ref={second} aria-label="Question" placeholder="Question" value={question} maxLength={4096} onChange={event => setQuestion(event.target.value)}
      onKeyDown={event => key(event, 'second')} />}
  </div>
}

export function ConstellationRows({controlled, Preview}: {controlled: ControlledBrowser; Preview: ComponentType<ConstellationPreviewProps>}) {
  const reading = useConstellations()
  const focus = useConstellationFocus()
  const list = useRef<HTMLDivElement>(null)
  const menu = useObjectMenu({width: 248})
  const workspace = useContext(Workspace)
  const needle = controlled.query.trim().toLowerCase()
  const rows = needle ? reading.rows.filter(row => `${row.title} ${row.registerTitle}`.toLowerCase().includes(needle)) : reading.rows
  const chosen = constellationNamed(reading.rows, focus.ref)
  const [generation, setGeneration] = useState(0)
  const construction = useConstruction(chosen, generation)
  const [edit, setEdit] = useState<RowEdit | null>(null)
  const [line, setLine] = useState<{text: string; alert?: boolean} | null>(null)
  // Show in Browser brings the selected row into view, each time it is asked (focus.shown moves).
  useEffect(() => {
    if (!focus.ref) return
    const row = [...list.current?.querySelectorAll<HTMLElement>('[data-constellation]') ?? []].find(item => item.dataset.constellation === focus.ref)
    row?.scrollIntoView?.({block: 'nearest'})
  }, [focus.shown, focus.ref, rows.length])
  useEffect(() => { setLine(null) }, [focus.ref])

  /** One owner act: what it says on the browser's line, then the register read again. */
  const run = useCallback(async (row: Constellation, doing: string, act: () => Promise<string>) => {
    setLine({text: `${doing}…`})
    try {
      const done = await act()
      await reread(row).catch(() => { /* The owner wrote it; the projection reads it on its next read. */ })
      setGeneration(n => n + 1)
      setLine({text: done})
    } catch (error) { setLine({text: said(error), alert: true}) }
  }, [])
  const transport = detectTransport
  const acts: RowActs = {
    edit: next => { menu.close(); setEdit(next) },
    open: (member, row) => {
      const own = 'participation_ref' in member ? member as ConstructionMember : null, node = own ? null : member as Constellation['members'][number]
      openInReader(own ? {title: own.label.slice(0, 120), project: row.project, address: {kind: 'source', value: own.subject_ref}, plane: 'page', ...(own.anchor ? {anchor: own.anchor} : {})}
        : {title: node!.title, project: row.project, address: {kind: 'wiki', value: node!.ref}, plane: 'page'},
      error => { if (error) setLine({text: error, alert: true}) })
    },
    facts: (subject, row, title) => {
      const member = typeof subject === 'string' ? null : construction.state === 'read' ? construction.reading.members.find(row_ => row_.participation_ref === subject.participation_ref) : null
      openInReader(member ? {title: title.slice(0, 120), project: row.project, address: {kind: 'source', value: member.subject_ref}, plane: 'page', ...(member.anchor ? {anchor: member.anchor} : {}), facts: subject}
        : {title, project: row.project, address: {kind: 'wiki', value: typeof subject === 'string' ? subject : row.ref}, plane: 'graph', facts: subject},
      error => { if (error) setLine({text: error, alert: true}) })
    },
    showInGraph: row => openInReader({title: row.title, project: row.project, address: {kind: 'wiki', value: row.ref}, plane: 'graph'}, error => { if (error) setLine({text: error, alert: true}) }),
    remove: (member, row) => void run(row, `Removing ${member.label.slice(0, 40)}`, async () => {
      await actOn(transport(), row.project, row.ref, row.title, (register, frame) => ({request: removeRequest(register, frame, member.participation_ref)}))
      return `Removed from ${row.title}. Its source stays as it is.`
    }),
    connection: (connection, row, change) => void run(row, change ? 'Changing the connection' : 'Retracting the connection', async () => {
      await actOn(transport(), row.project, row.ref, row.title, (register, frame) => ({request: connectionRequest(register, frame, connection.ref, change)}))
      return change ? `The connection ${change.direction ? `runs ${change.direction}` : `stands ${change.standing}`} in ${row.title}.` : `The connection is retracted from ${row.title}.`
    }),
    reopen: (item, row) => void run(row, 'Opening the Expression', async () => {
      const document = await reopenReturned(transport(), item)
      if (!workspace) throw new Error('No Expressions pane is open here to open it in.')
      workspace.requestExpression(document.expression_ref)
      return `${document.title ?? document.expression_ref} opens in Expressions at revision ${document.revision}.`
    }),
  }
  const write = (target: RowEdit, words: {title: string; question: string} | null) => {
    setEdit(null)
    if (!words) return
    const row = target.row
    if (target.kind === 'new') {
      void run(row, `Making ${words.title || 'the constellation'}`, async () => {
        const made = await createConstellation(transport(), row.project, row.space!, words.title, words.question)
        await reread(row).catch(() => {})
        selectConstellation(made.whole)
        return `${words.title.trim()} stands in ${row.title}. Gather passages into it from the reader: Add to constellation.`
      })
    } else if (target.kind === 'meaning') {
      void run(row, 'Renaming the connection', async () => {
        await actOn(transport(), row.project, row.ref, row.title, (register, frame) => ({request: connectionRequest(register, frame, target.connection.ref, {relation: words.title.trim()})}))
        return `The connection means ${words.title.trim()}.`
      })
    } else {
      void run(row, target.kind === 'title' ? 'Renaming' : 'Changing the question', async () => {
        await actOn(transport(), row.project, row.ref, row.title, (register, frame) => ({request: inquiryRequest(register, frame, target.kind === 'title' ? {title: words.title} : {question: words.question})}))
        return target.kind === 'title' ? `Renamed ${words.title.trim()}.` : `${row.title} asks: ${words.question.trim()}`
      })
    }
  }
  /** Open a row's menu at the pointer, or (by key) at the row. */
  const menuAt = (event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>, items: ObjectMenuItem[], name: string) => {
    event.preventDefault()
    const box = event.currentTarget.getBoundingClientRect()
    const pointer = 'clientX' in event && event.type === 'contextmenu'
    menu.openAt(pointer ? (event as MouseEvent).clientX : box.left + 12, pointer ? (event as MouseEvent).clientY : box.bottom, items, name, event.currentTarget, pointer ? 'pointer' : 'keyboard')
  }
  const menuKey = (event: KeyboardEvent<HTMLElement>, items: () => ObjectMenuItem[], name: string) => {
    if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) menuAt(event, items(), name)
  }

  const waiting = reading.fault ? `The wiki was not read: ${reading.fault}`
    : !reading.registers ? 'The wiki is being read: Central has not disclosed its registers yet.'
    : reading.reading.length && !reading.rows.length ? `The wiki is being read (${reading.reading.join(', ')}).` : null
  const missing = focus.ref && !chosen && !reading.reading.length ? `${focus.ref} is no constellation the wiki's reading holds now.` : null
  const made = construction.state === 'read' ? construction.reading : null
  const editing = (row: Constellation, kind: RowEdit['kind']) => edit && edit.row.ref === row.ref && edit.kind === kind ? edit : null
  const held = (row: Constellation) => {
    const items: JSX.Element[] = []
    const members = made ? made.members : row.members
    members.forEach((member, i) => {
      const words = memberWords(member)
      const key = 'participation_ref' in member ? member.participation_ref : `${member.ref}:${i}`
      const items_ = () => memberMenu(member, row, construction, acts)
      items.push(<button key={`m:${key}`} type="button" className="browser-item browser-held" data-member={key} title={words.name}
        data-i={`${words.name}|A member of ${row.title}. Double-click to open it at its passage; its menu holds its time and place and Remove.`}
        onDoubleClick={() => acts.open(member, row)} onContextMenu={event => menuAt(event, items_(), words.name.slice(0, 60))}
        onKeyDown={event => { if (event.key === 'Enter') acts.open(member, row); else menuKey(event, items_, words.name.slice(0, 60)) }}>
        <Icon name="placed" size={12} /><span>{words.name}</span><span className="mode-browser-row-meta">{words.meta}</span>
      </button>)
    })
    if (made) for (const connection of made.connections) {
      const meaning = editing(row, 'meaning')
      if (meaning?.kind === 'meaning' && meaning.connection.ref === connection.ref) {
        items.push(<EditRow key={`c:${connection.ref}`} edit={meaning} initial={{title: connection.relation, question: ''}} onDone={words => write(meaning, words)} />)
        continue
      }
      const words = connectionWords(connection, made)
      items.push(<button key={`c:${connection.ref}`} type="button" className="browser-item browser-held" data-connection={connection.ref} title={words}
        data-i={`${words}|A connection of ${row.title}, ${connection.standing}. Its menu holds its meaning, direction and standing, and Retract.`}
        onContextMenu={event => menuAt(event, connectionMenu(connection, row, acts), words.slice(0, 60))}
        onKeyDown={event => menuKey(event, () => connectionMenu(connection, row, acts), words.slice(0, 60))}>
        <Icon name="link" size={12} /><span>{words}</span><span className="mode-browser-row-meta">{connection.standing}</span>
      </button>)
    }
    if (made) for (const item of made.compositions) {
      const name = `${item.kind === 'expression' ? 'Expression' : item.kind} r${item.revision}`
      items.push(<button key={`r:${item.reference}:${item.revision}`} type="button" className="browser-item browser-held" data-returned={item.reference} title={item.reference}
        data-i={`${name}|Returned to ${row.title}. Double-click to open it again from its file.`}
        onDoubleClick={() => acts.reopen(item, row)} onContextMenu={event => menuAt(event, returnedMenu(item, row, acts), name)}
        onKeyDown={event => { if (event.key === 'Enter') acts.reopen(item, row); else menuKey(event, () => returnedMenu(item, row, acts), name) }}>
        <Icon name="expr" size={12} /><span>{name}</span><span className="mode-browser-row-meta">returned</span>
      </button>)
    }
    if (construction.state === 'reading') items.push(<p key="reading" className="browser-empty browser-held" role="status">Reading what {row.title} holds…</p>)
    if (construction.state === 'unread') items.push(<p key="unread" className="browser-empty browser-held" role="status">{row.title}'s register was not read: {construction.reason}</p>)
    if (!members.length && construction.state !== 'reading') items.push(<p key="empty" className="browser-empty browser-held">{made ? `${row.title} gathers nothing yet: select a passage in the reader and choose Add to constellation.` : `${row.title} gathers nothing yet.`}</p>)
    return items
  }
  return <div className="browser-results" data-browser-constellations ref={list}>
    <div className="browser-list-heading">Name <span>World</span></div>
    {rows.map(row => {
      const renaming = editing(row, 'title') ?? editing(row, 'question')
      const items = () => constellationMenu(row, row.ref === chosen?.ref ? construction : {state: 'reading'}, acts)
      const newHere = editing(row, 'new')
      return <div key={row.ref} className="browser-constellation" data-constellation-group={row.ref}>
        {renaming && made ? <EditRow edit={renaming} initial={{title: made.title, question: made.question}} onDone={words => write(renaming, words)} />
          : <button type="button" className="browser-item" aria-pressed={row.ref === focus.ref} data-constellation={row.ref}
          data-i={`${row.title}|${constellationRowWords(row)}`} title={constellationRowWords(row)} draggable
          onClick={() => selectConstellation(row.ref)}
          onContextMenu={event => { selectConstellation(row.ref); menuAt(event, items(), row.title) }}
          onKeyDown={event => menuKey(event, items, row.title)}
          onDragStart={event => { event.dataTransfer.setData(CONSTELLATION_DRAG, row.ref); event.dataTransfer.setData('text/plain', row.title); event.dataTransfer.effectAllowed = 'copy' }}>
          <Icon name="orbit" size={12} /><span>{row.title}</span><span className="mode-browser-row-meta">{row.registerTitle}</span>
        </button>}
        {newHere && <EditRow edit={newHere} initial={{title: '', question: ''}} onDone={words => write(newHere, words)} />}
        {row.ref === chosen?.ref && held(row)}
      </div>
    })}
    {line && <p className="browser-empty" role={line.alert ? 'alert' : 'status'}>{line.text}</p>}
    {waiting && <p className="browser-empty" role="status">{waiting}</p>}
    {!waiting && !reading.rows.length && <p className="browser-empty">Your wiki holds no constellation yet.</p>}
    {!waiting && reading.rows.length > 0 && !rows.length && <p className="browser-empty">No constellation matches.</p>}
    {reading.unread.map(item => <p key={item.register} className="browser-empty" role="status">{item.register}'s wiki was not read: {item.reason}</p>)}
    {controlled.previewHost && createPortal(chosen ? <Preview constellation={chosen} /> : missing ? <p className="browser-empty" role="status">{missing}</p> : null, controlled.previewHost)}
    <ObjectMenu menu={menu} />
  </div>
}
