#!/usr/bin/env python3
# PROVENANCE: owner-private analysis companion for
# docs/research/ableton-live-12.0.25/evidence/devices/glue_depth_equilibrium.md
# (the depth-equilibrium lane, 2026-10-08). Standing on:
#   devices/glue-perblock-derivation.md   (state-slot ledger, SS3/SS4)
#   devices/glue-compressor.md            (gain maps G1/G2, LAM verdict,
#                                          four-cell grid, "Over-branch
#                                          equilibrium closure")
#   devices/glue-absolute-threshold.md    (covariance law; 0x1bc chain closed)
#   evidence/binary/glue-kernel-decompilation.txt ([K113-255])
#   evidence/binary/glue-ratio-tables.txt (the committed 512-float LUTs)
#   evidence/devices/glue_abs_threshold_sim.py (the validated exact port)
#   evidence/devices/glue_overbranch_equilibrium_sim.py (E1-E4 predecessor)
# NOT FOR REDISTRIBUTION. Never enters product source. Python stdlib only.
#
# Question (the LAM verdict's named home, tested here end to end): the
# over-branch equilibrium — the shaped-LUT cycle mean -> x at depth — was
# "treated as constant" in the derivation. Does the equilibrium solve WITH the
# depth-dependent cycle mean produce the missing ~2 dB of depth?
#
# Tiers of the ȳ treatment (the ladder the verdict hangs on):
#   center  — the derivation's substitution lut_cycle_mean -> lut(0) = +0.676
#             (the "center value"): mean balance with a constant LUT read.
#   cycle   — depth-dependent ȳ(x): constant-G quasi-static, per-sample
#             balance solved pointwise on the shaped-LUT trajectory.
#   rippled — y's over-branch one-pole threaded over the cycle (G still
#             constant over the cycle).
#   full    — per-sample G(theta) from the pass-through det state (det = y)
#             AND exact s38 threading: the exact per-sample composition of
#             the mapped law iterated to its periodic steady state. If the
#             depth-dependent cycle mean is the residual's home, THIS tier
#             must move off the port's numbers toward the device.
#   port    — the exact time-domain model (float32-faithful, gate-validated).
#   device  — the committed gain maps (grid/LAM at idx 5, G1=G2 at idx 1).
#
# Sections
#   EA  port validation (tables-file LUTs vs committed gate numbers)
#   EB  per-sample balance audit: the kernel's own converged solve vs the
#       closed form Sum f = A(k y + s38 - x(k+Rh))/(A+k+Rh), and vs this
#       script's bisection root of the same equation
#   EC  the tier ladder at the four task pins x four over-levels
#   ED  residual structure (D inversion) + the x1.40 closure rows
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glue_abs_threshold_sim as base
import glue_overbranch_equilibrium_sim as eq

HERE = os.path.dirname(os.path.abspath(__file__))

M = base.OVER_M          # 6.8132e-9   [0x98]
B = base.OVER_B          # 19.23077    [0xa4]
SR = 44100

# Committed device rows at equal over-threshold (glue-compressor.md):
# idx 5: GRID/LAM (four-cell grid: all cells equal at equal over; LAM full map)
# idx 1: G2 map (T-24) = G1 map (T-12) at matched over (G1 == G2 proven)
DEVICE = {
    5: {6: -2.84, 12: -6.33, 18: -10.27, 24: -14.51},
    1: {6: -3.91, 12: -8.12, 18: -12.57, 24: -17.22},
}
OVERS = (6, 12, 18, 24)
RNG = 30.0


