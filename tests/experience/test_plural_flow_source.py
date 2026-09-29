"""Planning-source integrity only; does not execute plural conversations."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import re
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
MODULE = "docs/experience/plural-flow.json"
SPEC = "docs/experience/PLURAL-FLOW-SPEC.md"
WAYFINDER = ".wayfinder/maps/plural-flow-now.md"
EXPECTED = {
    "plural65:FORM", "plural65:DELIVERY", "plural65:RECOVERY",
    "plural65:PARTICIPATION", "plural65:RESPONSE", "plural65:SHARED",
    "plural65:CONTINUITY", "plural65:UI", "plural65:MATRIX",
}
loader_spec = importlib.util.spec_from_file_location(
    "plural_flow_experience_map", ROOT / "scripts/experience_map.py"
)
assert loader_spec is not None and loader_spec.loader is not None
compiler = importlib.util.module_from_spec(loader_spec)
loader_spec.loader.exec_module(compiler)


class PluralFlowSourceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.reading = compiler.load_sources(ROOT)
        cls.module = json.loads((ROOT / MODULE).read_text(encoding="utf-8"))

    def test_full_spec_and_wayfinder_are_retained_in_existing_campaign(self):
        self.assertIn(MODULE, self.reading["source_config"]["source_modules"])
        self.assertEqual(self.module["families"], [])
        for path in (MODULE, SPEC, WAYFINDER):
            with self.subTest(path=path):
                retained = self.reading["source_documents"][path]
                self.assertEqual(retained["text"], (ROOT / path).read_text(encoding="utf-8"))
                self.assertEqual(retained["digest"], compiler.digest((ROOT / path).read_bytes()))

    def test_obligations_reach_existing_stories_once(self):
        self.assertEqual(set(self.module["required_obligation_ids"]), EXPECTED)
        obligations = {
            row["id"]: row for row in self.reading["inherited_obligations"]
            if row["source_module"] == MODULE
        }
        self.assertEqual(set(obligations), EXPECTED)
        stories = {row["id"]: row for row in self.reading["stories"]}
        for key, obligation in obligations.items():
            self.assertEqual(len(obligation["required_branches"]), 3)
            self.assertTrue(obligation["native_locator"])
            self.assertEqual(obligation["mapping_status"], "specified-not-exercised")
            for story_id in obligation["story_ids"]:
                with self.subTest(obligation=key, story=story_id):
                    inherited = stories[story_id]["extensions"]["inherited_obligations"]
                    self.assertEqual(sum(row["id"] == key for row in inherited), 1)

    def test_cases_are_defined_and_referenced_without_fake_runtime_evidence(self):
        body = (ROOT / WAYFINDER).read_text(encoding="utf-8")
        definitions = re.findall(r"^\| \*\*(MP\d{2})\b", body, flags=re.MULTILINE)
        self.assertEqual(definitions, [f"MP{index:02d}" for index in range(1, 19)])
        referenced = {
            ref for row in self.module["obligations"] for ref in row["test_refs"]
            if re.fullmatch(r"MP\d{2}", ref)
        }
        self.assertEqual(referenced, set(definitions))
        self.assertTrue(self.reading["planning_only"])
        self.assertIsNone(self.reading["feature_verdict"])
        self.assertFalse(self.module["runtime_or_human_acceptance"])
        requirements = self.module["matrix_binding_requirements"]
        self.assertEqual(requirements["runtime_bindings"], [])
        self.assertEqual(requirements["execution_evidence"], [])

    def test_dropped_required_delivery_obligation_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for relative, source in self.reading["source_documents"].items():
                target = root / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(source["text"], encoding="utf-8")
            module = json.loads((root / MODULE).read_text(encoding="utf-8"))
            module["obligations"] = [
                row for row in module["obligations"] if row["id"] != "plural65:DELIVERY"
            ]
            (root / MODULE).write_text(json.dumps(module), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "inherited obligation coverage"):
                compiler.load_sources(root)


if __name__ == "__main__":
    unittest.main()
