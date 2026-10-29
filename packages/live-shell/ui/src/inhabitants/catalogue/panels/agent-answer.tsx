// The answer's face (manual §19.4 "The answer's face"): the Agent answering you on a page, in Central. Not a device of its own: the Answer
// (central:nara-conversation) was retired into the Agent in the 22 Oct manual rewrite ("Answer is the Agent on a page's chain"), and the
// Agent (actuation:harness-model) carries its parts through this module, ported from the retired design (central__nara-conversation.tsx
// and .css at 322134d71^, ticket 804): the well with the live face at its left, the Answer and Face pages, the pane that is mostly the
// face, and the small face that stands in for it on the chain and the rail.
//
// "In Central, the answer is a face. Opened, the Answer is mostly the face, whole and live: at rest while the agent waits, attending while
// you speak, intent on the packet while it reads, its mouth moving with its words while it answers, and asleep while no conversation is
// bound." The Agent shows this face where it speaks to you: where its voice is read, the Voice page reporting what the voice does now
// (`speech.now`; the one voice owner is the Answer's, agent/devices/voiceBinding.ts). Elsewhere its face is the creature of its type.
//
// The keys, all the Agent's (a key no owner reports is absent, and the views draw "—" and name it):
//   light, agent, effort, thread, draft, sent   the Agent's own; `light` lit is the conversation bound, dark is none bound (asleep).
//   run                                         the run state the Agent reads (actuation__harness-model.tsx runStateOf): reading the
//                                               packet while it thinks or acts, answering while it produces.
//   role, answerAs (new · replace), packet [{entry, scope, text, label?, bytes?}], context (bytes), sources [{n, name, tag, at, lines}],
//   entry                                       readings of the answer: its role, how it joins the page (the transport's Overdub, §19.4
//                                               Transport), what it reads, what it cites, and the entry asked about.
//   speech.hears, speech.speaks (on · off), speech.now (quiet · listening · speaking), speech.heard
//                                               the voice, as its owner holds it (carried under the Voice page's prefix).
//   face.chat (on · off), face.emotion, face.feeling.v, face.feeling.a, face.gaze.x, face.gaze.y, face.gesture, face.do, face.source
//                                               the view's own: the conversation beside the face, the face's dynamics, the source open.
//   thread.approve, thread.decline              a proposal's Accept and Decline: the session's own consent verbs, on the Thread page.
import {memo, useMemo, type CSSProperties} from 'react'
import {Band, Chooser, Dial, Display, Handle, Pad, Radio, Readout, Section, Toggle, Action, type LightState, type Option} from '../../sdk/panel'
import {Icon, type IconName} from '../../sdk/Icon'
import {maskStatic} from '../../../agent/maskFace'
import {FACE_EMOTIONS, FACE_GESTURES, FaceStage, maskOf, useFaceColours, type FaceEmotion, type FaceGesture, type FacePose, type FaceState} from '../../../agent/FaceStage'
import type {RunState} from '../faces/agency'
import {NONE, clampTo, has, json, numOf, st, strOf, type Value, type ViewProps} from './design'
import './agent-answer.css'

type V = ViewProps['v']

/** Where the Agent answers with its speaking face: where its voice is read (the Voice page reports what the voice does now). */
export const answersWithFace = (v: V): boolean => has(v, 'speech.now')

/** The shell's four effort steps (agent/AgentShellContext.tsx EFFORT_STEPS). */
const EFFORTS = ['low', 'medium', 'high', 'max'] as const
/** The native turn budget: a turn above 256 KiB is refused (desktop/cradle/src/nara/nativeDialogue.ts). */
const BUDGET = 256 * 1024
const kb = (bytes: number) => `${bytes < 10240 ? (bytes / 1024).toFixed(1) : Math.round(bytes / 1024)} KB`
const short = (text: string, n: number) => (text.length > n ? `${text.slice(0, Math.max(1, n - 1)).trimEnd()}…` : text)

const ANSWER_AS: readonly Option<string>[] = [
  {value: 'new', label: 'New', does: 'The answer joins as a new entry after the last entry.'},
  {value: 'replace', label: 'Replace', does: 'The answer takes the place of the selected entry.'},
]
const SAYS = {
  answerAs: 'New entry adds the answer after the last entry. Replace puts it in place of the selected entry. The transport\'s Overdub sets it.',
  effort: 'How hard the agent thinks on each answer. Drag handle 1 across the rungs.',
}

// ---------------------------------------------------------------- the sample material (the gallery's fixtures)
// Ported from the retired Answer's fixtures. The views never read these: the owners' readings arrive on the keys above, and a key that is
// missing draws as a missing reading.

