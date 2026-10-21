// A member of a Skillset rack (manual §19.8): one Skill identity in three forms (ai-kit docs/PRAXIS-ARCHITECTURE.md §2), so one
// device with three faces. Every form is trusted, enabled and projected alike and climbs the same ladder of evidence; the face
// changes with what the form is for. A Skill shows where it reaches. A Method shows the path it composes, from claim to Return,
// and runs and proves through AIKit. A Methodology shows its field and which Method applies when. The fixtures are Central's
// own: documentation-reconciliation, docs-methodology, vision-authoring and reverse-recovery (a revision nobody has reviewed).
//
// Its pages carry the member's upkeep. Why: how the member came to stand as it does — what selects it, what it needs and what needs it,
// where it is projected — and, where Central's ground holds it, its standing there, with Retire and Restore. History: every recorded
// change to it, newest last.
//
// Value keys beyond the member's own. The owners report, never written from here:
//   why       {state, trust, maturity, selectedBy: string[], requiredBy: string[], dependencies: string[], projection: string[], unavailable?}
//             `aikit explain <capability> --json`: active, the render's Trust and Maturity lines, selected_by, required_by, dependencies,
//             the Projection targets, unavailable
//   ground    {scope, path, provenance, standing: 'active' | 'retired', retirement?: {by, at, why}}  the member's row of Central's
//             `control.skills.inspect` (scope control-user | control-machine | projectcentral-user); JSON null when Central's ground does
//             not hold it (it comes from a product's or a package's skills)
//   history   [{kind, at, summary, recoverability}]  `aikit history <capability> --json`: entries[].kind (generation, trust, run, failure,
//             bypass, procedure), occurred_at_unix_ms as the person's civil time, summary, recoverability (inspect-only | undoable)
// Settings the shell holds: retireReason (the reason Retire records). Held by the hand: retireAsk, restoreAsk, event (the row chosen).
// Acts: retire (JSON {scope, name, retirement_reason}; the host adds retired_by, the person) and restore (JSON {scope, name}), Central's
// control.skills.retire and control.skills.restore, which the kernel's invoke_action reaches. `aikit explain` and `aikit history` have no
// kernel op yet: the host leaves why and history absent until one does.
import {WoodMark} from '../../sdk/marks'
import type {WoodSet} from '../../sdk/icons'
import {useState} from 'react'
import {Action, Band, Display, Folded, Ladder, Panel, Readout, Rows, Section, TextField, Tile, Toggle, type LightState, type RowItem} from '../../sdk/panel'
import {NONE, has, json, st, strOf, type DesignedDevice, type ViewProps} from './design'
import {DOCUMENTATION, FORM_ASKS, FORM_NAME, RUNGS, markState, type Member} from './practice'

type V = ViewProps['v']
/** The rack's members as AIKit reads them (the binding's `members`); this device's own is the one named by `member`. */
const members = (v: V): Member[] => json<Member[]>(v, 'members', []).filter(m => m && typeof m.id === 'string' && Array.isArray(m.rungs))
/** The member before its reading arrives: no name, no evidence, its mark withheld. */
const UNREAD: Member = {id: '', name: NONE, form: 'skill', rev: NONE, says: '', rungs: RUNGS.map(() => null)}
const member = (v: V): Member => members(v).find(m => m.id === strOf(v, 'member')) ?? UNREAD
const known = (v: V) => member(v) !== UNREAD
const formName = (v: V) => (known(v) ? FORM_NAME[member(v).form] : NONE)
// The mark set is the person's choice for the whole shell (Settings), not the owner's: the blade until they choose.
const marks = (v: V) => (strOf(v, 'marks') ?? 'blade') as WoodSet
const wanted = (v: V) => v.requested !== false
const reviewed = (v: V) => v.reviewed === true
/** The member as it stands now: your request, and a review you recorded, change what AIKit reports. */
function standing(v: V): Member {
  const m = member(v)
  if (!wanted(v)) return {...m, rungs: m.rungs.map((r, i) => (i < 2 ? r : false))}
  if (m.withheld?.fix === 'review' && reviewed(v)) return {...m, withheld: undefined, rungs: m.rungs.map((r, i) => (i === 2 || i === 4 ? true : r))}
  return m
}

/** The Method's path (its SKILL.md "Composes"; the binding's `path`): steps, not mandatory stages — a step whose layer is not
 * touched is skipped. */
type Step = {readonly step: string; readonly uses: readonly string[]}
const pathOf = (v: V) => json<Step[]>(v, 'path', []).filter(s => s && typeof s.step === 'string' && Array.isArray(s.uses))
/** The Methodology's table, "Methods and when each applies" (the binding's `when`). */
const whenOf = (v: V) => json<[string, string][]>(v, 'when', []).filter(r => Array.isArray(r) && r.length === 2)
// Sample material for the gallery's fixtures, from Central's own SKILL.md files.
const SAMPLE_PATHS: Record<string, readonly Step[]> = {
  'documentation-reconciliation': [
    {step: 'changed source', uses: []}, {step: 'discovery', uses: ['knowledge-navigation']},
    {step: 'authoring', uses: ['vision-authoring', 'design-authoring', 'architecture-authoring']},
    {step: 'reconcile', uses: ['capability-matrices']}, {step: 'verify', uses: ['verification']}, {step: 'Return', uses: []},
  ],
}
const SAMPLE_WHEN: Record<string, readonly [string, string][]> = {
  'docs-methodology': [
    ['product-development', 'New product meaning must travel from ground to code.'],
    ['ui-development', 'The change is chiefly an experienced surface.'],
    ['architecture-development', 'The change is chiefly structure.'],
    ['evidence-led-repair', 'Behaviour contradicts a documented determination.'],
    ['documentation-reconciliation', 'A source changed and its documents must follow.'],
    ['reverse-recovery', 'The documents are missing or thin.'],
    ['experimental-development', 'A bounded question is best answered by building.'],
  ],
}
const formOf = (v: V, id: string) => members(v).find(m => m.id === id)

