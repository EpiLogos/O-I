#!/usr/bin/env python3
"""Verify that O:I's current-main source snapshot is truthful.

This guard deliberately separates two claims:

1. suite/manifest.json is an immutable released-artifact snapshot;
2. suite/mainline.json + surfaces.json describe the current accepted native mains.

A release may be older than current source. What is forbidden is presenting that older
release as proof that the current-main development world was converged.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HEX40 = re.compile(r"^[0-9a-f]{40}$")
EXPECTED_IDS = {
    "central",
    "actuation",
    "ai-kit",
    "software-factory",
    "workcell",
    "quaternal-logic",
}


def load(path: str):
    with (ROOT / path).open("r", encoding="utf-8") as handle:
        return json.load(handle)


def die(message: str) -> None:
    raise SystemExit(f"mainline snapshot verification failed: {message}")


def live_main(repository: str) -> str:
    result = subprocess.run(
        ["git", "ls-remote", repository, "refs/heads/main"],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        die(f"cannot inspect live main for {repository}: {result.stderr.strip()}")
    fields = result.stdout.strip().split()
    if len(fields) != 2 or fields[1] != "refs/heads/main":
        die(f"unexpected live-main response for {repository}: {result.stdout.strip()}")
    return fields[0]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--live",
        action="store_true",
        help="also compare every recorded native revision with the repository's live main",
    )
    args = parser.parse_args()

    snapshot = load("suite/mainline.json")
    surfaces = load("surfaces.json")
    release = load("suite/manifest.json")

    if snapshot.get("schema") != "oi.mainline-snapshot/v1":
        die("unexpected mainline snapshot schema")

    products = snapshot.get("products", [])
    by_id = {product.get("id"): product for product in products}
    if set(by_id) != EXPECTED_IDS or len(products) != len(EXPECTED_IDS):
        die(f"mainline snapshot must contain exactly {sorted(EXPECTED_IDS)}")

    surface_list = surfaces.get("surfaces", [])
    surface_by_id = {surface.get("id"): surface for surface in surface_list}
    if set(surface_by_id) != EXPECTED_IDS or len(surface_list) != len(EXPECTED_IDS):
        die("surfaces.json and mainline snapshot do not describe the same six products")

    release_relation = snapshot.get("release_manifest", {})
    if release_relation.get("relation") != "historical-immutable-release-snapshot":
        die("release/mainline provenance relation is not explicit")
    if release_relation.get("suite_version") != release.get("suite_version"):
        die("recorded historical release version does not match suite/manifest.json")
    if release_relation.get("accepted_at") != release.get("accepted_at"):
        die("recorded historical release date does not match suite/manifest.json")

    for product_id in sorted(EXPECTED_IDS):
        product = by_id[product_id]
        surface = surface_by_id[product_id]
        revision = product.get("revision", "")
        if not HEX40.fullmatch(revision):
            die(f"{product_id} revision is not an immutable 40-character SHA: {revision!r}")
        if surface.get("repository") != product.get("repository"):
            die(f"{product_id} repository differs between surfaces and mainline snapshot")
        if surface.get("docs_ref") != revision:
            die(f"{product_id} docs_ref is {surface.get('docs_ref')}, expected {revision}")
        install = surface.get("install", {})
        if install.get("ref") != revision or install.get("revision") != revision:
            die(f"{product_id} source-install pin does not match mainline revision")
        if args.live:
            observed = live_main(product["repository"])
            if observed != revision:
                die(
                    f"{product_id} live main moved: snapshot {revision}, live {observed}; "
                    "update the snapshot/catalog or explicitly reclassify the line before claiming convergence"
                )

    print("mainline snapshot verification: PASS")
    if args.live:
        print("live native-main equality: PASS")
    print(
        f"release snapshot remains distinct: {release['suite_version']} accepted {release['accepted_at']}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
