// The Gateway device (manual §19.2, actuation:gateway): the way in to a workcell, the first device on its chain; every session that
// works in the workcell, in any mode, comes in through it. Live's nearest:
// Utility — a small effect of few controls whose meaning is plain at a glance. The well is the link: the shell on the left, the
// harness on the right, the line between them drawn by the transport, the frames in flight as dots, the replay ring as an arc
// round the harness, the heartbeat as the outer ring, and the time since the last check-in on a scale that ends at 30 min.
//
// Two pages in the head of Whole: Link (Link, Approval, Liveness, Readiness) and Frames (the Frames monitor, Live's MIDI monitor:
// five kind lanes, one tick for each frame, the Keep scale with handle 1, the frames themselves and every setting of the list). The
// Full is the Frames page at pane size; the tile is the small link, the readiness and the last eleven frames, newest at the bottom.
//
// The Gateway comes in builds (§19.2 "Builds"): the harness gateways (Hermes, Actuation) draw the link; the AIKit agency build draws
// the messages it carries — the surfaces on the left, the gateway, the agents on the right — with its own parameters, and its Full is
// the messages that passed and the refusals with their reasons.
//
// Value keys of the harness builds. The owner writes (kernel harness_agent_control, `configure`, harnessAgentControl.ts:14-25):
//   connect (bool), transport (stdio · ws · remote: Local · Network · Remote), approvals (ask · session · always), stallAfter (seconds:
//   30, 90, 300, 1800), autoContinue (bool), fanOut (0 to 8 observers).
// The shell holds the Frames page's own settings (nothing here is written to the harness):
//   session (all · lead · a session's name), direction (both · out · in), kinds (a comma list of messages · tools · heartbeat ·
//   approvals · errors, or none), follow (bool), pause (bool), keep (100 to 5000 frames), frame (the frame opened, by its place in the
//   list the owner reports).
// The owner reports (never written from here):
//   light (lit · dark), build (hermes · actuation · agency), harness (the binding's name), viaLead (bool), readiness (ready · composed ·
//   refused, or the harness's own word), refused (the owner's reason), epoch (hex), seq (the last sequence number of the session),
//   peers (observers attached), beatAge (seconds since the last check-in, -1 when none), inflight (frames in flight), running (turns
//   running), ring and ringCap (events held, events kept: the replay ring keeps 512 for each session, Hermes
//   tui_gateway/event_replay.py:28), lead (the lead's session), frames (a JSON list of {seq?, dir, kind, session, at, note, task?, turn?,
//   step?}; a frame the shell sent carries no seq: only the gateway numbers a frame it sends, event_replay.py:50-56).
//
// Value keys of the agency build. The owner writes (AIKit `aikit gateway`, crates/aikit-cli/src/cli.rs GatewaySub):
//   service (bool: serve · install-service · uninstall-service, shutdown), entry (local-ipc · loopback-service · private-tailnet ·
//   tailscale-serve · ssh-tunnel: `gateway setup --mode`, gateway_modes.rs:63 ENTRY_MODES, plan-first), coexist (bool: `gateway
//   coexistence --policy coexist|exclusive`), on:<surface id> (bool: `gateway connector add` with or without --disable), agentPolicy
//   (allow · pair · deny: GatewayIngressDecision, gateway_runtime.rs:106; the owner's word for Ask is pair).
// The shell holds: entryPending (an entry that waits for Confirm).
// The owner reports: state (ready · composed · refused, gateway_modes.rs:38), refused, reach, signIn, secrecy (the entry's terms),
//   keptBy (foreground · supervised-launchd · supervised-systemd · application), inbox (messages that wait), surfaces (JSON list of
//   {id, name, platform?, health?, enabled?, ingress?, detail?}), agents (JSON list of {id, name, presence?, waiting?}), harnesses (JSON
//   list of {name, evidence?}), passed (JSON list of {at, from, to, via, standing, why?}: the Communique journal).
// A key the owner has not reported is absent, and the view draws "—" for it, and names it in the well.
import {useEffect, useRef, useState, type CSSProperties} from 'react'
import {Action, Band, Chooser, Dial, Display, Folded, Handle, Panel, Radio, Readout, Rows, Section, Tile, Toggle, ValueBox, type LightState, type Option, type RowItem, type Tone} from '../../sdk/panel'
import {boolOf, clampTo, has, json, NONE, numOf, shown, st, strOf, type DesignedDevice, type ViewProps, type Values} from './design'
import {MonitorGroup, MonitorHead, MonitorPane} from './monitor'
import './actuation__gateway.css'

type V = ViewProps['v']
type Live = 'live' | 'stalled' | 'idle'

// ---------------------------------------------------------------- fixed vocabulary (not the owner's data)

/** The stops Stall after takes, in seconds, and what each is called. */
const STOPS = [30, 90, 300, 1800] as const
const STOP_LABEL = ['30 s', '90 s', '5 min', '30 min'] as const
/** The scale under the link runs from 10 s to 30 min on a log axis, so the four stops stand evenly apart. */
const AX_LO = 10, AX_HI = 1800
const FAN_MAX = 8
const STALL_DEFAULT = 90, FAN_DEFAULT = 2

const TRANSPORTS: readonly Option<string>[] = [
  {value: 'stdio', label: 'Local', does: 'A trusted child process of the shell.'},
  {value: 'ws', label: 'Network', does: 'A network link that shows a token.'},
  {value: 'remote', label: 'Remote', does: 'A short-lived ticket, through a connected machine.'},
]
const TRANSPORT_WORD: Record<string, string> = {stdio: 'local', ws: 'network', remote: 'remote'}
const APPROVALS: readonly Option<string>[] = [
  {value: 'ask', label: 'Ask', does: 'You answer each approval request.'},
  {value: 'session', label: 'Session', does: 'Requests are allowed for this session.'},
  {value: 'always', label: 'Always', does: 'Requests are allowed every time.'},
]

const SAYS = {
  connect: 'Attach the workcell\'s sessions, or detach them. A detached session keeps running and attaches again later.',
  transport: 'How the shell reaches the harness: Local is a trusted child process, Network uses a token, Remote a short-lived ticket through a connected machine.',
  approvals: 'The default answer to an approval request. You always give Deny yourself.',
  stall: 'The time without progress, with work pending, after which the session counts as stalled and Retry lights. Drag handle 1 along the scale.',
  autoContinue: 'Lets the gateway continue a turn that stopped on its own, for up to 15 minutes.',
  fanOut: 'How many observers may watch each session beside the shell. A slow observer loses only its own feed.',
  session: 'Whose frames to show: all sessions, the lead, or one session.',
  direction: 'Show the frames the shell sent, the frames it received, or both.',
  follow: 'Keep the list on the newest frame. Off keeps the list where it is.',
  pause: 'Hold the list still. The gateway keeps the frames that arrive.',
  keep: 'How many frames the list holds. Drag handle 1 along the scale. The mark is the 512 events the gateway keeps for each session.',
}

/** The five kinds of frame, in lane order, and what each holds. */
const KINDS = [
  {id: 'messages', label: 'Messages', does: 'The agent\'s text, your prompts and your steer lines.'},
  {id: 'tools', label: 'Tools', does: 'Each tool call, from its start to its end.'},
  {id: 'heartbeat', label: 'Heartbeat', does: 'Status, usage and session frames: the frames that show the session lives.'},
  {id: 'approvals', label: 'Approvals', does: 'Requests that wait for you, and your answers.'},
  {id: 'errors', label: 'Errors', does: 'Errors, gateway faults and timeouts.'},
] as const
type KindId = (typeof KINDS)[number]['id']
const ORDER: readonly KindId[] = KINDS.map(k => k.id)
const ALL_KINDS = ORDER.join(',')
/** Which kind a frame belongs to. Every frame belongs to one; a frame of any other kind counts as Heartbeat. */
const kindOf = (kind: string): KindId => {
  const k = kind.toLowerCase()
  if (/error|stderr|timeout|reconnecting/.test(k)) return 'errors'
  if (/^(approval|sudo|secret)\./.test(k)) return 'approvals'
  if (/^(tool|subagent)\./.test(k)) return 'tools'
  if (/^(message|prompt|thinking|reasoning|clarify)\./.test(k) || k === 'session.steer') return 'messages'
  return 'heartbeat'
}
const KEEP_MIN = 100, KEEP_MAX = 5000, KEEP_DEFAULT = 1000
/** The tile holds eleven frames. */
const TILE_LINES = 11
const DIRECTIONS: readonly Option<string>[] = [
  {value: 'both', label: 'Both', does: 'Show the frames the shell sent and the frames it received.'},
  {value: 'out', label: 'Sent', does: 'Show only the frames the shell sent.'},
  {value: 'in', label: 'Received', does: 'Show only the frames the shell received.'},
]

// ---------------------------------------------------------------- readings

const lightOf = (p: ViewProps): LightState => {
  const s = strOf(p.owner ?? p.v, 'light')
  return s === 'lit' || s === 'dark' ? s : 'unknown'
}
/** Which build this Gateway is. A Gateway that does not say is drawn as a harness gateway. */
const isAgency = (v: V) => strOf(v, 'build') === 'agency'

/** The time without progress, as a short word. */
const span = (s: number) => (s < 0 ? 'none' : s < 120 ? `${Math.round(s)} s` : s < 7200 ? `${Math.round(s / 60)} min` : `${Math.round(s / 3600)} h`)
const stopIndex = (v: V): number | undefined => {
  const s = numOf(v, 'stallAfter')
  if (s === undefined) return undefined
  return STOPS.reduce((best, stop, i) => (Math.abs(Math.log(stop / s)) < Math.abs(Math.log(STOPS[best]! / s)) ? i : best), 0)
}
const stallLabel = (v: V) => { const s = numOf(v, 'stallAfter'); return s === undefined ? NONE : (STOP_LABEL[STOPS.indexOf(s as (typeof STOPS)[number])] ?? span(s)) }

/** Stalled needs work pending: a session that is quiet with nothing running is idle. A state needs the readings that decide it. */
const liveOf = (v: V): Live | undefined => {
  const age = numOf(v, 'beatAge'), after = numOf(v, 'stallAfter'), running = numOf(v, 'running')
  if (age === undefined) return undefined
  if (age < 0) return 'idle'
  if (after === undefined) return undefined
  if (age < after) return 'live'
  if (running === undefined) return undefined
  return running > 0 ? 'stalled' : 'idle'
}
/** The harness's state: Ready, Composed, Refused, or its own word; a refusal is named when the owner gave no state. */
const readyWord = (v: V): string | undefined => {
  const r = strOf(v, 'readiness')
  if (r === undefined) return has(v, 'refused') ? 'Refused' : undefined
  return r === 'ready' ? 'Ready' : r === 'composed' ? 'Composed' : r === 'refused' ? 'Refused' : r
}
const readyTone = (v: V): Tone | undefined => {
  const r = strOf(v, 'readiness')
  return r === 'ready' ? 'green' : r === 'composed' ? 'accent' : r === 'refused' || (r === undefined && has(v, 'refused')) ? 'stall' : undefined
}
const epochOf = (v: V, n = 8) => { const e = strOf(v, 'epoch'); return e === undefined ? NONE : e.slice(0, n) }
const ringOf = (v: V) => { const r = numOf(v, 'ring'), c = numOf(v, 'ringCap'); return r === undefined || c === undefined || c <= 0 ? undefined : clampTo(0, 1, r / c) }
const peersLine = (v: V) => {
  const n = numOf(v, 'peers'), cap = numOf(v, 'fanOut')
  return n === undefined ? NONE : cap === undefined ? `${n}` : `${n} / ${cap}`
}
const atLog = (t: number, a0: number, a1: number) => a0 + (a1 - a0) * clampTo(0, 1, Math.log(Math.max(t, AX_LO) / AX_LO) / Math.log(AX_HI / AX_LO))
const arcPath = (cx: number, cy: number, r: number, f: number) => {
  if (f >= 0.999) return `M${cx} ${cy - r}A${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}`
  const a = -Math.PI / 2 + f * 2 * Math.PI
  return `M${cx} ${cy - r}A${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`
}

