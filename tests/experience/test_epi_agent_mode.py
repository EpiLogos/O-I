"""Source/compiler regressions, not live Prime/QL, model or installed-mode proof."""
from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "experience_map_epi_agent_test", ROOT / "scripts/experience_map.py"
)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
SOURCE = "docs/experience/EPI-LOGOS-AGENT-MODE.md"
CARRIER = "docs/experience/vak-expression-craft.json"
CLAUSES = {
    "lean-language": "constitution",
    "first-source-stamp": "basis",
    "real-participants": "children",
    "live-faculties": "faculties",
    "curated-invocation": "selection",
    "performed-return": "learning",
    "joined-experience": "lifecycle",
}


class EpiAgentModeSourceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.reading = MODULE.load_sources(ROOT)
        cls.carrier = json.loads((ROOT / CARRIER).read_text(encoding="utf-8"))

    def copy_sources(self, target: Path) -> None:
        # The compiler declares exactly what it read; do not copy the whole repo.
        for relative, source in self.reading["source_documents"].items():
            path = target / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(source["text"], encoding="utf-8")

    def assert_connected(self, reading) -> None:
        self.assertIn(SOURCE, reading["source_documents"])
        attached = [
            obligation
            for story in reading["stories"]
            for obligation in story["extensions"]["inherited_obligations"]
        ]
        for suffix, marker in CLAUSES.items():
            rows = [o for o in attached if o["id"] == "vakcraft65:" + suffix]
            self.assertTrue(rows, suffix)
            for row in rows:
                self.assertEqual(row["source_basis"]["agent_mode_source"], SOURCE)
                self.assertTrue(any(
                    branch.startswith("EPI-MODE/" + marker + ":")
                    for branch in row["required_branches"]
                ), suffix)
                self.assertEqual(row["mapping_status"], "specified-not-exercised")

    def test_complete_mode_source_and_digest_reach_the_existing_compiler(self):
        self.assertEqual(self.carrier["document_operations_source"], SOURCE)
        data = (ROOT / SOURCE).read_bytes()
        actual = self.reading["source_documents"][SOURCE]
        self.assertEqual(actual["text"], data.decode("utf-8"))
        self.assertEqual(actual["digest"], "sha256:" + hashlib.sha256(data).hexdigest())
        self.assert_connected(self.reading)

    def test_containing_body_is_distinct_from_all_six_explicit_faculties(self):
        mode = self.carrier["epi_agent_mode"]
        self.assertEqual(mode["containing_level"], "#0/1")
        self.assertEqual(mode["faculty_levels"], [f"#{i}" for i in range(6)])
        self.assertNotIn(mode["containing_level"], mode["faculty_levels"])
        self.assertIn("109-node", mode["ground_faculty"])
        self.assertIn("EBM", mode["ground_faculty"])
        self.assertEqual(mode["sprime_organs"], {"S4′": "Anima", "S5′": "Aletheia"})
        self.assertEqual(mode["domain_identities"], {"M4/M4′": "Nara", "M5/M5′": "Epii"})
        self.assertEqual(mode["comparison_arities"], [4, 6, 8, 12])

    def test_mode_default_does_not_claim_activation_or_global_takeover(self):
        mode = self.carrier["epi_agent_mode"]
        self.assertEqual(mode["host_modes"], ["Expressions", "Technē"])
        self.assertTrue(mode["default_on_explicit_mode_selection"])
        self.assertTrue(mode["user_override_preserved"])
        for key in ("global_default_change", "silent_generic_fallback",
                    "selected_is_effective", "runtime_implemented_by_publication"):
            with self.subTest(key=key):
                self.assertFalse(mode[key])
        self.assertIsNone(mode["native_profile_ref"])
        self.assertEqual(mode["execution_evidence"], [])
        self.assertIsNone(mode["human_assessment"])
        self.assertTrue(self.reading["planning_only"])
        self.assertIsNone(self.reading["feature_verdict"])

    def test_existing_seven_obligations_and_ordinary_factory_are_preserved(self):
        expected = {"vakcraft65:" + name for name in CLAUSES}
        self.assertEqual(set(self.carrier["required_obligation_ids"]), expected)
        self.assertEqual({o["id"] for o in self.carrier["obligations"]}, expected)
        self.assertEqual(self.carrier["families"], [])
        for key in ("requires_ql", "requires_epi_roles", "requires_claude", "requires_dsh"):
            self.assertFalse(self.carrier["factory_native_authoring"][key])
        hosted = next(f for f in self.reading["config"]["installation_composition"]["forms"]
                      if f["id"] == "CF7")
        self.assertFalse(hosted["visitor_agent_or_api_key_required"])
        self.assertFalse(hosted["requires_local_install"])

    def test_source_owners_survive_actual_story_projection(self):
        self.assert_connected(self.reading)
        rows = [o for o in self.reading["inherited_obligations"]
                if o["id"] in {"vakcraft65:" + name for name in CLAUSES}]
        for row in rows:
            with self.subTest(obligation=row["id"]):
                basis = row["source_basis"]
                self.assertEqual(basis["agent_body_issue"],
                                 "https://github.com/EpiLogos/Actuation/issues/107")
                self.assertEqual(basis["agent_domain_issue"],
                                 "https://github.com/EpiLogos/QL-MEF/issues/201")
                self.assertIn("/Actuation/", basis["agent_body_source"])
                self.assertIn("/QL-MEF/", basis["agent_domain_source"])
                self.assertEqual(basis["factory_authority"],
                                 "https://github.com/EpiLogos/Factory/blob/main/docs/program/NATIVE-WORKFLOW-AUTHORING.md")

    def test_parallel_lane_reuses_current_tree_without_blocking_general_preparation(self):
        policy = self.carrier["execution_policy"]
        self.assertTrue(policy["may_use_existing_main_feature_tree"])
        self.assertTrue(policy["preserves_foundation_before_broad_fanout"])
        for key in ("per_agent_worktree", "new_worktree_required",
                    "blocks_general_jev_redis_first_use", "start_workers_on_publication",
                    "live_machine_change_by_publication", "mathematical_kernel_change"):
            with self.subTest(key=key):
                self.assertFalse(policy[key])
        self.assertEqual(policy["worktree_unit"], "coherent-feature-line")

    def test_missing_declared_mode_source_is_not_silently_ignored(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.copy_sources(root)
            (root / SOURCE).unlink()
            with self.assertRaises(FileNotFoundError):
                MODULE.load_sources(root)

    def test_changed_mode_source_changes_the_compiled_reading_basis(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.copy_sources(root)
            with (root / SOURCE).open("a", encoding="utf-8") as stream:
                stream.write("\nControlled source-change specimen.\n")
            changed = MODULE.load_sources(root)
            self.assertNotEqual(changed["source_basis"][SOURCE], self.reading["source_basis"][SOURCE])
            self.assertNotEqual(changed["reading_digest"], self.reading["reading_digest"])

    def test_disconnected_source_or_dropped_branch_fails_the_connection_check(self):
        for fault in ("source", "branch"):
            with self.subTest(fault=fault), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                self.copy_sources(root)
                carrier = json.loads((root / CARRIER).read_text(encoding="utf-8"))
                if fault == "source":
                    carrier.pop("document_operations_source")
                else:
                    obligation = next(o for o in carrier["obligations"]
                                      if o["id"] == "vakcraft65:joined-experience")
                    obligation["required_branches"] = [
                        b for b in obligation["required_branches"]
                        if not b.startswith("EPI-MODE/lifecycle:")
                    ]
                (root / CARRIER).write_text(json.dumps(carrier), encoding="utf-8")
                with self.assertRaises(AssertionError):
                    self.assert_connected(MODULE.load_sources(root))


if __name__ == "__main__":
    unittest.main()
