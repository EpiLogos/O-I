// Factory's agent chain as devices of the runtime (manual §6, §10.4; lock §2.3; ticket T-DEVICES-FACTORY): gateway → agent →
// skills → scope → landing, each one a DeviceInstance the three sizes draw. Pure: the rows are the verified address table's
// (inhabitants/agentParamAddresses.ts:67-105, reused unchanged), the slots and their Live semantics are the admitted
// manifests' (inhabitants/agentDeviceCatalogue.ts:33-85), the readings are the owners' (the chain's reads, ported to
// useAgentChainReading.ts), and a write goes where the row's own write path says, through the one resolver
// (agentNativeDispatch.ts:66, injected here as `write`). A row without a write path is a reading; a light is the owner's
// reading and dark when unknown; nothing here invents a value, a default or a control. The shell's own flags (effort, steer,
// heartbeat, write arm — agent/AgentShellContext.tsx) are the shell's presentation of a press with the defaults it starts
// with, never a reading: a row shows only what an owner disclosed, or what an owner accepted (ownerAccepted.ts), and is
// otherwise unknown.
import type {DeviceDeclaration, SdkParamRow} from '../../inhabitants/sdk/define'
import type {IconName} from '../../inhabitants/sdk/icons'
import type {DispatchReceipt} from '../../inhabitants/sdk/shellSetters'
import type {DeviceInstance, ParamValue} from '../../frame/devices/deviceRuntime'
import {agentAddress, agentAddressesForDevice, type AgentParamAddress} from '../../inhabitants/agentParamAddresses'
import {deriveAgentDeviceRows, type AgentDeviceRow} from '../../inhabitants/agentDeviceCatalogue'
import {allFamilyManifests} from '../../inhabitants/familyManifest'
import {CHAIN_SLOTS, type AgentChainSlotId} from '../agentChainDrag'
import type {OwnerAcceptedValues} from './ownerAccepted'

type Obj = Record<string, unknown>
const isObj = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value)
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

export type ChainSlotId = AgentChainSlotId

/** The device id each slot publishes under at the door. */
export const chainDeviceId = (slot: string): string => `factory:${slot}`
export const CHAIN_DEVICE_IDS: readonly string[] = CHAIN_SLOTS.map(chainDeviceId)

// ---------------------------------------------------------------------------
// the owners' readings (the shape the chain's reads fill; null = not read yet)

/** One owner's reading, structured as the chain cards had it (NativeAgentDeviceRack.tsx:47-52): what the card says in one
 * line, with the verbatim receipt folded. */
export interface OwnerReading {
  kind: 'reading' | 'refused'
  title: string
  line: string
  receipt: string | null
}

/** One skill chain of the rack: a skill ref a roster profile carries, lit when an accepted profile carries it. */
export interface SkillChain {
  ref: string
  admitted: boolean
  carriedBy: readonly string[]
}

export interface AgentChainReading {
  gateway: OwnerReading
  /** The harness answered the read (the gateway lamp is earned by an answered reading, never assumed). Null while reading. */
  gatewayAdmitted: boolean | null
  /** The harness's own document, for the fields it discloses. */
  gatewayDoc: unknown
  git: OwnerReading
  /** The workcell seat answered. Null while reading. */
  gitAdmitted: boolean | null
  gitRepo: {branch?: string; uncommitted?: number}
  /** Who each unlit lamp waits on (P0-R4): the owner of the refused reading, or null while reading / once admitted. */
  waitingOn: {gateway: string | null; skillset: string | null; git: string | null}
  /** The roster's skill chains. Null while the roster is being read. */
  chains: readonly SkillChain[] | null
  skillsNote: string | null
  identity: string | null
  budget: {used?: number; cap?: number} | null
  autonomy: string | null
  /** The owner disclosed a task record for the selected session (encounter_task_read). The agent's light reads it: the shell's
   * selection is the person's choice, not the owner saying the agent is on the session. Null until the owner has said so. */
  attached: boolean | null
}

