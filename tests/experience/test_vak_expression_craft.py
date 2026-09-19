"""Source/coverage regressions only: these do not exercise a live craft run."""
from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "experience_map_vak_craft_test", ROOT / "scripts/experience_map.py"
)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
SOURCE = "docs/experience/EXPRESSION-FIELD.md"
MODULE_PATH = "docs/experience/vak-expression-craft.json"


class VakExpressionCraftSourceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.reading = MODULE.load_sources(ROOT)
        cls.config = cls.reading["config"]
        cls.module = json.loads((ROOT / MODULE_PATH).read_text(encoding="utf-8"))

    def test_additive_module_preserves_existing_source_entries(self):
        previous = {
            "docs/experience/developer-field.json",
            "docs/experience/personal-web.json",
            "docs/experience/factory-agency.json",
            "docs/experience/session-grounding.json",
            "docs/experience/harness-first-adoption.json",
        }
        self.assertTrue(previous.issubset(set(self.config["source_modules"])))
        self.assertEqual(self.config["source_modules"].count(MODULE_PATH), 1)
        self.assertEqual(self.module["families"], [])
        self.assertEqual(self.config["existing_caw"]["required_case_ids"],
                         [f"P{i:02}" for i in range(1, 29)])
        self.assertEqual(self.config["delegated_ql"]["repository"], "EpiLogos/QL-MEF")

    def test_original_expression_stories_are_preserved_verbatim(self):
        source = (ROOT / SOURCE).read_text(encoding="utf-8")
        before = source.split("## 9. Vāk-authored craft", 1)[0].rstrip() + "\n"
        data = before.encode("utf-8")
        blob = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
        self.assertEqual(blob, "93035d856295e4eaf89a8895dbe95652a4c8556c")

    def test_full_expression_source_is_in_the_operator_reading(self):
        data = (ROOT / SOURCE).read_bytes()
        retained = self.reading["source_documents"][SOURCE]
        self.assertEqual(retained["text"], data.decode("utf-8"))
        self.assertEqual(retained["digest"], "sha256:" + hashlib.sha256(data).hexdigest())
        self.assertEqual(self.module["story_source"], SOURCE)

    def test_every_clause_binds_existing_stories_and_retains_its_conditions(self):
        expected = {
            "lean-language", "first-source-stamp", "real-participants",
            "live-faculties", "curated-invocation", "performed-return",
            "joined-experience",
        }
        expected = {f"vakcraft65:{name}" for name in expected}
        self.assertEqual(set(self.module["required_obligation_ids"]), expected)
        self.assertEqual({o["id"] for o in self.module["obligations"]}, expected)
        attached = {
            obligation["id"]
            for story in self.reading["stories"]
            for obligation in story["extensions"]["inherited_obligations"]
        }
        self.assertTrue(expected.issubset(attached))
        known = {story["id"] for story in self.reading["stories"]}
        for obligation in self.module["obligations"]:
            with self.subTest(obligation=obligation["id"]):
                self.assertTrue(obligation["story_ids"])
                self.assertTrue(set(obligation["story_ids"]).issubset(known))
                self.assertTrue(obligation["native_locator"])
                self.assertTrue(obligation["required_branches"])
                self.assertTrue(set(obligation["required_evidence"]).issubset({"D", "C", "P", "M", "H"}))

    def test_planning_does_not_start_work_or_certify_it(self):
        self.assertFalse(self.module["runtime_or_human_acceptance"])
        policy = self.module["execution_policy"]
        self.assertFalse(policy["start_workers_on_publication"])
        self.assertFalse(policy["live_machine_change_by_publication"])
        self.assertFalse(policy["mathematical_kernel_change"])
        self.assertFalse(policy["per_agent_worktree"])
        self.assertEqual(policy["worktree_unit"], "coherent-feature-line")
        self.assertTrue(self.reading["planning_only"])
        self.assertIsNone(self.reading["feature_verdict"])

    def test_hosted_learning_does_not_gain_a_visitor_install(self):
        forms = {form["id"]: form for form in self.config["installation_composition"]["forms"]}
        self.assertEqual(forms["CF7"]["native_products"], [])
        self.assertFalse(forms["CF7"]["requires_local_install"])
        self.assertFalse(forms["CF7"]["visitor_agent_or_api_key_required"])


if __name__ == "__main__":
    unittest.main()