const DOC = 'Factory original development Run'
const QUESTION = 'What does this entry ask of me?'
/** The packet: what the Packet sent. Sizes are the bytes of each item (the document is Control/self/agents/relational-logos.md). */
const SAMPLE_PACKET = [
  {entry: 7, scope: 'selection', text: 'The development Run has not started its workers', bytes: 312},
  {entry: 8, scope: 'whole entry', text: 'The first worker can retain its coordinator', bytes: 428},
  {entry: 0, scope: 'document', label: 'relational-logos.md', text: 'I MUST inhabit one continuing identity through self-relation and other-relation.', bytes: 4618},
]
/** The answer in parts; a part with a source ends in its number. */
const SAMPLE_PARTS: readonly Part[] = [
  {t: 'The entry reports; it does not ask for anything.'},
  {t: 'It says the Run has not started its workers.', s: 2},
  {t: 'The next entry adds that the first worker can retain its coordinator.', s: 3},
  {t: 'So the wait is on the start, not on you. Receive it as a report.', s: 1},
]
const answerRow = (parts: readonly Part[]) => ({who: 'Nara', kind: 'agent', text: parts.map(x => x.t).join(' '), parts})
/** The exchange: the question, the answer, and then what stands in the page (a proposal that waits, or the receipt of a write). */
const sampleExchange = (end: 'proposal' | 'written', replace = false) => JSON.stringify([
  {who: 'you', kind: 'you', text: QUESTION},
  answerRow(SAMPLE_PARTS),
  end === 'proposal' ? {who: 'Nara', kind: 'proposal', text: replace ? 'replace entry 7' : 'add as entry 9', tool: DOC}
    : {who: 'Nara', kind: 'receipt', text: replace ? 'entry 7 replaced' : 'entry 9 added', tool: `${DOC} · revision 14 · 22:31`},
])
/** The answer as far as it has come, while the agent answers. */
const partialExchange = () => JSON.stringify([{who: 'you', kind: 'you', text: QUESTION}, answerRow(SAMPLE_PARTS.slice(0, 2).map(x => ({t: x.t})))])
/** The sources, each with the line it came from: relational-logos.md at its revision, and two entries of the Flow. */
const SAMPLE_SOURCES = [
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
/** The answer's face at rest: the voice closed, the face neutral, the conversation beside it, the answer read and waiting in the page. */
const ANSWERING: Readonly<Record<string, Value | undefined>> = {
  agent: 'Nara', role: 'nara', answerAs: 'new', effort: 'high', run: undefined, context: 38912, entry: 7, document: DOC,
  packet: JSON.stringify(SAMPLE_PACKET), thread: sampleExchange('proposal'), sources: JSON.stringify(SAMPLE_SOURCES),
  'speech.hears': 'off', 'speech.speaks': 'off', 'speech.now': 'quiet', 'speech.heard': '',
  'face.chat': 'on', 'face.emotion': 'neutral', 'face.feeling.v': 0, 'face.feeling.a': 0, 'face.gaze.x': 0, 'face.gaze.y': 0, 'face.gesture': 'nod', 'face.do': 0, 'face.source': '1',
}
/** The gallery's fixtures of the answer's face, laid over the Agent's defaults (actuation__harness-model.tsx). */
export const ANSWER_FIXTURES: Readonly<Record<string, Readonly<Record<string, Value | undefined>>>> = {
  'Answering on a page': ANSWERING,
  'Answering on a page, answering': {...ANSWERING, run: 'producing', thread: partialExchange(), sources: undefined},
  'Answering on a page, hearing you': {...ANSWERING, 'face.chat': 'off', 'speech.hears': 'on', 'speech.now': 'listening', 'speech.heard': 'What does this entry ask of me'},
  'Answering on a page, speaking': {...ANSWERING, 'face.chat': 'off', 'speech.hears': 'on', 'speech.speaks': 'on', 'speech.now': 'speaking', run: 'producing', thread: partialExchange(), sources: undefined},
  'Answering on a page, wry': {...ANSWERING, 'face.emotion': 'curious', 'face.feeling.v': 0.4, 'face.feeling.a': 0.3, 'face.gaze.x': -0.5, 'face.gaze.y': 0.2},
  'Answering on a page, replaced and written': {...ANSWERING, answerAs: 'replace', thread: sampleExchange('written', true)},
  'Answering on a page, not bound': {...ANSWERING, light: 'dark', context: undefined},
}

// ---------------------------------------------------------------- the owner's material, read safely

const obj = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x)
const text = (x: unknown) => (typeof x === 'string' ? x : undefined)
/** A list carried as JSON in a key: its readable members, or undefined when the key is absent or does not hold a list. */
function listOf<T>(v: V, key: string, read: (x: unknown) => T | undefined): T[] | undefined {
  const raw = json<unknown>(v, key, undefined)
  return Array.isArray(raw) ? raw.map(read).filter((x): x is T => x !== undefined) : undefined
}

/** An item of the packet: the words the agent reads, the scope it was added under (the Packet's item). */
interface Item {readonly entry?: number; readonly scope?: string; readonly text: string; readonly label?: string; readonly bytes?: number}
const readItem = (x: unknown): Item | undefined => (!obj(x) || text(x.text) === undefined ? undefined
  : {entry: typeof x.entry === 'number' ? x.entry : undefined, scope: text(x.scope), text: x.text as string, label: text(x.label) || undefined, bytes: typeof x.bytes === 'number' && x.bytes >= 0 ? x.bytes : undefined})
const packetOf = (v: V) => listOf(v, 'packet', readItem)
const sizeOf = (i: Item) => i.bytes ?? new TextEncoder().encode(i.text).length
const itemName = (i: Item) => i.label ?? (i.entry === undefined ? NONE : `Entry ${i.entry}`)
const itemKind = (i: Item) => (i.scope === undefined ? NONE : i.scope === 'whole entry' ? 'entry' : i.scope)
const packetBytes = (v: V) => packetOf(v)?.reduce((n, i) => n + sizeOf(i), 0)

interface SrcLine {readonly n: number; readonly t: string; readonly hit?: boolean}
interface Source {readonly n: number; readonly name: string; readonly tag: string; readonly at: string; readonly lines: readonly SrcLine[]}
const readSource = (x: unknown): Source | undefined => (!obj(x) || typeof x.n !== 'number' || text(x.name) === undefined ? undefined
  : {n: x.n, name: x.name as string, tag: text(x.tag) ?? '', at: text(x.at) ?? '', lines: Array.isArray(x.lines)
    ? x.lines.filter(obj).map(l => ({n: typeof l.n === 'number' ? l.n : 0, t: text(l.t) ?? '', hit: l.hit === true})) : []})
const sourcesOf = (v: V) => listOf(v, 'sources', readSource)

/** The exchange from the Agent's thread rows: your words (a steer or a queued line is yours too), the agent's answers with their claims,
 * and what stands in the page (a proposal that waits or was answered, the receipt of a write). The tools the agent used are its thread's
 * (the Thread page), not the exchange's; a row of another kind is a note. */
type Kind = 'you' | 'agent' | 'proposal' | 'receipt' | 'text'
interface Part {readonly t: string; readonly s?: number}
interface Row {readonly who: string; readonly kind: Kind; readonly text: string; readonly tool?: string; readonly state?: string; readonly parts?: readonly Part[]}
const YOURS = new Set(['you', 'steer', 'queued'])
function rowsOf(v: V): Row[] | undefined {
  const raw = json<unknown>(v, 'thread', undefined)
  const sent = strOf(v, 'sent')?.trim()
  if (!Array.isArray(raw) && !sent) return undefined
  const rows: Row[] = []
  for (const item of Array.isArray(raw) ? raw : []) {
    if (!obj(item) || item.kind === 'tool') continue
    const parts = Array.isArray(item.parts) ? item.parts.filter(obj).filter(x => text(x.t) !== undefined).map(x => ({t: x.t as string, s: typeof x.s === 'number' ? x.s : undefined})) : []
    const kind: Kind = YOURS.has(String(item.kind)) ? 'you' : item.kind === 'agent' || item.kind === 'proposal' || item.kind === 'receipt' ? item.kind : 'text'
    rows.push({who: kind === 'you' ? 'you' : text(item.who) || NONE, kind, text: text(item.text) ?? '', tool: text(item.tool) || undefined, state: text(item.state),
      parts: parts.length ? parts : undefined})
  }
  if (sent && !rows.some(r => r.text === sent)) rows.push({who: 'you', kind: 'you', text: sent})
  return rows
}

