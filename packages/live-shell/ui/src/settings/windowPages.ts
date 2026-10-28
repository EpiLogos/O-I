// The Settings window's pages as hooks (manual §10.10; the catalogue design `settings:window`): each page's readings and presses, ported
// from the page components the window drew before (HarnessPreferences.tsx, OwnerPreferences.tsx's Appearance and Credentials,
// ProfilePreferences.tsx, MachinePreferences.tsx, AutomationPreferences.tsx with ScheduleControl.tsx, ProductPreferences.tsx; the parked
// port 7cba70d10), now drawn by the design on the binding SettingsWorkspace.tsx composes. Each reads only through its owner's capability
// on the SettingsAdapter, only once its page was opened (`enabled`), and again for each new adapter or owner epoch, or when Read again is
// pressed; a late answer of an older adapter is dropped (the generation guard the components kept). A press rejects with the owner's
// words, which the host says on the control; an acknowledgement resolves with the owner's words, which the window says on the status
// bar's Info line, as the components said them under their controls. Nothing here invents a value.
import {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react'
import type {Value} from '../frame/devices/designed'
import type {ChangeRequest, ScopeAddress, SettingsAdapter} from './adapter'
import type {KernelOp, PresentationDocument, PresentationTheme} from '../../../../../desktop/cradle/src/kernel/types'
import type {HarnessReading} from '../../../../../desktop/cradle/src/configuration/harnessSource'
import type {ProfileDocument} from '../../../../../desktop/cradle/src/configuration/contracts'
import type {DisclosedAction, SystemCompositionReading} from '../../../../../desktop/cradle/src/workspace/settings/types'
import {actionMessage, object, routineList, type Invocation, type MethodRow, type RoutineDetail, type RoutineList, type RoutineRequest} from '../../../../../desktop/cradle/src/contributions/automations/client'
import {THEMES} from '../../../../oi-design-system/themes/index.mjs'
import {refusalLine, scalarEntries} from '../agent/RefusalCard'
import {connectionBasis, machineBasis, validateMachine, type MachineConnection, type RemoteMachineDeclaration} from './machines'
import {authorityAllowsTrigger, eligibleProofs, routineBasis, scheduleFromInput, type RoutineAuthoringOptions, type RoutineAuthoringResult, type ScheduleShape} from './routines'
import {appearanceValues, automationValues, credentialValues, folderOf, harnessValues, machineValues, NO_AUTHORING, NO_HARNESS, NO_INVOKE, NO_MACHINES, NO_NAVIGATE, NO_PRODUCTS,
  NO_PROFILES, NO_VISUALS, productValues, profileValues, systemValues, type CredentialRow} from './windowValues'

/** A press through its owner: it resolves with the owner's acknowledgement in its words (said on the Info line), or rejects with its refusal. */
export type Act = (value: Value) => Promise<string | void>
/** One page's part of the binding. */
export interface PagePart {
  readonly values: Record<string, Value>
  readonly acts: Record<string, Act>
  /** Why a press cannot act now, by key. */
  readonly why: Record<string, string>
  /** A read the owner refused, in its words, said on the page's control nearest it, by key. */
  readonly refused: Record<string, string>
  /** Read the page's owners again (the head's Read again). */
  readonly reread: () => Promise<void>
}
/** The open form's fields and the window's other own keys, as the window holds them. */
export type Held = (key: string) => Value | undefined
const words = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause))
/** A read's refusal, said on the page's control nearest it. */
const refusedOn = (key: string, error: string | null): Record<string, string> => (error ? {[key]: error} : {})
const text = (value: Value | undefined): string => (typeof value === 'string' ? value.trim() : '')
/** A list the window holds as a JSON string (the design's multi-choice toggles). */
const listOf = (value: Value | undefined): string[] => {
  if (typeof value !== 'string' || !value) return []
  try { const parsed = JSON.parse(value) as unknown; return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [] } catch { return [] }
}

/** One owner reading for a page: read when the page opens and for each new adapter or owner epoch; a late answer of an older one dropped. */
function useRead<T>(enabled: boolean, adapter: SettingsAdapter, can: boolean, read: (source: SettingsAdapter) => Promise<T>, key = ''): {
  value: T | null; error: string | null; refresh: () => Promise<void>; set: (value: T) => void; current: (source: SettingsAdapter) => boolean
} {
  const [state, setState] = useState<{value: T | null; error: string | null}>({value: null, error: null})
  const generation = useRef(0), latest = useRef(adapter)
  latest.current = adapter
  const reader = useRef(read)
  reader.current = read
  const refresh = useCallback(async () => {
    if (!can) return
    const epoch = ++generation.current, source = adapter
    try {
      const value = await reader.current(source)
      if (epoch === generation.current && source === latest.current) setState({value, error: null})
    } catch (cause) { if (epoch === generation.current) setState(was => ({...was, error: words(cause)})) }
  }, [adapter, can])
  useEffect(() => {
    setState({value: null, error: null})
    if (enabled && can) void refresh()
    return () => { ++generation.current }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the owner epoch and the key name what is read
  }, [enabled, adapter, adapter.ownerEpoch, can, key])
  const set = useCallback((value: T) => setState({value, error: null}), [])
  const current = useCallback((source: SettingsAdapter) => source === latest.current, [])
  return useMemo(() => ({...state, refresh: enabled ? refresh : async () => {}, set, current}), [state, refresh, set, current, enabled])
}

/** An owner operation through the adapter's kernel channel, acknowledged by its expected result (OwnerPreferences.tsx `operation`). */
async function operation(adapter: SettingsAdapter, op: KernelOp, expected: string) {
  if (!adapter.invoke) throw new Error('The native owner operation is not connected.')
  const response = await adapter.invoke(op)
  if (response.error || response.outcome?.result !== expected) throw new Error(response.error ?? `The owner did not acknowledge ${op.op}.`)
  return response.outcome
}

/** The system's own file picker, for an import (the old pages' hidden file inputs). Null when you cancel. */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null), {once: true})
    input.addEventListener('cancel', () => resolve(null), {once: true})
    input.click()
  })
}

