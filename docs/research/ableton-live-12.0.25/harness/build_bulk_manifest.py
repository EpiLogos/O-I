#!/usr/bin/env python3
"""Build the FULL-programme bulk render manifest — every Live 12 Suite device.

Offline only: enumerates device folders from the app bundle, resolves a
factory default state (.adv) per device, parses its automatable parameter
surface, and emits queue entries (JSONL) for golden renders:

  harness/bulk/manifest.jsonl     every device, every entry
  harness/bulk/queue_slice1.jsonl first committed slice: 5 proven-class FX
  harness/bulk/queue_rest.jsonl   everything else

Entry shape: {label, device, class, set_path, signal, preset, kind[, param, value]}
  - class "instrument" -> M1 4-note velocity clip lineage (midi-operator.als
    pattern; notes 48 vel 127/96/64/32, loop 11.75 beats), signal "m1-velocity"
  - class "audio"      -> impulse / sweep-20-20k / steps-1k lineages
    (build_set.py pattern; shrunk loops = content + 2 beats, 10.0 for impulse)
  - class "midi"       -> M1 clip lineage (see gaps.md audibility caveat)
  - pins: up to 5 extra impulse renders per device, values round-robined
    (min/max/mid) across the 3 most sonic MidiControllerRange params
    (gain/filter/amount-like names first). Instruments/MIDI FX reuse the M1
    clip for pins — an impulse audio file cannot excite them.

Default-state resolution per device:
  1. Core Library/Defaults/<class>/<Device>.adv     (factory default)
  2. "<Device>.adv" inside Core Library/Devices/<class>/<Device>/
  3. first (sorted) *.adv inside that device folder
  4. none -> recorded as a gap, no render entries
Max* stubs are skipped and noted. "Legacy" expands to its 5 real sub-devices.
"""
import gzip
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

LANE = Path(__file__).parent.parent
APP = Path("/Applications/Ableton Live 12 Suite.app/Contents/App-Resources/"
           "Core Library")
DEV_ROOT = APP / "Devices"
DEF_ROOT = APP / "Defaults"
BULK = Path(__file__).parent / "bulk"

CLASSES = (("Instruments", "instrument"),
           ("Audio Effects", "audio"),
           ("MIDI Effects", "midi"))
SIGNALS_AUDIO = ("impulse.wav", "sweep-20-20k.wav", "steps-1k.wav")
SIGNAL_MIDI = "m1-velocity"
SLICE1 = {"Compressor", "Saturator", "EQ Eight", "Auto Filter", "Utility"}

# params whose "range" is a discrete choice, not a sonic continuum
DISCRETE = re.compile(
    r"^(.*(Type|Mode|Shape|Curve|Wave|Model|Algorithm|Quality|Style|Kind|"
    r"Source|Sync|Freeze|On|Off|Enabled|Link|Chorus|Fold|Hiq|Oversample)$"
    r"|On|DryWetLocked)$")
SONIC_T1 = ("gain", "drive", "volume", "amount", "depth", "width", "level",
            "feedback", "resonance", "reso", "cutoff", "freq", "satur",
            "overdrive", "threshold", "ratio")
SONIC_T2 = ("filter", "tone", "color", "wet", "dry", "mix", "damp", "decay",
            "attack", "release", "time", "rate", "intensity", "character",
            "spread", "width", "pan", "detune", "glide", "flux", "out")


def slug(s):
    s = re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-").lower()
    return s or "x"


def is_num(s):
    try:
        float(s)
        return True
    except (TypeError, ValueError):
        return False


def fmt(v):
    """Format a pin value the way Live writes them."""
    if abs(v - round(v)) < 1e-9:
        return str(int(round(v)))
    return f"{v:.6f}".rstrip("0")


def sonic_score(tag):
    t = tag.lower()
    if any(k in t for k in SONIC_T1):
        return 2
    if any(k in t for k in SONIC_T2):
        return 1
    return 0


