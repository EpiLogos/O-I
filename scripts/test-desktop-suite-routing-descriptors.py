#!/usr/bin/env python3
"""Fixture-only tests of the local routing probe's descriptor selection.

These do not execute or certify the real-owner/local-machine routing campaign.
Native process/install evidence is in cli/tests/descriptor_entries.rs.
"""
import copy
import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("routing", ROOT / "scripts/test-desktop-suite-routing.py")
routing = importlib.util.module_from_spec(spec)
spec.loader.exec_module(routing)


class DescriptorBindings(unittest.TestCase):
    def setUp(self):
        surfaces = json.loads((ROOT / "surfaces.json").read_text())["surfaces"]
        self.catalogue = {"products": [dict(surface["native"], id=surface["id"]) for surface in surfaces]}
        self.work = Path("/controlled/Work")

    def actuation(self, catalogue):
        return next(product for product in catalogue["products"] if product["id"] == "actuation")

    def selected(self, catalogue, environ=None):
        bindings = routing.owner_bindings(catalogue, self.work, environ or {})
        return next(row for row in bindings if row[1] == "OI_ACTUATION_BIN")

    def test_script_and_rust_entries_follow_the_descriptor_not_a_language_default(self):
        for entry, build in [
            ("bin/actuation", []),
            ("scripts/native-entry", []),
            ("target/release/actuation", ["cargo", "build", "--release"]),
            ("custom-output/declared-entry", ["cargo", "build", "--target-dir", "custom-output"]),
        ]:
            with self.subTest(entry=entry):
                catalogue = copy.deepcopy(self.catalogue)
                self.actuation(catalogue)["source_install"] = {"executable_path": entry, "build": build}
                self.assertEqual(self.selected(catalogue)[2], self.work / "Actuation" / entry)

    def test_explicit_owner_override_is_preserved(self):
        override = "/controlled/existing/install/actuation"
        self.assertEqual(self.selected(self.catalogue, {"OI_ACTUATION_BIN": override})[2], Path(override))

    def test_empty_override_uses_the_published_entry(self):
        self.assertEqual(self.selected(self.catalogue, {"OI_ACTUATION_BIN": ""}), self.selected(self.catalogue))

    def test_native_namespace_is_read_from_the_descriptor(self):
        self.actuation(self.catalogue)["namespace"] = "fixture-owner-route"
        self.assertEqual(self.selected(self.catalogue)[0], "fixture-owner-route")

    def test_missing_entry_fails_instead_of_assuming_bin_actuation(self):
        for bad in [None, "", " "]:
            with self.subTest(entry=bad):
                self.actuation(self.catalogue)["source_install"]["executable_path"] = bad
                with self.assertRaisesRegex(ValueError, "missing native source entry"):
                    self.selected(self.catalogue)

    def test_missing_or_duplicate_owners_do_not_produce_a_partial_green_proof(self):
        for products in [self.catalogue["products"][:-1], [self.catalogue["products"][0]] * 6]:
            with self.subTest(products=len(products)):
                with self.assertRaises(ValueError):
                    routing.owner_bindings({"products": products}, self.work, {})


if __name__ == "__main__":
    unittest.main()
