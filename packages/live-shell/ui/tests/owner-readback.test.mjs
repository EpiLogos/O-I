import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {register} from 'node:module'

// P0-R6-ui: the owner readback. The admitted / excluded-by-footprint / failed /
// absent states are a pure function of live_shell_config (product_ids,
// contributions, suite_product_ids). The development browser states that it has
// no host readback. Production sources in memory, same loader pattern as the
// sibling suites: .ts/.tsx transpiled, .css stubbed.
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
const {ownerReadbackOf, OwnerReadback} = await import('../src/shell/ownerReadback.tsx')
const {RunContextReading} = await import('../src/shell/runContext.tsx')

const htmlOf = element => renderToStaticMarkup(element)
const byOwner = reading => Object.fromEntries(reading.rows.map(row => [row.owner, row]))

// The bundled 0/1/2 footprint: the host's universe is the full suite, the
// selected backing admits central, actuation and ai-kit, and the software
// factory contribution is compiled but excluded by the footprint.
const UNIVERSE = ['central', 'actuation', 'ai-kit', 'software-factory', 'workcell', 'quaternal-logic']
const footprint = {
  product_ids: ['central', 'actuation', 'ai-kit'],
  suite_product_ids: UNIVERSE,
  contributions: [
    {contribution_ref: 'oi.shell', owner: 'oi', revision: 1, compiled: true, owner_selected: true, registration: 'registered'},
    {contribution_ref: 'ai-kit.roster', owner: 'ai-kit', revision: 1, compiled: true, owner_selected: true, registration: 'registered'},
    {contribution_ref: 'factory.roster', owner: 'software-factory', revision: 1, compiled: true, owner_selected: false, registration: 'excluded'},
  ],
}

test('the footprint reading admits the selected backing, excludes the rest of the universe, and names no remedy', () => {
  const reading = ownerReadbackOf({native: true, config: footprint, error: null})
  assert.equal(reading.kind, 'native')
  const rows = byOwner(reading)
  assert.equal(rows.central.state, 'admitted')
  assert.equal(rows.actuation.state, 'admitted')
  assert.equal(rows['ai-kit'].state, 'admitted')
  assert.equal(rows['software-factory'].state, 'excluded-by-footprint')
  assert.equal(rows.workcell.state, 'excluded-by-footprint')
  assert.equal(rows['quaternal-logic'].state, 'excluded-by-footprint')
  assert.equal(rows.oi, undefined, 'the shell\'s own owner is not a suite product row')
  assert.deepEqual(reading.rows.map(row => row.owner), UNIVERSE, 'rows follow the host\'s universe order')
  assert.equal(reading.summary, '3 of 6 owners admitted')
  for (const row of reading.rows.filter(row => row.state !== 'admitted')) {
    assert.equal(row.remedy, 'no remedy named', `${row.owner} names its remedy as absent`)
    assert.match(row.line, /Remedy: no remedy named\./)
  }
  assert.equal(rows.central.remedy, null, 'an admitted owner carries no remedy line')
})

test('excluded by footprint reads differently from absent and from failed', () => {
  const rows = byOwner(ownerReadbackOf({native: true, config: footprint, error: null}))
  assert.equal(rows.workcell.label, 'excluded by footprint')
  assert.notEqual(rows.workcell.label, 'absent')
  assert.notEqual(rows.workcell.label, 'failed')
  assert.match(rows.workcell.line, /the footprint offers it, and the selected backing does not admit it/)
})

