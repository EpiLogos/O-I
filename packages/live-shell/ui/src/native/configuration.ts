/** Candidate receiving seam over the existing owner configuration engine. */
import {createLiveConfigPlaneSource} from '../../../../../desktop/cradle/src/configuration/liveSource'
import {createLiveHarnessSource} from '../../../../../desktop/cradle/src/configuration/harnessSource'
import {compactScope} from '../../../../../desktop/cradle/src/configuration/contracts'
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelOp, KernelOutcome, KernelTransportStatus, PresentationDocument} from '../../../../../desktop/cradle/src/kernel/types'
import type {SettingsAdapter, SettingsBasis} from '../settings/adapter'
import type {MachineConnection, MachineOperationResult, RemoteMachineDeclaration, RemoteMachinesSource} from '../settings/machines'
export type {SettingsAdapter, SettingsBasis} from '../settings/adapter'

export interface NativeSettingsContext {
  ownerEpoch: string
  /** True only while the originating World, native owner and access epoch remain current. */
  isCurrent(): boolean
  scopeChoices?: SettingsAdapter['scopeChoices']
  navigate?: SettingsAdapter['navigate']
  /** The renderer's own visual preference store (cradle visuals/store.ts `visuals`), handed in by the caller that already holds it. */
  visuals?: VisualsStoreLike
}
/** The part of the cradle's visual preference store Settings reads and writes. */
export interface VisualsStoreLike {
  get(): {readonly enabled: boolean; readonly welcomeEnabled: boolean}
  subscribe(listener: (snapshot: unknown) => void): () => void
  setEnabled(enabled: boolean): void
  setWelcomeEnabled(enabled: boolean): void
}
export class SettingsConflict extends Error {
  readonly code = 'reading_changed'
  constructor(readonly previous: SettingsBasis, readonly current: SettingsBasis | null) {
    super(`The native reading for ${previous.setting_ref} changed. Read and review the change again.`)
  }
}
const key = (basis: Pick<SettingsBasis,'setting_ref'|'scope'>) => `${basis.setting_ref}|${compactScope(basis.scope)}`

type OpAnswer = {outcome: KernelOutcome | null; error?: string | null}
type Call = (op: KernelOp) => Promise<OpAnswer>

/** One owner route's data (kernel owner_routes.rs answers reads and writes as `owner_route_reading`), or its refusal in its words. */
async function routeData(call: Call, op: KernelOp, what: string): Promise<unknown> {
  const answer = await call(op)
  if (answer.error) throw new Error(answer.error)
  if (answer.outcome?.result !== 'owner_route_reading') throw new Error(`${what} did not answer.`)
  return answer.outcome.data
}
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
const textOr = (value: unknown): string | null => typeof value === 'string' ? value : null

/** The Machines page over Workcell's own declarations and connections (kernel workcell_read machine-list, connections-list,
 * connections-show; workcell_write machine-add, machine-remove, connect, disconnect: owner_routes.rs). The operations a declaration may
 * expect are Workcell's control operations, which no Workcell read discloses yet, so none is offered (allowedOperations is empty) rather
 * than copied here. Each write answers in Workcell's words. */
