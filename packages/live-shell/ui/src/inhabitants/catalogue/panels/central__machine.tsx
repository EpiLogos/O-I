// Machine (manual §18.7, central:machine): the environment you rely on, as you declared it beside what the machine holds, and the way
// back to it. Live's nearest: Utility for its plainness, with Ground hygiene's lever for a change that asks first (Change: Off, Propose,
// Write). The picture is a ledger: a lane for each kind of requirement (capabilities, packages, configuration, services), what the
// declaration asks for on the left of the spine, what the machine was seen to hold on the right. A declared tick takes the plan's
// verdict: teal satisfied, amber changeable (Apply can make it so), orange missing, crossed unsupported. Handle 1 sets Change. Its other pages draw the road
// as stages: Reconcile (plan, apply, verify) and Recover (plan, synchronise, apply, verify), each stage with its result.
// The owner is Central (ctrl/src/machine.rs, ctrl/src/recovery.rs), through the kernel's invoke_action:
//   machine.account (roles, host, last observation, drift), machine.declaration {role}, machine.inspect, machine.plan {role},
//   machine.verify {role} — read-only; machine.apply {role}, machine.adopt-current {role?, workcell_ref?} — locally mutating;
//   central.recovery.plan {role} — read-only; central.recover {role} — externally mutating.
//
// Value keys. The owner reports (never written from here):
//   light      'lit' | 'dark'     the declaration was read and the machine observed; hollow when the owner reports none
//   roles      [{role, path, requirements}]  the authored declarations (machine.account: authored[].role, path, requirement_count)
//   host       {hostname, machineId, platform, architecture, observedAt (s), stale, connector}  the machine as last observed
//                                  (machine.account: current, last_observation: observation.platform, .architecture, observed_at,
//                                  connector_id; observation_stale)
//   declared   {bindings: [{kind, reference}], capabilities: [id], packages: [{id, state}], configurations: [{id, state}],
//                services: [{id, running?, enabled?}]}  the chosen role's declaration (machine.declaration: declaration)
//   observed   {capabilities: [id], packages: [id], configurations: [id], services: [id]}  what the machine holds
//                                  (machine.plan: observed.observation)
//   plan       {entries: [{kind, id, status, port?, connector?, reason?}], summary: {satisfied, missing, changeable, unsupported}}
//                                  the comparison (machine.plan: entries[].kind, id, status satisfied | missing | changeable |
//                                  unsupported, port, connector.id, reason; summary)
//   applied    {outcome, operations: [{kind, id, port, connector, changed}]}  the last apply (machine.apply: outcome complete |
//                                  partial | unavailable | failed; operations[].result.changed)
//   verified   {satisfied}        the last verification (machine.verify: satisfied)
//   recovery   {synchronization, reason?, connector?, changes}  the recovery plan (central.recovery.plan: synchronization.status
//                                  not_configured | satisfied | changeable | unavailable, its reason and connector; machine.summary
//                                  changeable + missing as `changes`)
//   recovered  {outcome, stage?, message?, synchronized?, applied?, operations?, satisfied?}  the last recovery (central.recover:
//                                  outcome; on failure the stage it stopped at and Central's words; synchronization.changed;
//                                  machine_apply.outcome and its operations count; verification.satisfied)
// Settings the shell holds: role (the declaration read), mode (Change: 'off' | 'propose' | 'write': Off only reads; Propose waits for your
//   Confirm; Write runs when you press it), refresh ('manual' | 'open').
// Held by the hand: ask (the act waiting for Confirm).
// Acts, each on its own key: replan (machine.plan), apply (machine.apply), verify (machine.verify), adopt (machine.adopt-current),
//   recoveryPlan (central.recovery.plan), recover (central.recover). Apply, Adopt and Recover change the machine or its declaration:
//   Propose asks first, and each is held.
// A key the owner does not report is absent: the picture names the missing reading and every control draws "—".
import {Action, Band, Chooser, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, type LightState, type RowItem, type Tone} from '../../sdk/panel'
import {NONE, clampTo, has, json, st, strOf, type DesignedDevice, type Values, type ViewProps} from './design'
import './central__machine.css'

type V = ViewProps['v']
type Mode = 'off' | 'propose' | 'write'
type Kind = 'capability' | 'package' | 'configuration' | 'service'
type Status = 'satisfied' | 'missing' | 'changeable' | 'unsupported'

// ------------------------------------------------------------------------------------------------ the vocabulary

const KINDS: readonly {kind: Kind; key: string; name: string}[] = [
  {kind: 'capability', key: 'capabilities', name: 'capabilities'}, {kind: 'package', key: 'packages', name: 'packages'},
  {kind: 'configuration', key: 'configurations', name: 'configuration'}, {kind: 'service', key: 'services', name: 'services'}]
