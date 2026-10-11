#!/usr/bin/env python3
"""Operator index-law + Algorithm probes (night round 2, op-alg lane).

Derived from the committed lane-1 base OP7_OSCB.als (Osc B Volume = 1 on
the M1 clip) with the same ET round-trip + gzip mtime=0 save convention
(build_lane1_probes.py). One edit per probe:

  OP10_BV025    Operator.1/Volume -> 0.25 (-12.04 dB): the third point of
                the beta-vs-B-Volume line (0.212 at 1.0, 0.109 at 0.5;
                linear-in-Volume predicts 0.053).
  OP11_ALGX     Globals/Algorithm -> 7: the only other factory-observed
                stored value (preset-choir.xml; default 0). The maximal
                stack position — at the choir pin all four shells are
                audible, here C/D stay at the -70 dB floor so the pin asks
                one question: does moving the index change B's role
                (carrier/output voice -> new level or new fundamental)
                or only the stack topology (shape change / null)?

Usage: build_lane3_alg_probes.py   (writes into harness/live/)
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


def derive(base, out_name, edits):
    root = ET.parse(gzip.open(LIVE / base)).getroot()
    dev = root.find(".//Operator")
    for where, param_tag, value in edits:
        if where.startswith("Operator."):
            man = shell(dev, where, param_tag)
        else:
            el = dev.find(f"{where}/{param_tag}")
            assert el is not None, f"{where}/{param_tag}"
            man = el.find("Manual")
            assert man is not None, f"{where}/{param_tag}/Manual"
        old = man.get("Value")
        man.set("Value", value)
        print(f"  {where}/{param_tag}: {old} -> {value}   (base {base})")
    save(root, LIVE / out_name)


derive(BASE, "OP10_BV025.als", [("Operator.1", "Volume", "0.25")])
derive(BASE, "OP11_ALGX.als", [("Globals", "Algorithm", "7")])

# verification pass: re-read and print the edited + untouched values
print("\nverify:")
for name in ("OP10_BV025.als", "OP11_ALGX.als"):
    root = ET.parse(gzip.open(LIVE / name)).getroot()
    dev = root.find(".//Operator")
    a_vol = dev.find("Operator.0/Volume/Manual").get("Value")
    b_vol = dev.find("Operator.1/Volume/Manual").get("Value")
    c_vol = dev.find("Operator.2/Volume/Manual").get("Value")
    d_vol = dev.find("Operator.3/Volume/Manual").get("Value")
    alg = dev.find("Globals/Algorithm/Manual").get("Value")
    g_vol = dev.find("Globals/Volume/Manual").get("Value")
    loop = root.find("LiveSet/Transport/LoopLength").get("Value")
    print(f"  {name:16s} A_vol={a_vol} B_vol={b_vol} C_vol={c_vol} "
          f"D_vol={d_vol} Algorithm={alg} G_vol={g_vol} loop={loop}")
