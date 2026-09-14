"""Proving-driver mechanics; synthetic logs here are NOT native product proof."""
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
import caw_campaign as c
import caw_native_tasks as t


def result(passed=7, failed=0, ignored=0, filtered=0, markers=True):
    state = 'FAILED' if failed else 'ok'
    text = ('\n'.join(sorted(t.MARKERS)) + '\n') if markers else ''
    return (text + f'test result: {state}. {passed} passed; {failed} failed; {ignored} ignored; 0 measured; {filtered} filtered out; finished in 0.00s\n').encode()


class NativeTaskMechanics(unittest.TestCase):
    def test_complete_executed_summary_and_witnesses_required(self):
        t.check_connected(0, result())
        for code, data in [(0, b'{"ok":true}'), (0, result(markers=False)),
                           (0, result(passed=6, ignored=1)), (0, result(passed=0, filtered=7)),
                           (1, result()), (0, result() + result())]:
            with self.subTest(code=code, data=data), self.assertRaises(c.Failure):
                t.check_connected(code, data)

    def test_removed_producer_must_fail_the_exact_native_case(self):
        t.check_disconnected(101, result(passed=0, failed=1, filtered=6, markers=False))
        for code, data in [(0, result()), (0, result(passed=0, failed=1, filtered=6, markers=False)),
                           (101, b'failed to run'), (101, result(passed=0, failed=1, filtered=6)),
                           (101, result(passed=0, ignored=1, filtered=6, markers=False))]:
            with self.subTest(code=code, data=data), self.assertRaises(c.Failure):
                t.check_disconnected(code, data)

    def test_native_suite_inventory_retains_all_seven_cases(self):
        self.assertEqual(len(t.TESTS), 7)
        self.assertIn(t.DISCONNECTED_TEST, t.TESTS)
        self.assertIn('material::a_healthy_unrelated_process_cannot_satisfy_encounter_hosting', t.TESTS)
        self.assertIn('missing_task_authority_refuses_before_now_allocation', t.TESTS)

    def test_absent_suite_binding_is_pending_not_a_disproof(self):
        import tempfile as tempfile_module
        with tempfile_module.TemporaryDirectory() as home:
            recorder = c.Recorder(Path(home), {}, timeout=1)
            with self.assertRaises(c.Pending):
                t.prove(recorder)

    def test_named_refinements_are_binding_in_every_required_parent_case(self):
        expected = {
            'candidate-worktree-now': ['P13','P14','P18','P19','P26'],
            'working-environment-continuity': ['P14','P17','P21','P22'],
            'assisted-commission': ['P07','P08','P21','P22','P23'],
            'candidate-comparison': ['P13','P18','P21','P22','P23'],
        }
        document = c.load(c.SPEC / 'cases.json')
        subcases = {s['id']: s for s in document['subcases']}
        self.assertEqual(set(subcases), set(expected))
        cases = {case['id']: case for case in c.matrix()}
        for name, members in expected.items():
            self.assertEqual(subcases[name]['cases'], members)
            self.assertTrue(subcases[name]['requires'])
            for member in members:
                self.assertIn(name, cases[member]['requires'])
        self.assertIn(t.OBLIGATION, cases['P26']['requires'])

    def test_native_material_slice_does_not_complete_the_parent(self):
        observations = [{'id':'native-task-material','case':'P26','obligation':t.OBLIGATION,
                         'standing':'observed','grade':grade,'disconnected':'detected','record_ids':[0,1,2]}
                        for grade in ('D','C')]
        assessment = c.assess(c.matrix(), observations)
        self.assertEqual(assessment['standing'], 'pending')
        self.assertEqual(len(assessment['cases']), 28)
        self.assertIsNone(assessment['whole_feature_verdict'])

    def test_native_sources_are_exact_candidates_not_branch_names(self):
        lock = c.load(c.SPEC / 'sources/lock.json')
        cut = lock['controlled_native_cut']
        for name in set(t.OWNER_KEYS.values()):
            self.assertRegex(cut[name], r'^[a-f0-9]{40}$')
        self.assertIn('unmerged-candidate', lock['standing'])
        self.assertIn('not-accepted-main', lock['standing'])


if __name__ == '__main__':
    unittest.main()
