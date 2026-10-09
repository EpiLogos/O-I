#!/usr/bin/env python3
"""OP15_AFB25 analysis — does Feedback 25 % (of 0..100) enrich A's tone?

Usage: analyze_op15.py   (paths resolved under harness/renders/)

Conventions follow analyze_op_probes2.py (no new analysis law): steady
window [start+0.15, start+0.70] per note, note-1 harmonics over
[1.15, 1.70], Goertzel amplitudes. h1..h6 this time; if feedback self-FM
enriches the tone, the implied modulation index beta is read from the
h1/h2 pair (beta = 2*10^((h2-h1)/20), the small-index convention already
committed in analyze_lane3_alg.py) and cross-checked against the Bessel
ladder position of h3/h1.
"""
import math
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_render import read_aiff, rms_db
from analyze_lane1 import amp_at, peak_freq, harmonics
from analyze_lane3_alg import top_partials, beta

RENDERS = __file__.rsplit("/", 1)[0] + "/renders"
C3 = 130.81278265
NOTES = [(0.0, 127), (1.0, 96), (2.0, 64), (3.0, 32)]
FAMILY = ["M1_OPERATOR", "OP14_AFB050", "OP15_AFB25"]


def load(name):
    rate, _, x = read_aiff(f"{RENDERS}/{name}.aif")
    return rate, x


def main():
    data = {n: load(n) for n in FAMILY}

    print("== (a) per-note steady RMS [s+0.15, s+0.70]")
    rm = {}
    for n in FAMILY:
        rate, x = data[n]
        row = []
        for start, vel in NOTES:
            s, e = int((start + 0.15) * rate), int((start + 0.70) * rate)
            row.append(rms_db(x[s:e]))
        rm[n] = row
        print(f"  {n:14s} " + " ".join(f"{v:7.2f}" for v in row))
    for probe, base in (("OP14_AFB050", "M1_OPERATOR"),
                        ("OP15_AFB25", "M1_OPERATOR")):
        d = [v - w for v, w in zip(rm[probe], rm[base])]
        print(f"  d {probe} vs {base}: " + " ".join(f"{v:+6.2f}" for v in d))

    print("\n== (b) note-1 harmonics h1..h6 [1.15, 1.70] + implied beta")
    h1s = {}
    for n in FAMILY:
        rate, x = data[n]
        f, _ = peak_freq(x, rate, 90.0, 180.0, 0.5, 1.15, 1.70)
        h = harmonics(x, rate, f, kmax=6)
        h1s[n] = (f, h)
        b = beta(h[0], h[1])
        print(f"  {n:14s} f0={f:7.2f} " +
              " ".join(f"h{k+1}:{v:8.2f}" for k, v in enumerate(h)) +
              f"  beta_h2={b:.4f}")
    f15, h15 = h1s["OP15_AFB25"]
    if h15[1] - h15[0] > -60.0 and h15[2] - h15[0] > -60.0:
        # cross-check: J2(β)/J1(β) ≈ β/4 for small β → β ≈ 4·10^((h3-h2)/20)
        b_cross = 4.0 * 10.0 ** ((h15[2] - h15[1]) / 20.0)
        print(f"  OP15 cross-check beta from h3/h2 (J2/J1 ladder): "
              f"{b_cross:.4f}")
        # Bessel-ladder reading: locate (h2/h1, h3/h1) on the J0,J1,J2 table
        r21 = 10.0 ** ((h15[1] - h15[0]) / 20.0)
        r31 = 10.0 ** ((h15[2] - h15[0]) / 20.0)
        print(f"  OP15 amplitude ratios h2/h1={r21:.4f} h3/h1={r31:.4f}")

    print("\n== (c) broad partial scan 90-2000 Hz, top local peaks [1.15,1.70]")
    for n in ("OP14_AFB050", "OP15_AFB25"):
        rate, x = data[n]
        f0ref = h1s["M1_OPERATOR"][0]
        print(f"  {n} (vs M1):")
        for db, f in top_partials(x, rate, C3):
            harm = ""
            k = round(f / f0ref)
            if k >= 1 and abs(f - k * f0ref) < 4.0:
                harm = f"  (= h{k} of M1 f0)"
            print(f"    {f:8.1f} Hz  {db:8.2f} dBFS{harm}")

    print("\n== (d) note-1 onset profile, 8 x 100 ms from 1.05 s, dBFS")
    for n in FAMILY:
        rate, x = data[n]
        prof = []
        for k in range(8):
            t0 = 1.05 + k * 0.1
            s, e = int(t0 * rate), int((t0 + 0.1) * rate)
            prof.append(rms_db(x[s:e]))
        print(f"  {n:14s} " + " ".join(f"{v:7.2f}" for v in prof))


if __name__ == "__main__":
    main()
