/** Port ledger conformance: every Expressions row names its outward home and its boundary operation, or says
 * explicitly why it has none (`none:`) or what owner operation it waits for (`pending:`). Real operations cite
 * their file:line. The crosswalk destinations stay inside the shell's destination vocabulary, and no target is
 * promoted to native exercise. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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
const KNOWN_REAL_OP_ON_OPEN_STATUS = new Set(["library","keep","native-library","lens","deep-lived","chakra-add"]);

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
