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
GAPPED = 'lane-4:T20'
SHA = 'c' * 40
FILE = 'desktop/cradle/fake/seam.ts'
TEST = 'desktop/cradle/fake/seam.test.mjs'


class FakeTree:
    """One revision's files and history, in memory: what `reprogress` reads through git."""
    head = 'f' * 40

    def __init__(self, files, commits=(SHA,), removed=None):
        self.files, self.commits, self.removed = files, set(commits), removed or {}

    def text(self, path):
        return self.files.get(path)

    def has_commit(self, sha):
        return any(commit.startswith(sha) for commit in self.commits)

    def removed_by(self, path, quote=None):
        return self.removed.get((path, quote) if quote else path)


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
        self.assertEqual(report['returned_by_cause'], {'evidence gone': 1})

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

    def test_the_tree_reads_git_at_a_revision(self):
        tree = a.Tree('HEAD')
        self.assertTrue(tree.text('desktop/cradle/docs/world-shell/acceptance.py').startswith('#!/usr/bin/env python3'))
        self.assertIsNone(tree.text('desktop/cradle/expressions-app/field-studies-journeys/src/placeTourPanel.css'))
        self.assertTrue(tree.removed_by('desktop/cradle/expressions-app/field-studies-journeys/src/placeTourPanel.css').startswith('92a7d38d5'))
        self.assertTrue(tree.has_commit('92a7d38d5'))
        self.assertFalse(tree.has_commit('0' * 40))


if __name__ == '__main__':
    unittest.main()
