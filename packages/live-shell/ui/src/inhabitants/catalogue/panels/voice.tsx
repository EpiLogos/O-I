// Retired as a device of its own (22 Oct manual rewrite): not a `<family>__<face>.tsx` panel any more, so the catalogue does not load
// it; the Agent (actuation:harness-model) carries its pages through this module.
// Voice (manual §19.21, actuation:voice): how an agent speaks, after the Agent on its chain. Listening is the track's own input row
// (Input, Listen, Pause, Recogniser: manual §24.1), as Live keeps input on the track and sound on the devices. Live's nearest: a vocal
// chain's last device, with its pitch-and-timing display. The display is the last spoken turn on one audio clock: each sentence with the
// affect K-E-V chose for it, its words across the sentence's measured speech, and, under them, the phone intervals that drive the
// mouth. A body that measures no timing (Kokoro) draws its words alone, and its mouth can only follow the loudness.
//
// Owners, and the keys on their paths:
//   voice.body       'local' (the kernel op nara_voice: whisper.cpp in, Kokoro-82M out, loopback only) | 'face' (Piper with sample-exact
//                    phone alignment, the face rig's chat server) | 'realtime-aligned' | 'realtime-native' (a cloud Realtime client:
//                    AIKit holds the contract and a fixture translator) | 'off'
//   bodies           what each body can do now: [{id, available, why}] — a body that is not available stands closed with its reason
//   voice.voice      the body's voice id; voice.voices the ids the body offers ([string])
//   voice.speed      0.5..2 (1)
//   voice.mouth      'aligned' | 'loudness' | 'off': what moves the face's mouth; Aligned needs measured phone timing
//   voice.affect     K-E-V chooses the face's affect for each sentence before it is spoken
//   voice.interrupt  'off' | 'stop' (stop when you talk) | 'barge-in'
//   voice.egress     'local' | 'ask' | 'allowed': whether spoken Nara material may leave the machine
//   voice.console    the Epii console beside the face
//   body.duplex, body.bargeIn, body.interrupt  the body's support for each: 'supported' | 'degraded' | 'unsupported' | 'unknown'
//   body.latencyMs   from the end of a sentence's text to its first sound
//   body.receipt     the last turn's receipt
//   turn             the last spoken turn: {sentences: [{text, start, end, affect: {emotion, intensity}, words: [{w, start, end}],
//                    phones: [{p, start, end}]}]}, times in ms from the turn's start
// The face itself stays on the Agent device: Voice drives its mouth through the face's speech parameters.
import {Band, Chooser, Dial, Display, Folded, Panel, Radio, Readout, Section, Tile, Toggle, type LightState, type Option} from '../../sdk/panel'
import {NONE, boolOf, clampTo, json, numOf, st, strOf, type DesignedDevice, type ViewProps} from './design'

type V = ViewProps['v']
type Body = 'local' | 'face' | 'realtime-aligned' | 'realtime-native' | 'off'
const BODY_LABEL: Record<Body, string> = {local: 'Local', face: 'Face', 'realtime-aligned': 'Realtime, aligned', 'realtime-native': 'Realtime, own voice', off: 'Off'}
const BODY_DOES: Record<Body, string> = {
  local: 'Kokoro on this machine. It measures no timing, so the mouth follows the loudness.',
  face: "Piper on this machine, every phone measured to the sample: the mouth moves with each sound.",
  'realtime-aligned': 'A cloud voice, its words aligned on this machine so the mouth still moves with each sound.',
  'realtime-native': "A cloud voice in the service's own voice; the mouth follows the loudness.",
  off: 'The agent does not speak.'}
const TIMED: readonly Body[] = ['face', 'realtime-aligned']
const MOUTHS = ['aligned', 'loudness', 'off'] as const
const INTERRUPTS = [{value: 'off', label: 'Off', does: 'The agent finishes what it is saying.'}, {value: 'stop', label: 'Stop', does: 'The agent stops when you start to talk.'},
  {value: 'barge-in', label: 'Barge-in', does: 'The agent stops and hears what you say over it.'}] as const
const EGRESS = [{value: 'local', label: 'Local only', does: 'Spoken Nara material never leaves this machine.'}, {value: 'ask', label: 'Ask', does: 'Each time a cloud body would hear it, you are asked.'},
  {value: 'allowed', label: 'Allowed', does: 'A cloud body may hear it.'}] as const
const SUPPORT: Record<string, string> = {supported: 'yes', degraded: 'degraded', unsupported: 'no', unknown: NONE}