function MarkAndLadder({v, w, h, tall}: {v: V; w: number; h: number; tall: boolean}) {
  if (!known(v)) return <Display w={w} h={h} label="Member" does="No reading of the member yet." corner={NONE}>
    <text x={w / 2} y={h / 2} className="dp-ink-dim" textAnchor="middle">No reading of the member</text>
  </Display>
  const m = standing(v), state = markState(m, wanted(v))
  return <Display w={w} h={h} label={FORM_NAME[m.form]} does={`${FORM_ASKS[m.form]} The ticks are its evidence in this session, carried to verified.`} corner={m.rev}>
    <foreignObject x={0} y={0} width={w} height={h}>
      <div className="ref-member" data-tall={tall ? 'true' : undefined}>
        <div className="ref-member-mark" data-state={state}>
          <WoodMark kind={m.form} size={tall ? 52 : 56} state={state} set={marks(v)} title={FORM_NAME[m.form]} />
          <span>{FORM_NAME[m.form]}</span>
          {!tall && <small>{FORM_ASKS[m.form]}</small>}
        </div>
        <Ladder rungs={m.rungs} labels={RUNGS} size={tall ? 'tall' : 'row'} label={m.name} />
      </div>
    </foreignObject>
  </Display>
}

/** Trust: an unseen revision waits for your review; recording it is AIKit's trust record, asked first. */
function Trust({p}: {p: ViewProps}) {
  const m = member(p.v)
  if (!known(p.v)) return <Readout label="trust" does="No reading of the member yet." value={undefined} />
  if (m.withheld?.fix !== 'review' || reviewed(p.v)) return <Readout label="trust" does="The revision in use has been reviewed." value={reviewed(p.v) ? `${m.rev} reviewed` : 'trusted'} tone="green" />
  if (p.v.reviewAsk === true) return <div className="ref-pair">
    <Action {...st(p, 'reviewed')} hold label="Trust" does={`Record that you reviewed ${m.rev}. AIKit delivers it again.`} onPress={() => { p.set('reviewed', true); p.set('reviewAsk', undefined) }} />
    <Action label="Cancel" does="Leave the revision unseen." onPress={() => p.set('reviewAsk', undefined)} />
  </div>
  return <Action {...st(p, 'reviewed')} label="Review" does={m.withheld.why} onPress={() => p.set('reviewAsk', true)} pending />
}

/** What the form does: a Method runs and proves; a Methodology says whether it must be instantiated; a Skill shows its reach. */
function FormControls({p, primary}: {p: ViewProps; primary?: boolean}) {
  const m = standing(p.v)
  if (m.form === 'method') {
    const run = strOf(p.v, 'run') ?? 'idle'
    const runControl = run === 'asked'
        ? <div className="ref-pair">
            <Action {...st(p, 'run')} hold label="Run" does="Preflight passed. Run the Method once, with a receipt." onPress={() => p.set('run', 'ran')} />
            <Action label="Cancel" does="Do not run it." onPress={() => p.set('run', 'idle')} />
          </div>
        : <Action label="Run…" does="Preflight first: a missing condition refuses the run before any effect, and names itself." onPress={m.rungs[2] ? () => p.set('run', 'asked') : undefined}
            disabled={st(p, 'run').disabled ?? (m.rungs[2] ? undefined : 'Not available: it cannot run.')} />
    if (primary) return runControl
    return <>
      {runControl}
      <Action label="Prove" does="Verify the last run's receipt. A run that did not verify is refused." onPress={run === 'ran' ? () => p.set('proved', true) : undefined}
        disabled={st(p, 'proved').disabled ?? (run === 'ran' ? undefined : 'No run to prove yet.')} />
      <Readout label="last run" does="The receipt of the last run." value={run === 'ran' ? 'receipt' : '—'} />
      <Readout label="proved" does="Whether an independent check passed." value={p.v.proved === true ? 'yes' : '—'} tone={p.v.proved === true ? 'green' : undefined} />
    </>
  }
  if (m.form === 'methodology' && primary) return <Readout label="instantiate" does="For the act in hand: does this Methodology need to be instantiated, or does the invoked Skill carry enough?" value={strOf(p.v, 'instantiate')} tone="accent" />
  if (m.form === 'skill' && primary) return <Readout label="projected" does="Harness trees it is projected into in this context." value={strOf(p.v, 'reach')} />
  if (m.form === 'methodology') return <>
    <Readout label="field" does="The field this practice orients." value={strOf(p.v, 'field')} />
    <Readout label="methods" does="The Methods it points at." value={has(p.v, 'when') ? whenOf(p.v).length : undefined} />
    <Readout label="instantiate" does="For the act in hand: does this Methodology need to be instantiated, or does the invoked Skill carry enough? AIKit answers per act." value={strOf(p.v, 'instantiate')} tone="accent" />
  </>
  return <>
    <Readout label="projected" does="Harness trees it is projected into in this context." value={strOf(p.v, 'reach')} />
    <Readout label="carried by" does="Sets that carry it." value={strOf(p.v, 'carriedBy')} />
  </>
}

