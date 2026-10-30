import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// P0-R5 (A) and (B): the run-context reading and the owner-refusal disclosure.
// The reading is a pure function of what the host disclosed; the components
// render with renderToStaticMarkup (effects do not run, so the first paint is
// the honest pending state). Production sources in memory, same loader pattern
// as the sibling suites: .ts/.tsx transpiled, .css stubbed.
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

const {renderToStaticMarkup} = await import('react-dom/server')
const React = await import('react')
const {runContextOf, carrierOf, RunContextReading} = await import('../src/shell/runContext.tsx')
const {OwnerRefusal} = await import('../src/components/OwnerRefusal.tsx')
// Settings' Products page is the catalogue design's now (settings:window); its operations' words are windowPages.ts's (ported unchanged).
const {outputWords} = await import('../src/settings/windowPages.ts')
const {StatusBar} = await import('../src/components/StatusBar.tsx')

const htmlOf = element => renderToStaticMarkup(element)
const COMMIT = '0123456789abcdef0123456789abcdef01234567'
const TREE = 'f'.repeat(64)
const NATIVE_CARRIER = 'Native owner configuration'
const DEV_CARRIER = 'Development native bridge'

// ————————————————————————————————————————————————————————————————————————
// (A) The run-context reading: what the host supplies, and nothing more.

test('a native host states its disclosed revision in the reading, shortened, and never invents one', () => {
  const reading = runContextOf({native: true, config: {source_revision: COMMIT, source_tree_sha256: TREE, source_dirty: false}, error: null, carrier: NATIVE_CARRIER})
  assert.equal(reading.kind, 'native')
  assert.equal(reading.revision, COMMIT)
  assert.equal(reading.tree, TREE)
  assert.equal(reading.dirty, false)
  assert.equal(reading.label, 'Native host · revision 0123456789ab')
  assert.match(reading.line, new RegExp(`Revision ${COMMIT}\\.`), 'the full commit stays in the sentence for the title')
  assert.match(reading.line, /The tree was clean\./)
  assert.match(reading.line, new RegExp(`Carrier: ${NATIVE_CARRIER}\\.`))
})

test('a native host that built from uncommitted changes says so in the status label, not only in the title', () => {
  const reading = runContextOf({native: true, config: {source_revision: COMMIT, source_tree_sha256: TREE, source_dirty: true}, error: null, carrier: NATIVE_CARRIER})
  assert.equal(reading.dirty, true)
  assert.equal(reading.label, 'Native host · revision 0123456789ab · uncommitted changes')
  assert.match(reading.line, /The tree carried uncommitted changes\./)
})

test('a malformed or missing revision is stated as absent, never as a guessed value', () => {
  const bad = runContextOf({native: true, config: {source_revision: 'main', source_dirty: true}, error: null, carrier: NATIVE_CARRIER})
  assert.equal(bad.revision, null, 'a branch name is not a qualified commit')
  assert.equal(bad.label, 'Native host · no revision disclosed · uncommitted changes')
  const absent = runContextOf({native: true, config: {}, error: null, carrier: NATIVE_CARRIER})
  assert.equal(absent.revision, null)
  assert.equal(absent.dirty, null, 'an undisclosed dirty flag stays undisclosed')
  assert.equal(absent.label, 'Native host · no revision disclosed')
  assert.doesNotMatch(absent.label, /[0-9a-f]{12}/, 'no hex is invented into the label')
})

test('the development browser states no revision until its owner configuration discloses one', () => {
  const undisclosed = runContextOf({native: false, config: {}, error: null, carrier: DEV_CARRIER})
  assert.equal(undisclosed.kind, 'development')
  assert.equal(undisclosed.label, 'Development browser · no revision disclosed')
  assert.equal(undisclosed.revision, null)
  const disclosed = runContextOf({native: false, config: {source_revision: COMMIT}, error: null, carrier: DEV_CARRIER})
  assert.equal(disclosed.label, 'Development browser · revision 0123456789ab', 'a disclosed revision is read, not hard-coded away')
})

test('before the configuration is read the reading is pending, and says it is reading', () => {
  const reading = runContextOf({native: true, config: null, error: null, carrier: 'not yet read'})
  assert.equal(reading.kind, 'pending')
  assert.equal(reading.label, 'Reading run context')
  assert.equal(reading.revision, null)
})

test('an unreadable configuration names the failure and states no revision', () => {
  const native = runContextOf({native: true, config: null, error: 'The installed host did not qualify its runtime access', carrier: 'not yet read'})
  assert.equal(native.kind, 'native')
  assert.equal(native.label, 'Native host · configuration not disclosed')
  assert.match(native.line, /did not qualify its runtime access/)
  assert.match(native.line, /No revision is stated\./)
  const dev = runContextOf({native: false, config: null, error: 'Owner read failed (500)', carrier: 'not yet read'})
  assert.equal(dev.label, 'Development browser · configuration not disclosed')
})

test('the carrier is named in the existing readers\' own words (configuration.ts adapter labels)', () => {
  assert.equal(carrierOf({kind: 'tauri'}), NATIVE_CARRIER)
  assert.equal(carrierOf({kind: 'bridge', url: 'http://127.0.0.1:4179'}), DEV_CARRIER)
  assert.equal(carrierOf({kind: 'unavailable', reason: 'The development shell has no configured native owner bridge'}), 'The development shell has no configured native owner bridge')
})

