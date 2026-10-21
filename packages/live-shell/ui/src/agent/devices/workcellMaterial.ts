// Workcell's material readings for the workcell rack's pages, the Remote carrier's Standing page and Runs' Outputs (lane W10, design package
// D1; T-COVERAGE §2), through the kernel's workcell_read (lanes W3 round 3 and W6 round 2; desktop/cradle/kernel/src/owner_routes.rs
// WorkcellRead), each answering Workcell's own document. Real shapes in desktop/cradle/kernel/tests/fixtures/owner-routes/
// workcell-material-2026-10-21.json and workcell-connections-probe-2026-10-21.json (read-only captures):
//   doctor            {declared_services [{logical_ref, endpoint, health, availability, lifetime, provider_ref}], instances {live, stale,
//                     status}, shell, state_root_writable, writable_workspace, …}            → the rack's `services`
//   instances list    {instances [{instance_ref, harness_ref, liveness, pids, …}]}          → the rack's `instances`
//   instances usage   workcell.resource-usage/v1 {metrics {cpu_utilisation {value, unit percent, standing}, memory_rss {value, unit
//                     bytes, standing}, …}} — a metric the provider marks unsupported is left out
//   discover          {offers [{offer_ref, port, provider_ref, health, availability, …}]}    → the carrier's `offers`
//   plan              {status satisfiable · degraded · unsatisfiable, planned_bindings, degradations, omissions}  → the carrier's `plan`
//   connections probe workcell.connection-probe/v1 {probes [{label, state reachable · incompatible · refused · unreachable, rtt_ms?,
//                     authorised?, reason?, detail?, remote_software?}]}                     → each machine's standing and round trip
//   collect           {world_ref, outputs [{logical_ref, material_locator, provenance}], omissions}  → Runs' `collected`
// Nothing is invented: a field Workcell does not name is left out of its row. Pure.

/** Why a run's world is not read: every world reading and write takes the world's receipt, and no reading names one. */
export const NO_RUN = 'a run\'s world receipt (`workcell --receipt R material|collect|recover|release|reconcile`): no reading here names one — `workcell status` counts the persisted world receipts (persisted_world_receipts) and lists none, a workcell\'s return track carries no run, and a Factory attempt keeps its world\'s ref, not its receipt'

type Obj = Record<string, unknown>
const isObj = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value)
const str = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value : undefined)
const num = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)
const keep = (row: Obj, pairs: readonly (readonly [string, string])[]): Obj =>
  Object.fromEntries(pairs.flatMap(([to, from]) => (str(row[from]) ? [[to, row[from]]] : [])))

/** `workcell doctor`'s declared services as the rack's Services (workcell__workcell.tsx `services` [{ref, endpoint, health, availability,
 * lifetime}]). Null when the answer is not doctor's. */
export function servicesOf(doctor: unknown): Record<string, unknown>[] | null {
  if (!isObj(doctor) || !Array.isArray(doctor.declared_services)) return null
  return doctor.declared_services.flatMap(row => (isObj(row) && str(row.logical_ref)
    ? [{ref: row.logical_ref, ...keep(row, [['endpoint', 'endpoint'], ['health', 'health'], ['availability', 'availability'], ['lifetime', 'lifetime']])}] : []))
}

/** One metric of a usage reading, where the provider observed or derived it. */
const metric = (usage: unknown, key: string): number | undefined => {
  const value = isObj(usage) && isObj(usage.metrics) && isObj(usage.metrics[key]) ? usage.metrics[key] as Obj : null
  return value && value.standing !== 'unsupported' ? num(value.value) : undefined
}

/** Workcell's liveness word for a harness process that runs now (`instances list` liveness: live · stale). */
export const PROCESS_RUNNING = 'live'

/** The pid one instance's cost is read on: its newest execution (the last of its pids). */
export const usagePid = (instance: Obj): number | undefined => (Array.isArray(instance.pids) ? num(instance.pids[instance.pids.length - 1]) : undefined)

/** `workcell instances list` with each live instance's `instances usage` as the rack's instances ({ref, harness, liveness, pids, cpu?
 * (percent), rss? (bytes)}). Null when the answer is not the list. */
