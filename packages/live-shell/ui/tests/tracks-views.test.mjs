import test from 'node:test'
import assert from 'node:assert/strict'
import {register} from 'node:module'

// T-TRACKS-VIEWS: the shared Session grid and Arrangement ruler at the craft floor. Every behaviour here is read from the
// set's data — parentId, depth, status, stalled, actions, ruler — and no view names a mode.
// - SCRIPTED: the views rendered to static markup (react-dom/server), and the stateless view called directly so its
//   handlers can be read off the element tree and run. There is no DOM, so nothing here proves how it looks or that a click
//   lands: the screen legs (stripes, rails, the now line, the needle's readout) are for the lead's screen pass.
// - CODE-READING: tracks.css is read as text for the rules the markup depends on.
// Loader as f3-tracks.test.mjs.
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
const grid = await import('../src/frame/tracks/SessionGrid.tsx')
const {ArrangementRuler, placeClips} = await import('../src/frame/tracks/ArrangementRuler.tsx')
const {SessionGridView, trackTree, stalledLanes, receiptOf, answerOf} = grid

const SELECT = {select() {}}
const clip = (id, trackId, columnId, label, extra = {}) => ({id, trackId, columnId, label, ...extra})
/** A crew: a group, a lead under it, a helper under the lead, and a lone session; helper stalled, one clip waiting. */
const crew = () => ({
  columns: [{id: 'r1', name: '1'}, {id: 'r2', name: '2'}],
  tracks: [
    {id: 'g', name: 'Crew', kind: 'group', color: '#111111', depth: 0},
    {id: 'lead', name: 'Lead', kind: 'session', color: '#222222', depth: 1, parentId: 'g'},
    {id: 'helper', name: 'Helper', kind: 'session', color: '#333333', depth: 2, parentId: 'lead'},
    {id: 'solo', name: 'Solo', kind: 'session', color: '#444444'},
  ],
  clips: [
    clip('lead#1', 'lead', 'r1', 'plan', {status: 'running'}),
    clip('helper#1', 'helper', 'r1', 'dig', {status: 'stalled'}),
    clip('helper#2', 'helper', 'r2', 'tidy', {status: 'waiting'}),
    clip('solo#1', 'solo', 'r1', 'alone', {status: 'stopped'}),
  ],
})
const noop = () => {}
const view = (set, over = {}) => SessionGridView({set, selection: SELECT, folded: {}, onFold: noop, receipt: null, onPress: noop, onDismiss: noop, ...over})
const html = (set, over = {}) => renderToStaticMarkup(React.createElement(SessionGridView, {set, selection: SELECT, folded: {}, onFold: noop, receipt: null, onPress: noop, onDismiss: noop, ...over}))
const ids = markup => [...markup.matchAll(/data-track="([^"]*)"/g)].map(match => match[1])
const clipIds = markup => [...markup.matchAll(/data-clip="([^"]*)"/g)].map(match => match[1])
const rollups = markup => [...markup.matchAll(/class="cs roll" data-rollup="(\d+)"[^>]*>((?:<i data-status="[a-z]+"><\/i>)+)<\/div>/g)]
  .map(match => [Number(match[1]), [...match[2].matchAll(/data-status="([a-z]+)"/g)].map(m => m[1])])

/** Every element of a rendered tree that satisfies `pred` (the stateless view called directly, so no DOM is needed). */
function find(tree, pred, out = []) {
  if (Array.isArray(tree)) { for (const child of tree) find(child, pred, out); return out }
  if (!tree || typeof tree !== 'object' || !tree.props) return out
  if (pred(tree)) out.push(tree)
  return find(tree.props.children, pred, out)
}

// ── the tree ───────────────────────────────────────────────────────────────────────────────────

