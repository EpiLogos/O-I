"""CI dependency/coverage regressions, separate from owner-native product proof."""
import importlib.util
from pathlib import Path
import unittest
import yaml

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('ci_status', ROOT / 'scripts/development-field-ci-status.py')
status = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(status)


def workflow(name):
    return yaml.load((ROOT / '.github/workflows' / name).read_text(), Loader=yaml.BaseLoader)


class DiagnosticsTests(unittest.TestCase):
    def test_activation_failure_blocks_lifecycle_not_independent_bridges(self):
        steps = {name: {'outcome': 'success'} for name in status.DEPENDENCIES}
        steps['activation']['outcome'] = 'failure'
        steps['lifecycle']['outcome'] = 'skipped'
        steps['whole_gate']['outcome'] = 'failure'
        report = status.classify(steps)
        self.assertEqual(['activation'], report['primary_failures'])
        self.assertEqual(['lifecycle'], report['blocked_steps'])
        self.assertEqual('passed', next(row for row in report['steps'] if row['step'] == 'bridges')['standing'])
        self.assertIn('| lifecycle | blocked | activation |', status.markdown(report))

    def test_preparation_failure_keeps_missing_proof_blocked(self):
        report = status.classify({'prepare': {'outcome': 'failure'}})
        self.assertEqual(['prepare'], report['primary_failures'])
        self.assertTrue(all(row['standing'] != 'passed' for row in report['steps']))
        self.assertIn('dispatch', report['blocked_steps'])

    def test_missing_and_cancelled_are_not_passed(self):
        self.assertEqual('not-executed', status.classify({})['steps'][0]['standing'])
        rows = status.classify({'prepare': {'outcome': 'cancelled'}})['steps']
        self.assertEqual('cancelled', rows[0]['standing'])
        self.assertEqual('blocked', rows[1]['standing'])

    def test_unexpected_executed_failure_is_not_hidden_as_blocked(self):
        report = status.classify({'activation': {'outcome': 'failure'}, 'lifecycle': {'outcome': 'failure'}})
        self.assertIn('lifecycle', report['primary_failures'])


class WorkflowTests(unittest.TestCase):
    """The cross-product lane keeps its dependency structure; the per-push gate keeps product coverage."""

    def test_lifecycle_requires_actual_activation(self):
        job = workflow('cross-product.yml')['jobs']['development-field-conformance']
        steps = {step['id']: step for step in job['steps'] if 'id' in step}
        self.assertIn("steps.activation.outcome == 'success'", steps['lifecycle']['if'])
        self.assertIn("steps.dispatch.outcome == 'success'", steps['bridges']['if'])
        self.assertNotIn('activation', steps['bridges']['if'])
        for name in ('probe', 'dispatch'):
            self.assertIn("steps.prepare.outcome == 'success'", steps[name]['if'])
        self.assertTrue(set(status.DEPENDENCIES) <= set(steps))
        self.assertTrue(all(step.get('continue-on-error', 'false') == 'false' for step in steps.values()))

    def test_cross_product_lane_is_scheduled_not_per_push(self):
        data = workflow('cross-product.yml')
        self.assertIn('schedule', data['on'])
        self.assertIn('workflow_dispatch', data['on'])
        self.assertNotIn('pull_request', data['on'])
        self.assertNotIn('push', data['on'])

    def test_all_seven_native_owners_are_preserved(self):
        job = workflow('cross-product.yml')['jobs']['development-field-native']
        self.assertEqual({'oi', 'central', 'actuation', 'ai-kit', 'software-factory', 'workcell', 'quaternal-logic'}, set(job['strategy']['matrix']['owner']))
        caches = [step for step in job['steps'] if step.get('uses', '').startswith('Swatinem/rust-cache@')]
        self.assertEqual(1, len(caches))
        self.assertIn("matrix.owner == 'oi'", caches[0]['with']['workspaces'])
        self.assertEqual('true', caches[0]['with']['cache-on-failure'])

    def test_per_push_gate_keeps_product_source_coverage(self):
        data = workflow('verify.yml')
        self.assertIn('pull_request', data['on'])
        self.assertEqual(['main'], data['on']['push']['branches'])
        runs = '\n'.join(step.get('run', '') for job in data['jobs'].values() for step in job['steps'])
        self.assertIn('scripts/verify-development-field-s0.py', runs)
        self.assertIn('cargo test', runs)
        self.assertNotIn('repository:', runs)
        for job in data['jobs'].values():
            for step in job['steps']:
                self.assertNotIn('repository', step.get('with', {}), 'the per-push gate never checks out a sibling repository')
