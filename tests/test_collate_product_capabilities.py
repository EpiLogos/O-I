#!/usr/bin/env python3
"""End-to-end checks for the native-product capability catalogue generator."""

from __future__ import annotations

import csv
import json
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/collate-product-capabilities.py"
PRODUCTS = [
    ("central", "Central"), ("actuation", "Actuation"), ("ai-kit", "ai-kit"),
    ("software-factory", "Software-Factory"), ("workcell", "Workcell"),
    ("quaternal-logic", "Quaternal-Logic"),
]
FIELDS = ["id", "record_type", "capability_refs", "extensions", "relation"]


def write_product(root: Path, product_id: str, *, rows: list[dict[str, str]] | None = None) -> None:
    matrix = root / "ProjectCentral/user"
    matrix.mkdir(parents=True, exist_ok=True)
    (matrix / "capability-matrix.json").write_text(json.dumps({
        "protocol": "ql-capability-matrix/1", "matrix_id": f"matrix.{product_id}",
        "anchor_ref": f"{product_id}:account", "default_view": "product-field",
    }), encoding="utf-8")
    records = rows or [{
        "id": f"cap.{product_id}.native", "record_type": "capability", "capability_refs": "[]",
        "extensions": json.dumps({"cli_commands": [f"{product_id}.inspect"]}), "relation": "",
    }, {
        "id": f"rel.{product_id}.native", "record_type": "relation",
        "capability_refs": json.dumps([f"cap.{product_id}.native"]), "extensions": "{}", "relation": "exposes native capability",
    }]
    with (matrix / "capability-matrix.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(records)


class CollationTests(unittest.TestCase):
    def write_fixture(self, root: Path) -> tuple[Path, Path]:
        workspace = root / "products"
        products = []
        for product_id, checkout in PRODUCTS:
            write_product(workspace / checkout, product_id)
            products.append({"id": product_id, "public_name": checkout, "checkout": checkout})
        manifest = root / "suite.json"
        manifest.write_text(json.dumps({"products": products}), encoding="utf-8")
        return manifest, workspace

    def fixture(self) -> tuple[tempfile.TemporaryDirectory, Path, Path]:
        temporary = tempfile.TemporaryDirectory()
        manifest, workspace = self.write_fixture(Path(temporary.name))
        return temporary, manifest, workspace

    def invoke(self, manifest: Path, workspace: Path, output: Path, *extra: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run([
            "python3", str(SCRIPT), "--suite-manifest", str(manifest), "--workspace-root", str(workspace),
            "--out-json", str(output / "catalogue.json"), "--out-csv", str(output / "catalogue.csv"), *extra,
        ], text=True, capture_output=True, check=False)

    def test_collates_every_record_relation_and_command_mapping(self) -> None:
        temporary, manifest, workspace = self.fixture()
        with temporary:
            output = Path(temporary.name) / "out"
            result = self.invoke(manifest, workspace, output)
            self.assertEqual(result.returncode, 0, result.stderr)
            catalogue = json.loads((output / "catalogue.json").read_text())
            self.assertEqual(catalogue["schema"], "oi.product-capability-catalogue/v1")
            self.assertIn("desktop M-prime acceptance is a separate projection", catalogue["scope"])
            self.assertEqual(catalogue["record_count"], 12)
            relation = next(record for record in catalogue["records"] if record["id"] == "rel.central.native")
            self.assertEqual(relation["capability_refs"], '["cap.central.native"]')
            capability = next(record for record in catalogue["records"] if record["id"] == "cap.central.native")
            self.assertEqual(capability["owner_ref"], "product:central")
            self.assertEqual(capability["cli_commands"], ["central.inspect"])
            self.assertEqual(capability["native_routing"]["namespace"], "central")
            self.assertIn("action run", capability["native_routing"]["dispatch"])
            self.assertEqual(len(capability["source_csv_sha256"]), 64)
            with (output / "catalogue.csv").open(encoding="utf-8", newline="") as handle:
                self.assertEqual(csv.DictReader(handle).fieldnames.count("owner_id"), 1)
            self.assertEqual(self.invoke(manifest, workspace, output, "--check").returncode, 0)

    def test_rejects_duplicate_ids_and_missing_relation_capabilities(self) -> None:
        temporary, manifest, workspace = self.fixture()
        with temporary:
            path = workspace / "Central"
            write_product(path, "central", rows=[
                {"id": "cap.duplicate", "record_type": "capability", "capability_refs": "[]", "extensions": "{}", "relation": ""},
                {"id": "cap.duplicate", "record_type": "relation", "capability_refs": '["cap.missing"]', "extensions": "{}", "relation": "bad"},
            ])
            result = self.invoke(manifest, workspace, Path(temporary.name) / "out")
            self.assertEqual(result.returncode, 2)
            self.assertIn("duplicate record id", result.stderr)

    def test_rejects_a_relation_with_an_unknown_capability(self) -> None:
        temporary, manifest, workspace = self.fixture()
        with temporary:
            write_product(workspace / "Central", "central", rows=[
                {"id": "cap.central.native", "record_type": "capability", "capability_refs": "[]", "extensions": "{}", "relation": ""},
                {"id": "rel.central.invalid", "record_type": "relation", "capability_refs": '["cap.missing"]', "extensions": "{}", "relation": "bad"},
            ])
            result = self.invoke(manifest, workspace, Path(temporary.name) / "out")
            self.assertEqual(result.returncode, 2)
            self.assertIn("references missing central capabilities", result.stderr)

    def test_check_reports_drift(self) -> None:
        temporary, manifest, workspace = self.fixture()
        with temporary:
            output = Path(temporary.name) / "out"
            self.assertEqual(self.invoke(manifest, workspace, output).returncode, 0)
            (output / "catalogue.csv").write_text("stale\n", encoding="utf-8")
            result = self.invoke(manifest, workspace, output, "--check")
            self.assertEqual(result.returncode, 2)
            self.assertIn("generated catalogue drift", result.stderr)

    def test_snapshot_check_needs_no_child_checkout_and_rejects_csv_mismatch(self) -> None:
        temporary, manifest, workspace = self.fixture()
        with temporary:
            output = Path(temporary.name) / "out"
            self.assertEqual(self.invoke(manifest, workspace, output).returncode, 0)
            snapshot_path = output / "catalogue.json"
            snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
            snapshot["records"][0]["native_routing"]["namespace"] = "wrong-owner"
            snapshot_path.write_text(json.dumps(snapshot), encoding="utf-8")
            mapping_mismatch = self.invoke(manifest, workspace, output, "--check-snapshot")
            self.assertEqual(mapping_mismatch.returncode, 2)
            self.assertIn("native routing disagrees", mapping_mismatch.stderr)
            self.assertEqual(self.invoke(manifest, workspace, output).returncode, 0)
            for child in workspace.iterdir():
                child.rename(child.with_name(f"missing-{child.name}"))
            clean = self.invoke(manifest, workspace, output, "--check-snapshot")
            self.assertEqual(clean.returncode, 0, clean.stderr)
            (output / "catalogue.csv").write_text("stale\n", encoding="utf-8")
            mismatch = self.invoke(manifest, workspace, output, "--check-snapshot")
            self.assertEqual(mismatch.returncode, 2)
            self.assertIn("missing required columns", mismatch.stderr)

    def test_rejects_reserved_catalogue_column_in_child_matrix(self) -> None:
        temporary, manifest, workspace = self.fixture()
        with temporary:
            csv_path = workspace / "Central/ProjectCentral/user/capability-matrix.csv"
            csv_path.write_text(csv_path.read_text(encoding="utf-8").replace(
                "id,record_type", "id,owner_id,record_type", 1
            ), encoding="utf-8")
            result = self.invoke(manifest, workspace, Path(temporary.name) / "out")
            self.assertEqual(result.returncode, 2)
            self.assertIn("reserved catalogue columns", result.stderr)

    def test_output_is_identical_after_relocating_every_product_checkout(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            left_manifest, left_workspace = self.write_fixture(root / "left")
            right_manifest, right_workspace = self.write_fixture(root / "right")
            left_output = root / "left-output"
            right_output = root / "right-output"
            self.assertEqual(self.invoke(left_manifest, left_workspace, left_output).returncode, 0)
            self.assertEqual(self.invoke(right_manifest, right_workspace, right_output).returncode, 0)
            self.assertEqual(
                (left_output / "catalogue.json").read_bytes(),
                (right_output / "catalogue.json").read_bytes(),
            )
            self.assertEqual(
                (left_output / "catalogue.csv").read_bytes(),
                (right_output / "catalogue.csv").read_bytes(),
            )

    def test_real_six_product_catalogue_is_current_and_complete(self) -> None:
        missing = [
            checkout for _, checkout in PRODUCTS
            if not (ROOT.parent / checkout / "ProjectCentral/user/capability-matrix.csv").is_file()
        ]
        if missing:
            self.skipTest(f"live sibling product matrices unavailable: {', '.join(missing)}")
        result = subprocess.run(["python3", str(SCRIPT), "--check"], cwd=ROOT, text=True, capture_output=True, check=False)
        self.assertEqual(result.returncode, 0, result.stderr)
        catalogue = json.loads((ROOT / "suite/product-capabilities.json").read_text())
        self.assertEqual({product["id"] for product in catalogue["products"]}, {product_id for product_id, _ in PRODUCTS})
        self.assertGreater(catalogue["record_count"], 400)


if __name__ == "__main__":
    unittest.main()
