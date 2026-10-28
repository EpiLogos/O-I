import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// R1 (T-REALIGN §3; manual §16.3–§16.4; lock §0.3.2): a device's six views on one binding, each in its own place with its frame and
// its room — Folded and Compact on the chain, Whole in the pool and expanded above the chain, Full in a pane, Pop-out in its own
// window, Widget on the rail. The expanded view stands one device at a time and Esc folds it; a concealed chain expands nothing.
// Any number of windows stand; ↗ in a window closes it, and a window closes when its device leaves the door. The head's menu
// offers Fold, and its owner's other acts disabled with the operation they wait for. Loader as device-runtime-host.test.mjs.
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

globalThis.document = {getElementById: () => null, createElement: () => ({}), head: {appendChild: () => {}}}
const {createElement} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const door = await import('../src/frame/devices/deviceDoor.ts')
const host = await import('../src/frame/devices/deviceHost.tsx')
const designs = await import('../src/frame/devices/designs.ts')
const view = await import('../src/frame/devices/DeviceView.tsx')
const {foldsExpanded, DeviceFlipHost} = await import('../src/frame/devices/DeviceFlip.tsx')
const {DeviceWindowLayer} = await import('../src/frame/devices/DeviceWindows.tsx')
const {DeviceFullPane} = await import('../src/frame/devices/devicePane.tsx')
const {headMenu, MISSING_OPS} = await import('../src/frame/devices/DeviceMenu.tsx')
const win = await import('../src/frame/devices/deviceWindow.ts')
const kit = await import('../src/inhabitants/sdk/panel.tsx')
const {WIDE_WHOLE_H} = await import('../src/inhabitants/catalogue/panels/popout.tsx')
const {ChainDevice, PlacedDevice, placedNav, bandStands, roomAt, FRAME_OF_VIEW} = view
const html = element => renderToStaticMarkup(element)
const settle = ms => new Promise(resolve => setTimeout(resolve, ms))

const row = key => ({family: 'r1', deviceInstance: 'd', key, type: 'number', title: key, range: {min: 0, max: 1}, writePath: 'kernel:x'})
const deviceOf = (id, title = 'Probe') => ({id, family: 'r1', face: {id: id.split(':')[1] ?? id, title, icon: 'form', liveSemantic: 'device-audio-fx'}, rows: [row('size')], values: {size: 0.5}})

// A design that writes, in every view, the frame and room its host gives it (design.ts ViewProps.frame, .room), and draws its head
// with the kit so the place's marks (▸ ↗ ▦) show.
const said = (name, p) => createElement('i', {'data-probe': name, 'data-frame': p.frame ?? 'none', 'data-room': p.room ? `${p.room.w}x${p.room.h}` : 'none'})
const probeDesign = id => ({id, title: 'Probe', kind: 'effect', defaults: {},
  folded: p => createElement('span', null, said('folded', p), createElement(kit.Folded, {title: 'Probe', light: 'unknown', onUnfold: p.nav.unfold})),
  compact: p => createElement(kit.Panel, {title: 'Probe', view: 'compact', light: 'unknown', onFold: p.nav.fold, onFull: p.nav.full}, said('compact', p)),
  whole: p => createElement(kit.Panel, {title: 'Probe', view: 'whole', light: 'unknown', onFold: p.nav.fold, onFull: p.nav.full}, said('whole', p)),
  full: p => said('full', p),
  widget: p => createElement(kit.Tile, {title: 'Probe', light: 'unknown', onFull: p.nav.full}, said('widget', p))})

function withProbe(id, run) {
  const device = deviceOf(id)
  designs.registerDesignedDevice(probeDesign(`r1:${device.face.id}`))
  door.publishDevice(id, {device})
  try { return run(device) } finally {
    designs.unregisterDesignedDevice(`r1:${device.face.id}`); door.publishDevice(id, null); host.resetHost(id)
    for (const open of door.deviceWindows()) door.closeDeviceWindow(open.id)
    door.flipDevice(null); door.selectDevice(null)
  }
}
const probes = markup => Object.fromEntries([...markup.matchAll(/data-probe="([a-z]+)" data-frame="([a-z]+)" data-room="([0-9x]+|none)"/g)]
  .map(([, name, frame, room]) => [name, {frame, room}]))

