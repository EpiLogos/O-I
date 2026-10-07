#!/usr/bin/env python3
"""Warp stretch-probe analysis: duration ratio, band distance, artifacts.

Usage: analyze_warp_stretch.py <render.aif> [baseline.aif] [--stretch S] [--sweep]
Baseline default: renders/W0_UNWARPED.aif. Default stretch 2.0.

Source: steps-1k.wav — 0.25 s silence lead, 7 sine steps 0.5 s each at
-30..0 dBFS (0 dBFS step at 3.30-3.70 s), 1.5 s silence tail; audible
content ends at 3.750 s on the source timeline. Under a 2x stretch every
source time t maps to S*t, so the expected content end is 7.500 s and the
0 dBFS analysis window moves to 6.60-7.40 s.

Metrics (pure stdlib; Goertzel probes):
  (a) duration ratio achieved: measured content end / source content end
  (b) band profile distance vs baseline on matched windows (source-t * S),
      1/3-octave centers 63 Hz..16 kHz: spectral preservation + LF skirt
  (c) pitch preservation: Goertzel at 1 kHz (warp preserves pitch) vs a
      500 Hz probe (a resample-style stretch would land here)
  (d) harmonic artifacts 2k..10k in the same window (grain noise)
  (e) quiet-step RMS at source 0.55-0.95 s (-> 1.10-1.90 s) cross-check
Sweep mode (--sweep): peak-frequency slices at matched sweep fractions
  (unstretched t vs S*t) demonstrate the time mapping and pitch lock.
"""
import math
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_render import read_aiff, rms_db

FLOOR_DB = -80.0
SRC_END = 3.750          # audible content end on the source timeline (s)
WIN0 = (3.30, 3.70)      # 0 dBFS step on the source timeline
QUIET = (0.55, 0.95)     # -30 dBFS step on the source timeline
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
    q1 = q2 = 0.0
    for v in seg:
        q0 = coeff * q1 - q2 + v
        q2, q1 = q1, q0
    n = len(seg)
    return math.sqrt(max(q1 * q1 + q2 * q2 - coeff * q1 * q2, 0.0)) * 2.0 / n


def band_db(x, rate, f, t0, t1):
    a = goertzel(x, rate, f, t0, t1)
    return 20 * math.log10(a / 32768.0) if a > 0 else -144.0


def content_end(x, rate):
    thr = 32768 * 10 ** (FLOOR_DB / 20.0)
    i = len(x) - 1
    step = int(0.5 * rate)
    while i > 0:
        j = max(0, i - step)
        seg = x[j:i]
        if max(abs(v) for v in seg) > thr:
            k = len(seg) - 1
            while k > 0 and abs(seg[k]) <= thr:
                k -= 1
            return (j + k) / rate
        i = j
    return 0.0


