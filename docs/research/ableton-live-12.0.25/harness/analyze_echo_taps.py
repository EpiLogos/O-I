#!/usr/bin/env python3
"""Echo tap analysis: stereo peak scan + windowed tap table (D3/D4/D8).

Reads both channels of an AIFF render of impulse.wav (impulse at wav sample
100 -> t0 ~ 0.0021 s at 44.1k export). Two modes:
  scan          - find all peaks above threshold, grouped 20 ms, both channels
  taps <t0hop>  - levels in +-8 ms windows at t0 + k*hop (E1-style table)
"""
import math
import struct
import sys


def read_aiff_stereo(path):
    b = open(path, "rb").read()
    assert b[:4] == b"FORM", "not AIFF"
    pos = 12
    rate = None
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


def db(x):
    a = abs(x) / 32768.0
    return -144.0 if a == 0 else 20 * math.log10(a)


def scan(L, R, rate, thr_db=-70.0):
    thr = 32768 * 10 ** (thr_db / 20.0)
    span = int(0.020 * rate)
    hits = []
    i = 1
    n = min(len(L), len(R))
    while i < n - 1:
        a = max(abs(L[i]), abs(R[i]))
        if a > thr and a >= max(abs(L[i - 1]), abs(R[i - 1])) and a >= max(abs(L[i + 1]), abs(R[i + 1])):
            # group: suppress following samples within span
            j = i + 1
            while j < min(i + span, n):
                if max(abs(L[j]), abs(R[j])) >= a:
                    break
                j += 1
            if j == min(i + span, n) or max(abs(L[j]), abs(R[j])) < a:
                hits.append((i / rate, db(L[i]), db(R[i])))
                i += span
                continue
        i += 1
    return hits


def main():
    path = sys.argv[1]
    rate, L, R = read_aiff_stereo(path)
    print(f"{path}: rate={rate} L={len(L)} ({len(L)/rate:.2f}s)")
    limit = int(6.0 * rate)
    hits = scan(L[:limit], R[:limit], rate)
    print(f"peaks above -70 dBFS in first 6 s (t / L dBFS / R dBFS):")
    for t, dl, dr in hits:
        print(f"  {t:8.4f}  L {dl:7.2f}  R {dr:7.2f}")
    if len(sys.argv) > 3 and sys.argv[2] == "taps":
        hop = float(sys.argv[3])
        t0 = 100 / 44100.0
        print(f"\n+-8 ms windows at t0 + k*{hop}s (E1-style tap table):")
        print("  k   t        L dBFS     R dBFS")
        for k in range(1, 13):
            tc = t0 + k * hop
            s, e = int((tc - 0.008) * rate), int((tc + 0.008) * rate)
            print(f"  {k:2d}  {tc:7.4f}  {db(max(L[s:e], key=abs)):8.2f}  {db(max(R[s:e], key=abs)):8.2f}")


if __name__ == "__main__":
    main()
