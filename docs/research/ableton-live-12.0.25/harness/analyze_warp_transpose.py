#!/usr/bin/env python3
"""Warp transposition-probe analysis: pitch-shift factor + artifacts.

Usage: analyze_warp_transpose.py <render.aif> <semitones>

Source: signals/sweep-20-20k.wav — exponential sweep 20 Hz -> 20 kHz over
3.0 s at -6 dBFS peak, +0.5 s silence tail (48 kHz stereo float32 WAV).
The render is a 1:1 time mapping (marker pair (0,0)-(1s,2beats)) with clip
PitchCoarse = <semitones>. If pitch tracking is exact:
  - sweep start reads 20 * 2^(n/12) Hz (the +12/-12 discriminator the
    probe cares about: 40 / 10 Hz),
  - duration stays 1.0x (Tones shifts pitch without changing time),
  - local sweep law f(t) = 20 * (1000)^(t/3) * 2^(n/12).

Metrics (stdlib Goertzel, same discipline as analyze_warp*.py):
  (a) content end + duration ratio vs the 3.0 s audible sweep
  (b) peak frequency at matched sweep fractions vs theory (cent error)
  (c) gain map: window RMS at matched fractions vs the source file's own
      window RMS (transposition should be level-true)
  (d) harmonic artifacts of the local fundamental at t=1.5 s (2f..6f, rel)
  (e) Nyquist note: at +12 the sweep end (40 kHz) exceeds 22.05k Nyquist;
      the 0.9*3 s window is probed for folded products
"""
import math
import struct
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_render import read_aiff, rms_db
from analyze_warp_stretch import content_end, goertzel

SWEEP_END = 3.0
F0, F1 = 20.0, 20000.0
L = 3.0
K = math.log(F1 / F0)


def sweep_f(t):
    """Instantaneous source-sweep frequency (the generator's exact law)."""
    return F0 * math.exp(K * t / L)


def read_wav_mono(path):
    b = open(path, "rb").read()
    n = (len(b) - 44) // 8
    vals = struct.unpack("<%df" % (2 * n), b[44:44 + 8 * n])
    # scale float32 source samples onto the int16 scale rms_db/band_db use
    return [v * 32768.0 for v in vals[0::2]]


def peak_freq(x, rate, t0, t1, f0, f1, step=1.0):
    best, bf = -1e30, 0.0
    f = f0
    while f <= f1:
        a = goertzel(x, rate, f, t0, t1)
        db = 20 * math.log10(a / 32768.0) if a > 0 else -144.0
        if db > best:
            best, bf = db, f
        f += step
    return bf, best


def band_db(x, rate, f, t0, t1):
    a = goertzel(x, rate, f, t0, t1)
    return 20 * math.log10(a / 32768.0) if a > 0 else -144.0


def main():
    path, semis = sys.argv[1], int(sys.argv[2])
    ratio = 2.0 ** (semis / 12.0)
    rate, _, x = read_aiff(path)
    src = read_wav_mono(__file__.rsplit("/", 1)[0] +
                        "/signals/sweep-20-20k.wav")
    print(f"== {path.split('/')[-1]}  pitch={semis:+d} st "
          f"(freq ratio {ratio:.4f})  rate {rate}")

    end = content_end(x, rate)
    print(f"(a) content end {end:.3f} s (sweep 3.0 s + grain smear; "
          f"ratio {end / SWEEP_END:.4f})")

    print("(b) peak frequency at matched sweep fractions:")
    for frac in (0.02, 0.1, 0.25, 0.5, 0.75, 0.9):
        ts = frac * SWEEP_END
        fth = sweep_f(ts) * ratio
        lo, hi = max(15.0, fth * 0.7), min(fth * 1.4, 21000.0)
        if lo >= hi:
            print(f"    t={ts:4.2f}s theory {fth:9.1f} Hz (out of probe band)")
            continue
        a0 = peak_freq(src, 48000.0, ts - 0.05, ts + 0.05,
                       max(15.0, sweep_f(ts) * 0.7),
                       min(sweep_f(ts) * 1.4, 21000.0))
        bf, db = peak_freq(x, rate, ts - 0.05, ts + 0.05, lo, hi)
        cents = 1200 * math.log2(bf / fth) if bf > 0 and fth > 0 else 0.0
        print(f"    t={ts:4.2f}s theory {fth:9.1f} Hz  render {bf:9.1f} Hz "
              f"({db:6.1f} dBFS, {cents:+7.1f} cent)   src@frac {a0[0]:9.1f} Hz")

    print("(c) gain map (100 ms window RMS at matched t, render - source):")
    for frac in (0.1, 0.25, 0.5, 0.75, 0.9):
        ts = frac * SWEEP_END
        s0, e0 = int((ts - 0.05) * 48000), int((ts + 0.05) * 48000)
        s1, e1 = int((ts - 0.05) * rate), int((ts + 0.05) * rate)
        r = rms_db(x[s1:e1])
        v = rms_db(src[s0:e0])
        print(f"    t={ts:4.2f}s render {r:7.2f} dBFS  source {v:7.2f} dBFS "
              f"  delta {r - v:+6.2f} dB")

    print("(d) harmonic artifacts of local f at t=1.5 s window (1.45-1.55):")
    ts = 1.5
    floc = sweep_f(ts) * ratio
    fl = band_db(x, rate, floc, ts - 0.05, ts + 0.05)
    print(f"    local f {floc:8.1f} Hz at {fl:6.2f} dBFS")
    for mult in (2, 3, 4, 6):
        fh = floc * mult
        if fh < 21000:
            ah = band_db(x, rate, fh, ts - 0.05, ts + 0.05)
            print(f"      {mult}f {fh:8.1f} Hz: {ah:8.2f} dBFS "
                  f"({ah - fl:+7.2f} rel)")

    if semis > 0:
        print("(e) Nyquist folding probe (sweep end would map to "
              f"{F1 * ratio / 1000:.1f} kHz > 22.05 kHz):")
        for frac in (0.95, 0.99):
            ts = frac * SWEEP_END
            bf, db = peak_freq(x, rate, ts - 0.03, ts + 0.03, 500.0, 21000.0)
            fth = sweep_f(ts) * ratio
            alias = abs(fth - rate) if fth > rate / 2 else 0
            print(f"    t={ts:4.2f}s theory {fth:9.1f} Hz "
                  f"(alias {alias:9.1f} Hz): peak {bf:9.1f} Hz ({db:6.1f} dBFS)")


if __name__ == "__main__":
    main()