const MODES: readonly Mode[] = ['off', 'propose', 'write']
const MODE_OPTIONS = [{value: 'off', label: 'Off', does: 'The device only reads. Apply, Adopt and Recover are not offered.'},
  {value: 'propose', label: 'Propose', does: 'Apply, Adopt and Recover wait for your Confirm.'}, {value: 'write', label: 'Write', does: 'They run when you hold them, and return a report.'}] as const
const REFRESH = [{value: 'manual', label: 'Manual', does: 'Read again only when you press Plan.'}, {value: 'open', label: 'On open', does: 'Read again when the device opens.'}] as const
const STATUS_TONE: Readonly<Record<Status, Tone | undefined>> = {satisfied: 'value', changeable: 'accent', missing: 'stall', unsupported: undefined}
const ACTS = {
  apply: {label: 'Apply', op: 'machine.apply: make the changeable requirements so, through the connectors the plan names, then verify.'},
  adopt: {label: 'Adopt', op: 'machine.adopt-current: write what this machine holds into the declaration, under Control/machines.'},
  recover: {label: 'Recover', op: 'central.recover: synchronise your source, apply the machine plan, then verify.'},
} as const
type Act = keyof typeof ACTS

// ------------------------------------------------------------------------------------------------ the readings

interface Entry {readonly kind: string; readonly id: string; readonly status: Status; readonly port?: string; readonly connector?: string; readonly reason?: string}
interface Plan {readonly entries: readonly Entry[]; readonly summary?: Readonly<Record<Status, number>>}
interface Declared {readonly bindings: readonly {kind: string; reference: string}[]; readonly items: Readonly<Record<Kind, readonly string[]>>}
const rec = (x: unknown): Record<string, unknown> | undefined => (x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : undefined)
const text = (x: unknown): string | undefined => (typeof x === 'string' && x !== '' ? x : undefined)
const ids = (x: unknown): string[] => (Array.isArray(x) ? x.flatMap(i => (typeof i === 'string' ? [i] : text(rec(i)?.id) ? [rec(i)!.id as string] : [])) : [])
const STATUSES: readonly string[] = ['satisfied', 'missing', 'changeable', 'unsupported']

function declaredOf(v: V): Declared | undefined {
  const d = rec(json<unknown>(v, 'declared', undefined))
  if (!d) return undefined
  const items = Object.fromEntries(KINDS.map(k => [k.kind, ids(d[k.key])])) as Record<Kind, string[]>
  const bindings = Array.isArray(d.bindings) ? d.bindings.flatMap(b => { const r = rec(b); return r && text(r.kind) && text(r.reference) ? [{kind: r.kind as string, reference: r.reference as string}] : [] }) : []
  return {bindings, items}
}
function observedOf(v: V): Record<Kind, string[]> | undefined {
  const o = rec(json<unknown>(v, 'observed', undefined))
  return o ? Object.fromEntries(KINDS.map(k => [k.kind, ids(o[k.key])])) as Record<Kind, string[]> : undefined
}
function planOf(v: V): Plan | undefined {
  const p = rec(json<unknown>(v, 'plan', undefined))
  if (!p) return undefined
  const entries = (Array.isArray(p.entries) ? p.entries : []).flatMap((e): Entry[] => {
    const r = rec(e)
    return r && text(r.kind) && text(r.id) && typeof r.status === 'string' && STATUSES.includes(r.status)
      ? [{kind: r.kind as string, id: r.id as string, status: r.status as Status, port: text(r.port), connector: text(r.connector), reason: text(r.reason)}] : []
  })
  const s = rec(p.summary)
  const summary = s && STATUSES.every(k => typeof s[k] === 'number') ? s as Record<Status, number> : undefined
  return {entries, summary}
}
const objOf = (v: V, key: string) => rec(json<unknown>(v, key, undefined))
const modeOf = (v: V): Mode | undefined => { const m = strOf(v, 'mode'); return m === 'off' || m === 'propose' || m === 'write' ? m : undefined }
const light = (p: ViewProps): LightState => { const s = strOf(p.owner ?? p.v, 'light'); return s === 'lit' || s === 'dark' ? s : 'unknown' }
const kindOf = (k: string): Kind | undefined => KINDS.find(x => x.kind === k || x.key === k)?.kind
const statusOf = (plan: Plan | undefined, kind: Kind, id: string): Status | undefined => plan?.entries.find(e => kindOf(e.kind) === kind && e.id === id)?.status
/** How far the machine is from its declaration: the requirements not satisfied. */
const toChange = (plan: Plan | undefined) => (plan ? (plan.summary ? plan.summary.changeable + plan.summary.missing + plan.summary.unsupported : plan.entries.filter(e => e.status !== 'satisfied').length) : undefined)
const verdict = (v: V) => { const n = toChange(planOf(v)); return n === undefined ? NONE : n === 0 ? 'satisfied' : `${n} to change` }

