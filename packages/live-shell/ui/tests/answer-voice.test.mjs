// The Answer's voice (central:nara-conversation; DLW §19.4, §19.21): the session over the native voice owner (central/devices/
// answerVoice.ts), the Answer's binding of it (answerBinding.ts: hears, speaks, voice, heard, and the view's own face keys), the voice's
// loudness for the face's mouth (agent/faceVoice.ts) and the calls that move the mouth (agent/FaceStage.tsx mouthCalls).
// Channels: SCRIPTED against a FAKE OWNER — a stand-in for the kernel op nara_voice that answers open · listen · transcribe · speak ·
// complete · close as nara_voice.rs does (a recording lease, a response lease, its refusals in its words), a fake microphone whose
// blocks the test feeds, fake speakers whose sound the test ends. The real op (whisper.cpp, Kokoro) is not exercised here: it runs only
// in the desktop. The mouth's movement on the live face is measured in the gallery (headless Chromium), not here.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  if (s === 'react' || s.startsWith('react/')) return n(s, {...c, parentURL: ${JSON.stringify(import.meta.url)}})
  let r = null
  try { r = await n(s, c) } catch (e) { if (!s.startsWith('.')) throw e }
  if (r) {
    if (r.url.endsWith('.html') || r.url.endsWith('.css')) return {...r, format: 'module'}
    return r
  }
  if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
  for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
  for (const x of ['/index.ts', '/index.tsx']) { try { return await n(s + x, c) } catch {} }
  throw new Error('cannot resolve ' + s)
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (u.includes('?raw') || u.includes('.html')) return {format: 'module', shortCircuit: true, source: 'export default ""'};
  if (u.endsWith('.json')) return {format: 'module', shortCircuit: true, source: 'export default ' + await readFile(new URL(u), 'utf8')};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(await readFile(new URL(u), 'utf8'), {fileName: new URL(u).pathname,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}}).outputText};
}`)}`, import.meta.url)

globalThis.document ??= {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const voiceModule = await import('../src/central/devices/answerVoice.ts')
const answer = await import('../src/central/devices/answerBinding.ts')
const holds = await import('../src/central/devices/pageBindings.ts')
const faceVoice = await import('../src/agent/faceVoice.ts')
const stage = await import('../src/agent/FaceStage.tsx')
const {AnswerVoice, VOICE_OFF, EAR, EAR_START, hear, spokenAnswerOf, exchangeOf, microphoneWords} = voiceModule

const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(resolve => setTimeout(resolve, 1)) }
const SAID = 'What does this entry ask of me?'

