#!/usr/bin/env python3
"""Build a minimal golden-render Live Set from the real template set.

Keeps one audio track, points its arrangement clip at a harness test WAV,
injects the device under test (from its own factory preset XML) with pinned
parameters, prunes everything else, and writes a gzip'd .als.

Usage: build_set.py <device_preset.xml> <param=Value ...> [signal.wav]
Result: harness/live/<signal>-<devicename>.als
"""
import gzip
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

LANE = Path(__file__).parent.parent
TEMPLATE = LANE / "evidence/sets/template-piano-voices-mastering.xml"
OUT_DIR = Path(__file__).parent / "live"
OUT_DIR.mkdir(exist_ok=True)

FS = 48000
TEMPO = 120.0  # beats per minute -> 1 beat = 0.5 s


def beats(seconds):
    return seconds * TEMPO / 60.0


def build(preset_path, pins, signal_path):
    sig = Path(signal_path).resolve()
    n_samples = (sig.stat().st_size - 44) // 8  # stereo f32, header ~44B
    dur_s = n_samples / FS

    dev_root = ET.parse(preset_path).getroot()
    device_el = list(dev_root)[0]
    dev_name = device_el.tag
    device_el.set("Id", "900")  # set devices are list members and need an Id

    # pin parameters by rewriting Manual
    pinned = {}
    for pin in pins:
        k, v = pin.split("=", 1)
        el = device_el.find(k)
        if el is None:
            print(f"  !! no param '{k}' on {dev_name}; have:",
                  [c.tag for c in device_el])
            sys.exit(2)
        man = el.find("Manual")
        man.set("Value", v)
        pinned[k] = v

    root = ET.parse(TEMPLATE).getroot()
    ls = root.find("LiveSet")

    # allocate pointee Ids: presets carry Id="0" on AutomationTarget /
    # ModulationTarget / Pointee; in a set these must reference allocated
    # pointees below NextPointeeId.
    np = ls.find("NextPointeeId")
    next_id = int(np.get("Value"))
    for el in device_el.iter():
        if el.tag in ("AutomationTarget", "ModulationTarget", "Pointee"):
            el.set("Id", str(next_id))
            next_id += 1
    np.set("Value", str(next_id))

    tracks = ls.find("Tracks")

    # choose the audio track that already has an arrangement clip
    keep = None
    for tr in list(tracks):
        if tr.tag == "AudioTrack" and tr.find(
                ".//MainSequencer/Sample/ArrangerAutomation/Events/AudioClip") is not None:
            keep = tr
            break
    assert keep is not None, "no audio track with arrangement clip in template"

    # clear inner device chain, inject device under test
    inner = keep.find("DeviceChain/DeviceChain")
    inner_children = [c.tag for c in inner]
    print("inner DeviceChain children:", inner_children)
    devices_el = inner.find("Devices")
    if devices_el is None:
        devices_el = ET.SubElement(inner, "Devices")
    for d in list(devices_el):
        devices_el.remove(d)
    devices_el.append(device_el)
    print("devices now:", [d.tag for d in devices_el])

    # strip dangling references: track automation, signal modulations and
    # clip envelopes all point at pointee Ids of the removed devices
    for container_path in ("AutomationEnvelopes",
                           "DeviceChain/SignalModulations"):
        cont = keep.find(container_path)
        if cont is not None:
            for c in list(cont):
                cont.remove(c)
    sends = keep.find("DeviceChain/Mixer/Sends")
    if sends is not None:
        for c in list(sends):
            sends.remove(c)

    keep.find(".//Name/EffectiveName").set("Value", "STIM")

    # rewrite the arrangement clip
    clip = keep.find(
        ".//MainSequencer/Sample/ArrangerAutomation/Events/AudioClip")
    clip_env = clip.find("Envelopes")
    if clip_env is not None:
        for c in list(clip_env):
            clip_env.remove(c)

    total_beats = beats(dur_s)
    clip.find("CurrentStart").set("Value", "0")
    clip.find("CurrentEnd").set("Value", repr(total_beats))
    # The clip element's Time ATTRIBUTE is the arrangement anchor (loader
    # fact, FA4_TIME 2026-10-08: without it the loader anchors at 0
    # regardless of CurrentStart — devices/follow-action.md).
    clip.set("Time", "0")
    sv = clip.find("SampleVolume")
    if sv is not None:
        # the template clip carries clip-gain 0.6513801813 = −3.715 dB;
        # pin unity so renders are absolutely calibrated
        sv.set("Value", "1.0")
    warped = clip.find("IsWarped")
    if warped is not None:
        warped.set("Value", "false")
    loop = clip.find("Loop")
    for tag, val in (("LoopStart", "0"), ("LoopEnd", repr(total_beats)),
                     ("StartRelative", "0"), ("LoopOn", "false"),
                     ("OutMarker", repr(total_beats)),
                     ("HiddenLoopStart", "0"),
                     ("HiddenLoopEnd", repr(total_beats))):
        el = loop.find(tag)
        if el is not None:
            el.set("Value", val)
    fades = clip.find("Fades")
    if fades is not None:
        for tag in ("FadeInLength", "FadeOutLength"):
            el = fades.find(tag)
            if el is not None:
                el.set("Value", "0")
    ts = clip.find("TimeSignature")
    if ts is not None:
        print("TimeSignature subtree:",
              [(c.tag, c.attrib) for c in ts.iter()][:6])
    sr = clip.find(".//SampleRef/FileRef")
    sr.find("RelativePathType").set("Value", "0")
    sr.find("RelativePath").set("Value", "")
    sr.find("Path").set("Value", str(sig))
    sr.find("Type").set("Value", "2")
    warp = clip.find(".//WarpProperties")
    if warp is not None:
        on = warp.find("WarpOn")
        if on is not None:
            on.set("Value", "false")
    nm = clip.find("Name")
    if nm is not None:
        nm.set("Value", sig.stem)

    # prune other tracks and returns
    for tr in list(tracks):
        if tr is not keep:
            tracks.remove(tr)
    rets = ls.find("ReturnTracks")
    if rets is not None:
        for r in list(rets):
            rets.remove(r)
    scenes = ls.find("Scenes")
    if scenes is not None:
        for s in list(scenes)[1:]:
            scenes.remove(s)

    # shrink the arrangement loop to the content: Live exports the
    # Transport loop (default 512 beats = 256 s of silence per render)
    transport = ls.find("Transport")
    if transport is not None:
        end_loop = beats(dur_s) + 2.0
        for tag in ("LoopLength", "LoopEnd"):
            el = transport.find(tag)
            if el is not None:
                el.set("Value", repr(end_loop))
        lon = transport.find("LoopOn")
        if lon is not None:
            lon.set("Value", "true")
        lst = transport.find("LoopStart")
        if lst is not None:
            lst.set("Value", "0")

    # pin tempo — lives in the MainTrack mixer, not directly under LiveSet
    tempo = ls.find("MainTrack/DeviceChain/Mixer/Tempo")
    if tempo is None:
        tempo = ls.find("MainTrack").find(".//Mixer/Tempo")
    if tempo is not None and tempo.find("Manual") is not None:
        tempo.find("Manual").set("Value", repr(int(TEMPO)))
    else:
        print("  !! Tempo not found under MainTrack/Mixer")

    # strip the template's MASTER-bus chain (a mastering template: Chorus,
    # Eq8 x2, AutoPan, Saturator, Compressor2 — all On) and pin unity gain:
    # every curve must be device-only.
    master = ls.find("MainTrack")
    mdevs = master.find("DeviceChain/DeviceChain/Devices")
    if mdevs is None:
        mdevs = master.find("DeviceChain/Devices")
    if mdevs is not None:
        for d in list(mdevs):
            mdevs.remove(d)
        print("master devices cleared")
    for container_path in ("AutomationEnvelopes",
                           "DeviceChain/SignalModulations"):
        cont = master.find(container_path)
        if cont is not None:
            for c in list(cont):
                cont.remove(c)
    for vol_path in ("MainTrack/DeviceChain/Mixer/Volume",
                     "DeviceChain/Mixer/Volume"):
        vol = ls.find(vol_path) if vol_path.startswith("Main") else keep.find(vol_path)
        if vol is not None:
            man = vol.find("Manual")
            if man is not None:
                man.set("Value", "1.0")  # linear gain 1.0 = 0 dB

    keep.find(".//Name/EffectiveName").set("Value", "STIM")

    out = OUT_DIR / f"{sig.stem}-{dev_name.lower()}.als"
    xml = ET.tostring(root, encoding="unicode")
    data = ('<?xml version="1.0" encoding="UTF-8"?>\n' + xml).encode()
    with gzip.GzipFile(str(out), "wb", mtime=0) as f:
        f.write(data)
    print(f"built {out}")
    print(f"device={dev_name} pinned={pinned} signal={sig.name} "
          f"({n_samples} samples, {dur_s:.2f}s)")


if __name__ == "__main__":
    build(sys.argv[1], sys.argv[2:-1], sys.argv[-1])
