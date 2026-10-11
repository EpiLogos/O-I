#!/usr/bin/env python3
"""Disambiguate Wavetable M2 envelope from waveform drift.

1. h1 Goertzel (20 ms windows, 2-cycle span... 20 ms ~ 2.6 cycles) across
   note 1 (on 1.0 s) and note 3 tail (off 3.875 s): the true amp-envelope
   shape, independent of any position-induced waveform change.
2. h2/h1 and (h2+h3)/h1 ratio per window across ALL FOUR notes: timbre
   drift = position law evidence; per-note differences = velocity→position.
"""
import math
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_render import read_aiff

RATE = 44100.0
C3 = 130.81278265


def amp_at(x, f, t0, t1):
    s, e = int(t0 * RATE), int(t1 * RATE)
    seg = x[s:e]
    n = len(seg)
    w = 2.0 * math.pi * f / RATE
    coeff = 2.0 * math.cos(w)
    q1 = q2 = 0.0
    for v in seg:
        q0 = coeff * q1 - q2 + v
        q2, q1 = q1, q0
    return math.sqrt(max(q1 * q1 + q2 * q2 - coeff * q1 * q2, 0.0)) * 2.0 / n


def db(a):
    return 20 * math.log10(max(a, 1e-12) / 32768.0)


def track(x, t0, t1, label):
    print(f"  {label}: t_rel_ms  h1_dBFS  h2/h1_dB  h3/h1_dB")
    t = t0 + 0.010
    while t < t1:
        h1 = amp_at(x, C3, t - 0.010, t + 0.010)
        h2 = amp_at(x, 2 * C3, t - 0.010, t + 0.010)
        h3 = amp_at(x, 3 * C3, t - 0.010, t + 0.010)
        print(f"    +{(t - t0) * 1000:6.1f}  {db(h1):8.2f}  "
              f"{db(h2) - db(h1):8.2f}  {db(h3) - db(h1):8.2f}")
        t += 0.020


def main(path):
    rate, bits, x = read_aiff(path)
    track(x, 1.0, 1.90, "note 1 decay+sustain (on 1.0 s)")
    track(x, 3.875, 4.55, "note 3 release (off 3.875 s)")
    print("  per-note timbre (steady windows):")
    for start, vel in [(0.0, 127), (1.0, 96), (2.0, 64), (3.0, 32)]:
        a = amp_at(x, C3, start + 0.15, start + 0.70)
        h2 = amp_at(x, 2 * C3, start + 0.15, start + 0.70)
        h3 = amp_at(x, 3 * C3, start + 0.15, start + 0.70)
        print(f"    vel {vel:3d} @ {start:.2f}s: h1 {db(a):8.2f} dBFS  "
              f"h2/h1 {db(h2) - db(a):7.2f}  h3/h1 {db(h3) - db(a):7.2f}")


if __name__ == "__main__":
    for p in sys.argv[1:]:
        main(p)