# ------------------------------------------------------------ port (exact)
class AuditedModel(base.Model):
    """base.Model with the per-sample solved states recorded for the
    balance audit (a verbatim copy of step() plus three captures)."""

    def __init__(self, *a, **kw):
        super().__init__(*a, **kw)
        self.records = []

    def step(self, in_l, in_r):
        il = max(-20.0, min(20.0, base.npfloat32(in_l)))
        ir = max(-20.0, min(20.0, base.npfloat32(in_r)))
        for i in range(5):
            self.acc[i] += self.inc[i]
        acc_thr, acc_makeup, acc_range, acc_wet = \
            self.acc[0], self.acc[1], self.acc[2], self.acc[3]
        g = 10.0 ** ((base.DETECTOR_SCALE * self.det_db - acc_thr
                      - base.G_LAW_OFFSET_DB) / 20.0)
        self.fast[0] += (il - self.fast[0]) * self.a_s1
        self.fast[1] += (ir - self.fast[1]) * self.a_s1
        e0 = (il - self.fast[0]) * g
        e1 = (ir - self.fast[1]) * g
        self.slow[0] += (e0 - self.slow[0]) * self.a_s2
        self.slow[1] += (e1 - self.slow[1]) * self.a_s2
        lut_l = base.lut_lookup(self.table, e0 - self.slow[0])
        lut_r = base.lut_lookup(self.table, e1 - self.slow[1])
        t = abs(acc_range * base.CEIL_LIN * base.CEIL_SCALE) \
            + base.CEIL_CONST - 1.0
        for name in ('l', 'r'):
            v = lut_l if name == 'l' else lut_r
            if v < -t:
                u = max(-2.0, min(2.0, v + t))
                v = base.cubic_soft_clip(u) - t
            if name == 'l':
                lut_l = v
            else:
                lut_r = v
        z = -self.k * (self.y - self.s28) - self.s38
        dvar16 = z
        y_state = self.y
        s38_state = self.s38
        x_it = self.x
        for it in range(11):
            dl = x_it - lut_l
            dr = x_it - lut_r
            if dl > 0.0 or dr > 0.0:
                ul = max(0.0, min(self.u_max, dl))
                ur = max(0.0, min(self.u_max, dr))
                ebl = math.exp(base.OVER_B * ul)
                ebr = math.exp(base.OVER_B * ur)
                fpl = base.OVER_M * base.OVER_B * ebl
                fpr = base.OVER_M * base.OVER_B * ebr
                phi = (base.OVER_M * (ebl - 1.0) - ul * fpl - lut_l * fpl) \
                    + (base.OVER_M * (ebr - 1.0) - ur * fpr - lut_r * fpr)
                ssum = fpl + fpr
                denom = (ssum + self.a_att_us) * self.k \
                    + ssum * self.a_att_us \
                    + (ssum + self.a_att_us) * self.a_rel_us
                x_new = (-self.a_att_us * dvar16 - self.c4 * phi
                         + self.s28 * self.a_att_us * self.c4) / denom
                y_new = self.g_over * (self.k * (y_state - self.s28)
                                       + self.s38 + x_new * self.a_att_us
                                       + self.s28 * self.c4)
            else:
                y_new = self.s28 + self.g_under * -dvar16
                x_new = y_new
            x_conv = abs(x_new - x_it) < abs(x_new) * 1e-5 + 1e-7
            x_it = x_new
            if x_conv or it >= 10:
                break
        y_new_ = y_new
        self.s38 = z + (y_new_ - self.s28) * self.k
        self.nint = dvar16 + self.c4 * (y_new_ - self.s28)
        self.s28 += 0.0 * self.nint
        self.x = x_it
        self.y = y_new_
        self.records.append((y_state, s38_state, x_it, lut_l))
        raw_det = y_new_
        raw_app = acc_makeup + base.DETECTOR_SCALE * y_new_
        s178, s17c, s180 = self.smoother
        self.det_db = s178 * raw_det + s17c * self.det_raw_prev \
            + s180 * self.det_db
        self.app_db = s178 * raw_app + s17c * self.app_raw_prev \
            + s180 * self.app_db
        self.det_raw_prev = raw_det
        self.app_raw_prev = raw_app
        gain_lin = (1.0 - acc_wet) + acc_wet * 10.0 ** (self.app_db / 20.0)
        outs = []
        for v0 in (il, ir):
            if self.peak_clip_in:
                v = v0 * gain_lin * 1.0592537
                if abs(v) > 0.84139514:
                    vn = max(-2.0, min(2.0, (v + 0.84139514) * 6.304977))
                    lo = base.cubic_soft_clip(vn) * 0.15860486 - 0.84139514
                    vp = max(-2.0, min(2.0, (v - 0.84139514) * 6.304977))
                    hi = base.cubic_soft_clip(vp) * 0.15860486 + 0.84139514
                    v = hi if v > 0.84139514 else lo
                v *= 0.94406086
            else:
                v = v0 * gain_lin
            outs.append(base.npfloat32(v))
        return outs[0], outs[1]