test('the parent links are walked outermost first; a missing parent or a cycle ends the walk', () => {
  const set = crew()
  const tree = trackTree(set.tracks)
  const at = id => set.tracks.find(t => t.id === id)
  assert.deepEqual(tree.ancestorsOf(at('helper')).map(t => t.id), ['g', 'lead'], 'the group first, then the lead')
  assert.deepEqual(tree.ancestorsOf(at('g')), []); assert.deepEqual(tree.ancestorsOf(at('solo')), [])
  assert.deepEqual(tree.descendantsOf(at('g')).map(t => t.id), ['lead', 'helper'], 'everything beneath, nearest first')
  assert.equal(tree.children.has('helper'), false, 'a track nothing sits under has no members')
  const orphan = trackTree([{id: 'o', name: 'O', kind: 'k', parentId: 'nowhere'}])
  assert.deepEqual(orphan.ancestorsOf(orphan.byId.get('o')), [], 'a parent the set does not hold is no ancestor')
  const loop = trackTree([{id: 'a', name: 'A', kind: 'k', parentId: 'b'}, {id: 'b', name: 'B', kind: 'k', parentId: 'a'}, {id: 'c', name: 'C', kind: 'k', parentId: 'c'}])
  assert.deepEqual(loop.ancestorsOf(loop.byId.get('a')).map(t => t.id), ['b'], 'a cycle is walked once')
  assert.deepEqual(loop.descendantsOf(loop.byId.get('a')).map(t => t.id), ['b'])
  assert.deepEqual(loop.ancestorsOf(loop.byId.get('c')), [], 'a track under itself sits under nothing')
})

// ── fold, rails, roll-up ───────────────────────────────────────────────────────────────────────

test('a group folds its members by parentId; every ancestor folded hides them, and the group itself stays', () => {
  const set = crew()
  assert.deepEqual(ids(html(set)), ['g', 'lead', 'helper', 'solo'])
  assert.deepEqual(ids(html(set, {folded: {g: true}})), ['g', 'solo'], 'folding the group hides the lead and, beneath it, the helper')
  assert.deepEqual(ids(html(set, {folded: {lead: true}})), ['g', 'lead', 'solo'], 'folding the lead hides its helper only')
  const open = html(set), shut = html(set, {folded: {g: true}})
  assert.match(open, /class="gf" aria-expanded="true" aria-label="Fold Crew"[^>]*>▼</)
  assert.match(shut, /class="gf" aria-expanded="false" aria-label="Unfold Crew"[^>]*>▶</)
  assert.equal((open.match(/class="gf"/g) ?? []).length, 2, 'the group and the lead have members to fold; the helper and the lone session do not')
  assert.match(open, /data-track="g" data-group="true"/, 'a group is marked by data, never by a class of its own')
  const folded = []
  find(view(set, {onFold: id => folded.push(id)}), n => n.props['aria-label'] === 'Fold Crew')[0].props.onClick()
  assert.deepEqual(folded, ['g'], 'the fold button folds its own track')
})

