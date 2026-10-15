// The Skillset rack (manual §19.6): a SkillSet is the repertoire an agent carries — Methodologies, Methods, Skills and child
// sets, each wearing its kind's woodcut mark in the set in use (icon-cut.html §7: the blade or the pen). Live's nearest: a rack
// and its chain list, with nested racks for child sets. Membership grants no trust, authority or loading, so the picture is
// the chain list with each member's evidence ladder: carried is not loaded, and loaded is not used. Every control here is an
// AIKit operation: enable or disable through the profile, the scope a composition applies at, preview then apply, package.
import {useState} from 'react'
import {WoodMark} from '../../sdk/marks'
import type {WoodSet} from '../../sdk/icons'
import {Action, Band, Chooser, Folded, Ladder, Panel, Radio, Readout, Rows, Section, Tile, type LightState, type RowItem} from '../../sdk/panel'
import {str, type DesignedDevice, type ViewProps} from './design'
import {DOCUMENTATION, FORM_NAME, ORDER, RUNGS, markState, reaching, type Member} from './practice'

type V = ViewProps['v']
const SCOPES = [{value: 'home', label: 'Home', does: 'Every session on this machine.'}, {value: 'project', label: 'Project', does: 'Every session in this project.'},
  {value: 'session', label: 'Session', does: 'This session only.'}] as const
const TARGETS = [{value: 'claude', label: 'Claude'}, {value: 'codex', label: 'Codex'}, {value: 'pi', label: 'Pi'}, {value: 'openai', label: 'OpenAI'}] as const
/** What a target cannot carry, from AIKit's target table (Pi has no MCP). */
const UNSUPPORTED: Record<string, number> = {claude: 0, codex: 0, pi: 1, openai: 0}

const marks = (v: V) => str(v, 'marks') as WoodSet
const requested = (v: V, m: Member) => v[`req:${m.id}`] !== false
const sorted = [...DOCUMENTATION].sort((a, b) => ORDER.indexOf(a.form) - ORDER.indexOf(b.form))
const effective = (v: V) => sorted.map(m => (requested(v, m) ? m : {...m, rungs: m.rungs.map((r, i) => (i < 2 ? r : false))}))

function chains(v: V): RowItem[] {
  return sorted.map(m => {
    const want = requested(v, m), state = markState(m, want)
    return {id: m.id, name: m.form === 'skillset' ? `${m.name} · ${m.holds}` : m.name, request: want,
      light: (state === 'whole' ? 'lit' : 'dark') as LightState, why: want ? m.withheld?.why : 'Turned off: your request, through the profile.',
      mark: <WoodMark kind={m.form} size={14} state={state} set={marks(v)} title={FORM_NAME[m.form]} />,
      meter: <Ladder rungs={want ? m.rungs : m.rungs.map((r, i) => (i < 2 ? r : false))} labels={RUNGS} label={m.name} />, note: m.rev}
  })
}

/** Your requests, the scope and the profile change the composition; Preview shows what would apply, Apply applies it. */
function Compose({p, stack = true}: {p: ViewProps; stack?: boolean}) {
  const state = str(p.v, 'compose')
  return <>
    <Radio label="Scope" does="Where the composition applies." value={str(p.v, 'scope')} options={SCOPES} stack={stack} onChange={x => { p.set('scope', x); p.set('compose', 'changed') }} />
    {state === 'previewed'
      ? <div className="ref-pair">
          <Action label="Apply" does="Apply the previewed composition. AIKit projects it into the harness trees." onPress={() => p.set('compose', 'applied')} />
          <Action label="Cancel" does="Keep the composition as it is." onPress={() => p.set('compose', 'changed')} />
        </div>
      : <Action label="Preview" does={state === 'changed' ? 'Show what the change would apply: members, withheld reasons, harness effects.' : 'Nothing has changed since the last apply.'}
          onPress={state === 'changed' ? () => p.set('compose', 'previewed') : undefined} pending={state === 'changed'} />}
  </>
}

function ChainList({p, size, columns}: {p: ViewProps; size: number; columns: 1 | 2}) {
  const [page, setPage] = useState(0)
  return <Rows label={`Members · ${reaching(effective(p.v), 2)} of ${sorted.length} available`}
    does="The square is your request. The mark is the member's kind, dim when withheld, orange when you can clear what holds it. The ticks are its evidence, carried to verified."
    items={chains(p.v)} onRequest={(id, x) => { p.set(`req:${id}`, x); p.set('compose', 'changed') }} size={size} page={page} onPage={setPage} columns={columns} />
}

