// The Answer (manual §18.10, central:nara-conversation): the agent that answers in a Central workspace, last on a document's chain.
// Live's nearest: Operator or Simpler — an instrument with a well that draws what it does and a short row of macros. The well
// draws the exchange by the owner's own law: the turn against the native budget of 256 KiB (desktop/cradle/src/nara/nativeDialogue.ts:232),
// the question and the answer in the conversation, and where the answer lands in the page (nara/nativeReturn.ts: a new entry through
// appendEntry, a quotation proposed for review, or a revision-checked write into the Flow). The binding is the owner's reading
// (oi.nara-dialogue-binding/v1): it lights the activator. Its Full view is the exchange itself, with the composer.
import {memo, useLayoutEffect, useMemo, useRef, useState} from 'react'
import {Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Section, Tile, type LightState, type Option} from '../../sdk/panel'
import {maskStatic} from '../../../agent/maskFace'
import {clampTo, num, str, type DesignedDevice, type ViewProps} from './design'
import './central__nara-conversation.css'

type V = ViewProps['v']
type SetFn = ViewProps['set']

/** The shell's four effort steps (agent/AgentShellContext.tsx:28). */
const EFFORTS = ['low', 'medium', 'high', 'max'] as const
const WRITES = ['off', 'propose', 'write'] as const
const WRITES_LABEL: Readonly<Record<string, string>> = {off: 'Off', propose: 'Propose', write: 'Write'}
/** The native turn budget: a turn above 256 KiB is refused (nara/nativeDialogue.ts:232). */
const BUDGET = 256 * 1024
const kb = (bytes: number) => `${bytes < 10240 ? (bytes / 1024).toFixed(1) : Math.round(bytes / 1024)} KB`

/** The agents: the two roles the owner binds (nara/dialogueTypes.ts) and the agents of Central's roster (Control/self/agents). */
const AGENTS: readonly Option<string>[] = [
  {value: 'nara', label: 'Nara', does: 'Answers to this person in this Expression.'},
  {value: 'epii', label: 'Epii', does: 'Investigates through the Epi-Logos sources.'},
  {value: 'cairn', label: 'Cairn', does: 'A patient interpreter.'},
  {value: 'flint', label: 'Flint', does: 'A grounded investigator.'},
  {value: 'kite', label: 'Kite', does: 'An exploratory maker.'},
  {value: 'lilt', label: 'Lilt', does: 'An associative companion.'},
]
const ANSWER_AS: readonly Option<string>[] = [
  {value: 'new', label: 'New', does: 'The answer joins as a new entry after the last entry.'},
  {value: 'replace', label: 'Replace', does: 'The answer takes the place of the selected entry.'},
]
const WRITE_OPTIONS: readonly Option<string>[] = [
  {value: 'off', label: 'Off', does: 'The answer shows in the conversation only.'},
  {value: 'propose', label: 'Propose', does: 'The answer waits in the page for you to accept it.'},
  {value: 'write', label: 'Write', does: 'The answer goes into the page at once, with a receipt.'},
]

const SAYS = {
  agent: 'Who answers: Nara, Epii, or an agent from your roster.',
  answerAs: 'New entry adds the answer after the last entry. Replace puts it in place of the selected entry.',
  writes: 'Off: the answer stays in the conversation. Propose: it waits in the page for you. Write: it goes in with a receipt.',
  effort: 'How hard the agent thinks on each answer. Drag handle 1 across the rungs.',
}

// ---------------------------------------------------------------- the exchange (the fixture)

/** The packet: what the Packet device sent. Sizes are the bytes of the text (the document is Control/self/agents/relational-logos.md). */
const PACKET = [
  {kind: 'selection', name: 'Entry 7', from: 'The development Run has not started its workers', bytes: 312},
  {kind: 'entry', name: 'Entry 8', from: 'The first worker can retain its coordinator', bytes: 428},
  {kind: 'document', name: 'relational-logos.md', from: 'Control/self/agents', bytes: 4618},
] as const
const PACKET_BYTES = PACKET.reduce((n, item) => n + item.bytes, 0)

