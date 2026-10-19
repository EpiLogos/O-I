// The packet (manual §5 "The packet is exactly what the agent will read; you see it whole, and how big it is, before
// anything is sent"; §10.6; world-shell-mockup.html `tileBody('packet')` 1630): the selections prepared for the conversation
// the agent widget holds, as its owner holds them.
//
// The owner is AIKit's prepared context (`aikit.prepared-context/v1`), read through the kernel's encounter op
// (context/nativeContext.ts `nativeContext`, the read the Context plane's PreparedContextView makes), scoped to the
// conversation's session — or to the project when no conversation stands, where nothing receives it yet. The owner
// discloses no token count: the size shown is each selection's own length in characters, named as such.
//
// "Answer this" is the conversation's own Send (encounter/session.ts `send`): it prompts the shared draft with exactly this
// packet (`prompt-context`, the reviewed context). It presses only when the owner takes a prepared context and a question
// stands in the draft; otherwise it says which of those is missing. Nothing here writes the packet.
import {useEffect, useState} from 'react'
import {useWorkspace} from '../shell/workspaceContext'
import {useAgencySessions} from '../agent/useAgencySessions'
import {nativeContext, PREPARED_CONTEXT_CHANGED, type PreparedContext} from '../../../../../desktop/cradle/src/context/nativeContext'
import {useEncounterSession} from '../../../../../desktop/cradle/src/encounter/session'
import {COMPANIONS} from '../shell/modeDockTiles'
import type {WidgetBodyProps, WidgetGlance} from '../frame/widgets/widgets'
import {useGlance} from '../frame/widgets/useGlance'
import {useWidgetReading} from './widgetReading'
import {CONVERSATION_PROJECT, conversationOf} from './agentConversation'

type Held = {key: string; context?: PreparedContext; error?: string}

/** Each prepared selection as a packet row: its title, an excerpt, and its size as the owner holds the text. */
export function packetRows(context: PreparedContext | undefined): {id: string; title: string; excerpt: string; size: string; ref: string}[] {
  return (context?.items ?? []).map(item => {
    const selection = item.selection
    const text = selection.text.replace(/\s+/g, ' ').trim()
    return {id: item.id, title: selection.title, excerpt: text.length > 120 ? `${text.slice(0, 120)}…` : text, ref: selection.source_ref,
      size: selection.anchor.kind === 'text' ? `${selection.text.length}` : 'page'}
  })
}

/** Why Answer this cannot press now, in the owners' words; null when it can. */
export function answerRefusal(input: {companion: string; bound: boolean; reading?: {actions?: {ref: string; enabled: boolean; reason?: string | null}[]} | undefined; draft: string; busy: boolean; items: number}): string | null {
  if (!input.bound) return `No ${input.companion} conversation stands, so nothing receives the packet yet.`
  if (!input.reading) return 'The conversation has not answered its first read yet.'
  const action = (ref: string) => input.reading?.actions?.find(entry => entry.ref === ref)
  const prompt = action('aikit.encounter.prompt')
  if (!prompt?.enabled) return `The conversation takes no prompt now${prompt?.reason ? `: ${prompt.reason}` : '.'}`
  if (!action('aikit.encounter.context')?.enabled) return 'The conversation takes no prepared context (aikit.encounter.context is not enabled), so a Send would go without the packet.'
  if (!input.items) return 'The packet is empty: put a selection in it first.'
  if (input.busy) return 'The conversation is busy with a draft or a Send.'
  if (!input.draft.trim()) return `Write the question in ${input.companion}'s composer: Answer this sends it with exactly this packet.`
  return null
}

