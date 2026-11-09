/** Port ledger conformance: every Expressions row names its outward home and its boundary operation, or says
 * explicitly why it has none (`none:`) or what owner operation it waits for (`pending:`). Real operations cite
 * their file:line. The crosswalk destinations stay inside the shell's destination vocabulary, and no target is
 * promoted to native exercise. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

const here = new URL('../../docs/world-shell/', import.meta.url);
const ledger = JSON.parse(readFileSync(join(here.pathname, 'EXPRESSIONS-PORT-STATUS.json'), 'utf8'));
const crosswalk = JSON.parse(readFileSync(join(here.pathname, 'FUNCTIONAL-CROSSWALK.json'), 'utf8'));

// A `none:` marker is legitimate only where the row has no boundary operation by design; a `pending:` marker only
// where the capability waits on an owner, another track, or a missing native op.
const NONE_STATUSES = new Set(['ported', 'partial', 'internal-no-outward-need', 'studio-only-by-design']);
const PENDING_STATUSES = new Set(['owner-op-required', 'out-of-scope-other-track', 'not-ported']);
const FILE_LINE = /[\w./-]+\.(?:ts|tsx|mjs|rs|json|md):\d+/;

// Pre-existing rows whose recorded boundary operation sits on an owner, out-of-scope, internal or studio status. Reported
// to the lead as ledger inconsistencies (2026-10-14); the ceiling may shrink as statuses are reconciled, never grow.
// O-I #747 shrank it by two: cancel-placement is ported (Clip view's Select) and fire-lane (since retired by ruling, round 881b) no
// longer records an operation.
// O-I #747 round 894 shrank it by four: library, keep, native-library and chakra-add are ported (the works acts and the presets).
const KNOWN_REAL_OP_ON_OPEN_STATUS = new Set(["lens","deep-lived"]);

test('every ledger row names its outward home and a boundary operation or explicit marker', () => {
  assert.equal(ledger.schema, 'oi.expressions-port-status/v1');
  assert.equal(ledger.rows.length, 213);
  const actions = ledger.rows.map(row => row.action);
  assert.equal(new Set(actions).size, actions.length, 'action ids are unique');
  for (const row of ledger.rows) {
    assert.ok(typeof row.outward_home === 'string' && row.outward_home.trim(), `${row.action}: outward_home is named`);
    assert.ok(typeof row.boundary_op === 'string' && row.boundary_op.trim(), `${row.action}: boundary_op is named or marked`);
    const op = row.boundary_op;
    if (op.startsWith('none:')) {
      assert.ok(NONE_STATUSES.has(row.status), `${row.action}: none: marker on status ${row.status}`);
      assert.ok(op.length > 'none:'.length + 20, `${row.action}: none: marker carries a reason`);
    } else if (op.startsWith('pending:')) {
      assert.ok(PENDING_STATUSES.has(row.status), `${row.action}: pending: marker on status ${row.status}`);
      assert.ok(op.length > 'pending:'.length + 20, `${row.action}: pending: marker names the owner or missing operation`);
    } else if (!(row.status === 'ported' || row.status === 'partial')) {
      assert.ok(KNOWN_REAL_OP_ON_OPEN_STATUS.has(row.action), `${row.action}: a real operation on status ${row.status} is an uncommissioned conflict`);
    }
  }
  // The rows this lane filled cite their evidence: a real operation recorded here must name a file:line.
  assert.match(ledger.rows.find(row => row.action === 'native-retry-open').boundary_op, FILE_LINE);
});

// O-I #747 (manual §20.1 "Where everything is": everything Expressions does has one place). The app's own Studio stands down in the
// field pane, so nothing is retained in it: each of the eleven rows that stayed "studio-only-by-design" takes the home the manual gives it,
// or is marked by the ledger's own vocabulary as what it is (`pending:` naming what it waits for). The ledger keeps no retained row.
const STUDIO_ROWS = ['studio', 'close-studio', 'dock-studio', 'edit', 'tab', 'entry-continue', 'cancel-placement', 'delete-group', 'fire-lane', 'take-manual', 'save-browser'];

test('no row is retained in the app\'s Studio: each takes its manual home or names what it waits for', () => {
  assert.equal(ledger.counts['studio-only-by-design'], undefined, 'no studio-only-by-design count');
  for (const action of STUDIO_ROWS) {
    const row = ledger.rows.find(item => item.action === action);
    assert.ok(row, `${action}: still a row`);
    assert.notEqual(row.status, 'studio-only-by-design', `${action}: retained in the app's Studio`);
    assert.doesNotMatch(row.outward_home, /legacy|retained during port|Studio inspector|Studio placement|Studio Automation|Studio browser/i, `${action}: its home is the manual's, not the app's Studio`);
    assert.match(row.outward_home, /§\d+(\.\d+)*/, `${action}: the home cites the manual section that gives it`);
  }
  for (const row of ledger.rows) assert.notEqual(row.status, 'studio-only-by-design', `${row.action}: retained in the app's Studio`);
});

