#!/usr/bin/env python3
"""Lane-1 probe analysis: one probe render against one baseline render.

Usage: analyze_lane1.py <probe.aif> <baseline.aif> [<probe2.aif> ...]

Clip model (120 BPM): 4 notes at k*1.0 s (beats 0/2/4/6), each sounds
0.875 s, velocities 127/96/64/32, key 48 (C3, f0 = 130.81 Hz).
Conventions follow analyze_wm_sources.py / analyze_wavetable.py /
analyze_vd.py (no new analysis law):

  (a) per-note RMS in [start+0.15, start+0.70], probe vs baseline + delta
  (b) note-1 envelope profile, 8 x 100 ms from 1.05 s (superposed voices)
  (c) note-1 fundamental: Goertzel peak scan 90-180 Hz, 0.5 Hz steps,
      window [1.15, 1.70]
  (d) harmonic scan h1..h8 at the measured f0 over [1.15, 1.70],
      probe vs baseline + delta (spectral delta, the render gate)
  (e) release tail of note 3 (off at 3.875 s), 20 ms windows x 30
"""
import math
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_render import read_aiff, rms_db

C3 = 130.81278265
NOTES = [(0.0, 127), (1.0, 96), (2.0, 64), (3.0, 32)]


def amp_at(x, rate, f, t0, t1):
    s, e = int(t0 * rate), int(t1 * rate)
    seg = x[s:e]
    n = len(seg)
    w = 2.0 * math.pi * f / rate
    coeff = 2.0 * math.cos(w)
    q1 = q2 = 0.0
    for v in seg:
        q0 = coeff * q1 - q2 + v
        q2, q1 = q1, q0
    return math.sqrt(max(q1 * q1 + q2 * q2 - coeff * q1 * q2, 0.0)) * 2.0 / n


def peak_freq(x, rate, f0, f1, step, t0, t1):
    best, bf = -1e30, 0.0
    f = f0
    while f <= f1:
        a = amp_at(x, rate, f, t0, t1)
        if a > best:
            best, bf = a, f
        f += step
    return bf, 20 * math.log10(best / 32768.0) if best > 0 else -144.0


def harmonics(x, rate, f0, kmax=8, t0=1.15, t1=1.70):
    out = []
    for k in range(1, kmax + 1):
        a = amp_at(x, rate, f0 * k, t0, t1)
        out.append(20 * math.log10(a / 32768.0) if a > 0 else -144.0)
    return out


def main(probe_path, base_path):
    rp, _, xp = read_aiff(probe_path)
    rb, _, xb = read_aiff(base_path)
    name = probe_path.split("/")[-1]
    base = base_path.split("/")[-1]
    print(f"== PROBE {name} vs BASELINE {base}")

    print("  (a) per-note RMS [s+0.15, s+0.70]:")
    for start, vel in NOTES:
        s, e = int((start + 0.15) * rp), int((start + 0.70) * rp)
        lp = rms_db(xp[s:e])
        s, e = int((start + 0.15) * rb), int((start + 0.70) * rb)
        lb = rms_db(xb[s:e])
        print(f"    vel {vel:3d}: probe {lp:8.2f}  base {lb:8.2f}  "
              f"delta {lp - lb:+6.2f} dB")

    print("  (b) note-1 envelope profile (8 x 100 ms from 1.05 s), dBFS:")
    for label, x, rate in ((name, xp, rp), (base, xb, rb)):
        prof = []
        for k in range(8):
            t0 = 1.05 + k * 0.1
            s, e = int(t0 * rate), int((t0 + 0.1) * rate)
            prof.append(rms_db(x[s:e]))
        print(f"    {label:20s} " + " ".join(f"{v:7.2f}" for v in prof))

    print("  (c) note-1 fundamental (Goertzel 90-180 Hz, 0.5 Hz grid):")
    for label, x, rate in ((name, xp, rp), (base, xb, rb)):
        f, db = peak_freq(x, rate, 90.0, 180.0, 0.5, 1.15, 1.70)
        cents = 1200 * math.log2(f / C3)
        print(f"    {label:20s} {f:7.2f} Hz ({db:7.2f} dBFS) "
              f"= C3{cents:+7.1f} cent")

    print("  (d) harmonic scan h1..h8 @ measured f0, [1.15, 1.70]:")
    fp, _ = peak_freq(xp, rp, 90.0, 180.0, 0.5, 1.15, 1.70)
    fb, _ = peak_freq(xb, rb, 90.0, 180.0, 0.5, 1.15, 1.70)
    hp = harmonics(xp, rp, fp)
    hb = harmonics(xb, rb, fb)
    for k, (a, b) in enumerate(zip(hp, hb), 1):
        print(f"    h{k} @{fp * k:7.1f} Hz: probe {a:8.2f}  base {b:8.2f}  "
              f"delta {a - b:+6.2f} dB")

    print("  (e) release tail, note 3 (off 3.875 s), 20 ms windows:")
    for label, x, rate in ((name, xp, rp), (base, xb, rb)):
        tail = []
        for k in range(0, 30, 3):  # 0..580 ms, every 3rd window
            t0 = 3.875 + k * 0.02
            s, e = int(t0 * rate), int((t0 + 0.02) * rate)
            tail.append(rms_db(x[s:e]))
        print(f"    {label:20s} " + " ".join(f"{v:7.2f}" for v in tail))


if __name__ == "__main__":
    base = sys.argv[2]
    for p in sys.argv[1:2] + sys.argv[3:]:
        main(p, base)
