#!/usr/bin/env python3
"""48-band profile of a render, replicating src/spectrum.rs::band_profile
(STFT 2048, 50% hop, mean band power dB, 20 Hz-20 kHz log-partitioned),
on the mono mixdown over a stated window, so the reverb rebuild's tail
band gains can be fitted before touching Rust."""
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
    x = [(l + r) / 2.0 / 32768.0 for l, r in zip(s[0::2], s[1::2])]
    return rate, x


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


def band_profile(x, rate, n_bands=48, dur=4.0):
    N = 2048
    f_lo, f_hi = 20.0, min(rate / 2.0, 20000.0)
    win = [0.5 - 0.5 * math.cos(2 * math.pi * i / N) for i in range(N)]
    acc = [0.0] * n_bands
    frames = 0.0
    pos = 0
    end = min(len(x), int(dur * rate))
    while pos + N <= end:
        re = [x[pos + i] * win[i] for i in range(N)]
        im = [0.0] * N
        fft(re, im)
        for k in range(N // 2):
            f = k * rate / N
            if f < f_lo or f > f_hi:
                continue
            band = int(math.log(f / f_lo) / math.log(f_hi / f_lo) * n_bands)
            band = min(band, n_bands - 1)
            acc[band] += re[k] ** 2 + im[k] ** 2
        frames += 1
        pos += N // 2
    return [10 * math.log10(p / frames) if p > 0 else -144.0 for p in acc]


def main():
    for path in sys.argv[1:]:
        rate, x = read_aiff_stereo(path)
        prof = band_profile(x, rate)
        print(f"== {path} rate={rate}")
        f_lo, f_hi = 20.0, min(rate / 2.0, 20000.0)
        for i, d in enumerate(prof):
            fc = f_lo * (f_hi / f_lo) ** ((i + 0.5) / len(prof))
            print(f"  band {i:2d} {fc:8.1f} Hz  {d:7.2f} dB")


if __name__ == "__main__":
    main()
