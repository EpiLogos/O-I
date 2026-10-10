#!/usr/bin/env python3
"""Transient-material warp probe analysis (WB): onset displacement per mode.

Usage: analyze_wb_imp.py <render.aif> [<render2.aif> ...]

Signal: signals/impulse.wav — unit impulse at source sample 100 (48 kHz),
4.0 s file. The clip's marker pair (0 s -> beat 0, 1 s -> beat 2) pins file
tempo to the set tempo (120 BPM), so a 1:1 mapping carries the source onset
to render time 100/48000 = 2.0833 ms exactly (92.0 samples at 44.1 kHz).

Discriminator: Beats (mode 0) quantizes transient onsets to the clip's beat
grid — nearest 16th at 120 BPM = multiples of 125 ms (nearest to 2.083 ms is
0 ms) — while Complex Pro (mode 5) preserves source timing. Onset here =
first sample above -40 dBFS (dither floor sits near -90); peak sample time
and pre-onset floor reported as corroboration.
"""
import math
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_render import read_aiff

SRC_ONSET_S = 100.0 / 48000.0          # 2.08333 ms
SRC_ONSET_44K = SRC_ONSET_S * 44100.0  # 92.0 samples
THR_DB = -40.0
GRID_16TH_S = 0.125                    # 120 BPM


def onset_stats(x, rate):
    thr = 32768 * 10 ** (THR_DB / 20.0)
    for i, v in enumerate(x):
        if abs(v) > thr:
            # exact first crossing already found (scan from 0)
            peak_i = max(range(min(len(x), i + int(0.05 * rate))),
                         key=lambda k: abs(x[k]))
            pre = x[:max(i, 1)]
            pre_rms = math.sqrt(sum(v * v for v in pre) / len(pre))
            pre_db = 20 * math.log10(pre_rms / 32768.0) if pre_rms > 0 else -144.0
            t = i / rate
            grid16 = round(t / GRID_16TH_S) * GRID_16TH_S
            return {
                "onset_s": t, "onset_smp": i,
                "peak_s": peak_i / rate, "peak_db": 20 * math.log10(abs(x[peak_i]) / 32768.0),
                "pre_db": pre_db, "nearest_16th_s": grid16,
            }
    return None


def report(path):
    rate, bits, x = read_aiff(path)
    st = onset_stats(x, rate)
    print(f"{path}: rate={rate} bits={bits} samples={len(x)} ({len(x)/rate:.2f}s)")
    if st is None:
        print("  NO ONSET above threshold — render empty?")
        return
    disp_ms = (st["onset_s"] - SRC_ONSET_S) * 1000.0
    print(f"  onset: sample {st['onset_smp']} = {st['onset_s']*1000:.3f} ms "
          f"(source ref {SRC_ONSET_S*1000:.3f} ms = {SRC_ONSET_44K:.1f} smp @44.1k)")
    print(f"  displacement: {disp_ms:+.3f} ms   "
          f"nearest-16th grid point: {st['nearest_16th_s']*1000:.1f} ms "
          f"(grid delta {(st['onset_s']-st['nearest_16th_s'])*1000:+.3f} ms)")
    print(f"  peak: {st['peak_s']*1000:.3f} ms ({st['peak_db']:+.2f} dBFS)   "
          f"pre-onset floor: {st['pre_db']:.1f} dB RMS")


if __name__ == "__main__":
    for p in sys.argv[1:]:
        report(p)
