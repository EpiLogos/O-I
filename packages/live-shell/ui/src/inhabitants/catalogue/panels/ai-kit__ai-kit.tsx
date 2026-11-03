// AIKit's instrument (manual §19.26, ai-kit:ai-kit): the window onto what a run's agents worked from, for the run you select. It stands on
// no chain: it is born in a pane and stands only there, following the track or task you select. The devices AIKit brings to a chain stay
// small (Sources says what an agent reads, §19.9; the Skillset rack what it carries, §19.7); the instrument holds the rest at full size.
// Live's nearest: a pane of the browser with its Places and their Add Folder, and the undo history.
//
// It has two views, Widget and Full (§16.3); its window holds its Full. The Full is six pages as tabs, each a monitor's pane: the page's
// settings in one line across its head, then its picture, then its lists. Run (each agent of the run with what it carried, loaded, invoked
// and relied on), Context (what each turn let in, for the agent you choose: the Agent's Context page until this instrument took it), Sources
// (where the practice comes from, and the skill trees on this machine that AIKit does not own), Adopt (bring a foreign tree under AIKit,
// previewed first), Package (the set written for another harness) and Procedures (each change AIKit made to the machine, with Run, Undo and
// the hook bypasses). Sources, Adopt and Procedures were the Skillset rack's pages (skills.tsx) until the manual gave them here; their keys
// and acts are the same.
//
// Value keys. The owners report, never written from here:
//   light       'lit' | 'dark'           AIKit answered for the run; hollow while nobody reports
//   run         string                   the run the selection names (its track or task)
//   agents      [{id, name, sets, members, consumed?, pressure?}]  each agent of the run: the sets its chain carries (`sets`, names), each
//                                        member as the Skillset rack reads it (practice.ts Member: its form, revision and ten rungs of
//                                        evidence), and its session's context pressure (`consumed`, 0–1 of the budget; `pressure`, the bracket)
//   unused      string[]                 members AIKit has catalogued and never seen used (`aikit unused --json`: unused[].capability)
//   ctx.pressure  {budget, prompts, consumed, pressure, brackets: {fresh_max, moderate_max, depleted_max}, blocks, lines}  `aikit work
//                 continuity pressure --json` for the agent chosen: brackets, reading.source, reading.consumed, reading.pressure,
//                 reading.allowance ('unbounded' = all)
//   ctx.armed     string[]   the star prompt-commands the composition arms (`aikit work continuity commands --json`: armed)
//   ctx.turn      {blocks: [{event, title, standing, kept, withheld, suppressed?}], withheldLines, withheldBlocks, notice}  the last turn's
//                 Bounded disclosure (crates/aikit-core/src/pressure.rs: Pressure, Allowance, Bounded). Standing guidance always enters
//                 whole, and every bound is disclosed to the agent.
//   sources     [{id, kind, skills, retired?, active, candidate, rollback?, ground?, rejected?}]  each registered source as `aikit source
//                                        show <id> --json` reads it: kind git | directory | capsule, active_skills, active_retired_skills,
//                                        active_snapshot, candidate_snapshot, rollback_points[0], control_ground, candidate_rejected (a count)
//   roots       [{root, path, skills, decide}]  the skill trees on this machine that AIKit does not own (`aikit collate --json`: each
//                                        cluster's where[].root and path, counted; decide counts the names whose copies differ, conflict)
//   adoption    {root, namespace, digest, isolation, items: [{name, act: 'adopt' | 'owned' | 'refused', why?}]}  the reviewed plan of
//                                        `aikit adopt <path> --namespace <ns> --json` without --yes: every skill copied into skill/<ns>/
//                                        and its foreign copy replaced by a projection link; undo restores the original bytes
//   sets        string[]                 the sets Package may write (the binding's set list)
//   unsupported {<target>: string[] | number}  what each target cannot carry, from the package receipt: the relations it names, or a count
//   procedures  [{id, kind, subject, state: 'planned' | 'committed' | 'undone', digest, isolation, at, edits: {<edit>: count}}]
//                                        `aikit procedure list --json`, each with its `procedure diff <id> --json` (WorldEdit kinds)
//   bypasses    [{id, scope, reason, capability?, at, state: 'open' | 'spent' | 'revoked'}]  `aikit bypass list --json` with
//                                        `aikit history bypasses --json`
// Settings the shell holds: agent (the agent Context reads), unusedOnly (the Unused filter), source (the source chosen), adoptRoot (the root
//   chosen), namespace (where adoption writes: skill/<namespace>/), set and target (what Package writes, and for which harness), outDir (the
//   absolute directory Export writes into: `aikit set package export <set> --target <t> --out <dir>`), procedure (the procedure chosen),
//   bypassScope ('next-event' | 'session' | '1h'), bypassReason.
// Acts, each on its own key: sync, promote, rollback (the source id: `aikit source sync|promote|rollback <id>`), adoptPreview (the root),
// adoptApply (the plan's digest: `aikit adopt <path> --yes --expect-digest <digest>`), exported (the target), procRun (`<id>@<digest>`:
// `aikit procedure run <id> --expect-digest <digest>`), procUndo (the id: `aikit procedure undo <id>`), issue (JSON {scope, reason}:
// `aikit bypass issue`), revoke (the bypass id: `aikit bypass revoke`). The instrument reads the run: it changes no device on a chain.
// A key the owner has not reported is absent: the views draw "—" and the well names what is missing.
import {useState, type ReactNode} from 'react'
import {WoodMark} from '../../sdk/marks'
import type {WoodSet} from '../../sdk/icons'
import {Action, Chooser, Display, Handle, Ladder, Lamp, Radio, Readout, TextField, Tile, Toggle, type LightState, NoReading} from '../../sdk/panel'
import {NONE, boolOf, clampTo, has, json, railAndPane, st, strOf, type Room, type ViewProps} from './design'
import {MonitorGroup, MonitorHead, MonitorPane, type MonitorReading} from './monitor'
import {DOCUMENTATION, FORM_NAME, ORDER, RUNGS, markState, reaching, type Member} from './practice'
import './ai-kit__ai-kit.css'

type V = ViewProps['v']
const isRec = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined)
const s = (x: unknown) => (typeof x === 'string' && x !== '' ? x : undefined)
const words = (x: unknown): string[] => (Array.isArray(x) ? x.filter((y): y is string => typeof y === 'string' && y.length > 0) : [])

// The mark set is the person's choice for the whole shell (Settings), not the owner's: the blade until they choose.
const marks = (v: V) => (strOf(v, 'marks') ?? 'blade') as WoodSet

// ------------------------------------------------------------------------------------------------ the run's agents

type Pressure = 'fresh' | 'moderate' | 'depleted' | 'critical'
const PRESSURES: readonly Pressure[] = ['fresh', 'moderate', 'depleted', 'critical']
interface Agent {readonly id: string; readonly name: string; readonly sets: readonly string[]; readonly members: readonly Member[]; readonly consumed?: number; readonly pressure?: Pressure}
function agentsOf(v: V): Agent[] | undefined {
  if (!has(v, 'agents')) return undefined
  const raw = json<unknown>(v, 'agents', [])
  return Array.isArray(raw) ? raw.flatMap((x): Agent[] => (isRec(x) && s(x.id) ? [{id: x.id as string, name: s(x.name) ?? (x.id as string), sets: words(x.sets),
    members: (Array.isArray(x.members) ? x.members : []).filter((m): m is Member => isRec(m) && typeof m.id === 'string' && Array.isArray(m.rungs))
      .sort((a, b) => ORDER.indexOf(a.form) - ORDER.indexOf(b.form)),
    consumed: n(x.consumed), pressure: PRESSURES.includes(x.pressure as Pressure) ? x.pressure as Pressure : undefined}] : [])) : []
}
/** Every member the run's agents carry, once each: a member two agents carry counts once, at the furthest its evidence reaches. */
function carried(v: V): Member[] | undefined {
  const agents = agentsOf(v)
  if (!agents) return undefined
  const by = new Map<string, Member>()
  for (const m of agents.flatMap(a => a.members)) { const was = by.get(m.id); by.set(m.id, was ? {...was, rungs: was.rungs.map((r, i) => (r === true || m.rungs[i] === true ? true : r ?? m.rungs[i] ?? null))} : m) }
  return [...by.values()]
}
/** How many of the run's members reach a rung; absent while the owner has not reported the agents. */
const reach = (v: V, rung: number) => { const all = carried(v); return all ? reaching(all, rung) : undefined }
/** The members AIKit has catalogued and never seen used; undefined when the owner has not said. */
const unusedOf = (v: V): ReadonlySet<string> | undefined => (has(v, 'unused') ? new Set(words(json<unknown>(v, 'unused', []))) : undefined)
const filtering = (v: V) => boolOf(v, 'unusedOnly') === true && unusedOf(v) !== undefined
const chosenAgent = (v: V) => { const all = agentsOf(v); return all?.find(a => a.id === strOf(v, 'agent')) ?? all?.[0] }
/** How many of the run's members AIKit has catalogued and never seen used; undefined while either is unread. */
const neverUsed = (v: V) => { const unused = unusedOf(v), all = carried(v); return unused === undefined || !all ? undefined : all.filter(m => unused.has(m.id)).length }

/** The run: a lane for each agent, and in it how many of its members reach each of the ten steps, carried at the left to verified at the
 * right. A member carried and never loaded costs nothing; one loaded and never invoked costs context on every turn. */
