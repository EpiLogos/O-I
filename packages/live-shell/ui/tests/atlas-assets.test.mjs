// T-ATLAS-ASSETS: the Earth is given (its base textures ship with the instrument), and a plate is owner material served by the
// host's material route. Scripted: (1) every texture path the ported globe loads exists under the candidate's public/, byte-pinned
// in PORT-PIN; (2) the image-ref resolver, over both transports, against the grammar in MaterialSurface.tsx itself; (3) the
// founding provider's adaptation and load, with and without a base Location.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {existsSync} from 'node:fs'
import {readFile, readdir} from 'node:fs/promises'
import {register} from 'node:module'
import {homedir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'

// The same in-memory TypeScript loader as the other atlas suites; `import.meta.env` (Vite's) is stood in for, as Node has none.
const root = new URL('../../../../', import.meta.url)
const ui = new URL('packages/live-shell/ui/', root)
const compilerUrl = new URL('desktop/cradle/node_modules/typescript/lib/typescript.js', root).href
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compilerUrl)};
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
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};
  if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);
  const source=(await readFile(new URL(url),'utf8')).replace(/import\\.meta\\.env/g,'({BASE_URL:"/"})');
  return {format:'module',shortCircuit:true,source:ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}`)}`, import.meta.url)
const {default: ts} = await import(compilerUrl)

const atlasDir = new URL('src/projections/atlas/', ui)
const imageRefs = await import(new URL('provider/imageRefs.ts', atlasDir))
const founding = await import(new URL('provider/archetypalEarthProvider.ts', atlasDir))
const {materialImageUrl, resolveImageRef, resolveFieldImages, hasRelativeImage} = imageRefs
const {archetypalEarthProvider, adaptFoundingField, ARCHETYPAL_EARTH_DATA, ARCHETYPAL_EARTH_ASSETS} = founding

const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const publicTextures = new URL('public/textures/', ui)
const pin = JSON.parse(await readFile(new URL('PORT-PIN.json', atlasDir), 'utf8'))

// ── (1) the Earth is given ────────────────────────────────────────────────────────────────────────────────────────────

/** Every `textures/<name>` the port names in code, `${which}` expanded over the two sizes hiResChoice returns. */
async function texturesTheGlobeLoads() {
  const earth = await readFile(new URL('src/globe/earth.ts', atlasDir), 'utf8')
  const sizes = [...earth.matchAll(/which:\s*((?:'\w+'\s*\|\s*)*'\w+')/g)].flatMap(match => [...match[1].matchAll(/'(\w+)'/g)].map(size => size[1]))
  const names = new Set()
  const walk = async dir => (await Promise.all((await readdir(dir, {withFileTypes: true})).map(entry => entry.name === 'dev' ? [] : entry.isDirectory() ? walk(new URL(`${entry.name}/`, dir)) : [new URL(entry.name, dir)]))).flat()
  for (const file of await walk(atlasDir)) {
    if (!/\.(ts|tsx)$/.test(file.pathname)) continue
    const code = (await readFile(file, 'utf8')).split('\n').filter(line => !/^\s*(\/\/|\/\*|\*)/.test(line)).join('\n')
    for (const match of code.matchAll(/textures\/([\w${}.-]+\.(?:jpg|png))/g)) {
      if (match[1].includes('${which}')) for (const size of sizes) names.add(match[1].replace('${which}', size))
      else names.add(match[1])
    }
  }
  return {sizes, names: [...names].sort()}
}

test('every texture path the ported globe loads exists under the candidate public/textures', async () => {
  const {sizes, names} = await texturesTheGlobeLoads()
  assert.deepEqual(sizes.sort(), ['4k', '8k'], 'the hi-res sizes are read from hiResChoice')
  assert.deepEqual(names, ['earth-2k.jpg', 'earth-4k.jpg', 'earth-8k.jpg'])
  for (const name of names) assert.ok(existsSync(new URL(name, publicTextures)), `${name} is not under packages/live-shell/ui/public/textures`)
})

