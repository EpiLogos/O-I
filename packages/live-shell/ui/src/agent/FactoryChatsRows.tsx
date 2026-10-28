// Factory's Projects category (DLW §19.1 "Projects and chats"): the owner's projects, and under each, once its row is opened, its chats
// — newest first, each with its agent, its state and its last exchange as the owners report them (agent/factoryChatsModel.ts says which
// owner reports which and what stands absent with its reason). A chat is dragged onto an empty track or the rail to be picked up
// again (agent/factoryChatsReopen.ts), or double-clicked to read its thread.
//
// Reads, all through the window's owner readings (owners/ownerReading.ts: one read in flight per key, the last answer drawn at once
// when the rows come back, read again behind it):
//   - the projects: Central's world disclosure (`world_browse`), the same answer the Worlds rows read;
//   - a project's chats: its agency answer (`agency_read`, owners/agency.ts), read when its row is opened — not at mount, not for a
//     closed project;
//   - the first chats' state and last exchange: the owner's encounter view of the session, one after another, reduced to
//     what the row shows before it is held (the transcript is not kept);
//   - their times: the frame's one temporal read, which is already running (timeline/temporalPoll.ts) — no read of its own.
import {useMemo, useState, type DragEvent, type KeyboardEvent} from 'react'
import {KindMark} from '../inhabitants/sdk/marks.tsx'
import {readWorlds, type CentralWorldsReading} from '../central/centralWorlds'
import {DEVICE_PANE_KIND, useIsPublished} from '../frame/devices/deviceDoor'
import {openInstrument} from '../frame/instrumentDoor'
import {useAgencyAnswer} from '../owners/agency'
import {useOwnerReading, useOwnerReadingsOf} from '../owners/ownerReading'
import {useRosterAgents} from '../owners/readers'
import {useSpineEpoch} from '../owners/spine'
import {useTemporalReading} from '../timeline/temporalPoll'
import {useWorkspace} from '../shell/workspaceContext'
import {trackKey} from './agentRunModel'
import {AGENT_CHAIN_MIME} from './agentChainDrag'
import {useAgentSessionsOptional} from './AgentSessionsProvider'
import {useAgentShellOptional} from './AgentShellContext'
import {chainDeviceId} from './devices/agentChainDevices'
import {
  chatKey, chatTrackKey, chatWords, encodeChatDrag, lastActivityOf, projectChatsOf, projectsOfWorlds, setActiveChatDrag, threadOpening,
  type ChatEvent, type ChatGlanceReading, type FactoryChat, type ProjectChats, type Said,
} from './factoryChatsModel'
import {readChatGlance} from './factoryChatsReopen'
import './agentShell.css'

/** How many of a project's chats, from the top of the list, have their view read (one owner process each, one after another). */
export const CHATS_READ = 16

/** The Agent on the session's chain, whose Full is the thread (DLW §19.4 Views: Full "The thread, and beside it the stage"): the Thread is
 * no device of its own since tickets 725 and 772, but the Agent's Thread page, and the chain's ⤢ opens the Agent the same way
 * (devices/FactoryDeviceChain.tsx openAgentThread). */
const AGENT_ID = chainDeviceId('agent')

/** The Worlds rows' key, so the one `world_browse` answer is shared (shell/ModeBrowser.tsx useListing: [family, transport, place]). */
const worldsKey = (transport: unknown): string => JSON.stringify(['world_browse', transport, 'worlds'])
const glanceKey = (transport: unknown, key: string): string => JSON.stringify(['factory_chat_view', transport, key])