/** Whether an act can run now, and if not, why. The host's standing for its key comes last. */
function actState(p: ViewProps, act: Act): {ok: boolean; why?: string} {
  const mode = modeOf(p.v)
  if (mode === undefined) return {ok: false, why: 'Change has no reading.'}
  if (mode === 'off') return {ok: false, why: 'Change is Off. Set it to Propose or Write.'}
  if (!has(p.v, 'role')) return {ok: false, why: 'No role is chosen.'}
  if (act === 'apply') { const plan = planOf(p.v); if (plan && !plan.entries.some(e => e.status === 'changeable')) return {ok: false, why: 'Nothing in the plan is changeable.'} }
  const held = st(p, act).disabled
  return held ? {ok: false, why: held} : {ok: true}
}
/** Under Propose an act waits for your Confirm; under Write it runs. */
const press = (p: ViewProps, act: Act) => (modeOf(p.v) === 'propose' ? p.set('ask', act) : p.set(act, strOf(p.v, 'role') ?? true))

// ------------------------------------------------------------------------------------------------ the pictures

const LEVER = [-40, 0, 40]
/** The Change lever: Off, Propose, Write, with handle 1 on it. */
function Lever({p, cx, y, live}: {p: ViewProps; cx: number; y: number; live?: boolean}) {
  const mode = modeOf(p.v), at = mode === undefined ? -1 : MODES.indexOf(mode)
  const drag = live && !st(p, 'mode').disabled ? (x: number) => p.set('mode', MODES[Math.round(clampTo(0, 2, (x - cx + 40) / 40))]!) : undefined
  return <g>
    <path d={`M${cx + LEVER[0]!} ${y}H${cx + LEVER[2]!}`} className="dp-faint" />
    {LEVER.map((dx, i) => <g key={i}>
      <circle cx={cx + dx} cy={y} r={1.8} fill="var(--text-faint)" />
      {mode !== undefined && <text x={cx + dx} y={y - 8} className="dp-axis" textAnchor="middle">{MODES[i]}</text>}
    </g>)}
    {mode === undefined ? <text x={cx} y={y - 8} className="dp-axis" textAnchor="middle">no reading of Change</text>
      : <Handle n={1} x={cx + LEVER[at]!} y={y} label="Change" does="Drag along the line: Off, Propose or Write. Propose waits for your Confirm."
        onDrag={drag} onReset={drag && (() => p.set('mode', 'propose'))} />}
  </g>
}

/** The ledger: a lane for each kind, the declaration left of the spine, the machine right of it. */
function Ledger({p, w, h, small, narrow, live}: {p: ViewProps; w: number; h: number; small?: boolean; narrow?: boolean; live?: boolean}) {
  const v = p.v, declared = declaredOf(v), observed = observedOf(v), plan = planOf(v)
  const cx = narrow ? w / 2 + 8 : w / 2, top = small ? 12 : narrow ? 22 : 30, laneH = small ? (h - 18) / 4 : 20, pitch = small ? 3 : 4, half = cx - (small ? 8 : narrow ? 30 : 52)
  const role = strOf(v, 'role'), bind = declared?.bindings.find(b => b.kind === 'workcell')?.reference
  return <g>
    {!small && !narrow && <>
      <text x={7} y={12} className="dp-axis">declared · {role ?? NONE}</text>
      <text x={w - 7} y={12} className="dp-axis" textAnchor="end">observed</text>
      {bind && <text x={7} y={22} className="dp-ink-dim">{bind}</text>}
    </>}
    <path d={`M${cx} ${top - 6}V${top + laneH * 4 - 6}`} stroke="var(--text-dim)" strokeWidth={1} />
    {KINDS.map((k, i) => {
      const y = top + i * laneH + laneH / 2 - 6
      const mine = declared?.items[k.kind] ?? [], seen = observed?.[k.kind] ?? []
      const room = Math.floor(half / pitch)
      return <g key={k.kind}>
        {!small && <text x={7} y={y + 3} className="dp-axis">{narrow ? k.name.slice(0, 3) : k.name}</text>}
        {!small && !narrow && <text x={w - 7} y={y + 3} className="dp-axis" textAnchor="end">{observed ? seen.length : NONE}</text>}
        {mine.slice(0, room).map((id, j) => {
          const s = statusOf(plan, k.kind, id), x = cx - 4 - j * pitch, t = s ? STATUS_TONE[s] : undefined
          return s === 'unsupported'
            ? <path key={id} d={`M${x - 1.5} ${y - 3}l3 6M${x + 1.5} ${y - 3}l-3 6`} stroke="var(--text-faint)" strokeWidth={1}><title>{`${id} · unsupported`}</title></path>
            : <path key={id} d={`M${x} ${y - 4}V${y + 4}`} strokeWidth={small ? 1.4 : 2} stroke={t === 'value' ? 'var(--dp-value)' : t === 'accent' ? 'var(--dp-on)' : t === 'stall' ? 'var(--stall)' : 'var(--text-dim)'}><title>{`${id} · ${s ?? 'not planned'}`}</title></path>
        })}
        {seen.slice(0, Math.floor((w - (small || narrow ? 6 : 26) - cx) / pitch)).map((id, j) => {
          const x = cx + 4 + j * pitch, wanted = mine.includes(id)
          return <path key={id} d={`M${x} ${y - 4}V${y + 4}`} strokeWidth={small ? 1.2 : 1.5} stroke={wanted ? 'var(--dp-value)' : 'var(--text-faint)'}><title>{id}</title></path>
        })}
        {declared && mine.length === 0 && !small && <text x={cx - 6} y={y + 3} className="dp-axis" textAnchor="end">none</text>}
      </g>
    })}
    {!declared && <text x={cx - 6} y={top + laneH * 4 + (small ? -2 : 4)} className="dp-axis" textAnchor="end">no declaration</text>}
    {!observed && <text x={cx + 6} y={top + laneH * 4 + (small ? -2 : 4)} className="dp-axis">not observed</text>}
    {!small && <Lever p={p} cx={cx} y={h - 8} live={live} />}
  </g>
}

