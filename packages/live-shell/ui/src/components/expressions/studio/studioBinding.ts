// The Studio on its owner (DLW §20.3; design `expressions:studio`, inhabitants/catalogue/panels/expressions__studio.tsx, 9e57d8fe0; lock
// §0.3.7 "The Studio is the Expression's rack: your chosen controls are its macros, the field devices stand in its chains"; R4). The
// design's value keys, filled from the Expression's own record as the retained native editor reads it (NativeEditorReading), and each
// change sent through the editor's own request — the owner reads the documentation lane mapped each key to (side-session note
// studio-reconciled.md, "Follow-ups 1. The build lead's binding"):
//   • `controls`, `control:<id>`, `shared:<id>` — your chosen controls, the toolbelt (Journey.shared.toolbelt, the boundary's chosen
//     controls: expressions-boundary/src/chosenControls.ts readNativeChosenControls), their values (base_value) and whether a Field
//     control's parameter is shared across the Expression (the reading's `sharedTargets`, Journey.shared.values); a value goes as the
//     editor's `parameter` change, All scenes as its `shared-setting` change; remove, order and reach as `chosen-remove`, `chosen-order`
//     and `chosen-scope` (ported from components/NativeChosenControls.tsx: ChosenDial's send :48-63, the order :106-113, the scope :207-211,
//     the removal :213);
//   • `devices`, `on:<family>` — the field devices in four chains, the holder table's (inhabitants/sdk/semantics.ts STUDIO_SECTIONS), each
//     with its owner's summary and, where the owner has an on/off (components/nativeFieldFaceModel.ts StripToggle), its light and its
//     switch (components/nativeDeviceStripModel.ts stripToggleChanges — Physics, Ink, Pointer and Focus have none, so their `on:` is
//     absent); the torus row says its owner waits (quaternalLogicFamilyManifest.ts admission);
//   • `on:nara` — the frame's own Nara control (its chrome's `nara` home, frameChrome.tsx), pressed through the frame's one runner;
//   • `save`, `undo`, `redo` — the editor's own `save`, `undo`, `redo` requests; `open`, `scene`, `dirty`, `pending`, `canUndo`, `canRedo`
//     its reading (basis, standing, history);
//   • `show`, `pane`, `add` — the place's own acts (DesignBinding.local): a device whole in the pool, full in a pane; + Parameter opens the
//     browser's parameters (NativeChosenControls.tsx browse, PARAMETER_BROWSE_EVENT).
// A key the owner does not report is absent. Pure: no React, no owner call (the ports carry them).
import type {NativeChosenControlReading, NativeEditorChange, NativeEditorReading, NativeEditorReply, NativeEditorRequest} from '@epilogos/expressions-boundary/editor'
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../../../frame/devices/designed'
import type {RackDevice} from '../../nativeDeviceCatalogue'
import {stripToggleChanges} from '../../nativeDeviceStripModel'

/** The Studio's id on the door and its design (`expressions:studio`). */
export const STUDIO_DESIGN = 'expressions:studio'
export const STUDIO_DEVICE_ID = 'expressions:studio'

export type StudioChain = 'material' | 'motion' | 'body' | 'nara'
/** The chain each holder of the table is (semantics.ts STUDIO_SECTIONS ids). */
export const CHAIN_OF_HOLDER: Readonly<Record<string, StudioChain>> = {'studio:material': 'material', 'studio:motion': 'motion', 'studio:body': 'body', 'studio:nara': 'nara'}

/** One row of the design's `devices` (expressions__studio.tsx:24-26). */
export interface StudioDeviceRow {
  readonly family: string
  readonly name: string
  readonly chain: StudioChain
  readonly toggle: boolean
  readonly says: string | null
  readonly why: string | null
}

/** A chain of the holder table with the devices it holds: the catalogue's field devices, the Quaternal Logic faces (Body), and — for
 * Nara — none of its own (the frame's instrument). */
export interface StudioChainHolding {
  readonly chain: StudioChain
  readonly field: readonly Pick<RackDevice, 'family' | 'name' | 'toggle' | 'enabled' | 'summary'>[]
  readonly ql: readonly {readonly id: string; readonly title: string; readonly waiting: boolean}[]
}

/** The frame's Nara control as the Studio reads it: pressed (open) or not, or why there is none. */
export interface StudioNara {
  readonly pressed?: boolean
  /** Why the frame offers no Nara control here (none published, no frame mounted); absent when it offers one. */
  readonly why?: string
}

export interface StudioInput {
  readonly reading: NativeEditorReading | null
  readonly chains: readonly StudioChainHolding[]
  readonly nara: StudioNara
}

