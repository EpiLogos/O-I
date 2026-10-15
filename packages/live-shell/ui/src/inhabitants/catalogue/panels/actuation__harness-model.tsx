// The Agent device (manual §19.3, actuation:harness-model): the agent seated on a Factory session's chain. Live's nearest: Simpler or
// Operator — an instrument with a well that draws what it is doing, and a short row of macros. The well draws the agent's own
// readings: its face (the shell's agent face, agent/maskFace.ts), the turns used against the budget as a ruler, the effort as four
// rungs, where an interrupt lands, and the heartbeat needle on the shell's 90 s horizon (agent/agentRunModel.ts HEARTBEAT_HORIZON_MS).
import {memo, useLayoutEffect, useMemo, useState} from 'react'
import {Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Section, Tile, Toggle, ValueBox, type LightState} from '../../sdk/panel'
import {maskStatic} from '../../../agent/maskFace'
import {clampTo, num, on, str, type DesignedDevice, type ViewProps} from './design'
import './actuation__harness-model.css'

type V = ViewProps['v']
const EFFORTS = ['low', 'medium', 'high', 'max'] as const
type Effort = (typeof EFFORTS)[number]
const QUANTIZE = ['now', 'next tool', 'next turn'] as const
const QUANTIZE_SHORT = ['now', 'tool', 'turn'] as const
/** The shell calls a needle stalled once its last check-in is older than this (agent/agentRunModel.ts:93). */
const HORIZON = 90
const CAP = {min: 1, max: 40, step: 1}

const MODELS = ['model:claude-opus-4.8', 'model:claude-opus-4.5', 'model:claude-sonnet-4.6', 'model:claude-haiku-4.5', 'model:deepseek-v4-pro', 'model:gemini-3.1-pro-preview']
const HARNESSES = ['claude-code', 'codex', 'hermes', 'pi', 'zcode']

const light = (v: V) => str(v, 'light') as LightState
const effortAt = (v: V) => Math.max(0, EFFORTS.indexOf(str(v, 'effort') as Effort))
const quantizeAt = (v: V) => Math.max(0, QUANTIZE.indexOf(str(v, 'quantize') as (typeof QUANTIZE)[number]))
const needle = (v: V): 'live' | 'stalled' | 'idle' => (num(v, 'age') < 0 ? 'idle' : num(v, 'age') >= HORIZON ? 'stalled' : 'live')
const turnsLine = (v: V) => `${num(v, 'used') < 0 ? '—' : num(v, 'used')} / ${num(v, 'cap')}`
const stateWord = (v: V) => (light(v) === 'unknown' ? 'not read' : light(v) === 'dark' ? 'benched' : needle(v) === 'live' ? 'working' : needle(v))
const checkIn = (v: V) => (num(v, 'age') < 0 ? 'none' : `${num(v, 'age')} s`)
const model = (v: V) => str(v, 'model').replace('model:', '')

const SAYS = {
  effort: 'How hard the agent thinks in each turn. Drag handle 1 across the rungs.',
  budget: 'The turns the agent may use for one task. Drag handle 2 along the ruler.',
  input: 'Steer: what you send reaches the turn that runs. Queue: it waits as the next task.',
  interrupt: 'Where a Stop or a Steer lands: now, at the next tool, or at the next turn.',
  heartbeat: 'The agent checks in on a beat. Each check-in moves the needle.',
}

// ---------------------------------------------------------------- the face