/** A stand-in for the kernel op nara_voice, as nara_voice.rs answers: one recording or one response per voice, refused otherwise. */
function fakeOwner({refuse = {}, text = SAID} = {}) {
  const calls = [], sent = [], played = []
  let n = 0, capture = null, response = null
  const open = new Set()
  const schema = 'oi.nara-voice/v1'
  const voice = async request => {
    calls.push(request.operation)
    if (refuse[request.operation]) throw new Error(refuse[request.operation])
    if (request.operation !== 'open' && !open.has(request.voice_ref)) throw new Error('Voice lease absent')
    switch (request.operation) {
      case 'open': { const voice_ref = `nara-voice:${++n}`; open.add(voice_ref); return {schema, voice_ref} }
      case 'listen':
        if (capture || response) throw new Error('Finish the current voice activity first')
        capture = `nara-capture:${++n}`
        return {schema, voice_ref: request.voice_ref, capture_ref: capture}
      case 'transcribe':
        if (request.capture_ref !== capture) throw new Error('Recording lease is stale or already consumed')
        capture = null
        assert.match(request.wav_base64, /^[A-Za-z0-9+/=]+$/, 'the recording goes as base64 WAV')
        return {schema, voice_ref: request.voice_ref, transcription: {text}}
      case 'speak':
        if (capture || response) throw new Error('Finish the current voice activity first')
        response = `nara-voice-answer:${++n}:${request.answer_block_id}`
        return {schema, voice_ref: request.voice_ref, response_ref: response, audio: {audio_base64: 'UklGRg==', content_type: 'audio/wav'}, answer: {text: 'An answer.', answer_block_ids: [request.answer_block_id]}}
      case 'complete':
        if (request.response_ref !== response) throw new Error('Playback completion does not name the current native response')
        response = null
        return {schema, voice_ref: request.voice_ref, observation: 'renderer-playback-ended'}
      case 'close': open.delete(request.voice_ref); capture = null; response = null; return {schema, voice_ref: request.voice_ref, closed: true}
    }
    throw new Error('Invalid native voice operation')
  }
  const mic = {hear: null, discarded: 0, refuse: null}
  const sound = {current: null}
  const ports = {
    voice,
    opening: async () => ({binding: {operation: 'lookup', role: 'nara'}, context: {agent_session_ref: 'session:fixture'}}),
    send: async said => { sent.push(said) },
    capture: async hearing => {
      if (mic.refuse) throw mic.refuse
      mic.hear = hearing
      return {finish: async () => new Uint8Array([82, 73, 70, 70]).buffer, discard: async () => { mic.discarded++ }}
    },
    play: async wav => {
      assert.ok(wav instanceof ArrayBuffer, 'the owner\'s WAV, decoded from base64')
      let end
      const ended = new Promise(resolve => { end = resolve })
      const playing = {ended, stopped: false, stop() { playing.stopped = true; end() }, finish: () => end()}
      played.push(playing)
      sound.current = playing
      return playing
    },
    encode: bytes => Buffer.from(bytes).toString('base64'),
    decode: base64 => new Uint8Array(Buffer.from(base64, 'base64')).buffer,
  }
  /** Speak a short utterance into the fake microphone: the room, a second of speech, then quiet until the ear ends it. */
  const speak = () => {
    for (let i = 0; i < 3; i++) mic.hear.level(0.002, 85)
    for (let i = 0; i < 6; i++) mic.hear.level(0.06, 85)
    for (let i = 0; i < 14; i++) mic.hear.level(0.002, 85)
  }
  return {calls, sent, played, ports, mic, sound, speak, holding: () => ({capture, response})}
}

// ── the session ───────────────────────────────────────────────────────────

test('both keys start off, and nothing opens a microphone by itself', () => {
  const voice = new AnswerVoice()
  assert.deepEqual(voice.snapshot(), VOICE_OFF)
  assert.deepEqual([VOICE_OFF.hears, VOICE_OFF.speaks, VOICE_OFF.voice, VOICE_OFF.heard], ['off', 'off', 'quiet', ''])
  const owner = fakeOwner()
  voice.attach('session:fixture', owner.ports)
  assert.deepEqual(owner.calls, [], 'attached, the voice opens nothing until a key is pressed')
})

test('with no conversation and no native owner, Hears refuses in words, and says nothing it did not hear', async () => {
  const voice = new AnswerVoice()
  await assert.rejects(() => voice.write('hears', 'on'), /No conversation is bound here/)
  await assert.rejects(() => voice.write('speaks', 'on'), /No conversation is bound here/)
  assert.equal(voice.snapshot().heard, '', 'no transcript is made up')
  await assert.rejects(() => voice.write('hears', 'maybe'), /on or off/)
})

test('Hears on: open, listen, the microphone until you stop talking, transcribe, then your words go as the next turn and clear', async () => {
  const voice = new AnswerVoice(), owner = fakeOwner()
  voice.attach('session:fixture', owner.ports)
  voice.observe({answer: 4, ended: 5})
  const seen = []
  voice.subscribe(() => seen.push(voice.snapshot()))
  await voice.write('hears', 'on')
  assert.deepEqual(owner.calls, ['open', 'listen'])
  assert.deepEqual([voice.snapshot().hears, voice.snapshot().voice], ['on', 'listening'], 'the microphone is open: the face attends')
  owner.speak()
  await settle()
  assert.deepEqual(owner.calls, ['open', 'listen', 'transcribe'])
  assert.deepEqual(owner.sent, [SAID], 'the transcript goes to the same Send a typed question does')
  assert.ok(seen.some(state => state.heard === SAID), 'your words stood in `heard` until they were sent')
  assert.deepEqual([voice.snapshot().heard, voice.snapshot().voice, voice.snapshot().hears], ['', 'quiet', 'on'], 'sent: heard clears; the microphone waits for the answer')
  // The turn ends (Speaks off): the microphone opens again.
  voice.observe({answer: 9, ended: 10})
  await settle()
  assert.deepEqual(owner.calls, ['open', 'listen', 'transcribe', 'listen'])
  assert.equal(voice.snapshot().voice, 'listening')
})

