// Capture skill (manual §19.10, ai-kit:capture-skill): what you did by hand, turned into a proposal for a new member of a set — most
// often a Method, otherwise a Skill. Live's nearest: Capture MIDI on a device that then offers what it kept. The owner is AIKit's
// capture pipeline (ai-kit crates/aikit-store/src/inbox.rs: normalize → scan → redact-or-quarantine → classify → exact dedup →
// similarity → file) with the transport's Capture as the source of the example. Grounded as follows.
//   Name: the candidate's title (aikit capture TITLE, cli.rs:4781, main.rs:6472) and the id the member is promoted under (aikit promote
//     --id, cli.rs:4791; PromotionEdits, inbox.rs:220).
//   Form: a description that opens with the Method prefix makes a Method, any other a Skill (aikit-core method.rs:26, :189-197);
//     capture classifies by front matter (inbox.rs:664-683) and promote refuses an id of another kind (inbox.rs:482-492).
//   Proposal, Held for, Resembles: the candidate's state ready · quarantined · rejected · promoted (inbox.rs:88-97), its findings (rule,
//     masked preview; scan.rs:79-100) and its ranked neighbours (inbox.rs:155-200), as `aikit capture` returns them (main.rs:6509-6520).
//   Accept writes a draft member (aikit promote, main.rs:6448; Maturity::Draft, inbox.rs:239), into the personal registry (app/mod.rs:3261).
//     A held proposal is never promoted (inbox.rs:466-477). Remove is the inbox's reject (inbox.rs:450). Release scans again and frees the
//     proposal only when no secret remains (inbox.rs:419-448).
//   Scope: the rack's own enable at a scope (ai-kit:skills:skills.capabilities, agent/devices/designBindings.ts:491); promote itself has no scope.
//   SPECIFIED, no code yet: Source and Minutes (the transport's Capture hands over a window of the track's frames and your commands, or a
//     clip's material), and Steps (the track's agent drafts the steps and the text from that example; AIKit's authoring Method directs it).
// The picture is the window on your work: a strip from 60 minutes ago to now on a square-root scale, so the last minutes have room, with
// the window shaded and a tick for each step the device found. Handle 1 sets how far back the window reaches. Below it stands the
// proposal: its kind mark, its name and its state.
import {useState} from 'react'
import {WoodMark} from '../../sdk/marks'
import type {WoodSet, WoodState} from '../../sdk/icons'
import {Action, Band, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, TextField, Tile, ValueBox, type LightState, type RowItem, type Scale, type Tone} from '../../sdk/panel'
import {NONE, boolOf, clampTo, has, json, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'
import {FORM_ASKS, FORM_NAME, type Form} from './practice'
import './ai-kit__capture-skill.css'

type V = ViewProps['v']
type SetFn = ViewProps['set']
type Proposal = 'ready' | 'held' | 'accepted' | 'removed'

// Fixed vocabulary: the choices, the strip's ticks and the proposal's states. None of it is the owner's data.
const SOURCES = [{value: 'minutes', label: 'Last minutes', does: 'The last minutes of your work.'}, {value: 'clip', label: 'A clip', does: 'The clip you selected in Clip view.'}] as const
const FORMS = [{value: 'method', label: 'Method', does: 'A path from claim to return, in steps.'}, {value: 'skill', label: 'Skill', does: 'One capability.'}] as const
const SCOPES = [{value: 'project', label: 'Project', does: 'Every session in this project.'}, {value: 'home', label: 'Home', does: 'Every session on this machine.'}] as const
const WINDOW: Scale = {min: 1, max: 60, step: 1}
const DEFAULT_MINUTES = 10, REACH = 60
const TICKS = [60, 30, 15, 5, 0]
const STATE_LABEL: Record<Proposal, string> = {ready: 'Ready', held: 'Held', accepted: 'Accepted', removed: 'Removed'}
const STATE_TONE: Record<Proposal, Tone | undefined> = {ready: 'accent', held: 'stall', accepted: 'green', removed: undefined}

// ---------------------------------------------------------------- what the owner reports

interface Step {readonly id: string; readonly name: string; readonly at: number; readonly uses: readonly {readonly id: string; readonly form: Form}[]}
interface Finding {readonly rule: string; readonly preview: string; readonly description?: string; readonly step?: string}
interface Likeness {readonly other: string; readonly form?: Form; readonly percentage: number; readonly summary?: string}
interface Beat {readonly at: number; readonly kind: string; readonly text: string; readonly step?: string}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const isForm = (x: unknown): x is Form => x === 'method' || x === 'skill' || x === 'methodology' || x === 'skillset'
const str = (x: unknown): string | undefined => (typeof x === 'string' ? x : undefined)

/** A JSON list the binding reports, each item picked or dropped; undefined when the owner reported none (an empty list is a reading). */
function read<T>(v: V, key: string, pick: (x: Record<string, unknown>) => T | null): T[] | undefined {
  if (!has(v, key)) return undefined
  const raw = json<unknown>(v, key, [])
  return Array.isArray(raw) ? raw.flatMap(x => { const item = isObj(x) ? pick(x) : null; return item ? [item] : [] }) : []
}

/** The steps the device found, oldest first. */
const stepsOf = (v: V): Step[] | undefined => read<Step>(v, 'steps', x => typeof x.id === 'string' && typeof x.name === 'string' && typeof x.at === 'number'
  ? {id: x.id, name: x.name, at: x.at, uses: Array.isArray(x.uses) ? x.uses.flatMap(u => (isObj(u) && typeof u.id === 'string' && isForm(u.form) ? [{id: u.id, form: u.form}] : [])) : []} : null)
  ?.sort((a, b) => b.at - a.at)
const findingsOf = (v: V) => read<Finding>(v, 'findings', x => typeof x.rule === 'string' && typeof x.preview === 'string' ? {rule: x.rule, preview: x.preview, description: str(x.description), step: str(x.step)} : null)
const likenessOf = (v: V) => read<Likeness>(v, 'similar', x => typeof x.other === 'string' && typeof x.percentage === 'number'
  ? {other: x.other, form: isForm(x.form) ? x.form : undefined, percentage: x.percentage, summary: str(x.summary)} : null)
const beatsOf = (v: V) => read<Beat>(v, 'example', x => typeof x.at === 'number' && typeof x.kind === 'string' && typeof x.text === 'string' ? {at: x.at, kind: x.kind, text: x.text, step: str(x.step)} : null)
const clipOf = (v: V) => { const c = json<unknown>(v, 'clip', null); return isObj(c) && typeof c.name === 'string' && typeof c.from === 'number' && typeof c.to === 'number' ? {name: c.name, from: c.from, to: c.to} : undefined }

const formOf = (v: V): Form | undefined => { const f = strOf(v, 'form'); return f === 'method' || f === 'skill' ? f : undefined }
const marks = (v: V) => (strOf(v, 'marks') ?? 'blade') as WoodSet
const leaf = (id: string) => id.split('/').pop() ?? id
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** The window of work the example comes from, in minutes ago: the last minutes, or the span of a clip. */
function windowOf(v: V): {readonly from: number; readonly to: number; readonly label: string} | undefined {
  const source = strOf(v, 'source')
  if (source === 'clip') { const c = clipOf(v); return c ? {from: c.from, to: c.to, label: c.name} : undefined }
  const m = numOf(v, 'minutes')
  return source === 'minutes' && m !== undefined ? {from: m, to: 0, label: `${m} min`} : undefined
}
const inside = (w: ReturnType<typeof windowOf>, s: Step) => w !== undefined && s.at <= w.from && s.at >= w.to
const wanted = (v: V, s: Step) => v[`step:${s.id}`] !== false
/** The steps that stay: asked for, and inside the window. */
const keeps = (v: V): Step[] | undefined => { const all = stepsOf(v), w = windowOf(v); return all && w ? all.filter(s => wanted(v, s) && inside(w, s)) : undefined }
const stepsText = (v: V) => { const k = keeps(v), all = stepsOf(v); return k && all ? `${k.length} of ${all.length}` : undefined }
/** The steps that still carry a finding, so AIKit still holds the proposal. */
const holding = (v: V): Step[] => keeps(v)?.filter(s => findingsOf(v)?.some(f => f.step === s.id)) ?? []
const stuck = (v: V) => (findingsOf(v)?.some(f => f.step === undefined) ?? false) || holding(v).length > 0

/** The proposal as it stands: AIKit's reading, then what you asked (Accept, Remove, Release) until the owner answers. */
function proposal(v: V): Proposal | undefined {
  if (v.remove === true) return 'removed'
  if (v.accept === true) return 'accepted'
  const s = strOf(v, 'proposal')
  const base = s === 'ready' || s === 'held' || s === 'accepted' || s === 'removed' ? s : undefined
  return base === 'held' && v.release === true && !stuck(v) ? 'ready' : base
}
const stateText = (v: V) => { const s = proposal(v); return s ? STATE_LABEL[s] : undefined }
/** A mark held back for a reason you can clear is orange: a held proposal, a draft that waits for your review. */
const woodState = (s: Proposal | undefined): WoodState => (s === 'ready' ? 'whole' : s === 'held' || s === 'accepted' ? 'warn' : 'outline')
const markOf = (v: V, size: number) => { const f = formOf(v); return f ? <WoodMark kind={f} size={size} state={woodState(proposal(v))} set={marks(v)} title={FORM_NAME[f]} /> : undefined }
const captureText = (v: V) => { const r = boolOf(v, 'recording'); return r === undefined ? undefined : r ? 'on' : 'off' }
const light = (p: ViewProps) => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState

// ---------------------------------------------------------------- the picture

/** The window on your work: 60 minutes ago to now, the window shaded, a tick for each step; the proposal beneath. */
function Take({v, set, w}: {v: V; set?: SetFn; w: number}) {
  const x0 = 12, x1 = w - 10, top = 34, bottom = 76
  const X = (m: number) => x1 - Math.sqrt(clampTo(0, REACH, m) / REACH) * (x1 - x0)
  const win = windowOf(v), all = stepsOf(v), f = formOf(v), state = proposal(v), minutes = numOf(v, 'minutes')
  const why = strOf(v, 'source') === undefined ? 'No reading of the source' : strOf(v, 'source') === 'clip' ? 'No clip selected' : 'No reading of the window'
  return <>
    {TICKS.map(t => <g key={t}>
      <line x1={X(t)} x2={X(t)} y1={top} y2={bottom} className="dp-grid" />
      <text x={X(t)} y={bottom + 11} className="dp-axis" textAnchor={t === REACH ? 'start' : t === 0 ? 'end' : 'middle'}>{t === 0 ? 'now' : `−${t}`}</text>
    </g>)}
    <rect x={x0} y={top} width={x1 - x0} height={bottom - top} className="dp-faint" />
    {win && <rect x={X(win.from)} y={top} width={Math.max(0, X(win.to) - X(win.from))} height={bottom - top} className="dp-fill" />}
    {win && all?.map((s, i) => {
      const on = wanted(v, s) && inside(win, s), x = X(s.at)
      return <g key={s.id}>
        <line x1={x} x2={x} y1={top + 4} y2={bottom - 4} className={on ? 'dp-curve-on' : 'dp-faint'} strokeDasharray={on ? undefined : '2 2'} />
        {on && <text x={x} y={top - (i % 2 ? 13 : 5)} className="dp-axis" textAnchor="middle">{i + 1}</text>}
      </g>
    })}
    {(!win || !all) && <text x={(x0 + x1) / 2} y={(top + bottom) / 2 + 3} className="dp-ink-dim" textAnchor="middle">{!win ? why : 'No reading of the steps'}</text>}
    {boolOf(v, 'recording') === true && <g><circle cx={x0 - 2} cy={12} r={2.6} fill="var(--rec)" /><text x={x0 + 5} y={15} className="dp-axis">capture on</text></g>}
    {set && win && strOf(v, 'source') === 'minutes' && minutes !== undefined &&
      <Handle x={X(win.from)} y={(top + bottom) / 2} n={1} shape="ring" label="Window" does="Drag along the strip. It sets how many minutes back the example reaches."
        onDrag={x => set('minutes', clampTo(WINDOW.min, WINDOW.max, Math.round(REACH * Math.pow(clampTo(0, 1, (x1 - x) / (x1 - x0)), 2))))} onReset={() => set('minutes', DEFAULT_MINUTES)} />}
    <line x1={0} x2={w} y1={93} y2={93} className="dp-faint" />
    <foreignObject x={10} y={98} width={44} height={44}>
      <div className="cs-mark" data-i={f ? `${FORM_NAME[f]}|${FORM_ASKS[f]}` : undefined}>{markOf(v, 40)}</div>
    </foreignObject>
    <text x={64} y={109} className="dp-ink">{f ? FORM_NAME[f] : NONE}</text>
    <text x={64} y={122} className="dp-ink-dim">{clip(strOf(v, 'name') ?? NONE, 24)}</text>
    <text x={64} y={135} className="dp-axis">{`${state ? STATE_LABEL[state] : NONE} · ${keeps(v) ? `${keeps(v)!.length} steps` : NONE}`}</text>
  </>
}

// ---------------------------------------------------------------- lists

function Steps({p, size}: {p: ViewProps; size: number}) {
  const [page, setPage] = useState(0)
  const v = p.v, w = windowOf(v), all = stepsOf(v), found = findingsOf(v)
  const items: RowItem[] = (all ?? []).map((s, i) => {
    const want = wanted(v, s), here = w === undefined ? undefined : inside(w, s), finding = found?.find(x => x.step === s.id)
    return {id: s.id, name: `${i + 1} ${s.name}`, request: want, light: here === undefined ? 'unknown' : want && here ? 'lit' : 'dark', tone: finding ? 'stall' : 'accent',
      why: here === false ? 'Outside the window. It does not enter the example.' : finding && want ? `AIKit found ${finding.description ?? 'a possible secret'} here.` : undefined, note: `−${s.at} m`}
  })
  const request = st(p, 'steps').disabled ? undefined : (id: string, on: boolean) => p.set(`step:${id}`, on)
  return <Rows label={all ? `Steps · ${stepsText(v) ?? NONE}` : 'Steps · no reading'} does="The steps found in the example. The square is your request: turn a step off to remove it. The number is the order."
    items={items} onRequest={request} size={size} page={page} onPage={setPage} />
}

function Resembles({v, size}: {v: V; size: number}) {
  const dup = strOf(v, 'duplicate'), like = likenessOf(v)
  const rows = like === undefined && dup === undefined ? undefined
    : [...(dup ? [{other: dup, form: undefined, percentage: 100, summary: 'AIKit already holds this example. It filed no second proposal.'} as Likeness] : []), ...(like ?? [])]
  const items: RowItem[] = (rows ?? []).map(r => ({id: r.other, name: leaf(r.other), light: 'lit', tone: 'value', note: `${r.percentage} %`,
    mark: r.form ? <WoodMark kind={r.form} size={14} set={marks(v)} title={FORM_NAME[r.form]} /> : undefined, does: r.summary ?? `${r.percentage} % of the phrasing is shared.`}))
  return <Rows label={rows ? (rows.length ? 'Resembles' : 'Resembles · none') : 'Resembles · no reading'}
    does="The members that the proposal resembles, and how much phrasing is shared. A close match needs a new revision, not a new member." items={items} size={size} />
}

function HeldFor({v, size}: {v: V; size: number}) {
  const found = findingsOf(v)
  if (proposal(v) !== 'held' || !found?.length) return null
  return <Rows label="Held for" does="AIKit holds the proposal because the example matched a rule for secrets. Turn off the step that holds it, then release."
    items={found.map((f, i) => ({id: `${f.rule}:${i}`, name: f.rule, light: 'lit', tone: 'stall', note: f.step ? `step ${(stepsOf(v)?.findIndex(s => s.id === f.step) ?? -1) + 1}` : undefined,
      does: `${f.description ?? 'A possible secret'}: ${f.preview}.`}))} size={size} />
}

// ---------------------------------------------------------------- decisions

/** Accept asks first; a held proposal offers Release in its place; after the answer it only says what happened. */
function Primary({p, stack}: {p: ViewProps; stack?: boolean}) {
  const v = p.v, state = proposal(v), pair = stack ? 'cs-stack' : 'ref-pair'
  if (state === 'accepted') return <Action label="Accepted" does="AIKit wrote the proposal as a draft member. Review it in the Skillset rack." disabled="Already accepted." />
  if (state === 'removed') return <Action label="Removed" does="The proposal was turned down." disabled="Already removed." />
  if (state === 'held') {
    const hold = holding(v)[0], at = (stepsOf(v)?.findIndex(s => s.id === hold?.id) ?? -1) + 1
    return <Action {...st(p, 'release')} label="Release" does="Scan the example again. AIKit frees the proposal only when no secret remains." onPress={() => p.set('release', true)}
      disabled={st(p, 'release').disabled ?? (stuck(v) ? (hold ? `Step ${at} still holds a possible secret. Turn it off, then release.` : 'AIKit still finds a possible secret in the example.') : undefined)} />
  }
  const refusal = state === undefined ? 'No proposal to accept yet.' : !(strOf(v, 'name') ?? '').trim() ? 'Name the proposal first.' : keeps(v)?.length === 0 ? 'No step is on.' : undefined
  if (v.acceptAsk === true && state === 'ready') return <div className={pair}>
    <Action {...st(p, 'accept')} label="Accept" does="Write the proposal as a draft member. It stays unreviewed until you review it." onPress={() => { p.set('accept', true); p.set('acceptAsk', undefined) }} />
    <Action label="Cancel" does="Keep the proposal as it is." onPress={() => p.set('acceptAsk', undefined)} />
  </div>
  return <Action {...st(p, 'accept')} label="Accept…" does="Write the proposal as a draft member. You confirm first." onPress={() => p.set('acceptAsk', true)} disabled={st(p, 'accept').disabled ?? refusal} />
}

const Remove = ({p}: {p: ViewProps}) => {
  const state = proposal(p.v)
  return <Action {...st(p, 'remove')} label="Remove" does="Turn the proposal down. AIKit keeps it among the removed." onPress={() => p.set('remove', true)}
    disabled={st(p, 'remove').disabled ?? (state === 'ready' || state === 'held' ? undefined : state === undefined ? 'No proposal to remove.' : 'The proposal is already answered.')} />
}

const sourceRadio = (p: ViewProps) => <Radio {...st(p, 'source')} label="Source" does="The part of your work that the skill learns from." value={strOf(p.v, 'source') ?? ''} options={SOURCES} stack onChange={x => p.set('source', x)} />
const formRadio = (p: ViewProps) => <Radio {...st(p, 'form')} label="Form" does="A Method is a path from claim to return. A Skill is one capability." value={strOf(p.v, 'form') ?? ''} options={FORMS} stack onChange={x => p.set('form', x)} />

// ---------------------------------------------------------------- the five views

// Sample material for the gallery's fixtures: one release done by hand, with the commands from Central's release Method.
const SAMPLE_STEPS = [
  {id: 'edit', name: 'Edit the skill', at: 9, uses: []}, {id: 'sync', name: 'Sync and promote', at: 7, uses: []},
  {id: 'apply', name: 'Apply', at: 5, uses: []}, {id: 'found', name: 'Check it is found', at: 3, uses: []},
  {id: 'method', name: 'Check it is a Method', at: 2, uses: [{id: 'skill/personal/central-skill-release', form: 'method'}]},
]
const SAMPLE_BEATS = [
  {at: 9, kind: 'edit', text: 'Control/user/skills/central-skill-release/SKILL.md', step: 'edit'},
  {at: 8, kind: 'say', text: 'Always edit the canonical source, never the projected copy.', step: 'edit'},
  {at: 7, kind: 'command', text: 'aikit source sync personal', step: 'sync'}, {at: 6, kind: 'command', text: 'aikit source promote personal', step: 'sync'},
  {at: 5, kind: 'command', text: 'aikit apply', step: 'apply'}, {at: 3, kind: 'command', text: 'aikit collate | grep central-skill-release', step: 'found'},
  {at: 2, kind: 'command', text: 'aikit method list', step: 'method'},
]
const SAMPLE_SIMILAR = [
  {other: 'skill/personal/central-skill-release', form: 'method', percentage: 64, summary: '64% of the phrasing is shared; 7 line(s) appear only in the capture and 21 only in skill/personal/central-skill-release'},
  {other: 'skill/personal/central-skill-authoring', form: 'method', percentage: 38, summary: '38% of the phrasing is shared; 9 line(s) appear only in the capture and 33 only in skill/personal/central-skill-authoring'},
]
const HELD_STEP = {id: 'push', name: 'Push the branch', at: 1, uses: []}

export const design: DesignedDevice = {
  id: 'ai-kit:capture-skill',
  title: 'Capture skill',
  kind: 'instrument',
  defaults: {light: 'lit', recording: false, source: 'minutes', minutes: DEFAULT_MINUTES, form: 'method', name: 'skill-release', scope: 'project', marks: 'blade', proposal: 'ready',
    clip: JSON.stringify({name: 'Release, take 2', from: 14, to: 4}),
    says: 'Release a changed skill: edit its source, sync and promote it, apply, and check that AIKit finds it as a Method.',
    // The owner's material, as the binding supplies it: the steps found, the example, and what AIKit says of the proposal.
    steps: JSON.stringify(SAMPLE_STEPS), example: JSON.stringify(SAMPLE_BEATS), similar: JSON.stringify(SAMPLE_SIMILAR)},
  fixtures: {
    'A release by hand': {},
    Held: {proposal: 'held', steps: JSON.stringify([...SAMPLE_STEPS, HELD_STEP]),
      example: JSON.stringify([...SAMPLE_BEATS, {at: 1, kind: 'command', text: 'export GITHUB_TOKEN=[redacted]', step: 'push'}]),
      findings: JSON.stringify([{rule: 'github-token', preview: 'ghp_… (40 characters)', description: 'a GitHub access token', step: 'push'}])},
    'No readings': {light: undefined, recording: undefined, source: undefined, minutes: undefined, clip: undefined, form: undefined, name: undefined, scope: undefined, proposal: undefined,
      says: undefined, steps: undefined, example: undefined, similar: undefined},
  },

  folded: p => <Folded title="Capture skill" light={light(p)} readings={[boolOf(p.v, 'recording') ? 'capture on' : keeps(p.v) ? `${keeps(p.v)!.length} steps` : NONE, stateText(p.v) ?? NONE]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Capture skill" mark={markOf(p.v, 14)} view="compact" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={244}><Steps p={p} size={8} /></Section>
    <Section label="Capture" width={92}>
      {sourceRadio(p)}
      {formRadio(p)}
      <Primary p={p} stack />
    </Section>
  </Panel>,

  whole: p => <Panel title="Capture skill" mark={markOf(p.v, 14)} view="whole" light={light(p)} onFold={p.nav.fold} onFull={p.nav.full}>
    <Band>
      <Section width={206}>
        <Display w={194} h={146} label="The window" corner={windowOf(p.v)?.label ?? NONE}
          does="The last minutes of your work, or a clip. The shaded part is the example. An amber line is a step that stays. Drag handle 1 to widen the window.">
          <Take v={p.v} set={st(p, 'minutes').disabled ? undefined : p.set} w={194} />
        </Display>
      </Section>
      <Section label="Example" width={88}>
        {sourceRadio(p)}
        <ValueBox {...st(p, 'minutes')} wide label="Minutes" does="How far back the example reaches. A clip sets its own span." value={numOf(p.v, 'minutes') ?? NaN} def={DEFAULT_MINUTES} scale={WINDOW}
          format={x => `${x} min`} disabled={strOf(p.v, 'source') === 'clip' ? 'A clip sets its own span.' : st(p, 'minutes').disabled} onChange={x => p.set('minutes', x)} />
        <Readout label="capture" does="Whether Capture records now. The transport starts and ends it." value={captureText(p.v)} tone={boolOf(p.v, 'recording') ? 'rec' : undefined} />
      </Section>
      <Section label="Skill" grow>
        {formRadio(p)}
        <TextField {...st(p, 'name')} wide label="Name" does="The name of the proposal. It becomes the member's name." value={strOf(p.v, 'name') ?? ''} placeholder={NONE} onChange={x => p.set('name', x)} />
        <Radio {...st(p, 'scope')} label="Scope" does="Where the member is on, once you accept it and review it." value={strOf(p.v, 'scope') ?? ''} options={SCOPES} stack onChange={x => p.set('scope', x)} />
      </Section>
    </Band>
    <Band>
      <Section width={200}><Steps p={p} size={8} /></Section>
      <Section label="Proposal" grow>
        <div className="ref-pair">
          <Readout label="state" does="AIKit's state of the proposal: ready, held, accepted or removed." value={stateText(p.v)} tone={proposal(p.v) ? STATE_TONE[proposal(p.v)!] : undefined} />
          <Readout label="steps" does="The steps that stay, of all the steps found." value={stepsText(p.v)} />
        </div>
        <HeldFor v={p.v} size={1} />
        <Resembles v={p.v} size={proposal(p.v) === 'held' ? 2 : 3} />
        <div className="ref-pair"><Primary p={p} stack /><Remove p={p} /></div>
      </Section>
    </Band>
  </Panel>,

  full: p => {
    const v = p.v, f = formOf(v), all = stepsOf(v), kept = keeps(v), beats = beatsOf(v), win = windowOf(v), found = findingsOf(v), like = likenessOf(v)
    return <div className="ref-pane-body cs-full">
      <article className="cs-page">
        <h3>{markOf(v, 28)} {strOf(v, 'name') ?? NONE} <small>{f ? FORM_NAME[f] : NONE} · {stateText(v) ?? NONE}</small></h3>
        <p className="cs-lead">{has(v, 'says') ? <>{f === 'method' && <b>METHOD: </b>}{strOf(v, 'says')}</> : 'No reading of the draft text.'}</p>
        <h4>Steps</h4>
        {kept ? <ol className="cs-steps">{kept.map(s => <li key={s.id}><b>{s.name}</b><span>−{s.at} m</span>
          {s.uses.map(u => <i key={u.id} data-i={`${leaf(u.id)}|${FORM_NAME[u.form]} this step uses.`}><WoodMark kind={u.form} size={14} set={marks(v)} />{leaf(u.id)}</i>)}</li>)}</ol>
          : <p className="cs-none">No reading of the steps.</p>}
        {proposal(v) === 'held' && !!found?.length && <>
          <h4>Held for</h4>
          <ul className="cs-find">{found.map((x, i) => <li key={i}><b>{x.rule}</b><span>{x.description ?? 'a possible secret'}: {x.preview}</span></li>)}</ul>
        </>}
        <h4>Resembles</h4>
        {like?.length ? <ul className="cs-like">{like.map(x => <li key={x.other} data-i={`${leaf(x.other)}|${x.summary ?? `${x.percentage} % of the phrasing is shared.`}`}>{x.form ? <WoodMark kind={x.form} size={14} set={marks(v)} /> : <i />}<b>{leaf(x.other)}</b><em>{x.percentage} %</em><span>{x.summary ?? ''}</span></li>)}</ul>
          : <p className="cs-none">{like ? 'No member resembles it.' : 'No reading of the members.'}</p>}
      </article>
      <aside className="cs-example">
        <h4>Example · {win?.label ?? NONE}</h4>
        {beats ? <ol className="cs-beats">{beats.slice(0, 12).map((b, i) => {
          const n = all?.findIndex(s => s.id === b.step) ?? -1, owner = n >= 0 ? all![n]! : undefined
          const off = (win !== undefined && (b.at > win.from || b.at < win.to)) || (owner !== undefined && !wanted(v, owner))
          return <li key={i} data-dim={off ? 'true' : undefined}><time>−{b.at} m</time><span className="cs-kind">{b.kind}</span><code>{b.text}</code>{n >= 0 && <em>{n + 1}</em>}</li>
        })}</ol> : <p className="cs-none">No reading of the example.</p>}
      </aside>
    </div>
  },

  widget: p => <Tile title="Capture skill" light={light(p)} span={2} onFull={p.nav.full}>
    <div className="cs-tile">
      <div className="cs-tile-mark" data-i={`${strOf(p.v, 'name') ?? NONE}|The proposal that waits for you.`}>
        {markOf(p.v, 44) ?? <span className="cs-tile-none">{NONE}</span>}
        <b>{clip(strOf(p.v, 'name') ?? NONE, 22)}</b>
        <small>{stateText(p.v) ?? NONE} · {keeps(p.v) ? `${keeps(p.v)!.length} steps` : NONE}</small>
      </div>
      <div className="cs-stack"><Primary p={p} stack /><Remove p={p} /></div>
    </div>
  </Tile>,
}