// ---------------------------------------------------------------- readings

type Phase = 'idle' | 'reading' | 'answering'
/** What the agent does now, from the run state the Agent reads: intent on the packet while it thinks or acts, answering while it produces. */
const PHASE_OF: Readonly<Record<RunState, Phase>> = {queued: 'idle', thinking: 'reading', acting: 'reading', waiting: 'idle', stalled: 'idle', producing: 'answering', done: 'idle', failed: 'idle'}
/** The light the owner reports (lit, dark, or a word for "not read"); undefined when it reports none. It reads the owner alone. */
const lightOf = (p: ViewProps) => strOf(p.owner ?? p.v, 'light')
const lampOf = (p: ViewProps): LightState => { const x = lightOf(p); return x === 'lit' || x === 'dark' ? x : 'unknown' }
const effortAt = (v: V) => { const i = EFFORTS.indexOf(strOf(v, 'effort') as (typeof EFFORTS)[number]); return i < 0 ? undefined : i }
/** What the voice does now, as its owner reports it; undefined when it reports none. */
const voiceOf = (v: V): 'quiet' | 'listening' | 'speaking' | undefined => { const x = strOf(v, 'speech.now'); return x === 'quiet' || x === 'listening' || x === 'speaking' ? x : undefined }
const onOf = (v: V, key: string): boolean | undefined => { const x = strOf(v, key); return x === 'on' ? true : x === 'off' ? false : undefined }

/** What the agent does now, in words: not bound (asleep), hearing you, speaking, reading the packet, answering, or at rest. */
export function answerStateWord(p: ViewProps, run: RunState): string | undefined {
  const l = lightOf(p)
  if (l === undefined) return undefined
  if (l === 'dark') return 'not bound'
  // Not read: no word in the state's place — its readout stands "—" with the No-reading standing, and the Info line says so.
  if (l !== 'lit') return undefined
  const vo = voiceOf(p.v)
  return vo === 'listening' ? 'hearing you' : vo === 'speaking' ? 'speaking' : PHASE_OF[run]
}
const standingWord = (p: ViewProps): string | undefined => { const l = lightOf(p); return l === undefined ? undefined : l === 'lit' ? 'bound' : l === 'dark' ? 'no subject' : 'resolving' }
/** The bytes of identity and Expression the turn carries; undefined when the owner has not read them. */
const contextOf = (v: V) => { const n = numOf(v, 'context'); return n === undefined || n < 0 ? undefined : n }
/** The whole turn: the context and the packet. Undefined while either is not read. */
const turnBytes = (v: V) => { const c = contextOf(v), k = packetBytes(v); return c === undefined || k === undefined ? undefined : c + k }

/** Where the answer stands in the page, from the rows after the last answer: nowhere yet, waiting for you, kept, or declined. */
type Landing = 'none' | 'waits' | 'kept' | 'declined'
function landingOf(p: ViewProps, run: RunState, rows: readonly Row[] | undefined): Landing {
  if (lampOf(p) !== 'lit' || PHASE_OF[run] !== 'idle') return 'none'
  const after = rows ? rows.slice(rows.map(r => r.kind).lastIndexOf('agent') + 1) : []
  const last = [...after].reverse().find(r => r.kind === 'proposal' || r.kind === 'receipt')
  if (!last) return 'none'
  return last.kind === 'receipt' || last.state === 'approve' ? 'kept' : last.state === 'declined' || last.state === 'decline' ? 'declined' : 'waits'
}
const LANDING_WORD: Readonly<Record<Exclude<Landing, 'none'>, string>> = {waits: 'waits', kept: 'kept', declined: 'declined'}

/** The light carries its ring while the agent hears, speaks or works (§19.4 The answer's face, Widget). */
export const answerBusy = (p: ViewProps, run: RunState): boolean => {
  const vo = voiceOf(p.v)
  return lampOf(p) === 'lit' && (PHASE_OF[run] !== 'idle' || vo === 'listening' || vo === 'speaking')
}
/** How its answers reach the page, in a word (Folded: the agent's name and how its answers reach the page). */
export const answerAsWord = (v: V): string | undefined => { const x = strOf(v, 'answerAs'); return x === undefined ? undefined : x === 'replace' ? 'replaces' : x === 'new' ? 'new entry' : x }

// ---------------------------------------------------------------- the face

const unitOf = (v: V, key: string) => Math.max(-1, Math.min(1, numOf(v, key) ?? 0))
/** The face's pose: the state it is in (hearing you, speaking, reading, at rest, or asleep while nothing is bound), then the dynamics you
 * set — the emotion, the feeling, where it looks, a gesture — which stand while the agent is at rest and which its own states move over. */
export function poseOf(p: ViewProps, run: RunState): FacePose {
  const v = p.v, lit = lampOf(p) === 'lit', vo = voiceOf(v)
  const state: FaceState = !lit ? 'idle' : vo === 'listening' ? 'listening' : vo === 'speaking' ? 'answering' : PHASE_OF[run]
  const emotion = strOf(v, 'face.emotion') as FaceEmotion | undefined, gesture = strOf(v, 'face.gesture') as FaceGesture | undefined
  const feeling: [number, number] = [unitOf(v, 'face.feeling.v'), unitOf(v, 'face.feeling.a')], gaze: [number, number] = [unitOf(v, 'face.gaze.x'), unitOf(v, 'face.gaze.y')]
  return {
    state, dim: !lit,
    // With Speaks on, the mouth waits for the voice; otherwise the face moves its mouth to the words itself.
    speaking: onOf(v, 'speech.speaks') ? false : undefined,
    ...(emotion && emotion !== 'neutral' && FACE_EMOTIONS.includes(emotion) ? {emotion} : {}),
    ...(feeling[0] || feeling[1] ? {affect: feeling} : {}),
    ...(gaze[0] || gaze[1] ? {gaze} : {}),
    ...(gesture && FACE_GESTURES.includes(gesture) ? {gesture: {name: gesture, n: numOf(v, 'face.do') ?? 0}} : {}),
  }
}
/** The agent's face, live and whole, where the device is opened (agent/FaceStage.tsx). Until it stands, and wherever it cannot, the mask in
 * the same pose. */
