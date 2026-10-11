#!/usr/bin/env python3
"""Operator voice-lane analysis: per-note level, fine envelope, harmonics.

Notes (120 BPM): key 48 (C3, f0 = 130.81 Hz) unless stated, beats 0/2/4/6
= s 0/1/2/3, each sounds 0.875 s. Steady window start+0.15..start+0.70
(same as analyze_vd/analyze_midi_notes so numbers are comparable).

Sections per render:
  per-note RMS (steady window, L channel)
  onset shape: 10 ms RMS windows over the first 0.20 s of note 0
  release shape: 20 ms RMS windows after note-0 off (0.875 s)
  harmonic scan: Goertzel amplitude at k*f0, k=1..10, note-0 steady window
"""
import math
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_render import read_aiff, rms_db

NOTES = [(0.0, 127), (1.0, 96), (2.0, 64), (3.0, 32)]
C3 = 130.81278265


def amp_at(x, rate, f, t0, t1):
    """Goertzel amplitude (linear, full-scale = 32768) of freq f in window."""
    s, e = int(t0 * rate), int(t1 * rate)
    seg = x[s:e]
    n = len(seg)
    w = 2.0 * math.pi * f / rate
    coeff = 2.0 * math.cos(w)
    q1 = q2 = 0.0
    for v in seg:
        q0 = coeff * q1 - q2 + v
        q2, q1 = q1, q0
    a = math.sqrt(max(q1 * q1 + q2 * q2 - coeff * q1 * q2, 0.0)) * 2.0 / n
    return a


def main(path, f0=C3):
    rate, bits, x = read_aiff(path)
    print(f"== {path}  (rate {rate}, {bits} bit)")
    print("  per-note RMS (start+0.15..start+0.70):")
    for start, vel in NOTES:
        s, e = int((start + 0.15) * rate), int((start + 0.70) * rate)
        print(f"    vel {vel:3d} @ {start:4.2f}s: {rms_db(x[s:e]):8.2f} dBFS")

    print("  onset shape (10 ms windows from note-0 start):")
    for k in range(21):
        t0 = k * 0.010
        s, e = int(t0 * rate), int((t0 + 0.010) * rate)
        print(f"    t={t0:5.3f}s  {rms_db(x[s:e]):8.2f} dBFS")

    print("  release shape (20 ms windows from note-0 off at 0.875 s):")
    for k in range(31):
        t0 = 0.875 + k * 0.020
        s, e = int(t0 * rate), int((t0 + 0.020) * rate)
        print(f"    t={t0:6.3f}s  {rms_db(x[s:e]):8.2f} dBFS")

    print("  harmonic scan (note-0 steady window 0.15..0.70):")
    for k in range(1, 11):
        a = amp_at(x, rate, f0 * k, 0.15, 0.70)
        print(f"    h{k:2d} @ {f0 * k:7.1f} Hz: {20 * math.log10(a / 32768.0):8.2f} dBFS")


if __name__ == "__main__":
    for p in sys.argv[1:]:
        main(p)
