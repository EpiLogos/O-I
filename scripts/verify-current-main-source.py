#!/usr/bin/env python3
"""Exercise one exact native product source revision from O:I's current catalogue.

The product owns its build and source-verification operations through
`.oi/product.json`. O:I owns selecting the exact suite revision, executing that
owner contract and retaining a composition receipt. The historical
`suite/manifest.json` is build evidence only and is never CI configuration.
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
LIFECYCLE_PATH = Path(".oi/product.json")


def fail(message: str) -> None:
    raise SystemExit(f"exact source verification failed: {message}")


def load(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        fail(f"{path}: expected JSON object")
    return value


def run(command: list[str], *, cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    print("+", " ".join(command), flush=True)
    return subprocess.run(command, cwd=cwd, text=True, check=False)


def command(value: object, context: str) -> list[str]:
    if not isinstance(value, list) or not value or not all(isinstance(part, str) and part for part in value):
        fail(f"{context}: expected a non-empty command array")
    return value


def surface_contract(product_id: str) -> dict:
    surfaces = load(SURFACES).get("surfaces", [])
    surface = next((item for item in surfaces if item.get("id") == product_id), None)
    if surface is None:
        fail(f"no current surface for {product_id}")
    return surface


def verify(product_id: str, receipt_path: Path | None) -> int:
    surface = surface_contract(product_id)
    repository = surface.get("repository")
    revision = surface.get("docs_ref")
    install = surface.get("install", {})
    if not isinstance(repository, str) or not repository.startswith("https://github.com/"):
        fail(f"{product_id}: invalid repository {repository!r}")
    if not isinstance(revision, str) or len(revision) != 40:
        fail(f"{product_id}: invalid source revision {revision!r}")
    if install.get("revision") != revision or install.get("ref") != revision:
        fail(f"{product_id}: source descriptor is internally inconsistent")

    started = time.time()
    temp_root = Path(tempfile.mkdtemp(prefix=f"oi-source-{product_id}-"))
    checkout = temp_root / "source"
    result = {
        "schema": "oi.current-main-source-evidence/v2",
        "product": product_id,
        "repository": repository,
        "revision": revision,
        "lifecycle_contract": str(LIFECYCLE_PATH),
        "build_command": None,
        "verification_command": None,
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
        head = subprocess.check_output(["git", "-C", str(checkout), "rev-parse", "HEAD"], text=True).strip()
        result["head"] = head
        if head != revision:
            fail(f"{product_id}: checked out {head}, expected {revision}")

        lifecycle_file = checkout / LIFECYCLE_PATH
        if not lifecycle_file.is_file():
            fail(f"{product_id}: owner lifecycle contract is missing")
        lifecycle = load(lifecycle_file)
        if lifecycle.get("schema") != "oi.product-lifecycle/v1":
            fail(f"{product_id}: unsupported lifecycle schema {lifecycle.get('schema')!r}")
        if lifecycle.get("id") != product_id:
            fail(f"{product_id}: lifecycle id is {lifecycle.get('id')!r}")
        if lifecycle.get("repository") != repository:
            fail(f"{product_id}: lifecycle repository disagrees with suite source")

        build = command(lifecycle.get("build", {}).get("command"), f"{product_id}.build.command")
        source_verify = command(lifecycle.get("verify", {}).get("source_command"), f"{product_id}.verify.source_command")
        result["build_command"] = build
        result["verification_command"] = source_verify

        built = run(build, cwd=checkout)
        if built.returncode != 0:
            fail(f"{product_id}: owner build contract exited {built.returncode}")
        tested = run(source_verify, cwd=checkout)
        if tested.returncode != 0:
            fail(f"{product_id}: owner source verification exited {tested.returncode}")

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