interface Frame {id: number; seq?: number; dir: 'in' | 'out'; kind: string; session: string; at: string; note: string; task?: string; turn?: number; step?: number}
const finite = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined)
/** The frames the owner reports, kept only where they have a shape. Nothing in a bad list can throw. */
const framesOf = (v: V): Frame[] => {
  const raw = json<unknown>(v, 'frames', [])
  if (!Array.isArray(raw)) return []
  return raw.flatMap((f, id): Frame[] => {
    if (!f || typeof f !== 'object') return []
    const r = f as Record<string, unknown>
    if (typeof r.kind !== 'string') return []
    return [{id, seq: finite(r.seq), dir: r.dir === 'out' ? 'out' : 'in', kind: r.kind, session: typeof r.session === 'string' ? r.session : NONE,
      at: typeof r.at === 'string' ? r.at : NONE, note: typeof r.note === 'string' ? r.note : '',
      task: typeof r.task === 'string' ? r.task : undefined, turn: finite(r.turn), step: finite(r.step)}]
  })
}
/** The kinds that are on, or undefined when nobody has said. */
const kindsOf = (v: V): KindId[] | undefined => {
  const s = strOf(v, 'kinds')
  if (s === undefined) return undefined
  return ORDER.filter(k => s.split(',').includes(k))
}
const canon = (on: readonly KindId[]) => (on.length ? ORDER.filter(k => on.includes(k)).join(',') : 'none')

interface Scope {
  /** Every frame the list holds (the last Keep of them). */
  readonly all: Frame[]
  /** The frames of the chosen session. */
  readonly scoped: Frame[]
  /** The frames of the chosen session that pass Direction and Kinds. */
  readonly passing: Frame[]
  readonly sessions: string[]
  /** The one session chosen (the lead resolved), when one is. */
  readonly name: string | undefined
  readonly missing: string[]
  readonly note: string | undefined
}
const filterOf = (v: V): ((f: Frame) => boolean) => {
  const dir = strOf(v, 'direction'), kinds = kindsOf(v)
  return f => (dir === undefined || dir === 'both' || f.dir === dir) && (kinds === undefined || kinds.includes(kindOf(f.kind)))
}
function scopeOf(v: V): Scope {
  const keep = numOf(v, 'keep'), read = framesOf(v)
  const all = keep === undefined || read.length <= keep ? read : read.slice(read.length - Math.floor(keep))
  const pick = strOf(v, 'session'), lead = strOf(v, 'lead')
  const name = pick === 'lead' ? lead : pick === 'all' ? undefined : pick
  const scoped = pick === undefined || pick === 'all' ? all : name === undefined ? [] : all.filter(f => f.session === name)
  const pass = filterOf(v)
  return {all, scoped, passing: scoped.filter(pass), sessions: [...new Set(all.map(f => f.session))], name,
    missing: ['session', 'direction', 'kinds'].filter(k => !has(v, k)), note: pick === 'lead' && lead === undefined ? 'No reading of the lead' : undefined}
}
const clockSecs = (at: string): number | undefined => {
  const m = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(at)
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : undefined
}
/** Frames a minute, over the time the frames span. */
const rateOf = (fs: readonly Frame[]): number | undefined => {
  const t = fs.map(f => clockSecs(f.at)).filter((x): x is number => x !== undefined)
  if (t.length < 2) return undefined
  const s = Math.max(...t) - Math.min(...t)
  return s > 0 ? (t.length - 1) / (s / 60) : undefined
}
/** Frames the gateway holds for the chosen session beyond the newest frame the list has taken. Known for one session only. */
const behindOf = (v: V, sc: Scope): number | undefined => {
  const seq = numOf(v, 'seq')
  if (seq === undefined || sc.name === undefined) return undefined
  const mine = sc.scoped.flatMap(f => (f.seq === undefined ? [] : [f.seq]))
  return mine.length ? Math.max(0, seq - Math.max(...mine)) : undefined
}
/** Whether the list follows, stands, or is held. */
const listState = (v: V): string | undefined => {
  const follow = boolOf(v, 'follow'), paused = boolOf(v, 'pause')
  return paused === undefined ? undefined : paused ? 'held' : follow === false ? 'standing' : follow === undefined ? undefined : 'following'
}
const rateWord = (v: V) => { const r = has(v, 'frames') ? rateOf(scopeOf(v).scoped) : undefined; return r === undefined ? undefined : `${Math.round(r)}/min` }
const shownWord = (v: V) => { const sc = scopeOf(v); return has(v, 'frames') && sc.missing.length < 3 ? `${sc.passing.length}/${sc.scoped.length}` : undefined }

// ---------------------------------------------------------------- the link well

type Size = 'mini' | 'compact' | 'whole'
/** Where the marks stand, by size: the shell box, the line, the harness and its two rings, the scale. */
const GEO = {
  mini: {w: 104, h: 100, sx: 4, sw: 22, cy: 44, hx: 80, hr: 8, ringR: 12, pulseR: 16, axisY: 86, a0: 6, a1: 98},
  compact: {w: 140, h: 146, sx: 7, sw: 24, cy: 50, hx: 109, hr: 11, ringR: 16, pulseR: 21, axisY: 127, a0: 7, a1: 133},
  whole: {w: 194, h: 146, sx: 8, sw: 34, cy: 50, hx: 156, hr: 13, ringR: 19, pulseR: 25, axisY: 127, a0: 8, a1: 186},
} as const

const Pair = ({x, y, k, val, tone}: {x: number; y: number; k: string; val: string; tone?: string}) =>
  <text x={x} y={y} className="dp-ink-dim" style={tone ? {fill: tone} : undefined}><tspan className="dp-axis">{k} </tspan>{val}</text>

/** The line between the shell and the harness: the transport draws it, and a detached session breaks it. */
function Line({x1, x2, y, transport, connect, labelled}: {x1: number; x2: number; y: number; transport: string | undefined; connect: boolean | undefined; labelled: boolean}) {
  const mx = (x1 + x2) / 2
  const word = transport === undefined ? undefined : TRANSPORT_WORD[transport]
  if (connect === false) return <g>
    <path d={`M${x1} ${y}H${mx - 6}M${mx + 6} ${y}H${x2}`} className="dp-faint" strokeDasharray="2 3" />
    <path d={`M${mx - 3} ${y - 3}l6 6M${mx + 3} ${y - 3}l-6 6`} className="dp-faint" />
  </g>
  if (transport === 'ws') return <g>
    <path d={`M${x1} ${y}H${x2}`} className="dp-curve" />
    <path d={`M${mx - 2} ${y - 5}V${y + 5}M${mx + 2} ${y - 5}V${y + 5}`} className="dp-curve" />
    {labelled && <text x={mx} y={y - 9} className="dp-axis" textAnchor="middle">{word}</text>}
  </g>
  if (transport === 'remote') return <g>
    <path d={`M${x1} ${y}H${x2}`} className="dp-curve" strokeDasharray="4 3" />
    <path d={`M${mx} ${y - 5}L${mx + 5} ${y}L${mx} ${y + 5}L${mx - 5} ${y}Z`} className="dp-curve" style={{fill: 'var(--dp-well)'}} />
    {labelled && <text x={mx} y={y - 9} className="dp-axis" textAnchor="middle">{word}</text>}
  </g>
  if (transport === 'stdio') return <g>
    <path d={`M${x1} ${y}H${x2}`} className="dp-curve" />
    {labelled && <text x={mx} y={y - 9} className="dp-axis" textAnchor="middle">{word}</text>}
  </g>
  return <path d={`M${x1} ${y}H${x2}`} className="dp-faint" />
}

/** The link: the shell, the line, the harness with its replay ring and heartbeat, the observers, and the time since the last check-in.
 * Handle 1 sets Stall after on the scale; handle 2 sets Fan-out on the observers (whole only). */
