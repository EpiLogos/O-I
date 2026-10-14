// Factory's bindings of the one transport (T-TRANSPORT-BINDINGS; FOUNDATION F7; manual §10.5, the Factory column).
// The working controls of the old agent bar (agent/AgentShellTransport.tsx, mounted through AgentShellTransportBridge in
// App.tsx) fold in here, slot by slot, so the frame's one bar (frame/transport/Transport.tsx) carries them. Nothing is new:
// every press goes through the exact owner call the old bar made (the shell setters, the harness control, the voice
// session), every light comes from the reading the old bar lit it from, and a control with no owner call stays unbound.
//
// Lights and presses (the old bar's line is named on each binding below):
//  - Run and Stop send `harness_agent_control` (resume, stop) on the bound harness — agent/harnessAgentControl.ts.
//  - Effort, Heartbeat, Interrupt timing, Steer and Write arm go through the registered shell setters
//    (inhabitants/sdk/shellSetters.ts, registered by agent/shellSetterBridge.ts) and carry the setter's receipt.
//  - Voice is the dictation session (agent/useAgentVoice.ts); Tap, Capture, Follow, Hand back and Routine are the agent
//    shell's own state (agent/AgentShellContext.tsx).
// The note line the old bar drew under the bar (receipt, voice, capture, tap) becomes each slot's title.
import {useContext, useRef, useState} from 'react'
import type {DictationSession} from '../../../../../../desktop/cradle/src/dictation/client'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {AGENT_TRANSPORT_TIPS} from '../../agent/agentFidelity'
import {useAgentShellOptional, EFFORT_STEPS, QUANTIZE_STEPS, type AgentShellState} from '../../agent/AgentShellContext'
import {useAgentSessionsOptional} from '../../agent/AgentSessionsProvider'
import {trackKey} from '../../agent/agentRunModel'
import {harnessAgentControl} from '../../agent/harnessAgentControl'
import {useAgentMetrics} from '../../agent/useAgentMetrics'
import {startAgentVoice, stopAgentVoice} from '../../agent/useAgentVoice'
import {useHarnessBinding} from '../../agent/useHarnessBinding'
import {useShellSetterBridge} from '../../agent/shellSetterBridge'
import type {TransportBindings, TransportSlotId} from '../../frame/transport/slots'
import {shellSetter, type DispatchReceipt} from '../../inhabitants/sdk/shellSetters'
import type {ModeTransportReadouts} from '../ModeTransportBar'
import type {UseModeTransport} from '../modeTransports'
import {Workspace} from '../workspaceContext'

const TIPS = AGENT_TRANSPORT_TIPS
/** The carrier an unmounted workspace has (a render with no workspace provider): the owner is unreachable, so no press reaches it. */
const NO_CARRIER: KernelTransportStatus = {kind: 'unavailable', reason: 'The shell has published no kernel carrier for this reading.'}
/** What the setter bridge is handed while no agent shell stands (a render with no provider): setters that move nothing. The product
 * always mounts the provider above the frame, so this only keeps the hook order fixed. */
const INERT_SETTERS: Pick<AgentShellState, 'setEffort' | 'setSteer' | 'setHeartbeat' | 'setWriteArm' | 'setQuantize' | 'quantize'> = {
  quantize: 'next tool', setEffort: () => {}, setSteer: () => {}, setHeartbeat: () => {}, setWriteArm: () => {}, setQuantize: () => {},
}

/** The owner readouts a frame publishes for a slot (Now, the carrier, …), as slot readouts — what the registry's default hook shows. */
const readoutBindings = (readouts: ModeTransportReadouts | undefined): TransportBindings =>
  Object.fromEntries(Object.entries(readouts ?? {}).map(([id, readout]) => [id, {readout}])) as TransportBindings

/** A slot's base title and the last thing its owner said about it (the old bar's note line, under the control it concerned). */
const noted = (base: string, note: string | null | undefined): string => note ? `${base} ${note}` : base

/** The setter's receipt as the old bar's note line wrote it (AgentShellTransport.tsx:126-128). */
const receiptLine = (receipt: DispatchReceipt): string => receipt.kind === 'fired' ? `↳ ${receipt.note}` : `↳ Refused — ${receipt.reason}`