export const INITIAL_READING: AgentChainReading = {
  gateway: {kind: 'reading', title: 'Gateway · hermes', line: 'Reading gateway…', receipt: null},
  gatewayAdmitted: null,
  gatewayDoc: null,
  git: {kind: 'reading', title: 'Git', line: 'Reading seat…', receipt: null},
  gitAdmitted: null,
  gitRepo: {},
  waitingOn: {gateway: null, skillset: null, git: null},
  chains: null,
  skillsNote: 'Reading roster…',
  identity: null,
  budget: null,
  autonomy: null,
  attached: null,
}

export interface AgentChainInput {
  sessionRef: string | null
  reading: AgentChainReading
  /** The settings an owner accepted on the bound harness (ownerAccepted.ts); empty until one has. */
  accepted: OwnerAcceptedValues
}

// ---------------------------------------------------------------------------
// reading parsers — ported unchanged from the chain's reads (AgentDeviceChain.tsx:26-62, 152-164)

/** Accepted roster agents that carry skill refs (AgentDeviceChain.tsx:26-35). */
export function rosterAdmits(data: unknown): number {
  if (!isObj(data) || !Array.isArray(data.profiles)) return 0
  let count = 0
  for (const entry of data.profiles) {
    if (!isObj(entry) || entry.accepted !== true) continue
    const profile = isObj(entry.profile) ? entry.profile : {}
    if (strings(profile.skill_refs).length > 0) count += 1
  }
  return count
}

/** The first accepted roster identity (AgentDeviceChain.tsx:38-46). */
export function rosterIdentity(data: unknown): string | null {
  if (!isObj(data) || !Array.isArray(data.profiles)) return null
  for (const entry of data.profiles) {
    if (!isObj(entry) || entry.accepted !== true) continue
    const profile = isObj(entry.profile) ? entry.profile : {}
    if (typeof profile.agent_ref === 'string') return profile.agent_ref
  }
  return null
}

/** A short honest line for an answered harness reading: the fields it actually discloses, named (AgentDeviceChain.tsx:50-62). */
export function gatewayLine(doc: unknown): string {
  if (isObj(doc)) {
    if ('refused' in doc) {
      const reason = isObj(doc.refused) && typeof doc.refused.message === 'string' ? doc.refused.message : undefined
      return `the gateway refused the read${reason ? ` — ${reason}` : ''}`
    }
    const named = ['schema', 'binding', 'state', 'status', 'purpose', 'session_ref']
      .map(key => (typeof doc[key] === 'string' || typeof doc[key] === 'number') ? `${key} ${String(doc[key])}` : null)
      .filter(Boolean)
    if (named.length) return named.join(' · ')
  }
  return 'answered — see the receipt for the full document'
}

/** The roster's skill chains (new): every skill ref a profile carries, lit when an accepted profile carries it — the
 * disclosure law made physical (carried is not loaded). The same accepted refs the Skillsets browser lists
 * (AgentShellBrowser.tsx:66-79); a ref only an unaccepted profile carries stands dark. */
export function rosterChains(data: unknown): SkillChain[] {
  if (!isObj(data) || !Array.isArray(data.profiles)) return []
  const byRef = new Map<string, {admitted: boolean; carriedBy: string[]}>()
  for (const entry of data.profiles) {
    if (!isObj(entry)) continue
    const profile = isObj(entry.profile) ? entry.profile : {}
    const carrier = typeof profile.agent_ref === 'string' ? profile.agent_ref : typeof profile.name === 'string' ? profile.name : null
    for (const ref of strings(profile.skill_refs)) {
      if (!ref) continue
      const held = byRef.get(ref) ?? {admitted: false, carriedBy: []}
      if (entry.accepted === true) held.admitted = true
      if (carrier && !held.carriedBy.includes(carrier)) held.carriedBy.push(carrier)
      byRef.set(ref, held)
    }
  }
  return [...byRef].sort(([a], [b]) => a.localeCompare(b)).map(([ref, held]) => ({ref, admitted: held.admitted, carriedBy: held.carriedBy}))
}

