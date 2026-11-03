// The Skillset rack (manual §19.7): a SkillSet is the repertoire an agent carries — Methodologies, Methods, Skills and child
// sets, each wearing its kind's woodcut mark in the set in use (icon-cut.html §7: the blade or the pen). Live's nearest: a rack
// and its chain list, with nested racks for child sets. Membership grants no trust, authority or loading, so the picture is
// the chain list with each member's evidence ladder: carried is not loaded, and loaded is not used. Every control here is an
// AIKit operation: enable or disable through the profile, where a composition applies, preview then apply.
//
// Its pages: Set (the composition, with an Unused filter) and Capture (making a skill). Where the practice comes from, the skill trees on
// this machine that AIKit does not own, packages for other harnesses and every change AIKit made are AIKit's instrument's (§19.26,
// ai-kit__ai-kit.tsx), in a pane.
//
// Value keys beyond the set's own (members, sets, profiles). The owners report, never written from here:
//   unused      string[]                 members AIKit has catalogued and never seen used (`aikit unused --json`: unused[].capability)
// Settings the shell holds: unusedOnly (the Unused filter). A key the owner has not reported is absent: the views draw "—" and the well
// names what is missing.
//
// Making a skill (manual §19.7, the Capture page): do the task once by hand with Capture on, and the page writes a Method or a Skill from
// it and sends it to you as a proposal, which waits in Approvals and here. The page carries the Capture skill's own parts
// (ai-kit__capture-skill.tsx, whose header names AIKit's capture pipeline: capture, promote, reject, the rescan that releases) under
// `capture.`: source (minutes · clip), minutes (1–60), name, form (method · skill), scope (project · home: this project, or all your
// work), steps (each found, with `step:<id>` your request to keep it), proposal (ready · held · accepted · removed), findings (Held
// for, masked), similar (Resembles), recording (whether Capture records now). Acts: accept (held: a draft member), release, remove.
// Its tab's light is lit while it records.
import {useState} from 'react'
import {WoodMark} from '../../sdk/marks'
import type {WoodSet} from '../../sdk/icons'
import {Action, Band, Chooser, Display, Folded, Handle, Ladder, Panel, Radio, Readout, Rows, Section, TextField, Tile, Toggle, ValueBox, type LightState, type RowItem, unreadRows} from '../../sdk/panel'
import {NONE, boolOf, clampTo, grown, has, json, numOf, prefixed, scoped, st, strOf, wideFrame, type DesignedDevice, type ViewProps} from './design'
import {DOCUMENTATION, FORM_NAME, ORDER, RUNGS, markState, reaching, type Form, type Member} from './practice'
import {design as captureSkill} from './capture-skill'

type V = ViewProps['v']
const SCOPES = [{value: 'home', label: 'Home', does: 'Every session on this machine.'}, {value: 'project', label: 'Project', does: 'Every session in this project.'},
  {value: 'session', label: 'Session', does: 'This session only.'}] as const

// The mark set is the person's choice for the whole shell (Settings), not the owner's: the blade until they choose.
const marks = (v: V) => (strOf(v, 'marks') ?? 'blade') as WoodSet
const requested = (v: V, m: Member) => v[`req:${m.id}`] !== false
/** The set's members as AIKit reads them (the binding's `members`), methodologies first. */
const members = (v: V): Member[] => json<Member[]>(v, 'members', []).filter(m => m && typeof m.id === 'string' && Array.isArray(m.rungs)).sort((a, b) => ORDER.indexOf(a.form) - ORDER.indexOf(b.form))
/** How many members reach a rung; absent when the owner has not reported the members. */
const reach = (v: V, rung: number) => (has(v, 'members') ? reaching(effective(v), rung) : undefined)
const options = (v: V, key: string) => json<string[]>(v, key, []).filter(x => typeof x === 'string').map(x => ({value: x, label: x}))
const effective = (v: V) => members(v).map(m => (requested(v, m) ? m : {...m, rungs: m.rungs.map((r, i) => (i < 2 ? r : false))}))
/** The members AIKit has catalogued and never seen used; undefined when the owner has not said. */
const unusedOf = (v: V): ReadonlySet<string> | undefined => { if (!has(v, 'unused')) return undefined; const raw = json<unknown>(v, 'unused', []); return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []) }
/** The Unused filter is on, and the owner has said which members are unused. */
const filtering = (v: V) => boolOf(v, 'unusedOnly') === true && unusedOf(v) !== undefined

