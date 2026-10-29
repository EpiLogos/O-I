import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'
import {readFile} from 'node:fs/promises'

// How a control moves (ProjectCentral/docs/1-vision/dlw/DLW.md §16.10; inhabitants/sdk/panel.tsx, panel.css). A control moves only when its state changes,
// and only to show that change: the hand is answered at once, what something else changed glides, slides or rings once, and nothing
// loops but what the owner reports. The kit draws the parts server-side (the thumb under a radio and under a head's pages, the default's
// tick and notch, the hold's fill, the copy mark, the ring on a working light, the grip on a movable row); the layout-bound parts
// (the thumb's place, the glide, the flash, the row slide) stand in the browser and are walked in the gallery. This holds what can be
// held without a DOM: the markup, the detent rule, the hand clock, and the stylesheet's reduced-motion promises.
// Loader as device-plate.test.mjs.
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
const {createElement: h} = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const kit = await import('../src/inhabitants/sdk/panel.tsx')
const css = await readFile(new URL('../src/inhabitants/sdk/panel.css', import.meta.url), 'utf8')
const html = el => renderToStaticMarkup(el)
const fmt = v => String(v)

// ── the detent ────────────────────────────────────────────────────────────

test('a drag that passes close to the default lands on it; Shift (fine) and a far hand do not', () => {
  const {detent, DETENT} = kit
  assert.deepEqual(detent(0.52, 0.5, false), {u: 0.5, caught: true}, 'within the catch: on the default')
  assert.deepEqual(detent(0.5 + DETENT, 0.5, false), {u: 0.5 + DETENT, caught: false}, 'at the edge of the catch: free')
  assert.deepEqual(detent(0.52, 0.5, true), {u: 0.52, caught: false}, 'Shift drags past it')
  assert.deepEqual(detent(0.52, null, false), {u: 0.52, caught: false}, 'no default, no detent (a stepped scale has none)')
  assert.ok(DETENT > 0 && DETENT < 0.05, 'a catch of a few percent of the range, not a trap')
})

test('the hand clock: while the hand holds the control or just let go, a change is the hand\'s own', () => {
  const {handIs, MOTION} = kit
  assert.equal(handIs(Infinity, 100000), true, 'held')
  assert.equal(handIs(99999, 100000), true, 'just let go')
  assert.equal(handIs(100000 - MOTION.hand - 1, 100000), false, 'long ago: something else moved it')
})

// ── the markup the kit draws ──────────────────────────────────────────────

const scale = {min: 0, max: 1}

test('a radio draws the thumb its chosen button slides on; the chosen button still says it is chosen', () => {
  const out = html(h(kit.Radio, {label: 'Plane', value: 'xz', options: [{value: 'xy', label: 'XY'}, {value: 'xz', label: 'XZ'}], onChange: () => {}}))
  assert.match(out, /<div class="dp-radio" role="radiogroup" aria-label="Plane"><span class="dp-thumb" aria-hidden="true"><\/span>/)
  assert.match(out, /aria-checked="true">XZ</)
  assert.match(out, /aria-checked="false">XY</)
  assert.doesNotMatch(out, /data-slide/, 'the slide stands only once it has a layout (the browser sets it)')
})

test('a head\'s pages draw the thumb the shown page\'s face slides on', () => {
  const out = html(h(kit.PanelHead, {title: 'Wavetable', light: 'lit', pages: [{id: 'a', label: 'Osc 1'}, {id: 'b', label: 'Osc 2'}], page: 'b'}))
  assert.match(out, /<nav class="dp-pages" role="tablist" aria-label="Wavetable pages"><span class="dp-thumb" aria-hidden="true"><\/span>/)
  assert.match(out, /aria-selected="true">Osc 2</)
})

