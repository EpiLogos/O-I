#!/usr/bin/env python3
"""OP18_AFB100R analysis — the routed-feedback discriminator.

Usage: analyze_op18.py   (paths resolved under harness/renders/)

Conventions follow analyze_op16_17.py (no new analysis law): steady window
[start+0.15, start+0.70] per note, note-1 harmonics over [1.15, 1.70],
Goertzel amplitudes, h1..h6; implied beta from the h1/h2 pair. The probe
family carries the OP7 reference (the identical voice with A fb 0) so the
verdict is direct:

  OP18 vs OP7: routed feedback acting shifts the beta/harmonic structure
  (self-FM of the B->A modulation loop) or the null seals flat, like the
  carrier-feedback case OP14/15/16.
"""
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_render import read_aiff, rms_db
from analyze_lane1 import peak_freq, harmonics
from analyze_lane3_alg import top_partials, beta

RENDERS = __file__.rsplit("/", 1)[0] + "/renders"
C3 = 130.81278265
NOTES = [(0.0, 127), (1.0, 96), (2.0, 64), (3.0, 32)]
FAMILY = ["M1_OPERATOR", "OP7_OSCB", "OP16_AFB100", "OP18_AFB100R"]


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
    for probe, base in (("OP18_AFB100R", "OP7_OSCB"),
                        ("OP18_AFB100R", "M1_OPERATOR")):
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
    for probe, base in (("OP18_AFB100R", "OP7_OSCB"),
                        ("OP18_AFB100R", "M1_OPERATOR"),
                        ("OP16_AFB100", "M1_OPERATOR")):
        _, hp = h1s[probe]
        _, hb = h1s[base]
        d = [v - w for v, w in zip(hp, hb)]
        print(f"  d-h {probe} vs {base}: " + " ".join(f"{v:+7.2f}" for v in d))

    h18 = h1s["OP18_AFB100R"][1]
    if h18[1] - h18[0] > -60.0 and h18[2] - h18[0] > -60.0:
        b_cross = 4.0 * 10.0 ** ((h18[2] - h18[1]) / 20.0)
        r21 = 10.0 ** ((h18[1] - h18[0]) / 20.0)
        r31 = 10.0 ** ((h18[2] - h18[0]) / 20.0)
        print(f"  OP18 self-FM reading: beta_h2 ladder cross-check {b_cross:.4f}, "
              f"h2/h1={r21:.4f} h3/h1={r31:.4f}")

    print("\n== (c) broad partial scan 90-2000 Hz, top local peaks [1.15,1.70]")
    for n in ("OP7_OSCB", "OP18_AFB100R"):
        rate, x = data[n]
        f0ref = h1s["M1_OPERATOR"][0]
        print(f"  {n} (vs M1):")
        for db, f in top_partials(x, rate, C3):
            harm = ""
            k = round(f / f0ref)
            if k >= 1 and abs(f - k * f0ref) < 4.0:
                harm = f"  (= h{k} of M1 f0)"
            print(f"    {f:8.1f} Hz  {db:8.2f} dBFS{harm}")


if __name__ == "__main__":
    main()
