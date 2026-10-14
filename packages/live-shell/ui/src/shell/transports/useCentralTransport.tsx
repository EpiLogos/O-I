// Central's bindings of the one transport (FOUNDATION F7; manual §10.5, the Central column). Each slot shows an owner's
// reading, and the one slot with a write path presses through it; every other slot stays drawn with its meaning and waits.
// The readers are the ones the Central surfaces already make, ported, never recreated:
//  - the Day, its die and its bounds: Central's ground reading (`central` inspect — desktop/cradle/src/central/client.ts:73
//    `readGround`, the read CentralGround.tsx:28 makes): today's Day reading (its native document's open face, the record's
//    opening) and the civil-time policy (its day boundary and timezone);
//  - the die's turn (Tempo ‹ ›): the die's own write route, central/devices/centralDeviceWrites.ts:42 `turnDieFace`;
//  - the packet's size and scope (Key, Scale): AIKit's prepared context through the kernel's encounter op, the read the packet
//    widget makes (widgets/PacketWidget.tsx:58-80, `nativeContext`), for the conversation the widget holds (agentConversation.ts
//    `conversationOf`, THE selection or Fizz's own session);
//  - the machine serving the ground (Rate): the host's configuration (ShellConfigContext, native/application.ts ShellConfig).
// The Day is read again when the window returns (focus, visibility) and after the die turns — never polled.
import {useContext, useEffect, useState} from 'react'
import {readGround, type CentralGroundReading} from '../../../../../../desktop/cradle/src/central/client'
import {nativeContext, PREPARED_CONTEXT_CHANGED, type PreparedContext} from '../../../../../../desktop/cradle/src/context/nativeContext'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {turnDieFace} from '../../central/devices/centralDeviceWrites'
import {dieFaceLabel} from '../../central/devices/dayDie'
import {useOptionalContinuity} from '../../continuity/workspace'
import {useAgencySessions} from '../../agent/useAgencySessions'
import {CONVERSATION_PROJECT, conversationOf} from '../../widgets/agentConversation'
import {COMPANIONS} from '../ModeContextDock'
import {ShellConfigContext} from '../useSet'
import {Workspace} from '../workspaceContext'
import type {UseModeTransport} from '../modeTransports'
import {centralBindings, dayDieOf} from './transportReadings'

const NO_CARRIER: KernelTransportStatus = {kind: 'unavailable', reason: 'The shell has published no kernel carrier for this reading.'}
const message = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause)

/** A count that advances when the window regains focus or becomes visible (central/useCentralDayStanding.ts's own rule). */
function useWindowReturns(): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    const again = () => { if (document.visibilityState !== 'hidden') setCount(value => value + 1) }
    window.addEventListener('focus', again)
    document.addEventListener('visibilitychange', again)
    return () => { window.removeEventListener('focus', again); document.removeEventListener('visibilitychange', again) }
  }, [])
  return count
}

/** Central's ground reading (readGround, desktop/cradle/src/central/client.ts:73) for the root register, or the owner's refusal. */
export function useCentralGround(transport: KernelTransportStatus): {reading: CentralGroundReading | null; error: string | null; reread: () => void} {
  const returns = useWindowReturns()
  const [again, setAgain] = useState(0)
  const key = JSON.stringify(transport)
  const [held, setHeld] = useState<{key: string; reading: CentralGroundReading | null; error: string | null} | null>(null)
  useEffect(() => {
    if (transport.kind === 'unavailable') return
    let alive = true
    readGround(transport, null).then(
      reading => { if (alive) setHeld({key, reading, error: null}) },
      cause => { if (alive) setHeld({key, reading: null, error: message(cause)}) },
    )
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key names the carrier
  }, [key, returns, again])
  const reread = () => setAgain(value => value + 1)
  if (transport.kind === 'unavailable') return {reading: null, error: `the carrier is unavailable: ${transport.reason}`, reread}
  return held?.key === key ? {reading: held.reading, error: held.error, reread} : {reading: null, error: null, reread}
}

/** The packet the agent will read: AIKit's prepared context for the conversation the packet widget holds (PacketWidget.tsx:58-80). */
export function usePacketReading(transport: KernelTransportStatus, selectionRef: string | null): {context?: PreparedContext; error?: string} | null {
  const agency = useAgencySessions(transport)
  const {track} = conversationOf(agency.tracks, COMPANIONS.base.name, selectionRef)
  const session = track?.sessionRef
  const key = JSON.stringify([transport, CONVERSATION_PROJECT, session ?? null])
  const [held, setHeld] = useState<{key: string; context?: PreparedContext; error?: string} | null>(null)
  const returns = useWindowReturns()
  useEffect(() => {
    if (transport.kind === 'unavailable') return
    let alive = true
    nativeContext(transport, CONVERSATION_PROJECT, session, {operation: 'read'})
      .then(context => { if (alive) setHeld({key, context}) }, cause => { if (alive) setHeld({key, error: message(cause)}) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key names the scope
  }, [key, returns])
  useEffect(() => {
    if (typeof window === 'undefined') return
    // The owner's own announcement of a changed packet (context/nativeContext.ts announceContext), as the widget listens for it.
    const changed = (event: Event) => {
      const detail = (event as CustomEvent<{project?: string; value?: PreparedContext; sourceWorldRef?: string}>).detail
      if (!detail?.value || detail.sourceWorldRef || detail.project !== CONVERSATION_PROJECT || detail.value.scope.agent_session !== (session ?? null)) return
      setHeld({key, context: detail.value})
    }
    window.addEventListener(PREPARED_CONTEXT_CHANGED, changed)
    return () => window.removeEventListener(PREPARED_CONTEXT_CHANGED, changed)
  }, [key, session])
  if (transport.kind === 'unavailable') return {error: transport.reason}
  return held?.key === key ? held : null
}

export const useCentralTransport: UseModeTransport = ({readouts}) => {
  const transport = useContext(Workspace)?.transport ?? NO_CARRIER
  const config = useContext(ShellConfigContext)
  const selection = useOptionalContinuity()?.current.context?.selection ?? null
  const ground = useCentralGround(transport)
  const packet = usePacketReading(transport, selection?.ref ?? null)
  const [turning, setTurning] = useState(false)
  const [turned, setTurned] = useState<string | null>(null)
  const die = dayDieOf(ground.reading, ground.error)
  // ‹ › turn the die one face either way, wrapping as the die does (the mockup's `(face + 1 | 5) % 6`), through its write route.
  const turn = die.state === 'ready' && !turning ? (direction: 1 | -1) => {
    const face = (die.face + direction + 6) % 6
    setTurning(true)
    turnDieFace(transport, die.aperture, face).then(
      () => setTurned(`↳ Turned to ${dieFaceLabel(face)}.`),
      cause => setTurned(`↳ Refused — ${message(cause)}`),
    ).finally(() => { setTurning(false); ground.reread() })
  } : undefined
  return centralBindings({ground: ground.reading, groundError: ground.error, packet, config, transport, readouts, turn, turned})
}
