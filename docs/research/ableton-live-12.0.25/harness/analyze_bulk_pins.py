#!/usr/bin/env python3
"""BULK corpus pin-quality audit (offline, pure stdlib).

For every entry of bulk/manifest.jsonl with kind=="pin", compares the pin
render against the device's default render OF THE SAME SIGNAL (audio class:
default-impulse-wav; instrument/midi class: default-m1-velocity). Frame
delta per channel, in 16-bit LSB. Dither-identical => max |delta| <= 2 LSB
(same threshold as the saturation-gate finding).

Writes harness/bulk/inert_pins.md: per device, each pin classified
live / inert / vacuous-silent, with the measured max |delta| evidence and
the pin's audit class:
  - no-op: the pin value equals the device default (probes nothing)
  - silent-carrier: both renders are dither-only silence (MIDI FX with no
    downstream instrument; Impulse with empty sample slots)
  - genuine: value differs from default, carrier present
Any "## Diagnosis" section already present in inert_pins.md is preserved
verbatim across re-runs (it is authored, not generated).

Usage: python3 analyze_bulk_pins.py
"""
import gzip
import json
import struct
import sys
import xml.etree.ElementTree as ET
from collections import OrderedDict, defaultdict
from pathlib import Path

HERE = Path(__file__).parent
MANIFEST = HERE / "bulk/manifest.jsonl"
RENDERS = HERE / "renders"
OUT = HERE / "bulk/inert_pins.md"

DITHER_LSB = 2.0   # max |delta| <= 2 LSB => dither-identical
MARGINAL_LSB = 16  # 3..16 LSB: at/near the noise floor for quiet renders


def read_aiff(path):
    """-> (nch, [int16 samples interleaved]) for the BULK corpus AIFFs."""
    data = Path(path).read_bytes()
    assert data[:4] == b"FORM", path
    pos, ssnd, nch = 12, None, 2
    while pos + 8 <= len(data):
        cid, size = data[pos:pos + 4], struct.unpack(">I", data[pos + 4:pos + 8])[0]
        body = data[pos + 8:pos + 8 + size]
        if cid == b"COMM":
            nch = struct.unpack(">h", body[0:2])[0]
        elif cid == b"SSND":
            off = struct.unpack(">I", body[0:4])[0]
            ssnd = body[8 + off:]
        pos += 8 + size + (size & 1)
    n = len(ssnd) // 2
    s = struct.unpack(">%dh" % n, ssnd[:2 * n])
    return nch, s


def frame_delta(path_a, path_b):
    """Per-channel max |delta| in LSB, plus per-channel peaks."""
    na, sa = read_aiff(path_a)
    nb, sb = read_aiff(path_b)
    n = min(len(sa), len(sb))
    deltas, peaks_a, peaks_b = [], [], []
    for ch in range(na):
        deltas.append(max(abs(sa[i] - sb[i]) for i in range(ch, n, na)))
        peaks_a.append(max(abs(sa[i]) for i in range(ch, n, na)))
        peaks_b.append(max(abs(sb[i]) for i in range(ch, n, na)))
    return deltas, peaks_a, peaks_b, na, len(sa), len(sb)


def adv_defaults(preset):
    """{tag: Manual value} for direct children of the device element."""
    out = {}
    try:
        dev = list(ET.parse(gzip.open(preset)).getroot())[0]
    except Exception:
        return out
    for c in list(dev):
        man = c.find("Manual")
        if man is not None and man.get("Value") is not None:
            out[c.tag] = man.get("Value")
    return out


def set_value(set_path, device_tag, param):
    """The Manual value of `param` inside the device under test, as stored
    in the built set — the render's actual provenance (the manifest may
    have been regenerated ahead of a rebuild)."""
    p = Path(set_path)
    if not p.is_absolute():  # manifest set_path is repo-relative
        p = HERE.parents[3] / p
    try:
        root = ET.parse(gzip.open(p)).getroot()
    except Exception:
        return None
    for dev in root.iter(device_tag):
        el = dev.find(param)
        if el is None:
            continue
        man = el.find("Manual")
        if man is not None:
            return man.get("Value")
    return None


def read_diagnosis():
    """Preserve an authored '## Diagnosis' section across re-runs."""
    if not OUT.exists():
        return ""
    txt = OUT.read_text()
    i = txt.find("\n## Diagnosis")
    return txt[i + 1:] if i >= 0 else ""


