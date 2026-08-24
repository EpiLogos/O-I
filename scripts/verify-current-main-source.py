#!/usr/bin/env python3
"""Exercise one exact product source revision from O:I's source catalogue.

This is intentionally distinct from the immutable released-artifact suite. O:I #97's
remote handoff uses this verifier for its explicitly in-scope native-main owners before
a physical workstation inhabits that source world. The separately owned Quaternal
Logic product may retain a stable suite pin while its own development programme moves;
it is therefore not part of #97's current-main workflow matrix.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SURFACES = ROOT / "surfaces.json"
RELEASE_MANIFEST = ROOT / "suite/manifest.json"


def fail(message: str) -> None:
    raise SystemExit(f"exact source verification failed: {message}")


def load(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def run(command: list[str], *, cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    print("+", " ".join(command), flush=True)
    return subprocess.run(command, cwd=cwd, text=True, check=False)


def product_contract(product_id: str) -> tuple[dict, dict]:
    surfaces = load(SURFACES).get("surfaces", [])
    products = load(RELEASE_MANIFEST).get("products", [])
    surface = next((item for item in surfaces if item.get("id") == product_id), None)
    product = next((item for item in products if item.get("id") == product_id), None)
    if surface is None:
        fail(f"no current surface for {product_id}")
    if product is None:
        fail(f"no native test contract for {product_id}")
    return surface, product


def verify(product_id: str, receipt_path: Path | None) -> int:
    surface, product = product_contract(product_id)
    repository = surface.get("repository")
    revision = surface.get("docs_ref")
    install = surface.get("install", {})
    if not isinstance(repository, str) or not repository.startswith("https://github.com/"):
        fail(f"{product_id}: invalid repository {repository!r}")
    if not isinstance(revision, str) or len(revision) != 40:
        fail(f"{product_id}: invalid source revision {revision!r}")
    if install.get("revision") != revision or install.get("ref") != revision:
        fail(f"{product_id}: source descriptor is internally inconsistent")

    command = product.get("dev", {}).get("test", [])
    if not isinstance(command, list) or not command or not all(isinstance(part, str) and part for part in command):
        fail(f"{product_id}: native source test command is missing")

    started = time.time()
    temp_root = Path(tempfile.mkdtemp(prefix=f"oi-source-{product_id}-"))
    checkout = temp_root / "source"
    result = {
        "schema": "oi.current-main-source-evidence/v1",
        "product": product_id,
        "repository": repository,
        "revision": revision,
        "test_command": command,
        "status": "failed",
        "head": None,
        "elapsed_seconds": None,
    }
    try:
        if run(["git", "init", "--quiet", str(checkout)]).returncode != 0:
            fail(f"{product_id}: git init failed")
        if run(["git", "-C", str(checkout), "remote", "add", "origin", repository]).returncode != 0:
            fail(f"{product_id}: remote configuration failed")
        if run(["git", "-C", str(checkout), "fetch", "--depth", "1", "origin", revision]).returncode != 0:
            fail(f"{product_id}: exact source revision fetch failed")
        if run(["git", "-C", str(checkout), "checkout", "--quiet", "--detach", "FETCH_HEAD"]).returncode != 0:
            fail(f"{product_id}: exact source revision checkout failed")
        head = subprocess.check_output(
            ["git", "-C", str(checkout), "rev-parse", "HEAD"], text=True
        ).strip()
        result["head"] = head
        if head != revision:
            fail(f"{product_id}: checked out {head}, expected {revision}")

        test = run(command, cwd=checkout)
        if test.returncode != 0:
            fail(f"{product_id}: native source test contract exited {test.returncode}")
        result["status"] = "passed"
        return 0
    finally:
        result["elapsed_seconds"] = round(time.time() - started, 3)
        if receipt_path is not None:
            receipt_path.parent.mkdir(parents=True, exist_ok=True)
            receipt_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        if os.environ.get("OI_KEEP_CURRENT_MAIN_CHECKOUT") != "1":
            shutil.rmtree(temp_root, ignore_errors=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--product", required=True)
    parser.add_argument("--receipt", type=Path)
    args = parser.parse_args()
    return verify(args.product, args.receipt)


if __name__ == "__main__":
    sys.exit(main())
