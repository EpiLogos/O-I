#!/usr/bin/env python3
"""Offline self-check: every arrangement clip the builders write carries the
`Time` anchor attribute, equal to its CurrentStart (devices/follow-action.md,
"The anchoring element — RESOLVED": Time == CurrentStart is the arrangement
anchor; without it the loader anchors the clip at arrangement 0).

Runs WITHOUT Live — no renders, no app:
  1. template census — re-proves the dossier's count (73 arrangement clips,
     56 MidiClip + 17 AudioClip, every one Time == CurrentStart) against the
     pinned evidence set;
  2. build_set_midi.py — builds a MIDI set into a temp dir (synthetic device
     preset, nothing touches harness/live/), asserts the clip's anchor;
  3. build_set.py — builds an audio set into the temp dir (synthetic 0.5 s
     stereo WAV), asserts the clip's anchor;
  4. build_followaction.py — duplicates that clip at a NONZERO offset (the
     case that was broken before the adoption: an unanchored second clip
     rendered at arrangement 0, FA1-FA3), asserts BOTH clips carry
     Time == CurrentStart;
  5. FA4_TIME.als — when present on disk, the loader-proven set is parsed
     and its two clips' anchors re-verified (this set is the EVIDENCE the
     stamp law rests on; the check only re-reads it).

Usage: python3 check_clip_time.py     (exit 0 = all checks pass)
"""
import gzip
import struct
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

HARNESS = Path(__file__).parent
LANE = HARNESS.parent
sys.path.insert(0, str(HARNESS))

import build_followaction  # noqa: E402
import build_set  # noqa: E402
import build_set_midi  # noqa: E402

TEMPLATE = LANE / "evidence/sets/template-piano-voices-mastering.xml"
FA4 = HARNESS / "live/FA4_TIME.als"
FS = 48000


def arrangement_clips(root):
    """Every arrangement clip (MidiClip/AudioClip) of a parsed set, in
    document order. Session-slot clips are NOT matched (session placement is
    the slot, not the attribute — the real writer puts NO Time on them)."""
    return (root.findall(".//ArrangerAutomation/Events/MidiClip")
            + root.findall(".//ArrangerAutomation/Events/AudioClip"))


def assert_anchored(root, label):
    """Assert every arrangement clip carries Time == CurrentStart (string-
    exact: the real writer's census form, devices/follow-action.md)."""
    clips = arrangement_clips(root)
    assert clips, f"{label}: no arrangement clips found"
    for c in clips:
        cs = c.find("CurrentStart")
        assert cs is not None, f"{label}: clip {c.get('Id')} has no CurrentStart"
        t = c.get("Time")
        assert t is not None, (
            f"{label}: {c.tag} Id={c.get('Id')} has NO Time attribute "
            f"(CurrentStart {cs.get('Value')}) — loader would anchor it at 0")
        assert t == cs.get("Value"), (
            f"{label}: {c.tag} Id={c.get('Id')} Time={t!r} != "
            f"CurrentStart {cs.get('Value')!r}")
    print(f"  ok {label}: {len(clips)} arrangement clip(s), "
          f"Time == CurrentStart on all")
    return len(clips)


def check_template_census():
    root = ET.parse(TEMPLATE).getroot()
    clips = arrangement_clips(root)
    counts = {"MidiClip": 0, "AudioClip": 0}
    for c in clips:
        counts[c.tag] += 1
    # the dossier's census (follow-action.md, 2026-10-08 late lane):
    # 73 arrangement clips = 56 MidiClip + 17 AudioClip, ALL Time == CurrentStart
    assert len(clips) == 73 and counts == {"MidiClip": 56, "AudioClip": 17}, \
        f"template census moved: {len(clips)} {counts} — re-pin the dossier"
    assert_anchored(root, "template census")
    print("  ok census matches the dossier (73 = 56 MidiClip + 17 AudioClip)")


def write_synthetic_preset(path):
    """A minimal device preset: the builders take the first child of the
    preset root as the device element and only pin parameters that are
    explicitly requested (we pass none)."""
    path.write_text('<?xml version="1.0" encoding="UTF-8"?>\n'
                    "<Preset><CheckDevice Id=\"0\"><Volume><Manual "
                    'Value="1.0"/></Volume></CheckDevice></Preset>')


def write_synthetic_wav(path, seconds=0.5):
    """Minimal 44-byte-header stereo float32 WAV (the builders read only the
    file size: n_samples = (size - 44) // 8)."""
    n = int(FS * seconds)
    data = b"\x00" * (n * 8)
    header = struct.pack("<4sI8sIHHIIHH4sI", b"RIFF", 36 + len(data),
                         b"WAVEfmt ", 16, 3, 2, FS, FS * 8, 8, 32, b"data",
                         len(data))
    assert len(header) == 44
    path.write_bytes(header + data)


def check_build_set_midi(tmp):
    preset = tmp / "preset-device.xml"
    write_synthetic_preset(preset)
    build_set_midi.OUT_DIR = tmp  # never write into harness/live/
    build_set_midi.build(preset, [], "60,100,0,1;72,80,4,2")
    with gzip.open(tmp / "midi-checkdevice.als") as f:
        assert_anchored(ET.parse(f).getroot(), "build_set_midi")


def check_build_set_audio(tmp):
    preset = tmp / "preset-device.xml"
    write_synthetic_preset(preset)
    wav = tmp / "clipcheck"
    write_synthetic_wav(wav)
    build_set.OUT_DIR = tmp  # never write into harness/live/
    build_set.build(preset, [], str(wav))
    with gzip.open(tmp / "clipcheck-checkdevice.als") as f:
        assert_anchored(ET.parse(f).getroot(), "build_set")


def check_build_followaction(tmp):
    src = tmp / "midi-checkdevice.als"
    build_followaction.LIVE = tmp  # never write into harness/live/
    build_followaction.build(src, "false", "check-fa.als")
    with gzip.open(tmp / "check-fa.als") as f:
        root = ET.parse(f).getroot()
    clips = arrangement_clips(root)
    assert len(clips) == 2, f"followaction set: expected 2 clips, got {len(clips)}"
    assert_anchored(root, "build_followaction")
    # the second clip must sit at a NONZERO anchor — that offset case is
    # exactly what the pre-adoption builders got wrong (FA1-FA3 void)
    second_cs = float(clips[1].find("CurrentStart").get("Value"))
    assert second_cs > 0.0, "second clip should be duplicated after the first"
    print(f"  ok second clip anchored at nonzero arrangement {second_cs}")


def check_fa4_loader_proof():
    if not FA4.exists():
        print(f"  skip FA4_TIME.als not on disk ({FA4}) — loader-proof "
              "artifact pruned; the builder checks above still hold")
        return
    with gzip.open(FA4) as f:
        root = ET.parse(f).getroot()
    n = assert_anchored(root, "FA4_TIME.als (loader-proof set)")
    assert n == 2, f"FA4_TIME: expected 2 clips, got {n}"


def main():
    print("clip Time-anchor self-check (offline; devices/follow-action.md)")
    check_template_census()
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        check_build_set_midi(tmp)
        check_build_set_audio(tmp)
        check_build_followaction(tmp)
    check_fa4_loader_proof()
    print("ALL CHECKS PASS")


if __name__ == "__main__":
    main()
