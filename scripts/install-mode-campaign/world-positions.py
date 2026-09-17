#!/usr/bin/env python3
"""Canonical position summary of an `oi current-world --json` document.

Used to prove no identity drift and no world reconstruction across restart
and composition changes: the same products with the same revisions and
presence must produce byte-identical summaries.

Usage: world-positions.py   (reads stdin, writes canonical JSON to stdout)
"""
import json
import sys

world = json.load(sys.stdin)
rows = [
    {
        "position": p.get("position"),
        "product_id": p.get("product_id"),
        "present": p.get("present"),
        "state": p.get("state"),
        "accepted_revision": p.get("accepted_revision"),
        "modality": p.get("modality"),
        "install_source": p.get("install_source"),
    }
    for p in world.get("positions", [])
]
rows.sort(key=lambda r: r["position"] or 0)
json.dump(rows, sys.stdout, indent=1, sort_keys=True)
sys.stdout.write("\n")