export function nativeRemoteMachines(call: Call, workcellRef: string): RemoteMachinesSource {
  const write = async (request: Extract<KernelOp, {op: 'workcell_write'}>['request'], done: string): Promise<MachineOperationResult> => {
    try {
      await routeData(call, {op: 'workcell_write', request}, `Workcell's ${request.kind}`)
      return {status: 'acknowledged', message: done}
    } catch (cause) {
      return {status: 'refused', message: cause instanceof Error ? cause.message : String(cause)}
    }
  }
  return {
    scope: {scope_kind: 'workcell', scope_ref: workcellRef},
    allowedOperations: [],
    async readMachines(): Promise<RemoteMachineDeclaration[]> {
      const data = await routeData(call, {op: 'workcell_read', request: {kind: 'machine-list'}}, 'Workcell\'s machine list') as {machines?: unknown}
      if (!Array.isArray(data?.machines)) throw new Error('Workcell\'s machine list carried no machines.')
      return data.machines.flatMap((row): RemoteMachineDeclaration[] => {
        const m = row as Record<string, unknown>
        return typeof m.label === 'string' && typeof m.endpoint === 'string'
          ? [{label: m.label, endpoint: m.endpoint, credential_ref: textOr(m.credential_ref), operations: strings(m.operations), note: textOr(m.note)}] : []
      })
    },
    async readConnections(): Promise<MachineConnection[]> {
      const data = await routeData(call, {op: 'workcell_read', request: {kind: 'connections-list'}}, 'Workcell\'s connections') as {connections?: unknown}
      if (!Array.isArray(data?.connections)) throw new Error('Workcell\'s connections list carried no connections.')
      const labels = data.connections.flatMap(row => typeof (row as {label?: unknown}).label === 'string' ? [(row as {label: string}).label] : [])
      // Each connection's whole record is its `show` (the list carries its label, endpoint and state only).
      const shown = await Promise.all(labels.map(label => routeData(call, {op: 'workcell_read', request: {kind: 'connections-show', label}}, `Workcell's connection ${label}`)))
      return shown.flatMap((answer): MachineConnection[] => {
        const c = (answer as {connection?: Record<string, unknown>})?.connection
        if (!c || typeof c.label !== 'string' || typeof c.endpoint !== 'string') return []
        const state = c.state === 'connected' || c.state === 'disconnected' || c.state === 'refused' || c.state === 'incompatible' ? c.state : 'disconnected'
        return [{connection_ref: typeof c.connection_ref === 'string' ? c.connection_ref : `connection:${c.label}`, label: c.label, endpoint: c.endpoint,
          protocol: typeof c.protocol === 'string' ? c.protocol : '', remote_workcell_ref: textOr(c.remote_workcell_ref), remote_software: textOr(c.remote_software),
          local_software: typeof c.local_software === 'string' ? c.local_software : '', granted_operations: strings(c.granted_operations),
          credential_ref: textOr(c.credential_ref), state, detail: textOr(c.detail),
          connected_at_unix_ms: typeof c.connected_at_unix_ms === 'number' ? c.connected_at_unix_ms : null,
          expires_at_unix_ms: typeof c.expires_at_unix_ms === 'number' ? c.expires_at_unix_ms : null,
          last_reconciled_at_unix_ms: typeof c.last_reconciled_at_unix_ms === 'number' ? c.last_reconciled_at_unix_ms : 0,
          provenance: Object.fromEntries(Object.entries((c.provenance as Record<string, unknown>) ?? {}).filter(([, value]) => typeof value === 'string')) as Record<string, string>}]
      })
    },
    add: declaration => write({kind: 'machine-add', label: declaration.label, endpoint: declaration.endpoint, credential_ref: declaration.credential_ref,
      allow: declaration.operations, note: declaration.note}, `${declaration.label} is declared.`),
    connect: label => write({kind: 'connect', connection: label}, `${label} is connected.`),
    disconnect: label => write({kind: 'disconnect', label}, `${label} is disconnected; its record is kept.`),
    remove: label => write({kind: 'machine-remove', label}, `${label} is removed.`),
  }
}

/** The renderer's own visual preference store (cradle visuals/store.ts), never a second owner: its snapshot read as the two switches
 * Settings shows, the same object while they stand (useSyncExternalStore needs it). */
export function nativeVisualPreferences(store: VisualsStoreLike): NonNullable<SettingsAdapter['visualPreferences']> {
  let held: {enabled: boolean; welcomeEnabled: boolean} | null = null
  return {
    getSnapshot() {
      const now = store.get()
      if (!held || held.enabled !== now.enabled || held.welcomeEnabled !== now.welcomeEnabled) held = {enabled: now.enabled, welcomeEnabled: now.welcomeEnabled}
      return held
    },
    subscribe: listener => store.subscribe(() => listener()),
    setEnabled: enabled => store.setEnabled(enabled),
    setWelcomeEnabled: enabled => store.setWelcomeEnabled(enabled),
  }
}

/** Import a theme file through the appearance owner: the cradle's own converter checks it against the themes the owner keeps
 * (presentation_read), and theme_import keeps it; the owner's document is the answer. */
export async function nativeImportTheme(call: Call, text: string, fileName: string): Promise<PresentationDocument> {
  const read = await call({op: 'presentation_read'})
  if (read.error || read.outcome?.result !== 'presentation_reading') throw new Error(read.error ?? 'The appearance owner did not answer.')
  const {convertImportedTheme} = await import('../../../../../desktop/cradle/src/visuals/customThemes')
  const theme = convertImportedTheme(text, fileName, read.outcome.document.custom_themes)
  const kept = await call({op: 'theme_import', theme})
  if (kept.error || kept.outcome?.result !== 'presentation_reading') throw new Error(kept.error ?? 'The appearance owner did not keep the theme.')
  return kept.outcome.document
}

/** No private desired/configuration store. Documents and owner receipts cross
 * through the imported native source. Reading preflight is not owner CAS. Connecting reads nothing: the owner is first
 * asked when Settings reads its registry (it is opened). */
