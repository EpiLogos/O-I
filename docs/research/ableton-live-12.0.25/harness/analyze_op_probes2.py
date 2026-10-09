#!/usr/bin/env python3
"""Shell C/D + feedback probe analysis (night round 2, lane 3 follow-up).

Usage: analyze_op_probes2.py   (paths resolved under harness/renders/)

Conventions follow analyze_lane1.py / analyze_lane3_alg.py (no new analysis
law): steady window [start+0.15, start+0.70] per note, note-1 harmonics over
[1.15, 1.70], Goertzel amplitudes, beta = 2*10^((h2-h1)/20).

Questions:
  OP12_ALG7CD  vs OP7_OSCB: does Algorithm 7 with C/D audible (0.25 each)
               change the spectrum (new partials / new carrier) or the level?
               The acoustic-null extent evidence from OP11 becomes a routing
               verdict only here.
  OP13_OSCC    vs M1_OPERATOR: shell C alone at the B-default level (1.0) —
               pure sine? level law vs A (OP3 raised A to 0.5: −6.02 dB from
               M1; C at 1.0 should sit AT the M1 constant).
  OP14_AFB050  vs M1_OPERATOR: Osc A Feedback 0.5 (range 0..100) — does the
               tone enrich above the dither floor (self-FM index reading)?
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
FAMILY = ["M1_OPERATOR", "OP7_OSCB", "OP12_ALG7CD", "OP13_OSCC", "OP14_AFB050"]


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
    for probe, base in (("OP12_ALG7CD", "OP7_OSCB"),
                        ("OP13_OSCC", "M1_OPERATOR"),
                        ("OP14_AFB050", "M1_OPERATOR")):
        d = [v - w for v, w in zip(rm[probe], rm[base])]
        print(f"  d {probe} vs {base}: " + " ".join(f"{v:+6.2f}" for v in d))

    print("\n== (b) note-1 harmonics h1..h4 [1.15, 1.70] + beta")
    h1s = {}
    for n in FAMILY:
        rate, x = data[n]
        f, _ = peak_freq(x, rate, 90.0, 180.0, 0.5, 1.15, 1.70)
        h = harmonics(x, rate, f, kmax=4)
        h1s[n] = (f, h)
        b = beta(h[0], h[1])
        print(f"  {n:14s} f0={f:7.2f} " +
              " ".join(f"h{k+1}:{v:8.2f}" for k, v in enumerate(h)) +
              f"  beta={b:.4f}")

    print("\n== (c) broad partial scan 90-2000 Hz, top local peaks [1.15,1.70]")
    for n, ref in (("OP12_ALG7CD", "OP7_OSCB"),
                   ("OP13_OSCC", "M1_OPERATOR"),
                   ("OP14_AFB050", "M1_OPERATOR")):
        rate, x = data[n]
        f0ref = h1s[ref][0]
        print(f"  {n} (vs {ref}):")
        for db, f in top_partials(x, rate, C3):
            harm = ""
            k = round(f / f0ref)
            if k >= 1 and abs(f - k * f0ref) < 4.0:
                harm = f"  (= h{k} of {ref} f0)"
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
