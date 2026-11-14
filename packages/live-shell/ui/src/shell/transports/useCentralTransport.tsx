// Central's bindings of the one transport (FOUNDATION F7; manual §10.5, the Central column). Each slot shows an owner's
// reading, and the one slot with a write path presses through it; every other slot stays drawn with its meaning and waits.
// The readers are the ones the Central surfaces already make, ported, never recreated:
//  - the Day, its die and its bounds: Central's ground reading (`central` inspect), as the World Model's day slice holds it — the one
//    answer the window holds (central/devices/useCentralReadings.ts useCentralGroundAnswer — the Day device reads the same slice, so the
//    ground is read once): today's Day reading (its native
//    document's open face, the record's opening) and the civil-time policy (its day boundary and timezone);
//  - the die's turn (Tempo ‹ ›): the die's own write route, central/devices/centralDeviceWrites.ts:42 `turnDieFace`;
//  - the packet's size and scope (Key, Scale): AIKit's prepared context as the World Model's packet slice holds it (the read the chain's
//    Packet makes, agentChainDevices.ts packetFromModel; O-I ticket 1005), for the conversation the Packet holds (agentConversation.ts
//    `conversationOf`, THE selection or Fizz's own session);
//  - the machine serving the ground (Rate): the host's configuration (ShellConfigContext, native/application.ts ShellConfig);
//  - Autosave and Save timing (Metronome, Quantize; §17.8): the one autosave setting for Central's pages (central/documents/autosave.ts),
//    which the slots turn, as the Document's Autosave does — each page then saves through its own Save.
//  - the core (world-shell.md §9.3; O-I ticket 1005): Play sends what the packet's conversation holds, with the packet, through that
//    conversation's one shared session (encounter/session.ts `encounterSessionOf(...).ask`, the send the Packet's Send and the Flow make),
//    and keeps the answer per Arm — the shell's one write arm (AgentShellContext `writeArm`): on, in the page the hand reached as the agent's
//    entry with its sources (centralDeviceWrites.ts keepAgentAnswer), a new entry or the replacement Overdub names; off, a proposal for that
//    page, nothing written: Central's source Return, which Approvals accepts or refuses (proposeAgentAnswer; a page of a project). Stop cancels
//    the turn Play sent. Capture stands refused with why; Load is the Save state slot.
// The Day is the kernel's to keep current (its watch, its own writes, the Day's turn) — never polled.
import {useContext, useState} from 'react'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {keepAgentAnswer, proposeAgentAnswer, turnDieFace, type AnswerTake} from '../../central/devices/centralDeviceWrites'
import {encounterSessionOf} from '../../../../../../desktop/cradle/src/encounter/session'
import {useAgentShellOptional} from '../../agent/AgentShellContext'
import {dieFaceLabel} from '../../central/devices/dayDie'
import {useCentralGroundAnswer} from '../../central/devices/useCentralReadings'
import {packetFromModel} from '../../central/devices/agentChainDevices'
import {useModelSlice} from '../../owners/model'
import {useOptionalContinuity} from '../../continuity/workspace'
import {useAgencySessions} from '../../agent/useAgencySessions'
import {conversationOf} from '../../widgets/agentConversation'
import {ROOT_REGISTER} from '../../agent/worldScope'
import {COMPANIONS} from '../ModeContextDock'
import {ShellConfigContext} from '../useSet'
import {Workspace} from '../workspaceContext'
import type {UseModeTransport} from '../modeTransports'
import {centralBindings, dayDieOf} from './transportReadings'
import {turnDay, useDayInPane, useReachedDocument} from '../../central/documents/documentDoor'
import {setAutosave, setSaveTiming} from '../../central/documents/autosave'
import {useAutosaveSetting} from '../../central/documents/useAutosave'

const NO_CARRIER: KernelTransportStatus = {kind: 'unavailable', reason: 'The shell has published no kernel carrier for this reading.'}
const message = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause)

/** How long Play waits for the agent's answer. */
const PLAY_WAIT_MS = 5 * 60_000