test('the shipped textures are exactly the pinned vendored assets, and nothing else is in public/textures', async () => {
  const shipped = (await readdir(publicTextures)).sort()
  assert.deepEqual(shipped.map(name => `textures/${name}`), Object.keys(pin.vendoredAssets).sort(), 'every shipped file is recorded, every record is shipped')
  for (const [path, record] of Object.entries(pin.vendoredAssets)) {
    const bytes = await readFile(new URL(path, new URL('public/', ui)))
    assert.equal(record.kind, 'vendored-asset')
    assert.equal(bytes.length, record.bytes, `${path}: byte length`)
    assert.equal(sha(bytes), record.sha256, `${path}: sha-256`)
    assert.ok(record.licence && record.ae && record.loadedBy, `${path}: the record names its AE path, its licence and the load site`)
  }
  for (const [path, reason] of Object.entries(pin.assetsNotVendored)) {
    assert.ok(reason.length > 20 && !existsSync(new URL(path.replace(/^public\//, ''), new URL('public/', ui))), `${path}: recorded as not vendored, and not shipped`)
  }
})

const AE = process.env.ARCHETYPAL_EARTH ?? join(homedir(), 'Central', 'Work', 'Archetypal-Earth')
test('the shipped textures are byte-identical to Archetypal-Earth at the pinned commit', {skip: existsSync(join(AE, '.git')) ? false : 'no Archetypal-Earth checkout on this machine'}, async () => {
  for (const [path, record] of Object.entries(pin.vendoredAssets)) {
    let blob
    try {
      blob = execFileSync('git', ['-C', AE, 'show', `${pin.commit}:${record.ae}`], {maxBuffer: 64 * 1024 * 1024})
    } catch {
      continue // the pinned commit is not in this checkout; the sha-256 in the pin above is the check
    }
    assert.equal(sha(blob), sha(await readFile(new URL(path, new URL('public/', ui)))), `${path} differs from AE ${pin.commit.slice(0, 7)}:${record.ae}`)
  }
})

test('the globe resolves its textures against Vite\'s BASE, which the build copies from public/ (no publicDir override)', async () => {
  const config = await readFile(new URL('vite.config.ts', ui), 'utf8')
  assert.equal(/publicDir/.test(config), false, 'public/ is Vite\'s default publicDir and is copied into ui-dist')
  assert.match(config, /outDir:\s*'ui-dist'/)
  const earth = await readFile(new URL('src/globe/earth.ts', atlasDir), 'utf8')
  assert.equal(/No texture bytes ship/.test(earth), false, 'the licence-gate comment says where the base ships')
  assert.match(earth, /Shipped byte-identical in the shell's public\/textures/)
})

// ── (2) the resolver ──────────────────────────────────────────────────────────────────────────────────────────────────

const BASE = {schema: 'central.path-ref/v1', ref: 'ref:Work/Archetypal-Earth/public/data', root: 'Work', path: 'Work/Archetypal-Earth/public/data'}
const TAURI = {kind: 'tauri'}
const BRIDGE = {kind: 'bridge', url: 'http://127.0.0.1:4179'}
const OFF = {kind: 'unavailable', reason: 'no transport'}

// The grammar's source of truth is MaterialSurface.tsx itself: its `materialPath` and `materialUrl` are lifted out of the file and
// run, so a change to that grammar moves this suite with it (desktop/cradle/src/material/MaterialSurface.tsx:34-49).
const surface = await readFile(new URL('desktop/cradle/src/material/MaterialSurface.tsx', root), 'utf8')
const lift = name => {
  const start = surface.indexOf(`function ${name}(`)
  assert.ok(start >= 0, `MaterialSurface.tsx has function ${name}`)
  const end = surface.indexOf('\n}\n', start)
  return surface.slice(start, end + 3)
}
const lifted = ts.transpileModule(`${lift('materialPath')}\n${lift('materialUrl')}`, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}}).outputText
const surfaceGrammar = new Function(`${lifted}\nreturn materialUrl`)()

test('the resolver emits the exact URLs MaterialSurface.materialUrl emits, for the native protocol and the bridge mirror', () => {
  const paths = ['img/archetypes/self.jpg', 'img/families/serpent.thumb.jpg', 'img/a b/c#d?e.jpg', 'img/ünï/café.jpg', 'img/100%.jpg']
  for (const relative of paths) {
    for (const transport of [TAURI, BRIDGE]) {
      const expected = surfaceGrammar(transport, BASE, relative)
      assert.ok(expected, 'the lifted grammar answers')
      assert.equal(materialImageUrl(transport, BASE, relative), expected, `${transport.kind}: ${relative}`)
    }
  }
  const encoded = encodeURIComponent(JSON.stringify(BASE))
  assert.equal(materialImageUrl(TAURI, BASE, 'img/archetypes/self.jpg'), `oi-material://localhost/${encoded}/img/archetypes/self.jpg`, 'the material_protocol.rs header grammar')
  assert.equal(materialImageUrl(BRIDGE, BASE, 'img/archetypes/self.jpg'), `http://127.0.0.1:4179/material/${encoded}/img/archetypes/self.jpg`, 'walk-bridge.rs: GET /material/<location>/<path>')
})

test('a path the route would refuse, or a transport that cannot serve material, gives no URL', () => {
  for (const transport of [TAURI, BRIDGE]) {
    for (const bad of ['../secret.jpg', 'img/../../secret.jpg', 'img/./x.jpg', '..', '.', '', '/', 'img/..', 'img\\..\\x.jpg', 'img/x\u0000.jpg', 'file:///etc/passwd', 'javascript:alert(1)', 'oi-material://localhost/x']) {
      assert.equal(materialImageUrl(transport, BASE, bad), undefined, `${transport.kind}: ${JSON.stringify(bad)} is refused before any request`)
    }
  }
  assert.equal(materialImageUrl(OFF, BASE, 'img/x.jpg'), undefined, 'no transport: absent, not a guess')
  assert.equal(materialImageUrl(TAURI, undefined, 'img/x.jpg'), undefined, 'no base Location: absent')
  assert.equal(materialImageUrl(BRIDGE, undefined, 'img/x.jpg'), undefined)
  assert.equal(materialImageUrl(TAURI, BASE, '/img/x.jpg'), materialImageUrl(TAURI, BASE, 'img/x.jpg'), 'a leading slash is site-relative, as resolveSrc reads it')
})

const ref = (src, thumb, extra = {}) => ({src, thumb, width: 1920, height: 1200, tone: '#8a4e3a', title: 'Four Mandalas', credit: 'Ngor Monastery', license: 'Public domain', sourceUrl: 'https://commons.wikimedia.org/wiki/File:x.jpg', ...extra})

test('resolveImageRef serves relative src and thumb, passes absolute refs through as they are, and drops what it cannot serve', () => {
  const images = {transport: TAURI, base: BASE}
  const served = resolveImageRef(ref('img/families/serpent.jpg', 'img/families/serpent.thumb.jpg'), images)
  assert.equal(served.src, materialImageUrl(TAURI, BASE, 'img/families/serpent.jpg'))
  assert.equal(served.thumb, materialImageUrl(TAURI, BASE, 'img/families/serpent.thumb.jpg'))
  assert.equal(served.credit, 'Ngor Monastery', 'the licence gate travels with the plate: credit, license and sourceUrl are untouched')
  assert.equal(served.license, 'Public domain')
  assert.equal(served.sourceUrl, 'https://commons.wikimedia.org/wiki/File:x.jpg')
  for (const url of ['data:image/svg+xml;utf8,<svg/>', 'https://upload.wikimedia.org/x.jpg', 'http://127.0.0.1:1/x.jpg', 'blob:http://localhost/abc']) {
    const absolute = ref(url, url)
    assert.equal(resolveImageRef(absolute, images), absolute, `${url.slice(0, 12)}: the same object, untouched`)
    assert.equal(resolveImageRef(absolute), absolute, 'absolute refs need no base at all')
  }
  assert.equal(resolveImageRef(ref('img/x.jpg', 'img/x.jpg')), undefined, 'no images context: absent')
  assert.equal(resolveImageRef(ref('img/x.jpg', 'img/x.jpg'), {transport: TAURI}), undefined, 'no base Location: absent')
  assert.equal(resolveImageRef(ref('../x.jpg', '../x.jpg'), images), undefined)
  assert.equal(resolveImageRef(ref('', ''), images), undefined)
  assert.equal(resolveImageRef(ref('img/x.jpg', ''), images).thumb, materialImageUrl(TAURI, BASE, 'img/x.jpg'), 'a missing thumb is the src')
  assert.equal(resolveImageRef(ref('img/x.jpg', '../escape.jpg'), images).thumb, materialImageUrl(TAURI, BASE, 'img/x.jpg'), 'a thumb that cannot be served falls back to the src')
  const mixed = resolveImageRef(ref('img/x.jpg', 'data:image/png;base64,AA=='), images)
  assert.equal(mixed.thumb, 'data:image/png;base64,AA==', 'each path is resolved on its own')
})

// ── (3) the founding provider ─────────────────────────────────────────────────────────────────────────────────────────

const palette = {core: '#fff', glow: '#eee', fog: '#111', deep: '#000'}
const planted = (id, extra = {}) => ({id, title: id, label: id, familyId: 'lighthouse', coFamilyIds: [], locusType: 'artifact', subject: 'jung', cultureIds: [], place: 'Channel', lat: 50, lon: -4, geoPrecision: 'place', year: 1698, yearDisplay: '1698', jung: [], body: [], parallelIds: [], ...extra})
const field = () => ({
  meta: {generatedAt: '2026-10-13T00:46:34.423Z', vaultPath: '/vault/x', vaultLedgerLine: 'L', counts: {archetypes: 1, theoretics: 1, families: 1, occurrences: 4, cultures: 0, images: 4}, yearMin: 1698, yearMax: 1844},
  archetypes: [{id: 'wayfinding', name: 'Wayfinding', oneLine: '', prime: false, spectrum: {position: 0.8}, palette, body: [], familyIds: ['lighthouse'], occurrenceCount: 4, archetypes: [], image: ref('img/archetypes/wayfinding.jpg', 'img/archetypes/wayfinding.thumb.jpg')}],
  theoretics: [{id: 'light', name: 'Light', oneLine: '', spectrum: {position: 0.5}, palette, body: [], theoretics: [], occurrenceCount: 0, image: ref('img/theoretics/light.jpg', 'img/theoretics/light.thumb.jpg')}],
  families: [{id: 'lighthouse', name: 'Lighthouse', subtype: 'object', aliases: [], oneLine: '', archetypes: [{id: 'wayfinding', basis: 'jung'}], spectrum: {position: 0.5}, palette, body: [], occurrenceIds: ['eddystone', 'bell', 'carried', 'bare'], synthesised: false, image: ref('img/families/lighthouse.jpg', 'img/families/lighthouse.thumb.jpg')}],
  occurrences: [
    planted('eddystone', {image: ref('img/occurrences/eddystone.jpg', 'img/occurrences/eddystone.thumb.jpg')}),
    planted('bell', {image: ref('../outside.jpg', '../outside.jpg')}),
    planted('carried', {image: ref('data:image/svg+xml;utf8,<svg/>', 'data:image/svg+xml;utf8,<svg/>')}),
    planted('bare'),
  ],
  cultures: [],
  joins: [],
})

const entryAt = (name, kind = 'directory') => ({name, kind, byte_len: 0, retrieval_allowed: true, location: {schema: 'central.path-ref/v1', ref: `ref:${ARCHETYPAL_EARTH_ASSETS}/${name}`, root: 'Work', path: `${ARCHETYPAL_EARTH_ASSETS}/${name}`}})

// A reader over a fixture tree rooted at AE's public/: `data/…` is the bundle, `img/` and `textures/` sit beside it.
function fakeReader(files, log = [], {assetsListable = true} = {}) {
  const dataFolders = new Set([''])
  for (const key of Object.keys(files)) { const slash = key.lastIndexOf('/'); if (slash >= 0) dataFolders.add(key.slice(0, slash)) }
  return {
    async list(path) {
      log.push(`list ${path}`)
      if (path === ARCHETYPAL_EARTH_ASSETS) {
        if (!assetsListable) throw new Error(`no such folder: ${path}`)
        return {schema: 'central.directory-reading/v1', location: {schema: 'central.path-ref/v1', ref: `ref:${path}`, root: 'Work', path}, entries: [entryAt('data'), entryAt('img'), entryAt('textures')], automatic_agent_or_model_invocation: false}
      }
      const folder = path === ARCHETYPAL_EARTH_DATA ? '' : path.startsWith(`${ARCHETYPAL_EARTH_DATA}/`) ? path.slice(ARCHETYPAL_EARTH_DATA.length + 1) : null
      if (folder === null || !dataFolders.has(folder)) throw new Error(`no such folder: ${path}`)
      const entries = Object.keys(files)
        .filter(key => (key.includes('/') ? key.slice(0, key.lastIndexOf('/')) : '') === folder)
        .map(key => ({name: key.slice(key.lastIndexOf('/') + 1), kind: 'file', byte_len: files[key].length, retrieval_allowed: true, location: {schema: 'central.path-ref/v1', ref: `ref:${ARCHETYPAL_EARTH_DATA}/${key}`, root: 'Work', path: `${ARCHETYPAL_EARTH_DATA}/${key}`}}))
      return {schema: 'central.directory-reading/v1', location: {schema: 'central.path-ref/v1', ref: `ref:${path}`, root: 'Work', path}, entries, automatic_agent_or_model_invocation: false}
    },
    async read(location) {
      log.push(`read ${location.path}`)
      const key = location.path.slice(ARCHETYPAL_EARTH_DATA.length + 1)
      if (!(key in files)) throw new Error(`no such file: ${location.path}`)
      return {schema: 'central.file-reading/v1', location, revision: 'r1', byte_len: files[key].length, content_encoding: 'utf-8', content: files[key], project: null, source: null, automatic_agent_or_model_invocation: false}
    },
  }
}

test('adaptFoundingField serves every tier\'s plate beside the base Location, and leaves everything else verbatim', () => {
  const raw = field()
  const out = adaptFoundingField(raw, {transport: BRIDGE, base: BASE})
  const at = relative => materialImageUrl(BRIDGE, BASE, relative)
  assert.equal(out.archetypes[0].image.src, at('img/archetypes/wayfinding.jpg'))
  assert.equal(out.archetypes[0].image.thumb, at('img/archetypes/wayfinding.thumb.jpg'))
  assert.equal(out.theoretics[0].image.src, at('img/theoretics/light.jpg'))
  assert.equal(out.families[0].image.thumb, at('img/families/lighthouse.thumb.jpg'))
  assert.equal(out.occurrences[0].image.src, at('img/occurrences/eddystone.jpg'))
  assert.equal(out.occurrences[0].image.credit, 'Ngor Monastery')
  assert.equal('image' in out.occurrences[1], false, 'a plate that climbs out of the base is absent, not a broken image')
  assert.equal(out.occurrences[2].image.src, 'data:image/svg+xml;utf8,<svg/>', 'inline data URLs are carried as they were')
  assert.equal('image' in out.occurrences[3], false)
  assert.deepEqual(out.meta.counts, raw.meta.counts, 'counts travel verbatim')
  assert.equal(out.occurrences.length, 4)
  assert.equal(raw.occurrences[0].image.src, 'img/occurrences/eddystone.jpg', 'the input is not mutated')
})

test('with no base Location every relative plate is absent; inline plates and the rest of each entity are untouched', () => {
  for (const out of [adaptFoundingField(field()), adaptFoundingField(field(), {transport: TAURI}), adaptFoundingField(field(), {transport: OFF, base: BASE})]) {
    assert.equal('image' in out.archetypes[0], false)
    assert.equal('image' in out.theoretics[0], false)
    assert.equal('image' in out.families[0], false)
    assert.equal('image' in out.occurrences[0], false)
    assert.equal(out.occurrences[2].image.src, 'data:image/svg+xml;utf8,<svg/>')
    assert.equal(out.families[0].name, 'Lighthouse')
    assert.deepEqual(out.occurrences[0].cites, [], 'the founding adaptation still runs')
  }
  const tiers = out => [out.archetypes, out.theoretics, out.families, out.occurrences]
  assert.equal(hasRelativeImage(field()), true)
  assert.equal(tiers(resolveFieldImages(field())).every(tier => tier.every(item => !item.image || /^data:/.test(item.image.src))), true)
})

test('load lists AE\'s public/ once for a base Location when the field carries a plate, and serves the plates beside it', async () => {
  const log = []
  const files = {'field.json': JSON.stringify(field())}
  const bundle = await archetypalEarthProvider(BRIDGE, ARCHETYPAL_EARTH_DATA, fakeReader(files, log)).load()
  assert.equal(log.filter(line => line === `list ${ARCHETYPAL_EARTH_ASSETS}`).length, 1, 'the asset folder is listed once')
  assert.equal(bundle.images.location.path, `${ARCHETYPAL_EARTH_ASSETS}/data`, 'the base is a Location in public/, so the route resolves img/… beside data/')
  const served = bundle.field.occurrences[0].image
  assert.equal(served.src, materialImageUrl(BRIDGE, bundle.images.location, 'img/occurrences/eddystone.jpg'))
  assert.match(served.src, /^http:\/\/127\.0\.0\.1:4179\/material\/.+\/img\/occurrences\/eddystone\.jpg$/)
  assert.equal(bundle.field.families[0].image.thumb, materialImageUrl(BRIDGE, bundle.images.location, 'img/families/lighthouse.thumb.jpg'))
  const native = await archetypalEarthProvider(TAURI, ARCHETYPAL_EARTH_DATA, fakeReader(files)).load()
  assert.match(native.field.occurrences[0].image.src, /^oi-material:\/\/localhost\/.+\/img\/occurrences\/eddystone\.jpg$/)
})

test('when AE\'s public/ cannot be listed the load still succeeds and the plates stay absent', async () => {
  const warn = console.warn
  const warned = []
  console.warn = (...args) => warned.push(args)
  try {
    const bundle = await archetypalEarthProvider(TAURI, ARCHETYPAL_EARTH_DATA, fakeReader({'field.json': JSON.stringify(field())}, [], {assetsListable: false})).load()
    assert.deepEqual(bundle.images, {})
    assert.equal(bundle.field.occurrences.length, 4)
    assert.equal(bundle.field.occurrences.some(occurrence => 'image' in occurrence && !/^data:/.test(occurrence.image.src)), false)
    assert.equal(warned.length, 1, 'the absence is named once')
  } finally {
    console.warn = warn
  }
})

test('a field with no relative plates reads nothing outside the bundle', async () => {
  const log = []
  const bare = field()
  for (const tier of [bare.archetypes, bare.theoretics, bare.families, bare.occurrences]) for (const item of tier) delete item.image
  const bundle = await archetypalEarthProvider(TAURI, ARCHETYPAL_EARTH_DATA, fakeReader({'field.json': JSON.stringify(bare)}, log)).load()
  assert.deepEqual(bundle.images, {})
  assert.ok(log.every(line => line.includes(ARCHETYPAL_EARTH_DATA)), `reads stay in the bundle: ${log.join(' | ')}`)
})

// ── the one hand-off this ticket cannot close from its zone ───────────────────────────────────────────────────────────

test('the port\'s resolveSrc leaves a native oi-material:// plate URL as it is', async () => {
  const {resolveSrc} = await import(new URL('src/data/load.ts', atlasDir))
  assert.equal(resolveSrc('oi-material://localhost/%7B%7D/img/x.jpg'), 'oi-material://localhost/%7B%7D/img/x.jpg')
})