// ── the expanded view ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('Esc alone folds the expanded view while one stands; never with a modifier, a repeat, while typing, or with none expanded', () => {
  const esc = (extra = {}) => ({key: 'Escape', ...extra})
  const plain = {tagName: 'DIV', getAttribute: () => null, parentElement: null}
  const typing = {tagName: 'INPUT', getAttribute: () => null, parentElement: null}
  assert.equal(foldsExpanded(esc(), plain, 'a'), true)
  assert.equal(foldsExpanded(esc(), plain, null), false, 'nothing expanded: Esc is the window\'s Stop')
  for (const modifier of ['shiftKey', 'altKey', 'metaKey', 'ctrlKey', 'repeat']) assert.equal(foldsExpanded(esc({[modifier]: true}), plain, 'a'), false, modifier)
  assert.equal(foldsExpanded(esc(), typing, 'a'), false, 'Esc in a field is the field\'s')
  assert.equal(foldsExpanded({key: 'Enter'}, plain, 'a'), false)
})

test('one device stands expanded at a time: ▸ on another moves the band, ▸ again (▾) folds it; the head shows ▾ while it stands', () => {
  withProbe('r1:flip', device => {
    const other = deviceOf('r1:other')
    door.publishDevice(other.id, {device: other})
    try {
      door.flipDevice(device.id)
      assert.equal(door.flippedDeviceId(), device.id)
      door.flipDevice(other.id)
      assert.equal(door.flippedDeviceId(), other.id, 'the band moves; never two')
      door.flipDevice(device.id)
      const chain = html(createElement(ChainDevice, {device}))
      assert.match(chain, /data-device-flipped="true"/)
      assert.match(chain, /class="dp-fold dp-expand" aria-pressed="true" aria-label="Fold Probe&#x27;s expanded view"/, 'the head\'s ▸ reads ▾, pressed')
      door.flipDevice(null)
      assert.match(html(createElement(ChainDevice, {device})), /class="dp-fold dp-expand" aria-pressed="false" aria-label="Expand Probe"/)
    } finally { door.publishDevice(other.id, null) }
  })
})

test('a concealed chain expands nothing: the band stands only while ▸ is pressed, the frame\'s host stands and the plate is shown', () => {
  const hostElement = {}
  const box = {width: 300, height: 191}
  assert.equal(bandStands(true, hostElement, box), true)
  assert.equal(bandStands(true, hostElement, null), false, 'a plate in a hidden detail body or another mode\'s chain is not shown')
  assert.equal(bandStands(true, null, box), false, 'no frame host, no band')
  assert.equal(bandStands(false, hostElement, box), false)
  withProbe('r1:hidden', device => {
    door.flipDevice(device.id)
    // Server-drawn, nothing is measured: the plate is not shown, so no band is portalled.
    assert.doesNotMatch(html(createElement(ChainDevice, {device})), /data-device-flip=/)
  })
})

// ── the six views, each with its frame and room ────────────────────────────────────────────────────────────────────────────

test('every view reaches its design with its own frame: chain, flip, pane, window, rail — and the room its place gives', () => {
  withProbe('r1:places', device => {
    assert.deepEqual(probes(html(createElement(ChainDevice, {device}))).compact, {frame: 'chain', room: 'none'}, 'Compact on the chain (room once measured)')
    assert.deepEqual(probes(html(createElement(PlacedDevice, {device, view: 'whole'}))).whole, {frame: 'flip', room: 'none'}, 'Whole in its band (W1: the pool holds no device)')
    assert.deepEqual(probes(html(createElement(PlacedDevice, {device, view: 'whole', frame: 'flip', room: {w: 1300, h: WIDE_WHOLE_H}}))).whole,
      {frame: 'flip', room: `1300x${WIDE_WHOLE_H}`}, 'Whole expanded, in the band\'s room')
    assert.deepEqual(probes(html(createElement(PlacedDevice, {device, view: 'full'}))).full, {frame: 'pane', room: 'none'}, 'Full in a pane')
    assert.deepEqual(probes(html(createElement(PlacedDevice, {device, view: 'full', room: {w: 760, h: 420}}))).full, {frame: 'pane', room: '760x420'})
    assert.deepEqual(probes(html(createElement(PlacedDevice, {device, view: 'widget'}))).widget, {frame: 'rail', room: 'none'}, 'Widget on the rail')
    const popout = probes(html(createElement(PlacedDevice, {device, view: 'popout', room: {w: 1000, h: 600}})))
    // Most devices need no pop-out of their own: the window shows Full over Whole (popout.tsx popoutOf), each in the window's frame.
    assert.deepEqual(popout.full, {frame: 'window', room: `1000x${600 - WIDE_WHOLE_H}`}, 'Full, the material, above')
    assert.deepEqual(popout.whole, {frame: 'window', room: `1000x${WIDE_WHOLE_H}`}, 'Whole docked under it')
    assert.deepEqual(FRAME_OF_VIEW, {whole: 'flip', full: 'pane', popout: 'window', widget: 'rail'})
  })
})