function LinkWell({v, set, size}: {v: V; set?: ViewProps['set']; size: Size}) {
  const g = GEO[size], mini = size === 'mini', whole = size === 'whole'
  const transport = strOf(v, 'transport'), connect = boolOf(v, 'connect')
  const inflight = numOf(v, 'inflight'), running = numOf(v, 'running'), age = numOf(v, 'beatAge'), after = numOf(v, 'stallAfter')
  const ring = ringOf(v), state = liveOf(v), fan = numOf(v, 'fanOut'), peers = numOf(v, 'peers')
  const x1 = g.sx + g.sw, x2 = g.hx - g.hr - 2
  // frames in flight: dots that run both ways; faster when more turns run, still when nobody says how many
  const n = inflight === undefined || connect === false ? 0 : Math.min(6, Math.max(0, Math.round(inflight)))
  const dur = running === undefined ? undefined : clampTo(0.8, 2.8, 2.8 - 0.5 * running)
  const pulse = state === 'stalled' ? 'var(--stall)' : state === 'live' ? 'var(--dp-value)' : undefined
  const fresh = state === 'live' && age !== undefined && after !== undefined ? 1 - 0.7 * clampTo(0, 1, age / after) : 1
  // the observers: one slot each, lit for each one attached
  const cap = fan ?? (peers === undefined ? 0 : Math.ceil(peers)), pitch = whole ? 10 : 7, slot = whole ? 7 : 5
  const sy = g.cy + g.pulseR + (whole ? 9 : 3), sx0 = g.hx + g.pulseR - FAN_MAX * pitch
  // the scale
  const ax = (t: number) => atLog(t, g.a0, g.a1)
  const near = (x: number) => STOPS.reduce((best, stop, i) => (Math.abs(ax(stop) - x) < Math.abs(ax(STOPS[best]!) - x) ? i : best), 0)
  const missing = [!has(v, 'transport') && !has(v, 'connect') ? 'link' : '', ring === undefined ? 'ring' : '', age === undefined ? 'beat' : '', inflight === undefined ? 'frames' : ''].filter(Boolean)
  const sayMissing = missing.length === 4 ? 'No readings' : `No reading: ${missing.join(', ')}`
  const name = strOf(v, 'harness')
  const stallInk = state === 'stalled' ? 'var(--stall)' : undefined
  return <Display w={g.w} h={g.h} label="The link"
    does={mini ? 'The shell, the harness and the frames between them.' : 'The shell on the left, the harness on the right. Dots are frames in flight. The arc is the replay ring; the outer ring the heartbeat. Drag handle 1 to set Stall after.'}
    corner={mini ? undefined : readyWord(v) ?? NONE}>
    {!mini && <text x={g.sx} y={14} className="dp-ink" style={{fontWeight: 600}}>{name === undefined ? NONE : name.length > (whole ? 28 : 12) ? `${name.slice(0, whole ? 27 : 11)}…` : name}</text>}
    {/* the shell */}
    <rect x={g.sx} y={g.cy - 9} width={g.sw} height={18} className="dp-faint" />
    <text x={g.sx + g.sw / 2} y={g.cy + 20} className="dp-axis" textAnchor="middle">shell</text>
    {/* the line, and the frames on it */}
    <Line x1={x1} x2={x2} y={g.cy} transport={transport} connect={connect} labelled={whole} />
    {Array.from({length: n}, (_, i) => dur === undefined
      ? <circle key={i} cx={x1 + (i + 1) * (x2 - x1) / (n + 1)} cy={g.cy} r={2} fill="var(--dp-value)" />
      : <circle key={i} className="gw-dot" cx={x1} cy={g.cy} r={2} fill="var(--dp-value)" data-back={i % 2 ? 'true' : undefined}
        style={{'--span': `${x2 - x1}px`, '--dur': `${dur}s`, '--delay': `${-(i * dur) / n}s`} as CSSProperties} />)}
    {/* the harness: the replay ring round it, the heartbeat outside */}
    <circle cx={g.hx} cy={g.cy} r={g.hr} className="dp-fill" style={{stroke: 'var(--text-dim)'}} />
    <circle cx={g.hx} cy={g.cy} r={g.ringR} className="dp-faint" style={{strokeWidth: 3}} />
    {ring !== undefined && ring > 0 && <path d={arcPath(g.hx, g.cy, g.ringR, ring)} fill="none" stroke={ring >= 1 ? 'var(--stall)' : 'var(--dp-value)'} strokeWidth={3} />}
    <circle cx={g.hx} cy={g.cy} r={g.pulseR} fill="none" strokeWidth={1.2} strokeDasharray="2 2.5"
      className={pulse ? undefined : 'dp-faint'} stroke={pulse} opacity={pulse ? fresh : undefined} />
    {/* the observers */}
    {!mini && cap > 0 && <g>
      {whole && <text x={g.sx} y={sy + 6} className="dp-axis">observers</text>}
      {Array.from({length: cap}, (_, i) => {
        const lit = peers !== undefined && i < peers
        return <rect key={i} x={sx0 + i * pitch} y={sy} width={slot} height={slot} fill={lit ? 'var(--dp-value)' : 'none'} className={lit ? undefined : 'dp-faint'} />
      })}
    </g>}
    {whole && set && fan !== undefined && <Handle n={2} shape="square" x={sx0 + fan * pitch + 3} y={sy + slot / 2} label="Fan-out"
      does="Drag along the slots: how many observers may watch beside the shell."
      onDrag={x => set('fanOut', Math.round(clampTo(0, FAN_MAX, (x - 3 - sx0) / pitch)))} onReset={() => set('fanOut', FAN_DEFAULT)} />}
    {!mini && missing.length > 0 && <text x={g.sx} y={whole ? 108 : 87} className="dp-axis">{sayMissing}</text>}
    {/* the readout under the diagram: epoch and sequence, peers and the age of the last heartbeat */}
    {size === 'compact' && <>
      <Pair x={7} y={96} k="epoch" val={epochOf(v, 6)} />
      <Pair x={78} y={96} k="seq" val={shown(v, 'seq')} />
      <Pair x={7} y={106} k="peers" val={peersLine(v)} />
      <Pair x={78} y={106} k="beat" val={age === undefined ? NONE : age < 0 ? 'none' : span(age)} tone={stallInk} />
    </>}
    {/* the time since the last check-in, on the scale that ends at 30 min */}
    {whole && age !== undefined && <text x={g.a0} y={g.axisY - 9} className="dp-ink-dim" style={stallInk ? {fill: stallInk} : undefined}>
      {age < 0 ? 'no check-in' : state === 'stalled' ? `stalled · ${span(age)}` : `check-in ${span(age)} ago`}
    </text>}
    {after !== undefined && <rect x={ax(after)} y={g.axisY - 2} width={Math.max(0, g.a1 - ax(after))} height={4} fill="var(--stall)" opacity={0.3} />}
    <path d={`M${g.a0} ${g.axisY}H${g.a1}`} className="dp-grid" />
    {STOPS.map((s, i) => <g key={s}>
      <path d={`M${ax(s)} ${g.axisY - 3}V${g.axisY + 3}`} className="dp-faint" />
      {!mini && <text x={ax(s)} y={g.axisY + 15} className="dp-axis" textAnchor={i === STOPS.length - 1 ? 'end' : 'middle'} style={{fontSize: 7.5}}>{STOP_LABEL[i]}</text>}
    </g>)}
    {age !== undefined && age >= 0 && <path d={`M${ax(age)} ${g.axisY - 6}V${g.axisY + 5}`} stroke={state === 'stalled' ? 'var(--stall)' : state === 'idle' ? 'var(--text-faint)' : 'var(--dp-value)'} strokeWidth={2} />}
    {!mini && set && after !== undefined && <Handle n={1} shape="ring" x={ax(after)} y={g.axisY} label="Stall after"
      does="Drag along the scale: the time without progress after which the session counts as stalled."
      onDrag={x => set('stallAfter', STOPS[near(x)]!)} onReset={() => set('stallAfter', STALL_DEFAULT)} />}
  </Display>
}

// ---------------------------------------------------------------- the tape: five kind lanes and the Keep scale

/** The tape: five kind lanes, a tick for each frame of the chosen session (sent above its lane's line, received below, placed by the
 * time of the frame), and the Keep scale under them, with the frames held, the gateway's ring and handle 1 on Keep. `h` 146 is the
 * well of the Frames page; 92 the strip across the top of the pane. */
function TapeMarks({p, w, h}: {p: ViewProps; w: number; h: number}) {
  const v = p.v, set = p.set, tall = h >= 140
  const x0 = 56, x1 = w - 10, lane0 = tall ? 16 : 14, pitch = tall ? 15 : 10, tick = 4
  const axisY = tall ? h - 19 : 76, a0 = tall ? 14 : 150, a1 = w - 18
  const sc = scopeOf(v), pass = filterOf(v), kinds = kindsOf(v)
  const keep = numOf(v, 'keep'), ringCap = numOf(v, 'ringCap')
  const paused = boolOf(v, 'pause'), follow = boolOf(v, 'follow')
  const read = has(v, 'frames'), held = read ? sc.all.length : undefined
  const laneY = (i: number) => lane0 + i * pitch
  // the time of each frame places it along the lanes; frames without a time are spread evenly
  const times = sc.scoped.map(f => clockSecs(f.at))
  const timed = sc.scoped.length > 1 && times.every(t => t !== undefined)
  const lo = timed ? Math.min(...(times as number[])) : 0, hi = timed ? Math.max(...(times as number[])) : 0
  const px = (i: number) => {
    const a = x0 + 4, b = x1 - 4
    if (sc.scoped.length < 2) return b
    return timed && hi > lo ? a + (b - a) * ((times[i]! - lo) / (hi - lo)) : a + (b - a) * i / (sc.scoped.length - 1)
  }
  // the Keep scale: log from 100 to 5000, so the gateway's 512 and the default 1000 stand apart
  const ax = (k: number) => a0 + (a1 - a0) * clampTo(0, 1, Math.log(Math.max(k, KEEP_MIN) / KEEP_MIN) / Math.log(KEEP_MAX / KEEP_MIN))
  const fromAx = (x: number) => KEEP_MIN * Math.pow(KEEP_MAX / KEEP_MIN, clampTo(0, 1, (x - a0) / (a1 - a0)))
  const snap = (k: number) => clampTo(KEEP_MIN, KEEP_MAX, k < 1000 ? Math.round(k / 10) * 10 : Math.round(k / 100) * 100)
  const cursor = paused === true ? {stroke: 'var(--stall)', dash: '2 2'} : follow === true ? {stroke: 'var(--dp-value)', dash: undefined} : {stroke: 'var(--text-faint)', dash: '2 2'}
  const centre = (laneY(0) + laneY(4)) / 2 + 3
  const missing = sc.missing.length === 0 ? '' : sc.missing.length === 1 ? `No ${sc.missing[0]}` : 'No filter readings'
  const ks = st(p, 'keep')
  return <g>
    {KINDS.map((k, i) => <g key={k.id} opacity={kinds === undefined || kinds.includes(k.id) ? 1 : 0.4}>
      <text x={8} y={laneY(i) + 3} className="dp-axis" style={{fontSize: 7.5}}>{k.label}</text>
      <path d={`M${x0} ${laneY(i)}H${x1}`} className="dp-grid" />
    </g>)}
    {read && sc.scoped.length > 0 && <path d={`M${x1 - 1.5} ${laneY(0) - 5}V${laneY(4) + 6}`} stroke={cursor.stroke} strokeWidth={1} strokeDasharray={cursor.dash} />}
    {sc.scoped.map((f, i) => {
      const kind = kindOf(f.kind), cy = laneY(ORDER.indexOf(kind))
      const colour = kind === 'errors' ? 'var(--stall)' : f.dir === 'out' ? 'var(--dp-on)' : 'var(--dp-value)'
      return <rect key={f.id} x={px(i) - 1} y={f.dir === 'out' ? cy - tick - 0.5 : cy + 0.5} width={2} height={tick} fill={colour} opacity={pass(f) ? 1 : 0.22} />
    })}
    {!read && <text x={(x0 + x1) / 2} y={centre} className="dp-axis" textAnchor="middle">No reading of the frames</text>}
    {read && sc.scoped.length === 0 && <text x={(x0 + x1) / 2} y={centre} className="dp-axis" textAnchor="middle">{sc.note ?? 'No frames for this session'}</text>}
    {missing && <text x={x1} y={laneY(4) + 13} className="dp-axis" textAnchor="end">{missing}</text>}
    <Pair x={tall ? a0 : 14} y={tall ? axisY - 11 : axisY + 3} k="held" val={held === undefined ? NONE : `${held}`} />
    {held !== undefined && <rect x={a0} y={axisY - 2} width={Math.max(2, ax(held) - a0)} height={4} fill="var(--dp-value)" opacity={0.7} />}
    <path d={`M${a0} ${axisY}H${a1}`} className="dp-grid" />
    {[KEEP_MIN, KEEP_DEFAULT, KEEP_MAX].map((k, i) => <g key={k}>
      <path d={`M${ax(k)} ${axisY - 3}V${axisY + 3}`} className="dp-faint" />
      <text x={ax(k)} y={axisY + 12} className="dp-axis" textAnchor={i === 2 ? 'end' : i ? 'middle' : 'start'} style={{fontSize: 7.5}}>{k >= 1000 ? `${k / 1000}k` : k}</text>
    </g>)}
    {ringCap !== undefined && ringCap >= KEEP_MIN && ringCap <= KEEP_MAX && <g>
      <path d={`M${ax(ringCap)} ${axisY - 6}V${axisY + 6}`} stroke="var(--text-dim)" strokeWidth={1} />
      <text x={ax(ringCap)} y={axisY - 8} className="dp-axis" textAnchor="middle" style={{fontSize: 7.5}}>ring</text>
    </g>}
    {keep !== undefined && <Handle n={1} shape="ring" x={ax(keep)} y={axisY} label="Keep" does={`Drag along the scale: how many frames the list holds.${ks.disabled ? ` ${ks.disabled}` : ''}`}
      onDrag={ks.disabled ? undefined : x => set('keep', snap(fromAx(x)))} onReset={ks.disabled ? undefined : () => set('keep', KEEP_DEFAULT)} />}
  </g>
}

// ---------------------------------------------------------------- the controls

const transportRadio = (p: ViewProps) => <Radio label="Transport" does={SAYS.transport} value={strOf(p.v, 'transport') ?? ''} options={TRANSPORTS} stack
  onChange={x => p.set('transport', x)} {...st(p, 'transport')} />
const approvalsRadio = (p: ViewProps) => <Radio label="Approvals" does={SAYS.approvals} value={strOf(p.v, 'approvals') ?? ''} options={APPROVALS} stack
  onChange={x => p.set('approvals', x)} {...st(p, 'approvals')} />
const stallDial = (p: ViewProps) => <Dial label="Stall after" does={SAYS.stall} value={stopIndex(p.v) ?? NaN} def={1} scale={{min: 0, max: 3, step: 1}}
  format={i => STOP_LABEL[Math.round(i)]!} onChange={i => p.set('stallAfter', STOPS[Math.round(i)]!)} {...st(p, 'stallAfter')} />
