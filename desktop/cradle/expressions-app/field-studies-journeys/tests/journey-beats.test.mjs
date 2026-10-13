// lane-5 T1-T3: the journey beat surface's pure glue. One beat card per scene-bearing
// binding (identity = the verbatim scene_ref), composition routed as exactly one
// scene_create, and reorder routed as exactly one scene_reorder naming the disclosed
// refs. Run after `npm run build:journeys` (this suite imports the bundled build/ module).
import test from 'node:test';
import assert from 'node:assert/strict';
import {journeyBeatView, composeSceneRequest, reorderSceneRequest, SCENE_READING_PENDING} from '../build/journeyBeats.js';
import {settleBounded, beatLoadKey} from '../build/journeyLoadSchedule.js';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const EXPRESSION = 'oi.expression:probe';
const ONE = `${EXPRESSION}:scene:one`;
const TWO = `${EXPRESSION}:scene:two`;
const GHOST = `${EXPRESSION}:scene:ghost`;

// The kernel document as the journey holds it: two native scenes at revision 7.
const DOC = {
  schema: 'oi.expression/v1',
  expression_ref: EXPRESSION,
  revision: 7,
  scenes: [{scene_ref: ONE, title: 'One'}, {scene_ref: TWO, title: 'Two'}],
};

const JOURNEY_REASON = 'the journey instrument has no scene beats for this subject';

function reading(overrides = {}) {
  return {
    contract: 'ql.techne/v1',
    reading_ref: 'ql.techne:reading:probe',
    snapshot: {revision: 'rev-1', basis_ref: null},
    subject: {subject_ref: EXPRESSION, native_owner: 'oi.cradle.kernel', kind: 'expression-scene'},
    whole: {whole_ref: EXPRESSION, member_refs: [EXPRESSION], relations: [], focus_refs: []},
    temporal: [{facet_ref: 't:1', kind: 'occurrence', instant: '2026-09-19T10:00:00Z', precision: 'day'}],
    spatial: [{place_ref: 'place:here', precision: 'region', identity: {names: [{name: 'Here'}]}}],
    provenance: [{source_ref: 'central:source:probe', source_revision: 'r3', native_owner: 'central'}],
    expressions: [
      {expression_ref: EXPRESSION, revision: '7', scene_ref: ONE},
      {expression_ref: EXPRESSION, revision: '7', scene_ref: TWO},
    ],
    actions: [{action_ref: 'oi.expression.edit', native_owner: 'oi.cradle.kernel', authority: 'owner', summary: 'Edit the bound Expression'}],
    disclosure: {
      instruments: [
        {instrument: 'journey', available: true, m_prime: 3, reading: '4:2-deep'},
      ],
      application_cuts: [{cut: '4:2-deep', available: true}],
      degraded: [],
      suggestions: [],
    },
    ...overrides,
  };
}

function draftOf(scene_order, overrides = {}) {
  return {expression_ref: EXPRESSION, revision: '7', scene_order, pace: [], ...overrides};
}

// ---- T1: the beat surface

test('T1: one card per scene-bearing binding, in binding order, identity byte-identical to the kernel scenes', () => {
  const view = journeyBeatView(reading(), DOC);
  assert.equal(view.unavailableReason, undefined);
  assert.deepEqual(view.cards.map((card) => card.scene_ref), [ONE, TWO]);
  const kernelRefs = new Set(DOC.scenes.map((scene) => scene.scene_ref));
  for (const card of view.cards) assert.ok(kernelRefs.has(card.scene_ref), `card ${card.scene_ref} is a kernel scene ref verbatim`);
  assert.ok(view.cards.every((card, index) => card.title.endsWith(index === 0 ? 'one' : 'two') && card.title.length > 0), 'the title is derived from the ref, never a replacement');
  assert.ok(view.cards.every((card) => card.onBasis), 'every disclosed scene is on the native revision');
});

