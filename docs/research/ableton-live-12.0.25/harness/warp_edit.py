#!/usr/bin/env python3
"""Edit a built .als in place: switch the audio clip to a warp mode.

Usage: warp_edit.py <set.als> <mode_enum> [stretch] [pitch_semitones]
Live LOM order: 0=Beats 1=Tones 2=Texture 3=Repitch 4=Complex 5=Complex Pro.

Edits the arrangement AudioClip:
  IsWarped -> true
  WarpMode Value -> <mode_enum>
  WarpMarkers -> (SecTime 0, BeatTime 0) + (SecTime 1.0, BeatTime 2.0*stretch)
  clip/loop end bounds -> natural end * stretch (when stretch != 1)
  PitchCoarse Value -> pitch_semitones (when given; clip children are plain
  Value elements — semitones; default leaves it at 0)
The marker pair pins the file tempo to the set tempo (120 BPM => 2 beats/s),
so at stretch=1 playback is a 1:1 time mapping and any duration change in a
render is the algorithm's own doing, not a marker artifact. With stretch=S the
second marker maps 1 s of source to 2*S beats = S seconds of output at 120 BPM:
the clip must play at rate 1/S, so the warp engine has to time-stretch by S.
Bounds are scaled so the stretched file is not truncated.
"""
import gzip
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


def main(als_path, mode, stretch=1.0, pitch=0):
    p = Path(als_path)
    root = ET.parse(gzip.open(p)).getroot()
    clip = root.find(".//MainSequencer/Sample/ArrangerAutomation/Events/AudioClip")
    assert clip is not None, "no arrangement AudioClip"

    warped = clip.find("IsWarped")
    assert warped is not None, "clip has no IsWarped element"
    warped.set("Value", "true")

    wm = clip.find("WarpMode")
    assert wm is not None, "clip has no WarpMode element"
    wm.set("Value", str(mode))

    if pitch:
        pc = clip.find("PitchCoarse")
        assert pc is not None, "clip has no PitchCoarse element"
        pc.set("Value", str(int(pitch)))
        pf = clip.find("PitchFine")
        if pf is not None:
            pf.set("Value", "0")

    if abs(stretch - 1.0) > 1e-9:
        natural = float(clip.find("CurrentEnd").get("Value"))
        bounds = repr(natural * stretch)
        clip.find("CurrentEnd").set("Value", bounds)
        loop = clip.find("Loop")
        for tag in ("LoopEnd", "OutMarker", "HiddenLoopEnd"):
            el = loop.find(tag)
            if el is not None:
                el.set("Value", bounds)
    else:
        bounds = clip.find("CurrentEnd").get("Value")

    markers = clip.find("WarpMarkers")
    assert markers is not None, "clip has no WarpMarkers element"
    for m in list(markers):
        markers.remove(m)
    beat2 = repr(2.0 * stretch)
    for mid, sec, beat in ((0, "0", "0"), (1, "1.0", beat2)):
        ET.SubElement(markers, "WarpMarker",
                      {"Id": str(mid), "SecTime": sec, "BeatTime": beat})

    # a pure time-stretch probe requires transposition 0 (checked only when
    # no explicit pitch is requested)
    if not pitch:
        for tag in ("PitchCoarse", "PitchFine"):
            el = clip.find(tag)
            if el is not None and el.get("Value") != "0":
                print(f"  !! {tag}={el.get('Value')} (expected 0)")

    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           + ET.tostring(root, encoding="unicode")).encode()
    with gzip.GzipFile(str(p), "wb", mtime=0) as f:
        f.write(xml)
    print(f"{p.name}: IsWarped=true WarpMode={mode} pitch={pitch:+d} "
          f"markers=[(0,0),(1s,{beat2}beats)] stretch={stretch} bounds={bounds}")


if __name__ == "__main__":
    stretch = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
    pitch = int(sys.argv[4]) if len(sys.argv) > 4 else 0
    main(sys.argv[1], sys.argv[2], stretch, pitch)
