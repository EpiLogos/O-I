import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// O-I #747 round 896, item 0.7 (DLW build ruling 2026-11-09): "In one run of four, the field's audio was closed after the return from Live
// while the Sound read On. Find why… Then either reopen it on the return, or have the Sound say it is closed, with one press to open it."
// The frame's half is desktop/cradle/tests/field-sound-closed-896.test.mjs (why the field is not heard, in words, and the `sound` stage
// command's `open` press). Here the shell's: the announcement carries the words (`soundClosed`), the Field reads them and draws them on its
// Sound, where one press, Open sound, asks the frame to open it (frameSound.ts openFieldSound); while the field is heard there is nothing to
// press. SCRIPTED: pure modules, the frame link's runner and the Field's design rendered to markup; no frame.
const root = new URL('../../../../', import.meta.url)
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
const parameters = new URL('packages/expressions-boundary/src/parameters.ts', root).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(s,c,n){if(s==='@epilogos/expressions-boundary/parameters')return n(${JSON.stringify(parameters)},c);try{return await n(s,c)}catch(e){if(!s.startsWith('.'))throw e;if(s.endsWith('.js')){try{return await n(s.slice(0,-3)+'.ts',c)}catch{}}for(const x of ['.ts','.tsx']){try{return await n(s+x,c)}catch{}}throw e}}export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};if(u.endsWith('?raw'))return {format:'module',shortCircuit:true,source:'export default '+JSON.stringify(await readFile(new URL(u.split('?')[0]),'utf8'))};if(!u.endsWith('.ts')&&!u.endsWith('.tsx'))return n(u,c);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(u),'utf8'),{fileName:new URL(u).pathname,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText}}`)}`, import.meta.url)
globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const [protocol, field, frameSound, {design}, model] = await Promise.all([
  import('../../../expressions-boundary/src/protocol.ts'),
  import('../src/components/devices/fieldInstrument.ts'),
  import('../src/native/frameSound.ts'),
  import('../src/inhabitants/catalogue/panels/expressions__field.tsx'),
  import('../../../../desktop/cradle/expressions-app/field-studies-journeys/src/model.ts'),
])
const CLOSED = 'The field\'s sound is closed: native acknowledgement timed out.'
const announced = extra => protocol.readHostedState({hostMode: 'expressions', sceneIndex: 0, sceneCount: 1, soundMuted: false, ...extra})

test('the announcement carries why the field\'s sound stands closed, in the frame\'s words, and refuses anything but bounded text', () => {
  assert.equal(announced({soundClosed: CLOSED})?.soundClosed, CLOSED)
  assert.equal(announced({})?.soundClosed, undefined, 'absent while the field is heard')
  assert.equal(announced({soundClosed: true}), null)
  assert.equal(announced({soundClosed: 'x'.repeat(4097)}), null)
})

const reading = () => ({scene: model.blankJourney().scenes[0]})
const input = sound => ({reading: reading(), devices: {}, sound, apply: async () => ({ok: true})})

test('the Field reads the closed sound and one press, Open sound, asks the frame to open it; heard, there is nothing to press', async () => {
  const opened = []
  const closed = input({muted: false, mute: async () => ({ok: true}), closed: CLOSED, open: async () => { opened.push(true); return {ok: true} }})
  const binding = field.fieldBinding(closed)
  assert.equal(binding.values.sound, true, 'the Sound stays the person\'s: On')
  assert.equal(binding.values.soundClosed, CLOSED)
  assert.equal(binding.standing.soundOpen, undefined, 'the press is open')
  await binding.write([{key: 'soundOpen', value: true}])
  assert.deepEqual(opened, [true])
  const heard = field.fieldBinding(input({muted: false, mute: async () => ({ok: true})}))
  assert.equal(heard.values.soundClosed, undefined)
  assert.equal(heard.standing.soundOpen?.disabled, 'The field\'s sound is open.')
  await assert.rejects(heard.write([{key: 'soundOpen', value: true}]), /The field's sound is open\./)
  const refused = field.fieldBinding(input({muted: false, mute: async () => ({ok: true}), closed: CLOSED, open: async () => ({ok: false, error: 'No field stands in this frame to open.'})}))
  await assert.rejects(refused.write([{key: 'soundOpen', value: true}]), /No field stands in this frame to open\./)
})

test('the press is the frame\'s sound command with open, sent on the link\'s runner', async () => {
  const sent = []
  const link = {run: async command => { sent.push(command); return {ok: true} }, state: {nativeScene: {expression_ref: 'expression:e'}}}
  assert.deepEqual(await frameSound.openFieldSound(link), {ok: true})
  assert.deepEqual(sent, [{command: 'sound', open: true}])
  assert.equal((await frameSound.openFieldSound({run: null, state: null})).ok, false, 'no frame: refused in words')
})

test('the Field\'s Sound says it is closed, with Open sound beside it; heard, neither stands', () => {
  const nav = {select() {}, expand() {}, full() {}, popout() {}, fold() {}, unfold() {}, rail() {}, close() {}}
  const draw = v => renderToStaticMarkup(createElement(() => design.whole({v, set() {}, nav, page: '', setPage() {}, standing: {}, owner: design.defaults, frame: 'pane'})))
  const closedMarkup = draw({...design.defaults, soundClosed: CLOSED})
  const sound = closedMarkup.slice(closedMarkup.indexOf('>Sound<'), closedMarkup.indexOf('>Time<'))
  assert.match(sound, /data-i="Sound\|On — [^"]*The field&#x27;s sound is closed: native acknowledgement timed out\./, 'the Sound says it')
  assert.match(sound, /<button[^>]*class="dp-action"[^>]*>Open sound<\/button>/, 'one press to open it, in the Sound section')
  const heardMarkup = draw(design.defaults)
  assert.doesNotMatch(heardMarkup, /Open sound|sound is closed/)
})
