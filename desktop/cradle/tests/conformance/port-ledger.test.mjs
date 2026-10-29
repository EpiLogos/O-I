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
// O-I #747 shrank it by two: cancel-placement is ported (Clip view's Select) and fire-lane names what it waits for.
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
