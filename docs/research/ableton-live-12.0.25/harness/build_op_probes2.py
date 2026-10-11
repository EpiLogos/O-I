#!/usr/bin/env python3
"""Operator shell C/D + feedback probes (night round 2, lane 3 follow-up).

Derived from the committed lane-1 base OP7_OSCB.als (same ET round-trip +
gzip mtime=0 save convention as build_lane1_probes.py). One to three pins
per probe:

  OP12_ALG7CD   Globals/Algorithm -> 7 AND Operator.2/Volume -> 0.25 AND
                Operator.3/Volume -> 0.25. The discriminating probe OP11
                could not run: at Algorithm 7 with C/D on the -70 dB floor
                the acoustic null cannot separate "Algorithm is sonically
                inert" from "Algorithm only re-routes the muted C/D
                shells". Here C/D are audible; if the spectrum changes vs
                OP7 the Algorithm routes voices.
  OP13_OSCC     Operator.1/Volume -> 0.0003162277571 (the -70 dB off floor
                the OP7 set itself carries for muted shells) AND
                Operator.2/Volume -> 1.0 (shell C on at the same default
                level A and B carry). Shell C level law check vs A.
  OP14_AFB050   Operator.1/Volume -> 0.0003162277571 (B off: the M1 voice)
                AND Operator.0/Feedback -> 0.5 (params.rs range 0..100).
                Does 0.5 % feedback enrich A's own harmonics (self-FM)?

Usage: build_op_probes2.py   (writes into harness/live/)
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


derive(BASE, "OP12_ALG7CD.als", [
    ("Globals", "Algorithm", "7"),
    ("Operator.2", "Volume", "0.25"),
    ("Operator.3", "Volume", "0.25"),
])
derive(BASE, "OP13_OSCC.als", [
    ("Operator.1", "Volume", OFF),
    ("Operator.2", "Volume", "1.0"),
])
derive(BASE, "OP14_AFB050.als", [
    ("Operator.1", "Volume", OFF),
    ("Operator.0", "Feedback", "0.5"),
])

# verification pass: re-read and print the edited + untouched values
print("\nverify:")
for name in ("OP12_ALG7CD.als", "OP13_OSCC.als", "OP14_AFB050.als"):
    root = ET.parse(gzip.open(LIVE / name)).getroot()
    dev = root.find(".//Operator")
    a_vol = dev.find("Operator.0/Volume/Manual").get("Value")
    b_vol = dev.find("Operator.1/Volume/Manual").get("Value")
    c_vol = dev.find("Operator.2/Volume/Manual").get("Value")
    d_vol = dev.find("Operator.3/Volume/Manual").get("Value")
    a_fb = dev.find("Operator.0/Feedback/Manual").get("Value")
    alg = dev.find("Globals/Algorithm/Manual").get("Value")
    g_vol = dev.find("Globals/Volume/Manual").get("Value")
    loop = root.find("LiveSet/Transport/LoopLength").get("Value")
    print(f"  {name:16s} A_vol={a_vol} B_vol={b_vol} C_vol={c_vol} "
          f"D_vol={d_vol} A_fb={a_fb} Algorithm={alg} G_vol={g_vol} "
          f"loop={loop}")