test('the status-region reading renders in the frame as a named run-context region', () => {
  const html = htmlOf(React.createElement(RunContextReading))
  assert.match(html, /data-region="run-context"/)
  assert.match(html, /data-run-context="pending"/, 'the first paint is the honest pending reading, never a claimed world')
  assert.match(html, /Reading run context/)
})

test('the status bar carries the run-context region in the live mode it always mounts', () => {
  const state = {set: null, path: null, error: null, loading: false, tracks: [], scene_count: 0, arrangement_clips: 0}
  const html = htmlOf(React.createElement(StatusBar, {state, documentError: null, viewport: [1920, 1200], audio: true, mode: 'live', reading: null, detailMode: 'clip', changeDetailMode: () => {}, presentedView: 'session'}))
  assert.match(html, /data-region="status-bar"/)
  assert.match(html, /data-region="run-context"/, 'the run context is in the status region, not a separate surface')
})

test('the status bar carries the run context in a base-mode centre too', () => {
  const state = {set: null, path: null, error: null, loading: false, tracks: [], scene_count: 0, arrangement_clips: 0}
  const html = htmlOf(React.createElement(StatusBar, {state, documentError: null, viewport: [1920, 1200], audio: false, mode: 'base', reading: null, detailMode: 'clip', changeDetailMode: () => {}, presentedView: 'session'}))
  assert.match(html, /data-region="run-context"/, 'every mode, not only Live')
})

// ————————————————————————————————————————————————————————————————————————
// (B) The owner-refusal disclosure: the owner's words, never a JSON dump.

test('an owner refusal shows the owner, the operation and the owner\'s message, never the raw JSON', () => {
  const error = '{"kind":"refused","message":"Scene is locked by another writer","receipt":{"x":1}}'
  const html = htmlOf(React.createElement(OwnerRefusal, {owner: 'Native expression owner', operation: 'Perform', error, fallback: 'The native owner refused this operation.', copy: 'copy-7', dataI: 'material-refusal'}))
  assert.match(html, /role="alert"/)
  assert.match(html, /data-owner-refusal="Native expression owner"/)
  assert.match(html, /<span class="line">Scene is locked by another writer\.<\/span>/, 'the owner\'s plain words, read by the product\'s one refusal reader (shared/Refusal.tsx plainReason)')
  assert.match(html, /Perform/)
  assert.match(html, /Retained copy <code>copy-7<\/code>/)
  assert.doesNotMatch(html, /"kind"|"receipt"|&quot;kind&quot;/, 'the raw refusal JSON is not rendered')
  assert.doesNotMatch(html, /<pre/, 'a refusal renders no preformatted dump at all')
})

test('an owner refusal that is not plain words shows its known cause in plain words, never the path, the prefix or the type', () => {
  const error = 'Error: Central owner Action refused: AgentProfile source not found: /Users/admin/Central/Work/O-I/ProjectCentral/agents/profiles/profile-bbf99f6f2ff90b4c.json'
  const html = htmlOf(React.createElement(OwnerRefusal, {owner: 'Central', operation: 'Read the agent', error, fallback: 'The owner refused this reading.'}))
  assert.match(html, /<span class="line">It was not found\.<\/span>/)
  assert.doesNotMatch(html, /Error:|\/Users\/|AgentProfile|\.json/, 'nothing raw in the line')
  const code = htmlOf(React.createElement(OwnerRefusal, {owner: 'Central', operation: 'Read', error: 'refused: {"code":"stale_basis","revision":12}', fallback: 'The owner refused this reading.'}))
  assert.match(code, /<span class="line">The owner refused this reading\.<\/span>/, 'a code and a dump leave only the place\'s fallback')
})

test('a refusal with no words falls back to the named fallback, and states no remedy the owner did not name', () => {
  const html = htmlOf(React.createElement(OwnerRefusal, {owner: 'Installed products', operation: 'Repair', error: null, fallback: 'The native owner did not acknowledge this operation.'}))
  assert.match(html, /The native owner did not acknowledge this operation\./)
  assert.doesNotMatch(html, /Remedy/, 'no remedy is invented')
  const named = htmlOf(React.createElement(OwnerRefusal, {owner: 'Installed products', operation: 'Repair', error: 'Refused', fallback: 'x', remedy: 'Run the owner check'}))
  assert.match(named, /Remedy: Run the owner check/, 'a remedy the owner names is stated')
})

test('a refusal carries no copy line when the owner kept none', () => {
  const html = htmlOf(React.createElement(OwnerRefusal, {owner: 'Native expression owner', operation: 'Play passages', error: 'Refused', fallback: 'x', copy: null}))
  assert.doesNotMatch(html, /Retained copy/)
})

test('a product operation\'s owner words are read from a string or a message, and nothing else is shown as words', () => {
  assert.equal(outputWords('the owner said no'), 'the owner said no')
  assert.equal(outputWords({message: 'Gateway not attached'}), 'Gateway not attached')
  assert.equal(outputWords({code: 7}), null, 'a structure without words yields none, so the fallback speaks')
  assert.equal(outputWords(undefined), null)
})