function RunWell({v, w, h}: {v: V; w: number; h: number}) {
  const agents = agentsOf(v)
  if (!agents) return <Display w={w} h={h} label="The run" corner={NONE}><text x={w / 2} y={h / 2} className="dp-ink-dim" textAnchor="middle">No reading of the run's agents</text></Display>
  const shownAgents = agents.slice(0, 5), x0 = 58, x1 = w - 6, pitch = (x1 - x0) / RUNGS.length, lane = Math.min(24, (h - 30) / Math.max(1, shownAgents.length))
  return <Display w={w} h={h} label="The run" corner={strOf(v, 'run') ?? NONE}
    does="A lane for each agent of the run. Each bar is a step of evidence, carried at the left to verified at the right; its height, how many of the agent's members reach it.">
    {!shownAgents.length && <text x={w / 2} y={h / 2} className="dp-ink-dim" textAnchor="middle">No agent in this run</text>}
    {shownAgents.map((a, i) => {
      const y = 18 + i * lane, most = Math.max(1, a.members.length)
      return <g key={a.id} data-i={`${a.name}|${a.sets.join(', ') || NONE}: ${a.members.length} members, ${reaching(a.members, 5)} loaded, ${reaching(a.members, 6)} invoked.`}>
        <text x={6} y={y + lane / 2 + 3} className="dp-ink">{a.name.length > 9 ? `${a.name.slice(0, 8)}…` : a.name}</text>
        {RUNGS.map((r, k) => { const c = reaching(a.members, k), bh = ((lane - 6) * c) / most
          return <rect key={r} x={x0 + k * pitch + 1} y={y + lane - 3 - bh} width={pitch - 2} height={Math.max(.5, bh)} fill={c ? 'var(--dp-value)' : 'none'} stroke={c ? 'none' : 'var(--text-faint)'} opacity={k === 5 || k === 6 ? 1 : .55} /> })}
        <path d={`M${x0} ${y + lane - 2.5}H${x1}`} className="dp-faint" />
      </g>
    })}
    <text x={x0} y={h - 4} className="dp-axis">{RUNGS[0]}</text>
    <text x={x0 + 5.5 * pitch} y={h - 4} className="dp-axis" textAnchor="middle">{RUNGS[5]}</text>
    <text x={x1} y={h - 4} className="dp-axis" textAnchor="end">{RUNGS[9]}</text>
  </Display>
}

/** The run's three counts: the widget's side, and the Run page's head. */
function runCounts(v: V): MonitorReading[] {
  const all = carried(v)
  return [
    {label: 'available', does: 'Members that pass their trust and policy checks here, of all the run\'s agents carry.', value: all ? `${reaching(all, 2)}/${all.length}` : undefined},
    {label: 'loaded', does: 'Members whose text entered an agent\'s context in this run.', value: reach(v, 5), tone: 'green'},
    {label: 'invoked', does: 'Members an agent called in this run.', value: reach(v, 6), tone: 'green'},
  ]
}

function RunCounts({v}: {v: V}) {
  return <>{runCounts(v).map(r => <Readout key={r.label} label={r.label!} does={r.does} value={r.value} tone={r.tone} />)}</>
}

/** The Run page's head: the run, its agents and counts, and Unused with how many members were never used. */
function RunHead({p}: {p: ViewProps}) {
  const agents = agentsOf(p.v), now = boolOf(p.v, 'unusedOnly'), count = neverUsed(p.v)
  return <MonitorHead title="Run" readings={[
    {label: 'run', value: strOf(p.v, 'run'), does: 'The run the selection names: the track or the task you selected.'},
    {label: 'agents', value: agents?.length, does: 'The agents of the run.', tone: 'value'},
    ...runCounts(p.v),
    {label: 'never used', value: count, does: 'Members of the run\'s sets that AIKit has catalogued and never seen used.', tone: count ? 'accent' : undefined},
  ]} controls={<Toggle {...st(p, 'unusedOnly')} label="Unused" does="Show only the members AIKit has catalogued and never seen used. A member carried and never used still costs the agent its place in the set."
    on={now === true} unknown={now === undefined} onChange={x => p.set('unusedOnly', x)} disabled={st(p, 'unusedOnly').disabled ?? (unusedOf(p.v) === undefined ? 'No reading of what has been used.' : undefined)} />} />
}

// ------------------------------------------------------------------------------------------------ Context: what entered an agent's context

interface PressureReading {readonly budget?: number; readonly prompts?: number; readonly consumed?: number; readonly pressure?: Pressure
  readonly brackets: readonly [number, number, number]; readonly blocks?: number | 'all'; readonly lines?: number | 'all'}
interface Block {readonly event: string; readonly title: string; readonly standing: number; readonly kept: number; readonly withheld: number; readonly suppressed: boolean}
interface Turn {readonly blocks: readonly Block[]; readonly withheldLines?: number; readonly withheldBlocks?: number; readonly notice?: string}
const allOr = (x: unknown): number | 'all' | undefined => (x === 'unbounded' || x === 'all' ? 'all' : n(x))

/** `aikit work continuity pressure`: the brackets in effect and the chosen agent's session. Undefined when the owner reports none. */
function pressureOf(v: V): PressureReading | undefined {
  const o = json<unknown>(v, 'ctx.pressure', undefined)
  if (!isRec(o)) return undefined
  const b = isRec(o.brackets) ? o.brackets : undefined
  return {budget: n(o.budget), prompts: n(o.prompts), consumed: n(o.consumed), pressure: PRESSURES.includes(o.pressure as Pressure) ? o.pressure as Pressure : undefined,
    brackets: [n(b?.fresh_max) ?? .2, n(b?.moderate_max) ?? .45, n(b?.depleted_max) ?? .7], blocks: allOr(o.blocks), lines: allOr(o.lines)}
}
/** The last turn's bounded blocks, as the continuity engine disclosed them. Undefined when the owner reports none. */
function turnOf(v: V): Turn | undefined {
  const o = json<unknown>(v, 'ctx.turn', undefined)
  if (!isRec(o)) return undefined
  const blocks = (Array.isArray(o.blocks) ? o.blocks : []).flatMap((b): Block[] => (isRec(b) && typeof b.title === 'string'
    ? [{event: s(b.event) ?? NONE, title: b.title, standing: n(b.standing) ?? 0, kept: n(b.kept) ?? 0, withheld: n(b.withheld) ?? 0, suppressed: b.suppressed === true}] : []))
  return {blocks, withheldLines: n(o.withheldLines), withheldBlocks: n(o.withheldBlocks), notice: s(o.notice)}
}
const armedOf = (v: V): string[] | undefined => (has(v, 'ctx.armed') ? words(json<unknown>(v, 'ctx.armed', [])) : undefined)
const allowanceWords = (r: PressureReading | undefined) => (r === undefined || r.blocks === undefined ? undefined
  : r.blocks === 'all' ? 'all' : r.blocks === 0 ? 'standing only' : `${r.blocks} × ${r.lines === 'all' ? 'all' : r.lines ?? NONE} lines`)
const enteredOf = (turn: Turn | undefined) => (turn ? turn.blocks.reduce((k, b) => k + b.standing + b.kept, 0) : undefined)

/** The context: along the top, the session's prompts against its budget, the four brackets as zones and a needle at where it stands. Under
 * it, the last turn's blocks as columns: standing lines solid, ordinary lines that entered lighter, the lines withheld as an orange outline
 * above them; a block withheld whole is an empty outline. */
function ContextWell({v, w, h}: {v: V; w: number; h: number}) {
  const r = pressureOf(v), turn = turnOf(v)
  const x0 = 8, x1 = w - 8, at = (u: number) => x0 + clampTo(0, 1, u) * (x1 - x0), ry = 24
  const edges = r ? [0, ...r.brackets, 1] : [0, .2, .45, .7, 1]
  const blocks = turn?.blocks.slice(0, 8) ?? [], most = Math.max(1, ...blocks.map(b => b.standing + b.kept + b.withheld))
  const base = h - 16, room = base - 52, colW = blocks.length ? Math.min(20, (w - 16) / blocks.length - 4) : 0, scale = room / most
  return <Display w={w} h={h} label="Context" corner={r?.pressure ?? NONE}
    does="Top: the session's prompts against its budget, the brackets fresh, moderate, depleted and critical, and the needle where it stands. Below: the last turn's blocks. Solid: standing lines, always whole. Lighter: ordinary lines that entered. Orange outline: lines withheld.">
    {edges.slice(0, 4).map((e, i) => <g key={i}>
      <rect x={at(e)} y={ry - 5} width={at(edges[i + 1]!) - at(e)} height={10} fill={i === 3 ? 'var(--stall)' : 'var(--dp-value)'} opacity={.12 + i * .1} />
      <text x={(at(e) + at(edges[i + 1]!)) / 2} y={ry + 16} className="dp-axis" textAnchor="middle">{PRESSURES[i]}</text>
    </g>)}
    {r?.consumed !== undefined ? <path d={`M${at(r.consumed)} ${ry - 9}V${ry + 7}`} stroke="var(--dp-on)" strokeWidth={2} />
      : <text x={w / 2} y={ry + 3} className="dp-axis" textAnchor="middle">no reading of the pressure</text>}
    <text x={x0} y={11} className="dp-axis">{r?.prompts !== undefined && r.budget !== undefined ? `${r.prompts} of ${r.budget} prompts` : NONE}</text>
    {!turn ? <text x={w / 2} y={(52 + base) / 2} className="dp-ink-dim" textAnchor="middle">No reading of the last turn</text>
      : !blocks.length ? <text x={w / 2} y={(52 + base) / 2} className="dp-ink-dim" textAnchor="middle">Nothing entered</text>
      : blocks.map((b, i) => {
        const x = 8 + i * ((w - 16) / blocks.length) + ((w - 16) / blocks.length - colW) / 2
        const hs = b.standing * scale, hk = b.kept * scale, hw = b.withheld * scale
        return <g key={i} data-i={`${b.title}|${b.event}: ${b.standing} standing, ${b.kept} ordinary entered, ${b.withheld} withheld${b.suppressed ? '; the whole block was withheld' : ''}.`}>
          {hs > 0 && <rect x={x} y={base - hs} width={colW} height={hs} fill="var(--dp-value)" />}
          {hk > 0 && <rect x={x} y={base - hs - hk} width={colW} height={hk} fill="var(--dp-value)" opacity={.45} />}
          {hw > 0 && <rect x={x + .5} y={base - hs - hk - hw} width={colW - 1} height={hw} fill="none" stroke="var(--stall)" strokeDasharray={b.suppressed ? '2 2' : undefined} />}
          <text x={x + colW / 2} y={h - 5} className="dp-axis" textAnchor="middle">{b.event.slice(0, 1)}</text>
        </g>
      })}
    <path d={`M6 ${base}H${w - 6}`} className="dp-faint" />
  </Display>
}