const dim = {color: 'var(--text-faint)'} as const
const ellipsis = {overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'} as const

// ---- the chats of one project, as drawn ---------------------------------------------------------------------------------------

export interface ProjectChatsPorts {
  /** A double-click (or Enter) on a chat: read its thread. */
  readonly openThread?: (chat: FactoryChat) => void
  /** What the last act on a chat said (a thread that could not be opened), drawn under the list. */
  readonly said?: string | null
}

const saidText = (said: Said, absent = '—'): string => ('said' in said ? said.said : absent)
const reasonOf = (said: Said): string | undefined => ('absent' in said ? said.absent : undefined)

function ChatCard({chat, glance, events, roster, ports}: {
  chat: FactoryChat
  glance: ChatGlanceReading | undefined
  events: readonly ChatEvent[]
  roster: ReadonlyMap<string, {readonly name: string}>
  ports: ProjectChatsPorts
}) {
  const words = chatWords(chat, {
    glance: glance?.status === 'answered' ? glance.glance : null,
    glanceRefused: glance?.status === 'refused' ? glance.error : null,
    activityUnixMs: lastActivityOf(chat, events),
    roster,
  })
  const open = () => ports.openThread?.(chat)
  return <div className="agent-bitem" role="button" tabIndex={0} draggable data-chat={chatKey(chat)} data-track={chatTrackKey(chat)}
    style={{height: 'auto', flexDirection: 'column', alignItems: 'stretch', gap: 1, padding: '3px 5px 4px 18px'}}
    title={`${words.hover}. Drag it onto an empty track or the rail to pick it up again; double-click it to read its thread.`}
    aria-label={`${words.label}, ${saidText(words.state, 'state not read')}`}
    onDragStart={(event: DragEvent<HTMLElement>) => {
      // The row's own card is the drag image. The empty track accepts the one chain drag type (frame/tracks/SessionGrid.tsx), so the
      // chat's payload rides it; it decodes as no chain item (agent/agentChainDrag.ts), and no chain gesture is held for it.
      event.dataTransfer.effectAllowed = 'copy'
      event.dataTransfer.setData(AGENT_CHAIN_MIME, encodeChatDrag(chat))
      event.dataTransfer.setData('text/plain', words.label)
      setActiveChatDrag(chat)
    }}
    onDragEnd={() => setActiveChatDrag(null)}
    onDoubleClick={open}
    onKeyDown={(event: KeyboardEvent<HTMLElement>) => { if (event.key === 'Enter') { event.preventDefault(); open() } }}>
    <span style={{display: 'flex', alignItems: 'center', gap: 6}}>
      <span aria-hidden="true"><KindMark kind="agent" size={12} /></span>
      <span style={ellipsis}>{words.label}</span>
      <span className="st" data-absent={'absent' in words.state ? 'state' : undefined} title={reasonOf(words.state)}>{saidText(words.state)}</span>
    </span>
    <span style={{display: 'flex', gap: 6, fontSize: 10, ...dim}}>
      <span data-absent={'absent' in words.agent ? 'agent' : undefined} title={reasonOf(words.agent)} style={{flex: 'none'}}>{'said' in words.agent ? words.agent.said : 'agent —'}</span>
      <span data-absent={'absent' in words.exchange ? 'exchange' : undefined} title={reasonOf(words.exchange)} style={ellipsis}>{saidText(words.exchange, glance?.status === 'refused' ? 'view refused' : 'last exchange —')}</span>
    </span>
  </div>
}

/** One project's chats as its discovery answered them: the owner's words when it refused, the cards when it listed. Pure over its
 * props (the reader below holds the owner answers). */
export function ProjectChats({project, chats, glances, roster, events, needle, ports}: {
  project: string
  chats: ProjectChats
  glances: ReadonlyMap<string, ChatGlanceReading>
  roster: ReadonlyMap<string, {readonly name: string}>
  events: readonly ChatEvent[]
  needle: string
  ports: ProjectChatsPorts
}) {
  if (chats.state === 'reading') return <p className="native-empty" role="status">Reading the chats of {project}…</p>
  if (chats.state === 'refused') return <p className="native-error" role="alert" data-project-refused={project}>{chats.words}</p>
  const query = needle.trim().toLocaleLowerCase()
  const shown = chats.chats.filter(chat => {
    if (!query) return true
    const words = chatWords(chat, {glance: null, activityUnixMs: null, roster})
    return `${words.label} ${saidText(words.agent, '')} ${chat.spaceLabel ?? ''}`.toLocaleLowerCase().includes(query)
  })
  const beyond = chats.chats.length - CHATS_READ
  return <div role="group" aria-label={`Chats of ${project}`}>
    {!chats.chats.length && <p className="native-empty" style={{paddingLeft: 18}}>No chat: the discovery names no session space for {project}.</p>}
    {!!chats.chats.length && !shown.length && <p className="native-empty" style={{paddingLeft: 18}}>No chat of {project} matches this search.</p>}
    {shown.map(chat => <ChatCard key={chatKey(chat)} chat={chat} glance={glances.get(chatKey(chat))} events={events} roster={roster} ports={ports} />)}
    {beyond > 0 && <p className="native-empty" style={{paddingLeft: 18}}>The state and last exchange are read for the first {CHATS_READ} chats listed; {beyond} more {beyond === 1 ? 'stands' : 'stand'} unread.</p>}
    {ports.said && <p className="native-error" role="status" style={{paddingLeft: 18}}>{ports.said}</p>}
  </div>
}

// ---- reading one project -----------------------------------------------------------------------------------------------------

/** A project's opened row: its agency answer, its chats' views, their times, and the thread a double-click opens. Mounted only
 * while the row is open, so a closed project asks no owner anything. */
function ProjectReader({project, needle}: {project: string; needle: string}) {
  const {transport} = useWorkspace()
  const epoch = useSpineEpoch()
  const agency = useAgencyAnswer(transport, project).reading
  const temporal = useTemporalReading(transport).reading
  const events = temporal.status === 'ready' ? temporal.events : NO_EVENTS
  const chats = useMemo(() => projectChatsOf(project, agency, events), [project, agency, events])
  const listed = chats.state === 'read' ? chats.chats : NO_CHATS
  // The newest chats' views, one owner read after another; each held reduced to what its row shows.
  const read = useMemo(() => listed.slice(0, CHATS_READ), [listed])
  const byKey = useMemo(() => new Map(read.map(chat => [chatKey(chat), chat])), [read])
  const glances = useOwnerReadingsOf<ChatGlanceReading>(read.map(chatKey), key => glanceKey(transport, key), key => async () => {
    const chat = byKey.get(key)
    if (!chat) return {error: 'The chat is no longer listed.'}
    try { return {value: {status: 'answered', glance: await readChatGlance(transport, chat)}} } catch (cause) {
      return {value: {status: 'refused', error: cause instanceof Error ? cause.message : String(cause)}}
    }
  }, epoch)
  // The roster names an agent the discovery names; with none named it is not read for this project.
  const named = listed.some(chat => chat.agentRef)
  const roster = useRosterAgents(transport, project, named)
  const names = useMemo(() => new Map(roster.agents.map(agent => [agent.ref, {name: agent.name}])), [roster.agents])
  const [said, setSaid] = useState<string | null>(null)
  const shell = useAgentShellOptional()
  const sessions = useAgentSessionsOptional()
  const agentOnChain = useIsPublished(AGENT_ID)
  const trackKeys = useMemo(() => sessions ? new Set(sessions.tracks.filter(track => !track.group).map(trackKey)) : null, [sessions])
  const ports: ProjectChatsPorts = {
    said,
    openThread: chat => {
      const opening = threadOpening(chat, shell ? trackKeys : null, agentOnChain)
      if (opening.kind === 'refused') { setSaid(opening.words); return }
      setSaid(null)
      // The Sessions rows' own path: THE selection moves to the session and the shell's thread view follows it; with the Agent on the
      // chain, the Agent opens full in a pane as well, its Full the selected session's thread (ticket 788: was the retired Thread device).
      shell?.setSelectedTrackId(opening.trackKey, opening.label)
      shell?.openThread(opening.trackKey)
      if (opening.pane) {
        try { openInstrument(DEVICE_PANE_KIND, undefined, {ref: AGENT_ID, title: opening.label}) } catch (cause) { setSaid(cause instanceof Error ? cause.message : String(cause)) }
      }
    },
  }
  return <ProjectChats project={project} chats={chats} glances={glances} roster={names} events={events} needle={needle} ports={ports} />
}

const NO_EVENTS: readonly ChatEvent[] = []
const NO_CHATS: readonly FactoryChat[] = []

/** One project's row, and its chats under it while it is open. */
export function ProjectRow({project, open, onToggle, needle}: {project: string; open: boolean; onToggle: () => void; needle: string}) {
  return <div data-project={project}>
    <button type="button" className="agent-bitem" aria-expanded={open} onClick={onToggle} style={{cursor: 'pointer'}}
      title={`${project} — ${open ? 'close it' : 'open it to read its chats from AIKit\'s session-space discovery'}.`}>
      <span aria-hidden="true" style={{width: 8, flex: 'none'}}>{open ? '▾' : '▸'}</span>
      <span style={ellipsis}>{project}</span>
    </button>
    {open && <ProjectReader project={project} needle={needle} />}
  </div>
}

// ---- the category ------------------------------------------------------------------------------------------------------------

/** The Projects category: the owner's projects, each opened to read its chats. */
export function FactoryChatsRows({needle}: {needle: string}) {
  const {transport} = useWorkspace()
  const epoch = useSpineEpoch()
  const unreached = transport.kind === 'unavailable' ? transport.reason : null
  const worlds = useOwnerReading<CentralWorldsReading>(unreached ? null : worldsKey(transport), async () => {
    try { return {value: await readWorlds(transport)} } catch (cause) { return {error: cause instanceof Error ? cause.message : String(cause)} }
  }, epoch).reading
  const [opened, setOpened] = useState<readonly string[]>([])
  const list = unreached
    ? ({state: 'unavailable', words: `The kernel carrier is unavailable, so Central's projects are not listed: ${unreached}`} as const)
    : worlds.status === 'refused' ? ({state: 'unavailable', words: worlds.error ?? 'Central did not disclose its worlds'} as const)
      : projectsOfWorlds(worlds.status === 'answered' ? worlds.value : null)
  const query = needle.trim().toLocaleLowerCase()
  return <div data-factory-projects>
    <div className="agent-bhead"><span>Project · chats</span><span>State</span></div>
    {list.state === 'reading' && <p className="native-empty" role="status">Reading Central's projects…</p>}
    {list.state === 'unavailable' && <p className="native-error" role="alert">{list.words}</p>}
    {list.state === 'read' && !list.projects.length && <p className="native-empty">Central discloses no project.</p>}
    {list.state === 'read' && list.projects
      .filter(project => !query || opened.includes(project) || project.toLocaleLowerCase().includes(query))
      .map(project => <ProjectRow key={project} project={project} open={opened.includes(project)} needle={needle}
        onToggle={() => setOpened(current => current.includes(project) ? current.filter(item => item !== project) : [...current, project])} />)}
  </div>
}
