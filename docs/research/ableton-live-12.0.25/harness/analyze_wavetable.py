#!/usr/bin/env python3
"""Wavetable voice-lane analysis: per-note level, envelope shape, harmonics.

Same clip model as analyze_operator.py (notes at 0/1/2/3 s, key 48, each
sounds 0.875 s; steady window start+0.15..start+0.70). Differences:

  - envelope shape at 5 ms resolution over note-1 (vel 96) — note 1, not
    note 0: the note-0 first-voice startup quirk is documented in
    midi-instruments.md, and note 1's decay is unmasked until 2.0 s
  - release tail from note 3 (off at 3.875 s): notes 1..3 tails are masked
    by the next note after ~0.12 s, so only note 3 shows the full release
  - harmonic scan k=1..8 on note-1 steady window (skip the quirk note)

Envelope values are RMS dBFS per window; the ratio between windows is the
envelope ratio (oscillator is steady within a note).
"""
import math
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_render import read_aiff, rms_db

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
    for start, vel in [(0.0, 127), (1.0, 96), (2.0, 64), (3.0, 32)]:
        s, e = int((start + 0.15) * rate), int((start + 0.70) * rate)
        print(f"    vel {vel:3d} @ {start:4.2f}s: {rms_db(x[s:e]):8.2f} dBFS")

    print("  envelope shape, note 1 (vel 96, start 1.0 s), 5 ms windows:")
    base = 1.0
    t_on = base
    for k in range(0, 141):  # 0..0.70 s after note-on
        t0 = t_on + k * 0.005
        s, e = int(t0 * rate), int((t0 + 0.005) * rate)
        print(f"    +{k * 5:4d}ms  {rms_db(x[s:e]):8.2f} dBFS")

    print("  release tail, note 3 (vel 32, off at 3.875 s), 20 ms windows:")
    t_off = 3.875
    for k in range(41):  # 0..0.80 s after note-off
        t0 = t_off + k * 0.020
        s, e = int(t0 * rate), int((t0 + 0.020) * rate)
        print(f"    +{k * 20:4d}ms  {rms_db(x[s:e]):8.2f} dBFS")

    print("  harmonic scan (note-1 steady window 1.15..1.70):")
    for k in range(1, 9):
        a = amp_at(x, rate, f0 * k, 1.15, 1.70)
        print(f"    h{k:2d} @ {f0 * k:7.1f} Hz: {20 * math.log10(a / 32768.0):8.2f} dBFS")


if __name__ == "__main__":
    for p in sys.argv[1:]:
        main(p)