/** The Context page's head: the agent whose session it reads, and beside it the prompts, the allowance now, the star commands armed, the
 * lines that entered and the lines and blocks withheld. */
function ContextHead({p}: {p: ViewProps}) {
  const r = pressureOf(p.v), turn = turnOf(p.v), agents = agentsOf(p.v)
  return <MonitorHead title="Context" readings={[
    {label: 'prompts', value: r?.prompts === undefined ? undefined : `${r.prompts} / ${r.budget ?? NONE}`, does: 'Prompts in this session, of the budget the brackets are measured against.', tone: 'value'},
    {label: 'allowance', value: allowanceWords(r), does: 'How much ordinary guidance a turn may carry now: how many blocks, and how many lines each. Standing guidance always enters whole.'},
    {label: 'armed', value: armedOf(p.v)?.length, does: 'Star commands the composition arms.'},
    {label: 'entered', value: enteredOf(turn), does: 'Lines that entered the agent\'s context in the last turn.', tone: 'value'},
    {label: 'withheld', value: turn?.withheldLines, does: 'Ordinary lines the bracket kept out. Each bound is disclosed to the agent.', tone: turn?.withheldLines ? 'stall' : undefined},
    {label: 'blocks out', value: turn?.withheldBlocks, does: 'Blocks withheld whole: they carried ordinary lines only, and the bracket allowed none.', tone: turn?.withheldBlocks ? 'stall' : undefined},
  ]} controls={<Chooser {...st(p, 'agent')} label="Agent" wide does="The agent of the run whose session Context reads." value={chosenAgent(p.v)?.id ?? ''}
    options={(agents ?? []).map(a => ({value: a.id, label: a.name}))} onChange={x => p.set('agent', x)} />} />
}

// ------------------------------------------------------------------------------------------------ where the practice comes from

interface Source {readonly id: string; readonly kind?: string; readonly skills?: number; readonly retired?: number; readonly active?: string; readonly candidate?: string; readonly rollback?: string; readonly ground?: boolean; readonly rejected?: number}
interface Root {readonly root: string; readonly path?: string; readonly skills?: number; readonly decide?: number}
function sourcesOf(v: V): Source[] | undefined {
  if (!has(v, 'sources')) return undefined
  const raw = json<unknown>(v, 'sources', [])
  return Array.isArray(raw) ? raw.flatMap(x => (isRec(x) && s(x.id) ? [{id: x.id as string, kind: s(x.kind), skills: n(x.skills), retired: n(x.retired), active: s(x.active),
    candidate: s(x.candidate), rollback: s(x.rollback), ground: x.ground === true, rejected: n(x.rejected)}] : [])) : []
}
function rootsOf(v: V): Root[] | undefined {
  if (!has(v, 'roots')) return undefined
  const raw = json<unknown>(v, 'roots', [])
  return Array.isArray(raw) ? raw.flatMap(x => (isRec(x) && s(x.root) ? [{root: x.root as string, path: s(x.path), skills: n(x.skills), decide: n(x.decide)}] : [])) : []
}
/** A snapshot's digest, short: its first eight characters. */
const snap = (x: string | undefined) => (x === undefined ? undefined : x.slice(0, 8))
/** A candidate that differs from the active snapshot waits for Promote. */
const waits = (x: Source) => x.candidate !== undefined && x.active !== undefined && x.candidate !== x.active
const chosenSource = (v: V) => { const all = sourcesOf(v); return all?.find(x => x.id === strOf(v, 'source')) ?? all?.[0] }
const KIND_WORD: Readonly<Record<string, string>> = {git: 'Git', directory: 'folder', capsule: 'capsule'}

/** The sources: a lane for each, its three snapshots in a row — the one to roll back to, the active one, the candidate. A filled square is
 * active; an orange square right of it is a candidate that waits to be promoted. Under a dashed rule, each skill tree AIKit does not own,
 * as a bar of its skills, an orange dot where copies differ. */
function SourcesWell({v, w, h}: {v: V; w: number; h: number}) {
  const all = sourcesOf(v), roots = rootsOf(v), chosen = chosenSource(v)?.id
  if (!all && !roots) return <Display w={w} h={h} label="Sources" corner={NONE}><text x={w / 2} y={h / 2} className="dp-ink-dim" textAnchor="middle">No reading of the sources</text></Display>
  const xs = [w - 92, w - 60, w - 28], lane = 11, top = 31
  const shown = (all ?? []).slice(0, 5), foreign = (roots ?? []).slice(0, 4), most = Math.max(1, ...foreign.map(r => r.skills ?? 0))
  const rule = top + shown.length * lane + 2
  return <Display w={w} h={h} label="Sources" corner={all ? `${all.length} sources` : NONE}
    does="A lane for each source: the snapshot to roll back to, the active one, the candidate. Filled: active. Orange: a candidate that waits to be promoted. Under the rule, the skill trees AIKit does not own, an orange dot where copies differ.">
    {['back', 'active', 'next'].map((t, i) => <text key={t} x={xs[i]} y={22} className="dp-axis" textAnchor="middle">{t}</text>)}
    {!all && <text x={6} y={top + 3} className="dp-ink-dim">No reading of the sources</text>}
    {shown.map((x, i) => {
      const y = top + i * lane, wait = waits(x)
      return <g key={x.id} data-i={`${x.id}|${KIND_WORD[x.kind ?? ''] ?? x.kind ?? NONE} · ${x.skills ?? NONE} skills${wait ? ' · a candidate waits' : ''}`}>
        <text x={6} y={y + 3} className={x.id === chosen ? 'dp-ink' : 'dp-ink-dim'}>{x.id.length > 11 ? `${x.id.slice(0, 10)}…` : x.id}</text>
        <path d={`M${xs[0]} ${y}H${xs[2]}`} className="dp-faint" />
        {x.rollback && <rect x={xs[0] - 3.5} y={y - 3.5} width={7} height={7} fill="none" stroke="var(--text-faint)" />}
        <rect x={xs[1] - 4} y={y - 4} width={8} height={8} fill={x.active ? 'var(--dp-value)' : 'none'} stroke="var(--dp-value)" />
        {wait ? <><path d={`M${xs[2] - 6} ${y}H${xs[1] + 7}`} stroke="var(--stall)" strokeWidth={1.2} /><rect x={xs[2] - 4} y={y - 4} width={8} height={8} fill="none" stroke="var(--stall)" strokeWidth={1.4} /></>
          : <circle cx={xs[2]} cy={y} r={1.6} fill="var(--text-faint)" />}
        {x.id === chosen && <rect x={2} y={y - 6} width={w - 4} height={12} fill="none" stroke="var(--dp-on)" strokeWidth={.8} opacity={.6} />}
      </g>
    })}
    {roots && <>
      <path d={`M4 ${rule}H${w - 4}`} className="dp-faint" strokeDasharray="2 3" />
      <text x={6} y={rule + 9} className="dp-axis">not AIKit's</text>
      {foreign.map((r, i) => {
        const y = rule + 19 + i * 11, len = ((w - 122) * (r.skills ?? 0)) / most
        return <g key={r.root} data-i={`${r.root}|${r.path ?? NONE}: ${r.skills ?? NONE} skills${r.decide ? `, ${r.decide} whose copies differ` : ''}.`}>
          <text x={6} y={y + 3} className="dp-ink-dim">{r.root}</text>
          <path d={`M78 ${y}h${Math.max(1, len)}`} stroke="var(--dp-value)" strokeWidth={3} opacity={.45} />
          <text x={82 + len} y={y + 3} className="dp-axis">{r.skills ?? NONE}</text>
          {r.decide ? <circle cx={w - 8} cy={y} r={3} fill="var(--stall)" /> : null}
        </g>
      })}
      {!foreign.length && <text x={6} y={rule + 22} className="dp-ink-dim">None found</text>}
    </>}
  </Display>
}

