#!/usr/bin/env python3
"""Groove onset-displacement analysis: render vs straight baseline.

Usage: analyze_groove.py <render.aif> [baseline.aif]
Baseline default: renders/W2_TEXTURE.aif (1:1 Texture, sample-transparent).

steps-1k: 0.25 s silence lead, then 7 sine steps 0.5 s apart at
0.25/0.75/1.25/.../3.25 s. Onset = first crossing of -60 dBFS in a window
around each expected position; displacement = render onset - baseline onset.
Expected with 'Swing MPC 3000 8ths 74' at TimingAmount=100: every step sits
on a displaced 8th position (+0.24 beats at the set's 120 BPM = +0.120 s).
"""
import math
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_render import read_aiff

STEP_ONSETS = [0.25 + 0.5 * k for k in range(7)]
WIN = 0.30          # search +- window around the expected onset (s)
THRESH_DB = -60.0


def onset_time(x, rate, expect):
    thr = 32768.0 * 10 ** (THRESH_DB / 20.0)
    s = max(0, int((expect - WIN) * rate))
    e = min(len(x), int((expect + WIN) * rate))
    for i in range(s, e):
        if abs(x[i]) > thr:
            return i / rate
    return None


def main():
    args = sys.argv[1:]
    path = args[0]
    base = args[1] if len(args) > 1 else \
        __file__.rsplit("/", 1)[0] + "/renders/W2_TEXTURE.aif"
    rate, _, x = read_aiff(path)
    brate, _, bx = read_aiff(base)
    print(f"== {path} vs baseline {base.split('/')[-1]}")
    print(f"   {'step':>6} {'base t':>8} {'rend t':>8} {'delta ms':>9}")
    deltas = []
    for k, exp in enumerate(STEP_ONSETS):
        tb = onset_time(bx, brate, exp)
        tr = onset_time(x, rate, exp)
        if tb is None or tr is None:
            print(f"   {k:>6} {exp:8.2f}  MISSING (base {tb}, render {tr})")
            continue
        d = (tr - tb) * 1000.0
        deltas.append(d)
        print(f"   {k:>6} {tb:8.3f} {tr:8.3f} {d:+9.2f}")
    if deltas:
        mean = sum(deltas) / len(deltas)
        print(f"   mean displacement {mean:+.2f} ms "
              f"(+0.24 beats @120BPM = +120.00 ms expected); "
              f"spread {max(deltas) - min(deltas):.2f} ms")


if __name__ == "__main__":
    main()
