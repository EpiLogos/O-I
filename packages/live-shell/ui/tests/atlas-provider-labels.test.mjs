// The atlas names no corpus in code (O-I #755, C2-b8): every line a person reads that named the founding author reads
// the provider's words (FieldMeta.provider.labels) through the port's data/labels.ts, carried verbatim from
// Archetypal-Earth, and mount.ts binds them from the provider's field. Scripted over the recorded 14 Oct suite reading.
//   - no string or template literal in the port's src names Jung (comments and data-shape ids such as 'jung' are not copy);
//   - over the suite's own field the surfaces read its words where it gives them and the neutral voice elsewhere;
//   - unbound, every surface is neutral; mount binds the field's labels before anything is drawn (structural).
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile, readdir} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {register} from 'node:module'

const compiler = new URL('../node_modules/typescript/lib/typescript.js', import.meta.url).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(s, c, n) {
  try { return await n(s, c) } catch (e) {
    if (!s.startsWith('.')) throw e;
    if (s.endsWith('.js')) { try { return await n(s.slice(0, -3) + '.ts', c) } catch {} }
    for (const x of ['.ts', '.tsx']) { try { return await n(s + x, c) } catch {} }
    throw e;
  }
}
export async function load(u, c, n) {
  if (u.endsWith('.css')) return {format: 'module', shortCircuit: true, source: 'export {}'};
  if (!u.endsWith('.ts') && !u.endsWith('.tsx')) return n(u, c);
  const source = (await readFile(new URL(u), 'utf8')).split('import.meta.env').join('({BASE_URL: "/"})');
  return {format: 'module', shortCircuit: true, source: ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX}, fileName: new URL(u).pathname}).outputText};
}`)}`, import.meta.url)

const ts = createRequire(import.meta.url)(new URL(compiler).pathname)
const atlas = new URL('../src/projections/atlas/', import.meta.url)
const SRC = new URL('src/', atlas)
const {NEUTRAL_LABELS, providerLabels, setProviderLabels} = await import(new URL('src/data/labels.ts', atlas))
const {landingCopy} = await import(new URL('src/shell/landing.ts', atlas))
const {lensDef} = await import(new URL('src/shell/lens.ts', atlas))
const {DEFAULT_TIE_BASES} = await import(new URL('src/types/field.ts', atlas))
const {citeLine} = await import(new URL('src/ui/format.ts', atlas))
const {SYSTEM_LABEL} = await import(new URL('src/ui/related.ts', atlas))
const {composeSuite, inputOfReading} = await import(new URL('provider/suiteReading.ts', atlas))
const {declarationsFromWiki} = await import(new URL('provider/suiteProvider.ts', atlas))

const fixture = JSON.parse(await readFile(new URL('fixtures/atlas-suite-reading.json', import.meta.url), 'utf8'))
const suiteField = () => {
  const inputs = Object.fromEntries(['central_wiki', 'shared_field', 'aikit_resolution'].map(name => [name, inputOfReading(name, JSON.parse(JSON.stringify(fixture.graph[name])))]))
  const basis = {path: fixture.wikiFile.path, revision: fixture.wikiFile.revision, location: {schema: 'central.path-ref/v1', ref: 'ref:Control/agents/wiki/wiki.json', root: 'Control', path: fixture.wikiFile.path}}
  return composeSuite({inputs, declarations: declarationsFromWiki(JSON.stringify({objects: fixture.wikiFile.objects}), basis), readAt: new Date('2026-10-14T15:17:18.000Z')}).field
}

async function sources(dir) {
  const out = []
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir)
    if (entry.isDirectory()) out.push(...await sources(url))
    else if (/\.tsx?$/.test(entry.name)) out.push(url)
  }
  return out
}

const surfaces = () => [landingCopy(), lensDef('aion').blurb, lensDef('astrology').blurb, DEFAULT_TIE_BASES[0].label, SYSTEM_LABEL.jung, ...Object.values(providerLabels())]

test('no string in the atlas port names the founding author: those words are the provider’s', async () => {
  const found = []
  for (const url of await sources(SRC)) {
    const file = ts.createSourceFile(url.pathname, await readFile(url, 'utf8'), ts.ScriptTarget.Latest, true)
    const visit = node => {
      if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) && /Jung/.test(node.text)) {
        found.push(`${url.pathname.slice(SRC.pathname.length)}:${file.getLineAndCharacterOfPosition(node.getStart()).line + 1} ${node.text.slice(0, 60)}`)
      }
      ts.forEachChild(node, visit)
    }
    visit(file)
  }
  assert.deepEqual(found, [])
})

test('over your own field the atlas reads its owners’ words where they give them, and the neutral voice elsewhere', () => {
  const field = suiteField()
  setProviderLabels(field.meta.provider.labels)
  try {
    assert.equal(providerLabels().citesHeading, field.meta.provider.labels.citesHeading, 'the suite’s own word stands')
    assert.equal(providerLabels().lensAion, NEUTRAL_LABELS.lensAion, 'a word it does not give is the neutral one')
    assert.equal(citeLine({work: 'w', workTitle: 'A page', year: '2026', locator: 'p. 1'}), `${field.meta.provider.labels.citePrefix} · A page · 2026 · p. 1`)
    for (const line of surfaces()) assert.doesNotMatch(line, /Jung/)
  } finally {
    setProviderLabels(null)
  }
})