/** The Sources page's head: the chosen source's readings, then Source, Sync, Promote and Roll back. */
function SourcesHead({p}: {p: ViewProps}) {
  const all = sourcesOf(p.v), x = chosenSource(p.v)
  return <MonitorHead title="Sources" readings={[
    {label: 'kind', value: x ? KIND_WORD[x.kind ?? ''] ?? x.kind : undefined, does: 'Where the source lives: a Git repository at an exact revision, a folder on this machine, or one exported capsule.'},
    {label: 'skills', value: x?.skills === undefined ? undefined : `${x.skills}${x.retired ? ` · ${x.retired} retired` : ''}`, does: 'Skills in the active snapshot, and how many of them are retired.', tone: 'value'},
    {label: 'active', value: snap(x?.active), copy: x?.active, does: 'The active snapshot.'},
    {label: 'candidate', value: x ? (waits(x) ? snap(x.candidate) : 'same') : undefined, does: 'The candidate snapshot: the same as the active one, or new and waiting.', tone: x && waits(x) ? 'stall' : undefined},
  ]} controls={<>
    <Chooser {...st(p, 'source')} label="Source" wide does="The source the readings and the acts are for." value={x?.id ?? ''} options={(all ?? []).map(y => ({value: y.id, label: y.id}))} onChange={y => p.set('source', y)} />
    <Action {...st(p, 'sync')} label="Sync" does="Copy the source into a new candidate snapshot. Nothing becomes active." onPress={x ? () => p.set('sync', x.id) : undefined} />
    <Action {...st(p, 'promote')} hold label="Promote" does="Make the candidate snapshot active. The one before stays to roll back to."
      onPress={x && waits(x) ? () => p.set('promote', x.id) : undefined} disabled={st(p, 'promote').disabled ?? (x && !waits(x) ? 'The candidate is the active snapshot.' : undefined)} />
    <Action {...st(p, 'rollback')} hold label="Roll back" does="Return to the snapshot promoted before this one."
      onPress={x?.rollback ? () => p.set('rollback', x.id) : undefined} disabled={st(p, 'rollback').disabled ?? (x && !x.rollback ? 'Nothing was promoted before.' : undefined)} />
  </>} />
}

// ------------------------------------------------------------------------------------------------ adoption

interface Item {readonly name: string; readonly act: 'adopt' | 'owned' | 'refused'; readonly why?: string}
interface Plan {readonly root: string; readonly namespace?: string; readonly digest?: string; readonly isolation?: string; readonly items: readonly Item[]}
function adoptionOf(v: V): Plan | undefined {
  const raw = json<unknown>(v, 'adoption', undefined)
  if (!isRec(raw) || !s(raw.root)) return undefined
  const items = (Array.isArray(raw.items) ? raw.items : []).flatMap((x): Item[] => (isRec(x) && s(x.name) && (x.act === 'adopt' || x.act === 'owned' || x.act === 'refused')
    ? [{name: x.name as string, act: x.act, why: s(x.why)}] : []))
  return {root: raw.root as string, namespace: s(raw.namespace), digest: s(raw.digest), isolation: s(raw.isolation), items}
}
const adoptRoot = (v: V) => strOf(v, 'adoptRoot') ?? rootsOf(v)?.[0]?.root
/** The plan, when it is for the root chosen now. */
const planFor = (v: V) => { const plan = adoptionOf(v); return plan && plan.root === adoptRoot(v) ? plan : undefined }
const count = (plan: Plan | undefined, act: Item['act']) => plan?.items.filter(x => x.act === act).length

/** The adoption: the root's skills at the left, AIKit's namespace at the right, a line for each skill the plan copies across. A ring at the
 * left is a skill AIKit already owns there; an orange cross, one the plan refuses. */
function AdoptWell({v, w, h}: {v: V; w: number; h: number}) {
  const plan = planFor(v), root = adoptRoot(v)
  if (!plan) return <Display w={w} h={h} label="The adoption" corner={NONE}>
    <text x={w / 2} y={h / 2 - 4} className="dp-ink-dim" textAnchor="middle">{root ? 'No plan yet' : 'No reading of the roots'}</text>
    {root && <text x={w / 2} y={h / 2 + 9} className="dp-axis" textAnchor="middle">Press Preview to plan {root}</text>}
  </Display>
  const items = plan.items.slice(0, 64), top = 16, step = (h - top - 16) / Math.max(1, items.length), lx = 34, rx = w - 34
  return <Display w={w} h={h} label="The adoption" corner={`${count(plan, 'adopt')} to adopt`}
    does="The root's skills at the left, AIKit's namespace at the right. A line: the plan copies the skill across and leaves a link in its place. A ring: AIKit already owns it. An orange cross: the plan refuses it.">
    <text x={6} y={h - 4} className="dp-axis">{plan.root}</text>
    <text x={w - 6} y={h - 4} className="dp-axis" textAnchor="end">skill/{plan.namespace ?? NONE}/</text>
    {items.map((x, i) => {
      const y = top + i * step + step / 2
      return <g key={`${x.name}:${i}`} data-i={`${x.name}|${x.act === 'adopt' ? 'Copied into AIKit; a link stands in its place.' : x.act === 'owned' ? 'AIKit already owns it.' : x.why ?? 'Refused.'}`}>
        {x.act === 'adopt' && <path d={`M${lx + 4} ${y}C${w / 2} ${y} ${w / 2} ${y} ${rx - 4} ${y}`} stroke="var(--dp-value)" strokeWidth={step > 3 ? 1 : .6} opacity={.55} fill="none" />}
        {x.act === 'refused' ? <path d={`M${lx - 3} ${y - 2.5}l6 5M${lx + 3} ${y - 2.5}l-6 5`} stroke="var(--stall)" strokeWidth={1.3} />
          : x.act === 'owned' ? <circle cx={lx} cy={y} r={Math.min(3, Math.max(1.4, step / 2.4))} fill="none" stroke="var(--text-faint)" />
          : <path d={`M${lx - 4} ${y}h8`} stroke="var(--dp-value)" strokeWidth={Math.min(2, Math.max(1, step / 3))} />}
        {x.act === 'adopt' && <path d={`M${rx - 4} ${y}h8`} stroke="var(--dp-value)" strokeWidth={Math.min(2, Math.max(1, step / 3))} />}
      </g>
    })}
    {plan.items.length > items.length && <text x={w / 2} y={h - 4} className="dp-axis" textAnchor="middle">+{plan.items.length - items.length} more</text>}
  </Display>
}

function AdoptActs({p}: {p: ViewProps}) {
  const plan = planFor(p.v), root = adoptRoot(p.v)
  return plan
    ? <div className="ref-pair">
        <Action {...st(p, 'adoptApply')} hold label="Apply" does="Adopt the tree as previewed: AIKit copies each skill in and leaves a link in its place. Undo on Procedures puts the originals back."
          onPress={plan.digest ? () => p.set('adoptApply', plan.digest) : undefined} disabled={st(p, 'adoptApply').disabled ?? (plan.digest ? undefined : 'The plan has no digest to confirm.')} />
        <Action label="Cancel" does="Drop the plan. Nothing has changed." onPress={() => p.set('adoption', undefined)} />
      </div>
    : <Action {...st(p, 'adoptPreview')} label="Preview" does="Plan the adoption and show it. Nothing changes until you apply it." onPress={root ? () => p.set('adoptPreview', root) : undefined} pending={!!root} />
}

/** The Adopt page's head: the plan's counts, then Root, Namespace, Preview, then Apply and Cancel. */
function AdoptHead({p}: {p: ViewProps}) {
  const plan = planFor(p.v), roots = rootsOf(p.v), root = adoptRoot(p.v)
  return <MonitorHead title="Adopt" readings={[
    {label: 'to adopt', value: count(plan, 'adopt'), does: 'Skills the plan copies into AIKit.', tone: 'accent'},
    {label: 'refused', value: count(plan, 'refused'), does: 'Skills the plan refuses, each with its reason.', tone: count(plan, 'refused') ? 'stall' : undefined},
    {label: 'isolation', value: plan?.isolation, does: 'How AIKit stages the change: on a Git branch, in a shadow tree it swaps file by file, or directly.'},
    {label: 'digest', value: plan?.digest?.slice(0, 10), copy: plan?.digest, does: 'The digest the plan was reviewed under. Apply names it, and a change since refuses.'},
  ]} controls={<>
    <Chooser {...st(p, 'adoptRoot')} label="Root" wide does="The skill tree to bring under AIKit. Sources lists every tree it does not own." value={root ?? ''}
      options={(roots ?? []).map(r => ({value: r.root, label: r.root}))} onChange={x => { p.set('adoptRoot', x); p.set('adoption', undefined) }} />
    <TextField {...st(p, 'namespace')} label="Namespace" wide does="Where the skills land in AIKit: skill/<namespace>/. Press Enter to keep it." value={strOf(p.v, 'namespace') ?? ''}
      placeholder={has(p.v, 'namespace') ? 'claude' : NONE} onChange={x => { p.set('namespace', x); p.set('adoption', undefined) }} />
    <AdoptActs p={p} />
  </>} />
}

// ------------------------------------------------------------------------------------------------ Package: the set for another harness

const TARGETS = [{value: 'claude', label: 'Claude'}, {value: 'codex', label: 'Codex'}, {value: 'pi', label: 'Pi'}, {value: 'openai', label: 'OpenAI'}] as const
/** The set Package writes: the one chosen, else the selected agent's first. */
const packageSet = (v: V) => strOf(v, 'set') ?? chosenAgent(v)?.sets[0]
/** What the target cannot carry, from the package receipt: the relations it names (a count alone names none). Undefined while unread. */
function unsupportedOf(v: V): {count: number; relations: string[]} | undefined {
  const t = strOf(v, 'target'), map = json<unknown>(v, 'unsupported', undefined)
  if (t === undefined || !isRec(map)) return undefined
  const x = map[t]
  return Array.isArray(x) ? {count: words(x).length, relations: words(x)} : n(x) !== undefined ? {count: n(x)!, relations: []} : undefined
}

