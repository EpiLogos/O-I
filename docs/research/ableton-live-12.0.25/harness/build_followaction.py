#!/usr/bin/env python3
"""Build a FollowAction probe set from a freshly built midi-instrument set.

Takes the builder output (ONE arrangement MidiClip carrying the notes),
adds the template's FollowAction element shape to every clip, duplicates
the clip once directly after itself (so "playback continues past the
first clip" is measurable), and shrinks the transport loop over both.

FollowAction element shape read from evidence/sets/template-piano-
voices-mastering.xml (all 73 arrangement clips carry it, between
Envelopes and Notes in template relative order):

    FollowTime / IsLinked / LoopIterations / FollowActionA /
    FollowActionB / FollowChanceA / FollowChanceB / JumpIndexA /
    JumpIndexB / FollowActionEnabled

(the brief's guessed "FollowActionMode"/"action_time" tags do not exist;
FollowTime stores beats — the template default 4 = one bar — and the
enabled flag is FollowActionEnabled, with the action enum in
FollowActionA/B and per-action chances in FollowChanceA/B.)

Usage: build_followaction.py <midi-xxx.als> <enabled true|false> <out.als>
"""
import copy
import gzip
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

LIVE = Path(__file__).parent / "live"

FA_FIELDS = (
    ("FollowTime", "4"),
    ("IsLinked", "true"),
    ("LoopIterations", "1"),
    ("FollowActionA", "4"),
    ("FollowActionB", "0"),
    ("FollowChanceA", "100"),
    ("FollowChanceB", "0"),
    ("JumpIndexA", "1"),
    ("JumpIndexB", "1"),
    ("FollowActionEnabled", "false"),  # rewritten below
)


def build(src, enabled, out):
    with gzip.open(src) as f:
        root = ET.parse(f).getroot()
    ls = root.find("LiveSet")

    clips = ls.findall(".//ArrangerAutomation/Events/MidiClip")
    assert len(clips) == 1, f"expected 1 arrangement clip, got {len(clips)}"
    clip = clips[0]

    span = float(clip.find("CurrentEnd").get("Value")) - float(
        clip.find("CurrentStart").get("Value"))

    events = ls.find(".//ArrangerAutomation/Events")
    for c in list(events):
        events.remove(c)
    for offset in (0.0, span):
        c2 = copy.deepcopy(clip)
        c2.set("Id", "912" if offset else clip.get("Id"))
        c2.find("CurrentStart").set("Value", repr(offset))
        c2.find("CurrentEnd").set("Value", repr(offset + span))
        # Time attribute == CurrentStart: the arrangement anchor the loader
        # reads (FA4_TIME 2026-10-08 — devices/follow-action.md)
        c2.set("Time", repr(offset))
        loop = c2.find("Loop")
        for tag in ("LoopEnd", "OutMarker", "HiddenLoopEnd"):
            loop.find(tag).set("Value", repr(span))
        # FollowAction goes after Envelopes, before Notes (template
        # relative order; the loader proved order-tolerant on this
        # subset, but stay close to the witnessed shape)
        fa = ET.Element("FollowAction")
        idx = list(c2).index(c2.find("Notes"))
        c2.insert(idx, fa)
        for tag, val in FA_FIELDS:
            ET.SubElement(fa, tag, Value=val)
        fa.find("FollowActionEnabled").set("Value", enabled)
        events.append(c2)

    transport = ls.find("Transport")
    end_loop = 2 * span + 2.0
    for tag in ("LoopLength", "LoopEnd"):
        el = transport.find(tag)
        if el is not None:
            el.set("Value", repr(end_loop))

    data = ('<?xml version="1.0" encoding="UTF-8"?>\n'
            + ET.tostring(root, encoding="unicode")).encode()
    with gzip.GzipFile(str(LIVE / out), "wb", mtime=0) as f:
        f.write(data)
    print(f"built {LIVE / out}: 2 clips x {span} beats, "
          f"FollowActionEnabled={enabled}, loop={end_loop}")


if __name__ == "__main__":
    build(sys.argv[1], sys.argv[2], sys.argv[3])
