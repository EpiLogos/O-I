#!/usr/bin/env python3
# E5 addendum — the stored-Attack pin-map diagnostics for the equilibrium
# lane. The setter switch (glue-shell-functions.txt FUN_10179f9d4) has cases
# {0,1,default:2700us,3,4,5,6}: stored 2 hits DEFAULT (2700 us = menu idx 2),
# stored 5 hits case 5 (82000 us), stored 20 (out of the 0..6 range) hits
# default too IF delivered raw — but the A20 renders' onset/steady pin idx 5.
# This probe runs the competing pin maps against the committed maps.
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glue_abs_threshold_sim as base
import glue_overbranch_equilibrium_sim as eq

tabs = eq.parse_ratio_tables()
eq.TABLES_LIST = [tabs['DAT_104cd0a80'], tabs['DAT_104cd1280'],
                  tabs['DAT_104cd1a80']]
base.RATIO_TABLES = eq.TABLES_LIST


def run(thr, rng, ratio, att, rel, sig, scale=1.0):
    base.LUT_SCALE = 510.99976 * scale
    sigl = eq.steps_1k_signal() if sig == '1k' else eq.steps_long_signal()
    out = eq.run_model(thr, rng, ratio, att, rel, sigl)
    base.LUT_SCALE = 510.99976
    return out


def row(pin, out, overs):
    return "  ".join(f"+{o}:{eq.pin_gr(pin, out, o):7.2f}" for o in overs)


print("E5: stored-Attack pin-map diagnostics (device rows quoted for compare)")
g2_dev = {6: -3.91, 12: -8.12, 18: -12.57, 21: -14.87, 24: -17.22}
g13_dev = {6: -1.94, 12: -4.70}
g14_dev = {6: -4.13, 12: -8.37}
g15_dev = {6: -3.04, 12: -6.58}

print("  G2 (stored 2, T-24/R30) device:      "
      + "  ".join(f"+{o}:{v:7.2f}" for o, v in g2_dev.items()))
print("  ...idx 1 unscaled (gate's map):       "
      + row(eq.PINS['G2'], run(-24.0, 30.0, 1, 1, 0, '1k'), [6, 12, 18, 21, 24]))
print("  ...idx 2 unscaled (setter default):   "
      + row(eq.PINS['G2'], run(-24.0, 30.0, 1, 2, 0, '1k'), [6, 12, 18, 21, 24]))
print("  ...idx 2 x1.40:                       "
      + row(eq.PINS['G2'], run(-24.0, 30.0, 1, 2, 0, '1k', 1.40), [6, 12, 18, 21, 24]))

print("  G13 (stored 20, T-12/R30 long) device: "
      + "  ".join(f"+{o}:{v:7.2f}" for o, v in g13_dev.items()))
for att, sc, tag in ((5, 1.0, "idx 5 unscaled (current gate)"),
                     (5, 1.40, "idx 5 x1.40"),
                     (2, 1.0, "idx 2 unscaled (setter default)"),
                     (2, 1.40, "idx 2 x1.40"),
                     (6, 1.0, "idx 6 unscaled (clamp-to-6)"),
                     (6, 1.40, "idx 6 x1.40")):
    out = run(-12.0, 30.0, 1, att, 0, 'long', sc)
    print(f"  ...{tag:<32} " + row(eq.PINS['G13'], out, [6, 12]))

print("  G14 (stored 2, R4 long) device:       "
      + "  ".join(f"+{o}:{v:7.2f}" for o, v in g14_dev.items()))
print("  ...idx 2 x1.40:                       "
      + row(eq.PINS['G14'], run(-12.0, 30.0, 1, 2, 4, 'long', 1.40), [6, 12]))
print("  G15 (stored 20, R4 long) device:      "
      + "  ".join(f"+{o}:{v:7.2f}" for o, v in g15_dev.items()))
print("  ...idx 5 unscaled:                    "
      + row(eq.PINS['G15'], run(-12.0, 30.0, 1, 5, 4, 'long', 1.0), [6, 12]))
print("  ...idx 6 x1.40:                       "
      + row(eq.PINS['G15'], run(-12.0, 30.0, 1, 6, 4, 'long', 1.40), [6, 12]))
