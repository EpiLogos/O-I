#!/usr/bin/env python3
"""Reverb per-band decay analysis from impulse renders (R1/R3/R4).

Mirrors what the Rust verify gate measures on the MONO MIXDOWN (L+R)/2:
- sample-level reverb onset (pre-delay)
- fine 1 ms peak envelope (early taps)
- 10 ms RMS blocks, broadband and per log-band (Hann 441 -> FFT 512)
- floor-aware least-squares decay fits (floor = median of the 4.5-6.0 s
  blocks per band; blocks below floor+3 dB excluded from fits)
"""
import math
import struct
import sys


def read_aiff_stereo(path):
    b = open(path, "rb").read()
    assert b[:4] == b"FORM", "not AIFF"
    pos = 12
    rate = None
    data = None
    while pos + 8 <= len(b):
        cid = b[pos:pos + 4]
        size = struct.unpack(">I", b[pos + 4:pos + 8])[0]
        body = b[pos + 8:pos + 8 + size]
        if cid == b"COMM":
            exp = struct.unpack(">h", body[8:10])[0]
            mant = struct.unpack(">Q", body[10:18])[0]
            rate = mant * 2.0 ** (exp - 16383 - 63)
        elif cid == b"SSND":
            offset = struct.unpack(">I", body[0:4])[0]
            data = body[8 + offset:]
            break
        pos += 8 + size + (size & 1)
    n = len(data) // 2
    s = struct.unpack(">%dh" % n, data[:2 * n])
    return rate, s[0::2], s[1::2]