export function PacketWidget({subject, glance}: WidgetBodyProps) {
  const reading = useWidgetReading()
  const workspace = useWorkspace()
  const transport = workspace.transport
  const companion = reading ? COMPANIONS[reading.mode].name : 'Agent'
  const agency = useAgencySessions(transport)
  const {track} = conversationOf(agency.tracks, companion, subject)
  const session = track?.sessionRef
  const key = JSON.stringify([transport.kind, CONVERSATION_PROJECT, session ?? null])
  const [held, setHeld] = useState<Held | null>(null)
  const [reread, setReread] = useState(0)
  useEffect(() => {
    let alive = true
    nativeContext(transport, CONVERSATION_PROJECT, session, {operation: 'read'})
      .then(context => { if (alive) setHeld({key, context}) })
      .catch(error => { if (alive) setHeld({key, error: error instanceof Error ? error.message : String(error)}) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key names the scope
  }, [key, reread])
  useEffect(() => {
    // The owner's own announcement of a changed packet (context/nativeContext.ts announceContext), and the window's return.
    const changed = (event: Event) => {
      const detail = (event as CustomEvent<{project?: string; value?: PreparedContext; sourceWorldRef?: string}>).detail
      if (!detail?.value || detail.sourceWorldRef || detail.project !== CONVERSATION_PROJECT || detail.value.scope.agent_session !== (session ?? null)) return
      setHeld({key, context: detail.value})
    }
    const again = () => setReread(count => count + 1)
    window.addEventListener(PREPARED_CONTEXT_CHANGED, changed)
    window.addEventListener('focus', again)
    return () => { window.removeEventListener(PREPARED_CONTEXT_CHANGED, changed); window.removeEventListener('focus', again) }
  }, [key, session])
  const current = held?.key === key ? held : null
  const rows = packetRows(current?.context)
  const encounter = useEncounterSession(track ? {project: CONVERSATION_PROJECT, ref: track.sessionRef, space: track.spaceRef} : undefined)
  const state = encounter?.state
  const refusal = answerRefusal({companion, bound: !!track, reading: state?.reading, draft: state?.draft ?? '', busy: !!state?.busy, items: rows.length})
  useGlance(glance, packetGlance(current?.context))
  return <PacketView companion={companion} scope={session ?? null} context={current?.context} error={current?.error} reading={!current}
    refusal={encounter ? refusal : refusal ?? 'The conversation is not observed.'} send={state?.send} onAnswer={() => void encounter?.actions.send()} />
}

/** The packet as the launcher's miniature: each prepared selection, its size the lead. */
export function packetGlance(context: PreparedContext | undefined): WidgetGlance | null {
  if (!context) return null
  const rows = packetRows(context)
  return {count: rows.length, status: rows.length ? `${rows.length} prepared` : 'empty', lines: rows.map(row => ({lead: row.size, text: `${row.title} — ${row.excerpt}`}))}
}

/** The packet's face over a reading the widget made: rows, the Answer press and the owners' words. Pure presentation. */
export function PacketView({companion, scope, context, error, reading, refusal, send, onAnswer}: {
  companion: string
  /** The session the packet is prepared for; null when it stands for the project. */
  scope: string | null
  context?: PreparedContext
  error?: string
  reading: boolean
  refusal: string | null
  send?: {phase: string; error?: string}
  onAnswer: () => void
}) {
  const rows = packetRows(context)
  return <div className="widget-packet" data-packet={context ? rows.length : 'unread'} data-scope={scope ?? 'project'}>
    {reading && <p className="mode-dock-note">Reading the packet…</p>}
    {error && <p className="mode-dock-note" role="alert">The prepared-context owner refused: {error}</p>}
    {context && rows.length === 0 && <p className="mode-dock-note">The packet is empty. Highlight a passage and put it in the packet; what lands here is exactly what {companion} reads.</p>}
    {rows.length > 0 && <div className="mode-dock-lines" aria-label="Packet">
      {rows.map(row => <div key={row.id} className="mode-dock-line" data-packet-item={row.id} title={`${row.ref}${row.size === 'page' ? ' · an observed page element' : ` · ${row.size} characters of selected text`}`}>
        <span className="mode-dock-line-lead">{row.size}</span>
        <span className="mode-dock-line-text">{row.title} — {row.excerpt}</span>
      </div>)}
    </div>}
    {context && <div className="mode-dock-acts">
      <button type="button" className="mode-dock-act pri" data-action="answer-this" disabled={refusal !== null}
        title={refusal ?? `Send ${companion}'s draft with exactly these ${rows.length} selections.`} onClick={onAnswer}>Answer this</button>
      {rows.length > 0 && <span className="mode-dock-acts-note" title="AIKit's prepared context discloses no token count; the sizes above are characters.">tokens not disclosed</span>}
    </div>}
    {context && refusal && rows.length > 0 && <p className="mode-dock-note" data-answer-refusal>{refusal}</p>}
    {scope === null && context && <p className="mode-dock-note">Prepared for {CONVERSATION_PROJECT}; no conversation receives it until {companion} has one.</p>}
    {send?.phase === 'failed' && <p className="mode-dock-note" role="alert">Not sent: {send.error}</p>}
    {send?.phase === 'checking' && <p className="mode-dock-note" role="status">Checking with the owner whether the Send landed…</p>}
  </div>
}
