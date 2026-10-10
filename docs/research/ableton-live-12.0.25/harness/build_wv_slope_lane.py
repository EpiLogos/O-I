#!/usr/bin/env python3
"""Attack/Release slope-family probe sets, 2026-10-09 lane (D16 aftermath).

  WV22_ASLP0    Slopes_Attack Manual 0 -> 0.0 (the brief's pin; numerically
                the M2 default — serves as the ET-round-trip control)
  WV23_RSLP0    Slopes_Release Manual 0.5 -> 0.0 (family k->0 limit:
                release predicted linear-to-zero at the stored time)
  WV24_ASLP1    Slopes_Attack Manual 0 -> 1.0 (the informative attack
                probe: family predicts k = 7.41, mid-ramp 2.4% of peak vs
                50% linear — decisive at sample level in the 1 ms ramp)

Base: WV8_SLOPE0.als (the M2 lineage on disk — M2_WAVETABLE.als itself was
never committed). Each set restores Slopes_Decay to the M2 default 0.5 and
pins ONE slope, so each differs from the M2 default patch by that one pin.
Method: build_wv_lane2.py's convention — xml.etree round-trip, gzip
mtime=0; clip Time stamped; v5 note serialization untouched (the M2
4-note staircase is kept as-is: notes at 0/1/2/3 s, loop 11.75 beats =
5.875 s, so note 3's release (3.875-4.475 s) is the clean, successor-free
release window and note 0 is the clean attack window).
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


def derive(base, out_name, edits):
    root = ET.parse(gzip.open(LIVE / base)).getroot()
    edits(root)
    save(root, LIVE / out_name)


DECAY_DEFAULT = "0.5"   # M2 stored default (WV8 lineage carries 0.0)

for slopes, out in [
    ({"Slopes_Decay": DECAY_DEFAULT, "Slopes_Attack": "0.0"}, "WV22_ASLP0.als"),
    ({"Slopes_Decay": DECAY_DEFAULT, "Slopes_Release": "0.0"}, "WV23_RSLP0.als"),
    ({"Slopes_Decay": DECAY_DEFAULT, "Slopes_Attack": "1.0"}, "WV24_ASLP1.als"),
]:
    def edit(r, s=slopes):
        for tag, v in s.items():
            set_manual(r, f"Voice_Modulators_AmpEnvelope_{tag}", v)
    derive("WV8_SLOPE0.als", out, edit)


# ---- verification pass: re-read from disk + XML diff vs the WV8 base ----
print("\nverify (re-read from disk):")
for name in ("WV22_ASLP0.als", "WV23_RSLP0.als", "WV24_ASLP1.als"):
    root = ET.parse(gzip.open(LIVE / name)).getroot()
    vals = {}
    for tag in ("Slopes_Attack", "Slopes_Decay", "Slopes_Release"):
        el = root.find(f".//Voice_Modulators_AmpEnvelope_{tag}")
        vals[tag] = el.find("Manual").get("Value")
    tr = root.find("LiveSet/Transport")
    loop = tr.find("LoopLength").get("Value")
    lon = tr.find("LoopOn").get("Value")
    nn = len(list(root.iter("MidiNoteEvent")))
    times = [root.find(f".//Voice_Modulators_AmpEnvelope_Times_{t}").find("Manual").get("Value")
             for t in ("Attack", "Decay", "Release")]
    sus = root.find(".//Voice_Modulators_AmpEnvelope_Sustain").find("Manual").get("Value")
    print(f"  {name:16s} notes={nn} loop={lon}/{loop} A/D/R_times={times} "
          f"sustain={sus} slopes A/D/R={vals['Slopes_Attack']}/{vals['Slopes_Decay']}/{vals['Slopes_Release']}")

print("\nXML element diff vs WV8_SLOPE0.als (tag+attrs only; everything else must be identical):")
import itertools


def flat(path):
    r = ET.parse(gzip.open(path)).getroot()
    return [(e.tag, tuple(sorted(e.attrib.items()))) for e in r.iter()]


base = flat(LIVE / "WV8_SLOPE0.als")
for name in ("WV22_ASLP0.als", "WV23_RSLP0.als", "WV24_ASLP1.als"):
    new = flat(LIVE / name)
    diffs = [(b, n) for b, n in zip(base, new) if b != n]
    print(f"  {name}: {len(diffs)} differing elements")
    for b, n in diffs:
        print(f"    - {b[0]}: {dict(b[1])}")
        print(f"    + {n[0]}: {dict(n[1])}")
    assert len(base) == len(new), f"{name}: element count changed"