const connectToggle = (p: ViewProps) => <Toggle label="Connect" does={SAYS.connect} on={boolOf(p.v, 'connect') === true} unknown={boolOf(p.v, 'connect') === undefined}
  onChange={x => p.set('connect', x)} {...st(p, 'connect')} />
const autoToggle = (p: ViewProps) => <Toggle label="Auto-continue" does={SAYS.autoContinue} on={boolOf(p.v, 'autoContinue') === true} unknown={boolOf(p.v, 'autoContinue') === undefined}
  onChange={x => p.set('autoContinue', x)} {...st(p, 'autoContinue')} />
const fanDial = (p: ViewProps) => <Dial label="Fan-out" does={SAYS.fanOut} value={numOf(p.v, 'fanOut') ?? NaN} def={FAN_DEFAULT} scale={{min: 0, max: FAN_MAX, step: 1}}
  format={x => `${Math.round(x)}`} onChange={x => p.set('fanOut', Math.round(x))} {...st(p, 'fanOut')} />

const sessionChooser = (p: ViewProps, wide?: boolean) => {
  const sc = scopeOf(p.v), cur = strOf(p.v, 'session')
  const named = sc.sessions.filter(n => n !== NONE && n !== 'all' && n !== 'lead')
  const options: Option<string>[] = [{value: 'all', label: 'All sessions'}, ...(has(p.v, 'lead') ? [{value: 'lead', label: 'The lead'}] : []), ...named.map(n => ({value: n, label: n}))]
  if (cur !== undefined && !options.some(o => o.value === cur)) options.push({value: cur, label: cur})
  return <Chooser label="Session" does={SAYS.session} value={cur ?? ''} options={options} wide={wide} onChange={x => p.set('session', x)} {...st(p, 'session')} />
}
const directionRadio = (p: ViewProps, stack?: boolean) => <Radio label="Direction" does={SAYS.direction} value={strOf(p.v, 'direction') ?? ''} options={DIRECTIONS} stack={stack}
  onChange={x => p.set('direction', x)} {...st(p, 'direction')} />
const pauseToggle = (p: ViewProps) => <Toggle label="Pause" does={SAYS.pause} on={boolOf(p.v, 'pause') === true} unknown={boolOf(p.v, 'pause') === undefined}
  onChange={x => p.set('pause', x)} {...st(p, 'pause')} />
const followToggle = (p: ViewProps) => <Toggle label="Follow" does={SAYS.follow} on={boolOf(p.v, 'follow') === true} unknown={boolOf(p.v, 'follow') === undefined}
  onChange={x => p.set('follow', x)} {...st(p, 'follow')} />
const keepBox = (p: ViewProps) => <ValueBox label="Keep" does={SAYS.keep} value={numOf(p.v, 'keep') ?? NaN} def={KEEP_DEFAULT} scale={{min: KEEP_MIN, max: KEEP_MAX, log: true}}
  format={x => `${Math.round(x)}`} onChange={x => p.set('keep', clampTo(KEEP_MIN, KEEP_MAX, x < 1000 ? Math.round(x / 10) * 10 : Math.round(x / 100) * 100))} {...st(p, 'keep')} />
/** Kinds: one toggle for each kind of frame. */
const kindToggles = (p: ViewProps) => {
  const on = kindsOf(p.v)
  return KINDS.map(k => <Toggle key={k.id} label={k.label} does={`${k.label}: ${k.does}`} on={on?.includes(k.id) === true} unknown={on === undefined}
    onChange={x => p.set('kinds', canon(x ? [...(on ?? []), k.id] : (on ?? []).filter(o => o !== k.id)))} {...st(p, 'kinds')} />)
}

const atWork = (p: ViewProps) => lightOf(p) === 'lit' && (numOf(p.v, 'running') ?? 0) > 0
const PAGES = [{id: 'link', label: 'Link'}, {id: 'frames', label: 'Frames'}] as const
const pageOf = (p: ViewProps) => (p.page === 'frames' ? 'frames' : 'link')
const head = (p: ViewProps) => ({light: lightOf(p), busy: atWork(p), onFold: p.nav.fold, onFull: p.nav.full})

/** The frames of the Frames page as rows: the newest page first shown, the frame you press opened in Full. */
function FrameRows({p}: {p: ViewProps}) {
  const sc = scopeOf(p.v), pick = numOf(p.v, 'frame'), size = 7
  const [page, setPage] = useState<number | null>(null)
  const last = Math.max(0, Math.ceil(sc.passing.length / size) - 1)
  const items: RowItem[] = sc.passing.map((f): RowItem => {
    const kind = kindOf(f.kind)
    return {id: String(f.id), name: f.note ? `${f.kind} · ${f.note}` : f.kind, light: 'lit', tone: kind === 'errors' ? 'stall' : f.dir === 'out' ? 'accent' : 'value', note: f.at,
      does: `${f.dir === 'out' ? 'Sent' : 'Received'} at ${f.at}, ${f.session}. Press to open it.`}
  })
  // No reading of the frames: the list stands empty under a hollow light, which reading is missing on the Info line.
  const label = !has(p.v, 'frames') ? 'Frames' : sc.scoped.length === 0 ? (sc.note ?? 'No frames for this session') : items.length === 0 ? 'No frame passes the filters' : 'Frames'
  return <Rows label={label} does="The frames of the chosen session that pass Direction and Kinds, newest last. Amber was sent, teal received." items={has(p.v, 'frames') ? items : undefined}
    waiting={st(p, 'frames').waiting} why="No reading of the frames." size={size}
    page={page ?? last} onPage={setPage} selected={pick === undefined ? undefined : String(pick)}
    onSelect={id => { p.set('frame', Number(id)); p.nav.full?.() }} />
}

// ---------------------------------------------------------------- the Frames page at pane size: the Gateway's Full

/** Full's head: the rate, the frames shown, whether the list follows, the epoch; every setting of the list. */
function FramesHead({p}: {p: ViewProps}) {
  const v = p.v
  return <MonitorHead title={has(v, 'harness') ? `Gateway · ${strOf(v, 'harness')}` : 'Gateway'} readings={[
    strOf(v, 'session') === 'lead' && {label: 'lead', value: strOf(v, 'lead'), does: 'The session the lead runs.'},
    {label: 'rate', value: rateWord(v), does: 'Frames a minute in the chosen session, over the time its frames span.', tone: 'value'},
    {label: 'shown', value: shownWord(v), does: 'Frames of the chosen session that pass Direction and Kinds, out of all its frames.'},
    {label: 'list', value: listState(v), does: 'Whether the list follows each new frame, stands where it is, or is held.', tone: boolOf(v, 'pause') ? 'stall' : undefined},
    {label: 'epoch', value: has(v, 'epoch') ? epochOf(v) : undefined, does: 'The gateway\'s epoch: a new epoch means the gateway restarted, and resets the cursor.'},
  ]} controls={<>
    {sessionChooser(p)}
    {directionRadio(p)}
    <MonitorGroup label="Kinds">{kindToggles(p)}</MonitorGroup>
    {followToggle(p)}
    {pauseToggle(p)}
    {keepBox(p)}
  </>} />
}

function FramesPane({p}: {p: ViewProps}) {
  const v = p.v, sc = scopeOf(v), pick = numOf(v, 'frame')
  // the list holds the rows that fit its height, top down; it never scrolls
  const listBox = useRef<HTMLDivElement>(null), frames = useRef<HTMLDivElement>(null)
  const [cap, setCap] = useState(30), [w, setW] = useState(520)
  useEffect(() => {
    const el = listBox.current, col = frames.current
    if (!el || !col) return
    const fit = () => { setCap(Math.max(1, Math.floor((el.clientHeight - 12) / 19))); if (col.clientWidth > 0) setW(col.clientWidth) }
    fit()
    if (typeof ResizeObserver === 'undefined') return
    const watch = new ResizeObserver(fit)
    watch.observe(el)
    watch.observe(col)
    return () => watch.disconnect()
  }, [])
  const follow = boolOf(v, 'follow'), read = has(v, 'frames')
  const rows = sc.passing
  // Follow off keeps the list on the newest frame that it showed when Follow went off; newer frames collect below.
  const anchor = useRef<number | null>(null)
  let end = rows.length
  if (follow === false) {
    if (anchor.current === null && rows.length) anchor.current = rows[rows.length - 1]!.id
    const at = rows.findIndex(f => f.id === anchor.current)
    if (at >= 0) end = at + 1
  } else anchor.current = null
  const visible = rows.slice(Math.max(0, end - cap), end)
  const newer = rows.length - end
  const picked = pick === undefined ? undefined : sc.all.find(f => f.id === pick)
  const behind = behindOf(v, sc), ringCap = numOf(v, 'ringCap'), ring = numOf(v, 'ring')
  const gap = behind !== undefined && ringCap !== undefined && behind > ringCap
  const state = liveOf(v), readiness = readyWord(v), refused = strOf(v, 'refused'), age = numOf(v, 'beatAge')
  return <div className="fm-body">
    <div className="fm-frames" ref={frames}>
      <div className="fm-strip">
        <svg className="fm-tape-svg" viewBox={`0 0 ${w} 92`} width={w} height={92} role="group" aria-label="The tape"
          data-i="The tape|Five kind lanes, a tick for each frame. Amber is sent, teal is received, a dim tick is hidden by a filter. Drag handle 1 to set Keep.">
          <g className="dp-display" style={{background: 'none', border: 'none'}}><TapeMarks p={p} w={w} h={92} /></g>
        </svg>
      </div>
      <div className="fm-listbox" ref={listBox}>
      {!read ? <p className="fm-empty">No reading of the frames.</p>
        : sc.scoped.length === 0 ? <p className="fm-empty">{sc.note ?? 'No frames for this session.'}</p>
        : rows.length === 0 ? <p className="fm-empty">No frame passes the filters.</p>
        : <ol className="fm-list" aria-label="Frames">
          {visible.map(f => <li key={f.id}>
            <button type="button" className="fm-frame" data-dir={f.dir} data-kind={kindOf(f.kind)} aria-pressed={f.id === pick} onClick={() => p.set('frame', f.id === pick ? undefined : f.id)}
              data-i={`${f.kind}|${f.dir === 'out' ? 'Sent' : 'Received'} at ${f.at}, ${f.session}. Press to read its task, turn and step.`}>
              <span className="fm-seq" title={f.seq === undefined ? 'A sent frame carries no sequence number.' : undefined}>{f.seq ?? NONE}</span>
              <span className="fm-at">{f.at}</span><span className="fm-dir" aria-label={f.dir === 'out' ? 'Sent' : 'Received'}>{f.dir === 'out' ? '→' : '←'}</span>
              <span className="fm-kind">{f.kind}</span><span className="fm-session">{f.session}</span><span className="fm-note">{f.note}</span>
            </button>
          </li>)}
        </ol>}
      </div>
      {read && <div className="fm-foot">
        <span data-i="held|Frames the list holds, out of the Keep limit.">held <b>{sc.all.length}</b></span>
        <span data-i="sent|Frames the shell sent, in the chosen session.">sent <b>{sc.scoped.filter(f => f.dir === 'out').length}</b></span>
        <span data-i="received|Frames the shell received, in the chosen session.">received <b>{sc.scoped.filter(f => f.dir === 'in').length}</b></span>
        {newer > 0 && <span>{newer} newer</span>}
        {behind !== undefined && behind > 0 && <span data-state={gap ? 'stalled' : undefined} data-i="behind|Frames the gateway holds for you while the list is held. It turns orange when the ring has dropped some.">
          {gap ? `gap: the gateway kept ${ringCap} of ${behind} waiting` : `${behind} waiting in the gateway`}</span>}
      </div>}
    </div>
    <aside className="fm-reads" aria-label="Readings">
      <section className="fm-read"><h4>Frame</h4>
        <strong data-state={picked === undefined ? 'none' : undefined}>{picked === undefined ? NONE : picked.turn === undefined ? NONE : `turn ${picked.turn}`}</strong>
        {picked === undefined ? <p>{NONE}</p> : <>
          <p>task <b>{picked.task ?? NONE}</b></p>
          <p>step <b>{picked.step ?? NONE}</b> · {picked.session} · {picked.at}</p></>}</section>
      {/* A refusal is drawn (the reading in the stall colour), and its words go to the Info line: never written where the harness stands. */}
      <section className="fm-read" data-i={refused !== undefined ? `Readiness|${readiness ?? 'Refused'} — ${refused}` : undefined}><h4>Readiness</h4>
        <strong data-state={strOf(v, 'readiness') === undefined ? (refused !== undefined ? 'refused' : 'none') : strOf(v, 'readiness') === 'refused' ? 'refused' : undefined}>{readiness ?? NONE}</strong>
        <p>harness <b>{shown(v, 'harness')}</b></p></section>
      <section className="fm-read"><h4>Liveness</h4>
        <strong data-state={state === 'stalled' ? 'stalled' : state === undefined ? 'none' : undefined}>{state ?? NONE}</strong>
        <p>last check-in <b>{age === undefined ? NONE : age < 0 ? 'none' : `${span(age)} ago`}</b></p>
        <p>stalls after <b>{stallLabel(v)}</b> · turns running <b>{shown(v, 'running')}</b></p></section>
      <section className="fm-read"><h4>Replay</h4>
        <strong data-state={ring === undefined || ringCap === undefined ? 'none' : undefined}>{ring === undefined || ringCap === undefined ? NONE : `${ring} of ${ringCap}`}</strong>
        <p>events in the ring · epoch <b>{epochOf(v)}</b></p>
        <p>last sequence <b>{shown(v, 'seq')}</b></p></section>
      <section className="fm-read"><h4>Upstream</h4>
        <strong data-state={has(v, 'harness') ? undefined : 'none'}>{shown(v, 'harness')}</strong>
        <p>over <b>{has(v, 'transport') ? TRANSPORT_WORD[strOf(v, 'transport')!] ?? strOf(v, 'transport') : NONE}</b> · observers <b>{peersLine(v)}</b></p>
        {boolOf(v, 'viaLead') && <p><b>via lead</b></p>}</section>
    </aside>
  </div>
}

