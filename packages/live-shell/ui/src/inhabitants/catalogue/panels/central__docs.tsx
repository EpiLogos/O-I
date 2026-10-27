// Docs (manual §18.5, central:docs): a project's own account of itself, on six tiers, with where each source stands. Live's nearest:
// Utility, an effect whose meaning is plain at a glance; the picture is a ladder of six rungs, tier 0 at the foot, each rung carrying
// four ticks — bound, recognised, holding, unmoved — lit where it is so, dark where it is not, hollow where nothing was read. It reads
// what passes along the world's track and changes nothing until you act (an effect's invariant). Making a document is opening the
// Document from a tier's row.
//
// The parts are the ones the Workspace's Self and Ground pages, Ground hygiene's Ground page and Impact's Meaning page drew first
// (central__workspace.tsx, central__ground-hygiene.tsx, central__impact.tsx), gathered here as the manual now gathers them.
//
// Owners, each reached by the kernel's invoke_action unless said:
//   sources   [{path, tier: 0–5 | null, rev?, kind?, hints?, recognised?: {provenance, standing} | false, meaning?: holds | missing |
//             wrong-relation | duplicate | stale | constitutive-flattening | none, mappings?: [{coordinate, implementation?, state, detail?}],
//             moved?: number, refusal?}]
//             The tier bindings and the unbound sources are Central's (`projectcentral.docs.inspect`: the six tier bindings and the
//             sources no tier holds); a document's kind is a tag on its source. Recognised is Central's (`projectcentral.ground.inspect`:
//             recognised_sources with provenance and standing; a source whose name suggests a vision, an intent, an experience or a
//             design waits, and so does a passage kept with Remember). Meaning is AIKit's project reflection (`aikit knowledge frame`,
//             aikit.project-reflection/v1: each mapping of the project's law, holds or how it does not); no law binds: none. Moved since
//             is the count of changes since the source was last read against the work (Central's change horizon). A source that cannot
//             be read carries the refusal in the owner's words and its readings stay empty.
//   root      {root, valid, checks: [{path, valid}]}  central.doctor: the parts every Central root must hold
//   scaffold  {project, present: [path], missing: [path]}  central.world.reproject.plan {project}: the world's ProjectCentral scaffold
//   account   {exists}  projectcentral.docs.inspect's aperture: whether the world has its account
//   ux        [{ref, source}]  the experiences the world means to give; ex [{ref, source, ux: [ref]}] the returns people wrote
// Settings: subject (subjects: the track's world and the folders and notes in it), tier, show (all | needs), provenance, standing,
//   refresh (manual | open), source (the source chosen), bindAs ('0'…'5' | 'ux' | 'ex').
// Acts, each on its own key: relate (JSON {as, source}: `projectcentral.docs.tier.relate`, `ux.relate`, `ex.relate`, held; only a person
//   binds a return), recognise (JSON {source, provenance, standing}: `projectcentral.ground.apply`, held; only a person recognises),
//   readNow (every reading again; Meaning's `aikit knowledge frame` has no kernel op yet), openSource (the source in the Document),
//   ensure (`projectcentral.docs.ensure`), reproject (`central.world.reproject.apply`), initRoot (`central.init`). Next is the hand's: it
//   points the tier and Relate at the next tier that has no source. Each act returns a receipt.
// A key the owner does not report is absent: its control draws "—", and the picture names the missing reading.
import {useState, type ReactNode} from 'react'
import {Action, Band, Chooser, Dial, Display, Folded, Ladder, Panel, Radio, Readout, Rows, Section, Tile, type LightState, type RowItem} from '../../sdk/panel'
import {NONE, json, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']
type Tick = boolean | null

// ------------------------------------------------------------------------------------------------ the vocabulary

const TIERS = [0, 1, 2, 3, 4, 5] as const
/** The six tiers (manual §18.5), and the short name a rung carries. */
const TIER_NAME = ['The originating ground', 'The intended experience', 'Design and capabilities', 'Architecture and contracts', 'Implementation', 'Evidence and returns'] as const
const TIER_SHORT = ['Ground', 'Experience', 'Design', 'Architecture', 'Implementation', 'Evidence'] as const
const READINGS = ['bound', 'recognised', 'holding', 'unmoved'] as const
const READING_SAYS = ['Bound to a tier.', 'Recognised as ground.', 'The code holds what it says.', 'Nothing moved since it was last read against the work.'] as const

type Holds = 'holds' | 'missing' | 'wrong-relation' | 'duplicate' | 'stale' | 'constitutive-flattening'
const HOLDS: readonly string[] = ['holds', 'missing', 'wrong-relation', 'duplicate', 'stale', 'constitutive-flattening']
const HOLDS_WORD: Readonly<Record<Holds, string>> = {holds: 'holds', missing: 'missing', 'wrong-relation': 'wrong relation', duplicate: 'twice', stale: 'stale', 'constitutive-flattening': 'flattened'}
const HOLDS_SAYS: Readonly<Record<Holds, string>> = {
  holds: 'The code holds the meaning by the relation the law names.',
  missing: 'The meaning names an implementation the project map does not hold.',
  'wrong-relation': 'The code is bound, but by another relation than the law names.',
  duplicate: 'More than one implementation claims the meaning where the law asks for one.',
  stale: 'The implementation has moved past the revision the meaning was checked against.',
  'constitutive-flattening': 'Two faces the law keeps apart are bound as one.',
}
const PROVENANCE = [{value: 'human-authored', label: 'Human-authored', does: 'You wrote it.'}, {value: 'human-edited-draft', label: 'Edited draft', does: 'A draft you edited.'},
  {value: 'human-adopted', label: 'Adopted', does: 'You adopt it as yours.'}] as const
const STANDING = [{value: 'authored-human-position', label: 'Your position', does: 'A position you hold.'}, {value: 'design-commitment', label: 'Design commitment', does: 'A commitment of the design.'},
  {value: 'architecture-contract', label: 'Architecture contract', does: 'A contract of the architecture.'}, {value: 'current-development-state', label: 'Current state', does: 'How the development stands now.'}] as const
const wordOf = (list: readonly {value: string; label: string}[], value: string | undefined) => (value === undefined ? undefined : list.find(o => o.value === value)?.label ?? value)
const SHOW = [{value: 'all', label: 'Everything', does: 'Every source of the tier.'}, {value: 'needs', label: 'Needs you', does: 'Hides the sources that are bound, recognised, holding and unmoved.'}] as const
const REFRESH = [{value: 'manual', label: 'Manual', does: 'Read again only when you press Read now.'}, {value: 'open', label: 'On open', does: 'Read again when Docs opens.'}] as const
const BIND_AS = [...TIERS.map(t => ({value: String(t), label: `Tier ${t}`, does: `Bind the source as tier ${t}: ${TIER_NAME[t].toLowerCase()}.`})),
  {value: 'ux', label: 'Intended experience', does: 'Bind a source you wrote or adopted as an experience the world means to give.'},
  {value: 'ex', label: 'Return', does: 'Bind a report of what an experience was like, against the experience it answers. Only a person binds a return.'}]

// ------------------------------------------------------------------------------------------------ what was read

interface Mapping {readonly coordinate: string; readonly implementation?: string; readonly state: Holds; readonly detail?: string}
interface Source {
  readonly path: string; readonly tier: number | null; readonly rev?: string; readonly kind?: string; readonly hints: readonly string[]
  readonly recognised?: {readonly provenance?: string; readonly standing?: string} | false
  readonly meaning?: Holds | 'none'; readonly mappings: readonly Mapping[]; readonly moved?: number; readonly refusal?: string
}
interface Ux {readonly ref: string; readonly source: string}
interface Ex {readonly ref: string; readonly source: string; readonly ux: readonly string[]}

const rec = (x: unknown): Record<string, unknown> | undefined => (x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : undefined)
const txt = (x: unknown): string | undefined => (typeof x === 'string' && x !== '' ? x : undefined)
const strs = (x: unknown): string[] => (Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string') : [])
const tail = (path: string) => path.split('/').filter(Boolean).pop() ?? path
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, Math.max(1, n - 1))}…` : s)

/** The sources the owners report, or undefined when none reports them. */
function sourcesOf(v: V): Source[] | undefined {
  const raw = json<unknown>(v, 'sources', undefined)
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap((x): Source[] => {
    const r = rec(x), path = txt(r?.path)
    if (!r || !path) return []
    const tier = typeof r.tier === 'number' && r.tier >= 0 && r.tier <= 5 ? r.tier : null
    const g = rec(r.recognised)
    return [{path, tier, rev: txt(r.rev), kind: txt(r.kind), hints: strs(r.hints),
      recognised: r.recognised === false ? false : g ? {provenance: txt(g.provenance), standing: txt(g.standing)} : undefined,
      meaning: r.meaning === 'none' ? 'none' : HOLDS.includes(r.meaning as string) ? r.meaning as Holds : undefined,
      mappings: (Array.isArray(r.mappings) ? r.mappings : []).flatMap((y): Mapping[] => { const m = rec(y), c = txt(m?.coordinate); return m && c && HOLDS.includes(m.state as string) ? [{coordinate: c, implementation: txt(m.implementation), state: m.state as Holds, detail: txt(m.detail)}] : [] }),
      moved: typeof r.moved === 'number' && Number.isFinite(r.moved) ? r.moved : undefined, refusal: txt(r.refusal)}]
  })
}

/** A source's four readings: lit where it is so, dark where it is not, null (hollow) where nothing was read. A refused source reads
 * nothing. */
function ticksOf(s: Source): readonly Tick[] {
  if (s.refusal) return [s.tier !== null, null, null, null]
  return [s.tier !== null, s.recognised === undefined ? null : s.recognised !== false, s.meaning === undefined || s.meaning === 'none' ? null : s.meaning === 'holds',
    s.moved === undefined ? null : s.moved === 0]
}
const needsYou = (s: Source) => !!s.refusal || ticksOf(s).some(t => t === false)
/** A tier's four readings, from its sources: dark where any source's is dark, lit where some are lit and none dark, hollow where nothing
 * was read. A tier with no source is unbound. */
function tierTicks(sources: readonly Source[], tier: number): readonly Tick[] {
  const here = sources.filter(s => s.tier === tier)
  if (!here.length) return [false, null, null, null]
  return [true, ...[1, 2, 3].map(i => { const ts = here.map(s => ticksOf(s)[i]); return ts.includes(false) ? false : ts.includes(true) ? true : null })]
}
const tierNeeds = (sources: readonly Source[], tier: number) => tierTicks(sources, tier).includes(false) || sources.some(s => s.tier === tier && !!s.refusal)
/** The first tier that needs you: the row Docs puts in front by default. */
const firstNeeding = (sources: readonly Source[] | undefined) => (sources ? TIERS.find(t => tierNeeds(sources, t)) : undefined)
const waitingOf = (sources: readonly Source[] | undefined) => (sources ? sources.filter(needsYou).length : undefined)
const tierOf = (v: V, sources: readonly Source[] | undefined): number | undefined => numOf(v, 'tier') ?? firstNeeding(sources)

function listOf<T>(v: V, key: string, keep: (r: Record<string, unknown>) => T | undefined): T[] | undefined {
  const raw = json<unknown>(v, key, undefined)
  return Array.isArray(raw) ? raw.flatMap(x => { const r = rec(x), y = r && keep(r); return y ? [y] : [] }) : undefined
}
const uxOf = (v: V) => listOf<Ux>(v, 'ux', r => (txt(r.ref) && txt(r.source) ? {ref: r.ref as string, source: r.source as string} : undefined))
const exOf = (v: V) => listOf<Ex>(v, 'ex', r => (txt(r.ref) && txt(r.source) ? {ref: r.ref as string, source: r.source as string, ux: strs(r.ux)} : undefined))

interface Part {readonly path: string; readonly present: boolean; readonly where: 'root' | 'world' | 'account'}
/** What every Central root and the world's ProjectCentral must hold, each part present or missing; undefined where nothing was read. */
function partsOf(v: V): {root?: Part[]; world?: Part[]; account?: Part} {
  const root = rec(json<unknown>(v, 'root', undefined)), scaffold = rec(json<unknown>(v, 'scaffold', undefined)), account = rec(json<unknown>(v, 'account', undefined))
  return {
    root: root && Array.isArray(root.checks) ? root.checks.flatMap(c => { const r = rec(c); return r && txt(r.path) ? [{path: r.path as string, present: r.valid === true, where: 'root' as const}] : [] }) : undefined,
    world: scaffold ? [...strs(scaffold.present).map(path => ({path, present: true, where: 'world' as const})), ...strs(scaffold.missing).map(path => ({path, present: false, where: 'world' as const}))] : undefined,
    account: account && typeof account.exists === 'boolean' ? {path: 'ProjectCentral/docs', present: account.exists, where: 'account'} : undefined,
  }
}
const missingOf = (v: V) => { const {root, world, account} = partsOf(v); return root || world || account ? [...(root ?? []), ...(world ?? []), ...(account ? [account] : [])].filter(x => !x.present).length : undefined }

// ------------------------------------------------------------------------------------------------ the picture

const TICK_FILL = (t: Tick) => (t === true ? 'var(--dp-value)' : t === false ? 'var(--dp-well)' : 'none')
const TICK_STROKE = (t: Tick) => (t === true ? 'var(--dp-value)' : t === false ? 'var(--stall)' : 'var(--text-faint)')

/** The ladder: six rungs, tier 0 at the foot. A rung carries its tier, its name and how many sources it holds, then four ticks — bound,
 * recognised, holding, unmoved. The rung in front is ringed. Press a rung to put it in front. */
function LadderWell({p, w, h, names, onRung}: {p: ViewProps; w: number; h: number; names: boolean; onRung?: (t: number) => void}) {
  const sources = sourcesOf(p.v), front = tierOf(p.v, sources), unbound = sources?.filter(s => s.tier === null).length
  const pitch = (h - 22) / 6, y = (t: number) => h - 6 - (t + 1) * pitch, size = Math.min(9, pitch - 7), tx = w - 4 * (size + 4) - 4
  return <Display w={w} h={h} label="The six tiers" corner={unbound === undefined ? NONE : `${unbound} unbound`}
    does="Six tiers, 0 at the foot. On each rung, four ticks: bound, recognised, holding, unmoved. Lit where it is so, dark where it is not, hollow where nothing was read. Press a rung to put it in front.">
    {!sources ? <text x={w / 2} y={h / 2} className="dp-ink-dim" textAnchor="middle">No reading of the account</text>
      : TIERS.map(t => {
        const ticks = tierTicks(sources, t), n = sources.filter(s => s.tier === t).length, yy = y(t), chosen = t === front
        return <g key={t} role={onRung ? 'button' : undefined} tabIndex={onRung ? 0 : undefined} style={onRung ? {cursor: 'pointer'} : undefined}
          aria-label={`Tier ${t}, ${TIER_SHORT[t]}`} data-i={`Tier ${t} · ${TIER_NAME[t]}|${n ? `${n} source${n === 1 ? '' : 's'}.` : 'No source is bound to this tier.'} ${ticks.map((x, i) => `${READINGS[i]} ${x === true ? 'yes' : x === false ? 'no' : '—'}`).join(' · ')}`}
          onClick={onRung ? () => onRung(t) : undefined} onKeyDown={onRung ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRung(t) } } : undefined}>
          <rect x={2} y={yy} width={w - 4} height={pitch - 2} fill={chosen ? 'color-mix(in srgb, var(--dp-on) 14%, transparent)' : 'transparent'} stroke={chosen ? 'var(--dp-on)' : 'none'} />
          <text x={7} y={yy + pitch / 2 + 2} className="dp-axis">{t}</text>
          {names && <text x={18} y={yy + pitch / 2 + 2} className={n ? 'dp-ink' : 'dp-ink-dim'}>{TIER_SHORT[t]}</text>}
          {names && <text x={tx - 8} y={yy + pitch / 2 + 2} className="dp-ink-dim" textAnchor="end">{n || ''}</text>}
          {ticks.map((x, i) => <rect key={i} x={(names ? tx : 18 + (w - 26 - 4 * (size + 4)) / 2) + i * (size + 4)} y={yy + (pitch - 2 - size) / 2} width={size} height={size}
            fill={TICK_FILL(x)} stroke={TICK_STROKE(x)} strokeDasharray={x === null ? '1.5 1.5' : undefined}
            data-i={`Tier ${t}: ${READINGS[i]}|${READING_SAYS[i]} ${x === true ? 'Yes, for every source read.' : x === false ? 'Not for every source.' : 'Nothing was read.'}`} />)}
        </g>
      })}
  </Display>
}

/** Make: the root's parts at the left, the world's ProjectCentral at the right, each filled where it stands and dashed where it is
 * missing; the account under the world's. */
function MakeWell({v, w, h}: {v: V; w: number; h: number}) {
  const {root, world, account} = partsOf(v), mid = w / 2, row = (i: number) => 34 + i * 13
  const worldParts = world || account ? [...(world ?? []), ...(account ? [account] : [])] : undefined
  const column = (parts: readonly Part[] | undefined, x: number, title: string, cap: number) => <g>
    <text x={x} y={14} className="dp-axis">{title}</text>
    {!parts ? <text x={x} y={row(0) + 3} className="dp-ink-dim">no reading</text> : parts.slice(0, cap).map((part, i) => <g key={part.path} data-i={`${part.path}|${part.present ? 'Present.' : 'Missing: Make adds it, and moves nothing.'}`}>
      <rect x={x} y={row(i) - 5} width={8} height={8} fill={part.present ? 'var(--dp-value)' : 'none'} stroke={part.present ? 'var(--dp-value)' : 'var(--stall)'} strokeDasharray={part.present ? undefined : '2 1.5'} />
      <text x={x + 12} y={row(i) + 3} className={part.present ? 'dp-ink-dim' : 'dp-ink'}>{cut(part.path.replace(/^Work\/[^/]+\//, '').replace(/^(Control|ProjectCentral)\/(?=.)/, ''), 15)}</text>
    </g>)}
    {parts && parts.length > cap && <text x={x} y={row(cap) + 3} className="dp-axis">+{parts.length - cap} more</text>}
  </g>
  return <Display w={w} h={h} label="Make" corner={missingOf(v) === undefined ? NONE : `${missingOf(v)} missing`}
    does="What the root and the world's ProjectCentral must hold. Filled: present. Dashed: missing, and Make adds it.">
    {column(root, 6, 'root', 8)}
    <path d={`M${mid - 3} 8V${h - 8}`} className="dp-faint" />
    {column(worldParts, mid + 3, 'world', 8)}
  </Display>
}

/** Returns: the experiences the world means to give, each with the returns people wrote against it. */
function ReturnsWell({v, w, h}: {v: V; w: number; h: number}) {
  const ux = uxOf(v), ex = exOf(v) ?? [], ex0 = w - 30
  return <Display w={w} h={h} label="Returns" corner={ux ? `${ex.length} return${ex.length === 1 ? '' : 's'}` : NONE}
    does="At the left, each experience the world means to give. At the right, the returns written against it.">
    {!ux ? <text x={w / 2} y={h / 2} className="dp-ink-dim" textAnchor="middle">No reading of the experiences</text>
      : !ux.length ? <text x={w / 2} y={h / 2} className="dp-ink-dim" textAnchor="middle">No intended experience is bound</text>
      : ux.slice(0, 6).map((u, i) => { const yy = 20 + i * 21, back = ex.filter(e => e.ux.includes(u.ref)); return <g key={u.ref} data-i={`${u.ref}|${u.source}: an experience the world means to give. ${back.length} return${back.length === 1 ? '' : 's'}.`}>
        <circle cx={10} cy={yy} r={4.5} fill="var(--dp-value)" />
        <text x={19} y={yy + 3} className="dp-ink">{cut(u.ref.replace(/^ux:/, ''), 20)}</text>
        {back.length ? back.slice(0, 3).map((e, k) => <g key={e.ref} data-i={`${e.ref}|${e.source}: a return written against ${u.ref}.`}>
          <path d={`M${ex0 - 40} ${yy}L${ex0 + k * 9 - 4} ${yy}`} stroke="var(--dp-value)" opacity={.6} />
          <rect x={ex0 + k * 9 - 3.5} y={yy - 3.5} width={7} height={7} fill="none" stroke="var(--dp-on)" strokeWidth={1.2} />
        </g>) : <text x={w - 6} y={yy + 3} className="dp-axis" textAnchor="end">none yet</text>}
      </g> })}
  </Display>
}

// ------------------------------------------------------------------------------------------------ the controls

const light = (p: ViewProps): LightState => (strOf(p.owner ?? p.v, 'light') ?? 'unknown') as LightState
const head = (p: ViewProps) => ({light: light(p), onFold: p.nav.fold, onFull: p.nav.full})
const span = (n: number, child: ReactNode) => <div style={{gridColumn: `span ${n}`, width: '100%'}}>{child}</div>

function TierDial({p}: {p: ViewProps}) {
  const sources = sourcesOf(p.v)
  return <Dial {...st(p, 'tier')} label="Tier" does="The row in front. By default, the first tier that needs you." value={tierOf(p.v, sources) ?? NaN} def={firstNeeding(sources)}
    scale={{min: 0, max: 5, step: 1}} format={t => `${t}`} onChange={x => p.set('tier', x)} />
}
const ShowRadio = ({p}: {p: ViewProps}) => <Radio {...st(p, 'show')} label="Show" does="Everything, or only what needs you." value={strOf(p.v, 'show') ?? ''} options={SHOW} stack onChange={x => p.set('show', x)} />
const RefreshRadio = ({p}: {p: ViewProps}) => <Radio {...st(p, 'refresh')} label="Refresh" does="When Docs reads again." value={strOf(p.v, 'refresh') ?? ''} options={REFRESH} onChange={x => p.set('refresh', x)} />
const StandingChooser = ({p}: {p: ViewProps}) => <Chooser {...st(p, 'standing')} label="Standing" wide does="What a source you recognise stands as." value={strOf(p.v, 'standing') ?? ''} options={STANDING} onChange={x => p.set('standing', x)} />
const ProvenanceChooser = ({p}: {p: ViewProps}) => <Chooser {...st(p, 'provenance')} label="Provenance" wide does="Who made a source you recognise." value={strOf(p.v, 'provenance') ?? ''} options={PROVENANCE} onChange={x => p.set('provenance', x)} />
function SubjectChooser({p}: {p: ViewProps}) {
  const subjects = strs(json<unknown>(p.v, 'subjects', [])), now = strOf(p.v, 'subject')
  return <Chooser {...st(p, 'subject')} label="Subject" wide does="Whose account Docs reads: the track's world, or a folder or note in it." value={now ?? ''}
    options={[...new Set([...(now ? [now] : []), ...subjects])].map(s => ({value: s, label: s}))} onChange={x => p.set('subject', x)} />
}

/** The rows of the tier in front, then the sources no tier holds: each with its kind, its four ticks and, refused, the owner's words. */
function sourceRows(v: V, sources: readonly Source[] | undefined, tier: number | undefined): RowItem[] {
  if (!sources) return [{id: 'none', name: 'No reading of the account', light: 'unknown'}]
  const needs = strOf(v, 'show') === 'needs'
  const shown = (s: Source) => !needs || needsYou(s)
  const row = (s: Source): RowItem => ({id: s.path, name: s.tier === null ? `${tail(s.path)} · unbound` : tail(s.path), light: s.refusal ? 'dark' : needsYou(s) ? 'dark' : 'lit', tone: 'value',
    note: s.kind ?? (s.hints.length ? s.hints[0] : undefined), why: s.refusal,
    does: `${s.path}${s.rev ? ` at ${s.rev}` : ''}.${s.recognised ? ` ${wordOf(PROVENANCE, s.recognised.provenance) ?? NONE}, ${wordOf(STANDING, s.recognised.standing) ?? NONE}.` : s.recognised === false ? ' Waits for you to recognise it.' : ''}${s.meaning && s.meaning !== 'none' ? ` Meaning: ${HOLDS_WORD[s.meaning]}. ${HOLDS_SAYS[s.meaning]}` : ''}${s.moved ? ` Moved ${s.moved} time${s.moved === 1 ? '' : 's'} since it was last read.` : ''}`,
    meter: <Ladder rungs={ticksOf(s)} labels={[...READINGS]} label="Bound, recognised, holding, unmoved" />})
  const here = tier === undefined ? [] : sources.filter(s => s.tier === tier && shown(s)).map(row)
  const loose = sources.filter(s => s.tier === null && shown(s)).map(row)
  return [...(here.length ? here : [{id: 'empty', name: tier === undefined ? NONE : `No source at tier ${tier}${needs && sources.some(s => s.tier === tier) ? ' needs you' : ''}`, light: 'unknown' as LightState}]), ...loose]
}

function TiersBands({p}: {p: ViewProps}) {
  const sources = sourcesOf(p.v), tier = tierOf(p.v, sources), chosen = sources?.find(s => s.path === strOf(p.v, 'source')), [page, setPage] = useState(0)
  const at = strOf(p.v, 'bindAs'), here = sources?.filter(s => s.tier === tier) ?? []
  const relateWhy = !sources ? 'No reading of the account.' : !chosen ? 'Choose an unbound source in the list.' : chosen.tier !== null ? 'The source is bound: choose an unbound one.' : !at ? 'Choose what to bind it as.'
    : at === 'ex' && !uxOf(p.v)?.length ? 'A return answers an intended experience: bind one first.' : undefined
  const recogniseWhy = !chosen ? 'Choose a source in the list.' : chosen.refusal ? 'The source cannot be read.' : chosen.recognised ? 'The source is recognised.'
    : !strOf(p.v, 'provenance') || !strOf(p.v, 'standing') ? 'Choose its provenance and its standing.' : undefined
  const next = sources ? TIERS.find(t => t > (tier ?? -1) && !sources.some(s => s.tier === t)) ?? TIERS.find(t => !sources.some(s => s.tier === t)) : undefined
  return <>
    <Band>
      <Section width={206}><LadderWell p={p} w={194} h={146} names onRung={t => p.set('tier', t)} /></Section>
      <Section label="Tier" cols={2} grow>
        {span(2, <SubjectChooser p={p} />)}
        <TierDial p={p} />
        <ShowRadio p={p} />
        {span(2, <RefreshRadio p={p} />)}
      </Section>
    </Band>
    <Band>
      <Section grow><Rows label={tier === undefined ? 'Sources' : `Tier ${tier} · ${TIER_NAME[tier]} · ${here.length} source${here.length === 1 ? '' : 's'}`}
        does="The sources of the tier in front, then those no tier holds. Four ticks on each: bound, recognised, holding, unmoved. Choose one to recognise it or relate it."
        items={sourceRows(p.v, sources, tier)} size={7} page={page} onPage={setPage} selected={chosen?.path} onSelect={id => { if (id !== 'none' && id !== 'empty') p.set('source', id) }} /></Section>
    </Band>
    <Band>
      <Section label="Recognise" width={150}>
        <ProvenanceChooser p={p} />
        <StandingChooser p={p} />
        <Action {...st(p, 'recognise')} hold label="Recognise" does="Records the source as the world's ground, with the provenance and the standing you chose. The document stays where it is, as it is."
          onPress={!recogniseWhy && chosen ? () => p.set('recognise', JSON.stringify({source: chosen.path, provenance: strOf(p.v, 'provenance'), standing: strOf(p.v, 'standing')})) : undefined}
          disabled={st(p, 'recognise').disabled ?? recogniseWhy} />
      </Section>
      <Section label="Relate" grow>
        <Chooser {...st(p, 'bindAs')} label="As" wide does="What the source becomes: one tier, an intended experience, or a return against one." value={at ?? ''} options={BIND_AS} onChange={x => p.set('bindAs', x)} />
        <div className="ref-pair">
          <Action {...st(p, 'relate')} hold label="Relate" does="Binds the source as chosen. Its bytes and its path stay, and its standing is recorded."
            onPress={!relateWhy ? () => p.set('relate', JSON.stringify({as: at, source: chosen!.path})) : undefined} disabled={st(p, 'relate').disabled ?? relateWhy} />
          <Action label="Next" does="Points at the next tier that has no source." onPress={next !== undefined ? () => { p.set('tier', next); p.set('bindAs', String(next)) } : undefined}
            disabled={!sources ? 'No reading of the account.' : next === undefined ? 'Every tier has a source.' : undefined} />
        </div>
        <Action {...st(p, 'readNow')} label="Read now" does="Reads each source against the code again." onPress={() => p.set('readNow', true)} />
      </Section>
    </Band>
  </>
}

function partRows(v: V): RowItem[] {
  const {root, world, account} = partsOf(v)
  if (!root && !world && !account) return [{id: 'none', name: 'No reading of the root or the world', light: 'unknown'}]
  const all = [...(root ?? []), ...(world ?? []), ...(account ? [account] : [])].sort((a, b) => Number(a.present) - Number(b.present))
  return all.map(x => ({id: `${x.where}:${x.path}`, name: x.path, light: x.present ? 'lit' as LightState : 'dark' as LightState, tone: x.present ? 'value' as const : 'stall' as const,
    note: x.present ? x.where : `missing · ${x.where}`, does: x.present ? 'Present.' : x.where === 'root' ? 'Initialise root adds it.' : x.where === 'account' ? 'Ensure gives the world its account.' : 'Reproject stamps it.'}))
}

function MakeBands({p}: {p: ViewProps}) {
  const {root, world, account} = partsOf(p.v), [page, setPage] = useState(0)
  const rootMissing = root?.filter(x => !x.present).length, worldMissing = world?.filter(x => !x.present).length
  return <>
    <Band>
      <Section width={206}><MakeWell v={p.v} w={194} h={146} /></Section>
      <Section label="Make" cols={2} grow>
        <Readout label="root" does="The parts every Central root must hold: missing, or all present." value={rootMissing === undefined ? undefined : rootMissing ? `${rootMissing} missing` : 'present'} tone={rootMissing ? 'stall' : 'green'} />
        <Readout label="world" does="The world's ProjectCentral scaffold: missing, or all present." value={worldMissing === undefined ? undefined : worldMissing ? `${worldMissing} missing` : 'present'} tone={worldMissing ? 'stall' : 'green'} />
        {span(2, <Readout label="account" does="Whether the world has its account of itself." value={account === undefined ? undefined : account.present ? 'present' : 'none yet'} tone={account?.present ? 'green' : 'stall'} />)}
        {span(2, <Action {...st(p, 'ensure')} label="Ensure" does="Gives the world its account where it has none. Nothing that is already there moves."
          onPress={account && !account.present ? () => p.set('ensure', true) : undefined} disabled={st(p, 'ensure').disabled ?? (!account ? 'No reading of the account.' : account.present ? 'The world has its account.' : undefined)} />)}
        {span(2, <Action {...st(p, 'reproject')} label="Reproject" does="Stamps the world's missing scaffold. It moves, renames and deletes nothing."
          onPress={worldMissing ? () => p.set('reproject', true) : undefined} disabled={st(p, 'reproject').disabled ?? (worldMissing === undefined ? 'No reading of the scaffold.' : worldMissing ? undefined : 'Nothing is missing.')} />)}
        {span(2, <Action {...st(p, 'initRoot')} label="Initialise root" does="Creates the root's missing parts: Control's user ground, governance, wiki and machines, the root's own state, and Work. It keeps what is there."
          onPress={rootMissing ? () => p.set('initRoot', true) : undefined} disabled={st(p, 'initRoot').disabled ?? (rootMissing === undefined ? 'No reading of the root.' : rootMissing ? undefined : 'Nothing is missing.')} />)}
      </Section>
    </Band>
    <Band>
      <Section grow><Rows label="What the root and the world must hold" does="Each part, missing first. Each act adds only what is missing and returns a receipt." items={partRows(p.v)} size={7} page={page} onPage={setPage} /></Section>
    </Band>
  </>
}

function returnRows(v: V): RowItem[] {
  const ux = uxOf(v), ex = exOf(v) ?? []
  if (!ux) return [{id: 'none', name: 'No reading of the experiences', light: 'unknown'}]
  if (!ux.length) return [{id: 'none', name: 'No intended experience is bound', light: 'dark'}]
  return ux.flatMap(u => [{id: u.ref, name: u.source, light: 'lit' as LightState, tone: 'value' as const, note: u.ref},
    ...ex.filter(e => e.ux.includes(u.ref)).map(e => ({id: e.ref, name: `↳ ${e.source}`, light: 'lit' as LightState, tone: 'accent' as const, note: 'return', does: `A return written against ${u.ref}.`}))])
}

function ReturnsBands({p}: {p: ViewProps}) {
  const ux = uxOf(p.v), ex = exOf(p.v), sources = sourcesOf(p.v), [page, setPage] = useState(0)
  const at = strOf(p.v, 'bindAs') === 'ex' ? 'ex' : 'ux', chosen = strOf(p.v, 'source'), loose = sources?.filter(s => s.tier === null) ?? []
  const why = !sources ? 'No reading of the account.' : !chosen || !loose.some(s => s.path === chosen) ? 'Choose a source no tier holds.' : at === 'ex' && !ux?.length ? 'A return answers an intended experience: bind one first.' : undefined
  return <>
    <Band>
      <Section width={206}><ReturnsWell v={p.v} w={194} h={146} /></Section>
      <Section label="Relate" cols={2} grow>
        <Readout label="experiences" does="The experiences the world means to give, each a source you wrote or adopted." value={ux?.length} tone="value" />
        <Readout label="returns" does="The returns people wrote against them." value={ex?.length} tone="accent" />
        {span(2, <Radio {...st(p, 'bindAs')} label="As" does="An experience the world means to give, or a return against one. Only a person binds a return." value={at}
          options={[{value: 'ux', label: 'Experience'}, {value: 'ex', label: 'Return'}]} onChange={x => p.set('bindAs', x)} />)}
        {span(2, <Chooser {...st(p, 'source')} label="Source" wide does="A source no tier holds yet." value={chosen && loose.some(s => s.path === chosen) ? chosen : ''}
          options={loose.map(s => ({value: s.path, label: tail(s.path)}))} onChange={x => p.set('source', x)} />)}
        {span(2, <Action {...st(p, 'relate')} hold label="Relate" does="Binds the source as chosen. Its bytes and its path stay, and its standing is recorded."
          onPress={!why ? () => p.set('relate', JSON.stringify({as: at, source: chosen})) : undefined} disabled={st(p, 'relate').disabled ?? why} />)}
      </Section>
    </Band>
    <Band>
      <Section grow><Rows label={ux ? `Experiences · ${ux.length}, returns · ${ex?.length ?? 0}` : 'Experiences'} does="Each experience the world means to give, and under it the returns written against it."
        items={returnRows(p.v)} size={7} page={page} onPage={setPage} /></Section>
    </Band>
  </>
}

type PageId = 'tiers' | 'make' | 'returns'
const PAGE_IDS: readonly PageId[] = ['tiers', 'make', 'returns']
const PAGE_LABEL: Readonly<Record<PageId, string>> = {tiers: 'Tiers', make: 'Make', returns: 'Returns'}
const pageOf = (p: ViewProps): PageId => (PAGE_IDS.includes(p.page as PageId) ? p.page as PageId : 'tiers')
/** A page's tab is dark while it holds something that needs you, lit when nothing does, hollow when nothing was read. */
function pageLight(v: V, id: PageId): LightState | undefined {
  if (id === 'tiers') { const s = sourcesOf(v); return s ? (TIERS.some(t => tierNeeds(s, t)) || s.some(x => x.tier === null) ? 'dark' : 'lit') : undefined }
  if (id === 'make') { const m = missingOf(v); return m === undefined ? undefined : m ? 'dark' : 'lit' }
  const ux = uxOf(v), s = sourcesOf(v)
  return ux ? (!ux.length || (s ?? []).some(x => x.tier === null && x.hints.some(h => h === 'desired-experience' || h === 'return')) ? 'dark' : 'lit') : undefined
}

// ------------------------------------------------------------------------------------------------ the pane

/** Full: the account at pane size — the six tiers as rows, each source with its tags and its four readings. Select a source to open it in
 * the Document; its Meaning shows the code it maps to, and where each mapping fails. */
function DocsPane({p}: {p: ViewProps}) {
  const sources = sourcesOf(p.v), picked = sources?.find(s => s.path === strOf(p.v, 'source'))
  const item = (s: Source) => <li key={s.path} data-dim={s.tier === null ? 'true' : undefined}>
    <span className="dp-lamp" data-light={needsYou(s) ? 'dark' : 'lit'} data-tone="value" />
    <b><button type="button" className="dp-row-select" style={{all: 'unset', cursor: 'pointer'}} aria-pressed={picked?.path === s.path}
      data-i={`${s.path}|Opens it in the Document.`} onClick={() => { p.set('source', s.path); p.set('openSource', s.path) }}>{tail(s.path)}</button></b>
    <span className="ref-doc-rev">{[s.kind, s.rev].filter(Boolean).join(' · ') || NONE}</span>
    <span className="ref-doc-standing"><Ladder rungs={ticksOf(s)} labels={[...READINGS]} label="Bound, recognised, holding, unmoved" />
      {s.refusal ? '' : s.recognised ? `${wordOf(PROVENANCE, s.recognised.provenance) ?? NONE} · ${wordOf(STANDING, s.recognised.standing) ?? NONE}` : s.recognised === false ? 'waits to be recognised' : NONE}
      {s.meaning && s.meaning !== 'none' ? ` · ${HOLDS_WORD[s.meaning]}` : ''}{s.moved ? ` · moved ${s.moved}` : ''}</span>
    {s.refusal && <p>{s.refusal}</p>}
    {picked?.path === s.path && s.mappings.length > 0 && <p>{s.mappings.map(m => `${m.coordinate} → ${m.implementation ?? 'no implementation'}: ${HOLDS_WORD[m.state]}${m.state === 'holds' ? '' : ` (${m.detail ?? HOLDS_SAYS[m.state]})`}`).join(' · ')}</p>}
  </li>
  return <div className="ref-pane-body">
    <div className="ref-pane-tabs" role="tablist" aria-label="Docs"><button type="button" role="tab" aria-selected="true">Docs · {strOf(p.v, 'subject') ?? NONE}</button></div>
    <div className="ref-doc">
      <h3>The account <small>{sources ? `${TIERS.filter(t => sources.some(s => s.tier === t)).length} of 6 tiers bound · ${waitingOf(sources)} need you` : 'no reading'}</small></h3>
      {!sources ? <p className="ref-doc-lead">No reading of the account.</p> : <>
        {TIERS.map(t => { const here = sources.filter(s => s.tier === t); return <section key={t} className="ref-doc-kind"><h4>Tier {t} · {TIER_NAME[t]}</h4>
          {here.length ? <ol className="ref-doc-list">{here.map(item)}</ol> : <p className="ref-doc-lead">No source yet.</p>}
        </section> })}
        {sources.some(s => s.tier === null) && <section className="ref-doc-kind"><h4>Unbound</h4><ol className="ref-doc-list">{sources.filter(s => s.tier === null).map(item)}</ol></section>}
      </>}
    </div>
  </div>
}

// ------------------------------------------------------------------------------------------------ the sample readings (defaults and fixtures only)

// O-I's account, as a sample: what each tier holds, the readings each source carries, and the sources no tier holds yet. The paths are
// O-I's own documents; the readings are a labelled sample, not a capture.
const DLW = 'packages/live-shell/ui/src/inhabitants/catalogue/panels'
const SOURCES = [
  {path: 'docs/VISION.md', tier: 0, rev: 'r12', kind: 'Vision', recognised: {provenance: 'human-authored', standing: 'authored-human-position'}, meaning: 'none', moved: 0},
  {path: 'docs/CANONICAL-PRODUCT-FIELD.md', tier: 0, rev: 'r4', kind: 'Intent', recognised: false, hints: ['purpose'], meaning: 'none', moved: 0},
  {path: 'docs/dlw/DLW.md', tier: 1, rev: 'r311', kind: 'Vision', recognised: {provenance: 'human-edited-draft', standing: 'design-commitment'}, meaning: 'stale', moved: 3, mappings: [
    {coordinate: '§18.2 Day', implementation: `${DLW}/day.tsx`, state: 'stale', detail: 'day.tsx moved after §18.2 was last read against it'},
    {coordinate: '§19.22 Prompt pads', implementation: `${DLW}/software-factory__prompt-pads.tsx`, state: 'stale'},
    {coordinate: '§10.10 Settings', implementation: `${DLW}/settings__window.tsx`, state: 'holds'}]},
  {path: 'docs/contracts/NARA-SPEECH-EXPERIENCE-V1.md', tier: 1, rev: 'r2', kind: 'Experience', recognised: false, hints: ['desired-experience'], meaning: 'holds', moved: 0},
  {path: 'desktop/cradle/docs/world-shell/WORLD-SHELL-DESIGN.md', tier: 2, rev: 'r58', kind: 'Design', recognised: {provenance: 'human-adopted', standing: 'design-commitment'}, meaning: 'holds', moved: 0},
  {path: 'suite/capability-matrix.json', tier: 2, rev: 'r40', kind: 'Capability matrix', recognised: {provenance: 'human-adopted', standing: 'current-development-state'}, meaning: 'missing', moved: 1, mappings: [
    {coordinate: 'S5 · the device SDK', state: 'missing', detail: 'no implementation of the gap finder is on the map'}]},
  {path: 'docs/ARCHITECTURE.md', tier: 3, rev: 'r9', kind: 'Architecture', recognised: {provenance: 'human-authored', standing: 'architecture-contract'}, meaning: 'holds', moved: 0},
  {path: 'desktop/cradle/docs/world-shell/wayfinder/DEVICE-SEMANTICS-LOCK.md', tier: 3, rev: 'r7', kind: 'Contract', recognised: {provenance: 'human-adopted', standing: 'architecture-contract'}, meaning: 'wrong-relation', moved: 0, mappings: [
    {coordinate: '§2 Live semantics', implementation: 'packages/live-shell/ui/src/inhabitants/sdk/semantics.ts', state: 'wrong-relation', detail: 'bound as a description, where the law names an implementation'}]},
  {path: 'docs/CONVERGENCE-AND-ACCEPTANCE.md', tier: 5, rev: 'r3', kind: 'Evidence', recognised: false, hints: ['evidence'], meaning: 'none', moved: 2},
  {path: 'docs/experience/DEVELOPER-FIELD.md', tier: null, rev: 'r5', hints: ['desired-experience']},
  {path: 'docs/cradle/03-UX-STATES.md', tier: null, rev: 'r6', hints: ['desired-experience']},
  {path: 'packages/live-shell/ui/src/inhabitants/sdk/DEVICE-SDK.md', tier: null, rev: 'r21', hints: ['design']},
]
const ROOT = {root: '/Users/admin/Central', valid: true, checks: ['Control/user', 'Control/agents/governance', 'Control/agents/wiki', 'Control/machines', '.central', 'Work'].map(path => ({path, valid: true}))}
const SCAFFOLD = ['ProjectCentral', 'ProjectCentral/project.json', 'ProjectCentral/user', 'ProjectCentral/agents/governance', 'ProjectCentral/agents/wiki', 'ProjectCentral/agents/wiki/wiki.json', 'ProjectCentral/relations']
const UX = [{ref: 'ux:hearing-it-together', source: 'docs/dlw/DLW.md#1-hearing-it-together'}, {ref: 'ux:speech', source: 'docs/contracts/NARA-SPEECH-EXPERIENCE-V1.md'}]
const EX = [{ref: 'ex:2026-10-20-live-12', source: 'ProjectCentral/user/returns/2026-10-20-live-12.md', ux: ['ux:hearing-it-together']},
  {ref: 'ex:2026-10-21-day', source: 'ProjectCentral/user/returns/2026-10-21-day.md', ux: ['ux:hearing-it-together']}]
const dump = (x: unknown) => JSON.stringify(x)

const DEFAULTS = {
  light: 'lit', subject: 'O-I', subjects: dump(['O-I', 'O-I/docs/dlw', 'O-I/packages/live-shell']), show: 'needs', provenance: 'human-authored', standing: 'design-commitment', refresh: 'open',
  source: 'docs/CANONICAL-PRODUCT-FIELD.md', bindAs: '4',
  // Readings: what the owners report, never set from here.
  sources: dump(SOURCES), root: dump(ROOT), scaffold: dump({project: 'O-I', present: SCAFFOLD.map(x => `Work/O-I/${x}`), missing: []}), account: dump({exists: true}),
  ux: dump(UX), ex: dump(EX),
}

export const design: DesignedDevice = {
  id: 'central:docs',
  title: 'Docs',
  kind: 'effect',
  firstPage: 'tiers',
  defaults: DEFAULTS,
  fixtures: {
    'O-I': {},
    'An old project': {subject: 'Point-Cloud-Demo', subjects: dump(['Point-Cloud-Demo']), source: undefined, bindAs: '0',
      sources: dump([{path: 'README.md', tier: null, rev: 'r1', hints: ['purpose']}, {path: 'docs/design.md', tier: null, rev: 'r1', hints: ['design']}]),
      scaffold: dump({project: 'Point-Cloud-Demo', present: ['ProjectCentral', 'ProjectCentral/project.json', 'ProjectCentral/user'].map(x => `Work/Point-Cloud-Demo/${x}`),
        missing: ['ProjectCentral/agents/governance', 'ProjectCentral/agents/wiki', 'ProjectCentral/relations'].map(x => `Work/Point-Cloud-Demo/${x}`)}),
      account: dump({exists: false}), ux: dump([]), ex: dump([])},
    'A source refused': {sources: dump([...SOURCES.slice(0, 6), {path: 'docs/architecture', tier: 3, kind: 'Architecture', refusal: 'The source is a folder: projectcentral.ground.inspect reads files only.'}, ...SOURCES.slice(6)])},
    Everything: {show: 'all'},
    'No readings': Object.fromEntries(Object.keys(DEFAULTS).map(k => [k, undefined])),
  },

  folded: p => {
    const sources = sourcesOf(p.v), first = firstNeeding(sources)
    return <Folded title="Docs" light={light(p)} onUnfold={p.nav.unfold} readings={[first === undefined ? NONE : `Tier ${first}`, sources ? `${waitingOf(sources)} wait` : NONE]} />
  },

  compact: p => <Panel title="Docs" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}><LadderWell p={p} w={140} h={146} names={false} onRung={t => p.set('tier', t)} /></Section>
    <Section label="Macros" cols={2} width={128}>
      <TierDial p={p} />
      <ShowRadio p={p} />
      {span(2, <StandingChooser p={p} />)}
      {span(2, <RefreshRadio p={p} />)}
    </Section>
  </Panel>,

  whole: p => <Panel title="Docs" view="whole" {...head(p)} page={pageOf(p)} onPage={p.setPage}
    pages={PAGE_IDS.map(id => ({id, label: PAGE_LABEL[id], light: pageLight(p.v, id)}))}>
    {pageOf(p) === 'make' ? <MakeBands p={p} /> : pageOf(p) === 'returns' ? <ReturnsBands p={p} /> : <TiersBands p={p} />}
  </Panel>,

  full: p => <DocsPane p={p} />,

  widget: p => {
    const sources = sourcesOf(p.v)
    return <Tile title="Docs" light={light(p)} span={2} onFull={p.nav.full}>
      <LadderWell p={p} w={112} h={104} names={false} onRung={t => { p.set('tier', t); p.nav.full?.() }} />
      <div className="ref-tile-side">
        <Readout big label="wait" does="Sources that need you: unbound, unrecognised, not holding, or moved." value={waitingOf(sources)} tone="accent" onPress={p.nav.full} />
        <Readout label="tier" does="The first tier that needs you." value={firstNeeding(sources)} />
      </div>
    </Tile>
  },
}
