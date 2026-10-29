// The Skillset rack (manual §19.7): a SkillSet is the repertoire an agent carries — Methodologies, Methods, Skills and child
// sets, each wearing its kind's woodcut mark in the set in use (icon-cut.html §7: the blade or the pen). Live's nearest: a rack
// and its chain list, with nested racks for child sets. Membership grants no trust, authority or loading, so the picture is
// the chain list with each member's evidence ladder: carried is not loaded, and loaded is not used. Every control here is an
// AIKit operation: enable or disable through the profile, the scope a composition applies at, preview then apply, package. Export writes
// the set's native package for the target you chose into the directory you name (`outDir`, an absolute path: `aikit set package export
// <set> --target <t> --out <dir>`), its receipt beside it.
//
// Its pages keep the practice itself: Set (the composition, with an Unused filter), Sources (where the practice comes from, and the
// skill trees on this machine that AIKit does not own), Adopt (bring a foreign tree under AIKit, previewed first) and Procedures (each
// change AIKit made to the machine, with Run, Undo and the hook bypasses). Live's nearest for the three: the browser's Places with
// their Add Folder, and the undo history.
//
// Value keys beyond the set's own (members, sets, profiles, unsupported). The owners report, never written from here:
//   unused      string[]                 members AIKit has catalogued and never seen used (`aikit unused --json`: unused[].capability)
//   sources     [{id, kind, skills, retired?, active, candidate, rollback?, ground?, rejected?}]  each registered source as `aikit source
//                                        show <id> --json` reads it: kind git | directory | capsule, active_skills, active_retired_skills,
//                                        active_snapshot, candidate_snapshot, rollback_points[0], control_ground, candidate_rejected (a count)
//   roots       [{root, path, skills, decide}]  the skill trees on this machine that AIKit does not own (`aikit collate --json`: each
//                                        cluster's where[].root and path, counted; decide counts the names whose copies differ, conflict)
//   adoption    {root, namespace, digest, isolation, items: [{name, act: 'adopt' | 'owned' | 'refused', why?}]}  the reviewed plan of
//                                        `aikit adopt <path> --namespace <ns> --json` without --yes: every skill copied into skill/<ns>/
//                                        and its foreign copy replaced by a projection link; undo restores the original bytes
//   procedures  [{id, kind, subject, state: 'planned' | 'committed' | 'undone', digest, isolation, at, edits: {<edit>: count}}]
//                                        `aikit procedure list --json`, each with its `procedure diff <id> --json` (WorldEdit kinds)
//   bypasses    [{id, scope, reason, capability?, at, state: 'open' | 'spent' | 'revoked'}]  `aikit bypass list --json` with
//                                        `aikit history bypasses --json`
// Settings the shell holds: unusedOnly (the Unused filter), source (the source chosen), adoptRoot (the root chosen), namespace (where
//   adoption writes: skill/<namespace>/), procedure (the procedure chosen), bypassScope ('next-event' | 'session' | '1h'), bypassReason.
// Acts, each on its own key: sync, promote, rollback (the source id: `aikit source sync|promote|rollback <id>`), adoptPreview (the root),
// adoptApply (the plan's digest: `aikit adopt <path> --yes --expect-digest <digest>`), procRun (`<id>@<digest>`: `aikit procedure run
// <id> --expect-digest <digest>`), procUndo (the id: `aikit procedure undo <id>`), issue (JSON {scope, reason}: `aikit bypass issue`),
// revoke (the bypass id: `aikit bypass revoke`). No kernel op reaches these AIKit commands yet: the host stands each act disabled with
// that reason until one does. A key the owner has not reported is absent: the views draw "—" and the well names what is missing.
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
import {Action, Band, Chooser, Display, Folded, Handle, Ladder, Panel, Radio, Readout, Rows, Section, TextField, Tile, Toggle, ValueBox, type LightState, type RowItem, unreadRows, NoReading} from '../../sdk/panel'
import {NONE, boolOf, clampTo, grown, has, json, numOf, prefixed, scoped, st, strOf, wideFrame, type DesignedDevice, type ViewProps} from './design'
import {DOCUMENTATION, FORM_NAME, ORDER, RUNGS, markState, reaching, type Form, type Member} from './practice'
import {design as captureSkill} from './capture-skill'

