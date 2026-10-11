#!/usr/bin/env python3
"""Analyze golden renders: segment gain map + render-vs-render determinism.

Reads AIFF (16-bit big-endian, from Live's export), no deps.
"""
import math
import struct
import sys


def read_aiff(path):
    b = open(path, "rb").read()
    assert b[:4] == b"FORM" and b[8:12] == b"AIFC" or b[8:12] == b"AIFF", "not AIFF"
    pos = 12
    rate = None
    bits = None
    frames = None
    while pos + 8 <= len(b):
        cid = b[pos:pos + 4]
        size = struct.unpack(">I", b[pos + 4:pos + 8])[0]
        body = b[pos + 8:pos + 8 + size]
        if cid == b"COMM":
            frames = struct.unpack(">I", body[2:6])[0]
            bits = struct.unpack(">h", body[6:8])[0]
            exp = struct.unpack(">h", body[8:10])[0]
            mant = struct.unpack(">Q", body[10:18])[0]
            rate = mant * 2.0 ** (exp - 16383 - 63)
        elif cid == b"SSND":
            offset = struct.unpack(">I", body[0:4])[0]
            data = body[8 + offset:]
            break
        pos += 8 + size + (size & 1)
    n = len(data) // 2
    samples = struct.unpack(">%dh" % n, data[:2 * n])
    # stereo interleave -> take left channel
    mono = samples[0::2]
    return rate, bits, mono


def rms_db(seg):
    if not seg:
        return -144.0
    acc = sum(v * v for v in seg) / len(seg)
    if acc <= 0:
        return -144.0
    return 10 * math.log10(acc / (32768 ** 2))


def main(run1, run2):
    r1, b1, m1 = read_aiff(run1)
    print(f"run1: rate={r1} bits={b1} samples={len(m1)} ({len(m1)/r1:.2f}s)")
    steps = [(-30, 0.25), (-24, 0.75), (-18, 1.25), (-12, 1.75),
             (-6, 2.25), (-3, 2.75), (0, 3.25)]
    print("\ngain map (segment mid 0.3s window, sine PEAK dB -> RMS):")
    print("  in_peak  in_rms   out_rms   gain_reduction")
    for db, t0 in steps:
        s = int((t0 + 0.1) * r1)
        e = int((t0 + 0.4) * r1)
        o = rms_db(m1[s:e])
        irms = db - 3.01
        print(f"  {db:7d}  {irms:7.2f}  {o:8.2f}  {o - irms:9.2f}")
    tail = int(4.3 * r1)
    print(f"  release tail (4.3-5.3s): {rms_db(m1[tail:tail + int(r1)]):.2f} dBFS")
    if run2:
        r2, b2, m2 = read_aiff(run2)
        n = min(len(m1), len(m2))
        diffs = [abs(m1[i] - m2[i]) for i in range(n)]
        mx = max(diffs)
        over1 = sum(1 for d in diffs if d > 1) / n
        over8 = sum(1 for d in diffs if d > 8) / n
        print(f"\ndeterminism: max|delta|={mx} LSB16; >1LSB: {over1:.4%}; "
              f">8LSB: {over8:.5%}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