def parse_params(adv_path):
    """Direct children of the device element with a numeric Manual and a
    numeric MidiControllerRange: {tag: (min, max)}."""
    dev = list(ET.parse(gzip.open(str(adv_path))).getroot())[0]
    params = {}
    for c in list(dev):
        man = c.find("Manual")
        mcr = c.find("MidiControllerRange")
        if man is None or mcr is None:
            continue
        mn, mx = mcr.find("Min"), mcr.find("Max")
        if mn is None or mx is None:
            continue
        if not (is_num(mn.get("Value")) and is_num(mx.get("Value"))
                and is_num(man.get("Value"))):
            continue
        if DISCRETE.match(c.tag):
            continue
        params[c.tag] = (float(mn.get("Value")), float(mx.get("Value")))
    return dev.tag, params


def pick_pins(params):
    """Up to 5 pins: round-robin min/max/mid across the 3 most sonic params."""
    ranked = sorted(params.items(), key=lambda kv: (-sonic_score(kv[0]), kv[0]))
    ranked = [kv for kv in ranked if sonic_score(kv[0]) > 0] or ranked[:3]
    ranked = ranked[:3]
    cands = []
    for rnd in ("min", "max", "mid"):
        for tag, (mn, mx) in ranked:
            v = {"min": mn, "max": mx, "mid": (mn + mx) / 2.0}[rnd]
            cands.append((tag, v, rnd))
    out, seen = [], set()
    for tag, v, rnd in cands:
        key = (tag, fmt(v))
        if key in seen:
            continue
        seen.add(key)
        out.append((tag, v, rnd))
        if len(out) >= 5:
            break
    return out


def resolve_adv(cls_dir, device):
    """Returns (adv_path, source) or (None, reason). Flat preference, then a
    recursive pass for devices whose presets live in category subfolders
    (e.g. Echo/{Ambient Spaces,Clean Delay,...})."""
    d = DEF_ROOT / cls_dir / f"{device}.adv"
    if d.exists():
        return d, "Defaults"
    folder = DEV_ROOT / cls_dir / device
    exact = folder / f"{device}.adv"
    if exact.exists():
        return exact, "preset(exact)"
    advs = sorted(p for p in folder.glob("*.adv"))
    if advs:
        return advs[0], "preset(first)"
    hit = next((p for p in sorted(folder.glob("*/*.adv"))
                if p.stem == device), None)
    if hit is not None:
        return hit, "preset(exact-sub)"
    advs = sorted(folder.glob("*/*.adv"))
    if advs:
        return advs[0], "preset(first-sub)"
    return None, "no .adv in Defaults or device folder (recursive)"


def inventory():
    """Every renderable device; Max* stubs noted separately."""
    devices, stubs, legacy = [], [], []
    for cls_dir, cls in CLASSES:
        for d in sorted(p for p in (DEV_ROOT / cls_dir).iterdir() if p.is_dir()):
            name = d.name
            if name == "Ableton Folder Info":
                continue
            if name.startswith("Max "):
                stubs.append((cls_dir, name))
                continue
            if name == "Legacy":
                for sub in sorted(p for p in d.iterdir() if p.is_dir()):
                    advs = sorted(p for p in sub.glob("*.adv"))
                    if advs:
                        legacy.append((cls_dir, sub.name, advs[0], "legacy-preset"))
                    else:
                        legacy.append((cls_dir, sub.name, None, "legacy: no .adv"))
                continue
            devices.append((cls_dir, cls, name))
    return devices, stubs, legacy


