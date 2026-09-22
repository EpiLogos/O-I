// The Technē walk-sweep probe page (test-only aperture, 2026-09-22): the HUD
// over ONE rich production reading that exercises every instrument — >10
// members and typed revisioned relations (Canvas/Timeline), a standing
// Expression with two scenes (Journey/Palace), and declared + geography-
// related places (World). Built by the real wikiReadingPayload so the reading
// is exactly what the live provider would serve. Drives the §28 lens-
// continuity walk and C5/C7/C12.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {wikiReadingPayload} from '../src/techne/wikiReadingProvider';
import {registerTechneReadingProvider, type TechneSubject} from '../src/techne/techneReading';
import {KernelProvider} from '../src/kernel/KernelProvider';
import {VisualsProvider} from '../src/visuals/ParticleExpression';
import {ExpressionStageProvider} from '../src/stage/ExpressionStage';
import {TechneSurfaceHost} from '../src/techne/TechneSurfaceHost';
import {disclosureSession} from '../src/techne/session';
import '@epilogos/oi-design-system/tokens.css';

const REGISTER = {key: 'central', title: 'Central'};
const SUBJECT: TechneSubject = {ref: 'wiki:central', kind: 'wiki-register', title: 'Central'};
const WIKI_BASIS = {path: 'Control/agents/wiki/wiki.json', revision: 'central.content-fnv1a64/v1:1:sweep', location: {root: 'central', path: 'Control/agents/wiki/wiki.json'}};

// Twelve member nodes (C6: more than ten reachable) plus two places.
const members = Array.from({length: 12}, (_, i) => ({object: 'node', ref: `central:wiki:m${i}`, title: `Member ${i}`}));
const nodes = [
  ...members,
  {object: 'node', ref: 'central:wiki:londinium', title: 'Londinium', type: 'place', place: {geometry: {type: 'point', coordinates: [-0.09, 51.51]}, precision: 'exact', names: [{name: 'Londinium', valid_from: '0047', valid_to: '0410'}], valid_from: '0047', valid_to: '0410'}},
  {object: 'node', ref: 'central:wiki:avalon', title: 'Avalon'},
];
// Typed, revisioned relations among members (Canvas edges + Timeline temporal
// basis), plus two geography relations (World).
const edges = [
  {relation: 'supports', from: 'central:wiki:m0', to: 'central:wiki:m1', provider: 'wiki', authority: null, revision: 'r1'},
  {relation: 'refutes', from: 'central:wiki:m2', to: 'central:wiki:m3', provider: 'wiki', authority: null, revision: 'r2'},
  {relation: 'derives', from: 'central:wiki:m4', to: 'central:wiki:m5', provider: 'wiki', authority: null, revision: 'r3'},
  {relation: 'OCCURRED_AT', from: 'central:wiki:m0', to: 'central:wiki:londinium', provider: 'wiki', authority: null, revision: 'r4'},
  {relation: 'MYTH_LOCATED_AT', from: 'central:wiki:m1', to: 'central:wiki:avalon', provider: 'wiki', authority: null, revision: null},
];
const richReading = {
  state: 'ready', register: REGISTER,
  wiki: {state: 'ready', spaces: [{object: 'space', ref: 'central:wiki:root', title: 'Central'}], nodes, constellations: []},
  wikiBasis: WIKI_BASIS,
  relations: {state: 'available', focusRef: 'central:wiki:root', edges, truncated: false, warnings: []},
};

// A standing Expression with two scenes → Journey beats + Palace elements.
const standingDoc = {
  schema: 'oi.expression/v1',
  expression_ref: 'expression:techne-m0.central.sweep',
  revision: 4,
  title: 'Central wiki',
  scenes: [
    {scene_ref: 'expression:techne-m0.central.sweep:scene:overview', revision: 1, title: 'Overview', entity_refs: ['central:wiki:m0', 'central:wiki:m1']},
    {scene_ref: 'expression:techne-m0.central.sweep:scene:relations', revision: 1, title: 'Relations', entity_refs: ['central:wiki:m2', 'central:wiki:m3']},
  ],
  entities: {}, relations: {}, selection: {scene_ref: 'expression:techne-m0.central.sweep:scene:overview', entity_ref: null},
  provenance: [], representations: [], refinements: [],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const payload = wikiReadingPayload({register: REGISTER, subject: SUBJECT, reading: richReading as any, document: standingDoc as any});
registerTechneReadingProvider({ref: 'sweep-probe.ql-techne', async read() { return payload; }});

const binding = {id: 'sweep-binding', kind: 'techne' as const, ref: 'wiki:central', title: 'Central'};

function SweepHarness() {
  const [collapsed, setCollapsed] = React.useState(false);
  return (
    <div style={{width: '980px', height: '640px', position: 'relative'}}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <TechneSurfaceHost binding={binding as any} subject={SUBJECT} collapsed={collapsed} onCollapsedChange={setCollapsed}/>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).sweepProbe = {session: () => disclosureSession.get()};

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <KernelProvider><VisualsProvider><ExpressionStageProvider>
      <SweepHarness/>
    </ExpressionStageProvider></VisualsProvider></KernelProvider>
  </React.StrictMode>,
);
