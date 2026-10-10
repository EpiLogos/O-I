#!/usr/bin/env python3
"""Reverb RT60 analysis from impulse renders (D5): 10 ms RMS blocks, L+R
summed energy, least-squares decay fits over selectable windows (reverb.md
method)."""
import math
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_echo_taps import read_aiff_stereo


def rms_lr(L, R, s, e):
    acc = 0.0
    for ch in (L, R):
        for v in ch[s:e]:
            acc += v * v
    n = max(1, (e - s) * 2)
    if acc <= 0:
        return -144.0
    return 10 * math.log10(acc / n / (32768.0 ** 2))


def fit(blocks, t_start, t_end):
    pts = [(t, db) for t, db in blocks if t_start <= t <= t_end and db > -95.0]
    if len(pts) < 4:
        return None
    n = len(pts)
    sx = sum(t for t, _ in pts)
    sy = sum(db for _, db in pts)
    sxx = sum(t * t for t, _ in pts)
    sxy = sum(t * db for t, db in pts)
    slope = (n * sxy - sx * sy) / (n * sxx - sx * sx)
    return slope, -60.0 / slope if slope < 0 else None, n


def main(path, windows):
    rate, L, R = read_aiff_stereo(path)
    bw = 0.010
    nb = int(6.0 / bw)
    blocks = []
    for k in range(nb):
        s = int(k * bw * rate)
        e = int((k + 1) * bw * rate)
        blocks.append((k * bw + bw / 2, rms_lr(L, R, s, e)))
    print(f"{path}: rate={rate}")
    print("envelope (20 ms steps, dB):")
    for t, dbv in blocks[::2]:
        if t <= 5.0:
            print(f"  {t:5.2f}s  {dbv:7.2f}")
    for t_start, t_end in windows:
        r = fit(blocks, t_start, t_end)
        if r:
            slope, rt60, n = r
            print(f"fit {t_start:.2f}-{t_end:.2f}s: {slope:7.1f} dB/s -> RT60 {rt60:5.2f} s  ({n} blocks)")


if __name__ == "__main__":
    wins = []
    for a in sys.argv[2:]:
        t0, t1 = a.split("-")
        wins.append((float(t0), float(t1)))
    main(sys.argv[1], wins or [(0.25, 0.6)])
