#!/usr/bin/env python3
"""Build the segment-tempo-mismatch warp probes (SEG90): W1_TONES lineage,
clip audio swapped to signals/impulse.wav, warp markers re-pinned so the
clip's *embedded segment tempo* is 90 BPM against the 120 BPM set.

Usage: build_wb_seg90.py <mode_enum> <out.als>
Live LOM order: 0=Beats 1=Tones 2=Texture 3=Repitch 4=Complex 5=Complex Pro.

Segment tempo storage (checked against the app bundle Schema, 12.0_1200x):
the AudioClip carries no explicit SegTempo field — Live derives "Seg. BPM"
from the WarpMarker SecTime/BeatTime ratio. Markers (0s,0)+(1.0s,1.5 beats)
=> 1.5 beats/s = 90 BPM; set tempo stays 120 => playback maps source t to
t * 90/120 (4/3 speed-up, time-compression x0.75). File is 4.0 s => 6.0
beats at 90; clip bounds 6.0 beats, transport loop 8.0 beats. Ideal onset:
100/48000 s * 0.75 = 1.5625 ms (68.9 samples @44.1k). Mode 0 = Beats
(re-slices to the grid under mismatch), mode 5 = Complex Pro control
(true time-stretch at the same mismatch). Same ET+gzip-mtime0 convention
as build_wb_imp.py.
"""
import gzip
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

SIG = ("signals/impulse.wav", "impulse")
FILE_S = 4.0
SEG_BPM = 90.0
BEATS = FILE_S * SEG_BPM / 60.0  # 6.0


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
        clip.find(tag).set("Value", repr(BEATS))
    loop = clip.find("Loop")
    for tag in ("LoopEnd", "OutMarker", "HiddenLoopEnd"):
        el = loop.find(tag)
        if el is not None:
            el.set("Value", repr(BEATS))
    loop.find("LoopStart").set("Value", "0")
    loop.find("HiddenLoopStart").set("Value", "0")

    markers = clip.find("WarpMarkers")
    assert markers is not None
    for m in list(markers):
        markers.remove(m)
    # 1.0 s of source spans 1.5 beats => 90 BPM embedded segment tempo
    for mid, sec, beat in ((0, "0", "0"), (1, "1.0", repr(SEG_BPM / 60.0))):
        ET.SubElement(markers, "WarpMarker",
                      {"Id": str(mid), "SecTime": sec, "BeatTime": beat})

    transport = root.find("LiveSet/Transport")
    if transport is not None:
        transport.find("LoopOn").set("Value", "true")
        transport.find("LoopStart").set("Value", "0")
        transport.find("LoopLength").set("Value", repr(BEATS + 2.0))
        le = transport.find("LoopEnd")
        if le is not None:
            le.set("Value", repr(BEATS + 2.0))

    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           + ET.tostring(root, encoding="unicode")).encode()
    with gzip.GzipFile(str(p), "wb", mtime=0) as f:
        f.write(xml)
    print(f"{p.name}: sample={SIG[0]} WarpMode={mode} "
          f"markers=[(0,0),(1s,{SEG_BPM/60.0}beats)] seg={SEG_BPM}BPM "
          f"set=120BPM mismatch=x{120/SEG_BPM:.4f} clip_end={BEATS}beats "
          f"transport_loop={BEATS + 2.0}beats")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
