"""The acceptance register's re-homing law (FOUNDATION §8): `rehome` records home/owner_op or a named gap per target, holds every
citation to its quote and every home to the candidate's reachability verdict, and `verify` keeps the columns whole and the counts true.
Each test works on a copy of the register in a temporary directory; the committed register is never written."""
import copy
import importlib.util
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


if __name__ == '__main__':
    unittest.main()
