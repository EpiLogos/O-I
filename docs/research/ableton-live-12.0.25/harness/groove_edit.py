#!/usr/bin/env python3
"""Edit a built .als in place: attach a factory groove to the audio clip.

Usage: groove_edit.py <set.als> <groove display name> [timing_amount]

Creates/extends LiveSet/GroovePool/Grooves with one Groove entry whose Name
matches an installed factory .agr (Core Library), and points the arrangement
AudioClip's GrooveSettings/GrooveId at it. The exact GroovePool schema is a
probe: first run uses the minimal plausible shape and lets the loader log
teach the corrections (same method that earned the session-model loader
rules).
"""
import gzip
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


def sub(parent, tag, **attrs):
    el = ET.SubElement(parent, tag)
    for k, v in attrs.items():
        el.set(k, v)
    return el


def main(als_path, groove_name, timing_amount="100"):
    p = Path(als_path)
    root = ET.parse(gzip.open(p)).getroot()
    ls = root.find("LiveSet")

    pool = ls.find("GroovePool")
    if pool is None:
        pool = sub(ls, "GroovePool")
    grooves = pool.find("Grooves")
    if grooves is None:
        grooves = sub(pool, "Grooves")
    for g in list(grooves):
        grooves.remove(g)

    gid = "5001"
    g = sub(grooves, "Groove", Id=gid)
    sub(g, "LomId", Value="0")
    sub(g, "Name", Value=groove_name)
    sub(g, "TimingAmount", Value=str(timing_amount))
    sub(g, "VelocityAmount", Value="0")
    sub(g, "RandomAmount", Value="0")
    sub(g, "QuantizationAmount", Value="0")

    clip = root.find(".//MainSequencer/Sample/ArrangerAutomation/Events/AudioClip")
    assert clip is not None, "no arrangement AudioClip"
    gs = clip.find("GrooveSettings")
    assert gs is not None, "clip has no GrooveSettings"
    gid_el = gs.find("GrooveId")
    gid_el.set("Value", gid)

    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           + ET.tostring(root, encoding="unicode")).encode()
    with gzip.GzipFile(str(p), "wb", mtime=0) as f:
        f.write(xml)
    print(f"{p.name}: GroovePool += '{groove_name}' (Id {gid}, "
          f"TimingAmount {timing_amount}); clip GrooveId -> {gid}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], *(sys.argv[3:4] or ["100"]))
