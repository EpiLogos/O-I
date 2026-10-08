import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFile} from 'node:fs/promises'

// Transpile actual owner modules in memory; the compiled registry's lazy
// bodies are never substituted with test providers or runtime claims.
const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`import ts from ${JSON.stringify(compiler)};import {readFile} from 'node:fs/promises';export async function resolve(specifier,context,next){try{return await next(specifier,context)}catch(error){if(!specifier.startsWith('.'))throw error;for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}throw error}}export async function load(url,context,next){if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText}}`)}`, import.meta.url)
const {admitContribution, contributionUnavailable} = await import('../src/native/contributions.ts')
const {registeredHostedSurfaces} = await import('../../../../desktop/cradle/src/contributions/generated.ts')
const {nativeDetachedBodySupported} = await import('../src/native/detachedKinds.ts')
const bindingFor = descriptor => ({id: descriptor.descriptor_ref, kind: descriptor.kind, title: descriptor.title, hosted: {descriptor_ref: descriptor.descriptor_ref, contribution_ref: descriptor.contribution_ref}})

test('actual compiled contribution identities require a disclosed selected backing', () => {
  assert.ok(registeredHostedSurfaces.length)
  for (const {descriptor} of registeredHostedSurfaces) {
    const binding = bindingFor(descriptor), before = JSON.stringify(binding)
    assert.throws(() => admitContribution(binding, undefined), /backing reading is unavailable/)
    const products = [...new Set(['oi', descriptor.owner, ...(descriptor.kind === 'epi-logos' ? ['quaternal-logic'] : [])])]
    assert.equal(contributionUnavailable(binding, products), undefined)
    admitContribution(binding, products)
    assert.equal(JSON.stringify(binding), before)
    assert.throws(() => admitContribution({...binding, hosted: {...binding.hosted, descriptor_ref: `${binding.hosted.descriptor_ref}/absent`}}, products), /saved contribution is unavailable/)
  }
})

test('actual product contributions and Epi-Logos refuse excluded native owners', () => {
  let checked = 0
  for (const {descriptor} of registeredHostedSurfaces) {
    if (descriptor.owner !== 'oi') {assert.throws(() => admitContribution(bindingFor(descriptor), ['oi']), /excluded from this backing/); checked++}
    if (descriptor.kind === 'epi-logos') {assert.throws(() => admitContribution(bindingFor(descriptor), ['oi']), /Quaternal Logic owner is excluded/); checked++}
  }
  assert.ok(checked >= 3)
})

test('compiled identities reject failed, excluded, absent and foreign native admission data', () => {
  // Exercise the production admission function against the actual descriptor
  // identities. These are bounded policy inputs, not a claim of native
  // registration or live provider availability; the owner compiler/registration
  // and installed window acceptance remain separate native replays.
  for (const {descriptor} of registeredHostedSurfaces) {
    const binding = bindingFor(descriptor)
    const products = [...new Set(['oi', descriptor.owner, ...(descriptor.kind === 'epi-logos' ? ['quaternal-logic'] : [])])]
    const reading = {contribution_ref: descriptor.contribution_ref, owner: descriptor.owner, revision: descriptor.revision, compiled: true, owner_selected: true, registration: 'registered'}
    assert.equal(contributionUnavailable(binding, products, [reading]), undefined)
    assert.throws(() => admitContribution(binding, products, []), /no matching native contribution registration/)
    const failure = 'Native contribution registration returned a different identity'
    assert.throws(() => admitContribution(binding, products, [{...reading, registration: 'failed', failure}]), error => error.message === failure)
    for (const change of [{registration: 'excluded'}, {compiled: false}, {owner_selected: false}, {revision: descriptor.revision + 1}, {owner: `${descriptor.owner}/foreign`}, {contribution_ref: `${descriptor.contribution_ref}/foreign`}]) {
      assert.throws(() => admitContribution(binding, products, [{...reading, ...change}]), /no matching native contribution registration/)
    }
  }
})

test('candidate detached receiving accepts exactly the original native owner body contract', async () => {
  const nativeSource = await readFile(new URL('../../../../desktop/cradle/src-tauri/src/windows.rs', import.meta.url), 'utf8')
  const detach = nativeSource.slice(nativeSource.indexOf('pub fn window_detach('), nativeSource.indexOf('pub fn window_binding('))
  const admission = detach.match(/if\s*!\s*matches!\(\s*binding\.kind\.as_str\(\)\s*,([\s\S]*?)\)\s*\{/)
  assert.ok(admission, 'the actual native owner must expose its detached body admission')
  const nativeKinds = [...admission[1].matchAll(/"([^"]+)"/g)].map(match => match[1])
  assert.equal(nativeKinds.length, 7)
  for (const kind of nativeKinds) assert.equal(nativeDetachedBodySupported(kind), true, kind)
  for (const {descriptor} of registeredHostedSurfaces) assert.equal(nativeDetachedBodySupported(descriptor.kind), nativeKinds.includes(descriptor.kind), descriptor.kind)
  assert.equal(nativeDetachedBodySupported(''), false)
})