/** The stages of a road, left to right: a node for each, filled where it ran well, amber where it ran in part, crossed where it failed,
 * hollow where it has not run, dashed where nothing is configured. Under each, its result. */
type Stage = {name: string; state: 'ok' | 'part' | 'failed' | 'idle' | 'none'; result: string}
function Stages({p, w, h, stages, live}: {p: ViewProps; w: number; h: number; stages: readonly Stage[]; live?: boolean}) {
  const n = stages.length, x0 = 34, x1 = w - 34, y = 62
  const at = (i: number) => (n === 1 ? w / 2 : x0 + i * (x1 - x0) / (n - 1))
  return <g>
    {stages.slice(1).map((_, i) => <path key={i} d={`M${at(i) + 8} ${y}H${at(i + 1) - 8}`} className={stages[i]!.state === 'ok' ? 'dp-curve' : 'dp-faint'} />)}
    {stages.map((s, i) => {
      const x = at(i)
      return <g key={s.name}>
        {s.state === 'failed'
          ? <><circle cx={x} cy={y} r={6} fill="none" stroke="var(--stall)" strokeWidth={1.5} /><path d={`M${x - 3} ${y - 3}l6 6M${x + 3} ${y - 3}l-6 6`} stroke="var(--stall)" strokeWidth={1.5} /></>
          : <circle cx={x} cy={y} r={6} fill={s.state === 'ok' ? 'var(--dp-value)' : s.state === 'part' ? 'var(--dp-on)' : 'none'}
            stroke={s.state === 'idle' || s.state === 'none' ? 'var(--text-faint)' : 'none'} strokeDasharray={s.state === 'none' ? '2 2' : undefined} />}
        <text x={x} y={y - 12} className="dp-ink" textAnchor="middle">{s.name}</text>
        {s.result.split('\n').map((line, k) => <text key={k} x={x} y={y + 20 + k * 10} className="dp-axis" textAnchor="middle">{line}</text>)}
      </g>
    })}
    <Lever p={p} cx={w / 2} y={h - 8} live={live} />
  </g>
}

const num = (o: Record<string, unknown> | undefined, k: string) => (typeof o?.[k] === 'number' ? o[k] as number : undefined)
function reconcileStages(v: V): Stage[] {
  const plan = planOf(v), applied = objOf(v, 'applied'), verified = objOf(v, 'verified'), n = toChange(plan)
  const outcome = text(applied?.outcome), ops = Array.isArray(applied?.operations) ? applied!.operations.length : undefined
  return [
    {name: 'plan', state: plan ? (n ? 'part' : 'ok') : 'idle', result: plan ? (n ? `${n} to change` : 'satisfied') : 'not read'},
    {name: 'apply', state: outcome === 'complete' ? 'ok' : outcome === 'partial' ? 'part' : outcome ? 'failed' : 'idle', result: outcome ? `${outcome}\n${ops ?? NONE} change${ops === 1 ? '' : 's'}` : 'not run'},
    {name: 'verify', state: verified?.satisfied === true ? 'ok' : verified?.satisfied === false ? 'failed' : 'idle', result: verified ? (verified.satisfied === true ? 'satisfied' : 'differs') : 'not run'},
  ]
}
function recoverStages(v: V): Stage[] {
  const plan = objOf(v, 'recovery'), done = objOf(v, 'recovered'), sync = text(plan?.synchronization), failedAt = text(done?.stage)
  const stopped = (stage: string) => failedAt === stage
  const ranPast = (stage: string) => done !== undefined && !stopped(stage) && (failedAt === undefined || ['synchronization', 'machine_apply', 'verification'].indexOf(failedAt) > ['synchronization', 'machine_apply', 'verification'].indexOf(stage))
  const applied = text(done?.applied), ops = num(done, 'operations'), changes = num(plan, 'changes')
  return [
    {name: 'plan', state: plan ? 'ok' : 'idle', result: plan ? `${changes ?? NONE} to change` : 'not read'},
    {name: 'sync', state: sync === 'not_configured' ? 'none' : stopped('synchronization') ? 'failed' : ranPast('synchronization') ? 'ok' : sync === 'unavailable' ? 'failed' : 'idle',
      result: stopped('synchronization') ? 'failed' : ranPast('synchronization') && sync !== 'not_configured' ? (done?.synchronized === true ? 'changed' : 'unchanged') : sync ? sync.replace('_', ' ') : NONE},
    {name: 'apply', state: stopped('machine_apply') ? 'failed' : applied === 'complete' ? 'ok' : applied === 'partial' ? 'part' : 'idle', result: stopped('machine_apply') ? `${applied ?? 'failed'}` : applied ? `${applied}\n${ops ?? NONE} change${ops === 1 ? '' : 's'}` : 'not run'},
    {name: 'verify', state: stopped('verification') ? 'failed' : done?.satisfied === true ? 'ok' : 'idle', result: stopped('verification') ? 'differs' : done?.satisfied === true ? 'satisfied' : 'not run'},
  ]
}

