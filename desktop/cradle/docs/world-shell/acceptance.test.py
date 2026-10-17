"""The acceptance register's re-homing law (FOUNDATION §8): `rehome` records home/owner_op or a named gap per target, holds every
citation to its quote and every home to the candidate's reachability verdict, and `verify` keeps the columns whole and the counts true.
Its progress law (lane V): `reprogress` holds every implemented claim to evidence that still stands in the code.
Each test works on a copy of the register in a temporary directory; the committed register is never written."""
import contextlib
import copy
import importlib.util
import io
import json
from pathlib import Path
import shutil
import tempfile
import unittest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('acceptance', HERE / 'acceptance.py')
a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(a)

SELF = 'desktop/cradle/docs/world-shell/acceptance.py'
QUOTE = '#!/usr/bin/env python3'
GAP = 'lane-1:D1'


def cite(line=1, quote=QUOTE):
    return {'path': SELF, 'line': line, 'quote': quote}


def entry():
    return {'home': {'component': cite(), 'reach': 'Any mode → browser › Instruments › Canvas', 'route': 'lens:canvas', 'condition': 'open-work'},
            'owner_op': {'op': 'kernel `expression` op · edit', 'call': cite(), 'chains': ['ke-edit']}, 'gap': None}


def plan(document):
    rows = {row['id']: entry() for row in document['targets']}
    rows[GAP] = {'home': None, 'owner_op': None, 'gap': {'kind': 'not-built', 'what': 'The rail does not keep the subject.', 'ticket': 'G1', 'where': cite()}}
    return {'recorded_on': '2026-10-15', 'candidate_head': 'a' * 40, 'rows': rows, 'notes': {GAP: 'Definition and code disagree.'},
            'routes': {'lens:canvas': {'chain': [cite()], 'condition': 'open-work'}},
            'owner_ops': {'ke-edit': {'op': 'kernel `expression` op · edit', 'calls': [cite()]}},
            'tickets': [{'id': 'G1', 'rank': 1, 'kind': 'gap', 'title': 'The rail keeps the subject', 'what': 'Build it.', 'targets': [GAP]}]}


def strip(document):
    for row in document['targets']:
        for field in a.REHOME_FIELDS:
            row.pop(field, None)
        row['notes'] = [note for note in row['notes'] if ' re-home: ' not in note]
    for key in ('rehome_tickets', 'rehome_routes', 'rehome_owner_ops'):
        document.pop(key, None)
    document.pop('rehome_basis', None)
    document['counts'].pop('rehome', None)
    document['standing'] = document['standing'].replace(' ' + a.REHOME_STANDING, '')
    return document


def product(paths):
    return {path: f'product  {path} — loaded at runtime (test)' for path in paths}


def unreached(paths):
    return {path: f'NOT     {path} — NOT reachable from the candidate (test)' for path in paths}


