// A member of a Skillset rack (manual §19.7): one Skill identity in three forms (ai-kit docs/PRAXIS-ARCHITECTURE.md §2), so one
// device with three faces. Every form is trusted, enabled and projected alike and climbs the same ladder of evidence; the face
// changes with what the form is for. A Skill shows where it reaches. A Method shows the path it composes, from claim to Return,
// and runs and proves through AIKit. A Methodology shows its field and which Method applies when. The fixtures are Central's
// own: documentation-reconciliation, docs-methodology, vision-authoring and reverse-recovery (a revision nobody has reviewed).
import {WoodMark} from '../../sdk/marks'
import type {WoodSet} from '../../sdk/icons'
import {Action, Band, Display, Folded, Ladder, Panel, Readout, Section, Tile, Toggle, type LightState} from '../../sdk/panel'
import {str, type DesignedDevice, type ViewProps} from './design'
import {DOCUMENTATION, FORM_ASKS, FORM_NAME, RUNGS, markState, type Member} from './practice'

type V = ViewProps['v']
const member = (v: V): Member => DOCUMENTATION.find(m => m.id === str(v, 'member'))!
const marks = (v: V) => str(v, 'marks') as WoodSet
const wanted = (v: V) => v.requested !== false
const reviewed = (v: V) => v.reviewed === true
/** The member as it stands now: your request, and a review you recorded, change what AIKit reports. */
function standing(v: V): Member {
  const m = member(v)
  if (!wanted(v)) return {...m, rungs: m.rungs.map((r, i) => (i < 2 ? r : false))}
  if (m.withheld?.fix === 'review' && reviewed(v)) return {...m, withheld: undefined, rungs: m.rungs.map((r, i) => (i === 2 || i === 4 ? true : r))}
  return m
}