// ---------------------------------------------------------------------------------------------------------------- Harnesses & models

const DEFAULT_SAVED = 'Native owner acknowledged the preference. New chats use the resolved provider; the current conversation keeps its provider.'

/** Harnesses & models (HarnessPreferences.tsx): the providers and the chat default through the adapter's HarnessSource, each harness client's
 * install and folder through the kernel channel, Sign in at the conversation's connection control. */
export function useHarnessPage(adapter: SettingsAdapter, enabled: boolean, done: (keys: readonly string[]) => void): PagePart & {chose(provider: Value | undefined): void} {
  const read = useRead<HarnessReading>(enabled, adapter, !!adapter.harnesses, async source => {
    const answer = await source.harnesses!.read()
    if (answer.kind === 'fixture' && !import.meta.env?.DEV) throw new Error('Fixture harness readings cannot qualify production settings.')
    return answer
  })
  // The basis a chosen provider stands on: the owner epoch and the saved default when you chose it.
  const basis = useRef<{epoch?: string; held: string | null} | null>(null)
  const held = read.value?.defaultState.state === 'ok' ? read.value.heldDefault?.value ?? null : null
  const chose = useCallback((provider: Value | undefined) => { basis.current = provider === undefined ? null : {epoch: adapter.ownerEpoch, held} }, [adapter, held])
  const save = useCallback(async (draft: string | null) => {
    const harnesses = adapter.harnesses
    if (!harnesses) throw new Error(NO_HARNESS)
    const reset = draft === null || draft === '', source = adapter
    if (draft !== null && basis.current?.epoch !== source.ownerEpoch) throw new Error('The native owner changed. Undo this draft and choose again.')
    const before = await harnesses.read()
    if (!read.current(source)) return
    if (before.defaultState.state !== 'ok' || before.providers.state !== 'ok') throw new Error('Read the native provider rows and saved default before changing it.')
    if (draft !== null && (before.heldDefault?.value ?? null) !== basis.current?.held) throw new Error('The saved provider default changed. Undo this draft, read again and review your choice.')
    if (!reset && !before.providers.rows.some(row => row.id === draft)) throw new Error('This provider is no longer configured.')
    if (reset) await harnesses.discardDefault(); else await harnesses.holdDefault(draft!)
    basis.current = null
    done(['chatDefault'])
    if (read.current(source)) read.set(await harnesses.read())
    return DEFAULT_SAVED
  }, [adapter, read, done])
  const rows = read.value?.harnesses.state === 'ok' ? read.value.harnesses.rows : []
  const run = useCallback(async (client: Value, install: boolean): Promise<string> => {
    const row = rows.find(item => item.client === client)
    if (!row) throw new Error(`${String(client)} is no harness client the owner reports.`)
    const path = folderOf(row.config_dir)
    if (!install && !path) throw new Error(`${row.harness} reports no configuration folder to reveal.`)
    await operation(adapter, install ? {op: 'client_install', client: row.client} : {op: 'settings_reveal', path: path!}, install ? 'client_installed' : 'settings_revealed')
    if (!install) return 'The native owner revealed the configuration folder.'
    await read.refresh()
    return `Native installation acknowledged. ${row.effect ?? 'Read detection again before starting work.'}`
  }, [adapter, rows, read])
  return useMemo(() => {
    const why: Record<string, string> = {}
    if (!adapter.harnesses) { why.applyDefault = NO_HARNESS; why.restoreDefault = NO_HARNESS }
    if (!adapter.invoke) { why.install = NO_INVOKE('Install and Folder'); why.reveal = NO_INVOKE('Install and Folder') }
    if (!adapter.navigate) why.signIn = NO_NAVIGATE('Sign in: the conversation\'s connection control (harness_auth_describe)')
    const refused: Record<string, string> = {}
    if (read.error) refused.chatDefault = read.error
    else if (read.value) for (const [section, state] of [['providers', read.value.providers], ['harnesses', read.value.harnesses], ['catalogue', read.value.catalogue], ['saved default', read.value.defaultState]] as const)
      if (state.state === 'failed') refused.chatDefault = `${section}: ${state.error}`
    return {values: harnessValues(read.value), why, refused, chose, reread: read.refresh,
      acts: {
        applyDefault: async value => save(typeof value === 'string' ? value : null),
        restoreDefault: async () => save(null),
        install: async client => run(client, true),
        reveal: async client => run(client, false),
        signIn: async client => {
          if (!adapter.navigate) throw new Error(why.signIn)
          adapter.navigate({kind: 'connection', native_ref: String(client)})
        },
      }}
  }, [adapter, read.value, read.error, read.refresh, save, run, chose])
}

// ---------------------------------------------------------------------------------------------------------------- Credentials

/** Accept only metadata fields. Material and unknown payloads never enter the window (OwnerPreferences.tsx credentialMetadata, unchanged). */
export function credentialMetadata(value: unknown): CredentialRow[] {
  if (!value || typeof value !== 'object') throw new Error('The credential owner did not return metadata.')
  const rows = (value as {bindings?: unknown}).bindings
  if (!Array.isArray(rows)) throw new Error('The credential metadata did not include its binding list.')
  return rows.flatMap(row => {
    if (!row || typeof row !== 'object') throw new Error('A credential metadata row is invalid.')
    const r = row as Record<string, unknown>
    const credential = typeof r.credential_ref === 'string' ? r.credential_ref : typeof r.credential === 'string' ? r.credential : null
    if (!credential) throw new Error('A credential binding has no native identity.')
    return [{credential, provider: typeof r.provider_ref === 'string' ? r.provider_ref : credential, reference: typeof r.declared_secret_ref === 'string' ? r.declared_secret_ref : null,
      revoked: r.revoked === true, verifiedAt: typeof r.last_verified_at_unix_seconds === 'number' ? r.last_verified_at_unix_seconds : null}]
  })
}
const CREDENTIAL_FAILED = 'The native owner did not complete this credential operation. Inspect the owner\'s redacted diagnostic.'

