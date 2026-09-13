"""Regressions against Central's native CSV reference contract, not runtime proof.

Source: EpiLogos/Central docs/CAPABILITY-MATRIX-PROTOCOL.md, CSV records.
source_refs/code_refs/test_refs are semicolon lists; capability_refs is JSON.
"""
from pathlib import Path
import csv
import importlib.util
import io
import json
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("experience_map_ref_test", ROOT / "scripts/experience_map.py")
assert spec and spec.loader
em = importlib.util.module_from_spec(spec)
spec.loader.exec_module(em)


class NativeReferenceFidelity(unittest.TestCase):
    def test_csv_source_and_proof_refs_use_the_native_semicolon_grammar(self):
        result = em.load_sources(ROOT)
        _, rows = em.relation_projection(result)
        stories = {s["id"]: s for s in result["stories"]}
        text = io.StringIO()
        writer = csv.DictWriter(text, fieldnames=em.COLUMNS)
        writer.writeheader()
        writer.writerows(rows)
        text.seek(0)
        for row in csv.DictReader(text):
            extension = json.loads(row["extensions"])["ux"]
            story = stories[extension["story_ref"]]
            self.assertEqual(row["source_refs"].split(";"), story["source_refs"])
            self.assertEqual(row["test_refs"].split(";"), story["extensions"]["existing_proof_refs"])
            self.assertEqual(json.loads(row["capability_refs"]), [])
            self.assertEqual(row["code_refs"], "")

    def test_source_path_cannot_escape_the_named_repository(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            root.mkdir()
            with self.assertRaisesRegex(ValueError, "escapes"):
                em.source_path(root, "../private.txt")
            with self.assertRaisesRegex(ValueError, "escapes"):
                em.source_path(root, str(Path(directory) / "absolute.txt"))
            self.assertEqual(em.source_path(root, "docs/source.md"), root / "docs/source.md")


if __name__ == "__main__":
    unittest.main()
