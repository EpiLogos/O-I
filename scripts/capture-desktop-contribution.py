#!/usr/bin/env python3
"""Capture a reviewed owner contribution from exact Git objects, never a dirty tree."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument("manifest", type=Path)
parser.add_argument("object_store", type=Path)
parser.add_argument("destination", type=Path)
args = parser.parse_args()
manifest = json.loads(args.manifest.read_text())
revision = manifest["candidate"]
if len(revision) != 40 or any(c not in "0123456789abcdef" for c in revision):
    raise SystemExit("An exact reviewed candidate commit is required")
prefix = str(PurePosixPath(manifest["entry"]).parent) + "/"
files = {}
for source, expected in manifest["files_sha256"].items():
    if not source.startswith(prefix) or ".." in PurePosixPath(source).parts:
        raise SystemExit("Contribution path is outside its declared entry root")
    data = subprocess.check_output(["git", f"--git-dir={args.object_store}", "show", f"{revision}:{source}"])
    if hashlib.sha256(data).hexdigest() != expected:
        raise SystemExit(f"Reviewed source digest changed: {source}")
    files[source[len(prefix):]] = data
if args.destination.exists():
    raise SystemExit("Destination already exists; review an explicit contribution update")
args.destination.mkdir(parents=True)
for relative, data in files.items():
    path = args.destination / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
manifest.pop("source_root", None)
manifest["capture"] = "Exact Git blobs; update through owner candidate, never edit captured source"
manifest["captured_files_sha256"] = {p: hashlib.sha256(data).hexdigest() for p, data in files.items()}
(args.destination / "contribution.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(f"Captured {len(files)} verified owner files at {revision}")