function LiveFace({p, run, className, style, still}: {p: ViewProps; run: RunState; className?: string; style?: CSSProperties; still?: boolean}) {
  return <FaceStage className={className} style={style} still={still} {...poseOf(p, run)} label={`${strOf(p.v, 'agent') ?? 'The agent'}: ${answerStateWord(p, run) ?? 'no reading'}`} />
}
/** The small face (§19.4: "a still drawing of the same face, in the same state"), drawn inside a display: the chain's well, the rail's tile. */
export const SmallFace = memo(function SmallFace({x, y, size, pose}: {x: number; y: number; size: number; pose: FacePose}) {
  const {ink, ground} = useFaceColours(), expr = maskOf(pose)
  const html = useMemo(() => maskStatic(expr, ink, ink, size, ground), [expr, ink, ground, size])
  return <g transform={`translate(${x} ${y})`} opacity={pose.dim ? 0.4 : 1} data-face={expr} dangerouslySetInnerHTML={{__html: html}} />
})
/** The small face beside a line of the exchange. */
const Avatar = memo(function Avatar({expr, size = 18}: {expr: string; size?: number}) {
  const {ink, ground} = useFaceColours()
  const html = useMemo(() => maskStatic(expr, ink, ink, size, ground), [expr, ink, ground, size])
  return <svg className="an-face" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true"><g dangerouslySetInnerHTML={{__html: html}} /></svg>
})

// ---------------------------------------------------------------- the well

/** Whole, the live face stands at the left of the well, in the well's own pixels, as tall as the well holds it; the well draws the rest
 * beside it. */
const FACE_BOX = {x: 2, y: 6, w: 96, h: 134} as const
const WHOLE_OX = FACE_BOX.x + FACE_BOX.w + 2
/** The whole well: the face, then the drawing (the compact's measures, widened). */
export const WHOLE_WELL = {w: WHOLE_OX + 174, h: 146} as const

/** The well: the agent and what it does now, the turn against its budget (the ruler), the chat and the page side by side — the question,
 * the answer, and where the answer lands — then the effort rungs (handle 1) and, whole, Answer as (handle 3). Whole, the agent's live
 * face stands at its left (FACE_BOX), laid over the well as a frame of its own: a frame inside the svg is not drawn by every engine. The
 * face takes no pointer, so the handles beside it keep their hand. */
