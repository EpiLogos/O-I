#!/usr/bin/env python3
"""Generate deterministic 48 kHz float32 stereo test WAVs for golden renders.

Pure stdlib (no numpy) so the harness runs anywhere. Every value is a fixed
arithmetic sequence — identical bytes on every run.
"""
import math
import struct
import wave
from pathlib import Path

FS = 48000
OUT = Path(__file__).parent / "signals"
OUT.mkdir(exist_ok=True)


def write_wav(name, frames_l):
    n = len(frames_l)
    # hand-written IEEE float32 WAV (format tag 3): Live rejects 32-bit
    # integer PCM ("For 32 bit, only floating point samples can be used")
    data = struct.pack("<%df" % (2 * n),
                       *[v for pair in zip(frames_l, frames_l) for v in pair])
    hdr = b"RIFF" + struct.pack("<I", 36 + len(data)) + b"WAVE"
    hdr += b"fmt " + struct.pack("<IHHIIHH", 16, 3, 2, FS, FS * 8, 8, 32)
    hdr += b"data" + struct.pack("<I", len(data))
    (OUT / name).write_bytes(hdr + data)
    print(f"wrote {name}: {n} samples ({n/FS:.2f}s)")


def silence(n):
    return [0.0] * n


def sine(dbfs, freq, n):
    a = 10 ** (dbfs / 20.0)
    w = 2 * math.pi * freq / FS
    return [a * math.sin(w * i) for i in range(n)]


# 1. Level staircase, 1 kHz: -30..0 dBFS in 6 dB steps, 0.5 s each,
#    0.25 s silence lead, 1.5 s release tail. Reveals static transfer curve
#    and release tails of compressors.
seg = silence(int(0.25 * FS))
for db in (-30, -24, -18, -12, -6, -3, 0):
    seg += sine(db, 1000.0, int(0.5 * FS))
seg += silence(int(1.5 * FS))
write_wav("steps-1k.wav", seg)

# 2. Exponential sweep 20 Hz -> 20 kHz, -6 dBFS, 3 s + 0.5 s tail.
#    Reveals filter/EQ magnitude response via deconvolution.
n = int(3.0 * FS)
f0, f1 = 20.0, 20000.0
L = 3.0
k = math.log(f1 / f0)
seg = [0.5 * math.sin(2 * math.pi * f0 * L / k * (math.exp(k * i / n) - 1))
       for i in range(n)]
seg += silence(int(0.5 * FS))
write_wav("sweep-20-20k.wav", seg)

# 3. Unit impulse at sample 100, 4 s. Kernel/IR capture (delay lines, reverb).
seg = silence(int(4.0 * FS))
seg[100] = 1.0
write_wav("impulse.wav", seg)

# 4. Long-hold staircase for envelope captures (D6): 0.5 s silence lead, then
#    2.5 s steps at -18/-12/-6/0 dBFS peak (1 kHz), 4 s release tail.
seg = silence(int(0.5 * FS))
for db in (-18, -12, -6, 0):
    seg += sine(db, 1000.0, int(2.5 * FS))
seg += silence(int(4.0 * FS))
write_wav("steps-long.wav", seg)

# 5. Release probe (D6 harness gap): the silence tail is blind to gain
#    recovery, so step DOWN to a live tone: 2 s at -6 dBFS peak, then 4 s at
#    -36 dBFS peak (recovery from ~8 dB GR visible on the quiet tone),
#    1 s silence tail.
seg = sine(-6.0, 1000.0, int(2.0 * FS))
seg += sine(-36.0, 1000.0, int(4.0 * FS))
seg += silence(int(1.0 * FS))
write_wav("release-probe.wav", seg)