export const useCentralTransport: UseModeTransport = ({readouts}) => {
  const transport = useContext(Workspace)?.transport ?? NO_CARRIER
  const config = useContext(ShellConfigContext)
  const selection = useOptionalContinuity()?.current.context?.selection ?? null
  const ground = useCentralGroundAnswer(transport)
  const [turning, setTurning] = useState(false)
  const [turned, setTurned] = useState<string | null>(null)
  const die = dayDieOf(ground.reading, ground.error)
  // A Day held open in a pane shows its own face (the owner holds it at that Day's next Save): Tempo names and turns that one.
  const inPane = useDayInPane(die.state === 'ready' ? die.aperture.documentId : null)
  const shownFace = die.state === 'ready' ? inPane?.face ?? die.face : null
  // ‹ › turn the die one face either way, wrapping as the die does (the mockup's `(face + 1 | 5) % 6`): in the pane that holds it, else
  // through its write route.
  const turn = die.state === 'ready' && shownFace !== null && !turning ? (direction: 1 | -1) => {
    const face = (shownFace + direction + 6) % 6
    setTurning(true)
    turnDay(die.aperture.documentId, face, () => turnDieFace(transport, die.aperture, face)).then(
      () => setTurned(`↳ Turned to ${dieFaceLabel(face)}.`),
      cause => setTurned(`↳ Refused — ${message(cause)}`),
    ).finally(() => { setTurning(false); ground.refresh() })
  } : undefined
  const document = useReachedDocument()
  // Autosave and Save timing: the one setting for Central's pages, as the Document's Autosave turns it.
  const autosave = {setting: useAutosaveSetting(), set: setAutosave, time: setSaveTiming}
  // The core: Play, Stop, Overdub and Arm on the packet's conversation — the one the Packet holds, its packet as the World Model's packet
  // slice holds it (central/devices/agentChainDevices.ts packetFromModel, the read the chain's Packet makes).
  const shell = useAgentShellOptional()
  const agency = useAgencySessions(transport)
  const held = conversationOf(agency.tracks, COMPANIONS.base.name, selection?.ref ?? null).track
  const packetSlice = useModelSlice(transport, 'packet')
  const packet = packetFromModel(packetSlice, {session: held?.sessionRef ?? null, project: held?.project ?? ROOT_REGISTER})
  const conversation = held ? {project: held.project ?? ROOT_REGISTER, ref: held.sessionRef, space: held.spaceRef} : null
  const agent = held?.agentName ?? 'The agent'
  const [take, setTake] = useState<AnswerTake>('new')
  const [playing, setPlaying] = useState(false)
  const [played, setPlayed] = useState<string | null>(null)
  const arm = shell?.writeArm === true
  const page = document?.form === 'Flow' && document.location ? document : null
  const sources = packet?.context?.items.map(item => item.selection.title) ?? []
  const playRefused = transport.kind === 'unavailable' ? transport.reason
    : !conversation ? 'No conversation holds the packet: open the Agent on the chain, or select a session, then Play.'
    : playing ? `${agent} is answering the last Play; Stop cancels it.`
    : !page ? `No Flow page is open for the answer: open one to ${arm ? 'keep the answer in it' : 'have the answer proposed for it'}.` : undefined
  const play = !playRefused && conversation ? () => {
    const session = encounterSessionOf(transport, conversation)
    const asked = session.snapshot().draft.trim()
    if (!asked) { setPlayed(`↳ Nothing was sent: Play sends what you write in ${agent}'s conversation, with the packet. Write your ask there first.`); return }
    const keepIn = page
    setPlaying(true)
    setPlayed(null)
    session.ask(asked, agent, PLAY_WAIT_MS, `${agent} has not finished answering: the ask stands in the conversation, and nothing was kept in the page.`)
      .then(async answer => {
        if (!keepIn?.location) throw new Error(`${agent} answered, but the page was closed; nothing was kept. The answer, unlost:\n\n${answer.text}`)
        const given = {text: answer.text, agent, session: conversation.ref, sources, take}
        if (!arm) {
          const proposed = await proposeAgentAnswer(transport, keepIn.location, given)
          setPlayed(`↳ ${agent}'s answer is a proposal for ${keepIn.title || 'the page'} (Arm is off): it waits in ${proposed.project}'s returns${proposed.returnRef ? ` as ${proposed.returnRef}` : ''}, for Approvals to accept or refuse; nothing was written in the page.`)
          return
        }
        const kept = await keepAgentAnswer(transport, keepIn.location, given)
        setPlayed(`↳ ${agent}'s answer is in ${keepIn.title || 'the page'} ${take === 'replace' ? 'replacing its last entry' : 'as a new entry'}${kept.revision ? ` at ${kept.revision}` : ''}.`)
        keepIn.reread?.()
      })
      .catch(cause => setPlayed(`↳ Refused — ${message(cause)}`))
      .finally(() => setPlaying(false))
  } : undefined
  const playWords = [`Play — send what ${agent}'s conversation holds, with the packet (${sources.length} item${sources.length === 1 ? '' : 's'}); the answer ${arm
    ? `lands in ${page ? page.title || 'the page' : 'the open Flow page'} as ${take === 'replace' ? 'the replacement of the agent\'s last entry' : 'a new entry'}, with its sources`
    : `is a proposal for ${page ? page.title || 'the page' : 'the open Flow page'} (Arm is off), which Approvals accepts or refuses: nothing is written in the page`}.`, played].filter(Boolean).join(' ')
  const core = {playWords, arm, take, setTake, ...(play ? {play} : {}), ...(playRefused ? {playRefused} : {}),
    ...(playing && conversation ? {stop: () => encounterSessionOf(transport, conversation).cancel()} : {}),
    ...(shell ? {setArm: shell.setWriteArm} : {})}
  return centralBindings({ground: ground.reading, groundError: ground.error, packet, config, transport, readouts, turn, turned, document, autosave, core,
    ...(shownFace !== null ? {face: shownFace} : {})})
}
