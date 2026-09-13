"""Source-contract regression only: this does not install or prove a composition."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("experience_map_composition_test", ROOT / "scripts/experience_map.py")
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class InstallationCompositionSourceTests(unittest.TestCase):
    def setUp(self):
        self.reading = MODULE.load_sources(ROOT)
        self.config = self.reading["config"]
        self.composition = self.config["installation_composition"]
        self.forms = {row["id"]: row for row in self.composition["forms"]}

    def test_one_containing_frame_and_six_forms(self):
        self.assertEqual(self.composition["organisation"], "1+6")
        self.assertEqual(self.composition["containing_frame"]["id"], "CF5")
        self.assertFalse(self.composition["containing_frame"]["management_software_mandatory"])
        self.assertEqual(set(self.forms), {"CF1", "CF2", "CF3", "CF4", "CF6", "CF7"})
        self.assertEqual(len(self.forms), len(self.composition["forms"]))
        self.assertEqual(self.composition["authority"], "https://github.com/EpiLogos/O-I/issues/268")

    def test_minima_do_not_smuggle_unselected_agent_stack(self):
        self.assertEqual(self.forms["CF2"]["native_products"], ["Central", "Actuation"])
        self.assertEqual(set(self.forms["CF2"]["not_required"]), {"ai-kit", "Factory", "QL-MEF"})
        self.assertEqual(self.forms["CF6"]["native_products"], ["Central", "Workcell-client"])
        self.assertEqual(set(self.forms["CF6"]["not_required_locally"]), {"Actuation", "ai-kit", "Factory", "QL-MEF"})
        self.assertEqual(self.forms["CF7"]["native_products"], ["Central", "QL-MEF"])
        self.assertEqual(set(self.forms["CF7"]["not_required"]), {"Actuation", "ai-kit", "Factory"})

    def test_desktop_backing_and_ordinary_core_are_distinct(self):
        self.assertTrue(self.forms["CF1"]["backing_selection_explicit"])
        self.assertEqual(self.forms["CF1"]["normal_new_install_backing"], self.forms["CF3"]["native_products"])
        self.assertNotEqual(self.forms["CF1"]["composition"], self.forms["CF3"]["composition"])
        self.assertNotIn("CF5", self.forms)

    def test_variants_resolve_real_existing_story_ids_and_source(self):
        known = {row["id"] for row in self.reading["stories"]}
        for form in self.forms.values():
            with self.subTest(frame=form["id"]):
                self.assertTrue(form["story_ids"])
                self.assertTrue(set(form["story_ids"]).issubset(known))
                self.assertTrue(form["required_observation"])
        path = MODULE.source_path(ROOT, self.composition["variant_source"])
        self.assertTrue(path.is_file())
        text = path.read_text(encoding="utf-8")
        for frame in ["CF1", "CF2", "CF3", "CF4", "CF5", "CF6", "CF7"]:
            self.assertIn(frame, text)

    def test_old_paths_are_history_not_a_second_taxonomy(self):
        self.assertEqual(len(self.config["setup_contexts"]), 6)
        self.assertIn("Historical", self.config["setup_context_semantics"])
        self.assertIn("not", self.config["setup_context_semantics"])
        self.assertEqual(len(self.composition["cross_form_branches"]), 6)

    def test_source_projection_does_not_claim_installed_or_lived_use(self):
        self.assertTrue(self.reading["planning_only"])
        self.assertIsNone(self.reading["feature_verdict"])
        self.assertFalse(self.config["runtime_or_human_acceptance"])
        self.assertFalse(self.config["delegated_ql"]["human_experience_validated_at_inspection"])
        for story in self.reading["stories"]:
            self.assertEqual(story["extensions"]["runtime_readiness"], "not-assessed")
            self.assertEqual(story["extensions"]["execution_evidence"], [])
        manifest, rows = MODULE.relation_projection(self.reading)
        self.assertEqual(manifest["protocol"], "ql-capability-matrix/1")
        self.assertIsNone(manifest["extensions"]["feature_verdict"])
        self.assertTrue(rows)
        self.assertTrue(all(json.loads(row["capability_refs"]) == [] for row in rows))


if __name__ == "__main__":
    unittest.main()