def fft(re, im):
    n = len(re)
    j = 0
    for i in range(n):
        if i < j:
            re[i], re[j] = re[j], re[i]
            im[i], im[j] = im[j], im[i]
        m = n >> 1
        while m >= 1 and j & m:
            j ^= m
            m >>= 1
        j ^= m
    length = 2
    while length <= n:
        ang = -2 * math.pi / length
        step = (math.cos(ang), math.sin(ang))
        for start in range(0, n, length):
            c, s = 1.0, 0.0
            for k in range(length // 2):
                a, b = start + k, start + k + length // 2
                tr = re[b] * c - im[b] * s
                ti = re[b] * s + im[b] * c
                re[b] = re[a] - tr
                im[b] = im[a] - ti
                re[a] += tr
                im[a] += ti
                c, s = c * step[0] - s * step[1], s * step[0] + c * step[1]
        length <<= 1


def db(x):
    return -144.0 if x <= 0 else 10 * math.log10(x)


def mono(L, R):
    return [(l + r) / 2.0 / 32768.0 for l, r in zip(L, R)]


def rms_blocks(x, rate, bw=0.010, dur=6.0):
    out = []
    for k in range(int(dur / bw)):
        a = int(k * bw * rate)
        e = int((k + 1) * bw * rate)
        acc = sum(v * v for v in x[a:e])
        m = acc / max(1, e - a)
        out.append((k * bw + bw / 2, db(m)))
    return out


def band_blocks(x, rate, edges, bw=0.010, dur=6.0):
    w = int(bw * rate)
    N = 512
    win = [0.5 - 0.5 * math.cos(2 * math.pi * i / w) for i in range(w)]
    bins = [[k for k in range(N // 2) if lo <= k * rate / N < hi]
            for lo, hi in zip(edges[:-1], edges[1:])]
    out = [[] for _ in bins]
    for k in range(int(dur / bw)):
        a = int(k * bw * rate)
        re = [0.0] * N
        im = [0.0] * N
        for i in range(w):
            re[i] = x[a + i] * win[i]
        fft(re, im)
        t = k * bw + bw / 2
        for bi, ks in enumerate(bins):
            p = sum(re[kk] ** 2 + im[kk] ** 2 for kk in ks) / len(ks)
            out[bi].append((t, db(p)))
    return out


def median(v):
    s = sorted(v)
    return s[len(s) // 2]


def fit(blocks, t0, t1, floor):
    pts = [(t, d) for t, d in blocks if t0 <= t <= t1 and d > floor + 3.0]
    if len(pts) < 4:
        return None
    n = len(pts)
    sx = sum(t for t, _ in pts)
    sy = sum(d for _, d in pts)
    sxx = sum(t * t for t, _ in pts)
    sxy = sum(t * d for t, d in pts)
    slope = (n * sxy - sx * sy) / (n * sxx - sx * sx)
    return slope, (-60.0 / slope if slope < 0 else None), n


BANDS = [80.0, 315.0, 1250.0, 5000.0, 16000.0]

def main():
    path = sys.argv[1]
    rate, L, R = read_aiff_stereo(path)
    x = mono(L, R)
    print(f"== {path}: rate={rate}")
    pk = max(range(int(0.05 * rate)), key=lambda i: abs(x[i]))
    print(f"direct peak: sample {pk} ({pk / rate * 1000:.3f} ms), "
          f"{20 * math.log10(abs(x[pk])):.2f} dBFS (mono)")
    # sample-level reverb onset: first sample after direct exceeding
    # -60 dBFS, either channel
    thr = 10 ** (-60 / 20)
    onset = None
    for i in range(pk + 9, int(0.2 * rate)):
        if abs(L[i]) / 32768 > thr or abs(R[i]) / 32768 > thr:
            onset = i
            break
    print(f"reverb onset (first sample > -60 dBFS after direct): "
          f"sample {onset} ({onset / rate * 1000:.3f} ms, "
          f"{(onset - pk) / rate * 1000:.3f} ms after direct)")
    print("fine 1 ms peak envelope (mono dBFS), first 120 ms:")
    w = int(0.001 * rate)
    for k in range(120):
        a = int(k * 0.001 * rate)
        p = max(abs(v) for v in x[a:a + w])
        print(f"  {k:4d} ms  {20 * math.log10(max(p, 1e-7)):7.2f}")
    bb = rms_blocks(x, rate)
    print("broadband 10 ms RMS (mono dBFS):")
    print("  " + " ".join(f"{t:.2f}:{d:.1f}" for t, d in bb if d > -100))
    fl_bb = median([d for t, d in bb if 4.5 <= t <= 6.0])
    print(f"broadband floor (median 4.5-6s): {fl_bb:.1f}")
    for t0, t1 in [(0.10, 0.30), (0.25, 0.60), (0.40, 0.80), (0.20, 0.60),
                   (0.40, 1.20), (0.80, 2.00)]:
        r = fit(bb, t0, t1, fl_bb)
        if r:
            print(f"  BB fit {t0:.2f}-{t1:.2f}s: {r[0]:8.2f} dB/s -> "
                  f"RT60 {r[1]:5.2f} s ({r[2]} blocks)")
    for lo, hi in zip(BANDS[:-1], BANDS[1:]):
        blocks = band_blocks(x, rate, [lo, hi])[0]
        fl = median([d for t, d in blocks if 4.5 <= t <= 6.0])
        print(f"band {lo:.0f}-{hi:.0f} Hz (floor {fl:.1f}):")
        print("  " + " ".join(f"{t:.2f}:{d:.1f}" for t, d in blocks[::5]
                              if t < 2.2 and d > fl - 8))
        for t0, t1 in [(0.05, 0.20), (0.10, 0.30), (0.20, 0.30),
                       (0.25, 0.60), (0.30, 0.55), (0.40, 0.80),
                       (0.40, 1.20), (0.80, 2.00)]:
            r = fit(blocks, t0, t1, fl)
            if r:
                rt = f"{r[1]:5.2f} s" if r[1] else "n/a  "
                print(f"  fit {t0:.2f}-{t1:.2f}s: {r[0]:8.2f} dB/s -> "
                      f"RT60 {rt} ({r[2]} blocks)")


if __name__ == "__main__":
    main()
