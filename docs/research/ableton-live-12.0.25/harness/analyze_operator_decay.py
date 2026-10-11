#!/usr/bin/env python3
"""Operator decay-tau fit for a DecayTime pin (OP6_DECAY and heirs).

Model (operator-voice.md topology): after the (sub-resolution) attack,

    a(t) = S + (P - S) * exp(-t / tau)

The audible peak P is NOT taken from the M1 plateau constant: the OP2
cross-check showed the pinned-sustain voice sits ~3 dB below the M1
plateau while the onset->sustain span still equals the stored
SustainLevel ratio exactly (24.0 dB). So S = P * SustainLevel with P
fitted, and tau is the second free parameter.

Fits run on 10 ms windows (the OP2 reference resolution) over the note,
and on 100 ms windows (coarser, integration-modeled) as a cross-check.
Validate on renders/OP2_SUSTAIN24.aif first: expected tau ~= 0.120 s.

Usage: analyze_operator_decay.py <render.aif> [note_start_s]
"""
import math
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_render import read_aiff, rms_db

NOTE_START = 1.0           # note 1 (vel 96) at beat 2 = 1.0 s
SOUND = 0.875              # sounds 1.75 beats
SUS_RATIO = 0.06309572607  # stored SustainLevel pin (=-24 dB)


def window_rms_model(t0, w, tau, P, S, npts=None):
    """RMS of S + (P-S)exp(-t/tau) over [t0, t0+w] (midpoint grid)."""
    if npts is None:
        npts = max(8, int(w * 2000))   # >= 2 kHz grid for the model
    acc = 0.0
    for k in range(npts):
        t = t0 + (k + 0.5) * (w / npts)
        a = S + (P - S) * math.exp(-t / tau)
        acc += a * a
    return math.sqrt(acc / npts)


def fit_tau(meas, win, P, S, tau_lo=0.02, tau_hi=5.0):
    """tau-only fit for fixed (P, S); coarse scan then golden refine."""
    def sse(tau):
        return sum((window_rms_model(k * win, win, tau, P, S) - m) ** 2
                   for k, m in enumerate(meas))
    best, bv = tau_lo, sse(tau_lo)
    t = tau_lo
    while t < tau_hi:
        v = sse(t)
        if v < bv:
            bv, best = v, t
        t += 0.005
    a, b = max(best - 0.01, tau_lo), min(best + 0.01, tau_hi)
    gr = (math.sqrt(5) - 1) / 2
    c, d = b - gr * (b - a), a + gr * (b - a)
    for _ in range(50):
        if sse(c) < sse(d):
            b, d = d, c
            c = b - gr * (b - a)
        else:
            a, c = c, d
            d = a + gr * (b - a)
    tau = (a + b) / 2
    return tau, bv


def main(path, note_start=NOTE_START):
    rate, _, x = read_aiff(path)
    print(f"== {path.split('/')[-1]} (rate {rate})")

    # onset verification: first time the 5 ms level leaves the floor
    onset = None
    for k in range(40):
        t0 = note_start - 0.05 + k * 0.005
        s, e = int(t0 * rate), int((t0 + 0.005) * rate)
        if rms_db(x[s:e]) > -60.0:
            onset = t0
            break
    print(f"  onset: first >-60 dBFS 5 ms window at {onset:.3f}s "
          f"({'aligned' if abs(onset - note_start) < 0.006 else 'OFFSET!'})")

    nw = int(SOUND / 0.1)
    meas100 = []
    print(f"\n  note-1 100 ms windows from {note_start}s:")
    for k in range(nw):
        t0 = note_start + k * 0.1
        s, e = int(t0 * rate), int((t0 + 0.1) * rate)
        m = rms_db(x[s:e])
        meas100.append(10 ** (m / 20.0))
        print(f"    [{k*0.1:4.1f}..{k*0.1+0.1:4.1f}s] {m:8.2f} dBFS")

    nw10 = int(SOUND / 0.01)
    meas10 = [10 ** (rms_db(x[int((note_start + k * 0.01) * rate):
                                int((note_start + (k + 1) * 0.01) * rate)
                                ]) / 20.0)
              for k in range(nw10)]

    # initial P: level just after onset (first 10 ms window, phase-wobbled)
    P0 = max(meas10[:3])
    S0 = P0 * SUS_RATIO

    print(f"\n  initial peak estimate {20 * math.log10(P0):.2f} dBFS "
          f"(sustain target {20 * math.log10(S0):.2f} dBFS)")

    # 2-parameter fit (P, tau), S tied to P by the stored ratio
    def sse2(P, tau):
        return sum((window_rms_model(k * 0.01, 0.01, tau, P, P * SUS_RATIO)
                    - m) ** 2 for k, m in enumerate(meas10))

    bestP, bestT, bv = P0, 0.12, sse2(P0, 0.12)
    for tau in [t * 0.005 for t in range(2, 240)]:       # 0.01 .. 1.195
        for pf in (0.85, 0.9, 0.95, 1.0, 1.05, 1.1):
            P = P0 * pf
            v = sse2(P, tau)
            if v < bv:
                bv, bestP, bestT = v, P, tau
    # local refine: coordinate descent
    P, tau = bestP, bestT
    for it in range(6):
        step_t = 0.002 / (2 ** it)
        step_p = P0 * 0.01 / (2 ** it)
        improved = True
        while improved:
            improved = False
            for dP, dT in ((step_p, 0), (-step_p, 0), (0, step_t), (0, -step_t)):
                v = sse2(P + dP, tau + dT)
                if v < bv:
                    bv, P, tau, improved = v, P + dP, tau + dT, True
    rms10 = math.sqrt(bv / len(meas10))
    print(f"\n  FIT (10 ms windows, P free, S = P x stored ratio): "
          f"tau = {tau:.4f} s, peak = {20 * math.log10(P):.2f} dBFS, "
          f"window-RMS resid = {rms10:.5f} amp ({20 * math.log10(rms10 / P):.2f} dB rel peak)")

    t100, bv100 = fit_tau(meas100, 0.1, P, P * SUS_RATIO)
    print(f"  cross-check (100 ms windows, same P/S): tau = {t100:.4f} s")

    print(f"\n  stored DecayTime = 3000 ms; default 1000 ms -> documented tau 0.120 s")
    print(f"  tau / (0.120 * 3) = {tau / 0.360:.3f}   "
          f"(proportional law would read 1.000)")


if __name__ == "__main__":
    main(sys.argv[1], float(sys.argv[2]) if len(sys.argv) > 2 else NOTE_START)
