#!/usr/bin/env python3
"""OP18_AFB100R — the routed-feedback discriminator (build_op16_17 pattern).

Same derivation as build_op16_17.py (base OP7_OSCB.als, same ET + gzip
mtime=0 convention). Where OP14/15/16 pinned Operator.0/Feedback with B
muted (the carrier-feedback null, sealed flat), OP18 keeps the OP7 voice —
B on at defaults, A+B audible at Algorithm 0 — and raises Osc A Feedback
Manual to 100 (top of the 0..100 MidiControllerRange).

  OP18_AFB100R  Operator.0/Feedback -> 100, B untouched. If Operator
                feedback acts on the routed pair, the B->A modulation loop
                self-FMs and the beta/harmonic structure shifts vs OP7;
                flat = the routed null seals too.

Usage: build_op18.py   (writes harness/live/OP18_AFB100R.als)
"""
import gzip
import xml.etree.ElementTree as ET
from pathlib import Path

LIVE = Path(__file__).resolve().parent / "live"
BASE = "OP7_OSCB.als"


def save(root, out: Path):
    xml = ET.tostring(root, encoding="unicode")
    data = ('<?xml version="1.0" encoding="UTF-8"?>\n' + xml).encode()
    with gzip.GzipFile(str(out), "wb", mtime=0) as f:
        f.write(data)
    print(f"built {out.name}")


def shell(dev, name, param_tag):
    """Targeted pin inside one Operator shell (root.find('.//X') would hit
    the Operator.0 shell first — Operator.0/Globals share tags)."""
    sh = dev.find(name)
    assert sh is not None, name
    el = sh.find(param_tag)
    assert el is not None, f"{name}/{param_tag}"
    man = el.find("Manual")
    assert man is not None, f"{name}/{param_tag}/Manual"
    return man


root = ET.parse(gzip.open(LIVE / BASE)).getroot()
dev = root.find(".//Operator")
man = shell(dev, "Operator.0", "Feedback")
old = man.get("Value")
man.set("Value", "100")
print(f"  Operator.0/Feedback: {old} -> 100   (base {BASE})")
save(root, LIVE / "OP18_AFB100R.als")

# verification pass: re-read and print the edited + untouched values
print("\nverify:")
root = ET.parse(gzip.open(LIVE / "OP18_AFB100R.als")).getroot()
dev = root.find(".//Operator")
vols = [dev.find(f"Operator.{i}/Volume/Manual").get("Value") for i in range(4)]
fbs = [dev.find(f"Operator.{i}/Feedback/Manual").get("Value") for i in range(4)]
fb_max = dev.find("Operator.0/Feedback/MidiControllerRange/Max").get("Value")
alg = dev.find("Globals/Algorithm/Manual").get("Value")
print(f"  vols={vols} fbs={fbs} (range max {fb_max}) alg={alg}")
assert fbs[0] == "100" and fbs[1] == "0"
assert vols[0] == "1" and vols[1] == "1"
assert vols[2] == "0.0003162277571" and vols[3] == "0.0003162277571"
print("  ok: OP18 A+B audible at defaults, A Feedback 100 of 0..100, B fb 0")