test('a quiet room, a cough, a word too short: the ear waits for speech, then for a second of quiet after it', () => {
  let ear = EAR_START
  const feed = (rms, ms) => { const step = hear(ear, rms, ms); ear = step.state; return step.ended }
  for (let i = 0; i < 20; i++) assert.equal(feed(0.003, 85), false, 'the room alone never ends anything')
  assert.equal(feed(0.05, 85), false)
  assert.equal(ear.heard, false, 'one block is not speech enough')
  for (let i = 0; i < 20; i++) feed(0.003, 85)
  assert.equal(ear.heard, false)
  for (let i = 0; i < 4; i++) feed(0.05, 85)
  assert.equal(ear.heard, true, `${EAR.speechMs} ms of speech: you have spoken`)
  let at = 0
  for (let i = 1; i <= 20 && !at; i++) if (feed(0.003, 85)) at = i * 85
  assert.ok(at >= EAR.quietMs && at < EAR.quietMs + 85, `ended after ${at} ms of quiet`)
  assert.equal(hear(EAR_START, 0.02, 85).state.room, 0.02, 'the room is learnt from the first block')
  assert.equal(hear({...EAR_START, room: 0.02}, 0.004, 85).state.room, 0.012, 'and follows a quieter room at once')
})

test('Speaks on: an answer that completes is spoken; the face reports speaking; played out, the owner is told, and the microphone opens', async () => {
  const voice = new AnswerVoice(), owner = fakeOwner()
  voice.attach('session:fixture', owner.ports)
  voice.observe({answer: 4, ended: 5})
  await voice.write('speaks', 'on')
  assert.deepEqual(owner.calls, ['open'])
  voice.observe({answer: 4, ended: 5})
  await settle()
  assert.deepEqual(owner.calls, ['open'], 'what was answered before is never spoken')
  await voice.write('hears', 'on')
  owner.speak()
  await settle()
  assert.deepEqual(owner.sent, [SAID])
  voice.observe({answer: 12, ended: 13})
  await settle()
  assert.deepEqual(owner.calls, ['open', 'listen', 'transcribe', 'speak'])
  assert.equal(voice.snapshot().voice, 'speaking')
  assert.deepEqual(owner.holding(), {capture: null, response: owner.holding().response}, 'no microphone while it speaks')
  owner.sound.current.finish()
  await settle()
  assert.deepEqual(owner.calls, ['open', 'listen', 'transcribe', 'speak', 'complete', 'listen'])
  assert.equal(voice.snapshot().voice, 'listening', 'played out: it listens again')
})

test('barge-in: Hears pressed while the answer is spoken stops the sound, tells the owner it ended, and listens', async () => {
  const voice = new AnswerVoice(), owner = fakeOwner()
  voice.attach('session:fixture', owner.ports)
  voice.observe({answer: null, ended: null})
  await voice.write('speaks', 'on')
  voice.observe({answer: 3, ended: 4})
  await settle()
  assert.equal(voice.snapshot().voice, 'speaking')
  await voice.write('hears', 'on')
  assert.equal(owner.played[0].stopped, true, 'the sound stopped at once')
  assert.deepEqual(owner.calls, ['open', 'speak', 'complete', 'listen'])
  assert.deepEqual([voice.snapshot().voice, voice.snapshot().hears, voice.snapshot().speaks], ['listening', 'on', 'on'])
  // Speaks off while it speaks stops it too.
  owner.speak()
  await settle()
  voice.observe({answer: 8, ended: 9})
  await settle()
  assert.equal(voice.snapshot().voice, 'speaking')
  await voice.write('speaks', 'off')
  assert.equal(owner.played[1].stopped, true)
  assert.equal(owner.calls.at(-1), 'complete')
})