const TORUS_WAITS = 'The torus waits for its owner in Expressions: the Quaternal Logic torus face is not admitted yet.'
const NO_NARA = 'The frame publishes no Nara control here.'

/** A chosen control's design row from the owner's resolution (NativeChosenControls.tsx ChosenDial: the label without its entity prefix,
 * the binding's range, step, scale, default and unit, what the field plays, the lock, why it is unavailable). */
export function controlRow(entry: {id: string; key: string; scope: 'field' | 'selected' | 'named'}, control: NativeChosenControlReading | undefined, reading: NativeEditorReading): Record<string, Value | null> {
  const binding = control?.binding ?? null
  const subject = entry.scope === 'field' ? null : control?.entity_id ? reading.scene.entities.find(entity => entity.id === control.entity_id)?.name ?? null : null
  const unavailable = !control || !binding || control.target === null || control.base_value === null || !Number.isFinite(control.base_value)
  const plays = control?.effective_value
  return {
    id: entry.id, label: binding?.label.replace(/^Entity \d+ · /, '') ?? entry.key, scope: entry.scope, subject,
    min: unavailable ? null : binding!.min, max: unavailable ? null : binding!.max,
    step: binding && binding.step > 0 ? binding.step : null, log: !!binding && binding.scale === 'log' && binding.min > 0,
    def: binding && Number.isFinite(binding.defaultValue) ? binding.defaultValue : null, unit: binding?.unit ?? null,
    plays: typeof plays === 'number' && Number.isFinite(plays) ? plays : null, locked: !!control?.locked,
    why: unavailable ? control?.unavailable_reason ?? 'The native owner has not resolved this retained declaration.' : null,
  }
}

/** The four chains' rows, in the holder table's order (the design's `devices`). */
export function studioDeviceRows(input: StudioInput): StudioDeviceRow[] {
  const {reading, nara} = input
  return input.chains.flatMap(holding => {
    if (holding.chain === 'nara') {
      return [{family: 'nara', name: 'Nara', chain: 'nara' as const, toggle: nara.why === undefined, says: nara.pressed === undefined ? null : nara.pressed ? 'Open' : 'Closed', why: nara.why ?? null}]
    }
    const field = holding.field.map((device): StudioDeviceRow => ({family: device.family, name: device.name, chain: holding.chain, toggle: device.toggle !== null,
      says: reading ? device.summary(reading) : null, why: reading ? null : 'Open a native Expression to read it.'}))
    const ql = holding.ql.map((face): StudioDeviceRow => ({family: face.id, name: face.title, chain: holding.chain, toggle: false, says: null,
      why: face.waiting ? (face.id === 'torus' ? TORUS_WAITS : `${face.title} waits for its owner.`) : null}))
    return [...field, ...ql]
  })
}

const put = (values: Record<string, Value>, key: string, value: Value | null | undefined) => {
  if (value !== null && value !== undefined && !(typeof value === 'number' && !Number.isFinite(value))) values[key] = value
}

/** The Studio's values: each key from the owner that reports it, or absent. */
export function studioValues(input: StudioInput): Values {
  const {reading} = input
  const values: Record<string, Value> = {}
  // The light: a native Expression is open. With no reading the frame's editor reports none open.
  values.open = reading !== null
  values.devices = JSON.stringify(studioDeviceRows(input))
  if (input.nara.pressed !== undefined) values['on:nara'] = input.nara.pressed
  if (!reading) return values
  put(values, 'scene', reading.scene.name)
  values.dirty = reading.standing.dirty
  values.pending = reading.standing.pending
  values.canUndo = reading.history.canUndo
  values.canRedo = reading.history.canRedo
  const chosen = reading.chosenControls
  if (chosen?.available) {
    const shared = reading.sharedTargets ? new Set(reading.sharedTargets) : null
    const rows = chosen.entries.map(entry => {
      const control = chosen.controls.find(item => item.entry_id === entry.id)
      if (control && control.base_value !== null && Number.isFinite(control.base_value)) values[`control:${entry.id}`] = control.base_value
      // All scenes: a Field control's parameter, shared or not — absent on an older reading that names no shared targets.
      if (entry.scope === 'field' && shared && control?.target) values[`shared:${entry.id}`] = shared.has(control.target)
      return controlRow(entry, control, reading)
    })
    values.controls = JSON.stringify(rows)
  }
  for (const holding of input.chains) for (const device of holding.field) {
    if (!device.toggle) continue
    put(values, `on:${device.family}`, device.enabled(reading))
  }
  return values
}