test('with no provider words every surface is neutral', () => {
  setProviderLabels(null)
  assert.deepEqual(providerLabels(), NEUTRAL_LABELS)
  for (const line of surfaces()) assert.doesNotMatch(line, /Jung/)
  assert.equal(citeLine({work: 'w', workTitle: 'A page', year: '2026', locator: 'p. 1'}), 'A page · 2026 · p. 1')
})

test('mount binds the field’s labels before the controller draws, and unbinds them on release (structural)', async () => {
  const mount = await readFile(new URL('mount.ts', atlas), 'utf8')
  const bind = mount.indexOf('setProviderLabels(field.meta.provider.labels)')
  assert.ok(bind > 0, 'mount.ts binds the provider’s labels from the field')
  assert.ok(bind < mount.indexOf('new Controller('), 'before the controller is built')
  assert.equal(mount.split('setProviderLabels(null)').length - 1, 2, 'released on dispose and on a failed mount')
})

// Carried from #755 to #762: the Technē devices outside the port named the founding corpus in their own copy (the World design's
// graph legend and its first Ties flag, the Project plate's relation keys, the declared ties row). Each reads the provider's word for
// its first basis (data/labels.ts basisOwn, bound by mount.ts from field.meta.provider.labels), never a name of its own.
const DEVICES = ['inhabitants/catalogue/panels/atlas-earth__globe-engine.tsx', 'inhabitants/ql/devices/ProjectPlate.tsx', 'inhabitants/agentNativeP0.ts']
  .map(path => new URL(`../src/${path}`, import.meta.url))

test('no Technē device outside the port names the founding author in its copy', async () => {
  const found = []
  for (const url of DEVICES) {
    const file = ts.createSourceFile(url.pathname, await readFile(url, 'utf8'), ts.ScriptTarget.Latest, true)
    const visit = node => {
      const text = ts.isJsxText(node) ? node.getText() : (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) ? node.text : null
      // a value key (`tieJung`) is a data-shape id, not copy: only words a person reads count
      if (text !== null && /Jung/.test(text) && !/^[a-z][A-Za-z]*$/.test(text)) found.push(`${url.pathname.split('/src/')[1]}:${file.getLineAndCharacterOfPosition(node.getStart()).line + 1} ${text.trim().slice(0, 60)}`)
      ts.forEachChild(node, visit)
    }
    visit(file)
  }
  assert.deepEqual(found, [])
})

test('the World design, the Project plate and the declared ties row read the provider’s word for the first basis', async () => {
  const {createElement} = await import('react')
  const {renderToStaticMarkup} = await import('react-dom/server')
  const {design} = await import('../src/inhabitants/catalogue/panels/atlas-earth__globe-engine.tsx')
  const door = await import('../src/inhabitants/familyManifest.ts')
  const {loadAgentShellFamilies} = await import('../src/inhabitants/loadAgentShellFamilies.ts')
  const {adoptVerifiedRows} = await import('../src/inhabitants/sdk/adoptVerifiedRows.ts')
  const {loadAgentNativeP0} = await import('../src/inhabitants/agentNativeP0.ts')
  const {sdkParamRows} = await import('../src/inhabitants/sdk/define.ts')
  door.resetFamilyManifestsForTest()
  loadAgentShellFamilies()
  adoptVerifiedRows()
  loadAgentNativeP0()
  const graph = () => renderToStaticMarkup(design.whole({v: design.defaults, set() {}, nav: {}, page: 'graph', setPage() {}}))
  const full = () => renderToStaticMarkup(design.full({v: {...design.defaults, view: 'graph'}, set() {}, nav: {}, page: 'space', setPage() {}}))
  const tiesRow = () => sdkParamRows('atlas-earth').find(row => row.deviceInstance === 'graph-tools' && row.key === 'ties').disclosure
  setProviderLabels({basisOwn: 'The Founder'})
  try {
    assert.match(graph(), />The Founder</, 'the first Ties flag is the provider’s word')
    assert.match(full(), /Ties: The Founder solid/, 'the graph legend names the first basis by the provider’s word')
    assert.match(tiesRow(), /The Founder, Inferred, Site/, 'the declared ties row names the bases as the provider does')
  } finally {
    setProviderLabels(null)
  }
  assert.match(graph(), new RegExp(`>${NEUTRAL_LABELS.basisOwn}<`), 'unbound, the neutral word')
  assert.match(full(), new RegExp(`Ties: ${NEUTRAL_LABELS.basisOwn} solid`))
  const plate = await readFile(DEVICES[1], 'utf8')
  assert.match(plate, /DEFAULT_TIE_BASES/, 'the Project plate’s relation keys fall back to the port’s own bases, whose first is the provider’s word')
})