def coeffs_of(m):
    return dict(a_s1=m.a_s1, a_s2=m.a_s2, a_att=m.a_att_us, a_rel=m.a_rel_us,
                k=m.k, dc=m.a_att_us / (m.a_att_us + m.a_rel_us),
                u_max=m.u_max)


# --------------------------------------------------------- balance solver
def solve_balance(lut, y_prev, s38, c):
    """Interior root x of the per-sample over-branch balance with s38 kept
    (the exact kernel map, [K214-225] with the Sum-f' cancellation — valid
    while 0 < x - lut < u_max):

        2 m (e^{B u} - 1) = A (k y[n-1] + s38 - x (k+Rh)) / (A+k+Rh),
        u = clamp(x - lut, 0, u_max).

    g(x) is continuous and strictly increasing (slope A(k+Rh)/(A+k+Rh)
    below the LUT, 2 m B e^{Bu} + that above), so one bisection finds the
    root — the branch switch needs no special case."""
    A, Rh, k = c['a_att'], c['a_rel'], c['k']
    c4 = k + Rh
    den = A + k + Rh
    xu = (k * y_prev + s38) / c4
    lo = min(lut, xu) - 1.0
    hi = max(lut, xu) + 60.0

    def g(x):
        u = x - lut
        if u < 0.0:
            u = 0.0
        elif u > c['u_max']:
            u = c['u_max']
        return 2.0 * M * (math.exp(B * u) - 1.0) \
            - A * (k * y_prev + s38 - x * c4) / den

    for _ in range(60):
        mid = 0.5 * (lo + hi)
        if g(mid) < 0.0:
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi)


def solve_x_exact(lut, y_prev, s38, c):
    """The kernel's per-sample solve in full — the Sum-f' balance is only
    the INTERIOR leg of it. With both legs at the same lut (mono), the
    fixed point of [K218-221] falls into three exhaustive regimes:
      under    (x* <= lut):        x* = (k y + s38)/(k+Rh)   [K227-231]
      clamped  (x* - lut >= u_max): u is pinned, so Phi and S are
               x-independent and [K220-221] is LINEAR in x
      interior (0 < x* - lut < u_max): the Sum-f' balance (bisection)
    Monotonicity of the kernel map makes the classification consistent."""
    A, Rh, k = c['a_att'], c['a_rel'], c['k']
    c4 = k + Rh
    den = A + k + Rh
    um = c['u_max']
    z = -k * y_prev - s38
    xu = (k * y_prev + s38) / c4
    if xu <= lut:
        return xu
    eum = math.exp(B * um)
    fp = M * B * eum
    phi_c = 2.0 * (M * (eum - 1.0) - um * fp - lut * fp)
    s_c = 2.0 * fp
    xc = (-A * z - (A + c4) * phi_c) / (s_c * den + A * c4)
    if xc - lut >= um:
        return xc
    return solve_balance(lut, y_prev, s38, c)


