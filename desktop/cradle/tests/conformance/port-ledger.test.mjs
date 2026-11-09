/** Port ledger conformance: every Expressions row names its outward home and its boundary operation, or says
 * explicitly why it has none (`none:`) or what owner operation it waits for (`pending:`). Real operations cite
 * a symbol in their file (`file#symbol`, round 896), never a line. The crosswalk destinations stay inside the shell's destination vocabulary, and no target is
 * promoted to native exercise. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import ts from 'typescript';
import {rustCode} from './source.mjs';

const here = new URL('../../docs/world-shell/', import.meta.url);
const ledger = JSON.parse(readFileSync(join(here.pathname, 'EXPRESSIONS-PORT-STATUS.json'), 'utf8'));
const crosswalk = JSON.parse(readFileSync(join(here.pathname, 'FUNCTIONAL-CROSSWALK.json'), 'utf8'));

// A `none:` marker is legitimate only where the row has no boundary operation by design; a `pending:` marker only
// where the capability waits on an owner, another track, or a missing native op.
const NONE_STATUSES = new Set(['ported', 'partial', 'internal-no-outward-need', 'studio-only-by-design']);
const PENDING_STATUSES = new Set(['owner-op-required', 'out-of-scope-other-track', 'not-ported']);
// O-I #747 round 896, 0R-surface.4 (DLW build ruling 2026-11-09): "Cite a symbol, never a line number: write `file#symbol`, and the check
// proves the symbol exists in that file." A line drifts with every edit above it; a symbol is found where it stands.
const SYMBOL_CITE = /[\w./-]+\.(?:ts|tsx|mjs|rs|json|md)#[A-Za-z_][\w-]*/;
const LINE_CITE = /(?<![\w#])[\w./-]+\.(?:ts|tsx|mjs|rs|json|md|css|html|py):\d+/;
/** What a row says, its lead and its history below it (round 896), each history entry with its stage, for the rounds' own assertions. */
const told = row => [row.note ?? '', ...(row.history ?? []).map(entry => `${entry.stage}: ${entry.note}`)].join(' ');

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
  // The rows this lane filled cite their evidence: a real operation recorded here must name a file#symbol.
  assert.match(ledger.rows.find(row => row.action === 'native-retry-open').boundary_op, SYMBOL_CITE);
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
  assert.match(take.boundary_op, SYMBOL_CITE, 'take-manual: its operation cites its symbol');
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
  assert.match(remove.boundary_op, SYMBOL_CITE);
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
  assert.match(monitor.boundary_op, SYMBOL_CITE, 'show-monitor: the section it shows cites its symbol');
  assert.doesNotMatch(`${monitor.boundary_op} ${monitor.note}`, /pending under monitor-mode|Owner-block/, 'show-monitor: waits for no live monitor');
  assert.match(monitor.note, /An envelope's curve is the shape set in the lane\. It is not a record of the live output\./, 'show-monitor: §20.1 Rules');
  assert.match(monitor.note, /DLW build ruling 2026-11-06/, 'show-monitor: cites its ruling');
  const formation = row('monitor-formation');
  assert.equal(formation.status, 'ported', 'monitor-formation: the Glyph a lane moves is the one selected');
  assert.match(formation.boundary_op, /operation=select entity_id/);
  assert.match(formation.boundary_op, SYMBOL_CITE, 'monitor-formation: its operation cites its symbol');
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
    assert.match(told(item), /Round 894 \(O-I #747, 7 Nov 2026\)/, `${action}: says what this round found`);
    for (const file of item.tests) assert.ok(existsSync(join(root, file)), `${action}: its test ${file} is on disk`);
    assert.ok(item.tests.length, `${action}: names its tests`);
    assert.doesNotMatch(item.boundary_op, /^pending:/, `${action}: waits on nothing`);
  }
  assert.equal(ledger.counts['owner-op-required'], undefined, 'no row waits on an owner operation');
  const arrange = /Objects \| A checklist of the symbols that can move \| None selected \| The symbols that Arrange moves\. Quick selects fill the list\./;
  for (const action of ['select-all', 'objects']) assert.match(told(row(action)), arrange, `${action}: the manual's words for choosing several`);
  assert.match(told(row('objects')), /does not ask for the app's Objects rail tree/, 'objects: what the manual does not ask for is marked so');
  for (const action of ['native-resolve', 'native-retry-file', 'native-save-file'])
    assert.match(row(action).note, /Save, undo and redo \| The File and Edit menus, and the Studio's head/, `${action}: the manual's Save`);
  // tune-station waited on a station-set change from the resonance owner, and choose-shape on a step-source that carries the yantra and the
  // template frequency; round 895 built both, so their tests are round 895's (below).
  for (const action of ['record-properties', 'preview-tracks', 'automation-play', 'automation-loop', 'native-kundalini-sequence',
    'source-image', 'layer-add', 'place-keyframe', 'save-video'])
    assert.match(told(row(action)), /Round 894 \(O-I #747, 7 Nov 2026\), re-read against main and the manual:/, `${action}: re-read, and says what it lacks`);
  // A later round's entry follows this one; the latest entry's counts are checked by the latest round's test (r895).
  assert.ok(ledger.history.some(entry => /round 894/.test(entry.stage)), 'the history records this round');
});

// O-I #747, round 895 (DLW build ruling 2026-11-08): "The port ledger tells the truth." A ported row carries none of the standing text its
// port superseded (since round 896, by the structural rule below: what superseded text a row carried stands in its history, under its lead);
// select-all and objects say what they are; every ported row names its tests, on disk, with no exemption; and the Save rows rest on a file
// owner that keeps the revision check, so the lost write and the file changed underneath are proven, not assumed.
// Round 896 (0R-surface.4): the SUPERSEDED phrase list gave way to the structural rule below (a ported note's lead and its history).

test('#747 r895: a ported row says only what it is and names its tests; the Save rows\' file owner keeps the revision check', () => {
  const row = action => ledger.rows.find(item => item.action === action);
  const root = new URL('../../../../', import.meta.url).pathname;
  for (const item of ledger.rows.filter(entry => entry.status === 'ported')) {
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
    assert.match(told(row(action)), /Round 895 \(O-I #747, 9 Nov 2026; DLW build ruling 2026-11-08\): the Save's file owner .* keeps the revision check/, `${action}: says so`);
  }
  const last = ledger.history.findLast(entry => /round 895/.test(entry.stage));
  assert.ok(last, 'the history records this round');
  // Its counts stood until round 896 item 1 walked the nine partial rows (below), which moved six of them to ported.
  const walked = ledger.history.find(entry => ITEM_1.test(entry.stage));
  assert.deepEqual(last.counts, walked ? countsBefore(walked) : ledger.counts, 'and its counts are the ledger\'s');
});


// O-I #747, round 895 (DLW build ruling 2026-11-09, 0b.5): a ported row may not say the shell lacks, cannot, or has nothing for what it
// ports, nor carry the open question it was ported over (since round 896 the structural rule below holds that: a ported lead says what is
// ported, and what the row said while it was open stands in its history). And each of the five rows the review found still saying so names only tests that
// exercise its subject: each named test is pinned to the test or call that runs it.
// Round 896 (0R-surface.4): the LACKS phrase list gave way to the structural rule below.
const SUBJECTS = {
  'new-journey': {
    'packages/live-shell/ui/tests/native-expression-open.test.mjs': /CMD\.newExpression\(ports, 'Untitled expression'\)/,
    'packages/live-shell/ui/tests/expressions-works-home-shell.test.mjs': /test\('New is create and its blank Scene\\'s material, then save_as into the home the owner disclosed, then the open door[\s\S]{0,200}await CMD\.newExpression\(p, 'Untitled expression'\)/,
    'packages/live-shell/ui/tests/new-expression-plays-893.test.mjs': /await CMD\.newExpression\(ports\(owner\), 'Untitled expression'\)/,
    'packages/live-shell/ui/tests/earlier-new-work-plays-894.test.mjs': /test\('an earlier New work \(the bare create, no Scene material\) plays on open/,
  },
  'native-resolve': {
    'desktop/cradle/expressions-app/field-studies-journeys/tests/save-bound-file-894.test.mjs': /test\('an interrupted Save whose write landed is adopted by the next Save; the write is not replayed \(native-resolve\)'/,
    'desktop/cradle/expressions-app/field-studies-journeys/tests/native-composition.test.mjs': /test\('lost native edit reply is inspected by value; the write is never replayed'/,
  },
  'native-retry-file': {
    'desktop/cradle/expressions-app/field-studies-journeys/tests/save-bound-file-894.test.mjs': /test\('an interrupted Save whose write never landed is dropped, and the next Save writes the file again \(native-retry-file\)'/,
    'packages/live-shell/ui/tests/open-expression-file-894.test.mjs': /test\('a file the owner will not open is refused in the owner\\'s words; nothing opens; Retry asks the same open again'/,
  },
  'import-legacy': {
    'packages/live-shell/ui/tests/import-earlier-894.test.mjs': /test\('the field\\'s import of earlier scenes runs on what an earlier version kept[\s\S]{0,400}bridge\.importDocuments\(kept\)/,
  },
};
SUBJECTS['entry-new'] = SUBJECTS['new-journey'];

test('#747 r895 0b.5: no ported row says the shell lacks what it ports; the five rows name only tests that exercise their subject', () => {
  const row = action => ledger.rows.find(item => item.action === action);
  const root = new URL('../../../../', import.meta.url).pathname;
  for (const [action, pinned] of Object.entries(SUBJECTS)) {
    const item = row(action);
    assert.deepEqual([...item.tests].sort(), Object.keys(pinned).sort(), `${action}: every test it names is pinned to its subject`);
    for (const [file, subject] of Object.entries(pinned))
      assert.match(readFileSync(join(root, file), 'utf8'), subject, `${action}: ${file} exercises its subject`);
    assert.match(told(item), /Round 895, 0b\.5 \(DLW build ruling 2026-11-09\): this note says what is ported\./, `${action}: rewritten as the ported facts`);
  }
});

// O-I #747, round 895 (DLW build ruling 2026-11-08), tune-station: the Resonance face draws the plate's stations as ticks, and a press tunes
// the plate there through the owner's one change, resonance-station: the app's "Tune frequency" (drive at the station's Hz, the Frequency
// driver Manual, the sweep off, the frequency lanes disabled), resolved against the engine's own stations. No row is left not ported.
test('#747 r895: tune-station is the Resonance face\'s station ticks, through the owner\'s one change', () => {
  const station = ledger.rows.find(item => item.action === 'tune-station');
  assert.equal(station.status, 'ported');
  assert.match(station.boundary_op, /^change kind=resonance-station station_index/);
  assert.match(station.boundary_op, SYMBOL_CITE, 'tune-station: its operation cites its symbol');
  for (const file of ['packages/expressions-boundary/tests/resonance-station-895.test.mjs', 'packages/live-shell/ui/tests/resonance-station-895.test.mjs'])
    assert.ok(station.tests.includes(file), `tune-station: names ${file}`);
  assert.match(station.note, /"Tune frequency"/, 'tune-station: one step under the app\'s own label');
  assert.doesNotMatch(station.note, /Owner-block|not writable from the shell yet/, 'tune-station: waits for nothing');
  assert.equal(ledger.counts['not-ported'], undefined, 'no row is left not ported');
});

// O-I #747, round 895 (DLW build ruling 2026-11-08), choose-shape: a state's yantra and an authored cymatic template's frequency travel in
// step-source, as the app's inspector writes them, and the Glyph Sequence editor chooses them under the State shape.
test('#747 r895: choose-shape carries the yantra and the template frequency in step-source, chosen in the glyph editor', () => {
  const shape = ledger.rows.find(item => item.action === 'choose-shape');
  assert.equal(shape.status, 'ported');
  assert.match(shape.boundary_op, /step-source shape=yantra yantraId=.* \| shape=cymatic templateFrequency=/);
  assert.match(shape.boundary_op, SYMBOL_CITE, 'choose-shape: its operation cites its symbol');
  assert.ok(shape.tests.includes('packages/live-shell/ui/tests/choose-shape-895.test.mjs'), 'choose-shape: names its round-895 test');
  assert.ok(shape.components.includes('packages/live-shell/ui/src/components/GlyphSequenceEditor.tsx'), 'choose-shape: the glyph editor is its home');
  assert.doesNotMatch(shape.note, /still owed|Not implemented/, 'choose-shape: owes nothing');
});

// O-I #747, round 896, 0R-surface.4 (DLW build ruling 2026-11-09): "A ported row's note leads with what is ported. Its history goes below.
// … Replace the SUPERSEDED and LACKS lists with a structural rule: the lead of a ported note states what is ported and carries no gap. Cite
// a symbol, never a line number: write `file#symbol`, and the check proves the symbol exists in that file. The check also proves every
// `components` path exists." Before it, a note was one run of text, each round appending its stage to what the row had said while it was
// open, and two closed phrase lists guessed at gaps in all of it: delete-saved still led "None is callable from the shell, so no Remove
// control is offered" over its port, chakra-add "Not expressible as admitted changes", library "sections are not shown"; and about 40 rows
// named components no longer on disk.
// The rule, by structure: a ported row's `note` is its lead, a present statement with no stage in it (no "<stage>: …" opening a sentence: a
// round, an audit, an owner block, an owner op needed, a ruling), and no replay standing, which is the row's `live_replay`; what the row
// said along the way is its `history`, below the note, each entry {stage, note}. A row cites no line anywhere; each `file#symbol` it cites
// is a symbol of that file (declared there, a key or call of it, or a quoted label); every components and tests path is on disk.
const STAGE_OPENING = /(?:^|(?<=[.;)"] ))(?:Round \d{3}[a-z]?\b[^:]{0,140}|\d{4}-\d{2}-\d{2} audit[^:]{0,80}|Owner-block \([^)]*\)|Owner op needed|DLW build ruling \d{4}-\d{2}-\d{2}):\s/;
const REPLAY_STANDING = /\blive[- ]replay|\breplayed live\b|\bnot (?:live-)?replayed\b|\btypecheck only\b|\bstatic port only\b/i;
const SYMBOL_IN_FILE = /(?<![\w#/.-])((?:[\w-]+\/)*[\w.-]+\.(?:ts|tsx|mjs|rs|json|md|css|html|py))#([A-Za-z_][\w-]*(?:(?:::|\.)[A-Za-z_]\w*)*)/g;
// O-I #747 round 896, 1R-surface.7 (DLW build ruling 2026-11-09): "A lead may not state a gap, enforced by a closed list of gap phrases tested
// structurally. A cite needs a declaration or member definition, checked with comments and strings stripped. Repoint the label-only cites."
// Before it, a cite stood when its symbol appeared anywhere in its file, a quoted label or a comment included: 251 of 349 cites stood so
// (app.ts#close-studio, a case label), and a lead could open "Not built: the shell has no control for this" and pass.
// The rule: a ported lead carries none of GAP_PHRASES. A cite's symbol stands where the file's syntax declares it (a function, a variable or
// a destructured binding, a class, an interface, a type, an enum, a namespace) or defines it as a member (a method, a property, an accessor,
// an enum member, an object literal's key, a prop an element is given): the syntax is read, so neither a comment nor a string stands for it.
// A label the code handles but does not declare is cited by the declared function that holds it, the label after the cite,
// `file#fn ('label')`, and the label is proven inside that function, not anywhere in its file.
const GAP_PHRASES = [/\bnot built\b/i, /\bno control\b/i, /\bnone is callable\b/i, /\bnot yet\b/i];
const LABEL_AFTER = / \('([^']+)'\)/y;
const visit = (node, fn) => {fn(node); ts.forEachChild(node, child => visit(child, fn));};
const named = node => node.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) || ts.isPrivateIdentifier(node.name)) ? node.name.text : null;
/** The nodes that declare `symbol` in a TypeScript or JavaScript file, or define it as a member. */
function definitions(syntax, symbol) {
  const found = [];
  visit(syntax, node => {
    const declared = (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)
      || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node) || ts.isModuleDeclaration(node)) && named(node) === symbol
      || (ts.isVariableDeclaration(node) || ts.isBindingElement(node)) && ts.isIdentifier(node.name) && node.name.text === symbol;
    const member = (ts.isMethodDeclaration(node) || ts.isPropertyDeclaration(node) || ts.isPropertySignature(node) || ts.isMethodSignature(node)
      || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node) || ts.isEnumMember(node) || ts.isPropertyAssignment(node)
      || ts.isShorthandPropertyAssignment(node) || ts.isJsxAttribute(node)) && named(node) === symbol;
    if (declared || member) found.push(node);
  });
  return found;
}
/** Whether a literal in `node` is the label, or names it as an attribute's value (a template's `data-action="label"`). */
function holdsLabel(node, label) {
  let held = false;
  visit(node, at => {
    if ((ts.isStringLiteral(at) || ts.isNoSubstitutionTemplateLiteral(at)) && at.text === label) held = true;
    else if ((ts.isStringLiteral(at) || ts.isNoSubstitutionTemplateLiteral(at) || ts.isTemplateHead(at) || ts.isTemplateMiddle(at) || ts.isTemplateTail(at))
      && (at.text.includes(`"${label}"`) || at.text.includes(`'${label}'`))) held = true;
  });
  return held;
}
/** Why `file#symbol` (with `label` after it, or none) does not stand in `text`, or null when it stands. */
function citeFault(file, text, symbol, label = null) {
  const parts = symbol.includes('-') ? [symbol] : symbol.split(/::|\./);
  if (/\.rs$/.test(file)) {
    const code = rustCode(text), missing = parts.find(part => !new RegExp(`\\b(?:fn|struct|enum|trait|mod|type|const|static)\\s+${part}\\b`).test(code));
    return missing ? `${missing} is declared nowhere in ${file}` : label ? 'a label is cited only inside a TypeScript function' : null;
  }
  if (!/\.(?:ts|tsx|mjs|js)$/.test(file)) return `${file}: a cite names a symbol in code whose syntax is read (TypeScript, JavaScript or Rust)`;
  const syntax = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  for (const part of parts) if (!definitions(syntax, part).length) return `${part} is neither declared nor a member in ${file} (a label, a comment or a string is not a symbol)`;
  if (label !== null && !definitions(syntax, parts.at(-1)).some(node => holdsLabel(node, label))) return `'${label}' is not in ${parts.at(-1)}`;
  return null;
}

// O-I #747 round 896, item 1 (DLW build ruling 2026-11-09): "Walk each on the private native stack, on the Mac's GPU, and mark it ported
// only on evidence. A row that is the frame's own gesture policy is ruled in the ledger by the manual's words, with its reason. Every row left
// partial names who owns it and why." A row walked to ported says so in its own field, `live_replay` (WALKED), and what was walked and
// read back in its history; a row ruled by the manual carries the manual's words, found in the manual, and its reason; a partial row names
// its owner and why. Before it, every row's live_replay was "pending-native-stack" and a partial row said only what it lacked.
const WALKED = 'walked-native-stack';
const REPLAY_FIELD = new Set(['pending-native-stack', WALKED]);
const ITEM_1 = /^O-I #747, round 896, item 1, walked on the private native stack/;
const walkOf = row => (row.history ?? []).find(entry => ITEM_1.test(entry.stage));
/** The counts the ledger stood at before a history entry: the entry before it. */
const countsBefore = entry => ledger.history[ledger.history.indexOf(entry) - 1]?.counts;
const NINE = ['record-properties', 'preview-tracks', 'automation-play', 'automation-loop', 'native-kundalini-sequence', 'source-image', 'layer-add', 'place-keyframe', 'save-video'];

test('#747 r896 0R-surface.4: a ported note leads with what is ported, its history below; cites are symbols proven in their files; every path is on disk', () => {
  const root = new URL('../../../../', import.meta.url).pathname;
  const sources = new Map(), source = file => {
    if (!sources.has(file)) sources.set(file, existsSync(join(root, file)) ? readFileSync(join(root, file), 'utf8') : null);
    return sources.get(file);
  };
  let cited = 0, labelled = 0;
  for (const row of ledger.rows) {
    const text = JSON.stringify(row);
    assert.doesNotMatch(text, LINE_CITE, `${row.action}: cites a line (${text.match(LINE_CITE)?.[0]}), not a symbol`);
    for (const match of text.matchAll(SYMBOL_IN_FILE)) {
      const [cite, file, symbol] = match;
      cited += 1;
      const found = source(file);
      assert.ok(found !== null, `${row.action}: ${cite}: ${file} is not on disk`);
      LABEL_AFTER.lastIndex = match.index + cite.length;
      const label = LABEL_AFTER.exec(text)?.[1] ?? null;
      if (label !== null) labelled += 1;
      const fault = citeFault(file, found, symbol, label);
      assert.equal(fault, null, `${row.action}: ${cite}${label ? ` ('${label}')` : ''}: ${fault}`);
    }
    for (const file of row.components ?? []) assert.ok(existsSync(join(root, file)), `${row.action}: its component ${file} is on disk`);
    for (const file of row.tests ?? []) assert.ok(existsSync(join(root, file)), `${row.action}: its test ${file} is on disk`);
    if (row.history !== undefined) {
      assert.ok(Array.isArray(row.history) && row.history.length, `${row.action}: a history is a list of what the row said`);
      for (const entry of row.history) {
        assert.deepEqual(Object.keys(entry), ['stage', 'note'], `${row.action}: each history entry is {stage, note}`);
        assert.ok(typeof entry.stage === 'string' && entry.stage.trim() && typeof entry.note === 'string' && entry.note.trim(), `${row.action}: each entry names its stage and says something`);
      }
      const keys = Object.keys(row);
      assert.equal(keys.indexOf('history'), keys.indexOf('note') + 1, `${row.action}: its history stands below its note`);
    }
    if (row.status !== 'ported') continue;
    assert.ok(typeof row.note === 'string' && row.note.trim(), `${row.action}: a ported row leads with what is ported`);
    assert.doesNotMatch(row.note, STAGE_OPENING, `${row.action}: its lead carries a stage (${row.note.match(STAGE_OPENING)?.[0]}); that belongs in its history`);
    for (const gap of GAP_PHRASES) assert.doesNotMatch(row.note, gap, `${row.action}: its lead states a gap (${row.note.match(gap)?.[0]})`);
    assert.doesNotMatch(row.note, REPLAY_STANDING, `${row.action}: its lead states its replay standing, which is its live_replay (${row.live_replay})`);
    assert.ok(REPLAY_FIELD.has(row.live_replay), `${row.action}: the replay standing is the row's own field (${row.live_replay})`);
    if (row.live_replay === WALKED) assert.ok(walkOf(row), `${row.action}: a walked row says in its history what was walked and read back`);
  }
  assert.ok(cited >= 300, `the rows cite their symbols (${cited})`);
  assert.ok(labelled >= 240, `the labels the code handles are cited by the functions that hold them (${labelled})`);
  // The three rows the review named lead with what is ported.
  const row = action => ledger.rows.find(item => item.action === action);
  assert.match(row('delete-saved').note, /^Delete \(⌫\) on the Expression's track takes the work out through the owner/);
  assert.ok(row('delete-saved').tests.includes('desktop/cradle/expressions-app/field-studies-journeys/tests/delete-hold-896.test.mjs'), 'delete-saved: names the Delete hold\'s test');
  assert.match(row('chakra-add').note, /^The Semantic Chakra Body is a preset added in one change/);
  assert.match(row('library').note, /^The browser's Expressions category lists your works, then Featured, Starters and Built-in presets/);
  for (const action of ['delete-saved', 'chakra-add', 'library']) assert.equal(row(action).history[0].stage, 'Before round 896', `${action}: what it first said is its history`);
  const entry = ledger.history.find(item => /round 896, 0R-surface\.4/.test(item.stage));
  assert.ok(entry, 'the history records this round');
  assert.deepEqual(entry.counts, countsBefore(entry), 'and no status changed in it');
});

test('#747 r896 1R-surface.7: a lead stating a gap fails; a cite stands as a declaration or a member, never as a label, a comment or a string', () => {
  // The review's probe: a gap prepended to a ported lead passed the stage and replay rules; the closed list catches it.
  const probe = `Not built: the shell has no control for this, and none is callable from it. ${ledger.rows.find(row => row.action === 'play-journey').note}`;
  assert.deepEqual(GAP_PHRASES.map(gap => gap.test(probe)), [true, true, true, false]);
  assert.ok(GAP_PHRASES.every(gap => !gap.test(ledger.rows.find(row => row.action === 'play-journey').note)), 'and the lead itself states none');
  const source = [
    '// closeStudio is named here, in a comment only',
    "const said = 'openStudio';",
    "export function action(name: string) { switch (name) { case 'close-studio': setStudio(false); break; } }",
    'function setStudio(open: boolean) {}',
    'function render() { return `<button data-action="keep-view">Keep</button>`; }',
    'export const owner = {retry() {}, held: 1};',
    'interface State { automationHolds?: number[] }',
    'const [mode, setMode] = [1, 2];',
  ].join('\n');
  for (const [symbol, label] of [['action', 'close-studio'], ['setStudio'], ['render', 'keep-view'], ['retry'], ['held'], ['automationHolds'], ['mode'], ['owner.retry']])
    assert.equal(citeFault('probe.ts', source, symbol, label ?? null), null, `${symbol}${label ? ` ('${label}')` : ''} stands`);
  for (const [symbol, label] of [['close-studio'], ['closeStudio'], ['openStudio'], ['keep-view'], ['action', 'keep-view'], ['render', 'close-studio']])
    assert.notEqual(citeFault('probe.ts', source, symbol, label ?? null), null, `${symbol}${label ? ` ('${label}')` : ''} does not stand`);
  const entry = ledger.history.find(item => /round 896, 1R-surface\.7/.test(item.stage));
  assert.ok(entry, 'the history records this round');
  assert.deepEqual(entry.counts, countsBefore(entry), 'and no status changed in it');
});

test('#747 r896 item 1: the nine partial rows are walked; each is ported on its walk or by the manual\'s words, or names who owns it and why', () => {
  const manual = readFileSync(new URL('../../../../ProjectCentral/docs/1-vision/dlw/DLW.md', import.meta.url), 'utf8').replace(/\s+/g, ' ');
  for (const action of NINE) {
    const row = ledger.rows.find(item => item.action === action);
    const walk = walkOf(row);
    assert.ok(walk, `${action}: walked on the private native stack this round, its history says what was walked and read back`);
    assert.match(walk.note, /walk896\.mjs/, `${action}: the walk names its section`);
    if (row.status === 'ported') {
      if (row.gesture_ruling) {
        const {manual: words, section, reason} = row.gesture_ruling;
        assert.ok(manual.includes(words.replace(/\s+/g, ' ')), `${action}: the manual's words stand in the manual (${words})`);
        assert.match(section, /^§\d+(\.\d+)*/, `${action}: the ruling cites its section`);
        assert.ok(typeof reason === 'string' && reason.length > 40, `${action}: the ruling gives its reason`);
      } else assert.equal(row.live_replay, WALKED, `${action}: ported on its walk`);
      assert.equal(row.left_partial, undefined, `${action}: a ported row is not left partial`);
    } else {
      assert.equal(row.status, 'partial', `${action}: ported or partial`);
      assert.ok(row.left_partial && typeof row.left_partial.owner === 'string' && row.left_partial.owner.trim(), `${action}: names who owns it`);
      assert.ok(typeof row.left_partial.why === 'string' && row.left_partial.why.length > 40, `${action}: says why it is left`);
    }
  }
  for (const row of ledger.rows) {
    if (row.status === 'partial') assert.ok(row.left_partial, `${row.action}: every partial row names who owns it and why`);
    else assert.equal(row.left_partial, undefined, `${row.action}: only a partial row is left partial`);
    if (row.gesture_ruling) assert.equal(row.status, 'ported', `${row.action}: a gesture ruling ports its row`);
    if (row.left_partial || row.gesture_ruling) assert.ok(Object.keys(row).indexOf(row.left_partial ? 'left_partial' : 'gesture_ruling') < Object.keys(row).indexOf('note'), `${row.action}: stands above its note`);
  }
  const entry = ledger.history.find(item => ITEM_1.test(item.stage));
  assert.ok(entry, 'the history records this round');
  assert.deepEqual(entry.counts, ledger.counts, 'at the counts the ledger stands at');
  assert.equal(entry.counts.partial, ledger.rows.filter(row => NINE.includes(row.action) && row.status === 'partial').length, 'the rows left partial are of the nine');
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
