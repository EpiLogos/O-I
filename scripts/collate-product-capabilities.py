#!/usr/bin/env python3
"""Build O:I's derived catalogue of the six native product capability matrices.

This is deliberately a catalogue, not another capability matrix.  Product CSV
records remain the owned assertions; the catalogue retains every record and its
owner, source paths, hashes, relations, and native command mappings so `oi` can
discover composition without absorbing product acceptance into the desktop.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import sys
from pathlib import Path


SCRIPT_ROOT = Path(__file__).resolve().parents[1]
REQUIRED_PRODUCT_IDS = {
    "central", "actuation", "ai-kit", "software-factory", "workcell", "quaternal-logic"
}
REQUIRED_COLUMNS = {
    "id", "record_type", "capability_refs", "extensions", "relation",
}
CATALOGUE_COLUMNS = {
    "owner_id", "owner_ref", "source_csv", "source_json", "source_csv_sha256",
    "source_json_sha256", "native_namespace", "native_dispatch", "cli_commands",
}


class CollationError(ValueError):
    """A child matrix cannot safely be represented in the suite catalogue."""


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def fail(message: str) -> None:
    raise CollationError(message)


def read_json(path: Path) -> tuple[dict, bytes]:
    try:
        raw = path.read_bytes()
        value = json.loads(raw)
    except (OSError, json.JSONDecodeError) as error:
        fail(f"{path}: cannot read JSON: {error}")
    if not isinstance(value, dict):
        fail(f"{path}: manifest must be a JSON object")
    return value, raw


def read_csv(path: Path, *, child_matrix: bool = True) -> tuple[list[str], list[dict[str, str]], bytes]:
    try:
        raw = path.read_bytes()
        text = raw.decode("utf-8")
    except (OSError, UnicodeDecodeError) as error:
        fail(f"{path}: cannot read UTF-8 CSV: {error}")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        fail(f"{path}: missing CSV header")
    headers = list(reader.fieldnames)
    missing = REQUIRED_COLUMNS - set(headers)
    if missing:
        fail(f"{path}: missing required columns: {', '.join(sorted(missing))}")
    if child_matrix:
        collisions = CATALOGUE_COLUMNS & set(headers)
        if collisions:
            fail(f"{path}: child matrix uses reserved catalogue columns: {', '.join(sorted(collisions))}")
    rows = []
    for number, row in enumerate(reader, start=2):
        if None in row:
            fail(f"{path}:{number}: has more values than its header")
        rows.append({key: value if value is not None else "" for key, value in row.items()})
    return headers, rows, raw


def native_surfaces(path: Path) -> tuple[dict[str, dict], bytes]:
    surfaces, raw = read_json(path)
    entries = surfaces.get("surfaces")
    if not isinstance(entries, list):
        fail(f"{path}: surfaces must be an array")
    result = {}
    for surface in entries:
        if not isinstance(surface, dict) or not isinstance(surface.get("id"), str):
            fail(f"{path}: each surface needs an id")
        native = surface.get("native")
        if not isinstance(native, dict) or not isinstance(native.get("namespace"), str) or not native["namespace"]:
            fail(f"{path}: surface {surface['id']!r} needs native.namespace")
        if surface["id"] in result:
            fail(f"{path}: duplicate surface id {surface['id']!r}")
        result[surface["id"]] = native
    return result, raw


def command_mapping(path: Path, number: int, row: dict[str, str]) -> list[str]:
    raw = row.get("extensions", "")
    if not raw.strip():
        return []
    try:
        extension = json.loads(raw)
    except json.JSONDecodeError as error:
        fail(f"{path}:{number}: extensions is not JSON: {error.msg}")
    if not isinstance(extension, dict):
        fail(f"{path}:{number}: extensions must be a JSON object")
    commands = extension.get("cli_commands", [])
    if not isinstance(commands, list) or not all(isinstance(command, str) and command for command in commands):
        fail(f"{path}:{number}: extensions.cli_commands must be an array of non-empty strings")
    if len(commands) != len(set(commands)):
        fail(f"{path}:{number}: extensions.cli_commands contains duplicates")
    return commands


def validate_rows(product_id: str, csv_path: Path, rows: list[dict[str, str]]) -> None:
    ids: set[str] = set()
    capabilities: set[str] = set()
    for number, row in enumerate(rows, start=2):
        record_id = row["id"].strip()
        if not record_id:
            fail(f"{csv_path}:{number}: record id is required")
        if record_id in ids:
            fail(f"{csv_path}:{number}: duplicate record id {record_id!r}")
        ids.add(record_id)
        record_type = row["record_type"].strip()
        if record_type not in {"capability", "relation"}:
            fail(f"{csv_path}:{number}: unsupported record_type {record_type!r}")
        if record_type == "capability":
            capabilities.add(record_id)
        if record_type == "relation" and not row["relation"].strip():
            fail(f"{csv_path}:{number}: relation records require relation text")
        command_mapping(csv_path, number, row)

    for number, row in enumerate(rows, start=2):
        try:
            refs = json.loads(row["capability_refs"] or "[]")
        except json.JSONDecodeError as error:
            fail(f"{csv_path}:{number}: capability_refs is not JSON: {error.msg}")
        if not isinstance(refs, list) or not all(isinstance(ref, str) and ref for ref in refs):
            fail(f"{csv_path}:{number}: capability_refs must be an array of non-empty strings")
        if len(refs) != len(set(refs)):
            fail(f"{csv_path}:{number}: capability_refs contains duplicates")
        missing = sorted(set(refs) - capabilities)
        if missing:
            fail(f"{csv_path}:{number}: references missing {product_id} capabilities: {', '.join(missing)}")


def parse_root_overrides(values: list[str]) -> dict[str, Path]:
    result: dict[str, Path] = {}
    for value in values:
        product_id, separator, raw_path = value.partition("=")
        if not separator or not product_id or not raw_path:
            fail("--product-root requires PRODUCT_ID=PATH")
        if product_id in result:
            fail(f"duplicate --product-root for {product_id!r}")
        result[product_id] = Path(raw_path).expanduser().resolve()
    return result


def product_root(product: dict, workspace_root: Path, overrides: dict[str, Path]) -> Path:
    product_id = product.get("id")
    checkout = product.get("checkout")
    if not isinstance(product_id, str) or not product_id:
        fail("suite manifest product is missing id")
    if product_id in overrides:
        return overrides[product_id]
    if not isinstance(checkout, str) or not checkout:
        fail(f"suite manifest product {product_id!r} is missing checkout")
    return workspace_root / checkout


def catalogue(
    suite_manifest: Path,
    suite_manifest_ref: str,
    surfaces_path: Path,
    surfaces_ref: str,
    workspace_root: Path,
    overrides: dict[str, Path],
) -> tuple[dict, list[dict[str, str]]]:
    suite, suite_raw = read_json(suite_manifest)
    native_by_product, surfaces_raw = native_surfaces(surfaces_path)
    products = suite.get("products")
    if not isinstance(products, list):
        fail(f"{suite_manifest}: products must be an array")
    product_ids = [product.get("id") for product in products if isinstance(product, dict)]
    if len(product_ids) != len(products) or len(product_ids) != len(set(product_ids)):
        fail(f"{suite_manifest}: products must have unique ids")
    if set(product_ids) != REQUIRED_PRODUCT_IDS:
        fail(f"{suite_manifest}: expected exactly the six native product ids, got {', '.join(map(str, product_ids))}")
    if not REQUIRED_PRODUCT_IDS <= set(native_by_product):
        fail(f"{surfaces_path}: missing native surface mapping for {', '.join(sorted(REQUIRED_PRODUCT_IDS - set(native_by_product)))}")
    unknown_overrides = set(overrides) - set(product_ids)
    if unknown_overrides:
        fail(f"--product-root names products absent from suite manifest: {', '.join(sorted(unknown_overrides))}")

    # Relation ids are local matrix addresses (for example H0->H1) and may recur
    # across owners. Capability identities are suite-composable, so those must be
    # globally unique.
    seen_capability_ids: set[str] = set()
    source_products = []
    catalogue_records = []
    flat_rows = []
    for product in products:
        product_id = product["id"]
        native = native_by_product[product_id]
        owner_ref = f"product:{product_id}"
        relative_csv = "ProjectCentral/user/capability-matrix.csv"
        relative_json = "ProjectCentral/user/capability-matrix.json"
        root = product_root(product, workspace_root, overrides)
        matrix_dir = root / "ProjectCentral/user"
        csv_path = matrix_dir / "capability-matrix.csv"
        json_path = matrix_dir / "capability-matrix.json"
        manifest, json_raw = read_json(json_path)
        if manifest.get("protocol") != "ql-capability-matrix/1":
            fail(f"{json_path}: unexpected protocol {manifest.get('protocol')!r}")
        if not isinstance(manifest.get("matrix_id"), str) or not manifest["matrix_id"]:
            fail(f"{json_path}: matrix_id is required")
        headers, rows, csv_raw = read_csv(csv_path)
        validate_rows(product_id, csv_path, rows)
        for number, row in enumerate(rows, start=2):
            if row["record_type"] == "capability" and row["id"] in seen_capability_ids:
                fail(f"duplicate capability id across products: {row['id']!r}")
            if row["record_type"] == "capability":
                seen_capability_ids.add(row["id"])
            commands = command_mapping(csv_path, number, row)
            routing = {
                "namespace": native["namespace"],
                "command_identities": commands,
                "dispatch": (
                    "oi central action run <native-command-id> <input-json>"
                    if product_id == "central"
                    else "oi <namespace> forwards the native leaf path unchanged"
                ),
            }
            provenance = {
                "owner_id": product_id,
                "owner_ref": owner_ref,
                "source_csv": f"{owner_ref}:{relative_csv}",
                "source_json": f"{owner_ref}:{relative_json}",
                "source_csv_sha256": sha256_bytes(csv_raw),
                "source_json_sha256": sha256_bytes(json_raw),
                "native_namespace": native["namespace"],
                "native_dispatch": routing["dispatch"],
            }
            # JSON keeps command identities as an array for `oi` consumers; CSV
            # uses its normal JSON-in-a-cell representation.
            catalogue_records.append({**provenance, "cli_commands": commands, "native_routing": routing, **row})
            flat_rows.append({
                **provenance,
                "cli_commands": json.dumps(commands, ensure_ascii=False, separators=(",", ":")),
                **row,
            })
        source_products.append({
            "id": product_id,
            "public_name": product.get("public_name"),
            "checkout": product.get("checkout"),
            "owner_ref": owner_ref,
            "matrix": {
                "protocol": manifest["protocol"],
                "matrix_id": manifest["matrix_id"],
                "anchor_ref": manifest.get("anchor_ref"),
                "default_view": manifest.get("default_view"),
                "source_csv": f"{owner_ref}:{relative_csv}",
                "source_json": f"{owner_ref}:{relative_json}",
                "source_csv_sha256": sha256_bytes(csv_raw),
                "source_json_sha256": sha256_bytes(json_raw),
            },
            "native_routing": {
                "namespace": native["namespace"],
                "dispatch": (
                    "oi central action run <native-command-id> <input-json>"
                    if product_id == "central"
                    else "oi <namespace> forwards the native leaf path unchanged"
                ),
            },
            "record_count": len(rows),
        })
    result = {
        "schema": "oi.product-capability-catalogue/v1",
        "scope": "Native S0-S5 product capability catalogue for oi composition; desktop M-prime acceptance is a separate projection.",
        "derived_from": {
            "suite_manifest": suite_manifest_ref,
            "suite_manifest_sha256": sha256_bytes(suite_raw),
            "surfaces": surfaces_ref,
            "surfaces_sha256": sha256_bytes(surfaces_raw),
        },
        "products": source_products,
        "record_count": len(catalogue_records),
        "records": catalogue_records,
    }
    return result, flat_rows


def encoded_outputs(result: dict, rows: list[dict[str, str]]) -> tuple[bytes, bytes]:
    json_output = (json.dumps(result, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    # Matrices may retain product-specific extension columns. Take their stable
    # first-seen union instead of assuming every child has Central's header.
    fields: list[str] = []
    for row in rows:
        for field in row:
            if field not in fields:
                fields.append(field)
    stream = io.StringIO(newline="")
    writer = csv.DictWriter(stream, fieldnames=fields, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return json_output, stream.getvalue().encode("utf-8")


def flat_rows_from_snapshot(records: list[dict]) -> list[dict[str, str]]:
    rows = []
    for number, record in enumerate(records, start=1):
        routing = record.get("native_routing")
        commands = record.get("cli_commands")
        if not isinstance(routing, dict) or not isinstance(commands, list):
            fail(f"snapshot record {number}: native_routing and cli_commands are required")
        row = {key: value for key, value in record.items() if key != "native_routing"}
        if not all(isinstance(value, str) for key, value in row.items() if key != "cli_commands"):
            fail(f"snapshot record {number}: CSV-carried values must be strings")
        row["cli_commands"] = json.dumps(commands, ensure_ascii=False, separators=(",", ":"))
        rows.append(row)
    return rows


def validate_snapshot(
    snapshot_json: Path, snapshot_csv: Path, suite_manifest: Path, suite_manifest_ref: str,
    surfaces_path: Path, surfaces_ref: str,
) -> None:
    snapshot, _ = read_json(snapshot_json)
    suite, suite_raw = read_json(suite_manifest)
    native_by_product, surfaces_raw = native_surfaces(surfaces_path)
    if snapshot.get("schema") != "oi.product-capability-catalogue/v1":
        fail(f"{snapshot_json}: unexpected catalogue schema")
    derived = snapshot.get("derived_from")
    if not isinstance(derived, dict) or derived != {
        "suite_manifest": suite_manifest_ref,
        "suite_manifest_sha256": sha256_bytes(suite_raw),
        "surfaces": surfaces_ref,
        "surfaces_sha256": sha256_bytes(surfaces_raw),
    }:
        fail(f"{snapshot_json}: suite or surfaces provenance hash mismatch")
    suite_products = suite.get("products")
    products = snapshot.get("products")
    records = snapshot.get("records")
    if not isinstance(suite_products, list) or not isinstance(products, list) or not isinstance(records, list):
        fail(f"{snapshot_json}: products and records must be arrays")
    expected_ids = [product.get("id") for product in suite_products if isinstance(product, dict)]
    if set(expected_ids) != REQUIRED_PRODUCT_IDS or len(expected_ids) != len(set(expected_ids)):
        fail(f"{suite_manifest}: expected exactly the six native product ids")
    product_by_id = {}
    for product in products:
        if not isinstance(product, dict) or not isinstance(product.get("id"), str):
            fail(f"{snapshot_json}: invalid product entry")
        product_id = product["id"]
        if product_id in product_by_id:
            fail(f"{snapshot_json}: duplicate product {product_id!r}")
        product_by_id[product_id] = product
    if set(product_by_id) != set(expected_ids):
        fail(f"{snapshot_json}: product set does not match suite manifest")
    if snapshot.get("record_count") != len(records):
        fail(f"{snapshot_json}: record_count does not match records")

    csv_headers, csv_rows, _ = read_csv(snapshot_csv, child_matrix=False)
    typed_records = []
    per_product_rows: dict[str, list[dict[str, str]]] = {product_id: [] for product_id in expected_ids}
    for number, record in enumerate(records, start=1):
        if not isinstance(record, dict):
            fail(f"{snapshot_json}: record {number} is not an object")
        product_id = record.get("owner_id")
        if product_id not in product_by_id:
            fail(f"{snapshot_json}: record {number} has unknown owner")
        owner_ref = f"product:{product_id}"
        product = product_by_id[product_id]
        matrix = product.get("matrix")
        routing = record.get("native_routing")
        if not isinstance(matrix, dict) or not isinstance(routing, dict):
            fail(f"{snapshot_json}: record {number} lacks product matrix/routing")
        expected_dispatch = (
            "oi central action run <native-command-id> <input-json>"
            if product_id == "central" else "oi <namespace> forwards the native leaf path unchanged"
        )
        if record.get("owner_ref") != owner_ref or record.get("source_csv") != f"{owner_ref}:ProjectCentral/user/capability-matrix.csv" or record.get("source_json") != f"{owner_ref}:ProjectCentral/user/capability-matrix.json":
            fail(f"{snapshot_json}: record {number} has invalid owner/source reference")
        if record.get("source_csv_sha256") != matrix.get("source_csv_sha256") or record.get("source_json_sha256") != matrix.get("source_json_sha256"):
            fail(f"{snapshot_json}: record {number} source hashes disagree with its product matrix")
        commands = record.get("cli_commands")
        if not isinstance(commands, list) or not all(isinstance(command, str) and command for command in commands) or len(commands) != len(set(commands)):
            fail(f"{snapshot_json}: record {number} has invalid cli_commands")
        if routing != {"namespace": native_by_product[product_id]["namespace"], "command_identities": commands, "dispatch": expected_dispatch}:
            fail(f"{snapshot_json}: record {number} native routing disagrees with surfaces.json")
        if record.get("native_namespace") != routing["namespace"] or record.get("native_dispatch") != expected_dispatch:
            fail(f"{snapshot_json}: record {number} CSV routing fields disagree")
        typed_records.append(record)
        per_product_rows[product_id].append({key: value for key, value in record.items() if isinstance(value, str)})

    seen_capabilities: set[str] = set()
    for product_id, product in product_by_id.items():
        matrix = product.get("matrix")
        if not isinstance(matrix, dict) or product.get("owner_ref") != f"product:{product_id}":
            fail(f"{snapshot_json}: product {product_id!r} has invalid ownership")
        if product.get("record_count") != len(per_product_rows[product_id]):
            fail(f"{snapshot_json}: product {product_id!r} count mismatch")
        for hash_field in ("source_csv_sha256", "source_json_sha256"):
            digest = matrix.get(hash_field)
            if not isinstance(digest, str) or len(digest) != 64 or any(char not in "0123456789abcdef" for char in digest):
                fail(f"{snapshot_json}: product {product_id!r} has invalid {hash_field}")
        expected_dispatch = (
            "oi central action run <native-command-id> <input-json>"
            if product_id == "central" else "oi <namespace> forwards the native leaf path unchanged"
        )
        if product.get("native_routing") != {"namespace": native_by_product[product_id]["namespace"], "dispatch": expected_dispatch}:
            fail(f"{snapshot_json}: product {product_id!r} routing disagrees with surfaces.json")
        validate_rows(product_id, snapshot_json, per_product_rows[product_id])
        for row in per_product_rows[product_id]:
            if row["record_type"] == "capability":
                if row["id"] in seen_capabilities:
                    fail(f"{snapshot_json}: duplicate capability id across products: {row['id']!r}")
                seen_capabilities.add(row["id"])

    expected_rows = flat_rows_from_snapshot(typed_records)
    expected_headers = []
    for row in expected_rows:
        for field in row:
            if field not in expected_headers:
                expected_headers.append(field)
    if csv_headers != expected_headers or csv_rows != expected_rows:
        fail(f"{snapshot_csv}: snapshot CSV does not agree with JSON")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--suite-manifest", type=Path, default=SCRIPT_ROOT / "suite/manifest.json")
    parser.add_argument("--suite-manifest-ref", default="suite/manifest.json", help="stable provenance ref for --suite-manifest")
    parser.add_argument("--surfaces", type=Path, default=SCRIPT_ROOT / "surfaces.json")
    parser.add_argument("--surfaces-ref", default="surfaces.json", help="stable provenance ref for --surfaces")
    parser.add_argument("--workspace-root", type=Path, default=SCRIPT_ROOT.parent)
    parser.add_argument("--product-root", action="append", default=[], metavar="PRODUCT_ID=PATH")
    parser.add_argument("--out-json", type=Path, default=SCRIPT_ROOT / "suite/product-capabilities.json")
    parser.add_argument("--out-csv", type=Path, default=SCRIPT_ROOT / "suite/product-capabilities.csv")
    parser.add_argument("--check", action="store_true", help="fail if generated files differ from current outputs")
    parser.add_argument("--check-snapshot", action="store_true", help="validate shipped outputs using only this O:I checkout")
    args = parser.parse_args(argv)
    try:
        if args.check and args.check_snapshot:
            fail("--check and --check-snapshot are mutually exclusive")
        if args.check_snapshot:
            validate_snapshot(
                args.out_json.resolve(), args.out_csv.resolve(), args.suite_manifest.resolve(), args.suite_manifest_ref,
                args.surfaces.resolve(), args.surfaces_ref,
            )
            return 0
        result, rows = catalogue(
            args.suite_manifest.resolve(), args.suite_manifest_ref, args.surfaces.resolve(), args.surfaces_ref,
            args.workspace_root.expanduser().resolve(), parse_root_overrides(args.product_root)
        )
        json_output, csv_output = encoded_outputs(result, rows)
        targets = ((args.out_json.resolve(), json_output), (args.out_csv.resolve(), csv_output))
        if args.check:
            drifted = [str(path) for path, expected in targets if not path.is_file() or path.read_bytes() != expected]
            if drifted:
                fail(f"generated catalogue drift: {', '.join(drifted)}")
        else:
            for path, output in targets:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(output)
    except CollationError as error:
        print(f"capability collation failed: {error}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