/** The Package page's head: the unsupported count, then Set, Package target and Export (Into, the directory Export writes into). */
function PackageHead({p}: {p: ViewProps}) {
  const lacks = unsupportedOf(p.v), target = strOf(p.v, 'target'), set = packageSet(p.v)
  const sets = words(json<unknown>(p.v, 'sets', []))
  return <MonitorHead title="Package" readings={[
    {label: 'unsupported', value: lacks?.count, does: 'The relations that the package target cannot carry. The receipt names each one.', tone: lacks?.count ? 'stall' : undefined},
  ]} controls={<>
    <Chooser {...st(p, 'set')} label="Set" wide does="The set to package. The set of the selected agent's Skillset rack until you choose another." value={set ?? ''}
      options={(set && !sets.includes(set) ? [...sets, set] : sets).map(x => ({value: x, label: x}))} onChange={x => p.set('set', x)} />
    <TextField {...st(p, 'outDir')} label="Into" does="The directory the package is written into, as an absolute path. AIKit writes the package and its receipt there." wide
      value={strOf(p.v, 'outDir') ?? ''} placeholder="/absolute/folder" onChange={x => p.set('outDir', x)} />
    <Radio {...st(p, 'target')} label="Package target" does="The harness to package the set for. The set itself does not change." value={target ?? ''} options={TARGETS} onChange={x => p.set('target', x)} />
    <Action {...st(p, 'exported')} label="Export" does="Write the native package and its receipt. The set does not change." onPress={target && set ? () => p.set('exported', target) : undefined} />
  </>} />
}

// ------------------------------------------------------------------------------------------------ procedures and bypasses

const EDITS = [['create', 'dir'], ['write', 'write'], ['link', 'link'], ['move', 'move'], ['delete', 'del'], ['block', 'block'], ['command', 'run']] as const
interface Proc {readonly id: string; readonly kind?: string; readonly subject?: string; readonly state?: 'planned' | 'committed' | 'undone'; readonly digest?: string; readonly isolation?: string; readonly at?: string; readonly edits: Readonly<Record<string, number>>}
interface Bypass {readonly id: string; readonly scope?: string; readonly reason?: string; readonly capability?: string; readonly at?: string; readonly state?: 'open' | 'spent' | 'revoked'}
function proceduresOf(v: V): Proc[] | undefined {
  if (!has(v, 'procedures')) return undefined
  const raw = json<unknown>(v, 'procedures', [])
  return Array.isArray(raw) ? raw.flatMap((x): Proc[] => (isRec(x) && s(x.id) ? [{id: x.id as string, kind: s(x.kind), subject: s(x.subject),
    state: x.state === 'planned' || x.state === 'committed' || x.state === 'undone' ? x.state : undefined, digest: s(x.digest), isolation: s(x.isolation), at: s(x.at),
    edits: isRec(x.edits) ? Object.fromEntries(Object.entries(x.edits).flatMap(([k, c]) => (n(c) === undefined ? [] : [[k, c as number]]))) : {}}] : [])) : []
}
function bypassesOf(v: V): Bypass[] | undefined {
  if (!has(v, 'bypasses')) return undefined
  const raw = json<unknown>(v, 'bypasses', [])
  return Array.isArray(raw) ? raw.flatMap((x): Bypass[] => (isRec(x) && s(x.id) ? [{id: x.id as string, scope: s(x.scope), reason: s(x.reason), capability: s(x.capability), at: s(x.at),
    state: x.state === 'open' || x.state === 'spent' || x.state === 'revoked' ? x.state : undefined}] : [])) : []
}
const chosenProc = (v: V) => { const all = proceduresOf(v); return all?.find(x => x.id === strOf(v, 'procedure')) ?? all?.[all.length - 1] }
const shortId = (id: string) => `…${id.slice(-4)}`
const clip = (x: string | undefined, k: number) => (x === undefined || x.length <= k ? x : `${x.slice(0, k - 1)}…`)
const STATE_WORD: Readonly<Record<string, string>> = {planned: 'planned', committed: 'applied', undone: 'undone'}
const SCOPE = [{value: 'next-event', label: 'Next event', does: 'The bypass lets the next hook event through, then is spent.'},
  {value: 'session', label: 'Session', does: 'The bypass holds for this session.'}, {value: '1h', label: '1 hour', does: 'The bypass holds for an hour.'}] as const

/** The procedures along a line, the latest at the right: filled when applied (Undo can take it back), a ring when planned and not run,
 * struck when undone. Above the chosen one, its edits by kind. Handle 1 chooses a procedure along the line. */
function ProcWell({p, w, h}: {p: ViewProps; w: number; h: number}) {
  const all = proceduresOf(p.v), chosen = chosenProc(p.v)
  if (!all) return <Display w={w} h={h} label="Procedures" corner={NONE}><text x={w / 2} y={h / 2} className="dp-ink-dim" textAnchor="middle">No reading of the procedures</text></Display>
  if (!all.length) return <Display w={w} h={h} label="Procedures" corner="none"><text x={w / 2} y={h / 2} className="dp-ink-dim" textAnchor="middle">No procedure recorded</text></Display>
  const shown = all.slice(-12), y = h - 26, x0 = 14, x1 = w - 14, xAt = (i: number) => (shown.length === 1 ? (x0 + x1) / 2 : x0 + (i * (x1 - x0)) / (shown.length - 1))
  const at = Math.max(0, shown.findIndex(x => x.id === chosen?.id)), cx = xAt(at), most = Math.max(1, ...EDITS.map(([k]) => chosen?.edits[k] ?? 0))
  const barW = (w - 24) / EDITS.length
  const drag = st(p, 'procedure').disabled ? undefined : (x: number) => { const i = Math.round(clampTo(0, shown.length - 1, ((x - x0) / Math.max(1, x1 - x0)) * (shown.length - 1))); p.set('procedure', shown[i]!.id) }
  return <Display w={w} h={h} label="Procedures" corner={chosen?.kind ?? NONE}
    does="The procedures AIKit recorded, the latest at the right. Filled: applied, and Undo can take it back. A ring: planned, not run. Struck: undone. Above, the chosen one's edits by kind. Drag handle 1 to choose.">
    {EDITS.map(([k, label], i) => {
      const c = chosen?.edits[k] ?? 0, bh = c ? 6 + (52 * Math.log(1 + c)) / Math.log(1 + most) : 0, bx = 12 + i * barW
      return <g key={k} data-i={`${label}|${c} edits of this kind.`}>
        <rect x={bx + 2} y={78 - bh} width={barW - 4} height={bh} fill="var(--dp-value)" opacity={c ? .75 : 0} />
        <path d={`M${bx + 2} 78h${barW - 4}`} className="dp-faint" />
        {c > 0 && <text x={bx + barW / 2} y={74 - bh} className="dp-axis" textAnchor="middle">{c}</text>}
        <text x={bx + barW / 2} y={89} className="dp-axis" textAnchor="middle">{label}</text>
      </g>
    })}
    <path d={`M${cx} 94V${y - 6}`} stroke="var(--dp-on)" strokeWidth={.8} strokeDasharray="2 2" />
    <path d={`M${x0} ${y}H${x1}`} className="dp-faint" />
    {shown.map((x, i) => <g key={x.id} data-i={`${x.kind ?? NONE} · ${shortId(x.id)}|${STATE_WORD[x.state ?? ''] ?? NONE}${x.at ? `, ${x.at}` : ''}.`}>
      <circle cx={xAt(i)} cy={y} r={3.6} fill={x.state === 'committed' ? 'var(--dp-value)' : 'var(--dp-well)'} stroke={x.state === 'planned' ? 'var(--dp-on)' : x.state === 'undone' ? 'var(--text-faint)' : 'var(--dp-value)'} strokeWidth={1.2} />
      {x.state === 'undone' && <path d={`M${xAt(i) - 5} ${y + 5}l10 -10`} stroke="var(--text-faint)" strokeWidth={1} />}
    </g>)}
    <text x={x0} y={h - 6} className="dp-axis">earlier</text><text x={x1} y={h - 6} className="dp-axis" textAnchor="end">latest</text>
    {chosen && <Handle n={1} x={cx} y={y} shape="ring" label="Procedure" does="Drag along the line to choose a procedure." onDrag={drag} onReset={drag && (() => p.set('procedure', shown[shown.length - 1]!.id))} />}
  </Display>
}

/** The Procedures page's head: the chosen procedure's readings, then Procedure, Run and Undo; Bypass with how long it lasts and its
 * reason, Issue, and Revoke (for the open bypass chosen in the list, else the first open one). */