export function AnswerWell({p, run, w, h, size}: {p: ViewProps; run: RunState; w: number; h: number; size: 'compact' | 'whole'}) {
  const v = p.v, set = p.set, whole = size === 'whole'
  const lamp = lampOf(p), lit = lamp === 'lit', ph = PHASE_OF[run], rows = rowsOf(v), where = landingOf(p, run, rows), pose = poseOf(p, run)
  const answerAs = strOf(v, 'answerAs'), replace = answerAs === 'replace', ctx = contextOf(v), packet = packetOf(v), turn = turnBytes(v)
  const effort = effortAt(v)
  const asked = !!rows?.some(r => r.kind === 'you'), answered = !!rows?.some(r => r.kind === 'agent')
  const canEffort = lit && !st(p, 'effort').disabled, canAnswerAs = lit && !st(p, 'answerAs').disabled
  // geometry: whole, everything stands right of the face (ox); the chat column and the page column, side by side
  const ox = whole ? WHOLE_OX : 0
  const g = whole ? {cx: ox + 7, cw: 72, px: ox + 92, pw: 72, dv: ox + 86, ly: 78, r0: 84} : {cx: 7, cw: 56, px: 78, pw: 55, dv: 70, ly: 73, r0: 79}
  const row = (i: number) => g.r0 + i * 8, bh = 3
  const fs = 26, nameX = whole ? ox + 7 : 7 + fs + 7
  // the ruler: the turn along the 256 KiB budget
  const rx = ox + 7, rw = w - rx - 7, ry = whole ? 56 : 53, rh = 8, per = rw / BUDGET
  let at = rx
  const segs: {x: number; w: number; packet: boolean; key: string}[] = []
  if (ctx !== undefined) { const sw = Math.max(2, ctx * per); segs.push({x: at, w: sw, packet: false, key: 'ctx'}); at += sw + 1 }
  packet?.forEach((item, i) => { const sw = Math.max(2, sizeOf(item) * per); segs.push({x: at, w: sw, packet: true, key: `item${i}`}); at += sw + 1 })
  const ruler = ctx === undefined && !packet ? 'turn · not read' : ctx === undefined ? 'turn · context not read' : !packet ? 'turn · packet not read' : 'turn'
  // the effort rungs
  const rungW = whole ? 16 : 12, rungGap = whole ? 4 : 3, baseY = whole ? 134 : 138, rungH = whole ? [6, 11, 16, 21] : [4, 8, 12, 16]
  const rung0 = ox + 7, rungX = (i: number) => rung0 + i * (rungW + rungGap)
  const tgt = replace ? 1 : 3, bar = (f: number) => g.pw * f
  const pageStatus = where === 'none' || !lit ? '' : LANDING_WORD[where]
  const well = <Display w={w} h={h} label="The answer"
    does={whole ? 'The agent\'s face, the turn against its 256 KB budget, the chat and the page, and the effort. Drag the handles to set them.'
      : 'The agent, the turn against its 256 KB budget, the chat and the page, and the effort. Drag the handles to set them.'}
    corner={turn === undefined ? NONE : whole ? `${kb(turn)} / 256 KB` : kb(turn)}>
    {!whole && <SmallFace x={7} y={5} size={fs} pose={pose} />}
    <text x={nameX} y={17} className="dp-ink" style={{fontSize: 11.5, fontWeight: 600}}>{strOf(v, 'agent') ?? NONE}</text>
    <text x={nameX} y={30} className="dp-ink-dim" style={{fill: lit && ph !== 'idle' ? 'var(--dp-value)' : undefined}}>{answerStateWord(p, run) ?? NONE}</text>

    {/* the turn: the identity and Expression context (dim), then each packet item, along the budget */}
    <text x={rx} y={ry - 3} className="dp-axis">{ruler}</text>
    {whole && <text x={rx + rw} y={ry - 3} className="dp-axis" textAnchor="end">256 KB</text>}
    <rect x={rx + 0.5} y={ry} width={rw - 1} height={rh} className="dp-faint" />
    {segs.map(s => <rect key={s.key} x={s.x} y={ry + 1.5} width={s.w} height={rh - 3} fill={s.packet ? 'var(--dp-value)' : 'var(--text-faint)'} opacity={s.packet ? 1 : 0.55} />)}

    {/* the chat and the page */}
    <text x={g.cx} y={g.ly} className="dp-axis">chat</text>
    <text x={g.px} y={g.ly} className="dp-axis">page</text>
    <text x={g.px + g.pw} y={g.ly} className="dp-axis" textAnchor="end" style={{fill: where === 'waits' ? 'var(--dp-on)' : where === 'kept' ? 'var(--green)' : undefined}}>{pageStatus}</text>
    <path d={`M${g.dv} ${g.ly - 6}V${row(3) + 6}`} className="dp-faint" />
    {!lit ? <>
      <text x={g.cx} y={row(1) + 3} className="dp-axis">{lamp === 'unknown' ? 'binding' : 'no subject'}</text>
      <text x={g.cx} y={row(2) + 3} className="dp-axis">{lamp === 'unknown' ? 'not read' : 'selected'}</text>
    </> : !rows ? <>
      <text x={g.cx} y={row(1) + 3} className="dp-axis">thread</text>
      <text x={g.cx} y={row(2) + 3} className="dp-axis">not read</text>
    </> : <>
      {(asked || ph !== 'idle') && <rect x={g.cx} y={row(0)} width={g.cw * 0.62} height={bh} fill="var(--text-dim)" opacity={0.55} />}
      {ph === 'reading' && [0, 1, 2].map(i => <circle key={i} cx={g.cx + 3 + i * 7} cy={row(1) + bh / 2} r={1.6} fill="var(--dp-value)" />)}
      {ph !== 'reading' && (answered || ph === 'answering') && [0.92, 0.8, 0.42].map((f, i) => {
        if (ph === 'answering' && i === 2) return <rect key={i} x={g.cx} y={row(1 + i)} width={g.cw * 0.22} height={bh} fill="var(--dp-value)" opacity={0.5} />
        return <rect key={i} x={g.cx} y={row(1 + i)} width={g.cw * f} height={bh} fill="var(--dp-value)" opacity={0.5} />
      })}
      {ph === 'answering' && <rect x={g.cx + g.cw * 0.22 + 2} y={row(3) - 1.5} width={2} height={bh + 3} fill="var(--dp-on)" />}
    </>}
    {[0.8, 0.9, 0.7].map((f, i) => {
      const gone = where === 'kept' && replace && i === 1
      return gone ? null : <rect key={i} x={g.px} y={row(i)} width={bar(f)} height={bh} fill="var(--text-dim)" opacity={where === 'waits' && replace && i === 1 ? 0.3 : 0.55} />
    })}
    {lit && numOf(v, 'entry') !== undefined && <rect x={g.px - 2.5} y={row(1) - 2.5} width={bar(0.9) + 5} height={bh + 5} fill="none" stroke="var(--sel)" strokeWidth={1} opacity={0.85} />}
    {where === 'waits' && answerAs !== undefined && <rect x={g.px} y={row(tgt) - 1} width={bar(0.85)} height={bh + 2} fill="none" stroke="var(--dp-value)" strokeWidth={1} strokeDasharray="2 2" />}
    {where === 'kept' && answerAs !== undefined && <>
      <rect x={g.px} y={row(tgt)} width={bar(0.85)} height={bh} fill="var(--dp-value)" />
      <rect x={g.px + bar(0.85) + 3} y={row(tgt) - 0.5} width={4} height={4} fill="var(--green)" />
    </>}
    {whole && lit && answerAs !== undefined && <Handle n={3} shape="square" x={g.px + bar(0.85) + 13} y={row(tgt) + bh / 2} label="Answer as" does="Drag up or down: the answer takes the selected entry or joins as a new one."
      onDrag={canAnswerAs ? (_, y) => set('answerAs', y < (row(1) + row(3)) / 2 ? 'replace' : 'new') : undefined} onReset={canAnswerAs ? () => set('answerAs', 'new') : undefined} />}

    {/* effort: four rungs, lit up to the chosen one */}
    <text x={rung0} y={whole ? 121 : 119} className="dp-axis">{effort === undefined ? `effort ${NONE}` : 'effort'}</text>
    {rungH.map((rh2, i) => { const on = lit && effort !== undefined && i <= effort
      return <g key={i}>
        <rect x={rungX(i) + 0.5} y={baseY - rh2} width={rungW - 1} height={rh2} className={on ? undefined : 'dp-faint'} fill={on ? 'var(--dp-value)' : 'none'} opacity={on ? 0.45 + i * 0.18 : 1} />
        {whole && <text x={rungX(i) + rungW / 2} y={baseY + 9} className="dp-axis" textAnchor="middle" style={{fontSize: 7.5}}>{['low', 'med', 'high', 'max'][i]}</text>}
      </g> })}
    {lit && effort !== undefined && <Handle n={1} shape="ring" x={rungX(effort) + rungW / 2} y={baseY - rungH[effort]! - 7} label="Effort" does="Drag across the rungs: how hard the agent thinks on each answer."
      onDrag={canEffort ? x => set('effort', EFFORTS[Math.round(clampTo(0, 3, (x - rung0 - rungW / 2) / (rungW + rungGap)))]!) : undefined} onReset={canEffort ? () => set('effort', 'medium') : undefined} />}
  </Display>
  if (!whole) return well
  // The face over the well: the well's border (1 px) and then its own pixels, 1:1. In its own window the pane above draws the live face,
  // so the well keeps the still one there (a second live face on a screen that already has one).
  return <div className="an-well">
    {well}
    <LiveFace p={p} run={run} still={p.frame === 'window'} className="an-well-face" style={{left: FACE_BOX.x + 1, top: FACE_BOX.y + 1, width: FACE_BOX.w, height: FACE_BOX.h}} />
    {/* Hears and Speaks at the face's lower corners, Chat at its upper right (§19.4): the whole face carries its marks, as the pane's does. */}
    <div className="an-face-marks" style={{left: FACE_BOX.x + 1, top: FACE_BOX.y + 1, width: FACE_BOX.w, height: FACE_BOX.h}}><FaceMarks p={p} size={11} /></div>
  </div>
}

// ---------------------------------------------------------------- the controls