test('T1: a card takes facet chips only from its own Scene reading; until that reading settles it says so, never the whole', () => {
  // T13: the Expression-wide reading's facets are not shown on any card. Before the card's own Scene reading arrives it is pending.
  const pending = journeyBeatView(reading(), DOC).cards;
  assert.ok(pending.every((card) => card.chips.length === 0 && card.chipsReason === SCENE_READING_PENDING), 'no card borrows the whole reading facets');
  // Once the Scene's own reading arrives, its facets are the card's, in the reading own vocabulary.
  const frames = new Map([[ONE, reading({expressions: [{expression_ref: EXPRESSION, revision: '7', scene_ref: ONE}]})]]);
  const [first] = journeyBeatView(reading(), DOC, frames).cards;
  assert.equal(first.chipsReason, undefined);
  const time = first.chips.filter((chip) => chip.kind === 'time');
  const place = first.chips.filter((chip) => chip.kind === 'place');
  const source = first.chips.filter((chip) => chip.kind === 'source');
  assert.deepEqual(time, [{kind: 'time', ref: 't:1', label: 'occurrence · 2026-09-19T10:00:00Z'}]);
  assert.deepEqual(place, [{kind: 'place', ref: 'place:here', label: 'Here · region'}]);
  assert.deepEqual(source, [{kind: 'source', ref: 'central:source:probe', label: 'central:source:probe · r3'}]);
});

test('T1: a scene on another revision keeps its card but is not on the basis', () => {
  const stale = {...DOC, revision: 8};
  const view = journeyBeatView(reading(), stale);
  assert.deepEqual(view.cards.map((card) => card.onBasis), [false, false]);
  assert.deepEqual(view.cards.map((card) => card.scene_ref), [ONE, TWO], 'identity still verbatim');
});

test('T1: a reading with no scene-bearing binding shows the disclosure reason and invents no beat', () => {
  const sceneless = reading({
    expressions: [{expression_ref: EXPRESSION, revision: '7'}],
    disclosure: {instruments: [{instrument: 'journey', available: false, reason: JOURNEY_REASON}], application_cuts: [], degraded: [], suggestions: []},
  });
  const view = journeyBeatView(sceneless, DOC);
  assert.deepEqual(view.cards, []);
  assert.equal(view.unavailableReason, JOURNEY_REASON, 'the disclosure own reason, verbatim');
});

test('T1: a reading that binds no Expression at all yields the derived reason, still no beat', () => {
  const unbound = reading({expressions: []});
  const view = journeyBeatView(unbound, DOC);
  assert.deepEqual(view.cards, []);
  assert.equal(view.unavailableReason, 'no Expression is bound to this subject');
});

// ---- T2: composition is one routed scene_create

test('T2: a composed scene is exactly one scene_create, CAS-gated on the disclosed revision', () => {
  const result = composeSceneRequest({reading: reading(), doc: DOC, focus_refs: [ONE], title: 'Three'});
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.request.operation, 'edit');
  assert.equal(result.request.expression_ref, EXPRESSION);
  assert.equal(result.request.expected_revision, 7);
  assert.deepEqual(result.request.changes, [{change: 'scene_create', scene_ref: `${EXPRESSION}:scene:three`, title: 'Three'}]);
  assert.equal(result.request.changes.length, 1, 'exactly one change');
  assert.equal(result.route.action_ref, 'oi.expression.edit', 'the disclosed owner action is named verbatim');
});

test('T2: a colliding title is refused with the floor reason and emits no request', () => {
  const result = composeSceneRequest({reading: reading(), doc: DOC, focus_refs: [ONE], title: 'Two'});
  assert.equal(result.ok, false);
  assert.match(result.reason, /already disclosed by reading/);
  assert.equal(result.request, undefined);
});

test('T2: a collision with a native scene the reading does not disclose is refused at document level', () => {
  const sceneOnly = reading({expressions: [{expression_ref: EXPRESSION, revision: '7', scene_ref: ONE}]});
  const result = composeSceneRequest({reading: sceneOnly, doc: DOC, focus_refs: [ONE], title: 'Two'});
  assert.equal(result.ok, false);
  assert.match(result.reason, /already exists in oi\.expression:probe/);
});

test('T2: a title that yields no scene name is refused, never minted', () => {
  const result = composeSceneRequest({reading: reading(), doc: DOC, focus_refs: [ONE], title: '   '});
  assert.equal(result.ok, false);
  assert.match(result.reason, /usable scene name/);
});

test('T2: a reading disclosed at another revision is refused before any proposal', () => {
  const result = composeSceneRequest({reading: reading(), doc: {...DOC, revision: 8}, focus_refs: [ONE], title: 'Three'});
  assert.equal(result.ok, false);
  assert.match(result.reason, /disclosed at revision 7/);
});

test('T2: a reading for another Expression is refused', () => {
  const result = composeSceneRequest({reading: reading(), doc: {...DOC, expression_ref: 'oi.expression:other'}, focus_refs: [ONE], title: 'Three'});
  assert.equal(result.ok, false);
  assert.match(result.reason, /not the open native Expression/);
});