function ProcHead({p, bypass}: {p: ViewProps; bypass: Bypass | undefined}) {
  const all = proceduresOf(p.v), x = chosenProc(p.v), byp = bypassesOf(p.v)
  const reason = strOf(p.v, 'bypassReason') ?? '', scope = strOf(p.v, 'bypassScope')
  return <MonitorHead title="Procedures" readings={[
    {label: 'subject', value: clip(x?.subject, 28), does: `What the procedure changes${x?.subject ? `: ${x.subject}` : ''}.`},
    {label: 'isolation', value: x?.isolation, does: 'How it is staged: on a Git branch, in a shadow tree, or directly.'},
    {label: 'digest', value: x?.digest?.slice(0, 10), copy: x?.digest, does: 'The digest Run names. A change since the plan refuses the run.'},
    {label: 'state', value: x ? STATE_WORD[x.state ?? ''] : undefined, does: 'Planned: not run. Applied: run, and Undo can take it back. Undone.', tone: x?.state === 'planned' ? 'accent' : x?.state === 'committed' ? 'green' : undefined},
    {label: 'at', value: x?.at, does: 'When it was planned or applied.'},
  ]} controls={<>
    <Chooser {...st(p, 'procedure')} label="Procedure" wide does="The recorded procedure the readings and acts are for." value={x?.id ?? ''}
      options={(all ?? []).map(y => ({value: y.id, label: `${y.kind ?? NONE} ${shortId(y.id)}`}))} onChange={y => p.set('procedure', y)} />
    <Action {...st(p, 'procRun')} hold label="Run" does="Apply the planned procedure exactly as planned. A world changed since the plan refuses it."
      onPress={x?.state === 'planned' && x.digest ? () => p.set('procRun', `${x.id}@${x.digest}`) : undefined}
      disabled={st(p, 'procRun').disabled ?? (x && x.state !== 'planned' ? 'It has already run.' : undefined)} />
    <Action {...st(p, 'procUndo')} hold label="Undo" does="Take the procedure back from its journal: each edit reversed, the last first."
      onPress={x?.state === 'committed' ? () => p.set('procUndo', x.id) : undefined}
      disabled={st(p, 'procUndo').disabled ?? (x && x.state !== 'committed' ? (x.state === 'undone' ? 'It is already undone.' : 'It has not run.') : undefined)} />
    <MonitorGroup label="Bypass">
      <Radio {...st(p, 'bypassScope')} label="Lasts" does="How long the next bypass lets hooks through." value={scope ?? ''} options={SCOPE} onChange={y => p.set('bypassScope', y)} />
      <TextField {...st(p, 'bypassReason')} label="Reason" wide does="Why you let the hooks through. AIKit records it with the bypass." value={reason} placeholder={has(p.v, 'bypassReason') ? 'Why' : NONE} onChange={y => p.set('bypassReason', y)} />
      <Action {...st(p, 'issue')} hold label="Issue" does="Issue a bypass: the hook chain lets the agent through for as long as it lasts. It is recorded, and is not an authority."
        onPress={reason.trim() && scope ? () => p.set('issue', JSON.stringify({scope, reason: reason.trim()})) : undefined}
        disabled={st(p, 'issue').disabled ?? (reason.trim() ? undefined : 'Give a reason first.')} />
    </MonitorGroup>
    <Action {...st(p, 'revoke')} hold label="Revoke" does="Close the chosen open bypass now." onPress={bypass ? () => p.set('revoke', bypass.id) : undefined} disabled={st(p, 'revoke').disabled ?? (byp && !bypass ? 'No bypass is open.' : undefined)} />
  </>} />
}

// ------------------------------------------------------------------------------------------------ the pages

type PageId = 'run' | 'context' | 'sources' | 'adopt' | 'package' | 'procedures'
const PAGES: readonly {id: PageId; label: string}[] = [{id: 'run', label: 'Run'}, {id: 'context', label: 'Context'}, {id: 'sources', label: 'Sources'}, {id: 'adopt', label: 'Adopt'},
  {id: 'package', label: 'Package'}, {id: 'procedures', label: 'Procedures'}]
const pageOf = (p: ViewProps): PageId => (PAGES.some(x => x.id === p.page) ? p.page as PageId : 'run')
/** Sources is dark while a candidate waits or copies of a skill differ; Procedures while one is planned and not run. */
function pageLight(v: V, id: PageId): LightState | undefined {
  if (id === 'sources') { const all = sourcesOf(v), roots = rootsOf(v); return all === undefined && roots === undefined ? undefined : (all ?? []).some(waits) || (roots ?? []).some(r => (r.decide ?? 0) > 0) ? 'dark' : 'lit' }
  if (id === 'procedures') { const all = proceduresOf(v); return all === undefined ? undefined : all.some(x => x.state === 'planned') ? 'dark' : 'lit' }
  return undefined
}

// ------------------------------------------------------------------------------------------------ the pane

function RunDoc({v}: {v: V}) {
  const agents = agentsOf(v), unused = unusedOf(v)
  return <>
    <h3>{strOf(v, 'run') ?? NONE} <small>{agents ? `${agents.length} agents` : <NoReading name="Agents" why="No reading of the run's agents." />}</small></h3>
    {(agents ?? []).map(a => <section key={a.id} className="ref-doc-kind">
      <h4>{a.name} <small>{a.sets.join(', ') || NONE}</small></h4>
      <ol className="ref-doc-list">
        {a.members.filter(m => !filtering(v) || unused!.has(m.id)).map(m => {
          const state = markState(m)
          return <li key={m.id} data-dim={state !== 'whole' ? 'true' : undefined}>
            <WoodMark kind={m.form} size={14} state={state} set={marks(v)} />
            <b>{m.name}</b><span className="ref-doc-rev">{unused?.has(m.id) ? `${m.rev} · never used` : m.rev}</span>
            <span className="ref-doc-standing"><Ladder rungs={m.rungs} labels={RUNGS} label={m.name} /> {m.withheld ? m.withheld.why : 'Available.'}</span>
            <p>{m.says}</p>
          </li>
        })}
      </ol>
    </section>)}
  </>
}

function ContextDoc({v}: {v: V}) {
  const r = pressureOf(v), turn = turnOf(v)
  return <>
    <h3>{chosenAgent(v)?.name ?? NONE} <small>{r ? `${r.prompts ?? NONE} of ${r.budget ?? NONE} prompts · ${r.pressure ?? NONE} · allowance ${allowanceWords(r) ?? NONE}` : <NoReading name="Pressure" why="No reading of the pressure." />}</small></h3>
    <section className="ref-doc-kind"><h4>{turn?.notice ?? 'The last turn'}</h4>
      {!turn ? <p className="ref-doc-lead">No reading of the last turn.</p>
        : <ol className="ref-doc-list">{turn.blocks.map((b, i) => <li key={i} data-dim={b.suppressed ? 'true' : undefined}>
          <span className="dp-lamp" data-light={b.suppressed ? 'dark' : 'lit'} data-tone={b.withheld ? 'stall' : 'value'} />
          <b>{b.title}</b><span className="ref-doc-rev">{b.event}</span>
          <span className="ref-doc-standing">{b.standing} standing · {b.kept} entered · {b.withheld} withheld</span>
        </li>)}</ol>}
    </section>
  </>
}

function SourcesDoc({v}: {v: V}) {
  const all = sourcesOf(v), roots = rootsOf(v)
  return <>
    <h3>Sources <small>{all ? `${all.length} owned by AIKit` : <NoReading name="Sources" why="No reading of the sources." />} · {roots ? `${roots.length} skill trees it does not own` : <NoReading name="Skill trees" why="No reading of the skill trees AIKit does not own." />}</small></h3>
    <ol className="ref-doc-list">{(all ?? []).map(x => <li key={x.id} data-dim={x.active ? undefined : 'true'}>
      <span className="dp-lamp" data-light={x.active ? 'lit' : 'dark'} data-tone={waits(x) ? 'stall' : 'value'} />
      <b>{x.id}</b><span className="ref-doc-rev">{KIND_WORD[x.kind ?? ''] ?? x.kind ?? NONE}</span>
      <span className="ref-doc-standing">Active {snap(x.active) ?? NONE} · candidate {x ? (waits(x) ? `${snap(x.candidate)}, waiting` : 'the same') : NONE} · {x.rollback ? `rolls back to ${snap(x.rollback)}` : 'nothing to roll back to'}</span>
      <p>{x.skills ?? NONE} skills{x.retired ? `, ${x.retired} retired` : ''}{x.ground ? '. Central\'s own ground.' : '.'}{x.rejected ? ` ${x.rejected} of the candidate rejected.` : ''}</p>
    </li>)}</ol>
    <section className="ref-doc-kind"><h4>Not AIKit's</h4>
      {roots === undefined ? <p className="ref-doc-lead">No reading of the skill trees on this machine.</p> : !roots.length ? <p className="ref-doc-lead">Every skill tree on this machine is AIKit's.</p>
        : <ol className="ref-doc-list">{roots.map(r => <li key={r.root}>
          <span className="dp-lamp" data-light="dark" data-tone={r.decide ? 'stall' : 'value'} />
          <b>{r.root}</b><span className="ref-doc-rev">{r.skills ?? NONE} skills</span>
          <span className="ref-doc-standing">{r.path ?? NONE}</span>
          <p>{r.decide ? `${r.decide} names have copies that differ here and in another tree.` : 'Every copy matches.'}</p>
        </li>)}</ol>}
    </section>
  </>
}

