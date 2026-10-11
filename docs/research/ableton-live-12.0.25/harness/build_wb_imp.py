#!/usr/bin/env python3
"""Build a transient-material warp probe set: W1_TONES lineage, clip audio
swapped to signals/impulse.wav (unit impulse at source sample 100, 4 s).

Usage: build_wb_imp.py <mode_enum> <out.als>
Live LOM order: 0=Beats 1=Tones 2=Texture 3=Repitch 4=Complex 5=Complex Pro.

Same edit hook as the Modes-0/3/4 sets (warp_edit.py contract): IsWarped=true,
WarpMode <mode>, marker pair (SecTime 0, BeatTime 0)+(1.0 s, 2.0 beats) pinning
file tempo to the set tempo (120 BPM), so 1:1 playback maps source t to render
t exactly. Sample reference swapped per build_set.py's audio handling (Path/
Type/Name only — Live re-scans the file and its .asd on load). Clip bounds set
to the file's 8 beats (4 s at 120 BPM); transport loop 10 beats so the export
stays short (harness note, 2026-10-08: render length follows the arrangement
loop).
"""
import gzip
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

SIG = ("signals/impulse.wav", "impulse")
BEATS_AT_120 = 8.0  # 4.0 s file at the pinned 2 beats/s


def main(mode, out_path):
    src = Path(__file__).parent / "live/W1_TONES.als"
    p = Path(out_path)
    root = ET.parse(gzip.open(src)).getroot()
    clip = root.find(".//MainSequencer/Sample/ArrangerAutomation/Events/AudioClip")
    assert clip is not None, "no arrangement AudioClip"

    sr = clip.find(".//SampleRef/FileRef")
    sr.find("RelativePathType").set("Value", "0")
    sr.find("RelativePath").set("Value", "")
    sr.find("Path").set("Value",
                        str((Path(__file__).parent / SIG[0]).resolve()))
    sr.find("Type").set("Value", "2")
    clip.find("Name").set("Value", SIG[1])

    clip.find("IsWarped").set("Value", "true")
    clip.find("WarpMode").set("Value", str(mode))
    for tag in ("CurrentEnd",):
        clip.find(tag).set("Value", repr(BEATS_AT_120))
    loop = clip.find("Loop")
    for tag in ("LoopEnd", "OutMarker", "HiddenLoopEnd"):
        el = loop.find(tag)
        if el is not None:
            el.set("Value", repr(BEATS_AT_120))
    loop.find("LoopStart").set("Value", "0")
    loop.find("HiddenLoopStart").set("Value", "0")

    markers = clip.find("WarpMarkers")
    assert markers is not None
    for m in list(markers):
        markers.remove(m)
    for mid, sec, beat in ((0, "0", "0"), (1, "1.0", "2.0")):
        ET.SubElement(markers, "WarpMarker",
                      {"Id": str(mid), "SecTime": sec, "BeatTime": beat})

    transport = root.find("LiveSet/Transport")
    if transport is not None:
        transport.find("LoopOn").set("Value", "true")
        transport.find("LoopStart").set("Value", "0")
        transport.find("LoopLength").set("Value", repr(BEATS_AT_120 + 2.0))
        le = transport.find("LoopEnd")
        if le is not None:
            le.set("Value", repr(BEATS_AT_120 + 2.0))

    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           + ET.tostring(root, encoding="unicode")).encode()
    with gzip.GzipFile(str(p), "wb", mtime=0) as f:
        f.write(xml)
    print(f"{p.name}: sample={SIG[0]} WarpMode={mode} markers=[(0,0),(1s,2beats)] "
          f"clip_end={BEATS_AT_120}beats transport_loop={BEATS_AT_120 + 2.0}beats")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