test('a value box and a dial with a default show where it is; one without shows nothing, and a stepped one has none', () => {
  const withDef = html(h(kit.ValueBox, {label: 'Drag', value: 0.3, def: 0.5, scale, format: fmt, onChange: () => {}}))
  assert.match(withDef, /data-def="true"/)
  assert.match(withDef, /--d:0\.5/)
  assert.doesNotMatch(html(h(kit.ValueBox, {label: 'Drag', value: 0.3, scale, format: fmt, onChange: () => {}})), /data-def/, 'no default declared: no tick')
  assert.doesNotMatch(html(h(kit.ValueBox, {label: 'Iterations', value: 4, def: 8, scale: {min: 1, max: 32, step: 1}, format: fmt, onChange: () => {}})), /data-def/, 'a stepped value has no detent')
  assert.match(html(h(kit.Dial, {label: 'Pressure', value: 0.3, def: 0.5, scale, format: fmt, onChange: () => {}})), /<line [^>]*class="dp-dial-def"/)
  assert.doesNotMatch(html(h(kit.Dial, {label: 'Pressure', value: 0.3, scale, format: fmt})), /dp-dial-def/)
  assert.doesNotMatch(html(h(kit.Dial, {label: 'Pressure', value: undefined, def: 0.5, scale, format: fmt})), /dp-dial-def/, 'no reading: nothing to catch on')
})