def main():
    BULK.mkdir(exist_ok=True)
    devices, stubs, legacy = inventory()

    entries, gaps, n_adv = [], [], 0
    stats = {}

    def emit(cls_dir, cls, device, adv, source, variant=None):
        nonlocal n_adv
        dev_tag, params = parse_params(adv)
        pins = pick_pins(params)
        dev_slug = slug(device)
        if variant:
            dev_slug = f"legacy-{dev_slug}"
        n_adv += 1
        rows = []
        sigs = [SIGNAL_MIDI] if cls in ("instrument", "midi") else \
               [s for s in SIGNALS_AUDIO]
        for sig in sigs:
            label = f"BULK-{dev_slug}-default-{slug(sig)}"
            rows.append({
                "label": label,
                "device": device,
                "class": cls,
                "set_path": f"docs/research/ableton-live-12.0.25/"
                            f"harness/live/{label}.als",
                "signal": sig,
                "preset": str(adv),
                "kind": "default",
                "source": source,
                "device_tag": dev_tag,
            })
            if variant:
                rows[-1]["variant"] = "legacy"
        for tag, v, rnd in pins:
            label = f"BULK-{dev_slug}-pin-{slug(tag)}-{rnd}"
            row = {
                "label": label,
                "device": device,
                "class": cls,
                "set_path": f"docs/research/ableton-live-12.0.25/"
                            f"harness/live/{label}.als",
                "signal": SIGNAL_MIDI if cls in ("instrument", "midi")
                          else "impulse.wav",
                "preset": str(adv),
                "kind": "pin",
                "param": tag,
                "value": fmt(v),
                "source": source,
                "device_tag": dev_tag,
            }
            if variant:
                row["variant"] = "legacy"
            rows.append(row)
        entries.extend(rows)
        stats.setdefault(cls, []).append((device, len(rows), len(params)))

    for cls_dir, cls, name in devices:
        adv, src = resolve_adv(cls_dir, name)
        if adv is None:
            gaps.append((cls_dir, name, src))
            continue
        emit(cls_dir, cls, name, adv, src)
    for cls_dir, name, adv, src in legacy:
        if adv is None:
            gaps.append((cls_dir, name, src))
            continue
        emit(cls_dir, "audio", name, adv, src, variant=True)

    slice1 = [e for e in entries if e["class"] == "audio"
              and e["device"] in SLICE1]
    rest = [e for e in entries if e not in slice1]

    for path, rows in ((BULK / "manifest.jsonl", entries),
                       (BULK / "queue_slice1.jsonl", slice1),
                       (BULK / "queue_rest.jsonl", rest)):
        with open(path, "w") as f:
            for r in rows:
                f.write(json.dumps(r) + "\n")

    # gaps ledger — build failures are appended by build_bulk_sets.py
    with open(BULK / "gaps.md", "w") as f:
        f.write("# Bulk lane gaps\n\n")
        f.write("Max* stub folders (no .adv, no device XML) — skipped, noted "
                "here only:\n")
        for cls_dir, name in stubs:
            f.write(f"- {cls_dir}/{name} (Max for Live stub)\n")
        f.write("\nDevices with no factory default state found — no manifest "
                "entries, flagged for a later lane:\n")
        for cls_dir, name, why in gaps:
            f.write(f"- {cls_dir}/{name}: {why}\n")
        if not gaps:
            f.write("- (none)\n")
        f.write("\nAdaptations (documented, not invented):\n")
        f.write("- Instruments and MIDI FX use the M1 4-note velocity clip "
                "for pin renders (an impulse WAV cannot excite them).\n")
        f.write("- MIDI FX default/pin renders will be silent audio unless an "
                "instrument sits downstream; their .als still carries the "
                "device state for offline diffing. Audible pairing flagged "
                "for a later lane.\n")
        f.write("- 'Legacy' folder expanded to its 5 real sub-devices "
                "(Chorus, Flanger, Frequency Shifter, Phaser, Redux Legacy), "
                "each on its first preset .adv.\n")
        f.write("- Pins skip params with no numeric MidiControllerRange and "
                "discrete-choice params (Type/Mode/Shape/...).\n")

    n_dev = sum(len(v) for v in stats.values())
    print(f"devices renderable: {n_dev}  (stubs skipped: {len(stubs)}, "
          f"gaps: {len(gaps)})")
    for cls, ds in sorted(stats.items()):
        tot = sum(r for _, r, _ in ds)
        print(f"  {cls}: {len(ds)} devices, {tot} entries")
    print(f"manifest.jsonl: {len(entries)} entries | slice1: {len(slice1)} "
          f"| rest: {len(rest)}")
    for e in slice1[:3]:
        print("  sample:", e["label"], e["set_path"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