/** The values a task record discloses for the agent rows (AgentDeviceChain.tsx:152-164). */
export function taskReading(data: unknown): {used?: number; cap?: number; autonomy?: string} {
  if (!isObj(data)) return {}
  const turns = isObj(data.turns) ? data.turns : undefined
  const used = turns?.used ?? data.turns_used
  const cap = turns?.cap ?? data.turn_budget ?? data.budget_cap
  const custody = data.custody ?? data.autonomy
  return {
    ...(typeof used === 'number' ? {used} : {}),
    ...(typeof cap === 'number' ? {cap} : {}),
    ...(typeof custody === 'string' ? {autonomy: custody} : {}),
  }
}

/** The git seat's branch and uncommitted files, as the repository owner discloses them (the cradle reads the same op:
 * desktop/cradle/src/git/RepositoryContext.tsx:5 — head_branch, and per worktree dirty_files). */
export function gitRepoReading(doc: unknown): {branch?: string; uncommitted?: number} {
  if (!isObj(doc)) return {}
  const branch = typeof doc.head_branch === 'string' && doc.head_branch ? doc.head_branch : undefined
  const here = Array.isArray(doc.worktrees) ? doc.worktrees.find(tree => isObj(tree) && tree.path === doc.repo_root) : undefined
  const dirty = isObj(here) && typeof here.dirty_files === 'number' ? here.dirty_files : undefined
  return {...(branch ? {branch} : {}), ...(dirty !== undefined ? {uncommitted: dirty} : {})}
}

/** The gateway rows' values, only where the harness's own document discloses them under the carrier's own field names
 * (harnessAgentControl.ts:14-25) and inside the row's declared choices. Anything else stays unknown. */
export function gatewayDisclosed(doc: unknown): Record<string, ParamValue> {
  if (!isObj(doc) || 'refused' in doc) return {}
  const out: Record<string, ParamValue> = {}
  const state = typeof doc.state === 'string' || typeof doc.state === 'number' ? doc.state : typeof doc.status === 'string' || typeof doc.status === 'number' ? doc.status : undefined
  if (state !== undefined && state !== '') out.readiness = String(state)
  for (const key of ['transport', 'approvals'] as const) {
    const choices = agentAddress('gateway', key)?.values ?? []
    const held = doc[key]
    if (typeof held === 'string' && choices.includes(held)) out[key] = held
  }
  if (typeof doc.connect === 'boolean') out.connect = doc.connect
  return out
}

/** The agent's budget line: used over cap, only as far as the task record discloses it. */
export function budgetLine(budget: AgentChainReading['budget']): string | undefined {
  if (!budget || typeof budget.used !== 'number') return undefined
  return typeof budget.cap === 'number' ? `${budget.used} / ${budget.cap}` : String(budget.used)
}

// ---------------------------------------------------------------------------
// the rows of each device

interface RowPlan {
  group: string
  compact?: boolean
  /** A macro, and only with the mapping its owner declares: at least one row of this device, each with a range (lock §0.1,
   * §5.3). A row that cannot name its mapping is not a macro, so there is no way to plan one without it. */
  macro?: NonNullable<SdkParamRow['macro']>
  /** The table declares a write for this row but no domain to draw a control on: the device keeps it a reading. */
  unwritten?: string
}

const GATEWAY_STALL = 'The table declares the write but no domain for it (the gateway judges the threshold), so no knob is drawn.'

/** Group and compact choices per row (the mockups' own: agent-device-mockup.html:512-520 the agent's compact controls, :562-590
 * the pool's groups; world-shell-mockup.html:1425-1431 the Factory chain's). Insertion order is the whole view's order. */
