#!/usr/bin/env python3
"""Fit the Wavetable default-patch envelope laws from M2_WAVETABLE.aif.

Sliding RMS (2-cycle window at C3 = 15.36 ms, 5 ms hop) over:
  note 1 (on 1.0 s):  decay curve t in [0, 0.875]
  note 3 tail (off 3.875 s): release curve u in [0, 0.65]
sustain reference: mean RMS over [3.60, 3.87] (post-decay, pre-off).

Candidate decay laws (u = t/0.6, stored D=0.6 s, sustain s = 0.5011875629,
slope 0.5), amplitude forms, a(0)=1, a(1)=s:
  linear-amp   a = 1 + (s-1)u
  db-linear    a = 10^(20log10(s) u / 20)
  exponential  a = exp(ln(s) u)                 (= db-linear, same curve)
  power        a = 1 + (s-1) u^p                (p from slope?)
  sinh-bend    a = s + (1-s) (1-u)^p
  warped       a(u) with warped x = u^q, then db-linear or linear in x

Release candidates (v = t/0.6, g(0)=1, g(1)=0):
  linear-amp   g = 1-v
  db-linear    impossible (would need -inf dB at finite time... = floor)
  power        g = (1-v)^p
  raised-cos   g = (1+cos(pi v))/2
  cos^2        g = cos(pi v/2)^2
  sin^2 cut    g = 1 - sin(pi v/2)^2  (= cos^2, same)
  smoothstep   g = 1 - (3v^2 - 2v^3)

Fit is least-squares in dB over the measured windows; report residual RMS
per candidate and the best per segment.
"""
import math
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_render import read_aiff

RATE = 44100.0
CYCLE = 1.0 / 130.81278265
WIN = 2 * CYCLE          # 2-cycle analysis window
HOP = 0.005
DECAY_T = 0.5999999642   # stored Decay
REL_T = 0.5999999642     # stored Release
SUSTAIN = 0.5011875629   # stored Sustain (amplitude)
SLOPE_D = 0.5            # stored Decay slope
SLOPE_R = 0.5            # stored Release slope


def sliding_rms_db(x, t0, t1, hop=HOP, win=WIN):
    """(t, rms_db) window centers in [t0, t1]."""
    out = []
    t = t0 + win / 2
    while t + win / 2 < t1:
        s = int((t - win / 2) * RATE)
        e = int((t + win / 2) * RATE)
        seg = x[s:e]
        acc = sum(v * v for v in seg) / len(seg)
        out.append((t, 10 * math.log10(max(acc, 1e-12) / 32768.0 ** 2)))
        t += hop
    return out


def rms_db_win(x, t0, t1):
    s, e = int(t0 * RATE), int(t1 * RATE)
    seg = x[s:e]
    acc = sum(v * v for v in seg) / len(seg)
    return 10 * math.log10(max(acc, 1e-12) / 32768.0 ** 2)


# candidate amplitude curves as functions of phase u in [0,1]
def c_linear_amp(u, s, p=2.0):
    return 1.0 + (s - 1.0) * u

def c_db_linear(u, s, p=2.0):
    return s ** u

def c_pow_in(u, s, p):
    # decay dominated by a power of u (slope-bent linear)
    return 1.0 + (s - 1.0) * (u ** p)

def c_pow_tail(u, s, p):
    # remainder dies like (1-u)^p scaled to hit s at u=1 -> impossible (0);
    # instead: a = s + (1-s)(1-u)^p
    return s + (1.0 - s) * ((1.0 - u) ** p)

def c_raised_cos(u, s, p=2.0):
    return s + (1.0 - s) * (1.0 + math.cos(math.pi * u)) / 2.0

def c_cos2(u, s, p=2.0):
    return s + (1.0 - s) * math.cos(math.pi * u / 2.0) ** 2

def c_smoothstep(u, s, p=2.0):
    return s + (1.0 - s) * (1.0 - u * u * (3 - 2 * u))

def c_sqrt_bend(u, s, p=2.0):
    # quadratic-in-log bend: a = exp(ln(s) u^q)
    return math.exp(math.log(s) * (u ** p))