type V = ViewProps['v']
const SCOPES = [{value: 'home', label: 'Home', does: 'Every session on this machine.'}, {value: 'project', label: 'Project', does: 'Every session in this project.'},
  {value: 'session', label: 'Session', does: 'This session only.'}] as const
const TARGETS = [{value: 'claude', label: 'Claude'}, {value: 'codex', label: 'Codex'}, {value: 'pi', label: 'Pi'}, {value: 'openai', label: 'OpenAI'}] as const
/** What a target cannot carry, from AIKit's target table (Pi has no MCP). */

// The mark set is the person's choice for the whole shell (Settings), not the owner's: the blade until they choose.
const marks = (v: V) => (strOf(v, 'marks') ?? 'blade') as WoodSet
const requested = (v: V, m: Member) => v[`req:${m.id}`] !== false
/** The set's members as AIKit reads them (the binding's `members`), methodologies first. */
const members = (v: V): Member[] => json<Member[]>(v, 'members', []).filter(m => m && typeof m.id === 'string' && Array.isArray(m.rungs)).sort((a, b) => ORDER.indexOf(a.form) - ORDER.indexOf(b.form))
/** How many members reach a rung; absent when the owner has not reported the members. */
const reach = (v: V, rung: number) => (has(v, 'members') ? reaching(effective(v), rung) : undefined)
/** What the target cannot carry, from the package receipt (the binding's `unsupported`, by target). */
const unsupported = (v: V) => { const t = strOf(v, 'target'); const map = json<Record<string, number>>(v, 'unsupported', {}); return t !== undefined && typeof map[t] === 'number' ? map[t] : undefined }
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
    <Radio label="Scope" does="Where the composition applies." value={strOf(p.v, 'scope') ?? ''} options={SCOPES} {...st(p, 'scope')} stack={stack} onChange={x => { p.set('scope', x); p.set('compose', 'changed') }} />
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

// ------------------------------------------------------------------------------------------------ where the practice comes from

interface Source {readonly id: string; readonly kind?: string; readonly skills?: number; readonly retired?: number; readonly active?: string; readonly candidate?: string; readonly rollback?: string; readonly ground?: boolean; readonly rejected?: number}
interface Root {readonly root: string; readonly path?: string; readonly skills?: number; readonly decide?: number}
const isRec = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined)
const s = (x: unknown) => (typeof x === 'string' && x !== '' ? x : undefined)
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

function sourceRows(v: V): RowItem[] {
  const all = sourcesOf(v), roots = rootsOf(v)
  const items: RowItem[] = all === undefined ? unreadRows('No reading of the sources.')
    : all.map(x => ({id: x.id, name: x.id, light: x.active ? 'lit' : 'dark', tone: waits(x) ? 'stall' : 'value',
      note: `${KIND_WORD[x.kind ?? ''] ?? x.kind ?? NONE} · ${x.skills ?? NONE}`, why: waits(x) ? 'A candidate snapshot waits: Promote makes it active.' : x.rejected ? `${x.rejected} skills of the candidate were rejected.` : undefined,
      does: `${x.ground ? 'Central\'s own ground. ' : ''}Active ${snap(x.active) ?? NONE}${x.retired ? `, ${x.retired} retired` : ''}.`}))
  for (const r of roots ?? []) items.push({id: `root:${r.root}`, name: r.root, light: 'dark', tone: r.decide ? 'stall' : 'value', note: `not AIKit's · ${r.skills ?? NONE}`,
    why: r.decide ? `${r.decide} names have copies that differ here and elsewhere. Adopt the tree to keep one.` : undefined, does: `${r.path ?? NONE}. A skill tree AIKit reads and does not own.`})
  return items
}