function chains(v: V): RowItem[] {
  const unused = unusedOf(v)
  const shown = filtering(v) ? members(v).filter(m => unused!.has(m.id)) : members(v)
  if (filtering(v) && !shown.length) return [{id: 'none', name: 'Every member has been used', light: 'lit', tone: 'green'}]
  return shown.map(m => {
    const want = requested(v, m), state = markState(m, want)
    return {id: m.id, name: m.form === 'skillset' ? `${m.name} · ${m.holds}` : m.name, request: want,
      light: (state === 'whole' ? 'lit' : 'dark') as LightState, why: want ? m.withheld?.why : 'Turned off: your request, through the profile.',
      mark: <WoodMark kind={m.form} size={14} state={state} set={marks(v)} title={FORM_NAME[m.form]} />,
      meter: <Ladder rungs={want ? m.rungs : m.rungs.map((r, i) => (i < 2 ? r : false))} labels={RUNGS} label={m.name} />, note: unused?.has(m.id) ? 'unused' : m.rev}
  })
}

/** Your requests, the scope and the profile change the composition; Preview shows what would apply, Apply applies it. */
function Compose({p, stack = true}: {p: ViewProps; stack?: boolean}) {
  // The composition's own standing: changed by your requests, previewed, applied. Nothing changed until you change something.
  const state = strOf(p.v, 'compose') ?? 'applied'
  return <>
    <Radio label="Applies to" does="Where the composition applies." value={strOf(p.v, 'scope') ?? ''} options={SCOPES} {...st(p, 'scope')} stack={stack} onChange={x => { p.set('scope', x); p.set('compose', 'changed') }} />
    {state === 'previewed'
      ? <div className="ref-pair">
          <Action label="Apply" does="Apply the previewed composition. AIKit projects it into the harness trees." onPress={() => p.set('compose', 'applied')} />
          <Action label="Cancel" does="Keep the composition as it is." onPress={() => p.set('compose', 'changed')} />
        </div>
      : <Action label="Preview" does={state === 'changed' ? 'Show what the change would apply: members, withheld reasons, harness effects.' : 'Nothing has changed since the last apply.'}
          onPress={state === 'changed' ? () => p.set('compose', 'previewed') : undefined} pending={state === 'changed'} />}
  </>
}

/** The Members list's columns: two in the pool; expanded or in a window, as many as the room beside the set, the composition and the
 * package holds at a member's width (manual §16.3: the room goes to what reads across it), up to six. */
const MEMBER_WIDTH = 250, BESIDE_MEMBERS = 136 + 104 + 74 + 20 + 84
const memberColumns = (p: ViewProps): number => Math.min(6, Math.max(2, Math.floor(grown(p, 2 * MEMBER_WIDTH, BESIDE_MEMBERS) / MEMBER_WIDTH)))

function ChainList({p, size, columns}: {p: ViewProps; size: number; columns: number}) {
  const [page, setPage] = useState(0)
  const requests = st(p, 'members').disabled ? undefined : (id: string, x: boolean) => { p.set(`req:${id}`, x); p.set('compose', 'changed') }
  const unused = unusedOf(p.v)
  const label = !has(p.v, 'members') ? 'Members'
    : filtering(p.v) ? `Unused · ${members(p.v).filter(m => unused!.has(m.id)).length} of ${members(p.v).length} never used`
    : `Members · ${reaching(effective(p.v), 2)} of ${members(p.v).length} available`
  return <Rows label={label}
    does="The square is your request. The mark is the member's kind, dim when withheld, orange when you can clear what holds it. The ticks are its evidence, carried to verified."
    items={has(p.v, 'members') ? chains(p.v) : undefined} waiting={st(p, 'members').waiting} why="No reading of the members." onRequest={requests} size={size} page={page} onPage={setPage} columns={columns} />
}

