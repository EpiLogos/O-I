import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

// The agent's face, live (src/agent/FaceStage.tsx), the face it hosts (public/face, vendored from EpiLogos/face-rig by
// scripts/sync-face.mjs), and the Answer that stands it where it is opened (catalogue/panels/central__nara-conversation.tsx;
// docs/dlw/DLW.md §19.4). What holds without a browser: the pose each phase asks of the face, in the face's own names; the mask
// the stage draws on the server; where the Answer stands the face and where it keeps the icon; the light's ring while the agent
// works; and the vendored files against their REVISION.json. The live face itself is walked in the gallery.
// Loader as kit-motion.test.mjs.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export default null'};
  if(url.endsWith('.ts')||url.endsWith('.tsx')){
    const source=await readFile(new URL(url).pathname,'utf8');
    const {outputText}=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:url});
    return {format:'module',shortCircuit:true,source:outputText};
  }
  return next(url,context);
}`)}`, {parentURL: import.meta.url})

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const {createElement: h} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const stage = await import('../src/agent/FaceStage.tsx')
const {maskStatic} = await import('../src/agent/maskFace.ts')
const {design: answer, WHOLE_WELL, poseOf} = await import('../src/inhabitants/catalogue/panels/central__nara-conversation.tsx')
const sync = await import('../scripts/sync-face.mjs')
const html = el => renderToStaticMarkup(el)
const FACE = new URL('../public/face/', import.meta.url)
const vendored = name => readFileSync(new URL(name, FACE), 'utf8')

// ── the pose, in the face's own names ─────────────────────────────────────

test('each phase puts the face in one of its own agent states: at rest, reading (focused, eyes on the packet), speaking', () => {
  const {faceCalls} = stage
  assert.deepEqual(faceCalls({}), [{apply: {type: 'agent', name: 'idle'}}], 'no phase reported: at rest')
  assert.deepEqual(faceCalls({state: 'idle'}), [{apply: {type: 'agent', name: 'idle'}}])
  assert.deepEqual(faceCalls({state: 'reading'}), [{apply: {type: 'agent', name: 'working'}}])
  assert.deepEqual(faceCalls({state: 'answering'}), [{apply: {type: 'agent', name: 'speaking'}}, {speechMode: false}],
    'answering: the speaking state moves the mouth itself, no voice needed')
  assert.deepEqual(faceCalls({state: 'answering', speaking: false}), [{apply: {type: 'agent', name: 'speaking'}}, {speechMode: true}],
    'not speaking: the mouth waits for a voice to move it')
  assert.deepEqual(faceCalls({state: 'reading', speaking: true}), [{apply: {type: 'agent', name: 'working'}}], 'only an answer speaks')
})

test('asleep while nothing is bound; a held expression and a feeling go over the phase, the feeling kept to the plane', () => {
  const {faceCalls} = stage
  const asleep = [{apply: {type: 'agent', name: 'idle'}}, {apply: {type: 'expression', name: 'sleep', weight: 1}}, {apply: {type: 'emotion', name: 'sleepy'}}]
  assert.deepEqual(faceCalls({dim: true}), asleep)
  assert.deepEqual(faceCalls({dim: true, state: 'answering', expression: 'smile', affect: [0.5, 0.5]}), asleep, 'asleep, nothing else is held over it')
  assert.deepEqual(faceCalls({state: 'idle', expression: 'curious', affect: [2, -0.4]}),
    [{apply: {type: 'agent', name: 'idle'}}, {apply: {type: 'expression', name: 'curious', weight: 1}}, {apply: {type: 'affect', valence: 1, arousal: -0.4}}])
  assert.deepEqual(stage.faceCalls({state: 'reading'}), stage.faceCalls({state: 'reading'}), 'pure: the same pose, the same calls')
})

/** The keys of a `const NAME = {…};` table in the vendored face (top-level keys, two spaces in). */
function tableOf(source, name) {
  const start = source.indexOf(`const ${name} = {`)
  assert.ok(start >= 0, `face-core.js has no ${name}`)
  const body = source.slice(start, source.indexOf('\n};', start))
  return new Set([...body.matchAll(/^ {2}'?([\w-]+)'?\s*:/gm)].map(m => m[1]))
}