def main():
    rows = [json.loads(l) for l in open(MANIFEST)]
    by_device = defaultdict(list)
    for r in rows:
        by_device[r["device"]].append(r)

    diagnosis = read_diagnosis()
    detail = []
    counts = {"live": 0, "inert": 0, "vacuous": 0, "no_render": 0}
    classes = defaultdict(int)
    inert_devices = defaultdict(int)

    for dev, entries in sorted(by_device.items()):
        defaults = {e["signal"]: e for e in entries if e["kind"] == "default"}
        pins = [e for e in entries if e["kind"] == "pin"]
        cls = entries[0]["class"]
        adv_def = adv_defaults(entries[0]["preset"]) if pins else {}
        lines, notes = [], []
        default_sigs = sorted(e["signal"] for e in entries
                              if e["kind"] == "default")
        if not pins:
            notes.append("no pins in manifest; defaults only "
                         f"(signals: {', '.join(default_sigs)})")
        for p in pins:
            sig = p["signal"]
            ref = defaults.get(sig)
            pa = RENDERS / f"{p['label']}.aif"
            if ref is None:
                notes.append(f"{p['label']}: no default render of signal "
                             f"'{sig}' (defaults: {', '.join(default_sigs)}) "
                             "— not auditable")
                counts["no_render"] += 1
                continue
            pb = RENDERS / f"{ref['label']}.aif"
            if not (pa.exists() and pb.exists()):
                notes.append(f"{p['label']}: render missing on disk")
                counts["no_render"] += 1
                continue
            deltas, peak_a, peak_b, nch, la, lb = frame_delta(pa, pb)
            mx = max(deltas)

            dflt = adv_def.get(p["param"])
            rendered = set_value(p["set_path"], p["device_tag"], p["param"])
            rv = rendered if rendered is not None else p["value"]
            try:
                noop = dflt is not None and abs(float(dflt) - float(rv)) < 1e-6
            except (TypeError, ValueError):
                noop = dflt == rv
            stale = ""
            try:
                if rendered is not None and \
                        abs(float(rendered) - float(p["value"])) >= 1e-9:
                    stale = (f" [set carries {rendered}, manifest {p['value']}"
                             " — pending rebuild]")
            except (TypeError, ValueError):
                if rendered != p["value"]:
                    stale = (f" [set carries {rendered}, manifest "
                             f"{p['value']} — pending rebuild]")
            silent = max(peak_a) <= DITHER_LSB and max(peak_b) <= DITHER_LSB

            if silent:
                verdict = "vacuous"
                counts["vacuous"] += 1
                vtxt = "vacuous (dither-only silence)"
                classes["silent-carrier"] += 1
            elif mx <= DITHER_LSB:
                verdict = "inert"
                counts["inert"] += 1
                inert_devices[dev] += 1
                classes["no-op" if noop else "genuine"] += 1
                vtxt = ("INERT (dither-identical; no-op value = default)"
                        if noop else "INERT (dither-identical)")
            else:
                verdict = "live"
                counts["live"] += 1
                classes["no-op" if noop else "genuine"] += 1
                if noop:
                    vtxt = ("live BUT no-op value = default (delta is "
                            "render-side variance, not the pin)")
                elif mx <= MARGINAL_LSB:
                    vtxt = "live (marginal, <=16 LSB: at the noise floor)"
                else:
                    vtxt = "live"
            if la != lb:
                notes.append(f"{p['label']}: length mismatch "
                             f"{la} vs {lb} samples; min-length compare")
            lines.append(
                f"| `{p['label']}` | {p['param']}={rv} | "
                f"{int(mx)} | {'/'.join(str(d) for d in deltas)} | "
                f"{vtxt}{stale} |")
        detail.append((dev, cls, lines, notes))

    total = sum(counts.values())
    with open(OUT, "w") as f:
        f.write("# BULK corpus pin-quality audit\n\n")
        f.write("Offline audit of `harness/bulk/manifest.jsonl` pin entries "
                "against their device's same-signal default render "
                "(`*-default-impulse-wav` for audio devices; "
                "`*-default-m1-velocity` for instruments and MIDI FX, whose "
                "pin renders reuse the M1 clip). Frame delta, per channel, in "
                "16-bit LSB; **dither-identical: max |delta| <= 2 LSB** "
                "(a real parameter change measures in the hundreds to "
                "thousands of LSB). Analyzer: `harness/analyze_bulk_pins.py` "
                "(pure stdlib, reads only committed renders).\n\n")
        f.write(f"**Totals: {total} pins — {counts['live']} live, "
                f"{counts['inert']} inert, {counts['vacuous']} vacuous "
                f"(dither-only silence), {counts['no_render']} not "
                f"auditable.** Audit classes among live+inert pins: "
                f"no-op {classes['no-op']}, genuine "
                f"{classes['genuine']}, silent-carrier "
                f"{classes['silent-carrier']}.\n\n")
        if inert_devices:
            f.write("Inert pins by device: ")
            f.write(", ".join(f"{d} ({n})"
                              for d, n in sorted(inert_devices.items())))
            f.write("\n\n")
        f.write("## Per-device detail\n\n")
        for dev, cls, lines, notes in detail:
            if not lines and not notes:
                continue
            f.write(f"### {dev} ({cls})\n\n")
            if lines:
                f.write("| pin | value | max|Δ| LSB | L/R LSB | verdict |\n")
                f.write("|---|---|---|---|---|\n")
                for l in lines:
                    f.write(l + "\n")
                f.write("\n")
            for n in notes:
                f.write(f"- NOTE: {n}\n")
            if notes:
                f.write("\n")
        f.write("## Devices with defaults but no pins (nothing auditable)"
                "\n\n")
        none_pins = [dev for dev, _, lines, _ in detail
                     if not lines and any(e["kind"] == "default"
                                          for e in by_device[dev])]
        if none_pins:
            for d in none_pins:
                sigs = sorted(e["signal"] for e in by_device[d]
                              if e["kind"] == "default")
                f.write(f"- {d} (default signals: {', '.join(sigs)})\n")
        else:
            f.write("- (none)\n")
        if diagnosis:
            f.write("\n" + diagnosis)
    print(f"wrote {OUT}: {total} pins — live {counts['live']}, "
          f"inert {counts['inert']}, vacuous {counts['vacuous']}, "
          f"not auditable {counts['no_render']}; classes: "
          f"no-op {classes['no-op']}, genuine {classes['genuine']}, "
          f"silent-carrier {classes['silent-carrier']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
