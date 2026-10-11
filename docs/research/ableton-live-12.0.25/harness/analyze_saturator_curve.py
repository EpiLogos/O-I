#!/usr/bin/env python3
"""Saturator corpus pinning — the Analog Clip curve + the pin-inert finding.

Offline analysis of the BULK corpus (2026-10-10, 435 renders), gate wave
2026-10-11. Reads only committed renders; pure stdlib.

What it measures (and what the crate constants cite):
  1. The default steps render's static map: per-step RMS and fundamental
     gains of the 1 kHz staircase at −30…0 dBFS. Measured: exactly unity on
     steps 0–5, −0.45 dB RMS / −0.454 dB fundamental at the 0 dBFS step.
     With the default chain (Type 0, drive 0 dB, colour at 0 dB = exact
     passthrough, PreDcFilter false per the ALS) out = SHAPER[in], so the
     step-6 waveform reads the Analog Clip curve pointwise.
  2. The pointwise curve: scatter y vs x = sin(w(n−d)) over the 0 dBFS
     step; d chosen so the recovered curve is identical to the identity on
     [0.12, 0.62] (the exactly-unity steps fix that segment). Emits the
     anchors and fits the knee deviation δ(x) = C·(x−K)^P — the constants
     wired into `packages/live-dynamics/src/saturator.rs`
     (`ANALOG_CLIP_KNEE/C/P`, `ANALOG_CLIP_MEASURED`).
  3. The pin-inert finding: every `BULK-saturator-pin-*` render is
     dither-identical to the default (max |Δ| ≤ 2 LSB) despite the pin
     values existing in the ALS — the five colour pins carry no DSP
     information in this corpus (no PreDrive/PostDrive pin exists either).

Usage: python3 analyze_saturator_curve.py [renders_dir]
"""
import collections
import math
import struct
import sys
from pathlib import Path

DEFAULT_RENDERS = Path(__file__).parent / "renders"
STEPS = "BULK-saturator-default-steps-1k-wav.aif"
PINS = [
    "BULK-saturator-default-impulse-wav.aif",
    "BULK-saturator-pin-basedrive-max.aif",
    "BULK-saturator-pin-basedrive-min.aif",
    "BULK-saturator-pin-colordepth-max.aif",
    "BULK-saturator-pin-colordepth-min.aif",
    "BULK-saturator-pin-colorfrequency-min.aif",
]
STEP_DBS = [-30, -24, -18, -12, -6, -3, 0]


def read_aiff_left(path):
    data = Path(path).read_bytes()
    assert data[:4] == b"FORM", path
    pos, rate, ssnd = 12, 0, None
    while pos + 8 <= len(data):
        cid, size = data[pos:pos + 4], struct.unpack(">I", data[pos + 4:pos + 8])[0]
        body = data[pos + 8:pos + 8 + size]
        if cid == b"COMM":
            expon = struct.unpack(">h", body[8:10])[0]
            mant = struct.unpack(">Q", body[10:18])[0]
            rate = int(mant * 2 ** (expon - 16383 - 63))
        elif cid == b"SSND":
            off = struct.unpack(">I", body[0:4])[0]
            ssnd = body[8 + off:]
        pos += 8 + size + (size & 1)
    n = len(ssnd) // 2
    s = struct.unpack(">%dh" % n, ssnd[:2 * n])
    return rate, [v / 32768.0 for v in s[0::2]]


def rms_db(buf):
    m = sum(v * v for v in buf) / len(buf)
    return 10 * math.log10(m) if m > 0 else -144.0


def fundamental_amp(buf, sr, freq, n0, n1):
    w = 2 * math.pi * freq / sr
    sc = ss = 0.0
    for n in range(n0, n1):
        sc += buf[n] * math.cos(w * n)
        ss += buf[n] * math.sin(w * n)
    return 2 * math.hypot(sc, ss) / (n1 - n0)


def static_map(sr, s):
    print("== static map (1 kHz steps, [t0+0.10, t0+0.40] windows)")
    for k, db in enumerate(STEP_DBS):
        a = int((0.25 + 0.5 * k + 0.10) * sr)
        b = int((0.25 + 0.5 * k + 0.40) * sr)
        gain = rms_db(s[a:b]) - (db - 3.0103)
        amp = fundamental_amp(s, sr, 1000.0, a, b)
        print("  step %+3d dBFS: RMS gain %+.3f dB  fundamental gain %+.3f dB"
              % (db, gain, 20 * math.log10(amp / 10 ** (db / 20.0))))


def recover_curve(sr, s):
    """Pointwise curve from the 0 dBFS step, phase-normalised to identity on
    the known-linear mid segment."""
    w = 2 * math.pi * 1000.0 / sr
    a = int((0.25 + 3.0 + 0.10) * sr)
    b = int((0.25 + 3.0 + 0.40) * sr)

    def recover(d, nb=200):
        bins = collections.defaultdict(list)
        for n in range(a, b):
            x = math.sin(w * (n - d))
            bins[round(x * nb) / nb].append(s[n])
        return {k: sum(v) / len(v) for k, v in bins.items()}

    best = None
    for i in range(-200, 400):
        d = i * 0.005
        f = recover(d)
        err = [((v - k) ** 2, 1) for k, v in f.items() if 0.12 < abs(k) < 0.62]
        e = sum(x for x, _ in err) / max(len(err), 1)
        if best is None or e < best[1]:
            best = (d, e)
    d = best[0]
    f = recover(d)
    print("== curve recovery: best phase d = %.3f samples (linear-zone rms %.2e)" % best)
    pts = sorted([(k, v) for k, v in f.items() if k >= 0.72])
    data = [(k, k - v) for k, v in pts if k >= 0.75]
    fit = None
    for bi in range(50, 80):
        bb = bi / 100
        for pi in range(120, 300):
            p = pi / 100
            num = sum(((max(k - bb, 0.0)) ** p) * dv for k, dv in data)
            den = sum(((max(k - bb, 0.0)) ** (2 * p)) for k, dv in data)
            if den <= 0:
                continue
            c = num / den
            err = max(abs(c * ((max(k - bb, 0.0)) ** p) - dv) for k, dv in data)
            if fit is None or err < fit[0]:
                fit = (err, bb, p, c)
    err, bb, p, c = fit
    print("  deviation fit: dev = %.5f * (max(x-%.2f,0))^%.2f  max|res| %.5f"
          % (c, bb, p, err))
    print("  anchors (x, f(x)):")
    step = max(1, len(pts) // 10)
    for k, v in pts[::step] + [pts[-1]]:
        print("    (%.4f, %.5f)," % (k, v))
    return c, bb, p


def pin_inert(renders):
    print("== pin-inert check (pairwise max |Δ|, 2 LSB = 6.1e-5)")
    bufs = []
    for name in PINS:
        p = Path(renders) / name
        if p.exists():
            bufs.append((name, read_aiff_left(p)[1]))
    worst = 0.0
    for i in range(len(bufs)):
        for j in range(i + 1, len(bufs)):
            d = max(abs(x - y) for x, y in zip(bufs[i][1], bufs[j][1]))
            worst = max(worst, d)
            print("  %-46s vs %-46s  %.6f" % (bufs[i][0][6:], bufs[j][0][6:], d))
    print("  worst |Δ| %.6f -> %s" % (worst, "INERT (dither only)" if worst < 1.2e-4 else "LIVE"))


def main():
    renders = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_RENDERS
    sr, s = read_aiff_left(renders / STEPS)
    static_map(sr, s)
    recover_curve(sr, s)
    pin_inert(renders)


if __name__ == "__main__":
    main()
