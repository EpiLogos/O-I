"""Regressions against Central's native CSV reference contract, not runtime proof.

source_refs/code_refs/test_refs are semicolon lists; capability_refs is JSON.
Each named view retains the exact source/proof basis of the relation it asserts.
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
        obligations = {o["id"]: o for o in result["inherited_obligations"]}
        text = io.StringIO()
        writer = csv.DictWriter(text, fieldnames=em.COLUMNS)
        writer.writeheader()
        writer.writerows(rows)
        text.seek(0)
        for row in csv.DictReader(text):
            extension = json.loads(row["extensions"])["ux"]
            story = stories[extension["story_ref"]]
            if row["view_id"] == "story-practice":
                self.assertEqual(row["source_refs"].split(";"), story["source_refs"])
                self.assertEqual(row["test_refs"].split(";"), story["extensions"]["existing_proof_refs"])
            else:
                self.assertEqual(row["view_id"], "story-obligation")
                obligation = obligations[row["column_id"]]
                self.assertEqual(row["source_refs"].split(";"), [
                    story["extensions"]["source_locator"]["path"], obligation["source_basis"]["source_ref"]])
                self.assertEqual(row["test_refs"].split(";"), [obligation["id"]])
                self.assertEqual(extension["existing_proof_refs"], [obligation])
            self.assertEqual(json.loads(row["capability_refs"]), [])
            self.assertEqual(row["code_refs"], "")
            self.assertEqual(row["account_ref"], story["extensions"]["source_locator"]["path"])

    def test_source_path_cannot_escape_the_named_repository(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "repo"
            root.mkdir()
            with self.assertRaisesRegex(ValueError, "escapes"):
                em.source_path(root, "../private.txt")
            with self.assertRaisesRegex(ValueError, "escapes"):
                em.source_path(root, str(Path(directory) / "absolute.txt"))
            # source_path resolves its basis (the guard is against escape, not
            # against symlinked parents such as macOS /tmp -> /private/tmp).
            self.assertEqual(em.source_path(root, "docs/source.md"), (root / "docs/source.md").resolve())


if __name__ == "__main__":
    unittest.main()
