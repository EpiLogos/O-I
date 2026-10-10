#!/usr/bin/env python3
"""OP16_AFB100 + OP17_OSCD — the round-6 discriminators (build_op15 pattern).

Same derivation as build_op15.py (base OP7_OSCB.als, same ET + gzip mtime=0
convention):

  OP16_AFB100  Operator.1/Volume -> the -70 dB off floor (B off: the M1
               voice) AND Operator.0/Feedback -> 100 — the top of the
               MidiControllerRange (Min=0 Max=100; OP15 proved stored values
               are on the 0..100 scale). Seals or breaks the carrier-feedback
               null at max.

  OP17_OSCD    B -> off, C -> off, D (Operator.3/Volume) -> 1 — A carrier
               plus the D shell, mirroring how OP7 enabled B and how OP13
               left the "B off, C on" state. Algorithm 0 unchanged.

Usage: build_op16_17.py   (writes harness/live/OP16_AFB100.als, OP17_OSCD.als)
"""
import gzip
import xml.etree.ElementTree as ET
from pathlib import Path

LIVE = Path(__file__).resolve().parent / "live"
BASE = "OP7_OSCB.als"
OFF = "0.0003162277571"  # the muted-shell floor carried by the OP7 set


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


def derive(base, out_name, edits):
    root = ET.parse(gzip.open(LIVE / base)).getroot()
    dev = root.find(".//Operator")
    for where, param_tag, value in edits:
        man = shell(dev, where, param_tag)
        old = man.get("Value")
        man.set("Value", value)
        print(f"  {where}/{param_tag}: {old} -> {value}   (base {base})")
    save(root, LIVE / out_name)


derive(BASE, "OP16_AFB100.als", [
    ("Operator.1", "Volume", OFF),
    ("Operator.0", "Feedback", "100"),
])

derive(BASE, "OP17_OSCD.als", [
    ("Operator.1", "Volume", OFF),
    ("Operator.3", "Volume", "1"),
])

# verification pass: re-read and print the edited + untouched values
print("\nverify:")
for name in ("OP16_AFB100.als", "OP17_OSCD.als"):
    root = ET.parse(gzip.open(LIVE / name)).getroot()
    dev = root.find(".//Operator")
    vols = [dev.find(f"Operator.{i}/Volume/Manual").get("Value") for i in range(4)]
    a_fb = dev.find("Operator.0/Feedback/Manual").get("Value")
    fb_max = dev.find("Operator.0/Feedback/MidiControllerRange/Max").get("Value")
    alg = dev.find("Globals/Algorithm/Manual").get("Value")
    print(f"  {name:18s} vols={vols} A_fb={a_fb} (range max {fb_max}) alg={alg}")

root = ET.parse(gzip.open(LIVE / "OP16_AFB100.als")).getroot()
dev = root.find(".//Operator")
assert dev.find("Operator.0/Feedback/Manual").get("Value") == "100"
assert dev.find("Operator.1/Volume/Manual").get("Value") == OFF
assert float(dev.find("Operator.0/Volume/Manual").get("Value")) == 1.0
print("  ok: OP16 A carrier, B off, A Feedback 100 of 0..100")

root = ET.parse(gzip.open(LIVE / "OP17_OSCD.als")).getroot()
dev = root.find(".//Operator")
assert dev.find("Operator.1/Volume/Manual").get("Value") == OFF
assert dev.find("Operator.2/Volume/Manual").get("Value") == OFF
assert dev.find("Operator.3/Volume/Manual").get("Value") == "1"
assert float(dev.find("Operator.0/Volume/Manual").get("Value")) == 1.0
print("  ok: OP17 A on, B off, C off, D on — all at defaults")