export async function connectNativeSettings(transport: KernelTransportStatus, context: NativeSettingsContext): Promise<SettingsAdapter> {
  const current = () => { if (!context.isCurrent()) throw Error('The originating native owner/access epoch has retired') }
  const call = async (op: Parameters<typeof kernelOp>[1]) => { current(); const answer = await kernelOp(transport,op); current(); return answer }
  const source = createLiveConfigPlaneSource(call)
  // The pages beyond the configuration plane, each over the kernel ops its owner already answers (settings/adapter.ts): the harnesses
  // (configuration/harnessSource.ts), the profiles (the live source's profile_* ops), the products (system_composition_read), this
  // Workcell's machines (workcell_read/workcell_write), the appearance (presentation_read, theme_import, the renderer's store) and the
  // existing operations the pages invoke themselves (routine, product_action_run, credential_*, client_install, settings_reveal).
  const workcell = context.scopeChoices?.find(choice => choice.address.scope_kind === 'workcell' && choice.address.scope_ref)?.address.scope_ref ?? null
  // The owner's reviewed-apply qualification is read when Settings first reads its registry — when Settings is opened —
  // not when the native access is qualified at boot. One read per adapter, which is one per owner epoch: a refusal (the owner
  // does not offer it) is remembered for the epoch and stays the stated reason; the next epoch asks again.
  type Capabilities = {schema?: string; reviewed_apply?: boolean; owner_plan_passthrough?: boolean; native_reset?: boolean} | null
  let capabilities: Capabilities = null
  let qualificationError: string | null = null
  let qualified: Promise<void> | null = null
  const qualify = () => qualified ??= call({op:'config_capabilities_read'}).then(qualification => {
    capabilities = qualification.outcome?.result === 'config_capabilities_reading' ? qualification.outcome.document as Capabilities : null
    qualificationError = qualification.error ?? null
  }, cause => { qualified = null; throw cause })
  const reviewed = () => !!(capabilities?.schema === 'oi.config-capabilities/v1' && capabilities.reviewed_apply && capabilities.owner_plan_passthrough)
  const heldBasis = new WeakMap<object,{basis:SettingsBasis[];expires:number}>()
  async function preflight(basis: SettingsBasis[]) {
    if (!basis.length) return
    const readings = await source.readResolutions(basis.map(({setting_ref,scope})=>({setting_ref,scope})))
    current()
    for (const previous of basis) {
      const reading = readings.find(row=>key(row)===key(previous))
      const observed = reading ? {setting_ref:reading.setting_ref,scope:reading.scope,reading_digest:reading.native_reading?.reading_digest ?? null} : null
      if (!observed || observed.reading_digest !== previous.reading_digest) throw new SettingsConflict(previous,observed)
    }
  }
  const reset = async (basis: SettingsBasis) => {
    await preflight([basis])
    const answer = await call({op:'config_reset',setting_ref:basis.setting_ref,scope:basis.scope})
    if (answer.outcome?.result !== 'config_applied') throw Error(answer.error ?? 'The native reset did not return its ChangeSet')
    return answer.outcome.changeset
  }
  const adapter: SettingsAdapter = {
    kind: transport.kind === 'tauri' ? 'native' : transport.kind === 'bridge' ? 'development' : 'unavailable',
    label: transport.kind === 'tauri' ? 'Native owner configuration' : transport.kind === 'bridge' ? 'Development native bridge' : transport.reason,
    ownerEpoch: context.ownerEpoch,
    // Until Settings is opened the qualification is unread: Apply and Reset stay unoffered, and say why.
    get canApply() { return reviewed() },
    get applyUnavailableReason() { return reviewed() ? undefined : qualificationError ?? (qualified ? 'This executing owner does not offer reviewed-plan application.' : 'The owner\'s apply qualification is read when Settings opens.') },
    scopeChoices: context.scopeChoices, navigate: context.navigate,
    async readRegistry() {current(); await qualify(); current(); return source.readRegistry()},
    async readResolutions(pairs) {current(); return source.readResolutions(pairs)},
    async plan(requests,basis=[]) {
      await preflight(basis)
      const answer = await source.plan(requests)
      current()
      for (const plan of answer.plans) heldBasis.set(plan,{basis:structuredClone(basis.filter(row=>key(row)===key(plan))),expires:Date.now()+15*60*1000})
      return answer
    },
    async apply(plans) {
      await qualify()
      if (!reviewed()) throw Error(adapter.applyUnavailableReason)
      const basis: SettingsBasis[] = []
      for (const plan of plans) {
        const held = heldBasis.get(plan)
        if (!held || held.expires <= Date.now()) throw Error('The supplied plan was not reviewed in this native owner epoch or its review has expired')
        basis.push(...held.basis)
      }
      await preflight(basis)
      const result = await source.apply(plans)
      current()
      return result
    },
    receipts: source.receipts ? (...args) => {current(); return source.receipts!(...args)} : undefined,
    get reset() { return capabilities?.native_reset ? reset : undefined },
    async invoke(operation) { const answer = await call(operation); return {outcome: answer.outcome, error: answer.error ?? null} },
    profiles: {
      listProfiles: () => source.listProfiles(),
      profileUsePlan: profile_ref => source.profileUsePlan(profile_ref),
      createProfile: (profile_ref, title) => source.createProfile(profile_ref, title),
      saveProfile: profile => source.saveProfile(profile),
    },
    async readProducts() {
      const answer = await call({op: 'system_composition_read'})
      if (answer.error || answer.outcome?.result !== 'system_composition_reading') throw new Error(answer.error ?? 'The suite composition did not answer.')
      return answer.outcome.reading
    },
    harnesses: createLiveHarnessSource(call),
    ...(workcell ? {remoteMachines: nativeRemoteMachines(call, workcell)} : {}),
    ...(context.visuals ? {visualPreferences: nativeVisualPreferences(context.visuals)} : {}),
    importTheme: (text, fileName) => nativeImportTheme(call, text, fileName),
  }
  return adapter
}
