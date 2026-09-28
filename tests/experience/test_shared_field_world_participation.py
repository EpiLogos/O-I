"""Source/coverage checks only; these tests do not execute shared agency or UI."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
MODULE = "docs/experience/shared-field-world-participation.json"
UX = "docs/experience/SHARED-FIELD-DESKTOP.md"
STATE = "docs/SHARED-FIELD-STATE-DISCOVERY.md"
EXPECTED = {
    "web65:WORLD", "web65:EXPLORE", "web65:RESOLVE", "web65:PARTICIPATE",
    "web65:ACTIVITY", "web65:RETURN", "web65:CONTINUITY", "web65:MATRIX",
}

spec = importlib.util.spec_from_file_location(
    "shared_world_experience_map", ROOT / "scripts/experience_map.py"
)
assert spec is not None and spec.loader is not None
compiler = importlib.util.module_from_spec(spec)
spec.loader.exec_module(compiler)


class SharedWorldSourceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.reading = compiler.load_sources(ROOT)
        cls.module = json.loads((ROOT / MODULE).read_text(encoding="utf-8"))

    def test_current_campaign_imports_whole_ux_and_state_source(self):
        self.assertIn(MODULE, self.reading["source_config"]["source_modules"])
        self.assertEqual(self.module["families"], [])
        for path in (MODULE, UX, STATE):
            with self.subTest(path=path):
                retained = self.reading["source_documents"][path]
                self.assertEqual(retained["text"], (ROOT / path).read_text(encoding="utf-8"))
                self.assertEqual(retained["digest"], compiler.digest((ROOT / path).read_bytes()))

    def test_every_required_obligation_reaches_its_existing_stories(self):
        self.assertEqual(set(self.module["required_obligation_ids"]), EXPECTED)
        obligations = {
            row["id"]: row for row in self.reading["inherited_obligations"]
            if row["source_module"] == MODULE
        }
        self.assertEqual(set(obligations), EXPECTED)
        stories = {row["id"]: row for row in self.reading["stories"]}
        for key, obligation in obligations.items():
            self.assertTrue(obligation["required_branches"])
            self.assertTrue(obligation["native_locator"])
            self.assertEqual(obligation["mapping_status"], "specified-not-exercised")
            for story_id in obligation["story_ids"]:
                with self.subTest(obligation=key, story=story_id):
                    inherited = stories[story_id]["extensions"]["inherited_obligations"]
                    self.assertEqual(sum(row["id"] == key for row in inherited), 1)

    def test_compilation_does_not_claim_runtime_or_matrix_binding(self):
        self.assertTrue(self.reading["planning_only"])
        self.assertIsNone(self.reading["feature_verdict"])
        self.assertFalse(self.module["runtime_or_human_acceptance"])
        self.assertEqual(self.reading["capability_bindings"], [])
        requirements = self.module["matrix_binding_requirements"]
        self.assertEqual(requirements["protocol"], "ql-capability-matrix/1")
        self.assertEqual(requirements["runtime_bindings"], [])
        self.assertEqual(requirements["execution_evidence"], [])

    def test_dropped_required_obligation_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for relative, source in self.reading["source_documents"].items():
                target = root / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(source["text"], encoding="utf-8")
            module = json.loads((root / MODULE).read_text(encoding="utf-8"))
            module["obligations"] = [
                row for row in module["obligations"] if row["id"] != "web65:PARTICIPATE"
            ]
            (root / MODULE).write_text(json.dumps(module), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "inherited obligation coverage"):
                compiler.load_sources(root)


if __name__ == "__main__":
    unittest.main()