/** The Method's path: each step a node, the members it uses as marks beneath; dashed, because a step can be skipped. */
function PathDisplay({v, w, h}: {v: V; w: number; h: number}) {
  const path = has(v, 'path') ? pathOf(v) : undefined
  if (!path) return <Display w={w} h={h} label="Composes"><text x={8} y={20} className="dp-ink-dim">This Method names its path in its text.</text></Display>
  const x = (i: number) => 40 + i * (w - 80) / (path.length - 1), y = 40
  return <Display w={w} h={h} label="Composes" does="The path this Method composes, from claim to Return. A step whose layer is not touched is skipped.">
    <path d={`M${x(0)} ${y}H${x(path.length - 1)}`} className="dp-faint" strokeDasharray="3 3" />
    {path.map((s, i) => <g key={s.step}>
      <circle cx={x(i)} cy={y} r={4.5} className={i === 0 || i === path.length - 1 ? 'dp-curve-on' : 'dp-curve'} fill="var(--dp-well)" />
      <text x={x(i)} y={y - 11} className="dp-axis" textAnchor="middle">{s.step}</text>
      {s.uses.map((use, k) => {
        const used = formOf(v, use)
        return used ? <foreignObject key={use} x={x(i) - 7} y={y + 12 + k * 18} width={14} height={14}>
          <span data-i={`${use}|${FORM_NAME[used.form]} this step uses.`} style={{display: 'block', color: 'var(--text)'}}>
            <WoodMark kind={used.form} size={14} state={markState(used)} set={marks(v)} />
          </span>
        </foreignObject> : null
      })}
    </g>)}
  </Display>
}

/** The Methodology's table: which Method applies when, each with its mark and state. */
function WhenTable({v}: {v: V}) {
  const rows = whenOf(v)
  return <ul className="ref-when">
    {rows.map(([id, when]) => {
      const m = formOf(v, id)
      return <li key={id} data-i={`${id}|Select when: ${when}`}>
        {m && <WoodMark kind="method" size={14} state={markState(m)} set={marks(v)} />}<b>{id}</b><span>{when}</span>
      </li>
    })}
  </ul>
}

// ------------------------------------------------------------------------------------------------ why it stands so, and its history

interface Why {readonly state?: string; readonly trust?: string; readonly maturity?: string; readonly selectedBy: readonly string[]; readonly requiredBy: readonly string[]
  readonly dependencies: readonly string[]; readonly projection: readonly string[]; readonly unavailable?: string}
interface Ground {readonly scope: string; readonly path?: string; readonly provenance?: string; readonly standing: 'active' | 'retired'; readonly retirement?: {readonly by?: string; readonly at?: string; readonly why?: string}}
interface Event {readonly kind: string; readonly at?: string; readonly summary: string; readonly recoverability?: string}
const isRec = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const txt = (x: unknown) => (typeof x === 'string' && x !== '' ? x : undefined)
const words = (x: unknown) => (Array.isArray(x) ? x.filter((y): y is string => typeof y === 'string' && y !== '') : [])
function whyOf(v: V): Why | undefined {
  const raw = json<unknown>(v, 'why', undefined)
  if (!isRec(raw)) return undefined
  return {state: txt(raw.state), trust: txt(raw.trust), maturity: txt(raw.maturity), selectedBy: words(raw.selectedBy), requiredBy: words(raw.requiredBy),
    dependencies: words(raw.dependencies), projection: words(raw.projection), unavailable: txt(raw.unavailable)}
}
/** Central's ground row for the member: undefined when not read, null when Central's ground does not hold it. */
function groundOf(v: V): Ground | null | undefined {
  if (!has(v, 'ground')) return undefined
  const raw = json<unknown>(v, 'ground', undefined)
  if (raw === null) return null
  if (!isRec(raw) || !txt(raw.scope) || (raw.standing !== 'active' && raw.standing !== 'retired')) return undefined
  const r = isRec(raw.retirement) ? {by: txt(raw.retirement.by), at: txt(raw.retirement.at), why: txt(raw.retirement.why)} : undefined
  return {scope: raw.scope as string, path: txt(raw.path), provenance: txt(raw.provenance), standing: raw.standing, retirement: r}
}
function historyOf(v: V): Event[] | undefined {
  if (!has(v, 'history')) return undefined
  const raw = json<unknown>(v, 'history', [])
  return Array.isArray(raw) ? raw.flatMap((x): Event[] => (isRec(x) && txt(x.kind) && txt(x.summary) ? [{kind: x.kind as string, at: txt(x.at), summary: x.summary as string, recoverability: txt(x.recoverability)}] : [])) : []
}
const SCOPE_WORD: Readonly<Record<string, string>> = {'control-user': 'your ground', 'control-machine': 'this machine', 'projectcentral-user': 'a project\'s ground'}
const cut = (x: string, k: number) => (x.length > k ? `${x.slice(0, k - 1)}…` : x)

