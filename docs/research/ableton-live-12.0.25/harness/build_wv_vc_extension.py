#!/usr/bin/env python3
"""VC-ladder extension probe sets (WV25/26/27), 2026-10-09.

VoiceCount N-extension on the WV9B_UNIM1 lineage (Mode 1, Amount 1.0):
the ONLY pin changed per set is Voice_Unison_VoiceCount.

  WV25_VC1   VoiceCount 3 -> 1   (N=1 floor: single voice, pan/gain anchor)
  WV26_VC5   VoiceCount 3 -> 5   (odd N beyond 3: spread + centre-voice deal)
  WV27_VC6   VoiceCount 3 -> 6   (even N beyond 4: does 6 = +-50/+-30/+-10?)

Method: the build_wv_lane2.py convention — xml.etree round-trip of the
base set, gzip with mtime=0 for reproducible bytes; clip Time stamped
(FA4_TIME lesson); v5 NoteIdGenerator shape kept as-is (notes untouched).
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


def set_voice_count(root, value):
    el = root.find(".//Voice_Unison_VoiceCount")
    assert el is not None, "Voice_Unison_VoiceCount"
    old = el.get("Value")
    el.set("Value", value)
    return old


def stamp_clip_time(root, value="0"):
    """FA4_TIME lesson: arrangement clips anchor at the clip Time attribute."""
    for clip in root.iter("MidiClip"):
        clip.set("Time", value)


def derive(base, out_name, count):
    root = ET.parse(gzip.open(LIVE / base)).getroot()
    old = set_voice_count(root, str(count))
    stamp_clip_time(root, "0")
    save(root, LIVE / out_name)
    return old


# ---- WV25/26/27: VoiceCount extension, one pin each ----
for count, out in [(1, "WV25_VC1.als"), (5, "WV26_VC5.als"), (6, "WV27_VC6.als")]:
    old = derive("WV9B_UNIM1.als", out, count)
    print(f"  Voice_Unison_VoiceCount {old} -> {count}")


# ---- verification pass: re-read from disk ----
print("\nverify:")
for name in ("WV25_VC1.als", "WV26_VC5.als", "WV27_VC6.als"):
    root = ET.parse(gzip.open(LIVE / name)).getroot()
    vc = root.find(".//Voice_Unison_VoiceCount")
    mode = root.find(".//Voice_Unison_Mode")
    amt = root.find(".//Voice_Unison_Amount/Manual")
    nn = len(list(root.iter("MidiNoteEvent")))
    ct = [c.get("Time") for c in root.iter("MidiClip")]
    loop = root.find("LiveSet/Transport/LoopLength")
    print(f"  {name:14s} notes={nn} VC={vc.get('Value')} Mode={mode.get('Value')} "
          f"Amount={amt.get('Value')} ClipTime={ct} Loop={loop.get('Value')}")