// ------------------------------------------------------------------------------------------------ the controls

const roleChooser = (p: ViewProps) => {
  const roles = (json<unknown[]>(p.v, 'roles', []) ?? []).flatMap(r => { const o = rec(r); return o && text(o.role) ? [{value: o.role as string, label: o.role as string, does: text(o.path)}] : [] })
  return <Chooser {...st(p, 'role')} label="Role" wide does="The declaration the machine is read against: a role under Control/machines." value={strOf(p.v, 'role') ?? ''} options={roles} onChange={x => p.set('role', x)} />
}
const modeRadio = (p: ViewProps) => <Radio {...st(p, 'mode')} label="Change" does="Off: only read. Propose: Apply, Adopt and Recover wait for your Confirm. Write: they run when you hold them." value={modeOf(p.v) ?? ''} options={MODE_OPTIONS} stack onChange={x => p.set('mode', x)} />

/** An act with its ask: the act itself, or, while it waits under Propose, Confirm and Cancel. */
function ActButton({p, act}: {p: ViewProps; act: Act}) {
  const can = actState(p, act), stand = st(p, act), t = ACTS[act]
  if (strOf(p.v, 'ask') === act) return <div className="mc-ask">
    <Action {...stand} hold label="Confirm" does={`Run ${t.op}`} onPress={() => { p.set(act, strOf(p.v, 'role') ?? true); p.set('ask', undefined) }} disabled={can.ok ? undefined : can.why} />
    <Action label="Cancel" does="Leave the machine as it is." onPress={() => p.set('ask', undefined)} />
  </div>
  return <Action {...stand} hold={modeOf(p.v) === 'write'} label={t.label} does={t.op} onPress={() => press(p, act)} disabled={can.ok ? undefined : can.why} />
}

function entryRows(v: V, all: boolean): RowItem[] {
  const plan = planOf(v)
  if (!plan) return [{id: 'none', name: 'No reading of the plan', light: 'unknown'}]
  const shown = plan.entries.filter(e => all || e.status !== 'satisfied')
  if (!shown.length) return [{id: 'none', name: plan.entries.length ? 'Every requirement is satisfied' : 'The declaration asks for nothing', light: 'lit', tone: 'green'}]
  return shown.map(e => ({id: `${e.kind}:${e.id}`, name: e.id, light: e.status === 'unsupported' ? 'dark' : 'lit', tone: STATUS_TONE[e.status] ?? 'value',
    note: `${kindOf(e.kind) ?? e.kind} · ${e.status}`, why: e.status === 'missing' || e.status === 'unsupported' ? e.reason ?? 'Central gave no reason.' : undefined,
    does: e.status === 'changeable' ? `Apply makes it so through ${e.connector ?? 'its connector'}${e.port ? ` (${e.port})` : ''}.` : `${e.kind} ${e.id}: ${e.status}.`}))
}

// ------------------------------------------------------------------------------------------------ the pane

