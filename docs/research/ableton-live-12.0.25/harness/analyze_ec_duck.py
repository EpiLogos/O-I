#!/usr/bin/env python3
"""Echo ducking-envelope analysis for the EC5/EC6 probes (steps-1k renders).

Reads four renders (duck/noduck x DryWet 0.5873/1.0 of the same recipe:
Filter off, Mod off, Reverb off, sync mode, FB 0.5):
  EC5_DUCK_TONE   (DryWet 0.5873, duck on)    EC5B_NODUCK  (0.5873, duck off)
  EC6_WET_DUCK    (DryWet 1, duck on)         EC6B_WET_NODUCK (1, duck off)

Signal timeline (steps-1k.wav, 0.25 s lead + 0.5 s steps + 1.5 s tail):
  -30..-3 dBFS-peak 1 kHz steps, then a 0 dBFS step, then silence at 3.75 s.

Outputs:
  G(t)  = EC6 - EC6B per window  : the wet-path duck gain envelope (dB)
  M(t)  = EC5 - EC5B per window  : the audible (dry+wet mix) duck effect
  per-step mean G, onset latency, and an exponential recovery-tau fit.
"""
import math
import struct
import sys

WIN = 0.020   # RMS window s
HOP = 0.005   # hop s
STEPS = [(-30, 0.25, 0.75), (-24, 0.75, 1.25), (-18, 1.25, 1.75),
         (-12, 1.75, 2.25), (-6, 2.25, 2.75), (-3, 2.75, 3.25),
         (0, 3.25, 3.75)]
TAIL_START = 3.75


def read_aiff_stereo(path):
    b = open(path, "rb").read()
    assert b[:4] == b"FORM", "not AIFF"
    pos = 12
    rate = None
    while pos + 8 <= len(b):
        cid = b[pos:pos + 4]
        size = struct.unpack(">I", b[pos + 4:pos + 8])[0]
        body = b[pos + 8:pos + 8 + size]
        if cid == b"COMM":
            exp = struct.unpack(">h", body[8:10])[0]
            mant = struct.unpack(">Q", body[10:18])[0]
            rate = mant * 2.0 ** (exp - 16383 - 63)
        elif cid == b"SSND":
            offset = struct.unpack(">I", body[0:4])[0]
            data = body[8 + offset:]
            break
        pos += 8 + size + (size & 1)
    n = len(data) // 2
    s = struct.unpack(">%dh" % n, data[:2 * n])
    return rate, s[0::2], s[1::2]


def rms_db(x):
    acc = sum(v * v for v in x) / max(1, len(x))
    r = math.sqrt(acc) / 32768.0
    return -144.0 if r == 0 else 20 * math.log10(r)


def load(name):
    rate, L, R = read_aiff_stereo(f"renders/{name}.aif")
    return rate, L, R


def window_table(rate, L, R, t_end):
    rows = []
    w = int(WIN * rate)
    t = WIN / 2
    while t < t_end:
        s = int((t - WIN / 2) * rate)
        rows.append((t, rms_db(L[s:s + w]), rms_db(R[s:s + w])))
        t += HOP
    return rows


def main():
    import os
    os.chdir(sys.path[0])
    # pair mode: analyze_ec_duck.py <duck_render_stem> <noduck_render_stem>
    # (no control for the 0.5873 mix beyond EC5B, so pair mode is wet-only)
    duck, noduck = "EC6_WET_DUCK", "EC6B_WET_NODUCK"
    if len(sys.argv) > 2:
        duck, noduck = sys.argv[1], sys.argv[2]
    rend = {}
    for name in {duck, noduck, "EC5_DUCK_TONE", "EC5B_NODUCK", "EC6_WET_DUCK", "EC6B_WET_NODUCK"}:
        rate, L, R = load(name)
        rend[name] = window_table(rate, L, R, 6.2)

    e6 = dict(((t, (l, r)) for t, l, r in rend[duck]))
    e6b = dict(((t, (l, r)) for t, l, r in rend[noduck]))
    e5 = dict(((t, (l, r)) for t, l, r in rend["EC5_DUCK_TONE"]))
    e5b = dict(((t, (l, r)) for t, l, r in rend["EC5B_NODUCK"]))
    ts = [t for t, _, _ in rend[duck]]

    def seg(t):
        for lvl, a, b in STEPS:
            if a <= t < b:
                return lvl
        return "tail" if t >= TAIL_START else "lead"

    print(f"G(t) = duck gain ({duck} - {noduck}), dB; M(t) = mix effect (EC5-EC5B)")
    print("  t     seg   G_L     G_R")
    for t in ts:
        gl = e6[t][0] - e6b[t][0]
        gr = e6[t][1] - e6b[t][1]
        print(f" {t:5.3f} {seg(t)!s:>5} {gl:7.2f} {gr:7.2f}")

    print("\nper-step mean G (dB), windows fully inside each segment:")
    for lvl, a, b in STEPS + [(None, TAIL_START, 6.2)]:
        name = f"{lvl} dBFS" if lvl is not None else "tail"
        gls, grs = [], []
        for t in ts:
            if a + WIN <= t < b:
                gls.append(e6[t][0] - e6b[t][0])
                grs.append(e6[t][1] - e6b[t][1])
        if gls:
            print(f"  step {name:>8}: G_L {sum(gls)/len(gls):7.2f}  G_R {sum(grs)/len(grs):7.2f}  (n={len(gls)})")

    # onset latency: first t where G_L < -0.5 dB after the 0 dBFS step starts
    onset = None
    for t in ts:
        if t >= 3.25 and e6[t][0] - e6b[t][0] < -0.5:
            onset = t
            break
    if onset:
        print(f"\nGR onset (G_L < -0.5 dB): t={onset:.3f} s -> {onset-3.25:+.3f} s vs 0 dBFS step start")

    # recovery fit in the tail: G_L(t) ~ -A*exp(-(t-t_x)/tau) once input is silent
    pts = [(t, e6[t][0] - e6b[t][0]) for t in ts if TAIL_START + 0.02 <= t <= 4.8
           and (e6[t][0] - e6b[t][0]) < -0.5]
    if len(pts) > 4:
        # linear fit of ln(-G) vs t
        xs = [t for t, g in pts]
        ys = [math.log(-g) for t, g in pts]
        n = len(xs)
        mx = sum(xs) / n
        my = sum(ys) / n
        sxx = sum((x - mx) ** 2 for x in xs)
        sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
        slope = sxy / sxx
        tau = -1 / slope
        a = my - slope * mx
        print(f"recovery fit (tail, L): G = -{math.exp(a):.2f} dB * exp(-(t-{TAIL_START:.2f})/{tau * 1000:.0f} ms)"
              f"  [tau={tau * 1000:.0f} ms, {n} pts, r range {pts[0][1]:.2f}..{pts[-1][1]:.2f}]")


if __name__ == "__main__":
    main()