/** The Unused filter: the members AIKit has catalogued and never seen used, from its record of use. */
function UnusedFilter({p}: {p: ViewProps}) {
  const now = boolOf(p.v, 'unusedOnly'), unused = unusedOf(p.v)
  const count = unused === undefined || !has(p.v, 'members') ? undefined : members(p.v).filter(m => unused.has(m.id)).length
  return <>
    <Toggle {...st(p, 'unusedOnly')} label="Unused" does="Show only the members AIKit has catalogued and never seen used. A member carried and never used still costs the agent its place in the set."
      on={now === true} unknown={now === undefined} onChange={x => p.set('unusedOnly', x)} disabled={st(p, 'unusedOnly').disabled ?? (unused === undefined ? 'No reading of what has been used.' : undefined)} />
    <Readout label="never used" does="Members of this set that AIKit has catalogued and never seen used." value={count} tone={count ? 'accent' : undefined} />
  </>
}

/** The set by kind: each kind's mark and how many members it has. */
function KindCounts({v, size}: {v: V; size: number}) {
  return <div className="ref-kinds" data-size={size > 20 ? 'big' : undefined}>
    {ORDER.map(form => <span key={form} className="ref-kind" data-i={`${FORM_NAME[form]}s|${has(v, 'members') ? members(v).filter(m => m.form === form).length : NONE} in this set.`}>
      <WoodMark kind={form} size={size} set={marks(v)} /><b>{has(v, 'members') ? members(v).filter(m => m.form === form).length : NONE}</b>
    </span>)}
  </div>
}

// ------------------------------------------------------------------------------------------------ Capture: making a skill
// Carried from the Capture skill's design (ai-kit__capture-skill.tsx), where these parts were drawn first, under `capture.`.

type Proposal = 'ready' | 'held' | 'accepted' | 'removed'
interface CapStep {readonly id: string; readonly name: string; readonly at: number}
const capObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
function capRead<T>(v: V, key: string, pick: (x: Record<string, unknown>) => T | null): T[] | undefined {
  if (!has(v, key)) return undefined
  const raw = json<unknown>(v, key, [])
  return Array.isArray(raw) ? raw.flatMap(x => { const item = capObj(x) ? pick(x) : null; return item ? [item] : [] }) : []
}
const capSteps = (v: V) => capRead<CapStep>(v, 'steps', x => (typeof x.id === 'string' && typeof x.name === 'string' && typeof x.at === 'number' ? {id: x.id, name: x.name, at: x.at} : null))?.sort((a, b) => b.at - a.at)
const capFindings = (v: V) => capRead(v, 'findings', x => (typeof x.rule === 'string' && typeof x.preview === 'string' ? {rule: x.rule, preview: x.preview, step: typeof x.step === 'string' ? x.step : undefined} : null))
const capSimilar = (v: V) => capRead(v, 'similar', x => (typeof x.other === 'string' && typeof x.percentage === 'number' ? {other: x.other, percentage: x.percentage} : null))
const capForm = (v: V): Form | undefined => { const f = strOf(v, 'form'); return f === 'method' || f === 'skill' ? f : undefined }
/** The window of work the example comes from, in minutes ago: the last minutes, or the span of the selected clip. */
const capWindow = (v: V): {from: number; to: number} | undefined => {
  if (strOf(v, 'source') === 'clip') { const c = json<unknown>(v, 'clip', null); return capObj(c) && typeof c.from === 'number' && typeof c.to === 'number' ? {from: c.from, to: c.to} : undefined }
  const m = numOf(v, 'minutes'); return strOf(v, 'source') === 'minutes' && m !== undefined ? {from: m, to: 0} : undefined
}
const capKept = (v: V, x: CapStep) => { const w = capWindow(v); return v[`step:${x.id}`] !== false && !!w && x.at <= w.from && x.at >= w.to }
function capProposal(v: V): Proposal | undefined {
  if (v.remove === true) return 'removed'
  if (v.accept === true) return 'accepted'
  const x = strOf(v, 'proposal'); return x === 'ready' || x === 'held' || x === 'accepted' || x === 'removed' ? x : undefined
}
const CAP_STATE: Readonly<Record<Proposal, string>> = {ready: 'Ready', held: 'Held', accepted: 'Accepted', removed: 'Removed'}
const CAP_SOURCES = [{value: 'minutes', label: 'The last minutes', does: 'The last minutes of your work.'}, {value: 'clip', label: 'A selected clip', does: 'The clip you selected in Clip view.'}]
const CAP_FORMS = [{value: 'method', label: 'Method', does: 'A Method carries a whole practice.'}, {value: 'skill', label: 'Skill', does: 'A Skill carries one step of it.'}]
const CAP_SCOPES = [{value: 'project', label: 'This project', does: 'The member may be used in this project.'}, {value: 'home', label: 'All my work', does: 'The member may be used in all your work.'}]
const REACH = 60