interface Sentence {readonly text: string; readonly start: number; readonly end: number; readonly emotion?: string; readonly intensity?: number
  readonly words: readonly {w: string; start: number; end: number}[]; readonly phones: readonly {p: string; start: number; end: number}[]}
const rec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null
const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
function turnOf(v: V): Sentence[] | undefined {
  const raw = json<unknown>(v, 'turn', undefined)
  if (!rec(raw) || !Array.isArray(raw.sentences)) return undefined
  return raw.sentences.flatMap((e): Sentence[] => {
    if (!rec(e) || typeof e.text !== 'string' || !num(e.start) || !num(e.end)) return []
    const a = rec(e.affect) ? e.affect : {}
    const words = Array.isArray(e.words) ? e.words.flatMap(x => (rec(x) && typeof x.w === 'string' && num(x.start) && num(x.end) ? [{w: x.w, start: x.start, end: x.end}] : [])) : []
    const phones = Array.isArray(e.phones) ? e.phones.flatMap(x => (rec(x) && typeof x.p === 'string' && num(x.start) && num(x.end) ? [{p: x.p, start: x.start, end: x.end}] : [])) : []
    return [{text: e.text, start: e.start, end: e.end, emotion: typeof a.emotion === 'string' ? a.emotion : undefined, intensity: num(a.intensity) ? a.intensity : undefined, words, phones}]
  })
}
interface BodyState {readonly id: Body; readonly available: boolean; readonly why?: string}
const bodiesOf = (v: V): BodyState[] | undefined => {
  const raw = json<unknown>(v, 'bodies', undefined)
  return Array.isArray(raw) ? raw.flatMap((e): BodyState[] => (rec(e) && typeof e.id === 'string' && e.id in BODY_LABEL ? [{id: e.id as Body, available: e.available === true, why: typeof e.why === 'string' ? e.why : undefined}] : [])) : undefined
}
const bodyOf = (v: V): Body | undefined => { const b = strOf(v, 'voice.body'); return b !== undefined && b in BODY_LABEL ? b as Body : undefined }
const f1 = (x: number) => x.toFixed(1)

/** The turn on one clock: a band per sentence with its affect, its words, and the phones under them. */
function TurnDisplay({v, w, h, phones = true}: {v: V; w: number; h: number; phones?: boolean}) {
  const turn = turnOf(v), body = bodyOf(v)
  if (!turn || !turn.length) return <text x={w / 2} y={h / 2} textAnchor="middle" className="dp-ink-dim">{w > 100 ? (strOf(v, 'reason') ?? 'Nothing spoken yet') : NONE}</text>
  const t0 = turn[0]!.start, t1 = turn[turn.length - 1]!.end, X = (t: number) => 6 + (t - t0) / Math.max(1, t1 - t0) * (w - 12)
  const timed = body !== undefined && TIMED.includes(body), rowA = 14, rowW = h * .46, rowP = h * .72, size = w > 300 ? 10 : 8
  // A word that would run into the one before it is left out: at this width the sentence cannot show every word.
  let edge = -Infinity
  const placed = turn.map(s => s.words.filter(x => { const at = X(x.start); if (at < edge + 2) return false; edge = at + x.w.length * size * .58; return true }))
  return <g>
    {turn.map((s, i) => <g key={i}>
      <rect x={f1(X(s.start))} y={4} width={f1(Math.max(1, X(s.end) - X(s.start) - 2))} height={rowA - 2} className="dp-fill" opacity={.25 + .6 * clampTo(0, 1, s.intensity ?? .5)} />
      {w > 160 && <text x={X(s.start) + 3} y={rowA - 2} className="dp-axis" style={{fontSize: 7.5}}>{s.emotion ? `${s.emotion}${s.intensity !== undefined ? ` ${Math.round(s.intensity * 100)}%` : ''}` : 'no affect'}</text>}
      {placed[i]!.map((x, k) => <text key={k} x={X(x.start)} y={rowW} className="dp-ink" style={{fontSize: size}}>{x.w}</text>)}
      {phones && timed && s.phones.map((x, k) => <g key={k}>
        <rect x={f1(X(x.start))} y={rowP - 8} width={f1(Math.max(.8, X(x.end) - X(x.start) - .6))} height={8} fill="var(--dp-value)" opacity={k % 2 ? .55 : .85} />
        {w > 300 && X(x.end) - X(x.start) > 8 && <text x={X(x.start) + 1} y={rowP + 8} className="dp-axis" style={{fontSize: 7}}>{x.p}</text>}
      </g>)}
    </g>)}
    {phones && !timed && <text x={6} y={rowP} className="dp-ink-dim" style={{fontSize: 8}}>{w > 220 ? 'no phone timing: the mouth follows the loudness' : 'no phone timing'}</text>}
    <text x={w - 4} y={h - 3} textAnchor="end" className="dp-axis">{`${((t1 - t0) / 1000).toFixed(1)} s`}</text>
  </g>
}

