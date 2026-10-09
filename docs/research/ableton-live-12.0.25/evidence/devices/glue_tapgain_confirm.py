#!/usr/bin/env python3
# E6 addendum — confirm the ×1.40 detector-tap closure on the deep ratio
# families (DF1/DF2), the full G1 rows, and pin the constant's value.
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glue_abs_threshold_sim as base
import glue_overbranch_equilibrium_sim as eq

tabs = eq.parse_ratio_tables()
eq.TABLES_LIST = [tabs['DAT_104cd0a80'], tabs['DAT_104cd1280'],
                  tabs['DAT_104cd1a80']]
base.RATIO_TABLES = eq.TABLES_LIST


def full_row(name, scale, att_override=None):
    pin = eq.PINS[name]
    att = att_override if att_override is not None else pin['att']
    base.LUT_SCALE = 510.99976 * scale
    overs = sorted(pin['dev'])
    if pin['sig'] == '1k':
        sigl = eq.steps_1k_signal()
        out = eq.run_model(pin['thr'], pin['rng'], pin['ratio'], att,
                           pin['rel'], sigl)
        vals = [eq.gr_1k(out, eq.K_OF_1K_T12.get(o, eq.K_OF_1K[o]),
                         eq.PEAK_OF_1K_OVER_T12.get(o, eq.PEAK_OF_1K_OVER[o]))
                if pin['thr'] == -12.0
                else eq.gr_1k(out, eq.K_OF_1K[o], eq.PEAK_OF_1K_OVER[o])
                for o in overs]
    else:
        sigl = eq.steps_long_signal()
        out = eq.run_model(pin['thr'], pin['rng'], pin['ratio'], att,
                           pin['rel'], sigl)
        vals = [eq.gr_long(out, eq.I_OF_LONG[o], pin['thr'] + o) for o in overs]
    base.LUT_SCALE = 510.99976
    ds = [v - pin['dev'][o] for v, o in zip(vals, overs)]
    cells = "  ".join(f"+{o}:{d:+6.2f}" for o, d in zip(overs, ds))
    print(f"  {name:<5} x{scale:.4f} att{att}: {cells}   worst {max(abs(d) for d in ds):.2f}")
    return max(abs(d) for d in ds)


print("E6: x1.40 confirm on every committed pin (d = sim - device, dB);")
print("    attack idx = setter case (stored 2 -> 2, stored 20 -> 6, stored 5 -> 5)")
pinmap = {'LAM': 5, 'G2': 2, 'G1': 2, 'DF1': 2, 'DF2': 2, 'G13': 6, 'G12': 2,
          'G14': 2, 'G15': 6}
worst = 0.0
for name in ('LAM', 'G2', 'G1', 'DF1', 'DF2', 'G13', 'G12', 'G14', 'G15'):
    worst = max(worst, full_row(name, 1.40, pinmap[name]))
print(f"  WORST |d| across all nine pin families: {worst:.2f} dB")

print("\nfine value scan (LAM five-step worst):")
for sc in (1.39, 1.395, 1.40, 1.405, 1.41, 1.41421):
    full_row('LAM', sc)