/** The window on your work: an hour back to now on a square-root scale, the window shaded, a tick for each step that stays. */
function CaptureWell({v, set, w, h}: {v: V; set?: ViewProps['set']; w: number; h: number}) {
  const x0 = 10, x1 = w - 10, top = 30, bottom = h - 46, X = (m: number) => x1 - Math.sqrt(clampTo(0, REACH, m) / REACH) * (x1 - x0)
  const win = capWindow(v), steps = capSteps(v), f = capForm(v), state = capProposal(v), recording = boolOf(v, 'recording') === true, minutes = numOf(v, 'minutes')
  return <Display w={w} h={h} label="The window" corner={state ? CAP_STATE[state] : NONE}
    does="An hour of your work, the last minutes widest. The shaded part is the example; a line is a step that stays. Drag handle 1 to widen the window.">
    {recording && <g><circle cx={x0 + 3} cy={12} r={3} fill="var(--rec)" /><text x={x0 + 10} y={15} className="dp-axis">capture on</text></g>}
    {[60, 30, 15, 5, 0].map(t => <g key={t}><line x1={X(t)} x2={X(t)} y1={top} y2={bottom} className="dp-grid" />
      <text x={X(t)} y={bottom + 10} className="dp-axis" textAnchor={t === 60 ? 'start' : t === 0 ? 'end' : 'middle'}>{t === 0 ? 'now' : `−${t}`}</text></g>)}
    <rect x={x0} y={top} width={x1 - x0} height={bottom - top} className="dp-faint" />
    {win && <rect x={X(win.from)} y={top} width={Math.max(0, X(win.to) - X(win.from))} height={bottom - top} className="dp-fill" />}
    {win && steps?.map(x => <line key={x.id} x1={X(x.at)} x2={X(x.at)} y1={top + 4} y2={bottom - 4} className={capKept(v, x) ? 'dp-curve-on' : 'dp-faint'} strokeDasharray={capKept(v, x) ? undefined : '2 2'} />)}
    {(!win || !steps) && <text x={(x0 + x1) / 2} y={(top + bottom) / 2 + 3} className="dp-ink-dim" textAnchor="middle">{!win ? 'No reading of the window' : 'No reading of the steps'}</text>}
    {set && win && strOf(v, 'source') === 'minutes' && minutes !== undefined && <Handle x={X(win.from)} y={(top + bottom) / 2} n={1} shape="ring" label="Minutes"
      does="Drag along the strip: how many minutes back the example reaches." onDrag={x => set('minutes', clampTo(1, 60, Math.round(REACH * Math.pow(clampTo(0, 1, (x1 - x) / (x1 - x0)), 2))))} onReset={() => set('minutes', 10)} />}
    {f && <foreignObject x={x0} y={h - 32} width={26} height={26}><WoodMark kind={f} size={24} state={state === 'ready' ? 'whole' : state === 'held' || state === 'accepted' ? 'warn' : 'outline'} set={marks(v)} title={FORM_NAME[f]} /></foreignObject>}
    <text x={x0 + 32} y={h - 22} className="dp-ink">{f ? FORM_NAME[f] : NONE}</text>
    <text x={x0 + 32} y={h - 10} className="dp-ink-dim">{strOf(v, 'name') ?? NONE}</text>
  </Display>
}

