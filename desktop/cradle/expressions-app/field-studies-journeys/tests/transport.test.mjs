// lane-3 E24: working-view transport (transport.ts). Shuttle ramp and K return, single-frame steps, the scrub law, the
// session round trip, and the app's key and clock wiring. Run after `npm run build:journeys` (imports the bundled build/ modules).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  STOPPED_TRANSPORT, PLAYING_TRANSPORT, TRANSPORT_FRAME_SECONDS, SHUTTLE_RAMP,
  shuttle, pauseTransport, beginScrub, endScrub, stepFrame, transportRate, transportPlaying,
  transportReadout, validateWorkingTransport,
} from '../build/transport.js';
import {advanceSceneTransport} from '../build/sceneTransport.js';

const here = fileURLToPath(new URL('.', import.meta.url));
const appSource = readFileSync(join(here, '../src/app.ts'), 'utf8');
const recoverySource = readFileSync(join(here, '../src/recovery.ts'), 'utf8');
const stopped = STOPPED_TRANSPORT;

test('J and L ramp ×1, ×2, ×4 per press and hold at ×4', () => {
  let t = shuttle(stopped, 1);
  assert.deepEqual([t.mode, t.rate], ['shuttle', 1]);
  t = shuttle(t, 1);
  assert.equal(t.rate, 2);
  t = shuttle(t, 1);
  assert.equal(t.rate, 4);
  t = shuttle(t, 1);
  assert.equal(t.rate, 4, 'the last magnitude holds');
  let back = shuttle(stopped, -1);
  assert.equal(back.rate, -1);
  back = shuttle(back, -1);
  assert.equal(back.rate, -2);
  assert.deepEqual(SHUTTLE_RAMP, [1, 2, 4]);
});

test('L from play goes to ×2 at once, because play is already ×1', () => {
  const t = shuttle(PLAYING_TRANSPORT, 1);
  assert.equal(t.rate, 2);
  assert.equal(t.resume, 'play');
});

test('a press against the shuttle restarts at ×1 in the new direction', () => {
  const forward = shuttle(shuttle(stopped, 1), 1);
  assert.equal(forward.rate, 2);
  const reversed = shuttle(forward, -1);
  assert.equal(reversed.rate, -1);
});

test('K ends a shuttle and returns to the state it began from', () => {
  const fromStop = pauseTransport(shuttle(shuttle(stopped, 1), 1));
  assert.deepEqual(fromStop, stopped, 'a shuttle begun from stop returns to stop');
  const fromPlay = pauseTransport(shuttle(shuttle(PLAYING_TRANSPORT, 1), 1));
  assert.deepEqual(fromPlay, PLAYING_TRANSPORT, 'a shuttle begun from play returns to play');
  const reversedFromPlay = pauseTransport(shuttle(PLAYING_TRANSPORT, -1));
  assert.equal(reversedFromPlay.mode, 'play', 'reversing and then K still returns to play');
});

test('K outside a shuttle pauses playback', () => {
  assert.deepEqual(pauseTransport(PLAYING_TRANSPORT), stopped);
  assert.deepEqual(pauseTransport(stopped), stopped);
});

test('a frame step is exactly one frame in one direction and leaves the transport held', () => {
  const forward = stepFrame(PLAYING_TRANSPORT, 1);
  assert.equal(forward.seconds, TRANSPORT_FRAME_SECONDS);
  assert.deepEqual(forward.transport, stopped);
  const back = stepFrame(stopped, -1);
  assert.equal(back.seconds, -TRANSPORT_FRAME_SECONDS);
  assert.equal(transportRate(back.transport), 0, 'a stepped playhead does not keep moving');
});

test('scrubbing holds the clock: rate 0, not playing, and the scene playhead does not advance', () => {
  const scrubbing = beginScrub(PLAYING_TRANSPORT);
  assert.equal(scrubbing.mode, 'scrub');
  assert.equal(transportRate(scrubbing), 0);
  assert.equal(transportPlaying(scrubbing), false);
  // The auto-advance with the working transport held (scrub is not playing) returns the elapsed time unchanged.
  const journey = {scenes: [{id: 'a', duration: 10}]};
  const frame = advanceSceneTransport(journey, 0, 3, 1 / 30, {playing: false, savedSequence: false, hidden: false,
    libraryOpen: false, propertyRecording: false, editing: false});
  assert.equal(frame.elapsed_seconds, 3);
  assert.equal(frame.scene_playing, false);
  // The pointer lets go: the seek that scrubbing performed already stopped playback, so the transport ends stopped.
  assert.deepEqual(endScrub(scrubbing), stopped);
  assert.equal(endScrub(PLAYING_TRANSPORT).mode, 'play', 'endScrub changes nothing outside a scrub');
});

