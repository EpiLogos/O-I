// The provider a new chat starts with, as one of the owners' settings (manual §10.10 Harnesses & models: "The provider a new chat starts
// with"; "A change is local until you review it"; O-I #744 round two). O:I's chat-default owner keeps it (HarnessSource: chat_default_hold,
// chat_default_discard; the providers and the held choice read with the harnesses); it contributes no setting to the configuration
// registry, so it stands on the window's one path for owned settings (ownedSettings.ts): a change of it is a draft like every other, planned
// and applied through its owner by Review changes…, and Reset on its row is the owner's withdrawal of the saved choice. Ported from
// windowPages.ts useHarnessPage's `save`, as it stood (#758): the guard that reads the owner again and refuses when the saved default moved
// under the choice or the provider is no longer configured, then holds it, then reads it back. Pure, apart from the owner's operations.
import type {ConfigResolution, PlanDocument, ScopeAddress} from './adapter'
import type {Draft, SettingEntry} from './model'
import type {HarnessReading, HarnessSource, ProviderRow} from '../../../../../desktop/cradle/src/configuration/harnessSource'
import {effectiveChatDefault} from '../../../../../desktop/cradle/src/configuration/harnessSource'
import {ownedEntry, ownedOperation, ownedPlan, ownedResolution, planBasis, planValue, type OwnedSetting} from './ownedSettings'

/** The chat default's identity among the owners' settings (its page is Harnesses & models: model.ts categoryOf reads `harness`). */
export const CHAT_DEFAULT_REF = 'oi:harness:chat.default'
export const CHAT_DEFAULT_SCOPE: ScopeAddress = {scope_kind: 'machine', scope_ref: null}
const OWNER = 'oi'
const EFFECT = {kind: 'session-restart-required' as const, summary: 'New chats start with this provider; a conversation keeps its own once it starts.'}
const SAID = 'Native owner withdrew the saved choice. New chats follow the configured order; the current conversation keeps its provider.'

/** The basis a change of the chat default is made on: the saved choice, or none. */
export const chatDefaultDigest = (reading: HarnessReading): string => `chat-default:${reading.heldDefault?.value ?? ''}`

const providersOf = (reading: HarnessReading): ProviderRow[] => (reading.providers.state === 'ok' ? reading.providers.rows : [])
const labelOf = (rows: readonly ProviderRow[], id: string | undefined): string => (id ? rows.find(row => row.id === id)?.label ?? id : 'the configured order')

/** The chat default as the engine reads an owner's setting: the configured providers its choices. */
export function chatDefaultEntry(rows: readonly ProviderRow[]): SettingEntry {
  return ownedEntry({ref: CHAT_DEFAULT_REF, owner: OWNER, section: 'harness', native: 'chat.default', title: 'Default provider',
    description: 'The provider a new chat starts with. A conversation keeps its own once it starts. With none saved, new chats follow the configured order.',
    options: rows.map(row => ({value: row.id, title: row.label})), scope: CHAT_DEFAULT_SCOPE, effect: EFFECT, resets: true})
}

/** The owner's reading as a resolution at this machine: the saved choice where one is held (this scope), else the provider in effect by the
 * configured order (inherited). A saved choice that no longer names a configured provider is said, never hidden. */
export function chatDefaultResolution(reading: HarnessReading): ConfigResolution {
  const rows = providersOf(reading), held = reading.heldDefault?.value, effective = effectiveChatDefault(rows, held ?? null)?.provider
  const drift = held && !rows.some(row => row.id === held) ? `The saved provider ${held} is no longer configured; new chats follow the configured order.` : undefined
  return ownedResolution(CHAT_DEFAULT_REF, CHAT_DEFAULT_SCOPE, OWNER, 'chat_default', {...(held ? {declared: held} : {}), ...(effective ? {effective} : {})}, chatDefaultDigest(reading), drift)
}

/** The owner's reading now, as the page reads it (a fixture never qualifies production settings). */
async function readOwner(source: HarnessSource): Promise<HarnessReading> {
  const answer = await source.read()
  if (answer.kind === 'fixture' && !import.meta.env?.DEV) throw new Error('Fixture harness readings cannot qualify production settings.')
  if (answer.defaultState.state !== 'ok' || answer.providers.state !== 'ok') throw new Error('Read the native provider rows and saved default before changing it.')
  return answer
}

/** The plan on a reading just read: refused where the saved default moved under the change, or the provider is no longer configured. */
export function chatDefaultPlanOn(reading: HarnessReading, draft: Draft): PlanDocument {
  if (chatDefaultDigest(reading) !== draft.basis) throw new Error('The saved provider default changed. Your change is kept; Keep it on the current reading, or Undo it, before reviewing again.')
  const rows = providersOf(reading), next = String(draft.value)
  if (!rows.some(row => row.id === next)) throw new Error('This provider is no longer configured.')
  const now = effectiveChatDefault(rows, reading.heldDefault?.value ?? null)?.provider
  return ownedPlan({ref: CHAT_DEFAULT_REF, scope: CHAT_DEFAULT_SCOPE, id: `chat-default-${reading.observed_at_unix_ms}`, basis: chatDefaultDigest(reading), before: now ?? '',
    after: next, summary: `${labelOf(rows, now)} → ${labelOf(rows, next)}`, native: 'chat.default', effect: EFFECT})
}

/** The chat default on the window's one path for owned settings: planned, applied (chat_default_hold) and reset (chat_default_discard) through
 * its owner, whose new reading `take` hands to the Harnesses & models page. None while the owner's providers or saved default are unread:
 * the page says the owner's refusal there. */
export function chatDefaultOwned(source: HarnessSource, reading: HarnessReading, take: (reading: HarnessReading) => void): OwnedSetting[] {
  if (reading.defaultState.state !== 'ok' || reading.providers.state !== 'ok') return []
  return [{entry: chatDefaultEntry(providersOf(reading)), scope: CHAT_DEFAULT_SCOPE, reading: chatDefaultResolution(reading),
    plan: async draft => { const now = await readOwner(source); take(now); return chatDefaultPlanOn(now, draft) },
    apply: async plan => {
      try {
        const before = await readOwner(source)
        if (planBasis(plan) !== chatDefaultDigest(before)) { take(before); return ownedOperation(plan, OWNER, 'failed', 'The saved provider default changed after review. Nothing was saved; review your change again.') }
        const provider = planValue(plan)
        if (!providersOf(before).some(row => row.id === provider)) return ownedOperation(plan, OWNER, 'failed', 'This provider is no longer configured.')
        await source.holdDefault(provider)
        take(await source.read())
        return ownedOperation(plan, OWNER, 'applied')
      } catch (cause) { return ownedOperation(plan, OWNER, 'failed', cause instanceof Error ? cause.message : String(cause)) }
    },
    reset: async () => { await source.discardDefault(); take(await source.read()); return SAID }}]
}