test('a place\'s room is its holder\'s box at 100 %: the box over the zoom the plate stands at, in whole px', () => {
  assert.equal(roomAt(null), null, 'unmeasured, or concealed: no room, and the design draws at its standard measures')
  assert.deepEqual(roomAt({w: 500, h: 380}, 1.25), {w: 400, h: 304})
  assert.deepEqual(roomAt({w: 761.4, h: 420.6}), {w: 761, h: 421})
  assert.deepEqual(roomAt({w: 100, h: 100}, 0), {w: 100, h: 100}, 'a zoom that is no zoom is 100 %')
})

test('Folded on its chain: the host keeps the fold per device, so the design\'s folded strip draws; its title opens it again', () => {
  withProbe('r1:fold', device => {
    host.setHostFolded(device.id, true)
    const folded = html(createElement(ChainDevice, {device}))
    assert.match(folded, /data-device-view="folded"/)
    assert.match(folded, /class="dp-folded"[\s\S]*aria-label="Unfold Probe"/, 'the folded title is the press that opens it')
    assert.equal(probes(folded).folded.frame, 'chain')
    host.setHostFolded(device.id, false)
    assert.match(html(createElement(ChainDevice, {device})), /data-device-view="compact"/)
  })
})

test('the head reads as Live\'s in every place: ▸ and ↗ where the device is published; ▦ opens it full; Full holds no controls', () => {
  withProbe('r1:head', device => {
    for (const markup of [html(createElement(ChainDevice, {device})), html(createElement(PlacedDevice, {device, view: 'whole'}))]) {
      assert.match(markup, /class="dp-fold dp-expand"/, '▸ beside the activator')
      assert.match(markup, /class="dp-full dp-popout" aria-label="Pop Probe out into its own window"/, '↗ at the right')
      assert.match(markup, /aria-label="Open Probe full in a pane"/, '▦ at the right')
    }
    assert.match(html(createElement(PlacedDevice, {device, view: 'widget'})), /class="dp-full dp-popout"/, 'the tile pops out too')
    const full = html(createElement(PlacedDevice, {device, view: 'full'}))
    assert.doesNotMatch(full, /dp-popout|dp-expand|dp-head/, 'a pane holds no device controls')
  })
  const nav = {full: () => {}, rail: () => {}, popout: () => 'open', expand: () => {}, expanded: true, select: () => {}}
  const close = () => 'close'
  assert.equal(placedNav('popout', nav, 'x', close).popout, close, '↗ in the window closes it')
  assert.equal(placedNav('whole', nav, 'x', close).popout, nav.popout, '↗ elsewhere opens the window')
  assert.deepEqual(placedNav('full', nav, 'x'), {}, 'Full: no head, no marks')
  assert.equal(placedNav('widget', nav, 'x', close).close, close, 'the tile\'s ✕ takes it off the rail')
  assert.equal(placedNav('whole', {full: nav.full}, 'x').expand, undefined, 'unpublished: no ▸')
})

// ── the pool and the pane ──────────────────────────────────────────────────────────────────────────────────────────────────

