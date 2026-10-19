/**
 * A device's tile on the rail keeps its marks inside the rail, in WebKit as in Chromium (r27, 19 Oct): the Day's widget is the kit's
 * Tile two squares wide (280 px), and the rail stands at 260 px by default and at the least (shell/workspaceAreas.ts RAIL_MIN_W), so
 * the tile ran past the rail's edge and its ↗ and ✕ lay beyond it — the Day could not be taken off the rail from the rail. A tile
 * wider than the rail now stands at the rail's width: its name shortens, its marks stay.
 *
 * The stage is the Day's own design (catalogue/panels/day.tsx) drawn by the host as its Widget view (frame/devices/deviceHost.tsx
 * HostedDevice, with the place's ↗ and ✕), inside the rail's markup as WidgetRail.tsx and PlacedDevice draw it around a device, the
 * rail at its least width; Scope's single square stands under it, and enough tiles to scroll the rail.
 *
 * Run: node tests/rail-tile-fits.browser.mjs
 */
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {createRequire} from 'node:module'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {bundleOptions, inlineModuleSafe, playwright, root} from './support/agentShellHarness.mjs'

const here = dirname(fileURLToPath(import.meta.url))

const contents = `
import {createRoot} from 'react-dom/client'
import './styles.css'
import './shell/modeSurface.css'
import './frame/widgets/deviceWidgets.css'
import './frame/devices/DeviceView'
import {HostedDevice} from './frame/devices/deviceHost'
import {day} from './inhabitants/catalogue/panels/day'
import {Tile} from './inhabitants/sdk/panel'

const nav = {full: () => {}, close: () => {}, popout: () => {}, select: () => {}}
const square = {...day, id: 'test:square', title: 'Scope', widget: () => <Tile title="Scope" light="ok">{null}</Tile>}
function OnRail({designed, id}: {designed: typeof day; id: string}) {
  return <section className="mode-dock-tile mode-dock-tile--bare" data-widget={'device:' + id}>
    <div className="device-place device-place--widget" data-device-frame="rail">
      <HostedDevice designed={designed} binding={{id, values: day.defaults}} view="widget" nav={nav}
        title={designed.title} frame="rail" className="device device--widget" data={{'data-device': id}} />
    </div>
  </section>
}
createRoot(document.getElementById('root')!).render(<div className="frame dock-open" style={{height: '100vh'}}>
  <aside className="mode-dock widget-rail" aria-label="Widgets" style={{width: 'var(--rail-default)'}}>
    <div className="mode-dock-tilesh"><span>Widgets</span></div>
    <div className="mode-dock-tiles">
      <OnRail designed={day} id="day" />
      {[1, 2, 3, 4].map(n => <OnRail key={n} designed={square} id={'scope-' + n} />)}
    </div>
  </aside>
</div>)
;(window as any).__ready = true
`

const esbuild = createRequire(join(root, 'desktop/cradle/package.json'))('esbuild')
const options = bundleOptions()
const bundle = await esbuild.build({...options, stdin: {contents, resolveDir: join(here, '..', 'src'), sourcefile: 'rail-tile-fits-entry.tsx', loader: 'tsx'},
  outfile: 'rail-tile-fits.browser.mjs'})
const js = bundle.outputFiles.find(file => file.path.endsWith('.mjs')).text
const css = bundle.outputFiles.filter(file => file.path.endsWith('.css')).map(file => file.text).join('\n')

const server = createServer((_request, response) => {
  response.setHeader('Content-Type', 'text/html; charset=utf-8')
  response.end(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body style="margin:0"><div id="root"></div><script type="module">${inlineModuleSafe(js)}</script></body></html>`)
})
await new Promise(done => server.listen(0, '127.0.0.1', done))
const url = `http://127.0.0.1:${server.address().port}/`

const faults = []
const engines = playwright()
try {
  for (const name of ['webkit', 'chromium']) {
    const browser = await engines[name].launch({headless: true, ...(name === 'webkit' && process.env.OI_WEBKIT_EXECUTABLE ? {executablePath: process.env.OI_WEBKIT_EXECUTABLE} : {})})
    try {
      const page = await browser.newPage({viewport: {width: 900, height: 420}})
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(url, {waitUntil: 'domcontentloaded'})
      await page.waitForFunction(() => window.__ready === true, undefined, {timeout: 20000})
      await page.waitForSelector('[data-widget="device:day"] .dp-tile', {timeout: 5000})
      const read = await page.evaluate(() => {
        const tiles = document.querySelector('.mode-dock-tiles')
        const box = tiles.getBoundingClientRect()
        const right = box.left + tiles.clientLeft + tiles.clientWidth
        const marks = [...document.querySelectorAll('[data-widget="device:day"] .dp-tile-head button')]
          .map(button => ({label: button.getAttribute('aria-label'), right: button.getBoundingClientRect().right}))
        const title = document.querySelector('[data-widget="device:day"] .dp-tile-title')
        return {right, marks, overflows: tiles.scrollWidth > tiles.clientWidth, scrolls: tiles.scrollHeight > tiles.clientHeight,
          titleShortened: title.scrollWidth > title.clientWidth}
      })
      try {
        assert.ok(read.scrolls, `${name}: the stage scrolls the rail, as the r27 rail did`)
        assert.deepEqual(read.marks.map(mark => mark.label.split(' ')[0]), ['Open', 'Pop', 'Take'], `${name}: the Day's head carries ⊞, ↗ and ✕`)
        for (const mark of read.marks) assert.ok(mark.right <= read.right + 0.5, `${name}: "${mark.label}" stands inside the rail (its right ${mark.right} ≤ the rail's ${read.right})`)
        assert.equal(read.overflows, false, `${name}: no tile runs past the rail's edge`)
      } catch (error) { faults.push(error.message) }
      if (errors.length) faults.push(`${name}: page errors: ${errors.join('; ')}`)
    } finally { await browser.close() }
  }
} finally { server.close() }

if (faults.length) {
  console.error(faults.join('\n'))
  process.exit(1)
}
console.log('rail-tile-fits: a tile wider than the rail stands at its width, its ↗ and ✕ inside it (webkit, chromium)')