/** Credentials (OwnerPreferences.tsx CredentialPreferences, CredentialConnection): AIKit's binding metadata, Discover, Verify, Rotate, Revoke
 * and a new binding, by reference only. */
export function useCredentialsPage(adapter: SettingsAdapter, enabled: boolean, held: Held, done: (keys: readonly string[]) => void): PagePart {
  const read = useRead<CredentialRow[]>(enabled, adapter, !!adapter.invoke, async source => {
    const answer = await operation(source, {op: 'credential_list'}, 'credential_reading')
    return credentialMetadata(answer.result === 'credential_reading' ? answer.data : null)
  })
  const [found, setFound] = useState<number | null>(null)
  const [verdicts, setVerdicts] = useState<Record<string, string>>({})
  useEffect(() => { setFound(null); setVerdicts({}) }, [adapter, adapter.ownerEpoch])
  const change = useCallback(async (op: KernelOp, said: string) => {
    try { await operation(adapter, op, 'credential_changed') } catch { throw new Error(CREDENTIAL_FAILED) }
    await read.refresh()
    return said
  }, [adapter, read])
  return useMemo(() => {
    const why: Record<string, string> = {}
    if (!adapter.invoke) for (const key of ['discover', 'verify', 'rotate', 'revoke', 'bind']) why[key] = NO_INVOKE('Credentials')
    return {values: credentialValues(read.value, verdicts, found), why, refused: refusedOn('discover', read.error), reread: read.refresh,
      acts: {
        discover: async () => {
          const answer = await operation(adapter, {op: 'credential_discover'}, 'credential_reading').catch(() => { throw new Error('Credential discovery did not complete. Inspect the owner\'s redacted diagnostic.') })
          const findings = answer.result === 'credential_reading' ? (answer.data as {findings?: unknown})?.findings : undefined
          if (!Array.isArray(findings)) throw new Error('The credential owner did not return discovery findings.')
          if (read.current(adapter)) setFound(findings.length)
          return `Native discovery reports ${findings.length} findings. Choose the native binding or stored reference to configure; discovery changes no preference.`
        },
        verify: async credential => {
          const answer = await operation(adapter, {op: 'credential_verify', credential: String(credential)}, 'credential_verified').catch(() => { throw new Error(CREDENTIAL_FAILED) })
          const verdict = answer.result === 'credential_verified' ? String((answer.data as {verdict?: unknown})?.verdict) : ''
          if (!['working', 'refused', 'unreachable'].includes(verdict)) throw new Error('Verification acknowledged; verdict was not reported.')
          setVerdicts(was => ({...was, [String(credential)]: verdict}))
          await read.refresh()
          return `Verification: ${verdict}`
        },
        rotate: async credential => {
          const reference = text(held('new.reference'))
          if (!reference) throw new Error('Rotate: write the new stored secret reference first.')
          const said = await change({op: 'credential_rotate', credential: String(credential), reference}, 'Native owner acknowledged the binding. Providers may require reconnect.')
          done(['rotating', 'new.reference'])
          return said
        },
        revoke: async credential => change({op: 'credential_revoke', credential: String(credential)}, 'Native owner acknowledged revocation.'),
        bind: async () => {
          const credential = text(held('new.credential')), reference = text(held('new.reference'))
          if (!credential || !reference) throw new Error('Bind: write the native credential identity and its stored secret reference first.')
          const said = await change({op: 'credential_setup', credential, reference}, 'Native owner acknowledged the binding. Providers may require reconnect.')
          done(['adding', 'new.credential', 'new.reference'])
          return said
        },
      }}
  }, [adapter, read.value, read.error, read.refresh, verdicts, found, change, held, done, read])
}

// ---------------------------------------------------------------------------------------------------------------- Appearance

const absentVisuals = {enabled: false, welcomeEnabled: false}
const noSubscription = () => () => {}
const noSnapshot = () => absentVisuals
const APPEARANCE_SAID = 'Acknowledged by the appearance owner. This window\'s renderer observation remains a separate reading.'

/** Appearance (OwnerPreferences.tsx AppearancePreferences, OpeningPreferences): the presentation owner's saved theme, Apply on the basis you
 * chose on, Revert, imported themes, the renderer's Opening preferences, and Open Expressions for the controls that stay in their editors. */