test('refusals come back in the owner\'s words, on the key that asked, and the key goes back off', async () => {
  const connect = 'Connect this person\'s native Nara conversation before opening voice'
  const refused = new AnswerVoice(), owner = fakeOwner({refuse: {open: connect}})
  refused.attach('session:fixture', owner.ports)
  await assert.rejects(() => refused.write('hears', 'on'), new RegExp(connect))
  assert.deepEqual([refused.snapshot().hears, refused.snapshot().refused.hears], ['off', connect])
  await assert.rejects(() => refused.write('speaks', 'on'), new RegExp(connect))
  assert.deepEqual([refused.snapshot().speaks, refused.snapshot().refused.speaks], ['off', connect])
  // The microphone refused: the recording lease is released (closed), and the words say how to allow it.
  const denied = new AnswerVoice(), mic = fakeOwner()
  mic.mic.refuse = Object.assign(new Error('Permission denied'), {name: 'NotAllowedError'})
  denied.attach('session:fixture', mic.ports)
  await assert.rejects(() => denied.write('hears', 'on'), /microphone was refused/)
  assert.deepEqual(mic.calls, ['open', 'listen', 'close'])
  assert.match(denied.snapshot().refused.hears, /Privacy & Security › Microphone/)
  assert.equal(microphoneWords(Object.assign(new Error('x'), {name: 'NotFoundError'})), 'No microphone is connected.')
  // The owner will not speak (no Kokoro model): Speaks goes off with its words.
  const mute = new AnswerVoice(), kokoro = fakeOwner({refuse: {speak: 'Local speech synthesis is unavailable: the Kokoro model is not installed'}})
  mute.attach('session:fixture', kokoro.ports)
  mute.observe({answer: null, ended: null})
  await mute.write('speaks', 'on')
  mute.observe({answer: 2, ended: 3})
  await settle()
  assert.deepEqual([mute.snapshot().speaks, mute.snapshot().voice], ['off', 'quiet'])
  assert.match(mute.snapshot().refused.speaks, /Kokoro model is not installed/)
  // The words could not be sent: they stay in `heard`, the microphone closes.
  const unsent = new AnswerVoice(), lost = fakeOwner()
  unsent.attach('session:fixture', {...lost.ports, send: async () => { throw new Error('The session is not connected.') }})
  await unsent.write('hears', 'on')
  lost.speak()
  await settle()
  assert.deepEqual([unsent.snapshot().heard, unsent.snapshot().hears, unsent.snapshot().refused.hears], [SAID, 'off', 'The session is not connected.'])
  // A press clears the last refusal on its key.
  await unsent.write('hears', 'off')
  assert.equal(unsent.snapshot().refused.hears, undefined)
})

test('Hears off mid-sentence drops the recording unwritten and releases its lease; another conversation closes the voice', async () => {
  const voice = new AnswerVoice(), owner = fakeOwner()
  voice.attach('session:fixture', owner.ports)
  await voice.write('hears', 'on')
  owner.mic.hear.level(0.002, 85)
  owner.mic.hear.level(0.06, 85)
  await voice.write('hears', 'off')
  assert.deepEqual(owner.calls, ['open', 'listen', 'close'], 'never transcribed; the lease that held it closed')
  assert.equal(owner.mic.discarded, 1)
  assert.deepEqual([voice.snapshot().hears, voice.snapshot().voice], ['off', 'quiet'])
  await voice.write('hears', 'on')
  assert.deepEqual(owner.calls.slice(3), ['open', 'listen'], 'pressed again, it opens again')
  voice.attach('session:another', fakeOwner().ports)
  await settle()
  assert.deepEqual(voice.snapshot(), VOICE_OFF, 'another conversation: both keys off')
  assert.equal(owner.calls.at(-1), 'close', 'the old voice closed')
})

