#!/usr/bin/env python3
"""WV19_LONG_UNI: long-note unison re-probe (D15 open item, 2026-10-09).

The set is WV9B_UNIM1 (Mode 1, VoiceCount 3, Amount 1.0) with ONE note of
8 beats (tempo 120 -> 4.0 s), transport loop 18 beats (render 9.0 s).

The D15 ladder analyzed 0.45 s windows (2.2 Hz resolution) of the LEFT
channel only — the three predicted voices {−50, 0, +50} cents sat at the
edge of resolution and the "+voice" read weak/absent. Here the steady
window [1.0, 3.9] s (2.9 s -> ~0.35 Hz) is scanned per channel with a
Hann-weighted DTFT, lines refined on a 0.005 Hz grid, and the beat pattern
tracked with short windows.

STEREO matters: read_aiff returns the left channel only; this analyzer
reads both (read_aiff_stereo below).
"""
import math
import struct
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_render import rms_db

R = __file__.rsplit("/", 1)[0] + "/renders/"

F0 = 130.81278265           # C3, key 48
T0, T1 = 1.0, 3.9           # steady window inside the 4.0 s note


def read_aiff_stereo(path):
    """(rate, bits, left, right) from Live's 16-bit AIFF export."""
    b = open(path, "rb").read()
    assert b[:4] == b"FORM", "not AIFF"
    pos = 12
    rate = bits = None
    while pos + 8 <= len(b):
        cid = b[pos:pos + 4]
        size = struct.unpack(">I", b[pos + 4:pos + 8])[0]
        body = b[pos + 8:pos + 8 + size]
        if cid == b"COMM":
            bits = struct.unpack(">h", body[6:8])[0]
            exp = struct.unpack(">h", body[8:10])[0]
            mant = struct.unpack(">Q", body[10:18])[0]
            rate = mant * 2.0 ** (exp - 16383 - 63)
        elif cid == b"SSND":
            offset = struct.unpack(">I", body[0:4])[0]
            data = body[8 + offset:]
            break
        pos += 8 + size + (size & 1)
    n = len(data) // 4
    a = struct.unpack(">%dh" % (2 * n), data[:4 * n])
    return rate, bits, a[0::2], a[1::2]


def dtft(x, rate, f, t0, t1, hann=True):
    """Complex DTFT of x in [t0,t1] at freq f, Hann-weighted; returns (X, sum_w)."""
    s, e = int(t0 * rate), int(t1 * rate)
    n = e - s
    w = 2.0 * math.pi * f / rate
    wstep = 2.0 * math.pi / (n - 1)
    sw = 0.0
    re = im = 0.0
    for i in range(n):
        c = 0.5 - 0.5 * math.cos(i * wstep) if hann else 1.0
        sw += c
        ph = w * i
        v = x[s + i]
        re += c * v * math.cos(ph)
        im -= c * v * math.sin(ph)
    return complex(re, im), sw


def amp_db(x, rate, f, t0, t1, hann=True):
    X, sw = dtft(x, rate, f, t0, t1, hann)
    a = 2.0 * abs(X) / sw
    return 20.0 * math.log10(a / 32768.0) if a > 0 else -144.0


def refine(x, rate, f0hz, step=0.005, half=0.12, t0=T0, t1=T1):
    """grid + parabolic peak around f0hz; returns (freq, dB)."""
    best = (None, -1e9)
    fr = f0hz - half
    while fr <= f0hz + half:
        d = amp_db(x, rate, fr, t0, t1)
        if d > best[1]:
            best = (fr, d)
        fr += step
    f1, f2, f3 = best[0] - step, best[0], best[0] + step
    y1, y2, y3 = (amp_db(x, rate, f, t0, t1) for f in (f1, f2, f3))
    denom = (y1 - 2 * y2 + y3)
    delta = 0.5 * (y1 - y3) / denom if denom != 0 else 0.0
    return best[0] + delta * step, best[1]


def beat_scan(track_pts, fmax=14.0, step=0.02):
    """Goertzel scan of a (t, value) envelope; returns [(f, linear)] rel-scaled."""
    ts = [t for t, _ in track_pts]
    es = [v for _, v in track_pts]
    n = len(es)
    t0 = ts[0]
    mean = sum(es) / n
    es = [e - mean for e in es]
    out = []
    fb = step
    while fb <= fmax:
        w = 2.0 * math.pi * fb
        re = im = 0.0
        for k, e in enumerate(es):
            ph = w * (ts[k] - t0)
            re += e * math.cos(ph)
            im -= e * math.sin(ph)
        out.append((fb, 2.0 * math.hypot(re, im) / n))
        fb += step
    return out


def local_peaks(seq, rel_db=20.0):
    mx = max(v for _, v in seq)
    out = []
    for i in range(1, len(seq) - 1):
        fb, v = seq[i]
        if v >= mx * 10 ** (-rel_db / 20) and v >= seq[i - 1][1] and v >= seq[i + 1][1]:
            if out and fb - out[-1][0] < 0.35:
                if v > out[-1][1]:
                    out[-1] = (fb, v)
            else:
                out.append((fb, v))
    return out


