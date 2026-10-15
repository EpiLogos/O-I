// The Skillset rack (manual §19.6): one chain for each skill, each with your request and AIKit's admit light, and four macros
// over all of them. Live's nearest: an Audio Effect Rack — the chain list with each chain's activator, and the macro dials.
// A rack's picture is its chain list; the light is AIKit's answer, the square is your request, and they can differ.
import {useState} from 'react'
import {Band, Chooser, Dial, Folded, Panel, Readout, Rows, Section, Tile, type LightState, type RowItem} from '../../sdk/panel'
import {num, pct, str, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']
const DEPTH = ['None', 'Unit', 'Unit + int.', 'Full'], REACH = ['Object', 'Scene', 'Expression', 'Central'], RISK = ['Low', 'Medium', 'High']

/** The set's skills (readings from AIKit, with your requests). */
const SKILLS: readonly {id: string; name: string; rev: string; admitted: boolean; why?: string; text: string}[] = [
  {id: 'engineering-methodology', name: 'Engineering method', rev: 'r7', admitted: true, text: 'Implement, repair, verify and land a change.'},
  {id: 'test-driven-development', name: 'Test first', rev: 'r3', admitted: true, text: 'Write the failing test before the code.'},
  {id: 'systematic-debugging', name: 'Systematic debugging', rev: 'r5', admitted: true, text: 'Find the cause before proposing a fix.'},
  {id: 'verification-before-completion', name: 'Verify before done', rev: 'r2', admitted: true, text: 'Run the proof before you say it is done.'},
  {id: 'requesting-code-review', name: 'Ask for review', rev: 'r4', admitted: false, why: 'Held back: a revision nobody has reviewed.', text: 'Ask a reviewer before you merge.'},
  {id: 'writing-plans', name: 'Write the plan', rev: 'r6', admitted: false, text: 'Turn a spec into steps before you touch code.'},
  {id: 'design-taste-frontend', name: 'Frontend taste', rev: 'r9', admitted: true, text: 'Hold an interface to a high visual standard.'},
  {id: 'brainstorming', name: 'Brainstorm', rev: 'r2', admitted: false, text: 'Open the space before you choose.'},
  {id: 'legacy-release', name: 'Legacy release', rev: 'r11', admitted: false, why: 'Held back: its author retired it.', text: 'The old release practice.'},
]

function chains(v: V): RowItem[] {
  return SKILLS.map(skill => {
    const request = v[`req:${skill.id}`] !== false
    const lit = request && skill.admitted
    return {id: skill.id, name: skill.name, request, light: (lit ? 'lit' : 'dark') as LightState, tone: 'green' as const,
      why: request && !skill.admitted ? skill.why ?? 'Held back by AIKit.' : undefined, note: skill.rev}
  })
}
const admitted = (v: V) => chains(v).filter(c => c.light === 'lit').length

function Macros({p}: {p: ViewProps}) {
  return <>
    <Dial label="Thorough" does="How exhaustive the skills are." value={num(p.v, 'thoroughness')} def={60} scale={{min: 0, max: 100}} format={pct} onChange={x => p.set('thoroughness', x)} />
    <Dial label="Tests" does="How deep the skills test." value={num(p.v, 'testDepth')} def={1} scale={{min: 0, max: 3, step: 1}} format={x => DEPTH[x]!} onChange={x => p.set('testDepth', x)} />
    <Dial label="Reach" does="How far beyond the scope the skills look." value={num(p.v, 'reach')} def={1} scale={{min: 0, max: 3, step: 1}} format={x => REACH[x]!} onChange={x => p.set('reach', x)} />
    <Dial label="Risk" does="How bold the skills are before they ask you." value={num(p.v, 'risk')} def={0} scale={{min: 0, max: 2, step: 1}} format={x => RISK[x]!} onChange={x => p.set('risk', x)} />
  </>
}

/** The chain list, paged. */
function ChainList({p, size, columns}: {p: ViewProps; size: number; columns: 1 | 2}) {
  const [page, setPage] = useState(0)
  return <Rows label={`Chains · ${admitted(p.v)} of ${SKILLS.length} lit`} does="The square is your request. The light is AIKit's answer. A dark chain with ! says why on hover."
    items={chains(p.v)} onRequest={(id, x) => p.set(`req:${id}`, x)} size={size} page={page} onPage={setPage} columns={columns} />
}

const light = (v: V) => str(v, 'light') as LightState
const title = (v: V) => `Skills · ${str(v, 'skillset')}`

export const skills: DesignedDevice = {
  id: 'ai-kit:skillset-rack',
  title: 'Skillset rack',
  kind: 'rack',
  defaults: {light: 'lit', skillset: 'build-lane', thoroughness: 60, testDepth: 1, reach: 1, risk: 0, steward: 'Flint', revision: 'r12', 'req:writing-plans': false, 'req:brainstorming': false},

  folded: p => <Folded title={title(p.v)} light={light(p.v)} readings={[`${admitted(p.v)} lit`]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title={title(p.v)} view="compact" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={168}><ChainList p={p} size={8} columns={1} /></Section>
    <Section label="Macros" cols={2}><Macros p={p} /></Section>
  </Panel>,

  whole: p => <Panel title={title(p.v)} view="whole" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full}>
    <Band>
      <Section label="Set" width={128}>
        <Chooser does="The set of skills in the rack. Drag a set from the browser to replace it." value={str(p.v, 'skillset')}
          options={[{value: 'build-lane', label: 'build-lane'}, {value: 'review-lane', label: 'review-lane'}, {value: 'docs-lane', label: 'docs-lane'}]} onChange={x => p.set('skillset', x)} />
        <div className="ref-pair">
          <Readout label="steward" does="Who looks after the set." value={str(p.v, 'steward')} />
          <Readout label="revision" does="The revision of the set in use." value={str(p.v, 'revision')} />
        </div>
        <Readout big label="admitted" does="Skills AIKit admits now, of all in the set." value={`${admitted(p.v)}/${SKILLS.length}`} tone="accent" />
      </Section>
      <Section label="Macros" cols={4} grow><Macros p={p} /></Section>
    </Band>
    <Band>
      <Section grow><ChainList p={p} size={16} columns={2} /></Section>
    </Band>
  </Panel>,

  full: p => <div className="ref-pane-body ref-doc">
    <h3>{str(p.v, 'skillset')} <small>{str(p.v, 'revision')} · steward {str(p.v, 'steward')}</small></h3>
    <ol className="ref-doc-list">
      {SKILLS.map(skill => {
        const chain = chains(p.v).find(c => c.id === skill.id)!
        return <li key={skill.id} data-dim={chain.light !== 'lit' ? 'true' : undefined}>
          <span className="dp-lamp" data-light={chain.light} />
          <b>{skill.name}</b><span className="ref-doc-rev">{skill.rev}</span>
          <span className="ref-doc-standing">{chain.light === 'lit' ? 'Admitted' : chain.request ? chain.why : 'Not requested'}</span>
          <p>{skill.text}</p>
        </li>
      })}
    </ol>
  </div>,

  widget: p => <Tile title={title(p.v)} light={light(p.v)} span={2} onFull={p.nav.full}>
    <div style={{width: 150}}><ChainList p={p} size={5} columns={1} /></div>
    <div className="ref-tile-grid ref-tile-grid--read">
      <Readout label="thorough" value={pct(num(p.v, 'thoroughness'))} />
      <Readout label="tests" value={DEPTH[num(p.v, 'testDepth')]} />
      <Readout label="reach" value={REACH[num(p.v, 'reach')]} />
      <Readout label="risk" value={RISK[num(p.v, 'risk')]} />
    </div>
  </Tile>,
}
