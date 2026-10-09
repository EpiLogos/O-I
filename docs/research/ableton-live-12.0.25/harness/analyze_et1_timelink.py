#!/usr/bin/env python3
"""ET1_TIMELINK — TimeLink=false free mode with tL/tR ratio != 2 (backlog d).

Set: E5_FREEMODE.als with Delay_TimeLink Manual -> false, Delay_TimeR
Manual -> 0.4 (tL stays 0.25 s; ratio 1.6). Free mode (SyncL/R=false).
Everything else the E5 full-preset state (filter/mod/reverb on, DryWet
0.5873, FB 0.5, ChannelMode 1 pingpong, ducking thr 0 — impulse-inert).

Hypotheses the render must separate (hop = min(tL,tR) vs force-equal vs
independent own-time lines):
  H_min-grid   taps at t0 + k*0.25 alternating (larger time inert)
  H_forced     all taps at one common spacing (loader/engine equalizes)
  H_own-time   pingpong crossover: tap sequence t0+tL, t0+tL+tR, t0+2tL+tR,
               ... — same-channel repeats at t0+tL+tR = 0.65 s

Measure: fine parabolic peak time/level in a +-12 ms window at each
hypothesis grid point (the round-2/3 method), plus the broad-scan tap
list; archived E5_FREEMODE.aif shown as the TimeLink=true reference.
"""
import math
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_ec_duck import read_aiff_stereo

HERE = __file__.rsplit("/", 1)[0]
ARCHIVE = "/Users/admin/tools/live-re/archive-20261007/renders-final"
T0 = 100 / 44100.0
TL, TR = 0.25, 0.40


def fine_peak(x, rate, tc, half=0.012):
    s, e = int((tc - half) * rate), int((tc + half) * rate)
    seg = [abs(v) for v in x[s:e]]
    if not seg:
        return None, -144.0
    i = max(range(len(seg)), key=lambda j: seg[j])
    delta = 0.0
    if 0 < i < len(seg) - 1:
        y0, y1, y2 = seg[i - 1], seg[i], seg[i + 1]
        denom = y0 - 2 * y1 + y2
        if denom != 0:
            delta = 0.5 * (y0 - y2) / denom
    t = (s + i + delta) / rate
    return t - T0, 20 * math.log10(abs(seg[i]) / 32768.0)


def main():
    rate, L, R = read_aiff_stereo(HERE + "/renders/ET1_TIMELINK.aif")
    rate5, L5, R5 = read_aiff_stereo(ARCHIVE + "/E5_FREEMODE.aif")

    # crossover-model tap sequence: cumulative alternation starting tL
    seq = []  # (channel, time)
    t = TL
    ch = "L"
    while t < 3.0:
        seq.append((ch, t))
        t += TR if ch == "L" else TL
        ch = "R" if ch == "L" else "L"

    print("H_own-time grid (crossover: after L waits tR, after R waits tL):")
    print("  tap ch  model_t   ET1 t-t0    dev_ms   ET1 dB | E5 same-family tap (time/dev/dB)")
    e5_taps = [("L", 1, 0.25), ("R", 1, 0.50), ("L", 2, 0.75), ("R", 2, 1.00),
               ("L", 3, 1.25), ("R", 3, 1.50), ("L", 4, 1.75), ("R", 4, 2.00)]
    for n, (ch, tm) in enumerate(seq, start=1):
        x = L if ch == "L" else R
        tmeas, db = fine_peak(x, rate, T0 + tm)
        dev = (tmeas - tm) * 1000
        # same FB family: E5's n-th tap sits at the same crossover depth
        e5ch, e5n, e5t = e5_taps[n - 1] if n - 1 < len(e5_taps) else (None, None, None)
        ref = ""
        if e5ch:
            x5 = L5 if e5ch == "L" else R5
            t5, db5 = fine_peak(x5, rate5, T0 + e5t)
            ref = f"({e5ch}{e5n} @t0+{e5t:.2f}: {(t5 - e5t) * 1000:+.1f} ms / {db5:.2f} dB)"
        print(f"  {n:2d}  {ch}   {tm:7.3f}  {tmeas:8.4f}  {dev:+7.2f}  {db:8.2f} | {ref}")

    print("\nAlternative grids — strongest peak in +-12 ms windows (ET1):")
    for name, times in [
        ("H_min-grid R slots t0+k*0.25 (R side)", [0.50, 1.00, 1.50, 2.00]),
        ("R raw own multiples t0+k*tR", [0.40, 0.80, 1.20, 1.60]),
        ("R raw own multiples t0+k*tR (odd)", [0.40 + 0.40 * k for k in (0, 2, 4)]),
    ]:
        vals = []
        for tm in times:
            _, dbl = fine_peak(L, rate, T0 + tm)
            _, dbr = fine_peak(R, rate, T0 + tm)
            vals.append(f"{tm:.2f}s: L {dbl:7.2f} R {dbr:7.2f}")
        print(f"  {name}\n    " + "\n    ".join(vals))


if __name__ == "__main__":
    main()
