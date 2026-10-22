import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// W4, the Session grid drawn to its design (catalogue dlw__session-grid.tsx FullGrid, dlw__session-grid.css .sgd-cell): the clip cell's
// second line (how it plays, what follows it, its takes) in the design's 52px cell, and a running clip's progress only where its owner
// reads it. Every established behaviour stays: the roll-up, the rails, launch, stop, record, retry, the empty track's drop, the returns,
// the Main column.
// - SCRIPTED: the view rendered to static markup (react-dom/server). There is no DOM, so nothing here proves how it looks: the headless
//   screen pass in the W4 return does that.
// - CODE-READING: tracks.css read as text for the rules the markup depends on.
// Loader as tracks-views.test.mjs.
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
const React = await import('react')
const {renderToStaticMarkup} = await import('react-dom/server')
const {readFile} = await import('node:fs/promises')
const cssText = await readFile(new URL('../src/frame/tracks/tracks.css', import.meta.url), 'utf8')
const {SessionGridView, clipSecondLine, clipProgress} = await import('../src/frame/tracks/SessionGrid.tsx')

const noop = () => {}
const SELECT = {select: noop}
const rule = selector => new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(cssText)?.[1] ?? ''
const html = (set, extra = {}) => renderToStaticMarkup(React.createElement(SessionGridView,
  {set, selection: SELECT, folded: {}, onFold: noop, receipt: null, onPress: noop, onDismiss: noop, ...extra}))
const line = clip => { const node = clipSecondLine(clip); return node === null ? null : renderToStaticMarkup(node) }

test('the cell stands the design\'s 52px, and an empty slot\'s square stands in its middle', () => {
  assert.match(rule('.cs'), /height: 52px/, 'catalogue dlw__session-grid.css .sgd-cell: height 52px')
  assert.match(rule('.cs[data-slot-track]'), /justify-content: center/, 'dlw__session-grid.css .sgd-cell[data-empty]: the square in the middle')
  assert.match(rule('.cs.sect-band'), /height: 16px/, 'a section\'s head row keeps its own height')
})

test('the second line says how a clip plays, what follows it and its takes, in its owner\'s words; once and nothing draw nothing', () => {
  assert.equal(line({launch: {mode: 'hold', follow: 'next'}, takes: [{id: 'a', name: '1'}, {id: 'b', name: '2', standing: true}]}),
    '<small class="cs-sub"><span class="cs-mode">hold</span> · <span class="cs-follow">→ next</span> · <span class="cs-takes">2 takes</span></small>')
  assert.equal(line({launch: {mode: 'loop'}}), '<small class="cs-sub"><span class="cs-mode">loop</span></small>', 'the mode alone')
  assert.equal(line({launch: {follow: 'stop 2/3 · Rosinus'}}), '<small class="cs-sub"><span class="cs-follow">→ stop 2/3 · Rosinus</span></small>', 'a follow alone, as the owner words it')
  assert.equal(line({launch: {mode: 'once'}}), null, 'the design draws once, the default, as nothing')
  assert.equal(line({launch: {mode: 'Once', follow: 'next'}}), '<small class="cs-sub"><span class="cs-follow">→ next</span></small>')
  assert.equal(line({launch: {quantize: 'next turn'}}), null, 'a quantize alone stands in the foot, not the second line')
  assert.equal(line({}), null, 'nothing to say, no line')
  assert.equal(line({takes: []}), null, 'no takes, no line')
})

test('a running clip\'s progress is its owner\'s elapsed over its expected length; with no reading there is none, and none is made up', () => {
  assert.equal(clipProgress({status: 'running', progress: {elapsed: 33, expected: 60}}), 55)
  assert.equal(clipProgress({status: 'running', progress: {elapsed: 90, expected: 60}}), 100, 'an overrun stands at the end, never past it')
  assert.equal(clipProgress({status: 'running', progress: {elapsed: 0, expected: 60}}), 0)
  assert.equal(clipProgress({status: 'running'}), null, 'no reading, no progress')
  assert.equal(clipProgress({status: 'stopped', progress: {elapsed: 33, expected: 60}}), null, 'only a running clip has got somewhere')
  assert.equal(clipProgress({status: 'running', progress: {elapsed: 10, expected: 0}}), null, 'no expected length, no progress')
  assert.equal(clipProgress({status: 'running', progress: {elapsed: Number.NaN, expected: 60}}), null)
  assert.equal(clipProgress({status: 'running', progress: {elapsed: -1, expected: 60}}), null)
  assert.equal(clipProgress({status: 'running', progress: {elapsed: 10, expected: Number.POSITIVE_INFINITY}}), null)
})

