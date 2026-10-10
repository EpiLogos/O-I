#!/usr/bin/env python3
"""OP15_AFB25 — the OP14 discriminating follow-up: a larger Feedback pin.

Same derivation as build_op_probes2.py's OP14 (base OP7_OSCB.als, same ET +
gzip mtime=0 convention): Operator.1/Volume -> the -70 dB off floor (B off:
the M1 voice) AND Operator.0/Feedback -> 25. The set XML carries
MidiControllerRange Min=0 Max=100 for Feedback, so Manual values are on the
displayed 0..100 scale — 25 means 25 % (OP14's 0.5 was 0.5 %, subliminal).

Usage: build_op15.py   (writes harness/live/OP15_AFB25.als)
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


derive(BASE, "OP15_AFB25.als", [
    ("Operator.1", "Volume", OFF),
    ("Operator.0", "Feedback", "25"),
])

# verification pass: re-read and print the edited + untouched values
print("\nverify:")
root = ET.parse(gzip.open(LIVE / "OP15_AFB25.als")).getroot()
dev = root.find(".//Operator")
a_vol = dev.find("Operator.0/Volume/Manual").get("Value")
b_vol = dev.find("Operator.1/Volume/Manual").get("Value")
a_fb = dev.find("Operator.0/Feedback/Manual").get("Value")
fb_min = dev.find("Operator.0/Feedback/MidiControllerRange/Min").get("Value")
fb_max = dev.find("Operator.0/Feedback/MidiControllerRange/Max").get("Value")
alg = dev.find("Globals/Algorithm/Manual").get("Value")
g_vol = dev.find("Globals/Volume/Manual").get("Value")
loop = root.find("LiveSet/Transport/LoopLength").get("Value")
print(f"  OP15_AFB25   A_vol={a_vol} B_vol={b_vol} A_fb={a_fb} "
      f"(range {fb_min}..{fb_max}) Algorithm={alg} G_vol={g_vol} loop={loop}")
assert a_fb == "25" and b_vol == OFF and float(a_vol) == 1.0, "edit did not land"
print("  ok: B off, A Feedback 25 of 0..100")