const lightOf = (p: ViewProps): LightState => { const b = bodyOf(p.owner ?? p.v); return b === undefined ? 'unknown' : b === 'off' ? 'dark' : 'lit' }
const DISPLAY_DOES = 'The last spoken turn: each sentence with the affect chosen for it, its words, and the phones that moved the mouth.'
const wide = (p: ViewProps) => (p.frame === 'flip' || p.frame === 'window') && p.room !== undefined

function controls(p: ViewProps) {
  const v = p.v, body = bodyOf(v), bodies = bodiesOf(v), egress = strOf(v, 'voice.egress')
  const closed = (id: Body): string | undefined => {
    const b = bodies?.find(x => x.id === id)
    if (id.startsWith('realtime') && egress === 'local') return 'Spoken Nara material stays local: Egress is Local only.'
    return b && !b.available ? b.why ?? 'This body is not available now.' : undefined
  }
  const bodyOptions: Option<Body>[] = (Object.keys(BODY_LABEL) as Body[]).map(id => ({value: id, label: BODY_LABEL[id], does: BODY_DOES[id], why: id === 'off' ? undefined : closed(id)}))
  const voices = json<unknown[]>(v, 'voice.voices', []).filter((x): x is string => typeof x === 'string')
  const support = (k: string) => strOf(v, k)
  const interruptOptions = INTERRUPTS.map(o => ({...o, why: o.value === 'barge-in' && support('body.bargeIn') === 'unsupported' ? 'This body cannot be talked over.'
    : o.value === 'stop' && support('body.interrupt') === 'unsupported' ? 'This body cannot stop mid-sentence.' : undefined}))
  const mouthOptions = MOUTHS.map(m => ({value: m, label: m === 'aligned' ? 'Aligned' : m === 'loudness' ? 'Loudness' : 'Off',
    does: m === 'aligned' ? 'The mouth moves with each measured sound.' : m === 'loudness' ? 'The mouth opens with the loudness.' : 'The mouth stays still.',
    why: m === 'aligned' && body !== undefined && !TIMED.includes(body) ? 'This body measures no timing.' : undefined}))
  return {
    body: (stack: boolean) => <Radio {...st(p, 'voice.body')} label={stack ? undefined : 'Body'} does="What speaks." value={body ?? ''} options={bodyOptions} stack={stack} onChange={x => p.set('voice.body', x)} />,
    bodyChooser: <Chooser {...st(p, 'voice.body')} label="Body" does="What speaks." value={body ?? ''} options={bodyOptions} onChange={x => p.set('voice.body', x)} />,
    voice: <Chooser {...st(p, 'voice.voice')} label="Voice" does="The body's voice." value={strOf(v, 'voice.voice') ?? ''} options={voices.map(x => ({value: x, label: x}))} onChange={x => p.set('voice.voice', x)}
      disabled={st(p, 'voice.voice').disabled ?? (voices.length ? undefined : 'The body reports no voices.')} />,
    speed: <Dial {...st(p, 'voice.speed')} label="Speed" does="How fast the agent speaks." value={numOf(v, 'voice.speed') ?? NaN} def={1} scale={{min: .5, max: 2}} format={x => `${x.toFixed(2)}×`} onChange={x => p.set('voice.speed', Math.round(x * 100) / 100)} />,
    mouth: (stack: boolean) => <Radio {...st(p, 'voice.mouth')} label="Mouth" does="What moves the face's mouth." value={strOf(v, 'voice.mouth') ?? ''} options={mouthOptions} stack={stack} onChange={x => p.set('voice.mouth', x)} />,
    mouthChooser: <Chooser {...st(p, 'voice.mouth')} label="Mouth" does="What moves the face's mouth." value={strOf(v, 'voice.mouth') ?? ''} options={mouthOptions} onChange={x => p.set('voice.mouth', x)} />,
    affect: <Toggle {...st(p, 'voice.affect')} label="Affect" does="K-E-V chooses the face's feeling for each sentence before it is spoken." on={boolOf(v, 'voice.affect') === true} unknown={boolOf(v, 'voice.affect') === undefined} onChange={x => p.set('voice.affect', x)} />,
    interrupt: (stack: boolean) => <Radio {...st(p, 'voice.interrupt')} label="Interrupt" does="What happens when you talk while the agent speaks." value={strOf(v, 'voice.interrupt') ?? ''} options={interruptOptions} stack={stack} onChange={x => p.set('voice.interrupt', x)} />,
    egress: <Radio {...st(p, 'voice.egress')} label="Egress" does="Whether spoken Nara material may leave this machine." value={egress ?? ''} options={EGRESS} stack onChange={x => p.set('voice.egress', x)} />,
    console: <Toggle {...st(p, 'voice.console')} label="Console" does="Show Epii's console beside the face." on={boolOf(v, 'voice.console') === true} unknown={boolOf(v, 'voice.console') === undefined} onChange={x => p.set('voice.console', x)} />,
  }
}

