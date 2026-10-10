#!/usr/bin/env python3
"""Build the BULK golden-render sets from a bulk queue JSONL (offline, no Live).

For each queue entry, injects the device (from its resolved factory .adv)
into the real template set via the proven builders (build_set.py for audio
lineages, build_set_midi.py for the M1 4-note velocity clip lineage), then
renames the result to the entry's set_path. Sets are ET+gzip-mtime0, loop
shrunk to content + 2 beats (10.0 for impulse, 11.75 for M1), device On,
DryWet and all other params at .adv defaults (pins excepted).

Usage: build_bulk_sets.py <queue.jsonl> [<queue2.jsonl> ...]
Appends build failures to harness/bulk/gaps.md.
"""
import collections
import gzip
import json
import shutil
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

LANE = Path(__file__).parent.parent
sys.path.insert(0, str(Path(__file__).parent))
import build_set            # noqa: E402
import build_set_midi       # noqa: E402

M1_NOTES = "48,127,0,1.75;48,96,2,1.75;48,64,4,1.75;48,32,6,1.75"
SIGNALS_DIR = Path(__file__).parent / "signals"
OUT_DIR = LANE / "harness/live"
SCRATCH = Path(tempfile.mkdtemp(prefix="bulk-scratch-"))
GAPS = Path(__file__).parent / "bulk/gaps.md"


def prep_preset(preset, label):
    """Plain-XML scratch copy with the device forced On (stipulated staging;
    every other value stays at the .adv default)."""
    root = ET.parse(gzip.open(preset)).getroot()
    dev = list(root)[0]
    on = dev.find("On")
    changed = False
    if on is not None and on.find("Manual") is not None:
        if on.find("Manual").get("Value") != "true":
            on.find("Manual").set("Value", "true")
            changed = True
    scratch = SCRATCH / f"{label}.xml"
    scratch.write_text(ET.tostring(root, encoding="unicode"))
    return scratch, dev.tag, changed


def build_row(row):
    label = row["label"]
    scratch, dev_tag, on_forced = prep_preset(row["preset"], label)
    assert dev_tag == row["device_tag"], (dev_tag, row["device_tag"])
    pins = []
    if row["kind"] == "pin":
        pins = [f"{row['param']}={row['value']}"]

    build_set.OUT_DIR = build_set_midi.OUT_DIR = SCRATCH
    if row["class"] == "audio":
        sig = str((SIGNALS_DIR / row["signal"]).resolve())
        build_set.build(scratch, pins, sig)
    else:
        build_set_midi.build(scratch, pins, M1_NOTES)

    built = next(SCRATCH.glob(f"*-{dev_tag.lower()}.als"))
    dest = LANE.parent.parent.parent / row["set_path"]  # repo-relative
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(built), dest)

    # verify: gunzips, carries the device, loop shrunk, pin applied
    xml = gzip.open(dest).read().decode()
    checks = [dev_tag in xml,
              'LoopLength Value="10.0"' in xml
              if row["signal"] == "impulse.wav"
              else ('LoopLength Value="11.75"' in xml
                    if row["signal"] == "m1-velocity" else True)]
    if row["kind"] == "pin":
        checks.append(f'Value="{row["value"]}"' in xml)
    if not all(checks):
        raise RuntimeError(f"verification failed {checks}")
    return on_forced


def main(queues):
    rows = []
    for q in queues:
        rows += [json.loads(l) for l in open(q)]
    ok, fails, forced = 0, [], 0
    per_dev = collections.Counter()
    for row in rows:
        try:
            if build_row(row):
                forced += 1
            ok += 1
            per_dev[row["device"]] += 1
        except Exception as e:  # noqa: BLE001 — bulk lane: record and move on
            fails.append((row["label"], repr(e)))
            print(f"  FAIL {row['label']}: {e!r}")
    with open(GAPS, "a") as f:
        f.write(f"\n## Build results ({', '.join(q.split('/')[-1] for q in queues)})\n")
        f.write(f"- built OK: {ok}/{len(rows)}\n")
        if forced:
            f.write(f"- devices whose .adv carried On=false, forced On per "
                    f"stipulation: {forced}\n")
        for label, err in fails:
            f.write(f"- FAIL {label}: {err}\n")
    print(f"built {ok}/{len(rows)} sets; failures: {len(fails)}")
    for d, n in per_dev.most_common(8):
        print(f"  {d}: {n}")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:] or
                  [str(Path(__file__).parent / "bulk/queue_slice1.jsonl")]))