test('a control with no reading and a wait for one is drawn waiting, not written as loading', () => {
  const out = html(h(kit.Dial, {label: 'Pressure', value: undefined, scale, format: fmt, waiting: true}))
  assert.match(out, /data-waiting="true"/)
  assert.match(out, /data-unread="true"/)
  assert.match(out, /Waiting for the owner&#x27;s first reading\./, 'the status bar says what the ring shows')
  assert.doesNotMatch(out, /Loading/i)
})

test('an act that cannot be undone is held: a fill, the hold said on the status bar, and no click', () => {
  const held = html(h(kit.Action, {label: 'Remove', does: 'Take the device off its chain.', onPress: () => {}, hold: true}))
  assert.match(held, /data-hold="true"/)
  assert.match(held, /--dp-hold:900ms/)
  assert.match(held, /<i class="dp-hold-fill" aria-hidden="true"><\/i>Remove<\/button>/)
  assert.match(held, /Take the device off its chain\. Hold to do it\./)
  assert.match(html(h(kit.Action, {label: 'Remove', onPress: () => {}, hold: 1500})), /--dp-hold:1500ms/)
  const plain = html(h(kit.Action, {label: 'Disperse', onPress: () => {}}))
  assert.doesNotMatch(plain, /dp-hold-fill|data-hold|Hold/, 'an act that can be undone is clicked')
  assert.match(plain, /<button type="button" class="dp-action">Disperse<\/button>/)
})

test('a reading you may copy draws its mark and says to press; one you may not, does not', () => {
  const out = html(h(kit.Readout, {label: 'Coordinate', value: 'M5-3.1', copy: 'M5-3.1'}))
  assert.match(out, /<button type="button" class="dp-readout-press">/)
  assert.match(out, /class="dp-copy" aria-hidden="true"/)
  assert.match(out, /Press to copy\./)
  assert.doesNotMatch(html(h(kit.Readout, {label: 'Coordinate', value: 'M5-3.1'})), /dp-copy/)
  assert.doesNotMatch(html(h(kit.Readout, {label: 'Coordinate', value: undefined, copy: 'x'})), /dp-copy/, 'no reading: nothing to copy')
})

test('a light the owner reports working carries the ring; a plain one does not', () => {
  assert.match(html(h(kit.Lamp, {state: 'lit', busy: true})), /data-busy="true"/)
  assert.doesNotMatch(html(h(kit.Lamp, {state: 'lit'})), /data-busy/)
  assert.match(html(h(kit.PanelHead, {title: 'Agent', light: 'lit', busy: true})), /class="dp-activator" data-light="lit" data-busy="true"/)
  assert.match(html(h(kit.PanelHead, {title: 'Agent', light: 'lit', busy: true})), /aria-label="Agent: on, working"/)
})

test('a ladder\'s rung being worked on is marked; the label says so', () => {
  const out = html(h(kit.Ladder, {rungs: [true, true, null, null], labels: ['seen', 'read', 'proved', 'kept'], running: 2, label: 'Plan'}))
  assert.match(out, /data-rung="unseen" data-running="true"/)
  assert.match(out, /working on proved/)
  assert.doesNotMatch(html(h(kit.Ladder, {rungs: [true, false], labels: ['a', 'b']})), /data-running/)
})

test('rows carry their identity (they slide by it) and the chosen movable row carries a grip, ▲ and ▼', () => {
  const items = [{id: 'a', name: 'Root', light: 'lit'}, {id: 'b', name: 'Heart', light: 'dark'}]
  const out = html(h(kit.Rows, {items, selected: 'b', onSelect: () => {}, onMove: () => {}}))
  assert.match(out, /data-id="a"/)
  assert.match(out, /data-id="b"/)
  assert.equal((out.match(/class="dp-row-grip"/g) ?? []).length, 1, 'one grip, on the chosen row')
  assert.match(out, /aria-label="Drag Heart to move it"/)
  assert.match(out, /Move Heart earlier/)
  assert.doesNotMatch(html(h(kit.Rows, {items, selected: 'b', onSelect: () => {}})), /dp-row-grip/, 'an order that is not yours has no grip')
  assert.doesNotMatch(html(h(kit.Rows, {items, selected: 'b', onSelect: () => {}, onMove: () => {}, columns: 2})), /dp-row-grip/, 'in columns the hand has no single line to follow: ▲ ▼ and the keys only')
})

test('a row\'s busy light and a short meter', () => {
  assert.match(html(h(kit.Rows, {items: [{id: 'a', name: 'Kite', light: 'lit', busy: true}]})), /data-light="lit" data-tone="accent" data-busy="true"/)
  const meter = html(h(kit.Meter, {value: 0.4, label: 'Evidence'}))
  assert.match(meter, /class="dp-meter"/)
  assert.match(meter, /--f:0\.4/)
  assert.match(meter, /Evidence: 40 %/)
  assert.match(html(h(kit.Meter, {value: undefined})), /no reading/)
})

test('a name that moved a value is shown only with the ring, never from the first draw', () => {
  const out = html(h(kit.ValueBox, {label: 'Coupling', value: 0.3, scale, format: fmt, onChange: () => {}, movedBy: 'Kite'}))
  assert.doesNotMatch(out, /dp-by|data-flash/, 'nothing has moved it yet')
})

// ── the pad ───────────────────────────────────────────────────────────────

const padAxis = (label, value, extra = {}) => ({label, value, def: 0.5, scale: {min: 0, max: 1}, format: fmt, onChange: () => {}, ...extra})

test('a pad stands its handle where the two values put it, with a faint line at each default', () => {
  const out = html(h(kit.Pad, {w: 100, h: 100, label: 'Room', does: 'Across and up.', x: padAxis('Decay', 0.5), y: padAxis('Size', 0.25)}))
  assert.match(out, /dp-cell--pad/)
  assert.match(out, /role="slider"[^>]*aria-valuetext="Decay 0\.5, Size 0\.25"/)
  // plot: left 8, right 92 (x = 8 + .5 × 84 = 50); top 17, bottom 85 (y = 85 − .25 × 68 = 68)
  assert.match(out, /<circle cx="50" cy="68" r="5\.5" class="dp-handle-mark"/)
  assert.equal([...out.matchAll(/class="dp-pad-def"/g)].length, 2, 'a default line for each side')
  assert.match(out, /Room\|Decay 0\.5 · Size 0\.25 — Across and up\./, 'the status bar names it, gives its value and says what it does (#750: the value joins the Info line)')
})

test('a pad with no reading on a side draws no handle and no number: the well says so', () => {
  const out = html(h(kit.Pad, {w: 100, h: 100, label: 'Room', x: padAxis('Decay', undefined), y: padAxis('Size', 0.25)}))
  assert.doesNotMatch(out, /dp-handle-mark|NaN|undefined/)
  assert.match(out, /data-unread="true"/)
  assert.match(out, /—/)
  assert.match(out, /aria-valuetext="no reading"/)
})

test('a pad whose one side the owner refuses stands on the other: the status bar says which', () => {
  const out = html(h(kit.Pad, {w: 100, h: 100, label: 'Room', does: 'Across and up.', x: padAxis('Decay', 0.5, {disabled: 'A reading.'}), y: padAxis('Size', 0.25)}))
  assert.doesNotMatch(out, /data-disabled="true"/, 'half a pad is still a pad')
  assert.match(out, /Decay: A reading\./)
  const both = html(h(kit.Pad, {w: 100, h: 100, label: 'Room', x: padAxis('Decay', 0.5, {disabled: 'A reading.'}), y: padAxis('Size', 0.25, {disabled: 'A reading.'})}))
  assert.match(both, /data-disabled="true"/, 'both sides closed: the pad is closed')
  assert.match(both, /aria-disabled="true"/)
})

test('a pad held by someone offers the value back, and rings as a dial does', () => {
  const out = html(h(kit.Pad, {w: 100, h: 100, label: 'Room', x: padAxis('Decay', 0.5, {heldBy: 'Kite', onHandBack: () => {}}), y: padAxis('Size', 0.25)}))
  assert.match(out, /data-held="true"/)
  assert.match(out, /class="dp-handback"[^>]*>Kite</)
})

// ── the stylesheet's promises ─────────────────────────────────────────────

test('one easing and one set of times, and every one shortens to nothing under reduced motion', () => {
  for (const t of ['--dp-mo-fast', '--dp-mo-light', '--dp-mo', '--dp-ease', '--dp-spring']) assert.match(css, new RegExp(`${t}:`), `${t} is defined`)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ :root \{ --dp-mo-fast: \.01ms; --dp-mo-light: \.01ms; --dp-mo: \.01ms; \} \}/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.dp \*, \.dp-tile \* \{ transition: none !important; animation: none !important; \} \}/, 'the kit\'s stop stays')
})