test('one rail per ancestor, each in that ancestor\'s colour, outermost first; an undeclared parent is a rail in the track\'s own colour', () => {
  const markup = html(crew())
  const helper = /<div class="trk sub" role="row" style="([^"]*)" data-track="helper" data-depth="2"[^>]*>(<span class="rails" aria-hidden="true">(?:<i style="[^"]*"><\/i>)+<\/span>)/.exec(markup)
  assert.ok(helper, 'the helper is railed')
  assert.match(helper[1], /--rails:2/)
  assert.deepEqual([...helper[2].matchAll(/background:(#[0-9a-f]{6})/g)].map(m => m[1]), ['#111111', '#222222'], 'the group\'s colour, then the lead\'s')
  const lead = /data-track="lead"[^>]*><span class="rails" aria-hidden="true">((?:<i style="[^"]*"><\/i>)+)<\/span>/.exec(markup)
  assert.deepEqual([...lead[1].matchAll(/background:(#[0-9a-f]{6})/g)].map(m => m[1]), ['#111111'])
  assert.doesNotMatch(markup.slice(markup.indexOf('data-track="g"'), markup.indexOf('data-track="lead"')), /class="rails"/, 'a top-level track has no rail')
  const depthOnly = html({columns: [{id: 'r', name: '1'}], clips: [], tracks: [{id: 'o', name: 'Orphan', kind: 'k', color: '#abcdef', depth: 2}]})
  assert.deepEqual([...depthOnly.matchAll(/background:(#[0-9a-f]{6})/g)].map(m => m[1]), ['#abcdef', '#abcdef'], 'depth 2 with no parent to name: two rails in its own colour')
  assert.match(depthOnly, /class="trk sub"/)
})

test('a group with no clip of its own in a row rolls up its members\' clips by status; its own clip, when it has one, takes the slot', () => {
  const set = crew()
  const markup = html(set)
  const cells = rollups(markup)
  // g: row 1 = lead's running + helper's stalled; row 2 = helper's waiting. lead: row 2 = helper's waiting (it has its own clip in row 1).
  assert.deepEqual(cells, [[2, ['running', 'stalled']], [1, ['waiting']], [1, ['waiting']]])
  assert.match(markup, /title="2 clips from the 2 under Crew in this row · 1 stalled"/)
  assert.equal(clipIds(markup).filter(id => id === 'lead#1').length, 1, 'the lead\'s own clip is a clip, never rolled up in its own cell')
  assert.equal(clipIds(markup).length, set.clips.length, 'a roll-up is not a clip: one data-clip per clip')
  assert.doesNotMatch(markup, /class="cs roll"[^>]*><button/, 'a roll-up launches nothing')
  const owned = crew(); owned.clips.push(clip('g#1', 'g', 'r1', 'crew-wide', {status: 'running'}))
  assert.deepEqual(rollups(html(owned)).map(c => c[0]), [1, 1], 'the group\'s own clip stands in row 1; only the rows it has none in roll up')
  const quiet = html({...set, clips: set.clips.filter(c => c.trackId === 'solo')})
  assert.equal(rollups(quiet).length, 0, 'no member clip in a row: an empty slot, not a roll-up')
  assert.match(quiet, /class="cs" role="gridcell"[^>]*title="Empty slot"/)
  const undisclosed = rollups(html({...set, clips: [clip('lead#1', 'lead', 'r1', 'plan')]}))
  assert.deepEqual(undisclosed, [[1, ['undisclosed']]], 'a member clip whose state is not disclosed ticks as undisclosed, not as any state')
})

// ── status, notes ──────────────────────────────────────────────────────────────────────────────

test('a waiting clip is drawn waiting, distinct from stopped; a clip\'s owner-disclosed absence is on the clip', () => {
  const set = crew()
  set.clips.push(clip('lead#2', 'lead', 'r2', 'queued one', {status: 'waiting', note: 'start time not disclosed by the owner'}))
  const markup = html(set)
  assert.match(markup, /class="cs clip waiting"/); assert.match(markup, /class="cs clip stopped"/)
  assert.match(markup, /data-clip="lead#2"[^>]*title="queued one · Waiting · start time not disclosed by the owner"/)
  assert.match(markup, /<span class="cs-note" role="img" aria-label="start time not disclosed by the owner" title="start time not disclosed by the owner">⚑<\/span>/)
  assert.equal((markup.match(/class="cs-note"/g) ?? []).length, 1, 'only the clip that carries a note')
  const css = rule => new RegExp(`${rule.replaceAll('.', '\\.')}\\s*\\{([^}]*)\\}`).exec(cssText)?.[1] ?? ''
  assert.match(css('.cs.clip.waiting'), /dashed/); assert.match(css('.cs.clip.waiting .tri'), /animation/)
  // R3 (manual §16.6 Session view: "Stopped — Ready, in full colour"; "Done — Dimmed and settled"): the dimming moved from stopped
  // to done. Replaces `assert.match(css('.cs.clip.stopped'), /opacity/)`: stopped carries no rule of its own (full colour), done dims.
  assert.equal(css('.cs.clip.stopped'), '', 'stopped is ready, in full colour'); assert.match(css('.cs.clip.done'), /opacity/)
})

// ── retry and the receipt ──────────────────────────────────────────────────────────────────────

test('a retry exists only where the set carries one, lights on a stalled lane and the groups above it, and nowhere else', () => {
  const set = crew()
  assert.doesNotMatch(html(set), /class="rt/, 'no retry action, no retry button')
  const withRetry = {...set, actions: {retry: {op: 'test:retry', run: id => ({ok: true, note: `retried ${id}`})}}}
  const markup = html(withRetry)
  const retry = name => new RegExp(`class="(rt(?: lit)?)" aria-label="Retry ${name}"`).exec(markup)?.[1]
  assert.deepEqual(['Crew', 'Lead', 'Helper', 'Solo'].map(retry), ['rt lit', 'rt lit', 'rt lit', 'rt'], 'lit while a lane in here has stalled: the stalled lane, and the lead and group above it; the lone healthy session is not')
  assert.match(markup, /title="Retry Helper \(test:retry\) · lit: a lane in here has stalled"/)
  assert.match(markup, /title="Retry Solo \(test:retry\)"/)
  const lanes = stalledLanes(set, trackTree(set.tracks))
  assert.deepEqual([...lanes.own], ['helper']); assert.deepEqual([...lanes.here].sort(), ['g', 'helper', 'lead'])
  // A stalled flag on the track, with no stalled clip, lights it too: the owner's word on the lane.
  const flagged = {...withRetry, tracks: withRetry.tracks.map(t => t.id === 'solo' ? {...t, stalled: true} : t), clips: set.clips.filter(c => c.status !== 'stalled')}
  const flaggedMarkup = html(flagged)
  assert.match(flaggedMarkup, /class="rt lit" aria-label="Retry Solo"/); assert.match(flaggedMarkup, /class="rt" aria-label="Retry Helper"/)
  assert.match(flaggedMarkup, /data-track="solo"[^>]*data-stalled="true"/); assert.doesNotMatch(flaggedMarkup, /data-track="lead"[^>]*data-stalled/)
})

test('a press runs the set\'s own op for the id it names; the owner\'s answer is shown, and marked, where it was pressed', async () => {
  const calls = []
  const op = name => ({op: `test:${name}`, run: id => { calls.push([name, id]); return {ok: true, note: `${name} ${id}`} }})
  const set = {...crew(), actions: {launch: op('launch'), stopTrack: op('stop'), launchStop: op('row'), retry: op('retry')}}
  const presses = []
  const tree = view(set, {onPress: (key, what, run) => presses.push({key, what, run})})
  const click = (pred, arg = {stopPropagation() {}}) => find(tree, pred)[0].props.onClick(arg)
  click(n => n.props['aria-label'] === 'Launch plan')
  click(n => n.props['aria-label'] === 'Stop Solo')
  click(n => n.props.className === 'stop-launch')
  click(n => n.props['aria-label'] === 'Retry Helper')
  assert.deepEqual(presses.map(p => [p.key, p.what]), [['clip:lead#1', 'Launch plan'], ['stop:solo:r2', 'Stop Solo'], ['row:r1', 'Launch row 1'], ['retry:helper', 'Retry Helper']])
  assert.deepEqual(await Promise.all(presses.map(p => answerOf(p.run))), ['launch lead#1', 'stop solo', 'row r1', 'retry helper'].map(text => ({ok: true, text})))
  assert.deepEqual(calls, [['launch', 'lead#1'], ['stop', 'solo'], ['row', 'r1'], ['retry', 'helper']], 'each press reaches only its own op, with the id it names (the empty slot stops its own track; the stop row launches its own row)')
  // Without the action the control is disabled and a press (should one arrive) calls nothing.
  const bare = []
  find(view(crew(), {onPress: (...args) => bare.push(args)}), n => n.props['aria-label'] === 'Stop Solo')[0].props.onClick()
  assert.deepEqual(bare, [])

  const said = html(set, {receipt: {key: 'retry:helper', what: 'Retry Helper', ok: true, text: 'restart → state running'}})
  assert.match(said, /<p class="sg-receipt" role="status" data-ok="true"><b>Retry Helper<\/b><span>restart → state running<\/span><button type="button" aria-label="Dismiss">×<\/button><\/p>/)
  assert.match(said, /aria-label="Retry Helper" data-receipt="ok"/); assert.equal((said.match(/data-receipt=/g) ?? []).length, 1, 'marked only where it was pressed')
  const refused = html(set, {receipt: {key: 'clip:lead#1', what: 'Launch plan', ok: false, text: 'no binding resolved'}})
  assert.match(refused, /data-ok="false"/); assert.match(refused, /data-clip="lead#1"[^>]*data-receipt="refused"/)
  assert.doesNotMatch(html(set), /sg-receipt/, 'no answer, no receipt line')
})

test('an owner\'s answer is read as it was given: a note or a refusal in its words, nothing made up for any other return', async () => {
  assert.deepEqual(receiptOf({ok: true, note: 'stop → state stopped'}), {ok: true, text: 'stop → state stopped'})
  assert.deepEqual(receiptOf({ok: false, error: 'no harness bound'}), {ok: false, text: 'no harness bound'})
  assert.deepEqual(receiptOf({ok: true}), {ok: true, text: 'The owner answered ok and gave no note.'})
  assert.deepEqual(receiptOf({ok: false}), {ok: false, text: 'The owner refused and gave no reason.'})
  for (const other of [undefined, null, 7, 'done', {note: 'x'}, {ok: 'yes'}]) assert.equal(receiptOf(other), null, String(other))
  assert.deepEqual(await answerOf(() => ({ok: true, note: 'now'})), {ok: true, text: 'now'})
  assert.deepEqual(await answerOf(async () => ({ok: false, error: 'later'})), {ok: false, text: 'later'})
  assert.equal(await answerOf(() => 3), null, 'a return that is not an answer shows nothing')
  assert.deepEqual(await answerOf(() => { throw new Error('boom') }), {ok: false, text: 'boom'}, 'a throw is a refusal, said as it was')
  assert.deepEqual(await answerOf(() => Promise.reject(new Error('refused'))), {ok: false, text: 'refused'})
})

// ── the ruler ──────────────────────────────────────────────────────────────────────────────────

const ruled = () => ({
  columns: [{id: 'r1', name: '1'}, {id: 'r2', name: '2'}, {id: 'r3', name: '3'}],
  tracks: [
    {id: 'a', name: 'Alpha', kind: 'session', color: '#111111', needle: 60},
    {id: 'b', name: 'Beta', kind: 'session', color: '#222222', needle: 90},
  ],
  clips: [
    clip('a1', 'a', 'r1', 'ran', {status: 'stopped', at: {start: 10, end: 40}}),
    clip('a2', 'a', 'r2', 'stuck', {status: 'stalled', at: {start: 40, end: 60}}),
    clip('b1', 'b', 'r1', 'going', {status: 'running', at: {start: 50, end: 90}}),
    clip('b2', 'b', 'r2', 'later', {status: 'waiting', at: {start: 100}}),
    clip('b3', 'b', 'r3', 'unplaced'),
  ],
  ruler: {unit: 'seconds', end: 100, now: 100, label: at => `t${at}`, duration: s => `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`},
})
const ruler = (set, selection = SELECT) => renderToStaticMarkup(React.createElement(ArrangementRuler, {set, selection}))

test('with a ruler, only a clip that has an `at` has a place on it, and the ones left to the Session are counted, not hidden', () => {
  const set = ruled()
  assert.deepEqual(placeClips(set).placed.map(p => p.clip.id), ['a1', 'a2', 'b1', 'b2'], 'b3 has no `at`: no place')
  const markup = ruler(set)
  assert.deepEqual(clipIds(markup), ['a1', 'a2', 'b1', 'b2'])
  assert.match(markup, /<p class="tl-note" role="status">1 clip has no place on this ruler: its owner gives none\. The Session grid holds it\.<\/p>/)
  assert.deepEqual(clipIds(html(set)), ['a1', 'a2', 'b1', 'b2', 'b3'], 'the Session holds it')
  const placedOnly = {...set, clips: set.clips.filter(c => c.at)}
  assert.deepEqual(clipIds(html(placedOnly)), clipIds(ruler(placedOnly)), 'Session and Arrangement show the same clips when each has a place')
  assert.doesNotMatch(ruler(placedOnly), /tl-note/)
  // A set with no ruler is unchanged: its rows end to end, every clip placed, nothing left over.
  const rows = {columns: [{id: 'x', name: 'x'}, {id: 'y', name: 'y'}], tracks: [{id: 't', name: 'T', kind: 'k'}],
    clips: [clip('x1', 't', 'x', 'x1', {span: {start: 0, end: 2}}), clip('y1', 't', 'y', 'y1', {span: {start: 0, end: 1}})]}
  assert.deepEqual(placeClips(rows).placed.map(p => [p.clip.id, p.start, p.end]), [['x1', 0, 2], ['y1', 2, 3]])
  assert.doesNotMatch(ruler(rows), /tl-note/)
})

test('a fixed window ends where the ruler says; a point past it stands at its edge; the now line is where the ruler says now is', () => {
  const set = ruled()
  assert.equal(placeClips(set).end, 100)
  assert.equal(placeClips({...set, ruler: {...set.ruler, end: 50}}).end, 50, 'the window is the ruler\'s, whatever the clips hold')
  const natural = placeClips({...set, ruler: {unit: 'seconds'}})
  assert.equal(natural.end, 100, 'no fixed window: the ruler spans what its clips and needles hold')
  const markup = ruler(set)
  assert.equal((markup.match(/class="tl-now" style="left:100%"/g) ?? []).length, 2, 'a now line in each lane, at the ruler\'s now')
  assert.doesNotMatch(ruler({...set, ruler: {...set.ruler, now: undefined}}), /tl-now/, 'no now on the ruler, no now line')
  const early = ruler({...set, ruler: {...set.ruler, now: 25}})
  assert.match(early, /class="tl-now" style="left:25%"/)
  // Inside a 50-wide window the clip 40–60 is held at the window's edge, and the clip at 100 stands at it.
  const narrow = ruler({...set, ruler: {...set.ruler, end: 50}})
  const stuck = /data-clip="a2"[^>]*style="left:([\d.]+)%;width:max\(6px, ([\d.]+)%\)"/.exec(narrow)
  assert.ok(Math.abs(Number(stuck[1]) - 80) < 1e-9 && Math.abs(Number(stuck[2]) - 20) < 1e-9, `held to the window: ${stuck[0]}`)
  for (const m of narrow.matchAll(/left:([\d.]+)%/g)) assert.ok(Number(m[1]) <= 100, `nothing stands past the window's edge: ${m[0]}`)
  assert.match(ruler({...set, ruler: {...set.ruler, label: undefined}}), /aria-label="Ruler in seconds"/)
  assert.match(markup, /<span class="end" style="left:100%">t100<\/span>/, 'the last mark reaches back from the edge instead of past it')
})

test('a stalled needle is in the stall colour with its age; a healthy needle is a plain one; no clock, no age', () => {
  const set = ruled()
  const markup = ruler(set)
  assert.match(markup, /class="tl-needle" style="left:60%" data-stalled="true" title="Alpha · stalled 0m 40s"><span class="tl-readout">Alpha · stalled 0m 40s<\/span><\/span>/)
  assert.match(markup, /class="tl-needle" style="left:90%" data-edge="end" title="Beta has got to t90"><\/span>/, 'the healthy needle keeps its plain look and says where it has got to')
  assert.equal((markup.match(/class="tl-needle"/g) ?? []).length, 2, 'both needles keep the one class; the stall is data')
  assert.match(ruler({...set, ruler: {...set.ruler, duration: undefined}}), /Alpha · stalled 40 seconds/, 'no duration given: the number and the ruler\'s unit')
  const noClock = ruler({...set, ruler: {...set.ruler, now: undefined}})
  assert.match(noClock, /<span class="tl-readout">Alpha · stalled<\/span>/, 'the ruler says no now: the age is not made up')
  // The lane's flag alone stalls it, with no stalled clip.
  const flagged = {...set, tracks: set.tracks.map(t => t.id === 'b' ? {...t, stalled: true} : t)}
  assert.match(ruler(flagged), /data-stalled="true" data-edge="end" title="Beta · stalled 0m 10s"/)
  const css = cssText
  assert.match(css, /\.tl-needle\[data-stalled\]\s*\{[^}]*var\(--stalled\)/)
  assert.match(css, /\.tl-readout\s*\{[^}]*color:\s*var\(--stalled\)/)
})

test('a running clip has no right edge; a waiting clip with no length is a dash; one with a length is drawn waiting', () => {
  const set = ruled()
  const markup = ruler(set)
  assert.match(markup, /class="tl-clip running"/); assert.match(markup, /class="tl-clip stalled"/); assert.match(markup, /class="tl-clip stopped"/)
  assert.match(markup, /data-clip="b2" data-clip-status="waiting" class="tl-clip waiting dash" style="right:calc\(100% - 100%\)"[^>]*>▸ later<\/button>/, 'a dash and a name, reaching back from the window\'s end')
  assert.match(markup, /title="going · t50 – t90 · Running · no end is drawn: its needle is the edge"/)
  assert.match(markup, /title="later · t100 · Waiting · no length is drawn"/)
  const early = {...set, clips: set.clips.map(c => c.id === 'b2' ? {...c, at: {start: 20}} : c)}
  assert.match(ruler(early), /class="tl-clip waiting dash" style="left:20%"/, 'a dash early in the window stands to the right of its point')
  const spanned = {...set, clips: set.clips.map(c => c.id === 'b2' ? {...c, at: {start: 20, end: 30}} : c)}
  assert.match(ruler(spanned), /class="tl-clip waiting" style="left:20%;width:max\(6px, 10%\)"/, 'a waiting clip that has a length is a clip, not a dash')
  assert.match(cssText, /\.tl-clip\.running\s*\{[^}]*mask-image/)
  assert.match(cssText, /\.tl-clip\.dash\s*\{[^}]*dashed/)
})

test('helpers step in on the ruler as in the Session: a rail per ancestor in the ancestor\'s colour', () => {
  const set = {...crew(), ruler: {unit: 'seconds'}}
  const markup = ruler(set)
  const head = name => new RegExp(`title="${name} · session"[^>]*>((?:<span class="rails" aria-hidden="true">(?:<i style="[^"]*"></i>)+</span>)?)`).exec(markup)?.[1] ?? ''
  assert.deepEqual([...head('Helper').matchAll(/background:(#[0-9a-f]{6})/g)].map(m => m[1]), ['#111111', '#222222'])
  assert.equal(head('Solo'), '', 'a top-level track has no rail')
  assert.match(markup, /class="tl-lane" style="--tc:#333333;--rails:2" data-track="helper"/)
})

// ── the laws ───────────────────────────────────────────────────────────────────────────────────

test('the views know no mode, and the stylesheet takes no raw colour and survives a stall colour the scope does not define', async () => {
  for (const view of ['SessionGrid.tsx', 'ArrangementRuler.tsx']) {
    const source = await readFile(new URL(`../src/frame/tracks/${view}`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /'(live|base|central|factory|expressions|techne|audio)'/, `${view} names no mode`)
    assert.doesNotMatch(source, /[!=]==\s*'(live|base|central|factory|expressions|techne|audio)'/)
    assert.doesNotMatch(source, /#[0-9a-fA-F]{6}\b|rgba?\(/, `${view} takes no raw colour`)
  }
  const bare = cssText.replace(/\/\*[\s\S]*?\*\//g, '')
  assert.doesNotMatch(bare, /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/, 'tracks.css takes no raw colour: a track\'s own colour arrives as --tc')
  assert.match(bare, /--stalled:\s*var\(--stall,\s*var\(--accent-dim,\s*var\(--accent\)\)\)/, '--stall is defined inside the agent frame only: the stall colour must fall back to a shell token')
  assert.doesNotMatch(bare.replace(/--stalled:[^;}]*/, ''), /var\(--stall\)/, 'nothing reads --stall bare')
})

test('the empty track takes a drop only where the set can seat what is dropped', async () => {
  const {SessionGridView} = await import('../src/frame/tracks/SessionGrid.tsx')
  const base = {columns: [{id: 'r', name: '1'}], tracks: [{id: 't', name: 'T', kind: 'k'}], clips: []}
  const props = {selection: {select() {}}, folded: {}, onFold() {}, receipt: null, onPress() {}, onDismiss() {}}
  const bare = renderToStaticMarkup(React.createElement(SessionGridView, {...props, set: base}))
  assert.doesNotMatch(bare, /data-seat-drop/, 'no seat, no drop target')
  const seated = renderToStaticMarkup(React.createElement(SessionGridView, {...props, set: {...base, actions: {seat: {op: 'owner:new', accepts: 'application/x-test', run() {}}}}}))
  assert.match(seated, /data-seat-drop="open"/); assert.match(seated, /owner:new/)
})
