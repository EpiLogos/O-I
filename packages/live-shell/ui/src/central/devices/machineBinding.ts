// Machine (DLW §18.7; T-COVERAGE §2 D2) on its catalogue design (`central:machine`, inhabitants/catalogue/panels/central__machine.tsx),
// bound to Central's machine readings through the kernel's invoke_action (action.rs routes every `machine.*` id to Central's runner):
//   machine.account            the authored roles, this machine as Central knows it, and its last observation;
//   machine.declaration {role} the chosen role's declaration (authored under Control/machines);
//   machine.plan {role}        the comparison: each requirement's verdict, and what the machine was observed to hold;
//   machine.verify {role}      whether the machine meets the declaration;
//   central.recovery.plan {role} how your source would synchronise, and how much of the machine would change.
// Each is `read-only` in Central's own description (ctrl action describe). Plan, Verify and the Recover page's Plan ask their readings
// again: a reading asked again, never a write. Apply (machine.apply), Adopt (machine.adopt-current) and Recover (central.recover) change
// the machine or its declaration; none is among the person's own presses the kernel carries (action.rs PERSON_ACTS), so each stands
// disabled naming that, and the last apply and the last recovery — which only those presses answer — stay absent. Pure.
import type {DesignBinding, Standing, Value, Values} from '../../frame/devices/designed'
import type {ActionAnswer} from './centralActions'
import {centralDeviceId} from './centralDeviceModel'
import {heldOf, pageBinding, type DesignWiring, type PageActs} from './pageBindings'

export const MACHINE_DESIGN = 'central:machine'
export const MACHINE_DEVICE_ID = centralDeviceId('machine')

export const MACHINE_ACCOUNT_ACTION = 'machine.account'
export const MACHINE_DECLARATION_ACTION = 'machine.declaration'
export const MACHINE_PLAN_ACTION = 'machine.plan'
export const MACHINE_VERIFY_ACTION = 'machine.verify'
export const RECOVERY_PLAN_ACTION = 'central.recovery.plan'

/** Why a press that changes the machine or its declaration sends nothing from here. */
const notThePersons = (action: string, does: string): string =>
  `${action} ${does}; it is not among the person's own presses the kernel carries (desktop/cradle/kernel/src/action.rs PERSON_ACTS), so nothing here sends it — missing route: ${action} as the person's act.`
const APPLY_REFUSED = notThePersons('machine.apply {role}', 'makes the changeable requirements so')
const ADOPT_REFUSED = notThePersons('machine.adopt-current {role}', 'writes what this machine holds into the role\'s declaration')
const RECOVER_REFUSED = notThePersons('central.recover {role}', 'synchronises your source, applies the plan and verifies')

