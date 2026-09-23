"""Source relation tests; no terminal, Telegram, model or human trial is simulated."""
from __future__ import annotations

import copy
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("developer_experience_map", ROOT / "scripts/experience_map.py")
assert SPEC and SPEC.loader
em = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(em)


class DeveloperFieldTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        shutil.copytree(ROOT / "docs/experience", self.root / "docs/experience")
        # Modules may declare public contracts outside the experience directory.
        # Copy the declared dependencies without making missing sources optional.
        config = json.loads((self.root / "docs/experience/campaign.json").read_text())
        for module_path in config.get("source_modules", []):
            module = json.loads(em.source_path(ROOT, module_path).read_text())
            for key in ("story_source", "document_operations_source"):
                relative = module.get(key)
                if relative:
                    target = em.source_path(self.root, relative)
                    if not target.exists():
                        target.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copy2(em.source_path(ROOT, relative), target)
        # The declared executable-test relation is a source dependency too.
        bindings = config.get("executable_test_bindings") or {}
        if bindings.get("path"):
            target = self.root / bindings["path"]
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(em.source_path(ROOT, bindings["path"]), target)
        self.module_path = self.root / "docs/experience/developer-field.json"

    def tearDown(self):
        self.temp.cleanup()

    def change_module(self, change):
        module = json.loads(self.module_path.read_text())
        change(module)
        self.module_path.write_text(json.dumps(module))

    def test_original_tui_journeys_and_physical_cases_are_individually_mapped(self):
        result = em.load_sources(self.root)
        self.assertIn("docs/experience/developer-field.json", result["source_config"]["source_modules"])
        ids = {o["id"] for o in result["inherited_obligations"]}
        expected = {f"tui:21:{letter}" for letter in "ABCDEFGH"} | {f"tui:22:{i:02}" for i in range(1, 15)}
        self.assertEqual({key for key in ids if key.startswith("tui:")}, expected)
        self.assertEqual({key for key in ids if key.startswith("gateway:")}, {f"gateway:{x}" for x in "ABCDEFG"})
        self.assertEqual({key for key in ids if key.startswith("alpha:")}, {f"alpha:{x}" for x in "ABCDEFGHI"})
        self.assertTrue({"oi97:source-cut", "oi97:protected-ground", "oi97:reference-world", "oi97:real-development"}.issubset(ids))
        self.assertTrue({"sdk:provider", "sdk:harness", "sdk:surface", "sdk:workcell", "sdk:package", "sdk:model", "sdk:platform-page", "sdk:connector"}.issubset(ids))

    def test_dropped_obligation_or_unknown_story_cannot_pass(self):
        original = self.module_path.read_bytes()
        self.change_module(lambda m: m["obligations"].pop())
        with self.assertRaisesRegex(ValueError, "obligation coverage"):
            em.load_sources(self.root)
        self.module_path.write_bytes(original)
        self.change_module(lambda m: m["obligations"][0]["story_ids"].append("TM99"))
        with self.assertRaisesRegex(ValueError, "unknown/duplicate/empty"):
            em.load_sources(self.root)

    def test_duplicate_module_and_source_escape_fail(self):
        config_path = self.root / "docs/experience/campaign.json"
        config = json.loads(config_path.read_text())
        config["source_modules"].append(config["source_modules"][0])
        config_path.write_text(json.dumps(config))
        with self.assertRaisesRegex(ValueError, "duplicate source module"):
            em.load_sources(self.root)
        config["source_modules"] = ["../private.json"]
        config_path.write_text(json.dumps(config))
        with self.assertRaisesRegex(ValueError, "escapes"):
            em.load_sources(self.root)

    def test_missing_declared_document_source_does_not_silently_degrade(self):
        (self.root / "docs/experience/DOCUMENT-OPERATIONS.md").unlink()
        with self.assertRaises(OSError):
            em.load_sources(self.root)

    def test_actual_source_module_digest_and_family_prose_are_retained(self):
        before = em.load_sources(self.root)
        path = self.root / "docs/experience/DEVELOPER-FIELD.md"
        path.write_text(path.read_text() + "\nA newly authored family qualification must survive.\n")
        after = em.load_sources(self.root)
        self.assertNotEqual(before["reading_digest"], after["reading_digest"])
        self.assertEqual(before["source_digest"], after["source_digest"])
        self.assertIn("newly authored family qualification", after["source_documents"]["docs/experience/DEVELOPER-FIELD.md"]["text"])
        story = next(s for s in after["stories"] if s["id"] == "GW02")
        self.assertEqual(story["extensions"]["source_locator"]["digest"], em.digest(path.read_bytes()))

    def test_unknown_source_metadata_and_explicit_new_story_survive(self):
        self.change_module(lambda m: m.update(future_annotation={"retain": ["a", {"b": True}]}))
        self.change_module(lambda m: m["families"][0].update(future_family={"standing": "not adopted"}))
        self.change_module(lambda m: m["families"][0]["ids"].append("TM11"))
        path = self.root / "docs/experience/DEVELOPER-FIELD.md"
        path.write_text(path.read_text() + "\n| TM11 | An additional native host task. | P01/P10: preserve context. | Real supported result. | A denied act stays denied. |\n")
        result = em.load_sources(self.root)
        self.assertEqual(result["source_modules"][0]["future_annotation"], {"retain": ["a", {"b": True}]})
        story = next(s for s in result["stories"] if s["id"] == "TM11")
        self.assertEqual(story["extensions"]["source_family"]["future_family"], {"standing": "not adopted"})

    def test_candidates_do_not_become_bound_native_capabilities_or_adopted_vision(self):
        result = em.load_sources(self.root)
        self.assertTrue(result["capability_candidates"])
        self.assertEqual(result["capability_inventory"], [])
        self.assertEqual(result["capability_bindings"], [])
        self.assertIsNone(result["feature_verdict"])
        for story in result["stories"]:
            extensions = story["extensions"]
            self.assertEqual(extensions["document_role"]["tier"], 1)
            self.assertEqual(extensions["document_role"]["adoption"], "not-conferred-by-projection")
            self.assertEqual(extensions["agent_ux"]["capability_requirements"]["native_refs"], [])
            self.assertEqual(extensions["runtime_readiness"], "not-assessed")
            self.assertIsNone(extensions["human_experience"])

    def test_both_native_matrix_views_retain_source_locators_and_full_requirements(self):
        result = em.load_sources(self.root)
        manifest, rows = em.relation_projection(result)
        self.assertEqual({v["id"] for v in manifest["views"]}, {"story-practice", "story-obligation"})
        self.assertEqual(manifest["protocol"], "ql-capability-matrix/1")
        requirements = {o["id"]: o for o in result["inherited_obligations"]}
        represented = set()
        for row in rows:
            self.assertEqual(row["record_type"], "relation")
            self.assertEqual(json.loads(row["capability_refs"]), [])
            self.assertEqual(row["coverage"], "unexercised")
            if row["view_id"] == "story-obligation":
                represented.add(row["column_id"])
                value = json.loads(row["extensions"])["ux"]
                self.assertEqual(value["existing_proof_refs"], [requirements[row["column_id"]]])
                self.assertEqual(value["evidence"], [])
        self.assertEqual(represented, set(requirements))

    def test_invalid_batch_does_not_partially_apply_valid_binding(self):
        result = em.load_sources(self.root)
        result["capability_inventory"] = [{"repository": "Test/Native", "capability_id": "cap.test", "source_digest": "sha256:actual", "coverage_disposition": "uncovered"}]
        valid = {"repository": "Test/Native", "capability_id": "cap.test", "source_digest": "sha256:actual", "disposition": "direct", "story_ids": ["GW02"]}
        invalid = dict(valid, source_digest="sha256:stale")
        before = copy.deepcopy(result)
        with self.assertRaisesRegex(ValueError, "stale native"):
            em.apply_bindings(result, [valid, invalid])
        self.assertEqual(result, before)


if __name__ == "__main__":
    unittest.main()
