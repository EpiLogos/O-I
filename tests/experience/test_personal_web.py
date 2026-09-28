"""Additional #65 source coverage; compilation does not establish UX acceptance."""
from pathlib import Path
import importlib.util
import json
import tempfile
import unittest
ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("personal_web_experience", ROOT / "scripts/experience_map.py")
assert spec and spec.loader
em = importlib.util.module_from_spec(spec)
spec.loader.exec_module(em)

class PersonalWebTests(unittest.TestCase):
    def test_additive_source_preserves_every_inherited_story_and_obligation(self):
        # Reproduce the complete declared source field, including module
        # dependencies outside docs/experience and docs/cradle.
        complete = em.load_sources(ROOT)
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for relative, source in complete["source_documents"].items():
                target = root / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(source["text"], encoding="utf-8")
            config_path = root / "docs/experience/campaign.json"
            config = json.loads(config_path.read_text())
            # This test compares the original Personal-Web addition with its
            # preceding field. The later shared-world extension deliberately
            # depends on PW stories, so exclude it from BOTH sides of this
            # historical comparison. Its full integrated propagation is tested
            # separately by test_shared_field_world_participation.py.
            config["source_modules"].remove(
                "docs/experience/shared-field-world-participation.json"
            )
            config_path.write_text(json.dumps(config))
            current = em.load_sources(root)
            config["source_modules"].remove("docs/experience/personal-web.json")
            config_path.write_text(json.dumps(config))
            before = em.load_sources(root)
            old = {s["id"]: s for s in before["stories"]}
            now = {s["id"]: s for s in current["stories"]}
            self.assertEqual(len(old), 114)
            self.assertEqual(set(now) - set(old), {f"PW{i:02}" for i in range(1,13)})
            for key, value in old.items():
                self.assertEqual(now[key], value)
            self.assertEqual(current["inherited_obligations"], before["inherited_obligations"])
            self.assertEqual(len([o for o in current["inherited_obligations"] if o["source_module"] == "docs/experience/developer-field.json"]), 56)

    def test_new_stories_retain_source_and_no_fabricated_acceptance(self):
        result = em.load_sources(ROOT)
        for story in result["stories"]:
            if not story["id"].startswith("PW"):
                continue
            self.assertEqual(story["extensions"]["source_locator"]["path"], "docs/experience/PERSONAL-WEB.md")
            self.assertEqual(story["extensions"]["runtime_readiness"], "not-assessed")
            self.assertIsNone(story["extensions"]["human_experience"])
        self.assertIsNone(result["feature_verdict"])

    def test_full_feature_contract_is_retained_as_source_not_only_table_rows(self):
        result = em.load_sources(ROOT)
        doc = (ROOT / "docs/cradle/PERSONAL-WEB.md").read_text()
        for exact in ["Beings", "Things", "C0/C5", "Full portable copy", "PW6", "5654421849"]:
            self.assertIn(exact, doc)
        self.assertIn("seventh", doc)

if __name__ == "__main__":
    unittest.main()