function CaptureBands({p}: {p: ViewProps}) {
  const v = p.v, steps = capSteps(v), found = capFindings(v), like = capSimilar(v), state = capProposal(v), [page, setPage] = useState(0)
  const stuck = !!found?.some(x => !x.step || steps?.some(y => y.id === x.step && capKept(v, y)))
  const items: RowItem[] = steps === undefined ? unreadRows('No reading of the steps.')
    : steps.map((x, i) => ({id: x.id, name: `${i + 1} ${x.name}`, request: v[`step:${x.id}`] !== false, light: capKept(v, x) ? 'lit' : 'dark', tone: found?.some(y => y.step === x.id) ? 'stall' as const : 'accent' as const,
      note: `−${x.at} m`, why: found?.some(y => y.step === x.id) ? 'AIKit found a possible secret here. Turn the step off, then release.' : undefined}))
  const held: RowItem[] = state === 'held' && found?.length ? found.map((x, i) => ({id: `h${i}`, name: x.rule, light: 'lit', tone: 'stall', note: x.preview})) : []
  const near: RowItem[] = like === undefined ? unreadRows('No reading of the members.') : like.map(x => ({id: x.other, name: x.other.split('/').pop() ?? x.other, light: 'lit', tone: 'value', note: `${x.percentage} %`,
    does: `${x.percentage} % of the phrasing is shared. A close match needs a new revision, not a new member.`}))
  const acceptWhy = state === undefined ? 'No proposal yet.' : state === 'held' ? 'A proposal that holds a secret is never accepted. Release it first.' : state !== 'ready' ? 'The proposal is answered.' : !(strOf(v, 'name') ?? '').trim() ? 'Name it first.' : undefined
  return <>
    <Band>
      <Section width={206}><CaptureWell v={v} set={st(p, 'minutes').disabled ? undefined : p.set} w={194} h={146} /></Section>
      <Section label="Example" width={100}>
        <Radio {...st(p, 'source')} label="Source" does="The part of your work that the skill learns from." value={strOf(v, 'source') ?? ''} options={CAP_SOURCES} stack onChange={x => p.set('source', x)} />
        <ValueBox {...st(p, 'minutes')} wide label="Minutes" does="How far back the window reaches. A clip sets its own span." value={numOf(v, 'minutes') ?? NaN} def={10} scale={{min: 1, max: 60, step: 1}}
          format={x => `${x} min`} onChange={x => p.set('minutes', x)} disabled={st(p, 'minutes').disabled ?? (strOf(v, 'source') === 'clip' ? 'A clip sets its own span.' : undefined)} />
      </Section>
      <Section label="Member" grow>
        <TextField {...st(p, 'name')} wide label="Name" does="The member's name and the id it is kept under." value={strOf(v, 'name') ?? ''} placeholder={NONE} onChange={x => p.set('name', x)} />
        <Radio {...st(p, 'form')} label="Form" does="A Method carries a whole practice; a Skill carries one step of it." value={strOf(v, 'form') ?? ''} options={CAP_FORMS} stack onChange={x => p.set('form', x)} />
        <Radio {...st(p, 'scope')} label="Scope" does="Where the member may be used." value={strOf(v, 'scope') ?? ''} options={CAP_SCOPES} stack onChange={x => p.set('scope', x)} />
      </Section>
    </Band>
    <Band>
      <Section width={180}><Rows label={steps ? `Steps · ${steps.filter(x => capKept(v, x)).length} of ${steps.length}` : 'Steps'} does="The steps the device found. The square is your request: turn a step off to remove it."
        items={items} onRequest={st(p, 'steps').disabled ? undefined : (id, x) => p.set(`step:${id}`, x)} size={7} page={page} onPage={setPage} /></Section>
      <Section label="Proposal" grow>
        <Readout label="proposal" does="How the proposal stands: ready, held, removed or accepted. A proposal that holds a secret is held." value={state ? CAP_STATE[state] : undefined} tone={state === 'held' ? 'stall' : state === 'accepted' ? 'green' : state === 'ready' ? 'accent' : undefined} />
        {held.length > 0 ? <Rows label="Held for" does="What holds the proposal: each finding, masked." items={held} size={2} />
          : <Rows label={like?.length === 0 ? 'Resembles · none' : 'Resembles'} does="The members it is close to, nearest first." items={near} size={2} />}
        <div className="ref-pair">
          <Action {...st(p, 'accept')} hold label="Accept" does="Keeps the proposal as a draft member of your practice." onPress={() => p.set('accept', true)} disabled={st(p, 'accept').disabled ?? acceptWhy} />
          <Action {...st(p, 'release')} label="Release" does="Scans the proposal again, and frees it when no secret remains." onPress={() => p.set('release', true)}
            disabled={st(p, 'release').disabled ?? (state !== 'held' ? 'Nothing holds the proposal.' : stuck ? 'A step that holds a secret is still on.' : undefined)} />
          <Action {...st(p, 'remove')} label="Remove" does="Drops the proposal." onPress={() => p.set('remove', true)} disabled={st(p, 'remove').disabled ?? (state === 'ready' || state === 'held' ? undefined : 'No proposal waits.')} />
        </div>
      </Section>
    </Band>
  </>
}