const answerRadio = (p: ViewProps) => <Radio {...st(p, 'answerAs')} label="Answer as" does={SAYS.answerAs} value={strOf(p.v, 'answerAs') ?? ''} stack options={ANSWER_AS} onChange={x => p.set('answerAs', x)} />
const effortDial = (p: ViewProps) => {
  const s = st(p, 'effort'), lamp = lampOf(p)
  return <Dial {...s} disabled={s.disabled ?? (lamp === 'lit' ? undefined : lamp === 'dark' ? 'The conversation is not bound. Effort needs a session.' : 'The binding is not read.')}
    label="Effort" does={SAYS.effort} value={effortAt(p.v) ?? NaN} def={1} scale={{min: 0, max: 3, step: 1}} format={i => EFFORTS[Math.round(i)] ?? NONE}
    onChange={i => p.set('effort', EFFORTS[Math.round(i)]!)} />
}
const voiceToggle = (p: ViewProps, key: 'speech.hears' | 'speech.speaks', label: string, does: string) => {
  const now = onOf(p.v, key), s = st(p, key)
  return <Toggle {...s} label={label} does={does} on={now === true} unknown={now === undefined} disabled={s.disabled ?? (lampOf(p) === 'lit' ? undefined : 'The conversation is not bound.')}
    onChange={x => p.set(key, x ? 'on' : 'off')} />
}
const chatToggle = (p: ViewProps) => <Toggle {...st(p, 'face.chat')} label="Chat" does="The conversation beside the face in the pane. Off, the face has the whole pane." on={strOf(p.v, 'face.chat') !== 'off'} onChange={x => p.set('face.chat', x ? 'on' : 'off')} />
const HEARS = 'Open the microphone: what you say is written and sent when you stop.'
const SPEAKS = 'Speak the answer aloud, with the face moving its mouth with the sound.'

/** The Answer page: the agent and its role, Effort, Answer as; Hears, Speaks and Chat; the turn against its budget, the packet, the
 * sources, where the answer stands in the page, and the binding. */
export function AnswerBands({p, run}: {p: ViewProps; run: RunState}) {
  const where = landingOf(p, run, rowsOf(p.v)), ph = PHASE_OF[run], turn = turnBytes(p.v), size = packetBytes(p.v), l = lightOf(p)
  return <>
    <Band>
      <Section width={WHOLE_WELL.w + 12}>
        <AnswerWell p={p} run={run} w={WHOLE_WELL.w} h={WHOLE_WELL.h} size="whole" />
      </Section>
      <Section label="Agent" cols={2} grow>
        <Readout label="agent" does="Who answers. Drag another agent from the browser here to replace it." value={strOf(p.v, 'agent')} />
        {effortDial(p)}
        <Readout label="role" does="The role the owner binds for this agent." value={strOf(p.v, 'role')} />
        <Readout label="standing" does="Whether the conversation is bound to a person and an Expression." value={standingWord(p)} tone={l === 'lit' ? 'green' : undefined} />
      </Section>
    </Band>
    <Band>
      <Section label="Answer" cols={2} width={140}>
        {answerRadio(p)}
        <Readout label="sources" does="The places the answer cites. Follow one in the pane." value={sourcesOf(p.v)?.length} tone="value" />
        <Readout label="page" does="Where the answer stands: waits for you, kept with a receipt, or declined." value={where === 'none' ? undefined : LANDING_WORD[where]}
          tone={where === 'waits' ? 'accent' : where === 'kept' ? 'green' : undefined} />
      </Section>
      <Section label="Exchange" cols={3} width={140}>
        <Readout label="state" does="What the agent does now: at rest, hearing you, reading the packet, answering or speaking." value={answerStateWord(p, run)} tone={ph === 'idle' ? undefined : 'value'} />
        <Readout label="packet" does="The size of the packet the agent receives." value={size === undefined ? undefined : kb(size)} tone="value" />
        <Readout label="turn" does="The whole turn against the native budget of 256 KB: the packet and the identity context." value={turn === undefined ? undefined : kb(turn)} />
      </Section>
      <Section label="Voice" grow>
        {voiceToggle(p, 'speech.hears', 'Hears', HEARS)}
        {voiceToggle(p, 'speech.speaks', 'Speaks', SPEAKS)}
        {chatToggle(p)}
      </Section>
    </Band>
  </>
}

const signed2 = (x: number) => `${x > 0 ? '+' : ''}${x.toFixed(2)}`
const UNIT = {min: -1, max: 1} as const
const EMOTION_OPTIONS: readonly Option<string>[] = FACE_EMOTIONS.map(e => ({value: e, label: e[0]!.toUpperCase() + e.slice(1)}))
const GESTURE_OPTIONS: readonly Option<string>[] = FACE_GESTURES.map(g => ({value: g, label: g[0]!.toUpperCase() + g.slice(1)}))
const FACE_PREVIEW = {w: 100, h: 146} as const, FACE_PAD = 118
/** The Face page: the feeling and where it looks on a pad each, the emotion and the gesture on a menu each, and the face itself to watch
 * them on. They stand on the face while the agent is at rest; its own states move the face over them. */
export function FaceBands({p, run}: {p: ViewProps; run: RunState}) {
  const v = p.v, lit = lampOf(p) === 'lit', put = (key: string) => (x: number) => p.set(key, Math.round(x * 100) / 100)
  const num = (key: string) => numOf(v, key) ?? 0
  return <>
    <Band>
      <Section width={FACE_PREVIEW.w + 12}>
        <div className="an-preview" style={{width: FACE_PREVIEW.w, height: FACE_PREVIEW.h}} data-i="The face|The agent's face, as the dynamics set here and its own state move it.">
          <LiveFace p={p} run={run} still={p.frame === 'window'} className="an-preview-face" />
          <div className="an-face-marks"><FaceMarks p={p} size={11} /></div>
        </div>
      </Section>
      <Section label="Feeling" width={FACE_PAD + 12}>
        <Pad w={FACE_PAD} h={146} label="Feeling" does="Drag across for the mood, from unpleasant to pleasant, and up for the energy, from calm to stirred up."
          x={{...st(p, 'face.feeling.v'), label: 'Mood', value: num('face.feeling.v'), def: 0, scale: UNIT, format: signed2, onChange: put('face.feeling.v')}}
          y={{...st(p, 'face.feeling.a'), label: 'Energy', value: num('face.feeling.a'), def: 0, scale: UNIT, format: signed2, onChange: put('face.feeling.a')}} />
      </Section>
      <Section label="Eyes" width={FACE_PAD + 12}>
        <Pad w={FACE_PAD} h={146} label="Eyes" does="Drag to where the face looks: across, and up."
          x={{...st(p, 'face.gaze.x'), label: 'Across', value: num('face.gaze.x'), def: 0, scale: UNIT, format: signed2, onChange: put('face.gaze.x')}}
          y={{...st(p, 'face.gaze.y'), label: 'Up', value: num('face.gaze.y'), def: 0, scale: UNIT, format: signed2, onChange: put('face.gaze.y')}} />
      </Section>
    </Band>
    <Band>
      <Section label="Manner" grow>
        <Chooser {...st(p, 'face.emotion')} label="Emotion" does="The feeling the face holds while the agent is at rest." value={strOf(v, 'face.emotion') ?? 'neutral'} options={EMOTION_OPTIONS} onChange={x => p.set('face.emotion', x)} />
        <Chooser {...st(p, 'face.gesture')} label="Gesture" does="A movement the face makes once when you press Do." value={strOf(v, 'face.gesture') ?? 'nod'} options={GESTURE_OPTIONS} onChange={x => p.set('face.gesture', x)} />
        <Action label="Do" does="The face makes the gesture once." disabled={lit ? undefined : 'The face sleeps while no conversation is bound.'} onPress={() => p.set('face.do', (numOf(v, 'face.do') ?? 0) + 1)} />
      </Section>
    </Band>
  </>
}

