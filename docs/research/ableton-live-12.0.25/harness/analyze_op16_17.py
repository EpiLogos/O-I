#!/usr/bin/env python3
"""OP16_AFB100 / OP17_OSCD analysis — round-6 discriminators.

Usage: analyze_op16_17.py   (paths resolved under harness/renders/)

Conventions follow analyze_op15.py (no new analysis law): steady window
[start+0.15, start+0.70] per note, note-1 harmonics over [1.15, 1.70],
Goertzel amplitudes, h1..h6; implied beta from the h1/h2 pair. The family
carries the OP7/OP13/OP15 references so the verdicts are direct:

  OP16 vs {OP14, OP15}: the carrier-feedback null at the top of 0..100 —
  self-FM enrichment (beta rises with the pin) or the null seals.
  OP17 vs {OP7, OP13}: does the D shell mirror B (flat RMS + h2/h3
  sideband enrichment) or C (byte-flat inert at Algorithm 0)?
"""
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_render import read_aiff, rms_db
from analyze_lane1 import peak_freq, harmonics
from analyze_lane3_alg import top_partials, beta

RENDERS = __file__.rsplit("/", 1)[0] + "/renders"
C3 = 130.81278265
NOTES = [(0.0, 127), (1.0, 96), (2.0, 64), (3.0, 32)]
FAMILY = ["M1_OPERATOR", "OP7_OSCB", "OP13_OSCC", "OP15_AFB25",
          "OP16_AFB100", "OP17_OSCD"]


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
    for probe, base in (("OP16_AFB100", "M1_OPERATOR"),
                        ("OP16_AFB100", "OP15_AFB25"),
                        ("OP17_OSCD", "M1_OPERATOR"),
                        ("OP17_OSCD", "OP13_OSCC")):
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
    for probe, base in (("OP16_AFB100", "M1_OPERATOR"),
                        ("OP16_AFB100", "OP15_AFB25"),
                        ("OP17_OSCD", "M1_OPERATOR"),
                        ("OP17_OSCD", "OP7_OSCB"),
                        ("OP17_OSCD", "OP13_OSCC")):
        _, hp = h1s[probe]
        _, hb = h1s[base]
        d = [v - w for v, w in zip(hp, hb)]
        print(f"  d-h {probe} vs {base}: " + " ".join(f"{v:+7.2f}" for v in d))

    h16 = h1s["OP16_AFB100"][1]
    if h16[1] - h16[0] > -60.0 and h16[2] - h16[0] > -60.0:
        b_cross = 4.0 * 10.0 ** ((h16[2] - h16[1]) / 20.0)
        r21 = 10.0 ** ((h16[1] - h16[0]) / 20.0)
        r31 = 10.0 ** ((h16[2] - h16[0]) / 20.0)
        print(f"  OP16 self-FM reading: beta_h2 ladder cross-check {b_cross:.4f}, "
              f"h2/h1={r21:.4f} h3/h1={r31:.4f}")

    print("\n== (c) broad partial scan 90-2000 Hz, top local peaks [1.15,1.70]")
    for n in ("OP16_AFB100", "OP17_OSCD"):
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
    for n in ("M1_OPERATOR", "OP16_AFB100", "OP17_OSCD"):
        rate, x = data[n]
        prof = []
        for k in range(8):
            t0 = 1.05 + k * 0.1
            s, e = int(t0 * rate), int((t0 + 0.1) * rate)
            prof.append(rms_db(x[s:e]))
        print(f"  {n:14s} " + " ".join(f"{v:7.2f}" for v in prof))


if __name__ == "__main__":
    main()
