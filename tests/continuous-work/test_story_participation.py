"""Planning form/link checks only; these tests do not prove any user story."""
from __future__ import annotations

import copy
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("caw_story_map", ROOT / "scripts/caw_story_map.py")
assert SPEC is not None and SPEC.loader is not None
MAP = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MAP
SPEC.loader.exec_module(MAP)


class StoryParticipationSourceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.text = (ROOT / "docs/ux/EXISTING-WORK-STORIES.md").read_text(encoding="utf-8")
        cls.bindings = json.loads((ROOT / "docs/ux/participation-bindings.json").read_text(encoding="utf-8"))
        cls.rows = MAP.story_rows(cls.text)

    def test_all_authored_children_have_paired_participation(self) -> None:
        assigned = MAP.validate_bindings(self.rows, self.bindings)
        self.assertEqual(85, len(self.rows))
        self.assertEqual(16, len(self.bindings["families"]))
        self.assertEqual({r["id"] for r in self.rows}, set(assigned))
        for row in self.rows:
            self.assertTrue(row["entry_state"])
            self.assertTrue(row["agent_work"])
            self.assertTrue(row["outcome"])
            self.assertTrue(row["branch"])

    def test_removed_family_is_not_a_green_subset(self) -> None:
        damaged = copy.deepcopy(self.bindings)
        damaged["families"].pop()
        with self.assertRaisesRegex(ValueError, "without participation"):
            MAP.validate_bindings(self.rows, damaged)

    def test_duplicate_binding_is_rejected(self) -> None:
        damaged = copy.deepcopy(self.bindings)
        damaged["families"][1]["stories"].append(damaged["families"][0]["stories"][0])
        with self.assertRaisesRegex(ValueError, "multiply bound"):
            MAP.validate_bindings(self.rows, damaged)

    def test_nonexistent_story_is_rejected(self) -> None:
        damaged = copy.deepcopy(self.bindings)
        damaged["families"][0]["stories"].append("ux.oi.not-authored")
        with self.assertRaisesRegex(ValueError, "absent or multiply"):
            MAP.validate_bindings(self.rows, damaged)

    def test_missing_context_or_practice_stays_a_gap(self) -> None:
        for field in ("context_required", "conditions", "practice_sources", "acceptance_refs"):
            damaged = copy.deepcopy(self.bindings)
            damaged["families"][0][field] = []
            with self.subTest(field=field), self.assertRaises(ValueError):
                MAP.validate_bindings(self.rows, damaged)

    def test_unknown_native_owner_or_practice_is_rejected(self) -> None:
        for field, value in (("capability_candidates", "cap.invented.operation"), ("practice_sources", "unregistered-practice")):
            damaged = copy.deepcopy(self.bindings)
            damaged["families"][0][field].append(value)
            with self.subTest(field=field), self.assertRaises(ValueError):
                MAP.validate_bindings(self.rows, damaged)

    def test_source_map_cannot_insert_execution_or_runtime_claim(self) -> None:
        for key, value in (("runtime_support_claimed", True), ("executed_story_results", [{"passed": True}])):
            damaged = copy.deepcopy(self.bindings)
            damaged[key] = value
            with self.subTest(key=key), self.assertRaisesRegex(ValueError, "cannot claim"):
                MAP.validate_bindings(self.rows, damaged)

    def test_compilation_preserves_source_human_and_agent_fields_without_pass(self) -> None:
        reading = MAP.compile_map(ROOT)
        self.assertEqual(85, reading["story_count"])
        self.assertIsNone(reading["whole_feature_verdict"])
        self.assertEqual(64, len(reading["source_sha256"]))
        self.assertTrue(reading["capability_identity_check"]["unresolved_identity_refs"])
        self.assertFalse(reading["capability_identity_check"]["meaning_or_implementation_verified"])
        for story in reading["stories"]:
            for field in ("id", "kind", "parent_ref", "actor", "story", "entry_state", "act", "experienced_outcome", "return_state", "branch_condition", "surface_refs", "source_refs", "standing", "extensions"):
                self.assertIn(field, story)
            self.assertEqual([], story["extensions"]["participation"]["trial_results"])
            self.assertEqual([], story["extensions"]["participation"]["human_ex_refs"])
            self.assertTrue(story["extensions"]["participation"]["agent_work"])

    def test_derived_matrix_uses_existing_protocol_and_only_native_reference_relations(self) -> None:
        manifest, rows = MAP.matrix_files(MAP.compile_map(ROOT))
        self.assertEqual("ql-capability-matrix/1", manifest["protocol"])
        self.assertNotIn("shape_ref", manifest["views"][0])
        self.assertEqual(85, len(manifest["views"][0]["row_axis"]["members"]))
        self.assertEqual(len(rows), len({r["id"] for r in rows}))
        for row in rows:
            self.assertEqual(set(MAP.CORE_COLUMNS), set(row))
            self.assertEqual("relation", row["record_type"])
            self.assertEqual("unassessed", row["coverage"])
            self.assertEqual([row["column_id"]], json.loads(row["capability_refs"]))
            self.assertEqual([row["row_id"]], json.loads(row["extensions"])["ux_refs"])
        self.assertIsNone(manifest["extensions"]["whole_feature_verdict"])

    def test_supplied_native_matrix_rejects_missing_capability_identity(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "central.csv"
            path.write_text("id,record_type\ncap.central.unrelated,capability\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "does not contain capability"):
                MAP.native_capability_check(self.bindings, {"central": path})

    def test_supplied_native_matrix_checks_only_its_actual_identities(self) -> None:
        refs = sorted({cap for f in self.bindings["families"] for cap in f["capability_candidates"] if cap.startswith("cap.central.")})
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "central.csv"
            path.write_text("id,record_type\n" + "".join(f"{ref},capability\n" for ref in refs), encoding="utf-8")
            result = MAP.native_capability_check(self.bindings, {"central": path})
            self.assertEqual(refs, result["verified_identity_refs"])
            self.assertTrue(result["unresolved_identity_refs"])
            self.assertFalse(result["meaning_or_implementation_verified"])
            self.assertEqual(64, len(result["source_sha256"]["central"]))

    def test_duplicate_or_malformed_authored_row_is_rejected(self) -> None:
        line = next(line for line in self.text.splitlines() if MAP.ROW.match(line))
        with self.assertRaisesRegex(ValueError, "duplicate"):
            MAP.story_rows(line + "\n" + line)
        with self.assertRaisesRegex(ValueError, "expected five"):
            MAP.story_rows("| `ux.oi.bad` — Test | Missing columns |")

    def test_profile_examples_are_json_and_do_not_claim_execution(self) -> None:
        text = (ROOT / "docs/ux/STORY-PARTICIPATION-PROFILE.md").read_text(encoding="utf-8")
        blocks = text.split("```json\n")[1:]
        self.assertEqual(2, len(blocks))
        examples = [json.loads(block.split("```", 1)[0]) for block in blocks]
        self.assertIn("extensions", examples[0])
        self.assertIn("unresolved", examples[0]["extensions"]["participation"]["readiness"])
        self.assertEqual(["ux.oi.quiet-coding"], examples[1]["ux_refs"])

    def test_local_protocol_and_campaign_sources_exist(self) -> None:
        for name in ("EXISTING-WORK-CAMPAIGN.md", "LOCAL-CAMPAIGN-PROTOCOL.md", "STORY-PARTICIPATION-PROFILE.md"):
            self.assertTrue((ROOT / "docs/ux" / name).is_file())
        protocol = (ROOT / "docs/ux/LOCAL-CAMPAIGN-PROTOCOL.md").read_text(encoding="utf-8")
        for important in ("independent", "actor-visible", "uncertain", "assisted", "private", "usable end-to-end feature."):
            self.assertIn(important, protocol)


if __name__ == "__main__":
    unittest.main()
