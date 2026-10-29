// The search line (DLW §18.4 "The line anywhere"; O-I #820): the line ⌘K opens over the frame and @ opens in a Flow entry or the agent's
// composer. "It is one line, with the same language, the same settings and the same results; where it opens only decides where a result
// goes. Esc closes it and you are where you were." Loaded when it first opens (SearchLineHost.tsx); its door is searchLineDoor.ts, its
// reading of the owners' answers searchLineModel.ts.
//
// Every part is an owner's, reached through a path the shell already has:
//   - the search is the Search pane's (central/devices/agentChainDevices.ts useSearchDevice over searchBinding.ts): the line writes
//     Search's own held query, so AIKit's knowledge search and resolve, Central's search of Control and Quaternal Logic's Vāk reads answer
//     it, in Search's held reach and kinds; a Search pane that stands follows what the line asks;
//   - nothing typed asks AIKit's own zero-query search (the same `knowledge` op) and keeps what it counted you opening;
//   - opening a result goes through the Graph and source receiver (panels/knowledge.tsx, `oi:epi-open-knowledge`, as the Workbench
//     opens one: native/Workbench.tsx:332-343), a page of a world through the page link route (CentralDocumentPane.tsx openPageLink),
//     a Vāk entry in Search's own pane among its neighbours (searchPane.tsx openSearchPane); each open is then counted by AIKit
//     (`knowledge` use, `aikit knowledge route`, as the cradle's frame counts one: desktop/cradle/src/CradleFrame.tsx:832-834);
//   - a Flow takes a passage through Central's Flow append (central/devices/centralDeviceWrites.ts appendFlowEntry, the Flow's own
//     revision-checked write), as html whose last line links back to the page it came from (searchLineModel.ts flowEntryHtml); an
//     agent is started on it through its session's encounter (encounter/session.ts useEncounterSession: change, then send —
//     central/devices/CentralDevices.tsx answerSend); a person, a place and another document through their own owners
//     (central/searchLineSends.ts: the Shared Field's message, Central's file-passage, the page owner's append_quote);
//   - `>` runs the menu bar's own acts: an Edit or Create act on the selection of the view that stands (frame/menu/commandDoor.ts
//     runObjectCommand), the rest through the frame's `oi:command` router (App.tsx, published through searchLineDoor.ts);
//   - the history is AIKit's (§18.4 "Each item shows how often and how lately you opened it. Press ✕ beside it and the line forgets it.
//     Turn History off and the line never ranks by use."): how often is its count of the line's opens and sends in the world asked
//     (searchBinding.ts usedOf: its routes and plain uses), how lately its own receipts (`knowledge history`, searchLineModel.ts
//     latelyOf), ✕ its forget of that one item in that world (`aikit knowledge forget here`, through the kernel's aikit_write in the
//     world's ground), and History Off — Search's own setting — counts nothing and ranks by the provider's match alone.
import {useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent} from 'react'
import {detectTransport} from '../../../../../desktop/cradle/src/kernel/bridge'
import {knowledge} from '../../../../../desktop/cradle/src/knowledge/client'
import {listFlowInstances, type FlowInstanceRow} from '../../../../../desktop/cradle/src/flow/flowsDir'
import {useEncounterSession} from '../../../../../desktop/cradle/src/encounter/session'
import type {KnowledgeHit, KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import {useAgencySessions} from '../agent/useAgencySessions'
import {sessionOfAgent} from '../widgets/agentConversation'
import {runObjectCommand} from '../frame/menu/commandDoor'
import {linkTarget} from '../inhabitants/DocumentPageFace'
import {marksOf} from '../inhabitants/catalogue/panels/central__search'
import {SEARCH_DEVICE_ID, useSearchDevice} from './devices/agentChainDevices'
import {heldOf, setHeld} from './devices/pageBindings'
import {aikitWriteOp, ownerRouteWrite} from '../agent/devices/ownerRoutes'
import {searchProjectOf, searchResultsOf} from './devices/searchBinding'
import {openPageLink} from './documents/CentralDocumentPane'
import {openSearchPane} from './searchPane'
import {closeSearchLine, menuCommands, showLineReceipt, type LinePassage, type LineRequest} from './searchLineDoor'
import {actsOf, agentTurnText, documentPathOf, flowEntryHtml, flowEntryText, flowOf, forgetRequestOf, groupsOf, historyOn, jumpOrder, latelyOf, lineModeOf, lineResultsOf,
  pathOf, placeWorldOf, sendPlanOf, unranked, usedWords, type AgentSessionFact, type LineAct, type LineResult, type SendFacts, type SendPlan} from './searchLineModel'
import './searchLine.css'

/** Results shown: the manual's default (§18.4 Parameters, "Results shown 5 to 30, 12"); no owner holds the setting yet. */
const SHOWN = 12
/** The typing settles this long before the held search changes (each change asks AIKit again). */
const SETTLE_MS = 220
/** How long the Graph and source receiver has to acknowledge an open before the line says it did not. */
const OPEN_DEADLINE_MS = 10_000

type Item = {readonly key: string; readonly act: LineAct} | {readonly key: string; readonly result: LineResult; readonly group?: string}
const message = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause))
const size = (passage: LinePassage) => `${passage.text.length} character${passage.text.length === 1 ? '' : 's'}`