test('T2: a bound content type whose material is absent is refused, never silently stripped', () => {
  const noActions = reading({actions: []});
  const result = composeSceneRequest({reading: noActions, doc: DOC, focus_refs: [ONE], title: 'Three', ct: 'CT2'});
  assert.equal(result.ok, false);
  assert.match(result.reason, /CT2/);
});

test('T2: an unbound reading has nothing to compose into', () => {
  const result = composeSceneRequest({reading: reading({expressions: []}), doc: DOC, focus_refs: [ONE], title: 'Three'});
  assert.equal(result.ok, false);
  assert.match(result.reason, /no Expression is bound/);
});

// ---- T3: reorder is one routed scene_reorder naming the disclosed refs

test('T3: a reordered draft is exactly one scene_reorder naming the disclosed refs in the new order', () => {
  const result = reorderSceneRequest({reading: reading(), doc: DOC, draft: draftOf([TWO, ONE])});
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.request.expected_revision, 7);
  assert.deepEqual(result.request.changes, [{change: 'scene_reorder', scene_refs: [TWO, ONE]}]);
  assert.equal(result.request.changes.length, 1, 'exactly one change');
});

test('T3: the local pace never enters the routed request', () => {
  const paced = draftOf([TWO, ONE], {pace: [{scene_ref: ONE, dwell_seconds: 9}]});
  const result = reorderSceneRequest({reading: reading(), doc: DOC, draft: paced});
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(result.request).includes('dwell'), false);
  assert.equal(result.request.changes.length, 1);
});

test('T3: a draft naming an undisclosed ref is refused with the floor error', () => {
  const result = reorderSceneRequest({reading: reading(), doc: DOC, draft: draftOf([ONE, GHOST])});
  assert.equal(result.ok, false);
  assert.match(result.reason, /is not disclosed by reading/);
  assert.equal(result.request, undefined);
});

test('T3: a draft that drops a disclosed ref is refused, never dropped silently', () => {
  const result = reorderSceneRequest({reading: reading(), doc: DOC, draft: draftOf([ONE])});
  assert.equal(result.ok, false);
  assert.match(result.reason, /reorder, never drop/);
});

test('T3: a reading that names fewer scenes than the kernel holds routes no partial order', () => {
  const partial = reading({expressions: [{expression_ref: EXPRESSION, revision: '7', scene_ref: ONE}]});
  const result = reorderSceneRequest({reading: partial, doc: DOC, draft: draftOf([ONE])});
  assert.equal(result.ok, false);
  assert.match(result.reason, /names 1 of its 2 scenes/);
  assert.equal(result.request, undefined);
});

test('T3: a disclosed scene the kernel does not hold is refused', () => {
  const extra = reading({expressions: [
    {expression_ref: EXPRESSION, revision: '7', scene_ref: ONE},
    {expression_ref: EXPRESSION, revision: '7', scene_ref: TWO},
    {expression_ref: EXPRESSION, revision: '7', scene_ref: GHOST},
  ]});
  const result = reorderSceneRequest({reading: extra, doc: DOC, draft: draftOf([ONE, TWO, GHOST])});
  assert.equal(result.ok, false);
  assert.match(result.reason, /is not held by/);
});

test('T3: the draft at the authored order routes nothing', () => {
  const result = reorderSceneRequest({reading: reading(), doc: DOC, draft: draftOf([ONE, TWO])});
  assert.equal(result.ok, false);
  assert.match(result.reason, /keeps the authored scene order/);
});

test('T3: a draft taken at another revision is refused before routing', () => {
  const result = reorderSceneRequest({reading: reading(), doc: DOC, draft: draftOf([TWO, ONE], {revision: '6'})});
  assert.equal(result.ok, false);
  assert.match(result.reason, /taken at revision 6/);
});

test('T3: a draft for another Expression is refused', () => {
  const result = reorderSceneRequest({reading: reading(), doc: DOC, draft: draftOf([TWO, ONE], {expression_ref: 'oi.expression:other'})});
  assert.equal(result.ok, false);
  assert.match(result.reason, /not the open native Expression/);
});

// ---- shape: every routed request is plain data, one change, no pacing key

test('routed requests are plain JSON data with a single change each', () => {
  const compose = composeSceneRequest({reading: reading(), doc: DOC, focus_refs: [ONE], title: 'Three'});
  const reorder = reorderSceneRequest({reading: reading(), doc: DOC, draft: draftOf([TWO, ONE])});
  for (const result of [compose, reorder]) {
    assert.deepEqual(JSON.parse(JSON.stringify(result.request)), result.request);
    assert.equal(result.request.changes.length, 1);
  }
});