// ------------------------------------------------------------------------------------------------ the pages

type PageId = 'set' | 'capture'
const PAGES: readonly {id: PageId; label: string}[] = [{id: 'set', label: 'Set'}, {id: 'capture', label: 'Capture'}]
const captureOf = (p: ViewProps) => scoped(p, 'capture.')
const pageOf = (p: ViewProps): PageId => (PAGES.some(x => x.id === p.page) ? p.page as PageId : 'set')
/** Capture's dot shows while it records (the manual draws it red; a page's light here carries no tone of its own). */
const pageLight = (v: V, id: PageId): LightState | undefined => (id === 'capture' && boolOf(v, 'capture.recording') === true ? 'lit' : undefined)

function SetBands({p}: {p: ViewProps}) {
  // The rack's picture is its chain list (§16.12): expanded above the chain, where the bands stand side by side, it stands first (§16.9).
  const list = <Section key="list" grow part="chains"><ChainList p={p} size={8 * memberColumns(p)} columns={memberColumns(p)} /></Section>
  const show = <Section key="show" width={76} part="chains"><UnusedFilter p={p} /></Section>
  const members = <Band key="members">{wideFrame(p) ? [list, show] : [show, list]}</Band>
  return <>
    {wideFrame(p) && members}
    <Band>
      <Section label="Set" width={136} part="macros">
        <Chooser {...st(p, 'set')} does="The set in the rack. Drag a set from the browser to replace it." value={strOf(p.v, 'set') ?? ''}
          options={options(p.v, 'sets')}
          onChange={x => { p.set('set', x); p.set('compose', 'changed') }} />
        <KindCounts v={p.v} size={18} />
        <div className="ref-pair">
          <Readout label="revision" does="A digest over the revisions of every member." value={strOf(p.v, 'revision')} copy={strOf(p.v, 'revision')} />
          <Readout label="author" does="The set's author, from its package metadata." value={strOf(p.v, 'author')} />
        </div>
      </Section>
      <Section label="Compose" grow part="macros">
        <Compose p={p} />
        <Chooser label="Profile" does="The governance profile the composition applies under. Profiles keep their precedence." value={strOf(p.v, 'profile') ?? ''} {...st(p, 'profile')}
          options={options(p.v, 'profiles')} onChange={x => { p.set('profile', x); p.set('compose', 'changed') }} />
      </Section>
    </Band>
    {!wideFrame(p) && members}
  </>
}

function SkillsWhole({p}: {p: ViewProps}) {
  const page = pageOf(p)
  return <Panel title={strOf(p.v, 'set') ?? 'Skillset rack'} mark={headMark(p.v)} view="whole" rack light={light(p.v, p.owner)} onFold={p.nav.fold} onFull={p.nav.full}
    pages={PAGES.map(x => ({id: x.id, label: x.label, light: pageLight(p.v, x.id)}))} page={page} onPage={p.setPage}>
    {page === 'capture' ? <CaptureBands p={captureOf(p)} /> : <SetBands p={p} />}
  </Panel>
}

// ------------------------------------------------------------------------------------------------ the pane
// The full rack is the set as a page, grouped by kind (manual §19.7 Full); the controls stay in Device view, below the pane.

function SetDoc({v}: {v: V}) {
  const unused = unusedOf(v)
  return <>
    <h3>{strOf(v, 'set') ?? NONE} <small>{strOf(v, 'revision') ?? NONE} · {has(v, 'members') ? members(v).length : NONE} members · applied at {strOf(v, 'scope') ?? NONE} scope</small></h3>
    {!has(v, 'members') && <p className="ref-doc-lead">No reading of the members.</p>}
    {ORDER.map(form => <section key={form} className="ref-doc-kind">
      <h4><WoodMark kind={form} size={24} set={marks(v)} /> {FORM_NAME[form]}s</h4>
      <ol className="ref-doc-list">
        {members(v).filter(m => m.form === form && (!filtering(v) || unused!.has(m.id))).map(m => {
          const want = requested(v, m), state = markState(m, want)
          return <li key={m.id} data-dim={state !== 'whole' ? 'true' : undefined}>
            <WoodMark kind={m.form} size={14} state={state} set={marks(v)} />
            <b>{m.name}</b><span className="ref-doc-rev">{unused?.has(m.id) ? `${m.rev} · never used` : m.rev}</span>
            <span className="ref-doc-standing"><Ladder rungs={m.rungs} labels={RUNGS} label={m.name} /> {!want ? 'Turned off by you.' : m.withheld ? m.withheld.why : 'Available.'}</span>
            <p>{m.says}</p>
          </li>
        })}
      </ol>
    </section>)}
  </>
}