/** Open a result through the Graph and source receiver, as the Workbench does (native/Workbench.tsx:332-343): a wiki address as its
 * graph, a source as its page; resolves when the receiver acknowledges, rejects with its refusal. */
function openKnowledge(result: LineResult, project: string | undefined): Promise<void> {
  const address = result.address!
  return new Promise<void>((resolve, reject) => {
    let settled = false
    const complete = (reason?: string) => { if (settled) return; settled = true; window.clearTimeout(deadline); if (reason) reject(new Error(reason)); else resolve() }
    const deadline = window.setTimeout(() => complete('The Graph and source receiver (panels/knowledge.tsx) did not acknowledge this open.'), OPEN_DEADLINE_MS)
    window.dispatchEvent(new CustomEvent('oi:epi-open-knowledge', {detail: {title: result.title, ...(project ? {project} : {}), address,
      plane: address.kind === 'wiki' ? 'graph' : 'page', complete}}))
  })
}

/** What AIKit counts: an open or a send the line made (`knowledge` use → `aikit knowledge route`, one familiarity observation). Its refusal
 * is said once the line has closed. History Off (`remember` false): nothing is counted. */
function countUse(transport: KernelTransportStatus, project: string | undefined, result: LineResult, what: string, remember: boolean): void {
  if (!remember) return
  if (!result.address) return
  void knowledge(transport, project, {action: 'use', address: result.address}).catch(cause =>
    showLineReceipt({ok: false, what, text: `AIKit did not count it, so the jump will not rank it: ${message(cause)}`}))
}

/** What you opened, as AIKit counts it: its own zero-query search, the destinations it observed you opening. Asked again when `again`
 * moves (a ✕ forgot one). */
function useOpened(transport: KernelTransportStatus, asked: boolean, project: string | undefined, again: number): {results: LineResult[]} | {error: string} | null {
  const [opened, setOpened] = useState<{at: number; value: {results: LineResult[]} | {error: string}} | null>(null)
  useEffect(() => {
    if (!asked || opened?.at === again) return
    let live = true
    knowledge<{hits?: KnowledgeHit[]}>(transport, project, {action: 'search', query: ''}).then(
      data => { if (live) setOpened({at: again, value: {results: lineResultsOf(JSON.stringify(searchResultsOf({query: '', hits: data?.hits ?? [], rows: [], pending: []}))).filter(result => (result.used ?? 0) > 0)}}) },
      cause => { if (live) setOpened({at: again, value: {error: message(cause)}}) })
    return () => { live = false }
  }, [asked, opened, transport, project, again])
  return opened?.value ?? null
}

/** How lately each result was opened from the line: AIKit's own receipts (`knowledge history`, newest first, in the world asked). Not
 * asked with History Off; asked again when `again` moves. An unanswered history shows how often only. */
function useLately(transport: KernelTransportStatus, asked: boolean, project: string | undefined, again: number): ReadonlyMap<string, number> {
  const [lately, setLately] = useState<ReadonlyMap<string, number>>(new Map())
  useEffect(() => {
    if (!asked) return
    let live = true
    knowledge<unknown>(transport, project, {action: 'history'}).then(data => { if (live) setLately(latelyOf(data)) }, () => { if (live) setLately(new Map()) })
    return () => { live = false }
  }, [asked, transport, project, again])
  return lately
}