// ---- T1b: the beat cards read each Scene's OWN facets over the Expression-wide disclosure

/** The Expression-wide disclosure: every bound scene, no facets attributed to any of them. */
function wholeReading() {
  return reading({temporal: [], spatial: [], provenance: []});
}

test('T1b: the Expression-wide disclosure lists every scene and attributes no facet to any of them', () => {
  const view = journeyBeatView(wholeReading(), DOC);
  assert.deepEqual(view.cards.map((card) => card.scene_ref), [ONE, TWO]);
  assert.ok(view.cards.every((card) => card.chips.length === 0), 'no chip is borrowed from the whole');
  assert.ok(view.cards.every((card) => card.chipsReason === SCENE_READING_PENDING), 'each card says its own reading is pending');
});

test('T1b: each card takes its chips from its own Scene reading, verbatim', () => {
  const frames = new Map([[ONE, reading({expressions: [{expression_ref: EXPRESSION, revision: '7', scene_ref: ONE}]})]]);
  const view = journeyBeatView(wholeReading(), DOC, frames);
  const [first, second] = view.cards;
  assert.deepEqual(first.chips.map((chip) => chip.kind), ['time', 'place', 'source']);
  assert.deepEqual(first.chips.map((chip) => chip.ref), ['t:1', 'place:here', 'central:source:probe']);
  assert.equal(first.scene_ref, ONE, 'identity stays the verbatim scene ref');
  assert.deepEqual(second.chips, [], 'a Scene with no frame entry shows no borrowed chip');
  assert.equal(second.chipsReason, SCENE_READING_PENDING, 'and says its reading is pending');
});

test('T1b: a Scene whose own reading cannot be read keeps its card with the owner reason and no chips', () => {
  const frames = new Map([[TWO, 'the register carries no source binding for this Scene']]);
  const [, second] = journeyBeatView(wholeReading(), DOC, frames).cards;
  assert.equal(second.scene_ref, TWO);
  assert.deepEqual(second.chips, []);
  assert.equal(second.chipsReason, 'the register carries no source binding for this Scene');
});

test('T1b: a Scene reading that names no beat for its Scene is refused as a reason, never a chip', () => {
  const frames = new Map([[ONE, reading({expressions: [{expression_ref: EXPRESSION, revision: '7', scene_ref: TWO}]})]]);
  const [first] = journeyBeatView(wholeReading(), DOC, frames).cards;
  assert.equal(first.scene_ref, ONE);
  assert.deepEqual(first.chips, []);
  assert.equal(first.chipsReason, 'the Scene reading names no beat for this Scene');
});

test('T1b: the beat cards keep the disclosure reason when no scene is bound', () => {
  const view = journeyBeatView(reading({expressions: [{expression_ref: EXPRESSION, revision: '7'}]}), DOC, new Map([[ONE, 'x']]));
  assert.deepEqual(view.cards, []);
  assert.equal(view.unavailableReason, 'bound Expressions disclose no scene refs');
});

// T-REVIEW-4 #6: the beat load fills each card's chips as its Scene read settles, four at a time, and a stale load schedules no
// further reads. The scheduler is pure (journeyLoadSchedule.ts); the instrument's wiring is read from its source.
const here = fileURLToPath(new URL('.', import.meta.url));
const instrumentSource = readFileSync(join(here, '../src/journeyInstrument.tsx'), 'utf8');
const appSource = readFileSync(join(here, '../src/app.ts'), 'utf8');

const later = (value, ms) => new Promise((resolve) => setTimeout(() => resolve(value), ms));

test('T-REVIEW-4 #6: settleBounded never has more than the limit in flight, and settles every item', async () => {
  let inFlight = 0, peak = 0;
  const settled = [];
  const items = Array.from({length: 11}, (_, i) => i);
  await settleBounded(items, 4, async (item) => {
    inFlight++; peak = Math.max(peak, inFlight);
    await later(null, (item * 7) % 5);
    inFlight--;
    return item * 10;
  }, (index, outcome) => settled.push([index, outcome.status, outcome.value]), () => true);
  assert.equal(peak, 4);
  assert.equal(settled.length, 11);
  assert.deepEqual(settled.map(([index]) => index).sort((a, b) => a - b), items);
  assert.ok(settled.every(([index, status, value]) => status === 'fulfilled' && value === index * 10));
});

