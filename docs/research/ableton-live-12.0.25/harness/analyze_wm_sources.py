#!/usr/bin/env python3
"""Wavetable mod-matrix source-attribution analysis (Amp-row probes).

Usage: analyze_wm_sources.py <render.aif> [<render2.aif> ...]

Clip model (120 BPM): 4 notes at k*1.0 s (beats 0/2/4/6), each sounds
0.875 s (1.75 beats), velocities 127/96/64/32, key C3 (130.81 Hz).

Per render:
  (a) per-note RMS in [start+0.15, start+0.70] — velocity dependence
  (b) per-note sub-window profile: 8 x 100 ms over [start+0.05, start+0.85]
      + max cross-note profile delta — envelope retrigger (flat delta)
      vs free-running LFO (delta grows with note position)
  (c) per-note fundamental: Goertzel peak scan 60-500 Hz mid-note
      [start+0.30, start+0.80] — pitch-target sources move it
  (d) between-note residual RMS [start+0.90, start+0.99] — free-running
      sources can leak past the amp envelope release
"""
import math
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_render import read_aiff, rms_db

NOTES = [(0.0, 127), (1.0, 96), (2.0, 64), (3.0, 32)]


def goertzel(x, rate, f, t0, t1):
    s, e = int(t0 * rate), int(t1 * rate)
    seg = x[s:e]
    if not seg:
        return 0.0
    w = 2.0 * math.pi * f / rate
    coeff = 2.0 * math.cos(w)
    q1 = q2 = 0.0
    for v in seg:
        q0 = coeff * q1 - q2 + v
        q2, q1 = q1, q0
    n = len(seg)
    return math.sqrt(max(q1 * q1 + q2 * q2 - coeff * q1 * q2, 0.0)) * 2.0 / n


def peak_freq(x, rate, t0, t1, f0, f1, step=1.0):
    best, bf = -1e30, 0.0
    f = f0
    while f <= f1:
        a = goertzel(x, rate, f, t0, t1)
        db = 20 * math.log10(a / 32768.0) if a > 0 else -144.0
        if db > best:
            best, bf = db, f
        f += step
    return bf, best


def analyze(path):
    rate, _, x = read_aiff(path)
    print(f"== {path.split('/')[-1]} (rate {rate})")

    print("  (a) per-note RMS [s+0.15, s+0.70]:")
    rms = []
    for start, vel in NOTES:
        s, e = int((start + 0.15) * rate), int((start + 0.70) * rate)
        r = rms_db(x[s:e])
        rms.append(r)
        print(f"    vel {vel:3d}: {r:8.2f} dBFS")
    print(f"    spread: {max(rms) - min(rms):.2f} dB")

    print("  (b) sub-window profiles (8 x 100 ms from s+0.05), dBFS:")
    profiles = []
    for start, vel in NOTES:
        prof = []
        for k in range(8):
            t0 = start + 0.05 + k * 0.1
            s, e = int(t0 * rate), int((t0 + 0.1) * rate)
            prof.append(rms_db(x[s:e]))
        profiles.append(prof)
        print(f"    vel {vel:3d}: " + " ".join(f"{v:7.2f}" for v in prof))
    for k in (1, 2, 3):
        d = max(abs(a - b) for a, b in zip(profiles[0], profiles[k]))
        print(f"    max|profile(note{k+1}) - profile(note1)| = {d:6.2f} dB")

    print("  (c) fundamental peak 60-500 Hz mid-note [s+0.30, s+0.80]:")
    for start, vel in NOTES:
        bf, db = peak_freq(x, rate, start + 0.30, start + 0.80, 60.0, 500.0)
        cents = 1200 * math.log2(bf / 130.81)
        print(f"    vel {vel:3d}: peak {bf:7.1f} Hz ({db:7.2f} dBFS, "
              f"{cents:+7.1f} cent vs C3 130.81)")

    print("  (d) between-note residual [s+0.90, s+0.99]:")
    for start, vel in NOTES[:-1]:
        s, e = int((start + 0.90) * rate), int((start + 0.99) * rate)
        print(f"    after vel {vel:3d}: {rms_db(x[s:e]):8.2f} dBFS")


if __name__ == "__main__":
    for p in sys.argv[1:]:
        analyze(p)
        print()
