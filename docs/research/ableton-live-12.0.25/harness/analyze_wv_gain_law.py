#!/usr/bin/env python3
"""Unison per-voice gain law, all readings on one footing (2026-10-09).

The VC ladder section left the per-voice gain OPEN: short-note reads gave
outer-vs-solo 0.0 / -1.8 / -3.0 dB at N=2/3/4 (fits g=sqrt(2/N)), while
WV19's long-note read reported -2.35 dB at N=3 -- but that number was the
centre-to-outer ratio WITHIN WV19 (analyze_wv19_unison_long.py line
"outer-centre"), a different quantity read at a different envelope phase.
This analyzer re-derives every voice's gain against the M2 mode-0 solo h1
in the SAME channel, and adds for WV19 a window matched to M2's note-life
phase ([0.15, 0.85] s of a note that starts at t=0) beside its long steady
window [1.0, 3.9] -- if both agree, sustain is flat and window choice is
immaterial; if they disagree the envelope phase was the confound.

Pan deal (proven in the VC ladder stereo re-read): voices dealt alternately
hard-L/hard-R by ascending detune, odd N's middle voice centre
(bit-identical L/R). Per-channel voice counts are therefore
  N=2: 1/ch   N=3: 2/ch (hard + centre)   N=4: 2/ch
and the channel-unity hypothesis follows: hard voices g=sqrt(2/N),
centre g=1/sqrt(N)  ->  channel power = 1 for every N
(N=3: 2/3 + 1/3; N=4: 1/2 + 1/2; N=2: 1). The equal-voice alternative
(every voice sqrt(2/N)) sums to 4/3 per channel at N=3 (+1.25 dB).

Reads: per channel, refine_db (Hann, grid+parabolic, reused from
analyze_wv_vc_stereo) at each expected line, plus a peaks() scan to catch
any unmodeled line above -50 dBFS.
"""
import math
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_wv_vc_stereo import (ARCH, F0, R, read_stereo, refine_db,
                                  windowed_from, lines_in, fmt)

CENTS = {
    "M2 (mode0)":  [(0.0, "solo")],
    "WV12 (VC2)":  [(-50.0, "hardL"), (+50.0, "hardR")],
    "WV9B (VC3)":  [(-50.0, "hardL"), (0.0, "centre"), (+50.0, "hardR")],
    "WV13 (VC4)":  [(-50.0, "hardL"), (-50.0/3.0, "hardR"),
                    (+50.0/3.0, "hardL"), (+50.0, "hardR")],
    "WV19 (VC3 long)": [(-50.0, "hardL"), (0.0, "centre"), (+50.0, "hardR")],
}
PATHS = {
    "M2 (mode0)": R + "M2_WAVETABLE.aif",
    "WV12 (VC2)": ARCH + "WV12_UNI_M1_VC2.aif",
    "WV9B (VC3)": ARCH + "WV9B_UNIM1.aif",
    "WV13 (VC4)": ARCH + "WV13_UNI_M1_VC4.aif",
    "WV19 (VC3 long)": R + "WV19_LONG_UNI.aif",
}
# (tag, [(t0, t1) per note]) -- short renders: notes at 0/1/2/3 s;
# WV19: one 4 s note at t=0.
SHORT_WINDOWS = [(k, k + 0.15, k + 0.85) for k in range(4)]
LONG_WINDOWS = [("phase", 0.15, 0.85), ("steady", 1.0, 3.9)]


def read_line(seg, norm, rate, cents):
    """refined (freq, dB) at the expected detune; assumes line present."""
    return refine_db(seg, norm, rate, F0 * 2.0 ** (cents / 1200.0))