function SourcesBands({p}: {p: ViewProps}) {
  const [page, setPage] = useState(0)
  const all = sourcesOf(p.v), x = chosenSource(p.v)
  return <>
    <Band>
      <Section width={206}><SourcesWell v={p.v} w={194} h={146} /></Section>
      <Section label="Source" width={104}>
        <Chooser {...st(p, 'source')} label="Source" wide does="The source the readings and the acts are for." value={x?.id ?? ''} options={(all ?? []).map(y => ({value: y.id, label: y.id}))} onChange={y => p.set('source', y)} />
        <Readout label="kind" does="Where the source lives: a Git repository at an exact revision, a folder on this machine, or one exported capsule." value={x ? KIND_WORD[x.kind ?? ''] ?? x.kind : undefined} />
        <Readout label="skills" does="Skills in the active snapshot, and how many of them are retired." value={x?.skills === undefined ? undefined : `${x.skills}${x.retired ? ` · ${x.retired} retired` : ''}`} tone="value" />
        <Readout label="active" does="The active snapshot. Press to copy its digest." value={snap(x?.active)} copy={x?.active} />
      </Section>
      <Section label="Snapshot" grow>
        <Action {...st(p, 'sync')} label="Sync" does="Copy the source into a new candidate snapshot. Nothing becomes active." onPress={x ? () => p.set('sync', x.id) : undefined} />
        <Action {...st(p, 'promote')} hold label="Promote" does="Make the candidate snapshot active. The one before stays to roll back to."
          onPress={x && waits(x) ? () => p.set('promote', x.id) : undefined} disabled={st(p, 'promote').disabled ?? (x && !waits(x) ? 'The candidate is the active snapshot.' : undefined)} />
        <Action {...st(p, 'rollback')} hold label="Roll back" does="Return to the snapshot promoted before this one."
          onPress={x?.rollback ? () => p.set('rollback', x.id) : undefined} disabled={st(p, 'rollback').disabled ?? (x && !x.rollback ? 'Nothing was promoted before.' : undefined)} />
        <Readout label="candidate" does="The candidate snapshot: the same as the active one, or new and waiting." value={x ? (waits(x) ? snap(x.candidate) : 'same') : undefined} tone={x && waits(x) ? 'stall' : undefined} />
      </Section>
    </Band>
    <Band>
      <Section grow><Rows label={all ? `Sources · ${all.length}, and ${rootsOf(p.v)?.length ?? NONE} trees AIKit does not own` : 'Sources'}
        does="The sources AIKit owns, then the skill trees it reads and does not own. Orange: a candidate waits, or copies differ." items={sourceRows(p.v)} size={14} columns={2}
        page={page} onPage={setPage} selected={x?.id} onSelect={id => { if (!id.startsWith('root:') && all?.some(y => y.id === id)) p.set('source', id) }} /></Section>
    </Band>
  </>
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

function adoptRows(v: V): RowItem[] {
  const plan = planFor(v)
  if (!plan) return adoptRoot(v) ? [{id: 'none', name: 'Preview to read the plan', light: 'unknown'}] : unreadRows('No reading of the roots.')
  return plan.items.map(x => ({id: x.name, name: x.name, light: x.act === 'adopt' ? 'lit' : 'dark', tone: x.act === 'refused' ? 'stall' : 'value',
    note: x.act === 'adopt' ? 'adopt' : x.act === 'owned' ? 'owned' : 'refused', why: x.act === 'refused' ? x.why ?? 'The plan refuses it.' : undefined,
    does: x.act === 'adopt' ? `Copied to skill/${plan.namespace ?? NONE}/${x.name}; a link stands in its place.` : x.act === 'owned' ? 'AIKit already owns it.' : undefined}))
}

function AdoptBands({p}: {p: ViewProps}) {
  const [page, setPage] = useState(0)
  const plan = planFor(p.v), roots = rootsOf(p.v), root = adoptRoot(p.v)
  return <>
    <Band>
      <Section width={206}><AdoptWell v={p.v} w={194} h={146} /></Section>
      <Section label="Root" width={104}>
        <Chooser {...st(p, 'adoptRoot')} label="Root" wide does="The skill tree to bring under AIKit. Sources lists every tree it does not own." value={root ?? ''}
          options={(roots ?? []).map(r => ({value: r.root, label: r.root}))} onChange={x => { p.set('adoptRoot', x); p.set('adoption', undefined) }} />
        <TextField {...st(p, 'namespace')} label="Namespace" wide does="Where the skills land in AIKit: skill/<namespace>/. Press Enter to keep it." value={strOf(p.v, 'namespace') ?? ''}
          placeholder={has(p.v, 'namespace') ? 'claude' : NONE} onChange={x => { p.set('namespace', x); p.set('adoption', undefined) }} />
        <Readout label="isolation" does="How AIKit stages the change: on a Git branch, in a shadow tree it swaps file by file, or directly." value={plan?.isolation} />
      </Section>
      <Section label="Adopt" grow>
        <AdoptActs p={p} />
        <Readout big label="to adopt" does="Skills the plan copies into AIKit." value={count(plan, 'adopt')} tone="accent" />
        <Readout label="refused" does="Skills the plan refuses, each with its reason." value={count(plan, 'refused')} tone={count(plan, 'refused') ? 'stall' : undefined} />
        <Readout label="digest" does="The digest the plan was reviewed under. Apply names it, and a change since refuses." value={plan?.digest?.slice(0, 10)} copy={plan?.digest} />
      </Section>
    </Band>
    <Band>
      <Section grow><Rows label={plan ? `The plan · ${plan.items.length} skills in ${plan.root}` : 'The plan'} does="Each skill of the root and what the plan does with it."
        items={adoptRows(p.v)} size={14} columns={2} page={page} onPage={setPage} /></Section>
    </Band>
  </>
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

function bypassRows(v: V): RowItem[] {
  const all = bypassesOf(v)
  if (!all) return unreadRows('No reading of the bypasses.')
  if (!all.length) return [{id: 'none', name: 'No bypass issued', light: 'dark'}]
  return all.map(b => ({id: b.id, name: b.reason ?? b.id, light: b.state === 'open' ? 'lit' : 'dark', tone: b.state === 'open' ? 'stall' : 'value',
    note: `${b.scope ?? NONE} · ${b.state ?? NONE}`, does: `${b.capability ? `${b.capability} only. ` : 'The whole hook chain. '}Issued ${b.at ?? NONE}.`}))
}

function ProcBands({p}: {p: ViewProps}) {
  const all = proceduresOf(p.v), x = chosenProc(p.v), byp = bypassesOf(p.v)
  const [chosenBypass, setChosenBypass] = useState<string | undefined>(undefined)
  const b = byp?.find(y => y.id === chosenBypass && y.state === 'open') ?? byp?.find(y => y.state === 'open')
  const reason = strOf(p.v, 'bypassReason') ?? '', scope = strOf(p.v, 'bypassScope')
  return <>
    <Band>
      <Section width={206}><ProcWell p={p} w={194} h={146} /></Section>
      <Section label="Procedure" width={104}>
        <Chooser {...st(p, 'procedure')} label="Procedure" wide does="The recorded procedure the readings and acts are for." value={x?.id ?? ''}
          options={(all ?? []).map(y => ({value: y.id, label: `${y.kind ?? NONE} ${shortId(y.id)}`}))} onChange={y => p.set('procedure', y)} />
        <Readout label="subject" does={`What the procedure changes${x?.subject ? `: ${x.subject}` : ''}.`} value={clip(x?.subject, 15)} />
        <Readout label="isolation" does="How it is staged: on a Git branch, in a shadow tree, or directly." value={x?.isolation} />
        <Readout label="digest" does="The digest Run names. A change since the plan refuses the run." value={x?.digest?.slice(0, 10)} copy={x?.digest} />
      </Section>
      <Section label="Act" grow>
        <Readout label="state" does="Planned: not run. Applied: run, and Undo can take it back. Undone." value={x ? STATE_WORD[x.state ?? ''] : undefined} tone={x?.state === 'planned' ? 'accent' : x?.state === 'committed' ? 'green' : undefined} />
        <Action {...st(p, 'procRun')} hold label="Run" does="Apply the planned procedure exactly as planned. A world changed since the plan refuses it."
          onPress={x?.state === 'planned' && x.digest ? () => p.set('procRun', `${x.id}@${x.digest}`) : undefined}
          disabled={st(p, 'procRun').disabled ?? (x && x.state !== 'planned' ? 'It has already run.' : undefined)} />
        <Action {...st(p, 'procUndo')} hold label="Undo" does="Take the procedure back from its journal: each edit reversed, the last first."
          onPress={x?.state === 'committed' ? () => p.set('procUndo', x.id) : undefined}
          disabled={st(p, 'procUndo').disabled ?? (x && x.state !== 'committed' ? (x.state === 'undone' ? 'It is already undone.' : 'It has not run.') : undefined)} />
        <Readout label="at" does="When it was planned or applied." value={x?.at} />
      </Section>
    </Band>
    <Band>
      <Section label="Bypass" width={112}>
        <Radio {...st(p, 'bypassScope')} label="Lasts" does="How long the next bypass lets hooks through." value={scope ?? ''} options={SCOPE} stack onChange={y => p.set('bypassScope', y)} />
        <TextField {...st(p, 'bypassReason')} label="Reason" wide does="Why you let the hooks through. AIKit records it with the bypass." value={reason} placeholder={has(p.v, 'bypassReason') ? 'Why' : NONE} onChange={y => p.set('bypassReason', y)} />
        <Action {...st(p, 'issue')} hold label="Issue" does="Issue a bypass: the hook chain lets the agent through for as long as it lasts. It is recorded, and is not an authority."
          onPress={reason.trim() && scope ? () => p.set('issue', JSON.stringify({scope, reason: reason.trim()})) : undefined}
          disabled={st(p, 'issue').disabled ?? (reason.trim() ? undefined : 'Give a reason first.')} />
      </Section>
      <Section grow><Rows label={byp ? `Bypasses · ${byp.filter(y => y.state === 'open').length} open` : 'Bypasses'} does="Each bypass with its reason, how long it lasts, and whether it is open, spent or revoked."
        items={bypassRows(p.v)} size={7} selected={b?.id} onSelect={id => setChosenBypass(id)} /></Section>
      <Section width={76}>
        <Action {...st(p, 'revoke')} hold label="Revoke" does="Close the chosen open bypass now." onPress={b ? () => p.set('revoke', b.id) : undefined} disabled={st(p, 'revoke').disabled ?? (byp && !b ? 'No bypass is open.' : undefined)} />
      </Section>
    </Band>
  </>
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

function CaptureDoc({v}: {v: V}) {
  const steps = capSteps(v), found = capFindings(v), like = capSimilar(v), state = capProposal(v), f = capForm(v)
  return <>
    <h3>{strOf(v, 'name') ?? NONE} <small>{f ? FORM_NAME[f] : NONE} · {state ? CAP_STATE[state] : NONE}{boolOf(v, 'recording') ? ' · capture on' : ''}</small></h3>
    {strOf(v, 'says') && <p className="ref-doc-lead">{strOf(v, 'says')}</p>}
    <section className="ref-doc-kind"><h4>Steps</h4>
      {!steps ? <p className="ref-doc-lead">No reading of the steps.</p> : <ol className="ref-doc-list">{steps.map((x, i) => <li key={x.id} data-dim={capKept(v, x) ? undefined : 'true'}>
        <span className="dp-lamp" data-light={capKept(v, x) ? 'lit' : 'dark'} data-tone="accent" /><b>{i + 1} {x.name}</b><span className="ref-doc-rev">−{x.at} m</span></li>)}</ol>}
    </section>
    {state === 'held' && !!found?.length && <section className="ref-doc-kind"><h4>Held for</h4><ol className="ref-doc-list">{found.map((x, i) => <li key={i}>
      <span className="dp-lamp" data-light="lit" data-tone="stall" /><b>{x.rule}</b><span className="ref-doc-rev">{x.preview}</span></li>)}</ol></section>}
    <section className="ref-doc-kind"><h4>Resembles</h4>
      {!like ? <p className="ref-doc-lead">No reading of the members.</p> : !like.length ? <p className="ref-doc-lead">No member resembles it.</p>
        : <ol className="ref-doc-list">{like.map(x => <li key={x.other}><span className="dp-lamp" data-light="lit" data-tone="value" /><b>{x.other.split('/').pop()}</b><span className="ref-doc-rev">{x.percentage} %</span></li>)}</ol>}
    </section>
  </>
}

// ------------------------------------------------------------------------------------------------ the pages

type PageId = 'set' | 'sources' | 'adopt' | 'procedures' | 'capture'
const PAGES: readonly {id: PageId; label: string}[] = [{id: 'set', label: 'Set'}, {id: 'sources', label: 'Sources'}, {id: 'adopt', label: 'Adopt'}, {id: 'procedures', label: 'Procedures'},
  {id: 'capture', label: 'Capture'}]
const captureOf = (p: ViewProps) => scoped(p, 'capture.')
const pageOf = (p: ViewProps): PageId => (PAGES.some(x => x.id === p.page) ? p.page as PageId : 'set')
/** Sources is dark while a candidate waits or copies of a skill differ; Procedures while one is planned and not run. */
function pageLight(v: V, id: PageId): LightState | undefined {
  if (id === 'sources') { const all = sourcesOf(v), roots = rootsOf(v); return all === undefined && roots === undefined ? undefined : (all ?? []).some(waits) || (roots ?? []).some(r => (r.decide ?? 0) > 0) ? 'dark' : 'lit' }
  if (id === 'procedures') { const all = proceduresOf(v); return all === undefined ? undefined : all.some(x => x.state === 'planned') ? 'dark' : 'lit' }
  // Capture's dot shows while it records (the manual draws it red; a page's light here carries no tone of its own).
  if (id === 'capture') return boolOf(v, 'capture.recording') === true ? 'lit' : undefined
  return undefined
}

function SetBands({p}: {p: ViewProps}) {
  // The rack's picture is its chain list (§16.12): expanded above the chain, where the bands stand side by side, it stands first (§16.9).
  const list = <Section key="list" grow part="chains"><ChainList p={p} size={8 * memberColumns(p)} columns={memberColumns(p)} /></Section>
  const show = <Section key="show" label="Show" width={76} part="chains"><UnusedFilter p={p} /></Section>
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
      <Section label="Compose" width={104} part="macros">
        <Compose p={p} />
        <Chooser label="Profile" does="The governance profile the composition applies under. Profiles keep their precedence." value={strOf(p.v, 'profile') ?? ''} {...st(p, 'profile')}
          options={options(p.v, 'profiles')} onChange={x => { p.set('profile', x); p.set('compose', 'changed') }} />
      </Section>
      <Section label="Package" grow part="macros">
        <Radio does="The harness to package the set for. The set itself does not change." value={strOf(p.v, 'target') ?? ''} options={TARGETS} {...st(p, 'target')} stack onChange={x => p.set('target', x)} />
        <TextField {...st(p, 'outDir')} label="Into" does="The directory the package is written into, as an absolute path. AIKit writes the package and its receipt there." wide
          value={strOf(p.v, 'outDir') ?? ''} placeholder="/absolute/folder" onChange={x => p.set('outDir', x)} />
        <Action {...st(p, 'exported')} label="Export" does="Write the native package and its receipt into the directory named Into." onPress={has(p.v, 'target') ? () => p.set('exported', strOf(p.v, 'target')) : undefined} />
        <Readout label="unsupported" does="Relations the target cannot carry. The receipt names each one." value={unsupported(p.v)} tone={unsupported(p.v) ? 'stall' : undefined} />
      </Section>
    </Band>
    {!wideFrame(p) && members}
  </>
}

function SkillsWhole({p}: {p: ViewProps}) {
  const page = pageOf(p)
  return <Panel title={strOf(p.v, 'set') ?? 'Skillset rack'} mark={headMark(p.v)} view="whole" rack light={light(p.v, p.owner)} onFold={p.nav.fold} onFull={p.nav.full}
    pages={PAGES.map(x => ({id: x.id, label: x.label, light: pageLight(p.v, x.id)}))} page={page} onPage={p.setPage}>
    {page === 'sources' ? <SourcesBands p={p} /> : page === 'adopt' ? <AdoptBands p={p} /> : page === 'procedures' ? <ProcBands p={p} /> : page === 'capture' ? <CaptureBands p={captureOf(p)} /> : <SetBands p={p} />}
  </Panel>
}

// ------------------------------------------------------------------------------------------------ the pane

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
  if (!plan) return <><h3>Adopt <small>{root ?? NONE}</small></h3><p className="ref-doc-lead">{root ? 'No plan yet. Preview it in Device view.' : 'No reading of the skill trees.'}</p></>
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

function ProceduresDoc({v}: {v: V}) {
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
        : <ol className="ref-doc-list">{byp.map(b => <li key={b.id} data-dim={b.state === 'open' ? undefined : 'true'}>
          <span className="dp-lamp" data-light={b.state === 'open' ? 'lit' : 'dark'} data-tone="stall" />
          <b>{b.reason ?? b.id}</b><span className="ref-doc-rev">{b.state ?? NONE}</span>
          <span className="ref-doc-standing">{b.scope ?? NONE} · {b.capability ?? 'the whole hook chain'} · issued {b.at ?? NONE}</span>
        </li>)}</ol>}
    </section>
  </>
}

function SkillsFull({p}: {p: ViewProps}) {
  const page = pageOf(p)
  return <div className="ref-pane-body">
    <div className="ref-pane-tabs" role="tablist" aria-label="Pages">
      {PAGES.map(x => <button key={x.id} type="button" role="tab" aria-selected={x.id === page} onClick={() => p.setPage(x.id)}>{x.label}</button>)}
    </div>
    <div className="ref-doc">
      {page === 'sources' ? <SourcesDoc v={p.v} /> : page === 'adopt' ? <AdoptDoc v={p.v} /> : page === 'procedures' ? <ProceduresDoc v={p.v} /> : page === 'capture' ? <CaptureDoc v={captureOf(p).v} /> : <SetDoc v={p.v} />}
    </div>
  </div>
}

// The light reads the owner alone; hollow while it has not said.
const light = (v: V, owner?: V) => (strOf(owner ?? v, 'light') ?? 'unknown') as LightState
const short = (v: V) => { const set = strOf(v, 'set'); return set === undefined ? NONE : set.split(':')[1] ?? set }
const headMark = (v: V) => <WoodMark kind="skillset" size={14} set={marks(v)} title="Skillset" />

// ------------------------------------------------------------------------------------------------ sample readings (defaults and fixtures only)

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
// `aikit procedure list --json`, the latest four, with their diffs.
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

export const skills: DesignedDevice = {
  id: 'ai-kit:skillset-rack',
  title: 'Skillset rack',
  kind: 'rack',
  firstPage: 'set',
  defaults: {light: 'lit', set: 'central:documentation', scope: 'project', profile: 'baseline', compose: 'applied', target: 'claude', outDir: '/Users/you/Packages',
    marks: 'blade', revision: 'b3:9f2c41', author: 'Epi-Logos', 'req:experimental-development': false,
    // The owner's material, as the binding supplies it: the members, the sets and profiles to choose from, what each target drops.
    members: JSON.stringify(DOCUMENTATION),
    sets: JSON.stringify(['central:documentation', 'central:core-development', 'aikit:project-author']),
    profiles: JSON.stringify(['baseline', 'core', 'review']),
    unsupported: JSON.stringify({claude: 0, codex: 0, pi: 1, openai: 0}),
    // Upkeep: what has never been used, the sources and the trees AIKit does not own, the adoption plan, the procedures and bypasses.
    unused: JSON.stringify(['architecture-development', 'evidence-led-repair', 'diagram-authoring', 'projection-authoring', 'ui-mockup-authoring']), unusedOnly: false,
    sources: JSON.stringify(SOURCES), roots: JSON.stringify(ROOTS), source: 'central',
    adoptRoot: '@claude', namespace: 'claude', adoption: JSON.stringify(ADOPTION),
    procedures: JSON.stringify(PROCEDURES), procedure: 'prc_01M5EER86PB5JC206XZFWZ2C0A', bypasses: JSON.stringify(BYPASSES), bypassScope: 'next-event', bypassReason: '',
    // The Capture page: the Capture skill's own sample, under `capture.`.
    ...prefixed('capture.', captureSkill.defaults)},
  fixtures: {'The blade': {marks: 'blade'}, 'The pen': {marks: 'pen'},
    'Unused only': {unusedOnly: true},
    'A candidate waits': {source: 'mattpocock', sources: JSON.stringify(SOURCES.map(x => (x.id === 'mattpocock' ? {...x, candidate: '3be07c55f1a82d64'} : x)))},
    'Before preview': {adoption: undefined, adoptRoot: '@codex', namespace: 'codex'},
    'Capturing, held for a secret': {'capture.recording': true, ...prefixed('capture.', captureSkill.fixtures?.Held ?? {})},
    'No readings': {light: undefined, set: undefined, scope: undefined, profile: undefined, compose: undefined, target: undefined, outDir: undefined, revision: undefined,
      author: undefined, members: undefined, sets: undefined, profiles: undefined, unsupported: undefined, unused: undefined, unusedOnly: undefined,
      sources: undefined, roots: undefined, source: undefined, adoptRoot: undefined, namespace: undefined, adoption: undefined, procedures: undefined,
      procedure: undefined, bypasses: undefined, bypassScope: undefined, bypassReason: undefined, ...prefixed('capture.', captureSkill.fixtures?.['No readings'] ?? {})}},

  folded: p => <Folded title={short(p.v)} light={light(p.v, p.owner)} readings={[`${reach(p.v, 5) === undefined ? NONE : reach(p.v, 5)} loaded`]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title={short(p.v)} mark={headMark(p.v)} view="compact" rack light={light(p.v, p.owner)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={244} part="chains"><ChainList p={p} size={8} columns={1} /></Section>
    <Section label="Repertoire" width={92} part="macros">
      <Compose p={p} />
      <Readout label="loaded" does="Members whose body entered the agent's context in this session." value={has(p.v, 'members') ? `${reaching(effective(p.v), 5)}/${members(p.v).length}` : undefined} tone="green" />
    </Section>
  </Panel>,

  whole: p => <SkillsWhole p={p} />,

  full: p => <SkillsFull p={p} />,

  widget: p => <Tile title={short(p.v)} light={light(p.v, p.owner)} span={2} onFull={p.nav.full}>
    <KindCounts v={p.v} size={28} />
    <div className="ref-tile-side">
      <Readout label="available" value={has(p.v, 'members') ? `${reaching(effective(p.v), 2)}/${members(p.v).length}` : undefined} />
      <Readout label="loaded" value={reach(p.v, 5)} tone="green" />
      <Readout label="invoked" value={reach(p.v, 6)} tone="green" />
    </div>
  </Tile>,
}