/** Why the member stands as it does: what selects it at the left, the member in the middle, the harnesses it is projected into at the right;
 * what needs it above, what it needs below. */
function WhyWell({v, w, h}: {v: V; w: number; h: number}) {
  const why = whyOf(v)
  if (!why) return <Display w={w} h={h} label="Why" corner={NONE}><text x={w / 2} y={h / 2} className="dp-ink-dim" textAnchor="middle">No reading of why</text></Display>
  const cx = w / 2, cy = h / 2 + 2, col = (list: readonly string[], left: boolean) => list.slice(0, 5).map((s, i, all) => {
    const y = cy + (i - (all.length - 1) / 2) * 15, dot = left ? 66 : w - 66
    return <g key={`${left}:${s}`} data-i={`${s}|${left ? 'Selects the member.' : 'A harness the member is projected into.'}`}>
      <path d={`M${dot} ${y}L${left ? cx - 8 : cx + 8} ${cy}`} stroke="var(--dp-value)" strokeWidth={1} opacity={.55} />
      <circle cx={dot} cy={y} r={2.6} fill="var(--dp-value)" />
      <text x={left ? 6 : w - 6} y={y + 3} className="dp-ink-dim" textAnchor={left ? 'start' : 'end'}>{cut(s, 10)}</text>
    </g>
  })
  const stack = (list: readonly string[], y: number, word: string) => list.length > 0 && <g data-i={`${word}|${list.join(', ')}`}>
    <path d={`M${cx} ${cy + (y < cy ? -9 : 9)}V${y + (y < cy ? 4 : -9)}`} stroke="var(--text-faint)" strokeDasharray="2 2" />
    <text x={cx} y={y} className="dp-axis" textAnchor="middle">{word} · {cut(list.join(', '), 26)}</text>
  </g>
  const on = why.state === 'active'
  return <Display w={w} h={h} label="Why" corner={why.state ?? NONE}
    does="What selects the member at the left, the harnesses it is projected into at the right. Above: what needs it. Below: what it needs.">
    {col(why.selectedBy.map(s => s.replace(/^enabled by |^carried by /, '')), true)}
    {col(why.projection, false)}
    {stack(why.requiredBy, 12, 'needed by')}
    {stack(why.dependencies, h - 5, 'needs')}
    <circle cx={cx} cy={cy} r={8} fill={on ? 'var(--dp-value)' : 'var(--dp-well)'} stroke={on ? 'var(--dp-value)' : 'var(--text-faint)'} strokeWidth={1.4} />
    {why.unavailable && <text x={cx} y={cy + 24} className="dp-ink-dim" textAnchor="middle" style={{fill: 'var(--stall)'}}>{cut(why.unavailable, 30)}</text>}
  </Display>
}

function whyRows(v: V): RowItem[] {
  const why = whyOf(v), g = groundOf(v)
  if (!why) return [{id: 'none', name: 'No reading of why', light: 'unknown'}]
  const line = (id: string, name: string, list: readonly string[], none: string): RowItem[] => (list.length ? list.map((x, i) => ({id: `${id}:${i}`, name: x, light: 'lit' as LightState, tone: 'value' as const, note: name}))
    : [{id, name: none, light: 'dark', note: name}])
  return [
    ...line('sel', 'selects it', why.selectedBy, 'Nothing selects it'),
    ...line('proj', 'projected', why.projection, 'Projected nowhere'),
    ...line('req', 'needs it', why.requiredBy, 'Nothing needs it'),
    ...line('dep', 'it needs', why.dependencies, 'It needs nothing'),
    ...(g ? [{id: 'ground', name: `${SCOPE_WORD[g.scope] ?? g.scope}${g.path ? ` · ${g.path}` : ''}`, light: (g.standing === 'active' ? 'lit' : 'dark') as LightState, tone: 'value' as const, note: g.standing,
      why: g.retirement?.why}] : []),
  ]
}

