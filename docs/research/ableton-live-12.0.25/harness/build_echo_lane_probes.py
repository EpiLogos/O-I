#!/usr/bin/env python3
"""Echo lane (echo/round-5) probe sets, 2026-10-09.

Derives probe sets from existing ones via the same ET round-trip +
gzip mtime=0 convention as build_session_probes.py.

  EC13_THR21 / EC14_THR27 / EC15_THR33
      delta(thr) sweep — EC9_DUCK_TONE_STAIRCASE.als (round-3 duck
      staircase lineage: EC6/EC7 recipe, steps-long.wav, 31-beat loop,
      Ducking_On, unity clip gain) with ONLY Ducking_Threshold Manual
      changed -> -21 / -27 / -33. Combined with the archived round-3
      points thr -24 (EC9_DUCK_TONE_STAIRCASE.aif) and thr -30
      (EC9C_DUCK_T30.aif, rendered from EC9C_DUCK_T30.als = same base,
      only threshold changed) this gives a five-point delta(thr) mapping.
      Loop left at the base's 31.0 beats (15.5 s render, as archived).

  ET1_TIMELINK
      backlog (d): TimeLink=false free-mode pair with tL/tR ratio != 2 —
      E5_FREEMODE.als (free mode, SyncL/R=false, tL=0.25) with
      Delay_TimeLink Manual -> false and Delay_TimeR Manual -> 0.4
      (ratio 1.6, so "each channel at its own time", "grid = min()" and
      "loader force-equal" are distinguishable). Transport loop shrunk
      512 -> 10.0 beats (the round-4 EC10/11/12 impulse convention;
      impulse.wav is 4 s).

Usage: build_echo_lane_probes.py   (writes into harness/live/)
"""
import gzip
import xml.etree.ElementTree as ET
from pathlib import Path

LIVE = Path(__file__).resolve().parent / "live"


def save(root, out: Path):
    xml = ET.tostring(root, encoding="unicode")
    data = ('<?xml version="1.0" encoding="UTF-8"?>\n' + xml).encode()
    with gzip.GzipFile(str(out), "wb", mtime=0) as f:
        f.write(data)
    print(f"built {out.name}")


def set_manual(root, param_tag, value):
    el = root.find(f".//{param_tag}")
    assert el is not None, param_tag
    man = el.find("Manual")
    assert man is not None, param_tag + "/Manual"
    man.set("Value", value)


def shrink_loop(root, length):
    transport = root.find("LiveSet/Transport")
    for tag in ("LoopLength", "LoopEnd"):
        el = transport.find(tag)
        if el is not None:
            el.set("Value", length)
    lon = transport.find("LoopOn")
    if lon is not None:
        lon.set("Value", "true")
    lst = transport.find("LoopStart")
    if lst is not None:
        lst.set("Value", "0")


def derive(base, out_name, edits):
    root = ET.parse(gzip.open(LIVE / base)).getroot()
    edits(root)
    save(root, LIVE / out_name)


# ---- delta(thr) sweep: only Ducking_Threshold moves, loop stays 31.0 ----
for thr, out in [("-21", "EC13_THR21.als"),
                 ("-27", "EC14_THR27.als"),
                 ("-33", "EC15_THR33.als")]:
    derive("EC9_DUCK_TONE_STAIRCASE.als", out,
           lambda r, t=thr: set_manual(r, "Ducking_Threshold", t))

# ---- TimeLink=false, tR = 0.4 s (tL stays 0.25) ----
def et1_edit(r):
    set_manual(r, "Delay_TimeLink", "false")
    set_manual(r, "Delay_TimeR", "0.4")
    shrink_loop(r, "10.0")

derive("E5_FREEMODE.als", "ET1_TIMELINK.als", et1_edit)

# ---- verification pass: re-read and print the edited values ----
print("\nverify:")
for name, checks in [
    ("EC13_THR21.als", [("Ducking_Threshold", "Manual"), ("LiveSet/Transport/LoopLength", None)]),
    ("EC14_THR27.als", [("Ducking_Threshold", "Manual"), ("LiveSet/Transport/LoopLength", None)]),
    ("EC15_THR33.als", [("Ducking_Threshold", "Manual"), ("LiveSet/Transport/LoopLength", None)]),
    ("ET1_TIMELINK.als", [("Delay_TimeLink", "Manual"), ("Delay_TimeL", "Manual"),
                          ("Delay_TimeR", "Manual"), ("Delay_SyncL", "Manual"),
                          ("Delay_SyncR", "Manual"), ("LiveSet/Transport/LoopLength", None)]),
]:
    root = ET.parse(gzip.open(LIVE / name)).getroot()
    vals = []
    for tag, child in checks:
        el = root.find(f".//{tag}")
        v = el.find(child).get("Value") if child else el.get("Value")
        vals.append(f"{tag.split('/')[-1]}={v}")
    print(f"  {name:22s} {' '.join(vals)}")
