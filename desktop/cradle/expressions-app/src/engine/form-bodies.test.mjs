/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Forms become bodies (O-I #852): a symbol takes its glyph from an M3′ form, a step moves it one line or one
 * turn about a matrix axis by QL's own law (ql-core pole/codon.rs, pole/generation.rs), and Morph moves along
 * M3′'s torus at M1′'s nine to sixteen; the sampler names the body QL's form owner prepares and draws its
 * picture from the native owner's state (form_instrument::body).
 *
 *   node --test desktop/cradle/expressions-app/src/engine/form-bodies.test.mjs
 *
 * The modules are TypeScript: bundled once with the app's own esbuild into a temporary directory.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const dir = mkdtempSync(join(tmpdir(), 'form-bodies-'));
async function load(name) {
  const outfile = join(dir, `${name}.mjs`);
  await esbuild.build({
    entryPoints: [fileURLToPath(new URL(`./${name}.ts`, import.meta.url))],
    bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent',
  });
  return import(pathToFileURL(outfile).href);
}
const G = await load('glyphLibrary');
const S = await load('psg-form-sampler');

test('a symbol takes its glyph from an M3′ form: a fold, a codon or a hexagram', () => {
  // The hexagram's sign is its King Wen number's: all yang is ䷀ 1, all yin ䷁ 2, Earth over Heaven ䷊ 11.
  assert.equal(G.m3FormGlyph({ kind: 'hexagram', address: 0b111111 }), '䷀');
  assert.equal(G.m3FormGlyph({ kind: 'hexagram', address: 0 }), '䷁');
  assert.equal(G.kingWen(0b000111), 11);
  assert.equal(G.kingWen(0b111000), 12);
  assert.equal(G.kingWen(0b010101), 63, 'Water over Fire');
  assert.equal(G.m3FormGlyph({ kind: 'codon', address: 0 }), 'AAA');
  assert.equal(G.m3FormGlyph({ kind: 'codon', address: 63 }), 'GGG');
  // Outer site X (lines 4–5) 01 T, hinge Y (lines 2–3) 10 C, inner site Z (lines 0–1) 11 G.
  assert.equal(G.m3FormGlyph({ kind: 'codon', address: 0b011011 }), 'TCG');
  // A fold's three creases, outer site first: yang a mountain, resting solid.
  assert.equal(G.m3FormGlyph({ kind: 'fold', address: 63 }), '∧∧∧');
  assert.equal(G.m3FormGlyph({ kind: 'fold', address: 0 }), '⋎⋎⋎');
  // Every hexagram has its own sign, and the forms stand beside letters and shapes in the library.
  const forms = G.GLYPH_CATEGORIES.find((c) => c.id === 'm3-forms');
  assert.equal(forms.items.length, 64 + 56, 'the 64 hexagrams and the 56 cards');
  assert.equal(new Set(forms.items.map((i) => i.char)).size, 64 + 56);
  assert.ok(G.GLYPH_CATEGORIES.findIndex((c) => c.id === 'm3-forms') > 0, 'the forms come after letters and shapes');
  assert.throws(() => G.m3FormGlyph({ kind: 'deck', address: 0 }), /fold, a codon, a hexagram or a card/);
  assert.throws(() => G.m3FormGlyph({ kind: 'codon', address: 64 }), /0 to 63/);
});

// The card (O-I #852 "a fold, codon, hexagram or card"): the Minor Arcana card QL's exact cover gives the codon (ql-core
// pole/tarot.rs TarotBridge::card_of_codon over the kernel's M3_TAROT_CODON_MAP, m3.c FR 2.3.19), as QL's M3 state names it.
test('a symbol takes its glyph from a card: the Minor Arcana card QL\'s exact cover gives its codon', () => {
  // QL's own readings of the card (ql.m3-state/v1 `tarot`), as the shell and the kernel fixtures keep them.
  const readings = [
    JSON.parse(readFileSync(fileURLToPath(new URL('../../../../../packages/live-shell/ui/tests/fixtures/ql-m3-state-2026-10-21.json', import.meta.url)), 'utf8')).answer.state.tarot,
    JSON.parse(readFileSync(fileURLToPath(new URL('../../../kernel/tests/fixtures/epi-world-131.expression.json', import.meta.url)), 'utf8')).document.scenes[0].presentation.scene.epiWorld.world.basis.m3.tarot,
  ];
  for (const reading of readings) {
    for (const address of reading.codons) {
      const card = G.m3Card({ kind: 'card', address });
      assert.deepEqual({ card_id: card.cardId, suit: card.suit, rank: card.rank, codons: card.codons },
        { card_id: reading.card_id, suit: reading.suit, rank: reading.rank, codons: reading.codons }, `codon ${address}`);
    }
  }
  // The cover is exact: 56 cards, each codon on one card; 48 carry one codon, the 8 courts two.
  const cards = new Map();
  for (let address = 0; address < 64; address++) {
    const card = G.m3Card({ kind: 'card', address });
    assert.ok(card.codons.includes(address), `codon ${address} is on its own card`);
    assert.equal(card.cardId, ['Cups', 'Wands', 'Pentacles', 'Swords'].indexOf(card.suit) * 14 + card.pip);
    assert.equal(card.suit, ['Cups', 'Wands', 'Pentacles', 'Swords'][address >> 4], 'the suit is the outer site\'s nucleotide');
    cards.set(card.cardId, card);
  }
  assert.equal(cards.size, 56);
  const courts = [...cards.values()].filter((card) => card.codons.length === 2);
  assert.equal(courts.length, 8);
  // The yin suits carry their two codons at the Knight and the King, the yang suits at the Page and the Queen.
  for (const card of courts) assert.ok((['Cups', 'Pentacles'].includes(card.suit) ? ['Knight', 'King'] : ['Page', 'Queen']).includes(card.rank), `${card.rank} of ${card.suit}`);
  // The glyph is the card's rank and suit sign, one sign for each card, the court's two codons drawing the same card.
  assert.equal(G.m3FormGlyph({ kind: 'card', address: 0 }), 'A♥', 'the Ace of Cups');
  assert.equal(G.m3FormGlyph({ kind: 'card', address: 17 }), '10♣', 'the Ten of Wands');
  assert.equal(G.m3FormGlyph({ kind: 'card', address: 0b100111 }), '8♦', 'CTG, the Eight of Pentacles');
  assert.equal(G.m3FormGlyph({ kind: 'card', address: 0b100011 }), 'Kn♦', 'CAG, the Knight of Pentacles');
  assert.equal(G.m3FormGlyph({ kind: 'card', address: 0b101100 }), 'Kn♦', 'CGA, its second codon');
  assert.equal(new Set(Array.from({ length: 64 }, (_, address) => G.m3FormGlyph({ kind: 'card', address }))).size, 56);
  // A card steps as its codon does, and Morph carries it to the card its change lands on.
  assert.deepEqual(G.stepM3Form({ kind: 'card', address: 0 }, { axis: 'i' }), { kind: 'card', address: 0b010101 });
  const morph = G.m3FormMorph({ kind: 'card', address: 0 }, { axis: 'i' });
  assert.equal(morph.from.glyph, 'A♥');
  assert.equal(morph.to.glyph, 'A♣', 'TTT, the Ace of Wands');
  // The library holds the cards beside the hexagrams, each named as QL names it.
  const forms = G.GLYPH_CATEGORIES.find((c) => c.id === 'm3-forms');
  assert.equal(forms.items.length, 64 + 56);
  assert.ok(forms.items.some((item) => item.char === 'Kn♦' && item.name === 'Knight of Pentacles · CAG CGA'));
});

test('a step moves a form one line or one turn about a matrix axis, by QL\'s law', () => {
  const form = { kind: 'codon', address: 0 };
  for (let line = 0; line < 6; line++) {
    const moved = G.stepM3Form(form, { line });
    assert.equal(moved.address, 1 << line, `line ${line} flips its own bit`);
    assert.deepEqual(G.stepM3Form(moved, { line }), form, 'a moving line moved again returns');
  }
  // The partner of A under each matrix, on every site: T (complementary, i), G (moving/resting, j), C (same quality, k).
  assert.equal(G.codonLetters(G.stepM3Form(form, { axis: 'i' })), 'TTT');
  assert.equal(G.codonLetters(G.stepM3Form(form, { axis: 'j' })), 'GGG');
  assert.equal(G.codonLetters(G.stepM3Form(form, { axis: 'k' })), 'CCC');
  for (const axis of ['i', 'j', 'k']) {
    const turned = G.stepM3Form({ kind: 'hexagram', address: 0b101100 }, { axis });
    assert.equal(G.stepM3Form(turned, { axis }).address, 0b101100, `a turn about ${axis} is an involution`);
  }
  assert.equal(G.M3_AXIS_MATRIX.j, 'moving-resting');
  assert.throws(() => G.stepM3Form(form, { line: 6 }), /one of the six/);
  assert.throws(() => G.stepM3Form(form, { axis: 'x' }), /i, j or k/);
});

test('Morph moves between a form and its change along M3′\'s torus at nine to sixteen', () => {
  assert.equal(G.M3_TORUS_TUBE, 9 / 16);
  const morph = G.m3FormMorph({ kind: 'hexagram', address: 0 }, { line: 0 }, 3);
  assert.equal(morph.from.glyph, '䷁');
  assert.equal(morph.to.form.address, 1);
  assert.notEqual(morph.to.glyph, morph.from.glyph);
  for (const end of [morph.from, morph.to]) {
    const [x, y, z] = end.place.point;
    const tube = Math.hypot(Math.hypot(x, y) - 1, z);
    assert.ok(Math.abs(tube - 9 / 16) < 1e-12, 'each form stands on the tube of M3′\'s torus');
    assert.ok(Math.abs(end.place.theta - (2 * Math.PI * 3) / 12) < 1e-12, 'read through the lens in force');
  }
  assert.ok(morph.to.place.phi > morph.from.place.phi, 'the forms\' circle carries them by address');
  // The engine's Morph drives the field round a torus of the same proportion.
  const shader = readFileSync(fileURLToPath(new URL('./shaders/simulationShaders.ts', import.meta.url)), 'utf8');
  assert.match(shader, /float rMinor = rMajor \* \$\{M3_TORUS_TUBE\.toFixed\(4\)\};/);
  assert.doesNotMatch(shader, /rMajor \* 0\.42/);
});

// The editor gives a symbol its form (O-I #852): a form picked from the library is kept on the symbol beside the text it draws, drawn
// as a fold, codon, hexagram or card of the same address, stepped a line or an axis, and its change added as the next link, so the
// sequence's Morph carries the one into the other along M3′'s torus.
test('the editor keeps a picked form on its symbol, draws it as any of the four, steps it, and morphs it to its change', () => {
  const forms = G.GLYPH_CATEGORIES.find((c) => c.id === 'm3-forms');
  assert.deepEqual(forms.items[0].form, { kind: 'hexagram', address: 0 });
  assert.deepEqual(forms.items.find((item) => item.char === 'Kn♦').form, { kind: 'card', address: 0b100011 }, 'a court by its first codon');
  for (const c of G.GLYPH_CATEGORIES.filter((c) => c.id !== 'm3-forms')) assert.ok(c.items.every((item) => item.form === undefined), c.id);
  assert.deepEqual(G.M3_FORM_KINDS.map((k) => k.kind), ['fold', 'codon', 'hexagram', 'card']);
  const card = { kind: 'card', address: 0 };
  assert.deepEqual(G.m3FormShape(card), { text: 'A♥', form: card });
  assert.deepEqual(G.m3FormShape({ ...card, kind: 'fold' }), { text: '⋎⋎⋎', form: { kind: 'fold', address: 0 } }, 'the same address drawn as a fold');
  assert.deepEqual(G.m3FormShape(G.stepM3Form(card, { line: 0 })), { text: '3♥', form: { kind: 'card', address: 1 } }, 'AAT, the Three of Cups');
  // A plain glyph keeps no form; text typed over a form's glyph leaves the form behind.
  assert.equal(G.formOfText({ text: 'A♥', form: card }, 'A♥'), card);
  assert.equal(G.formOfText({ text: 'A♥', form: card }, 'WORD'), undefined);
  // The picker hands the form with the glyph; the editor keeps it, steps it and adds its change as a link.
  const picker = readFileSync(fileURLToPath(new URL('../components/GlyphPicker.tsx', import.meta.url)), 'utf8');
  assert.match(picker, /onPick\(item\.char, item\.form\)/);
  const editor = readFileSync(fileURLToPath(new URL('../components/EntityEditor.tsx', import.meta.url)), 'utf8');
  assert.match(editor, /onPick=\{\(char, form\) => onUpdate\(\{ shape: \{ \.\.\.entity\.shape, text: char, form \} \}\)\}/);
  assert.match(editor, /onDraw\(m3FormShape\(stepM3Form\(form, step\)\)\)/, 'a step moves the symbol\'s form');
  assert.match(editor, /onDraw\(m3FormShape\(\{ kind: k\.kind, address: form\.address \}\)\)/, 'drawn as any of the four');
  assert.match(editor, /onDraw=\{\(next\) => onUpdate\(\{ shape: \{ \.\.\.entity\.shape, \.\.\.next \} \}\)\}/);
  assert.match(editor, /onMorph\(m3FormShape\(stepM3Form\(form, step\)\)\)/, 'its change');
  assert.match(editor, /onMorph=\{\(next\) => addLink\(\{ kind: 'glyph', \.\.\.next \}\)\}/, 'is the next link');
  assert.match(editor, /formOfText\(entity\.shape, /, 'typed text keeps the form only while it draws it');
});

function sheet(resolution, mask) {
  return {
    schema: S.FORM_SAMPLES_CONTRACT, prepRef: 'oi:psg:fold-body@1',
    treatment: mask ? 'glyph-mask' : 'sheet-carrier',
    layers: [{ layerRef: 'form:sheet', restDepthW: 0.5 }], resolution,
    units: { extentUnits: 2, depthUnits: 0.1, metresPerUnit: 0.25 },
    ...(mask ? { mask: { maskRef: 'app:rasteriser:form@1', coverages: mask } } : {}),
  };
}
const progress = (angles) => ({ schema: S.FOLD_PROGRESS_CONTRACT, cursor_steps: 0, site_angles_deg10: angles });

test('a fold\'s body folds its halves at the creases, as QL\'s form owner does', () => {
  const body = S.prepareSamples(sheet(2));
  // Allocation order v then u: (u0,v0) (u1,v0) (u0,v1) (u1,v1); rest x = ±0.5, y = ±0.5.
  const { positions, normals } = S.creaseFold(body, progress([900, 0, 0]));
  const at = (a, i) => Array.from(a.slice(i * 3, i * 3 + 3)).map((x) => Math.round(x * 1e12) / 1e12 + 0);
  assert.deepEqual(at(positions, 0), [-0.5, -0.5, 0], 'the near half stands');
  assert.deepEqual(at(normals, 0), [0, 0, 1]);
  assert.deepEqual(at(positions, 3), [0.5, 0, 0.5], 'the half beyond the X hinge folds up about it');
  assert.deepEqual(at(normals, 3), [0, -1, 0]);
  // A turn of the whole body moves every point and creases nothing.
  const turned = S.creaseFold(body, progress([0, 0, 900]));
  assert.deepEqual(at(turned.positions, 1), [0.5, 0.5, 0]);
  for (let i = 0; i < 4; i++) assert.deepEqual(at(turned.normals, i), [0, 0, 1]);
  // applyFold, the pose, turns the whole body: it is not the body's fold.
  assert.notDeepEqual(at(S.applyFold(body, progress([900, 0, 0])), 0), at(positions, 0));
});

test('the body QL is asked for, its native names and its picture from the same state', () => {
  const body = S.prepareSamples(sheet(4));
  const ask = {
    eventRef: 'event:e', subjectRef: 'person:p', sourceGeneration: 7,
    form: { kind: 'fold', formRef: 'm3-prime:fold/vmv', sourceRef: 'ql.psg-fold-progress/v1:x' },
    preparation: sheet(4), creaseDeg10: [900, -450, 0],
    material: { fibre: 'earth', qFactor: 40, strikeShare: 0.7, sourceRef: 'declared' }, modes: 8, sampleRate: 48000,
  };
  const request = S.formBodyRequest(ask);
  assert.equal(request.schema, 'ql.form-body-request/v1');
  assert.deepEqual(Object.keys(request), ['schema', 'event_ref', 'subject_ref', 'source_generation', 'form', 'samples', 'crease_deg10', 'material', 'modes', 'sample_rate']);
  assert.deepEqual(request.samples.units, { extent_units: 2, depth_units: 0.1, metres_per_unit: 0.25 });
  assert.deepEqual(request.material, { fibre: 'earth', q_factor: 40, strike_share: 0.7, source_ref: 'declared' });
  assert.throws(() => S.formBodyRequest({ ...ask, preparation: sheet(20) }), /at most 256 samples/);
  assert.throws(() => S.formBodyRequest({ ...ask, modes: 0 }), /modes/);
  assert.throws(() => S.formBodyRequest({ ...ask, material: { ...ask.material, qFactor: 0 } }), /Q factor/);
  // A native name is the sample ID's low 53 bits.
  const id = body.samples[5].sampleId;
  assert.equal(S.bodyIdentity(id), Number(id & ((1n << 53n) - 1n)));
  assert.ok(Number.isSafeInteger(S.bodyIdentity(id)));
  // The Body: the torus, or the prepared body for this request; a body for another form is refused.
  assert.deepEqual(S.selectBody(null), { kind: 'torus' });
  const prepared = { schema: 'ql.physical-body-preparation/v1', contract: 'ql.physical-body/v1', event_ref: 'event:e', form: request.form };
  assert.equal(S.selectBody(prepared, request).kind, 'form');
  assert.throws(() => S.selectBody({ ...prepared, form: { ...request.form, form_ref: 'other' } }, request), /another form/);
  assert.throws(() => S.selectBody({ schema: 'ql.torus-checkpoint/v1' }), /physical-body-preparation/);
  // The picture: each point where the owner's frame draws it, by name; an undrawn point is left out.
  const frame = { targets: body.samples.slice(0, 3).map((s, i) => ({ identity: S.bodyIdentity(s.sampleId), constituent: '#3-3', position: [i, 0.5, -i] })) };
  const picture = S.bodyPicture(frame, body);
  assert.equal(picture.size, 3);
  assert.deepEqual(picture.get(body.samples[2].sampleId), [2, 0.5, -2]);
  assert.equal(picture.get(body.samples[9].sampleId), undefined);
});
