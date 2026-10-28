// The one Agent (DLW §16.1 "One job is one device, in every mode … one Agent (§19.4): who it is, how it works, how much it decides
// alone, and its thread"; §19.4 "Wherever it sits, it is the same agent, with the same settings, the same custody and the same thread";
// lock §0.3.5 "the Agent carries Custody, Identity and the Thread (as its Full)"). The Agent's design carries the other three as pages
// of its own values, each under a prefix (inhabitants/catalogue/panels/design.ts `scoped`/`prefixed`; actuation__harness-model.tsx
// custodyOf/identityOf/threadOf, 3679a9ceb): Custody's keys as `custody.*`, Identity's as `id.*`, the Thread's as `thread.*`, and the
// keys a page shares with the Agent (its light, the autonomy both show, the composer the thread sends) unprefixed. So a binding hosts
// the carried page by prefixing that page's own binding — this module is that prefixing, and nothing more: every value is still the
// carried binding's owner reading, every write still goes to the carried binding's owner, every refusal is still in its words.
//
// Replaces the three devices that stood beside the Agent (FactoryDeviceChain.tsx's Thread and Custody members of the Agent slot;
// CentralDevices.tsx's Agent identity before the Answer): their bindings (threadBinding.ts, sessionChainBindings.ts custodyBinding,
// central/devices/identityBinding.ts) are unchanged and composed here. Pure.
import type {DesignBinding, Standing, Value, ValueChange, Values} from '../../frame/devices/designed'

/** A page the Agent carries: its prefix, the keys it shares with the Agent (read and written as the Agent's own), and which of those
 * shared keys the page owns — read from the page's binding and written to its owner rather than the Agent's (Custody sets the autonomy
 * the Agent's Run page reads: actuation__harness-model.tsx:205 "Custody sets it; you read it here"). */
export interface CarriedPage {
  readonly prefix: string
  readonly shared: readonly string[]
  readonly owns?: readonly string[]
}

// The shared keys restate the design's (actuation__harness-model.tsx:18-20 CUSTODY_SHARED, IDENTITY_SHARED, THREAD_SHARED); the R4 test
// derives them again from the design's own defaults (a carried default absent under the prefix is shared) and fails on any drift.
export const CUSTODY_PAGE: CarriedPage = {prefix: 'custody.', shared: ['light', 'autonomy'], owns: ['autonomy']}
export const IDENTITY_PAGE: CarriedPage = {prefix: 'id.', shared: ['light']}
export const THREAD_PAGE: CarriedPage = {prefix: 'thread.', shared: ['light', 'input', 'quantize', 'draft', 'sent', 'age']}
/** The Voice page (manual §19.4 "The Voice page"; §19.21 "How an agent speaks … is the Agent's Voice page"): Voice's own keys under
 * `speech.` (actuation__harness-model.tsx VOICE_SHARED), its light the Agent's. */
export const VOICE_PAGE: CarriedPage = {prefix: 'speech.', shared: ['light']}
/** Files' Diff page (manual §23.2, §23.4 "Reading what changed before you approve it … is the Diff page of Files"; widgets__files.tsx): the
 * Diff's own keys under `diff.`. */
export const DIFF_PAGE: CarriedPage = {prefix: 'diff.', shared: []}
/** The Workcells tile's gateways (manual §19.3 "Every gateway your machines reach, with its state, is listed on the Workcells tile";
 * workcell__workcell.tsx `gw.` keys): the gateways' own keys under `gw.`. */
export const GATEWAYS_PAGE: CarriedPage = {prefix: 'gw.', shared: []}
/** Git / landing's Seat page (§19.17 "Claiming a seat … is the Seat page of Git / landing"; workcell__git-seat.tsx `seat.` keys): the seat
 * instrument's binding under `seat.`. */
export const SEAT_PAGE: CarriedPage = {prefix: 'seat.', shared: []}
/** Git / landing's Checkouts page (§19.16 "The Checkouts page"; workcell__git-seat.tsx `co.` keys): Ground hygiene's census under `co.`. */
export const CHECKOUTS_PAGE: CarriedPage = {prefix: 'co.', shared: []}
/** The Remote carrier's Machine page (§18.7, §19.18 "The Machine page"; workcell__remote-carrier.tsx `mc.` keys): Central's machine readings
 * under `mc.`. */
export const MACHINE_PAGE: CarriedPage = {prefix: 'mc.', shared: []}
/** The Skillset rack's Capture page (§19.11 "the Capture page of the Skillset rack"; skills.tsx `capture.` keys). */
export const CAPTURE_PAGE: CarriedPage = {prefix: 'capture.', shared: []}
/** The Agentset rack's Helper page (§19.20 "on the rack's Helper page"; software-factory__agentset-rack.tsx `helper.` keys). */
export const HELPER_PAGE: CarriedPage = {prefix: 'helper.', shared: []}

