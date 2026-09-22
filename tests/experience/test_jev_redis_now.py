"""Source/projection checks only; not Jev, Redis or Factory runtime acceptance."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
NOTE = "docs/experience/JEV-REDIS-NOW-INTEGRATION.md"
MODULE = "docs/experience/session-grounding.json"
SPEC = importlib.util.spec_from_file_location("jev_redis_experience_map", ROOT / "scripts/experience_map.py")
assert SPEC is not None and SPEC.loader is not None
EXPERIENCE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(EXPERIENCE)

# Retain the original September 16 obligation identities and their story links.
# Later additions are allowed; a new source count is never an execution verdict.
ORIGINAL_STORIES = {
    "source-place": {"TM01", "TM02", "AG01", "MC01", "DV02"},
    "identity": {"TM02", "AG06", "DV05", "WK04"},
    "census": {"TM03", "WK04", "MC03", "MC07"},
    "provider": {"TM02", "TM06", "TM08", "AG09"},
    "composition": {"AG03", "AG04", "PX02", "PX03", "PX04", "PX06", "TM01"},
    "authority-delivery": {"AG07", "AG08", "GW06", "GW09", "DV01", "TM03"},
    "recovery": {"AG06", "AG09", "GW05", "GW07", "MC06", "DV04"},
    "remote": {"MC02", "MC04", "MC08", "GW08", "TM09"},
    "guardians": {"AG01", "AG02", "AG05", "AG08", "TM01", "TM03"},
    "factory-return": {"DV01", "DV02", "DV03", "DV04", "WR05", "WR06", "TM05"},
    "presence": {"UI02", "UI04", "UI05", "TM07", "TM09", "GW05"},
    "joined": {"DV08", "TM03", "TM10", "MC06", "GW08"},
}


def require_integration_source(reading: dict) -> None:
    """A declared source note must really enter the existing compiler reading."""
    modules = [m for m in reading["source_modules"] if m["source_module_path"] == MODULE]
    if len(modules) != 1 or modules[0].get("document_operations_source") != NOTE:
        raise ValueError("Jev/Redis note disconnected from session-grounding")
    if NOTE not in reading["source_documents"] or NOTE not in reading["source_basis"]:
        raise ValueError("Jev/Redis source body or basis missing")


class JevRedisNowSourceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.reading = EXPERIENCE.load_sources(ROOT)
        cls.module = json.loads((ROOT / MODULE).read_text(encoding="utf-8"))

    def copy_source_cut(self, target: Path) -> None:
        # Copy exactly the source files actually consumed by the compiler.
        for relative in self.reading["source_documents"]:
            destination = target / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes((ROOT / relative).read_bytes())

    def test_note_body_and_digest_are_in_the_live_compiler(self) -> None:
        require_integration_source(self.reading)
        data = (ROOT / NOTE).read_bytes()
        self.assertEqual(self.reading["source_documents"][NOTE]["text"], data.decode("utf-8"))
        self.assertEqual(self.reading["source_basis"][NOTE], EXPERIENCE.digest(data))
        self.assertTrue(self.reading["planning_only"])
        self.assertIsNone(self.reading["feature_verdict"])
        self.assertFalse(self.module["runtime_or_human_acceptance"])

    def test_original_obligations_and_evidence_requirements_survive(self) -> None:
        obligations = {row["id"]: row for row in self.module["obligations"]}
        for suffix, stories in ORIGINAL_STORIES.items():
            key = "grounding220:" + suffix
            with self.subTest(obligation=key):
                self.assertIn(key, self.module["required_obligation_ids"])
                self.assertTrue(stories.issubset(obligations[key]["story_ids"]))
                grades = {"C", "P", "M"}
                if suffix in {"presence", "joined"}:
                    grades.add("H")
                self.assertTrue(grades.issubset(obligations[key]["required_evidence"]))

    def test_added_branches_are_projected_to_existing_document_stories(self) -> None:
        by_id = {row["id"]: row for row in self.reading["stories"]}
        bindings = {
            "composition": {"DO01", "DO04", "DO07"},
            "recovery": {"DO08"},
            "factory-return": {"DO03", "DO05", "DO07", "DO08"},
            "joined": {"DO01", "DO03", "DO04", "DO05", "DO07", "DO08"},
        }
        source = {row["id"]: row for row in self.module["obligations"]}
        for suffix, stories in bindings.items():
            key = "grounding220:" + suffix
            for story in stories:
                with self.subTest(story=story, obligation=key):
                    inherited = {row["id"]: row for row in by_id[story]["extensions"]["inherited_obligations"]}
                    self.assertIn(key, inherited)
                    self.assertEqual(inherited[key]["required_branches"], source[key]["required_branches"])
                    self.assertTrue(any("Redis" in branch for branch in inherited[key]["required_branches"]))
                    self.assertEqual(inherited[key]["mapping_status"], "specified-not-exercised")

    def test_editing_note_changes_reading_basis_without_inventing_a_verdict(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.copy_source_cut(root)
            before = EXPERIENCE.load_sources(root)
            with (root / NOTE).open("a", encoding="utf-8") as stream:
                stream.write("\nSource-check mutation: changed planning basis.\n")
            after = EXPERIENCE.load_sources(root)
            self.assertNotEqual(before["reading_digest"], after["reading_digest"])
            self.assertNotEqual(before["source_basis"][NOTE], after["source_basis"][NOTE])
            self.assertEqual(before["source_digest"], after["source_digest"])
            self.assertIsNone(after["feature_verdict"])

    def test_missing_declared_note_fails_source_loading(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.copy_source_cut(root)
            (root / NOTE).unlink()
            with self.assertRaises(FileNotFoundError):
                EXPERIENCE.load_sources(root)

    def test_disconnected_note_is_detected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.copy_source_cut(root)
            module = json.loads((root / MODULE).read_text(encoding="utf-8"))
            module.pop("document_operations_source")
            (root / MODULE).write_text(json.dumps(module), encoding="utf-8")
            disconnected = EXPERIENCE.load_sources(root)
            with self.assertRaisesRegex(ValueError, "disconnected"):
                require_integration_source(disconnected)


if __name__ == "__main__":
    unittest.main()
