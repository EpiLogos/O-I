/** Candidate receiving seam over the existing owner configuration engine. */
import {createLiveConfigPlaneSource} from '../../../../../desktop/cradle/src/configuration/liveSource'
import {compactScope} from '../../../../../desktop/cradle/src/configuration/contracts'
import {kernelOp} from '../../../../../desktop/cradle/src/kernel/bridge'
import type {KernelTransportStatus} from '../../../../../desktop/cradle/src/kernel/types'
import type {SettingsAdapter, SettingsBasis} from '../settings/adapter'
export type {SettingsAdapter, SettingsBasis} from '../settings/adapter'

export interface NativeSettingsContext {
  ownerEpoch: string
  /** True only while the originating World, native owner and access epoch remain current. */
  isCurrent(): boolean
  scopeChoices?: SettingsAdapter['scopeChoices']
  navigate?: SettingsAdapter['navigate']
}
export class SettingsConflict extends Error {
  readonly code = 'reading_changed'
  constructor(readonly previous: SettingsBasis, readonly current: SettingsBasis | null) {
    super(`The native reading for ${previous.setting_ref} changed. Read and review the change again.`)
  }
}
const key = (basis: Pick<SettingsBasis,'setting_ref'|'scope'>) => `${basis.setting_ref}|${compactScope(basis.scope)}`

/** No private desired/configuration store. Documents and owner receipts cross
 * through the imported native source. Reading preflight is not owner CAS. Connecting reads nothing: the owner is first
 * asked when Settings reads its registry (it is opened). */
export async function connectNativeSettings(transport: KernelTransportStatus, context: NativeSettingsContext): Promise<SettingsAdapter> {
  const current = () => { if (!context.isCurrent()) throw Error('The originating native owner/access epoch has retired') }
  const call = async (op: Parameters<typeof kernelOp>[1]) => { current(); const answer = await kernelOp(transport,op); current(); return answer }
  const source = createLiveConfigPlaneSource(call)
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
  }
  return adapter
}
