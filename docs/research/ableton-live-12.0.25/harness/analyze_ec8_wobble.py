#!/usr/bin/env python3
"""EC8: Modulation_AmountDelay depth law — tap-timing wobble vs stored amount.

Renders (impulse.wav, E1 full preset, sync hop 0.1875 s, mod 2 Hz phase 90):
  EC3_NOMOD               amount 0        (timing reference)
  E1_IMPULSE_default_v2   amount 0.21875  (stored preset)
  EC8_MOD50               amount 0.5      (this probe)

For each tap k (1..6, both channels): fine peak time in a +-12 ms window at
t0 + k*hop by parabolic interpolation of |x| around the largest sample.
Wobble(tap) = t_peak - grid. Law read-out: peak-to-peak wobble per channel
per render -> ms per unit of Modulation_AmountDelay (0-anchor + two points).
Also: tap peak level (smear) per render.
"""
import math
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_ec_duck import read_aiff_stereo

REND = __file__.rsplit("/", 1)[0] + "/renders/"
HOP = 0.1875
T0 = 100 / 44100.0
AMOUNTS = {"EC3_NOMOD": 0.0, "E1_IMPULSE_default_v2": 0.21875, "EC8_MOD50": 0.5}


def fine_peak(x, rate, tc, half=0.020):
    s, e = int((tc - half) * rate), int((tc + half) * rate)
    seg = [abs(v) for v in x[s:e]]
    imax = max(range(len(seg)), key=lambda i: seg[i])
    i = imax
    if 0 < i < len(seg) - 1:
        y0, y1, y2 = seg[i - 1], seg[i], seg[i + 1]
        denom = y0 - 2 * y1 + y2
        delta = 0.5 * (y0 - y2) / denom if denom != 0 else 0.0
    else:
        delta = 0.0
    t = (s + i + delta) / rate
    peak = x[s + i]
    return t - tc, 20 * math.log10(abs(peak) / 32768.0)


def depth_fit(ks, offs_ms):
    """fit offset(k) = A*sin(w*k + phi) + c, w = -90 deg per same-channel tap
    (LFO 2 Hz, hop 0.1875 s = 135 deg per hop = 270 per same-channel tap).
    Returns A in ms (least squares over a 3-param grid on w,phi)."""
    best = (0.0, 1e9)
    n = len(ks)
    for phideg in range(0, 360, 2):
        w = math.radians(-90.0)
        phi = math.radians(phideg)
        # linear least squares for [a, b, c] in a*sin + b*cos + c
        rows = [[math.sin(w * k + phi), math.cos(w * k + phi), 1.0] for k in ks]
        ys = offs_ms
        # normal equations 3x3
        import statistics
        ATA = [[sum(r[i] * r[j] for r in rows) for j in range(3)] for i in range(3)]
        ATy = [sum(r[i] * y for r, y in zip(rows, ys)) for i in range(3)]
        # solve 3x3
        import copy
        M = [row[:] + [ATy[i]] for i, row in enumerate(ATA)]
        for col in range(3):
            piv = max(range(col, 3), key=lambda r: abs(M[r][col]))
            M[col], M[piv] = M[piv], M[col]
            for r in range(3):
                if r != col and M[col][col] != 0:
                    f = M[r][col] / M[col][col]
                    for c in range(col, 4):
                        M[r][c] -= f * M[col][c]
        try:
            a, b, c = (M[i][3] / M[i][i] for i in range(3))
        except ZeroDivisionError:
            continue
        resid = math.sqrt(sum((a * r[0] + b * r[1] + c - y) ** 2
                              for r, y in zip(rows, ys)) / n)
        amp = math.hypot(a, b)
        if resid < best[1]:
            best = (amp, resid)
    return best


def main():
    rate0 = None
    res = {}
    for name, amount in AMOUNTS.items():
        rate, L, R = read_aiff_stereo(REND + name + ".aif")
        rate0 = rate
        # pingpong: L channel carries the odd taps, R the even taps
        offs = {"L": [], "R": []}
        lvl = {"L": [], "R": []}
        for ch, x, ks in (("L", L, (1, 3, 5, 7, 9)), ("R", R, (2, 4, 6, 8, 10))):
            for k in ks:
                dt, db = fine_peak(x, rate, T0 + k * HOP)
                offs[ch].append(dt * 1000.0)
                lvl[ch].append(db)
        res[name] = (amount, offs, lvl)
        pp = {ch: max(offs[ch]) - min(offs[ch]) for ch in "LR"}
        print(f"== {name} (amount {amount})")
        print("   L taps k=1,3,5,7,9 offsets ms:", " ".join(f"{v:+7.3f}" for v in offs["L"]))
        print("   R taps k=2,4,6,8,10 offsets ms:", " ".join(f"{v:+7.3f}" for v in offs["R"]))
        print("   L tap levels dB:", " ".join(f"{v:7.2f}" for v in lvl["L"]))
        print("   R tap levels dB:", " ".join(f"{v:7.2f}" for v in lvl["R"]))
        print(f"   pp wobble: L {pp['L']:.3f} ms  R {pp['R']:.3f} ms")

    print("\n== depth law (pp wobble over the same tap set; EC3 = 0-anchor)")
    a3 = res["EC3_NOMOD"][1]
    for ch in "LR":
        row = []
        for name in AMOUNTS:
            offs = res[name][1][ch]
            pp = max(offs) - min(offs)
            amount = AMOUNTS[name]
            unit = f"({pp / amount:6.2f} ms/unit)" if amount else "(0-anchor)"
            row.append(f"A={amount}: pp {pp:6.3f} ms {unit}")
        print(f"   {ch}: " + "; ".join(row))
    # power law through the two mod-on points (origin-anchored): pp ~ amount^p
    for ch in "LR":
        pp1 = max(res["E1_IMPULSE_default_v2"][1][ch]) - min(res["E1_IMPULSE_default_v2"][1][ch])
        pp8 = max(res["EC8_MOD50"][1][ch]) - min(res["EC8_MOD50"][1][ch])
        p = math.log(pp8 / pp1) / math.log(0.5 / 0.21875)
        print(f"   {ch}: power-law exponent pp~A^p: p = {p:.2f} (linear = 1.0)")

    print("\n== per-tap offset ratio EC8/E1 (same tap, tail-guarded by level match):")
    for ch, ks in (("L", (1, 3, 5, 7)), ("R", (2, 4, 6, 8))):
        idx = {k: i for i, k in enumerate((1, 3, 5, 7, 9) if ch == "L" else (2, 4, 6, 8, 10))}
        ratios = []
        for k in ks:
            i = idx[k]
            l1 = res["E1_IMPULSE_default_v2"][2][ch][i]
            l8 = res["EC8_MOD50"][2][ch][i]
            if abs(l8 - l1) <= 3.0:  # same tap family -> measurement is the tap
                o1 = res["E1_IMPULSE_default_v2"][1][ch][i]
                o8 = res["EC8_MOD50"][1][ch][i]
                ratios.append(f"k={k}: {o8:+7.3f}/{o1:+7.3f}")
        print(f"   {ch}: " + "; ".join(ratios))

    print("\n== level smear (tap1..6 mean dB, ducking of peak by mod)")
    for name in AMOUNTS:
        _, _, lvl = res[name]
        ml = sum(lvl["L"]) / 6
        mr = sum(lvl["R"]) / 6
        print(f"   {name:24s} L {ml:7.2f}  R {mr:7.2f}")


if __name__ == "__main__":
    main()