test('a failed registration is named as failed, with the host\'s own failure, even for an admitted owner', () => {
  const config = {...footprint, contributions: [
    ...footprint.contributions,
    {contribution_ref: 'ai-kit.roster', owner: 'ai-kit', revision: 1, compiled: true, owner_selected: true, registration: 'failed', failure: 'roster checksum mismatch'},
  ]}
  const rows = byOwner(ownerReadbackOf({native: true, config, error: null}))
  assert.equal(rows['ai-kit'].state, 'failed')
  assert.match(rows['ai-kit'].line, /the host's registration failed: roster checksum mismatch/)
  assert.equal(rows['ai-kit'].remedy, 'no remedy named')
  assert.equal(rows.central.state, 'admitted')
})

test('a product the footprint does not name is absent, and an uncompiled one says it is not compiled', () => {
  const config = {
    product_ids: ['central'],
    suite_product_ids: ['central'],
    contributions: [
      {contribution_ref: 'ghost.roster', owner: 'ghost', revision: 1, compiled: true, owner_selected: false, registration: 'excluded'},
      {contribution_ref: 'unbuilt.roster', owner: 'unbuilt', revision: 1, compiled: false, owner_selected: false, registration: 'excluded'},
    ],
  }
  const rows = byOwner(ownerReadbackOf({native: true, config, error: null}))
  assert.equal(rows.ghost.state, 'absent')
  assert.match(rows.ghost.line, /the footprint does not offer it/)
  assert.equal(rows.unbuilt.state, 'absent')
  assert.match(rows.unbuilt.line, /not compiled into this build/)
})

test('a host build that predates the universe field admits what it admits and says the universe is not disclosed', () => {
  const config = {product_ids: ['central', 'ai-kit'], contributions: footprint.contributions}
  const reading = ownerReadbackOf({native: true, config, error: null})
  const rows = byOwner(reading)
  assert.equal(rows.central.state, 'admitted')
  assert.equal(rows['ai-kit'].state, 'admitted')
  assert.equal(rows['software-factory'].state, 'undisclosed', 'an excluded product is not called excluded without the universe')
  assert.equal(rows.workcell, undefined, 'no product is invented without the host naming it')
  assert.match(reading.line, /did not disclose the suite product universe/)
})

test('the development browser states no host readback and never admits or excludes an owner from its own config', () => {
  const reading = ownerReadbackOf({native: false, config: footprint, error: null})
  assert.equal(reading.kind, 'development')
  assert.equal(reading.rows.length, 0, 'no owner row is fabricated')
  assert.equal(reading.summary, 'No host readback')
  assert.match(reading.line, /discloses no owner configuration/)
  const html = htmlOf(React.createElement(OwnerReadback, {native: false, config: footprint, error: null}))
  assert.match(html, /data-owner-readback="development"/)
  assert.doesNotMatch(html, /data-owner-state=/, 'no state chip is drawn on the development path')
})

test('before the host answers the reading is pending, and an unreadable host names its failure without a state', () => {
  assert.equal(ownerReadbackOf({native: true, config: null, error: null}).kind, 'pending')
  const unread = ownerReadbackOf({native: true, config: null, error: 'The installed host did not qualify its runtime access'})
  assert.equal(unread.kind, 'unread')
  assert.equal(unread.rows.length, 0)
  assert.match(unread.line, /did not qualify its runtime access/)
})

test('the readback renders one named state per owner in the status region', () => {
  const html = htmlOf(React.createElement(OwnerReadback, {native: true, config: footprint, error: null}))
  assert.match(html, /data-region="owner-readback"/)
  assert.match(html, /data-owner="workcell" data-owner-state="excluded-by-footprint"/)
  assert.match(html, /data-owner="central" data-owner-state="admitted"/)
  assert.match(html, /workcell · excluded by footprint/)
})

test('the run-context region mounts the owner readback beside it, in the same status region', () => {
  const html = htmlOf(React.createElement(RunContextReading))
  assert.match(html, /data-region="run-context"/)
  assert.match(html, /data-region="owner-readback"/)
  assert.match(html, /data-owner-readback="development"/, 'with no native host in the render, the first paint says there is no host readback')
  assert.match(html, /No host readback/)
})

test('the readback never hard-codes the product universe: the module names no suite product as a literal', async () => {
  const text = await readFile(new URL('../src/shell/ownerReadback.tsx', import.meta.url), 'utf8')
  for (const id of UNIVERSE) assert.doesNotMatch(text, new RegExp(`'${id}'`), `${id} is read from the host, not written in the shell`)
})
