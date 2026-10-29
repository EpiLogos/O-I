import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {dirname, join} from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {gzipSync} from 'node:zlib'

// The first load (O-I #740, foundations and loading; MAP, the build lane's loading item: "the shell loads as one 6.2 MB script
// before it draws anything — split it by mode and device"). The shell is built as the candidate builds it (vite, this package's
// config, nothing written to disk) and the gate counts what the main window must fetch before its frame can draw: the entry
// chunk and every chunk it imports statically, then the frame's own chunk (App) and its static imports — scripts/load-census.mjs's
// count. A mode's code, a device's design and a page load later, when first entered, placed or opened, and are not counted.
//
// The reference (measured 29 Oct 2026 on dlw/build-lane at bbba4efee, before the mode split; channel: scripted, this build):
//   the main window's first load  3,445,430 B, 1,116,689 B gzip, in 33 chunks
//   the entry chunk alone         1,455,183 B,   438,090 B gzip
// The limits, set against it before the split was tuned: the first load sheds a third (gzip ≤ two thirds of the reference) — the
// static graph showed about a third of it reachable only through a mode's or a device's registration, the rest being the frame
// itself, its transport and its browser — and the entry chunk sheds half.
//
// A production build: about half a minute on a quiet machine. The counter's own teeth are checked on a made-up bundle first.

const ui = join(dirname(fileURLToPath(import.meta.url)), '..')
const REFERENCE = {firstLoadGzip: 1_116_689, entryGzip: 438_090}
export const LIMIT = {firstLoadGzip: Math.floor(REFERENCE.firstLoadGzip * 2 / 3), entryGzip: Math.floor(REFERENCE.entryGzip / 2)}

/** What a window loads before its frame draws: the entry chunk, the frame's chunk, and every chunk either imports statically. */
export function firstLoad(chunks, frameModule) {
  const byName = new Map(chunks.map(chunk => [chunk.fileName, chunk]))
  const entry = chunks.find(chunk => chunk.isEntry)
  const frame = chunks.find(chunk => Object.keys(chunk.modules).some(id => id.endsWith(frameModule)))
  const loaded = new Set()
  const visit = name => {
    if (loaded.has(name) || !byName.has(name)) return
    loaded.add(name)
    for (const next of byName.get(name).imports) visit(next)
  }
  visit(entry.fileName)
  if (frame) visit(frame.fileName)
  const list = [...loaded].map(name => byName.get(name))
  return {
    entry: {file: entry.fileName, bytes: Buffer.byteLength(entry.code), gzip: gzipSync(entry.code).length},
    bytes: list.reduce((sum, chunk) => sum + Buffer.byteLength(chunk.code), 0),
    gzip: list.reduce((sum, chunk) => sum + gzipSync(chunk.code).length, 0),
    chunks: list.length,
    modules: new Set(list.flatMap(chunk => Object.keys(chunk.modules))),
  }
}

test('the counter follows static imports from the entry and the frame, and leaves a dynamic import out', () => {
  const chunk = (fileName, code, imports = [], modules = [], isEntry = false) => ({fileName, code, imports, modules: Object.fromEntries(modules.map(id => [id, {}])), isEntry})
  const chunks = [
    chunk('index.js', 'a'.repeat(100), ['shared.js'], ['/src/main.tsx'], true),
    chunk('App.js', 'b'.repeat(50), ['shared.js', 'frame-part.js'], ['/src/App.tsx']),
    chunk('shared.js', 'c'.repeat(10), [], ['/src/shared.ts']),
    chunk('frame-part.js', 'd'.repeat(20), [], ['/src/frame/part.ts']),
    chunk('mode.js', 'e'.repeat(1000), ['shared.js'], ['/src/mode.tsx']),
  ]
  const counted = firstLoad(chunks, '/src/App.tsx')
  assert.equal(counted.bytes, 180, 'entry + App + their static imports; the mode chunk is not counted')
  assert.equal(counted.chunks, 4)
  assert.ok(!counted.modules.has('/src/mode.tsx'))
  // Teeth: the same bundle with the mode imported statically by the frame counts it.
  chunks[1].imports.push('mode.js')
  assert.equal(firstLoad(chunks, '/src/App.tsx').bytes, 1180)
})

/** The build, once for the file's tests: every chunk the candidate's build emits. */
let built = null
const chunksOfBuild = () => built ??= (async () => {
  const vite = await import(pathToFileURL(createRequire(join(ui, 'package.json')).resolve('vite')).href)
  let chunks = null
  const capture = {name: 'first-load-budget', generateBundle(_options, bundle) { chunks = Object.values(bundle).filter(item => item.type === 'chunk') }}
  await vite.build({root: ui, configFile: join(ui, 'vite.config.ts'), logLevel: 'error', build: {write: false}, plugins: [capture]})
  assert.ok(chunks?.length, 'the build produced no chunks')
  return chunks
})()

