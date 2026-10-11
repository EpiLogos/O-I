#!/usr/bin/env python3
"""Op-alg lane analysis: the index law (beta vs B Volume, 3 points) and the
Algorithm cell (OP11 vs OP7).

Usage: analyze_lane3_alg.py   (paths resolved under harness/renders/)

Conventions follow analyze_lane1.py / analyze_wm_sources.py (no new
analysis law): steady window [start+0.15, start+0.70] per note, note-1
harmonics over [1.15, 1.70], Goertzel amplitudes. Small-index FM/PM
reading beta = 2*10^((h2-h1)/20) (J1/J0 ~ beta/2), the same reading
operator-voice.md used for 0.212 / 0.109.

Sections:
  (a) per-note steady RMS, each probe vs OP7 (level-invariance check)
  (b) note-1 harmonics h1..h4 for M1/OP7/OP8/OP10/OP11 + beta table
  (c) broad partial scan 90-2000 Hz (2 Hz grid), OP11 vs OP7: top peaks
      — does the Algorithm move introduce any partial the OP7 family
      does not have (B as carrier/output voice), or reshape only?
  (d) note-1 onset profile 8 x 100 ms for OP11 vs OP7 (is B still the
      onset-index driver at Algorithm 7?)
"""
import math
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_render import read_aiff, rms_db
from analyze_lane1 import amp_at, peak_freq, harmonics

RENDERS = __file__.rsplit("/", 1)[0] + "/renders"
C3 = 130.81278265
NOTES = [(0.0, 127), (1.0, 96), (2.0, 64), (3.0, 32)]
FAMILY = ["M1_OPERATOR", "OP7_OSCB", "OP8_OSCB050", "OP10_BV025", "OP11_ALGX"]
BVOL = {"OP7_OSCB": 1.0, "OP8_OSCB050": 0.5, "OP10_BV025": 0.25}


def load(name):
    rate, _, x = read_aiff(f"{RENDERS}/{name}.aif")
    return rate, x


def beta(h1_db, h2_db):
    return 2.0 * 10.0 ** ((h2_db - h1_db) / 20.0)


def top_partials(x, rate, f0, t0=1.15, t1=1.70, flo=90.0, fhi=2000.0,
                 step=2.0, k=12):
    peaks = []
    f = flo
    while f <= fhi:
        a = amp_at(x, rate, f, t0, t1)
        peaks.append((20 * math.log10(a / 32768.0), f))
        f += step
    peaks.sort(reverse=True)
    # keep local maxima only, then top k
    out = []
    for db, f in peaks:
        if all(abs(f - g) > 6.0 for _, g in out):
            out.append((db, f))
        if len(out) >= k:
            break
    return out


def main():
    data = {n: load(n) for n in FAMILY}

    print("== (a) per-note steady RMS [s+0.15, s+0.70], vs OP7")
    r7, x7 = data["OP7_OSCB"]
    for n in FAMILY:
        rate, x = data[n]
        row = []
        for start, vel in NOTES:
            s, e = int((start + 0.15) * rate), int((start + 0.70) * rate)
            row.append(rms_db(x[s:e]))
        d = [v - w for v, w in zip(row, [
            rms_db(x7[int((st + 0.15) * r7):int((st + 0.70) * r7)])
            for st, _ in NOTES])]
        print(f"  {n:14s} " + " ".join(f"{v:7.2f}" for v in row) +
              "   d_vs_OP7 " + " ".join(f"{v:+6.2f}" for v in d))

    print("\n== (b) note-1 harmonics h1..h4 [1.15, 1.70] + beta")
    h1s = {}
    for n in FAMILY:
        rate, x = data[n]
        f, _ = peak_freq(x, rate, 90.0, 180.0, 0.5, 1.15, 1.70)
        h = harmonics(x, rate, f, kmax=4)
        h1s[n] = (f, h)
        print(f"  {n:14s} f0={f:7.2f} " +
              " ".join(f"h{k+1}:{v:8.2f}" for k, v in enumerate(h)))
    print("  -- beta vs B Volume (steady, beta = 2*10^((h2-h1)/20)):")
    for n, v in BVOL.items():
        f, h = h1s[n]
        b = beta(h[0], h[1])
        pred = 0.212 * v
        print(f"    {n:14s} V={v:4.2f}  beta={b:.4f}  "
              f"linear-from-OP7 predicts {pred:.4f}  "
              f"ratio {b / (0.212 * v):.3f}")
    f, h = h1s["OP11_ALGX"]
    print(f"    OP11_ALGX      Alg=7   beta={beta(h[0], h[1]):.4f}  "
          f"(OP7: {beta(h1s['OP7_OSCB'][1][0], h1s['OP7_OSCB'][1][1]):.4f})")

    print("\n== (c) broad partial scan 90-2000 Hz, top local peaks [1.15,1.70]")
    for n in ("OP7_OSCB", "OP11_ALGX"):
        rate, x = data[n]
        print(f"  {n}:")
        for db, f in top_partials(x, rate, C3):
            harm = ""
            k = round(f / h1s["OP7_OSCB"][0])
            if k >= 1 and abs(f - k * h1s["OP7_OSCB"][0]) < 4.0:
                harm = f"  (= h{k} of f0)"
            print(f"    {f:8.1f} Hz  {db:8.2f} dBFS{harm}")

    print("\n== (d) note-1 onset profile, 8 x 100 ms from 1.05 s, dBFS")
    for n in ("OP7_OSCB", "OP11_ALGX"):
        rate, x = data[n]
        prof = []
        for k in range(8):
            t0 = 1.05 + k * 0.1
            s, e = int(t0 * rate), int((t0 + 0.1) * rate)
            prof.append(rms_db(x[s:e]))
        print(f"  {n:14s} " + " ".join(f"{v:7.2f}" for v in prof))


if __name__ == "__main__":
    main()