export const MACHINE_WIRING: DesignWiring = {
  design: MACHINE_DESIGN,
  keys: ['light', 'roles', 'host', 'declared', 'observed', 'plan', 'applied', 'verified', 'recovery', 'recovered', 'role', 'mode', 'refresh', 'ask',
    'replan', 'verify', 'recoveryPlan', 'apply', 'adopt', 'recover'],
  reads: {
    light: 'lit when Central read the declaration and observed the machine (machine.declaration and machine.plan answered); dark when it refused either',
    roles: 'the authored declarations: machine.account authored[] (role, path, requirement_count)',
    host: 'this machine as last observed: machine.account current (hostname, machine_id), last_observation (platform, architecture, observed_at, connector_id), observation_stale',
    declared: 'the chosen role\'s declaration: machine.declaration {role} (bindings, capabilities, requirements)',
    observed: 'what the machine was observed to hold: machine.plan {role} observed.observation',
    plan: 'each requirement\'s verdict: machine.plan {role} entries (kind, id, status, port, connector.id, reason) and summary',
    verified: 'whether the machine meets the declaration: machine.verify {role} satisfied',
    recovery: 'the recovery plan: central.recovery.plan {role} synchronization (status, reason, connector.id), machine.summary changeable + missing',
  },
  writes: {
    replan: 'machine.account, machine.declaration {role} and machine.plan {role} asked again (readings through invoke_action)',
    verify: 'machine.verify {role} asked again (a reading through invoke_action)',
    recoveryPlan: 'central.recovery.plan {role} asked again (a reading through invoke_action)',
  },
  local: {
    role: 'the declaration the machine is read against (DLW §18.7 Role; by default the role this machine is bound to: Control/machines/current.json)',
    mode: 'Change: Off, Propose or Write (DLW §18.7; Propose by default)', refresh: 'Manual or On open (DLW §18.7; On open by default)',
    ask: 'the act waiting for Confirm under Propose',
  },
  refused: {apply: APPLY_REFUSED, adopt: ADOPT_REFUSED, recover: RECOVER_REFUSED},
  absent: {
    applied: 'The last apply is machine.apply\'s own report, answered to its press alone; no Central reading keeps it, and the press is not the person\'s here (action.rs PERSON_ACTS).',
    recovered: 'The last recovery is central.recover\'s own report, answered to its press alone; no Central reading keeps it, and the press is not the person\'s here (action.rs PERSON_ACTS).',
  },
}

/** The five readings the device draws, each Central's answer (or its words), or nothing yet. */
export interface MachineAnswers {
  readonly account: ActionAnswer
  readonly declaration: ActionAnswer
  readonly plan: ActionAnswer
  readonly verify: ActionAnswer
  readonly recovery: ActionAnswer
}
export const MACHINE_UNREAD: MachineAnswers = {account: {status: 'reading'}, declaration: {status: 'reading'}, plan: {status: 'reading'}, verify: {status: 'reading'}, recovery: {status: 'reading'}}

const rec = (x: unknown): Record<string, unknown> | undefined => (x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : undefined)
const text = (x: unknown): string | undefined => (typeof x === 'string' && x !== '' ? x : undefined)
const list = (x: unknown): unknown[] => (Array.isArray(x) ? x : [])
const answered = (answer: ActionAnswer): Record<string, unknown> | undefined => (answer.status === 'answered' ? rec(answer.value) : undefined)
const nonNegative = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : undefined)

/** The roles the account lists: each authored declaration's role, its path, and how many requirements it declares. */
export function rolesOf(account: unknown): {role: string; path: string | null; requirements: number | null}[] {
  return list(rec(account)?.authored).flatMap(entry => {
    const r = rec(entry), role = text(r?.role)
    return role ? [{role, path: text(r?.path) ?? null, requirements: nonNegative(r?.requirement_count) ?? null}] : []
  })
}

/** The role this machine is bound to (DLW §18.7 Role's default): the declaration at Control/machines/current.json, the one that binds this
 * machine; else the only role declared. None where the account names neither. Pure. */
export function boundRoleOf(account: unknown): string | null {
  const roles = rolesOf(account)
  return roles.find(role => role.path === 'Control/machines/current.json')?.role ?? (roles.length === 1 ? roles[0]!.role : null)
}

/** This machine as last observed (machine.account), in the design's words; null where the account names nothing of it. */
export function hostOf(account: unknown): Record<string, Value> | null {
  const a = rec(account)
  if (!a) return null
  const current = rec(a.current), last = rec(a.last_observation), seen = rec(last?.observation)
  const host: Record<string, Value> = {}
  const put = (key: string, value: Value | undefined) => { if (value !== undefined) host[key] = value }
  put('hostname', text(current?.hostname) ?? text(last?.hostname))
  put('machineId', text(current?.machine_id) ?? text(last?.machine_id))
  put('platform', text(seen?.platform))
  put('architecture', text(seen?.architecture))
  const at = typeof last?.observed_at === 'number' ? last.observed_at : typeof last?.observed_at === 'string' && /^\d+$/.test(last.observed_at) ? Number(last.observed_at) : undefined
  put('observedAt', at)
  if (typeof a.observation_stale === 'boolean') host.stale = a.observation_stale
  put('connector', text(last?.connector_id))
  return Object.keys(host).length ? host : null
}