test('the answer the owner speaks is the first block of the last completed answer; a turn ends at completed, cancelled or error', () => {
  const blocks = [{id: 1, kind: 'user', text: 'Q'}, {id: 2, kind: 'assistant', text: 'A'}, {id: 3, kind: 'assistant', text: 'B'}, {id: 4, kind: 'completed', text: ''},
    {id: 5, kind: 'user', text: 'Q2'}, {id: 6, kind: 'assistant', text: 'part'}]
  assert.equal(spokenAnswerOf(blocks), 2, 'the run 2–3 completed; the run at 6 has not')
  assert.deepEqual(exchangeOf(blocks), {answer: 2, ended: 4})
  assert.deepEqual(exchangeOf([...blocks, {id: 7, kind: 'cancelled', text: ''}]), {answer: 2, ended: 7}, 'a cancelled turn ends, unspoken')
  assert.deepEqual(exchangeOf(undefined), {answer: null, ended: null})
})

// ── the binding ───────────────────────────────────────────────────────────

const roster = [{ref: 'agent/nara', name: 'Nara', accepted: true, role: 'nara'}]
const bound = {nara: {state: 'bound', session: 'session:fixture', resume: false}, observed: {status: {state: 'Resident'}, reading: {blocks: [], permissions: []}}, roster, page: null}

test('the Answer reports the voice its owner holds, writes Hears and Speaks to it, and holds the face\'s own keys for the session', async () => {
  holds.resetHolds()
  for (const key of ['hears', 'speaks', 'voice', 'heard', 'chat', 'emotion', 'feeling.v', 'feeling.a', 'gaze.x', 'gaze.y', 'gesture', 'do']) assert.ok(answer.ANSWER_WIRING.keys.includes(key), key)
  for (const key of ['hears', 'speaks']) assert.ok(key in answer.ANSWER_WIRING.writes && key in answer.ANSWER_WIRING.reads, `${key}: read and written`)
  for (const key of ['voice', 'heard']) assert.ok(key in answer.ANSWER_WIRING.reads && !(key in answer.ANSWER_WIRING.writes), `${key}: a reading`)
  const written = []
  const state = {...VOICE_OFF, hears: 'on', voice: 'listening', heard: SAID}
  const binding = answer.answerBinding('central:nara-conversation', {...bound, voice: state}, {bind: null, send: async () => {}, voice: {write: async (key, value) => { written.push([key, value]) }, why: null}})
  const v = binding.values
  assert.deepEqual([v.hears, v.speaks, v.voice, v.heard], ['on', 'off', 'listening', SAID])
  assert.deepEqual([v.chat, v.emotion, v['feeling.v'], v['feeling.a'], v['gaze.x'], v['gaze.y'], v.gesture, v.do], ['on', 'neutral', 0, 0, 0, 0, 'nod', 0], 'the view\'s keys at rest')
  await binding.write([{key: 'hears', value: 'off'}, {key: 'speaks', value: 'on'}])
  assert.deepEqual(written, [['hears', 'off'], ['speaks', 'on']])
  assert.equal(binding.standing.hears, undefined, 'it can open: nothing stands disabled')
  // The view's own keys never reach an owner: they go to the one store, and every view of the Answer reads them.
  for (const key of ['chat', 'emotion', 'feeling.v', 'gaze.x', 'gesture', 'do']) assert.equal(typeof binding.local[key], 'function', `${key} is the view's`)
  binding.local.emotion('curious'); binding.local['feeling.v'](0.4); binding.local.do(3); binding.local.chat('off')
  const again = answer.answerBinding('central:nara-conversation', {...bound, voice: state}, {bind: null, send: null, voice: null})
  assert.deepEqual([again.values.emotion, again.values['feeling.v'], again.values.do, again.values.chat], ['curious', 0.4, 3, 'off'], 'another view reads the same face')
  holds.resetHolds()
})