export function useAppearancePage(adapter: SettingsAdapter, enabled: boolean, done: (keys: readonly string[]) => void): PagePart & {chose(theme: Value | undefined): void} {
  const read = useRead<PresentationDocument>(enabled, adapter, !!adapter.invoke, async source => {
    const answer = await operation(source, {op: 'presentation_read'}, 'presentation_reading')
    if (answer.result !== 'presentation_reading') throw new Error('The appearance owner did not return its reading.')
    return answer.document
  })
  // The library the window offers (the adapter's, else the design system's themes), and with it the themes you imported, for Apply.
  const base = (adapter.themeLibrary ?? THEMES) as readonly {id: string; name: string; appearance: PresentationTheme['appearance']}[]
  const library = useMemo(() => [...base, ...(read.value?.custom_themes ?? [])] as {id: string; name: string; appearance: PresentationTheme['appearance']}[], [base, read.value])
  const basis = useRef<{epoch?: string; theme: string} | null>(null)
  const chose = useCallback((theme: Value | undefined) => { basis.current = theme === undefined ? null : {epoch: adapter.ownerEpoch, theme: JSON.stringify(read.value?.theme)} }, [adapter, read.value])
  const store = adapter.visualPreferences
  const visuals = useSyncExternalStore(store?.subscribe ?? noSubscription, store?.getSnapshot ?? noSnapshot, store?.getSnapshot ?? noSnapshot)
  const send = useCallback(async (op: KernelOp) => {
    const source = adapter
    if (op.op === 'theme_apply') {
      if (!basis.current || basis.current.epoch !== source.ownerEpoch) throw new Error('The appearance owner changed. Choose the appearance again on the current reading before applying.')
      const now = await operation(source, {op: 'presentation_read'}, 'presentation_reading')
      if (!read.current(source)) return
      if (now.result === 'presentation_reading' && JSON.stringify(now.document.theme) !== basis.current.theme) {
        read.set(now.document)
        throw new Error('The saved appearance changed. Your choice is retained; choose it again on the current reading before applying.')
      }
    }
    const answer = await operation(source, op, 'presentation_reading')
    if (read.current(source) && answer.result === 'presentation_reading') { read.set(answer.document); basis.current = null }
    if (op.op === 'theme_apply' || op.op === 'theme_revert') done(['themeDraft'])
    return APPEARANCE_SAID
  }, [adapter, read, done])
  return useMemo(() => {
    const why: Record<string, string> = {}
    if (!adapter.invoke) for (const key of ['applyTheme', 'revertTheme', 'removeTheme']) why[key] = NO_INVOKE('Appearance')
    if (!adapter.importTheme) why.importTheme = 'Import: the settings adapter carries no theme importer (SettingsAdapter.importTheme: Cradle\'s converter and validator before theme_import).'
    if (!store) { why.visualLayer = NO_VISUALS; why.welcome = NO_VISUALS }
    if (!adapter.navigate) why.openExpressions = NO_NAVIGATE('The Expressions editor')
    const values = appearanceValues(read.value, base)
    if (store) { values.visualLayer = visuals.enabled; values.welcome = visuals.welcomeEnabled }
    return {values, why, refused: refusedOn('themeDraft', read.error), chose, reread: read.refresh,
      acts: {
        applyTheme: async value => {
          const id = String(value)
          const theme: PresentationTheme = id === 'light' || id === 'dark' || id === 'system' ? {appearance: id, id: null} as PresentationTheme
            : (() => { const found = library.find(item => item.id === id); if (!found) throw new Error(`${id} is no theme of the library.`); return {id: found.id, appearance: found.appearance} as PresentationTheme })()
          return send({op: 'theme_apply', ...theme} as KernelOp)
        },
        revertTheme: async () => send({op: 'theme_revert'}),
        removeTheme: async id => send({op: 'theme_remove', id: String(id)} as KernelOp),
        importTheme: async () => {
          const importTheme = adapter.importTheme
          if (!importTheme) throw new Error(why.importTheme)
          const picked = await pickFile('.json,.jsonc,application/json')
          if (!picked) return
          const source = adapter, document = await importTheme(await picked.text(), picked.name)
          if (read.current(source)) read.set(document)
          return 'Theme import acknowledged by the appearance owner.'
        },
        visualLayer: async on => { if (!store) throw new Error(NO_VISUALS); store.setEnabled(on === true) },
        welcome: async on => { if (!store) throw new Error(NO_VISUALS); store.setWelcomeEnabled(on === true) },
        openExpressions: async () => {
          if (!adapter.navigate) throw new Error(why.openExpressions)
          adapter.navigate({kind: 'editor', native_ref: 'expressions'})
        },
      }}
  }, [adapter, read.value, read.error, read.refresh, base, library, store, visuals, chose, send, read])
}

// ---------------------------------------------------------------------------------------------------------------- Profiles

/** Profiles (ProfilePreferences.tsx): O:I's named profiles; Use stages a profile's settings as local changes; Save keeps your valid local
 * changes under a name; Import reads an oi.profile/v1 file. */
export function useProfilesPage(adapter: SettingsAdapter, enabled: boolean, held: Held, drafts: readonly ChangeRequest[], stage: (requests: ChangeRequest[]) => Promise<void>,
  isSensitive: (ref: string) => boolean, done: (keys: readonly string[]) => void): PagePart {
  const read = useRead<{active_profile_ref: string | null; profiles: ProfileDocument[]}>(enabled, adapter, !!adapter.profiles, source => source.profiles!.listProfiles())
  const run = useCallback(async (work: (source: SettingsAdapter) => Promise<string | undefined>) => {
    const source = adapter
    if (!source.profiles) throw new Error(NO_PROFILES)
    const said = await work(source)
    if (read.current(source)) read.set(await source.profiles.listProfiles())
    return said
  }, [adapter, read])
  return useMemo(() => {
    const why: Record<string, string> = {}
    if (!adapter.profiles) for (const key of ['useProfile', 'saveProfile', 'importProfile']) why[key] = NO_PROFILES
    return {values: profileValues(read.value, isSensitive), why, refused: refusedOn('importProfile', read.error), reread: read.refresh,
      acts: {
        useProfile: async ref => run(async source => {
          const plan = await source.profiles!.profileUsePlan(String(ref))
          if (!read.current(source)) throw new Error('The profile owner changed.')
          const requests = plan.entries.flatMap(entry => entry.target ? [{setting_ref: entry.setting_ref, scope: entry.scope, value: entry.target.value, secret_reference: entry.target.secret_reference ?? null}] : [])
          await stage(requests)
          const title = read.value?.profiles.find(profile => profile.profile_ref === ref)?.title ?? String(ref)
          return `Staged ${requests.length} local ${requests.length === 1 ? 'draft' : 'drafts'} from ${title}. Review the changes before applying.`
        }),
        saveProfile: async () => run(async source => {
          const title = text(held('new.name')), ref = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48)
          if (!ref) throw new Error('Give the profile a name.')
          const created = await source.profiles!.createProfile(ref, title)
          try { if (drafts.length) await source.profiles!.saveProfile({...created, desired: [...drafts]}) } catch {
            throw new Error(`The owner created “${title}”, but did not acknowledge saving its draft entries. Read the profile before retrying.`)
          }
          done(['adding', 'new.name'])
          return `Profile saved by the native owner with ${drafts.length} valid draft entries. No settings were applied.`
        }),
        importProfile: async () => run(async source => {
          const picked = await pickFile('.json,application/json')
          if (!picked) return undefined
          if (picked.size > 1024 * 1024) throw new Error('Profile files must be under 1 MiB.')
          const value = JSON.parse(await picked.text()) as Partial<ProfileDocument>
          if (value.schema !== 'oi.profile/v1' || typeof value.profile_ref !== 'string' || !value.profile_ref.trim() || !Array.isArray(value.desired)) throw new Error('This file is not an O:I profile.')
          const created = await source.profiles!.createProfile(value.profile_ref, value.title ?? undefined)
          try { await source.profiles!.saveProfile({...created, title: value.title ?? created.title, description: value.description ?? created.description, desired: value.desired}) } catch {
            throw new Error('The native owner created the profile but did not acknowledge its imported entries. Nothing was applied.')
          }
          return 'Profile import acknowledged by the native owner. Use it to stage changes for review.'
        }),
      }}
  }, [adapter, read.value, read.error, read.refresh, isSensitive, run, stage, held, drafts, done, read])
}