function AdoptDoc({v}: {v: V}) {
  const plan = planFor(v), root = adoptRoot(v)
  if (!plan) return <><h3>Adopt <small>{root ?? NONE}</small></h3><p className="ref-doc-lead">{root ? 'No plan yet. Press Preview to plan it.' : 'No reading of the skill trees.'}</p></>
  return <>
    <h3>Adopt {plan.root} <small>into skill/{plan.namespace ?? NONE}/ · {count(plan, 'adopt')} to adopt · {plan.isolation ?? NONE} · digest {plan.digest?.slice(0, 12) ?? NONE}</small></h3>
    <p className="ref-doc-lead">Each skill is copied into AIKit and a link takes its place, so every harness that read the tree reads the same skill. Undo, on Procedures, puts the original files back.</p>
    <ol className="ref-doc-list">{plan.items.map(x => <li key={x.name} data-dim={x.act === 'adopt' ? undefined : 'true'}>
      <span className="dp-lamp" data-light={x.act === 'adopt' ? 'lit' : 'dark'} data-tone={x.act === 'refused' ? 'stall' : 'value'} />
      <b>{x.name}</b><span className="ref-doc-rev">{x.act}</span>
      {x.why && <p>{x.why}</p>}
    </li>)}</ol>
  </>
}

function PackageDoc({v}: {v: V}) {
  const lacks = unsupportedOf(v), target = TARGETS.find(x => x.value === strOf(v, 'target'))?.label
  return <>
    <h3>{packageSet(v) ?? NONE} <small>for {target ?? NONE} · {lacks ? `${lacks.count} unsupported` : <NoReading name="Unsupported" why="No reading of the package receipt." />}</small></h3>
    {lacks && (lacks.relations.length ? <ol className="ref-doc-list">{lacks.relations.map(x => <li key={x}><span className="dp-lamp" data-light="lit" data-tone="stall" /><b>{x}</b></li>)}</ol>
      : <p className="ref-doc-lead">{lacks.count ? `The receipt counts ${lacks.count} and names none.` : 'The receipt names none.'}</p>)}
  </>
}

/** Each procedure, the latest first, then the bypasses; an open bypass is chosen for Revoke by clicking it. */
function ProceduresDoc({v, chosen, onChoose}: {v: V; chosen?: string; onChoose: (id: string) => void}) {
  const all = proceduresOf(v), byp = bypassesOf(v)
  return <>
    <h3>Procedures <small>{all ? `${all.length} recorded` : <NoReading name="Procedures" why="No reading of the procedures." />}</small></h3>
    <ol className="ref-doc-list">{[...(all ?? [])].reverse().map(x => <li key={x.id} data-dim={x.state === 'undone' ? 'true' : undefined}>
      <span className="dp-lamp" data-light={x.state === 'committed' ? 'lit' : 'dark'} data-tone={x.state === 'planned' ? 'accent' : 'value'} />
      <b>{x.kind ?? NONE} {shortId(x.id)}</b><span className="ref-doc-rev">{STATE_WORD[x.state ?? ''] ?? NONE}</span>
      <span className="ref-doc-standing">{x.subject ?? NONE} · {x.isolation ?? NONE} · {x.at ?? NONE}</span>
      <p>{EDITS.filter(([k]) => x.edits[k]).map(([k, label]) => `${x.edits[k]} ${label}`).join(' · ') || 'No edits read.'}</p>
    </li>)}</ol>
    <section className="ref-doc-kind"><h4>Bypasses</h4>
      {byp === undefined ? <p className="ref-doc-lead">No reading of the bypasses.</p> : !byp.length ? <p className="ref-doc-lead">No bypass has been issued.</p>
        : <ol className="ref-doc-list">{byp.map(b => { const open = b.state === 'open'
          return <li key={b.id} data-dim={open ? undefined : 'true'} data-chosen={b.id === chosen ? 'true' : undefined}
            role={open ? 'button' : undefined} tabIndex={open ? 0 : undefined} data-i={open ? `${b.reason ?? b.id}|Choose it for Revoke.` : undefined}
            onClick={open ? () => onChoose(b.id) : undefined} onKeyDown={open ? e => { if (e.key === 'Enter') onChoose(b.id) } : undefined}>
            <span className="dp-lamp" data-light={open ? 'lit' : 'dark'} data-tone="stall" />
            <b>{b.reason ?? b.id}</b><span className="ref-doc-rev">{b.state ?? NONE}</span>
            <span className="ref-doc-standing">{b.scope ?? NONE} · {b.capability ?? 'the whole hook chain'} · issued {b.at ?? NONE}</span>
          </li> })}</ol>}
    </section>
  </>
}

/** The pane's six pages, over the head; a page that is dark carries its lamp, as a panel's pages do. */
function PaneTabs({p}: {p: ViewProps}) {
  const page = pageOf(p)
  return <div className="ref-pane-tabs aik-tabs" role="tablist" aria-label="Pages">
    {PAGES.map(x => { const lamp = pageLight(p.v, x.id)
      return <button key={x.id} type="button" role="tab" data-page={x.id} aria-selected={x.id === page} onClick={() => p.setPage(x.id)}>{lamp && <Lamp state={lamp} />}{x.label}</button> })}
  </div>
}

type Picture = (w: number, h: number) => ReactNode
/** A page's body: its picture across the top at the body's width, then its lists. */
function Body({room, picture, children}: {room: Room; picture?: Picture; children: ReactNode}) {
  return <div className="aik-body">
    {picture && <div className="aik-picture">{picture(room.w - 24, Math.round(clampTo(120, 190, room.h * .42)))}</div>}
    <div className="ref-doc aik-doc">{children}</div>
  </div>
}

function ProceduresPane({p}: {p: ViewProps}) {
  const byp = bypassesOf(p.v), [chosen, setChosen] = useState<string | undefined>(undefined)
  const b = byp?.find(y => y.id === chosen && y.state === 'open') ?? byp?.find(y => y.state === 'open')
  return <MonitorPane label="Procedures" head={<><PaneTabs p={p} /><ProcHead p={p} bypass={b} /></>}>
    {room => <Body room={room} picture={(w, h) => <ProcWell p={p} w={w} h={h} />}><ProceduresDoc v={p.v} chosen={b?.id} onChoose={setChosen} /></Body>}
  </MonitorPane>
}

/** The Full: the page chosen on the tabs, its head, its picture and its lists. */
function FullView({p}: {p: ViewProps}) {
  const page = pageOf(p), v = p.v
  if (page === 'procedures') return <ProceduresPane p={p} />
  const {head, picture, doc}: {head: ReactNode; picture?: Picture; doc: ReactNode} = page === 'context' ? {head: <ContextHead p={p} />, picture: (w, h) => <ContextWell v={v} w={w} h={h} />, doc: <ContextDoc v={v} />}
    : page === 'sources' ? {head: <SourcesHead p={p} />, picture: (w, h) => <SourcesWell v={v} w={w} h={h} />, doc: <SourcesDoc v={v} />}
    : page === 'adopt' ? {head: <AdoptHead p={p} />, picture: (w, h) => <AdoptWell v={v} w={w} h={h} />, doc: <AdoptDoc v={v} />}
    : page === 'package' ? {head: <PackageHead p={p} />, doc: <PackageDoc v={v} />}
    : {head: <RunHead p={p} />, picture: (w, h) => <RunWell v={v} w={w} h={h} />, doc: <RunDoc v={v} />}
  return <MonitorPane label={PAGES.find(x => x.id === page)!.label} head={<><PaneTabs p={p} />{head}</>}>{room => <Body room={room} picture={picture}>{doc}</Body>}</MonitorPane>
}

/** The four marks with how many of the run's members are of each kind. */
function KindCounts({v, size}: {v: V; size: number}) {
  const all = carried(v)
  return <div className="ref-kinds" data-size={size > 20 ? 'big' : undefined}>
    {ORDER.map(form => <span key={form} className="ref-kind" data-i={`${FORM_NAME[form]}s|${all ? all.filter(m => m.form === form).length : NONE} the run's agents carry.`}>
      <WoodMark kind={form} size={size} set={marks(v)} /><b>{all ? all.filter(m => m.form === form).length : NONE}</b>
    </span>)}
  </div>
}

// The light reads the owner alone; hollow while it has not said.
const light = (v: V, owner?: V) => (strOf(owner ?? v, 'light') ?? 'unknown') as LightState

// ------------------------------------------------------------------------------------------------ sample readings (defaults and fixtures only)

/** The rungs a member reaches when it is carried and projected, and its text never entered the agent's context. */
const notLoaded = (m: Member): Member => ({...m, rungs: m.rungs.map((r, i) => (i < 5 ? r : null))})
// Two agents of a run on O-I: Flint loads the documentation set; Eros carries it and loads none of it.
const AGENTS = [
  {id: 'flint', name: 'Flint', sets: ['central:documentation'], members: DOCUMENTATION, consumed: 14 / 60, pressure: 'moderate'},
  {id: 'eros', name: 'Eros', sets: ['central:documentation'], members: DOCUMENTATION.map(notLoaded), consumed: 5 / 60, pressure: 'fresh'},
]
// The Context page's sample: Flint's session fourteen prompts in, at moderate pressure, and its last turn.
const SAMPLE_PRESSURE = JSON.stringify({budget: 60, prompts: 14, consumed: 14 / 60, pressure: 'moderate', brackets: {fresh_max: .2, moderate_max: .45, depleted_max: .7}, blocks: 3, lines: 8})
const SAMPLE_TURN = JSON.stringify({withheldLines: 20, withheldBlocks: 1, notice: 'Moderate: 20 lines and 1 block withheld',
  blocks: [
    {event: 'SessionStart', title: 'Disclosure: who you are, where you stand', standing: 4, kept: 0, withheld: 0},
    {event: 'SessionStart', title: 'O-I orientation and recent work', standing: 3, kept: 8, withheld: 9},
    {event: 'Prompt', title: 'Domain: the DLW manual', standing: 2, kept: 8, withheld: 4},
    {event: 'PreToolUse', title: 'docs/dlw/DLW.md: its standing guidance', standing: 0, kept: 8, withheld: 2},
    {event: 'PostToolUse', title: 'Receipts of the last edits', standing: 0, kept: 0, withheld: 5, suppressed: true},
  ]})