/** The Method's path (its SKILL.md "Composes"): steps, not mandatory stages — a step whose layer is not touched is skipped. */
const PATHS: Record<string, readonly {step: string; uses: readonly string[]}[]> = {
  'documentation-reconciliation': [
    {step: 'changed source', uses: []}, {step: 'discovery', uses: ['knowledge-navigation']},
    {step: 'authoring', uses: ['vision-authoring', 'design-authoring', 'architecture-authoring']},
    {step: 'reconcile', uses: ['capability-matrices']}, {step: 'verify', uses: ['verification']}, {step: 'Return', uses: []},
  ],
}
/** The Methodology's table, "Methods and when each applies" (docs-methodology SKILL.md). */
const WHEN: Record<string, readonly [string, string][]> = {
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
const formOf = (id: string) => DOCUMENTATION.find(m => m.id === id)

function MarkAndLadder({v, w, h, tall}: {v: V; w: number; h: number; tall: boolean}) {
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
  if (m.withheld?.fix !== 'review' || reviewed(p.v)) return <Readout label="trust" does="The revision in use has been reviewed." value={reviewed(p.v) ? `${m.rev} reviewed` : 'trusted'} tone="green" />
  if (p.v.reviewAsk === true) return <div className="ref-pair">
    <Action label="Trust" does={`Record that you reviewed ${m.rev}. AIKit delivers it again.`} onPress={() => { p.set('reviewed', true); p.set('reviewAsk', undefined) }} />
    <Action label="Cancel" does="Leave the revision unseen." onPress={() => p.set('reviewAsk', undefined)} />
  </div>
  return <Action label="Review" does={m.withheld.why} onPress={() => p.set('reviewAsk', true)} pending />
}

/** What the form does: a Method runs and proves; a Methodology says whether it must be instantiated; a Skill shows its reach. */
function FormControls({p, primary}: {p: ViewProps; primary?: boolean}) {
  const m = standing(p.v)
  if (m.form === 'method') {
    const run = str(p.v, 'run')
    const runControl = run === 'asked'
        ? <div className="ref-pair">
            <Action label="Run" does="Preflight passed. Run the Method once, with a receipt." onPress={() => p.set('run', 'ran')} />
            <Action label="Cancel" does="Do not run it." onPress={() => p.set('run', 'idle')} />
          </div>
        : <Action label="Run…" does="Preflight first: a missing condition refuses the run before any effect, and names itself." onPress={m.rungs[2] ? () => p.set('run', 'asked') : undefined}
            disabled={m.rungs[2] ? undefined : 'Not available: it cannot run.'} />
    if (primary) return runControl
    return <>
      {runControl}
      <Action label="Prove" does="Verify the last run's receipt. A run that did not verify is refused." onPress={run === 'ran' ? () => p.set('proved', true) : undefined}
        disabled={run === 'ran' ? undefined : 'No run to prove yet.'} />
      <Readout label="last run" does="The receipt of the last run." value={run === 'ran' ? 'receipt' : '—'} />
      <Readout label="proved" does="Whether an independent check passed." value={p.v.proved === true ? 'yes' : '—'} tone={p.v.proved === true ? 'green' : undefined} />
    </>
  }
  if (m.form === 'methodology' && primary) return <Readout label="instantiate" does="For the act in hand: does this Methodology need to be instantiated, or does the invoked Skill carry enough?" value="needed" tone="accent" />
  if (m.form === 'skill' && primary) return <Readout label="projected" does="Harness trees it is projected into in this context." value="Claude · Pi" />
  if (m.form === 'methodology') return <>
    <Readout label="field" does="The field this practice orients." value="documentation" />
    <Readout label="methods" does="The Methods it points at." value={WHEN[m.id]?.length ?? 0} />
    <Readout label="instantiate" does="For the act in hand: does this Methodology need to be instantiated, or does the invoked Skill carry enough? AIKit answers per act." value="needed" tone="accent" />
  </>
  return <>
    <Readout label="projected" does="Harness trees it is projected into in this context." value="Claude · Pi" />
    <Readout label="carried by" does="Sets that carry it." value="2 sets" />
  </>
}

/** The Method's path: each step a node, the members it uses as marks beneath; dashed, because a step can be skipped. */
function PathDisplay({v, w, h}: {v: V; w: number; h: number}) {
  const path = PATHS[member(v).id]
  if (!path) return <Display w={w} h={h} label="Composes"><text x={8} y={20} className="dp-ink-dim">This Method names its path in its text.</text></Display>
  const x = (i: number) => 40 + i * (w - 80) / (path.length - 1), y = 40
  return <Display w={w} h={h} label="Composes" does="The path this Method composes, from claim to Return. A step whose layer is not touched is skipped.">
    <path d={`M${x(0)} ${y}H${x(path.length - 1)}`} className="dp-faint" strokeDasharray="3 3" />
    {path.map((s, i) => <g key={s.step}>
      <circle cx={x(i)} cy={y} r={4.5} className={i === 0 || i === path.length - 1 ? 'dp-curve-on' : 'dp-curve'} fill="var(--dp-well)" />
      <text x={x(i)} y={y - 11} className="dp-axis" textAnchor="middle">{s.step}</text>
      {s.uses.map((use, k) => {
        const used = formOf(use)
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
  const rows = WHEN[member(v).id] ?? []
  return <ul className="ref-when">
    {rows.map(([id, when]) => {
      const m = formOf(id)
      return <li key={id} data-i={`${id}|Select when: ${when}`}>
        {m && <WoodMark kind="method" size={14} state={markState(m)} set={marks(v)} />}<b>{id}</b><span>{when}</span>
      </li>
    })}
  </ul>
}

const light = (v: V) => (markState(standing(v), wanted(v)) === 'whole' ? 'lit' : 'dark') as LightState
const head = (v: V) => <WoodMark kind={member(v).form} size={14} state={markState(standing(v), wanted(v))} set={marks(v)} />
const enabled = (p: ViewProps) => <Toggle label="Enabled" does="Your request, through the profile in use. Turning it on grants no trust and loads nothing." on={wanted(p.v)} onChange={x => p.set('requested', x)} />

export const memberDevice: DesignedDevice = {
  id: 'ai-kit:skill-device',
  title: 'Skill · Method · Methodology',
  kind: 'effect',
  defaults: {member: 'documentation-reconciliation', marks: 'blade', run: 'idle'},
  fixtures: {
    Method: {member: 'documentation-reconciliation'},
    Methodology: {member: 'docs-methodology'},
    Skill: {member: 'vision-authoring'},
    'Unseen revision': {member: 'reverse-recovery'},
    'The pen': {member: 'documentation-reconciliation', marks: 'pen'},
  },

  folded: p => <Folded title={member(p.v).name} light={light(p.v)} readings={[FORM_NAME[member(p.v).form], member(p.v).rev]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title={member(p.v).name} mark={head(p.v)} view="compact" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
    <Section width={152}><MarkAndLadder v={p.v} w={140} h={146} tall={false} /></Section>
    <Section label={FORM_NAME[member(p.v).form]} width={112}>
      {enabled(p)}
      <Trust p={p} />
      <FormControls p={p} primary />
    </Section>
  </Panel>,

  whole: p => <Panel title={member(p.v).name} mark={head(p.v)} view="whole" light={light(p.v)} onFold={p.nav.fold} onFull={p.nav.full}>
    <Band>
      <Section width={196}><MarkAndLadder v={p.v} w={184} h={146} tall /></Section>
      <Section label="Standing" width={100}>
        {enabled(p)}
        <Trust p={p} />
        <Readout label="revision" does="The revision in use." value={member(p.v).rev} />
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
  </Panel>,

  full: p => {
    const m = standing(p.v)
    return <div className="ref-pane-body ref-doc">
      <h3><WoodMark kind={m.form} size={28} state={markState(m, wanted(p.v))} set={marks(p.v)} /> {m.name} <small>{FORM_NAME[m.form]} · {m.rev}</small></h3>
      <p className="ref-doc-lead">{m.form === 'skill' ? '' : `${m.form.toUpperCase()}: `}{m.says}</p>
      {m.form === 'method' && PATHS[m.id] && <ol className="ref-doc-steps">{PATHS[m.id]!.map(s => <li key={s.step}><b>{s.step}</b>{s.uses.length ? ` — ${s.uses.join(', ')}` : ''}</li>)}</ol>}
      {m.form === 'methodology' && <WhenTable v={p.v} />}
      <p className="ref-doc-standing"><Ladder rungs={m.rungs} labels={RUNGS} label={m.name} /> {m.withheld ? m.withheld.why : 'Available in this session.'}</p>
    </div>
  },

  widget: p => <Tile title={member(p.v).name} light={light(p.v)} onFull={p.nav.full}>
    <div className="ref-member-tile">
      <WoodMark kind={member(p.v).form} size={44} state={markState(standing(p.v), wanted(p.v))} set={marks(p.v)} />
      <Ladder rungs={standing(p.v).rungs} labels={RUNGS} label={member(p.v).name} />
      {member(p.v).form === 'method' ? <Action label="Run…" does="Preflight, then run once." onPress={() => p.set('run', 'asked')} />
        : <Readout label={FORM_NAME[member(p.v).form].toLowerCase()} value={member(p.v).rev} />}
    </div>
  </Tile>,
}
