#!/usr/bin/env python3
"""Fit the Wavetable voice laws from the WV probe renders (lane: fit+implement).

Probes (stored-value deltas vs the M2 default patch, confirmed from the
.hals sets in harness/live/):
  M2_WAVETABLE  default patch: Osc1 on, pos 0, gain 1; Osc2 off;
                AmpEnv A=0.001 D=0.6 S=0.5011875629 R=0.6 slopes 0/0.5/0.5;
                Volume 0.3548134267
  WV2_POS50     Osc1 WavePosition 0 -> 0.5      (timbre law)
  WV3_OSCGAIN   Osc1 Gain 1 -> 0.5              (gain law)
  WV4_SUSTAIN   AmpEnv Sustain 0.5012 -> 0.25   (sustain law)
  WV5_OSC2ON    Oscillator2_On false -> true    (osc2 sum law)

Measured per render:
  - per-note steady RMS (start+0.15..start+0.70), 4 notes, key 48
  - harmonic scan h1..h8 on the note-1 steady window (long window: the
    20 ms-window scans leak; the 0.55 s window resolves h2 to -57 dB)
  - sustain-window pair for the envelope laws:
      early  = start+0.005..start+0.045  (attack peak)
      late   = start+0.70..start+0.875   (post-decay plateau)
  - h1 Goertzel envelope (20 ms hop, 40 ms span) over note 1 + note 3 tail,
    fitted against two law families per segment (least squares, dB):
      decay:   one-pole approach  a(u) = s + (1-s)*exp(-u/tau)
      release: power tail         a(v) = s*(1-v)^p
Outputs the fitted constants + all deltas as a table for the dossier.

NOTE: the auto-fits at the bottom are the coarse first pass (the release
power-tail fit p~1.9 is anchor-dragged and superseded); the SHIPPED model
constants (decay tau=0.170 s one-pole, release (1-v)*exp(-2.43v)) come
from the plateau-anchored refinement recorded in devices/wavetable-voice.md.
"""
import math
import os
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_render import read_aiff

RATE = 44100.0
C3 = 130.81278265
NOTES = [(0.0, 127), (1.0, 96), (2.0, 64), (3.0, 32)]
NAMES = ["M2_WAVETABLE", "WV2_POS50", "WV3_OSCGAIN", "WV4_SUSTAIN", "WV5_OSC2ON"]
NOTE_LEN = 0.875
OFF3 = 3.875
SUSTAIN_STORED = 0.5011875629
SUSTAIN_WV4 = 0.25
DECAY_T = 0.5999999642
REL_T = 0.5999999642


def rms_db(seg):
    if not seg:
        return -144.0
    acc = sum(v * v for v in seg) / len(seg)
    return 10 * math.log10(max(acc, 1e-14) / 32768.0 ** 2)


def win_db(x, t0, t1):
    return rms_db(x[int(t0 * RATE):int(t1 * RATE)])


def amp_at(x, f, t0, t1):
    s, e = int(t0 * RATE), int(t1 * RATE)
    seg = x[s:e]
    n = len(seg)
    w = 2.0 * math.pi * f / RATE
    coeff = 2.0 * math.cos(w)
    q1 = q2 = 0.0
    for v in seg:
        q0 = coeff * q1 - q2 + v
        q2, q1 = q1, q0
    return math.sqrt(max(q1 * q1 + q2 * q2 - coeff * q1 * q2, 0.0)) * 2.0 / n


def db(a):
    return 20 * math.log10(max(a, 1e-12) / 32768.0)


def h1_track(x, t0, t1, hop=0.020, span=0.020):
    """h1 peak-dBFS track, window = [t-span, t+span]."""
    out = []
    t = t0 + span
    while t < t1:
        out.append((t - t0, db(amp_at(x, C3, t - span, t + span))))
        t += hop
    return out


def fit_decay_onepole(track_pts, sustain_db, decay_s):
    """a(u) = s + (1-s)exp(-u/tau); db(t) = onset_db + 20log10(a).
    Grid-search onset_db and tau."""
    best = (1e18, None, None)
    for tau_ms in range(20, 400, 2):
        tau = tau_ms / 1000.0
        for onset_x10 in range(-400, -120, 2):
            onset = onset_x10 / 10.0
            num = n = 0.0
            for dt, d in track_pts:
                if dt > decay_s:
                    continue
                u = dt / decay_s
                a = SUSTAIN_STORED + (1 - SUSTAIN_STORED) * math.exp(-u * decay_s / tau)
                pred = onset + 20 * math.log10(max(a, 1e-9))
                num += (d - pred) ** 2
                n += 1
            r = math.sqrt(num / n)
            if r < best[0]:
                best = (r, tau, onset)
    return best


def fit_release_powtail(track_pts, sustain_db, rel_s):
    """a(v) = s*(1-v)^p from the sustain plateau; db = sust_db + 20log10(a/vs)."""
    best = (1e18, None)
    for p_x100 in range(120, 500, 2):
        p = p_x100 / 100.0
        num = n = 0.0
        for dt, d in track_pts:
            if dt > rel_s:
                continue
            v = dt / rel_s
            pred = sustain_db + 20 * p * math.log10(max(1 - v, 1e-6))
            num += (d - pred) ** 2
            n += 1
        r = math.sqrt(num / n)
        if r < best[0]:
            best = (r, p)
    return best


