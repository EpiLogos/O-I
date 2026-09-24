"""Planning/source regressions; no installation, loading or runtime proof."""
from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "experience_map_adoption_test", ROOT / "scripts/experience_map.py"
)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
SOURCE = "docs/experience/HARNESS-FIRST-ADOPTION.md"
MODULE_PATH = "docs/experience/harness-first-adoption.json"


class HarnessFirstAdoptionSourceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.reading = MODULE.load_sources(ROOT)
        cls.config = cls.reading["config"]
        cls.module = json.loads((ROOT / MODULE_PATH).read_text(encoding="utf-8"))

    def test_additive_module_uses_existing_stories_and_preserves_sources(self):
        previous = {
            "docs/experience/developer-field.json",
            "docs/experience/personal-web.json",
            "docs/experience/factory-agency.json",
            "docs/experience/session-grounding.json",
        }
        self.assertTrue(previous.issubset(set(self.config["source_modules"])))
        self.assertEqual(self.config["source_modules"].count(MODULE_PATH), 1)
        self.assertEqual(self.module["families"], [])
        known = {row["id"] for row in self.reading["stories"]}
        for obligation in self.module["obligations"]:
            with self.subTest(obligation=obligation["id"]):
                self.assertTrue(set(obligation["story_ids"]).issubset(known))
                self.assertTrue(obligation["story_ids"])
                self.assertTrue(obligation["native_locator"])
                self.assertTrue(obligation["required_branches"])
                self.assertTrue(set(obligation["required_evidence"]).issubset({"D", "C", "P", "M", "H"}))
        self.assertEqual(
            self.config["existing_caw"]["required_case_ids"],
            [f"P{number:02}" for number in range(1, 29)],
        )
        self.assertEqual(self.config["delegated_ql"]["repository"], "EpiLogos/QL-MEF")

    def test_full_prose_is_in_the_compilers_digest_and_reading(self):
        data = (ROOT / SOURCE).read_bytes()
        retained = self.reading["source_documents"][SOURCE]
        self.assertEqual(retained["text"], data.decode("utf-8"))
        self.assertEqual(retained["digest"], "sha256:" + hashlib.sha256(data).hexdigest())
        self.assertEqual(self.module["story_source"], SOURCE)
        self.assertEqual(self.module["obligation_sources"]["adoption65"]["source_ref"], SOURCE)

    def test_every_declared_join_is_attached_to_an_existing_story(self):
        expected = {
            "entry-and-facets", "source-preservation", "practice-and-defaults",
            "hooks-and-activation", "session-routing", "extension-and-retraction",
            "current-native-cut", "independent-proving",
        }
        declared = {f"adoption65:{name}" for name in expected}
        self.assertEqual(set(self.module["required_obligation_ids"]), declared)
        self.assertEqual({o["id"] for o in self.module["obligations"]}, declared)
        attached = {
            obligation["id"]
            for story in self.reading["stories"]
            for obligation in story["extensions"]["inherited_obligations"]
        }
        self.assertTrue(declared.issubset(attached))

    def test_cut_does_not_mutate_ql_or_replace_feature_worktrees_per_actor(self):
        scope = self.module["current_cut_scope"]
        self.assertEqual(set(scope["update_owner_ids"]), {
            "oi", "central", "actuation", "ai-kit", "software-factory", "workcell",
        })
        self.assertEqual(scope["held_native_owner"], "QL-MEF")
        self.assertEqual(scope["held_install_owner_id"], "quaternal-logic")
        self.assertNotIn(scope["held_install_owner_id"], scope["update_owner_ids"])
        self.assertIn("current installed app generation", scope["held_surfaces"])
        self.assertEqual(scope["code_workspace_unit"], "coherent-feature-line")
        self.assertFalse(scope["new_worktree_per_agent_or_session"])
        self.assertEqual(scope["update_source"], "docs/INSTALL-UPDATE-FLOW.md")
        self.assertFalse(scope["actual_machine_inspection_or_install_claimed"])

    def test_hosted_learning_and_required_operational_core_remain_distinct(self):
        forms = {f["id"]: f for f in self.config["installation_composition"]["forms"]}
        self.assertEqual(forms["CF3"]["native_products"], ["Central", "Actuation", "ai-kit"])
        self.assertEqual(forms["CF7"]["native_products"], [])
        self.assertFalse(forms["CF7"]["requires_local_install"])
        self.assertFalse(forms["CF7"]["visitor_agent_or_api_key_required"])
        self.assertFalse(forms["CF7"]["live_shared_session_required_for_reading"])
        self.assertFalse(self.config["runtime_or_human_acceptance"])
        self.assertFalse(self.module["runtime_or_human_acceptance"])
        self.assertTrue(self.reading["planning_only"])
        self.assertIsNone(self.reading["feature_verdict"])

    def test_operator_routes_to_real_sources_without_altering_governance(self):
        skill = (ROOT / "skills/suite-operator/SKILL.md").read_text(encoding="utf-8")
        description = re.search(r"^description: (.+)$", skill, re.MULTILINE)
        self.assertIsNotNone(description)
        self.assertIn("existing harness", description.group(1))
        self.assertIn(SOURCE, skill)
        self.assertIn("docs/INSTALL-UPDATE-FLOW.md", skill)
        block = skill.split("<!-- caw-governance-source:start -->\n", 1)[1]
        block = block.split("<!-- caw-governance-source:end -->", 1)[0]
        self.assertEqual(hashlib.sha256(block.encode("utf-8")).hexdigest(),
                         "7aa3005900612ee79323bf61b466ed25e36ee5427649b1b53953a8a53983cd61")
        guide = (ROOT / "docs/SUITE-OPERATOR-SKILLSET.md").read_text(encoding="utf-8")
        self.assertIn("three O:I-owned Skills", guide)
        manifest = (ROOT / "skills/suite-operator/skillset.toml").read_text(encoding="utf-8")
        # Owner ruling 2026-09-17: O:I holds and projects the Central session
        # strap itself, so the guardian manifest ships central-session-strap.
        self.assertIn('skill_ref = "oi:skill:central-session-strap"', manifest)


if __name__ == "__main__":
    unittest.main()
