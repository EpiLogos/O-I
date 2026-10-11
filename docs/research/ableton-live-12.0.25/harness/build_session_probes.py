#!/usr/bin/env python3
"""Session probes 2026-10-09 (night lane): derive probe sets from existing ones.

Families (each = base set + one Manual/transport edit, everything else
byte-equivalent structure via the same ET round-trip build_set.py uses):

  WMR_*   clean-boot re-render family — WM_BASE / WM_S8 / WM_S9 / WM_S12
          (mod sources 8/9/12 -> Amp at amount 1.0) and midi-wm-a10
          (velocity route 10 -> Amp) with the transport loop shrunk to
          11.75 beats (the WMA8_* convention; native 512 beats renders
          256 s for no behavioral delta).

  WV1[456]_AMT*  unison Amount WITHIN 0..1 — WV9B_UNIM1 (Mode 1, VoiceCount 3)
          with Voice_Unison_Amount Manual -> 0.25 / 0.50 / 0.75 (D15 open:
          spread-vs-amount law; 1.0 exists, >1 clamps).

  EC1[123]_AMT*  Echo AmountDelay depth on the bare line — E8_BARE
          (filter/duck/reverb off, mod LFO 2 Hz phase 90 synced) with
          Modulation_AmountDelay Manual -> 0.10 / 0.35 / 0.75 (round-3
          open: exact depth curve; amount 0 = E8_BARE itself, 0.5 =
          full-preset EC8_MOD50).

Usage: build_session_probes.py   (writes into harness/live/)
"""
import gzip
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path

LIVE = Path(__file__).resolve().parent / "live"
LOOP = "11.75"  # beats; the WMA8_*/WV9B shrunk-loop convention


def save(root, out: Path):
    xml = ET.tostring(root, encoding="unicode")
    data = ('<?xml version="1.0" encoding="UTF-8"?>\n' + xml).encode()
    with gzip.GzipFile(str(out), "wb", mtime=0) as f:
        f.write(data)
    print(f"built {out.name}")


def shrink_loop(root, length=LOOP):
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


def set_manual(root, param_tag, value):
    el = root.find(f".//{param_tag}")
    assert el is not None, param_tag
    man = el.find("Manual")
    assert man is not None, param_tag + "/Manual"
    man.set("Value", value)


def derive(base, out_name, edits):
    src = LIVE / base
    root = ET.parse(gzip.open(src)).getroot()
    edits(root)
    save(root, LIVE / out_name)


# ---- batch 1: clean-boot re-render family (loop shrink only) ----
for src, out in [("WM_BASE.als", "WMR_BASE.als"),
                 ("WM_S8.als", "WMR_S8.als"),
                 ("WM_S9.als", "WMR_S9.als"),
                 ("WM_S12.als", "WMR_S12.als"),
                 ("midi-wm-a10.als", "WMR_A10.als")]:
    derive(src, out, shrink_loop)

# ---- batch 2: unison Amount within 0..1 ----
for amt, out in [("0.25", "WV14_AMT25.als"),
                 ("0.5", "WV15_AMT50.als"),
                 ("0.75", "WV16_AMT75.als")]:
    derive("WV9B_UNIM1.als", out, lambda r, a=amt: set_manual(r, "Voice_Unison_Amount", a))

# ---- batch 3: Echo AmountDelay depth on the bare line ----
for amt, out in [("0.1", "EC10_AMT10.als"),
                 ("0.35", "EC11_AMT35.als"),
                 ("0.75", "EC12_AMT75.als")]:
    def edit(r, a=amt):
        set_manual(r, "Modulation_AmountDelay", a)
        shrink_loop(r, "10.0")
    derive("E8_BARE.als", out, edit)

# ---- verification pass: re-read and print the edited values ----
print("\nverify:")
for name, checks in [
    ("WMR_BASE.als", [("LiveSet/Transport/LoopLength", None)]),
    ("WMR_S8.als", [("LiveSet/Transport/LoopLength", None)]),
    ("WMR_S9.als", [("LiveSet/Transport/LoopLength", None)]),
    ("WMR_S12.als", [("LiveSet/Transport/LoopLength", None)]),
    ("WMR_A10.als", [("LiveSet/Transport/LoopLength", None)]),
    ("WV14_AMT25.als", [("Voice_Unison_Amount", "Manual"), ("LiveSet/Transport/LoopLength", None)]),
    ("WV15_AMT50.als", [("Voice_Unison_Amount", "Manual"), ("LiveSet/Transport/LoopLength", None)]),
    ("WV16_AMT75.als", [("Voice_Unison_Amount", "Manual"), ("LiveSet/Transport/LoopLength", None)]),
    ("EC10_AMT10.als", [("Modulation_AmountDelay", "Manual"), ("LiveSet/Transport/LoopLength", None)]),
    ("EC11_AMT35.als", [("Modulation_AmountDelay", "Manual"), ("LiveSet/Transport/LoopLength", None)]),
    ("EC12_AMT75.als", [("Modulation_AmountDelay", "Manual"), ("LiveSet/Transport/LoopLength", None)]),
]:
    root = ET.parse(gzip.open(LIVE / name)).getroot()
    vals = []
    for tag, child in checks:
        el = root.find(f".//{tag}")
        v = el.find(child).get("Value") if child else el.get("Value")
        vals.append(f"{tag.split('/')[-1]}={v}")
    print(f"  {name:18s} {' '.join(vals)}")