export interface StudioPorts {
  /** The retained editor's one request (its apply, save, undo and redo). */
  readonly request: (request: NativeEditorRequest) => Promise<NativeEditorReply>
  /** + Parameter: the browser's parameters. */
  readonly browse: () => void
  /** A chain's device whole in the pool, and full in a pane (by family). */
  readonly show: (family: string) => void
  readonly pane: (family: string) => void
  /** Press the frame's Nara control (null: the frame offers none). */
  readonly nara: (() => void) | null
}

const reasonOf = (reply: NativeEditorReply) => (reply.ok ? null : reply.error)

/** The Studio's binding. */
export function studioBinding(input: StudioInput, ports: StudioPorts): DesignBinding {
  const {reading} = input
  const standing: Record<string, Standing> = {}
  if (input.nara.why) standing['on:nara'] = {disabled: input.nara.why}
  const send = async (changes: NativeEditorChange[]) => {
    if (!reading) throw Error('Open a native Expression first.')
    const reply = await ports.request({operation: 'apply', basis: reading.basis, changes})
    const refused = reasonOf(reply)
    if (refused) throw Error(refused)
  }
  const entries = reading?.chosenControls?.entries ?? []
  const controlOf = (id: string) => reading?.chosenControls?.controls.find(item => item.entry_id === id)
  const fieldDevice = (family: string) => input.chains.flatMap(holding => holding.field).find(device => device.family === family)
  return {
    id: STUDIO_DEVICE_ID,
    values: studioValues(input),
    standing,
    enabledKey: 'open',
    local: {
      add: value => { if (value === true) ports.browse() },
      show: value => { if (typeof value === 'string' && value) ports.show(value) },
      pane: value => { if (typeof value === 'string' && value) ports.pane(value) },
    },
    writes: key => ['save', 'undo', 'redo', 'earlier', 'later', 'remove', 'follow', 'bind'].includes(key) || key.startsWith('control:') || key.startsWith('shared:') || key.startsWith('on:'),
    write: async (changes: readonly ValueChange[]) => {
      for (const {key, value} of changes) {
        if (key === 'save' || key === 'undo' || key === 'redo') {
          if (!reading) throw Error('Open a native Expression first.')
          const refused = reasonOf(await ports.request({operation: key, basis: reading.basis}))
          if (refused) throw Error(refused)
          continue
        }
        if (key.startsWith('control:')) {
          const control = controlOf(key.slice('control:'.length))
          if (!control?.binding || !control.target) throw Error(control?.unavailable_reason ?? 'The native owner has not resolved this control.')
          const next = Number(value)
          if (!Number.isFinite(next) || next < control.binding.hardMin || next > control.binding.hardMax) throw Error(`Range ${control.binding.hardMin}–${control.binding.hardMax}`)
          await send([{kind: 'parameter', target: control.target, value: next}])
          continue
        }
        if (key.startsWith('shared:')) {
          const id = key.slice('shared:'.length)
          const entry = entries.find(item => item.id === id), control = controlOf(id)
          if (!entry || entry.scope !== 'field' || !control?.target) throw Error('Only a Field control can hold for every scene.')
          await send([{kind: 'shared-setting', target: control.target, shared: value === true}])
          continue
        }
        if (key === 'earlier' || key === 'later') {
          const ids = entries.map(entry => entry.id), at = ids.indexOf(String(value)), to = at + (key === 'earlier' ? -1 : 1)
          if (at < 0 || to < 0 || to >= ids.length) continue
          const next = [...ids]; next.splice(at, 1); next.splice(to, 0, ids[at]!)
          await send([{kind: 'chosen-order', entry_ids: next}])
          continue
        }
        if (key === 'remove') { await send([{kind: 'chosen-remove', entry_id: String(value)}]); continue }
        if (key === 'follow') { await send([{kind: 'chosen-scope', entry_id: String(value), scope: 'selected'}]); continue }
        if (key === 'bind') {
          const id = String(value)
          const entity = controlOf(id)?.entity_id ?? (reading && reading.selection.entity_ids.length === 1 ? reading.selection.entity_ids[0] : null)
          if (!entity) throw Error('Select the one symbol to bind it to first.')
          await send([{kind: 'chosen-scope', entry_id: id, scope: 'named', entity_id: entity}])
          continue
        }
        if (key === 'on:nara') {
          if (!ports.nara || input.nara.why) throw Error(input.nara.why ?? NO_NARA)
          if (input.nara.pressed !== (value === true)) ports.nara()
          continue
        }
        if (key.startsWith('on:')) {
          const device = fieldDevice(key.slice('on:'.length))
          if (!device?.toggle) throw Error(`${device?.name ?? key.slice(3)} has no on and off: it is always part of the field.`)
          await send(stripToggleChanges(device, value === true))
          continue
        }
        throw Error(`${key} is a reading: its owner reports it; nothing here changes it.`)
      }
    },
  }
}
