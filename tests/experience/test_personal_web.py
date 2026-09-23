"""Additional #65 source coverage; compilation does not establish UX acceptance."""
from pathlib import Path
import importlib.util
import json
import shutil
import tempfile
import unittest
ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("personal_web_experience", ROOT / "scripts/experience_map.py")
assert spec and spec.loader
em = importlib.util.module_from_spec(spec)
spec.loader.exec_module(em)

class PersonalWebTests(unittest.TestCase):
    def test_additive_source_preserves_every_inherited_story_and_obligation(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            shutil.copytree(ROOT / "docs/experience", root / "docs/experience")
            shutil.copytree(ROOT / "docs/cradle", root / "docs/cradle")
            # The declared executable-test relation is a source dependency too.
            config = json.loads((ROOT / "docs/experience/campaign.json").read_text())
            bindings = config.get("executable_test_bindings") or {}
            if bindings.get("path"):
                target = root / bindings["path"]
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(ROOT / bindings["path"], target)
            current = em.load_sources(root)
            config_path = root / "docs/experience/campaign.json"
            config = json.loads(config_path.read_text())
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