/** Retire and Restore: Central's standing for a member its ground holds. Retiring keeps the files; the member stops being projected. */
function GroundActs({p}: {p: ViewProps}) {
  const g = groundOf(p.v), m = member(p.v), reason = strOf(p.v, 'retireReason') ?? ''
  if (g === undefined) return <Readout label="ground" does="Whether Central's ground holds the member, and its standing there." value={undefined} />
  if (g === null) return <>
    <Readout label="ground" does="Central's ground does not hold this member: it comes from a product's or a package's skills. Retire it where it is written." value="not Central's" />
    <Action label="Retire" does="Retire the member in Central's ground." disabled="Central's ground does not hold this member. Retire it where it is written." />
  </>
  if (g.standing === 'retired') return <>
    <Readout label="retired" does={`Retired by ${g.retirement?.by ?? NONE}: ${g.retirement?.why ?? NONE}`} value={g.retirement?.at} tone="stall" />
    {p.v.restoreAsk === true
      ? <div className="ref-pair">
          <Action {...st(p, 'restore')} hold label="Restore" does="Return the member to active standing. AIKit projects it again at the next apply." onPress={() => { p.set('restore', JSON.stringify({scope: g.scope, name: m.id})); p.set('restoreAsk', undefined) }} />
          <Action label="Cancel" does="Leave it retired." onPress={() => p.set('restoreAsk', undefined)} />
        </div>
      : <Action {...st(p, 'restore')} label="Restore…" does="Return the member to active standing. You confirm it first." onPress={() => p.set('restoreAsk', true)} />}
  </>
  return <>
    <TextField {...st(p, 'retireReason')} label="Reason" wide does="Why you retire it. Central records the reason, who and when." value={reason} placeholder="Why" onChange={x => p.set('retireReason', x)} />
    {p.v.retireAsk === true
      ? <div className="ref-pair">
          <Action {...st(p, 'retire')} hold label="Retire" does="Retire the member. Its files stay; it is no longer projected. Restore brings it back."
            onPress={() => { p.set('retire', JSON.stringify({scope: g.scope, name: m.id, retirement_reason: reason.trim()})); p.set('retireAsk', undefined) }} />
          <Action label="Cancel" does="Keep it active." onPress={() => p.set('retireAsk', undefined)} />
        </div>
      : <Action {...st(p, 'retire')} label="Retire…" does="Retire the member in Central's ground. You give a reason and confirm it first." onPress={reason.trim() ? () => p.set('retireAsk', true) : undefined}
          disabled={st(p, 'retire').disabled ?? (reason.trim() ? undefined : 'Give a reason first.')} />}
  </>
}

function WhyBands({p}: {p: ViewProps}) {
  const why = whyOf(p.v), g = groundOf(p.v)
  return <>
    <Band>
      <Section width={196}><WhyWell v={p.v} w={184} h={146} /></Section>
      <Section label="Standing" width={100}>
        <Readout label="state" does="Whether AIKit includes the member in the context now." value={why?.state} tone={why?.state === 'active' ? 'green' : undefined} />
        <Readout label="trust" does="Whether the revision in use has been reviewed." value={why?.trust} tone={why?.trust === 'unseen' ? 'stall' : undefined} />
        <Readout label="maturity" does="The maturity its author declares." value={why?.maturity} />
      </Section>
      <Section label="Ground" grow><GroundActs p={p} /></Section>
    </Band>
    <Band>
      <Section grow><Rows label={g ? `Why · in ${SCOPE_WORD[g.scope] ?? g.scope}, ${g.standing}` : 'Why'} does="What selects the member, where it is projected, what needs it, what it needs, and its standing in Central's ground."
        items={whyRows(p.v)} size={14} columns={2} /></Section>
    </Band>
  </>
}

const KIND_LANES = ['generation', 'trust', 'run', 'procedure', 'bypass', 'failure'] as const
const laneOf = (kind: string) => { const i = KIND_LANES.indexOf(kind as (typeof KIND_LANES)[number]); return i < 0 ? 0 : i }

/** The history: a lane for each kind of change, oldest at the left; the chosen change ringed. A failure is orange. */
function HistoryWell({v, w, h, chosen}: {v: V; w: number; h: number; chosen?: number}) {
  const all = historyOf(v)
  if (!all) return <Display w={w} h={h} label="History" corner={NONE}><text x={w / 2} y={h / 2} className="dp-ink-dim" textAnchor="middle">No reading of the history</text></Display>
  if (!all.length) return <Display w={w} h={h} label="History" corner="none"><text x={w / 2} y={h / 2} className="dp-ink-dim" textAnchor="middle">Nothing recorded yet</text></Display>
  const x0 = 64, x1 = w - 10, top = 22, lane = (h - top - 16) / KIND_LANES.length, xAt = (i: number) => (all.length === 1 ? (x0 + x1) / 2 : x0 + (i * (x1 - x0)) / (all.length - 1))
  return <Display w={w} h={h} label="History" corner={`${all.length} changes`} does="A lane for each kind of change, the oldest at the left. Orange: a failure. Point at a mark to read the change.">
    {KIND_LANES.map((k, i) => <g key={k}>
      <text x={6} y={top + i * lane + 3} className="dp-axis">{k}</text>
      <path d={`M${x0 - 4} ${top + i * lane}H${x1}`} className="dp-grid" />
    </g>)}
    {all.map((e, i) => { const y = top + laneOf(e.kind) * lane, x = xAt(i); return <g key={i} data-i={`${e.kind} · ${e.at ?? NONE}|${e.summary}`}>
      <rect x={x - 2} y={y - 4} width={4} height={8} fill={e.kind === 'failure' ? 'var(--stall)' : 'var(--dp-value)'} opacity={e.recoverability === 'undoable' ? 1 : .7} />
      {i === chosen && <circle cx={x} cy={y} r={6.5} fill="none" stroke="var(--dp-on)" strokeWidth={1.2} />}
    </g> })}
    <text x={x0} y={h - 4} className="dp-axis">{all[0]!.at ?? NONE}</text><text x={x1} y={h - 4} className="dp-axis" textAnchor="end">{all[all.length - 1]!.at ?? NONE}</text>
  </Display>
}