// O-I #747, round 881: no row keeps the app's Studio by its surface or its words either. Device "Open in studio" opens the section where
// it lives (panels/expressions.tsx → studioHome.ts), so studio-section is no longer "retained by design"; and take-manual is each value's
// own: a field device takes hold of a value its lane plays, and its hand-back light gives that one value back (manual §20.1 Rules).
test('#747: no row keeps the app\'s Studio as its surface or "retained by design"; take-manual is each value\'s own hand-back', () => {
  for (const row of ledger.rows) {
    assert.notEqual(row.surface, 'studio-only', `${row.action}: its surface is the app's Studio`);
    assert.doesNotMatch(row.note ?? '', /retained by design during the port/i, `${row.action}: retained in the app's Studio`);
  }
  const take = ledger.rows.find(row => row.action === 'take-manual');
  assert.equal(take.status, 'ported', 'take-manual: a value takes hold and gives back by its own light');
  for (const file of ['packages/live-shell/ui/tests/field-design-bindings.test.mjs', 'packages/live-shell/ui/tests/native-live-channel.test.mjs'])
    assert.ok(take.tests.includes(file), `take-manual: ${file}`);
  assert.match(take.boundary_op, FILE_LINE, 'take-manual: its operation cites its file:line');
  assert.equal(ledger.rows.find(row => row.action === 'studio-section').status, 'ported', 'studio-section: the section opens where it lives');
});

