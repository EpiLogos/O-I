// T-ATLAS-ASSETS: the Earth is given (its base textures ship with the instrument). Scripted: every texture path the ported globe
// loads exists under the candidate's public/, byte-pinned in PORT-PIN; the port's own resolveSrc leaves a native material URL as
// it is. (The founding provider's plate resolver and load — provider/imageRefs.ts, provider/archetypalEarthProvider.ts — are
// gone: the atlas reads the suite through provider/suiteProvider.ts, whose suites are atlas-suite-provider*.test.mjs.)
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
const atlasDir = new URL('src/projections/atlas/', ui)

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

// ── the port's own plate-URL pass-through ─────────────────────────────────────────────────────────────────────────────

test('the port\'s resolveSrc leaves a native oi-material:// plate URL as it is', async () => {
  const {resolveSrc} = await import(new URL('src/data/load.ts', atlasDir))
  assert.equal(resolveSrc('oi-material://localhost/%7B%7D/img/x.jpg'), 'oi-material://localhost/%7B%7D/img/x.jpg')
})
