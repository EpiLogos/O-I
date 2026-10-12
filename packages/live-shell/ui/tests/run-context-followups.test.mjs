import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// P0-R5b (a) and (d): the run-context reading follows configuration refreshes,
// and an unreadable configuration names itself rather than "not yet read".
// The readings are exercised through the real readShellConfig with fetch
// stubbed (the development path reads /api/config). Production sources in
// memory, same loader pattern as the sibling run-context suite.
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

const {readShellConfig, subscribeShellConfig} = await import('../src/native/application.ts')
const {carrierForRead, carrierOf} = await import('../src/shell/runContext.tsx')

const settle = () => new Promise(resolve => setTimeout(resolve, 0))

// A fetch stub whose answers the test controls, in call order.
const pending = []
globalThis.fetch = () => new Promise(resolve => pending.push(resolve))
const answer = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'content-type': 'application/json'}})

// ————————————————————————————————————————————————————————————————————————
// (a) The configuration readings are announced, so the reading can follow a refresh.

test('a fresh settled reading is announced to subscribers, a cached read is not, and a refresh is', async () => {
  const seen = []
  const off = subscribeShellConfig(outcome => seen.push(outcome))
  const first = readShellConfig()
  pending.shift()(answer({default_set: 'central', kernel_bridge: 'http://127.0.0.1:4179'}))
  assert.equal((await first).default_set, 'central')
  assert.equal(seen.length, 1, 'the first settled reading is announced')
  assert.equal(seen[0].error, null)
  assert.equal(seen[0].config.default_set, 'central')

  const cached = readShellConfig()
  assert.equal(pending.length, 0, 'a cached read makes no new host call')
  await cached
  assert.equal(seen.length, 1, 'a cached read announces nothing')

  const refreshed = readShellConfig(true)
  pending.shift()(answer({default_set: 'central', kernel_bridge: 'http://127.0.0.1:4179', source_dirty: true}))
  assert.equal((await refreshed).source_dirty, true)
  assert.equal(seen.length, 2, 'a refresh announces its settled reading')
  assert.equal(seen[1].config.source_dirty, true, 'the subscriber receives the refreshed value, not the old one')
  off()
})

test('a failed refresh is announced as a named failure, so the reading says the configuration was not read', async () => {
  const seen = []
  const off = subscribeShellConfig(outcome => seen.push(outcome))
  const failed = readShellConfig(true).catch(cause => cause)
  pending.shift()(answer({error: 'The owner configuration refused the read'}, 500))
  const cause = await failed
  assert.match(cause.message, /owner configuration refused the read/)
  await settle()
  assert.equal(seen.length, 1)
  assert.equal(seen[0].config, null)
  assert.equal(seen[0].error, 'The owner configuration refused the read')
  off()
})

test('after unsubscribe, a refresh announces nothing to the old listener', async () => {
  const seen = []
  const off = subscribeShellConfig(outcome => seen.push(outcome))
  off()
  const refreshed = readShellConfig(true)
  pending.shift()(answer({default_set: 'central'}))
  await refreshed
  assert.equal(seen.length, 0)
})

test('a superseded request is not announced; the request that superseded it is', async () => {
  const seen = []
  const off = subscribeShellConfig(outcome => seen.push(outcome))
  const older = readShellConfig(true).catch(cause => cause)
  const newer = readShellConfig(true)
  // The newer request settles first; the older one settles later and is superseded.
  pending[1](answer({default_set: 'newer'}))
  await newer
  pending[0](answer({default_set: 'older'}))
  const superseded = await older
  assert.match(String(superseded.message ?? superseded), /superseded/)
  await settle()
  assert.equal(seen.length, 1, 'only the current request is announced')
  assert.equal(seen[0].config.default_set, 'newer', 'the superseded older reading never overwrites the newer one')
  off()
})

// ————————————————————————————————————————————————————————————————————————
// (d) An unreadable configuration names its failure in the carrier field.

test('the carrier reads "configuration not read" when the read failed, and "not yet read" before it settles', () => {
  assert.equal(carrierForRead({config: null, error: 'Owner read failed (500)'}), 'configuration not read',
    'the failed read is not described as a read still in progress')
  assert.equal(carrierForRead({config: null, error: null}), 'not yet read', 'before the read settles it is pending')
})

test('once read, the carrier is the existing reader\'s label for the transport the configuration names', () => {
  const dev = carrierForRead({config: {default_set: 'central', kernel_bridge: 'http://127.0.0.1:4179'}, error: null})
  assert.equal(dev, 'Development native bridge')
  assert.equal(dev, carrierOf({kind: 'bridge', url: 'http://127.0.0.1:4179'}), 'one carrier reader, not a second wording')
  assert.equal(carrierForRead({config: {default_set: 'central'}, error: null}),
    'The development shell has no configured native owner bridge', 'a configuration with no bridge names its absence')
})
