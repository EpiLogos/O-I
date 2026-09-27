// FX-A3: profile → roster/card → character preview. A character is an
// ordinary oi.expression/v1 document with reuse.kind "character"; the
// profile carries only its Central file ref (expressive_character_ref), the
// card reading carries it as character.character_ref, and the creator and
// card draw the same CharacterPreview from the document's preview state.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp, rm} from 'node:fs/promises';
import {join, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {characterPreview, characterRepertoire, characterSceneRef, asCharacterDocument} from '../src/agency/character/characterModel.ts';
import {frameAt, ease, inkColour, forceMotion} from '../src/agency/character/characterAnimation.ts';

const here = dirname(fileURLToPath(import.meta.url));
const temp = await mkdtemp(join(here, '.agent-character-'));
await build({
  entryPoints: {card: join(here, '../src/agency/HumanAgentCard.tsx'), preview: join(here, '../src/agency/character/CharacterPreview.tsx'), reading: join(here, '../src/agency/agentCardReading.ts'), roster: join(here, '../src/agency/roster.ts'), section: join(here, '../src/agency/character/CharacterSection.tsx'), material: join(here, '../src/agency/character/characterMaterial.ts')},
  bundle: true, platform: 'node', format: 'esm', jsx: 'automatic',
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  outdir: temp, outExtension: {'.js': '.mjs'}, logLevel: 'error',
});
const {HumanAgentCard} = await import(pathToFileURL(join(temp, 'card.mjs')));
const {CharacterPreview} = await import(pathToFileURL(join(temp, 'preview.mjs')));
const {cardCharacterRef} = await import(pathToFileURL(join(temp, 'reading.mjs')));
const {rosterFromReading} = await import(pathToFileURL(join(temp, 'roster.mjs')));
const {encodeChoice, decodeChoice} = await import(pathToFileURL(join(temp, 'section.mjs')));
const {charactersOf} = await import(pathToFileURL(join(temp, 'material.mjs')));
test.after(() => rm(temp, {recursive: true, force: true}));

const REF = 'central:Control/agents/expressive-material/character/nous.expression.json';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const body = (overrides) => ({id: 'expression:nous:entity:self', role: 'self', kind: 'formation', name: 'Nous', text: '◇', shape: 'text', tint: '#3366ff', tintWeight: .5, scale: 1,
  force: {kind: 'none', strength: 0, radius: .4, spin: 0}, sequence: {enabled: false, clock: 'seconds', steps: []}, ...overrides});
const scene = (ref, entity) => ({scene_ref: ref, title: ref, entity_refs: [entity.id], presentation: {schema: 'oi.journey-scene/v1', scene: {id: ref, name: ref, entities: [entity]}}});
function characterDocument() {
  return {
    schema: 'oi.expression/v1', expression_ref: 'expression:nous', revision: 3, title: 'Nous character',
    reuse: {schema: 'oi.expression-reuse/v1', kind: 'character', title: 'Nous', entry_scene_ref: 'expression:nous:scene:idle',
      states: {idle: 'expression:nous:scene:idle', working: 'expression:nous:scene:working', speaking: 'expression:nous:scene:speaking'},
      gestures: {'invoke-skill': {scene_ref: 'expression:nous:scene:invoke', role: 'self'}}, preview_state: 'working'},
    scenes: [
      scene('expression:nous:scene:idle', body({})),
      scene('expression:nous:scene:working', body({text: '◆', tint: '#ff0066', tintWeight: 1, source: {kind: 'ascii', ascii: {text: '/\\\n\\/'}},
        layers: [{id: 'halo', text: '○', z: -1, scale: 1.6}, {id: 'mark', text: '', z: 1, scale: .5, source: {kind: 'image', image: {dataUrl: PNG, mode: 'silhouette', threshold: .5, scale: 1}}}],
        force: {kind: 'vortex', strength: 2, radius: .5, spin: 1}, sound: {enabled: true, frequencyHz: 432},
        sequence: {enabled: true, clock: 'seconds', steps: [{id: 'a', name: 'gather', text: '◆', shape: 'text', hold: 1, transition: .5, position: null}, {id: 'b', name: 'release', text: '◇', shape: 'text', hold: 1, transition: .5, position: null}]}})),
      scene('expression:nous:scene:speaking', body({text: '◈'})),
      scene('expression:nous:scene:invoke', body({text: '✦', source: {kind: 'image', image: {dataUrl: 'https://example.com/x.png', mode: 'luminance', threshold: .5, scale: 1}}})),
    ],
  };
}

test('the roster carries the profile character ref, and only when authored', () => {
  const reading = {schema: 'central.agent-profile-roster/v1', scope_ref: 'control:root', profiles: [
    {accepted: true, profile: {ref: 'agent-profile:nous', agent_ref: 'agent:nous', name: 'Nous', expressive_character_ref: REF}},
    {accepted: false, profile: {ref: 'agent-profile:plain', agent_ref: 'agent:plain'}},
  ]};
  const [nous, plain] = rosterFromReading(reading);
  assert.equal(nous.characterRef, REF);
  assert.equal('characterRef' in plain, false);
});

test('the preview reads the preview state by default, and any named state or gesture on request', () => {
  const doc = asCharacterDocument(characterDocument());
  const preview = characterPreview(doc);
  assert.equal(preview.showing, 'working');
  assert.equal(preview.glyph, '◆');
  assert.equal(preview.tint, '#ff0066');
  assert.equal(preview.ascii, '/\\\n\\/');
  assert.deepEqual(preview.layers.map(layer => layer.id), ['halo', 'mark']);
  assert.equal(preview.layers[1].imageDataUrl, PNG);
  assert.deepEqual(preview.steps, ['gather', 'release']);
  assert.equal(preview.force, 'vortex');
  assert.equal(preview.sound, true);
  assert.equal(characterPreview(doc, {state: 'speaking'}).glyph, '◈');
  const gesture = characterPreview(doc, {gesture: 'invoke-skill'});
  assert.equal(gesture.showing, 'invoke-skill');
  assert.equal(gesture.imageDataUrl, undefined, 'an ambient image URL is never drawn');
  assert.equal(characterPreview(doc, {state: 'unknown'}).showing, 'working', 'an unknown state falls back to the preview state');
  assert.deepEqual(characterRepertoire(doc), {states: ['idle', 'working', 'speaking'], gestures: ['invoke-skill'], preview: 'working'});
  const noPreview = characterDocument(); delete noPreview.reuse.preview_state;
  assert.equal(characterSceneRef(asCharacterDocument(noPreview)).scene_ref, 'expression:nous:scene:idle');
  const notCharacter = characterDocument(); notCharacter.reuse.kind = 'scene';
  assert.throws(() => asCharacterDocument(notCharacter), /not a reusable character/);
});

test('material_list rows (oi.expression-material-list/v1) become character choices; other kinds are left out', () => {
  const location = {schema: 'central.path-ref/v1', ref: REF, root: 'Central', path: 'Control/agents/expressive-material/character/nous.expression.json'};
  const row = (overrides) => ({file_ref: REF, revision: 'r2', title: 'Nous', kind: 'character', roles: [{role: 'self', accepts: 'agent'}],
    states: {idle: 'expression:nous:scene:idle', working: 'expression:nous:scene:working'}, gestures: {'invoke-skill': {scene_ref: 'expression:nous:scene:invoke', role: 'self'}},
    associations: {workflow_keys: [], task_types: [], skill_set_refs: [], skill_refs: [], event_families: []}, preview_state: 'working', entry_scene_ref: 'expression:nous:scene:idle',
    playback: [], expression_ref: 'expression:nous', location, ...overrides});
  const result = {state: 'materials', schema: 'oi.expression-material-list/v1', register: 'Work/O-I/desktop/cradle/material/expressive-material', folders: {},
    materials: [row({}), row({file_ref: 'central:x/handoff.expression.json', kind: 'scene'})], unreadable: [], truncated: false};
  assert.deepEqual(charactersOf(result), [{file_ref: REF, revision: 'r2', title: 'Nous', states: ['idle', 'working'], gestures: ['invoke-skill'], preview_state: 'working', location, expression_ref: 'expression:nous'}]);
  assert.throws(() => charactersOf({state: 'unbound'}), /no material listing/);
});

test('the preview draws glyph, ASCII, image and layers with the authored tint', () => {
  const html = renderToStaticMarkup(createElement(CharacterPreview, {material: characterPreview(asCharacterDocument(characterDocument())), size: 100}));
  assert.ok(html.includes('aria-label="Nous — working"'));
  assert.ok(html.includes('color:#ff0066'));
  assert.ok(html.includes('<pre'));
  assert.ok(html.includes(`src="${PNG}"`));
  assert.ok(html.includes('○'));
  assert.ok(html.includes('vortex') && html.includes('sound') && html.includes('2 states'));
  const empty = renderToStaticMarkup(createElement(CharacterPreview, {material: null}));
  assert.ok(empty.includes('No character'));
  const idle = renderToStaticMarkup(createElement(CharacterPreview, {material: characterPreview(asCharacterDocument(characterDocument()), {state: 'idle'})}));
  assert.ok(idle.includes('color-mix(in srgb, #3366ff 50%, currentColor)'));
});

test('the Agent Card shows the same character preview from its card reading', () => {
  const base = {schema: 'oi.human-agent-card/v1', identity: {name: 'Nous', agent_ref: 'agent:nous', profile_ref: 'agent-profile:nous', revision: 'r2', refs: []},
    why_im_here: {text: 'Think it through.', refs: []}, what_i_can_do: {text: '', refs: []}, how_i_work: {text: '', refs: []}, how_i_orient: null,
    what_i_carry: {text: '', refs: []}, where_i_participate: {text: '', world_ref: 'control:root', refs: []},
    citizenship: {summary: '', dimensions: {}, refs: []}, currently: {text: '', refs: []}};
  const doc = asCharacterDocument(characterDocument());
  const seen = [];
  const renderCharacter = (ref) => { seen.push(ref); return createElement(CharacterPreview, {material: characterPreview(doc), size: 72}); };
  const withCharacter = {...base, character: {character_ref: REF, text: 'Appears through its reusable expressive character.', refs: [REF, 'agent-profile:nous@r2']}};
  assert.equal(cardCharacterRef(withCharacter), REF);
  const html = renderToStaticMarkup(createElement(HumanAgentCard, {card: withCharacter, renderCharacter}));
  assert.deepEqual(seen, [REF]);
  assert.ok(html.includes('How I appear'));
  assert.ok(html.includes('aria-label="Nous — working"'));
  assert.ok(html.includes(REF));
  // No character on the profile: no section, nothing read.
  seen.length = 0;
  const plain = renderToStaticMarkup(createElement(HumanAgentCard, {card: {...base, character: null}, renderCharacter}));
  assert.equal(plain.includes('How I appear'), false);
  assert.equal(seen.length, 0);
  assert.equal(cardCharacterRef({character: {character_ref: ' padded'}}), null);
  // An existing Agent without a character still offers the editor slot.
  const editable = renderToStaticMarkup(createElement(HumanAgentCard, {card: {...base, character: null}, renderCharacter, characterEditor: createElement('div', {id: 'editor'})}));
  assert.ok(editable.includes('Give this Agent a character') && editable.includes('id="editor"'));
});

test('the live preview plays the state sequence with its hold, transition and easing', () => {
  const doc = characterDocument();
  const working = doc.scenes[1].presentation.scene;
  working.transition = 2.5;
  Object.assign(working.entities[0].sequence, {enabled: true, hold: 1, transition: .5, easing: 'linear'});
  working.entities[0].sequence.steps[1].objectState = {size: {x: 1, y: 1}, rotation: 90, scale: 2, tint: '#00ff00', tintWeight: 1, force: {kind: 'none', strength: 0, radius: 1, spin: 0}};
  const material = characterPreview(asCharacterDocument(doc));
  assert.equal(material.transition, 2.5, 'switching uses the Scene\'s authored transition');
  assert.equal(material.sequence.easing, 'linear');
  const hold = frameAt(material, .5);
  assert.equal(hold.phase, 'hold'); assert.equal(hold.from.text, '◆'); assert.equal(hold.mix, 0);
  const moving = frameAt(material, 1.25);
  assert.equal(moving.phase, 'transition'); assert.equal(moving.to.text, '◇'); assert.ok(Math.abs(moving.mix - .5) < 1e-9);
  assert.equal(moving.to.tint, '#00ff00'); assert.equal(moving.to.scale, 2); assert.equal(moving.to.rotation, 90);
  const second = frameAt(material, 1.75);
  assert.equal(second.step, 1); assert.equal(second.from.text, '◇');
  assert.equal(frameAt(material, 3.2).from.text, frameAt(material, .2).from.text, 'the cycle repeats');
  assert.ok(Math.abs(ease(.5, 'whip') - .5) < 1e-9); assert.equal(ease(.5, 'smoothstep'), .5); assert.equal(ease(2, 'kineticSnap'), ease(1, 'kineticSnap'));
  // A disabled sequence holds the body.
  const idle = characterPreview(asCharacterDocument(characterDocument()), {state: 'idle'});
  assert.equal(frameAt(idle, 10).mix, 0);
  assert.equal(inkColour('#ff0000', .5, [0, 0, 0]), 'rgb(128,0,0)');
  assert.equal(inkColour(null, 1, [1, 2, 3]), 'rgb(1,2,3)');
  const vortex = forceMotion(material, 1);
  assert.ok(vortex.spin !== 0, 'a vortex body turns');
});

test('state and gesture choices survive names containing ":"', () => {
  for (const choice of [{state: 'a:b'}, {gesture: 'invoke:skill:x'}, {}]) assert.deepEqual(decodeChoice(encodeChoice(choice)), choice);
  assert.deepEqual(decodeChoice('state:working'), {}, 'the old colon encoding is not guessed at');
});

test('the live preview renders a canvas with its static drawing as fallback', () => {
  const html = renderToStaticMarkup(createElement(CharacterPreview, {material: characterPreview(asCharacterDocument(characterDocument())), size: 80}));
  assert.ok(html.includes('<canvas'));
  assert.ok(html.includes('data-live="true"'));
  assert.ok(/<canvas[^>]*>.*<pre/.test(html), 'the ASCII drawing sits inside the canvas as fallback');
});
