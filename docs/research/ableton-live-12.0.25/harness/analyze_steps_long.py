#!/usr/bin/env python3
"""Envelope analysis for steps-long.wav renders (D6 envelope family).

Signal layout (48k source, render 44.1k, timeline preserved):
  0.5 s lead | -18 dBFS 0.5-3.0 | -12 3.0-5.5 | -6 5.5-8.0 | 0 8.0-10.5 | tail 10.5-14.5

Attack: 100 ms RMS windows across each at/over-threshold step onset.
Release: 250 ms RMS windows for 4 s after the last step ends.
Reports time-constants: attack = time to 63% of final GR; release = time to
decay to 37% of GR at step end.
"""
import math
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_render import read_aiff, rms_db

STEPS = [(-18, 0.5, 3.0), (-12, 3.0, 5.5), (-6, 5.5, 8.0), (0, 8.0, 10.5)]
TAIL0 = 10.5


def main(path):
    rate, bits, mono = read_aiff(path)
    print(f"{path}: rate={rate} samples={len(mono)} ({len(mono)/rate:.2f}s)")

    def win_rms(t0, w):
        s, e = int(t0 * rate), int((t0 + w) * rate)
        return rms_db(mono[s:e])

    print("\nattack onsets (100 ms windows, GR = out_rms - in_rms):")
    for db, t0, t1 in STEPS:
        steady = win_rms(t1 - 0.4, 0.4) - (db - 3.01)
        if db > -14:  # at/over threshold only
            print(f"  step {db} dBFS @ {t0:.2f}s (steady GR {steady:6.2f} dB):")
            vals = []
            for k in range(-2, 21):
                t = t0 + k * 0.1
                gr = win_rms(t, 0.1) - (db - 3.01)
                vals.append((t - t0, gr))
                if k % 2 == 0 and k >= 0:
                    print(f"    +{t - t0:4.1f}s  GR {gr:7.2f}")
            # 63% time: first window center where GR <= -0.63*steady
            t63 = None
            for dt, gr in vals:
                if dt >= 0 and gr <= 0.63 * steady:
                    t63 = dt
                    break
            print(f"    -> t63 (63% of steady GR): {t63 if t63 is not None else '>2.0'} s")

    print("\nrelease tail after 10.5 s (250 ms windows, GR vs 0 dBFS step in_rms):")
    g0 = None
    rows = []
    for k in range(0, 17):
        t = TAIL0 + k * 0.25
        gr = win_rms(t, 0.25) - (-3.01)
        if g0 is None and t >= TAIL0:
            g0 = gr
        rows.append((t - TAIL0, gr))
    for dt, gr in rows:
        print(f"    +{dt:5.2f}s  GR {gr:7.2f}")
    # 37% time: last GR above 37% of g0 (decay toward 0); report crossing
    t37 = None
    for dt, gr in rows:
        if gr <= 0.37 * g0:
            t37 = dt
            break
    print(f"    -> GR at step end {g0:.2f} dB; decay to 37% ({0.37*g0:.2f} dB) at +{t37 if t37 is not None else '>4.0'} s")
    tail = win_rms(13.5, 1.0)
    print(f"    -> floor (13.5-14.5s): {tail:.2f} dBFS")


if __name__ == "__main__":
    main(sys.argv[1])