const PLAN: Readonly<Record<string, Readonly<Record<string, RowPlan>>>> = {
  gateway: {
    transport: {group: 'Connection', compact: true},
    approvals: {group: 'Connection', compact: true},
    connect: {group: 'Connection', compact: true},
    'stall-after': {group: 'Connection', unwritten: GATEWAY_STALL},
    readiness: {group: 'Reading', compact: true},
    frames: {group: 'Reading'},
    spend: {group: 'Reading'},
  },
  agent: {
    autonomy: {group: 'Autonomy', compact: true},
    effort: {group: 'Autonomy', compact: true},
    'budget-used': {group: 'Budget', compact: true},
    input: {group: 'Steering', compact: true},
    heartbeat: {group: 'Steering'},
    model: {group: 'Runtime'},
    identity: {group: 'Runtime'},
  },
  // The rack's four settings are ai-kit readings that no owner writes (agentParamAddresses.ts: "macros have no live source"), and
  // ai-kit declares no mapping from them to any row. They stand as readings under "Settings", not as macros, until ai-kit
  // declares which rows each one turns and across what range (then a `macro` goes on the row, and macroFaults checks it).
  skillset: {
    thoroughness: {group: 'Settings'},
    'test-depth': {group: 'Settings'},
    reach: {group: 'Settings'},
    risk: {group: 'Settings'},
  },
  world: {
    reads: {group: 'Scope'},
    writes: {group: 'Scope'},
    'knowledge-route': {group: 'Scope'},
    'write-mode': {group: 'Writes', compact: true},
    'write-receipts': {group: 'Writes'},
  },
  git: {
    branch: {group: 'Seat'},
    uncommitted: {group: 'Seat'},
    'commit-policy': {group: 'Policy', compact: true},
    'push-policy': {group: 'Policy', compact: true},
    land: {group: 'Policy', compact: true},
  },
}

/** Row titles (AgentDevicePool.tsx:36-48, unchanged). */
const LABELS: Readonly<Record<string, string>> = {
  'stall-after': 'Stall-after',
  'budget-used': 'Budget',
  'test-depth': 'Test depth',
  'knowledge-route': 'Knowledge route',
  'write-mode': 'Write mode',
  'write-receipts': 'Receipts',
  'commit-policy': 'Commit',
  'push-policy': 'Push',
}
export const rowTitle = (key: string): string => LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1)

function deviceRow(address: AgentParamAddress, plan: RowPlan | undefined, fallbackGroup: string): SdkParamRow {
  const {writePath, ...rest} = address
  const withheld = plan?.unwritten
  return {
    ...rest,
    title: rowTitle(address.key),
    group: plan?.group ?? fallbackGroup,
    ...(plan?.compact ? {compact: true} : {}),
    // A macro maps what the owner maps; the plan carries the mapping or the row claims none.
    ...(plan?.macro ? {macro: plan.macro} : {}),
    ...(withheld ? {disclosure: address.disclosure ? `${address.disclosure} ${withheld}` : withheld} : writePath ? {writePath} : {}),
  } as SdkParamRow
}

/** The macro invariant at the instance (lock §0.1: "a macro maps at least one row with a range, or it is not a macro"; §5.3:
 * "maps ≥1 declared row of its own device, with ranges"). The face gate checks a macro face's declaration; this checks the rows an
 * instance actually draws, so a row cannot claim the semantic by carrying an empty or foreign mapping. Every fault is named. */
export function macroFaults(device: string, rows: readonly SdkParamRow[]): string[] {
  const faults: string[] = []
  const byKey = new Map(rows.map(row => [row.key, row] as const))
  for (const row of rows) {
    if (!row.macro) continue
    const where = `${device}/${row.key}`
    if (row.macro.maps.length < 1) {
      faults.push(`${where}: a macro maps at least one declared row of its own device, and this one maps none`)
      continue
    }
    for (const map of row.macro.maps) {
      const mapped = byKey.get(map.key)
      if (!mapped || mapped.key === row.key) {
        faults.push(`${where}: maps "${map.key}", which is no other row of this device`)
        continue
      }
      if (typeof map.min !== 'number' || typeof map.max !== 'number' || !Number.isFinite(map.min) || !Number.isFinite(map.max) || map.min > map.max) {
        faults.push(`${where}: its map of "${map.key}" has no range (a min and a max, the min not above the max)`)
        continue
      }
      const min = mapped.range?.min, max = mapped.range?.max
      if ((min !== undefined && map.min < min) || (max !== undefined && map.max > max)) {
        faults.push(`${where}: its map of "${map.key}" [${map.min}, ${map.max}] leaves that row's own range [${min ?? '-inf'}, ${max ?? 'inf'}]`)
      }
    }
  }
  return faults
}

