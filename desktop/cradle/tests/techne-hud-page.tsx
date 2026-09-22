// The Technē HUD probe page (test-only aperture, 2026-09-22): the SIX existing
// M0′–M5′ instruments made available in the live HUD (TechneSurfaceHost),
// over a REAL production reading built by wikiReadingPayload — the same
// payload the wiki provider serves live, carrying the M4′ producer's spatial
// facets. `?reading=bare` serves the register with no place ground (the §41
// negative). The HUD registers no provider of its own here because this page
// registers one first (ensureWikiProvider yields to a standing provider).
import React from 'react';
import {createRoot} from 'react-dom/client';
import {wikiReadingPayload} from '../src/techne/wikiReadingProvider';
import {registerTechneReadingProvider, type TechneSubject} from '../src/techne/techneReading';
import {KernelProvider} from '../src/kernel/KernelProvider';
import {VisualsProvider} from '../src/visuals/ParticleExpression';
import {ExpressionStageProvider} from '../src/stage/ExpressionStage';
import {TechneSurfaceHost} from '../src/techne/TechneSurfaceHost';
import '@epilogos/oi-design-system/tokens.css';

const REGISTER = {key: 'central', title: 'Central'};
const SUBJECT: TechneSubject = {ref: 'wiki:central', kind: 'wiki-register', title: 'Central'};
const WIKI_BASIS = {path: 'Control/agents/wiki/wiki.json', revision: 'central.content-fnv1a64/v1:1:probe', location: {root: 'central', path: 'Control/agents/wiki/wiki.json'}};

// A register reading carrying real place ground: a declared, georeferenced,
// temporally-valid historical place reached by OCCURRED_AT, and a mythic
// place reached by MYTH_LOCATED_AT (unlocated — no coordinate).
const placeRegisterReading = {
  state: 'ready', register: REGISTER,
  wiki: {state: 'ready', spaces: [{object: 'space', ref: 'central:wiki:root', title: 'Central'}], nodes: [
    {object: 'node', ref: 'central:wiki:battle', title: 'The Battle'},
    {object: 'node', ref: 'central:wiki:londinium', title: 'Londinium', type: 'place', place: {geometry: {type: 'point', coordinates: [-0.09, 51.51]}, precision: 'exact', names: [{name: 'Londinium', valid_from: '0047', valid_to: '0410'}], valid_from: '0047', valid_to: '0410'}},
    {object: 'node', ref: 'central:wiki:avalon', title: 'Avalon'},
  ], constellations: []},
  wikiBasis: WIKI_BASIS,
  relations: {state: 'available', focusRef: 'central:wiki:root', edges: [
    {relation: 'OCCURRED_AT', from: 'central:wiki:battle', to: 'central:wiki:londinium', provider: 'wiki', authority: null, revision: 'r1'},
    {relation: 'MYTH_LOCATED_AT', from: 'central:wiki:battle', to: 'central:wiki:avalon', provider: 'wiki', authority: null, revision: null},
  ], truncated: false, warnings: []},
};

const bareRegisterReading = {
  state: 'ready', register: REGISTER,
  wiki: {state: 'ready', spaces: [{object: 'space', ref: 'central:wiki:root', title: 'Central'}], nodes: [{object: 'node', ref: 'central:wiki:battle', title: 'The Battle'}], constellations: []},
  wikiBasis: WIKI_BASIS,
  relations: {state: 'available', focusRef: 'central:wiki:root', edges: [{relation: 'wiki:child', from: 'central:wiki:root', to: 'central:wiki:battle', provider: null, authority: null, revision: 'r9'}], truncated: false, warnings: []},
};

const bare = new URLSearchParams(location.search).get('reading') === 'bare';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const payload = wikiReadingPayload({register: REGISTER, subject: SUBJECT, reading: (bare ? bareRegisterReading : placeRegisterReading) as any});

registerTechneReadingProvider({ref: 'hud-probe.ql-techne', async read() { return payload; }});

const binding = {id: 'hud-binding', kind: 'techne' as const, ref: 'wiki:central', title: 'Central'};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <KernelProvider>
      <VisualsProvider>
        <ExpressionStageProvider>
          <div style={{width: '960px', height: '620px', position: 'relative'}}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <TechneSurfaceHost binding={binding as any} subject={SUBJECT}/>
          </div>
        </ExpressionStageProvider>
      </VisualsProvider>
    </KernelProvider>
  </React.StrictMode>,
);