# ------------------------------------------------- full tier (per-sample G)
def equilibrium_full(peak_db, thr, rng, ratio, att_idx, rel_idx,
                     tap=1.0, warm_s=0.6, meas_s=0.30):
    """The mapped law's exact per-sample composition at periodic steady
    state: detector chain driven sample-directly, G(theta) = 10^((7.8
    y[n-1] - T - 18)/20) (the smoother is a pass-through, [K113-115] +
    [PB SS2]), LUT read + ceiling per sample, the balance root per sample,
    the y one-pole and s38 threaded exactly ([K223-225], [K236]). GR is
    the power-weighted applied gain over the measurement stretch — the
    render-side definition (out_rms - in_rms)."""
    c = eq.solver_coeffs(att_idx, rel_idx)
    tab = eq.TABLES_LIST[min(ratio, 2)]
    t_ceiling = abs(-rng * base.CEIL_LIN * base.CEIL_SCALE) \
        + base.CEIL_CONST - 1.0
    amp = 10.0 ** (peak_db / 20.0)
    w = base.TAU * 1000.0 / SR
    A, Rh, k = c['a_att'], c['a_rel'], c['k']
    c4 = k + Rh
    den = A + k + Rh
    fast = slow = y = s38 = 0.0
    n_warm = int(warm_s * SR)
    n_meas = int(meas_s * SR)
    num = den_sum = 0.0
    for i in range(n_warm + n_meas):
        v = amp * math.sin(w * i)
        G = 10.0 ** ((base.DETECTOR_SCALE * y - thr - base.G_LAW_OFFSET_DB)
                     / 20.0)
        fast += (v - fast) * c['a_s1']
        e = (v - fast) * G
        slow += (e - slow) * c['a_s2']
        lut = eq.shaped_lut(tab, (e - slow) * tap, t_ceiling)
        z = -k * y - s38
        x = solve_x_exact(lut, y, s38, c)
        y_new = (k * y + s38 + A * x) / den
        s38 = z + k * y_new
        y = y_new
        if i >= n_warm:
            num += v * v * 10.0 ** (base.DETECTOR_SCALE * y / 10.0)
            den_sum += v * v
    return 10.0 * math.log10(num / den_sum)


# ------------------------------------------------------- center-value tier
def center_tier(c, tab):
    """The derivation's constant-cycle-mean substitution: LUT read pinned at
    the center value lut(0), mean balance with <y> = xbar*A/(A+Rh):

        h(xbar) = 2 m (e^{B u} - 1) + xbar * A Rh/(A+Rh),  u = clamp(xbar-lut0,0,u_max)

    Returns (min h on x>0 grid, max h on x<0 grid): if the first is > 0 and
    the second < 0, the ONLY fixed point is xbar = 0 — GR identically 0."""
    lut0 = base.lut_lookup(tab, 0.0)
    A, Rh, k = c['a_att'], c['a_rel'], c['k']
    coeff = A * Rh / (A + k + Rh)
    xs_pos = [1e-4, 0.05, 0.2, 0.5, 1.0, 2.0, 5.0]
    xs_neg = [-v for v in xs_pos]

    def h(x):
        u = min(max(x - lut0, 0.0), c['u_max'])
        return 2.0 * M * (math.exp(B * u) - 1.0) + x * coeff

    return (min(h(x) for x in xs_pos), max(h(x) for x in xs_neg), lut0)


# ------------------------------------------------------------------ mains
def ea_validate():
    print("=" * 76)
    print("EA port validation (LUTs from glue-ratio-tables.txt) vs committed")
    ok = True
    sig = eq.steps_1k_signal()
    for name, thr, rng, att in (('LAM', -24.0, 60.0, 5),
                                ('G2', -24.0, 30.0, 1)):
        out = eq.run_model(thr, rng, 1, att, 0, sig)
        for over in OVERS:
            g = eq.gr_1k(out, eq.K_OF_1K[over], eq.PEAK_OF_1K_OVER[over])
            ref = eq.MODEL_COMMITTED[(name, over)]
            flag = 'ok' if abs(g - ref) <= 0.02 else 'MISMATCH'
            ok = ok and abs(g - ref) <= 0.02
            print(f"  {name} +{over:>2}: sim {g:7.3f}  committed {ref:7.2f}  [{flag}]")
    print(f"  EA {'PASS' if ok else 'FAIL'}")
    return ok