export function instancesOf(list: unknown, usages: Readonly<Record<string, {readonly value?: unknown}>> = {}): Record<string, unknown>[] | null {
  if (!isObj(list) || !Array.isArray(list.instances)) return null
  return list.instances.flatMap(row => {
    if (!isObj(row) || !str(row.instance_ref) || !str(row.harness_ref)) return []
    const usage = usages[String(row.instance_ref)]?.value
    const cpu = metric(usage, 'cpu_utilisation'), rss = metric(usage, 'memory_rss')
    const pids = Array.isArray(row.pids) ? row.pids.filter((pid): pid is number => typeof pid === 'number') : undefined
    return [{ref: row.instance_ref, harness: row.harness_ref, ...(str(row.liveness) ? {liveness: row.liveness} : {}), ...(pids ? {pids} : {}),
      ...(cpu !== undefined ? {cpu} : {}), ...(rss !== undefined ? {rss} : {})}]
  })
}

/** `workcell discover`'s offers as the carrier's Offers (workcell__remote-carrier.tsx `offers` [{ref, port, health?, availability?}]). Null
 * when the answer is not discover's. */
export function offersOf(discover: unknown): Record<string, unknown>[] | null {
  if (!isObj(discover) || !Array.isArray(discover.offers)) return null
  return discover.offers.flatMap(row => (isObj(row) && str(row.offer_ref) && str(row.port)
    ? [{ref: row.offer_ref, port: row.port, ...keep(row, [['health', 'health'], ['availability', 'availability']])}] : []))
}

/** `workcell plan`'s reading as the carrier's Plan ({status, bindings [{ref, necessity, offer}], degradations, omissions}). Null when the
 * answer is not a plan. */
export function planOf(plan: unknown): Record<string, unknown> | null {
  if (!isObj(plan) || !str(plan.status)) return null
  const needs = (list: unknown) => (Array.isArray(list) ? list.flatMap(row => (isObj(row) && str(row.requirement)
    ? [{requirement: row.requirement, ...keep(row, [['necessity', 'necessity'], ['reason', 'reason']])}] : [])) : [])
  const bindings = Array.isArray(plan.planned_bindings) ? plan.planned_bindings.flatMap(row => (isObj(row) && str(row.logical_ref)
    ? [{ref: row.logical_ref, ...keep(row, [['necessity', 'necessity'], ['offer', 'offer_ref']])}] : [])) : []
  return {status: plan.status, bindings, degradations: needs(plan.degradations), omissions: needs(plan.omissions)}
}

/** What one probe says of a connected machine, in the carrier's words: reached and authorised is Ready (it answers and admits this
 * machine); reached but not authorised, refused and incompatible stand as Workcell's own refusal with its reason; unreachable keeps the
 * recorded standing and says why. The round trip is the probe's, where it reached. */
export function probeFields(probe: unknown): Record<string, unknown> {
  if (!isObj(probe)) return {}
  const rtt = num(probe.rtt_ms), why = str(probe.reason) ?? str(probe.detail)
  const software = str(probe.remote_software)
  const common = {...(rtt !== undefined ? {rtt} : {}), ...(software ? {software} : {})}
  switch (probe.state) {
    case 'reachable': return probe.authorised === true ? {...common, state: 'ready'} : {...common, state: 'refused', ...(why ? {why} : {})}
    case 'refused': case 'incompatible': return {...common, state: probe.state, ...(why ? {why} : {})}
    case 'unreachable': return {...common, ...(why ? {why: `Unreachable: ${why}`} : {why: 'Unreachable.'})}
    default: return common
  }
}

/** Each probe of `workcell connections probe`, by its connection's label. Empty when the answer is not the probe reading. */
export function probesByLabel(reading: unknown): Record<string, Obj> {
  if (!isObj(reading) || reading.schema !== 'workcell.connection-probe/v1' || !Array.isArray(reading.probes)) return {}
  return Object.fromEntries(reading.probes.flatMap(row => (isObj(row) && str(row.label) ? [[String(row.label), row]] : [])))
}

/** `workcell --receipt R collect`'s reading as one attempt's collected outputs (software-factory__attempt-review.tsx `collected` row
 * {attempt, world, outputs [{ref, locator, provenance}], omitted [{requirement, reason}]}). Null when the answer is not a collection. */
export function collectedOf(attempt: string, collect: unknown): Record<string, unknown> | null {
  if (!isObj(collect) || !str(collect.world_ref) || !Array.isArray(collect.outputs)) return null
  const outputs = collect.outputs.flatMap(row => (isObj(row) && str(row.logical_ref)
    ? [{ref: row.logical_ref, ...keep(row, [['locator', 'material_locator'], ['provenance', 'provenance']])}] : []))
  const omitted = (Array.isArray(collect.omissions) ? collect.omissions : []).flatMap(row => (isObj(row) && str(row.requirement)
    ? [{requirement: row.requirement, ...keep(row, [['reason', 'reason']])}] : []))
  return {attempt, world: collect.world_ref, outputs, omitted}
}