export interface CarriedBindings {
  readonly custody?: DesignBinding | null
  readonly identity?: DesignBinding | null
  readonly thread?: DesignBinding | null
  readonly voice?: DesignBinding | null
}

/** One page a device carries, on the binding that owns it. */
export interface Carried {readonly page: CarriedPage; readonly binding: DesignBinding}

const carriedOf = (pages: CarriedBindings): Carried[] => [
  ...(pages.custody ? [{page: CUSTODY_PAGE, binding: pages.custody}] : []),
  ...(pages.identity ? [{page: IDENTITY_PAGE, binding: pages.identity}] : []),
  ...(pages.thread ? [{page: THREAD_PAGE, binding: pages.thread}] : []),
  ...(pages.voice ? [{page: VOICE_PAGE, binding: pages.voice}] : []),
]

/** Where one key of the Agent lives: a carried page's own key (prefixed, or a shared key the page owns), else the Agent's own. */
function route(carried: readonly Carried[], key: string): {binding: DesignBinding | null; key: string} {
  for (const {page, binding} of carried) {
    if (key.startsWith(page.prefix)) {
      const own = key.slice(page.prefix.length)
      return page.shared.includes(own) ? {binding: null, key} : {binding, key: own}
    }
    if (page.owns?.includes(key)) return {binding, key}
  }
  return {binding: null, key}
}

/** A carried page's record laid into the Agent's keys: its own keys under the prefix, the shared keys it owns as they are; the shared
 * keys it does not own are the Agent's, so they are left out. */
function lay<T>(into: Record<string, T>, page: CarriedPage, record: Readonly<Record<string, T>> | undefined): void {
  for (const [key, value] of Object.entries(record ?? {})) {
    if (page.shared.includes(key)) { if (page.owns?.includes(key)) into[key] = value }
    else into[page.prefix + key] = value
  }
}

/** The one Agent's binding: the Agent's own binding with each carried page's laid in under its prefix. A value is its owner's reading; a
 * change goes to the owner of its key; a refusal is that owner's. A carried page that is absent leaves its keys absent (the design then
 * draws "—" and names the missing reading). */
export function composeAgentBinding(own: DesignBinding, pages: CarriedBindings): DesignBinding {
  return carryPages(own, carriedOf(pages))
}

/** Any device's binding with the pages it carries laid in, each under its prefix (the 22 Oct catalogue: a device whose design draws a
 * retired device's parts as a page of its own hosts that page by prefixing the retired device's binding — Git / landing's Seat and
 * Checkouts, the Remote carrier's Machine, the Agent's Voice). The same rule as the Agent's: a value is its owner's reading, a change goes
 * to the owner of its key, a refusal is that owner's. Pure. */
export function carryPages(own: DesignBinding, carried: readonly Carried[]): DesignBinding {
  const values: Record<string, Value> = {...own.values}
  const standing: Record<string, Standing> = {...(own.standing ?? {})}
  const heldBy: Record<string, string> = {...(own.heldBy ?? {})}
  const modulatedBy: Record<string, string> = {...(own.modulatedBy ?? {})}
  const local: Record<string, (value: Value | undefined) => void> = {...(own.local ?? {})}
  for (const {page, binding} of carried) {
    // An owned shared key is the page's: the Agent's own reading of it gives way (Factory's two read the same task record; on
    // Central only Custody would report it).
    for (const key of page.owns ?? []) { delete values[key]; delete standing[key] }
    lay(values, page, binding.values)
    lay(standing, page, binding.standing)
    lay(heldBy, page, binding.heldBy)
    lay(modulatedBy, page, binding.modulatedBy)
    lay(local, page, binding.local)
  }
  const target = (key: string) => route(carried, key)
  return {
    id: own.id,
    values: values as Values,
    ...(Object.keys(standing).length ? {standing} : {}),
    ...(Object.keys(heldBy).length ? {heldBy} : {}),
    ...(Object.keys(modulatedBy).length ? {modulatedBy} : {}),
    ...(Object.keys(local).length ? {local} : {}),
    ...(own.enabledKey ? {enabledKey: own.enabledKey} : {}),
    writes: key => {
      const at = target(key)
      const binding = at.binding ?? own
      // A binding that carries no write writes nothing: every key of it is a reading.
      if (!binding.write) return false
      return binding.writes ? binding.writes(at.key) : true
    },
    write: async (changes: readonly ValueChange[]) => {
      for (const change of changes) {
        const at = target(change.key)
        const binding = at.binding ?? own
        if (!binding.write) throw Error(`${change.key} is a reading: its owner reports it; nothing here changes it.`)
        await binding.write([{key: at.key, value: change.value}])
      }
    },
    // Hand back only where some owner of the Agent's keys takes it back.
    ...(own.handBack || carried.some(({binding}) => binding.handBack) ? {handBack: async (key: string) => {
      const at = target(key)
      const binding = at.binding ?? own
      if (!binding.handBack) throw Error(`${key}: its owner takes nothing back from here.`)
      await binding.handBack(at.key)
    }} : {}),
  }
}
