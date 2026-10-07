#!/usr/bin/env python3
"""Build a minimal MIDI-instrument golden-render Live Set.

Same loader rules as build_set.py (they are earned knowledge — see
session-model.md): device list members carry Id, pointee targets must be
allocated against NextPointeeId, sends match return tracks, master chain
stripped, unity staging, tempo via MainTrack mixer.

Usage:
  build_set_midi.py <device_preset.xml> <notes-spec>

notes-spec: semicolon list of  key,velocity,start,duration  (beats), e.g.
  48,127,0,1.75;48,96,2,1.75;48,64,4,1.75;48,32,6,1.75

Result: harness/live/midi-<devicename>.als
"""
import gzip
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

LANE = Path(__file__).parent.parent
TEMPLATE = LANE / "evidence/sets/template-piano-voices-mastering.xml"
OUT_DIR = Path(__file__).parent / "live"
OUT_DIR.mkdir(exist_ok=True)

TEMPO = 120.0


def sub(parent, tag, **attrs):
    el = ET.SubElement(parent, tag)
    for k, v in attrs.items():
        el.set(k, v)
    return el


def build(preset_path, pins, notes_spec):
    root = ET.parse(TEMPLATE).getroot()
    ls = root.find("LiveSet")

    # device under test from its factory preset
    dev_root = ET.parse(preset_path).getroot()
    device_el = list(dev_root)[0]
    dev_name = device_el.tag
    device_el.set("Id", "901")

    # pin parameters: "Tag=Value" pins the first match's Manual; "Tag*=Value"
    # pins ALL matches (for per-voice elements like Operator's VelScale);
    # "Conn:<TargetId>#<ChildTag>=Value" pins a child of the one
    # ModulationConnectionsForInstrumentVector carrying that TargetId
    # (mod-matrix cells: children are ModulationAmounts.N with plain Value)
    for pin in pins:
        if pin.endswith("*") or "=" not in pin:
            continue
        if pin.startswith("Conn:"):
            head, rest = pin.split("#", 1)   # head="Conn:<TargetId>", rest="<ChildTag>=<Value>"
            target, v = rest.split("=", 1)
            child = head[5:]
            conn = device_el.find(
                ".//ModulationConnectionsForInstrumentVector[@TargetId='"
                + child + "']")
            if conn is None:
                print(f"  !! no mod connection TargetId '{child}'")
                sys.exit(2)
            cel = conn.find(target)
            if cel is None:
                print(f"  !! no child '{target}' in that connection")
                sys.exit(2)
            cel.set("Value", v)
            print(f"pinned conn[{child}].{target} = {v}")
            continue
        k, v = pin.split("=", 1)
        if k.endswith("*"):
            els = device_el.findall(".//" + k[:-1])
            for el in els:
                man = el.find("Manual")
                if man is not None:
                    man.set("Value", v)
            print(f"pinned {k[:-1]}* x{len(els)} = {v}")
        else:
            el = device_el.find(".//" + k)
            if el is None:
                print(f"  !! no param '{k}' on {dev_name}")
                sys.exit(2)
            man = el.find("Manual")
            if man is None:
                el.set("Value", v)  # plain-value element (e.g. Amount)
            else:
                man.set("Value", v)

    # allocate pointees (AutomationTarget/ModulationTarget/Pointee)
    np = ls.find("NextPointeeId")
    next_id = int(np.get("Value"))
    for el in device_el.iter():
        if el.tag in ("AutomationTarget", "ModulationTarget", "Pointee"):
            el.set("Id", str(next_id))
            next_id += 1
    np.set("Value", str(next_id))

    # pick a MIDI track; prune the rest
    tracks = ls.find("Tracks")
    keep = next(t for t in tracks if t.tag == "MidiTrack")
    for t in list(tracks):
        if t is not keep:
            tracks.remove(t)
    rets = ls.find("ReturnTracks")
    if rets is not None:
        for r in list(rets):
            rets.remove(r)
    scenes = ls.find("Scenes")
    if scenes is not None:
        for s in list(scenes)[1:]:
            scenes.remove(s)

    keep.find(".//Name/EffectiveName").set("Value", "MIDI-STIM")

    # clear inner device chain and inject the instrument
    inner = keep.find("DeviceChain/DeviceChain")
    devices_el = inner.find("Devices")
    if devices_el is None:
        devices_el = sub(inner, "Devices")
    for d in list(devices_el):
        devices_el.remove(d)
    devices_el.append(device_el)
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

    # arrangement MIDI clip under MainSequencer/ClipTimeable/ArrangerAutomation
    ms = keep.find("DeviceChain/MainSequencer")
    ct = ms.find("ClipTimeable")
    if ct is None:
        ct = sub(ms, "ClipTimeable")
    aa = ct.find("ArrangerAutomation")
    if aa is None:
        aa = sub(ct, "ArrangerAutomation")
    events = aa.find("Events")
    if events is None:
        events = sub(aa, "Events")
    for c in list(events):
        events.remove(c)

    notes = []           # (key, vel01, start, dur)
    keys = {}
    for spec in notes_spec.split(";"):
        key, vel, start, dur = spec.split(",")
        key = int(key)
        notes.append((key, int(vel) / 127.0, float(start), float(dur)))
        keys.setdefault(key, []).append(notes[-1])
    end_beat = max(s + d for _, _, s, d in notes) + 2.0

    clip = sub(events, "MidiClip", Id="910")  # Events members carry Ids
    sub(clip, "LomId", Value="0")
    sub(clip, "LomIdView", Value="0")
    sub(clip, "CurrentStart", Value="0")
    sub(clip, "CurrentEnd", Value=repr(end_beat))
    loop = sub(clip, "Loop")
    for tag, val in (("LoopStart", "0"), ("LoopEnd", repr(end_beat)),
                     ("StartRelative", "0"), ("LoopOn", "false"),
                     ("OutMarker", repr(end_beat)),
                     ("HiddenLoopStart", "0"),
                     ("HiddenLoopEnd", repr(end_beat))):
        sub(loop, tag, Value=val)
    nm = sub(clip, "Name", Value="notes")
    sub(clip, "Annotation", Value="")
    sub(clip, "Color", Value="12")
    sub(clip, "Disabled", Value="false")
    env = sub(clip, "Envelopes")
    sub(env, "Envelopes")
    notes_el = sub(clip, "Notes")
    kts_list = sub(notes_el, "KeyTracks")  # Notes/KeyTracks IS the array
    max_id = 0
    note_id = 0
    kt_id = 911
    for key in sorted(keys):
        kt = sub(kts_list, "KeyTrack", Id=str(kt_id))
        kt_id += 1
        sub(kt, "MidiKey", Value=str(key))
        kn = sub(kt, "Notes")
        for _, vel, start, dur in keys[key]:
            max_id += 1
            # MidiNoteEvent takes NO Id attribute (loader: "Unknown
            # attribute 'Id'"); note identity is implicit/generator-driven
            sub(kn, "MidiNoteEvent", Time=repr(start),
                Duration=repr(dur), Velocity=repr(round(vel, 6)),
                OffVelocity="0.4", IsEnabled="true")
    store = sub(notes_el, "PerNoteEventStore")
    sub(store, "EventLists")
    sub(notes_el, "NoteProbabilityGroups")
    pgg = sub(notes_el, "ProbabilityGroupIdGenerator")
    sub(pgg, "NextId", Value="0")
    nig = sub(notes_el, "NoteIdGenerator")
    sub(nig, "NextId", Value=str(max_id))

    # master chain strip + unity staging + tempo (earned rules)
    master = ls.find("MainTrack")
    mdevs = master.find("DeviceChain/DeviceChain/Devices")
    if mdevs is None:
        mdevs = master.find("DeviceChain/Devices")
    if mdevs is not None:
        for d in list(mdevs):
            mdevs.remove(d)
    for container_path in ("AutomationEnvelopes",
                           "DeviceChain/SignalModulations"):
        cont = master.find(container_path)
        if cont is not None:
            for c in list(cont):
                cont.remove(c)
    tempo = ls.find("MainTrack/DeviceChain/Mixer/Tempo")
    if tempo is None:
        tempo = ls.find("MainTrack").find(".//Mixer/Tempo")
    if tempo is not None and tempo.find("Manual") is not None:
        tempo.find("Manual").set("Value", repr(int(TEMPO)))
    for holder, path in ((ls, "MainTrack/DeviceChain/Mixer/Volume"),
                         (keep, "DeviceChain/Mixer/Volume")):
        vol = holder.find(path)
        if vol is not None:
            man = vol.find("Manual")
            if man is not None:
                man.set("Value", "1.0")

    out = OUT_DIR / f"midi-{dev_name.lower()}.als"
    xml = ET.tostring(root, encoding="unicode")
    data = ('<?xml version="1.0" encoding="UTF-8"?>\n' + xml).encode()
    with gzip.GzipFile(str(out), "wb", mtime=0) as f:
        f.write(data)
    print(f"built {out}")
    print(f"device={dev_name} notes={len(notes)} end_beat={end_beat}")


if __name__ == "__main__":
    build(sys.argv[1], sys.argv[2:-1], sys.argv[-1])