function HistoryBands({p}: {p: ViewProps}) {
  const all = historyOf(p.v), [chosen, setChosen] = useState<number | undefined>(undefined), [page, setPage] = useState(0)
  const at = chosen ?? (all?.length ? all.length - 1 : undefined), e = at === undefined ? undefined : all?.[at]
  const items: RowItem[] = !all ? [{id: 'none', name: 'No reading of the history', light: 'unknown'}] : !all.length ? [{id: 'none', name: 'Nothing recorded yet', light: 'dark'}]
    : [...all].map((x, i) => ({id: String(i), name: x.summary, light: 'lit' as LightState, tone: x.kind === 'failure' ? 'stall' as const : 'value' as const, note: `${x.kind} · ${x.at ?? NONE}`})).reverse()
  return <>
    <Band>
      <Section width={296}><HistoryWell v={p.v} w={284} h={146} chosen={at} /></Section>
      <Section label="Change" grow>
        <Readout label="kind" does="What kind of change it was." value={e?.kind} tone={e?.kind === 'failure' ? 'stall' : 'value'} />
        <Readout label="when" does="When it happened." value={e?.at} />
        <Readout label="recovery" does="Inspect only: it is a record. Undoable: Procedures on the Skillset rack can take it back." value={e?.recoverability} />
      </Section>
    </Band>
    <Band>
      <Section grow><Rows label={all ? `History · ${all.length}, newest first` : 'History'} does="Every recorded change to the member, newest first. Select one to read it above."
        items={items} size={7} page={page} onPage={setPage} selected={at === undefined ? undefined : String(at)} onSelect={id => { const i = Number(id); if (Number.isFinite(i)) setChosen(i) }} /></Section>
    </Band>
  </>
}

type PageId = 'member' | 'why' | 'history'
const PAGES: readonly {id: PageId; label: string}[] = [{id: 'member', label: 'Member'}, {id: 'why', label: 'Why'}, {id: 'history', label: 'History'}]
const pageOf = (p: ViewProps): PageId => (PAGES.some(x => x.id === p.page) ? p.page as PageId : 'member')

// The light is the member's availability as AIKit reports it; hollow before the member's reading arrives.
const light = (v: V) => (!known(v) ? 'unknown' : markState(standing(v), wanted(v)) === 'whole' ? 'lit' : 'dark') as LightState
const head = (v: V) => <WoodMark kind={member(v).form} size={14} state={known(v) ? markState(standing(v), wanted(v)) : 'outline'} set={marks(v)} />
const enabled = (p: ViewProps) => <Toggle label="Enabled" does="Your request, through the profile in use. Turning it on grants no trust and loads nothing." on={wanted(p.v)} unknown={!known(p.v)} {...st(p, 'requested')} onChange={x => p.set('requested', x)} />

/** Full: the member's text, then its Why and its History as tabs. */
function MemberFull({p}: {p: ViewProps}) {
  const page = pageOf(p), m = standing(p.v), why = whyOf(p.v), g = groundOf(p.v), events = historyOf(p.v)
  return <div className="ref-pane-body">
    <div className="ref-pane-tabs" role="tablist" aria-label="Pages">
      {PAGES.map(x => <button key={x.id} type="button" role="tab" aria-selected={x.id === page} onClick={() => p.setPage(x.id)}>{x.id === 'member' ? 'Text' : x.label}</button>)}
    </div>
    <div className="ref-doc">
      {page === 'why' ? <>
        <h3>Why {m.name} stands so <small>{why ? `${why.state ?? NONE} · ${why.trust ?? NONE} · ${why.maturity ?? NONE}` : 'no reading'}</small></h3>
        {!why ? <p className="ref-doc-lead">No reading of why.</p> : <ol className="ref-doc-list">
          {([['Selected by', why.selectedBy, 'Nothing selects it.'], ['Projected into', why.projection, 'It is projected nowhere.'], ['Needed by', why.requiredBy, 'Nothing needs it.'],
            ['Needs', why.dependencies, 'It needs nothing.']] as const).map(([title, list, none]) => <li key={title}>
            <span className="dp-lamp" data-light={list.length ? 'lit' : 'dark'} data-tone="value" /><b>{title}</b><span className="ref-doc-rev">{list.length}</span>
            <p>{list.length ? list.join(' · ') : none}</p>
          </li>)}
        </ol>}
        {why?.unavailable && <p className="ref-doc-lead">{why.unavailable}</p>}
        <section className="ref-doc-kind"><h4>In Central's ground</h4>
          <p className="ref-doc-lead">{g === undefined ? 'No reading of Central\'s ground.' : g === null ? 'Central\'s ground does not hold this member: it comes from a product\'s or a package\'s skills.'
            : g.standing === 'retired' ? `Retired in ${SCOPE_WORD[g.scope] ?? g.scope} by ${g.retirement?.by ?? NONE} on ${g.retirement?.at ?? NONE}: ${g.retirement?.why ?? NONE}`
            : `Active in ${SCOPE_WORD[g.scope] ?? g.scope}, ${g.path ?? NONE}, ${g.provenance ?? NONE}.`}</p>
        </section>
      </> : page === 'history' ? <>
        <h3>History of {m.name} <small>{events ? `${events.length} changes` : 'no reading'}</small></h3>
        {!events ? <p className="ref-doc-lead">No reading of the history.</p> : !events.length ? <p className="ref-doc-lead">Nothing recorded yet.</p>
          : <ol className="ref-doc-list">{[...events].reverse().map((e, i) => <li key={i}>
            <span className="dp-lamp" data-light="lit" data-tone={e.kind === 'failure' ? 'stall' : 'value'} /><b>{e.kind}</b><span className="ref-doc-rev">{e.at ?? NONE}</span>
            <span className="ref-doc-standing">{e.recoverability ?? NONE}</span><p>{e.summary}</p>
          </li>)}</ol>}
      </> : <>
        <h3><WoodMark kind={m.form} size={28} state={markState(m, wanted(p.v))} set={marks(p.v)} /> {m.name} <small>{FORM_NAME[m.form]} · {m.rev}</small></h3>
        <p className="ref-doc-lead">{m.form === 'skill' ? '' : `${m.form.toUpperCase()}: `}{m.says}</p>
        {m.form === 'method' && pathOf(p.v).length > 0 && <ol className="ref-doc-steps">{pathOf(p.v).map(s => <li key={s.step}><b>{s.step}</b>{s.uses.length ? ` — ${s.uses.join(', ')}` : ''}</li>)}</ol>}
        {m.form === 'methodology' && <WhenTable v={p.v} />}
        <p className="ref-doc-standing"><Ladder rungs={m.rungs} labels={RUNGS} label={m.name} /> {m.withheld ? m.withheld.why : 'Available in this session.'}</p>
      </>}
    </div>
  </div>
}

