// O-I 854 (DLW §20.14 Modes: "The lens in force gives the surface its material"; M2′ seed §2.M2-1′: "A lens does not pick the pitch; it
// determines how the surface receives and shows that pitch", "Lx and Lx′ … must render opposite surface valence"). QL's Torus reading
// gives the material the lens in force gives the surface (scene_field.rs lens_material_of, m2_material.rs); the frame reads it as it
// stands and lays it on the particles' marks and the colour field. It moves no note: nothing the frame sounds reads it.
//
//   node --test desktop/cradle/expressions-app/field-studies-journeys/tests/lens-material-854.test.mjs
import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const journeys = fileURLToPath(new URL('..', import.meta.url));
const out = mkdtempSync(join(tmpdir(), 'lens-material-854-'));
after(() => rmSync(out, {recursive: true, force: true}));
const load = async (entry, name) => {
  const outfile = join(out, `${name}.mjs`);
  await esbuild.build({absWorkingDir: journeys, nodePaths: [join(journeys, '../node_modules')], entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent'});
  return import(pathToFileURL(outfile).href);
};
const {torusPlayReading} = await import(pathToFileURL(join(journeys, 'src/native-field/torusPlay.mjs')).href);
const surface = await load(join(journeys, '../src/engine/surfaceMaterial.ts'), 'surface');

// QL m2_material.rs lens_material(L5′, 1) and lens_material(L5, 1), as the owner's Torus reading gives them.
const alpha = 2 * Math.PI * (6 * 5 + 1) / 36;
const day = {lens: 'L5', partner: "L5'", face: 'day', position: 1, valence: 1,
  colour_rgb: [0, 1, 2].map(j => 0.5 + 0.5 * Math.cos(alpha - 2 * Math.PI * j / 3)), roughness: 0.25 + 0.2 * Math.sin(alpha),
  elasticity: 0.5 + 0.4 * Math.cos(alpha), particle_affinity: 0.5 + 0.4 * Math.sin(2 * alpha), tension: 0.5 + 0.4 * Math.cos(2 * alpha),
  standing: 'declared-policy', law: 'M2-1′'};
const mirror = m => ({...m, lens: m.partner, partner: m.lens, face: m.face === 'day' ? 'night' : 'day', valence: -m.valence,
  colour_rgb: m.colour_rgb.map(c => 1 - c), roughness: 1 - m.roughness, elasticity: 1 - m.elasticity, particle_affinity: 1 - m.particle_affinity, tension: 1 - m.tension});
const night = mirror(day);
const reading = (torus) => ({status: 'following', instrument: {acting: {voices: [{mode_ref: 'scene:planet/#2-5-0/1', planet_ref: '#2-5-0/1', frequency_hz: 220}]},
  influence: {voices: []}, torus_object: null, struck: null, torus}});

test('the frame reads the material the owner gives the surface, as it stands, and says why when there is none', () => {
  const read = torusPlayReading(reading({steps: 0, steps_per_second: 2.5, material: night})).material;
  assert.equal(read.absentBecause, null);
  assert.equal(read.lens, "L5'"); assert.equal(read.partner, 'L5'); assert.equal(read.valence, -1);
  assert.deepEqual(read.colour_rgb, night.colour_rgb);
  assert.deepEqual([read.roughness, read.elasticity, read.particle_affinity, read.tension], [night.roughness, night.elasticity, night.particle_affinity, night.tension]);
  assert.match(torusPlayReading(null).material.absentBecause, /No instrument is open/);
  assert.match(torusPlayReading(reading({steps: 0})).material.absentBecause, /names no material/);
  assert.match(torusPlayReading(reading({material: {absent: 'a lens\'s position runs 0..6, not 7'}})).material.absentBecause, /The owner gives no material: a lens's position runs 0\.\.6/);
  assert.match(torusPlayReading(reading({material: {...night, roughness: 1.5}})).material.absentBecause, /not a lens's surface/);
});

test('the lens\'s material lies on the particles\' marks and the colour field, and moves nothing else: no note, no body, no force', () => {
  const config = {particleCount: 4096, particleSize: {min: 1, max: 2}, material: {sizeBias: 1.4, opacity: 0.8},
    color: {enabled: true, mode: 'gradient', primaryColor: '#000000', secondaryColor: '#ffffff', accentColor: '#ff0000'},
    cymatics: {enabled: true, engine: 'modal'}, resonanceDrive: {enabled: true}, composition: {focus: 'still'}};
  const laid = surface.surfaceMaterial(config, torusPlayReading(reading({material: day})).material);
  assert.equal(laid.material.irregularity, day.roughness);
  assert.equal(laid.material.softness, day.elasticity);
  assert.equal(laid.material.contrast, day.tension);
  assert.equal(laid.material.halo, surface.HALO_MAX * (1 - day.particle_affinity), 'particles that gather less leave more peripheral ink');
  assert.equal(laid.material.sizeBias, 1.4, 'the scene\'s own marks stand where the lens says nothing');
  assert.equal(laid.material.opacity, 0.8);
  assert.equal(laid.color.primaryColor, surface.hexOf(day.colour_rgb));
  for (const key of ['particleCount', 'particleSize', 'cymatics', 'resonanceDrive', 'composition']) assert.equal(laid[key], config[key], `${key}: untouched`);
  assert.equal(config.material.irregularity, undefined, 'the authored configuration is never written');
  // A lens and its partner show opposite surfaces.
  const other = surface.surfaceMaterial(config, torusPlayReading(reading({material: night})).material);
  for (const key of ['irregularity', 'softness', 'contrast']) assert.ok(Math.abs(laid.material[key] + other.material[key] - 1) < 1e-12, key);
  assert.notEqual(other.color.primaryColor, laid.color.primaryColor);
  // A scene whose colour field is off keeps its ink: the lens gives the marks only.
  const ink = surface.surfaceMaterial({...config, color: {...config.color, enabled: false}}, torusPlayReading(reading({material: day})).material);
  assert.equal(ink.color.primaryColor, '#000000');
});

test('the native frame lays the owner\'s material on the scene it draws, and the same reading gives the same configuration', async () => {
  const production = await load(join(journeys, 'src/native-field/surfaceConfig.ts'), 'surface-config');
  const config = {particleCount: 64, particleSize: {min: 1, max: 2}, toroidalMorph: {enabled: true, autoOscillate: true}, automations: []};
  const a = production.nativeSurface(config, torusPlayReading(reading({material: day})));
  assert.equal(a.toroidalMorph.enabled, false, 'the plate rings no plate of its own (O-I 851)');
  assert.equal(a.material.irregularity, day.roughness);
  assert.equal(production.nativeSurface(config, torusPlayReading(reading({material: day}))), a, 'the same reading: the same configuration, so nothing is re-applied');
  const b = production.nativeSurface(config, torusPlayReading(reading({material: night})));
  assert.notEqual(b, a); assert.equal(b.material.irregularity, night.roughness);
  assert.equal(production.nativeSurface(config, torusPlayReading(null)).material, undefined, 'no instrument: the scene\'s own surface');
});