test('the grid draws the read progress as the design\'s fill, and keeps the fill that grows with no end where none is read', () => {
  const set = {columns: [{id: 'r1', name: '1'}, {id: 'r2', name: '2'}], tracks: [{id: 't', name: 'Lead', kind: 'session', color: '#5cc6b4'}],
    clips: [{id: 'read', trackId: 't', columnId: 'r1', label: 'map field', status: 'running', progress: {elapsed: 33, expected: 60}},
      {id: 'unread', trackId: 't', columnId: 'r2', label: 'widget tests', status: 'running'}]}
  const markup = html(set)
  assert.match(markup, /data-clip="read" data-clip-status="running" data-progress="55" title="map field · Running · 55% through, as its owner reads it" style="--p:55"/)
  assert.match(markup, /data-clip="unread" data-clip-status="running" title="widget tests · Running"/, 'no reading: no progress attribute and no number')
  assert.doesNotMatch(markup, /data-clip="unread"[^>]*data-progress/)
  assert.match(rule('.cs.clip.running[data-progress]'), /linear-gradient\(90deg, var\(--tc\) 0, var\(--tc\) calc\(var\(--p, 0\) \* 1%\)/, 'the fill stands at the reading')
  assert.match(rule('.cs.clip.running[data-progress]::before'), /display: none/, 'the growing fill gives way to the reading')
  assert.match(rule('.cs.clip.running::before'), /animation: tracks-fill/, 'manual §16.6: running is a slow blink and a fill that grows, with no end drawn')
})

test('the cell carries its mode in its title, and its second line in the cell, as read', () => {
  const set = {columns: [{id: 'r1', name: '1'}], tracks: [{id: 't', name: 'Walk', kind: 'occurrences'}],
    clips: [{id: 'c', trackId: 't', columnId: 'r1', label: 'Rosinus', status: 'stopped', launch: {mode: 'hold', follow: 'stop 2/3'}}]}
  const markup = html(set)
  assert.match(markup, /title="Rosinus · Stopped · plays hold · then stop 2\/3"/)
  assert.match(markup, /<span class="cs-text"><span class="cs-label">Rosinus<\/span><small class="cs-sub"><span class="cs-mode">hold<\/span> · <span class="cs-follow">→ stop 2\/3<\/span><\/small><\/span>/)
})

test('every established behaviour stands: the roll-up, the rails, launch, stop, record, retry, the drop, the returns and the Main column', () => {
  const set = {
    columns: [{id: 'r1', name: '1'}, {id: 'r2', name: '2'}],
    tracks: [
      {id: 'g', name: 'Crew', kind: 'group', color: '#111111'},
      {id: 'lead', name: 'Lead', kind: 'session', color: '#222222', depth: 1, parentId: 'g'},
      {id: 'arm', name: 'Armed', kind: 'session', color: '#444444', mix: {arm: true}},
      {id: 'cell', name: 'Workcell', kind: 'workcell', returns: true},
    ],
    clips: [{id: 'l1', trackId: 'lead', columnId: 'r1', label: 'plan', status: 'stalled'}],
    actions: {
      launch: {op: 'test:launch', run: noop}, launchStop: {op: 'test:row', run: noop}, stopTrack: {op: 'test:stop', run: noop},
      retry: {op: 'test:retry', run: noop}, recordSlot: {op: 'test:record', run: noop}, seat: {op: 'test:seat', accepts: 'text/x-agent', run: noop},
      stopAll: {op: 'test:stop-all', run: noop},
    },
  }
  const markup = html(set)
  assert.match(markup, /class="cs roll" data-rollup="1"/, 'the group rolls up its member\'s clip, open as it always did')
  assert.match(markup, /data-track="lead"[^>]*>(?:(?!data-track=).)*<span class="rails" aria-hidden="true"><i style="background:#111111">/, 'a rail per ancestor')
  assert.match(rule('.rails'), /top: 0; bottom: 0/, 'the rails run the column\'s full height')
  assert.match(markup, /class="tri" aria-label="Launch plan"/, 'a clip\'s launch')
  assert.match(markup, /class="sg2" aria-label="Stop Crew"/, 'an empty slot\'s stop square')
  assert.match(markup, /class="sg-rec" aria-label="Record on Armed"/, 'an armed track\'s empty slot records')
  assert.match(markup, /class="rt lit" aria-label="Retry Lead"/, 'a stalled lane lights its retry')
  assert.match(markup, /class="sg-fill" data-seat-drop="open"/, 'the empty track takes a drop')
  assert.ok(markup.indexOf('data-track="cell"') > markup.indexOf('class="sg-fill"'), 'a return track stands after the empty track')
  assert.ok(markup.indexOf('aria-label="Stops"') > markup.indexOf('data-track="cell"'), 'the Main column stands last')
  assert.match(markup, /class="sa" aria-label="Stop All"/)
  assert.match(markup, /class="stop-launch"[^>]*title="Launch the row: every clip in it \(test:row\)"/, 'a row\'s launcher')
  assert.match(markup, /<footer class="sg-legend" aria-label="Legend">/)
})
