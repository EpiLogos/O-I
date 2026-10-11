#!/usr/bin/env python3
"""Warp-mode probe analysis (D9): duration, band profile, harmonic artifacts.

Usage: analyze_warp.py <render.aif> [baseline.aif]
Baseline default: renders/G6_BYPASS_v2.aif (unity unwarped pass-through).

Signal: steps-1k.wav (0.25 s silence lead, 0.5 s sine steps at
-30..0 dBFS peak, 1.5 s tail; content 5.25 s at source timeline).

Metrics (pure stdlib; Goertzel probes, no FFT):
  (a) content duration: last sample above -80 dBFS vs source audible
      content end 3.750 s (0.25 s lead + 7 x 0.5 s steps; the 1.5 s file
      tail is silence)
  (b) band profile: Goertzel energy in 1/3-octave bands 63 Hz..16 kHz over
      the 0 dBFS step window (3.30-3.70 s), distance vs baseline
  (c) harmonic artifacts: 2k..10k harmonics rel to the 1 kHz fundamental
      in the same window (source is a pure sine -> any harmonic is
      algorithm- or path-generated)
"""
import math
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_render import read_aiff, rms_db

FS_HINT = 44100.0
FLOOR_DB = -80.0
WIN = (3.30, 3.70)  # 0 dBFS step, mid-window
BANDS = [(63, 125), (125, 250), (250, 500), (500, 1000), (1000, 2000),
         (2000, 4000), (4000, 8000), (8000, 16000)]
BAND_CENTERS = [math.sqrt(lo * hi) for lo, hi in BANDS]
HARMONICS = [2000, 3000, 4000, 5000, 6000, 8000, 10000]


def goertzel(x, rate, f, t0, t1):
    s, e = int(t0 * rate), int(t1 * rate)
    seg = x[s:e]
    if not seg:
        return 0.0
    w = 2.0 * math.pi * f / rate
    coeff = 2.0 * math.cos(w)
    q0, q1, q2 = 0.0, 0.0, 0.0
    for v in seg:
        q0 = coeff * q1 - q2 + v
        q2, q1 = q1, q0
    n = len(seg)
    return math.sqrt(q1 * q1 + q2 * q2 - coeff * q1 * q2) * 2.0 / n


def band_db(x, rate, f, t0=WIN[0], t1=WIN[1]):
    a = goertzel(x, rate, f, t0, t1)
    if a <= 0:
        return -144.0
    return 20 * math.log10(a / 32768.0)


def content_end(x, rate):
    thr = 32768 * 10 ** (FLOOR_DB / 20.0)
    # scan backwards in 0.5 s chunks for speed
    i = len(x) - 1
    step = int(0.5 * rate)
    while i > 0:
        j = max(0, i - step)
        seg = x[j:i]
        if max(abs(v) for v in seg) > thr:
            # refine sample-exact within this chunk
            k = len(seg) - 1
            while k > 0 and abs(seg[k]) <= thr:
                k -= 1
            return (j + k) / rate
        i = j
    return 0.0


def profile(x, rate):
    return [band_db(x, rate, f) for f in BAND_CENTERS]


def main():
    path = sys.argv[1]
    base_path = sys.argv[2] if len(sys.argv) > 2 else \
        __file__.rsplit("/", 1)[0] + "/renders/G6_BYPASS_v2.aif"
    rate, bits, x = read_aiff(path)
    print(f"{path}: rate={rate} samples={len(x)} ({len(x)/rate:.2f}s)")
    end = content_end(x, rate)
    print(f"(a) content end: {end:.3f} s  (source audible content 3.750 s; "
          f"factor {end/3.750:.4f}x)")

    brate, _, bx = read_aiff(base_path)
    print(f"baseline: {base_path} (content end {content_end(bx, brate):.3f} s)")

    print("\n(b) band profile over 0 dBFS step window 3.30-3.70 s "
          "(center Hz / render dB / baseline dB / delta):")
    pr = profile(x, rate)
    pb = profile(bx, brate)
    deltas = []
    for (lo, hi), f, a, b in zip(BANDS, BAND_CENTERS, pr, pb):
        d = a - b
        deltas.append(d)
        flag = "  <-- " + f"{d:+.2f} dB" if abs(d) > 1.0 else ""
        print(f"  {f:8.1f}  {a:8.2f}  {b:8.2f}  {d:+7.2f}{flag}")
    print(f"  mean|delta| (all bands) = "
          f"{sum(abs(d) for d in deltas)/len(deltas):.3f} dB; "
          f"max|delta| = {max(abs(d) for d in deltas):.2f} dB")

    print("\n(c) harmonics of 1 kHz in the same window (rel to fundamental):")
    f1 = band_db(x, rate, 1000.0)
    f1b = band_db(bx, rate, 1000.0)
    print(f"  fundamental 1k: render {f1:.2f} dB / baseline {f1b:.2f} dB "
          f"(delta {f1-f1b:+.2f})")
    for h in HARMONICS:
        ah = band_db(x, rate, float(h))
        bh = band_db(bx, rate, float(h))
        rel = ah - f1
        relb = bh - f1b
        print(f"  {h:6d} Hz: render {ah:8.2f} ({rel:+7.2f} rel)   "
              f"baseline {bh:8.2f} ({relb:+7.2f} rel)")

    # broadband check on the quietest audible step (-30 dBFS, 0.55-0.95 s):
    # any noise/hiss added by the algorithm shows here
    q = rms_db(x[int(0.55 * rate):int(0.95 * rate)])
    qb = rms_db(bx[int(0.55 * brate):int(0.95 * brate)])
    print(f"\nextra: -30 dBFS step RMS (0.55-0.95 s): render {q:.2f} vs "
          f"baseline {qb:.2f} (delta {q-qb:+.2f})")


if __name__ == "__main__":
    main()
