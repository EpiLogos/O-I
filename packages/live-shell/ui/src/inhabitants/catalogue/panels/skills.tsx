// The Skillset rack (manual §19.7): a SkillSet is the repertoire an agent carries — Methodologies, Methods, Skills and child
// sets, each wearing its kind's woodcut mark in the set in use (icon-cut.html §7: the blade or the pen). Live's nearest: a rack
// and its chain list, with nested racks for child sets. Membership grants no trust, authority or loading, so the picture is
// the chain list with each member's evidence ladder: carried is not loaded, and loaded is not used. Every control here is an
// AIKit operation: enable or disable through the profile, the scope a composition applies at, preview then apply, package.
import {useState} from 'react'
import {WoodMark} from '../../sdk/marks'
import type {WoodSet} from '../../sdk/icons'
import {Action, Band, Chooser, Folded, Ladder, Panel, Radio, Readout, Rows, Section, Tile, type LightState, type RowItem} from '../../sdk/panel'
import {NONE, grown, has, json, st, strOf, type DesignedDevice, type ViewProps} from './design'
import {DOCUMENTATION, FORM_NAME, ORDER, RUNGS, markState, reaching, type Member} from './practice'

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

function chains(v: V): RowItem[] {
  return members(v).map(m => {
    const want = requested(v, m), state = markState(m, want)
    return {id: m.id, name: m.form === 'skillset' ? `${m.name} · ${m.holds}` : m.name, request: want,
      light: (state === 'whole' ? 'lit' : 'dark') as LightState, why: want ? m.withheld?.why : 'Turned off: your request, through the profile.',
      mark: <WoodMark kind={m.form} size={14} state={state} set={marks(v)} title={FORM_NAME[m.form]} />,
      meter: <Ladder rungs={want ? m.rungs : m.rungs.map((r, i) => (i < 2 ? r : false))} labels={RUNGS} label={m.name} />, note: m.rev}
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
const MEMBER_WIDTH = 250, BESIDE_MEMBERS = 136 + 104 + 74 + 20
const memberColumns = (p: ViewProps): number => Math.min(6, Math.max(2, Math.floor(grown(p, 2 * MEMBER_WIDTH, BESIDE_MEMBERS) / MEMBER_WIDTH)))

function ChainList({p, size, columns}: {p: ViewProps; size: number; columns: number}) {
  const [page, setPage] = useState(0)
  const requests = st(p, 'members').disabled ? undefined : (id: string, x: boolean) => { p.set(`req:${id}`, x); p.set('compose', 'changed') }
  return <Rows label={has(p.v, 'members') ? `Members · ${reaching(effective(p.v), 2)} of ${members(p.v).length} available` : 'Members · no reading'}
    does="The square is your request. The mark is the member's kind, dim when withheld, orange when you can clear what holds it. The ticks are its evidence, carried to verified."
    items={chains(p.v)} onRequest={requests} size={size} page={page} onPage={setPage} columns={columns} />
}

/** The set by kind: each kind's mark and how many members it has. */
function KindCounts({v, size}: {v: V; size: number}) {
  return <div className="ref-kinds" data-size={size > 20 ? 'big' : undefined}>
    {ORDER.map(form => <span key={form} className="ref-kind" data-i={`${FORM_NAME[form]}s|${has(v, 'members') ? members(v).filter(m => m.form === form).length : NONE} in this set.`}>
      <WoodMark kind={form} size={size} set={marks(v)} /><b>{has(v, 'members') ? members(v).filter(m => m.form === form).length : NONE}</b>
    </span>)}
  </div>
}

// The light reads the owner alone; hollow while it has not said.
const light = (v: V, owner?: V) => (strOf(owner ?? v, 'light') ?? 'unknown') as LightState
const short = (v: V) => { const set = strOf(v, 'set'); return set === undefined ? NONE : set.split(':')[1] ?? set }
const headMark = (v: V) => <WoodMark kind="skillset" size={14} set={marks(v)} title="Skillset" />

export const skills: DesignedDevice = {
  id: 'ai-kit:skillset-rack',
  title: 'Skillset rack',
  kind: 'rack',
  defaults: {light: 'lit', set: 'central:documentation', scope: 'project', profile: 'baseline', compose: 'applied', target: 'claude',
    marks: 'blade', revision: 'b3:9f2c41', author: 'Epi-Logos', 'req:experimental-development': false,
    // The owner's material, as the binding supplies it: the members, the sets and profiles to choose from, what each target drops.
    members: JSON.stringify(DOCUMENTATION),
    sets: JSON.stringify(['central:documentation', 'central:core-development', 'aikit:project-author']),
    profiles: JSON.stringify(['baseline', 'core', 'review']),
    unsupported: JSON.stringify({claude: 0, codex: 0, pi: 1, openai: 0})},
  fixtures: {'The blade': {marks: 'blade'}, 'The pen': {marks: 'pen'},
    'No readings': {light: undefined, set: undefined, scope: undefined, profile: undefined, compose: undefined, target: undefined, revision: undefined,
      author: undefined, members: undefined, sets: undefined, profiles: undefined, unsupported: undefined}},

  folded: p => <Folded title={short(p.v)} light={light(p.v, p.owner)} readings={[`${reach(p.v, 5) === undefined ? NONE : reach(p.v, 5)} loaded`]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title={short(p.v)} mark={headMark(p.v)} view="compact" light={light(p.v, p.owner)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={244}><ChainList p={p} size={8} columns={1} /></Section>
    <Section label="Repertoire" width={92}>
      <Compose p={p} />
      <Readout label="loaded" does="Members whose body entered the agent's context in this session." value={has(p.v, 'members') ? `${reaching(effective(p.v), 5)}/${members(p.v).length}` : undefined} tone="green" />
    </Section>
  </Panel>,

  whole: p => <Panel title={strOf(p.v, 'set') ?? 'Skillset rack'} mark={headMark(p.v)} view="whole" light={light(p.v, p.owner)} onFold={p.nav.fold} onFull={p.nav.full}>
    <Band>
      <Section label="Set" width={136}>
        <Chooser {...st(p, 'set')} does="The set in the rack. Drag a set from the browser to replace it." value={strOf(p.v, 'set') ?? ''}
          options={options(p.v, 'sets')}
          onChange={x => { p.set('set', x); p.set('compose', 'changed') }} />
        <KindCounts v={p.v} size={18} />
        <div className="ref-pair">
          <Readout label="revision" does="A digest over the revisions of every member." value={strOf(p.v, 'revision')} />
          <Readout label="author" does="The set's author, from its package metadata." value={strOf(p.v, 'author')} />
        </div>
      </Section>
      <Section label="Compose" width={104}>
        <Compose p={p} />
        <Chooser label="Profile" does="The governance profile the composition applies under. Profiles keep their precedence." value={strOf(p.v, 'profile') ?? ''} {...st(p, 'profile')}
          options={options(p.v, 'profiles')} onChange={x => { p.set('profile', x); p.set('compose', 'changed') }} />
      </Section>
      <Section label="Package" grow>
        <Radio does="The harness to package the set for. The set itself does not change." value={strOf(p.v, 'target') ?? ''} options={TARGETS} {...st(p, 'target')} stack onChange={x => p.set('target', x)} />
        <Action {...st(p, 'exported')} label="Export" does="Write the native package and its receipt." onPress={has(p.v, 'target') ? () => p.set('exported', strOf(p.v, 'target')) : undefined} />
        <Readout label="unsupported" does="Relations the target cannot carry. The receipt names each one." value={unsupported(p.v)} tone={unsupported(p.v) ? 'stall' : undefined} />
      </Section>
    </Band>
    <Band>
      <Section grow><ChainList p={p} size={8 * memberColumns(p)} columns={memberColumns(p)} /></Section>
    </Band>
  </Panel>,

  full: p => <div className="ref-pane-body ref-doc">
    <h3>{strOf(p.v, 'set') ?? NONE} <small>{strOf(p.v, 'revision') ?? NONE} · {has(p.v, 'members') ? members(p.v).length : NONE} members · applied at {strOf(p.v, 'scope') ?? NONE} scope</small></h3>
    {!has(p.v, 'members') && <p className="ref-doc-lead">No reading of the members.</p>}
    {ORDER.map(form => <section key={form} className="ref-doc-kind">
      <h4><WoodMark kind={form} size={24} set={marks(p.v)} /> {FORM_NAME[form]}s</h4>
      <ol className="ref-doc-list">
        {members(p.v).filter(m => m.form === form).map(m => {
          const want = requested(p.v, m), state = markState(m, want)
          return <li key={m.id} data-dim={state !== 'whole' ? 'true' : undefined}>
            <WoodMark kind={m.form} size={14} state={state} set={marks(p.v)} />
            <b>{m.name}</b><span className="ref-doc-rev">{m.rev}</span>
            <span className="ref-doc-standing"><Ladder rungs={m.rungs} labels={RUNGS} label={m.name} /> {!want ? 'Turned off by you.' : m.withheld ? m.withheld.why : 'Available.'}</span>
            <p>{m.says}</p>
          </li>
        })}
      </ol>
    </section>)}
  </div>,

  widget: p => <Tile title={short(p.v)} light={light(p.v, p.owner)} span={2} onFull={p.nav.full}>
    <KindCounts v={p.v} size={28} />
    <div className="ref-tile-side">
      <Readout label="available" value={has(p.v, 'members') ? `${reaching(effective(p.v), 2)}/${members(p.v).length}` : undefined} />
      <Readout label="loaded" value={reach(p.v, 5)} tone="green" />
      <Readout label="invoked" value={reach(p.v, 6)} tone="green" />
    </div>
  </Tile>,
}