/** The set by kind: each kind's mark and how many members it has. */
function KindCounts({v, size}: {v: V; size: number}) {
  return <div className="ref-kinds" data-size={size > 20 ? 'big' : undefined}>
    {ORDER.map(form => <span key={form} className="ref-kind" data-i={`${FORM_NAME[form]}s|${sorted.filter(m => m.form === form).length} in this set.`}>
      <WoodMark kind={form} size={size} set={marks(v)} /><b>{sorted.filter(m => m.form === form).length}</b>
    </span>)}
  </div>
}

const light = (v: V) => str(v, 'light') as LightState
const short = (v: V) => str(v, 'set').split(':')[1] ?? str(v, 'set')
const headMark = (v: V) => <WoodMark kind="skillset" size={14} set={marks(v)} title="Skillset" />

export const skills: DesignedDevice = {
  id: 'ai-kit:skillset-rack',
  title: 'Skillset rack',
  kind: 'rack',
  defaults: {light: 'lit', set: 'central:documentation', scope: 'project', profile: 'baseline', compose: 'applied', target: 'claude',
    marks: 'blade', revision: 'b3:9f2c41', author: 'Epi-Logos', 'req:experimental-development': false},
  fixtures: {'The blade': {marks: 'blade'}, 'The pen': {marks: 'pen'}},

  folded: p => <Folded title={short(p.v)} light={light(p.v)} readings={[`${reaching(effective(p.v), 5)} loaded`]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title={short(p.v)} mark={headMark(p.v)} view="compact" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={244}><ChainList p={p} size={8} columns={1} /></Section>
    <Section label="Repertoire" width={92}>
      <Compose p={p} />
      <Readout label="loaded" does="Members whose body entered the agent's context in this session." value={`${reaching(effective(p.v), 5)}/${sorted.length}`} tone="green" />
    </Section>
  </Panel>,

  whole: p => <Panel title={str(p.v, 'set')} mark={headMark(p.v)} view="whole" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full}>
    <Band>
      <Section label="Set" width={136}>
        <Chooser does="The set in the rack. Drag a set from the browser to replace it." value={str(p.v, 'set')}
          options={[{value: 'central:documentation', label: 'central:documentation'}, {value: 'central:core-development', label: 'central:core-development'}, {value: 'aikit:project-author', label: 'aikit:project-author'}]}
          onChange={x => { p.set('set', x); p.set('compose', 'changed') }} />
        <KindCounts v={p.v} size={18} />
        <div className="ref-pair">
          <Readout label="revision" does="A digest over the revisions of every member." value={str(p.v, 'revision')} />
          <Readout label="author" does="The set's author, from its package metadata." value={str(p.v, 'author')} />
        </div>
      </Section>
      <Section label="Compose" width={104}>
        <Compose p={p} />
        <Chooser label="Profile" does="The governance profile the composition applies under. Profiles keep their precedence." value={str(p.v, 'profile')}
          options={[{value: 'baseline', label: 'Baseline'}, {value: 'core', label: 'core'}, {value: 'review', label: 'review'}]} onChange={x => { p.set('profile', x); p.set('compose', 'changed') }} />
      </Section>
      <Section label="Package" grow>
        <Radio does="The harness to package the set for. The set itself does not change." value={str(p.v, 'target')} options={TARGETS} stack onChange={x => p.set('target', x)} />
        <Action label="Export" does="Write the native package and its receipt." onPress={() => p.set('exported', str(p.v, 'target'))} />
        <Readout label="unsupported" does="Relations the target cannot carry. The receipt names each one." value={UNSUPPORTED[str(p.v, 'target')]} tone={UNSUPPORTED[str(p.v, 'target')] ? 'stall' : undefined} />
      </Section>
    </Band>
    <Band>
      <Section grow><ChainList p={p} size={16} columns={2} /></Section>
    </Band>
  </Panel>,

  full: p => <div className="ref-pane-body ref-doc">
    <h3>{str(p.v, 'set')} <small>{str(p.v, 'revision')} · {sorted.length} members · applied at {str(p.v, 'scope')} scope</small></h3>
    {ORDER.map(form => <section key={form} className="ref-doc-kind">
      <h4><WoodMark kind={form} size={24} set={marks(p.v)} /> {FORM_NAME[form]}s</h4>
      <ol className="ref-doc-list">
        {sorted.filter(m => m.form === form).map(m => {
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

  widget: p => <Tile title={short(p.v)} light={light(p.v)} span={2} onFull={p.nav.full}>
    <KindCounts v={p.v} size={28} />
    <div className="ref-tile-side">
      <Readout label="available" value={`${reaching(effective(p.v), 2)}/${sorted.length}`} />
      <Readout label="loaded" value={reaching(effective(p.v), 5)} tone="green" />
      <Readout label="invoked" value={reaching(effective(p.v), 6)} tone="green" />
    </div>
  </Tile>,
}