// `aikit source show <id> --json` on this machine, 21 Oct: Central's documentation source, the personal ground and a Git source.
const SOURCES = [
  {id: 'central', kind: 'directory', skills: 25, active: 'fc3e18e4969ee49d', candidate: 'fc3e18e4969ee49d', rollback: 'b80df39f9416e267'},
  {id: 'personal', kind: 'directory', skills: 71, retired: 15, active: '79561209324ca4f5', candidate: '79561209324ca4f5', rollback: 'fd60f26199b396bd', ground: true},
  {id: 'mattpocock', kind: 'git', skills: 41, active: 'da1ea3e2d10c0233', candidate: 'da1ea3e2d10c0233', rollback: '0411127db42e91fd'},
  {id: 'factory', kind: 'directory', skills: 12, active: '5a0e91c4b7d2e310', candidate: '5a0e91c4b7d2e310'},
  {id: 'ql', kind: 'directory', skills: 9, active: '0c7f3e21a9b04d55', candidate: '0c7f3e21a9b04d55'},
]
// `aikit collate --json --all`, counted by root: the trees AIKit reads and does not own; two names differ (central-session-strap,
// reverse-engineer-anything).
const ROOTS = [
  {root: '@hermes', path: '~/.hermes/skills', skills: 146, decide: 0}, {root: '@claude', path: '~/.claude/skills', skills: 100, decide: 2},
  {root: '@agents', path: '~/.agents/skills', skills: 77, decide: 2}, {root: '@codex', path: '~/.codex/skills', skills: 63, decide: 1},
]
const CLAUDE_TREE = ['agent-worktree-lifecycle', 'apply-cmea', 'apply-tetralemma', 'bimba-graph', 'brainstorming', 'brandkit', 'central-archive-recovery',
  'central-authorised-task', 'central-capability-discovery', 'central-contribution', 'central-day-close', 'central-delegation', 'central-field-health',
  'central-git-convergence', 'central-ground-keeping', 'central-ledger', 'central-now-field', 'central-orient', 'central-placement', 'central-retrieval',
  'central-session-handoff', 'central-session-strap', 'central-wiki-return', 'central-work-intake', 'design-taste-frontend', 'dispatching-parallel-agents',
  'executing-plans', 'find-skills', 'full-output-enforcement', 'gpt-taste', 'grilling', 'high-end-visual-design', 'image-to-code', 'minimalist-ui', 'process-hygiene',
  'prototype', 'receiving-code-review', 'requesting-code-review', 'reverse-engineer-anything', 'systematic-debugging', 'telos', 'test-driven-development',
  'using-git-worktrees', 'verification-before-completion', 'wayfinder', 'writing-plans', 'writing-skills']
const ADOPTION = {root: '@claude', namespace: 'claude', digest: 'b3:4e2a91c07f5d8e13a6c2', isolation: 'staged',
  items: CLAUDE_TREE.map(name => (name === 'central-session-strap' || name === 'reverse-engineer-anything'
    ? {name, act: 'refused', why: 'Another tree holds a different copy of this name. Adopt cannot choose between them: keep one, then adopt.'}
    : name.startsWith('central-') && name !== 'central-orient' ? {name, act: 'owned'} : {name, act: 'adopt'}))}
// `aikit procedure list --json`, the latest five, with their diffs.
const PROCEDURES = [
  {id: 'prc_01M29MA279X5V519PSFXT0K3WV', kind: 'promote', subject: 'source central', state: 'committed', digest: 'b3:91d04c2e7a', isolation: 'direct', at: '19 Sep 14:02', edits: {write: 4, link: 25}},
  {id: 'prc_01M3C19D7640P0JXS3283H4R9R', kind: 'adopt', subject: 'Central/.claude/skills → skill/oi/', state: 'committed', digest: 'b3:7f2a19e0c4', isolation: 'staged', at: '25 Sep 10:20', edits: {create: 3, write: 9, link: 3}},
  {id: 'prc_01M4K7G2ZWH9EYDVBM320CVXYP', kind: 'profile-fork', subject: 'baseline → baseline-dlw', state: 'undone', digest: 'b3:0c51e8a2d9', isolation: 'git-branch', at: '14 Oct 09:41', edits: {create: 1, write: 2}},
  {id: 'prc_01M4K7G303SF0VVPSCD0RZNPES', kind: 'tools-projection', subject: 'claude-code MCP servers', state: 'committed', digest: 'b3:e4a7c1093b', isolation: 'direct', at: '14 Oct 09:44', edits: {block: 1, write: 1}},
  {id: 'prc_01M5EER86PB5JC206XZFWZ2C0A', kind: 'adopt', subject: '~/.codex/skills → skill/codex/', state: 'planned', digest: 'b3:2d6e90af13', isolation: 'staged', at: '21 Oct 11:05', edits: {create: 61, write: 244, link: 61}},
]
const BYPASSES = [
  {id: 'byp_01M5EER9', scope: 'next-event', reason: 'Landing the dlw/build merge by hand', at: '21 Oct 10:52', state: 'open'},
  {id: 'byp_01M4QK2T', scope: 'session', reason: 'Recovering a stuck day close', capability: 'hook/aikit/development-entry', at: '18 Oct 22:14', state: 'spent'},
  {id: 'byp_01M3ZP0D', scope: '1h', reason: 'Testing the gateway restart', at: '12 Oct 16:30', state: 'revoked'},
]

export const design = railAndPane({
  id: 'ai-kit:ai-kit',
  title: 'AIKit',
  kind: 'instrument',
  firstPage: 'run',
  defaults: {light: 'lit', run: 'Reconcile the agency designs', marks: 'blade', agents: JSON.stringify(AGENTS), agent: 'flint',
    unused: JSON.stringify(['architecture-development', 'evidence-led-repair', 'diagram-authoring', 'projection-authoring', 'ui-mockup-authoring']), unusedOnly: false,
    'ctx.pressure': SAMPLE_PRESSURE, 'ctx.turn': SAMPLE_TURN, 'ctx.armed': JSON.stringify(['continuity-closeout']),
    sources: JSON.stringify(SOURCES), roots: JSON.stringify(ROOTS), source: 'central',
    adoptRoot: '@claude', namespace: 'claude', adoption: JSON.stringify(ADOPTION),
    set: 'central:documentation', sets: JSON.stringify(['central:documentation', 'central:core-development', 'aikit:project-author']), target: 'claude', outDir: '/Users/you/Packages',
    unsupported: JSON.stringify({claude: [], codex: [], pi: ['mcp: the set\'s MCP servers (Pi carries no MCP)'], openai: []}),
    procedures: JSON.stringify(PROCEDURES), procedure: 'prc_01M5EER86PB5JC206XZFWZ2C0A', bypasses: JSON.stringify(BYPASSES), bypassScope: 'next-event', bypassReason: ''},
  fixtures: {
    'A candidate waits': {source: 'mattpocock', sources: JSON.stringify(SOURCES.map(x => (x.id === 'mattpocock' ? {...x, candidate: '3be07c55f1a82d64'} : x)))},
    'Before preview': {adoption: undefined, adoptRoot: '@codex', namespace: 'codex'},
    'Unused only': {unusedOnly: true},
    'For Pi': {target: 'pi'},
    'Context critical': {'ctx.pressure': JSON.stringify({budget: 60, prompts: 47, consumed: 47 / 60, pressure: 'critical', brackets: {fresh_max: .2, moderate_max: .45, depleted_max: .7}, blocks: 0, lines: 0}),
      'ctx.turn': JSON.stringify({withheldLines: 31, withheldBlocks: 3, notice: 'Critical: standing guidance only; 3 blocks withheld',
        blocks: [{event: 'Prompt', title: 'Standing: authorship and the never-do card', standing: 6, kept: 0, withheld: 0}, {event: 'Prompt', title: 'Domain: the DLW manual', standing: 0, kept: 0, withheld: 12, suppressed: true},
          {event: 'PreToolUse', title: 'docs/dlw/DLW.md: its standing guidance', standing: 2, kept: 0, withheld: 9}, {event: 'PostToolUse', title: 'Receipts of the last edits', standing: 0, kept: 0, withheld: 10, suppressed: true}]}),
      agents: JSON.stringify(AGENTS.map(a => (a.id === 'flint' ? {...a, consumed: 47 / 60, pressure: 'critical'} : a)))},
    'The pen': {marks: 'pen'},
    'No readings': Object.fromEntries(['light', 'run', 'agents', 'agent', 'unused', 'unusedOnly', 'ctx.pressure', 'ctx.turn', 'ctx.armed', 'sources', 'roots', 'source', 'adoptRoot', 'namespace',
      'adoption', 'set', 'sets', 'target', 'outDir', 'unsupported', 'procedures', 'procedure', 'bypasses', 'bypassScope', 'bypassReason'].map(k => [k, undefined])),
  },

  // Full: the six pages, as tabs; its window holds it (§16.3).
  full: p => <FullView p={p} />,

  widget: p => <Tile title="AIKit" light={light(p.v, p.owner)} span={2} onFull={p.nav.full}>
    <KindCounts v={p.v} size={28} />
    <div className="ref-tile-side"><RunCounts v={p.v} /></div>
  </Tile>,
})