// ================================================================ the agency build (§19.2 "The agency build")

type AState = 'ready' | 'composed' | 'refused'
type Health = 'connected' | 'connecting' | 'degraded' | 'reconnecting' | 'disconnected' | 'unavailable' | 'closed'
type Presence = 'embodied-here' | 'embodied-elsewhere' | 'not-currently-embodied' | 'unavailable'

/** The entries a person can choose, in the owner's order (gateway_modes.rs ENTRY_MODES). An open remote endpoint is Refused by
 * default and a public Funnel is never set, so neither is offered. */
const ENTRIES: readonly Option<string>[] = [
  {value: 'local-ipc', label: 'This machine only', does: 'A socket in the home folder. Only local processes that the file mode admits can reach the gateway.'},
  {value: 'loopback-service', label: 'A local service', does: 'A port on this machine. Any local process with a token, and local browsers, can reach the gateway.'},
  {value: 'private-tailnet', label: 'Your private network', does: 'The private network address. Machines that its policy admits, with a token, can reach the gateway.'},
  {value: 'tailscale-serve', label: 'A served address', does: 'A loopback port behind a private forward. Machines of the private network with a token can reach the gateway.'},
  {value: 'ssh-tunnel', label: 'An SSH tunnel', does: 'A tunnel from another machine. Whoever can log in to the far machine, with a token, can reach the gateway.'},
]
const ENTRY_TICK = ['here', 'local', 'private', 'served', 'ssh'] as const
const ENTRY_DEFAULT = 'local-ipc'
/** Agent to agent: the owner's three ingress decisions (GatewayIngressDecision). The owner's word for Ask is pair. */
const POLICY: readonly Option<string>[] = [
  {value: 'allow', label: 'Allow', does: 'A call from one agent to another goes through at once.'},
  {value: 'pair', label: 'Ask', does: 'A call waits in Approvals until you approve it.'},
  {value: 'deny', label: 'Deny', does: 'A call from one agent to another is refused, with a reason.'},
]
const POLICY_TICK = ['allow', 'ask', 'deny'] as const
const POLICY_DEFAULT = 'pair'
const STATE_WORD: Record<AState, string> = {ready: 'Ready', composed: 'Composed', refused: 'Refused'}
const STATE_SAYS: Record<AState, string> = {
  ready: 'The gateway carries messages now.',
  composed: 'Declared, and nobody has tried the entry end to end.',
  refused: 'The owner refuses this entry.',
}
const HEALTH_WORD: Record<Health, string> = {
  connected: 'Connected', connecting: 'Connecting', degraded: 'Degraded', reconnecting: 'Reconnecting', disconnected: 'Disconnected', unavailable: 'Unavailable', closed: 'Closed',
}
const PRESENCE_WORD: Record<Presence, string> = {'embodied-here': 'seated here', 'embodied-elsewhere': 'seated elsewhere', 'not-currently-embodied': 'not seated', unavailable: 'unavailable'}
const KEPT_WORD: Record<string, string> = {foreground: 'terminal', 'supervised-launchd': 'launchd', 'supervised-systemd': 'systemd', application: 'app'}
const INGRESS_WORD: Record<string, string> = {allow: 'allow', pair: 'ask', deny: 'deny'}
const INGRESS_SAYS: Record<string, string> = {allow: 'A new sender is admitted at once.', pair: 'A new sender waits for your approval.', deny: 'A new sender is refused.'}
const STANDING_SAYS: Record<string, string> = {
  delivered: 'The agent took the message at a turn boundary.',
  pending: 'The agent stands somewhere. It takes the message at its next turn boundary.',
  held: 'Nobody sits in the place. The next agent to sit there takes the message.',
  escalated: 'The message crossed into work that someone is accountable for.',
  pairing: 'The call waits for you in Approvals.',
  denied: 'The rule refused the call.',
}
const WAITING = ['pending', 'held'], REFUSED = ['pairing', 'denied']
const ASAYS = {
  service: 'Start or stop the gateway. A stopped gateway carries no message; the agents keep their work.',
  coexist: 'On: run beside the other harness gateways on this machine. Off: run alone, and hold the connectors they own.',
  entry: 'How the gateway can be reached. A change is planned first and lands when you confirm it.',
  policy: 'Whether one agent may call another. Ask puts the call in Approvals.',
  surfaces: 'The places that may send a message to an agent. The square is your request; the light is the surface\'s health.',
}

const text = (x: unknown) => (typeof x === 'string' && x.length > 0 ? x : undefined)
const records = (v: V, key: string): Record<string, unknown>[] => {
  const raw = json<unknown>(v, key, [])
  return Array.isArray(raw) ? raw.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : []
}
const oneOf = <T extends string>(x: unknown, list: readonly T[]): T | undefined => (typeof x === 'string' && (list as readonly string[]).includes(x) ? (x as T) : undefined)

interface Surface {readonly id: string; readonly name: string; readonly health?: Health; readonly enabled?: boolean; readonly ingress?: string; readonly detail?: string}
const HEALTHS = Object.keys(HEALTH_WORD) as Health[]
const surfacesOf = (v: V): Surface[] => records(v, 'surfaces').flatMap((r): Surface[] => {
  const id = text(r.id), name = text(r.name)
  if (!id || !name) return []
  return [{id, name, health: oneOf(r.health, HEALTHS), enabled: typeof r.enabled === 'boolean' ? r.enabled : undefined, ingress: oneOf(r.ingress, ['allow', 'pair', 'deny']), detail: text(r.detail)}]
})
interface Agent {readonly id: string; readonly name: string; readonly presence?: Presence; readonly waiting?: number}
const agentsOf = (v: V): Agent[] => records(v, 'agents').flatMap((r): Agent[] => {
  const id = text(r.id), name = text(r.name)
  if (!id || !name) return []
  return [{id, name, presence: oneOf(r.presence, Object.keys(PRESENCE_WORD) as Presence[]), waiting: typeof r.waiting === 'number' && r.waiting >= 0 ? r.waiting : undefined}]
})
const seated = (a: Agent) => a.presence === 'embodied-here' || a.presence === 'embodied-elsewhere'
interface Harness {readonly name: string; readonly evidence?: string}
const harnessesOf = (v: V): Harness[] => records(v, 'harnesses').flatMap((r): Harness[] => { const name = text(r.name); return name ? [{name, evidence: text(r.evidence)}] : [] })
interface Passed {readonly at: string; readonly from: string; readonly to: string; readonly via: string; readonly standing: string; readonly why?: string}
const passedOf = (v: V): Passed[] => records(v, 'passed').flatMap((r): Passed[] => {
  const standing = text(r.standing)
  if (!standing) return []
  return [{at: text(r.at) ?? NONE, from: text(r.from) ?? NONE, to: text(r.to) ?? NONE, via: text(r.via) ?? NONE, standing, why: text(r.why)}]
})

const stateOf = (v: V): AState | undefined => oneOf(strOf(v, 'state'), ['ready', 'composed', 'refused'])
const stateWord = (v: V): string | undefined => { const s = stateOf(v); return s ? STATE_WORD[s] : undefined }
const stateTone = (s: AState | undefined): Tone | undefined => (s === 'ready' ? 'green' : s === 'composed' ? 'accent' : s === 'refused' ? 'stall' : undefined)
const entryOf = (v: V): string | undefined => oneOf(strOf(v, 'entry'), ENTRIES.map(e => e.value))
const entryNext = (v: V): string | undefined => oneOf(strOf(v, 'entryPending'), ENTRIES.map(e => e.value))
const entryLabel = (id: string | undefined) => ENTRIES.find(e => e.value === id)?.label
const policyOf = (v: V): string | undefined => oneOf(strOf(v, 'agentPolicy'), POLICY.map(x => x.value))
/** The square on a surface's row: your request when you made one, else the owner's own reading. */
const requestOf = (v: V, s: Surface): boolean | undefined => (has(v, `on:${s.id}`) ? v[`on:${s.id}`] === true : s.enabled)
const surfaceLine = (v: V): string | undefined => (has(v, 'surfaces') ? `${surfacesOf(v).filter(s => s.health === 'connected').length}/${surfacesOf(v).length}` : undefined)
const seatedLine = (v: V): string | undefined => (has(v, 'agents') ? `${agentsOf(v).filter(seated).length}/${agentsOf(v).length}` : undefined)
const keptWord = (v: V): string | undefined => { const k = strOf(v, 'keptBy'); return k === undefined ? undefined : KEPT_WORD[k] ?? k }
const inboxOf = (v: V) => numOf(v, 'inbox')
/** An entry you set waits for Confirm; setting it back to the owner's entry drops the wait. */
const askEntry = (v: V, set: ViewProps['set']) => (x: string) => set('entryPending', x === entryOf(v) ? undefined : x)