def eb_balance_audit():
    print("=" * 76)
    print("EB per-sample balance audit at the LAM pin, 0 dBFS sine (T+24):")
    print("  kernel's converged Newton solve vs the closed-form balance and")
    print("  vs this script's exact per-sample solve, classified by regime")
    m = AuditedModel(threshold_db=-24.0, range_db=60.0, ratio_index=1,
                     attack_idx=5, release_idx=0)
    amp = 1.0
    w = base.TAU * 1000.0 / SR
    n = int(1.2 * SR)
    rec = []
    for i in range(n):
        o, _ = m.step(amp * math.sin(w * i), amp * math.sin(w * i))
        if i >= int(0.5 * SR) and i % 7 == 0:
            rec.append(m.records[-1])
    c = coeffs_of(m)
    A, Rh, k = c['a_att'], c['a_rel'], c['k']
    c4 = k + Rh
    den = A + k + Rh
    um = c['u_max']
    worst_int = 0.0        # interior at the kernel's iterate (exit-tol slack)
    worst_int_exact = 0.0  # interior at the exact root: the identity itself
    worst_all = 0.0        # piecewise-exact solve vs the kernel everywhere
    n_under = n_int = n_clamp = 0
    for (y_state, s38_state, x, lut_l) in rec:
        u = x - lut_l
        if u <= 0.0:
            n_under += 1
        elif u >= um:
            n_clamp += 1
        else:
            n_int += 1
            bal = A * (k * y_state + s38_state - x * c4) / den
            sf = 2.0 * M * (math.exp(B * u) - 1.0)
            worst_int = max(worst_int, abs(sf - bal) / max(abs(sf), 1e-12))
            xe = solve_balance(lut_l, y_state, s38_state, c)
            bale = A * (k * y_state + s38_state - xe * c4) / den
            sfe = 2.0 * M * (math.exp(B * (xe - lut_l)) - 1.0)
            worst_int_exact = max(worst_int_exact,
                                  abs(sfe - bale) / max(abs(sfe), 1e-12))
        xb = solve_x_exact(lut_l, y_state, s38_state, c)
        worst_all = max(worst_all, abs(xb - x))
    print(f"  samples audited {len(rec)}: under {n_under}, interior {n_int}, "
          f"u_max-clamped {n_clamp}")
    print(f"  interior at exact root:   max |Sum f - balance|/|Sum f| "
          f"= {worst_int_exact:.2e}  (the identity itself)")
    print(f"  interior at kernel solve: max |Sum f - balance|/|Sum f| "
          f"= {worst_int:.2e}  (Newton exit-tol slack, [K232])")
    print(f"  all       max |x_exact - x_Newton|       = {worst_all:.2e}")


def ec_ladder():
    print("=" * 76)
    print("EC the y-treatment tier ladder — steady applied GR (dB)")
    hdr = (f"  {'pin':>14} {'over':>4} {'device':>8} {'port':>8} "
           f"{'center':>8} {'cycle':>8} {'ripple':>8} {'full':>8} "
           f"{'d full-dev':>10} {'d port-dev':>10}")
    print(hdr)
    worst_fd = 0.0
    cov_max = 0.0
    sig = eq.steps_1k_signal()
    for att in (5, 1):
        c = eq.solver_coeffs(att, 0)
        tab = eq.TABLES_LIST[1]
        hpos, hneg, lut0 = center_tier(c, tab)
        if att == 5:
            print(f"  (center tier, att {att}: lut(0) = {lut0:+.4f}; "
                  f"min h(x>0) = {hpos:+.3e} > 0, max h(x<0) = {hneg:+.3e} < 0"
                  f" -> unique root xbar = 0: GR identically 0)")
        for thr in (-12.0, -24.0):
            # the committed T-12 grid tops at 0 dBFS peak = +12 over
            overs = (6, 12) if thr == -12.0 else OVERS
            out = eq.run_model(thr, RNG, 1, att, 0, sig)
            kmap = eq.K_OF_1K_T12 if thr == -12.0 else eq.K_OF_1K
            pmap = (eq.PEAK_OF_1K_OVER_T12 if thr == -12.0
                    else eq.PEAK_OF_1K_OVER)
            for over in overs:
                peak = thr + over
                cyc = eq.cycle_equilibrium(peak, thr, RNG, 1, att, 0)
                rip = eq.cycle_equilibrium(peak, thr, RNG, 1, att, 0,
                                           rippled=True)
                ful = equilibrium_full(peak, thr, RNG, 1, att, 0)
                port = eq.gr_1k(out, kmap[over], pmap[over])
                _CACHE[(att, thr, over)] = port
                _FULL[(att, thr, over)] = ful
                dev = DEVICE[att][over]
                tag = f"T{thr:+.0f}/R30/A{att}"
                print(f"  {tag:>14} +{over:>3} {dev:8.2f} {port:8.2f} "
                      f"{0.0:8.2f} {cyc:8.2f} {rip:8.2f} {ful:8.2f} "
                      f"{ful - dev:+10.2f} {port - dev:+10.2f}")
                if thr == -24.0:
                    worst_fd = max(worst_fd, abs(ful - dev))
    for att in (5, 1):
        for over in (6, 12):    # the overs both thresholds commit
            cov_max = max(cov_max, abs(_FULL[(att, -12.0, over)]
                                       - _FULL[(att, -24.0, over)]))
    print(f"  worst |full - device| (all ladder rows): {worst_fd:.2f} dB")
    print("  (center column = the constant-cycle-mean substitution: GR = 0 at")
    print("   every depth — it has no compressed fixed point at all.)")
    return cov_max