def analyze(path):
    rate, bits, x = read_aiff(path)
    assert rate == RATE, path
    out = {"path": path}
    out["steady"] = [win_db(x, s + 0.15, s + 0.70) for s, _ in NOTES]
    out["harmonics"] = [
        db(amp_at(x, C3 * k, 1.15, 1.70)) for k in range(1, 9)
    ]
    out["early1"] = win_db(x, 1.005, 1.045)
    out["late1"] = win_db(x, 1.70, 1.875)
    out["late1b"] = win_db(x, 3.60, 3.87)
    out["track_decay"] = h1_track(x, 1.0, 1.75)
    out["track_release"] = h1_track(x, OFF3, OFF3 + 0.75)
    return out


def main():
    # prefer renders checked out beside this harness; fall back to the
    # scratch dir used by the offline fit lane (git-recovered renders)
    base = "renders"
    if not all(os.path.exists(f"{base}/{n}.aif") for n in NAMES):
        base = "/tmp/wv-fits"
    print(f"(render source: {base}/)")
    R = {n: analyze(f"{base}/{n}.aif") for n in NAMES}
    M = R["M2_WAVETABLE"]

    print("== per-note steady RMS (start+0.15..start+0.70) ==\n")
    print(f"{'render':14s} " + " ".join(f"note{i:>2d}    " for i in range(4)) + "   d(mean notes1-3)")
    mref = sum(M["steady"][1:]) / 3
    for n in NAMES:
        s = R[n]["steady"]
        d = sum(s[1:]) / 3 - mref
        print(f"{n:14s} " + " ".join(f"{v:8.2f}" for v in s) + f"   {d:+7.2f} dB")

    print("\n== harmonic scan h1..h8, note-1 steady window [1.15,1.70] ==\n")
    print(f"{'render':14s} " + " ".join(f"h{k:d}@{C3*k:6.0f}Hz" for k in range(1, 9)))
    for n in NAMES:
        h = R[n]["harmonics"]
        print(f"{n:14s} " + " ".join(f"{v:9.2f}" for v in h))
    print("\nharmonic deltas vs M2 (dB):")
    for n in NAMES[1:]:
        d = [R[n]["harmonics"][k] - M["harmonics"][k] for k in range(8)]
        mae = sum(abs(v) for v in d) / 8
        print(f"  {n:14s} " + " ".join(f"{v:+7.2f}" for v in d) + f"   |mean| {mae:5.2f}")

    print("\n== envelope window pair (note 1) ==")
    print(f"{'render':14s} {'early 5-45ms':>14s} {'late 700-875ms':>15s} {'sustain ref [3.6,3.87]':>22s}")
    for n in NAMES:
        print(f"{n:14s} {R[n]['early1']:14.2f} {R[n]['late1']:15.2f} {R[n]['late1b']:22.2f}")

    print("\n== law fits ==")
    law = 20 * math.log10(0.5)
    d3 = sum(R["WV3_OSCGAIN"]["steady"][1:]) / 3 - mref
    print(f"  (a) Osc gain 1->0.5: measured {d3:+.2f} dB vs 20log10(0.5) = {law:+.2f} dB")

    dsus = 20 * math.log10(SUSTAIN_WV4 / SUSTAIN_STORED)
    early_d = sum(R["WV4_SUSTAIN"]["early1"] for _ in [1]) - M["early1"]
    late_d = R["WV4_SUSTAIN"]["late1"] - M["late1"]
    lateb_d = R["WV4_SUSTAIN"]["late1b"] - M["late1b"]
    print(f"  (c) Sustain 0.5012->0.25: predicted plateau {dsus:+.2f} dB; "
          f"measured early {early_d:+.2f}, late1 {late_d:+.2f}, late3 {lateb_d:+.2f} dB")

    d5 = [R["WV5_OSC2ON"]["steady"][i] - M["steady"][i] for i in range(4)]
    print(f"  (d) Osc2 on: per-note deltas {['%+.2f' % v for v in d5]} dB "
          f"vs coherent +6.02 / uncorrelated +3.01")
    dh5 = [R["WV5_OSC2ON"]["harmonics"][k] - M["harmonics"][k] for k in range(8)]
    print(f"      harmonic deltas {['%+.2f' % v for v in dh5]}")

    d2h = [R["WV2_POS50"]["harmonics"][k] - M["harmonics"][k] for k in range(8)]
    d2n = [R["WV2_POS50"]["steady"][i] - M["steady"][i] for i in range(4)]
    print(f"  (b) Position 0->0.5: per-note steady {['%+.2f' % v for v in d2n]} dB; "
          f"harmonics {['%+.2f' % v for v in d2h]}")

    print("\n== envelope curve fits (h1 track, note 1 decay / note 3 release) ==")
    sust_db_m2 = M["late1b"]
    r, tau, onset = fit_decay_onepole(M["track_decay"], sust_db_m2, DECAY_T)
    print(f"  decay  one-pole a = s+(1-s)exp(-t/tau): tau {tau*1000:.0f} ms "
          f"(stored decay {DECAY_T*1000:.0f} ms -> ratio {tau/DECAY_T:.3f}), "
          f"onset {onset:.2f} dBFS, resid {r:.3f} dB (n~{len(M['track_decay'])})")
    r2, p = fit_release_powtail(M["track_release"], sust_db_m2, REL_T)
    print(f"  release power tail a = s*(1-v)^p: p {p:.2f}, resid {r2:.3f} dB")

    # measured tables for the dossier (10 ms coarse)
    print("\n  decay table (note-1 h1 dBFS, 40 ms steps):")
    for dt, d in M["track_decay"][::2]:
        print(f"    +{dt*1000:5.0f}ms {d:8.2f}")
    print("  release table (note-3 h1 dBFS, 40 ms steps):")
    for dt, d in M["track_release"][::2]:
        print(f"    +{dt*1000:5.0f}ms {d:8.2f}")


if __name__ == "__main__":
    main()