export const useFactoryTransport: UseModeTransport = ({readouts}) => {
  const provided = useAgentShellOptional()
  const transport = useContext(Workspace)?.transport ?? NO_CARRIER
  // The sessions are the agency provider's one poll (App.tsx reads the same through useAgencySessions); the selected one is the
  // shell's selection, or the first (AgentShellTransportBridge in App.tsx).
  const tracks = useAgentSessionsOptional()?.tracks ?? []
  const track = tracks.find(item => trackKey(item) === provided?.selectedTrackId) ?? tracks[0]
  const metrics = useAgentMetrics(transport, track?.sessionRef ?? null)
  const {binding} = useHarnessBinding(transport)
  // The bar mounts the setters' registration (AgentShellTransport.tsx:74): without it the effort, steer, quantize, heartbeat and
  // write-arm presses reach no setter, and the atlas and knowledge setters are never registered.
  useShellSetterBridge(provided ?? INERT_SETTERS, transport, binding)
  const voiceSession = useRef<DictationSession | null>(null)
  // Whether the harness is running: only the owner's answer to the last Run or Stop says so (AgentShellTransportBridge in App.tsx held it, true from mount).
  const [running, setRunning] = useState<boolean | null>(null)
  const [controlBusy, setControlBusy] = useState(false)
  const [notes, setNotes] = useState<Partial<Record<TransportSlotId, string>>>({})
  if (!provided) return readoutBindings(readouts)
  const shell = provided
  const note = (slot: TransportSlotId, line: string) => setNotes(current => ({...current, [slot]: line}))

  // A press through a registered shell setter — AgentShellTransport.tsx:79 (`shellSetter(path)?.(value)`) — and its receipt.
  const dispatch = (slot: TransportSlotId, path: string, value: unknown) => {
    const setter = shellSetter(path)
    if (!setter) { note(slot, `↳ ${path} is not registered in this session, so the press reached no owner.`); return }
    void setter(value).then(receipt => note(slot, receiptLine(receipt)), cause => note(slot, `↳ Refused — ${cause instanceof Error ? cause.message : String(cause)}`))
  }
  const stepEffort = (direction: 1 | -1) => {            // AgentShellTransport.tsx:80-84
    const index = EFFORT_STEPS.indexOf(shell.effort)
    dispatch('tempo', 'shell.setEffort', EFFORT_STEPS[Math.max(0, Math.min(EFFORT_STEPS.length - 1, index + direction))])
  }
  const cycleQuantize = () => dispatch('quantize', 'shell.setQuantize', QUANTIZE_STEPS[(QUANTIZE_STEPS.indexOf(shell.quantize) + 1) % QUANTIZE_STEPS.length]) // :85-88
  const toggleHeartbeat = () => dispatch('metro', 'shell.setHeartbeat', !shell.heartbeat)   // :90
  const toggleSteer = () => dispatch('overdub', 'shell.setSteer', !shell.steer)             // :89
  const toggleWriteArm = () => dispatch('arm', 'shell.setWriteArm', !shell.writeArm)        // :91
  const tap = () => {                                                                       // :92-97
    shell.setTapNote(`Tap ${new Date().toISOString()} · ${shell.heartbeat ? 'heartbeat on' : 'heartbeat off'}`)
    shell.recordCapture('tap')
    if (!shell.openTiles.includes('agents')) shell.toggleTile('agents')
  }
  const toggleVoice = async () => {                                                         // :98-115
    if (shell.voiceArmed && voiceSession.current) {
      const line = await stopAgentVoice(voiceSession.current)
      voiceSession.current = null
      shell.setVoiceArmed(false)
      shell.setVoiceNote(line)
      return
    }
    shell.setVoiceArmed(true)
    shell.recordCapture('voice')
    const started = await startAgentVoice(transport)
    if (!started.ok) {
      // The dictation owner refused: nothing records, so the light goes dark (the old bar left it on beside "Voice not armed").
      shell.setVoiceArmed(false)
      shell.setVoiceNote(started.note)
      return
    }
    voiceSession.current = started.session
    shell.setVoiceNote('Recording — click Voice again to transcribe into the armed track.')
  }
  const toggleCapture = () => {                                                             // :116-125
    if (shell.capturing) {
      shell.setCapturing(false)
      shell.setCaptureNote(`Captured ${shell.captureLog.length} action(s) as a worked-example clip.`)
      return
    }
    shell.setCapturing(true)
    shell.recordCapture('capture-start')
    shell.setCaptureNote('Capture on — shell actions land as a skill example.')
  }
  // Run and Stop: the harness control on the bound harness (runControl in AgentShellTransportBridge, App.tsx).
  const runControl = async (slot: 'play' | 'stop', control: 'resume' | 'stop') => {
    setControlBusy(true)
    const outcome = await harnessAgentControl(transport, binding, control)
    setControlBusy(false)
    if (outcome.ok) {
      setRunning(control === 'resume')
      note(slot, `↳ ${outcome.note}`)
    } else {
      console.warn(outcome.error)
      note(slot, `↳ Refused — ${outcome.error}`)
    }
  }
  // The meter drew `spend * 100 %` (:163). `useAgentMetrics` sets `spend` from the reading's fill, or from its cap when no fill is disclosed
  // (useAgentMetrics.ts:68-70), so only a fraction is a fill: anything else is not shown as a percentage.
  const spend = metrics.spend !== null && metrics.spend >= 0 && metrics.spend <= 1 ? `${Math.round(metrics.spend * 100)}%` : null
  const budget = metrics.budgetUsed === null && metrics.budgetCap === null ? '— / —' : `${metrics.budgetUsed ?? '—'} / ${metrics.budgetCap ?? '—'}`

  return {
    ...readoutBindings(readouts),
    // Link has no handler on the old bar (AgentShellTransport.tsx:135): it stays unbound, drawn waiting.
    tap: {press: tap, title: noted(TIPS.tap, shell.tapNote)},                                                              // :136
    tempo: {step: stepEffort, readout: {value: shell.effort, title: noted(TIPS.effort, notes.tempo)}, title: noted(`${TIPS.effort} ‹ and › step it.`, notes.tempo)}, // :137-138
    signature: {readout: {value: budget, title: TIPS.budget}},                                                            // :139
    metro: {press: toggleHeartbeat, lit: shell.heartbeat, title: noted(TIPS.heartbeat, notes.metro)},                      // :140
    quantize: {press: cycleQuantize, readout: {value: `${shell.quantize} ▾`, title: noted(TIPS.quantize, notes.quantize)}, title: noted(TIPS.quantize, notes.quantize)}, // :141
    // Σ scope, tokens in, tokens out — the manual's "count tokens in and out" across key, root and scale (:144-146).
    key: {press: shell.cycleTokenScope, readout: {value: `Σ ${shell.tokenScope}`, title: TIPS.tokens}, title: TIPS.tokens},
    root: {readout: {value: `in ${metrics.tokensIn}`, title: TIPS.tokIn}},
    scale: {readout: {value: `out ${metrics.tokensOut}`, title: TIPS.tokOut}},
    follow: {press: () => shell.setFollow(!shell.follow), lit: shell.follow, title: TIPS.follow},                          // :150
    position: {readout: {value: metrics.position, title: TIPS.position}},                                                  // :151
    // Run lights only after the owner has answered a Run or Stop; the old bar held it lit from mount (`useState(true)` in AgentShellTransportBridge, App.tsx).
    play: {press: controlBusy ? undefined : () => void runControl('play', 'resume'), ...(running === null ? {} : {lit: running}), title: noted(TIPS.run, notes.play)}, // :152
    stop: {press: controlBusy ? undefined : () => void runControl('stop', 'stop'), title: noted(TIPS.stop, notes.stop)},    // :153
    record: {press: () => void toggleVoice(), lit: shell.voiceArmed, title: noted(TIPS.voice, shell.voiceNote)},           // :154
    overdub: {press: toggleSteer, lit: shell.steer, title: noted(TIPS.steer, notes.overdub)},                              // :155
    arm: {press: toggleWriteArm, lit: shell.writeArm, title: noted(TIPS.writeArm, notes.arm)},                             // :156
    're-enable': {press: () => shell.setHandBackLit(false), lit: shell.handBackLit, title: TIPS.handBack},                 // :157
    capture: {press: toggleCapture, lit: shell.capturing, title: noted(TIPS.capture, shell.captureNote)},                  // :158
    loop: {press: () => shell.setLoopOn(!shell.loopOn), lit: shell.loopOn, title: TIPS.loop},                              // :159
    // The old bar's spend meter (:163) is the only load reading it had; the manual's Load (context fill) has none here.
    cpu: {readout: {value: spend ?? '—', title: `${TIPS.spend} (The context-window fill has no reading on this bar yet.)`}},
  }
}
