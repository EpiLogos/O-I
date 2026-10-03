import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';

// Compile the real production modules in memory. No mock resonator, copied
// oscillator arithmetic, semantic constitution or persisted test scene.
const engine = fileURLToPath(new URL('../expressions-app/src/engine/', import.meta.url));
const bundle = await build({stdin: {contents: `export * from './LocalizedResonanceBank'; export * from './cymaticResonator'; export {MAX_FORMATIONS} from './fieldModel'; export {projectNativePlanetaryResonanceDrivers} from '../../field-studies-journeys/src/naraEvidenceField';`, resolveDir: engine}, bundle: true, platform: 'node', format: 'esm', write: false});
const {LocalizedResonanceBank, CymaticResonator, DEFAULT_RESONATOR_PARAMS, MAX_FORMATIONS, projectNativePlanetaryResonanceDrivers} = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const driver = (entityId, frequencyHz, dimension = '2D', driverRef) => ({...(driverRef ? {driverRef} : {}), entityId, position: [0, 0, 0], frequencyHz, params: {...DEFAULT_RESONATOR_PARAMS, dimension}});
const vectors = frame => [Array.from(frame.re), Array.from(frame.im)];

test('distinct localized drivers equal the retained physical owners in both supported dimensions', () => {
  const bank = new LocalizedResonanceBank();
  const drivers = [driver('plate', 148), driver('cavity', 221, '3D')];
  const controls = drivers.map(d => new CymaticResonator(d.params));
  bank.configure(drivers);
  let frames;
  for (let i = 0; i < 70; i++) {
    frames = bank.step(1 / 60);
    controls.forEach((control, n) => {
      const telemetry = control.step(1 / 60, drivers[n].frequencyHz);
      assert.deepEqual(vectors(frames[n]), [Array.from(control.re), Array.from(control.im)]);
      assert.deepEqual(frames[n].modes, control.getModalState());
      assert.deepEqual(frames[n].telemetry, telemetry);
      assert.equal(frames[n].representation, 'slow-complex-envelope');
    });
  }
  assert.notDeepEqual(vectors(frames[0]), vectors(frames[1]));
});

test('frequency, material, location and ordering changes continue each exact resident state', () => {
  const a = driver('a', 148), b = driver('b', 184);
  const bank = new LocalizedResonanceBank(), control = new CymaticResonator(a.params);
  bank.configure([a, b]);
  bank.step(0.04); control.step(0.04, a.frequencyHz);
  const before = bank.step(0), changed = {...a, frequencyHz: 210, position: [12, 34, 56], params: {...a.params, dampingQ: 12}};
  bank.configure([b, changed]); control.configure(changed.params);
  const unchanged = bank.step(0);
  assert.deepEqual(vectors(unchanged[0]), vectors(before[1]));
  assert.deepEqual(vectors(unchanged[1]), vectors(before[0]));
  assert.deepEqual(unchanged[1].position, changed.position);
  const after = bank.step(0.03)[1]; control.step(0.03, changed.frequencyHz);
  assert.deepEqual(vectors(after), [Array.from(control.re), Array.from(control.im)]);
  const reset = new CymaticResonator(changed.params); reset.step(0.03, changed.frequencyHz);
  assert.notDeepEqual(vectors(after), [Array.from(reset.re), Array.from(reset.im)]);
});

test('returned buffers and caller objects cannot mutate the resident field; removal releases it', () => {
  const input = driver('retained', 145), bank = new LocalizedResonanceBank();
  bank.configure([input]);
  const frame = bank.step(0.04), expected = vectors(frame[0]);
  input.position[0] = 99; input.params.baseFrequency = 99;
  frame[0].re.fill(99); frame[0].im.fill(99); frame[0].position[0] = 99; frame[0].params.baseFrequency = 99; frame[0].modes[0].re = 99;
  const fresh = bank.step(0)[0];
  assert.deepEqual(vectors(fresh), expected);
  assert.equal(fresh.position[0], 0); assert.equal(fresh.params.baseFrequency, DEFAULT_RESONATOR_PARAMS.baseFrequency);
  bank.configure([]); assert.deepEqual(bank.step(0.04), []);
  bank.configure([driver('retained', 145)]);
  assert.ok(vectors(bank.step(0)[0]).flat().every(x => x === 0));
});