// ---------------------------------------------------------------------------------------------------------------- Machines

const WRONG_WORKCELL = 'The requested Workcell differs from this connection. Machine changes require the adapter for that exact Workcell.'

/** Remote machines (MachinePreferences.tsx): Workcell's declarations and connection receipts; Add (with the operations you expect), Connect,
 * Disconnect and Remove, each on the basis the page read (a setup that changed since is refused, and read again). A setup begun under
 * another Workcell connection is refused once and kept, then saved on the next press (the old "Use draft with this Workcell"). */
export function useMachinesPage(adapter: SettingsAdapter, enabled: boolean, held: Held, requestedScope: ScopeAddress | null, done: (keys: readonly string[]) => void): PagePart {
  const source = adapter.remoteMachines
  const read = useRead<{machines: RemoteMachineDeclaration[]; connections: MachineConnection[]}>(enabled, adapter, !!source, async adapterNow => {
    const machines = adapterNow.remoteMachines!
    const [declared, receipts] = await Promise.allSettled([machines.readMachines(), machines.readConnections()])
    if (declared.status === 'rejected' || receipts.status === 'rejected') throw new Error('Workcell could not read all machine setup and connection receipts. Retry the read; unknown state is not an empty list.')
    return {machines: declared.value, connections: receipts.value}
  }, JSON.stringify(source?.scope ?? null))
  const wrongScope = !!source && !!requestedScope && (requestedScope.scope_kind !== source.scope.scope_kind || requestedScope.scope_ref !== source.scope.scope_ref)
  // The connection a setup was begun under: a Save under another is refused once, naming it, and the draft is kept.
  const ownerKey = JSON.stringify([adapter.ownerEpoch ?? adapter.kind, source?.scope ?? null])
  const adding = held('adding') === 'machine'
  const formOwner = useRef<string | null>(null)
  useEffect(() => { formOwner.current = adding ? formOwner.current ?? ownerKey : null }, [adding]) // eslint-disable-line react-hooks/exhaustive-deps -- set once, when the form opens
  const act = useCallback(async (action: 'add' | 'connect' | 'disconnect' | 'remove', label?: string): Promise<string> => {
    const machines = adapter.remoteMachines
    if (!machines) throw new Error(NO_MACHINES)
    if (wrongScope) throw new Error(WRONG_WORKCELL)
    const known = read.value
    if (!known) throw new Error('Read the machines before changing them.')
    const draft: RemoteMachineDeclaration = {label: text(held('new.label')), endpoint: text(held('new.endpoint')), credential_ref: text(held('new.credential')) || null,
      operations: listOf(held('new.expects')), note: text(held('new.note')) || null}
    if (action === 'add') {
      if (formOwner.current !== null && formOwner.current !== ownerKey) {
        formOwner.current = ownerKey
        throw new Error('The Workcell connection changed. This setup is still a local draft: press Save again to use it with this Workcell.')
      }
      const errors = validateMachine(draft, machines.allowedOperations, known.machines)
      if (Object.keys(errors).length) throw new Error(Object.values(errors).join(' '))
    }
    const [fresh, receipts] = await Promise.all([machines.readMachines(), machines.readConnections()])
    if (machineBasis(fresh) !== machineBasis(known.machines) || (action === 'disconnect' && connectionBasis(receipts.find(row => row.label === label)) !== connectionBasis(known.connections.find(row => row.label === label)))) {
      read.set({machines: fresh, connections: receipts})
      throw new Error('Machine setup changed after this page was read. It is read again: accept the current setup, then retry. Your draft is retained.')
    }
    const response = action === 'add' ? await machines.add(draft) : action === 'connect' ? await machines.connect(label!) : action === 'disconnect' ? await machines.disconnect(label!) : await machines.remove(label!)
    if (response.status !== 'acknowledged') throw new Error(`${response.status === 'pending' ? 'Awaiting acknowledgement' : response.status} · ${response.message}`)
    if (action === 'add') done(['adding', 'new.label', 'new.endpoint', 'new.credential', 'new.note', 'new.expects'])
    await read.refresh()
    return `${response.status} · ${response.message}`
  }, [adapter, wrongScope, read, held, done, ownerKey])
  return useMemo(() => {
    const why: Record<string, string> = {}
    for (const key of ['addMachine', 'connect', 'disconnect', 'removeMachine']) if (!source) why[key] = NO_MACHINES
      else if (wrongScope) why[key] = WRONG_WORKCELL
    return {values: machineValues(read.value?.machines ?? null, read.value?.connections ?? null, read.value && source ? source.allowedOperations : null, source?.scope ?? null),
      why, refused: refusedOn('connect', read.error), reread: read.refresh,
      acts: {
        addMachine: async () => act('add'), connect: async label => act('connect', String(label)), disconnect: async label => act('disconnect', String(label)),
        removeMachine: async label => act('remove', String(label)),
      }}
  }, [source, wrongScope, read.value, read.error, read.refresh, act])
}

// ---------------------------------------------------------------------------------------------------------------- Automations