def peak_freq(x, rate, t0, t1, f0=40.0, f1=16000.0, step=2.0):
    best, bf = -1e30, 0.0
    f = f0
    n = int((t1 - t0) * rate)
    while f <= f1:
        a = goertzel(x, rate, f, t0, t1)
        db = 20 * math.log10(a / 32768.0) if a > 0 else -144.0
        if db > best:
            best, bf = db, f
        f += step
    return bf, best


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    stretch = 2.0
    for i, a in enumerate(sys.argv):
        if a == "--stretch":
            stretch = float(sys.argv[i + 1])
    sweep = "--sweep" in sys.argv
    path = args[0]
    base_path = args[1] if len(args) > 1 else \
        __file__.rsplit("/", 1)[0] + "/renders/W0_UNWARPED.aif"

    rate, _, x = read_aiff(path)
    brate, _, bx = read_aiff(base_path)
    print(f"== {path} (rate {rate}) vs baseline {base_path.split('/')[-1]}")
    print(f"   stretch={stretch}")

    if sweep:
        print("\n(sweep) peak-frequency slices at matched sweep fractions:")
        # sweep occupies source 0..3.0 s; unstretched f(t)=20*exp(ln1000*t/3)
        for frac in (0.25, 0.5, 0.75):
            ts = frac * 3.0
            f_exp_src = 20.0 * math.exp(math.log(1000.0) * ts / 3.0)
            a0, db0 = peak_freq(bx, brate, ts - 0.05, ts + 0.05)
            tr = ts * stretch
            a1, db1 = peak_freq(x, rate, tr - 0.05 * stretch,
                                tr + 0.05 * stretch)
            print(f"  t_src={ts:.2f}s: baseline peak {a0:8.1f} Hz "
                  f"({db0:6.1f} dB) | render@{tr:.2f}s peak {a1:8.1f} Hz "
                  f"({db1:6.1f} dB) | source-side theory {f_exp_src:8.1f} Hz")
        end = content_end(x, rate)
        print(f"  render content end {end:.3f} s "
              f"(audible sweep 3.0 s x {stretch} = {3.0 * stretch:.2f} s; "
              f"file tail is silence)")
        return

    win = (WIN0[0] * stretch, WIN0[1] * stretch)
    quiet = (QUIET[0] * stretch, QUIET[1] * stretch)

    print(f"\n(a) content end: {content_end(x, rate):.3f} s  "
          f"(source 3.750 s x {stretch} = {SRC_END * stretch:.3f} s)")
    r = content_end(x, rate) / SRC_END
    print(f"    duration ratio achieved: {r:.4f}x (target {stretch})")

    print(f"\n(b) band profile, 0 dBFS window render {win} vs baseline "
          f"{WIN0} (center Hz / render / base / delta):")
    deltas = []
    for (lo, hi), f in zip(BANDS, BAND_CENTERS):
        a = band_db(x, rate, f, *win)
        b = band_db(bx, brate, f, *WIN0)
        d = a - b
        deltas.append(d)
        flag = "  <-- " + f"{d:+.2f} dB" if abs(d) > 1.0 else ""
        print(f"  {f:8.1f}  {a:8.2f}  {b:8.2f}  {d:+7.2f}{flag}")
    print(f"  mean|delta| = {sum(abs(d) for d in deltas)/len(deltas):.3f} dB; "
          f"max|delta| = {max(abs(d) for d in deltas):.2f} dB")

    print("\n(c) pitch probes in the 0 dBFS window (1k = warp preserves; "
          "0.5k = resample-style):")
    for f in (500.0, 1000.0):
        a = band_db(x, rate, f, *win)
        b = band_db(bx, brate, f, *WIN0)
        print(f"  {f:6.1f} Hz: render {a:8.2f} dB | baseline {b:8.2f} dB "
              f"(delta {a - b:+6.2f})")
    pk, pdb = peak_freq(x, rate, win[0], win[1], 200.0, 4000.0, 1.0)
    print(f"  strongest peak 200-4000 Hz: {pk:.1f} Hz ({pdb:.2f} dB)")

    print("\n(d) harmonics of 1 kHz in the same window:")
    f1 = band_db(x, rate, 1000.0, *win)
    f1b = band_db(bx, brate, 1000.0, *WIN0)
    for h in HARMONICS:
        ah = band_db(x, rate, float(h), *win)
        bh = band_db(bx, brate, float(h), *WIN0)
        print(f"  {h:6d} Hz: render {ah:8.2f} ({ah - f1:+7.2f} rel)   "
              f"baseline {bh:8.2f} ({bh - f1b:+7.2f} rel)")

    q = rms_db(x[int(quiet[0] * rate):int(quiet[1] * rate)])
    qb = rms_db(bx[int(QUIET[0] * brate):int(QUIET[1] * brate)])
    print(f"\n(e) -30 dBFS step RMS (render {quiet} vs baseline {QUIET}): "
          f"{q:.2f} vs {qb:.2f} (delta {q - qb:+.2f})")


if __name__ == "__main__":
    main()
