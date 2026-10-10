#!/usr/bin/env python3
"""WV12/WV13 stereo re-read: the VC2/VC4 unison ladder, BOTH channels.

The D15 ladder (2026-10-08) analyzed the LEFT channel only; rev 4's WV19
long-note re-probe proved unison is a STEREO spread (hard-L/centre/hard-R,
equal-power). This analyzer re-reads the archived short-note renders
per channel to settle the VC2 and VC4 layouts:

  WV12_UNI_M1_VC2.aif   Mode 1, Amount 1.0, VoiceCount 2   (archive)
  WV13_UNI_M1_VC4.aif   Mode 1, Amount 1.0, VoiceCount 4   (archive)
  WV9B_UNIM1.aif        Mode 1, Amount 1.0, VoiceCount 3   (sanity anchor)
  M2_WAVETABLE.aif      Mode 0                             (floor reference)

Method: clip model as analyze_wavetable.py — notes at 0/1/2/3 s, each
sounds 0.875 s; whole steady window per note [k+0.15, k+0.85] (note 3 also
with its unmasked release tail, the longest clean window). Fine Goertzel
scan around h1 per channel (Hann-weighted — the D15 rect-window sidelobes
are what fabricated the "-0.50 Hz weak line"), 0.005 Hz refinement,
local-peak picking (peaks() semantics from analyze_wv_unison.py).

VC4 inner-voice separation: the two inner voices are 2.50 Hz apart, below
the note-body window's resolution, so two pan-null combination channels
are also scanned on note 3 — C_killLow = 0.5·L − (√3/2)·R nulls the pan
−1/3 voice, C_killHigh = (√3/2)·L − 0.5·R nulls the pan +1/3 voice, under
the equal-power hypothesis pan = 2k/(N−1) − 1.
"""
import math
import struct
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_render import rms_db
from analyze_wavetable import C3

ARCH = "/Users/admin/tools/live-re/archive-20261007/renders-final/"
R = __file__.rsplit("/", 1)[0] + "/renders/"

F0 = C3  # 130.81278265 Hz, key 48
S = math.sqrt(3.0) / 2.0  # equal-power gain at pan ±1/3

RENDERS = [("M2 (mode0)", R + "M2_WAVETABLE.aif"),
           ("WV9B (VC3)", ARCH + "WV9B_UNIM1.aif"),
           ("WV12 (VC2)", ARCH + "WV12_UNI_M1_VC2.aif"),
           ("WV13 (VC4)", ARCH + "WV13_UNI_M1_VC4.aif")]


def read_stereo(path):
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


def amp(seg, norm, rate, f):
    """Goertzel amplitude of pre-windowed seg, full-scale = 32768."""
    n = len(seg)
    w = 2.0 * math.pi * f / rate
    coeff = 2.0 * math.cos(w)
    q1 = q2 = 0.0
    for v in seg:
        q0 = coeff * q1 - q2 + v
        q2, q1 = q1, q0
    return math.sqrt(max(q1 * q1 + q2 * q2 - coeff * q1 * q2, 0.0)) * 2.0 / n * norm


def scan_db(seg, norm, rate, fc, span, step=0.2, t_ref=None):
    out = []
    fr = fc - span
    while fr <= fc + span:
        a = amp(seg, norm, rate, fr)
        out.append((fr, 20 * math.log10(a / 32768.0) if a > 0 else -144.0))
        fr += step
    return out


def refine_db(seg, norm, rate, f0hz, step=0.01, half=0.3):
    """grid + parabolic peak around f0hz; returns (freq, dB)."""
    best = (None, -1e9)
    fr = f0hz - half
    while fr <= f0hz + half:
        a = amp(seg, norm, rate, fr)
        d = 20 * math.log10(a / 32768.0) if a > 0 else -144.0
        if d > best[1]:
            best = (fr, d)
        fr += step
    f1, f2, f3 = best[0] - step, best[0], best[0] + step
    y = []
    for f in (f1, f2, f3):
        a = amp(seg, norm, rate, f)
        y.append(20 * math.log10(a / 32768.0) if a > 0 else -144.0)
    denom = y[0] - 2 * y[1] + y[2]
    delta = 0.5 * (y[0] - y[2]) / denom if denom != 0 else 0.0
    return best[0] + delta * step, best[1]


