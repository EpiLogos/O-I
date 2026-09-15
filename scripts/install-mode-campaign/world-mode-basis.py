#!/usr/bin/env python3
"""Extract the install-mode basis from an `oi current-world --json` document.

Usage: world-mode-basis.py <world.json>  -> "requested" | "effective" | "none"
"""
import json
import sys

world = json.load(open(sys.argv[1]))
basis = (world.get("context_frame") or {}).get("install_mode_basis")
print(basis if basis else "none")