/** A sentence of the turn for the widget: the last one, with its affect. */
const lastSentence = (v: V) => { const t = turnOf(v); return t && t.length ? t[t.length - 1] : undefined }

export const design: DesignedDevice = {
  id: 'actuation:voice',
  title: 'Voice',
  kind: 'effect',
  defaults: {
    'voice.body': 'face', 'voice.voice': 'en_US-norman-medium', 'voice.voices': JSON.stringify(['en_US-norman-medium', 'en_US-amy-medium', 'en_GB-alba-medium']),
    'voice.speed': 1, 'voice.mouth': 'aligned', 'voice.affect': true, 'voice.interrupt': 'stop', 'voice.egress': 'local', 'voice.console': false,
    bodies: JSON.stringify([
      {id: 'local', available: false, why: 'The local speech services are stopped.'},
      {id: 'face', available: true},
      {id: 'realtime-aligned', available: false, why: 'No live client: AIKit holds the contract and a fixture translator.'},
      {id: 'realtime-native', available: false, why: 'No live client: AIKit holds the contract and a fixture translator.'}]),
    'body.duplex': 'unsupported', 'body.bargeIn': 'unsupported', 'body.interrupt': 'supported', 'body.latencyMs': 240, 'body.receipt': '0f3a…c21',
    // A two-sentence turn as the face rig's chat server returns it: K-E-V's affect per sentence, the words across each sentence's
    // measured speech, and Piper's phone intervals (gallery sample: its times are laid out evenly, not measured).
    turn: JSON.stringify({sentences: [
      {text: 'I hear you.', start: 0, end: 820, affect: {emotion: 'calm', intensity: .4},
        words: [{w: 'I', start: 0, end: 180}, {w: 'hear', start: 200, end: 520}, {w: 'you.', start: 540, end: 820}],
        phones: [{p: 'aɪ', start: 0, end: 180}, {p: 'h', start: 200, end: 280}, {p: 'ɪ', start: 280, end: 420}, {p: 'ɹ', start: 420, end: 520}, {p: 'j', start: 540, end: 620}, {p: 'u', start: 620, end: 820}]},
      {text: 'What stood out today?', start: 980, end: 2240, affect: {emotion: 'curious', intensity: .6},
        words: [{w: 'What', start: 980, end: 1240}, {w: 'stood', start: 1260, end: 1580}, {w: 'out', start: 1600, end: 1800}, {w: 'today?', start: 1820, end: 2240}],
        phones: [{p: 'w', start: 980, end: 1060}, {p: 'ʌ', start: 1060, end: 1160}, {p: 't', start: 1160, end: 1240}, {p: 's', start: 1260, end: 1340}, {p: 't', start: 1340, end: 1400},
          {p: 'ʊ', start: 1400, end: 1500}, {p: 'd', start: 1500, end: 1580}, {p: 'aʊ', start: 1600, end: 1740}, {p: 't', start: 1740, end: 1800}, {p: 't', start: 1820, end: 1880},
          {p: 'ə', start: 1880, end: 1960}, {p: 'd', start: 1960, end: 2040}, {p: 'eɪ', start: 2040, end: 2240}]}]}),
  },
  fixtures: {
    'Face, aligned': {},
    'Local, no timing': {'voice.body': 'local', 'voice.mouth': 'loudness', 'voice.voice': 'af_heart', 'voice.voices': JSON.stringify(['af_heart', 'af_bella', 'am_michael', 'bf_emma']),
      bodies: JSON.stringify([{id: 'local', available: true}, {id: 'face', available: true}, {id: 'realtime-aligned', available: false, why: 'No live client: AIKit holds the contract and a fixture translator.'},
        {id: 'realtime-native', available: false, why: 'No live client: AIKit holds the contract and a fixture translator.'}]),
      'body.interrupt': 'unsupported', 'voice.interrupt': 'off'},
    'Silent': {'voice.body': 'off', turn: undefined, reason: 'The agent has not spoken.'},
    'No readings': {'voice.body': undefined, 'voice.voice': undefined, 'voice.voices': undefined, 'voice.speed': undefined, 'voice.mouth': undefined, 'voice.affect': undefined,
      'voice.interrupt': undefined, 'voice.egress': undefined, 'voice.console': undefined, bodies: undefined, 'body.duplex': undefined, 'body.bargeIn': undefined,
      'body.interrupt': undefined, 'body.latencyMs': undefined, 'body.receipt': undefined, turn: undefined},
  },

  folded: p => { const b = bodyOf(p.v)
    return <Folded title="Voice" light={lightOf(p)} readings={[b === undefined ? NONE : BODY_LABEL[b], strOf(p.v, 'voice.voice') ?? NONE]} onUnfold={p.nav.unfold} /> },

  compact: p => { const c = controls(p)
    return <Panel title="Voice" view="compact" light={lightOf(p)} onFold={p.nav.fold} onFull={p.nav.full} onSelect={p.nav.select}>
      <Section width={152}><Display w={140} h={146} label="The last turn" does={DISPLAY_DOES}><TurnDisplay v={p.v} w={140} h={146} /></Display></Section>
      <Section label="Macros" cols={2}>{c.bodyChooser}{c.speed}{c.mouthChooser}{c.interrupt(true)}</Section>
    </Panel> },

  whole: p => { const c = controls(p), w = wide(p) ? Math.round(clampTo(186, p.room!.w - 640, 460)) : 186
    return <Panel title="Voice" view="whole" light={lightOf(p)} onFold={p.nav.fold} onFull={p.nav.full}>
      <Band>
        <Section width={w + 12}><Display w={w} h={146} label="The last turn" does={DISPLAY_DOES} corner={strOf(p.v, 'voice.voice')}><TurnDisplay v={p.v} w={w} h={146} /></Display></Section>
        <Section label="Body" width={124}>{c.body(true)}</Section>
        <Section label="Voice" width={124}>{c.voice}{c.speed}</Section>
        <Section label="Mouth" grow>{c.mouth(true)}{c.affect}</Section>
      </Band>
      <Band>
        <Section label="Turn-taking" width={96}>{c.interrupt(true)}</Section>
        <Section label="Privacy" width={104}>{c.egress}{c.console}</Section>
        <Section label="The body" cols={3} grow>
          <Readout label="duplex" does="Whether the body hears while it speaks." value={SUPPORT[strOf(p.v, 'body.duplex') ?? 'unknown']} />
          <Readout label="barge-in" does="Whether you can talk over it." value={SUPPORT[strOf(p.v, 'body.bargeIn') ?? 'unknown']} />
          <Readout label="stop" does="Whether it can stop mid-sentence." value={SUPPORT[strOf(p.v, 'body.interrupt') ?? 'unknown']} />
          <Readout label="latency" does="From the end of a sentence's text to its first sound." value={numOf(p.v, 'body.latencyMs') === undefined ? undefined : `${numOf(p.v, 'body.latencyMs')} ms`} tone="value" />
          <Readout label="receipt" does="The last turn's receipt." value={strOf(p.v, 'body.receipt')} />
        </Section>
      </Band>
    </Panel> },

  full: p => { const turn = turnOf(p.v)
    return <div className="ref-pane-body ref-pane-body--dark">
      <svg viewBox="0 0 760 420" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" className="ref-pane-svg" aria-label="The last spoken turn">
        <g className="dp-display" style={{background: 'none', border: 'none'}}>
          <g transform="translate(20 40)"><TurnDisplay v={p.v} w={720} h={240} /></g>
          {turn?.map((s, i) => <text key={i} x={20} y={320 + i * 22} className="dp-ink">{`${s.emotion ?? 'no affect'}${s.intensity !== undefined ? ` ${Math.round(s.intensity * 100)}%` : ''} · ${s.text}`}</text>)}
          {!turn && <text x={380} y={210} textAnchor="middle" className="dp-ink-dim">{strOf(p.v, 'reason') ?? 'Nothing spoken yet'}</text>}
        </g>
      </svg>
    </div> },

  widget: p => { const s = lastSentence(p.v), b = bodyOf(p.v)
    return <Tile title="Voice" light={lightOf(p)} span={2} onFull={p.nav.full}>
      <Display w={150} h={100} label="The last turn" does={DISPLAY_DOES}><TurnDisplay v={p.v} w={150} h={100} phones={false} /></Display>
      <div className="ref-tile-side">
        <Readout label="body" value={b === undefined ? undefined : BODY_LABEL[b]} tone="value" />
        <Readout label="feeling" value={s?.emotion} />
      </div>
    </Tile> },
}