test('pressing a plate selects the device and fills no pool; a device held from the browser stands whole in its band (W1, §16.4, §16.7)', () => {
  withProbe('r1:pool', device => {
    door.selectDevice(device.id)
    assert.equal(door.flippedDeviceId(), null, 'selecting shows no Whole of its own: ▸ does, as a band above the chain')
    door.selectDevice(null)
    const browsed = deviceOf('r1:browsed', 'Browsed')
    door.holdInBand(browsed.id, {device: browsed})
    assert.equal(door.selectedDeviceId(), browsed.id); assert.equal(door.flippedDeviceId(), browsed.id, 'held, it takes the band')
    const band = html(createElement(DeviceFlipHost))
    assert.match(band, /data-device-held="true"[\s\S]*data-device-frame="flip"[\s\S]*data-device="r1:browsed"[\s\S]*data-device-size="whole"/, 'the band host draws it whole')
    door.holdInBand(browsed.id, null)
    assert.equal(door.publishedDevice(browsed.id), undefined); assert.equal(door.flippedDeviceId(), null, 'let go, its band folds')
    assert.doesNotMatch(html(createElement(DeviceFlipHost)), /r1:browsed/)
  })
})

test('▦ opens the device Full in a pane: the pane kind draws the device by id, the material only', () => {
  withProbe('r1:pane', () => {
    const pane = html(createElement(DeviceFullPane, {id: 'r1:pane'}))
    assert.match(pane, /data-device-frame="pane"[\s\S]*data-device-size="full"/)
    assert.match(pane, /data-probe="full" data-frame="pane"/)
    assert.match(html(createElement(DeviceFullPane, {id: 'r1:gone'})), /not on any chain right now/)
  })
})

// ── the device's own window ────────────────────────────────────────────────────────────────────────────────────────────────

test('any number of windows stand at once; ↗ again brings one to the front; its close takes only it away', () => {
  withProbe('r1:a', a => {
    const b = deviceOf('r1:b', 'Other')
    door.publishDevice(b.id, {device: b})
    try {
      door.openDeviceWindow(a.id)
      door.openDeviceWindow(b.id)
      assert.deepEqual(door.deviceWindows().map(open => open.id), [a.id, b.id], 'two windows, the last opened in front')
      door.openDeviceWindow(a.id)
      assert.deepEqual(door.deviceWindows().map(open => open.id), [b.id, a.id], '↗ on a standing window brings it forward, never a second')
      const layer = html(createElement(DeviceWindowLayer))
      assert.match(layer, /data-device-windows="2"/)
      assert.match(layer, /data-device-window="r1:a"[\s\S]*data-device-window="r1:b"|data-device-window="r1:b"[\s\S]*data-device-window="r1:a"/)
      assert.match(layer, /aria-roledescription="window" aria-label="Probe — its own window"[^>]*data-front="true"/, 'the front window is marked')
      assert.match(layer, /<span class="device-window-title">Probe<\/span>/, 'its name in the bar')
      assert.match(layer, /data-device-frame="window"[\s\S]*data-device-size="popout"/, 'Pop-out, in the window\'s frame')
      assert.match(layer, /data-probe="full" data-frame="window"[\s\S]*data-probe="whole" data-frame="window"/, 'Full over Whole')
      door.closeDeviceWindow(b.id)
      assert.deepEqual(door.deviceWindows().map(open => open.id), [a.id], 'the other stays')
      door.closeDeviceWindow(a.id)
      assert.equal(html(createElement(DeviceWindowLayer)), '', 'no window, no layer')
    } finally { door.publishDevice(b.id, null) }
  })
})

test('a window follows its device: withdrawn for good it closes after the grace; republished within it, the window stays', async () => {
  const device = deviceOf('r1:leaving')
  door.publishDevice(device.id, {device})
  door.openDeviceWindow(device.id)
  door.publishDevice(device.id, null)
  door.publishDevice(device.id, {device})
  await settle(door.WINDOW_GRACE_MS + 50)
  assert.deepEqual(door.deviceWindows().map(open => open.id), [device.id], 'a chain republishing its devices keeps the window')
  door.publishDevice(device.id, null)
  assert.equal(door.deviceWindows().length, 1, 'inside the grace it still stands (drawing nothing)')
  assert.equal(html(createElement(DeviceWindowLayer)).includes('data-device-window='), false, 'with no device, nothing is drawn in it')
  await settle(door.WINDOW_GRACE_MS + 50)
  assert.equal(door.deviceWindows().length, 0, 'the device left the chain: its window closed')
  door.openDeviceWindow('r1:never')
  door.sweepDeviceWindows()
  assert.equal(door.deviceWindows().length, 0, 'a window for a device the door does not hold closes on the sweep')
})