const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, Math.max(1, n - 1))}…` : s)
const wrap = (s: string, n: number): string[] => {
  const lines: string[] = []
  let line = ''
  for (const word of s.split(' ')) {
    if (line && `${line} ${word}`.length > n) { lines.push(line); line = word } else line = line ? `${line} ${word}` : word
  }
  return [...lines, line].slice(0, 2)
}
/** The agents the well draws: the ones that stand here first, then the ones with mail waiting, then the rest in the owner's order. */
const priority = (a: Agent) => (a.presence === 'embodied-here' ? 0 : (a.waiting ?? 0) > 0 ? 1 : seated(a) ? 2 : 3)
const drawnAgents = (v: V, n: number): Agent[] => agentsOf(v).map((a, i) => ({a, i})).sort((x, y) => priority(x.a) - priority(y.a) || x.i - y.i).slice(0, n).map(x => x.a)

const AGEO = {
  mini: {w: 104, h: 100, y0: 15, pitch: 12, sx: 5, sw: 16, gx: 44, gw: 8, ax: 86, scaleY: 90, a0: 22, a1: 84},
  compact: {w: 140, h: 146, y0: 21, pitch: 15, sx: 6, sw: 40, gx: 64, gw: 10, ax: 104, scaleY: 127, a0: 22, a1: 118},
  whole: {w: 194, h: 146, y0: 24, pitch: 14, sx: 8, sw: 46, gx: 84, gw: 12, ax: 136, scaleY: 128, a0: 40, a1: 180},
} as const
const AROWS = 4
const E0 = 40, E1 = 180
const stopX = (i: number, n: number, a0: number, a1: number) => a0 + (a1 - a0) * (n === 1 ? 0 : i / (n - 1))
const nearStop = (x: number, n: number, a0: number, a1: number) => Math.round(clampTo(0, n - 1, ((x - a0) / (a1 - a0)) * (n - 1)))

/** The agency build's picture: surfaces → gateway → agents. A surface's line is its health; a dot beside an agent is a message that
 * waits; the rung that joins the agents is the rule for a call between them, and the scale under it sets that rule (handle 1); on the
 * whole well a second scale sets the entry (handle 2). With no reading of a part, the part is not drawn and the well names it. */
function AgencyPicture({p, size}: {p: ViewProps; size: Size}) {
  const v = p.v, g = AGEO[size], mini = size === 'mini', whole = size === 'whole'
  const set = mini ? undefined : p.set
  const running = lightOf(p) === 'lit'
  const surfaces = surfacesOf(v).slice(0, AROWS), agents = drawnAgents(v, AROWS)
  const policy = policyOf(v), entry = entryOf(v), next = entryNext(v), state = stateOf(v)
  const cy = (i: number) => g.y0 + i * g.pitch
  const top = g.y0 - 9, tall = (AROWS - 1) * g.pitch + 18
  const lineA = g.sx + g.sw, lineB = g.gx, lineC = g.gx + g.gw, lineD = g.ax - 2, rung = g.ax - 5
  const first = cy(0), last = cy(Math.max(0, agents.length - 1))
  const missing = [!has(v, 'surfaces') ? 'surfaces' : '', !has(v, 'agents') ? 'agents' : '', entry === undefined ? 'entry' : '', policy === undefined ? 'agent rule' : '', state === undefined ? 'state' : ''].filter(Boolean)
  const sayMissing = missing.length === 5 ? ['No readings'] : missing.length ? wrap(`No reading: ${missing.join(', ')}`, mini ? 20 : size === 'compact' ? 28 : 46) : []
  const captionY = whole ? 84 : mini ? 69 : 86
  const stroke = state === 'ready' ? 'var(--green)' : state === 'composed' ? 'var(--dp-on)' : state === 'refused' ? 'var(--stall)' : 'var(--text-dim)'
  const mid = (first + last) / 2
  const canPolicy = !!set && policy !== undefined && !st(p, 'agentPolicy').disabled
  const canEntry = whole && !!set && entry !== undefined && !st(p, 'entry').disabled
  const sel = next ?? entry
  return <Display w={g.w} h={g.h} label="The gateway"
    does={mini ? 'The surfaces, the gateway and the agents. A dot beside an agent is a message that waits.' : 'The surfaces on the left, the gateway in the middle, the agents on the right. A dot is a message that waits for an agent. Drag handle 1 to set Agent to agent.'}
    corner={mini ? undefined : stateWord(v) ?? NONE}>
    {surfaces.map((s, i) => {
      const y = cy(i), up = running && s.health === 'connected' && requestOf(v, s) !== false
      const held = requestOf(v, s) === false, weak = s.health === 'degraded' || s.health === 'reconnecting' || s.health === 'connecting'
      return <g key={s.id}>
        <rect x={g.sx} y={y - 5} width={g.sw} height={10} className="dp-faint" strokeDasharray={held ? '2 2' : undefined}
          style={up ? {stroke: 'var(--dp-value)'} : weak ? {stroke: 'var(--stall)'} : undefined} />
        {!mini && <text x={g.sx + 3} y={y + 3} className="dp-ink-dim" style={{fontSize: 8}}>{trunc(s.name, whole ? 9 : 8)}</text>}
        <path d={`M${lineA} ${y}H${lineB}`} className={up ? 'dp-curve' : 'dp-faint'} strokeDasharray={up ? undefined : weak ? '3 3' : '1 3'} />
      </g>
    })}
    <rect x={g.gx} y={top} width={g.gw} height={tall} className="dp-fill" style={{stroke: running ? stroke : 'var(--text-faint)'}} />
    <circle cx={g.gx + g.gw / 2} cy={top + tall / 2} r={2.2} fill={running ? 'var(--dp-value)' : 'none'} className={running ? undefined : 'dp-faint'} />
    {agents.map((a, i) => {
      const y = cy(i), n = Math.min(4, Math.round(a.waiting ?? 0)), here = a.presence === 'embodied-here', elsewhere = a.presence === 'embodied-elsewhere'
      return <g key={a.id}>
        <path d={`M${lineC} ${y}H${lineD}`} className={running ? 'dp-curve' : 'dp-faint'} strokeDasharray={running ? undefined : '1 3'} opacity={running ? 0.55 : 1} />
        {Array.from({length: n}, (_, k) => <circle key={k} cx={g.ax - 11 - k * 5} cy={y} r={1.9} fill="var(--dp-on)" />)}
        <circle cx={g.ax} cy={y} r={3.6} className={here || elsewhere ? undefined : 'dp-faint'} fill={here ? 'var(--dp-value)' : 'none'}
          stroke={elsewhere ? 'var(--dp-value)' : undefined} strokeDasharray={a.presence === 'unavailable' ? '1.5 1.5' : undefined} />
        {!mini && <text x={g.ax + 7} y={y + 3} className="dp-ink-dim" style={{fontSize: 8}}>{trunc(a.name.replace(/^@/, ''), whole ? 11 : 6)}</text>}
      </g>
    })}
    {agents.length > 1 && (policy === 'deny'
      ? <g>
        <path d={`M${rung} ${first}V${mid - 5}M${rung} ${mid + 5}V${last}`} className="dp-faint" />
        <path d={`M${rung - 3} ${mid - 3}l6 6M${rung + 3} ${mid - 3}l-6 6`} className="dp-faint" style={{stroke: 'var(--stall)'}} />
      </g>
      : <g>
        <path d={`M${rung} ${first}V${last}`} className={policy === 'allow' ? 'dp-curve' : policy === 'pair' ? 'dp-curve-on' : 'dp-faint'} strokeDasharray={policy === 'pair' ? '3 3' : undefined} />
        {policy === 'pair' && <path d={`M${rung} ${mid - 4}L${rung + 4} ${mid}L${rung} ${mid + 4}L${rung - 4} ${mid}Z`} className="dp-curve-on" style={{fill: 'var(--dp-well)'}} />}
      </g>)}
    {sayMissing.map((line, i) => <text key={i} x={g.sx} y={captionY + i * 9} className="dp-axis">{line}</text>)}
    {whole && missing.length === 0 && <>
      <text x={g.sx} y={captionY} className="dp-axis">surfaces {surfaceLine(v)}</text>
      <text x={g.w - 8} y={captionY} className="dp-axis" textAnchor="end">agents {seatedLine(v)} seated</text>
    </>}
    {size === 'compact' && <Pair x={7} y={missing.length > 0 ? 112 : 104} k="entry" val={entry === undefined ? NONE : ENTRY_TICK[ENTRIES.findIndex(e => e.value === entry)] ?? NONE} />}
    {whole && <g>
      <text x={g.sx} y={103} className="dp-axis">entry</text>
      {next !== undefined && next !== entry && <text x={g.w - 8} y={94} className="dp-axis" textAnchor="end" style={{fill: 'var(--dp-on)'}}>waits for Confirm</text>}
      <path d={`M${E0} 100H${E1}`} className="dp-grid" />
      {ENTRY_TICK.map((t, i) => <g key={t}>
        <path d={`M${stopX(i, ENTRIES.length, E0, E1)} 97V103`} className="dp-faint" />
        <text x={stopX(i, ENTRIES.length, E0, E1)} y={112} className="dp-axis" textAnchor="middle" style={{fontSize: 7.5}}>{t}</text>
      </g>)}
      {entry !== undefined && <circle cx={stopX(ENTRIES.findIndex(e => e.value === entry), ENTRIES.length, E0, E1)} cy={100} r={3} fill="var(--dp-value)" />}
      {canEntry && sel !== undefined && <Handle n={2} shape="square" x={stopX(ENTRIES.findIndex(e => e.value === sel), ENTRIES.length, E0, E1)} y={100} label="Entry"
        does="Drag along the scale: how the gateway can be reached. A change waits for Confirm."
        onDrag={x => askEntry(v, p.set)(ENTRIES[nearStop(x, ENTRIES.length, E0, E1)]!.value)} onReset={() => askEntry(v, p.set)(ENTRY_DEFAULT)} />}
    </g>}
    {whole && <text x={g.sx} y={g.scaleY + 3} className="dp-axis">calls</text>}
    <path d={`M${g.a0} ${g.scaleY}H${g.a1}`} className="dp-grid" />
    {POLICY_TICK.map((t, i) => <g key={t}>
      <path d={`M${stopX(i, 3, g.a0, g.a1)} ${g.scaleY - 3}V${g.scaleY + 3}`} className="dp-faint" />
      {!mini && <text x={stopX(i, 3, g.a0, g.a1)} y={g.scaleY + 12} className="dp-axis" textAnchor="middle" style={{fontSize: 7.5}}>{t}</text>}
    </g>)}
    {policy !== undefined && <circle cx={stopX(POLICY.findIndex(x => x.value === policy), 3, g.a0, g.a1)} cy={g.scaleY} r={mini ? 2.4 : 3} fill="var(--dp-value)" />}
    {canPolicy && <Handle n={1} shape="ring" x={stopX(POLICY.findIndex(x => x.value === policy), 3, g.a0, g.a1)} y={g.scaleY} label="Agent to agent"
      does="Drag along the scale: whether one agent may call another. Ask puts the call in Approvals."
      onDrag={x => p.set('agentPolicy', POLICY[nearStop(x, 3, g.a0, g.a1)]!.value)} onReset={() => p.set('agentPolicy', POLICY_DEFAULT)} />}
  </Display>
}

const serviceToggle = (p: ViewProps) => <Toggle label="Service" does={ASAYS.service} on={boolOf(p.v, 'service') === true} unknown={boolOf(p.v, 'service') === undefined}
  onChange={x => p.set('service', x)} {...st(p, 'service')} />
const coexistToggle = (p: ViewProps) => <Toggle label="Coexist" does={ASAYS.coexist} on={boolOf(p.v, 'coexist') === true} unknown={boolOf(p.v, 'coexist') === undefined}
  onChange={x => p.set('coexist', x)} {...st(p, 'coexist')} />
const policyRadio = (p: ViewProps) => <Radio label="Agent to agent" does={ASAYS.policy} value={policyOf(p.v) ?? ''} options={POLICY} stack
  onChange={x => p.set('agentPolicy', x)} {...st(p, 'agentPolicy')} />
const entryChooser = (p: ViewProps) => <div className="gw-wide"><Chooser wide label="Entry" does={ASAYS.entry} value={entryNext(p.v) ?? entryOf(p.v) ?? ''} options={ENTRIES}
  onChange={askEntry(p.v, p.set)} {...st(p, 'entry')} pending={entryNext(p.v) !== undefined || st(p, 'entry').pending} /></div>

/** The consent pair under a changed entry: the change waits until you confirm it. */
function Consent({p}: {p: ViewProps}) {
  const next = entryNext(p.v)
  if (next === undefined) return null
  return <div className="gw-pair">
    <Action {...st(p, 'entry')} hold label="Confirm" does={`Change the entry to ${entryLabel(next) ?? NONE}. The gateway rebinds its listener.`} onPress={() => { p.set('entry', next); p.set('entryPending', undefined) }} />
    <Action label="Cancel" does="Keep the entry as it is." onPress={() => p.set('entryPending', undefined)} />
  </div>
}
const surfacesReadout = (p: ViewProps) => <Readout label="surfaces" does="Surfaces that are connected, of the surfaces declared. Press to show the whole gateway." value={surfaceLine(p.v)} tone="value" onPress={p.nav.select} />
const stateReadout = (p: ViewProps) => <Readout label="state" does="Whether the gateway carries messages now. Composed: declared and not in use. Refused: the owner refuses it." value={stateWord(p.v)} tone={stateTone(stateOf(p.v))} />

/** Surfaces as a list: your request beside the owner's answer, and the rule for a new sender in the note. */
function SurfaceList({p, size = 6}: {p: ViewProps; size?: number}) {
  const [page, setPage] = useState(0)
  const items: RowItem[] = surfacesOf(p.v).map((s): RowItem => {
    const light: LightState = s.health === undefined ? 'unknown' : s.health === 'connected' || s.health === 'connecting' || s.health === 'degraded' || s.health === 'reconnecting' ? 'lit' : 'dark'
    const tone: Tone = s.health === 'connected' ? 'green' : 'accent'
    const weak = s.health === 'degraded' || s.health === 'reconnecting' || s.health === 'unavailable'
    return {id: s.id, name: s.name, light, tone, request: requestOf(p.v, s), note: s.ingress ? INGRESS_WORD[s.ingress] : undefined, why: weak ? s.detail ?? HEALTH_WORD[s.health!] : undefined,
      does: `${s.health ? HEALTH_WORD[s.health] : 'No reading of its health'}${s.ingress ? `. ${INGRESS_SAYS[s.ingress]}` : ''}`}
  })
  const off = st(p, 'surfaces').disabled
  // No reading of the surfaces: the list stands empty under a hollow light (breathing while the owner is asked); which reading is missing
  // goes to the Info line.
  return <Rows label="Surfaces" does={ASAYS.surfaces} items={has(p.v, 'surfaces') ? items : undefined} waiting={st(p, 'surfaces').waiting} why="No reading of the surfaces."
    size={size} page={page} onPage={setPage}
    onRequest={off ? undefined : (id, x) => p.set(`on:${id}`, x)} />
}

/** The agency build's Full: the messages that passed and the refusals with their reasons, beside its readings. */
function AgencyPane({v}: {v: V}) {
  const [only, setOnly] = useState<'all' | 'waiting' | 'refused'>('all')
  const all = passedOf(v), rows = all.filter(r => only === 'all' || (only === 'waiting' ? WAITING.includes(r.standing) : REFUSED.includes(r.standing)))
  const state = stateOf(v), reason = strOf(v, 'refused')
  const harnesses = harnessesOf(v), entry = entryOf(v), next = entryNext(v)
  return <div className="ag-pane">
    <div className="ag-strip" aria-label="The gateway">
      <b>Agency gateway</b><span>{entryLabel(entry) ?? NONE}</span><span data-state={state === 'refused' ? 'refused' : undefined}>{stateWord(v) ?? NONE}</span>
      <span>{inboxOf(v) === undefined ? NONE : `${inboxOf(v)} waiting`}</span><span>kept by {keptWord(v) ?? NONE}</span>
    </div>
    <div className="ag-body">
      <div className="ag-log">
        <div className="ag-chips" role="group" aria-label="Messages">
          {(['all', 'waiting', 'refused'] as const).map(k => <button key={k} type="button" aria-pressed={only === k} onClick={() => setOnly(k)}>{k === 'all' ? 'All messages' : k === 'waiting' ? 'Waiting' : 'Refused'}</button>)}
        </div>
        {rows.length === 0 ? <p className="ag-empty">{has(v, 'passed') ? 'No message in this list.' : 'No reading of the messages.'}</p> : <ol className="ag-list" aria-label="Messages that passed">
          {rows.map((r, i) => <li key={`${r.at}:${i}`} className="ag-row" data-standing={r.standing} title={STANDING_SAYS[r.standing]}>
            <span className="ag-at">{r.at}</span><span className="ag-who">{r.from}</span><span className="ag-arrow" aria-hidden="true">→</span><span className="ag-who">{r.to}</span>
            <span className="ag-standing">{r.standing}</span>
            <span className="ag-note"><span>{r.via}</span>{r.why !== undefined && <span>{r.why}</span>}</span>
          </li>)}
        </ol>}
      </div>
      <aside className="ag-reads" aria-label="Readings">
        <section className="ag-read"><h4>State</h4>
          <strong data-state={state ?? 'none'}>{stateWord(v) ?? NONE}</strong>
          <p>{state === undefined ? (reason ?? NONE) : state === 'refused' && reason !== undefined ? reason : STATE_SAYS[state]}</p></section>
        <section className="ag-read"><h4>Entry</h4>
          <strong data-state={entry === undefined ? 'none' : undefined}>{entryLabel(entry) ?? NONE}</strong>
          <p>reach <b>{strOf(v, 'reach') ?? NONE}</b></p>
          <p>sign-in <b>{strOf(v, 'signIn') ?? NONE}</b></p>
          <p>secrecy <b>{strOf(v, 'secrecy') ?? NONE}</b></p>
          {next !== undefined && next !== entry && <p>waits for Confirm <b>{entryLabel(next)}</b></p>}</section>
        <section className="ag-read"><h4>Inbox</h4>
          <strong data-state={has(v, 'inbox') ? undefined : 'none'}>{inboxOf(v) ?? NONE}</strong>
          <p>agents seated <b>{seatedLine(v) ?? NONE}</b></p></section>
        <section className="ag-read"><h4>Harnesses</h4>
          <strong data-state={has(v, 'harnesses') ? undefined : 'none'}>{has(v, 'harnesses') ? `${harnesses.length} found` : NONE}</strong>
          {harnesses.map(h => <p key={h.name}><b>{h.name}</b> {h.evidence ?? ''}</p>)}
          <p>{boolOf(v, 'coexist') === undefined ? NONE : boolOf(v, 'coexist') ? 'coexist' : 'alone'}</p></section>
      </aside>
    </div>
  </div>
}

const agencyHead = (p: ViewProps) => ({light: lightOf(p), onFold: p.nav.fold, onFull: p.nav.full})

const agency = {
  folded: (p: ViewProps) => <Folded title="Agency gateway" light={lightOf(p)} readings={[stateWord(p.v) ?? NONE, inboxOf(p.v) === undefined ? NONE : `${inboxOf(p.v)} msg`]} onUnfold={p.nav.unfold} />,
  compact: (p: ViewProps) => <Panel title="Agency gateway" view="compact" {...agencyHead(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <AgencyPicture p={p} size="compact" />
    </Section>
    <Section label="Macros" cols={2}>
      {policyRadio(p)}
      {serviceToggle(p)}
      {surfacesReadout(p)}
      <Readout label="inbox" does="Messages that wait for an agent." value={inboxOf(p.v)} tone="accent" />
    </Section>
  </Panel>,
  whole: (p: ViewProps) => <Panel title="Agency gateway" view="whole" {...agencyHead(p)}>
    <Band>
      <Section width={206}>
        <AgencyPicture p={p} size="whole" />
      </Section>
      <Section label="Service" cols={2}>
        {serviceToggle(p)}
        {coexistToggle(p)}
        {entryChooser(p)}
        <Consent p={p} />
      </Section>
      <Section label="Agents" grow>
        {policyRadio(p)}
      </Section>
    </Band>
    <Band>
      <Section width={224}>
        <SurfaceList p={p} />
      </Section>
      <Section label="Readings" cols={3} grow>
        {stateReadout(p)}
        <Readout label="inbox" does="Messages that wait for an agent." value={inboxOf(p.v)} tone="accent" />
        <Readout label="harnesses" does="The harnesses the gateway can reach on this machine. Open the pane to read how each was found." value={has(p.v, 'harnesses') ? harnessesOf(p.v).length : undefined} />
        <Readout label="seated" does="Agents that stand somewhere now, of all the agents AIKit knows." value={seatedLine(p.v)} tone="value" />
        <Readout label="kept by" does="What keeps the gateway running, and starts it again after a restart." value={keptWord(p.v)} />
      </Section>
    </Band>
  </Panel>,
  full: (p: ViewProps) => <AgencyPane v={p.v} />,
  widget: (p: ViewProps) => <Tile title="Agency gateway" light={lightOf(p)} span={2} onFull={p.nav.full}>
    <AgencyPicture p={p} size="mini" />
    <div className="gw-tile-side">
      <Readout label="state" does="Whether the gateway carries messages now." value={stateWord(p.v)} tone={stateTone(stateOf(p.v))} />
      <Readout big label="waiting" does="Messages that wait for an agent. Press to open the messages." value={inboxOf(p.v)} tone="accent" onPress={p.nav.full} />
      <Readout label="surfaces" does="Surfaces that are connected, of the surfaces declared." value={surfaceLine(p.v)} tone="value" />
    </div>
  </Tile>,
}

// ================================================================ the device

const TASK = 'Type-check the three TypeScript roots'
const REVIEW = 'Review the lane diff'
const b = (o: object) => ({session: 'build-lane', task: TASK, turn: 7, ...o})
const r = (o: object) => ({session: 'review-lane', task: REVIEW, turn: 2, ...o})
/** Sample frames: a lane that builds and a lane that reviews. */
const FRAMES = [
  b({dir: 'out', kind: 'prompt.submit', at: '14:02:01', note: TASK, step: 1}),
  b({seq: 381, dir: 'in', kind: 'message.start', at: '14:02:01', note: '', step: 2}),
  b({seq: 382, dir: 'in', kind: 'message.delta', at: '14:02:02', note: 'I will read the agent context first.', step: 3}),
  b({seq: 383, dir: 'in', kind: 'tool.start', at: '14:02:04', note: 'Read · src/agent/AgentShellContext.tsx', step: 4}),
  b({seq: 384, dir: 'in', kind: 'tool.complete', at: '14:02:04', note: 'Read · 412 lines', step: 4}),
  b({seq: 385, dir: 'in', kind: 'tool.start', at: '14:02:09', note: 'Bash · tsc --noEmit -p packages/live-shell/ui', step: 5}),
  b({seq: 386, dir: 'in', kind: 'approval.request', at: '14:02:09', note: 'Bash waits for you', step: 5}),
  b({dir: 'out', kind: 'approval.respond', at: '14:02:12', note: 'allow once', step: 5}),
  r({seq: 41, dir: 'in', kind: 'status.update', at: '14:02:15', note: 'reading the diff', step: 1}),
  b({dir: 'out', kind: 'session.steer', at: '14:02:21', note: 'Skip the cradle root.', step: 6}),
  b({seq: 387, dir: 'in', kind: 'tool.complete', at: '14:02:38', note: 'Bash · exit 0', step: 5}),
  r({seq: 42, dir: 'in', kind: 'message.delta', at: '14:02:41', note: 'Two findings so far.', step: 2}),
  b({seq: 388, dir: 'in', kind: 'status.update', at: '14:02:47', note: 'turn 7 of 12', step: 7}),
  b({seq: 389, dir: 'in', kind: 'message.delta', at: '14:02:52', note: 'All three roots type-check.', step: 8}),
  r({seq: 43, dir: 'in', kind: 'error', at: '14:02:55', note: 'git diff failed: no upstream', step: 3}),
]

/** The agency build's sample readings: the surfaces you use, the agents AIKit attaches, the harnesses found, the messages that passed. */
const SURFACES = [
  {id: 'gateway-connector/shell/main', name: 'This window', health: 'connected', enabled: true, ingress: 'allow'},
  {id: 'gateway-connector/terminal/main', name: 'Terminal', health: 'connected', enabled: true, ingress: 'allow'},
  {id: 'gateway-connector/telegram/main', name: 'Telegram', health: 'connected', enabled: true, ingress: 'pair'},
  {id: 'gateway-connector/slack/main', name: 'Slack', health: 'disconnected', enabled: false, ingress: 'pair'},
]
const AGENTS = [
  {id: 'agent:nara', name: '@nara', presence: 'embodied-here', waiting: 0},
  {id: 'agent:aikit-guardian', name: '@aikit-guardian', presence: 'not-currently-embodied', waiting: 2},
  {id: 'agent:central-guardian', name: '@central-guardian', presence: 'not-currently-embodied', waiting: 1},
  {id: 'agent:aletheia', name: '@aletheia', presence: 'not-currently-embodied', waiting: 0},
  {id: 'agent:anima', name: '@anima', presence: 'not-currently-embodied', waiting: 0},
]
const HARNESSES = [{name: 'hermes', evidence: 'its service is loaded'}, {name: 'openclaw', evidence: 'its binary is on the path'}]
const PASSED = [
  {at: '14:02:07', from: '@nara', to: '@aikit-guardian', via: 'this machine', standing: 'pending', why: 'Waits for its next turn.'},
  {at: '14:02:31', from: 'telegram:owner', to: '@nara', via: 'Telegram', standing: 'delivered'},
  {at: '14:03:10', from: '@aletheia', to: '@anima', via: 'this machine', standing: 'held', why: 'Nobody sits in the place yet.'},
  {at: '14:04:02', from: 'telegram:unknown', to: '@nara', via: 'Telegram', standing: 'pairing', why: 'The call waits in Approvals.'},
  {at: '14:04:15', from: '@anima', to: '@aletheia', via: 'this machine', standing: 'denied', why: 'Agent to agent is Deny for this pair.'},
  {at: '14:05:20', from: '@nara', to: '@central-guardian', via: 'this machine', standing: 'escalated', why: 'Crossed into Factory custody.'},
]
const AGENCY = {
  build: 'agency', light: 'lit', service: true, entry: ENTRY_DEFAULT, coexist: true, agentPolicy: POLICY_DEFAULT,
  state: 'ready', reach: 'local processes the file mode admits', signIn: 'file mode: owner scope', secrecy: 'none needed; stays in the kernel', keptBy: 'supervised-launchd',
  inbox: 3, surfaces: JSON.stringify(SURFACES), agents: JSON.stringify(AGENTS), harnesses: JSON.stringify(HARNESSES), passed: JSON.stringify(PASSED),
}

/** Every key the harness build reports or holds: the "Refused" fixture leaves all of them out but the light and the reason. */
const KEYS = ['build', 'harness', 'connect', 'transport', 'approvals', 'stallAfter', 'autoContinue', 'fanOut', 'readiness', 'epoch', 'seq', 'peers', 'beatAge', 'inflight', 'running',
  'ring', 'ringCap', 'frames', 'viaLead', 'lead', 'session', 'direction', 'kinds', 'follow', 'pause', 'keep']
const NOTHING = Object.fromEntries(KEYS.map(k => [k, undefined])) as unknown as Values

const isA = (p: ViewProps) => isAgency(p.v)

export const design: DesignedDevice = {
  id: 'actuation:gateway',
  title: 'Gateway',
  kind: 'connection',
  firstPage: 'link',
  defaults: {
    light: 'lit', build: 'hermes', harness: 'hermes',
    // What the owner writes, at the owner's defaults.
    connect: true, transport: 'stdio', approvals: 'ask', stallAfter: STALL_DEFAULT, autoContinue: true, fanOut: FAN_DEFAULT,
    // The Frames page's own settings, at their defaults.
    session: 'all', direction: 'both', kinds: ALL_KINDS, follow: true, pause: false, keep: KEEP_DEFAULT,
    // Readings: what the owner reports, never set from here.
    lead: 'build-lane', readiness: 'ready', epoch: '3f9a21c4e07b4d59a1e2c6b83d70f5a4', seq: 389, peers: 2, beatAge: 6, inflight: 3, running: 2, ring: 389, ringCap: 512,
    frames: JSON.stringify(FRAMES),
  },
  fixtures: {
    Ready: {},
    Stalled: {beatAge: 140, inflight: 0, running: 1},
    'Frames held': {pause: true, follow: false, session: 'lead', seq: 401},
    Refused: {...NOTHING, light: 'dark', readiness: 'refused', refused: 'The gateway refused the read: it is not running.'},
    'Agency build': AGENCY,
    'Agency build, not running': {...AGENCY, light: 'dark', service: false, state: undefined, entry: undefined, surfaces: undefined, passed: undefined, inbox: undefined,
      refused: 'The gateway socket does not exist. Start one with the gateway serve command.'},
  },

  folded: p => isA(p) ? agency.folded(p) : <Folded title="Gateway" light={lightOf(p)} readings={[shown(p.v, 'harness')]} onUnfold={p.nav.unfold} />,

  compact: p => isA(p) ? agency.compact(p) : <Panel title="Gateway" view="compact" {...head(p)} onSelect={p.nav.select}>
    <Section width={152}>
      <LinkWell v={p.v} set={p.set} size="compact" />
    </Section>
    <Section label="Macros" cols={2} width={124}>
      {transportRadio(p)}
      {approvalsRadio(p)}
      {stallDial(p)}
      {connectToggle(p)}
    </Section>
  </Panel>,

  whole: p => isA(p) ? agency.whole(p) : <Panel title="Gateway" view="whole" {...head(p)} pages={PAGES} page={pageOf(p)} onPage={p.setPage}>
    {pageOf(p) === 'link' ? <>
      <Band>
        <Section width={206}>
          <LinkWell v={p.v} set={p.set} size="whole" />
        </Section>
        <Section label="Link" cols={2}>
          {transportRadio(p)}
          {fanDial(p)}
          {connectToggle(p)}
        </Section>
        <Section label="Approval" grow>
          {approvalsRadio(p)}
        </Section>
      </Band>
      <Band>
        <Section label="Liveness" cols={2} width={152}>
          {stallDial(p)}
          {autoToggle(p)}
        </Section>
        <Section label="Readiness" cols={4} grow>
          <Readout label="state" does="The harness's state: its database, its settings, its model and its disk. A refusal shows here in orange." value={readyWord(p.v)} tone={readyTone(p.v)} />
          <Readout label="epoch" does="Which start of the gateway these frames belong to. A new epoch means the gateway restarted, and the shell syncs again." value={strOf(p.v, 'epoch') === undefined ? undefined : epochOf(p.v)} />
          <Readout label="seq" does="The last sequence number of this session. Each session counts its own frames." value={numOf(p.v, 'seq')} />
          <Readout label="ring" does="Events the replay ring holds, of the events it keeps." value={numOf(p.v, 'ring') === undefined || numOf(p.v, 'ringCap') === undefined ? undefined : `${numOf(p.v, 'ring')}/${numOf(p.v, 'ringCap')}`} />
          <Readout label="peers" does="Observers attached beside the shell, of the observers allowed." value={numOf(p.v, 'peers') === undefined ? undefined : peersLine(p.v)} />
          <Readout label="in flight" does="Frames sent and not yet taken." value={numOf(p.v, 'inflight')} tone="value" />
          <Readout label="turns" does="Turns that run through this gateway now." value={numOf(p.v, 'running')} />
          <Readout label="check-in" does="The time since the session last made progress." value={numOf(p.v, 'beatAge') === undefined ? undefined : span(numOf(p.v, 'beatAge')!)}
            tone={liveOf(p.v) === 'stalled' ? 'stall' : undefined} />
        </Section>
      </Band>
    </> : <>
      <Band>
        <Section width={220}>
          <Display w={208} h={146} label="The tape" corner={listState(p.v) ?? NONE}
            does="Five kind lanes, a tick for each frame of the chosen session: amber sent, teal received, dim hidden by a filter. Drag handle 1 to set Keep.">
            <TapeMarks p={p} w={208} h={146} />
          </Display>
        </Section>
        <Section label="Frames" cols={2} grow>
          <div className="gw-wide">{sessionChooser(p, true)}</div>
          {directionRadio(p, true)}
          <div className="gw-stack">{followToggle(p)}{pauseToggle(p)}{keepBox(p)}</div>
        </Section>
      </Band>
      <Band>
        <Section label="Kinds" width={76}>
          {kindToggles(p)}
        </Section>
        <Section grow>
          <FrameRows p={p} />
        </Section>
        <Section label="Rate" cols={1} width={64}>
          <Readout label="frames/min" does="Frames a minute in the chosen session, over the time its frames span." value={rateWord(p.v)?.replace('/min', '')} tone="value" />
          <Readout label="shown" does="Frames of the chosen session that pass Direction and Kinds, out of all its frames." value={shownWord(p.v)} />
        </Section>
      </Band>
    </>}
  </Panel>,

  full: p => isA(p) ? agency.full(p) : <MonitorPane label="Gateway frames" head={<FramesHead p={p} />}><FramesPane p={p} /></MonitorPane>,

  widget: p => {
    if (isA(p)) return agency.widget(p)
    const sc = scopeOf(p.v), read = has(p.v, 'frames'), lines = sc.passing.slice(-TILE_LINES), open = (id: number) => { p.set('frame', id); p.nav.full?.() }
    return <Tile title={has(p.v, 'harness') ? `Gateway · ${strOf(p.v, 'harness')}` : 'Gateway'} light={lightOf(p)} busy={atWork(p)} span={2} onFull={p.nav.full}
      badge={<span data-tone={readyTone(p.v)} className="gw-badge">{readyWord(p.v) ?? NONE}</span>}>
      <LinkWell v={p.v} size="mini" />
      <div className="fm-tape" aria-label="The last frames">
        {!read ? <p className="fm-empty">No reading of the frames.</p>
          : sc.scoped.length === 0 ? <p className="fm-empty">{sc.note ?? 'No frames for this session.'}</p>
          : lines.length === 0 ? <p className="fm-empty">No frame passes the filters.</p>
          : <ol>{lines.map(f => <li key={f.id} className="fm-tl" data-dir={f.dir} data-kind={kindOf(f.kind)} role="button" tabIndex={0} aria-label={`Open ${f.kind} in Full`}
            data-i={`${f.kind}|${f.dir === 'out' ? 'Sent' : 'Received'} at ${f.at}. Press to open it in Full.`} onClick={() => open(f.id)} onKeyDown={e => { if (e.key === 'Enter') open(f.id) }}>
            <span className="fm-tl-dir">{f.dir === 'out' ? '→' : '←'}</span><span className="fm-tl-kind">{f.kind}</span><span className="fm-tl-note">{f.note}</span>
          </li>)}</ol>}
      </div>
    </Tile>
  },
}