test('every action the stage can send is one the face itself takes (face-core.js tables, face-speech.js FACE_RIG_CHAT.apply)', () => {
  const core = vendored('face-core.js'), speech = vendored('face-speech.js')
  const agents = tableOf(core, 'AGENTS'), expressions = tableOf(core, 'FACE_EXPRS'), emotions = tableOf(core, 'EMOTIONS')
  const surface = speech.slice(speech.indexOf('window.FACE_RIG_CHAT = Object.freeze({'))
  assert.match(surface, /\n {2}setSpeechMode\(active\)\{/, 'the speech mode is the face\'s own')
  const cases = new Set([...surface.slice(surface.indexOf('apply(action){')).matchAll(/case '([\w-]+)':/g)].map(m => m[1]))
  const poses = [{}, {dim: true}, ...['idle', 'reading', 'answering'].flatMap(state => [{state}, {state, speaking: false}, {state, expression: 'focus', affect: [0, 0]}])]
  for (const pose of poses) {
    for (const call of stage.faceCalls(pose)) {
      if ('speechMode' in call) continue
      const {type, name} = call.apply
      assert.ok(cases.has(type), `apply() takes ${type}`)
      if (type === 'agent') assert.ok(agents.has(name), `the face has the agent state ${name}`)
      if (type === 'expression') assert.ok(expressions.has(name), `the face has the expression ${name}`)
      if (type === 'emotion') assert.ok(emotions.has(name), `the face has the emotion ${name}`)
    }
  }
  for (const name of Object.values(stage.FACE_AGENT_OF)) assert.ok(agents.has(name), name)
  assert.ok(agents.has('working') && /working:\s*\{[^}]*expr:\['focus'/.test(core), 'reading is the face\'s focused, working state')
})

// ── the stage on the server ───────────────────────────────────────────────

test('on the server the stage draws the mask in the pose and no frame: the live face stands only in a browser', () => {
  const out = html(h(stage.FaceStage, {state: 'reading', label: 'Nara: reading'}))
  assert.match(out, /^<div class="face-stage" data-face="mask" role="img" aria-label="Nara: reading"><div class="face-stage-mask" aria-hidden="true"><svg class="pface"/)
  assert.doesNotMatch(out, /<iframe/, 'no frame until it mounts')
  assert.ok(out.includes(maskStatic('focus', 'var(--fizz)', 'var(--fizz)', 150, 'var(--bg-0)')), 'reading: the focused mask')
  const asleep = html(h(stage.FaceStage, {state: 'answering', dim: true}))
  assert.match(asleep, /data-dim="true"/)
  assert.ok(asleep.includes(maskStatic('sleep', 'var(--fizz)', 'var(--fizz)', 150, 'var(--bg-0)')), 'not bound: the mask asleep')
  assert.equal(stage.maskOf({state: 'answering'}), 'speak')
  assert.equal(stage.maskOf({state: 'idle', expression: 'smile'}), 'smile')
  assert.equal(stage.FACE_PAGE, '/face/face.html', 'served beside the page, under the app\'s base')
})

// ── where the Answer stands the face ──────────────────────────────────────

const valuesOf = fixture => Object.fromEntries(Object.entries({...answer.defaults, ...(answer.fixtures?.[fixture] ?? {})}).filter(([, v]) => v !== undefined))
const props = (fixture, extra = {}) => ({v: valuesOf(fixture), set: () => {}, nav: {}, page: '', setPage: () => {}, ...extra})
const stages = out => (out.match(/class="face-stage[ "]/g) ?? []).length

test('opened, the Answer shows its whole face: Whole beside the well; Full is the face, three marks and, optionally, the conversation', () => {
  const whole = html(h(() => answer.whole(props('Answered, waiting'))))
  assert.equal(stages(whole), 1, 'Whole: one face')
  assert.match(whole, /<div class="an-well"><div class="dp-display" style="width:274px;height:146px"/, 'the well, widened for the face')
  assert.match(whole, /class="face-stage an-well-face" style="left:3px;top:7px;width:96px;height:134px" data-face="mask" role="img" aria-label="Nara: idle"/,
    'the face at the well\'s left, over its own pixels, at least 110 px tall')
  assert.equal(WHOLE_WELL.w + 12 + 112, 398, 'the well and the Agent section fill the pool\'s 400 px plate, borders aside')
  for (const handle of ['Effort', 'Agent writes', 'Answer as']) assert.match(whole, new RegExp(`role="slider" aria-label="${handle}"`), `handle: ${handle}`)
  const full = html(h(() => answer.full(props('Answered, waiting', {frame: 'pane'}))))
  assert.equal(stages(full), 1, 'Full: the face')
  assert.match(full, /<div class="an-pane" data-chat="on"><div class="an-stage"><div class="face-stage an-stage-face"/, 'the face fills the stage')
  for (const mark of ['hears', 'speaks', 'chat']) assert.match(full, new RegExp(`class="an-mark" data-kind="${mark}"`), `mark: ${mark}`)
  assert.doesNotMatch(full, /an-pane-head|an-task/, 'no header: what it would say of itself is in the rack')
  assert.match(full, /<aside class="an-chat" aria-label="Conversation">/, 'the conversation, at the right')
  const alone = html(h(() => answer.full({...props('Answered, waiting', {frame: 'pane'}), v: {...valuesOf('Answered, waiting'), chat: 'off'}})))
  assert.match(alone, /data-chat="off"/)
  assert.doesNotMatch(alone, /an-chat/, 'closed: the face has the whole pane')
  const window = html(h(() => answer.whole(props('Answered, waiting', {frame: 'window'}))))
  assert.equal(stages(window), 1, 'in its own window the rack\'s face is the still one: the pane above stands the live face')
  const asleep = html(h(() => answer.whole(props('Not bound'))))
  assert.match(asleep, /class="face-stage an-well-face"[^>]*data-dim="true"[^>]*aria-label="Nara: not bound"/, 'not bound: asleep')
})

test('your words and the agent\'s stand under the face when the conversation is closed, and in it when it is open', () => {
  const alone = html(h(() => answer.full({...props('Hearing you, face alone', {frame: 'pane'})})))
  assert.match(alone, /<p class="an-subtitle" aria-live="polite"><span data-who="you">What does this entry ask of me<\/span><\/p>/, 'heard, under the face')
  assert.doesNotMatch(alone, /an-chat/)
  const speaking = html(h(() => answer.full({...props('Speaking, face alone', {frame: 'pane'})})))
  assert.match(speaking, /<span data-who="agent">/, 'said, under the face while it speaks')
  const open = html(h(() => answer.full({...props('Speaking, face alone', {frame: 'pane'}), v: {...valuesOf('Speaking, face alone'), chat: 'on'}})))
  assert.doesNotMatch(open, /data-who="agent"/, 'with the conversation open, it holds the words and the face does not say them twice')
  assert.match(html(h(() => answer.full(props('Hearing you, face alone', {frame: 'pane'})))), /aria-pressed="true"[^>]*aria-label="Hears"|aria-label="Hears"[^>]*aria-pressed="true"/, 'the mark shows the microphone open')
})

test('the face\'s pose follows the voice and the dynamics set on the Face page, over the state it is in', () => {
  const pose = (fixture, extra = {}) => poseOf({...props(fixture), v: {...valuesOf(fixture), ...extra}})
  assert.equal(pose('Answered, waiting').state, 'idle')
  assert.equal(pose('Hearing you, face alone').state, 'listening', 'while you speak the face attends')
  assert.equal(pose('Speaking, face alone').state, 'answering')
  assert.equal(pose('Speaking, face alone').speaking, false, 'with Speaks on the mouth waits for the voice')
  assert.equal(pose('Answering').speaking, undefined, 'without it the face moves its mouth to the words itself')
  const wry = pose('Wry, looking aside')
  assert.equal(wry.emotion, 'curious')
  assert.deepEqual(wry.affect, [0.4, 0.3])
  assert.deepEqual(wry.gaze, [-0.5, 0.2])
  assert.equal(pose('Answered, waiting').emotion, undefined, 'neutral and centred hold nothing over the state')
  assert.equal(pose('Answered, waiting', {do: 3}).gesture.n, 3, 'a gesture is made for each count')
  assert.equal(pose('Not bound').dim, true)
})

test('folded, compact, on the rail and in each row the Answer keeps the small mask: an icon, never the live face', () => {
  for (const fixture of ['Answered, waiting', 'Answering', 'Not bound']) {
    for (const view of ['folded', 'compact', 'widget']) {
      const out = html(h(() => answer[view](props(fixture))))
      assert.equal(stages(out), 0, `${fixture}, ${view}: no live face`)
    }
  }
  assert.match(html(h(() => answer.compact(props('Answered, waiting')))), /<g transform="translate\(7 5\)" opacity="1"><svg class="pface" width="26"/, 'compact: the 26 px mask')
  assert.match(html(h(() => answer.full(props('Answered, waiting', {frame: 'pane'})))), /<svg class="an-face" width="18" height="18"/, 'each row: the 18 px avatar')
})

test('while the owner reports the agent reading or answering, the head\'s light carries its ring; idle or unbound, none', () => {
  const ring = out => /class="dp-activator" data-light="lit" data-busy="true"/.test(out)
  assert.equal(ring(html(h(() => answer.whole(props('Answering'))))), true, 'answering')
  assert.equal(ring(html(h(() => answer.compact(props('Answering'))))), true, 'answering, on the chain')
  assert.equal(ring(html(h(() => answer.whole(props('Answered, waiting', {v: {...valuesOf('Answered, waiting'), state: 'reading'}}))))), true, 'reading')
  assert.equal(ring(html(h(() => answer.whole(props('Answered, waiting'))))), false, 'idle')
  assert.doesNotMatch(html(h(() => answer.whole(props('Not bound', {v: {...valuesOf('Not bound'), state: 'answering'}})))), /data-busy/, 'not bound: no ring')
})

// ── the vendored face ─────────────────────────────────────────────────────

test('the vendored face matches its REVISION.json and its own build: no file edited by hand', () => {
  assert.deepEqual(sync.driftOf(), [], 'run node scripts/sync-face.mjs and commit public/face')
  const revision = JSON.parse(vendored('REVISION.json'))
  assert.equal(revision.source, 'EpiLogos/face-rig')
  assert.match(revision.commit, /^[0-9a-f]{40}$/, 'the rig commit the face comes from')
  assert.equal(typeof revision.dirty, 'boolean')
  assert.match(revision.date, /^\d{4}-\d\d-\d\dT/)
  const page = vendored('face.html')
  assert.doesNotMatch(page.replace(/<!--[\s\S]*?-->/g, ''), /<style\b|<script>/, 'no inline style or script: the candidate\'s webview would nonce them')
  assert.match(page, /<script src="face-core.js"><\/script>\n<script src="face-speech.js"><\/script>\n<script src="face-embed.js"><\/script>/)
  assert.doesNotMatch(vendored('face-embed.js'), /localStorage/, 'the shell remembers no rig setting')
})

test('the drift check catches a hand edit, a stray file and a page that no longer comes from facerig2.html', () => {
  const dir = mkdtempSync(join(tmpdir(), 'face-drift-'))
  try {
    cpSync(new URL('../public/face', import.meta.url), dir, {recursive: true})
    assert.deepEqual(sync.driftOf(dir), [])
    writeFileSync(join(dir, 'face-core.js'), `${readFileSync(join(dir, 'face-core.js'), 'utf8')}\n// a hand edit\n`)
    assert.match(sync.driftOf(dir).join('\n'), /face-core.js differs from REVISION.json/)
    cpSync(new URL('../public/face/face-core.js', import.meta.url), join(dir, 'face-core.js'))
    writeFileSync(join(dir, 'notes.txt'), 'stray')
    assert.match(sync.driftOf(dir).join('\n'), /notes.txt is not the sync's/)
    rmSync(join(dir, 'notes.txt'))
    writeFileSync(join(dir, 'face.html'), readFileSync(join(dir, 'face.html'), 'utf8').replace('face-embed.js', 'face-other.js'))
    const found = sync.driftOf(dir).join('\n')
    assert.match(found, /face.html differs from REVISION.json/)
    assert.match(found, /face.html is not what the sync builds from facerig2.html/)
  } finally {
    rmSync(dir, {recursive: true, force: true})
  }
  assert.throws(() => sync.buildEmbed('<!DOCTYPE html>\n<style>a{}</style><script>alert(1)</script>'), /scripts changed/, 'a page of another shape is refused')
})
