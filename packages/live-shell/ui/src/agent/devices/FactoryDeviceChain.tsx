// Factory's Device side: the session's chain — gateway → agent → skills → scope → landing — as devices of the runtime (manual §6,
// §10.4; ticket T-DEVICES-FACTORY). Each is a DeviceView at its compact size (a picture and at most four controls); each is
// published to the door, so the pool shows the chosen one whole and a pane shows it full — the same live settings in all three,
// a change in any one the same change through the owner's write path. The skills rack is a rack: its chains with their admit
// lamps and its selector; its four settings stand as readings until ai-kit declares the mapping that would make them macros.
//
// What the chain's cards (agent/AgentDeviceChain.tsx + NativeAgentDeviceRack.tsx) did that is not the devices' own is ported
// here unchanged and named: the drop receiver (aperture law: a drop is one declared owner operation or a named refusal —
// AgentDeviceChain.tsx:199-243), the slide grip and drop slot (NativeAgentDeviceRack.tsx:113-182), the card click that opens
// the device in the pool (:119) and the owner-line notes. The fold to a title (:210-221) is the runtime's own (DeviceView's ▾,
// its light read by deviceRuntime.ts lightOf); the chain draws no fold or light of its own.
//
// The designed devices (lane BF): the Gateway, the Agent, the Skillset rack, its member and Scope draw the catalogue's designs
// (inhabitants/catalogue/panels: actuation__gateway.tsx, actuation__harness-model.tsx, skills.tsx, member.tsx, scope.tsx) on their owners' readings and
// writes (designBindings.ts), each published with its binding so the chain, the pool, a pane and the rail draw one device. A
// design that still draws a list of its own where the owner's belongs waits (designBindings.ts designWaits), and the generic
// plate draws the owner's rows; the slot names why (data-design-waits).
import {Fragment, useCallback, useEffect, useMemo, useRef, useState, type DragEvent} from 'react'
import {DeviceView} from '../../frame/devices/DeviceView'
import {publishDevice, selectDevice} from '../../frame/devices/deviceDoor'
import {DEVICE_PANE_KIND} from '../../frame/devices/devicePane'
import type {DesignBinding} from '../../frame/devices/designed'
import {useDesign} from '../../frame/devices/designs'
import {openInstrument} from '../../frame/instrumentDoor'
import {agentAddress} from '../../inhabitants/agentParamAddresses'
import {useRosterAnswer} from '../../owners/readers'
import {useAgentSessionsOptional} from '../AgentSessionsProvider'
import {useAgentShell, type AgentDeviceId} from '../AgentShellContext'
import {
  AGENT_CHAIN_MIME, MISSING_OPS, activeChainDrag, chainDropDecision, chainInsertIndex, decodeChainDrag, dropZoneLine,
  encodeChainDrag, missingOpRemedy, setActiveChainDrag, type ActiveChainDrag, type AgentChainSlotId,
} from '../agentChainDrag'
import {agentDataI} from '../agentFidelity'
import {fireWritePath} from '../agentNativeDispatch'
import {harnessAgentControl} from '../harnessAgentControl'
import {RefusalCard, safeJson} from '../RefusalCard'
import {CHAIN_DEVICE_IDS, agentChainDevices, chainDeviceId, rackMemberDevice, type ChainWrite} from './agentChainDevices'
import {chainPicture, type PictureContext} from './AgentDevicePictures'
import {
  AGENT_DESIGN, AGENT_P0_ROWS, GATEWAY_DESIGN, MEMBER_DESIGN, MEMBER_DEVICE_ID, RACK_DESIGN, SCOPE_DESIGN, SLOT_DESIGN_FACE, agentBinding, designWaits,
  gatewayBinding, memberBinding,
  memberChains, rackBinding, scopeBinding, seatedProfile, useChainHolds, type AgentRows,
} from './designBindings'
import {useOwnerAccepted} from './ownerAccepted'
import {useSelectedSkillChain} from './skillRackSelection'
import {useAgentChainReading} from './useAgentChainReading'
import {RACK_PROJECT, composePorts, useRackReading} from './useRackReading'
import '../agentShell.css'
import './factoryDevices.css'

