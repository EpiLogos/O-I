#!/usr/bin/env python3
"""Reverb refinements (2026-10-09 offline lane): HF second slope + stereo.

(a) `decay <render.aif>` — band-decay decomposition on the MONO mixdown:
    10 log bands 80 Hz-16 kHz, 10 ms Hann-441/FFT-512 blocks (same method
    as analyze_reverb_bands.py), per-band floor-aware SINGLE fit vs a
    scanned TWO-SEGMENT fit (breakpoint scan on the 10 ms grid, >=0.08 s
    per segment, min SSE). Fit starts 50 ms after the band envelope peak
    so the diffuse build-up is excluded per band. Reports onset time and
    both slopes for any resolvable second slope.

(b) `stereo <render.aif>` — inter-channel decorrelation per band on the
    impulse tail: block cross-spectra X_L(f)·conj(X_R(f)) accumulated over
    each window; lag-0 band correlation r0 = Re(C)/sqrt(P_L·P_R)
    (Parseval-exact for the windowed band signal), plus coherence
    |C|/sqrt(P_L·P_R) and L/R level difference. Windows: early taps,
    early tail, late tail. Blocks within floor+6 dB are excluded
    (16-bit dither is inter-channel independent and would bias r0 down).
    Also: broadband time-domain lag scan around 0.

Reads only the first HEAD_S seconds (renders are 256 s; fits need
0-2.5 s tail + the 4.5-6.0 s floor region).
"""
import math
import struct
import sys

from analyze_reverb_bands import fft, db, mono, median, band_blocks

HEAD_S = 7.0
EDGES = [80.0, 160.0, 315.0, 630.0, 900.0, 1250.0, 2500.0, 4500.0,
         8000.0, 12000.0, 16000.0]