def main():
    data = {}
    for name, path in PATHS.items():
        rate, bits, L, Rch = data[name] = read_stereo(path)
        print(f"== {name}  rate {rate} bits {bits} frames {len(L)}")

    # M2 reference stability: solo h1 in L and R across its four notes.
    print("\n-- M2 reference h1 (dBFS) per note window, L / R --")
    m2 = {}
    rate = data["M2 (mode0)"][0]
    for k, t0, t1 in SHORT_WINDOWS:
        s, e = int(t0 * rate), int(t1 * rate)
        row = []
        for cn, ch in (("L", data["M2 (mode0)"][2]), ("R", data["M2 (mode0)"][3])):
            seg, norm = windowed_from(ch[s:e], rate)
            f, d = read_line(seg, norm, rate, 0.0)
            m2[(k, cn)] = d
            row.append(f"{cn} {d:6.2f} ({f - F0:+.2f}Hz)")
        print(f"  note {k}: " + "  ".join(row))

    print("\n-- per-voice gain vs M2 solo h1, same channel --")
    print("   (dB; g = voice_dBFS - M2_dBFS in that channel; "
          "L/R shown, phase-tagged for WV19)")
    gains = {}  # (name, tag, kind, channel) -> [g dB]
    for name in ("WV12 (VC2)", "WV9B (VC3)", "WV13 (VC4)"):
        rate, _, L, Rch = data[name]
        for k, t0, t1 in SHORT_WINDOWS:
            s, e = int(t0 * rate), int(t1 * rate)
            for cn, ch in (("L", L), ("R", Rch)):
                seg, norm = windowed_from(ch[s:e], rate)
                for cents, kind in CENTS[name]:
                    if (cn == "L" and "hardR" in kind) or (cn == "R" and "hardL" in kind):
                        continue  # absent by the hard-pan deal
                    f, d = read_line(seg, norm, rate, cents)
                    g = d - m2[(k, cn)]
                    gains.setdefault((name, "", kind, cn, cents), []).append(g)
                    print(f"  {name:<16} note {k} {cn} {kind:<6} "
                          f"{cents:+6.1f}c  {d:7.2f} dBFS  g {g:+5.2f} dB")
                # unmodeled-line guard
                extra = [ln for ln in lines_in(seg, norm, rate)
                         if all(abs(ln[0] - c * F0 * math.log(2) / 1200.0) > 1.0
                                for c, _ in CENTS[name]) and ln[2] > -50.0]
                if extra:
                    print(f"    !! unmodeled lines {cn} note {k}: {fmt(extra)}")

    for tag, t0, t1 in LONG_WINDOWS:
        rate, _, L, Rch = data["WV19 (VC3 long)"]
        s, e = int(t0 * rate), int(t1 * rate)
        for cn, ch in (("L", L), ("R", Rch)):
            seg, norm = windowed_from(ch[s:e], rate)
            for cents, kind in CENTS["WV19 (VC3 long)"]:
                if (cn == "L" and "hardR" in kind) or (cn == "R" and "hardL" in kind):
                    continue
                f, d = read_line(seg, norm, rate, cents)
                # M2 reference for this window: same-length solo comparison is
                # impossible (M2 notes change every 1 s) -- use the M2 note
                # mean (notes agree within dither; printed above) and say so.
                ref = sum(m2[(k, cn)] for k in range(4)) / 4.0
                g = d - ref
                gains.setdefault(("WV19 (VC3 long)", tag, kind, cn, cents), []).append(g)
                print(f"  WV19[{tag:>6}]      --    {cn} {kind:<6} "
                      f"{cents:+6.1f}c  {d:7.2f} dBFS  g {g:+5.2f} dB (vs M2 mean)")

    def mean(v):
        return sum(v) / len(v)

    def law_row(label, entries, n, centre=False):
        m = mean(entries)
        pred = 20 * math.log10((1 / math.sqrt(n)) if centre else math.sqrt(2 / n))
        return (f"{label:<24}{m:+6.2f}  (sp {max(entries) - min(entries):.2f})"
                f"{pred:+7.2f}{m - pred:+7.2f}")

    print("\n-- law table: measured vs sqrt(2/N) hard / 1/sqrt(N) centre --")
    print(f"{'quantity':<24}{'meas dB':<16}{'pred':>7}{'resid':>7}")
    for label, key, n, centre in (
            ("N=2 hard", ("WV12 (VC2)", "", "hardL", "L", -50.0), 2, False),
            ("N=3 hard (L)", ("WV9B (VC3)", "", "hardL", "L", -50.0), 3, False),
            ("N=3 hard (R)", ("WV9B (VC3)", "", "hardR", "R", +50.0), 3, False),
            ("N=3 centre (L)", ("WV9B (VC3)", "", "centre", "L", 0.0), 3, True),
            ("N=3 centre (R)", ("WV9B (VC3)", "", "centre", "R", 0.0), 3, True),
            ("N=4 hard (L)", ("WV13 (VC4)", "", "hardL", "L", -50.0), 4, False),
            ("N=4 hard (R)", ("WV13 (VC4)", "", "hardR", "R", +50.0), 4, False)):
        print(law_row(label, gains[key], n, centre))
    for tag in ("phase", "steady"):
        for kind, cn, cents_key, n, centre in (
                ("hardL", "L", -50.0, 3, False), ("hardR", "R", +50.0, 3, False),
                ("centre", "L", 0.0, 3, True), ("centre", "R", 0.0, 3, True)):
            print(law_row(f"WV19[{tag}] {kind} {cn}",
                          gains[("WV19 (VC3 long)", tag, kind, cn, cents_key)], n, centre))

    print("\n-- per-channel power sum vs solo (dB): unity per channel is the law's claim --")
    for name in ("WV12 (VC2)", "WV9B (VC3)", "WV13 (VC4)"):
        for cn in ("L", "R"):
            ks = [k for k in gains if k[0] == name and k[3] == cn]
            p = sum(10 ** (mean(gains[k]) / 10) for k in ks)
            print(f"  {name:<16} {cn}: {len(ks)} voice(s)/ch -> {10 * math.log10(p):+5.2f} dB")
    for tag in ("phase", "steady"):
        for cn in ("L", "R"):
            ks = [k for k in gains if k[0] == "WV19 (VC3 long)" and k[1] == tag and k[3] == cn]
            p = sum(10 ** (mean(gains[k]) / 10) for k in ks)
            print(f"  WV19[{tag:<6}]     {cn}: {len(ks)} voice(s)/ch -> {10 * math.log10(p):+5.2f} dB")


if __name__ == "__main__":
    main()
