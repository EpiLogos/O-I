#!/usr/bin/env python3
"""Regenerate the suite build record from the campaign source lock.

suite/manifest.json is the RECORDED BUILD EVIDENCE of the last artifact
release; suite/mainline.json's build_record relation must name the same
suite_version and recorded_at (scripts/verify-mainline-snapshot.py enforces
the agreement). This tool is the release-flow step that moves both together:
run it only as part of producing a new artifact release, after the release
pipeline has built archives at the locked revisions, because the manifest's
asset blocks (archives + attestations) stay evidence of their own release.

  suite_manifest_from_lock.py          rewrite manifest + mainline build_record
  suite_manifest_from_lock.py --check  verify only; exit 1 listing stale revisions

--check passes while the recorded build record is the last release; it is the
release pipeline's gate, not a per-commit freshness gate (a dev machine's
freshness signal is `oi doctor`, which reconciles the live surfaces).
"""
from __future__ import annotations
import argparse
import datetime
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCK = ROOT / "tests/continuous-work/sources/lock.json"
MANIFEST = ROOT / "suite/manifest.json"

# Suite product id -> controlled_native_cut key. Products absent from the
# mapping have no locked revision and are reported, never guessed.
LOCK_KEYS = {
    "central": "central",
    "ai-kit": "aikit",
    "workcell": "workcell",
    "actuation": "actuation",
    "software-factory": "factory",
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verify only; exit 1 when stale")
    args = parser.parse_args()

    lock = json.loads(LOCK.read_text())
    cut = lock["controlled_native_cut"]
    manifest = json.loads(MANIFEST.read_text())

    stale, updated, skipped = [], [], []
    for product in manifest["products"]:
        key = LOCK_KEYS.get(product["id"])
        if key is None:
            skipped.append(product["id"])
            continue
        locked = cut.get(key)
        if not re.fullmatch(r"[0-9a-f]{40}", locked or ""):
            stale.append(f"{product['id']}: lock key '{key}' is not an exact 40-hex revision")
            continue
        if product["revision"] != locked:
            if args.check:
                stale.append(f"{product['id']}: manifest {product['revision'][:7]} != locked {locked[:7]}")
            else:
                product["revision"] = locked
                updated.append(f"{product['id']} -> {locked[:7]}")

    version_now = manifest["suite_version"]
    if args.check:
        if stale:
            print("suite manifest is stale; regenerate with suite_manifest_from_lock.py:")
            for line in stale:
                print(f"  {line}")
            return 1
        print("suite manifest matches the controlled native cut")
        return 0

    counter = re.fullmatch(r"(.*)-prelocal\.(\d+)", version_now)
    manifest["suite_version"] = f"{counter.group(1)}-prelocal.{int(counter.group(2)) + 1}" if counter else f"{version_now}+cut"
    manifest["recorded_at"] = datetime.date.today().isoformat()
    mainline_path = ROOT / "suite/mainline.json"
    mainline = json.loads(mainline_path.read_text())
    record = mainline.get("build_record", {})
    record["suite_version"] = manifest["suite_version"]
    record["recorded_at"] = manifest["recorded_at"]
    mainline["build_record"] = record
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    mainline_path.write_text(json.dumps(mainline, indent=2, ensure_ascii=False) + "\n")
    for line in updated:
        print(f"  {line}")
    for product_id in skipped:
        print(f"  {product_id}: no locked revision; left unchanged")
    print(f"suite_version {version_now} -> {manifest['suite_version']}; recorded_at {manifest['recorded_at']}")
    print("artifact asset blocks preserved: regenerate via the release pipeline before artifact install")
    return 0


if __name__ == "__main__":
    sys.exit(main())
