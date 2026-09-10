"""Evidence-reader mechanics only; these fixtures are never native uptake proof."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
import caw_campaign as c
import caw_native_profiles as p


class ProfileEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.gen = self.root / 'generations/gen_checked'
        self.tree = self.gen / 'projections/codex/.agents/skills/operator'
        self.tree.mkdir(parents=True)
        (self.gen / 'metadata.json').write_text(json.dumps({'generation_id': 'gen_checked', 'generation_format': 1}))
        (self.tree / 'SKILL.md').write_bytes((c.ROOT / 'skills/suite-operator/SKILL.md').read_bytes())
        (self.root / 'current').symlink_to(self.gen, target_is_directory=True)

    def test_current_body_is_read_not_just_receipt(self):
        self.assertEqual(len(p.generated_bodies(self.root, 'gen_checked')), 1)

    def test_old_or_wrong_generation_cannot_satisfy_current_receipt(self):
        with self.assertRaisesRegex(c.Failure, 'no matching'):
            p.generated_bodies(self.root, 'gen_other')

    def test_wrong_context_cannot_supply_an_equal_generation(self):
        with self.assertRaisesRegex(c.Failure, 'no matching'):
            p.generated_bodies(self.root, 'gen_checked', 'ctx_not_this_context')

    def test_missing_current_pointer_fails_even_with_source_and_old_payload(self):
        (self.root / 'current').unlink()
        with self.assertRaises(c.Failure): p.generated_bodies(self.root, 'gen_checked')

    def test_disabled_current_generation_has_no_effective_governance(self):
        (self.tree / 'SKILL.md').unlink()
        self.assertEqual(p.generated_bodies(self.root, 'gen_checked'), [])

    def test_changed_payload_is_not_loaded_original(self):
        skill = self.tree / 'SKILL.md'
        skill.write_bytes(skill.read_bytes().replace(b'## 0 ', b'## altered '))
        with self.assertRaisesRegex(c.Failure, 'changed the authored'):
            p.generated_bodies(self.root, 'gen_checked')

    def test_generation_metadata_without_format_is_not_committed(self):
        (self.gen / 'metadata.json').write_text(json.dumps({'generation_id': 'gen_checked'}))
        with self.assertRaises(c.Failure): p.generated_bodies(self.root, 'gen_checked')

    def test_missing_projection_is_not_receipt_success(self):
        import shutil
        shutil.rmtree(self.gen / 'projections')
        with self.assertRaises(c.Failure): p.generated_bodies(self.root, 'gen_checked')

    def test_projected_symlink_outside_world_is_refused(self):
        external = self.root / 'generations/external'
        external.symlink_to('/etc', target_is_directory=True)
        (self.tree / 'outside').symlink_to(external, target_is_directory=True)
        with self.assertRaises(c.Failure): p.generated_bodies(self.root, 'gen_checked')

    def test_all_seventeen_fields_keep_the_exact_source_positions(self):
        positions = c.load(c.SPEC / 'sources/ct4b-fields.json')['positions']
        expected = [
            ['p0_grounds','p0_adjacencies'], ['p1_tasks_defined','p1_intentions'],
            ['p2_sessions','p2_operations','p2_manual_activity'],
            ['p3_patterns','p3_observations','p3_connections'],
            ['p4_temporals','p4_files_touched','p4_people_mentioned','p4_concepts_engaged'],
            ['p5_learnings','p5_synthesis','p5_tomorrow_focus']]
        self.assertEqual([position['position'] for position in positions], list(range(6)))
        self.assertEqual([position['fields'] for position in positions], expected)
        self.assertEqual(sum(map(len, expected)), 17)

    def test_every_parent_join_has_an_explicit_owner_operation(self):
        joins = c.load(c.SPEC / 'joins.json')['web_code']
        for case in c.matrix():
            for name in case['owner_joins']:
                self.assertTrue(joins[name]['owner'])
                self.assertTrue(joins[name]['needed'])

    def test_unbound_local_campaign_runs_both_lanes_and_keeps_parent_pending(self):
        out = self.root / 'campaign'
        result = subprocess.run([sys.executable, str(ROOT / 'scripts/caw_local.py'), '--output', str(out)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 2, result.stderr)
        report = c.load(out / 'report.json')
        self.assertEqual({child['stage'] for child in report['children']}, {'profiles', 'native'})
        self.assertEqual(len(report['acceptance']['cases']), 28)
        self.assertEqual(report['acceptance']['standing'], 'pending')
        self.assertEqual(report['commands'], [])
        self.assertIsNone(report['acceptance']['whole_feature_verdict'])


if __name__ == '__main__': unittest.main()