test('invalid complete updates refuse atomically and a changed modal basis requires release', () => {
  const bank = new LocalizedResonanceBank(), a = driver('a', 148), b = driver('b', 184);
  bank.configure([a, b]); const before = bank.step(0.04).map(vectors);
  const missing = {...b, params: {...b.params}}; delete missing.params.driveZ;
  const invalid = [
    [a, {...b, frequencyHz: NaN}], [a, missing], [a, {...b, params: {...b.params, invented: 1}}],
    [a, {...b, params: {...b.params, baseFrequency: Number.MAX_VALUE}}], [a, {...b, params: {...b.params, driveStrength: Number.MAX_VALUE}}],
    [a, {...b, position: [0, Infinity, 0]}], [a, {...b, position: Array(3)}],
    [a, {...b, params: {...b.params, modeCount: 1.5}}], [a, a], [a, {...b, params: {...b.params, dimension: '3D'}}],
  ];
  for (const values of invalid) {
    assert.throws(() => bank.configure(values));
    assert.deepEqual(bank.step(0).map(vectors), before);
  }
  for (const dt of [-1, NaN, Infinity]) assert.throws(() => bank.step(dt));
  assert.deepEqual(bank.step(0).map(vectors), before);
  bank.configure([a]); bank.configure([a, driver('b', 184, '3D')]);
  assert.equal(bank.step(0)[1].params.dimension, '3D');
});

test('driver capacity follows the existing formation budget without a second semantic registry', () => {
  const bank = new LocalizedResonanceBank();
  const drivers = Array.from({length: MAX_FORMATIONS}, (_, i) => driver(`entity-${i}`, 148));
  bank.configure(drivers); assert.equal(bank.step(0).length, MAX_FORMATIONS);
  assert.throws(() => bank.configure([...drivers, driver('excess', 148)]));
  assert.equal(bank.step(0).length, MAX_FORMATIONS);
});

test('independent driver identities may share one target entity without sharing modal state', () => {
  const bank = new LocalizedResonanceBank();
  const moon = driver('ajna', 210, '2D', 'native-planet:moon');
  const neptune = driver('ajna', 211.44, '2D', 'native-planet:neptune');
  bank.configure([moon, neptune]);
  let frames;
  for (let i = 0; i < 30; i++) frames = bank.step(1 / 60);
  assert.equal(frames.length, 2);
  assert.deepEqual(frames.map(frame => frame.entityId), ['ajna', 'ajna']);
  assert.deepEqual(frames.map(frame => frame.driverRef), ['native-planet:moon', 'native-planet:neptune']);
  assert.notDeepEqual(vectors(frames[0]), vectors(frames[1]));
  assert.throws(() => bank.configure([moon, {...neptune, driverRef: moon.driverRef}]));
  assert.deepEqual(bank.step(0).map(frame => frame.driverRef), ['native-planet:moon', 'native-planet:neptune']);
});

const nativeInputs=[process.env.OI_TEST_PROFILE_A,process.env.OI_TEST_PROFILE_B];
test('actual qualified native A/B readings retain nine voices over seven centre targets', {skip:!process.env.OI_TEST_QL_BIN||nativeInputs.some(value=>!value)}, () => {
  for(const [index,path] of nativeInputs.entries()){
    const child=spawnSync(process.env.OI_TEST_QL_BIN,['nara','calculate','-','--json'],{input:readFileSync(path),encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024,env:process.env});
    assert.equal(child.status,0,child.stderr||String(child.error));
    const reading=JSON.parse(child.stdout),natal=reading.natal_composition,bindings=Array.from({length:7},(_,ordinal)=>({ordinal,entityId:`centre:${ordinal}`}));
    const drivers=projectNativePlanetaryResonanceDrivers(natal,natal.presentation_partition,bindings,`controlled-source:${index}`);
    assert.equal(drivers.length,9);assert.equal(new Set(drivers.map(value=>value.driverRef)).size,9);assert.equal(new Set(drivers.map(value=>value.entityId)).size,7);
    assert.deepEqual(drivers.filter(value=>value.entityId==='centre:5').map(value=>value.frequencyHz),[210,211]);
    assert.deepEqual(drivers.filter(value=>value.entityId==='centre:6').map(value=>value.frequencyHz),[126,140]);
    assert.equal(natal.planetary_contributions.find(value=>value.body==='Uranus').receiving_centre_ordinal,null);
    const params={...DEFAULT_RESONATOR_PARAMS},bank=new LocalizedResonanceBank();
    bank.configure(drivers.map(value=>({driverRef:value.driverRef,entityId:value.entityId,frequencyHz:value.frequencyHz,
      position:[0,0,0],params:{...params,driveStrength:params.driveStrength*value.driveShare}})));
    const frames=bank.step(1/60);assert.equal(frames.length,9);assert.equal(new Set(frames.map(value=>value.driverRef)).size,9);
  }
});
