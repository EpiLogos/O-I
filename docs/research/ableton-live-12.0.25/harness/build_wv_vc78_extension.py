#!/usr/bin/env python3
"""VC-ladder top-of-control extension (WV28/29), 2026-10-09.

Closes the VoiceCount N-extension: N=7 and N=8 on the WV9B_UNIM1 lineage
(Mode 1, Amount 1.0); the ONLY pin changed per set is Voice_Unison_VoiceCount.

  WV28_VC7   VoiceCount 3 -> 7   (odd top: does 7 = +-50/+-33.3/+-16.7/0?)
  WV29_VC8   VoiceCount 3 -> 8   (even top: does 8 = +-50/+-35.7/...+-7.1?)

Same method as build_wv_vc_extension.py: xml.etree round-trip of the base
set, gzip with mtime=0 for reproducible bytes; clip Time stamped
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


# ---- WV28/29: VoiceCount top extension, one pin each ----
for count, out in [(7, "WV28_VC7.als"), (8, "WV29_VC8.als")]:
    old = derive("WV9B_UNIM1.als", out, count)
    print(f"  Voice_Unison_VoiceCount {old} -> {count}")


# ---- verification pass: re-read from disk ----
print("\nverify:")
for name in ("WV28_VC7.als", "WV29_VC8.als"):
    root = ET.parse(gzip.open(LIVE / name)).getroot()
    vc = root.find(".//Voice_Unison_VoiceCount")
    mode = root.find(".//Voice_Unison_Mode")
    amt = root.find(".//Voice_Unison_Amount/Manual")
    nn = len(list(root.iter("MidiNoteEvent")))
    ct = [c.get("Time") for c in root.iter("MidiClip")]
    loop = root.find("LiveSet/Transport/LoopLength")
    print(f"  {name:14s} notes={nn} VC={vc.get('Value')} Mode={mode.get('Value')} "
          f"Amount={amt.get('Value')} ClipTime={ct} Loop={loop.get('Value')}")