/** The rows of one chain device: every address of the table for the slot, in the plan's order, none invented and none
 * dropped (a row the plan does not know stands under "Other"). */
export function slotRows(slot: string): SdkParamRow[] {
  const plan = PLAN[slot] ?? {}
  const addresses = agentAddressesForDevice(slot)
  const planned = Object.keys(plan).flatMap(key => addresses.filter(address => address.key === key))
  const rest = addresses.filter(address => !(address.key in plan))
  return [...planned, ...rest].map(address => deviceRow(address, plan[address.key], 'Other'))
}

// ---------------------------------------------------------------------------
// the declaration, the values and the light of each device

/** The chain faces' marks, as the kit adopts them (sdk/adoptVerifiedRows.ts:33-48). */
const MARKS: Readonly<Record<string, IconName>> = {gateway: 'link', agent: 'form', skillset: 'lib', world: 'orbit', git: 'chain'}

/** The row whose reading is each device's light. The world device has none: the only state it could light from is the write arm,
 * and the dispatcher calls that the shell's presentation-state and refuses it (agentNativeDispatch.ts), so no owner reports it.
 * When the apply path (WO-SF2) reports the write standing, the key goes here. */
const LIGHT_KEY: Readonly<Record<string, string>> = {gateway: 'admitted', agent: 'attached', skillset: 'admitted', git: 'admitted'}

/** The slot's declaration: its primary face from the admitted manifests, with that face's Live semantic and invariant. The
 * rack declares the chains it actually holds. */
export function slotFace(slot: AgentDeviceRow, chains: readonly SkillChain[] | null): DeviceDeclaration {
  const ref = slot.faces[0]!
  const face = allFamilyManifests().find(manifest => manifest.id === ref.family)?.faces.find(candidate => candidate.id === ref.faceId)
  if (!face) throw Error(`The ${slot.id} slot names a face the door has not admitted: ${ref.family}:${ref.faceId}`)
  const held = face.liveSemantic === 'rack' && chains && chains.length > 0 ? chains : null
  return {
    id: ref.faceId, title: slot.title, icon: MARKS[slot.id] ?? 'form', liveSemantic: face.liveSemantic,
    ...(held ? {invariant: {chains: held.map(chain => chain.ref), chainSelector: face.invariant?.chainSelector ?? 'skill (admit light)'}}
      : face.invariant ? {invariant: face.invariant} : {}),
    ...(face.note ? {note: face.note} : {}),
    ...(face.heldBy ? {heldBy: face.heldBy} : {}),
  }
}

function slotValues(slot: string, input: AgentChainInput): Record<string, ParamValue> {
  const {reading, accepted, sessionRef} = input
  const values: Record<string, ParamValue> = {}
  const put = (key: string, value: ParamValue | null | undefined) => { if (value !== null && value !== undefined && value !== '') values[key] = value }
  switch (slot) {
    case 'gateway':
      put('admitted', reading.gatewayAdmitted)
      for (const [key, value] of Object.entries(gatewayDisclosed(reading.gatewayDoc))) put(key, value)
      break
    case 'agent':
      // The light is the owner's task record for the session, not the shell's selection of it (and with no session selected there
      // is no record to read).
      put('attached', sessionRef != null ? reading.attached : null)
      // Effort and input are what an owner accepted. The shell's own effort ('high') and steer (on) are defaults it starts with,
      // and its heartbeat flag (on) is presentation-state the dispatcher refuses: none of them is a reading, so none is put.
      put('effort', accepted.effort)
      put('input', accepted.input)
      put('autonomy', reading.autonomy)
      put('budget-used', budgetLine(reading.budget))
      put('identity', reading.identity)
      break
    case 'skillset':
      put('admitted', reading.chains ? reading.chains.some(chain => chain.admitted) : null)
      break
    case 'world':
      // Nothing: write-mode would read the shell's write-arm flag, which the dispatcher calls presentation-state (no write flow
      // reads it; WO-SF2). The row stays unknown, and so does the device's light.
      break
    case 'git':
      put('admitted', reading.gitAdmitted)
      put('branch', reading.gitRepo.branch)
      put('uncommitted', reading.gitRepo.uncommitted)
      break
  }
  return values
}

