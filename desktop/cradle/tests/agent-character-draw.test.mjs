// The live character preview draws every state of the curated characters:
// each curated material (desktop/cradle/material/factory-expressions/
// character/*.json) is rendered through the preview's own drawing code onto
// a recording 2D-context stub, at several times through each state's
// sequence, and every state must produce visible draw calls — including the
// yantra and cymatic forms, which are drawn shapes, not text glyphs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {mkdtemp, rm} from 'node:fs/promises';
import {build} from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
// Bundled from source (as the other agency tests do), so plain `node --test` runs it.
const temp = await mkdtemp(join(here, '.agent-character-draw-'));
await build({entryPoints: {model: join(here, '../src/agency/character/characterModel.ts'), draw: join(here, '../src/agency/character/characterDraw.ts'), animation: join(here, '../src/agency/character/characterAnimation.ts')},
  bundle: true, platform: 'node', format: 'esm', outdir: temp, outExtension: {'.js': '.mjs'}, logLevel: 'error'});
const {asCharacterDocument, characterPreview, characterRepertoire} = await import(pathToFileURL(join(temp, 'model.mjs')));
const {drawMaterial, drawForm, cymaticMode} = await import(pathToFileURL(join(temp, 'draw.mjs')));
const {frameAt} = await import(pathToFileURL(join(temp, 'animation.mjs')));
test.after(() => rm(temp, {recursive: true, force: true}));
const folder = join(here, '../material/factory-expressions/character');
const curated = readdirSync(folder).filter(name => name.endsWith('.json')).map(name => ({name, doc: asCharacterDocument(JSON.parse(readFileSync(join(folder, name), 'utf8')))}));

const DRAWS = new Set(['fillText', 'drawImage', 'fill', 'stroke', 'fillRect', 'strokeRect']);
function recorder() {
  const calls = [];
  const ctx = {globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: ''};
  for (const name of ['save', 'restore', 'translate', 'rotate', 'scale', 'fillText', 'drawImage', 'beginPath', 'closePath', 'arc', 'moveTo', 'lineTo', 'fill', 'stroke', 'fillRect', 'strokeRect']) {
    ctx[name] = (...args) => { calls.push({name, args, alpha: ctx.globalAlpha}); };
  }
  return {ctx, calls, draws: () => calls.filter(call => DRAWS.has(call.name) && call.alpha > 0)};
}

test('the curated characters are present', () => {
  assert.deepEqual(curated.map(c => c.name).sort(), ['aletheia.expression.json', 'anima.expression.json']);
});

for (const {name, doc} of curated) {
  const {states, gestures} = characterRepertoire(doc);
  for (const choice of [...states.map(state => ({state})), ...gestures.map(gesture => ({gesture}))]) {
    test(`${name}: ${choice.state ?? choice.gesture} draws visibly throughout its sequence`, () => {
      const material = characterPreview(doc, choice);
      assert.ok(material, 'the state has body material');
      const period = material.sequence.steps.reduce((sum, step) => sum + (step.hold ?? material.sequence.hold) + (step.transition ?? material.sequence.transition), 0) || 1;
      for (let i = 0; i < 12; i++) {
        const time = period * i / 12;
        const r = recorder();
        drawMaterial(r.ctx, material, time, 96, 1, [40, 40, 36], false);
        assert.ok(r.draws().length > 0, `nothing drawn at t=${time.toFixed(2)} (step ${frameAt(material, time).step})`);
      }
    });
  }
}

test('yantra and cymatic steps are drawn as shapes, not as (empty) glyph text', () => {
  const seen = new Set();
  for (const {doc} of curated) for (const state of characterRepertoire(doc).states) {
    const material = characterPreview(doc, {state});
    for (const step of material.sequence.steps) if (step.shape && step.shape !== 'text') {
      seen.add(step.shape);
      const r = recorder();
      drawForm(r.ctx, {text: step.text ?? '', shape: step.shape, yantraId: step.yantraId, frequency: step.templateFrequency}, 96);
      const kinds = new Set(r.draws().map(call => call.name));
      assert.ok(!kinds.has('fillText'), `${step.shape} is not drawn as text`);
      assert.ok(r.draws().length >= (step.shape === 'cymatic' ? 20 : 5), `${step.shape} draws a real figure (${r.draws().length} calls)`);
    }
  }
  assert.deepEqual([...seen].sort(), ['cymatic', 'yantra']);
  // Different yantras and frequencies draw differently.
  const count = (look) => { const r = recorder(); drawForm(r.ctx, look, 96); return r.draws().length; };
  assert.notEqual(count({text: '', shape: 'yantra', yantraId: 'anahata'}), count({text: '', shape: 'yantra', yantraId: 'ajna'}));
  assert.notDeepEqual(cymaticMode(432), cymaticMode(55));
  for (const shape of ['ring', 'disc', 'square', 'triangle']) assert.ok(count({text: '', shape}) > 0, shape);
});

test('an empty step text on a text form keeps the body glyph; a drawn form drops the body source', () => {
  const doc = curated.find(c => c.name.startsWith('anima')).doc;
  const material = characterPreview(doc, {state: 'idle'});
  material.sequence.steps[0].text = '';
  assert.equal(frameAt(material, 0).from.text, material.glyph);
  const aletheia = characterPreview(curated.find(c => c.name.startsWith('aletheia')).doc, {state: 'working'});
  const index = aletheia.sequence.steps.findIndex(step => step.shape === 'yantra');
  const look = frameAt({...aletheia, sequence: {...aletheia.sequence, steps: [aletheia.sequence.steps[index]]}}, 0).from;
  assert.equal(look.shape, 'yantra'); assert.equal(look.ascii, undefined);
});
