#!/usr/bin/env python3
"""MIDI-instrument render analysis: per-note RMS, onset shape, release tail.

Clip model (120 BPM): 4 notes at k*1.0 s (beats 0/2/4/6), each sounds 0.875 s
(1.75 beats), velocities 127/96/64/32 (stored 1.0/0.7559/0.5039/0.2520).
"""
import math
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_render import read_aiff, rms_db
from analyze_echo_taps import read_aiff_stereo, db

NOTES = [(0.0, 1.0, 127), (1.0, 0.7559, 96), (2.0, 0.5039, 64), (3.0, 0.2520, 32)]
SOUND = 0.875


def main(path):
    rate, bits, mono = read_aiff(path)
    rate2, L, R = read_aiff_stereo(path)
    print(f"{path}: rate={rate} samples={len(mono)}")

    def wrms(t0, w, ch=None):
        s, e = int(t0 * rate), int((t0 + w) * rate)
        if ch == "L":
            return rms_db(L[s:e])
        if ch == "R":
            return rms_db(R[s:e])
        return rms_db(mono[s:e])

    print("\nper-note RMS (window [start+0.15, start+0.70]):")
    print("  note  start  velocity   stored    L dBFS     R dBFS")
    for k, (start, stored, vel) in enumerate(NOTES):
        print(f"  {k:4d}  {start:5.2f}  {vel:5d}    {stored:7.4f}  "
              f"{wrms(start + 0.15, 0.55, 'L'):8.2f}  {wrms(start + 0.15, 0.55, 'R'):8.2f}")

    print("\nnote-1 onset (100 ms windows, 0-0.5 s):")
    for k in range(5):
        t = k * 0.1
        print(f"  +{t:4.2f}s  L {wrms(t, 0.1, 'L'):8.2f}  R {wrms(t, 0.1, 'R'):8.2f}")

    print("\nrelease after note-4 off (start 3.875 s; 100 ms x6 then 250 ms x8):")
    off = NOTES[3][0] + SOUND
    for k in range(6):
        t = off + k * 0.1
        print(f"  +{t - off:5.2f}s  L {wrms(t, 0.1, 'L'):8.2f}  R {wrms(t, 0.1, 'R'):8.2f}")
    for k in range(8):
        t = off + 0.6 + k * 0.25
        print(f"  +{t - off:5.2f}s  L {wrms(t, 0.25, 'L'):8.2f}  R {wrms(t, 0.25, 'R'):8.2f}")

    # whole-file activity map (2 s blocks) to see where sound actually is
    print("\nactivity map (1 s blocks, L, dBFS):")
    row = []
    for t0 in range(0, int(len(mono) / rate)):
        row.append(f"{t0}s:{wrms(t0, 1.0, 'L'):7.1f}")
    for i in range(0, len(row), 6):
        print("  " + "  ".join(row[i:i + 6]))


if __name__ == "__main__":
    main(sys.argv[1])
