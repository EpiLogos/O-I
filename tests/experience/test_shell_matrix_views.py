"""The S-whole matrix's derived surfaces stay equal to their sources (O-I #736).

The story-position view is derived from the stories; the capability-home
tables of capabilityHomes.ts are derived from the matrix. These tests hold the
checked-in files to their derivation and show the check failing on drift.
"""
from __future__ import annotations

import contextlib
import csv
import importlib.util
import io
import json
from pathlib import Path
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


def load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


views = load("shell_matrix_views", ROOT / "scripts/shell_matrix_views.py")
em = load("experience_map", ROOT / "scripts/experience_map.py")


def run(*argv: str) -> tuple[int, str]:
    err = io.StringIO()
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(err):
        code = views.main(list(argv))
    return code, err.getvalue()


def view_records(root: Path) -> list[dict]:
    with (root / views.MATRIX_CSV).open(encoding="utf-8", newline="") as stream:
        return [row for row in csv.DictReader(stream) if row["view_id"] == views.VIEW_ID]


class CheckedInSurfaces(unittest.TestCase):
    def test_the_checked_in_surfaces_equal_their_derivation(self):
        code, err = run("--root", str(ROOT), "--check")
        self.assertEqual(code, 0, err)

    def test_every_story_is_a_row_with_its_cells(self):
        stories = em.load_sources(ROOT)["stories"]
        manifest = json.loads((ROOT / views.MATRIX_JSON).read_text(encoding="utf-8"))
        view = next(v for v in manifest["views"] if v["id"] == views.VIEW_ID)
        self.assertEqual([m["id"] for m in view["row_axis"]["members"]], [s["id"] for s in stories])
        self.assertEqual([m["id"] for m in view["column_axis"]["members"]], [p[0] for p in views.POSITIONS])
        cells = {(r["row_id"], r["column_id"]) for r in view_records(ROOT)}
        for story in stories:
            required = ["p0", "p1", "p3", "p5"] + (["p2", "p4"] if "ux" in story["extensions"] else [])
            for position in required:
                self.assertIn((story["id"], position), cells, f"{story['id']} lacks its {position} cell")

    def test_capability_refs_resolve_and_absent_units_are_named(self):
        with (ROOT / views.MATRIX_CSV).open(encoding="utf-8", newline="") as stream:
            capabilities = {r["id"] for r in csv.DictReader(stream) if r["record_type"] == "capability"}
        for record in view_records(ROOT):
            refs = json.loads(record["capability_refs"])
            self.assertTrue(set(refs) <= capabilities, record["id"])
            if record["column_id"] == "p2":
                ux = json.loads(record["extensions"])["ux"]
                if not refs:
                    self.assertTrue(ux["absent_units"] or ux.get("external_capability_refs"), record["id"])
                    self.assertEqual(ux["binding_status"], "binding-required")


class Drift(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        paths = set(em.load_sources(ROOT)["source_documents"]) | {
            "scripts/experience_map.py", "scripts/shell_matrix_views.py", views.MATRIX_JSON, views.MATRIX_CSV,
            views.MANUAL, views.HOMES_TS}
        for relative in paths:
            target = self.root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / relative, target)

    def tearDown(self):
        self.temp.cleanup()

    def test_a_changed_story_fails_the_check_until_written(self):
        stories = self.root / views.STORIES
        text = stories.read_text(encoding="utf-8")
        old = "| SU03 | [Bare] I have no ground yet."
        self.assertIn(old, text)
        stories.write_text(text.replace(old, "| SU03 | [Arriving] I have no ground yet."), encoding="utf-8")
        code, err = run("--root", str(self.root), "--check")
        self.assertEqual(code, 1)
        self.assertIn(views.MATRIX_CSV, err)
        self.assertEqual(run("--root", str(self.root), "--write")[0], 0)
        self.assertEqual(run("--root", str(self.root), "--check")[0], 0)
        p4 = next(r for r in view_records(self.root) if r["id"] == "story.SU03.p4")
        self.assertEqual(json.loads(p4["extensions"])["ux"]["starting_world"], "Arriving")

    def test_a_changed_home_fails_the_check_until_the_code_is_regenerated(self):
        matrix = self.root / views.MATRIX_CSV
        text = matrix.read_text(encoding="utf-8")
        old = "Browser search, every mode"
        self.assertEqual(text.count(old), 1)
        matrix.write_text(text.replace(old, "the search line, every mode"), encoding="utf-8")
        code, err = run("--root", str(self.root), "--check")
        self.assertEqual(code, 1)
        self.assertIn(views.HOMES_TS, err)
        self.assertEqual(run("--root", str(self.root), "--write")[0], 0)
        self.assertIn("'cap.o-i.search-aperture': 'the search line, every mode',",
                      (self.root / views.HOMES_TS).read_text(encoding="utf-8"))

    def test_a_capability_homed_twice_is_refused(self):
        matrix = self.root / views.MATRIX_CSV
        text = matrix.read_text(encoding="utf-8")
        # Home the search aperture a second time, on the rooted-world navigator's row.
        old = '""ref"": ""cap.o-i.rooted-world-navigator""'
        self.assertEqual(text.count(old), 1)
        matrix.write_text(text.replace(old, '""ref"": ""cap.o-i.search-aperture""'), encoding="utf-8")
        code, err = run("--root", str(self.root), "--check")
        self.assertEqual(code, 1)
        self.assertIn("cap.o-i.search-aperture", err)
        self.assertRegex(err, "homed twice|has its own row")


if __name__ == "__main__":
    unittest.main()