/** Where the line stands: at the caret it was asked from (below it, or above it near the window's foot), else over the frame. */
function placeOf(at: LineRequest['at']): CSSProperties {
  if (!at || typeof window === 'undefined') return {}
  const width = Math.min(560, window.innerWidth - 16)
  const left = Math.max(8, Math.min(at.x, window.innerWidth - width - 8))
  return at.y > window.innerHeight * 0.55 ? {left, width, bottom: Math.max(8, window.innerHeight - at.y + 6), top: 'auto', transform: 'none'}
    : {left, width, top: Math.max(8, at.y + 6), transform: 'none'}
}

export function SearchLine({request}: {request: LineRequest}) {
  const transport = useMemo(() => detectTransport(), [])
  const [typed, setTyped] = useState('')
  const [index, setIndex] = useState(0)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const query = typed.trim()
  const mode = lineModeOf(typed)
  const marks = useMemo(() => (mode === 'acts' ? [] : marksOf(query)), [mode, query])

  // The search is Search's own: the held search line, written once the typing settles.
  useEffect(() => {
    if (mode !== 'jump' && mode !== 'search') return
    if (heldOf(SEARCH_DEVICE_ID).query === query) return
    const timer = window.setTimeout(() => setHeld(SEARCH_DEVICE_ID, 'query', query), SETTLE_MS)
    return () => window.clearTimeout(timer)
  }, [mode, query])
  const search = useSearchDevice(transport, null)
  const held = heldOf(SEARCH_DEVICE_ID)
  const project = searchProjectOf(SEARCH_DEVICE_ID)
  const asking = mode === 'jump' || mode === 'search'
  const answered = asking && search.values.query === query && typeof search.values.results === 'string'
  const owned = useMemo(() => (answered ? lineResultsOf(search.values.results as string) : []), [answered, search.values.results])
  const refused = asking && search.values.query === query ? search.standing?.query?.refused : undefined
  const kindOn = (group: string) => held[`k:${group}`] !== false
  // History: Remember counts each open and send and ranks the jump by it; Off counts nothing and ranks by the match alone.
  const remember = historyOn(held)
  const [again, setAgain] = useState(0)
  const opened = useOpened(transport, mode === 'opened' && remember, project, again)
  const lately = useLately(transport, remember, project, again)
  /** The owner's results as the line shows them: with History, how lately beside how often; without, as the provider ranks them. */
  const shown = useMemo(() => (remember ? owned.map(result => (lately.has(result.ref) ? {...result, lately: lately.get(result.ref)} : result)) : unranked(owned)),
    [remember, owned, lately])
  const enterOpens = held.enter === 'open'
  const passage = request.passage ?? null

  // The owner's Flows (Central's listing): a result is a Flow a tag can add to only when the owner lists it.
  const [flows, setFlows] = useState<readonly FlowInstanceRow[] | null>(null)
  useEffect(() => {
    let live = true
    listFlowInstances(transport).then(rows => { if (live) setFlows(rows) }, () => { if (live) setFlows([]) })
    return () => { live = false }
  }, [transport])
  const agency = useAgencySessions(transport)

  const items: Item[] = useMemo(() => {
    if (mode === 'acts') return actsOf(typed).map(act => ({key: act.id, act}))
    if (mode === 'opened') return remember && opened && 'results' in opened ? opened.results.filter(r => kindOn(r.group)).slice(0, SHOWN)
      .map(result => ({key: result.ref, result: lately.has(result.ref) ? {...result, lately: lately.get(result.ref)} : result})) : []
    if (mode === 'jump') return (remember ? jumpOrder(shown.filter(r => kindOn(r.group))) : shown.filter(r => kindOn(r.group))).slice(0, SHOWN).map(result => ({key: result.ref, result}))
    return groupsOf(shown, kindOn).flatMap(group => group.results.map(result => ({key: result.ref, result, group: group.name}))).slice(0, SHOWN)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the kinds are Search's holds, read with the results
  }, [mode, typed, opened, shown, held, remember, lately])
  useEffect(() => { setIndex(0); setProblem(null) }, [typed])
  const at = Math.min(index, Math.max(0, items.length - 1))
  const chosen = items[at]
  const chosenResult = chosen && 'result' in chosen ? chosen.result : null

  // The agent a tag would start: its own session in the agency reading, observed while it is the one chosen.
  const agentTrack = chosenResult?.group === 'agent' ? sessionOfAgent(agency.tracks, chosenResult.ref) : null
  const encounter = useEncounterSession(agentTrack ? {project: agentTrack.project ?? '', ref: agentTrack.sessionRef, space: agentTrack.spaceRef} : undefined)
  const factsOf = (result: LineResult): SendFacts => {
    const track = result.group === 'agent' ? sessionOfAgent(agency.tracks, result.ref) : null
    const agent: AgentSessionFact | null | undefined = result.group !== 'agent' ? undefined : track
      ? {sessionRef: track.sessionRef, project: track.project ?? '', name: track.agentName ?? result.title, space: track.spaceRef} : agency.loading ? undefined : null
    return {flow: flows === null ? undefined : flowOf(result, flows), ...(result.group === 'agent' ? {agent} : {})}
  }
  const planOf = (result: LineResult): SendPlan => sendPlanOf(result, enterOpens ? null : passage, factsOf(result))
  const plan = chosenResult ? planOf(chosenResult) : null

  // A click elsewhere closes the line and leaves the focus where the click put it.
  useEffect(() => {
    const away = (event: PointerEvent) => { if (box.current && event.target instanceof Node && !box.current.contains(event.target)) closeSearchLine({restore: false}) }
    document.addEventListener('pointerdown', away, true)
    return () => document.removeEventListener('pointerdown', away, true)
  }, [])

  const open = async (result: LineResult) => {
    setProblem(null)
    const path = pathOf(result)
    try {
      if (result.group === 'vak') {
        // The entry among its neighbours: Search's own pane on the search that found it.
        closeSearchLine({restore: false})
        openSearchPane(query)
        return
      }
      setBusy(`Opening ${result.title}…`)
      if (path && linkTarget(path).kind === 'page') await openPageLink(transport, {kind: 'page', path})
      else if (result.address) await openKnowledge(result, project)
      else { setProblem(`${result.title}: the owner gave no address to open it by.`); return }
      closeSearchLine({restore: false})
      countUse(transport, project, result, `Opened ${result.title}`, remember)
    } catch (cause) {
      setProblem(`${result.title} did not open: ${message(cause)}`)
    } finally { setBusy(null) }
  }

  const send = async (result: LineResult, sending: Extract<SendPlan, {verb: 'send'}>) => {
    if (!passage) return
    setProblem(null)
    try {
      if (sending.target === 'flow') {
        const location = flows ? flowOf(result, flows) : null
        if (!location) { setProblem(`${result.title}: the owner no longer lists this Flow.`); return }
        setBusy(`Adding to ${result.title}…`)
        const {appendFlowEntry} = await import('./devices/centralDeviceWrites')
        const answer = await appendFlowEntry(transport, location, {text: flowEntryText(passage), html: flowEntryHtml(passage), relation: null})
        closeSearchLine()
        showLineReceipt({ok: true, what: `Sent to ${result.title}`, text: `${size(passage)} from ${passage.from}, added as a new entry${answer.revision ? ` (revision ${answer.revision})` : ''}.`})
      } else if (sending.target === 'person') {
        setBusy(`Sending to ${result.title}…`)
        const {messagePerson} = await import('./searchLineSends')
        const answer = await messagePerson(transport, result.ref, passage)
        closeSearchLine()
        showLineReceipt({ok: true, what: `Sent to ${result.title}`, text: `${size(passage)} from ${passage.from}, as a request ${result.title} accepts before reading it (${answer.state}).`})
      } else if (sending.target === 'place') {
        const world = placeWorldOf(result)
        if (!world) { setProblem(`${result.title}: the owner names no world for this place.`); return }
        setBusy(`Filing on ${result.title}…`)
        const {filePassage} = await import('./searchLineSends')
        const answer = await filePassage(transport, world, passage)
        closeSearchLine()
        showLineReceipt({ok: true, what: `Filed on ${result.title}`, text: `${size(passage)} from ${passage.from}${answer.outcome === 'unchanged' ? ' stood there already' : ', with a link back'}${answer.path ? ` (${answer.path})` : ''}. It stays unrecognised until you recognise it.`})
      } else if (sending.target === 'quote') {
        const path = documentPathOf(result)
        if (!path) { setProblem(`${result.title}: the owner names no path for this document.`); return }
        setBusy(`Quoting in ${result.title}…`)
        const {quoteAtEnd} = await import('./searchLineSends')
        const answer = await quoteAtEnd(transport, path, passage)
        closeSearchLine()
        showLineReceipt({ok: true, what: `Quoted in ${result.title}`, text: `${size(passage)} from ${passage.from}, at the end with a link back${answer.revision ? ` (revision ${answer.revision})` : ''}.`})
      } else {
        if (!encounter) { setProblem(`Reading ${agentTrack?.agentName ?? result.title}'s conversation…`); return }
        setBusy(`Starting ${agentTrack?.agentName ?? result.title}…`)
        encounter.actions.change(agentTurnText(passage))
        await encounter.actions.send()
        closeSearchLine()
        showLineReceipt({ok: true, what: `Started ${agentTrack?.agentName ?? result.title}`, text: `on ${size(passage)} from ${passage.from}.`})
      }
      countUse(transport, project, result, `Sent to ${result.title}`, remember)
    } catch (cause) {
      setProblem(`${result.title} did not take the passage: ${message(cause)}`)
    } finally { setBusy(null) }
  }

  /** ✕: AIKit forgets this item in the world the line stands in; the line and Search then ask AIKit again, and it shows as it now counts. */
  const forget = async (result: LineResult) => {
    if (busy) return
    setProblem(null)
    setBusy(`Forgetting ${result.title}…`)
    try {
      await ownerRouteWrite(transport, aikitWriteOp(forgetRequestOf(result, project)), '`aikit knowledge forget here`')
      setAgain(n => n + 1)
      setHeld(SEARCH_DEVICE_ID, 'again', Date.now())
    } catch {
      setProblem(`AIKit did not forget ${result.title}, so the line still ranks it by use.`)
    } finally { setBusy(null) }
  }

  const runAct = (act: LineAct) => {
    // The act runs on what you had selected: the line closes and puts the focus back first.
    closeSearchLine()
    if (act.object) {
      if (!runObjectCommand(act.object)) showLineReceipt({ok: false, what: act.label, text: `Nothing selected in the view that stands takes ${act.label}.`})
      return
    }
    const run = menuCommands()
    if (!run) { showLineReceipt({ok: false, what: act.label, text: 'This window has published no menu bar commands to run it.'}); return }
    run(act.id)
  }

  const enter = (shift: boolean) => {
    if (!chosen || busy) return
    if ('act' in chosen) { runAct(chosen.act); return }
    const result = chosen.result
    const chosenPlan = planOf(result)
    if (shift || chosenPlan.verb === 'open') { void open(result); return }
    if (chosenPlan.verb === 'dim') { setProblem(chosenPlan.why); return }
    void send(result, chosenPlan)
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeSearchLine(); return }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (items.length) setIndex((at + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length)
      return
    }
    if (event.key === 'Enter') { event.preventDefault(); enter(event.shiftKey) }
  }

  const status = busy ? busy
    : mode === 'acts' ? (items.length ? `${items.length} act${items.length === 1 ? '' : 's'} of the menu bar · Enter runs it on what you selected` : 'No act of the menu bar is named so.')
    : mode === 'opened' && !remember ? 'History is off: the line counts nothing you open or send to, and ranks nothing by use. Type to jump to the best match, add a mark to search, or > for acts.'
    : mode === 'opened' ? (!opened ? 'Asking AIKit what you opened…' : 'error' in opened ? `AIKit did not answer: ${opened.error}`
      : items.length ? 'What you opened, as AIKit counts it · type to jump, a mark searches, > offers acts'
      : 'Nothing counted yet: AIKit counts each result you open or send to from here, and the count ranks the jump. Type to jump, add a mark (@, @0–@5, @#, +, -, a kind:) to search, or > for acts.')
    : refused && !owned.length ? `AIKit refused the search: ${refused}`
    : !answered ? 'AIKit is answering…'
    : `${items.length}${owned.length > items.length ? ` of ${owned.length}` : ''} · ${mode === 'jump' ? (remember ? 'a jump: what you open most first' : 'a jump: the best match first (History is off)') : 'a search: in groups by kind'}`

  const resultRow = (item: Extract<Item, {result: LineResult}>, i: number) => {
    const result = item.result
    const rowPlan = passage && !enterOpens ? planOf(result) : null
    const dim = rowPlan?.verb === 'dim'
    return <li key={item.key} id={`search-line-${i}`} role="option" aria-selected={i === at} data-chosen={i === at || undefined} data-dim={dim || undefined}
      data-i={`${result.title}|${dim ? rowPlan.why : `${result.owner ? `${result.owner}. ` : ''}${result.says ?? result.ref}`}`}
      onPointerMove={() => { if (i !== at) setIndex(i) }} onClick={event => { setIndex(i); enter(event.shiftKey) }}>
      <span className="search-line-title">{result.title}</span>
      <span className="search-line-says">{result.says ?? result.ref}</span>
      {result.used ? <span className="search-line-used" title={`AIKit counted ${result.used} open${result.used === 1 ? '' : 's'} in this world${result.lately === undefined ? '' : `, the last ${new Date(result.lately).toLocaleString('en-GB')}`}`}>{usedWords(result)}</span> : null}
      {result.used && remember ? <button type="button" className="search-line-forget" aria-label={`Forget ${result.title}`} disabled={!!busy}
        data-i={`Forget ${result.title}|The line forgets it in this world: AIKit stops ranking it by your use here. It stays findable.`}
        onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); void forget(result) }}>✕</button> : null}
    </li>
  }

  let lastGroup: string | undefined
  // Esc closes the line wherever the focus stands inside it (a result pressed with the pointer holds the focus, not the line's input).
  return <div ref={box} className="search-line" role="dialog" aria-modal="true" aria-label="Search line" data-door={request.door} data-mode={mode} style={placeOf(request.at)}
    onKeyDown={event => { if (event.key === 'Escape' && event.target === event.currentTarget) { event.preventDefault(); closeSearchLine() } }} tabIndex={-1}>
    <div className="search-line-query">
      <span className="search-line-door" aria-hidden="true">{request.door === 'frame' ? '⌘K' : '@'}</span>
      <input autoFocus spellCheck={false} autoComplete="off" value={typed} readOnly={!!busy} onChange={event => setTyped(event.target.value)} onKeyDown={onKeyDown}
        aria-label="Search line: words jump, a mark searches, > offers acts" aria-controls="search-line-results" aria-activedescendant={items.length ? `search-line-${at}` : undefined}
        placeholder={request.door === 'frame' ? 'Jump to what you open most, @ to search, > for acts' : 'A name to jump to, or a mark to search'} />
    </div>
    {marks.length > 0 && <div className="search-line-chips" aria-label="What the line read">{marks.map((mark, i) => <span key={i} className="search-line-chip" data-mark={mark.mark} title={mark.mark}>{mark.text}</span>)}</div>}
    {passage && <p className="search-line-send" data-plan={plan?.verb ?? 'none'} data-i={`What is sent|${plan ? (plan.verb === 'dim' ? plan.why : plan.words) : `${size(passage)} from ${passage.from}`}`}>
      <q>{passage.text.length > 80 ? `${passage.text.slice(0, 79)}…` : passage.text}</q>
      <span>{!plan ? `${size(passage)} from ${passage.from}. Choose where it goes.` : plan.verb === 'dim' ? plan.why : enterOpens && plan.verb === 'open' ? `${plan.words} (On Enter is Open.)` : plan.words}</span>
    </p>}
    <ul id="search-line-results" className="search-line-results" role="listbox" aria-label={mode === 'acts' ? 'Acts' : 'Results'}>
      {items.map((item, i) => {
        if ('act' in item) return <li key={item.key} id={`search-line-${i}`} role="option" aria-selected={i === at} data-chosen={i === at || undefined}
          data-i={`${item.act.label}|${item.act.object ? `Runs ${item.act.label} on what is selected in the view that stands.` : 'The menu bar\'s own act.'}`}
          onPointerMove={() => { if (i !== at) setIndex(i) }} onClick={() => { setIndex(i); enter(false) }}>
          <span className="search-line-title">{item.act.label}</span><kbd className="search-line-key">{item.act.key}</kbd>
        </li>
        const heading = item.group && item.group !== lastGroup ? item.group : undefined
        lastGroup = item.group
        return [heading ? <li key={`g:${heading}`} className="search-line-group" role="presentation">{heading}</li> : null, resultRow(item, i)]
      })}
    </ul>
    {problem && <p className="search-line-problem" role="alert">{problem}</p>}
    <p className="search-line-status" role="status">{status}<span className="search-line-keys">↑↓ choose · ↵ {mode === 'acts' ? 'run' : passage && !enterOpens ? 'send · ⇧↵ open' : 'open'} · esc</span></p>
  </div>
}