test('a window moves and sizes inside the shell\'s window, never below the native host\'s least size, its bar always within reach', () => {
  const viewport = [1440, 900]
  const first = win.openedWindowBox(0, viewport)
  assert.equal(first.w, win.WINDOW_W, 'the gallery\'s width where it fits')
  assert.equal(first.h, win.WINDOW_H)
  const second = win.openedWindowBox(1, viewport)
  assert.equal(second.x - first.x, win.WINDOW_CASCADE, 'a second steps right')
  assert.equal(second.y - first.y, win.WINDOW_CASCADE, 'and down')
  const small = win.openedWindowBox(0, [600, 320])
  assert.equal(small.w, 600 - 48, 'the shell\'s width less its margins')
  assert.equal(small.h, win.WINDOW_MIN_H, 'never below the least size')
  assert.equal(win.openedWindowBox(0, [380, 900]).w, win.WINDOW_MIN_W)
  const moved = win.movedWindowBox({box: first, at: [700, 40]}, [5000, 5000], viewport)
  assert.equal(moved.x, 1440 - win.WINDOW_GRIP, 'dragged off the right, its grip stays')
  assert.equal(moved.y, 900 - win.WINDOW_BAR_H, 'dragged below, its bar stays')
  const up = win.movedWindowBox({box: first, at: [700, 40]}, [-5000, -5000], viewport)
  assert.equal(up.y, 0, 'never above the top')
  assert.equal(up.x, win.WINDOW_GRIP - first.w, 'its grip stays inside the left edge')
  const sized = win.sizedWindowBox({box: first, at: [0, 0]}, [-5000, -5000], viewport)
  assert.deepEqual([sized.w, sized.h], [win.WINDOW_MIN_W, win.WINDOW_MIN_H])
  const grown = win.sizedWindowBox({box: {x: 100, y: 50, w: 500, h: 400}, at: [0, 0]}, [5000, 5000], viewport)
  assert.deepEqual([grown.w, grown.h], [1340, 850], 'never past the right and bottom edges')
  // REPLACED (#806): "the room is the window less its bar" — a window now docks the status bar's Info line under its device
  // (DeviceWindows.tsx WindowInfoLine; §16.11 Disabled "The status bar says why"), so the room is the window less its bar and that line.
  assert.deepEqual(win.windowRoom({w: 1180, h: 646}), {w: 1180, h: 646 - win.WINDOW_BAR_H - win.WINDOW_INFO_H}, 'the room is the window less its bar and its Info line')
  assert.equal(win.WINDOW_INFO_H, 20, 'one status line high (styles.css .statusbar-info-line)')
  assert.equal(win.heldInView(first, viewport), first, 'a box already in view is the same box')
})

// ── the head's menu ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('right-click the head: Fold (Unfold while folded) on the chain, then Rename, Group, Save as preset, Hot-swap, Show automation, Map', () => {
  const titles = items => items.map(item => item.title)
  const onChain = headMenu({onChain: true, folded: false})
  assert.deepEqual(titles(onChain), ['Fold', 'Rename', 'Group', 'Save as preset', 'Hot-swap', 'Show automation', 'Map'])
  assert.equal(onChain[0].enabled, true)
  for (const item of onChain.slice(1)) {
    assert.equal(item.enabled, false, `${item.title} waits for its owner`)
    assert.match(item.why, /^No owner operation carries it yet — missing op: .+\.$/)
    assert.ok(item.why.includes(MISSING_OPS[item.id]), 'the reason names the operation it waits for')
  }
  assert.equal(headMenu({onChain: true, folded: true})[0].title, 'Unfold')
  const pool = headMenu({onChain: false, folded: false})[0]
  assert.equal(pool.enabled, false, 'a device folds where it stands on its chain')
  assert.match(pool.why, /on its chain/)
  const carried = headMenu({onChain: true, folded: false, acts: {rename: () => {}, map: () => {}}})
  assert.deepEqual(carried.filter(item => item.enabled).map(item => item.id), ['fold', 'rename', 'map'], 'an act its owner carries stands live')
})
