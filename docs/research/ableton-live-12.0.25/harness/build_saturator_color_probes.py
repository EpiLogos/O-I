#!/usr/bin/env python3
"""Saturator colour-pin diagnostic probes (offline build, no Live).

The 2026-10-11 inert-pin audit found the five BULK saturator colour pins
dither-identical to the default although their values are present in the
.als at the correct element path (bulk/inert_pins.md, "Diagnosis"). These
three probes bound the mechanism:

  BULK-saturator-probe-predrive-max   PreDrive=36   — does a non-colour
      float parameter reach the DSP from a stored set value?
  BULK-saturator-probe-postclip-on    PostClip=true — does a structural
      toggle reach the DSP from a stored set value?
  BULK-saturator-probe-basedrive-env  BaseDrive=36 PLUS an arrangement
      automation envelope on BaseDrive (constant 36 from t=-63072000) —
      does a post-load value application (transport-time automation)
      reach the colour stage?

Sets are built with the proven build_bulk_sets/build_set lineage (impulse
signal, shrunk loop); the envelope one is post-edited to insert
AutomationEnvelopes/Envelopes/AutomationEnvelope targeting the built set's
BaseDrive AutomationTarget pointee id (same shape as a real Live-saved
envelope, evidence/sets/template-piano-voices-mastering.xml).

Usage: python3 build_saturator_color_probes.py
"""
import gzip
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
import build_bulk_sets  # noqa: E402

APP = "/Applications/Ableton Live 12 Suite.app/Contents/App-Resources"
Q = HERE / "bulk/queue_color_probes.jsonl"

BASE = {
    "device": "Saturator",
    "class": "audio",
    "signal": "impulse.wav",
    "preset": f"{APP}/Core Library/Defaults/Audio Effects/Saturator.adv",
    "source": "Defaults",
    "device_tag": "Saturator",
}

PROBES = [
    ("BULK-saturator-probe-predrive-max", "PreDrive", "36"),
    ("BULK-saturator-probe-postclip-on", "PostClip", "true"),
    ("BULK-saturator-probe-basedrive-env", "BaseDrive", "36"),
]


def insert_basedrive_envelope(als_path):
    """Post-edit: add a constant-36 BaseDrive automation envelope to the
    arrangement, targeting the set's own BaseDrive AutomationTarget id."""
    root = ET.parse(gzip.open(als_path)).getroot()
    ls = root.find("LiveSet")
    track = list(ls.find("Tracks"))[0]
    sat = next(root.iter("Saturator"))
    target_id = sat.find("BaseDrive/AutomationTarget").get("Id")

    ae = track.find("AutomationEnvelopes")
    envs = ae.find("Envelopes")
    if envs is None:
        envs = ET.SubElement(ae, "Envelopes")
    env = ET.SubElement(envs, "AutomationEnvelope", Id="40001")
    etgt = ET.SubElement(env, "EnvelopeTarget")
    ET.SubElement(etgt, "PointeeId", Value=target_id)
    auto = ET.SubElement(env, "Automation")
    events = ET.SubElement(auto, "Events")
    for i, (t, ev) in enumerate((("-63072000", "50001"), ("0", "50002"),
                                 ("40", "50003"))):
        ET.SubElement(events, "FloatEvent", Id=ev, Time=t, Value="36")
    xform = ET.SubElement(auto, "AutomationTransformViewState")
    ET.SubElement(xform, "IsTransformPending", Value="false")
    ET.SubElement(xform, "TimeAndValueTransforms")

    xml = ET.tostring(root, encoding="unicode")
    data = ('<?xml version="1.0" encoding="UTF-8"?>\n' + xml).encode()
    with gzip.GzipFile(str(als_path), "wb", mtime=0) as f:
        f.write(data)
    return target_id


def main():
    rows = []
    for label, param, value in PROBES:
        row = dict(BASE)
        row["label"] = label
        row["set_path"] = (f"docs/research/ableton-live-12.0.25/harness/"
                           f"live/{label}.als")
        row["kind"] = "pin"
        row["param"] = param
        row["value"] = value
        rows.append(row)
    with open(Q, "w") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")

    for label, row in zip((p[0] for p in PROBES), rows):
        build_bulk_sets.build_row(row)
        if label.endswith("basedrive-env"):
            dest = Path("/Users/admin/Central/Work/O-I") / row["set_path"]
            tid = insert_basedrive_envelope(dest)
            print(f"  envelope inserted -> BaseDrive AutomationTarget Id {tid}")
    print("built", len(rows), "saturator colour probes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