// ---------------------------------------------------------------- the exchange, in the pane

/** The packet's items as chips, with the size of each in the turn. */
function Packet({v}: {v: V}) {
  const items = packetOf(v)
  if (!items || !items.length) return <ul className="an-packet" aria-label="Packet"><li>{items ? 'Nothing in the packet' : 'No reading of the packet'}</li></ul>
  return <ul className="an-packet" aria-label="Packet">
    {items.map((item, i) => <li key={i} data-i={`${itemName(item)}|${itemKind(item)}${item.text ? `: ${short(item.text, 60)}` : ''}. ${kb(sizeOf(item))} of the turn.`}>
      <b>{itemKind(item)}</b>{itemName(item)}<small>{kb(sizeOf(item))}</small></li>)}
  </ul>
}

const note = (key: string | number, words: string) => <div key={key} className="an-row an-row--note"><span className="an-av an-av--tool" aria-hidden="true" /><p className="an-note">{words}</p></div>

/** The three marks at the stage's corners, each the cut's (icon-cut.html, the icon law): Hears the transport's Record (what you say goes
 * in), Speaks Tap's contact and ring (a sound sent out), Chat the conversation's exchange, as Messages wears it. */
const MARK: Readonly<Record<'hears' | 'speaks' | 'chat', IconName>> = {hears: 'rec', speaks: 'tap', chat: 'contact'}
/** Where each mark stands on the face (§19.4 "the two marks at the face's lower corners; a third mark opens the conversation"). */
const CORNER: Readonly<Record<keyof typeof MARK, string>> = {hears: 'lower-left', speaks: 'lower-right', chat: 'upper-right'}
function StageMark({kind, on, label, does, standing, onPress, size = 16}: {kind: keyof typeof MARK; on: boolean | undefined; label: string; does: string; standing: {disabled?: string}; onPress?: () => void; size?: number}) {
  return <button type="button" className="an-mark" data-kind={kind} data-corner={CORNER[kind]} aria-pressed={on === undefined ? undefined : on} aria-label={label} disabled={!onPress || !!standing.disabled}
    data-i={`${label}|${[does, standing.disabled].filter(Boolean).join(' ')}`} onClick={onPress}>
    <Icon name={MARK[kind]} size={size} />
  </button>
}

/** The face's three marks, at its corners wherever the face stands whole — the pane, and the whole face of the expanded Agent and its
 * Face page (§19.4 The answer's face): Hears at the lower left, Speaks at the lower right, Chat at the upper right. The same keys as the
 * rack's toggles, so the two never disagree. `size` the marks' size: smaller on the expanded plate's face than in the pane. */
export function FaceMarks({p, size = 16}: {p: ViewProps; size?: number}) {
  const {v, set} = p
  const lit = lampOf(p) === 'lit', chat = strOf(v, 'face.chat') !== 'off'
  const hears = onOf(v, 'speech.hears'), speaks = onOf(v, 'speech.speaks'), hs = st(p, 'speech.hears'), ss = st(p, 'speech.speaks'), cs = st(p, 'face.chat')
  const unbound = lit ? undefined : 'The conversation is not bound.'
  return <>
    <StageMark kind="hears" size={size} on={hears} label="Hears" does={hears ? 'The microphone is open: what you say is written and sent when you stop. Press to close it.' : HEARS}
      standing={{disabled: hs.disabled ?? unbound}} onPress={hs.disabled || !lit ? undefined : () => set('speech.hears', hears ? 'off' : 'on')} />
    <StageMark kind="speaks" size={size} on={speaks} label="Speaks" does={speaks ? 'The answer is spoken, and the face moves its mouth with the sound. Press to stop speaking.' : SPEAKS}
      standing={{disabled: ss.disabled ?? unbound}} onPress={ss.disabled || !lit ? undefined : () => set('speech.speaks', speaks ? 'off' : 'on')} />
    <StageMark kind="chat" size={size} on={chat} label="Chat" does={chat ? 'Close the conversation: the face has the whole pane.' : 'Open the conversation beside the face.'}
      standing={cs} onPress={() => set('face.chat', chat ? 'off' : 'on')} />
  </>
}

/** The conversation, small, at the right of the face: the exchange, a proposal's two answers, the line to type in. No header: what the
 * pane would say about itself is in the rack. */
