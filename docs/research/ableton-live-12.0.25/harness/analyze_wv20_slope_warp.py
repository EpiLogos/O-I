#!/usr/bin/env python3
"""D16 slope warp curve: decay-segment shape at four Slopes_Decay pins.

Renders (M2 notes clip: attack 1 ms, decay 0.6 s, sustain 0.5011875629,
tempo 120, notes at 0/1/2/3 s, 0.875 s long):
  M2_WAVETABLE      slope 0.5 (patch default)  harness/renders
  WV8_SLOPE0        slope 0.0   (linear, D16)   archive
  WV20_SLOPE_M05    slope -0.5                  harness/renders
  WV21_SLOPE_P1     slope +1.0                  harness/renders

Envelope extraction (the two artifacts that poisoned earlier readings):
  1. PER-CYCLE PEAK (rising zero-crossing to rising zero-crossing, cycle
     max) — no window scalloping. Short Goertzel windows (0.65-1.3 cycles)
     scallop +-1..2 dB and fabricate family ambiguity; integer-cycle RMS
     windows are also clean but 4x coarser.
  2. NOTE 0 is the analyzed note: every later note's decay overlaps the
     PREDECESSOR's release tail (note k-1 rings until its off + 0.6 s),
     which adds/subtracts a same-frequency phasor of up to ~0.2 amplitude
     through the first ~80% of the segment and bends the measured shape.
     Note 0 has no predecessor.

The law (see devices/wavetable-voice.md, 2026-10-09 section):

  endpoints pinned:  a(0) = peak, a(1) = sustain, with
                     peak = sustain_amp / S_STORED (the stored sustain is
                     a linear amplitude ratio — validated 5.99 vs 6.02 dB)
  shape:             v(u) = (exp(-k u) - exp(-k)) / (1 - exp(-k)),
                     k = C * slope,  C = 7.41 (the one fitted scalar),
                     u = t / stored_decay; the k -> 0 limit is the linear
                     ramp (slope 0).

This script re-derives C from the four renders and prints the residual
table.
"""
import math
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_render import read_aiff

R = __file__.rsplit("/", 1)[0] + "/renders/"
ARCHIVE = "/Users/admin/tools/live-re/archive-20261007/renders-final/"

RENDERS = [
    ("-0.5", R + "WV20_SLOPE_M05.aif"),
    ("0.0", ARCHIVE + "WV8_SLOPE0.aif"),
    ("0.5", R + "M2_WAVETABLE.aif"),
    ("1.0", R + "WV21_SLOPE_P1.aif"),
]

NOTE0 = 0.0                 # note 0: no predecessor release tail
DECAY = 0.5999999642
S_STORED = 0.5011875629
PROBE_MS = (25, 75, 150, 325, 500, 575)


def cycle_peaks(x, rate, t0, t1, f=130.81278265):
    """per-cycle peak amplitude via rising zero crossings."""
    s, e = int(t0 * rate), int(t1 * rate)
    seg = x[s:e]
    zc = [i for i in range(1, len(seg)) if seg[i - 1] < 0 <= seg[i]]
    return [((a + b) / 2 / rate + t0, max(abs(v) for v in seg[a:b]))
            for a, b in zip(zc, zc[1:])]


def expwarp_D(u, k):
    """remaining fraction above sustain; k -> 0 limit is 1 - u."""
    if abs(k) < 1e-6:
        return 1.0 - u
    return (math.exp(-k * u) - math.exp(-k)) / (1.0 - math.exp(-k))