const DOC = 'Factory original development Run'
const QUESTION = 'What does this entry ask of me?'
/** The answer in parts; a part with a source ends in its number. */
const ANSWER: readonly {readonly t: string; readonly s?: number}[] = [
  {t: 'The entry reports; it does not ask for anything.'},
  {t: 'It says the Run has not started its workers.', s: 2},
  {t: 'The next entry adds that the first worker can retain its coordinator.', s: 3},
  {t: 'So the wait is on the start, not on you. Receive it as a report.', s: 1},
]
interface Source {readonly n: number; readonly name: string; readonly tag: string; readonly at: string; readonly lines: readonly {readonly n: number; readonly t: string; readonly hit?: boolean}[]}
/** The sources, each with the line it came from: relational-logos.md at its revision, and two entries of the Flow. */
const SOURCES: readonly Source[] = [
  {n: 1, name: 'relational-logos.md', tag: '454bfbd1e47a', at: 'line 7', lines: [
    {n: 5, t: 'I MUST inhabit one continuing identity through self-relation and other-relation.'},
    {n: 6, t: ''},
    {n: 7, t: 'The other initially reaches me through an expression or event. I MUST receive that expression within its movement of meaning.', hit: true},
    {n: 8, t: ''},
    {n: 9, t: '## 0/1 — The whole in determination'}]},
  {n: 2, name: 'Entry 7', tag: 'Flow', at: '21:02', lines: [
    {n: 6, t: '19:20  The original Run remains incomplete'},
    {n: 7, t: '21:02  The development Run has not started its workers', hit: true},
    {n: 8, t: '21:55  The first worker can retain its coordinator'}]},
  {n: 3, name: 'Entry 8', tag: 'Flow', at: '21:55', lines: [
    {n: 6, t: '19:20  The original Run remains incomplete'},
    {n: 7, t: '21:02  The development Run has not started its workers'},
    {n: 8, t: '21:55  The first worker can retain its coordinator', hit: true}]},
]

// ---------------------------------------------------------------- readings

type Phase = 'idle' | 'reading' | 'answering'
const light = (v: V) => str(v, 'light') as LightState
const bound = (v: V) => light(v) === 'lit'
const phase = (v: V) => str(v, 'state') as Phase
const agentName = (v: V) => AGENTS.find(a => a.value === str(v, 'agent'))?.label ?? str(v, 'agent')
const effortAt = (v: V) => Math.max(0, EFFORTS.indexOf(str(v, 'effort') as (typeof EFFORTS)[number]))
const writesAt = (v: V) => Math.max(0, WRITES.indexOf(str(v, 'writes') as (typeof WRITES)[number]))
const replacing = (v: V) => str(v, 'answerAs') === 'replace'
const stateWord = (v: V) => (light(v) === 'unknown' ? 'not read' : light(v) === 'dark' ? 'not bound' : phase(v))
const standing = (v: V) => (light(v) === 'unknown' ? 'resolving' : light(v) === 'dark' ? 'no subject' : 'bound')
const context = (v: V) => num(v, 'context')
const turnBytes = (v: V) => (context(v) < 0 ? PACKET_BYTES : context(v) + PACKET_BYTES)
/** The dialogue role the owner binds; an agent of the roster has none yet. */
const roleOf = (v: V) => (str(v, 'agent') === 'nara' || str(v, 'agent') === 'epii' ? str(v, 'agent') : '—')

/** Where the answer stands in the page: nowhere yet, in the conversation only, waiting for you, kept, or declined. */
type Landing = 'none' | 'chat' | 'waits' | 'kept' | 'declined'
function landed(v: V, at: Phase = phase(v)): Landing {
  if (!bound(v) || at !== 'idle') return 'none'
  const w = str(v, 'writes')
  if (w === 'off') return 'chat'
  if (w === 'write') return 'kept'
  const a = str(v, 'proposalAnswer')
  return a === 'accept' ? 'kept' : a === 'decline' ? 'declined' : 'waits'
}
const LANDING_WORD: Readonly<Record<Landing, string>> = {none: '—', chat: 'off', waits: 'waits', kept: 'kept', declined: 'declined'}