/** The face colours resolved from the shell's tokens: the mask mixes hex values, so it needs the token's value, not its name. */
function useFaceColours() {
  const [colours, setColours] = useState({ink: 'var(--fizz)', ground: 'var(--bg-0)'})
  useLayoutEffect(() => {
    const style = getComputedStyle(document.documentElement)
    const hex = (name: string, fallback: string) => { const x = style.getPropertyValue(name).trim(); return /^#[0-9a-f]{6}$/i.test(x) ? x : fallback }
    setColours({ink: hex('--fizz', 'var(--fizz)'), ground: hex('--bg-0', 'var(--bg-0)')})
  }, [])
  return colours
}

/** The agent's face at rest, as the shell's agent device draws it. Dim when the agent is benched. */
const Face = memo(function Face({x, y, size, dim}: {x: number; y: number; size: number; dim: boolean}) {
  const {ink, ground} = useFaceColours()
  const html = useMemo(() => maskStatic('think', ink, ink, size, ground), [ink, ground, size])
  return <g transform={`translate(${x} ${y})`} opacity={dim ? 0.4 : 1} dangerouslySetInnerHTML={{__html: html}} />
})

// ---------------------------------------------------------------- the well

/** The well: face and name, the turn ruler (its end is the budget), the effort rungs, the interrupt scale, the needle. */
function AgentWell({v, set, w, h, size}: {v: V; set?: ViewProps['set']; w: number; h: number; size: 'mini' | 'compact' | 'whole'}) {
  const mini = size === 'mini', whole = size === 'whole'
  const cap = num(v, 'cap'), used = num(v, 'used'), effort = effortAt(v), q = quantizeAt(v), state = needle(v), beating = on(v, 'heartbeat')
  const fs = mini ? 24 : whole ? 36 : 34, nameX = 7 + fs + 8
  // the ruler: one tick per turn on a fixed 40-turn axis, so the budget reads as a length
  const pitch = (w - 14) / CAP.max, rulerY = mini ? 54 : 68, tickH = mini ? 8 : 10
  // the effort rungs and the interrupt scale
  const rw = whole ? 16 : mini ? 10 : 12, gp = whole ? 4 : 3, baseY = mini ? 78 : 110, rungH = mini ? [4, 7, 10, 13] : [6, 11, 16, 21]
  const rungX = (i: number) => 7 + i * (rw + gp)
  const sx0 = whole ? 104 : 80, sx1 = w - 14, markX = (i: number) => sx0 + i * (sx1 - sx0) / 2
  // the needle: the age of the last check-in along the shell's 90 s horizon
  const needleY = mini ? h - 18 : 130, nx = 7 + (w - 14) * Math.min(Math.max(num(v, 'age'), 0), HORIZON) / HORIZON
  const IY = 102
  const needleColour = state === 'stalled' ? 'var(--stall)' : 'var(--dp-value)'
  return <Display w={w} h={h} label="The agent"
    does={mini ? 'The agent, its turns against the budget, and the needle.' : 'The agent, its turns against the budget, its effort and where an interrupt lands. Drag the handles to set them.'}
    corner={mini ? undefined : whole ? `${turnsLine(v)} turns` : turnsLine(v)}>
    <Face x={7} y={mini ? 4 : 6} size={fs} dim={light(v) !== 'lit'} />
    <text x={nameX} y={mini ? 17 : 29} className="dp-ink" style={{fontSize: mini ? 10.5 : 11.5, fontWeight: 600}}>{str(v, 'agent')}</text>
    <text x={nameX} y={mini ? 28 : 42} className="dp-ink-dim">{str(v, 'harness')}</text>
    {whole && <text x={nameX} y={54} className="dp-axis">{model(v)}</text>}

    {/* turns: used ticks lit, the rest dark, the axis running on to 40 */}
    <text x={7} y={rulerY - 3} className="dp-axis">{used < 0 ? 'turns used not read' : 'turns'}</text>
    {Array.from({length: cap}, (_, i) => <rect key={i} x={7 + i * pitch + 0.5} y={rulerY} width={Math.max(1.2, pitch - 1)} height={tickH}
      className={i < used ? undefined : 'dp-faint'} fill={i < used ? 'var(--dp-value)' : 'none'} />)}
    <path d={`M7 ${rulerY + tickH + 2}H${7 + CAP.max * pitch}`} className="dp-grid" />
    {!mini && set && <Handle n={2} shape="square" x={7 + cap * pitch} y={rulerY + tickH / 2} label="Budget" does="Drag along the ruler: the turns the agent may use for one task."
      onDrag={x => set('cap', Math.round(clampTo(CAP.min, CAP.max, (x - 7) / pitch)))} onReset={() => set('cap', 12)} />}

    {/* effort: four rungs, lit up to the chosen one */}
    {!mini && <text x={7} y={91} className="dp-axis">effort</text>}
    {rungH.map((rh, i) => <g key={i}>
      <rect x={rungX(i) + 0.5} y={baseY - rh} width={rw - 1} height={rh} className={i <= effort ? undefined : 'dp-faint'} fill={i <= effort ? 'var(--dp-value)' : 'none'}
        opacity={i <= effort ? (0.45 + i * 0.18) : 1} />
      {whole && <text x={rungX(i) + rw / 2} y={baseY + 10} className="dp-axis" textAnchor="middle" style={{fontSize: 7.5}}>{['low', 'med', 'high', 'max'][i]}</text>}
    </g>)}
    {!mini && set && <Handle n={1} shape="ring" x={rungX(effort) + rw / 2} y={baseY - rungH[effort]! - 7} label="Effort" does="Drag across the rungs: how hard the agent thinks in each turn."
      onDrag={x => set('effort', EFFORTS[Math.round(clampTo(0, 3, (x - 7 - rw / 2) / (rw + gp)))]!)} onReset={() => set('effort', 'high')} />}

    {/* interrupt: where a Stop or a Steer lands, left to right from now to the next turn */}
    {!mini && <>
      <text x={sx0 - 4} y={91} className="dp-axis">interrupt</text>
      <path d={`M${sx0} ${IY}H${sx1}`} className="dp-faint" />
      {QUANTIZE_SHORT.map((word, i) => <g key={word}>
        <path d={`M${markX(i)} ${IY - 5}V${IY + 5}`} className="dp-faint" />
        <text x={markX(i)} y={baseY + 10} className="dp-axis" textAnchor="middle" style={{fontSize: 7.5}}>{word}</text>
      </g>)}
      <circle cx={markX(q)} cy={IY} r={3.5} fill="var(--dp-on)" />
      {whole && set && <Handle n={3} x={markX(q)} y={IY} label="Interrupt" does="Drag along the line: where a Stop or a Steer lands."
        onDrag={x => set('quantize', QUANTIZE[Math.round(clampTo(0, 2, (x - sx0) / ((sx1 - sx0) / 2)))]!)} onReset={() => set('quantize', 'next tool')} />}
    </>}

    {/* the needle: the last check-in, on a line that ends at the stall horizon */}
    <path d={`M7 ${needleY}H${w - 7}M7 ${needleY - 3}v6M${w - 7} ${needleY - 3}v6`} className="dp-faint" />
    {state !== 'idle' && <path d={`M${nx} ${needleY - 5}V${needleY + 4}`} stroke={needleColour} strokeWidth={2} strokeDasharray={beating ? undefined : '2 2'} opacity={beating ? 1 : 0.55} />}
    <text x={7} y={needleY + 11} className="dp-axis">
      {!beating ? 'heartbeat off' : state === 'idle' ? 'no check-in' : state === 'stalled' ? (mini ? `stalled · ${num(v, 'age')} s` : `stalled · last check-in ${num(v, 'age')} s`) : `check-in ${num(v, 'age')} s ago`}
    </text>
    {whole && <text x={w - 7} y={needleY + 11} className="dp-axis" textAnchor="end">{HORIZON} s</text>}
  </Display>
}

// ---------------------------------------------------------------- the controls

const effortDial = (p: ViewProps) => <Dial label="Effort" does={SAYS.effort} value={effortAt(p.v)} def={2} scale={{min: 0, max: 3, step: 1}} format={i => EFFORTS[Math.round(i)]!}
  onChange={i => p.set('effort', EFFORTS[Math.round(i)]!)} heldBy={str(p.v, 'effortHeld') || undefined} onHandBack={() => p.set('effortHeld', '')} />
const budgetBox = (p: ViewProps) => <ValueBox label="Budget" does={SAYS.budget} value={num(p.v, 'cap')} def={12} scale={CAP} format={x => `${Math.round(x)}`} onChange={x => p.set('cap', Math.round(x))} />
const inputRadio = (p: ViewProps, label?: string) => <Radio label={label} does={SAYS.input} value={str(p.v, 'input')} stack onChange={x => p.set('input', x)}
  options={[{value: 'steer', label: 'Steer', does: 'What you send reaches the turn that runs.'}, {value: 'queue', label: 'Queue', does: 'What you send waits as the next task.'}]} />
const interruptDial = (p: ViewProps) => <Dial label="Interrupt" does={SAYS.interrupt} value={quantizeAt(p.v)} def={1} scale={{min: 0, max: 2, step: 1}} format={i => QUANTIZE_SHORT[Math.round(i)]!}
  onChange={i => p.set('quantize', QUANTIZE[Math.round(i)]!)} />
const head = (p: ViewProps) => ({light: light(p.v), onLight: () => p.set('light', light(p.v) === 'lit' ? 'dark' : 'lit'), onFold: p.nav.fold, onFull: p.nav.full})

// ---------------------------------------------------------------- the thread, in the pane

function Thread({v}: {v: V}) {
  const agent = str(v, 'agent'), stalled = needle(v) === 'stalled', steering = str(v, 'input') === 'steer', sent = str(v, 'sent') || 'Skip the cradle root. Nothing changed there.'
  return <div className="hm-pane">
    <div className="hm-pane-head" aria-label="The thread's agent">
      <b>{agent}</b><span>{model(v)}</span><span>{str(v, 'harness')}</span><span>effort {str(v, 'effort')}</span><span>turn {num(v, 'used') < 0 ? '—' : num(v, 'used')} of {num(v, 'cap')}</span>
      <span data-state={needle(v) === 'stalled' ? 'stalled' : undefined}>{stateWord(v)}</span>
    </div>
    <div className="hm-thread" role="log" aria-label="Thread">
      <div className="hm-row"><span className="hm-who">you</span><p className="hm-text">Type-check the three TypeScript roots and fix what the last change broke.</p></div>
      <div className="hm-row"><span className="hm-who" data-agent="true">{agent}</span><p className="hm-text">I will read the shell's agent context first, then run the type-check on each root.</p></div>
      <div className="hm-row"><span className="hm-who">tool</span><div className="hm-tool"><i /><b>Read</b><span>src/agent/AgentShellContext.tsx</span></div></div>
      <div className="hm-row"><span className="hm-who">tool</span><div className="hm-tool"><i /><b>Grep</b><span>harness_agent_control · 6 matches</span></div></div>
      <div className="hm-row"><span className="hm-who">tool</span><div className="hm-tool" data-state={stalled ? 'waits' : needle(v) === 'live' ? 'runs' : undefined}><i /><b>Bash</b><span>tsc --noEmit -p packages/live-shell/ui</span></div></div>
      <div className="hm-row"><span className="hm-who">you</span><div className="hm-steer"><span>{sent}</span><small>{steering ? `steer · lands at ${str(v, 'quantize')}` : 'queued · runs as the next task'}</small></div></div>
      <div className="hm-row"><span className="hm-who" data-agent="true">{agent}</span>
        <div className="hm-card"><b>Proposal · add the model row to the agent device</b><small>agentParamAddresses.ts · autonomy {str(v, 'autonomy')}</small></div></div>
      {stalled && <div className="hm-row"><span className="hm-who">stall</span>
        <div className="hm-card" data-kind="stall"><b>Stalled</b><small>Bash · tsc --noEmit waits for output. The last check-in was {num(v, 'age')} s ago.</small></div></div>}
    </div>
  </div>
}

// ---------------------------------------------------------------- the device

export const design: DesignedDevice = {
  id: 'actuation:harness-model',
  title: 'Agent',
  kind: 'instrument',
  defaults: {
    light: 'lit', effort: 'high', effortHeld: '', cap: 12, input: 'steer', quantize: 'next tool', heartbeat: true,
    model: 'model:claude-sonnet-4.6', harness: 'claude-code', draft: '', sent: '',
    // Readings: what the owners report, never set from here.
    agent: 'Flint', autonomy: 'review', used: 7, age: 6,
  },
  fixtures: {
    Working: {},
    Stalled: {age: 140},
    'Queued, no check-in': {input: 'queue', used: 0, age: -1, heartbeat: false},
    'Agent moved Effort': {effort: 'max', effortHeld: 'Flint'},
    Benched: {light: 'dark', age: -1},
    'Not read': {light: 'unknown', used: -1, age: -1},
  },

  folded: p => <Folded title="Agent" light={light(p.v)} readings={[str(p.v, 'agent'), turnsLine(p.v).replace(/ /g, '')]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Agent" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <AgentWell v={p.v} set={p.set} w={140} h={146} size="compact" />
    </Section>
    <Section label="Macros" cols={2}>
      {effortDial(p)}
      {budgetBox(p)}
      {inputRadio(p)}
      {interruptDial(p)}
    </Section>
  </Panel>,

  whole: p => <Panel title="Agent" view="whole" {...head(p)}>
    <Band>
      <Section width={206}>
        <AgentWell v={p.v} set={p.set} w={194} h={146} size="whole" />
      </Section>
      <Section label="Effort" cols={2}>
        {effortDial(p)}
        {budgetBox(p)}
        <Readout label="used" does="The turns the agent has used on this task." value={num(p.v, 'used') < 0 ? '—' : num(p.v, 'used')} tone="value" />
        <Readout label="autonomy" does="What the agent may do alone. Custody sets it; you read it here." value={str(p.v, 'autonomy')} />
      </Section>
      <Section label="Input" grow>
        {inputRadio(p)}
        <Radio label="Interrupt" does={SAYS.interrupt} value={str(p.v, 'quantize')} stack onChange={x => p.set('quantize', x)}
          options={QUANTIZE.map(q => ({value: q, label: q, does: q === 'now' ? 'A Stop or a Steer lands at once.' : q === 'next tool' ? 'It lands when the running tool ends.' : 'It lands when the turn ends.'}))} />
      </Section>
    </Band>
    <Band>
      <Section label="Identity" width={198}>
        <Readout label="agent" does="Who the agent is. Drag another agent from the browser here to replace it." value={str(p.v, 'agent')} />
        <Chooser label="Model" does="The model for this session." value={str(p.v, 'model')} options={MODELS.map(m => ({value: m, label: m.replace('model:', '')}))} onChange={x => p.set('model', x)} />
        <Chooser label="Harness" does="The program that runs the agent." value={str(p.v, 'harness')} options={HARNESSES.map(h => ({value: h, label: h}))} onChange={x => p.set('harness', x)} />
      </Section>
      <Section label="Heartbeat" cols={3} grow>
        <Toggle label="Beat" does={SAYS.heartbeat} on={on(p.v, 'heartbeat')} onChange={x => p.set('heartbeat', x)} />
        <Readout label="needle" does="Live while the agent checked in within 90 s. Stalled after that." value={needle(p.v)} tone={needle(p.v) === 'stalled' ? 'stall' : 'value'} />
        <Readout label="check-in" does="The time since the agent's last check-in." value={checkIn(p.v)} />
      </Section>
    </Band>
  </Panel>,

  full: p => <Thread v={p.v} />,

  widget: p => <Tile title={`Agent · ${str(p.v, 'agent')}`} light={light(p.v)} span={2} onFull={p.nav.full}>
    <AgentWell v={p.v} w={104} h={100} size="mini" />
    <div className="hm-tile-side">
      <p className="hm-last" aria-live="polite">{needle(p.v) === 'stalled' ? <><b>Bash</b> waits for output.</>
        : str(p.v, 'sent') ? <><b>you</b> {str(p.v, 'sent')}</> : <><b>{str(p.v, 'agent')}</b> Reading the shell's agent context.</>}</p>
      <div className="hm-tile-reads">
        <Readout label="state" does="What the agent does now." value={stateWord(p.v)} tone={needle(p.v) === 'stalled' ? 'stall' : 'value'} />
        <Readout label="turns" does="Turns used of turns allowed." value={turnsLine(p.v)} />
        <Readout label="effort" does="How hard the agent thinks in each turn." value={str(p.v, 'effort')} />
      </div>
      <input className="hm-composer" aria-label="Message" placeholder={`Message ${str(p.v, 'agent')}`} value={str(p.v, 'draft')}
        data-i="Composer|Type a message and press Enter. It steers the turn that runs, or waits as the next task, as Input says."
        onChange={e => p.set('draft', e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && str(p.v, 'draft').trim()) { p.set('sent', str(p.v, 'draft').trim()); p.set('draft', '') } }} />
    </div>
  </Tile>,
}
