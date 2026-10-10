#!/usr/bin/env python3
"""Operator oscillator-shell probes (night round 2, lane 1): derive from M1.

Base set: midi-operator.als (the M1 clip — 4-note velocity staircase
127/96/64/32 at key 48/C3, transport loop 512 beats = the committed
M1_OPERATOR.aif render convention). One edit per probe, everything else
byte-equivalent structure via the same ET round-trip + gzip mtime=0 save
build_session_probes.py uses.

  OP7_OSCB      Operator.1 (Osc B) Volume Manual -> 1 (= osc A's factory
                level, 0 dB). The factory default stores IsOn=true on all
                four shells — the mute is the Volume floor (-70 dB), not
                the switch (params.rs OPERATOR note) — so "switching B on"
                is raising its level; 1.0 is the only pinned audible value
                the factory itself uses (Operator.0/Volume).
  OP8_OSCB050   OP7 + Osc B Volume -> 0.5 (-6.02 dB): does shell B's effect
                scale with the linear-amplitude level law measured on
                shell A (OP3)?
  OP9_WF22      OP7 + Osc B WaveForm -> 22 (the only other observed extent
                value, preset-choir.xml): first behavioral probe of the
                bare-integer WaveForm path (params.rs: labels unknown,
                semantic unverified). Derived from OP7, not the muted M1
                patch — at the -70 dB floor a WaveForm change is blind
                (OP7 finding: B's audible role is a modulator, index set
                by its Volume).

Usage: build_lane1_probes.py   (writes into harness/live/)
"""
import gzip
import xml.etree.ElementTree as ET
from pathlib import Path

LIVE = Path(__file__).resolve().parent / "live"
BASE = "midi-operator.als"


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


def derive(base, out_name, value, param_tag):
    root = ET.parse(gzip.open(LIVE / base)).getroot()
    dev = root.find(".//Operator")
    man = shell(dev, "Operator.1", param_tag)
    old = man.get("Value")
    man.set("Value", value)
    print(f"  {param_tag}: {old} -> {value}   (base {base})")
    save(root, LIVE / out_name)


derive(BASE, "OP7_OSCB.als", "1", "Volume")
derive("OP7_OSCB.als", "OP8_OSCB050.als", "0.5", "Volume")
derive("OP7_OSCB.als", "OP9_WF22.als", "22", "WaveForm")

# verification pass: re-read and print the edited + untouched values
print("\nverify:")
for name in ("OP7_OSCB.als", "OP8_OSCB050.als", "OP9_WF22.als"):
    root = ET.parse(gzip.open(LIVE / name)).getroot()
    dev = root.find(".//Operator")
    a_vol = dev.find("Operator.0/Volume/Manual").get("Value")
    b_vol = dev.find("Operator.1/Volume/Manual").get("Value")
    a_wf = dev.find("Operator.0/WaveForm/Manual").get("Value")
    b_wf = dev.find("Operator.1/WaveForm/Manual").get("Value")
    b_ison = dev.find("Operator.1/IsOn/Manual").get("Value")
    b_sus = dev.find("Operator.1/Envelope/SustainLevel/Manual").get("Value")
    b_dt = dev.find("Operator.1/Envelope/DecayTime/Manual").get("Value")
    g_vol = dev.find("Globals/Volume/Manual").get("Value")
    loop = root.find("LiveSet/Transport/LoopLength").get("Value")
    print(f"  {name:16s} A_vol={a_vol} B_vol={b_vol} A_wf={a_wf} B_wf={b_wf} "
          f"B_isOn={b_ison} B_sus={b_sus} B_decayT={b_dt} G_vol={g_vol} "
          f"loop={loop}")