def peaks(sc, floor_db=-100.0, rel=35.0, merge=1.2):
    """local maxima above max(floor, scanmax - rel); merged < merge Hz apart."""
    mx = max(d for _, d in sc)
    thr = max(floor_db, mx - rel)
    out = []
    for i in range(1, len(sc) - 1):
        fr, db = sc[i]
        if db >= thr and db >= sc[i - 1][1] and db >= sc[i + 1][1]:
            if out and fr - out[-1][0] < merge:
                if db > out[-1][1]:
                    out[-1] = (fr, db)
            else:
                out.append((fr, db))
    return out


def lines_in(seg, norm, rate, span=8.0, step=0.2):
    """resolved h1 lines around F0: [(offset Hz, cents, dBFS)]."""
    sc = scan_db(seg, norm, rate, F0, span, step)
    out = []
    for fr, _ in peaks(sc):
        f, d = refine_db(seg, norm, rate, fr)
        out.append((f - F0, 1200 * math.log2(f / F0), d))
    return out


def fmt(lines):
    return "  ".join(f"{o:+6.2f}Hz/{c:+6.1f}c/{d:6.1f}" for o, c, d in lines) or "(none)"


def main():
    # --- note-layout check on WV12 (L channel): 0.25 s RMS staircase
    rate0, _, L0, _ = read_stereo(RENDERS[2][1])
    print("note-layout check WV12 L, 0.25 s RMS dBFS:")
    t, row = 0.0, []
    while t < 5.5:
        s, e = int(t * rate0), int(min((t + 0.25), len(L0) / rate0) * rate0)
        row.append(f"{t:.2f}:{rms_db(L0[s:e]):.0f}")
        t += 0.25
    print("  " + "  ".join(row))

    # note windows: whole steady window per note (body), note 3 body+release
    windows = [(0, 0.15, 0.85), (1, 1.15, 1.85), (2, 2.15, 2.85),
               (3, 3.15, 3.85), ("3+tail", 3.15, 4.35)]

    for name, path in RENDERS:
        rate, bits, L, Rch = read_stereo(path)
        print(f"\n== {name}  ({path.rsplit('/', 1)[1]}) rate {rate}")
        for tag, t0, t1 in windows:
            s, e = int(t0 * rate), int(t1 * rate)
            if e > len(L):
                continue
            chans = [("L", L[s:e]), ("R", Rch[s:e])]
            if name.startswith("WV13") and tag == "3+tail":
                chans.append(("kLo", [0.5 * a - S * b for a, b in zip(L[s:e], Rch[s:e])]))
                chans.append(("kHi", [S * a - 0.5 * b for a, b in zip(L[s:e], Rch[s:e])]))
            for cn, seg_raw in chans:
                seg, norm = windowed_from(seg_raw, rate)
                ls = lines_in(seg, norm, rate)
                rr = rms_db(seg_raw)
                print(f"  note {tag!s:>7} {cn:>2} RMS {rr:6.2f} | {fmt(ls)}")


def windowed_from(seg_raw, rate):
    """Hann-weight a raw segment list; returns (seg, n/sw)."""
    n = len(seg_raw)
    wstep = 2.0 * math.pi / (n - 1)
    seg = [v * (0.5 - 0.5 * math.cos(i * wstep)) for i, v in enumerate(seg_raw)]
    sw = sum(0.5 - 0.5 * math.cos(i * wstep) for i in range(n))
    return seg, n / sw


if __name__ == "__main__":
    main()