test('under reduced motion every state still shows: a ring stands still, a name still stands and goes, the hold still shows its progress', () => {
  const reduce = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce) {'))
  // REPLACED (#750): the ring was keyed on data-busy; the kit draws every standing from the one data-standing (Working).
  assert.match(reduce, /\.dp-lamp\[data-standing="working"\]::after[^}]*animation: none[^}]*opacity: \.6/, '`.dp *` does not reach a pseudo-element: the ring is stopped by name and left standing')
  assert.match(reduce, /\.dp-cell\[data-flash\]::after \{ animation: none; opacity: 0; \}/)
  assert.match(reduce, /data-standing="awaiting"[^}]*opacity: \.55/, 'a reading still to come stays dimmed, still (REPLACED #750: data-waiting → data-standing="awaiting")')
  assert.match(reduce, /\.dp-ladder-rung\[data-running="true"\] \{ background:/)
  assert.match(reduce, /\.dp-hold-fill \{ transition: transform var\(--dp-hold, 900ms\) linear !important; \}/)
  assert.match(reduce, /\.dp \.dp-by \{ animation: dp-by-still/)
})

test('nothing loops but what the owner reports', () => {
  const infinite = [...css.matchAll(/([^{}]+)\{[^}]*animation:[^;}]*infinite/g)].map(m => m[1].trim())
  // REPLACED (#750): the owner's reports are the one data-standing (working, awaiting, waiting) and a rung's data-running.
  for (const selector of infinite) assert.match(selector, /data-standing="(working|awaiting|waiting)"|data-running/, `${selector.slice(0, 80)} loops only while the owner reports it`)
  assert.ok(infinite.length >= 4, 'a working light, a rung, a reading to come, a wait')
})
