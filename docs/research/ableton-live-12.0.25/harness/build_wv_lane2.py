#!/usr/bin/env python3
"""Lane-2 (wavetable voice depth) probe sets, night round 2026-10-09.

  WV19_LONG_UNI    D15 open item: long-note unison re-probe. WV9B_UNIM1
                   (Mode 1, VoiceCount 3, Amount 1.0) with the 4-note
                   staircase replaced by ONE note of 8 beats (velocity 1.0)
                   and the transport loop shrunk to 18 beats — an 8-beat
                   steady tone gives a ~2.9 s analysis window (sub-Hz
                   resolution) where the D15 ladder's 0.45 s windows
                   (2.2 Hz) blurred the three voices.

  WV20_SLOPE_M05   D16 warp curve: WV8_SLOPE0 lineage with
                   Voice_Modulators_AmpEnvelope_Slopes_Decay Manual
                   0.0 -> -0.5.
  WV21_SLOPE_P1    same lineage, Manual -> +1.0.
                   With WV8 (0.0) and M2 (0.5, default) the warp curve has
                   four slope points; endpoints (peak, sustain plateau)
                   already pinned by D16.

Method: the build_session_probes.py convention — xml.etree round-trip of
the base set (the same ET serialization build_set.py's loader-accepted
output uses), gzip with mtime=0 for reproducible bytes.

v5 serialization notes applied (backlog D7): note events carry NO generic
Id attributes; <NoteIdGenerator><NextId Value="N"/></NoteIdGenerator> with
N = note count; <PerNoteEventStore><EventLists /></PerNoteEventStore>
present in the base (kept). Clip anchoring: the MidiClip element's Time
attribute is stamped (= CurrentStart, 0 here) — the FA4_TIME lesson
(devices/follow-action.md).
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


def stamp_clip_time(root, value="0"):
    """FA4_TIME lesson: arrangement clips anchor at the clip Time attribute."""
    for clip in root.iter("MidiClip"):
        clip.set("Time", value)


def single_long_note(root, duration="8.0", velocity="1.0"):
    """Replace every KeyTrack note list with one long note; keep the v5
    generator shape (NextId = note count)."""
    n = 0
    for notes in root.iter("Notes"):
        kts = notes.find("KeyTracks")
        if kts is None:
            continue
        for kt in kts.findall("KeyTrack"):
            evl = kt.find("Notes")
            for ev in list(evl):
                evl.remove(ev)
            ev = ET.Element("MidiNoteEvent")
            ev.set("Time", "0.0")
            ev.set("Duration", duration)
            ev.set("Velocity", velocity)
            ev.set("OffVelocity", "0.4")
            ev.set("IsEnabled", "true")
            evl.append(ev)
            n += 1
    assert n == 1, f"expected exactly one KeyTrack, got {n}"
    gen = root.find(".//NoteIdGenerator")
    assert gen is not None
    gen.attrib.pop("NextId", None)          # in case a stale attr was set
    nxt = gen.find("NextId")
    assert nxt is not None, "NoteIdGenerator/NextId child"
    nxt.set("Value", "1")                   # = note count (v5 convention)


def derive(base, out_name, edits):
    root = ET.parse(gzip.open(LIVE / base)).getroot()
    edits(root)
    save(root, LIVE / out_name)


# ---- WV19: long-note unison re-probe ----
def build_wv19():
    def edit(r):
        single_long_note(r, duration="8.0")
        shrink_loop(r, "18.0")     # 8-beat note + release fits; render = 9.0 s
        stamp_clip_time(r, "0")    # CurrentStart = 0; attribute stamped explicitly
    derive("WV9B_UNIM1.als", "WV19_LONG_UNI.als", edit)


build_wv19()


# ---- WV20/WV21: slope warp-curve points on the WV8 lineage ----
for slope, out in [("-0.5", "WV20_SLOPE_M05.als"), ("1.0", "WV21_SLOPE_P1.als")]:
    def edit(r, s=slope):
        set_manual(r, "Voice_Modulators_AmpEnvelope_Slopes_Decay", s)
    derive("WV8_SLOPE0.als", out, edit)


# ---- verification pass: re-read from disk ----
print("\nverify:")
checks = [
    ("WV19_LONG_UNI.als", [
        ("LiveSet/Transport/LoopLength", None),
        ("MidiClip", "@Time"),
        ("MidiNoteEvent", "@Time"),
        ("MidiNoteEvent", "@Duration"),
        ("MidiNoteEvent", "@Velocity"),
        ("NoteIdGenerator/NextId", None),
        ("Voice_Unison_Mode", None),
        ("Voice_Unison_Amount", "Manual"),
        ("Voice_Unison_VoiceCount", None),
    ]),
    ("WV20_SLOPE_M05.als", [
        ("Voice_Modulators_AmpEnvelope_Slopes_Decay", "Manual"),
        ("LiveSet/Transport/LoopLength", None),
    ]),
    ("WV21_SLOPE_P1.als", [
        ("Voice_Modulators_AmpEnvelope_Slopes_Decay", "Manual"),
        ("LiveSet/Transport/LoopLength", None),
    ]),
]
for name, ck in checks:
    root = ET.parse(gzip.open(LIVE / name)).getroot()
    vals = []
    for tag, how in ck:
        el = root.find(f".//{tag}")
        if el is None:
            vals.append(f"{tag}=MISSING")
        elif how == "@Time":
            vals.append(f"{tag.split('.')[-1]}@Time={el.get('Time')}")
        elif how and how.startswith("@"):
            vals.append(f"{tag}{how}={el.get(how[1:])}")
        elif how:
            vals.append(f"{tag.split('.')[-1]}/{how}={el.find(how).get('Value')}")
        else:
            vals.append(f"{tag.split('/')[-1]}={el.get('Value')}")
    # count notes
    nn = len(list(root.iter("MidiNoteEvent")))
    print(f"  {name:20s} notes={nn}  {' '.join(vals)}")