const head = (p: ViewProps) => ({light: light(p.v), onLight: () => p.set('light', light(p.v) === 'lit' ? 'dark' : 'lit'), onFold: p.nav.fold, onFull: p.nav.full})
const ask = (v: V, set: SetFn, text: string) => {
  const t = text.trim()
  if (!t || !bound(v)) return
  set('sent', t); set('state', 'reading'); set('draft', '')
}
/** A change to Writes or Answer as clears an answer to the proposal: the new setting starts fresh. */
const setWrites = (p: ViewProps, x: string) => { p.set('writes', x); p.set('proposalAnswer', '') }
const setAnswerAs = (p: ViewProps, x: string) => { p.set('answerAs', x); p.set('proposalAnswer', '') }

// ---------------------------------------------------------------- the face

function useFaceColours() {
  const [colours, setColours] = useState({ink: 'var(--fizz)', ground: 'var(--bg-0)'})
  useLayoutEffect(() => {
    const style = getComputedStyle(document.documentElement)
    const hex = (name: string, fallback: string) => { const x = style.getPropertyValue(name).trim(); return /^#[0-9a-f]{6}$/i.test(x) ? x : fallback }
    setColours({ink: hex('--fizz', 'var(--fizz)'), ground: hex('--bg-0', 'var(--bg-0)')})
  }, [])
  return colours
}
const EXPR: Readonly<Record<Phase, string>> = {idle: 'neutral', reading: 'focus', answering: 'speak'}
/** The agent's face as the shell draws it: at rest when idle, focused while it reads, speaking while it answers. */
const Face = memo(function Face({x, y, size, expr, dim}: {x: number; y: number; size: number; expr: string; dim: boolean}) {
  const {ink, ground} = useFaceColours()
  const html = useMemo(() => maskStatic(expr, ink, ink, size, ground), [expr, ink, ground, size])
  return <g transform={`translate(${x} ${y})`} opacity={dim ? 0.4 : 1} dangerouslySetInnerHTML={{__html: html}} />
})
const Avatar = memo(function Avatar({expr, size = 18}: {expr: string; size?: number}) {
  const {ink, ground} = useFaceColours()
  const html = useMemo(() => maskStatic(expr, ink, ink, size, ground), [expr, ink, ground, size])
  return <svg className="an-face" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true"><g dangerouslySetInnerHTML={{__html: html}} /></svg>
})

// ---------------------------------------------------------------- the well

/** The well: the agent, the turn against its budget (the ruler), the chat and the page side by side — the question, the answer,
 * and where the answer lands — then the effort rungs (handle 1) and, whole, the writes line (handle 2) and the landing (handle 3). */
function AnswerWell({v, set, w, h, size}: {v: V; set?: SetFn; w: number; h: number; size: 'mini' | 'compact' | 'whole'}) {
  const mini = size === 'mini', whole = size === 'whole'
  const lit = bound(v), st = phase(v), where = landed(v), replace = replacing(v), ctx = context(v)
  const effort = effortAt(v), writes = writesAt(v)
  // geometry: the chat column and the page column, side by side
  const g = mini ? {cx: 6, cw: 40, px: 58, pw: 40, dv: 52, ly: 38, r0: 44}
    : whole ? {cx: 7, cw: 83, px: 106, pw: 81, dv: 98, ly: 78, r0: 84}
    : {cx: 7, cw: 56, px: 78, pw: 55, dv: 70, ly: 73, r0: 79}
  const row = (i: number) => g.r0 + i * 8, bh = mini ? 2.4 : 3
  const fs = mini ? 20 : whole ? 30 : 26, nameX = (mini ? 6 : 7) + fs + 7
  // the ruler: the turn along the 256 KiB budget
  const rx = mini ? 6 : 7, rw = w - 2 * rx, ry = mini ? 83 : whole ? 56 : 53, rh = mini ? 5 : 8, per = rw / BUDGET
  let at = rx
  const segs: {x: number; w: number; packet: boolean; key: string}[] = []
  if (ctx >= 0) { const sw = Math.max(2, ctx * per); segs.push({x: at, w: sw, packet: false, key: 'ctx'}); at += sw + 1 }
  PACKET.forEach(item => { const sw = Math.max(2, item.bytes * per); segs.push({x: at, w: sw, packet: true, key: item.name}); at += sw + 1 })
  // effort rungs, the writes line
  const rungW = whole ? 16 : 12, rungGap = whole ? 4 : 3, baseY = whole ? 134 : 138, rungH = whole ? [6, 11, 16, 21] : [4, 8, 12, 16]
  const rungX = (i: number) => 7 + i * (rungW + rungGap)
  const wx0 = whole ? 114 : 84, wx1 = whole ? 180 : 128, wy = whole ? 130 : 129, wxs = [wx0, (wx0 + wx1) / 2, wx1]
  const tgt = replace ? 1 : 3, bar = (f: number) => g.pw * f
  const pageStatus = where === 'none' || !lit ? '' : LANDING_WORD[where]
  return <Display w={w} h={h} label="The answer"
    does={mini ? 'The agent, the turn against its budget, and where the answer lands.' : 'The agent, the turn against its 256 KB budget, the chat and the page, and the effort. Drag the handles to set them.'}
    corner={mini ? undefined : ctx < 0 ? '—' : whole ? `${kb(turnBytes(v))} / 256 KB` : kb(turnBytes(v))}>
    <Face x={mini ? 6 : 7} y={mini ? 4 : 5} size={fs} expr={EXPR[st]} dim={!lit} />
    <text x={nameX} y={mini ? 13 : 17} className="dp-ink" style={{fontSize: mini ? 10.5 : 11.5, fontWeight: 600}}>{agentName(v)}</text>
    <text x={nameX} y={mini ? 24 : 30} className="dp-ink-dim" style={{fill: lit && st !== 'idle' ? 'var(--dp-value)' : undefined}}>{stateWord(v)}</text>

    {/* the turn: the identity and Expression context (dim), then each packet item, along the budget */}
    <text x={rx} y={ry - 3} className="dp-axis">{ctx < 0 ? 'turn · context not read' : 'turn'}</text>
    {whole && <text x={w - rx} y={ry - 3} className="dp-axis" textAnchor="end">256 KB</text>}
    <rect x={rx + 0.5} y={ry} width={rw - 1} height={rh} className="dp-faint" />
    {segs.map(s => <rect key={s.key} x={s.x} y={ry + 1.5} width={s.w} height={rh - 3} fill={s.packet ? 'var(--dp-value)' : 'var(--text-faint)'} opacity={s.packet ? 1 : 0.55} />)}

    {/* the chat and the page */}
    <text x={g.cx} y={g.ly} className="dp-axis">chat</text>
    <text x={g.px} y={g.ly} className="dp-axis">page</text>
    {!mini && <text x={g.px + g.pw} y={g.ly} className="dp-axis" textAnchor="end" style={{fill: where === 'waits' ? 'var(--dp-on)' : where === 'kept' ? 'var(--green)' : undefined}}>{pageStatus}</text>}
    <path d={`M${g.dv} ${g.ly - 6}V${row(3) + 6}`} className="dp-faint" />
    {lit ? <>
      <rect x={g.cx} y={row(0)} width={g.cw * 0.62} height={bh} fill="var(--text-dim)" opacity={0.55} />
      {st === 'reading' && [0, 1, 2].map(i => <circle key={i} cx={g.cx + 3 + i * 7} cy={row(1) + bh / 2} r={1.6} fill="var(--dp-value)" />)}
      {st !== 'reading' && [0.92, 0.8, 0.42].map((f, i) => {
        if (st === 'answering' && i === 2) return <rect key={i} x={g.cx} y={row(1 + i)} width={g.cw * 0.22} height={bh} fill="var(--dp-value)" opacity={0.5} />
        return <rect key={i} x={g.cx} y={row(1 + i)} width={g.cw * f} height={bh} fill="var(--dp-value)" opacity={0.5} />
      })}
      {st === 'answering' && <rect x={g.cx + g.cw * 0.22 + 2} y={row(3) - 1.5} width={2} height={bh + 3} fill="var(--dp-on)" />}
    </> : <>
      <text x={g.cx} y={row(1) + 3} className="dp-axis">{light(v) === 'unknown' ? 'binding' : 'no subject'}</text>
      <text x={g.cx} y={row(2) + 3} className="dp-axis">{light(v) === 'unknown' ? 'not read' : 'selected'}</text>
    </>}
    {[0.8, 0.9, 0.7].map((f, i) => {
      const gone = where === 'kept' && replace && i === 1
      return gone ? null : <rect key={i} x={g.px} y={row(i)} width={bar(f)} height={bh} fill="var(--text-dim)" opacity={where === 'waits' && replace && i === 1 ? 0.3 : 0.55} />
    })}
    {lit && <rect x={g.px - 2.5} y={row(1) - 2.5} width={bar(0.9) + 5} height={bh + 5} fill="none" stroke="var(--sel)" strokeWidth={1} opacity={0.85} />}
    {where === 'waits' && <rect x={g.px} y={row(tgt) - 1} width={bar(0.85)} height={bh + 2} fill="none" stroke="var(--dp-value)" strokeWidth={1} strokeDasharray="2 2" />}
    {where === 'kept' && <>
      <rect x={g.px} y={row(tgt)} width={bar(0.85)} height={bh} fill="var(--dp-value)" />
      <rect x={g.px + bar(0.85) + 3} y={row(tgt) - 0.5} width={4} height={4} fill="var(--green)" />
    </>}
    {whole && set && lit && <Handle n={3} shape="square" x={g.px + bar(0.85) + 13} y={row(tgt) + bh / 2} label="Answer as" does="Drag up or down: the answer takes the selected entry or joins as a new one."
      onDrag={(_, y) => setAnswerAsFromHandle(set, y, row(1), row(3))} onReset={() => set('answerAs', 'new')} />}

    {/* effort: four rungs, lit up to the chosen one */}
    {!mini && <>
      <text x={7} y={whole ? 121 : 119} className="dp-axis">effort</text>
      {rungH.map((rh, i) => <g key={i}>
        <rect x={rungX(i) + 0.5} y={baseY - rh} width={rungW - 1} height={rh} className={i <= effort && lit ? undefined : 'dp-faint'} fill={i <= effort && lit ? 'var(--dp-value)' : 'none'}
          opacity={i <= effort && lit ? 0.45 + i * 0.18 : 1} />
        {whole && <text x={rungX(i) + rungW / 2} y={baseY + 9} className="dp-axis" textAnchor="middle" style={{fontSize: 7.5}}>{['low', 'med', 'high', 'max'][i]}</text>}
      </g>)}
      {set && lit && <Handle n={1} shape="ring" x={rungX(effort) + rungW / 2} y={baseY - rungH[effort]! - 7} label="Effort" does="Drag across the rungs: how hard the agent thinks on each answer."
        onDrag={x => set('effort', EFFORTS[Math.round(clampTo(0, 3, (x - 7 - rungW / 2) / (rungW + rungGap)))]!)} onReset={() => set('effort', 'high')} />}

      {/* writes: where the answer goes, from the chat alone to the page */}
      <text x={g.px} y={whole ? 121 : 119} className="dp-axis">writes</text>
      <path d={`M${wx0} ${wy}H${wx1}`} className="dp-faint" />
      {wxs.map((x, i) => <g key={i}>
        <path d={`M${x} ${wy - 4}V${wy + 4}`} className="dp-faint" />
        <text x={x} y={wy + 11} className="dp-axis" textAnchor="middle" style={{fontSize: 7.5}}>{whole ? WRITES[i] : ['off', 'prop', 'write'][i]}</text>
      </g>)}
      <circle cx={wxs[writes]} cy={wy} r={3.5} fill="var(--dp-on)" />
      {whole && set && <Handle n={2} x={wxs[writes]!} y={wy} label="Agent writes" does="Drag along the line: the answer stays in the chat, waits in the page, or goes in."
        onDrag={x => { set('writes', WRITES[Math.round(clampTo(0, 2, (x - wx0) / ((wx1 - wx0) / 2)))]!); set('proposalAnswer', '') }} onReset={() => set('writes', 'propose')} />}
    </>}
  </Display>
}

/** Handle 3 moves between the selected entry's place and the place after the last entry. */
function setAnswerAsFromHandle(set: SetFn, y: number, selected: number, after: number) {
  set('answerAs', y < (selected + after) / 2 ? 'replace' : 'new')
  set('proposalAnswer', '')
}

// ---------------------------------------------------------------- the controls

const agentChooser = (p: ViewProps) => <Chooser label="Agent" does={SAYS.agent} value={str(p.v, 'agent')} options={AGENTS} onChange={x => p.set('agent', x)} />
const answerRadio = (p: ViewProps) => <Radio label="Answer as" does={SAYS.answerAs} value={str(p.v, 'answerAs')} stack options={ANSWER_AS} onChange={x => setAnswerAs(p, x)} />
const writesRadio = (p: ViewProps) => <Radio label="Agent writes" does={SAYS.writes} value={str(p.v, 'writes')} stack options={WRITE_OPTIONS} onChange={x => setWrites(p, x)} />
const effortDial = (p: ViewProps) => <Dial label="Effort" does={SAYS.effort} value={effortAt(p.v)} def={2} scale={{min: 0, max: 3, step: 1}} format={i => EFFORTS[Math.round(i)]!}
  onChange={i => p.set('effort', EFFORTS[Math.round(i)]!)} disabled={bound(p.v) ? undefined : 'The conversation is not bound. Effort needs a session.'} />

// ---------------------------------------------------------------- the exchange, in the pane

function AnswerPane({v, set}: {v: V; set: SetFn}) {
  const name = agentName(v), lit = bound(v), sent = str(v, 'sent'), open = Number(str(v, 'source')) || 0
  const first: Phase = sent ? 'idle' : phase(v), second = sent ? phase(v) : null
  const where = landed(v, first), composer = useRef<HTMLInputElement>(null)
  const shown = first === 'answering' ? ANSWER.slice(0, 2) : ANSWER
  const source = SOURCES.find(s => s.n === open)
  const draft = str(v, 'draft')
  return <div className="an-pane">
    <div className="an-pane-head" aria-label="The answering agent">
      <b>{name}</b><span>{DOC}</span><span>{standing(v)}</span><span>effort {str(v, 'effort')}</span>
      <span>writes {WRITES_LABEL[str(v, 'writes')]}</span><span data-state={phase(v) === 'idle' ? undefined : 'busy'}>{stateWord(v)}</span>
    </div>
    <div className="an-stream" role="log" aria-label="Exchange">
      <div className="an-task"><span>Answer to entry 7</span><i /><small>{kb(turnBytes(v))} of 256 KB</small></div>
      {lit && <>
        <div className="an-row"><span className="an-av">Y</span>
          <div className="an-body"><span className="an-who">you</span><p className="an-text">{QUESTION}</p>
            <ul className="an-packet" aria-label="Packet">
              {PACKET.map(item => <li key={item.name} data-i={`${item.name}|${item.kind} from ${item.from}. ${kb(item.bytes)} of the turn.`}><b>{item.kind}</b>{item.name}<small>{kb(item.bytes)}</small></li>)}
            </ul></div></div>
        <div className="an-row"><span className="an-av" data-agent="true"><Avatar expr={EXPR[first]} /></span>
          <div className="an-body"><span className="an-who" data-agent="true">{name}</span>
            {first === 'reading'
              ? <p className="an-work"><i />{name} reads the packet · {PACKET.length} items · {kb(PACKET_BYTES)}</p>
              : <p className="an-text">{shown.map((part, i) => <span key={i}>{part.t}{part.s && first === 'idle' && <button type="button" className="an-cite" aria-pressed={open === part.s}
                  data-i={`Source ${part.s}|Land on the line this claim comes from: ${SOURCES.find(s => s.n === part.s)!.name}, ${SOURCES.find(s => s.n === part.s)!.at}.`}
                  onClick={() => set('source', open === part.s ? '' : String(part.s))}>{part.s}</button>} </span>)}
                {first === 'answering' && <span className="an-caret" />}</p>}
            {first === 'idle' && <ul className="an-sources" aria-label="Sources">
              {SOURCES.map(s => <li key={s.n}><button type="button" aria-pressed={open === s.n} onClick={() => set('source', open === s.n ? '' : String(s.n))}
                data-i={`Source ${s.n}|Follow it to the line it came from: ${s.name}, ${s.at}.`}><b>{s.n}</b>{s.name}<small>{s.at}</small></button></li>)}
            </ul>}
            {first === 'idle' && source && <div className="an-line-card" aria-label={`Source ${source.n}`}>
              <div><b>{source.name}</b><small>{source.tag}</small></div>
              {source.lines.map(l => <p key={l.n} data-hit={l.hit || undefined}><i>{l.n}</i><span>{l.t || ' '}</span></p>)}
            </div>}
          </div></div>
        {where === 'chat' && <div className="an-row an-row--note"><span className="an-av an-av--tool" aria-hidden="true" /><p className="an-note">Agent writes is Off. The answer stays in this conversation.</p></div>}
        {where === 'waits' && <div className="an-row"><span className="an-av an-av--tool" aria-hidden="true" /><div className="an-card">
          <b>Proposal · {replacing(v) ? 'replace entry 7' : 'add as entry 9'}</b><small>{DOC} · waits for you</small>
          <span className="an-card-do">
            <button type="button" onClick={() => set('proposalAnswer', 'accept')} data-i="Accept|Put the answer into the page. The write carries a receipt.">Accept</button>
            <button type="button" onClick={() => set('proposalAnswer', 'decline')} data-i="Decline|Leave the page as it is. The answer stays in the conversation.">Decline</button></span></div></div>}
        {where === 'kept' && <div className="an-row"><span className="an-av an-av--tool" aria-hidden="true" /><div className="an-card" data-done="true">
          <b>Written · {replacing(v) ? 'entry 7 replaced' : 'entry 9 added'}</b><small>{DOC} · revision 14 · 22:31 · receipt kept with the entry</small></div></div>}
        {where === 'declined' && <div className="an-row an-row--note"><span className="an-av an-av--tool" aria-hidden="true" /><p className="an-note">Declined. The page is unchanged.</p></div>}
        {sent && <>
          <div className="an-row"><span className="an-av">Y</span><div className="an-body"><span className="an-who">you</span><p className="an-text">{sent}</p></div></div>
          {second && <div className="an-row"><span className="an-av" data-agent="true"><Avatar expr={EXPR[second]} /></span><div className="an-body"><span className="an-who" data-agent="true">{name}</span>
            <p className="an-work"><i />{second === 'reading' ? `${name} reads the packet · ${PACKET.length} items · ${kb(PACKET_BYTES)}` : `${name} is answering`}</p></div></div>}
        </>}
      </>}
      {!lit && <div className="an-row an-row--note"><span className="an-av an-av--tool" aria-hidden="true" /><p className="an-note">
        {light(v) === 'unknown' ? 'The binding has not been read. The owner has not said.' : 'No subject is selected. The conversation binds once you select one.'}</p></div>}
    </div>
    <div className="an-composer">
      <input ref={composer} aria-label="Message" disabled={!lit} placeholder={lit ? `Ask ${name}` : 'Bind a conversation to ask'} value={draft}
        data-i="Composer|Type a question and press Enter. The agent reads the packet and answers in this pane."
        onChange={e => set('draft', e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); ask(v, set, draft) } }} />
      <small>ask</small>
    </div>
  </div>
}

