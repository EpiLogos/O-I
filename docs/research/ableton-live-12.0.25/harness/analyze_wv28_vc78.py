#!/usr/bin/env python3
"""WV28/29 stereo read: VoiceCount 7/8 — top of the N-extension.

Same method as analyze_wv25_vc_ext.py (imported machinery from
analyze_wv_vc_stereo.py): per-channel Hann-weighted fine Goertzel around h1,
whole steady windows, grid + parabolic refinement. Renders are in
harness/renders/ (WV28/29 are this lane's renders; M2_WAVETABLE is the
mode-0 solo floor reference).

Windows: note-1 body [1.15, 1.85] and the highest-resolution note-3+tail
[3.15, 4.35]. Per-voice gain = level(render, window, own channel) minus
level(M2, same window).

Questions answered per N:
  spread    line offsets in cents vs the +-50*(2k/(N-1)-1) ladder
            N=7 -> {-50,-33.3,-16.7,0,+16.7,+33.3,+50}; N=8 -> +-50..+-7.1
  pan       which channel holds each voice (alternating hard deal?)
  gain      per-voice delta vs M2 solo, vs the sqrt(2/N) candidate
"""
import math
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_wv_vc_stereo import read_stereo, lines_in, windowed_from, rms_db, R

RENDERS = [("M2 (mode0)", R + "M2_WAVETABLE.aif"),
           ("WV28 (VC7)", R + "WV28_VC7.aif"),
           ("WV29 (VC8)", R + "WV29_VC8.aif")]

WINDOWS = [("1", 1.15, 1.85), ("3+tail", 3.15, 4.35)]


def fmt(lines):
    return "  ".join(f"{c:+6.1f}c/{d:6.1f}" for _, c, d in lines) or "(none)"


def main():
    data = {}
    for name, path in RENDERS:
        rate, bits, L, Rch = read_stereo(path)
        data[name] = (rate, L, Rch)

    # reference levels per window (M2, left channel)
    ref = {}
    rate0, L0, _ = data["M2 (mode0)"]
    for tag, t0, t1 in WINDOWS:
        s, e = int(t0 * rate0), int(t1 * rate0)
        seg, norm = windowed_from(L0[s:e], rate0)
        ls = lines_in(seg, norm, rate0)
        ref[tag] = max(d for _, _, d in ls)
        print(f"M2 ref note {tag}: {fmt(ls)}  -> solo h1 {ref[tag]:.2f} dBFS")

    for name, _ in RENDERS[1:]:
        rate, L, Rch = data[name]
        print(f"\n== {name}")
        for tag, t0, t1 in WINDOWS:
            s, e = int(t0 * rate), int(t1 * rate)
            for cn, ch in (("L", L), ("R", Rch)):
                seg, norm = windowed_from(ch[s:e], rate)
                ls = lines_in(seg, norm, rate)
                # per-voice gain delta vs the M2 solo in the same window
                deltas = [f"{d - ref[tag]:+5.2f}" for _, _, d in ls]
                print(f"  note {tag!s:>7} {cn} RMS {rms_db(ch[s:e]):6.2f} | {fmt(ls)}")
                print(f"      {'':>14} dVSsolo | " + "  ".join(deltas))


if __name__ == "__main__":
    main()