function Pane({p}: {p: ViewProps}) {
  const v = p.v, declared = declaredOf(v), observed = observedOf(v), plan = planOf(v), host = objOf(v, 'host'), applied = objOf(v, 'applied'), done = objOf(v, 'recovered')
  return <div className="ref-pane-body mc-pane">
    <div className="mc-top">
      <h3>Machine<small>{strOf(v, 'role') ?? NONE} · {text(host?.hostname) ?? NONE} · {text(host?.platform) ?? NONE} {text(host?.architecture) ?? ''}</small></h3>
      <span className="mc-verdict" data-ok={toChange(plan) === 0 ? 'true' : undefined}>{verdict(v)}</span>
    </div>
    <div className="mc-cols">
      {KINDS.map(k => {
        const mine = declared?.items[k.kind], seen = observed?.[k.kind]
        return <section key={k.kind} className="mc-col">
          <h4>{k.name}<b>{mine ? mine.length : NONE} declared · {seen ? seen.length : NONE} observed</b></h4>
          {!declared ? <p className="mc-none">No reading of the declaration.</p> : mine!.length === 0 ? <p className="mc-none">None declared.</p>
            : <ul className="mc-list">{mine!.map(id => { const s = statusOf(plan, k.kind, id); const e = plan?.entries.find(x => kindOf(x.kind) === k.kind && x.id === id)
              return <li key={id} data-status={s}><i /><b>{id}</b><span>{s ?? 'not planned'}{e?.connector ? ` · ${e.connector}` : ''}</span>{e?.reason && <em>{e.reason}</em>}</li> })}</ul>}
          {seen && seen.filter(id => !mine?.includes(id)).length > 0 && <p className="mc-extra">Also on the machine: {seen.filter(id => !mine?.includes(id)).slice(0, 12).join(' · ')}{seen.filter(id => !mine?.includes(id)).length > 12 ? ` · +${seen.filter(id => !mine?.includes(id)).length - 12}` : ''}</p>}
        </section>
      })}
    </div>
    <div className="mc-foot">
      <span>Last apply <b>{text(applied?.outcome) ?? NONE}</b>{Array.isArray(applied?.operations) ? ` · ${applied!.operations.length} change${applied!.operations.length === 1 ? '' : 's'}` : ''}</span>
      <span>Verified <b>{objOf(v, 'verified') ? (objOf(v, 'verified')!.satisfied === true ? 'satisfied' : 'differs') : NONE}</b></span>
      <span>Last recovery <b>{text(done?.outcome) ?? NONE}</b>{text(done?.message) ? ` · ${text(done?.message)}` : ''}</span>
    </div>
  </div>
}

// ------------------------------------------------------------------------------------------------ the sample readings

const dump = (x: unknown) => JSON.stringify(x)
/** What this Mac reported (machine.account, machine.plan, 21 Oct): a `current` role that declares nothing, and 21 observed capabilities. */
const OBSERVED_CAPS = ['MachineInspector', 'claude-code@source:actuation-harness-capability', 'claude-code@source:workcell-harness-instance', 'codex@source:actuation-harness-capability',
  'cursor-cli@source:actuation-harness-detection', 'deepseek-harness@source:actuation-harness-detection', 'gemini-antigravity@source:actuation-harness-detection',
  'gemini@source:actuation-harness-capability', 'hermes-acp@source:actuation-harness-detection', 'hermes@source:actuation-harness-detection', 'kimi@source:actuation-harness-detection',
  'ollama@source:actuation-harness-detection', 'ollama@source:workcell-harness-instance', 'openclaw@source:actuation-harness-capability', 'opencode@source:actuation-harness-detection',
  'opencode@source:workcell-harness-instance', 'pi@source:actuation-harness-capability', 'pi@source:workcell-harness-instance', 'prime@source:actuation-harness-capability',
  'prime@source:workcell-harness-instance', 'zcode@source:actuation-harness-capability']