/** The chosen role's declaration (machine.declaration: declaration), as the design lays it: its bindings, capabilities and requirements. */
export function declaredOf(declaration: unknown): Record<string, unknown> | null {
  const d = rec(rec(declaration)?.declaration)
  if (!d) return null
  const requirements = rec(d.requirements)
  return {
    bindings: list(d.bindings).flatMap(b => { const r = rec(b); return r && text(r.kind) && text(r.reference) ? [{kind: r.kind, reference: r.reference}] : [] }),
    capabilities: list(d.capabilities).filter(c => typeof c === 'string'),
    packages: list(requirements?.packages), configurations: list(requirements?.configurations), services: list(requirements?.services),
  }
}

const STATUSES: readonly string[] = ['satisfied', 'missing', 'changeable', 'unsupported']
type Summary = {satisfied: number; missing: number; changeable: number; unsupported: number}
const summaryOf = (x: unknown): Summary | null => {
  const s = rec(x)
  return s && STATUSES.every(key => nonNegative(s[key]) !== undefined) ? s as unknown as Summary : null
}

/** The comparison (machine.plan): each entry's kind, id and verdict, the port and connector that would change it, and why not. */
export function planOf(plan: unknown): Record<string, unknown> | null {
  const p = rec(plan)
  if (!p) return null
  const entries = list(p.entries).flatMap(entry => {
    const e = rec(entry), status = text(e?.status)
    if (!e || !text(e.kind) || !text(e.id) || !status || !STATUSES.includes(status)) return []
    const port = text(e.port), connector = text(rec(e.connector)?.id) ?? text(e.connector), reason = text(e.reason)
    return [{kind: e.kind, id: e.id, status, ...(port ? {port} : {}), ...(connector ? {connector} : {}), ...(reason ? {reason} : {})}]
  })
  const summary = summaryOf(p.summary)
  return {entries, ...(summary ? {summary} : {})}
}

/** What the machine was observed to hold (machine.plan: observed.observation). */
export function observedOf(plan: unknown): Record<string, unknown> | null {
  const seen = rec(rec(rec(plan)?.observed)?.observation)
  return seen ? {capabilities: list(seen.capabilities), packages: list(seen.packages), configurations: list(seen.configurations), services: list(seen.services)} : null
}

/** The recovery plan (central.recovery.plan): how your source synchronises, and how many requirements the machine plan would change. */
export function recoveryOf(recovery: unknown): Record<string, unknown> | null {
  const r = rec(recovery), sync = rec(r?.synchronization), status = text(sync?.status)
  if (!r || !status) return null
  const reason = text(sync?.reason), connector = text(rec(sync?.connector)?.id)
  const summary = summaryOf(rec(r.machine)?.summary)
  return {synchronization: status, ...(reason ? {reason} : {}), ...(connector ? {connector} : {}), ...(summary ? {changes: summary.changeable + summary.missing} : {})}
}

const READING_OF: Readonly<Record<string, keyof MachineAnswers>> = {roles: 'account', host: 'account', declared: 'declaration', observed: 'plan', plan: 'plan', verified: 'verify', recovery: 'recovery'}

