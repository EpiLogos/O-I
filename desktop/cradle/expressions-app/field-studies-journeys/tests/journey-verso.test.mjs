// lane-5 T12: the source/verso leg is reachable from the journey. A beat offers its own Scene's explicit activation portals (never a
// re-dock, never a navigate), enabled only on the current native Scene, because the host checks the portal against the presented
// Scene. A Scene with no portal offers none, and a journey with no host portal draws no affordance at all. The React surface is
// rendered from the real component, bundled the same way the timeline tests bundle theirs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {journeyBeatView} from '../build/journeyBeats.js';

const compiled = await build({
  stdin: {
    contents: [
      "export {JourneyBeatPanel, journeyPortalTriggers, journeyPortalLabel} from './journeyInstrument.tsx';",
      "export {createElement} from 'react';",
      "export {renderToStaticMarkup} from 'react-dom/server';",
    ].join('\n'),
    resolveDir: fileURLToPath(new URL('../src/', import.meta.url)),
    loader: 'ts',
  },
  tsconfig: fileURLToPath(new URL('../tsconfig.json', import.meta.url)),
  nodePaths: [fileURLToPath(new URL('../../../node_modules', import.meta.url))],
  banner: {js: `import {createRequire as __createRequire} from 'node:module';globalThis.require=__createRequire(${JSON.stringify(fileURLToPath(import.meta.url))});`},
  loader: {'.css': 'empty'},
  bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', write: false, logLevel: 'silent',
});
const api = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const {JourneyBeatPanel, journeyPortalTriggers, journeyPortalLabel, createElement, renderToStaticMarkup} = api;

const EXPRESSION = 'oi.expression:probe';
const ONE = `${EXPRESSION}:scene:one`;
const TWO = `${EXPRESSION}:scene:two`;
const DOC = {schema: 'oi.expression/v1', expression_ref: EXPRESSION, revision: 7, scenes: [{scene_ref: ONE, title: 'One'}, {scene_ref: TWO, title: 'Two'}]};

const SOURCE = {trigger_ref: 'trigger:source', occasion: 'activate', target: {kind: 'portal', placement: 'overlay', subject_ref: 'central:source:probe', scene_ref: null}};
const RE_DOCK = {trigger_ref: 'trigger:return', occasion: 'activate', target: {kind: 'portal', placement: 're_dock', subject_ref: 'central:source:probe', scene_ref: null}};
const NAVIGATE = {trigger_ref: 'trigger:go', occasion: 'activate', target: {kind: 'navigate', scene_ref: TWO}};

const NATIVE = {
  document: DOC,
  bindings: {
    a: {scene_ref: ONE, triggers: [SOURCE, RE_DOCK, NAVIGATE]},
    b: {scene_ref: TWO, triggers: [SOURCE]},
  },
};

function reading() {
  return {
    contract: 'ql.techne/v1',
    reading_ref: 'ql.techne:reading:probe',
    snapshot: {revision: 'rev-1', basis_ref: null},
    subject: {subject_ref: EXPRESSION, native_owner: 'oi.cradle.kernel', kind: 'expression-scene'},
    temporal: [],
    spatial: [],
    provenance: [],
    expressions: [{expression_ref: EXPRESSION, revision: '7', scene_ref: ONE}, {expression_ref: EXPRESSION, revision: '7', scene_ref: TWO}],
    actions: [],
    disclosure: {instruments: [{instrument: 'journey', available: true, reading: '4:2-deep'}], application_cuts: [], degraded: [], suggestions: []},
  };
}

const beatView = journeyBeatView(reading(), DOC, new Map([[ONE, 'pending'], [TWO, 'pending']]));
const handlers = {onFocus() {}, onMove() {}, onRefresh() {}};

function render(overrides = {}) {
  return renderToStaticMarkup(createElement(JourneyBeatPanel, {
    reading: reading(), beatView, native: NATIVE,
    basis: {expression_ref: EXPRESSION, revision: 7, scene_ref: ONE}, busy: false,
    ...handlers, onPortal() {}, ...overrides,
  }));
}

/** The opening tag of each portal button, in beat order. */
function portalButtons(markup) {
  return [...markup.matchAll(/<button[^>]*data-journey-portal="[^"]+"[^>]*>/g)].map((match) => match[0]);
}

test('T12: a beat offers its own activation portals, never a re-dock or a navigate', () => {
  assert.deepEqual(journeyPortalTriggers(NATIVE, ONE).map((trigger) => trigger.trigger_ref), ['trigger:source']);
  assert.deepEqual(journeyPortalTriggers(NATIVE, TWO).map((trigger) => trigger.trigger_ref), ['trigger:source']);
  assert.deepEqual(journeyPortalTriggers(NATIVE, `${EXPRESSION}:scene:none`), [], 'a Scene that names none offers none');
  assert.equal(journeyPortalLabel(SOURCE), 'Overlay source');
});

test('T12: the portal affordance is enabled on the current Scene and disabled on any other, with its reason', () => {
  const buttons = portalButtons(render());
  assert.equal(buttons.length, 2, 'one affordance per beat that carries a portal');
  assert.equal(buttons.filter((tag) => !/disabled/.test(tag)).length, 1, 'only the current Scene can place its source');
  assert.match(buttons.find((tag) => /disabled/.test(tag)), /Open this Scene first/);
});

test('T12: without a host portal, no affordance is drawn', () => {
  const markup = render({onPortal: undefined});
  assert.equal(markup.includes('data-journey-portal'), false, 'honest absence: no host, no affordance');
});