test('the main window\'s first load and its entry chunk stay under their limits', async () => {
  const main = firstLoad(await chunksOfBuild(), '/src/App.tsx')
  const kb = n => `${(n / 1000).toFixed(0)} kB`
  const said = `first load ${kb(main.bytes)} (${kb(main.gzip)} gzip) in ${main.chunks} chunks; entry ${main.entry.file} ${kb(main.entry.bytes)} (${kb(main.entry.gzip)} gzip)`
  console.log(`[first-load] ${said}; limits: first load ${kb(LIMIT.firstLoadGzip)} gzip, entry ${kb(LIMIT.entryGzip)} gzip`)
  assert.ok(main.gzip <= LIMIT.firstLoadGzip, `the main window loads ${kb(main.gzip)} gzip before its frame draws, over the ${kb(LIMIT.firstLoadGzip)} limit (${said})`)
  assert.ok(main.entry.gzip <= LIMIT.entryGzip, `the entry chunk is ${kb(main.entry.gzip)} gzip, over the ${kb(LIMIT.entryGzip)} limit (${said})`)
})

/** What loads when a mode is first entered, a device first placed or shown, a document or a pane first opened — never with the first
 * frame. Each is a module's path under the repository; a static import that pulls one back into the first load fails here by name. */
export const LOADS_LATER = [
  // each mode's detail bodies (shell/modeDetails.tsx registers them) and the chains behind them
  /\/src\/shell\/details\//, /\/src\/shell\/ModeDetail\.tsx$/, /\/src\/central\/devices\/CentralDevices\.tsx$/, /\/src\/inhabitants\/ql\/devices\/TechneDevices\.tsx$/,
  /\/src\/components\/DeviceChainPanel\.tsx$/, /\/src\/components\/NativeWorldDetail\.tsx$/, /\/src\/agent\/AgentShellDeviceDetail\.tsx$/,
  // each mode's transport bindings (shell/modeTransports.tsx registers them)
  /\/src\/shell\/transports\/use(Live|Central|Factory|Expressions|Techne)Transport\.tsx$/, /\/src\/shell\/transports\/boundTransport\.tsx$/,
  // the mode's tracks (frame/tracks/TracksPane.tsx loads them)
  /\/src\/frame\/tracks\/(ModeTracksView|modeTracks)\.tsx?$/,
  // the Expressions application and its pane body; the Day's and the Flow's forms; Live's device faces
  /\/src\/panels\/expressions\.tsx$/, /\/src\/projections\/expressionsPane\.tsx$/, /\/src\/inhabitants\/Document(DayDie|Flow)Face\.tsx$/,
  /\/src\/panels\/devices-pro\/(glue|echo|reverb|wavetable|operator)\.tsx$/,
  // a Flow's parser and its form page (desktop/cradle/src/flow/instances.ts readFlowInstance; the folder and its listing are
  // flow/flowsDir.ts, which the first frame may read)
  /\/desktop\/cradle\/src\/flow\/instances?\.ts$/, /\/desktop\/cradle\/documents\/ql-flow\.html$/,
  // Settings' source census and its development specimens (settings/catalogue.ts loadSourceSettings; panels/settings.tsx)
  /\/src\/settings\/native-inventory\.capture\.json$/, /\/src\/settings\/development\.ts$/,
  // the rail-born devices' publisher (App.tsx draws it when the rail first shows; their ids and claims are widgets/railDeviceIds.ts)
  /\/src\/widgets\/railDevices\.tsx$/,
  // a catalogue device's design (frame/devices/designs.ts requestDesign)
  /\/src\/inhabitants\/catalogue\/panels\/[^/]+__[^/]+\.tsx$/, /\/src\/frame\/devices\/designsLoad\.ts$/,
  // the search line (central/SearchLineHost.tsx loads it when ⌘K or an @ first opens it; its door is central/searchLineDoor.ts)
  /\/src\/central\/searchLine(Model)?\.tsx?$/,
]

test('what loads when first entered, placed, shown or opened is not in the first load', async () => {
  const main = firstLoad(await chunksOfBuild(), '/src/App.tsx')
  const short = id => id.replace(/^.*\/o-i\//, '')
  const early = [...main.modules].filter(id => LOADS_LATER.some(pattern => pattern.test(id.replace(/\?.*$/, '')))).map(short).sort()
  assert.deepEqual(early, [], 'a mode, a device, a document or a pane pulled into the first frame by a static import')
})