const triggerKey = (value: unknown): string => {
  const row = object(value)
  return typeof row.schedule_ref === 'string' ? row.schedule_ref : typeof row.event_ref === 'string' ? row.event_ref : typeof row.trigger_ref === 'string' ? row.trigger_ref : String(row.kind ?? '')
}
/** A new schedule, prepared by AIKit when you create (AutomationPreferences.tsx "New schedule…", ScheduleControl.tsx). */
export const NEW_SCHEDULE = 'new-schedule'
const REPEATS: readonly ScheduleShape['kind'][] = ['daily', 'every', 'once', 'cron']
const said = (result: RoutineAuthoringResult) => `${result.status === 'pending' ? 'Awaiting acknowledgement' : result.status} · ${result.message}`

/** Automations (AutomationPreferences.tsx): AIKit's routines, Methods and history in the chosen work context (kernel op `routine`), the
 * chosen routine's detail, Run now and Disable on the basis read; Create (a new schedule prepared first), Enable on the authority you choose
 * and Reprove on the verified run you choose, through the adapter's routine authoring where it carries one; a creation that waits is read
 * back, never sent again. */
export function useAutomationsPage(adapter: SettingsAdapter, enabled: boolean, held: Held, project: string | null, show: string, routine: string | null,
  done: (keys: readonly string[]) => void): PagePart {
  const ask = useCallback(async (source: SettingsAdapter, request: RoutineRequest) => {
    if (!source.invoke) throw new Error(NO_INVOKE('Automations'))
    const result = await source.invoke({op: 'routine', project: project ?? undefined, request})
    if (result.error || result.outcome?.result !== 'routine') throw new Error(result.error ?? 'AIKit did not return this routine operation.')
    return result.outcome.data
  }, [project])
  const key = project ?? ''
  const lists = useRead<{list: RoutineList; methods: MethodRow[]}>(enabled, adapter, !!adapter.invoke, async source => {
    const [list, methods] = await Promise.all([ask(source, {action: 'list'}), ask(source, {action: 'methods'})])
    const rows = object(methods).methods
    if (!Array.isArray(rows) || rows.some(row => typeof row?.id !== 'string' || typeof row?.name !== 'string')) throw new Error('AIKit could not read routines or Methods. Retry; an unavailable read is not an empty list.')
    return {list: routineList(list), methods: rows as MethodRow[]}
  }, key)
  const history = useRead<Invocation[]>(enabled && show === 'history', adapter, !!adapter.invoke, async source => {
    const value = await ask(source, {action: 'history'})
    if (!Array.isArray(value) || value.some(row => typeof row?.invocation_ref !== 'string')) throw new Error('Invocation history could not be read.')
    return value as Invocation[]
  }, key)
  const detail = useRead<RoutineDetail>(enabled && !!routine, adapter, !!adapter.invoke && !!routine, async source => {
    const value = await ask(source, {action: 'show', routine_ref: routine!})
    if (object(value).routine !== routine) throw new Error('This routine could not be read. Retry before running or changing it.')
    return value as RoutineDetail
  }, `${key}|${routine ?? ''}`)
  const method = text(held('new.method'))
  const options = useRead<RoutineAuthoringOptions>(enabled && !!method, adapter, !!adapter.routineAuthoring && !!method, source => source.routineAuthoring!.options(method, project ?? undefined), `${key}|${method}`)
  // The chosen routine's own Method: the authorities it may be enabled under and the verified runs it may be reproved on.
  const shownMethod = detail.value?.method ?? ''
  const chosenOptions = useRead<RoutineAuthoringOptions>(enabled && !!shownMethod, adapter, !!adapter.routineAuthoring && !!shownMethod,
    source => source.routineAuthoring!.options(shownMethod, project ?? undefined), `${key}|${routine ?? ''}|${shownMethod}`)
  const [pending, setPending] = useState<RoutineAuthoringResult | null>(null)
  useEffect(() => { setPending(null) }, [adapter, adapter.ownerEpoch, project])
  const answered = useCallback(async () => { await Promise.all([lists.refresh(), detail.refresh()]) }, [lists, detail])
  /** Act on the routine only on the basis it was read on (AutomationPreferences.tsx act). */
  const onBasis = useCallback(async (ref: string) => {
    const shown = detail.value
    if (!shown || shown.routine !== ref) throw new Error('Read the routine first: choose it in the list.')
    const fresh = await ask(adapter, {action: 'show', routine_ref: ref})
    if (routineBasis(fresh) !== routineBasis(shown)) { detail.set(fresh as RoutineDetail); throw new Error('The routine changed after it was read. Review its current state before retrying.') }
    return shown
  }, [adapter, ask, detail])
  return useMemo(() => {
    const why: Record<string, string> = {}
    if (!adapter.invoke) { why.runNow = NO_INVOKE('Automations'); why.disableRoutine = NO_INVOKE('Automations') }
    if (!adapter.routineAuthoring) for (const k of ['enableRoutine', 'reprove', 'createRoutine', 'checkCreation']) why[k] = NO_AUTHORING
    else {
      if (!adapter.routineAuthoring.reprove) why.reprove = 'Reprove: the adapter\'s routine authoring carries no reprove (RoutineAuthoringSource.reprove).'
      if (!adapter.routineAuthoring.readResult) why.checkCreation = 'Check result: the adapter\'s routine authoring cannot read a creation back (RoutineAuthoringSource.readResult).'
      if (pending) why.createRoutine = 'Creation is awaiting its result. This draft cannot be submitted again; closing it does not cancel the native operation.'
      else why.checkCreation ??= 'No creation waits for its result.'
    }
    const refused: Record<string, string> = {}
    for (const error of [lists.error, history.error, detail.error]) if (error) refused.context = error
    if (options.error) refused.createRoutine = options.error
    if (chosenOptions.error) refused.enableRoutine = chosenOptions.error
    // What the form's choosers read (proofs, triggers, authorities, profiles, context scopes, the civil-time zone) and whether the chosen
    // authority permits the chosen trigger (the old review's line).
    const choices = options.value
    const chosenAuthority = choices?.authorities.find(row => row.document.authority_ref === held('new.authority'))?.document
    const chosenTrigger = held('new.trigger') === NEW_SCHEDULE ? {schema: 'aikit.time-schedule/v1', schedule_ref: '', schedule: {}} as const
      : choices?.triggers.find(row => triggerKey(row.document) === held('new.trigger'))?.document
    const shownOptions = choices ? {
      proofs: eligibleProofs(choices, method).map(row => ({ref: row.document.proof_ref, title: row.title})),
      triggers: choices.triggers.map(row => ({ref: triggerKey(row.document), title: row.title})),
      authorities: choices.authorities.map(row => ({ref: row.document.authority_ref, title: row.title})),
      profiles: choices.profiles.map(row => ({ref: row.ref, title: row.title})),
      scopes: choices.contextScopes.map(row => ({ref: row.ref, title: row.title})),
      ...(choices.timePolicy ? {timezone: choices.timePolicy.timezone} : {}),
      ...(chosenAuthority && chosenTrigger ? {permits: authorityAllowsTrigger(chosenAuthority, chosenTrigger)} : {}),
    } : null
    const shown = chosenOptions.value
    const projects = (adapter.scopeChoices ?? []).flatMap(choice => choice.address.scope_kind === 'project' && choice.address.scope_ref ? [{ref: choice.address.scope_ref, title: choice.title}] : [])
    const values = automationValues({list: lists.value?.list ?? null, methods: lists.value?.methods ?? null, history: history.value, detail: detail.value, project, projects, options: shownOptions,
      grants: shown ? shown.authorities.map(row => ({ref: row.document.authority_ref, title: row.title})) : null,
      reproofs: shown && detail.value ? eligibleProofs(shown, detail.value.method).map(row => ({ref: row.document.proof_ref, title: row.title})) : null,
      pending: pending ? said(pending) : null})
    return {values, why, refused, reread: async () => { await Promise.all([lists.refresh(), history.refresh(), detail.refresh(), options.refresh(), chosenOptions.refresh()]) },
      acts: {
        runNow: async ref => { await onBasis(String(ref)); const value = await ask(adapter, {action: 'run_now', routine_ref: String(ref)}); await answered(); return actionMessage(value) },
        disableRoutine: async ref => { await onBasis(String(ref)); const value = await ask(adapter, {action: 'disable', routine_ref: String(ref)}); await answered(); return actionMessage(value) },
        createRoutine: async () => {
          const authoring = adapter.routineAuthoring
          if (!authoring) throw new Error(NO_AUTHORING)
          if (pending) throw new Error(why.createRoutine)
          if (!choices) throw new Error('Choose a Method first: its verified runs, schedules and authorities are read for it.')
          const proof = eligibleProofs(choices, method).find(row => row.document.proof_ref === held('new.proof'))?.document
          const authority = chosenAuthority
          const name = text(held('new.name')), fresh = held('new.trigger') === NEW_SCHEDULE
          let trigger = fresh ? undefined : choices.triggers.find(row => triggerKey(row.document) === held('new.trigger'))?.document
          if (!name || !proof || !authority || (!trigger && !fresh)) throw new Error('Choose a name, a verified Method run, a trigger and a native authority receipt.')
          const scopes = listOf(held('new.scopes')), profile = text(held('new.profile')) || null
          // The receipts are read again: a proof, a trigger or an authority that changed since you chose it is refused (the old review's basis).
          const latest = await authoring.options(method, project ?? undefined)
          const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
          if (!same(eligibleProofs(latest, method).find(row => row.document.proof_ref === proof.proof_ref)?.document, proof)
            || !same(latest.authorities.find(row => row.document.authority_ref === authority.authority_ref)?.document, authority)
            || (!fresh && !same(latest.triggers.find(row => triggerKey(row.document) === triggerKey(trigger))?.document, trigger))
            || (profile && !latest.profiles.some(row => row.ref === profile)) || scopes.some(ref => !latest.contextScopes.some(row => row.ref === ref))) {
            options.set(latest)
            throw new Error('The selected proof, trigger or authority changed. Choose from the current native reading and review again. Your draft is retained.')
          }
          if (fresh) {
            if (!authoring.prepareSchedule) throw new Error('The native schedule preparation operation is not connected.')
            const repeat = (REPEATS as readonly string[]).includes(String(held('new.repeat'))) ? String(held('new.repeat')) as ScheduleShape['kind'] : 'daily'
            trigger = await authoring.prepareSchedule(scheduleFromInput(repeat, text(held('new.schedule'))), project ?? undefined)
            if (trigger.schema !== 'aikit.time-schedule/v1' || !trigger.schedule_ref) throw new Error('AIKit did not return a native schedule identity.')
          }
          const result = await authoring.create({name, description: text(held('new.description')), method, proof, trigger: trigger!, authority, agent_profile: profile, context_scope: scopes}, project ?? undefined)
          if (result.status === 'pending') { setPending(result); return said(result) }
          if (result.status !== 'acknowledged') throw new Error(said(result))
          done(['adding', 'new.name', 'new.description', 'new.method', 'new.proof', 'new.trigger', 'new.repeat', 'new.schedule', 'new.authority', 'new.profile', 'new.scopes'])
          await lists.refresh()
          return said(result)
        },
        checkCreation: async () => {
          const authoring = adapter.routineAuthoring
          if (!pending) throw new Error('No creation waits for its result.')
          if (!authoring?.readResult) throw new Error(why.checkCreation ?? NO_AUTHORING)
          const result = await authoring.readResult(pending, project ?? undefined)
          setPending(result.status === 'pending' ? result : null)
          if (result.status === 'acknowledged') {
            done(['adding', 'new.name', 'new.description', 'new.method', 'new.proof', 'new.trigger', 'new.repeat', 'new.schedule', 'new.authority', 'new.profile', 'new.scopes'])
            await lists.refresh()
          }
          if (result.status === 'refused' || result.status === 'failed') throw new Error(said(result))
          return said(result)
        },
        enableRoutine: async ref => {
          const authoring = adapter.routineAuthoring
          if (!authoring) throw new Error(NO_AUTHORING)
          const routineNow = await onBasis(String(ref))
          const chosen = shown?.authorities.find(row => row.document.authority_ref === held('new.grant'))?.document
          if (!chosen) throw new Error('Enable: choose the authority it runs under first.')
          const latest = (await authoring.options(routineNow.method, project ?? undefined)).authorities.find(row => row.document.authority_ref === chosen.authority_ref)?.document
          const unattended = routineNow.trigger.kind !== 'manual'
          if (!latest || JSON.stringify(latest) !== JSON.stringify(chosen) || !chosen.granted || (unattended && !chosen.unattended)) {
            await chosenOptions.refresh()
            throw new Error('The authority receipt changed or does not permit this trigger. Choose its current authority and retry.')
          }
          const result = await authoring.enable(String(ref), chosen, project ?? undefined)
          if (result.status !== 'acknowledged') throw new Error(said(result))
          done(['new.grant'])
          await answered()
          return said(result)
        },
        reprove: async ref => {
          const authoring = adapter.routineAuthoring
          if (!authoring?.reprove) throw new Error(why.reprove ?? NO_AUTHORING)
          const routineNow = await onBasis(String(ref))
          const chosen = shown ? eligibleProofs(shown, routineNow.method).find(row => row.document.proof_ref === held('new.reproof'))?.document : undefined
          if (!chosen) throw new Error('Reprove: choose the verified run of the Method\'s current revision first.')
          const latest = eligibleProofs(await authoring.options(routineNow.method, project ?? undefined), routineNow.method).find(row => row.document.proof_ref === chosen.proof_ref)?.document
          if (!latest || JSON.stringify(latest) !== JSON.stringify(chosen)) { await chosenOptions.refresh(); throw new Error('The verified run changed. Choose the current proof and retry.') }
          const result = await authoring.reprove(String(ref), chosen, project ?? undefined)
          if (result.status !== 'acknowledged') throw new Error(said(result))
          done(['new.reproof'])
          await answered()
          return said(result)
        },
      }}
  }, [adapter, lists.value, lists.error, history.value, history.error, detail.value, detail.error, options.value, options.error, chosenOptions.value, chosenOptions.error,
    project, method, ask, answered, onBasis, held, done, lists, history, detail, options, chosenOptions, pending])
}