// The light reads the owner alone; hollow while it has not said.
const light = (v: V, owner?: V) => (strOf(owner ?? v, 'light') ?? 'unknown') as LightState
const short = (v: V) => { const set = strOf(v, 'set'); return set === undefined ? NONE : set.split(':')[1] ?? set }
const headMark = (v: V) => <WoodMark kind="skillset" size={14} set={marks(v)} title="Skillset" />

export const skills: DesignedDevice = {
  id: 'ai-kit:skillset-rack',
  title: 'Skillset rack',
  kind: 'rack',
  firstPage: 'set',
  defaults: {light: 'lit', set: 'central:documentation', scope: 'project', profile: 'baseline', compose: 'applied',
    marks: 'blade', revision: 'b3:9f2c41', author: 'Epi-Logos', 'req:experimental-development': false,
    // The owner's material, as the binding supplies it: the members, the sets and profiles to choose from.
    members: JSON.stringify(DOCUMENTATION),
    sets: JSON.stringify(['central:documentation', 'central:core-development', 'aikit:project-author']),
    profiles: JSON.stringify(['baseline', 'core', 'review']),
    // What has never been used.
    unused: JSON.stringify(['architecture-development', 'evidence-led-repair', 'diagram-authoring', 'projection-authoring', 'ui-mockup-authoring']), unusedOnly: false,
    // The Capture page: the Capture skill's own sample, under `capture.`.
    ...prefixed('capture.', captureSkill.defaults)},
  fixtures: {'The blade': {marks: 'blade'}, 'The pen': {marks: 'pen'},
    'Unused only': {unusedOnly: true},
    'Capturing, held for a secret': {'capture.recording': true, ...prefixed('capture.', captureSkill.fixtures?.Held ?? {})},
    'No readings': {light: undefined, set: undefined, scope: undefined, profile: undefined, compose: undefined, revision: undefined,
      author: undefined, members: undefined, sets: undefined, profiles: undefined, unused: undefined, unusedOnly: undefined,
      ...prefixed('capture.', captureSkill.fixtures?.['No readings'] ?? {})}},

  folded: p => <Folded title={short(p.v)} light={light(p.v, p.owner)} readings={[`${reach(p.v, 5) === undefined ? NONE : reach(p.v, 5)} loaded`]} onUnfold={p.nav.unfold} />,

  // Live's rack on its chain, left to right: the macros, then the chain list (Live 12 manual, Racks).
  compact: p => <Panel title={short(p.v)} mark={headMark(p.v)} view="compact" rack light={light(p.v, p.owner)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={92} part="macros">
      <Compose p={p} />
      <Readout label="loaded" does="Members whose body entered the agent's context in this session." value={has(p.v, 'members') ? `${reaching(effective(p.v), 5)}/${members(p.v).length}` : undefined} tone="green" />
    </Section>
    <Section width={244} part="chains"><ChainList p={p} size={8} columns={1} /></Section>
  </Panel>,

  whole: p => <SkillsWhole p={p} />,

  full: p => <div className="ref-pane-body"><div className="ref-doc"><SetDoc v={p.v} /></div></div>,

  widget: p => <Tile title={short(p.v)} light={light(p.v, p.owner)} span={2} onFull={p.nav.full}>
    <KindCounts v={p.v} size={28} />
    <div className="ref-tile-side">
      <Readout label="available" value={has(p.v, 'members') ? `${reaching(effective(p.v), 2)}/${members(p.v).length}` : undefined} />
      <Readout label="loaded" value={reach(p.v, 5)} tone="green" />
      <Readout label="invoked" value={reach(p.v, 6)} tone="green" />
    </div>
  </Tile>,
}