function Conversation({p, run}: {p: ViewProps; run: RunState}) {
  const {v, set} = p
  const lamp = lampOf(p), lit = lamp === 'lit', ph = PHASE_OF[run], answering = ph === 'answering'
  const all = rowsOf(v), rows = all ?? [], packet = packetOf(v), name = strOf(v, 'agent'), who = name ?? NONE
  const sources = sourcesOf(v), open = Number(strOf(v, 'face.source')) || 0, source = sources?.find(s => s.n === open)
  const lastAgent = rows.map(r => r.kind).lastIndexOf('agent'), firstYou = rows.findIndex(r => r.kind === 'you')
  const send = st(p, 'sent'), pick = st(p, 'face.source'), accept = st(p, 'thread.approve'), decline = st(p, 'thread.decline'), draft = strOf(v, 'draft') ?? ''
  const said = (does: string, why: string | undefined) => [does, why].filter(Boolean).join(' ')
  const cite = (n: number) => {
    const src = sources?.find(s => s.n === n)
    return <button type="button" className="an-cite" aria-pressed={open === n} disabled={!!pick.disabled}
      data-i={`Source ${n}|${said(src ? `Land on the line this claim comes from: ${src.name}, ${src.at}.` : 'No reading of this source.', pick.disabled)}`}
      onClick={() => set('face.source', open === n ? '' : String(n))}>{n}</button>
  }
  const line = (r: Row, i: number) => {
    if (r.kind === 'you') return <div key={i} className="an-row"><span className="an-av">Y</span>
      <div className="an-body"><span className="an-who">{r.who}</span><p className="an-text">{r.text || NONE}</p>{i === firstYou && <Packet v={v} />}</div></div>
    if (r.kind === 'agent') {
      const live = answering && i === rows.length - 1, done = i === lastAgent && !live
      return <div key={i} className="an-row"><span className="an-av" data-agent="true"><Avatar expr={live ? 'speak' : 'neutral'} /></span>
        <div className="an-body"><span className="an-who" data-agent="true">{r.who}</span>
          <p className="an-text">{r.parts ? r.parts.map((part, j) => <span key={j}>{part.t}{part.s !== undefined && sources && !live && cite(part.s)} </span>) : r.text || NONE}
            {live && <span className="an-caret" />}</p>
          {done && sources && sources.length > 0 && <ul className="an-sources" aria-label="Sources">
            {sources.map(s => <li key={s.n}><button type="button" aria-pressed={open === s.n} disabled={!!pick.disabled} onClick={() => set('face.source', open === s.n ? '' : String(s.n))}
              data-i={`Source ${s.n}|${said(`Follow it to the line it came from: ${s.name}, ${s.at}.`, pick.disabled)}`}><b>{s.n}</b>{s.name}<small>{s.at}</small></button></li>)}
          </ul>}
          {done && source && <div className="an-line-card" aria-label={`Source ${source.n}`}>
            <div><b>{source.name}</b><small>{source.tag}</small></div>
            {source.lines.map((l, j) => <p key={j} data-hit={l.hit || undefined}><i>{l.n}</i><span>{l.t || ' '}</span></p>)}
          </div>}
        </div></div>
    }
    if (r.kind === 'proposal') {
      if (r.state === 'declined' || r.state === 'decline') return note(i, 'Declined. The page is unchanged.')
      if (r.state === 'approve') return <div key={i} className="an-row"><span className="an-av an-av--tool" aria-hidden="true" /><div className="an-card" data-done="true">
        <b>Accepted · {r.text || NONE}</b><small>{[r.tool ?? strOf(v, 'document'), 'the write carries a receipt'].filter(Boolean).join(' · ')}</small></div></div>
      return <div key={i} className="an-row"><span className="an-av an-av--tool" aria-hidden="true" /><div className="an-card">
        <b>Proposal · {r.text || NONE}</b><small>{[r.tool ?? strOf(v, 'document'), 'waits for you'].filter(Boolean).join(' · ')}</small>
        <span className="an-card-do">
          <button type="button" disabled={!!accept.disabled} onClick={() => set('thread.approve', true)} data-i={`Accept|${said('Put the answer into the page. The write carries a receipt.', accept.disabled)}`}>Accept</button>
          <button type="button" disabled={!!decline.disabled} onClick={() => set('thread.decline', true)} data-i={`Decline|${said('Leave the page as it is. The answer stays in the conversation.', decline.disabled)}`}>Decline</button></span></div></div>
    }
    if (r.kind === 'receipt') return <div key={i} className="an-row"><span className="an-av an-av--tool" aria-hidden="true" /><div className="an-card" data-done="true">
      <b>Written · {r.text || NONE}</b><small>{[r.tool, 'receipt kept with the entry'].filter(Boolean).join(' · ')}</small></div></div>
    return note(i, r.text || NONE)
  }
  const working = (expr: string, words: string) => <div className="an-row"><span className="an-av" data-agent="true"><Avatar expr={expr} /></span>
    <div className="an-body"><span className="an-who" data-agent="true">{who}</span><p className="an-work"><i />{words}</p></div></div>
  const reads = `${who} reads the packet${packet ? ` · ${packet.length} item${packet.length === 1 ? '' : 's'} · ${kb(packetBytes(v) ?? 0)}` : ''}`
  return <aside className="an-chat" aria-label="Conversation">
    <div className="an-stream" role="log" aria-label="Exchange">
      {lit && <>
        {firstYou < 0 && <div className="an-row"><span className="an-av an-av--tool" aria-hidden="true" /><div className="an-body"><span className="an-who">packet</span><Packet v={v} /></div></div>}
        {all === undefined && note('thread', 'No reading of the thread.')}
        {all !== undefined && rows.length === 0 && note('empty', 'Nothing asked yet.')}
        {rows.map((r, i) => line(r, i))}
        {ph === 'reading' && working('focus', reads)}
        {answering && rows[rows.length - 1]?.kind !== 'agent' && working('speak', `${who} is answering`)}
      </>}
      {!lit && note('unlit', lamp === 'unknown' ? 'The binding has not been read. The owner has not said.' : 'No subject is selected. The conversation binds once you select one.')}
    </div>
    <div className="an-composer">
      <input aria-label="Message" disabled={!lit || !!send.disabled} placeholder={!lit ? 'Bind a conversation to ask' : name ? `Ask ${name}` : 'Ask the agent'} value={draft}
        data-i={`Composer|${[said('Type a question and press Enter. The agent reads the packet and answers here.', send.disabled), send.refused ? `The owner refused: ${send.refused}` : undefined].filter(Boolean).join(' ')}`}
        onChange={e => set('draft', e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && draft.trim() && lit) { e.preventDefault(); set('sent', draft.trim()); set('draft', '') } }} />
    </div>
  </aside>
}

/** Full: mostly the face. Its three marks stand at its corners; your words, as they are heard, and the agent's, as they are said, stand
 * under it while the conversation is closed (open, the conversation holds them). The conversation is small, at the right. No header. */
export function AnswerPane({p, run}: {p: ViewProps; run: RunState}) {
  const {v} = p
  const ph = PHASE_OF[run], vo = voiceOf(v), chat = strOf(v, 'face.chat') !== 'off'
  const heard = strOf(v, 'speech.heard')?.trim(), rows = rowsOf(v) ?? [], lastAgent = [...rows].reverse().find(r => r.kind === 'agent')
  const saying = !chat && lastAgent && (ph === 'answering' || vo === 'speaking') ? lastAgent.text : undefined
  return <div className="an-pane" data-chat={chat ? 'on' : 'off'}>
    <div className="an-stage">
      <LiveFace p={p} run={run} className="an-stage-face" />
      {(heard || saying) && <p className="an-subtitle" aria-live="polite">{heard && <span data-who="you">{heard}</span>}{saying && <span data-who="agent">{saying}</span>}</p>}
      <FaceMarks p={p} />
    </div>
    {chat && <Conversation p={p} run={run} />}
  </div>
}
