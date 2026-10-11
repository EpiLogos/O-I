/** Receiving contract: native documents stay owner-minted and unmodified. */
import type { ChangeSetDocument, ConfigResolution, PlanDocument, ScopeAddress, SettingSpec } from '../../../../../desktop/cradle/src/configuration/contracts'
import type { ChangeRequest, ConfigPlaneSource, PlanBundle } from '../../../../../desktop/cradle/src/configuration/source'
import { disconnectedCatalogue } from './catalogue'
import type { KernelOp, KernelOutcome, PresentationCustomTheme, PresentationDocument } from '../../../../../desktop/cradle/src/kernel/types'
import type { SystemCompositionReading } from '../../../../../desktop/cradle/src/workspace/settings/types'
import type { HarnessSource } from '../../../../../desktop/cradle/src/configuration/harnessSource'
import type { RemoteMachinesSource } from './machines'
import type { RoutineAuthoringSource } from './routines'

export type { ChangeRequest, PlanBundle, ContributionMount } from '../../../../../desktop/cradle/src/configuration/source'
export type { SettingSpec, ScopeAddress, ConfigResolution, PlanDocument, ChangeSetDocument } from '../../../../../desktop/cradle/src/configuration/contracts'

export interface SettingsBasis { setting_ref: string; scope: ScopeAddress; reading_digest: string | null }
export interface SettingsChoice { value: string; title: string; description?: string }
/** The operation acknowledgement subset consumed here; structurally compatible
 * with Cradle KernelOpCall without importing its renderer/transport runtime. */
export interface SettingsInvocation { outcome?: KernelOutcome | null; error?: string | null }
export interface SettingsDestination {
  kind: 'editor' | 'credentials' | 'connection' | 'product' | 'operation'
  native_ref: string
  setting_ref?: string
  scope?: ScopeAddress
}
/** Searchable native parameters/operations whose editor is at point of use.
 * Supply the owner's exact identity and current subject, never an invented key. */
export interface SettingsSearchTarget {
  setting_ref: string
  title: string
  description: string
  synonyms?: string
  scope: ScopeAddress
  destination: SettingsDestination
}
export type SettingsRequest = {
  /** Changes on every contextual opening, even when the identity is unchanged. */
  requestId: string
  scope: ScopeAddress
  returnLabel: string
} & ({ setting_ref: string; page?: never } | { page: 'machines' | 'automations'; setting_ref?: never })
export interface SettingsAdapter {
  readonly kind: 'native' | 'development' | 'unavailable'
  /** Explicit scenarios simulate responses. A development native bridge does not. */
  readonly simulated?: boolean
  readonly label: string
  readonly ownerEpoch?: string
  /** Only true when Apply consumes the exact reviewed owner plans. */
  readonly canApply?: boolean
  readonly applyUnavailableReason?: string
  readRegistry: ConfigPlaneSource['readRegistry']
  readResolutions: ConfigPlaneSource['readResolutions']
  plan(requests: ChangeRequest[], basis?: SettingsBasis[]): Promise<PlanBundle>
  apply(plans: PlanDocument[]): Promise<ChangeSetDocument>
  receipts?: ConfigPlaneSource['receipts']
  /** Owner reset removes a native override; it is never discardDesired. */
  reset?(basis: SettingsBasis): Promise<ChangeSetDocument>
  /** Actual scope subjects, in descriptor order. No fabricated fallback refs. */
  scopeChoices?: { address: ScopeAddress; title: string }[]
  /** Advertised dependent choices. A missing catalogue isn't permission to invent one. */
  choices?(setting: SettingSpec, column: string, row: Record<string, unknown>): SettingsChoice[] | null
  /** Native picker returns a canonical path/resource reference; null cancels. */
  pickResource?(setting: SettingSpec): Promise<string | null>
  /** Existing Cradle operations, supplied by the current native/access epoch. */
  invoke?(operation: KernelOp): Promise<SettingsInvocation>
  /** Reuse Cradle's convertImportedTheme validator before theme_import. */
  importTheme?(text: string, fileName: string): Promise<PresentationDocument>
  themeLibrary?: readonly Pick<PresentationCustomTheme, 'id' | 'name' | 'appearance' | 'preview'>[]
  /** Qualified by credential capabilities; a generic invoke channel is insufficient. */
  readonly canEnterCredentialMaterial?: boolean
  /** Retained Cradle renderer store. Never instantiate a second preference owner. */
  visualPreferences?: {
    getSnapshot(): { enabled: boolean; welcomeEnabled: boolean }
    subscribe(listener: () => void): () => void
    setEnabled(enabled: boolean): void
    setWelcomeEnabled(enabled: boolean): void
  }
  /** Existing sparse O:I profile operations, qualified in the same owner epoch. */
  profiles?: Pick<ConfigPlaneSource, 'listProfiles' | 'profileUsePlan' | 'createProfile' | 'saveProfile'>
  readProducts?(): Promise<SystemCompositionReading>
  harnesses?: HarnessSource
  /** Workcell declarations/connection operations; never an SSH/provider fiction. */
  remoteMachines?: RemoteMachinesSource
  /** Exact AIKit create/enable over selected native proof/authority documents. */
  routineAuthoring?: RoutineAuthoringSource
  pointOfUseEntries?: readonly SettingsSearchTarget[]
  navigate?(destination: SettingsDestination): void
}

export function unavailableSettingsAdapter(reason = 'The native configuration contribution has not been connected to this shell.'): SettingsAdapter {
  const unavailable = async (): Promise<never> => { throw new Error(reason) }
  return { kind: 'unavailable', label: reason, canApply: false, applyUnavailableReason: reason,
    readRegistry: async () => ({ mounts: import.meta.env?.DEV ? disconnectedCatalogue(reason) : [], observed_at_unix_ms: 0, composition: null }),
    readResolutions: async () => [], plan: unavailable, apply: unavailable }
}

export function resolutionBasis(resolution: ConfigResolution): SettingsBasis {
  return { setting_ref: resolution.setting_ref, scope: resolution.scope, reading_digest: resolution.native_reading?.reading_digest ?? null }
}
