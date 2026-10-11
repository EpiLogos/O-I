#!/usr/bin/env python3
"""delta(thr) sweep — Echo ducking effective threshold vs stored threshold.

Round 3 (EC9 family) measured out_env = in_RMS + G_settled sitting ~0.0 dB
above the stored threshold at thr -24 but ~+1.2 dB above it at thr -30 —
a stored-dependent offset delta(thr) with the mapping law open. This probe
adds three thresholds on the same lineage (EC6/EC7 recipe, steps-long.wav,
2.5 s steps, unity clip gain):

  archived (round 3):  EC9_DUCK_TONE_STAIRCASE.aif  thr -24
                       EC9C_DUCK_T30.aif            thr -30
  new (this round):    EC13_THR21.aif               thr -21
                       EC14_THR27.aif               thr -27
                       EC15_THR33.aif               thr -33

Control (unducked, clip gain 0.5): EC9B_NODUCK6.aif (archive).
G(t) = duck - (control + 20log10(0.5)) per 20 ms window; settled window =
last 1.5 s of each 2.5 s step; out_env = in_RMS + G_settled;
delta(thr) = out_env - thr. The soft knee (round 3: ~1 dB shallow at +3 dB
excess) is excluded — only cells with excess >= +6 dB enter the mapping fit.

Run from anywhere; archive dir passed as arg 1 (default the 20261007 archive).
"""
import math
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_ec_duck import read_aiff_stereo

HERE = __file__.rsplit("/", 1)[0]
ARCHIVE_DEFAULT = "/Users/admin/tools/live-re/archive-20261007/renders-final"
WIN = 0.020
HOP = 0.010
STEPS = [(-18, 0.5, 3.0), (-12, 3.0, 5.5), (-6, 5.5, 8.0), (0, 8.0, 10.5)]
CONTROL_GAIN_DB = 20 * math.log10(0.5)
MIN_EXCESS = 6.0  # leveler region only (knee at +3 excluded)

POINTS = [  # (threshold dB, label, directory-or-None-for-renders)
    (-21, "EC13_THR21", None),
    (-24, "EC9_DUCK_TONE_STAIRCASE", "ARCHIVE"),
    (-27, "EC14_THR27", None),
    (-30, "EC9C_DUCK_T30", "ARCHIVE"),
    (-33, "EC15_THR33", None),
]


def rms_db(x):
    acc = sum(v * v for v in x) / max(1, len(x))
    r = math.sqrt(acc) / 32768.0
    return -144.0 if r == 0 else 20 * math.log10(r)


def window_table(rate, L, R, t_end):
    rows = []
    w = int(WIN * rate)
    t = WIN / 2
    while t < t_end:
        s = int((t - WIN / 2) * rate)
        rows.append((t, rms_db(L[s:s + w]), rms_db(R[s:s + w])))
        t += HOP
    return rows


def load(path):
    rate, L, R = read_aiff_stereo(path)
    return dict(((round(t, 4), (l, r)) for t, l, r in window_table(rate, L, R, 14.4)))


def g_table(duck, ctrl_tab):
    out = {}
    for t, (l, r) in duck.items():
        cl, cr = ctrl_tab[t]
        out[t] = (l - cl + CONTROL_GAIN_DB, r - cr + CONTROL_GAIN_DB)
    return out


def main():
    archive = sys.argv[1] if len(sys.argv) > 1 else ARCHIVE_DEFAULT

    def path_for(label, where):
        base = archive if where == "ARCHIVE" else HERE + "/renders"
        return f"{base}/{label}.aif"

    ctrl = load(path_for("EC9B_NODUCK6", "ARCHIVE"))

    # validation: reproduce round 3 on the archived pair first
    print("settled per-cell table (mean of (L+R)/2 over windows fully in the")
    print("last 1.5 s of each 2.5 s step); knee-region cells shown greyed):\n")
    print(f"  {'thr':>5} {'step RMS':>9} {'excess':>7} {'G_settled':>10} "
          f"{'out_env':>8} {'delta=out-thr':>14}  region")
    per_thr = {}
    for thr, label, where in POINTS:
        tab = g_table(load(path_for(label, where)), ctrl)
        cells = []
        for lvl, a, b in STEPS:
            setw = [((tab[t][0] + tab[t][1]) / 2) for t in tab if b - 1.5 <= t < b]
            g = sum(setw) / len(setw)
            rms = lvl - 3.01
            exc = rms - thr
            outenv = rms + g
            region = "leveler" if exc >= MIN_EXCESS else "knee/no-duck"
            print(f"  {thr:>5} {rms:9.2f} {exc:+7.2f} {g:10.2f} {outenv:8.2f} "
                  f"{outenv - thr:+14.2f}  {region}")
            if exc >= MIN_EXCESS:
                cells.append(outenv - thr)
        # L/R split check on leveler cells
        splits = []
        for lvl, a, b in STEPS:
            setw_l = [tab[t][0] for t in tab if b - 1.5 <= t < b]
            setw_r = [tab[t][1] for t in tab if b - 1.5 <= t < b]
            exc = (lvl - 3.01) - thr
            if exc >= MIN_EXCESS:
                splits.append(abs(sum(setw_l) / len(setw_l) - sum(setw_r) / len(setw_r)))
        outenv_delta = sum(cells) / len(cells)
        spread = (max(cells) - min(cells)) / 2 if len(cells) > 1 else 0.0
        per_thr[thr] = (outenv_delta, spread, max(splits), len(cells))
        print(f"  -> thr {thr}: delta(thr) = {outenv_delta:+.3f} dB "
              f"(+/-{spread:.2f} over {len(cells)} cells; max|L-R| {max(splits):.2f} dB)\n")

    thr_list = sorted(per_thr)
    ys = [per_thr[t][0] for t in thr_list]
    n = len(thr_list)
    mx = sum(thr_list) / n
    my = sum(ys) / n
    sxx = sum((t - mx) ** 2 for t in thr_list)
    sxy = sum((t - mx) * (y - my) for t, y in zip(thr_list, ys))
    slope = sxy / sxx
    intercept = my - slope * mx
    resid = [y - (slope * t + intercept) for t, y in zip(thr_list, ys)]
    print("delta(thr) mapping — linear fit delta = a*thr + b (dB vs stored dB):")
    print(f"  a = {slope:.4f}   b = {intercept:.3f}   (fitted, {n} points)")
    for t, y, r in zip(thr_list, ys, resid):
        print(f"  thr {t:>4}: measured delta {y:+7.3f}  fit {slope * t + intercept:+7.3f}  resid {r:+.3f}")
    rms_resid = math.sqrt(sum(r * r for r in resid) / n)
    print(f"  residual RMS = {rms_resid:.3f} dB (max |resid| {max(abs(r) for r in resid):.3f} dB)")
    # two-point anchor deltas for the round-3 phrasing (offset above threshold)
    print("\nround-3 phrasing (out_env minus stored threshold, per point): "
          + ", ".join(f"{t}:{per_thr[t][0]:+.2f}" for t in thr_list))


if __name__ == "__main__":
    main()
