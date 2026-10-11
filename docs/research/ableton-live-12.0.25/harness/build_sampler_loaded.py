#!/usr/bin/env python3
"""Build loaded-sample probes for Sampler and Simpler (2026-10-11).

The BULK default sets for Sampler/Simpler reference NO sample (empty
<SampleParts/>), so they correctly render digital silence — a corpus gap for
the sample-player DSP. This builder loads OUR OWN test signal
(harness/signals/steps-1k.wav — clean-room, redistribution-safe) into both
devices, copying the MultiSamplePart STRUCTURE from a factory preset
(names/ranges only; no factory audio or content is copied).

Outputs: live/BULK-sampler-loaded-steps.als, live/BULK-simpler-loaded-steps.als
Same conventions as the bulk builder: ET round-trip, gzip mtime=0, loop
already shrunk in the base sets.
"""
import gzip
import struct
import xml.etree.ElementTree as ET
from pathlib import Path

HARNESS = Path(__file__).resolve().parent
LIVE = HARNESS / "live"
SIGNAL = (HARNESS / "signals" / "steps-1k.wav").resolve()
PRESET = Path(
    "/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/Core "
    "Library/Devices/Instruments/Sampler/Synth Pad/Megaphatness Pad.adv"
)

# steps-1k.wav: 5.25 s @48k stereo float32 → frames
_afinfo_frames = int(5.25 * 48000)
SIGNAL_SIZE = SIGNAL.stat().st_size


def load_part_template():
    root = ET.parse(gzip.open(PRESET)).getroot()
    part = [el for el in root.iter() if el.tag.endswith("MultiSamplePart")][0]
    return part


def set_range(el, lo, hi):
    el.find("Min").set("Value", str(lo))
    el.find("Max").set("Value", str(hi))
    el.find("CrossfadeMin").set("Value", str(lo))
    el.find("CrossfadeMax").set("Value", str(hi))


def configure_part(part):
    part.find("Name").set("Value", "steps-1k.wav")
    set_range(part.find("KeyRange"), 0, 127)
    set_range(part.find("VelocityRange"), 1, 127)
    set_range(part.find("SelectorRange"), 0, 127)
    part.find("RootKey").set("Value", "48")  # M1 clip notes at MIDI 48
    part.find("Detune").set("Value", "0")
    part.find("TuneScale").set("Value", "100")
    part.find("SampleStart").set("Value", "0")
    part.find("SampleEnd").set("Value", str(_afinfo_frames - 1))
    for loop in ("SustainLoop", "ReleaseLoop"):
        part.find(loop).find("Mode").set("Value", "0")  # loops off
    ref = part.find("SampleRef")
    fref = ref.find("FileRef")
    fref.find("RelativePathType").set("Value", "0")
    fref.find("RelativePath").set("Value", "")
    fref.find("Path").set("Value", str(SIGNAL))
    fref.find("Type").set("Value", "2")
    fref.find("LivePackName").set("Value", "")
    fref.find("LivePackId").set("Value", "")
    fref.find("OriginalFileSize").set("Value", str(SIGNAL_SIZE))
    fref.find("OriginalCrc").set("Value", "0")
    return part


def build(base_name, out_name):
    root = ET.parse(gzip.open(LIVE / base_name)).getroot()
    parts = [el for el in root.iter() if el.tag.endswith("SampleParts")][0]
    assert len(list(parts)) == 0, "base expected empty SampleParts"
    part = configure_part(load_part_template())
    parts.append(part)
    xml = ET.tostring(root, encoding="unicode")
    data = ('<?xml version="1.0" encoding="UTF-8"?>\n' + xml).encode()
    with gzip.GzipFile(str(LIVE / out_name), "wb", mtime=0) as f:
        f.write(data)
    print(f"built {out_name}")

    # verify: re-read, check part + path
    r2 = ET.parse(gzip.open(LIVE / out_name)).getroot()
    p2 = [el for el in r2.iter() if el.tag.endswith("MultiSamplePart")][0]
    path = [el for el in p2.iter() if el.tag.endswith("Path")][0].get("Value")
    rootkey = p2.find("RootKey").get("Value")
    print(f"  verify: part present, RootKey={rootkey}, path={path}")


build("BULK-sampler-default-m1-velocity.als", "BULK-sampler-loaded-steps.als")
build("BULK-simpler-default-m1-velocity.als", "BULK-simpler-loaded-steps.als")