const HOST = {hostname: 'unknown-host', machineId: 'central-18d546bb2f3b3048-135df', platform: 'macos', architecture: 'aarch64', observedAt: 1792547554, stale: false, connector: 'read-models.harness-capability'}
/** A workstation role, declared: what a development machine of this ground relies on. */
const WORKSTATION = {
  bindings: [{kind: 'workcell', reference: 'workcell:mac'}],
  capabilities: ['claude-code@source:actuation-harness-capability', 'codex@source:actuation-harness-capability', 'pi@source:actuation-harness-capability', 'hermes@source:actuation-harness-capability'],
  packages: [{id: 'git', state: 'present'}, {id: 'node', state: 'present'}, {id: 'rustup', state: 'present'}, {id: 'redis', state: 'present'}, {id: 'tailscale', state: 'present'}],
  configurations: [{id: 'git-config', state: 'present'}, {id: 'zshrc', state: 'present'}],
  services: [{id: 'redis-now', running: true, enabled: true}, {id: 'tailscaled', running: true}],
}
const WORKSTATION_SEEN = {capabilities: OBSERVED_CAPS, packages: ['git', 'node', 'redis', 'tailscale', 'ripgrep'], configurations: ['git-config'], services: ['redis-now']}
const WORKSTATION_PLAN = {
  entries: [
    {kind: 'capability', id: 'claude-code@source:actuation-harness-capability', status: 'satisfied'}, {kind: 'capability', id: 'codex@source:actuation-harness-capability', status: 'satisfied'},
    {kind: 'capability', id: 'pi@source:actuation-harness-capability', status: 'satisfied'},
    {kind: 'capability', id: 'hermes@source:actuation-harness-capability', status: 'unsupported', reason: 'No eligible Connector declares a compatible capability installer.'},
    {kind: 'package', id: 'git', status: 'satisfied'}, {kind: 'package', id: 'node', status: 'satisfied'},
    {kind: 'package', id: 'rustup', status: 'changeable', port: 'PackageManager', connector: 'homebrew'},
    {kind: 'package', id: 'redis', status: 'satisfied'}, {kind: 'package', id: 'tailscale', status: 'satisfied'},
    {kind: 'configuration', id: 'git-config', status: 'satisfied'},
    {kind: 'configuration', id: 'zshrc', status: 'changeable', port: 'ConfigurationSource', connector: 'personal.git-sync'},
    {kind: 'service', id: 'redis-now', status: 'satisfied'},
    {kind: 'service', id: 'tailscaled', status: 'missing', reason: 'The service is not observed, and no eligible Connector starts it.'},
  ],
  summary: {satisfied: 9, changeable: 2, missing: 1, unsupported: 1},
}
const DEFAULTS: Values = {
  light: 'lit', role: 'workstation', mode: 'propose', refresh: 'open',
  roles: dump([{role: 'current', path: 'Control/machines/current.json', requirements: 0}, {role: 'workstation', path: 'Control/machines/workstation.json', requirements: 13}]),
  host: dump(HOST), declared: dump(WORKSTATION), observed: dump(WORKSTATION_SEEN), plan: dump(WORKSTATION_PLAN),
  applied: dump({outcome: 'partial', operations: [{kind: 'package', id: 'rustup', port: 'PackageManager', connector: 'homebrew', changed: true}]}),
  verified: dump({satisfied: false}),
  recovery: dump({synchronization: 'changeable', connector: 'personal.git-sync', changes: 4}),
}
const NOTHING = Object.fromEntries([...Object.keys(DEFAULTS), 'recovered', 'ask'].map(k => [k, undefined]))

// ------------------------------------------------------------------------------------------------ the device