// ---------------------------------------------------------------------------------------------------------------- Products and System

/** Whether an operation runs from here: disclosed, shown in a UI, taking no argument, with its native path (ProductPreferences.tsx, unchanged). */
export function runnableProductAction(action: DisclosedAction): boolean {
  const path = (action as DisclosedAction & {native_path?: unknown}).native_path
  return action.availability === 'disclosed' && action.exposure?.ui !== false && !action.args?.length && typeof path === 'string' && !!path && !/[<[]/.test(path)
}
/** The owner's own words in a failed operation's output: a string, or its message (ProductPreferences.tsx, unchanged). */
export function outputWords(output: unknown): string | null {
  if (typeof output === 'string') return output
  const message = output && typeof output === 'object' ? (output as {message?: unknown}).message : undefined
  return typeof message === 'string' ? message : null
}

/** Products & updates and System (ProductPreferences.tsx): each product's mount, its operations, the last operation's answer, and each
 * owner's System disclosure, from one composition reading (system_composition_read). A refusal is the owner's words, read by the one
 * refusal reader (agent/RefusalCard.tsx refusalLine), as OwnerRefusal read them. */
export function useProductsPage(adapter: SettingsAdapter, enabled: boolean): PagePart {
  const read = useRead<SystemCompositionReading>(enabled, adapter, !!adapter.readProducts, async source => {
    try { return await source.readProducts!() } catch (cause) { throw new Error(refusalLine(words(cause), 'The installed products could not be read.')) }
  })
  const [ran, setRan] = useState<{product: string; title: string; ok: boolean; at: string; rows?: [string, unknown][]} | null>(null)
  useEffect(() => { setRan(null) }, [adapter, adapter.ownerEpoch])
  return useMemo(() => {
    const why: Record<string, string> = {}
    if (!adapter.readProducts) why.reread = NO_PRODUCTS
    if (!adapter.invoke) why.run = NO_INVOKE('Product operations')
    const values = {...productValues(read.value, runnableProductAction, ran), ...systemValues(read.value)}
    return {values, why, refused: refusedOn('reread', read.error), reread: read.refresh,
      acts: {
        run: async value => {
          const [product, ...rest] = String(value).split(':'), ref = rest.join(':')
          const action = read.value?.owners.find(mount => mount.product_id === product)?.descriptor?.actions.find(item => item.action_ref === ref)
          if (!action || !runnableProductAction(action)) throw new Error(action?.availability === 'disclosed' ? 'Choose its subject at the point of use.' : action?.unavailable_reason ?? 'No native operation available.')
          if (!adapter.invoke) throw new Error(NO_INVOKE('Product operations'))
          const source = adapter, answer = await adapter.invoke({op: 'product_action_run', product_id: product!, action_ref: action.action_ref})
          if (answer.error || answer.outcome?.result !== 'product_action_ran') throw new Error(refusalLine(answer.error, 'The native owner did not acknowledge this operation.'))
          const data = answer.outcome.data as {ok?: unknown; output?: unknown; ran_at_unix_ms?: unknown}
          if (typeof data?.ok !== 'boolean' || typeof data.ran_at_unix_ms !== 'number') throw new Error('The owner returned no qualified operation result.')
          if (!read.current(source)) return
          setRan({product: product!, title: action.title, ok: data.ok, at: new Date(data.ran_at_unix_ms).toISOString().slice(11, 16), ...(data.ok ? {rows: scalarEntries(data.output)} : {})})
          await read.refresh()
          if (!data.ok) throw new Error(refusalLine(outputWords(data.output), 'The native owner reports a problem.'))
          return `${action.title}: the native owner reports success`
        },
      }}
  }, [adapter, read.value, read.error, read.refresh, ran, read])
}