/** The slot hooks, keyed like the mockup oracle (`label|function`); worded as the chain's cards worded them
 * (NativeAgentDeviceRack.tsx:30-43). */
const SLOT_DATA_I: Readonly<Record<string, string>> = {
  gateway: agentDataI('Gateway · hermes', 'Where the session runs: the harness connection (Hermes tui_gateway, JSON-RPC over stdio or WebSocket). Frames flow along the link; the ring is the replay buffer; the outer pulse is the heartbeat.'),
  agent: agentDataI('Agent · agent', 'Compact. Click: expand in the pool. Thread ↗: open its thread full.'),
  skillset: agentDataI('Skillset rack', 'Skills as chains (light = admitted); macros steer several at once.'),
  world: agentDataI('World · bridge', 'What the session may read (teal) and write (amber).'),
  git: agentDataI('Git', 'The session’s repository seat. The diagram is the branch against main; the pulsing hollow dot is uncommitted work.'),
}
const DROP_ZONE_DATA_I = agentDataI('Drop zone', 'Gateways, agents, skillsets, worlds, git. Left to right: through → who → how → where → lands.')

/** The outcome of one drop attempt or one write: the owner's receipt, or the refusal that names the missing operation. */
interface ChainNote {
  kind: 'receipt' | 'refused'
  title: string
  line: string
  receipt: string | null
}

/** Where a drop landed: the dashed zone or a named card. */
type ChainDropTarget = {kind: 'zone'; label: string} | {kind: 'card'; id: string; label: string}

/** The slots whose designs this chain binds, with the design each draws. */
const SLOT_DESIGNS: Readonly<Record<string, string>> = {gateway: GATEWAY_DESIGN, agent: AGENT_DESIGN, skillset: RACK_DESIGN, world: SCOPE_DESIGN}

