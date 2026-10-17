import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {register} from 'node:module';

// Seam 5 (UX-SPINE-ALIGNMENT §5 row 5; WORLD-SHELL-DESIGN §1, Revision 2):
// a clip carries the standing its source states, drawn in the shared grammar
// and announced in its accessible name. Placement never changes standing.
// The loader is the timeline-time-spine one (CSS stubbed, extensionless
// relative imports resolved, TSX transpiled).

const root = new URL('../../../../', import.meta.url);
const compiler = new URL('desktop/cradle/node_modules/typescript/lib/typescript.js', root).href;
register(`data:text/javascript,${encodeURIComponent(`
import ts from ${JSON.stringify(compiler)};
import {readFile} from 'node:fs/promises';
export async function resolve(specifier,context,next){
  try{return await next(specifier,context)}catch(error){
    if(!specifier.startsWith('.'))throw error;
    if(specifier.endsWith('.js')){try{return await next(specifier.slice(0,-3)+'.ts',context)}catch{}}
    for(const suffix of ['.ts','.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    for(const suffix of ['/index.ts','/index.tsx']){try{return await next(specifier+suffix,context)}catch{}}
    throw error;
  }
}
export async function load(url,context,next){
  if(url.endsWith('.css'))return {format:'module',shortCircuit:true,source:'export {}'};
  if(!url.endsWith('.ts')&&!url.endsWith('.tsx'))return next(url,context);
  return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX},fileName:new URL(url).pathname}).outputText};
}`)}`, import.meta.url);

const {eventStanding, standingInputOf, readStanding} = await import('../src/timeline/timeSpine.ts');
const {standingOf} = await import('../../../../desktop/cradle/src/techne/m0m5/timeline/standing.ts');
const {projectQlPhysicsTracks} = await import('../src/timeline/qlPhysicsTrackAdapter.ts');

const DAY = '2026-10-06';
const at = (hour) => Date.UTC(2026, 9, 6, hour, 0, 0);

// The authority is the only reader: every reading below is standingOf over disclosed fields.
const UNDISCLOSED = {standing: null, source_ref: null, evidence_refs: [], derivation_ref: null};

// ── 1 — the kernel row: its disclosed source and evidence, read by the authority ─

test('a kernel reading with its stream identity disclosed reads as sourced, by standingOf, not a constant', () => {
  const row = {stream: 'central-now', kind: 'now', subject_ref: 'now:1', stream_position: 'now:1', instant_unix_ms: at(9), evidence_refs: []};
  assert.deepEqual(standingInputOf(row), {standing: null, source_ref: 'central-now:now:1', evidence_refs: [], derivation_ref: null});
  const reading = eventStanding(row);
  assert.equal(reading.visual, 'sourced');
  assert.deepEqual(reading, standingOf(standingInputOf(row)), 'eventStanding is the authority reading of the disclosed input');
  assert.match(reading.rule, /source or evidence ref is disclosed/);
});

test('a kernel reading with evidence refs but no stream position still reads as sourced', () => {
  const row = {stream: 'wiki-returns', kind: 'return', subject_ref: 'central:path:a.md', evidence_refs: ['central:path:a.md']};
  assert.equal(eventStanding(row).visual, 'sourced');
});

test('a kernel reading that discloses nothing reads as unavailable (standing unknown), never fact', () => {
  const row = {subject_ref: 'x', summary: 'bare'};
  const reading = eventStanding(row);
  assert.equal(reading.visual, 'unavailable');
  assert.equal(reading.verbatim, null);
  assert.match(reading.rule, /standing unknown, never guessed/);
});

test('placement never changes a kernel reading class: kind, instant, day, undated or moved', () => {
  const base = {stream: 'central-now', stream_position: 'now:1', evidence_refs: ['now:1/record.json'], subject_ref: 'now:1'};
  const placements = [
    {kind: 'now', instant_unix_ms: at(9), day_ref: `central:day:control:root:${DAY}`},
    {kind: 'return', instant_unix_ms: null, day_ref: null},
    {kind: 'run', instant_unix_ms: Date.UTC(2099, 0, 1), day_ref: null},
    {kind: 'thought', instant_unix_ms: null, day_ref: '2026-09-01'},
  ];
  for (const placement of placements) {
    assert.equal(eventStanding({...base, ...placement}).visual, 'sourced', `${placement.kind} keeps sourced`);
  }
  assert.equal(eventStanding({subject_ref: 'a', instant_unix_ms: at(1)}).visual, 'unavailable', 'a placed but undisclosed reading is unavailable, not fact');
});

// ── 2 — a family's stated word, read by the same authority ─────────────────────────

test('a stated hypothesis reads as derived with the verbatim word kept; disputed reads as disputed', () => {
  const hyp = readStanding({...UNDISCLOSED, standing: 'hypothesis'});
  assert.equal(hyp.visual, 'derived');
  assert.equal(hyp.verbatim, 'hypothesis');
  const disputed = readStanding({...UNDISCLOSED, standing: 'disputed'});
  assert.equal(disputed.visual, 'disputed');
  assert.equal(disputed.verbatim, 'disputed');
});

test('a family clip with a stated word keeps it; an unstated one reads unavailable; a visual-only glyph is not passed a standing', () => {
  const set = projectQlPhysicsTracks({
    columns: [{id: 'composition-1', name: 'Composition 1'}],
    presentedColumnId: 'composition-1',
    lanes: [
      {id: 'chladni', name: 'Chladni plate', role: 'resonator', spanUnit: 'seconds', clips: [
        {id: 'stated', label: 'plate modes', start: 0, end: 2.5, standing: 'hypothesis'},
        {id: 'unstated', label: 'plate rest', start: 3, end: 4},
      ]},
      {id: 'ghost', name: 'Glyph motion', role: 'visual-only', spanUnit: 'm1-ticks', clips: [{id: 'glyph', label: 'glyph drift', start: 0, end: 12}]},
    ],
  });
  const byId = (id) => set.clips.find((clip) => clip.id === `ql-physics-clip:${id}`);
  assert.equal(byId('stated').standing.visual, 'derived');
  assert.equal(byId('stated').standing.verbatim, 'hypothesis');
  assert.equal(byId('unstated').standing.visual, 'unavailable', 'nothing disclosed reads unavailable');
  assert.equal(byId('glyph').standing.visual, 'unavailable', 'the visual-only role is not a standing: the glyph reads by its source');
  assert.equal(byId('glyph').standing.verbatim, null, 'the role word is never passed as a stated standing');
  assert.equal(byId('glyph').state, 'visual-only', 'the legacy state word is unchanged for the QL test');
  assert.match(byId('stated').label, /· hypothesis/, 'the stated word rides the label, as before');
});

// ── 3 — drawing the class ────────────────────────────────────────────────────────────────
// The World cut presentation drew each clip in its class (data-standing, the grammar's stroke and dash, the class in the clip's
// accessible name). It was drawn by nothing once the tracks pane became the centre, and was deleted on 15 Oct (FOUNDATION §7).
// The readings above still ride every clip (`clip.standing`); the shared Session grid and Arrangement ruler do not draw them
// yet — clipStandingMark, in that presentation at git 09a573a1d, is the port source.
