import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("experience_map", ROOT / "scripts/experience_map.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class AdaptiveWikiSource(unittest.TestCase):
    def setUp(self):
        self.reading = module.load_sources(ROOT)
    def test_all_adaptive_obligations_are_compiled_into_existing_stories(self):
        obligations = {o["id"]: o for o in self.reading["inherited_obligations"]}
        for n in range(1, 9):
            item = obligations[f"adaptive65:AP{n:02}"]
            self.assertTrue(item["story_ids"])
            self.assertEqual(item["mapping_status"], "specified-not-exercised")
        for n in range(1, 16):
            self.assertIn(f"wc65:WC{n:02}", obligations)
    def test_complete_interaction_text_is_in_the_hashed_source_reading(self):
        source = self.reading["source_documents"]["docs/experience/WIKI-CONSTELLATION-UX.md"]
        for text in ["Use this correction", "root meta-project", "bkmr", "ripgrep", "AP08"]:
            self.assertIn(text, source["text"])
        self.assertTrue(source["digest"].startswith("sha256:"))
    def test_extension_does_not_confer_runtime_or_human_acceptance(self):
        self.assertIsNone(self.reading["feature_verdict"])
        for story in self.reading["stories"]:
            if any(o["id"].startswith("adaptive65:") for o in story["extensions"]["inherited_obligations"]):
                self.assertEqual(story["extensions"]["runtime_readiness"], "not-assessed")
                self.assertIsNone(story["extensions"]["human_experience"])
    def test_original_and_new_walks_are_retained(self):
        text = (ROOT / ".wayfinder/maps/wiki-constellation-development.md").read_text()
        for n in range(1, 26):
            self.assertIn(f"WCT{n:02}", text)

if __name__ == "__main__":
    unittest.main()