test('T-REVIEW-4 #6: a rejected read is its own outcome and does not stop the others', async () => {
  const outcomes = new Map();
  await settleBounded(['a', 'bad', 'c'], 4, async (item) => {
    if (item === 'bad') throw Error('the Scene reading names no beat for this Scene');
    return item.toUpperCase();
  }, (index, outcome) => outcomes.set(index, outcome), () => true);
  assert.equal(outcomes.get(0).value, 'A');
  assert.equal(outcomes.get(1).status, 'rejected');
  assert.equal(outcomes.get(1).reason.message, 'the Scene reading names no beat for this Scene');
  assert.equal(outcomes.get(2).value, 'C');
});

test('T-REVIEW-4 #6: a stale load stops scheduling: after it goes stale, no further read starts and no late outcome is shown', async () => {
  let stale = false, started = 0;
  const shown = [];
  await settleBounded(Array.from({length: 20}, (_, i) => i), 4, async (item) => {
    started++;
    await later(null, 2);
    return item;
  }, (index) => { shown.push(index); stale = true; }, () => !stale);
  // The four first reads start together; the first settle flips the load stale, so nothing further is started.
  assert.equal(started, 4);
  assert.equal(shown.length, 1, 'only the outcome that settled while current is shown');
});

test('T-REVIEW-4 #6: the load key names the native Expression, its revision and the Scene; a refresh joins only the same key', () => {
  const basis = {expression_ref: 'oi.expression:probe', revision: 7, scene_ref: 'oi.expression:probe:scene:one'};
  assert.equal(beatLoadKey(basis), beatLoadKey({...basis}));
  assert.notEqual(beatLoadKey(basis), beatLoadKey({...basis, revision: 8}));
  assert.notEqual(beatLoadKey(basis), beatLoadKey({...basis, scene_ref: 'oi.expression:probe:scene:two'}));
  assert.notEqual(beatLoadKey(basis), beatLoadKey({...basis, expression_ref: 'oi.expression:other'}));
});

test('T-REVIEW-4 #6: the instrument draws the cards before any Scene read, fills chips through the bounded settle, and refresh joins the load in flight', () => {
  const load = instrumentSource.slice(instrumentSource.indexOf('async function loadBeats'), instrumentSource.indexOf('return {\n  async open()'));
  const firstDraw = load.indexOf('draw();message(beatView.unavailableReason');
  const settle = load.indexOf('settleBounded(cards,4,');
  assert.ok(firstDraw > 0 && settle > firstDraw, 'the cards draw before the bounded fill starts');
  assert.ok(load.includes('beatView=journeyBeatView(reading,view!.document,frames);'), 'each settled card redraws the view with its frames');
  assert.ok(load.includes('},()=>current(basis,generation));'), 'the fill stops scheduling when the load goes stale');
  assert.ok(instrumentSource.includes('if(key!==undefined&&inFlight?.key===key)return inFlight.done;'), 'a refresh for the same basis joins the load in flight');
  assert.match(instrumentSource, /async refresh\(\)\{if\(open\)await reuseOrLoad\(\);\}/);
  assert.ok(instrumentSource.includes('onRefresh={()=>void reuseOrLoad()}'), 'the Refresh button joins the same load');
  assert.match(instrumentSource, /close\(\)\{epoch\+\+;open=false;inFlight=undefined;/);
});

test('T-REVIEW-4 #1: a reorder is refused with the compose words while work is open, and the native edit refreshes to the new revision', () => {
  const edit = appSource.slice(appSource.indexOf(' editExpression:async request=>{'), appSource.indexOf(' editExpression:async request=>{') + 900);
  assert.ok(edit.includes("if(store.transactionOpen||reading.standing.pending||reading.standing.dirty)throw Error('Save the open work before reordering this Journey.');"),
    'reorder carries the dirty, pending and transaction guard');
  assert.ok(edit.includes("if((reply as {state?:string}|null)?.state==='ready')await nativeWorkspace?.refreshReference(request.expression_ref);"),
    'a ready reply refreshes through refreshReference, not open');
  const compose = appSource.slice(appSource.indexOf('async function composeJourneyScene'), appSource.indexOf('async function composeJourneyScene') + 2400);
  assert.ok(compose.includes('await nativeWorkspace?.refreshReference(routed.request.expression_ref);'), 'compose refreshes to the new revision');
  assert.ok(compose.indexOf('refreshReference(routed.request.expression_ref)') < compose.indexOf('journeyInstrument?.refresh()'), 'the Journey re-reads after the refresh');
});