class Rehome(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        for name in ('targets.json', 'references.json', 'sources.json'):
            shutil.copy(HERE / name, self.dir / name)
        self.saved_out = a.OUT
        a.OUT = self.dir
        self.register = strip(json.loads((self.dir / 'targets.json').read_text()))
        self.write(self.register)

    def tearDown(self):
        a.OUT = self.saved_out
        shutil.rmtree(self.dir)

    def write(self, document):
        (self.dir / 'targets.json').write_text(json.dumps(document, indent=2, ensure_ascii=False) + '\n')

    def read(self):
        return json.loads((self.dir / 'targets.json').read_text())

    def apply(self, data, reachability=product):
        path = self.dir / 'input.json'
        path.write_text(json.dumps(data))
        a.rehome(path, reachability=reachability)

    def test_a_register_without_the_columns_verifies_as_before(self):
        a.verify()
        self.assertNotIn('rehome', json.loads((self.dir / 'register-verification.json').read_text()))

    def test_rehome_records_every_target_and_verifies(self):
        before = copy.deepcopy(self.register)
        self.apply(plan(self.register))
        after = self.read()
        self.assertEqual(after['counts']['rehome']['homed'], 125)
        self.assertEqual(after['counts']['rehome']['gap'], 1)
        self.assertEqual(after['counts']['rehome']['by_lane']['1'], {'homed': 20, 'gap': 1})
        row = next(row for row in after['targets'] if row['id'] == 'lane-1:A1')
        self.assertEqual(row['home']['component'], {'at': f'{SELF}:1', 'quote': QUOTE})
        self.assertEqual(after['rehome_routes']['lens:canvas']['chain'], [{'at': f'{SELF}:1', 'quote': QUOTE}])
        self.assertEqual(row['owner_op']['call'], {'at': f'{SELF}:1', 'quote': QUOTE})
        self.assertEqual(row['home_evidence']['screen'], 'UNVERIFIED — the lead\'s computer-use leg')
        self.assertTrue(row['home_evidence']['reachability'].startswith('product '))
        gap = next(row for row in after['targets'] if row['id'] == GAP)
        self.assertIsNone(gap['home'])
        self.assertIn('2026-10-15 re-home: Definition and code disagree.', gap['notes'])
        # No progress axis and no definition moves.
        for old, new in zip(before['targets'], after['targets']):
            self.assertEqual(old['progress'], new['progress'])
            self.assertEqual(old['definition'], new['definition'])
        self.assertIn('rehome', json.loads((self.dir / 'register-verification.json').read_text()))

    def test_a_citation_that_no_longer_holds_its_quote_is_refused(self):
        data = plan(self.register)
        data['owner_ops']['ke-edit']['calls'] = [cite(quote='not on this line')]
        with self.assertRaises(ValueError):
            self.apply(data)
        self.assertNotIn('rehome_tickets', self.read())
        data = plan(self.register)
        data['rows']['lane-2:T1']['home']['component'] = cite(line=2)
        with self.assertRaises(ValueError):
            self.apply(data)

    def test_a_home_names_a_known_route_and_its_condition(self):
        data = plan(self.register)
        data['rows']['lane-2:T1']['home']['route'] = 'lens:nowhere'
        with self.assertRaises(ValueError):
            self.apply(data)
        data = plan(self.register)
        data['rows']['lane-2:T1']['home']['condition'] = 'none'
        with self.assertRaises(AssertionError):
            self.apply(data)

    def test_a_home_the_candidate_does_not_load_is_refused(self):
        with self.assertRaises(ValueError):
            self.apply(plan(self.register), reachability=unreached)

    def test_a_gap_names_a_gap_ticket_that_lists_it(self):
        data = plan(self.register)
        data['tickets'][0]['targets'] = ['lane-1:A1']
        with self.assertRaises(AssertionError):
            self.apply(data)

    def test_a_target_is_homed_or_a_gap(self):
        data = plan(self.register)
        data['rows']['lane-1:A1']['gap'] = {'kind': 'not-built', 'what': 'x', 'ticket': 'G1'}
        with self.assertRaises(ValueError):
            self.apply(data)

    def test_rehoming_is_whole(self):
        data = plan(self.register)
        del data['rows']['lane-5:T24']
        with self.assertRaises(ValueError):
            self.apply(data)

    def test_verify_refuses_counts_that_differ_from_the_rows(self):
        self.apply(plan(self.register))
        document = self.read()
        document['counts']['rehome']['homed'] = 126
        self.write(document)
        with self.assertRaises(AssertionError):
            a.verify()

    def test_verify_refuses_a_home_without_its_owner(self):
        self.apply(plan(self.register))
        document = self.read()
        document['targets'][0]['owner_op'] = None
        self.write(document)
        with self.assertRaises(AssertionError):
            a.verify()

    def test_the_lead_may_replace_the_screen_leg_with_a_computer_use_record(self):
        self.apply(plan(self.register))
        document = self.read()
        document['targets'][0]['home_evidence']['screen'] = {'channel': 'computer-use', 'evidence': 'evidence/m/a1.png'}
        document['counts']['rehome'] = a.rehome_counts(document['targets'])
        self.write(document)
        a.verify()
        self.assertEqual(self.read()['counts']['rehome']['screen_verified'], 1)


HOMED = 'lane-1:A1'
PLACE = 'lane-4:T2'
GAPPED = 'lane-4:T20'
SHA = 'c' * 40
FILE = 'desktop/cradle/fake/seam.ts'
TEST = 'desktop/cradle/fake/seam.test.mjs'


def home_of(row):
    path, line = row['home']['component']['at'].rsplit(':', 1)
    return path, int(line), row['home']['component']['quote']


def at_line(line, quote):
    return '\n' * (line - 1) + quote + '\n'


class FakeTree:
    """One revision's files and history, in memory: what `reprogress` and `prove-at-home` read through git."""
    head = 'f' * 40

    def __init__(self, files, commits=(SHA,), removed=None, touched=None, ancestors=None):
        self.files, self.commits, self.removed = files, set(commits), removed or {}
        self.changed = touched or {}
        self.ancestors = set(commits) if ancestors is None else set(ancestors)

    def text(self, path):
        return self.files.get(path)

    def has_commit(self, sha):
        return any(commit.startswith(sha) for commit in self.commits)

    def removed_by(self, path, quote=None):
        return self.removed.get((path, quote) if quote else path)

    def in_history(self, sha):
        return any(commit.startswith(sha) for commit in self.ancestors)

    def full(self, sha):
        return next(commit for commit in self.commits if commit.startswith(sha))

    def subject(self, sha):
        return 'lands the home'

    def touched(self, sha):
        return self.changed.get(self.full(sha), set())


class Reprogress(unittest.TestCase):
    """The progress axis follows the code (lane V): `reprogress` re-holds every implemented claim's evidence, re-points a moved
    quote, returns a row whose source and test citations are gone (or a gap) to pending with its note; `verify` refuses a gap or
    a commit-only claim left implemented."""

    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        for name in ('targets.json', 'references.json', 'sources.json'):
            shutil.copy(HERE / name, self.dir / name)
        self.saved_out = a.OUT
        a.OUT = self.dir
        document = self.read()
        for row in document['targets']:
            row['progress']['implemented'] = {'state': 'pending', 'evidence': []}
        self.write(document)

    def tearDown(self):
        a.OUT = self.saved_out
        shutil.rmtree(self.dir)

    def read(self):
        return json.loads((self.dir / 'targets.json').read_text())

    def write(self, document):
        (self.dir / 'targets.json').write_text(json.dumps(document, indent=2, ensure_ascii=False) + '\n')

    def row(self, document, target):
        return next(row for row in document['targets'] if row['id'] == target)

    def claim(self, target, evidence):
        document = self.read()
        row = self.row(document, target)
        row['progress']['implemented'] = {'state': 'yes', 'evidence': evidence}
        row['candidate_revision'] = row['candidate_revision'] or 'a' * 40
        self.write(document)
        return row

    def run_it(self, tree, apply=True):
        with contextlib.redirect_stdout(io.StringIO()):
            return a.reprogress(apply=apply, tree=tree, day='2026-10-15')

    def test_a_moved_quote_is_re_pointed_never_rewritten(self):
        before = self.claim(HOMED, [f'commit {SHA} — lands it', f'source {FILE}:4 — the seam holds', f'scripted {TEST} — it is tested'])
        notes = list(before['notes'])
        tree = FakeTree({FILE: 'the seam holds, early\nb\nc\nd\ne\nthe seam holds\n', TEST: 'ok'})
        report = self.run_it(tree)
        row = self.row(self.read(), HOMED)
        # The quote stands at lines 1 and 6; line 4 holds neither, so the nearer, 6, is cited; the quote is never touched.
        self.assertEqual(row['progress']['implemented'], {'state': 'yes', 'evidence': [f'commit {SHA} — lands it', f'source {FILE}:6 — the seam holds', f'scripted {TEST} — it is tested']})
        self.assertEqual(row['notes'], notes)
        self.assertEqual(report['citations_repointed'], 1)
        self.assertEqual(self.read()['reprogress_basis']['runs'][-1]['rows_repointed'], 1)

    def test_without_apply_nothing_is_written(self):
        self.claim(HOMED, [f'source {FILE}:3 — the seam holds'])
        bytes_before = (self.dir / 'targets.json').read_bytes()
        report = self.run_it(FakeTree({FILE: 'the seam holds\n'}), apply=False)
        self.assertEqual((self.dir / 'targets.json').read_bytes(), bytes_before)
        self.assertEqual(report['repointed'][0]['to'], 1)
        self.assertFalse(report['applied'])

    def test_a_deleted_file_returns_the_row_to_pending_with_its_note(self):
        self.claim(HOMED, [f'commit {SHA} — lands it', f'source {FILE}:4 — the seam holds', f'scripted {TEST} — it is tested'])
        report = self.run_it(FakeTree({}, removed={FILE: '92a7d38d5', TEST: '92a7d38d5'}))
        document = self.read()
        row = self.row(document, HOMED)
        self.assertEqual(row['progress']['implemented'], {'state': 'pending', 'evidence': []})
        note = row['notes'][-1]
        self.assertTrue(note.startswith('2026-10-15 reprogress: implemented returns to pending'))
        self.assertIn(f'{FILE}:4 (deleted in 92a7d38d5)', note)
        self.assertIn(f'{TEST} (deleted in 92a7d38d5)', note)
        self.assertIn(f"homed at {row['home']['component']['at']}", note)
        self.assertIn('implemented to be re-proven there', note)
        self.assertEqual(report['returned_to_pending'], {'lane-1': 1})
        self.assertEqual(report['returned_by_cause'], {'no citation of its own holds': 1})

    def test_commit_evidence_alone_never_keeps_implemented(self):
        # The commit stands in history; the quote is no longer in the file and the test is gone: commit-only, so pending.
        self.claim(HOMED, [f'commit {SHA} — lands it', f'source {FILE}:2 — the seam holds', f'scripted {TEST} — it is tested'])
        self.run_it(FakeTree({FILE: 'something else\n'}, removed={(FILE, 'the seam holds'): 'deadbeef1'}))
        row = self.row(self.read(), HOMED)
        self.assertEqual(row['progress']['implemented']['state'], 'pending')
        self.assertIn('the quote was taken out in deadbeef1', row['notes'][-1])
        self.assertIn(f'Its commit {SHA[:9]} stands in history, but commit evidence alone never keeps implemented', row['notes'][-1])
        # A claim that was commit-only from the start returns too.
        self.claim(HOMED, [f'commit {SHA} — lands it'])
        self.run_it(FakeTree({}))
        self.assertEqual(self.row(self.read(), HOMED)['progress']['implemented']['state'], 'pending')

    def test_withdrawn_evidence_is_named_while_the_row_stands(self):
        self.claim(HOMED, [f'source {FILE}:1 — the seam holds', f'scripted {TEST} — it is tested'])
        report = self.run_it(FakeTree({FILE: 'the seam holds\n'}, removed={TEST: '6855f56d3'}))
        row = self.row(self.read(), HOMED)
        self.assertEqual(row['progress']['implemented'], {'state': 'yes', 'evidence': [f'source {FILE}:1 — the seam holds']})
        self.assertIn(f'evidence withdrawn, no longer held at {"f" * 9} — {TEST} (deleted in 6855f56d3)', row['notes'][-1])
        self.assertEqual(report['rows_with_evidence_withdrawn'], 1)

    def test_a_gap_returns_to_pending_though_its_evidence_holds(self):
        self.claim(GAPPED, [f'source {FILE}:1 — the seam holds'])
        report = self.run_it(FakeTree({FILE: 'the seam holds\n'}))
        row = self.row(self.read(), GAPPED)
        self.assertEqual(row['progress']['implemented']['state'], 'pending')
        self.assertIn('a named gap cannot stay implemented', row['notes'][-1])
        self.assertIn(f"implemented to be re-proven when {row['gap']['ticket']} builds its home", row['notes'][-1])
        self.assertEqual(report['returned_by_cause'], {'gap': 1})

    def test_verify_refuses_a_gap_that_stays_implemented(self):
        self.claim(GAPPED, [f'source {FILE}:1 — the seam holds'])
        with self.assertRaises(AssertionError):
            a.verify()

    def test_verify_refuses_a_commit_only_or_unformed_claim(self):
        self.claim(HOMED, [f'commit {SHA} — lands it'])
        with self.assertRaises(AssertionError):
            a.verify()
        self.claim(HOMED, ['it works, trust me'])
        with self.assertRaises(AssertionError):
            a.verify()
        self.claim(HOMED, [f'commit {SHA} — lands it', f'scripted {TEST} — it is tested'])
        a.verify()

    def test_the_other_axes_are_never_touched(self):
        self.claim(HOMED, [f'source {FILE}:1 — the seam holds'])
        before = {row['id']: {axis: state for axis, state in row['progress'].items() if axis != 'implemented'} for row in self.read()['targets']}
        self.run_it(FakeTree({}))
        after = {row['id']: {axis: state for axis, state in row['progress'].items() if axis != 'implemented'} for row in self.read()['targets']}
        self.assertEqual(before, after)

    def test_described_sources_and_test_lists_are_held_to_their_files(self):
        self.assertEqual(a.scripted_files('a/b/x.test.mjs, y.test.mjs; c/z.test.mjs'), ['a/b/x.test.mjs', 'a/b/y.test.mjs', 'c/z.test.mjs'])
        tree = FakeTree({FILE: '1\n2\n3\n', TEST: 'ok'})
        self.assertTrue(a.held(f'source {FILE} — what the file does', tree)['holds'])
        self.assertTrue(a.held(f'source {FILE}:1-3 — what those lines do', tree)['holds'])
        self.assertFalse(a.held(f'source {FILE}:2-9 — past the end', tree)['holds'])
        self.assertFalse(a.held(f'scripted {TEST}, other.test.mjs — both', tree)['holds'])
        self.assertTrue(a.held(f'scripted {TEST} — one', tree)['holds'])

    def test_a_quote_naming_another_target_is_not_this_targets_evidence(self):
        # lane-1:A1 cites a line that names A10 only: another target's code, so it does not hold for A1, and A1 returns to pending.
        self.claim(HOMED, [f'commit {SHA} — lands it', f'source {FILE}:1 — /* lane-1 A10 — embeds over their box */'])
        self.run_it(FakeTree({FILE: '/* lane-1 A10 — embeds over their box */\n'}))
        row = self.row(self.read(), HOMED)
        self.assertEqual(row['progress']['implemented']['state'], 'pending')
        self.assertIn('the quote names lane-1 A10, not this target', row['notes'][-1])
        # A quote that names this target among others, or within a range, is its own; the stray one is withdrawn beside it.
        body = '/* lane-1 A1-A3: guides */\n/** B2/B3 — one download */\n'
        self.claim(HOMED, [f'source {FILE}:1 — /* lane-1 A1-A3: guides */', f'source {FILE}:2 — /** B2/B3 — one download */'])
        self.run_it(FakeTree({FILE: body}))
        row = self.row(self.read(), HOMED)
        self.assertEqual(row['progress']['implemented'], {'state': 'yes', 'evidence': [f'source {FILE}:1 — /* lane-1 A1-A3: guides */']})
        self.assertIn('the quote names B2, B3, not this target', row['notes'][-1])

    def test_a_target_id_is_read_with_its_lane(self):
        row = {'target_id': 'T15', 'lane': 4}
        self.assertEqual(a.names_other_targets('lane-4 T14–T16: the transport', row), [])
        self.assertEqual(a.names_other_targets('T15: the window plays', row), [])
        self.assertEqual(a.names_other_targets('lane-2 T15-T18 — named timeline views', row), ['lane-2 T15', 'lane-2 T16', 'lane-2 T17', 'lane-2 T18'])
        self.assertEqual(a.names_other_targets('lane-2 T12 + T13: clusters', row), ['lane-2 T12', 'lane-2 T13'])
        self.assertEqual(a.names_other_targets('export function atlasTimeBindings(', row), [], 'a quote that names no target is held as before')

    def test_a_run_can_be_held_to_some_lanes(self):
        self.claim(HOMED, [f'source {FILE}:1 — the seam holds'])
        self.claim(PLACE, [f'source {FILE}:1 — the seam holds'])
        with contextlib.redirect_stdout(io.StringIO()):
            a.reprogress(apply=True, tree=FakeTree({}), day='2026-10-15', lanes=[4])
        document = self.read()
        self.assertEqual(self.row(document, HOMED)['progress']['implemented']['state'], 'yes', 'lane 1 is not in the run')
        self.assertEqual(self.row(document, PLACE)['progress']['implemented']['state'], 'pending')
        self.assertEqual(document['reprogress_basis']['runs'][-1]['lanes'], [4])

    def test_at_home_returns_a_row_whose_evidence_is_beside_its_home(self):
        self.claim(PLACE, [f'commit {SHA} — lands it', f'source {FILE}:1 — the seam holds'])
        self.run_it(FakeTree({FILE: 'the seam holds\n'}))
        self.assertEqual(self.row(self.read(), PLACE)['progress']['implemented']['state'], 'yes', 'without --at-home the frame code holds')
        with contextlib.redirect_stdout(io.StringIO()):
            report = a.reprogress(apply=True, tree=FakeTree({FILE: 'the seam holds\n'}), day='2026-10-15', at_home=True)
        row = self.row(self.read(), PLACE)
        self.assertEqual(row['progress']['implemented']['state'], 'pending')
        self.assertIn(f"none cites its home {row['home']['component']['at']}", row['notes'][-1])
        self.assertEqual(report['returned_by_cause'], {'beside its home': 1})
        # Evidence that cites the home's own file stays.
        home, line, quote = home_of(row)
        self.claim(PLACE, [f'source {home}:{line} — {quote}'])
        with contextlib.redirect_stdout(io.StringIO()):
            a.reprogress(apply=True, tree=FakeTree({home: at_line(line, quote)}), day='2026-10-15', at_home=True)
        self.assertEqual(self.row(self.read(), PLACE)['progress']['implemented']['state'], 'yes')

    def test_a_cited_test_title_must_still_stand(self):
        self.claim(HOMED, [f'scripted {TEST} — test "it flies"; its imports reach x'])
        self.run_it(FakeTree({TEST: "test('it walks', () => {})\n"}))
        row = self.row(self.read(), HOMED)
        self.assertEqual(row['progress']['implemented']['state'], 'pending')
        self.assertIn('no test "it flies" stands in the file', row['notes'][-1])

    def test_the_tree_reads_git_at_a_revision(self):
        tree = a.Tree('HEAD')
        self.assertTrue(tree.text('desktop/cradle/docs/world-shell/acceptance.py').startswith('#!/usr/bin/env python3'))
        self.assertIsNone(tree.text('desktop/cradle/expressions-app/field-studies-journeys/src/placeTourPanel.css'))
        self.assertTrue(tree.removed_by('desktop/cradle/expressions-app/field-studies-journeys/src/placeTourPanel.css').startswith('92a7d38d5'))
        self.assertTrue(tree.has_commit('92a7d38d5'))
        self.assertFalse(tree.has_commit('0' * 40))
        self.assertTrue(tree.in_history('92a7d38d5'))
        self.assertIn('packages/live-shell/ui/src/projections/atlas/places/PlacesPlate.tsx', tree.touched('92a7d38d5'))

    def test_the_import_walk_reads_the_revision_and_says_which_tests_reach_a_home(self):
        tree = a.Tree('92a7d38d5')
        root = tree.materialize()
        try:
            plate = root / 'packages/live-shell/ui/src/projections/atlas/places/PlacesPlate.tsx'
            self.assertEqual(plate.read_text(), tree.text('packages/live-shell/ui/src/projections/atlas/places/PlacesPlate.tsx'), 'the revision\'s bytes')
            tests = 'packages/live-shell/ui/tests/atlas-places-plate.test.mjs', 'packages/live-shell/ui/tests/atlas-places-model.test.mjs'
            self.assertEqual(a.test_reaches(list(tests), 'packages/live-shell/ui/src/projections/atlas/places/PlacesPlate.tsx', root), {tests[0]: True, tests[1]: False})
        finally:
            shutil.rmtree(root)


class ProveAtHome(unittest.TestCase):
    """`prove-at-home` records implemented only at the row's home, on evidence it checks: the home's cited line, tests whose imports
    reach the home (each named title in its file), commits in the revision's history that touched them. `pending` says why not."""

    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        for name in ('targets.json', 'references.json', 'sources.json'):
            shutil.copy(HERE / name, self.dir / name)
        self.saved_out = a.OUT
        a.OUT = self.dir
        document = self.read()
        for row in document['targets']:
            row['progress']['implemented'] = {'state': 'pending', 'evidence': []}
        (self.dir / 'targets.json').write_text(json.dumps(document, indent=2, ensure_ascii=False) + '\n')
        self.home, self.line, self.quote = home_of(next(row for row in document['targets'] if row['id'] == PLACE))

    def tearDown(self):
        a.OUT = self.saved_out
        shutil.rmtree(self.dir)

    def read(self):
        return json.loads((self.dir / 'targets.json').read_text())

    def row(self, target=PLACE):
        return next(row for row in self.read()['targets'] if row['id'] == target)

    def tree(self, **over):
        files = {self.home: at_line(self.line, self.quote), TEST: "test('it flies by precision', () => {})\n"}
        return FakeTree(over.pop('files', files), touched=over.pop('touched', {SHA: {self.home}}), **over)

    def prove(self, tree=None, targets=(PLACE,), commits=(SHA,), scripted=(f'{TEST}::it flies by precision',), reach=None):
        reach = reach or (lambda tests, home: {test: True for test in tests})
        with contextlib.redirect_stdout(io.StringIO()):
            return a.prove_at_home(list(targets), list(commits), list(scripted), tree=tree or self.tree(), day='2026-10-15', reach=reach)

    def test_it_records_the_home_citation_the_tests_and_the_commit(self):
        self.prove()
        row = self.row()
        self.assertEqual(row['progress']['implemented'], {'state': 'yes', 'evidence': [
            f'commit {SHA} — lands the home',
            f'source {self.home}:{self.line} — {self.quote}',
            f'scripted {TEST} — test "it flies by precision"; its imports reach {self.home}']})
        self.assertEqual(row['candidate_revision'], 'f' * 40)
        self.assertTrue(row['notes'][-1].startswith(f"2026-10-15 prove-at-home: implemented at its home {self.home}:{self.line}"))
        self.assertEqual(self.read()['reprogress_basis']['runs'][-1]['verb'], 'prove-at-home')
        # The proof is held by reprogress, home and all.
        with contextlib.redirect_stdout(io.StringIO()):
            a.reprogress(apply=True, tree=self.tree(), day='2026-10-15', at_home=True)
        self.assertEqual(self.row()['progress']['implemented']['state'], 'yes')

    def test_it_names_the_evidence_it_replaces(self):
        document = self.read()
        row = next(row for row in document['targets'] if row['id'] == PLACE)
        row['progress']['implemented'] = {'state': 'yes', 'evidence': [f'source {FILE}:1 — beside the home']}
        row['candidate_revision'] = 'a' * 40
        (self.dir / 'targets.json').write_text(json.dumps(document, indent=2, ensure_ascii=False) + '\n')
        self.prove()
        self.assertIn(f'Replaces its earlier evidence: source {FILE}:1.', self.row()['notes'][-1])

    def refused(self, **kwargs):
        before = (self.dir / 'targets.json').read_bytes()
        with self.assertRaises(ValueError) as caught:
            self.prove(**kwargs)
        self.assertEqual((self.dir / 'targets.json').read_bytes(), before, 'a refusal writes nothing')
        return str(caught.exception)

    def test_a_home_that_no_longer_holds_its_quote_is_refused(self):
        self.assertIn('does not hold its quote', self.refused(tree=self.tree(files={self.home: 'moved\n', TEST: "test('it flies by precision')"})))

    def test_a_test_that_is_missing_untitled_or_never_reaches_the_home_is_refused(self):
        self.assertIn('no test file', self.refused(tree=self.tree(files={self.home: at_line(self.line, self.quote)})))
        self.assertIn('no test "it walks"', self.refused(scripted=(f'{TEST}::it walks',)))
        self.assertIn('never reaches its home', self.refused(reach=lambda tests, home: {test: False for test in tests}))

    def test_a_commit_outside_the_history_or_touching_neither_is_refused(self):
        self.assertIn('is not in the history', self.refused(tree=self.tree(ancestors=())))
        self.assertIn('touched neither', self.refused(tree=self.tree(touched={SHA: {'elsewhere.ts'}})))
        self.prove(tree=self.tree(touched={SHA: {TEST}}))
        self.assertEqual(self.row()['progress']['implemented']['state'], 'yes', 'a commit that touched a cited test is the tests\' landing')

    def test_a_gap_has_no_home_to_prove_at(self):
        self.assertIn('no home to prove at (a named gap', self.refused(targets=(GAPPED,)))

    def test_pending_says_why_and_returns_a_claim(self):
        document = self.read()
        row = next(row for row in document['targets'] if row['id'] == PLACE)
        row['progress']['implemented'] = {'state': 'yes', 'evidence': [f'commit {SHA} — lands it', f'source {FILE}:1 — beside the home']}
        row['candidate_revision'] = 'a' * 40
        (self.dir / 'targets.json').write_text(json.dumps(document, indent=2, ensure_ascii=False) + '\n')
        runs = len((document.get('reprogress_basis') or {}).get('runs', []))
        with contextlib.redirect_stdout(io.StringIO()):
            a.hold_pending([PLACE, HOMED], 'not kept (lane O): the atlas rig is north-up', day='2026-10-15')
            a.hold_pending([HOMED], 'not kept (lane O): the atlas rig is north-up', day='2026-10-15')
        row = self.row()
        self.assertEqual(row['progress']['implemented'], {'state': 'pending', 'evidence': []})
        self.assertEqual(row['notes'][-1], f'2026-10-15 pending: not kept (lane O): the atlas rig is north-up. Implemented returns to pending; its evidence is withdrawn: commit {SHA}; source {FILE}:1.')
        self.assertEqual(sum(note.startswith('2026-10-15 pending:') for note in self.row(HOMED)['notes']), 1, 'the same reason is said once')
        self.assertEqual([run['returned_to_pending'] for run in self.read()['reprogress_basis']['runs'][runs:]], [[PLACE]], 'a repeat that says nothing new records no run')
        with self.assertRaises(ValueError):
            a.hold_pending([PLACE], '  ', day='2026-10-15')


if __name__ == '__main__':
    unittest.main()