def read_aiff_head(path, seconds):
    """Stereo AIFF reader, first `seconds` only (same chunk walk as
    analyze_reverb_bands.read_aiff_stereo, bounded SSND unpack)."""
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
    n = min(len(data) // 2, int(seconds * rate) * 2)
    s = struct.unpack(">%dh" % n, data[:2 * n])
    return rate, s[0::2], s[1::2]


def fit_pts(pts):
    n = len(pts)
    sx = sum(t for t, _ in pts)
    sy = sum(d for _, d in pts)
    sxx = sum(t * t for t, _ in pts)
    sxy = sum(t * d for t, d in pts)
    den = n * sxx - sx * sx
    if den == 0:
        return None
    slope = (n * sxy - sx * sy) / den
    icpt = (sy - slope * sx) / n
    sse = sum((d - (slope * t + icpt)) ** 2 for t, d in pts)
    return slope, icpt, sse


def rt60(slope):
    return -60.0 / slope if slope < 0 else float("nan")


def two_seg(pts, min_seg=0.08, min_pts=8):
    """Scan breakpoint on the block grid; return (single, best) where
    best = (sse, tb, fitA, fitB) or None if unresolvable."""
    single = fit_pts(pts)
    if single is None or len(pts) < 2 * min_pts:
        return single, None
    best = None
    for i in range(min_pts, len(pts) - min_pts + 1):
        tb = pts[i - 1][0]
        fa = fit_pts(pts[:i])
        fb = fit_pts(pts[i:])
        if fa is None or fb is None:
            continue
        sse = fa[2] + fb[2]
        if best is None or sse < best[0]:
            best = (sse, tb, fa, fb)
    return single, best


def smooth(blocks, k=7):
    """70 ms moving mean (same as the verify gate) for narrow-band noise."""
    out = []
    h = k // 2
    for i in range(len(blocks)):
        a = max(0, i - h)
        b = min(len(blocks), i + h + 1)
        out.append((blocks[i][0],
                    sum(d for _, d in blocks[a:b]) / (b - a)))
    return out


def decay(path):
    rate, L, R = read_aiff_head(path, HEAD_S)
    x = mono(L, R)
    print(f"== decay decomposition: {path} (rate {rate:.0f}, "
          f"first {HEAD_S:.0f} s, mono mixdown)")
    print("bands 80 Hz-16 kHz log, 10 ms blocks + 70 ms moving mean (gate "
          "method), floor = median 4.5-6.0 s, fit from band-peak + 50 ms,")
    print("floor+3 dB exclusion; 2-seg = scanned breakpoint (>=0.08 s/seg);")
    print("class: floor-approach = late segment ends within 6 dB of floor.")
    hdr = (f"{'band Hz':>14} | {'single dB/s':>11} {'RT60':>6} | "
           f"{'2seg onset':>10} {'s1 dB/s':>8} {'s2 dB/s':>8} "
           f"{'RT60a':>6} {'RT60b':>6} | {'class':>14}")
    print(hdr)
    blocks_all = band_blocks(x, rate, EDGES)
    for lo, hi, blocks in zip(EDGES[:-1], EDGES[1:], blocks_all):
        fl = median([d for t, d in blocks if 4.5 <= t <= 6.0])
        sm = smooth(blocks)
        pts = sorted((t, d) for t, d in sm if d > fl + 3.0)
        if len(pts) < 16:
            print(f"{lo:6.0f}-{hi:6.0f} | floor-limited "
                  f"(floor {fl:.1f}, {len(pts)} blocks above)")
            continue
        pk = max(pts, key=lambda p: p[1])[0]
        t0 = pk + 0.05
        fpts = [p for p in pts if p[0] >= t0]
        if len(fpts) < 16:
            print(f"{lo:6.0f}-{hi:6.0f} | too few fit blocks "
                  f"(floor {fl:.1f})")
            continue
        single, best = two_seg(fpts)
        s = single
        line = (f"{lo:6.0f}-{hi:6.0f} | {s[0]:11.1f} {rt60(s[0]):6.2f} | ")
        cls = "-"
        show = None
        if best:
            sse, tb, fa, fb = best
            base = s[2] / len(fpts)
            gain = 1.0 - (sse / len(fpts)) / base
            s1, s2 = fa[0], fb[0]
            if gain > 0.20 and abs(s1 - s2) > 0.15 * max(abs(s1), abs(s2)):
                late_pts = [p for p in fpts if p[0] > tb]
                late_mean = sum(d for _, d in late_pts) / len(late_pts)
                if late_mean < fl + 6.0:
                    cls = "floor-approach"
                else:
                    cls = "2nd slope"
                    show = (tb, s1, s2)
        if show:
            tb, s1, s2 = show
            line += (f"{tb:10.2f} {s1:8.1f} {s2:8.1f} "
                     f"{rt60(s1):6.2f} {rt60(s2):6.2f} | {cls:>14}")
        else:
            line += f"{'-':>10} {'-':>8} {'-':>8} {'-':>6} {'-':>6} | {cls:>14}"
        print(line)
    print()


def stereo(path):
    rate, L, R = read_aiff_head(path, HEAD_S)
    w = int(0.010 * rate)
    N = 512
    win = [0.5 - 0.5 * math.cos(2 * math.pi * i / w) for i in range(w)]
    bins = [[k for k in range(N // 2) if lo <= k * rate / N < hi]
            for lo, hi in zip(EDGES[:-1], EDGES[1:])]
    WINDOWS = [("taps", 0.012, 0.050), ("early", 0.080, 0.300),
               ("late", 0.300, 0.600)]
    # taps window starts at 12 ms: block 0 (0-10 ms) holds the mono direct
    # (sample 92 = 2.1 ms) which would dominate the correlation
    print(f"== stereo decorrelation: {path} (rate {rate:.0f})")
    print("lag-0 band correlation r0 = Re(sum X_L conj X_R)/sqrt(P_L P_R)")
    print("over 10 ms Hann blocks; blocks <= floor+6 dB excluded (dither).")
    # floors per band from the mono mixdown floor region
    x = mono(L, R)
    floors = []
    for blocks in band_blocks(x, rate, EDGES):
        floors.append(median([d for t, d in blocks if 4.5 <= t <= 6.0]))
    acc = {nm: [[0.0, 0.0, 0.0 + 0j, 0] for _ in bins] for nm, _, _ in WINDOWS}
    for k in range(int(HEAD_S / 0.010)):
        t = k * 0.010 + 0.005
        seg = next((nm for nm, t0, t1 in WINDOWS if t0 <= t < t1), None)
        if seg is None:
            continue
        a = int(k * 0.010 * rate)
        rl = [0.0] * N
        il = [0.0] * N
        rr = [0.0] * N
        ir = [0.0] * N
        for i in range(w):
            v = L[a + i] / 32768.0
            u = R[a + i] / 32768.0
            wl = win[i]
            rl[i] = v * wl
            rr[i] = u * wl
        fft(rl, il)
        fft(rr, ir)
        cell = acc[seg]
        for bi, ks in enumerate(bins):
            lim = 10 ** ((floors[bi] + 6.0) / 10.0)
            pl = pr = 0.0
            cr = 0.0 + 0.0j
            for kk in ks:
                xr, xi = rl[kk], il[kk]
                yr, yi = rr[kk], ir[kk]
                pl += xr * xr + xi * xi
                pr += yr * yr + yi * yi
                cr += (xr * yr + xi * yi) + 1j * (xi * yr - xr * yi)
            c = cell[bi]
            if pl > lim or pr > lim:
                c[0] += pl
                c[1] += pr
                c[2] += cr
                c[3] += 1
    print(f"{'band Hz':>14} | " +
          " | ".join(f"{nm:>22}" for nm, _, _ in WINDOWS) +
          "  (r0 / coh / dL L-R dB / nblk)")
    for bi, (lo, hi) in enumerate(zip(EDGES[:-1], EDGES[1:])):
        row = f"{lo:6.0f}-{hi:6.0f} | "
        parts = []
        for nm, _, _ in WINDOWS:
            pl, pr, cr, n = acc[nm][bi]
            if n == 0 or pl == 0 or pr == 0:
                parts.append(f"{'-- floor':>22}")
                continue
            r0 = cr.real / math.sqrt(pl * pr)
            coh = abs(cr) / math.sqrt(pl * pr)
            dl = 10 * math.log10(pl / pr)
            parts.append(f"{r0:+.3f}/{coh:.3f}/{dl:+5.1f}/{n:3d}")
        row += " | ".join(f"{p:>22}" for p in parts)
        print(row)
    # broadband time-domain lag scan on the late window
    t0, t1 = 0.300, 0.600
    a0, a1 = int(t0 * rate), int(t1 * rate)
    ls = [v / 32768.0 for v in L[a0:a1]]
    rs = [v / 32768.0 for v in R[a0:a1]]
    e_l = sum(v * v for v in ls)
    e_r = sum(v * v for v in rs)
    print("broadband lag scan, 0.30-0.60 s (r vs lag, ms):")
    out = []
    for lag_ms in (-2.0, -1.0, -0.5, -0.2, 0.0, 0.2, 0.5, 1.0, 2.0):
        lg = int(round(lag_ms * rate / 1000.0))
        num = sum(ls[i] * rs[i + lg]
                  for i in range(0, len(ls) - abs(lg)))
        r = num / math.sqrt(e_l * e_r)
        out.append(f"{lag_ms:+.1f}:{r:+.3f}")
    print("  " + "  ".join(out))
    print()


def main():
    mode, path = sys.argv[1], sys.argv[2]
    if mode == "decay":
        decay(path)
    elif mode == "stereo":
        stereo(path)
    else:
        raise SystemExit("mode must be decay|stereo")


if __name__ == "__main__":
    main()
