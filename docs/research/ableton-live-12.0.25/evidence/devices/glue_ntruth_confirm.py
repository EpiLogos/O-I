#!/usr/bin/env python3
# The N-truth check: the device's coefficient master runs at N = os·sr = 44100
# (NewRate's second int -> s[0x3e0]; FUN_10168762c: N = s[0x3e4]·s[0x3e0]),
# not os·ParamBlockSize = 128. If TRUE, the ×1.40 detector-tap gain is the
# compensation for the model's wrong detector N: at 1 kHz the model's
# difference stages attenuate the spread by 0.7115 (= 1/1.4055), the device's
# are unity. This script runs the exact port in both worlds against the
# committed render numbers (same pins/measures as glue_tapgain_confirm.py).
import os
import sys

sys.path.insert(0, "/Users/admin/Central/Work/O-I/docs/research/ableton-live-12.0.25/evidence/devices")
import glue_abs_threshold_sim as base
import glue_overbranch_equilibrium_sim as eq

tabs = eq.parse_ratio_tables()
eq.TABLES_LIST = [tabs['DAT_104cd0a80'], tabs['DAT_104cd1280'],
                  tabs['DAT_104cd1a80']]
base.RATIO_TABLES = eq.TABLES_LIST

SR = 44100
K_DEV = 9.4e-7 * SR   # the literal k = s[0x200]·9.4e-7 at os = 1

pinmap = {'LAM': 5, 'G2': 2, 'G1': 2, 'DF1': 2, 'DF2': 2, 'G13': 6, 'G12': 2,
          'G14': 2, 'G15': 6}


def run_world(name, scale, block_size, k_override):
    pin = eq.PINS[name]
    att = pinmap[name]
    base.LUT_SCALE = 510.99976 * scale
    sigl = (eq.steps_1k_signal() if pin['sig'] == '1k'
            else eq.steps_long_signal())
    m = base.Model(threshold_db=pin['thr'], range_db=pin['rng'],
                   ratio_index=pin['ratio'], attack_idx=att,
                   release_idx=pin['rel'], block_size=block_size,
                   k_override=k_override)
    out = []
    ap = out.append
    st = m.step
    for v in sigl:
        o, _ = st(v, v)
        ap(o)
    overs = sorted(pin['dev'])
    if pin['sig'] == '1k':
        vals = [eq.gr_1k(out, eq.K_OF_1K_T12.get(o, eq.K_OF_1K[o]),
                         eq.PEAK_OF_1K_OVER_T12.get(o, eq.PEAK_OF_1K_OVER[o]))
                if pin['thr'] == -12.0
                else eq.gr_1k(out, eq.K_OF_1K[o], eq.PEAK_OF_1K_OVER[o])
                for o in overs]
    else:
        vals = [eq.gr_long(out, eq.I_OF_LONG[o], pin['thr'] + o) for o in overs]
    base.LUT_SCALE = 510.99976
    ds = [v - pin['dev'][o] for v, o in zip(vals, overs)]
    cells = "  ".join(f"+{o}:{d:+6.2f}" for o, d in zip(overs, ds))
    worst = max(abs(d) for d in ds)
    print(f"  {name:<5} {name}-{block_size}: {cells}   worst {worst:.2f}")
    return worst


print("A. CONTROL — committed world (block 128, solved k, tap gain x1.40):")
worst = 0.0
for name in ('LAM', 'G2', 'G1', 'DF1', 'DF2', 'G13', 'G12', 'G14', 'G15'):
    worst = max(worst, run_world(name, 1.40, 128, None))
print(f"  WORST: {worst:.2f} dB\n")

print("B. N-TRUTH — device world (block 44100 = os*sr, literal k = 9.4e-7*N, no gain):")
worst = 0.0
for name in ('LAM', 'G2', 'G1', 'DF1', 'DF2', 'G13', 'G12', 'G14', 'G15'):
    worst = max(worst, run_world(name, 1.0, 44100, K_DEV))
print(f"  WORST: {worst:.2f} dB\n")

print("C. linear check: model difference-stage gain at 1 kHz, N=128 vs N=44100:")
import math
w = 2 * math.pi * 1000.0 / SR


def diff_gain(a):
    r = 1.0 - a
    return r * 2 * math.sin(w / 2) / abs(1 - r * complex(math.cos(w), -math.sin(w)))


a1_128 = 1 - math.exp(-2 * 2 * math.pi / 128)
a2_128 = 1 - math.exp(-1.1 * 2 * math.pi / 128)
a1_44 = 1 - math.exp(-2 * 2 * math.pi / 44100)
a2_44 = 1 - math.exp(-1.1 * 2 * math.pi / 44100)
g128 = diff_gain(a1_128) * diff_gain(a2_128)
g44 = diff_gain(a1_44) * diff_gain(a2_44)
print(f"  N=128 : |1-H1|*|1-H2| = {g128:.5f}  -> compensation {1/g128:.5f}")
print(f"  N=44100: |1-H1|*|1-H2| = {g44:.5f}  -> compensation {1/g44:.5f}")
