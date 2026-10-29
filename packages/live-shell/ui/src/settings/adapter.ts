/** Receiving contract: native documents stay owner-minted and unmodified. */
import type { ChangeSetDocument, ConfigResolution, PlanDocument, ScopeAddress, SettingSpec } from '../../../../../desktop/cradle/src/configuration/contracts'
import type { ChangeRequest, ConfigPlaneSource, PlanBundle } from '../../../../../desktop/cradle/src/configuration/source'
import { disconnectedCatalogue } from './catalogue'
import type { AikitReadRequest, AikitWriteRequest, KernelOp, KernelOutcome, PresentationCustomTheme, PresentationDocument } from '../../../../../desktop/cradle/src/kernel/types'
import type { SystemCompositionReading } from '../../../../../desktop/cradle/src/workspace/settings/types'
import type { HarnessSource } from '../../../../../desktop/cradle/src/configuration/harnessSource'
import type { RemoteMachinesSource } from './machines'
import type { RoutineAuthoringSource } from './routines'
import type { AdoptionNative } from '../../../../../desktop/cradle/src/configuration/adoptionController'
import type { NaraIdentityRequest } from '../../../../../desktop/cradle/src/nara/identity/types'

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
} & ({ setting_ref: string; page?: never } | { page: 'machines' | 'automations' | 'setup'; setting_ref?: never
  /** Setup's Projects step opened for this folder (the browser's Work place: Add folder…, manual §10.11). */
  folder?: string })
/** The AIKit ops Setup asks (manual §10.11, Harnesses and skills and Credentials): the tools AIKit detects and the providers each reaches
 * (harness_status, harness_auth_describe), the skill roots it discovers, names, holds and would adopt (aikit_read init, collate, tree,
 * adopt-plan), the person's adoption (aikit_write adopt), and the keys it finds, the bindings it keeps and a binding by reference
 * (credential_discover, credential_list, credential_setup: a reference, never material). */
export type SetupAikitOp =
  | { op: 'harness_status' } | { op: 'harness_auth_describe'; harness: string }
  | { op: 'aikit_read'; request: Extract<AikitReadRequest, { kind: 'init' | 'collate' | 'tree' | 'adopt-plan' }> }
  | { op: 'aikit_write'; request: Extract<AikitWriteRequest, { kind: 'adopt' }> }
  | { op: 'credential_discover' } | { op: 'credential_list' } | { op: 'credential_setup'; credential: string; reference: string }
/** Setup (manual §10.11) runs before a world is qualified, so it reaches its owners over the kernel channel the host holds, not over the
 * qualified configuration owners: the kernel's `setup` op (native oi's adoption — discover, plan, apply with the plan's review token;
 * desktop/cradle/src/configuration/adoptionController.ts) for the Ground step, AIKit's ops for the Harnesses and skills and Credentials
 * steps, Workcell's status and Central's machine actions for the Machines step, and Central's own actions through invoke_action for the
 * Projects step (Work's members, the folders of work elsewhere, a project's inspection, its previews and the person's Accept). */
export interface SetupSource {
  readonly adoption: AdoptionNative
  /** One Central action: its data, or a refusal in Central's words. */
  central(action: string, input: Readonly<Record<string, unknown>>): Promise<unknown>
  /** One AIKit op Setup asks (SetupAikitOp): its data, or AIKit's refusal in its words. */
  aikit?(op: SetupAikitOp): Promise<unknown>
  /** Workcell's status for this computer (`workcell status --json`, the kernel's workcell_status_read): the Workcell it answers as. */
  workcell?(): Promise<unknown>
  /** The person's identity, through the kernel's `nara_identity` op (list, open, save: QL inspects the profile, Central keeps it in the
   * ground's Control/self/nara/identities; desktop/cradle/kernel/src/nara_identity.rs), as the Studio's Nara chain keeps it (§24.7): the
   * date of birth Setup asks once the ground is made (§10.11). Its answer, the kernel's `nara_identity` data. */
  identity?(request: NaraIdentityRequest): Promise<unknown>
  /** AIKit's own disclosure of each agent tool (`aikit harness disclose --json`, aikit.harness-disclosure/v1): its instructions (the
   * guidance layer), settings and models, as AIKit reads them; the Harnesses and skills step shows what it found. */
  harnessDisclosure?(): Promise<unknown>
  /** The person's key (the kernel's `ground_authority` op, desktop/cradle/kernel/src/ground_authority.rs): preview — whether this host can
   * keep a key here and Central's preview of the grant — and adopt, on Setup's held Ground Accept: the key made in the world's own folder,
   * only its digest sent to Central. Its answers never carry the key nor its digest. */
  groundAuthority?(request: {operation: 'preview'} | {operation: 'adopt'; acceptance_ref: string; expected_digest: string}): Promise<unknown>
  /** The Day's form (the kernel's `ground_form` op, desktop/cradle/kernel/src/ground_form.rs): preview — carried by the ground's O-I
   * project, or Central's preview of keeping the application's own Day form in the ground — and keep, on Setup's held Ground Accept. */
  groundForm?(request: {operation: 'preview'} | {operation: 'keep'; acceptance_ref: string; expected_digest: string}): Promise<unknown>
  /** The host reads its world again once a ground is made or bound (native/Foundation.tsx). */
  groundChanged?(): void
}
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
  /** Setup's owners, reached before and after a world is qualified (SetupSource). */
  setup?: SetupSource
}

export function unavailableSettingsAdapter(reason = 'The native configuration contribution has not been connected to this shell.'): SettingsAdapter {
  const unavailable = async (): Promise<never> => { throw new Error(reason) }
  return { kind: 'unavailable', label: reason, canApply: false, applyUnavailableReason: reason,
    readRegistry: async () => ({ mounts: import.meta.env?.DEV ? await disconnectedCatalogue(reason) : [], observed_at_unix_ms: 0, composition: null }),
    readResolutions: async () => [], plan: unavailable, apply: unavailable }
}

export function resolutionBasis(resolution: ConfigResolution): SettingsBasis {
  return { setting_ref: resolution.setting_ref, scope: resolution.scope, reading_digest: resolution.native_reading?.reading_digest ?? null }
}