test('where the voice cannot open, Hears and Speaks stand disabled with the reason; a refusal stands on its key in the owner\'s words', async () => {
  const noNative = 'Voice needs the desktop\'s own speech on this machine (the kernel op nara_voice: whisper.cpp hears, Kokoro speaks), and no native kernel stands here: the test carrier is down'
  const closed = answer.answerBinding('central:nara-conversation', {...bound, voice: VOICE_OFF}, {bind: null, send: null, voice: {write: async () => {}, why: noNative}})
  assert.equal(closed.standing.hears.disabled, noNative)
  assert.equal(closed.standing.speaks.disabled, noNative)
  await assert.rejects(() => closed.write([{key: 'hears', value: 'on'}]), /no native kernel stands here/)
  const none = answer.answerBinding('central:nara-conversation', {...bound, voice: VOICE_OFF}, {bind: null, send: null})
  assert.match(none.standing.hears.disabled, /No voice owner stands here/)
  const refused = answer.answerBinding('central:nara-conversation', {...bound, voice: {...VOICE_OFF, refused: {speaks: 'The Kokoro model is not installed'}}},
    {bind: null, send: async () => {}, voice: {write: async () => {}, why: null}})
  assert.deepEqual(refused.standing.speaks, {refused: 'The Kokoro model is not installed'}, 'pressable again, with what the owner said')
  await assert.rejects(() => refused.write([{key: 'voice', value: 'speaking'}]), /a reading/, 'what the voice does is the owner\'s to report')
  const {voiceAbsence} = await import('../src/central/devices/useAnswerVoice.ts')
  assert.equal(voiceAbsence({kind: 'unavailable', reason: 'the test carrier is down'}, true, true), noNative)
  assert.match(voiceAbsence({kind: 'tauri'}, false, false), /not bound/)
  assert.equal(voiceAbsence({kind: 'tauri'}, true, true), null)
})

// ── the loudness, for the mouth ───────────────────────────────────────────

const sine = (amplitude, n = 2400, rate = 24000, hz = 150) => Float32Array.from({length: n}, (_, i) => amplitude * Math.sin(2 * Math.PI * hz * i / rate))

test('a known signal gives the known level: RMS, the speaking level, and the loudness against it', () => {
  assert.ok(Math.abs(faceVoice.rmsOf(sine(0.2)) - 0.2 / Math.SQRT2) < 1e-3, 'a sine\'s RMS is its amplitude over √2')
  assert.equal(faceVoice.rmsOf([]), 0)
  const reference = faceVoice.referenceLevel(sine(0.2, 24000), 24000)
  assert.ok(Math.abs(reference - 0.2 / Math.SQRT2) < 2e-3, 'the speaking level of a steady voice is its RMS')
  assert.equal(faceVoice.referenceLevel(new Float32Array(24000), 24000), 0, 'silence has no speaking level')
  const at = db => faceVoice.loudnessOf(reference * 10 ** (db / 20), reference)
  assert.equal(at(0), 1, 'at the speaking level: fully open')
  assert.equal(at(6), 1, 'louder stays fully open')
  assert.ok(Math.abs(at(-15) - 0.25) < 1e-9, 'half the range under: a quarter (the curve squares it)')
  assert.equal(at(-faceVoice.LOUDNESS_RANGE_DB), 0, 'the range under: shut')
  assert.equal(faceVoice.loudnessOf(0, reference), 0)
  // The follower opens fast and closes slower.
  const up = faceVoice.follow(0, 1, 16), down = 1 - faceVoice.follow(1, 0, 16)
  assert.ok(up > down && up > 0.5 && down > 0.15, `opens ${up.toFixed(2)} and closes ${down.toFixed(2)} of the way in a frame`)
})