def fit(x, curve, pts, sustain_db, t_origin, dur, params):
    """Least squares over (t, db) points; returns (rms_resid_db, params)."""
    num = 0.0
    n = 0
    for t, db in pts:
        u = (t - t_origin) / dur
        if u < 0 or u > 1.0:
            continue
        amp = curve(u, SUSTAIN, params)
        model_db = sustain_db + 20 * math.log10(max(amp, 1e-9))
        num += (db - model_db) ** 2
        n += 1
    return (math.sqrt(num / n), params) if n else (1e9, params)


def main(path):
    rate, bits, x = read_aiff(path)
    assert rate == RATE

    sustain_db = rms_db_win(x, 3.60, 3.87)
    print(f"sustain reference RMS [3.60,3.87]: {sustain_db:.2f} dBFS "
          f"(envelope 0 dB point of the post-decay voice)")

    note1 = sliding_rms_db(x, 1.0, 1.875)
    tail3 = sliding_rms_db(x, 3.875, 4.55)

    # floor clamp for release fit: ignore windows at/below floor+6 dB
    floor = -90.0
    tail3f = [(t, d) for t, d in tail3 if d > floor]

    print("\nDECAY segment fit (note 1, u = t/0.6, points to 0.6 s):")
    cands = [
        ("linear-amp 1+(s-1)u", c_linear_amp, 2.0),
        ("db-linear s^u", c_db_linear, 2.0),
        ("pow-in 1+(s-1)u^p p=2", c_pow_in, 2.0),
        ("pow-in 1+(s-1)u^p p=0.5", c_pow_in, 0.5),
        ("pow-tail s+(1-s)(1-u)^p p=2", c_pow_tail, 2.0),
        ("raised-cos", c_raised_cos, 2.0),
        ("cos^2", c_cos2, 2.0),
        ("smoothstep", c_smoothstep, 2.0),
        ("exp-bend exp(ln s u^q) q=2", c_sqrt_bend, 2.0),
        ("exp-bend q=0.5", c_sqrt_bend, 0.5),
    ]
    for name, curve, p in cands:
        r, _ = fit(x, curve, note1, sustain_db, 1.0, DECAY_T, p)
        print(f"    {name:32s} resid {r:6.3f} dB")

    print("\nRELEASE segment fit (note 3 tail, v = t/0.6):")
    for name, curve, p in cands:
        r, _ = fit(x, curve, tail3f, sustain_db, 3.875, REL_T, p)
        print(f"    {name:32s} resid {r:6.3f} dB")

    # refine p for the two best families
    print("\np/q sweep for pow families (decay, release):")
    best_d = (1e9, None)
    best_r = (1e9, None)
    q = 0.1
    while q <= 4.001:
        rd, _ = fit(x, c_pow_in, note1, sustain_db, 1.0, DECAY_T, q)
        rr, _ = fit(x, c_pow_tail, tail3f, sustain_db, 3.875, REL_T, q)
        rd2, _ = fit(x, c_sqrt_bend, note1, sustain_db, 1.0, DECAY_T, q)
        rr2, _ = fit(x, c_pow_tail, tail3f, sustain_db, 3.875, REL_T, q)
        if rd < best_d[0]:
            best_d = (rd, f"pow-in u^{q:.2f}")
        if rd2 < best_d[0]:
            best_d = (rd2, f"exp-bend u^{q:.2f}")
        if rr < best_r[0]:
            best_r = (rr, f"pow-tail (1-u)^{q:.2f}")
        q += 0.05
    print(f"    best decay : {best_d[1]}  resid {best_d[0]:.3f} dB")
    print(f"    best release: {best_r[1]}  resid {best_r[0]:.3f} dB")

    # measured reference table for the dossier
    print("\nmeasured decay (note 1, window-center -> dBFS):")
    for t, db in note1[::4]:
        if t - 1.0 <= 0.62:
            print(f"    +{(t-1.0)*1000:5.0f}ms  {db:8.2f}")
    print("\nmeasured release (note 3 tail):")
    for t, db in tail3[::4]:
        print(f"    +{(t-3.875)*1000:5.0f}ms  {db:8.2f}")


if __name__ == "__main__":
    for p in sys.argv[1:]:
        main(p)