export function FactoryDeviceChain({sessionRef}: {sessionRef: string | null}) {
  const shell = useAgentShell()
  const {reading, transport, binding, resolved} = useAgentChainReading(sessionRef)
  // The settings an owner accepted on this harness: the only readings effort and input have. The shell's own effort, steer,
  // heartbeat and write-arm flags are presentation, so they are not read here.
  const accepted = useOwnerAccepted(binding)
  const sessions = useAgentSessionsOptional()
  const track = sessionRef != null ? sessions?.tracks.find(item => item.sessionRef === sessionRef) ?? null : null
  const holds = useChainHolds()
  // The catalogue's designs, and whether each can be hosted on its owner yet (designBindings.ts designWaits).
  const gatewayDesign = useDesign(GATEWAY_DESIGN, true), agentDesign = useDesign(AGENT_DESIGN, true), rackDesign = useDesign(RACK_DESIGN, true)
  const memberDesign = useDesign(MEMBER_DESIGN, true), scopeDesign = useDesign(SCOPE_DESIGN, true)
  const waits: Readonly<Record<string, string | null>> = useMemo(() => ({
    gateway: designWaits(GATEWAY_DESIGN, gatewayDesign), agent: designWaits(AGENT_DESIGN, agentDesign), skillset: designWaits(RACK_DESIGN, rackDesign),
    world: designWaits(SCOPE_DESIGN, scopeDesign), member: designWaits(MEMBER_DESIGN, memberDesign),
  }), [gatewayDesign, agentDesign, rackDesign, memberDesign, scopeDesign])
  const [note, setNote] = useState<ChainNote | null>(null)
  // The gesture-held drag, mirrored into state so the zone names what is held and a slide's drop slot opens.
  const [held, setHeld] = useState<ActiveChainDrag | null>(null)
  const [gap, setGap] = useState<number | null>(null)
  const rowRef = useRef<HTMLDivElement | null>(null)

  // A write goes to the row's own write path through the one resolver; its receipt is the chain's note (as the transport's is).
  const write = useCallback<ChainWrite>(async (row, value) => {
    const receipt = await fireWritePath(row, value, {transport, binding})
    setNote(receipt.kind === 'fired'
      ? {kind: 'receipt', title: row.title, line: receipt.note, receipt: receipt.outcome !== undefined ? safeJson(receipt.outcome) : null}
      : {kind: 'refused', title: `${row.title} refused`, line: receipt.missingOp ? `${receipt.reason} — missing op: ${receipt.missingOp}` : receipt.reason, receipt: null})
    return receipt
  }, [transport, binding])

  // A slot whose design is bound draws by that design's face (the world slot by Software Factory's Scope).
  const designedFaces = useMemo(() => Object.fromEntries(Object.entries(SLOT_DESIGN_FACE).filter(([slot]) => !waits[slot])), [waits])
  const chain = useMemo(() => agentChainDevices({sessionRef, reading, accepted}, write, designedFaces), [sessionRef, reading, accepted, write, designedFaces])
  const pictures: PictureContext = {reading, sessionRef, onFrames: () => shell.toggleTile('frames'), onThread: () => shell.openThread(sessionRef)}

  // The Gateway: the harness reading's own fields; its settings through the address table's rows (stall-after with the design's
  // stops as its domain — the device's generic row withholds it for want of one, agentChainDevices.ts GATEWAY_STALL).
  const gatewayDesignBinding = useMemo(() => {
    if (waits.gateway) return null
    const rows = chain.find(entry => entry.slot.id === 'gateway')?.device.rows ?? []
    const stall = agentAddress('gateway', 'stall-after')
    return gatewayBinding(chainDeviceId('gateway'), {reading, harness: {binding, resolved}}, {
      transport: rows.find(row => row.key === 'transport'), approvals: rows.find(row => row.key === 'approvals'), connect: rows.find(row => row.key === 'connect'),
      ...(stall ? {stallAfter: {...stall, title: 'Stall after'}} : {}),
    }, write)
  }, [waits.gateway, chain, reading, binding, resolved, write])

  // The Agent: its rows' own write paths — the address table's (effort, input, heartbeat) and the declared P0 rows
  // (designBindings.ts AGENT_P0_ROWS: interrupt timing and the steer line on Actuation's face, the new task on Software Factory's).
  const agentRows = useMemo((): AgentRows => {
    const rows = chain.find(entry => entry.slot.id === 'agent')?.device.rows ?? []
    return {
      effort: rows.find(row => row.key === 'effort'), input: rows.find(row => row.key === 'input'), heartbeat: rows.find(row => row.key === 'heartbeat'),
      ...AGENT_P0_ROWS,
    }
  }, [chain])
  const steering = useRef(shell.steer)
  steering.current = shell.steer
  const agentDesignBinding = useMemo(() => (waits.agent ? null : agentBinding(chainDeviceId('agent'), {
    sessionRef, track, nowUnixMs: sessions?.nowUnixMs ?? 0, reading, accepted, harness: {binding, resolved}, holds,
  }, agentRows, write, () => steering.current)), [waits.agent, sessionRef, track, sessions?.nowUnixMs, reading, accepted, binding, resolved, holds, agentRows, write])

  // The rack: the seated agent's carried practice (its accepted profile in the roster, the sets AIKit replies for), and the
  // composition through the configuration plane. Read only while its design can draw it.
  const roster = useRosterAnswer(transport, null).reading
  const profile = useMemo(() => seatedProfile(roster.status === 'answered' ? roster.value : null, track?.agentRef ?? null), [roster, track?.agentRef])
  const [planeEpoch, setPlaneEpoch] = useState(0)
  const rackOn = !waits.skillset
  const rackReading = useRackReading(transport, profile, holds.compose.scope, sessionRef, rackOn, planeEpoch)
  const ports = useMemo(() => composePorts(transport, () => setPlaneEpoch(epoch => epoch + 1)), [transport])
  const rackDesignBinding = useMemo(() => (rackOn ? rackBinding(chainDeviceId('skillset'), {profile, ...rackReading, holds}, ports, {project: RACK_PROJECT, sessionRef}) : null),
    [rackOn, profile, rackReading, holds, ports, sessionRef])
  // The member: the rack's chosen chain, one device inside the rack (§19.7).
  const memberOn = rackOn && !waits.member
  const chosen = useSelectedSkillChain(rackDesignBinding ? memberChains(rackDesignBinding.values) : null)
  const memberDevice = useMemo(() => (memberOn ? rackMemberDevice(MEMBER_DEVICE_ID) : null), [memberOn])
  const memberDesignBinding = useMemo(() => (memberDevice && rackDesignBinding ? memberBinding(MEMBER_DEVICE_ID, rackDesignBinding.values, chosen, holds) : null),
    [memberDevice, rackDesignBinding, chosen, holds])
  // Scope: the world row's write path for the write mode; a raised reach held until Confirm.
  const writeModeRow = chain.find(entry => entry.slot.id === 'world')?.device.rows.find(row => row.key === 'write-mode')
  const scopeDesignBinding = useMemo(() => (waits.world ? null : scopeBinding(chainDeviceId('world'), holds, writeModeRow, write)), [waits.world, holds, writeModeRow, write])
  const bindings: Readonly<Record<string, DesignBinding | null>> = useMemo(() => ({
    gateway: gatewayDesignBinding, agent: agentDesignBinding, skillset: rackDesignBinding, world: scopeDesignBinding,
  }), [gatewayDesignBinding, agentDesignBinding, rackDesignBinding, scopeDesignBinding])

  // Publish each device to the door: the pool shows the chosen one whole, a pane shows it full, from these same devices — a
  // designed device with its binding, so every place draws the design on the same owner values.
  useEffect(() => {
    for (const {slot, device} of chain) publishDevice(device.id, {device, picture: size => chainPicture(slot.id, pictures, size), ...(bindings[slot.id] ? {binding: bindings[slot.id]!} : {})})
    if (memberDevice && memberDesignBinding) publishDevice(memberDevice.id, {device: memberDevice, binding: memberDesignBinding})
    else publishDevice(MEMBER_DEVICE_ID, null)
  }, [chain, bindings, memberDevice, memberDesignBinding]) // the pictures read the reading `chain` is built from
  useEffect(() => () => { for (const id of [...CHAIN_DEVICE_IDS, MEMBER_DEVICE_ID]) publishDevice(id, null) }, [])

  const choose = (slotId: string) => { shell.setExpandedDevice(slotId as AgentDeviceId); selectDevice(chainDeviceId(slotId)) }
  const openDevice = (id: string, title: string) => {
    try { openInstrument(DEVICE_PANE_KIND, undefined, {ref: id, title}) }
    catch (cause) { setNote({kind: 'refused', title: 'Open full', line: cause instanceof Error ? cause.message : String(cause), receipt: null}) }
  }
  const openFull = (slotId: string, title: string) => openDevice(chainDeviceId(slotId), title)
  // The Agent's ⤢ opens its thread in a pane (§19.3 Compact: "Click ⤢ to open the thread in a pane") — the session's own thread,
  // never a picture of one; with no session selected there is no thread to open.
  const openAgentThread = () => {
    if (sessionRef == null) { setNote({kind: 'refused', title: 'Open thread', line: 'No session is selected: the Agent\'s thread opens when one is.', receipt: null}); return }
    shell.openThread(sessionRef)
  }

  // One drop, one owner operation (or one named refusal). The session drop rides the run model's own selection — the who slot
  // then reads the new session's task record. The agent drop dispatches `harness_agent_control` (new) on the gateway binding and
  // folds the owner's outcome document as the receipt. That op takes a binding and a control word and no agent ref
  // (harnessAgentControl.ts), so what the drop does is start a NEW agent on the bound harness: the dragged agent is named in the
  // note and the harness is not told which one it was. Everything else refuses by name — the dragged item simply returns.
  // (Ported from AgentDeviceChain.tsx:199-243.)
  const attemptDrop = useCallback(async (active: ActiveChainDrag, target: ChainDropTarget) => {
    if (active.kind === 'reorder') {
      setNote({
        kind: 'refused',
        title: 'Slide refused',
        line: `«${active.reorder.title}» over ${target.label} — the chain composition is declared at the family door (through → who → how → where → lands); no owner operation reorders it — missing op: ${MISSING_OPS.order}; remedy: ${missingOpRemedy('order')}.`,
        receipt: encodeChainDrag(active.reorder),
      })
      return
    }
    const decision = chainDropDecision(active.drag)
    if (decision.kind === 'missing-op') {
      setNote({
        kind: 'refused',
        title: 'Drop refused',
        line: `«${active.drag.label}» onto ${target.label} — no owner operation admits it: missing op ${decision.missingOp} — ${decision.because}; owner ${decision.owner ?? 'not named'}; remedy: ${decision.remedy}.`,
        receipt: encodeChainDrag(active.drag),
      })
      return
    }
    if (decision.operation.kind === 'select-session') {
      shell.setSelectedTrackId(active.drag.ref)
      setNote({
        kind: 'receipt',
        title: 'Chain subject',
        line: `«${active.drag.label}» onto ${target.label} — the who slot reads this session’s task record (encounter_task_read follows the selection).`,
        receipt: null,
      })
      return
    }
    const outcome = await harnessAgentControl(transport, binding, decision.operation.control)
    const dragged = `«${active.drag.label}» (${active.drag.ref})`
    setNote(outcome.ok
      ? {
          kind: 'receipt',
          title: 'New agent started',
          line: `${dragged} onto ${target.label} — started a new agent on the harness bound as “${binding}”; the harness was not told which agent was dragged, because harness_agent_control carries no agent ref. ${outcome.note}`,
          receipt: outcome.document !== undefined ? safeJson(outcome.document) : null,
        }
      : {
          kind: 'refused',
          title: 'New agent refused',
          line: `${dragged} onto ${target.label} — harness_agent_control (${decision.operation.control}: a new agent on the bound harness, not the dragged one) answered: ${outcome.error}`,
          receipt: outcome.error,
        })
  }, [shell, transport, binding])

  // A drag that ends anywhere (dropped outside, cancelled, escaped) clears the held mirror and the drop slot — the dragged item
  // has returned either way (NativeAgentDeviceRack.tsx:127-135).
  useEffect(() => {
    const clear = () => { setHeld(null); setGap(null) }
    window.addEventListener('dragend', clear)
    window.addEventListener('drop', clear)
    return () => { window.removeEventListener('dragend', clear); window.removeEventListener('drop', clear) }
  }, [])
  const isChainDrag = (event: DragEvent<HTMLElement>) => event.dataTransfer.types.includes(AGENT_CHAIN_MIME)
  // The visible drop slot for a slide: the gap between cards under the pointer.
  const gapAt = (x: number) => chainInsertIndex(x, [...(rowRef.current?.querySelectorAll<HTMLElement>('[data-slot]:not([data-slot="zone"])') ?? [])].map(card => card.getBoundingClientRect()))
  const onRowDragOver = (event: DragEvent<HTMLElement>) => {
    if (!isChainDrag(event)) return
    event.preventDefault()
    const active = activeChainDrag()
    setHeld(active)
    event.dataTransfer.dropEffect = active?.kind === 'reorder' ? 'move' : 'copy'
    setGap(active?.kind === 'reorder' ? gapAt(event.clientX) : null)
  }
  const onRowDrop = (event: DragEvent<HTMLElement>) => {
    if (!isChainDrag(event)) return
    event.preventDefault()
    const active = decodeChainDrag(event.dataTransfer.getData(AGENT_CHAIN_MIME)) ?? activeChainDrag()
    const slotId = (event.target as HTMLElement).closest<HTMLElement>('[data-slot]')?.dataset.slot
    const card = chain.find(entry => entry.slot.id === slotId)?.slot
    const target: ChainDropTarget = card ? {kind: 'card', id: card.id, label: `«${card.title}»`} : {kind: 'zone', label: 'the drop zone'}
    setHeld(null)
    setGap(null)
    if (active) void attemptDrop(active, target)
  }
  const grip = (id: string, title: string) => (
    <span
      role="button" tabIndex={0} draggable className="agent-chain-grip"
      aria-label={`Slide ${title}: drag, or Alt+Arrow — the chain refuses: its composition is declared (missing op: agent-chain order)`}
      title="Slide — the chain refuses: the composition is declared"
      onClick={event => event.stopPropagation()}
      onDragStart={event => {
        const reorder = {id: id as AgentChainSlotId, title}
        setActiveChainDrag({kind: 'reorder', reorder})
        setHeld({kind: 'reorder', reorder})
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData(AGENT_CHAIN_MIME, encodeChainDrag(reorder))
        event.dataTransfer.setData('text/plain', title)
      }}
      onDragEnd={() => { setActiveChainDrag(null); setHeld(null); setGap(null) }}
      onKeyDown={event => {
        if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
        event.preventDefault()
        void attemptDrop({kind: 'reorder', reorder: {id: id as AgentChainSlotId, title}}, {kind: 'zone', label: 'the drop zone'})
      }}
    ><span aria-hidden="true">⋮⋮</span></span>
  )

  return (
    <div className="agent-device-chain factory-devices">
      {note && (note.kind === 'refused'
        ? <RefusalCard
            title={note.title}
            line={note.line}
            receipt={note.receipt}
            onDismiss={() => setNote(null)}
            dataI="Refusal|The named missing operation or the owner’s own words: nothing was written, and the dragged item returned."
          />
        : <p className="agent-transport-note" role="status"><b>{note.title}</b> — {note.line}</p>)}
      <div
        className="native-agent-rack" aria-label="Agent device chain" data-region="device-chain"
        ref={rowRef}
        onDragOver={onRowDragOver}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setGap(null) }}
        onDrop={onRowDrop}
      >
        {chain.map(({slot, device}, index) => (
          <Fragment key={slot.id}>
            {/* The visible drop slot while a card slides — it opens under the pointer and closes on release. It never lies:
              a slot is not a landing, the owner operation (here: the refusal naming the missing order op) is. */}
            {held?.kind === 'reorder' && gap === index && <span className="agent-chain-gap" aria-hidden="true" />}
            <div className="factory-slot" data-slot={slot.id} data-family={slot.family} data-device={slot.id}
              data-selected={shell.expandedDevice === slot.id} data-i={SLOT_DATA_I[slot.id]} onClick={() => choose(slot.id)}
              data-design={SLOT_DESIGNS[slot.id] && bindings[slot.id] ? SLOT_DESIGNS[slot.id] : undefined}
              data-design-waits={SLOT_DESIGNS[slot.id] ? waits[slot.id] ?? undefined : undefined}>
              <div className="factory-slot__rail">{grip(slot.id, slot.title)}</div>
              <DeviceView device={device} size="compact" picture={chainPicture(slot.id, pictures, 'compact')} binding={bindings[slot.id] ?? undefined} actions={[
                {icon: 'detail', label: 'Show every setting in the pool', onPress: () => choose(slot.id)},
                slot.id === 'agent'
                  ? {icon: 'pane', label: 'Open the Agent\'s thread in a pane', onPress: openAgentThread}
                  : {icon: 'pane', label: `Open ${slot.title} full size in a pane`, onPress: () => openFull(slot.id, slot.title)},
              ]} />
              {/* The rack's chosen chain, inside the rack (§19.7): the member device. Its press shows it whole in the pool. */}
              {slot.id === 'skillset' && memberDevice && memberDesignBinding && (
                <div className="factory-slot__member" data-device={memberDevice.id} onClick={event => event.stopPropagation()}>
                  <DeviceView device={memberDevice} size="compact" binding={memberDesignBinding} actions={[
                    {icon: 'detail', label: 'Show the member whole in the pool', onPress: () => selectDevice(memberDevice.id)},
                    {icon: 'pane', label: 'Open the member full size in a pane', onPress: () => openDevice(memberDevice.id, 'Member')},
                  ]} />
                </div>
              )}
            </div>
          </Fragment>
        ))}
        {held?.kind === 'reorder' && gap === chain.length && <span className="agent-chain-gap" aria-hidden="true" />}
        <div className={'agent-dropz dropz' + (held ? ' armed' : '')} data-slot="zone" data-i={DROP_ZONE_DATA_I} title={DROP_ZONE_DATA_I.split('|')[1]}>
          {held ? dropZoneLine(held) : 'Drop gateways, agents, skillsets, worlds or git here'}
        </div>
      </div>
    </div>
  )
}