// Sample readings for the fixtures: `aikit explain` and `aikit history` read the way the CLI reports them on this machine, 21 Oct.
const WHY = {state: 'active', trust: 'trusted', maturity: 'stable', selectedBy: ['carried by central:documentation', 'enabled by project profile'],
  requiredBy: ['docs-methodology'], dependencies: ['knowledge-navigation', 'capability-matrices', 'verification'], projection: ['claude-code', 'codex', 'pi']}
const HISTORY = [
  {kind: 'trust', at: '2 Oct 09:14', summary: 'r6 reviewed and trusted', recoverability: 'inspect-only'},
  {kind: 'generation', at: '2 Oct 09:15', summary: 'Projected into claude-code, codex and pi', recoverability: 'inspect-only'},
  {kind: 'run', at: '9 Oct 16:40', summary: 'Ran on O-I docs/dlw: verified', recoverability: 'inspect-only'},
  {kind: 'procedure', at: '14 Oct 09:41', summary: 'Profile fork baseline → baseline-dlw changed its selection', recoverability: 'undoable'},
  {kind: 'failure', at: '14 Oct 11:02', summary: 'Preflight refused: no capability matrix in Work/face-rig', recoverability: 'inspect-only'},
  {kind: 'run', at: '20 Oct 18:22', summary: 'Ran on Archetypal-Earth: verified', recoverability: 'inspect-only'},
  {kind: 'generation', at: '21 Oct 08:05', summary: 'Projected into claude-code, codex and pi', recoverability: 'inspect-only'},
]
// Two members of Control/user/skills, beside the documentation set: one active, one retired (control.skills.inspect, 21 Oct).
const WITH_GROUND: readonly Member[] = [...DOCUMENTATION,
  {id: 'central-ledger', name: 'central-ledger', form: 'skill', rev: 'r11', rungs: [true, true, true, true, true, true, true, null, null, null],
    says: 'Write a NOW return, handoff, note or learning to a root or Project working field, or decide that no record is needed.'},
  {id: 'brainstorming', name: 'brainstorming', form: 'skill', rev: 'r3', rungs: [true, true, false, false, false, null, null, null, null, null],
    withheld: {why: 'Retired in your ground: it is not projected.'}, says: 'Explore intent, requirements and design before creative work.'},
]
const WHY_LEDGER = {state: 'active', trust: 'trusted', maturity: 'stable', selectedBy: ['enabled by global profile'], requiredBy: ['central-session-handoff', 'central-day-close'],
  dependencies: [], projection: ['claude-code', 'codex', 'pi', 'hermes']}
const HISTORY_LEDGER = [
  {kind: 'trust', at: '28 Sep 10:02', summary: 'r11 reviewed and trusted', recoverability: 'inspect-only'},
  {kind: 'generation', at: '28 Sep 10:02', summary: 'Projected into claude-code, codex, pi and hermes', recoverability: 'inspect-only'},
  {kind: 'run', at: '20 Oct 23:10', summary: 'Wrote a NOW handoff for the DLW lane', recoverability: 'inspect-only'},
]
const HISTORY_RETIRED = [
  {kind: 'procedure', at: '25 Aug 12:30', summary: 'Adopted from ~/.claude/skills into skill/claude/', recoverability: 'undoable'},
  {kind: 'generation', at: '6 Sep 14:11', summary: 'Retired in Control/user/skills: no longer projected', recoverability: 'inspect-only'},
]