// ---------------------------------------------------------------- the device

const lastLine = (v: V) => {
  const sent = str(v, 'sent'), st = phase(v), name = agentName(v)
  if (!bound(v)) return <>{light(v) === 'unknown' ? 'The binding is not read.' : 'No subject is selected.'}</>
  if (sent && st === 'reading') return <><b>you</b> {sent}</>
  if (st === 'reading') return <>{name} reads the packet.</>
  if (st === 'answering') return <><b>{name}</b> {ANSWER.slice(0, 2).map(a => a.t).join(' ')}</>
  return <><b>{name}</b> {ANSWER.map(a => a.t).join(' ')}</>
}

export const design: DesignedDevice = {
  id: 'central:nara-conversation',
  title: 'Answer',
  kind: 'instrument',
  defaults: {
    light: 'lit', agent: 'nara', answerAs: 'new', writes: 'propose', effort: 'high', draft: '', sent: '', proposalAnswer: '', source: '1',
    // Readings: what the owners report, never set from here. `context` is the bytes of identity and Expression the turn carries (-1: not read).
    state: 'idle', context: 38912,
  },
  fixtures: {
    'Answered, waiting': {},
    Answering: {state: 'answering'},
    'Replace and write': {answerAs: 'replace', writes: 'write'},
    'Not bound': {light: 'dark', context: -1},
  },

  folded: p => <Folded title="Answer" light={light(p.v)} readings={[agentName(p.v), WRITES_LABEL[str(p.v, 'writes')]!]} onUnfold={p.nav.unfold} />,

  compact: p => <Panel title="Answer" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <AnswerWell v={p.v} set={p.set} w={140} h={146} size="compact" />
    </Section>
    <Section label="Macros" cols={2} width={140}>
      {agentChooser(p)}
      {answerRadio(p)}
      {writesRadio(p)}
      {effortDial(p)}
    </Section>
  </Panel>,

  whole: p => <Panel title="Answer" view="whole" {...head(p)}>
    <Band>
      <Section width={206}>
        <AnswerWell v={p.v} set={p.set} w={194} h={146} size="whole" />
      </Section>
      <Section label="Agent" cols={2}>
        {agentChooser(p)}
        {effortDial(p)}
        <Readout label="role" does="The role the owner binds for this agent. A roster agent has none yet." value={roleOf(p.v)} />
      </Section>
      <Section label="Answer" grow>
        {answerRadio(p)}
        <Readout label="sources" does="The places the answer cites. Follow one in the pane." value={bound(p.v) && phase(p.v) === 'idle' ? SOURCES.length : '—'} tone="value" />
      </Section>
    </Band>
    <Band>
      <Section label="Writes" cols={2} width={140}>
        {writesRadio(p)}
        <Readout label="page" does="Where the answer stands: off, waits for you, or kept with a receipt." value={LANDING_WORD[landed(p.v)]}
          tone={landed(p.v) === 'waits' ? 'accent' : landed(p.v) === 'kept' ? 'green' : undefined} />
      </Section>
      <Section label="Exchange" cols={3} width={140}>
        <Readout label="state" does="What the agent does now: idle, reading the packet, or answering." value={stateWord(p.v)} tone={phase(p.v) === 'idle' ? undefined : 'value'} />
        <Readout label="packet" does="The size of the packet the agent receives." value={kb(PACKET_BYTES)} tone="value" />
        <Readout label="turn" does="The whole turn against the native budget of 256 KB: the packet and the identity context." value={context(p.v) < 0 ? '—' : kb(turnBytes(p.v))} />
      </Section>
      <Section label="Binding" grow>
        <Readout label="standing" does="Whether the conversation is bound to a person and an Expression." value={standing(p.v)} tone={bound(p.v) ? 'green' : undefined} />
        <Readout label="resume" does="Whether the owner needs the session resumed before it answers." value={bound(p.v) ? 'no' : '—'} />
      </Section>
    </Band>
  </Panel>,

  full: p => <AnswerPane v={p.v} set={p.set} />,

  widget: p => <Tile title={`Answer · ${agentName(p.v)}`} light={light(p.v)} span={2} onFull={p.nav.full}>
    <AnswerWell v={p.v} w={104} h={100} size="mini" />
    <div className="an-tile-side">
      <p className="an-last" aria-live="polite">{lastLine(p.v)}</p>
      <div className="an-tile-reads">
        <Readout label="state" does="What the agent does now." value={stateWord(p.v)} tone={phase(p.v) === 'idle' ? undefined : 'value'} />
        <Readout label="writes" does="Off, Propose or Write: how the answer reaches the page." value={WRITES_LABEL[str(p.v, 'writes')]} />
        <Readout label="effort" does="How hard the agent thinks on each answer." value={str(p.v, 'effort')} />
      </div>
      <input className="an-tile-composer" aria-label="Message" disabled={!bound(p.v)} placeholder={`Ask ${agentName(p.v)}`} value={str(p.v, 'draft')}
        data-i="Composer|Type a question and press Enter. The agent reads the packet and answers."
        onChange={e => p.set('draft', e.target.value)} onKeyDown={e => { if (e.key === 'Enter') ask(p.v, p.set, str(p.v, 'draft')) }} />
    </div>
  </Tile>,
}