export const design: DesignedDevice = {
  id: 'central:machine',
  title: 'Machine',
  kind: 'effect',
  firstPage: 'declared',
  defaults: DEFAULTS,
  fixtures: {
    'A workstation to reconcile': {},
    'This Mac, nothing declared': {role: 'current', declared: dump({bindings: [{kind: 'workcell', reference: 'workcell:mac'}], capabilities: [], packages: [], configurations: [], services: []}),
      observed: dump({capabilities: OBSERVED_CAPS, packages: [], configurations: [], services: []}), plan: dump({entries: [], summary: {satisfied: 0, missing: 0, changeable: 0, unsupported: 0}}),
      applied: undefined, verified: dump({satisfied: true}), recovery: dump({synchronization: 'not_configured', changes: 0})},
    'Recovered in part': {recovered: dump({outcome: 'partial', stage: 'machine_apply', message: 'Recovery machine application did not complete: one operation failed.', synchronized: true, applied: 'partial', operations: 1})},
    'No readings': NOTHING,
  },

  folded: p => { const n = toChange(planOf(p.v)); return <Folded title="Machine" light={light(p)} readings={[strOf(p.v, 'role') ?? NONE, n === undefined ? NONE : n === 0 ? 'satisfied' : `${n} differ`]} onUnfold={p.nav.unfold} /> },

  compact: p => <Panel title="Machine" view="compact" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}>
      <Display w={140} h={146} label="The machine" does="Declared on the left of the spine, observed on the right. Teal satisfied, amber changeable, orange missing. Drag handle 1 to set Change." corner={verdict(p.v)}>
        <Ledger p={p} w={140} h={146} narrow live />
      </Display>
    </Section>
    <Section label="Macros" width={124}>
      {roleChooser(p)}
      {modeRadio(p)}
      <ActButton p={p} act="apply" />
    </Section>
  </Panel>,

  whole: p => {
    const page = p.page === 'reconcile' || p.page === 'recover' ? p.page : 'declared', v = p.v, host = objOf(v, 'host'), plan = planOf(v)
    const pages = [{id: 'declared', label: 'Declared', light: (plan ? (toChange(plan) ? 'dark' : 'lit') : undefined) as LightState | undefined}, {id: 'reconcile', label: 'Reconcile'}, {id: 'recover', label: 'Recover'}]
    return <Panel title="Machine" view="whole" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full} pages={pages} page={page} onPage={p.setPage}>
      {page === 'declared' ? <Band>
        <Section width={206}>
          <Display w={194} h={146} label="The machine" does="A lane for each kind. Declared on the left of the spine, observed on the right. Teal satisfied, amber changeable, orange missing, crossed unsupported. Drag handle 1 to set Change." corner={verdict(v)}>
            <Ledger p={p} w={194} h={146} live />
          </Display>
        </Section>
        <Section label="Machine" width={124}>
          {roleChooser(p)}
          <Readout label="host" does="The machine as Central last observed it." value={text(host?.platform) ? `${text(host?.platform)} · ${text(host?.architecture) ?? NONE}` : undefined} />
          <Readout label="verified" does="Whether the machine met its declaration when Central last verified it." value={objOf(v, 'verified') ? (objOf(v, 'verified')!.satisfied === true ? 'satisfied' : 'differs') : undefined}
            tone={objOf(v, 'verified')?.satisfied === true ? 'green' : objOf(v, 'verified') ? 'stall' : undefined} />
          <Chooser {...st(p, 'refresh')} label="Refresh" wide does="When the device reads again." value={strOf(v, 'refresh') ?? ''} options={REFRESH} onChange={x => p.set('refresh', x)} />
        </Section>
        <Section label="Requirements" grow>
          <Rows does="Every requirement of the declaration and the plan's verdict on it. Point at the ! for Central's reason." items={entryRows(v, true)} size={8} />
        </Section>
      </Band> : page === 'reconcile' ? <Band>
        <Section width={206}>
          <Display w={194} h={146} label="Reconcile" does="Plan, apply, verify: each stage with its result. Drag handle 1 to set Change.">
            <Stages p={p} w={194} h={146} stages={reconcileStages(v)} live />
          </Display>
        </Section>
        <Section label="Change" width={78}>{modeRadio(p)}</Section>
        <Section label="Act" width={104}>
          <Action {...st(p, 'replan')} label="Plan" does="Compare the declaration with the machine again." onPress={() => p.set('replan', strOf(v, 'role') ?? true)} />
          <ActButton p={p} act="apply" />
          <Action {...st(p, 'verify')} label="Verify" does="Observe the machine and check it against the declaration." onPress={() => p.set('verify', strOf(v, 'role') ?? true)} />
          <ActButton p={p} act="adopt" />
        </Section>
        <Section label="To change" grow>
          <Rows does="What the plan would change, and why the rest cannot be changed here." items={entryRows(v, false)} size={8} />
        </Section>
      </Band> : <Band>
        <Section width={206}>
          <Display w={194} h={146} label="Recover" does="Plan, synchronise, apply, verify: each stage of the way back with its result. Drag handle 1 to set Change.">
            <Stages p={p} w={194} h={146} stages={recoverStages(v)} live />
          </Display>
        </Section>
        <Section label="Recover" width={112}>
          <Readout label="synchronise" does="Whether your source synchronises before the machine is applied: not configured, satisfied, changeable or unavailable."
            value={text(objOf(v, 'recovery')?.synchronization)?.replace('_', ' ')} />
          <Readout label="outcome" does="How the last recovery ended." value={text(objOf(v, 'recovered')?.outcome)} tone={text(objOf(v, 'recovered')?.outcome) === 'complete' ? 'green' : objOf(v, 'recovered') ? 'stall' : undefined} />
          <Action {...st(p, 'recoveryPlan')} label="Plan" does="Preview the synchronisation and the machine plan, changing nothing." onPress={() => p.set('recoveryPlan', strOf(v, 'role') ?? true)} />
          <ActButton p={p} act="recover" />
        </Section>
        <Section label="Stages" grow>
          <Rows does="Each stage of the last recovery, and where it stopped." items={recoverStages(v).map(s => ({id: s.name, name: s.name, light: s.state === 'ok' ? 'lit' : s.state === 'idle' || s.state === 'none' ? 'dark' : 'lit',
            tone: s.state === 'ok' ? 'green' : s.state === 'part' ? 'accent' : 'stall', note: s.result.replace('\n', ' · '),
            why: s.state === 'failed' ? text(objOf(v, 'recovered')?.message) ?? 'Central gave no reason.' : undefined}))} size={6} />
        </Section>
      </Band>}
    </Panel>
  },

  full: p => <Pane p={p} />,

  widget: p => {
    const plan = planOf(p.v)
    return <Tile title={`Machine · ${strOf(p.v, 'role') ?? NONE}`} light={light(p)} span={2} onFull={p.nav.full}>
      <Display w={96} h={96} label="The machine" does="Declared left, observed right.">
        <Ledger p={p} w={96} h={96} small />
      </Display>
      <div className="mc-tile-side">
        <Readout big label="to change" does="Requirements the machine does not meet." value={toChange(plan)} tone={toChange(plan) ? 'accent' : 'green'} />
        <Readout label="verified" does="The last verification." value={objOf(p.v, 'verified') ? (objOf(p.v, 'verified')!.satisfied === true ? 'yes' : 'no') : undefined} />
      </div>
    </Tile>
  },
}