export const memberDevice: DesignedDevice = {
  id: 'ai-kit:skill-device',
  title: 'Skill · Method · Methodology',
  kind: 'effect',
  firstPage: 'member',
  defaults: {member: 'documentation-reconciliation', marks: 'blade', run: 'idle',
    // The owner's material, as the binding supplies it: the rack's members, this member's path or table, and its readings.
    members: JSON.stringify(DOCUMENTATION), path: JSON.stringify(SAMPLE_PATHS['documentation-reconciliation']), carriedBy: '2 sets', reach: 'Claude · Pi',
    // Why and History: `aikit explain` and `aikit history` for the member, and Central's ground (null: Central's ground does not hold it).
    why: JSON.stringify(WHY), ground: 'null', history: JSON.stringify(HISTORY), retireReason: ''},
  fixtures: {
    Method: {member: 'documentation-reconciliation'},
    Methodology: {member: 'docs-methodology', path: undefined, when: JSON.stringify(SAMPLE_WHEN['docs-methodology']), field: 'documentation', instantiate: 'needed'},
    Skill: {member: 'vision-authoring', path: undefined},
    'Unseen revision': {member: 'reverse-recovery', path: undefined, why: JSON.stringify({...WHY, state: 'inactive', trust: 'unseen', projection: [], unavailable: 'r4 is unseen: review it to deliver it'})},
    'In your ground': {members: JSON.stringify(WITH_GROUND), member: 'central-ledger', path: undefined, why: JSON.stringify(WHY_LEDGER), history: JSON.stringify(HISTORY_LEDGER),
      ground: JSON.stringify({scope: 'control-user', path: 'Control/user/skills/central-ledger', provenance: 'human-authored', standing: 'active'})},
    Retired: {members: JSON.stringify(WITH_GROUND), member: 'brainstorming', path: undefined, why: JSON.stringify({...WHY_LEDGER, state: 'inactive', selectedBy: [], projection: [], requiredBy: [], dependencies: []}),
      history: JSON.stringify(HISTORY_RETIRED), ground: JSON.stringify({scope: 'control-user', path: 'Control/user/skills/brainstorming', provenance: 'adopted', standing: 'retired',
        retirement: {by: 'human-owner-via-codex', at: '6 Sep 2026', why: 'Owner-directed migration: restore archived superpowers to Control ground as retired; do not project.'}})},
    'The pen': {member: 'documentation-reconciliation', marks: 'pen'},
    'No readings': {member: undefined, members: undefined, path: undefined, when: undefined, run: undefined, carriedBy: undefined, reach: undefined, why: undefined, ground: undefined, history: undefined, retireReason: undefined},
  },

  folded: p => <Folded title={member(p.v).name} light={light(p.v)} readings={[formName(p.v), member(p.v).rev]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title={member(p.v).name} mark={head(p.v)} view="compact" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}><MarkAndLadder v={p.v} w={140} h={146} tall={false} /></Section>
    <Section label={formName(p.v)} width={112}>
      {enabled(p)}
      <Trust p={p} />
      <FormControls p={p} primary />
    </Section>
  </Panel>,

  whole: p => {
    const page = pageOf(p)
    return <Panel title={member(p.v).name} mark={head(p.v)} view="whole" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full}
      pages={PAGES.map(x => ({id: x.id, label: x.label, light: x.id === 'why' && groundOf(p.v) ? (groundOf(p.v)!.standing === 'retired' ? 'dark' as const : 'lit' as const) : undefined}))} page={page} onPage={p.setPage}>
      {page === 'why' ? <WhyBands p={p} /> : page === 'history' ? <HistoryBands p={p} /> : <>
        <Band>
          <Section width={196}><MarkAndLadder v={p.v} w={184} h={146} tall /></Section>
          <Section label="Standing" width={100}>
            {enabled(p)}
            <Trust p={p} />
            <Readout label="revision" does="The revision in use." value={member(p.v).rev} copy={member(p.v).rev} />
          </Section>
          <Section label={member(p.v).form === 'method' ? 'Run' : member(p.v).form === 'methodology' ? 'Orients' : 'Reach'} grow><FormControls p={p} /></Section>
        </Band>
        <Band>
          <Section label={member(p.v).form === 'method' ? 'Composes' : member(p.v).form === 'methodology' ? 'Which Method, when' : 'What it is for'} grow>
            {member(p.v).form === 'method' ? <PathDisplay v={p.v} w={372} h={130} />
              : member(p.v).form === 'methodology' ? <WhenTable v={p.v} />
                : <p className="ref-says">{member(p.v).says}</p>}
          </Section>
        </Band>
      </>}
    </Panel>
  },

  full: p => <MemberFull p={p} />,

  widget: p => <Tile title={member(p.v).name} light={light(p.v)} onFull={p.nav.full}>
    <div className="ref-member-tile">
      <WoodMark kind={member(p.v).form} size={44} state={markState(standing(p.v), wanted(p.v))} set={marks(p.v)} />
      <Ladder rungs={standing(p.v).rungs} labels={RUNGS} label={member(p.v).name} />
      {member(p.v).form === 'method' ? <Action label="Run…" does="Preflight, then run once." onPress={() => p.set('run', 'asked')} />
        : <Readout label={formName(p.v).toLowerCase()} value={known(p.v) ? member(p.v).rev : undefined} />}
    </div>
  </Tile>,
}
