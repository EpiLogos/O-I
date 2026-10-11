#!/usr/bin/env python3
"""Operator VelDst Connection sweep analysis: per-note level + pitch.

Notes (120 BPM): key 48 (C3, f0 = 130.81 Hz), beats 0/2/4/6 = s 0/1/2/3,
each sounds 0.875 s, velocities 127/96/64/32.

A Connection is a LEVEL destination if per-note RMS rises with velocity;
a PITCH destination if the note-1 fundamental shifts with velocity.
Pitch: Goertzel scan 90-180 Hz (0.5 Hz steps) over the note-1 steady window.
"""
import math
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_render import read_aiff, rms_db

NOTES = [(0.0, 127), (1.0, 96), (2.0, 64), (3.0, 32)]
C3 = 130.81278265


def goertzel_peak(x, rate, f0, f1, step, t0, t1):
    s, e = int(t0 * rate), int(t1 * rate)
    seg = x[s:e]
    n = len(seg)
    best, bf = -1e30, 0.0
    f = f0
    while f <= f1:
        w = 2.0 * math.pi * f / rate
        coeff = 2.0 * math.cos(w)
        q1 = q2 = 0.0
        for v in seg:
            q0 = coeff * q1 - q2 + v
            q2, q1 = q1, q0
        a = math.sqrt(max(q1 * q1 + q2 * q2 - coeff * q1 * q2, 0.0)) * 2.0 / n
        if a > best:
            best, bf = a, f
        f += step
    return bf, 20 * math.log10(best / 32768.0) if best > 0 else -144.0


def main(path):
    rate, bits, x = read_aiff(path)
    print(f"== {path}")
    print("  per-note RMS (window start+0.15..start+0.70):")
    levels = []
    for start, vel in NOTES:
        s, e = int((start + 0.15) * rate), int((start + 0.70) * rate)
        lv = rms_db(x[s:e])
        levels.append(lv)
        print(f"    vel {vel:3d}: {lv:8.2f} dBFS")
    spread = levels[0] - levels[3]
    print(f"    level spread vel127 vs vel32: {spread:+.2f} dB "
          f"({'LEVEL destination' if abs(spread) > 3 else 'flat'})")
    f, db = goertzel_peak(x, rate, 90.0, 180.0, 0.5, 0.15, 0.70)
    cents = 1200.0 * math.log2(f / C3)
    print(f"    note-1 fundamental: {f:7.2f} Hz ({db:6.2f} dBFS) "
          f"= C3{cents:+7.1f} cent  "
          f"({'PITCH destination' if abs(cents) > 30 else '~no pitch shift'})")


if __name__ == "__main__":
    for p in sys.argv[1:]:
        main(p)