test('shuttle is ignored while scrubbing', () => {
  const scrubbing = beginScrub(stopped);
  assert.equal(shuttle(scrubbing, 1), scrubbing);
  assert.equal(pauseTransport(scrubbing), scrubbing, 'K does not end a scrub');
});

test('the rate is the clock: play 1, shuttle signed, stop 0', () => {
  assert.equal(transportRate(PLAYING_TRANSPORT), 1);
  assert.equal(transportRate(shuttle(stopped, -1)), -1);
  assert.equal(transportRate(stopped), 0);
  assert.equal(transportPlaying(shuttle(stopped, 1)), true);
});

test('readouts name the mode and the rate', () => {
  assert.equal(transportReadout(stopped), 'Stopped');
  assert.equal(transportReadout(PLAYING_TRANSPORT), 'Playing');
  assert.equal(transportReadout(shuttle(shuttle(stopped, 1), 1)), '▸ ×2');
  assert.equal(transportReadout(shuttle(stopped, -1)), '◂ ×1');
  assert.equal(transportReadout(beginScrub(stopped)), 'Scrubbing');
});

test('the session keeps a valid transport, returns a scrub stopped and drops what is malformed', () => {
  assert.deepEqual(validateWorkingTransport(PLAYING_TRANSPORT), PLAYING_TRANSPORT);
  assert.deepEqual(validateWorkingTransport(beginScrub(PLAYING_TRANSPORT)), stopped, 'a scrub does not survive a reload');
  const kept = validateWorkingTransport({mode: 'shuttle', rate: -4, resume: 'play'});
  assert.deepEqual(kept, {mode: 'shuttle', rate: -4, resume: 'play'});
  assert.equal(validateWorkingTransport({mode: 'shuttle', rate: 3, resume: 'stop'}), undefined, 'a rate off the ramp is refused');
  assert.equal(validateWorkingTransport({mode: 'play', rate: 1, resume: 'maybe'}), undefined);
  assert.equal(validateWorkingTransport('play'), undefined);
  assert.equal(validateWorkingTransport(undefined), undefined);
});

test('the app keys J, K, L, comma and period are wired, and Cmd/Ctrl+4 answers before the modifier return', () => {
  const keydown = appSource.indexOf("document.addEventListener('keydown'");
  assert.ok(keydown > 0, 'the keydown handler exists');
  const cmd4 = appSource.indexOf("ev.key==='4'", keydown);
  const modifierReturn = appSource.indexOf('if(ev.metaKey||ev.ctrlKey||ev.altKey)return;', keydown);
  assert.ok(cmd4 > 0 && modifierReturn > 0 && cmd4 < modifierReturn, 'Cmd/Ctrl+4 has its own branch before the early return');
  const jkl = appSource.indexOf("if(k==='k')", keydown);
  const shortcuts = appSource.indexOf('const shortcuts:Record<string,string>=', keydown);
  assert.ok(jkl > 0 && jkl < shortcuts, 'J, K and L are handled before the shortcut map');
  assert.doesNotMatch(appSource.slice(shortcuts, shortcuts + 240), /\b[jkl]:/, 'the shortcut map binds none of J, K or L');
  assert.ok(appSource.includes("k===','||k==='.'"), 'comma and period step between snap points');
});

test('the auto-advance clock reads the working transport rate, and a reverse shuttle is held out of the forward advance', () => {
  const tick = appSource.indexOf('function tick(now:number)');
  const frame = appSource.indexOf('advanceSceneTransport(store.document,sceneIndex,sceneElapsed', tick);
  assert.ok(tick > 0 && frame > tick, 'the frame loop advances the scene through advanceSceneTransport');
  const window = appSource.slice(frame - 400, frame + 200);
  assert.ok(window.includes('transportRate(workingTransport)'), 'the advance is scaled by the transport rate');
  assert.ok(window.includes('reverse?0:'), 'a reverse shuttle is not advanced forward');
  assert.ok(appSource.includes('workingTransport=recovered.workingTransport??STOPPED_TRANSPORT'), 'a reload restores the transport');
  assert.ok(appSource.includes('workingTransport};localStorage.setItem(SESSION_KEY'), 'the session saves the transport');
  assert.ok(recoverySource.includes('workingTransport:working'), 'the recovery session validates the working transport');
});
