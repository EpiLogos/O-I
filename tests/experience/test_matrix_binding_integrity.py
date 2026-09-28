"""Native-matrix inventory and obligation-binding integrity (source projection only).

None of these tests executes a feature; they check that the compiler refuses
misattributed inventories and unvalidated obligation/branch links, and that a
valid obligation link produces the obligation -> branch -> capability view.
"""
from __future__ import annotations

import copy
import csv
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("matrix_binding_experience_map", ROOT / "scripts/experience_map.py")
assert spec is not None and spec.loader is not None
em = importlib.util.module_from_spec(spec)
spec.loader.exec_module(em)

LEDGER = ROOT / "suite/capability-matrix.json"
CATALOGUE = ROOT / "suite/product-capabilities.csv"


class ObligationBindingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base = em.load_sources(ROOT)
        em.load_coverage(cls.base, ROOT)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        path = Path(self.temp.name) / "native.csv"
        with path.open("w", newline="") as target:
            writer = csv.DictWriter(target, fieldnames=["id", "record_type", "need"])
            writer.writeheader()
            writer.writerow({"id": "cap.native.offer", "record_type": "capability", "need": "Offer"})
            writer.writerow({"id": "cap.native.reading", "record_type": "capability", "need": "Read"})
        self.result = copy.deepcopy(self.base)
        self.result["capability_inventory"] = em.read_matrix("Example/Native", path)
        self.digest = self.result["capability_inventory"][0]["source_digest"]

    def tearDown(self):
        self.temp.cleanup()

    def binding(self, capability="cap.native.offer", **extra):
        value = {"repository": "Example/Native", "capability_id": capability, "source_digest": self.digest,
                 "disposition": "direct", "story_ids": ["MC01"], "reason": "offer projected"}
        value.update(extra)
        return value

    def test_unknown_obligation_is_rejected(self):
        with self.assertRaisesRegex(ValueError, r"unknown obligation_id 'web65:NOPE'; not declared by any loaded obligation module"):
            em.apply_bindings(self.result, [self.binding(obligation_id="web65:NOPE", branch=0)])
        self.assertEqual(self.result["capability_bindings"], [])

    def test_out_of_range_or_untyped_branch_is_rejected(self):
        for branch in (3, -1, True, "1"):
            with self.subTest(branch=branch):
                with self.assertRaisesRegex(ValueError, r"out of range for web65:WORLD \(3 required branches"):
                    em.apply_bindings(copy.deepcopy(self.result), [self.binding(obligation_id="web65:WORLD", branch=branch)])
        with self.assertRaisesRegex(ValueError, "branch requires obligation_id"):
            em.apply_bindings(self.result, [self.binding(branch=0)])

    def test_obligation_hidden_in_extensions_is_refused(self):
        hidden = self.binding(extensions={"web65": {"obligation_id": "web65:NOPE", "branch_index": 1}})
        with self.assertRaisesRegex(ValueError, r"inside extensions\.web65 is untyped and unvalidated"):
            em.apply_bindings(self.result, [hidden])

    def test_story_outside_the_obligation_is_refused(self):
        with self.assertRaisesRegex(ValueError, r"stories \['GV02'\] are not constrained by obligation web65:WORLD"):
            em.apply_bindings(self.result, [self.binding(obligation_id="web65:WORLD", branch=0, story_ids=["GV02"])])

    def test_valid_link_produces_obligation_branch_capability_view(self):
        em.apply_bindings(self.result, [
            self.binding(obligation_id="web65:WORLD", branch=0),
            self.binding("cap.native.reading", obligation_id="web65:WORLD", branch=2, story_ids=["MC01", "AG01"]),
        ])
        world = next(o for o in self.result["inherited_obligations"] if o["id"] == "web65:WORLD")
        view = world["capability_view"]
        self.assertEqual([c["capability_id"] for c in view["branches"][0]["capabilities"]], ["cap.native.offer"])
        self.assertEqual([c["capability_id"] for c in view["branches"][2]["capabilities"]], ["cap.native.reading"])
        self.assertEqual(view["branches_without_capability"], [1])
        explore = next(o for o in self.result["inherited_obligations"] if o["id"] == "web65:EXPLORE")
        self.assertNotIn("capability_view", explore)

        manifest, rows = em.relation_projection(self.result)
        self.assertIn("obligation-branch-capability", [v["id"] for v in manifest["views"]])
        branch_rows = {(r["row_id"], r["column_id"]) for r in rows if r["view_id"] == "obligation-branch-capability"}
        self.assertEqual(branch_rows, {("web65:WORLD#0", "Example/Native:cap.native.offer"),
                                       ("web65:WORLD#2", "Example/Native:cap.native.reading")})
        mc01 = next(r for r in rows if r["id"] == "rel.MC01.web65:WORLD")
        self.assertEqual(json.loads(mc01["capability_refs"]),
                         ["Example/Native:cap.native.offer", "Example/Native:cap.native.reading"])
        self.assertEqual(json.loads(mc01["extensions"])["ux"]["binding_status"], "source-bound-not-executed")
        ag01 = next(r for r in rows if r["id"] == "rel.AG01.web65:WORLD")
        self.assertEqual(json.loads(ag01["capability_refs"]), ["Example/Native:cap.native.reading"])

        reading = em.coverage_reading(self.result)
        entry = next(o for o in reading["obligations"] if o["id"] == "web65:WORLD")
        self.assertEqual(entry["capability_view"]["branches_without_capability"], [1])
        self.assertEqual(reading["summary"]["obligations_with_capability_binding"], 1)
        self.assertEqual(reading["summary"]["branches_with_capability_binding"], 2)

    def test_binding_without_obligation_keeps_existing_shape(self):
        em.apply_bindings(self.result, [self.binding(story_ids=["GV02"])])
        self.assertFalse(any("capability_view" in o for o in self.result["inherited_obligations"]))
        manifest, rows = em.relation_projection(self.result)
        self.assertNotIn("obligation-branch-capability", [v["id"] for v in manifest["views"]])
        self.assertTrue(all(r["capability_refs"] == "[]" for r in rows if r["view_id"] == "story-obligation"))
        self.assertNotIn("obligations_with_capability_binding", em.coverage_reading(self.result)["summary"])


class NativeInventoryOwnerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = em.owner_registry(ROOT)

    def test_catalogue_rows_are_not_filed_under_another_owner(self):
        with self.assertRaisesRegex(ValueError, r"EpiLogos/O-I: \d+ capability row\(s\) of .* belong to other owners "
                                                r"by the source's own owner_ref column"):
            em.read_matrix("EpiLogos/O-I", CATALOGUE, self.registry)

    def test_slice_reads_only_the_rows_the_source_attributes_to_the_owner(self):
        rows = em.read_matrix("EpiLogos/Central", CATALOGUE, self.registry, slice_only=True)
        with CATALOGUE.open(newline="") as source:
            expected = [r["id"] for r in csv.DictReader(source)
                        if r["record_type"] == "capability" and r["owner_id"] == "central"]
        self.assertEqual([r["capability_id"] for r in rows], expected)
        self.assertNotIn("central", rows[0]["excluded_foreign_records"])

    def test_single_owner_matrix_with_foreign_namespace_is_refused(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "factory.csv"
            path.write_text("id,record_type\ncap.factory.journey,capability\n")
            with self.assertRaisesRegex(ValueError, r"capability namespace 'factory' is not EpiLogos/Central's native namespace"):
                em.read_matrix("EpiLogos/Central", path, self.registry)
            path.write_text("id,record_type\ncap.factory.journey,capability\ncap.central.root,capability\n")
            with self.assertRaisesRegex(ValueError, "mixes capability namespaces"):
                em.read_matrix("Example/Native", path, self.registry)

    def test_host_recovery_ledger_enters_with_true_ids_and_digest(self):
        with self.assertRaisesRegex(ValueError, r"belong to other owners by the source's own product field"):
            em.read_matrix("EpiLogos/O-I", LEDGER, self.registry)
        rows = em.read_matrix("EpiLogos/O-I", LEDGER, self.registry, slice_only=True)
        document = json.loads(LEDGER.read_bytes())
        expected = [r["id"] for r in document["records"] if r["product"] in {"O-I", "Suite"}]
        self.assertEqual([r["capability_id"] for r in rows], expected)
        self.assertEqual({r["source_digest"] for r in rows}, {"sha256:" + hashlib.sha256(LEDGER.read_bytes()).hexdigest()})
        first = rows[0]
        self.assertEqual(first["source_format"], "epilogos-recovery/capability-matrix/v1")
        self.assertEqual(first["native_record"], document["records"][[r["id"] for r in document["records"]].index(first["capability_id"])])
        self.assertIsNone(first["native_view"]["need"])
        self.assertIsNone(first["native_view"]["operation"])
        self.assertIsNone(first["native_view"]["test_refs"])
        self.assertEqual(sum(first["excluded_foreign_records"].values()) + len(rows), document["record_count"])

    def test_registered_projection_json_and_unknown_json_are_refused(self):
        with tempfile.TemporaryDirectory() as temp:
            projected = Path(temp) / "readiness.json"
            projected.write_text(json.dumps({"schema_version": "epi-capability-readiness/0.1", "rows": [],
                                             "matrix_projection": {"protocol": "ql-capability-matrix/1", "csv": "field.csv"}}))
            with self.assertRaisesRegex(ValueError, "canonical matrix is its declared ql-capability-matrix/1 projection field.csv"):
                em.read_matrix("EpiLogos/QL-MEF", projected, self.registry)
            unknown = Path(temp) / "other.json"
            unknown.write_text(json.dumps({"schema": "epi.aw-field-projection/v1"}))
            with self.assertRaisesRegex(ValueError, "unsupported JSON capability source schema 'epi.aw-field-projection/v1'"):
                em.read_matrix("EpiLogos/QL-MEF", unknown, self.registry)

    def test_campaign_names_the_real_aikit_and_host_inventories(self):
        sources = {s["repository"]: s["path"] for s in
                   json.loads((ROOT / "docs/experience/campaign.json").read_text())["native_capability_sources"]}
        self.assertEqual(sources["EpiLogos/ai-kit"], "ProjectCentral/user/telos/capability-matrix.csv")
        self.assertEqual(sources["EpiLogos/O-I"], "suite/capability-matrix.json")
        self.assertTrue((ROOT / sources["EpiLogos/O-I"]).is_file())


if __name__ == "__main__":
    unittest.main()