def main():
    data = {}
    for slope, path in RENDERS:
        rate, bits, x = read_aiff(path)
        cp = cycle_peaks(x, rate, NOTE0, 1.0)
        plat = sum(pk for t, pk in cp if 0.70 <= t <= 0.86) / \
            sum(1 for t, pk in cp if 0.70 <= t <= 0.86)
        P = plat / S_STORED
        pts = [(t / DECAY, pk) for t, pk in cp if 0.02 <= t / DECAY <= 0.98]
        data[slope] = (pts, plat, P)
        p_meas = max(pk for t, pk in cp if 0.004 <= t <= 0.04)
        print(f"== slope {slope}  ({path.rsplit('/', 1)[-1]})")
        print(f"   plateau {20 * math.log10(plat / 32768.0):.2f} dBFS "
              f"(cycle-peak scale; RMS scale = -3.01 dB); "
              f"first-cycle peak {20 * math.log10(p_meas / plat):.2f} dB above "
              f"(fast-start curves under-read the true peak within cycle 1-2)")
        row = []
        for ms in PROBE_MS:
            u = ms / 1000.0 / DECAY
            cand = [pk for t, pk in cp if abs(t - ms / 1000.0) <= 0.004]
            if cand:
                db = 20 * math.log10(cand[0] / plat)
                row.append(f"+{ms}:{db:+.2f}")
        print("   dB above plateau: " + "  ".join(row))

    # fit the single shared constant C in k = C * slope
    def resid_for_c(c):
        tot = n = 0
        worst = (0.0, None, None)
        pers = {}
        for slope in ("-0.5", "0.0", "0.5", "1.0"):
            pts, plat, P = data[slope]
            k = c * float(slope)
            s_ = n_ = 0
            for u, pk in pts:
                m = plat + (P - plat) * expwarp_D(u, k)
                d = 20 * math.log10(pk / m)
                s_ += d * d
                n_ += 1
                if abs(d) > worst[0]:
                    worst = (abs(d), slope, u)
            pers[slope] = math.sqrt(s_ / n_)
            tot += s_
            n += n_
        return math.sqrt(tot / n), pers, worst

    best = (1e9, None)
    c = 4.0
    while c <= 12.0:
        r, _, _ = resid_for_c(c)
        if r < best[0]:
            best = (r, c)
        c += 0.05
    c = best[1]
    for step in (0.01, 0.002):
        for d in (-step, 0.0, step):
            r, _, _ = resid_for_c(c + d)
            if r < best[0]:
                best = (r, c + d)
    c = best[1]
    r, pers, worst = resid_for_c(c)
    print(f"\nLAW k = C*slope, expwarp v(u): C = {c:.3f}  "
          f"overall resid RMS {r:.3f} dB, worst {worst[0]:.2f} dB "
          f"(slope {worst[1]}, u={worst[2]:.2f})")
    for s in ("-0.5", "0.0", "0.5", "1.0"):
        print(f"  slope {s}: k = {c * float(s):+.2f}   resid RMS {pers[s]:.3f} dB")

    print("\nresidual profile (measured - model, dB):")
    print("  u     " + "  ".join(f"{s:>7}" for s in ("-0.5", "0.0", "0.5", "1.0")))
    for u in (0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95):
        row = []
        for s in ("-0.5", "0.0", "0.5", "1.0"):
            pts, plat, P = data[s]
            cand = [p for p in pts if abs(p[0] - u) < 0.02]
            if not cand:
                row.append("      -")
                continue
            u0, pk = cand[0]
            k = c * float(s)
            m = plat + (P - plat) * expwarp_D(u0, k)
            row.append(f"{20 * math.log10(pk / m):7.2f}")
        print(f"  {u:.2f}  " + "  ".join(row))

    # sanity: the D16 readings at 75/325 ms for slope 0.0 (linear limit)
    print("\nslope-0.0 vs linear ramp (D16 cross-check):")
    pts, plat, P = data["0.0"]
    for ms in (75, 325):
        u = ms / 1000.0 / DECAY
        cand = [(uu, pk) for uu, pk in pts if abs(uu - u) < 0.02]
        if cand:
            uu, pk = cand[0]
            db = 20 * math.log10(pk / plat)
            lin = 20 * math.log10((S_STORED + (1 - S_STORED) * (1 - u)) / S_STORED)
            print(f"  +{ms} ms (u={u:.3f}): {db:+.2f} dB above plateau "
                  f"(linear {lin:+.2f})")


if __name__ == "__main__":
    main()
