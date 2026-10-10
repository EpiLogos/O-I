#!/usr/bin/env python3
"""EC9: duck GR saturation ladder on steps-long.wav (2.5 s steps).

Renders (EC6/EC7 recipe: Echo, Filter/Mod/Reverb off, DryWet=1, sync, FB 0.5):
  EC9_DUCK_TONE_STAIRCASE  duck on,  thr -24
  EC9C_DUCK_T30            duck on,  thr -30
  EC9B_NODUCK6             duck off, clip gain 0.5 (-6.0206 dB) — control

steps-long timeline (48k source, 44.1k render, timeline preserved):
  0.5 lead | -18 dBFS 0.5-3.0 | -12 3.0-5.5 | -6 5.5-8.0 | 0 8.0-10.5 | tail

G(t) = duck(t) - (control(t) + 20log10(0.5)) per 20 ms window. The control's
-6 dB clip gain keeps the unducked wet sum (FB 0.5) below full scale, so the
top-step depths are exact, not lower bounds (the EC6B control clipped).
Excess = input RMS (peak - 3.01) - threshold.
"""
import math
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_ec_duck import read_aiff_stereo

REND = __file__.rsplit("/", 1)[0] + "/renders/"
WIN = 0.020
HOP = 0.010
STEPS = [(-18, 0.5, 3.0), (-12, 3.0, 5.5), (-6, 5.5, 8.0), (0, 8.0, 10.5)]
CONTROL_GAIN_DB = 20 * math.log10(0.5)


def window_table(rate, L, R, t_end):
    rows = []
    w = int(WIN * rate)
    t = WIN / 2
    while t < t_end:
        s = int((t - WIN / 2) * rate)
        seg_l = L[s:s + w]
        seg_r = R[s:s + w]
        rows.append((t, rms_db(seg_l), rms_db(seg_r)))
        t += HOP
    return rows


def rms_db(x):
    acc = sum(v * v for v in x) / max(1, len(x))
    r = math.sqrt(acc) / 32768.0
    return -144.0 if r == 0 else 20 * math.log10(r)


def load(name):
    rate, L, R = read_aiff_stereo(REND + name + ".aif")
    return dict(((round(t, 4), (l, r)) for t, l, r in window_table(rate, L, R, 14.4)))


def seg_of(t):
    for lvl, a, b in STEPS:
        if a <= t < b:
            return lvl
    return "tail" if t >= 10.5 else "lead"


def g_table(duck, ctrl_tab):
    # control renders at clip gain 0.5 = unity - 6.02 dB; restore to unity
    out = {}
    for t, (l, r) in duck.items():
        cl, cr = ctrl_tab[t]
        out[t] = (l - cl + CONTROL_GAIN_DB, r - cr + CONTROL_GAIN_DB)
    return out


def main():
    ctrl = load("EC9B_NODUCK6")
    ducks = {"thr -24": g_table(load("EC9_DUCK_TONE_STAIRCASE"), ctrl)}
    import os
    if os.path.exists(REND + "EC9C_DUCK_T30.aif"):
        ducks["thr -30"] = g_table(load("EC9C_DUCK_T30"), ctrl)
    else:
        print("(EC9C_DUCK_T30.aif absent — thr -30 ladder pending re-render)\n")

    print("per-step mean G (dB): 20 ms windows fully inside each segment, and SETTLED (last 1.5 s of the 2.5 s step):")
    hdr = f"  {'step':>10} {'RMS':>6} "
    for thr in ducks:
        hdr += f"| excess{'':5} G_all{'':9} G_settled{'':7} "
    print(hdr)
    ladder = {}
    for lvl, a, b in STEPS + [(None, 10.5, 14.4)]:
        name = f"{lvl} dBFS" if lvl is not None else "tail*"
        row = f"  {name:>10} {lvl - 3.01 if lvl is not None else -144:6.1f} "
        for thr, tab in ducks.items():
            allw = [((tab[t][0] + tab[t][1]) / 2) for t in tab if a + WIN <= t < b]
            if lvl is not None:
                setw = [((tab[t][0] + tab[t][1]) / 2) for t in tab if b - 1.5 <= t < b]
                exc = (lvl - 3.01) - float(thr.split()[1])
                mean = sum(setw) / len(setw)
                ladder[(thr, lvl)] = (exc, mean, sum(allw) / len(allw))
                row += (f"| {exc:+8.1f} {sum(allw) / len(allw):7.2f}"
                        f" {mean:9.2f} ({(tab[max(t for t in tab if t < b)][0]):6.2f}/{(tab[max(t for t in tab if t < b)][1]):6.2f}) ")
            else:
                row += f"| {'':14} {sum(allw) / len(allw):7.2f}"
        print(row)
    print("  (*tail G is floor-dominated: the -6 dB control reaches the dither floor earlier; not a duck reading)")

    print("\nSTEADY depth-vs-excess ladder (settled windows) + leveler read-out:")
    print("  out_env = in_RMS + G_settled; the leveler law predicts out_env = threshold")
    pts = []
    for thr in ducks:
        for lvl in (-18, -12, -6, 0):
            if (thr, lvl) in ladder:
                exc, g, _ = ladder[(thr, lvl)]
                outenv = (lvl - 3.01) + g
                thrdb = float(thr.split()[1])
                pts.append((exc, g, thr))
                print(f"  {thr}: excess {exc:+5.1f} -> GR {g:7.2f} dB; "
                      f"out_env {outenv:7.2f} dBFS vs thr {thrdb:+.0f} (delta {outenv - thrdb:+.2f})")
    pts.sort()
    print("\nlocal slope (dB GR per dB excess):")
    for i in range(1, len(pts)):
        e0, g0, t0 = pts[i - 1]
        e1, g1, t1 = pts[i]
        if e1 > e0:
            print(f"  {e0:+5.1f}({t0}) -> {e1:+5.1f}({t1}): {(g1 - g0) / (e1 - e0):+.3f}")

    # onset + release on the 0 dBFS step of the first duck render
    thr0, tab = next(iter(ducks.items()))
    onset = next((t for t in sorted(tab) if t >= 8.0 and tab[t][0] < -0.5), None)
    if onset:
        print(f"\nGR onset ({thr0}, G<-0.5): t={onset:.3f} s ({onset - 8.0:+.3f} s vs step)")
    tail = [(t, tab[t][0]) for t in sorted(tab) if 10.6 <= t <= 12.5 and tab[t][0] < -0.5]
    if len(tail) > 4:
        # CAVEAT: this window is floor-dominated (control reaches the dither
        # floor first, G converges to a floor offset, not to 0) — the fitted
        # tau here is NOT the release constant; round-2's tau ~111 ms fit on
        # steps-1k stands (this render's own first 0.4 s of tail shows
        # -21.2 -> -9.9 -> -6.1 -> -4.6 dB at 0.1 s steps, consistent with it).
        xs = [t for t, g in tail]
        ys = [math.log(-g) for t, g in tail]
        n = len(xs)
        mx, my = sum(xs) / n, sum(ys) / n
        sxx = sum((x - mx) ** 2 for x in xs)
        sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
        tau = -1 / (sxy / sxx)
        print(f"release fit (L, 10.6-12.5 s): tau={tau * 1000:.0f} ms (stored 0.1 s)")


if __name__ == "__main__":
    main()