// ---------------------------------------------------------------------------
// writes — through the row's own write path, and nowhere else

export type ChainWrite = (row: SdkParamRow, value: unknown) => Promise<DispatchReceipt>

/** The value a row's owner setter takes. The shell's steer and write-arm setters take a boolean (AgentShellTransport.tsx:89,91,
 * the transport's own calls); the rows are enumerated, so the choice is carried the way the transport carries it. The write
 * arm's `draft` has no writer (the address's own disclosure), so it is refused by name. */
export function carryValue(row: SdkParamRow, value: ParamValue): {ok: true; value: ParamValue} | {ok: false; reason: string} {
  if (row.writePath === 'shell.setSteer') return {ok: true, value: value === 'steer'}
  if (row.writePath === 'shell.setWriteArm') {
    if (value === 'direct') return {ok: true, value: true}
    if (value === 'propose') return {ok: true, value: false}
    return {ok: false, reason: row.disclosure ?? `The shell write arm carries propose and direct; "${String(value)}" has no writer.`}
  }
  return {ok: true, value}
}

/** The device's owner write: each changed row goes to its own write path through the one resolver; a refusal comes back in
 * the owner's words and the device keeps the draft. */
export function chainSubmit(rows: readonly SdkParamRow[], write: ChainWrite): NonNullable<DeviceInstance['submit']> {
  return async changes => {
    for (const change of changes) {
      const row = rows.find(candidate => candidate.key === change.key)
      if (!row?.writePath) throw Error(`${change.key}: no owner write is declared for this row`)
      const carried = carryValue(row, change.value)
      if (!carried.ok) throw Error(carried.reason)
      const receipt = await write(row, carried.value)
      if (receipt.kind === 'refused') throw Error(receipt.reason)
    }
  }
}

// ---------------------------------------------------------------------------
// the chain

/** One slot as a device of the runtime. A row that claims a macro without keeping it (no mapping, a mapping onto a row the device
 * does not have, a mapping with no range) refuses the device at admission, the fault named — the lock's gate, at the instance. */
export function agentChainDevice(slot: AgentDeviceRow, input: AgentChainInput, write: ChainWrite): DeviceInstance {
  const rows = slotRows(slot.id)
  const faults = macroFaults(slot.id, rows)
  if (faults.length) throw Error(`The ${slot.id} device claims a macro it does not keep: ${faults.join('; ')}`)
  return {
    id: chainDeviceId(slot.id),
    family: slot.family,
    face: slotFace(slot, slot.id === 'skillset' ? input.reading.chains : null),
    rows,
    values: slotValues(slot.id, input),
    ...(LIGHT_KEY[slot.id] ? {enabledKey: LIGHT_KEY[slot.id]} : {}),
    // A door only where a row can be written: a device of readings (the skills rack's admit lights) offers none.
    ...(rows.some(row => row.writePath) ? {submit: chainSubmit(rows, write)} : {}),
  }
}

/** The chain over the door's current admissions, in the declared order (a slot nothing admitted drops out). */
export function agentChainDevices(input: AgentChainInput, write: ChainWrite): {slot: AgentDeviceRow; device: DeviceInstance}[] {
  return deriveAgentDeviceRows(allFamilyManifests()).map(slot => ({slot, device: agentChainDevice(slot, input, write)}))
}
