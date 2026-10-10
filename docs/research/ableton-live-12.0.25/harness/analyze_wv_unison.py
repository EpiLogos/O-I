#!/usr/bin/env python3
"""WV10/WV11: Wavetable unison topology — sideband count/spacing vs Amount.

Renders (M2 notes clip, Mode=1, VoiceCount=3; frame A = pure sine at f0):
  M2_WAVETABLE      Mode 0 (unison off)  — floor reference
  WV9B_UNIM1        Mode 1, Amount 1.0   — the known h1 split (-3.8 Hz lobe)
  WV10_UNI_M1_A2    Mode 1, Amount 2
  WV11_UNI_M1_A4    Mode 1, Amount 4

Method: note-1 steady window, fine Goertzel amplitude scans around h1 and h2
(wide span: amount 2/4 may spread sidebands beyond the +-35 Hz of the WV9
scan), local-peak picking, spacing table, total partial power, AM beat rate.
"""
import math
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_render import read_aiff, rms_db
from analyze_wavetable import amp_at, C3

R = __file__.rsplit("/", 1)[0] + "/renders/"

RENDERS = [("M2 (mode0)", "M2_WAVETABLE.aif"),
           ("WV9B (A1.0)", "WV9B_UNIM1.aif"),
           ("WV10 (A2)", "WV10_UNI_M1_A2.aif"),
           ("WV11 (A4)", "WV11_UNI_M1_A4.aif")]

F0 = C3  # 130.81 Hz


def scan(x, rate, fc, span, step=0.25, t0=1.20, t1=1.65):
    """fine amplitude scan |fc| <= span; returns [(freq, dBFS)]."""
    out = []
    fr = fc - span
    while fr <= fc + span:
        a = amp_at(x, rate, fr, t0, t1)
        out.append((fr, 20 * math.log10(a / 32768.0) if a > 0 else -144.0))
        fr += step
    return out


def peaks(sc, floor_db=-95.0, rel=25.0):
    """local maxima above max(floor, scanmax - rel), merged <1.5 Hz apart."""
    mx = max(d for _, d in sc)
    thr = max(floor_db, mx - rel)
    out = []
    for i in range(1, len(sc) - 1):
        fr, db = sc[i]
        if db >= thr and db >= sc[i - 1][1] and db >= sc[i + 1][1]:
            if out and fr - out[-1][0] < 1.5:
                if db > out[-1][1]:
                    out[-1] = (fr, db)
            else:
                out.append((fr, db))
    return out


def am_rate(x, rate, f, t0=1.15, t1=1.70):
    amp = []
    t = t0
    while t + 0.02 <= t1:
        amp.append(amp_at(x, rate, f, t, t + 0.02))
        t += 0.01
    mx, mn = max(amp), min(amp)
    mid = (mx + mn) / 2
    n = sum(1 for i in range(1, len(amp) - 1)
            if amp[i] > mid and amp[i] >= amp[i - 1] and amp[i] >= amp[i + 1])
    return mx, mn, n / (len(amp) * 0.01) if n > 1 else 0.0


def main():
    for name, f in RENDERS:
        rate, bits, x = read_aiff(R + f)
        s, e = int(1.15 * rate), int(1.70 * rate)
        steady = rms_db(x[s:e])
        print(f"== {name} ({f}) steady RMS {steady:.2f} dBFS")
        for h, span in ((1, 120.0), (2, 120.0)):
            sc = scan(x, rate, h * F0, span)
            pk = peaks(sc)
            below = [(fr - h * F0, db) for fr, db in pk if fr < h * F0]
            above = [(fr - h * F0, db) for fr, db in pk if fr > h * F0]
            fmt = lambda lst: ", ".join(f"{d:+7.2f}Hz({db:6.1f})" for d, db in lst[:8])
            print(f"   h{h} peak {max(d for _, d in sc):6.2f} dBFS; "
                  f"peaks within {25} dB, offset from h{h} (Hz):")
            print(f"     below: {fmt(below) if below else '(none)'}")
            print(f"     above: {fmt(above) if above else '(none)'}")
        mx, mn, rate_am = am_rate(x, rate, F0)
        print(f"   h1 AM max/min {mx:.3f}/{mn:.3f} lin, maxima rate {rate_am:.2f} Hz")

    print("\nspacing law read-out (main lobe offset from f0, Hz and cents):")
    for name, f in RENDERS[1:]:
        rate, bits, x = read_aiff(R + f)
        sc = scan(x, rate, F0, 120.0)
        pk = peaks(sc)
        if len(pk) >= 2:
            frs = [fr for fr, _ in pk]
            main_fr = max(pk, key=lambda p: p[1])[0]
            off = main_fr - F0
            cents = 1200 * math.log2(main_fr / F0)
            sp = min(abs(frs[i] - frs[i - 1]) for i in range(1, len(frs)))
            print(f"   {name}: main lobe {off:+.2f} Hz ({cents:+.1f} cents), "
                  f"min spacing {sp:.2f} Hz, {len(pk)} peaks")


if __name__ == "__main__":
    main()