test('the player puts the voice\'s loudness on the bus each frame and lets go when it ends or is stopped', async () => {
  const levels = []
  const off = faceVoice.subscribeVoiceLevel(level => levels.push(level))
  let frame = null, now = 0, data = sine(0.2, 1024), onended = null
  const nodes = []
  const audio = {
    currentTime: 0, destination: 'speakers',
    createBufferSource: () => { const node = {buffer: null, connected: [], connect(to) { node.connected.push(to) }, start() { node.started = true }, stop() { node.stopped = true }, set onended(f) { onended = f }, get onended() { return onended }}; nodes.push(node); return node },
    createAnalyser: () => ({fftSize: 0, getFloatTimeDomainData(array) { array.set(data.subarray(0, array.length)) }}),
    createDelay: () => { const node = {delayTime: {value: 0}, connect(to) { node.to = to }}; nodes.push(node); return node },
  }
  const sound = {duration: 1, sampleRate: 24000, getChannelData: () => sine(0.2, 24000)}
  const clock = tick => { frame = tick; return () => { frame = null } }
  const playing = faceVoice.playVoice(audio, sound, clock)
  assert.equal(nodes[0].started, true)
  assert.equal(nodes[1].delayTime.value, faceVoice.MOUTH_LEAD_MS / 1000, 'the sound waits for the mouth')
  assert.equal(nodes[1].to, 'speakers')
  assert.equal(levels[0], 0, 'it starts shut')
  for (let i = 0; i < 12; i++) { now += 16; frame(now) }
  assert.ok(levels.at(-1) > 0.95, `at the speaking level the mouth is open (${levels.at(-1).toFixed(3)})`)
  data = new Float32Array(1024)
  for (let i = 0; i < 12; i++) { now += 16; frame(now) }
  assert.ok(levels.at(-1) < 0.1, `in the quiet between words it closes (${levels.at(-1).toFixed(3)})`)
  onended()
  await playing.ended
  assert.equal(levels.at(-1), null, 'ended: no voice')
  assert.equal(frame, null, 'and no frame is asked for')
  const again = faceVoice.playVoice(audio, sound, clock)
  again.stop()
  await again.ended
  assert.equal(faceVoice.voiceLevel(), null, 'stopped: no voice')
  off()
})

test('the mouth follows only the loudness: the jaw opens and the lower lip drops by it, through the face\'s own pads', async () => {
  assert.deepEqual(stage.mouthCalls(1), [{apply: {type: 'pad', name: 'jaw', x: 0, y: stage.MOUTH_JAW}}, {apply: {type: 'pad', name: 'lowerFace', x: stage.MOUTH_LIP, y: 0}}])
  assert.deepEqual(stage.mouthCalls(0.5), [{apply: {type: 'pad', name: 'jaw', x: 0, y: 0.23}}, {apply: {type: 'pad', name: 'lowerFace', x: 0.15, y: 0}}], 'kept to two places')
  assert.deepEqual(stage.mouthCalls(null), stage.mouthCalls(0), 'no voice: the pads let go')
  assert.deepEqual(stage.mouthCalls(7), stage.mouthCalls(1), 'never past fully open')
  assert.ok(stage.MOUTH_JAW * 0.85 < 0.42, 'fully open stays short of the widest the face\'s own speech opens the jaw')
  assert.equal(stage.mouthFollowsVoice({state: 'answering', speaking: false}), true, 'answering aloud: the mouth follows the voice')
  assert.equal(stage.mouthFollowsVoice({state: 'answering'}), false, 'answering in words: the face moves its own mouth')
  assert.equal(stage.mouthFollowsVoice({state: 'listening', speaking: false}), false)
  assert.equal(stage.mouthFollowsVoice({state: 'answering', speaking: false, dim: true}), false, 'asleep, never')
  // Only actions the face itself takes: apply() has `pad`, and the face has both pads.
  const speech = await readFile(new URL('../public/face/face-speech.js', import.meta.url), 'utf8')
  const core = await readFile(new URL('../public/face/face-core.js', import.meta.url), 'utf8')
  assert.match(speech.slice(speech.indexOf('apply(action){')), /case 'pad': \{/)
  assert.match(core, /pad:\{[^\n]*jaw:\[0, 0\][^\n]*lowerFace:\{L:\[0, 0\]/, 'the face\'s pads include jaw and lowerFace')
  assert.match(core, /PADS\.lowerFace = \{[^\n]*'drop lip'/, 'lowerFace\'s x drops the lip')
})