// O-I #747, round 881b, DLW build rulings 2026-11-06. Delete removes what is selected (manual §10.9: "The same keys act on whatever is
// selected"; its key table: "Delete it | ⌫"), and the Automation device removes the selected lane (automation-remove), so delete-group is
// that removal: never a leader with all its followers in one act. A ramp's Loop says what it does at its end (§20.1 Envelopes: "Once ·
// Loop (restart) · Ping-pong"), and launching the scene starts its envelopes again, so restarting one Once ramp is no act of the manual:
// fire-lane is retired. And the live monitor is not the manual's (§20.1 Rules: "An envelope's curve is the shape set in the lane. It is
// not a record of the live output."): monitor-mode and monitor-dock are retired.
test('#747: delete-group is the selected lane\'s removal; fire-lane, monitor-mode and monitor-dock are retired by their rulings', () => {
  const row = action => ledger.rows.find(item => item.action === action);
  const remove = row('delete-group');
  assert.equal(remove.status, 'ported', 'delete-group: the Automation device removes the selected lane');
  assert.equal(remove.surface, 'device', 'delete-group: on the Automation device');
  assert.match(remove.outward_home, /§10\.9/, 'delete-group: Delete acts on whatever is selected');
  assert.match(remove.boundary_op, /automation-remove/);
  assert.match(remove.boundary_op, /removeLaneChange/);
  assert.match(remove.boundary_op, /removeAutomation/, 'delete-group: says what scope lane does to a leader\'s followers');
  assert.match(remove.boundary_op, FILE_LINE);
  for (const file of ['packages/live-shell/ui/tests/native-device-automation.test.mjs', 'packages/live-shell/ui/tests/native-automation.test.mjs'])
    assert.ok(remove.tests.includes(file), `delete-group: ${file}`);
  assert.match(remove.note, /DLW build ruling 2026-11-06/, 'delete-group: cites its ruling');
  for (const action of ['fire-lane', 'monitor-mode', 'monitor-dock']) {
    const retired = row(action);
    assert.equal(retired.status, 'internal-no-outward-need', `${action}: retired`);
    assert.equal(retired.surface, 'internal', `${action}: no outward surface`);
    assert.match(retired.boundary_op, /^none: retired by DLW build ruling 2026-11-06/, `${action}: no operation, by its ruling`);
    assert.match(retired.note, /DLW build ruling 2026-11-06/, `${action}: cites its ruling`);
    assert.equal(retired.tests.length, 0, `${action}: nothing is built for it`);
  }
  assert.match(row('fire-lane').note, /Once · Loop \(restart\) · Ping-pong/, 'fire-lane: the ramp\'s Loop says what it does at its end');
  assert.match(row('fire-lane').note, /over the scene/, 'fire-lane: launching the scene starts its envelopes again');
  for (const action of ['monitor-mode', 'monitor-dock'])
    assert.match(row(action).note, /An envelope's curve is the shape set in the lane\. It is not a record of the live output\./, `${action}: §20.1 Rules`);
});

// O-I #747, round 882, DLW build ruling 2026-11-06, under the same §20.1 Rules sentence ("An envelope's curve is the shape set in the lane.
// It is not a record of the live output."): show-monitor waits for no live monitor, since the Monitor section draws the shape set in the
// lane; and the live monitor's Glyph picker is retired with that monitor, so monitor-formation is the Glyph selected, through the owner's
// select. And ⌫ on the Automation device removes the selected lane (§10.9: "The same keys act on whatever is selected"), as its Remove
// buttons do, only while focus is in the device and never from a text field: delete-group says so.
test('#747: show-monitor draws the shape set in the lane; monitor-formation is the Glyph selected, its live monitor retired; ⌫ removes the selected lane', () => {
  const row = action => ledger.rows.find(item => item.action === action);
  const monitor = row('show-monitor');
  assert.equal(monitor.status, 'ported', 'show-monitor: the Monitor section draws the shape set in the lane');
  assert.match(monitor.outward_home, /§20\.1/, 'show-monitor: its home cites the manual');
  assert.match(monitor.boundary_op, /^none: /, 'show-monitor: no owner operation by design');
  assert.match(monitor.boundary_op, FILE_LINE, 'show-monitor: the section it shows cites its file:line');
  assert.doesNotMatch(`${monitor.boundary_op} ${monitor.note}`, /pending under monitor-mode|Owner-block/, 'show-monitor: waits for no live monitor');
  assert.match(monitor.note, /An envelope's curve is the shape set in the lane\. It is not a record of the live output\./, 'show-monitor: §20.1 Rules');
  assert.match(monitor.note, /DLW build ruling 2026-11-06/, 'show-monitor: cites its ruling');
  const formation = row('monitor-formation');
  assert.equal(formation.status, 'ported', 'monitor-formation: the Glyph a lane moves is the one selected');
  assert.match(formation.boundary_op, /operation=select entity_id/);
  assert.match(formation.boundary_op, FILE_LINE, 'monitor-formation: its operation cites its file:line');
  assert.match(formation.note, /retired/, 'monitor-formation: the live monitor\'s Glyph picker is retired');
  assert.match(formation.note, /DLW build ruling 2026-11-06/, 'monitor-formation: cites its ruling');
  assert.doesNotMatch(formation.note, /Owner-block|is not built/i, 'monitor-formation: waits for nothing');
  const remove = row('delete-group');
  assert.match(remove.note, /⌫/, 'delete-group: ⌫ on the selected lane');
  assert.match(remove.note, /laneDeleteScope/, 'delete-group: names the key\'s rule');
  assert.doesNotMatch(remove.note, /Not built: ⌫/, 'delete-group: ⌫ is built');
  assert.ok(ledger.history.some(entry => /round 882/.test(entry.stage)), 'the history records this round');
});

// O-I #747, round 883, DLW build ruling 2026-11-06 (the Monitor's trace): "If it draws a value the frame reports, it is a reading. It stays,
// labelled as what the field plays now, distinct from the lane's curve." It draws observation.effectiveValues, which the frame reads from
// the engine's telemetry, so it stays, named Field now, beside the Lane's curve.
test('#747 r883: the Monitor\'s second trace is a reading of what the field plays now, named apart from the lane\'s curve', () => {
  const monitor = ledger.rows.find(item => item.action === 'show-monitor');
  assert.match(monitor.note, /effective values the frame reports/, 'show-monitor: the trace draws what the frame reports');
  assert.match(monitor.note, /a reading/, 'show-monitor: so it is a reading');
  assert.match(monitor.note, /named Field now, what the field plays now, and kept apart from the lane's curve/, 'show-monitor: named as the ruling says');
  assert.doesNotMatch(JSON.stringify(ledger), /Live output/, 'no row still names the trace Live output');
  const at = ledger.history.findIndex(entry => /round 883/.test(entry.stage));
  assert.ok(at > 0, 'the history records this round');
  assert.deepEqual(ledger.history[at].counts, ledger.history[at - 1].counts, 'and no row changed status in it');
});

// O-I #747, round 894: the 43 open rows re-read against main and the manual (DLW.md). A row is ported only on a test or a walk: each one
// this round moved names its tests, and they are on disk. No owner operation is still waited on; the rows the manual does not ask for in
// the app's form are marked with the manual's words; tune-station waits on the resonance owner's station-set.
const ROUND_894_PORTED = ['library', 'preset-browser', 'keep', 'native-library', 'modes', 'start-mode', 'open-featured', 'load-built-in',
  'entry-starter-mark', 'new-journey', 'entry-new', 'fork-saved', 'delete-saved', 'native-open-file', 'native-retry-file', 'native-resolve',
  'native-save-file', 'add-built-in', 'chakra-add', 'import-legacy', 'place-formation', 'tool-formation', 'tool-text', 'tool-orbit',
  'native-retry-open', 'objects', 'library-section', 'image-suite', 'source-new', 'source-entity', 'sequence-entity', 'select-all'];

test('#747 r894: the open rows re-read; a row is ported on its tests; none waits on an owner op; tune-station names its owner', () => {
  const row = action => ledger.rows.find(item => item.action === action);
  const root = new URL('../../../../', import.meta.url).pathname;
  for (const action of ROUND_894_PORTED) {
    const item = row(action);
    assert.equal(item.status, 'ported', `${action}: ported`);
    assert.match(item.note, /Round 894 \(O-I #747, 7 Nov 2026\)/, `${action}: says what this round found`);
    for (const file of item.tests) assert.ok(existsSync(join(root, file)), `${action}: its test ${file} is on disk`);
    assert.ok(item.tests.length, `${action}: names its tests`);
    assert.doesNotMatch(item.boundary_op, /^pending:/, `${action}: waits on nothing`);
  }
  assert.equal(ledger.counts['owner-op-required'], undefined, 'no row waits on an owner operation');
  const arrange = /Objects \| A checklist of the symbols that can move \| None selected \| The symbols that Arrange moves\. Quick selects fill the list\./;
  for (const action of ['select-all', 'objects']) assert.match(row(action).note, arrange, `${action}: the manual's words for choosing several`);
  assert.match(row('objects').note, /does not ask for the app's Objects rail tree/, 'objects: what the manual does not ask for is marked so');
  for (const action of ['native-resolve', 'native-retry-file', 'native-save-file'])
    assert.match(row(action).note, /Save, undo and redo \| The File and Edit menus, and the Studio's head/, `${action}: the manual's Save`);
  const station = row('tune-station');
  assert.equal(station.status, 'not-ported');
  assert.match(station.boundary_op, /^pending: owner op: a station-set change from the resonance owner/);
  for (const action of ['record-properties', 'preview-tracks', 'automation-play', 'automation-loop', 'native-kundalini-sequence', 'choose-shape',
    'source-image', 'layer-add', 'place-keyframe', 'save-video'])
    assert.match(row(action).note, /Round 894 \(O-I #747, 7 Nov 2026\), re-read against main and the manual:/, `${action}: re-read, and says what it lacks`);
  // A later round's entry follows this one; the latest entry's counts are checked by the latest round's test (r895).
  assert.ok(ledger.history.some(entry => /round 894/.test(entry.stage)), 'the history records this round');
});

// O-I #747, round 895 (DLW build ruling 2026-11-08): "The port ledger tells the truth." A ported row carries none of the standing text its
// port superseded ("Still partial", "Fork needs the native save_as owner operation", the audits' owner-op-required and still-open lines);
// select-all and objects say what they are; every ported row names its tests, on disk, with no exemption; and the Save rows rest on a file
// owner that keeps the revision check, so the lost write and the file changed underneath are proven, not assumed.
const SUPERSEDED = /Still partial|Fork needs|cannot call save_as|the shell cannot call|Status stays owner-op-required|reclassified partial → owner-op-required|Owner-block|No select-all control exists|confirmed still open|Not built here|not loadable from the shell|Open is disabled|Load is disabled|its action is disabled|Starting one is disabled|with disabled Open rows/;

test('#747 r895: a ported row says only what it is and names its tests; the Save rows\' file owner keeps the revision check', () => {
  const row = action => ledger.rows.find(item => item.action === action);
  const root = new URL('../../../../', import.meta.url).pathname;
  for (const item of ledger.rows.filter(entry => entry.status === 'ported')) {
    assert.doesNotMatch(item.note, SUPERSEDED, `${item.action}: no standing text its port superseded`);
    assert.ok(item.tests.length, `${item.action}: names its tests`);
    for (const file of item.tests) assert.ok(existsSync(join(root, file)), `${item.action}: its test ${file} is on disk`);
  }
  assert.match(row('select-all').note, /^Select all is Arrange's: All, among its Quick selects, checks every symbol it can move\./, 'select-all: what it is');
  assert.match(row('objects').note, /^A scene's symbols have the manual's homes:/, 'objects: what it is');
  const save = 'desktop/cradle/expressions-app/field-studies-journeys/tests/save-bound-file-894.test.mjs';
  const fake = readFileSync(join(root, save), 'utf8');
  assert.match(fake, /if\(at!==String\(file\.revision\)\)\{refused\.push\(\{at,current:String\(file\.revision\)\}\);throw new Error\(REFUSED\);\}/,
    'the fake file owner refuses a write at a revision the file no longer holds');
  assert.match(fake, /test\('a file changed underneath the work is never written over/, 'the file changed underneath is proven');
  for (const action of ['native-resolve', 'native-retry-file', 'native-save-file']) {
    assert.ok(row(action).tests.includes(save), `${action}: rests on the Save's test`);
    assert.match(row(action).note, /Round 895 \(O-I #747, 9 Nov 2026; DLW build ruling 2026-11-08\): the Save's file owner .* keeps the revision check/, `${action}: says so`);
  }
  const last = ledger.history.at(-1);
  assert.match(last.stage, /round 895/, 'the history records this round');
  assert.deepEqual(last.counts, ledger.counts, 'and its counts are the ledger\'s');
});

test('the ledger accounting matches its row statuses', () => {
  const histogram = {};
  for (const row of ledger.rows) histogram[row.status] = (histogram[row.status] || 0) + 1;
  assert.deepEqual(histogram, ledger.counts);
});

test('every crosswalk target keeps native exercise pending and names a shell destination', () => {
  const targets = crosswalk.targets;
  assert.equal(targets.length, 126);
  const surfaces = new Set();
  for (const target of targets) {
    assert.equal(target.status, 'pending', `${target.id}: native exercise is not promoted`);
    const destination = target.functional_crosswalk.shell_destination;
    assert.ok(destination && typeof destination.surface === 'string' && destination.surface.trim(), `${target.id}: destination named`);
    surfaces.add(destination.surface);
  }
  // The shell's destination vocabulary: the hosted lens/instrument names the frame and the pane instruments use.
  const vocabulary = new Set([
    'Canvas', 'Graph', 'Timeline', 'Expressions Clip / Arrangement', 'Places', 'Journey', 'Palace', 'Journey / Palace',
    'Lens bar (instrument rail)',
  ]);
  for (const surface of surfaces) assert.ok(vocabulary.has(surface), `destination "${surface}" is in the shell vocabulary`);
});
