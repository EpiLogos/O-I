// Link in the transport (manual §19.19: "Link is the transport's Link button, as Live's is: press it to join, and ▾ beside it expands
// its settings"; §16.1: a connection, "Link stands in the transport. Never on a track's chain"): one Link in every mode, the same device
// the rail's tile and a pane's Full draw. Its readings and its refusals are the Link's own binding (agent/devices/workcellBindings.ts
// linkBinding: Workcell's status, AIKit's population `gateway who` and its declared remotes `gateway remote list`); this slot publishes
// the device on the door, so the rail and a pane hold it, and draws its button and ▾. ▾ shows its Whole beneath the transport; Esc or a
// press outside folds it. The button joins and leaves the link only through the owner's operation, which does not exist yet: it stands
// disabled with that operation's name (LINK_REFUSE.link).
import {useContext, useEffect, useMemo, useRef, useState} from 'react'
import {Workspace} from '../../shell/workspaceContext'
import {useWorkcellAnswer} from '../../owners/readers'
import {usePopulationAnswer} from '../../agent/devices/usePopulationAnswer'
import {useGatewayRemotesAnswer} from '../../agent/devices/workcellReads'
import {useChainHolds} from '../../agent/devices/designBindings'
import {registerOf, ROOT_REGISTER} from '../../agent/worldScope'
import {LINK_ID, LINK_REFUSE, linkBinding, workcellDevices} from '../../agent/devices/workcellBindings'
import type {KernelTransportStatus} from '../../../../../../desktop/cradle/src/kernel/types'
import {publishDevice} from '../devices/deviceDoor'
import {PlacedDevice} from '../devices/DeviceView'
import type {SlotWords} from './slots'

const NO_CARRIER: KernelTransportStatus = {kind: 'unavailable', reason: 'The shell has published no kernel carrier here.'}

/** The button's words (§19.19 Widget: "the peers and the link state"): Link, with the count of machines that answered, else the
 * link's state, from the binding's own readings. Pure. */
export function linkButtonWords(values: Readonly<Record<string, unknown>>, words?: Pick<SlotWords, 'label' | 'fn'>): {lit: boolean | undefined; title: string} {
  const machines = (() => { try { return typeof values.machines === 'string' ? JSON.parse(values.machines) as Record<string, unknown>[] : null } catch { return null } })()
  const others = machines?.filter(machine => !machine.self) ?? []
  const answered = others.filter(machine => machine.state === 'answered').length
  const lit = values.light === 'lit' ? true : values.light === 'dark' ? false : undefined
  const state = !machines ? 'unread: no owner has answered for the link yet' : others.length === 0 ? 'no other machine is declared'
    : `${answered} of ${others.length} ${others.length === 1 ? 'machine answers' : 'machines answer'}`
  const meaning = words ? `${words.label} — ${words.fn}` : 'Link — joins this machine to your others: one ledger, one clock (§19.19)'
  return {lit, title: `${meaning}. ${state}. ${LINK_REFUSE.link}`}
}

/** `words`: the mode's word and meaning for the slot (manual §10.5: Central's Ground, Factory's Link …); the device is the same Link. */
export function LinkSlot({words}: {words?: SlotWords}) {
  const workspace = useContext(Workspace)
  const transport = workspace?.transport ?? NO_CARRIER
  const workcell = useWorkcellAnswer(transport).reading
  // The Link's population is the world's whole: the root register, named by no project world (agent/worldScope.ts).
  const population = usePopulationAnswer(transport, registerOf(ROOT_REGISTER))
  const remotes = useGatewayRemotesAnswer(transport).reading
  const holds = useChainHolds()
  const binding = useMemo(() => linkBinding(workcell, holds, population, remotes), [workcell, holds, population, remotes])
  const device = useMemo(() => workcellDevices().link, [])
  // One publisher in every mode: the rail's tile and a pane's Full draw this same device on this same binding.
  useEffect(() => { if (device) publishDevice(LINK_ID, {device, binding}) }, [device, binding])
  useEffect(() => () => { publishDevice(LINK_ID, null) }, [])
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => { if (!(event.target instanceof Node) || !root.current?.contains(event.target)) setOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', escape) }
  }, [open])
  const {lit, title} = linkButtonWords(binding.values, words)
  const face = words?.face ?? words?.label ?? 'Link'
  const light = lit === undefined ? undefined : lit ? 'on' : 'off'
  return <span ref={root} className="transport-slot transport-link">
    <button type="button" className="native-control transport-text transport-word" data-slot="link" data-light={light} aria-label={words?.label ?? 'Link'} aria-pressed={binding.values.link === true}
      data-i={`${words?.label ?? 'Link'}|${title}`} title={title} disabled aria-disabled>{face}</button>
    <button type="button" className="native-control transport-link-more" aria-label="Link's settings" aria-expanded={open}
      data-i="Link ▾|Shows the Link's settings beneath the transport: its machines, Share, the peers and the lag." title="Show the Link's settings"
      onClick={() => setOpen(was => !was)}>▾</button>
    {open && device && <span className="transport-link-band dp-wide" data-claims-keys="escape" role="dialog" aria-label="Link">
      <PlacedDevice device={device} view="whole" frame="flip" binding={binding} />
    </span>}
  </span>
}