def track_amp(x, rate, f, t0, t1, win=0.40, hop=0.05):
    """rect-window complex amplitude track; [(t_center, |X|*2/n)]."""
    pts = []
    t = t0
    while t + win <= t1:
        X, _ = dtft(x, rate, f, t, t + win, hann=False)
        pts.append((t + win / 2, 2.0 * abs(X) / win / rate))
        t += hop
    return pts


def _sinc(df, win):
    """normalized rect-window gain at offset df for window length win."""
    a = math.pi * df * win
    return abs(math.sin(a) / a) if a != 0 else 1.0


def main(path):
    rate, bits, L, Rch = read_aiff_stereo(path)
    print(f"== {path}  rate {rate}, {len(L)} frames ({len(L)/rate:.2f} s)")

    for nm, ch in (("L", L), ("R", Rch)):
        s, e = int(T0 * rate), int(T1 * rate)
        print(f"  {nm} steady RMS [{T0},{T1}]: {rms_db(ch[s:e]):.2f} dBFS")

    print("\nsteady check L (0.25 s RMS):")
    t, row = 0.0, []
    while t < 5.0:
        s, e = int(t * rate), int((t + 0.25) * rate)
        row.append(f"{t:.2f}:{rms_db(L[s:e]):.1f}")
        t += 0.25
    print("  " + "  ".join(row))

    print(f"\nline refinement [{T0},{T1}] s, 0.005 Hz grid + parabolic:")
    lines = {}
    for nm, ch, guess in (("L", L, F0 - 3.724), ("L", L, F0), ("R", Rch, F0 + 3.828)):
        f, d = refine(ch, rate, guess)
        key = f"{nm}:{(f - F0):+.2f}Hz"
        lines[key] = (f, d)
        print(f"  {nm} {f - F0:+8.3f} Hz ({1200 * math.log2(f / F0):+7.2f} cents)  {d:7.2f} dBFS")

    # opposite-channel leakage proof at each resolved line
    print("\nopposite-channel reading at each line (leakage proof):")
    for (f, _) in lines.values():
        dl = amp_db(L, rate, f, T0, T1)
        dr = amp_db(Rch, rate, f, T0, T1)
        own = "L" if dl >= dr else "R"
        other = dr if own == "L" else dl
        print(f"  {f - F0:+7.3f} Hz: owned by {own} ({max(dl, dr):7.2f} dBFS); "
              f"other channel {other:7.2f} dBFS")

    print("\nbeat tracking (0.40 s rect windows, hop 0.05, clean sustain [1.0,3.9]):")
    # Physically correct envelope: the complex track at the channel's OUTER
    # line — the centre voice leaks through the window skirt with a known
    # gain W(df), so |X(t)| = |A_out + A_ctr*W(df)*e^{i*df*t}| beats at
    # df = |f_outer - f_centre|. A sum of per-line magnitudes has no cross
    # term and cannot show beats.
    for nm, ch in (("L", L), ("R", Rch)):
        outs = [(f, d) for f, d in lines.values()
                if abs(f - F0) > 1 and ((amp_db(ch, rate, f, T0, T1)) > -60)]
        if not outs:
            continue
        f_out = outs[0][0]
        ctr = [f for f, d in lines.values() if abs(f - F0) <= 1][0]
        df = abs(f_out - ctr)
        pts = track_amp(ch, rate, f_out, 1.00, 3.90)
        bs = beat_scan(pts)
        pks = local_peaks(bs)
        mxv = max(v for _, v in bs)
        fmt = ", ".join(f"{fb:.2f}Hz({20 * math.log10(v / mxv):.1f}dB)" for fb, v in pks[:6])
        depth = 20 * math.log10(min(v for _, v in pts) / max(v for _, v in pts))
        w = 0.7071 * abs(_sinc(df, 0.40))
        print(f"  {nm}: track at outer line {f_out - F0:+.3f} Hz -> beats: {fmt}")
        print(f"    envelope depth {depth:.1f} dB; window-skirt coupling W({df:.2f}Hz)="
              f"{abs(_sinc(df, 0.40)):.3f} -> predicted beat depth "
              f"{20 * math.log10((1 + w) / (1 - w)):.1f} dB")
    fl = sorted(f for f, _ in lines.values())
    print(f"\n  predicted beat rates: L {abs(fl[1] - fl[0]):.3f} Hz, "
          f"R {abs(fl[2] - fl[1]):.3f} Hz (outer-outer {abs(fl[2] - fl[0]):.3f} Hz never "
          f"co-channel, absent by construction)")

    print("\namplitude law read-out (per channel):")
    low = dict((f"{f - F0:+.2f}", d) for f, d in lines.values())
    outs = [(f, d) for f, d in lines.values() if abs(f - F0) > 1]
    cents_ = [1200 * math.log2(abs(f / F0)) for f, _ in outs]
    print(f"  outer voices: {20 * math.log10(10 ** (outs[0][1] / 20)):.2f} / "
          f"{outs[-1][1]:.2f} dBFS (cents {cents_[0]:+.2f} / {cents_[-1]:+.2f})")
    ctr = [(f, d) for f, d in lines.values() if abs(f - F0) <= 1]
    print(f"  centre voice: {ctr[0][1]:.2f} dBFS both channels; "
          f"outer-centre {ctr[0][1] - outs[0][1]:.2f} dB "
          f"(equal-power pan predicts 3.01)")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else R + "WV19_LONG_UNI.aif")