def ed_residual(cov_max):
    print("=" * 76)
    print("ED residual structure (D = xbar - u_eff, the exp-weighted LUT read)")
    print(f"  {'pin':>6} {'over':>4} {'dev D':>8} {'mod D':>8} {'dD dev-mod':>10}")
    for att in (5, 1):
        for over in OVERS:
            d = eq.inversion(DEVICE[att][over], att, 0)
            m = eq.inversion(_CACHE[(att, -24.0, over)], att, 0)
            print(f"  A{att:<5} +{over:>3} {d['D']:8.3f} {m['D']:8.3f} "
                  f"{d['D'] - m['D']:+10.3f}")
    print("  (thresholds do not enter the inversion — the grid's covariance.)")

    print("\nED2 closure rows — exact port, detector-tap x1.40 (glue.rs"
          " DETECTOR_TAP_GAIN), corrected attack map (stored 2 -> case 2,"
          " stored 5 -> case 5):")
    sig = eq.steps_1k_signal()
    saved = base.LUT_SCALE
    rows = (('LAM(5) T-24/R60', -24.0, 60.0, 5, eq.K_OF_1K,
             eq.PEAK_OF_1K_OVER, DEVICE[5], OVERS),
            ('G2(2)  T-24/R30', -24.0, 30.0, 2, eq.K_OF_1K,
             eq.PEAK_OF_1K_OVER, DEVICE[1], OVERS),
            ('G1(2)  T-12/R30', -12.0, 30.0, 2, eq.K_OF_1K_T12,
             eq.PEAK_OF_1K_OVER_T12, {6: -3.91, 12: -8.12}, (6, 12)))
    worst = 0.0
    try:
        base.LUT_SCALE = 510.99976 * 1.40
        for name, thr, rng, att, kmap, pmap, dev, overs in rows:
            out = eq.run_model(thr, rng, 1, att, 0, sig)
            ds = []
            for over in overs:
                g = eq.gr_1k(out, kmap[over], pmap[over])
                ds.append(g - dev[over])
            worst = max(worst, max(abs(v) for v in ds))
            cells = "  ".join(f"+{o}:{v:+6.2f}" for o, v in zip(OVERS, ds))
            print(f"  {name:<18} {cells}   worst {max(abs(v) for v in ds):.2f}")
    finally:
        base.LUT_SCALE = saved
    print(f"  worst |d| across the three closure rows: {worst:.2f} dB")
    print(f"  (full-tier vs port covariance check, max |d| = {cov_max:.4f} dB)")


_CACHE = {}
_FULL = {}


def main():
    tabs = eq.parse_ratio_tables()
    eq.TABLES_LIST = [tabs['DAT_104cd0a80'], tabs['DAT_104cd1280'],
                      tabs['DAT_104cd1a80']]
    base.RATIO_TABLES = eq.TABLES_LIST

    if not ea_validate():
        return 1
    eb_balance_audit()
    cov = ec_ladder()
    ed_residual(cov)
    return 0


if __name__ == '__main__':
    sys.exit(main())
