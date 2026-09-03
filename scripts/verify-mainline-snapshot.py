#!/usr/bin/env python3
"""Verify O:I's six-product source snapshot without collapsing owner programmes.

This guard separates three claims:

1. suite/manifest.json is a historical unratified pre-local build record;
2. suite/mainline.json + surfaces.json describe one coherent six-product source cut;
3. O:I #97 live-main convergence applies only to its explicitly authored primary
   repository set. Quaternal Logic remains the separately owned parallel product
   and its moving development main is not a #97 closure dependency.
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
PARALLEL_LIVE_EXCEPTIONS = {"quaternal-logic"}


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
        help=(
            "compare #97 in-scope product revisions with their live mains; "
            "parallel Quaternal Logic remains represented but is not live-gated"
        ),
    )
    args = parser.parse_args()

    snapshot = load("suite/mainline.json")
    surfaces = load("surfaces.json")
    build_record = load("suite/manifest.json")

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

    record_relation = snapshot.get("build_record", {})
    if record_relation.get("relation") != "historical-build-evidence-not-current-main-authority":
        die("build-record/mainline provenance relation is not explicit")
    if record_relation.get("suite_version") != build_record.get("suite_version"):
        die("recorded historical build version does not match suite/manifest.json")
    if record_relation.get("recorded_at") != build_record.get("recorded_at"):
        die("recorded historical build date does not match suite/manifest.json")

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

        if product_id in PARALLEL_LIVE_EXCEPTIONS:
            if product.get("state") != "parallel-native-owner-exception":
                die(
                    f"{product_id} must declare parallel-native-owner-exception "
                    "while outside #97 live-main gating"
                )
            continue

        if args.live:
            observed = live_main(product["repository"])
            if observed != revision:
                die(
                    f"{product_id} live main moved: snapshot {revision}, live {observed}; "
                    "update the #97 source cut or explicitly reclassify the in-scope line"
                )

    print("mainline snapshot verification: PASS")
    if args.live:
        print("live #97 in-scope native-main equality: PASS")
        print("Quaternal Logic parallel owner: represented, NOT #97 live-gated")
    if build_record.get("standing") != "historical-unratified-prelocal-build-record":
        die("historical build record has release/acceptance standing")
    print(
        f"historical build record remains distinct: {build_record['suite_version']} "
        f"recorded {build_record['recorded_at']}; unratified"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
