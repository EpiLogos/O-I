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
 * through the imported native source. Reading preflight is not owner CAS. */
export async function connectNativeSettings(transport: KernelTransportStatus, context: NativeSettingsContext): Promise<SettingsAdapter> {
  const current = () => { if (!context.isCurrent()) throw Error('The originating native owner/access epoch has retired') }
  const call = async (op: Parameters<typeof kernelOp>[1]) => { current(); const answer = await kernelOp(transport,op); current(); return answer }
  const source = createLiveConfigPlaneSource(call)
  const qualification = await call({op:'config_capabilities_read'})
  const capabilities = qualification.outcome?.result === 'config_capabilities_reading' ? qualification.outcome.document : null
  const reviewed = capabilities?.schema === 'oi.config-capabilities/v1' && capabilities.reviewed_apply && capabilities.owner_plan_passthrough
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
  const adapter: SettingsAdapter = {
    kind: transport.kind === 'tauri' ? 'native' : transport.kind === 'bridge' ? 'development' : 'unavailable',
    label: transport.kind === 'tauri' ? 'Native owner configuration' : transport.kind === 'bridge' ? 'Development native bridge' : transport.reason,
    ownerEpoch: context.ownerEpoch, canApply: !!reviewed,
    applyUnavailableReason: reviewed ? undefined : qualification.error ?? 'This executing owner does not offer reviewed-plan application.',
    scopeChoices: context.scopeChoices, navigate: context.navigate,
    async readRegistry() {current(); return source.readRegistry()},
    async readResolutions(pairs) {current(); return source.readResolutions(pairs)},
    async plan(requests,basis=[]) {
      await preflight(basis)
      const answer = await source.plan(requests)
      current()
      for (const plan of answer.plans) heldBasis.set(plan,{basis:structuredClone(basis.filter(row=>key(row)===key(plan))),expires:Date.now()+15*60*1000})
      return answer
    },
    async apply(plans) {
      if (!reviewed) throw Error(adapter.applyUnavailableReason)
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
  }
  if (capabilities?.native_reset) adapter.reset = async basis => {
    await preflight([basis])
    const answer = await call({op:'config_reset',setting_ref:basis.setting_ref,scope:basis.scope})
    if (answer.outcome?.result !== 'config_applied') throw Error(answer.error ?? 'The native reset did not return its ChangeSet')
    return answer.outcome.changeset
  }
  return adapter
}
