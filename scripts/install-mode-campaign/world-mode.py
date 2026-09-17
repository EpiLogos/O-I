#!/usr/bin/env python3
"""Extract the install mode from an `oi current-world --json` document.

Usage: world-mode.py <world.json>   -> prints the frame notation or "none"
"""
import json
import sys

world = json.load(open(sys.argv[1]))
mode = (world.get("context_frame") or {}).get("install_mode")
print(mode if mode else "none")