/** Machine's values (MACHINE_WIRING): Central's readings, and the view's own keys at the manual's defaults until the hand moves them. */
export function machineValues(id: string, answers: MachineAnswers): Values {
  const values: Record<string, Value> = {}
  const account = answered(answers.account), declaration = answered(answers.declaration), plan = answered(answers.plan), verify = answered(answers.verify)
  const recovery = answered(answers.recovery)
  if (account) {
    values.roles = JSON.stringify(rolesOf(account))
    const host = hostOf(account)
    if (host) values.host = JSON.stringify(host)
  }
  const declared = declaredOf(declaration)
  if (declared) values.declared = JSON.stringify(declared)
  const observed = observedOf(plan), comparison = planOf(plan)
  if (observed) values.observed = JSON.stringify(observed)
  if (comparison) values.plan = JSON.stringify(comparison)
  if (verify && typeof verify.satisfied === 'boolean') values.verified = JSON.stringify({satisfied: verify.satisfied})
  const recovered = recoveryOf(recovery)
  if (recovered) values.recovery = JSON.stringify(recovered)
  if (declared && comparison) values.light = 'lit'
  else if (answers.declaration.status === 'refused' || answers.plan.status === 'refused') values.light = 'dark'
  const held = heldOf(id)
  const defaults: Record<string, Value | undefined> = {role: account ? boundRoleOf(account) ?? undefined : undefined, mode: 'propose', refresh: 'open'}
  for (const key of Object.keys(MACHINE_WIRING.local)) { const value = held[key] ?? defaults[key]; if (value !== undefined) values[key] = value }
  return values
}

/** The keys still waiting on Central's first answer, where it was asked. */
export function machineWaiting(answers: MachineAnswers, asked: boolean): string[] {
  if (!asked) return []
  const keys = Object.entries(READING_OF).filter(([, source]) => answers[source].status === 'reading').map(([key]) => key)
  return answers.plan.status === 'reading' || answers.declaration.status === 'reading' ? [...keys, 'light'] : keys
}

/** Each refusal said where its control stands: the account's on Role (no roles to choose), the declaration's on Role too (the role chosen
 * has none Central can read), the plan's on Plan, the verification's on Verify, the recovery plan's on the Recover page's Plan. */
export function machineRefusals(answers: MachineAnswers): Record<string, Standing> {
  const standing: Record<string, Standing> = {}
  const words = (answer: ActionAnswer) => (answer.status === 'refused' ? answer.error : null)
  const account = words(answers.account), declaration = words(answers.declaration), plan = words(answers.plan)
  const verify = words(answers.verify), recovery = words(answers.recovery)
  if (account) standing.role = {disabled: `Central did not list the roles (${MACHINE_ACCOUNT_ACTION}): ${account}`}
  else if (declaration) standing.role = {refused: `${MACHINE_DECLARATION_ACTION}: ${declaration}`}
  if (plan) standing.replan = {refused: `${MACHINE_PLAN_ACTION}: ${plan}`}
  if (verify) standing.verify = {refused: `${MACHINE_VERIFY_ACTION}: ${verify}`}
  if (recovery) standing.recoveryPlan = {refused: `${RECOVERY_PLAN_ACTION}: ${recovery}`}
  return standing
}

/** The presses that ask the readings again (Plan, Verify, the Recover page's Plan); null where no transport reaches Central. */
export interface MachineAsks {
  readonly replan: () => Promise<void> | void
  readonly verify: () => Promise<void> | void
  readonly recoveryPlan: () => Promise<void> | void
}

/** Machine's binding: Central's readings, the view's own Role, Change, Refresh and ask, Plan and Verify as readings asked again, and Apply,
 * Adopt and Recover disabled naming the route they lack (MACHINE_WIRING.refused). */
export function machineBinding(id: string, answers: MachineAnswers, asks: MachineAsks | null, asked = true): DesignBinding {
  const acts: PageActs = asks ? {replan: async () => { await asks.replan() }, verify: async () => { await asks.verify() }, recoveryPlan: async () => { await asks.recoveryPlan() }} : {}
  const none = 'No transport reaches Central here.'
  const why: Readonly<Record<string, string>> = asks ? {} : {replan: none, verify: none, recoveryPlan: none}
  const binding = pageBinding(id, MACHINE_WIRING, machineValues(id, answers), acts, why, machineRefusals(answers))
  const waiting = machineWaiting(answers, asked)
  return waiting.length ? {...binding, waiting} : binding
}
