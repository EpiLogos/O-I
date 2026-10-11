#!/usr/bin/env python3
# PROVENANCE: owner-private analysis companion for the Glue over-branch
# equilibrium lane (bounded binary+math lane, 2026-10-08). Standing on:
#   devices/glue-perblock-derivation.md (§3/§4/§7, the state-slot ledger),
#   devices/glue-absolute-threshold.md  (§1 covariance law, §3 k-free balance),
#   devices/glue-compressor.md          ("LAM verdict", four-cell grid),
#   evidence/binary/glue-kernel-decompilation.txt ([K178-255]),
#   evidence/binary/glue-ratio-tables.txt (the committed 512-float LUTs),
#   evidence/devices/glue_abs_threshold_sim.py (the validated exact port).
# NOT FOR REDISTRIBUTION. Never enters product source.
#
# Question (the last open mechanism item): the model's ~2 dB covariant
# deep-over deficit — does the over-branch equilibrium, re-derived WITH the
# LUT cycle mean ybar(x) computed from the actual tables, produce the missing
# depth? Or is the mapped law's equilibrium (however solved) the model's own
# numbers, so the residual is a law-shape difference?
#
# Experiments
#   E1  validation: exact port (tables-file LUT) vs committed gate numbers
#   E2  mean-balance inversion at every committed pin (device vs model):
#       the exact k-free cycle-mean balance
#         <sum_legs m(e^{B u}-1)> = -xbar * A*Rh/(A+Rh)
#       (derived below, exact for the mapped law) gives each side's
#       exp-weighted LUT read D = xbar - u_eff.
#   E3  the corrected quasi-static cycle-map equilibrium (constant-G cycle,
#       ybar = xbar*A/(A+Rh) closure, per-sample k-free balance solved
#       pointwise on the shaped-LUT trajectory) vs the exact time-domain
#       port — "solving the balance properly as a function of depth"; its
#       gap to the port is the "ybar treated as constant" treatment error.
#   E4  covariance-preserving lever scan against the committed renders.
#
# Derivation of the mean balance (from [K214-225], s28 = 0, w = 0, s38 -> 0):
#   over-branch solve:  x*denom = -(A+c4)*Phi - A*z,
#     denom = (S+A)k + S*A + (S+A)*Rh = S*(A+k+Rh) + A*(k+Rh),
#     Phi = sum_legs [f(u_c) - x*f'(u_c)]  (u_c + lut_c = x on the interior),
#     z = -k*y[n-1].
#   Substitute: the x*S*(A+k+Rh) terms cancel exactly (the "Sum f' cancel"),
#     x*A*(k+Rh) = -(A+k+Rh)*sum f(u_c) + A*k*y[n-1]
#     =>  sum_legs f(u_c) = A*(k*y[n-1] - x*(k+Rh))/(A+k+Rh)     (per sample)
#   Cycle means (y = one-pole of x, DC gain A/(A+Rh), exact for means):
#     <sum f> = A*(k*ybar - xbar*(k+Rh))/(A+k+Rh) = -xbar*A*Rh/(A+Rh).
# k-free, threshold-free, covariance-invariant — and satisfied by the model
# numerically (glue-absolute-threshold.md verified +2.4% at idx 5).
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glue_abs_threshold_sim as base

HERE = os.path.dirname(os.path.abspath(__file__))
TABLES = os.path.join(HERE, '..', 'binary', 'glue-ratio-tables.txt')

M = base.OVER_M          # 6.8132e-9   [0x98]
B = base.OVER_B          # 19.23077    [0xa4]
UMAX = base.U_MAX        # 0.38866684  [0xc8], idx 0: 0.40361890
ATTACK_US = base.ATTACK_MENU_US
RELEASE_US = base.RELEASE_MENU_US
G_OFF = base.G_LAW_OFFSET_DB         # -18  [K115 literal]
SR = 44100


# ---------------------------------------------------------------- loaders
def parse_ratio_tables(path=TABLES):
    """Parse the three 512-float LUTs from the committed tables file."""
    out = {}
    cur = None
    buf = []
    with open(path) as fh:
        for line in fh:
            s = line.split('(GhidraScript)')[0].strip()
            if s.startswith('== DAT_'):
                if cur is not None:
                    out[cur] = [float(t) for t in ' '.join(buf).split(',') if t.strip()]
                cur = s.split()[-1]
                buf = []
                continue
            if cur is None or not s:
                continue
            if s.startswith('//') or s.startswith('TABLE') or s.startswith('INFO'):
                continue
            buf.append(s)
    if cur is not None:
        out[cur] = [float(t) for t in ' '.join(buf).split(',') if t.strip()]
    for key, val in out.items():
        assert len(val) == 512, (key, len(val))
    return out


def shaped_lut(table, delta, t_ceiling, lut_scale=None):
    """LUT read + Range ceiling shape ([K135-177]) at spread index delta."""
    scale = base.LUT_SCALE if lut_scale is None else lut_scale
    v = base.f32(delta * scale + 0.5)
    i = int(v)
    ic = max(-255, min(255, i))
    frac = base.f32(v - base.f32(ic))
    val = table[255 + ic] * (1.0 - frac) + table[256 + ic] * frac
    if val < -t_ceiling:
        u = max(-2.0, min(2.0, val + t_ceiling))
        val = base.cubic_soft_clip(u) - t_ceiling
    return val


def solver_coeffs(attack_idx, release_idx):
    """The model's coefficient set (mirrors base.Model.__init__)."""
    att_us = ATTACK_US[min(attack_idx, 6)]
    rel_us = RELEASE_US[min(release_idx, 6)]
    tau_rel_smp = base.TAU_PER_MENU_US * rel_us * 1e-6 * SR
    n_blk = 128.0
    a_s1 = 1.0 - math.exp(-2.0 * base.TAU / n_blk)
    a_s2 = 1.0 - math.exp(-base.STAGE2_RATE * base.TAU / n_blk)
    a_att = 1.0 / att_us
    a_rel = 1.0 / rel_us
    p_rel = (1.0 + math.exp(-1.0 / tau_rel_smp)) * 0.5
    k = p_rel * a_rel / (1.0 - p_rel)
    return dict(att_us=att_us, rel_us=rel_us, a_s1=a_s1, a_s2=a_s2,
                a_att=a_att, a_rel=a_rel, k=k,
                dc=a_att / (a_att + a_rel),
                u_max=(base.U_MAX_ATT0 if attack_idx == 0 else UMAX))


def spread_trajectory(amplitude, a_s1, a_s2, n_periods=12):
    """Steady-state spread (e - slow) over one 1 kHz cycle for a sine of the
    given peak amplitude with G = 1 folded out (linear detector chain)."""
    w = base.TAU * 1000.0 / SR
    period = int(round(SR / 1000.0))
    n = period * n_periods
    fast = slow = 0.0
    traj = []
    for i in range(n):
        v = amplitude * math.sin(w * i)
        fast += (v - fast) * a_s1
        e = v - fast
        slow += (e - slow) * a_s2
        traj.append(e - slow)
    return traj[-period:]


# --------------------------------------------------------- committed truth
# Device GR (dB) at over-threshold steps, from the committed gain maps
# (glue-compressor.md; the four-cell grid reproduces LAM to 0.01 dB).
PINS = {
    'LAM':  dict(thr=-24.0, rng=60.0, ratio=1, att=5, rel=0, sig='1k',
                 dev={6: -2.84, 12: -6.33, 18: -10.27, 21: -12.36, 24: -14.51}),
    'G2':   dict(thr=-24.0, rng=30.0, ratio=1, att=1, rel=0, sig='1k',
                 dev={6: -3.91, 12: -8.12, 18: -12.57, 21: -14.87, 24: -17.22}),
    'G1':   dict(thr=-12.0, rng=30.0, ratio=1, att=1, rel=0, sig='1k',
                 dev={6: -3.91, 9: -5.98, 12: -8.12}),
    'DF1':  dict(thr=-24.0, rng=60.0, ratio=0, att=1, rel=0, sig='1k',
                 dev={6: -6.81, 12: -10.01, 18: -13.66, 21: -15.60, 24: -17.43}),
    'DF2':  dict(thr=-24.0, rng=60.0, ratio=2, att=1, rel=0, sig='1k',
                 dev={6: -2.04, 12: -7.34, 18: -12.72, 21: -15.43, 24: -18.15}),
    'G13':  dict(thr=-12.0, rng=30.0, ratio=1, att=5, rel=0, sig='long',
                 dev={6: -1.94, 12: -4.70}),
    'G12':  dict(thr=-12.0, rng=30.0, ratio=1, att=1, rel=0, sig='long',
                 dev={6: -3.91, 12: -8.12}),
    'G14':  dict(thr=-12.0, rng=30.0, ratio=1, att=1, rel=4, sig='long',
                 dev={6: -4.13, 12: -8.37}),
    'G15':  dict(thr=-12.0, rng=30.0, ratio=1, att=5, rel=4, sig='long',
                 dev={6: -3.04, 12: -6.58}),
}
# committed model numbers (gate logs / dossiers) for E1 validation
MODEL_COMMITTED = {
    ('LAM', 6): -1.38, ('LAM', 12): -4.57, ('LAM', 18): -8.31, ('LAM', 24): -12.41,
    ('G2', 6): -2.02, ('G2', 12): -6.07, ('G2', 18): -10.42, ('G2', 24): -14.98,
}
K_OF_1K = {6: 2, 9: 5, 12: 3, 18: 4, 21: 5, 24: 6}
PEAK_OF_1K_OVER = {6: -18.0, 9: -3.0, 12: -12.0, 18: -6.0, 21: -3.0, 24: 0.0}
# T=-12 grid: over = peak + 12 -> +6/-6, +9/-3, +12/0
K_OF_1K_T12 = {6: 4, 9: 5, 12: 6}
PEAK_OF_1K_OVER_T12 = {6: -6.0, 9: -3.0, 12: 0.0}
I_OF_LONG = {6: 2, 12: 3}
LONG_WINDOWS = [(1.5, 2.8), (4.0, 5.3), (6.5, 7.8), (9.0, 10.3)]


# ----------------------------------------------------------- time-domain
def steps_1k_signal():
    return base.steps_1k(SR)


def steps_long_signal():
    n = int(14.5 * SR)
    s = [0.0] * n
    w = base.TAU * 1000.0 / SR
    for i, db in enumerate([-18.0, -12.0, -6.0, 0.0]):
        start = int((0.5 + 2.5 * i) * SR)
        end = min(start + int(2.5 * SR), n)
        a = 10.0 ** (db / 20.0)
        for j in range(start, end):
            s[j] = base.npfloat32(a * math.sin(w * j))
    return s


def gr_1k(out, k, peak_db):
    return base.window_gr(out, SR, k, peak_db)


def pin_gr(pin, out, over):
    if pin['sig'] == '1k':
        if pin['thr'] == -12.0:
            return gr_1k(out, K_OF_1K_T12[over], PEAK_OF_1K_OVER_T12[over])
        return gr_1k(out, K_OF_1K[over], PEAK_OF_1K_OVER[over])
    return gr_long(out, I_OF_LONG[over], pin['thr'] + over)


def gr_long(out, i, peak_db):
    a, b = LONG_WINDOWS[i]
    ia, ib = int(a * SR), int(b * SR)
    r = math.sqrt(sum(v * v for v in out[ia:ib]) / (ib - ia))
    return 20.0 * math.log10(max(r, 1e-12)) - (peak_db - 3.01)


def run_model(thr, rng, ratio, att, rel, signal):
    base.RATIO_TABLES = TABLES_LIST
    m = base.Model(threshold_db=thr, range_db=rng, ratio_index=ratio,
                   attack_idx=att, release_idx=rel)
    out = []
    ap = out.append
    st = m.step
    for v in signal:
        o, _ = st(v, v)
        ap(o)
    return out


# ------------------------------------------------- E2: mean-balance math
def inversion(gr_db, att_idx, rel_idx):
    """GR -> equilibrium quantities via the exact mean balance.
    ybar = GR/7.8; xbar = ybar/DC; <sum f> = |xbar|*A*Rh/(A+Rh);
    u_eff = ln(1+<sum f>/(2m))/B; D = xbar - u_eff (the exp-weighted LUT
    read the trajectory must supply)."""
    c = solver_coeffs(att_idx, rel_idx)
    ybar = gr_db / base.DETECTOR_SCALE
    xbar = ybar / c['dc']
    cur = -xbar * (c['a_att'] * c['a_rel'] / (c['a_att'] + c['a_rel']))
    u_eff = math.log(1.0 + cur / (2.0 * M)) / B
    return dict(ybar=ybar, xbar=xbar, u_eff=u_eff, D=xbar - u_eff)


# ----------------------------------------------- E3: cycle-map equilibrium
def solve_x_point(lut, y_drive, c):
    """Unique root x of  2m(e^{B u}-1) = A*(k*y - x*(k+Rh))/(A+k+Rh),
    u = clamp(x - lut, 0, u_max). Monotone -> bisection."""
    A, Rh, k = c['a_att'], c['a_rel'], c['k']

    def g(x):
        u = min(max(x - lut, 0.0), c['u_max'])
        return 2.0 * M * (math.exp(B * u) - 1.0) \
            - A * (k * y_drive - x * (k + Rh)) / (A + k + Rh)
    lo, hi = lut - 60.0, 60.0
    if g(lo) > 0.0:
        return lo
    if g(hi) < 0.0:
        return hi
    for _ in range(80):
        mid = 0.5 * (lo + hi)
        if g(mid) < 0.0:
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi)


def cycle_equilibrium(peak_db, thr, range_db, ratio, att_idx, rel_idx,
                      rippled=False, verbose=False):
    """Quasi-static over-branch equilibrium with the LUT cycle mean computed
    from the actual table (the corrected ybar(x) treatment).

    Closure: G = 10^((7.8*ybar - T - 18)/20), ybar = xbar*A/(A+Rh).
    Per cycle sample the k-free balance is solved pointwise on the
    shaped-LUT trajectory. rippled=True runs y's over-branch one-pole over
    the solved x cycle and re-solves with y(theta-1) (the k-dependent
    bridge toward the exact port)."""
    c = solver_coeffs(att_idx, rel_idx)
    tab = TABLES_LIST[min(ratio, 2)]
    t_ceiling = abs(-range_db * base.CEIL_LIN * base.CEIL_SCALE) \
        + base.CEIL_CONST - 1.0
    amp = 10.0 ** (peak_db / 20.0)
    traj = spread_trajectory(amp, c['a_s1'], c['a_s2'])
    A = c['a_att']

    ybar = -0.3
    for it in range(300):
        G = 10.0 ** ((base.DETECTOR_SCALE * ybar - thr - G_OFF) / 20.0)
        luts = [shaped_lut(tab, s * G, t_ceiling) for s in traj]
        if rippled:
            x = [0.0] * len(luts)
            y = [ybar] * len(luts)
            for _pass in range(12):
                y_prev = y[-1]
                for i, lut in enumerate(luts):
                    x[i] = solve_x_point(lut, y_prev, c)
                    y[i] = (c['k'] * y_prev + A * x[i]) / (A + c['k'] + c['a_rel'])
                    y_prev = y[i]
            ybar_new = sum(y) / len(y)
        else:
            xs = [solve_x_point(lut, ybar, c) for lut in luts]
            ybar_new = (sum(xs) / len(xs)) * c['dc']
        diff = abs(ybar_new - ybar)
        ybar = ybar_new if (it < 30 or diff > 1e-3) \
            else 0.5 * (ybar + ybar_new)
        if diff < 1e-9:
            break
    if verbose:
        print(f"    cycle-eq: ybar {ybar:.4f} iters {it}")
    return base.DETECTOR_SCALE * ybar  # GR dB


# ------------------------------------------------------------------ main
TABLES_LIST = None


def e1_validate(signal_1k):
    print("=" * 72)
    print("E1 validation: exact port (LUT from glue-ratio-tables.txt) vs "
          "committed model numbers")
    ok = True
    for name, thr, rng, att in (('LAM', -24.0, 60.0, 5), ('G2', -24.0, 30.0, 1)):
        out = run_model(thr, rng, 1, att, 0, signal_1k)
        for over in (6, 12, 18, 24):
            g = gr_1k(out, K_OF_1K[over], PEAK_OF_1K_OVER[over])
            ref = MODEL_COMMITTED[(name, over)]
            flag = 'ok' if abs(g - ref) <= 0.02 else 'MISMATCH'
            ok = ok and abs(g - ref) <= 0.02
            print(f"  {name} +{over:>2}: sim {g:7.3f}  committed {ref:7.2f}  [{flag}]")
    print(f"  E1 {'PASS' if ok else 'FAIL'}")
    return ok


def e2_inversion(model_cache):
    print("=" * 72)
    print("E2 mean-balance inversion (exact k-free cycle-mean balance)")
    print(f"  {'pin':>5} {'over':>4} {'dev xbar':>9} {'mod xbar':>9} "
          f"{'dev u_eff':>9} {'mod u_eff':>9} {'dev D':>8} {'mod D':>8} "
          f"{'dD':>7}")
    for name in ('LAM', 'G2', 'G1', 'G13', 'G12'):
        pin = PINS[name]
        for over in sorted(pin['dev']):
            d = inversion(pin['dev'][over], pin['att'], pin['rel'])
            m = inversion(model_cache[(name, over)], pin['att'], pin['rel'])
            print(f"  {name:>5} +{over:>3} {d['xbar']:9.3f} {m['xbar']:9.3f} "
                  f"{d['u_eff']:9.4f} {m['u_eff']:9.4f} {d['D']:8.3f} "
                  f"{m['D']:8.3f} {d['D'] - m['D']:+7.3f}")
    print("  (D = xbar - u_eff: exp-weighted LUT read; dD = device - model)")


def e3_cycle_map(model_cache):
    print("=" * 72)
    print("E3 corrected cycle-map equilibrium vs exact port")
    print(f"  {'pin':>5} {'over':>4} {'device':>8} {'sim':>8} {'cycle-eq':>9} "
          f"{'ripple-eq':>9} {'eq-sim':>8}")
    for name in ('LAM', 'G2', 'G13', 'G12'):
        pin = PINS[name]
        for over in sorted(pin['dev']):
            peak = pin['thr'] + over
            eq = cycle_equilibrium(peak, pin['thr'], pin['rng'], pin['ratio'],
                                   pin['att'], pin['rel'])
            eqr = cycle_equilibrium(peak, pin['thr'], pin['rng'], pin['ratio'],
                                    pin['att'], pin['rel'], rippled=True)
            sim = model_cache[(name, over)]
            print(f"  {name:>5} +{over:>3} {pin['dev'][over]:8.2f} {sim:8.2f} "
                  f"{eq:9.2f} {eqr:9.2f} {eq - sim:+8.2f}")


def e4_scan():
    """Fine scan of the one lever family the E2 inversion leaves standing
    (trajectory read-depth), plus the refuted levers for the record, then a
    finalist table at the best scale against every committed pin."""
    print("=" * 72)
    print("E4 lever scan (time-domain exact port); d = sim - device")
    saved = (base.G_LAW_OFFSET_DB, base.LUT_SCALE, base.OVER_M, base.OVER_B,
             base.U_MAX, base.U_MAX_ATT0)

    def deltas(tag, pins=('LAM', 'G2')):
        row = {}
        for name in pins:
            pin = PINS[name]
            sigl = steps_1k_signal() if pin['sig'] == '1k' else steps_long_signal()
            out = run_model(pin['thr'], pin['rng'], pin['ratio'], pin['att'],
                            pin['rel'], sigl)
            row[name] = [pin_gr(pin, out, o) - pin['dev'][o]
                         for o in sorted(pin['dev'])]
        cells = ""
        for name, d in row.items():
            cells += f"   {name} d: " + " ".join(f"{v:+6.2f}" for v in d)
        print(f"  {tag:<32}{cells}")
        return row

    try:
        deltas("baseline (ledger)")
        for sc in (1.35, 1.40, 1.45, 1.50):
            base.LUT_SCALE = 510.99976 * sc
            deltas(f"LUT index scale x{sc:.2f}", pins=('LAM',))
        base.LUT_SCALE = saved[1]
        for uf in (1.25, 1.5):
            base.U_MAX = UMAX * uf
            deltas(f"u_max x{uf:.2f}", pins=('G2',))
        base.U_MAX = saved[4]
        # refuted-lever rows, kept for the record (one value each)
        base.G_LAW_OFFSET_DB = -12.0
        deltas("G offset -18->-12 (refuted: hot)", pins=('LAM',))
        base.G_LAW_OFFSET_DB = saved[0]
        base.OVER_M = M * 0.1
        deltas("m x 0.1 (refuted: wrong way)", pins=('LAM',))
        base.OVER_M = saved[2]

        # finalist: best scale against every committed pin
        best = 1.45
        base.LUT_SCALE = 510.99976 * best
        print(f"\n  finalist table at LUT index scale x{best:.2f} "
              "(d = sim - device, dB):")
        worst = 0.0
        for name in ('LAM', 'G2', 'G1', 'DF1', 'DF2', 'G13', 'G12'):
            pin = PINS[name]
            sigl = steps_1k_signal() if pin['sig'] == '1k' else steps_long_signal()
            out = run_model(pin['thr'], pin['rng'], pin['ratio'], pin['att'],
                            pin['rel'], sigl)
            ds = [(o, pin_gr(pin, out, o) - pin['dev'][o])
                  for o in sorted(pin['dev'])]
            w = max(abs(d) for _, d in ds)
            worst = max(worst, w)
            cells = "  ".join(f"+{o}:{d:+6.2f}" for o, d in ds)
            print(f"    {name:<5} {cells}   worst {w:.2f}")
        print(f"  finalist worst |d| = {worst:.2f} dB")
    finally:
        (base.G_LAW_OFFSET_DB, base.LUT_SCALE, base.OVER_M, base.OVER_B,
         base.U_MAX, base.U_MAX_ATT0) = saved
    print("  (baseline = the committed +1.5..+2.2 shallow row.)")


def main():
    global TABLES_LIST
    tabs = parse_ratio_tables()
    TABLES_LIST = [tabs['DAT_104cd0a80'], tabs['DAT_104cd1280'],
                   tabs['DAT_104cd1a80']]
    rs = base.load_ratio1()
    dmax = max(abs(a - b) for a, b in zip(rs, TABLES_LIST[1]))
    print(f"LUT provenance: tables file vs glue.rs RATIO_LUTS[1] max|d| = {dmax:.2e}")
    base.RATIO_TABLES = TABLES_LIST

    sig1k = steps_1k_signal()
    e1_validate(sig1k)

    print("=" * 72)
    print("running exact port at the committed pins ...")
    model_cache = {}
    for name in ('LAM', 'G2', 'G1', 'G13', 'G12', 'DF1', 'DF2'):
        pin = PINS[name]
        sigl = steps_1k_signal() if pin['sig'] == '1k' else steps_long_signal()
        out = run_model(pin['thr'], pin['rng'], pin['ratio'], pin['att'],
                        pin['rel'], sigl)
        for over in pin['dev']:
            model_cache[(name, over)] = pin_gr(pin, out, over)
        row = "  ".join(f"+{o}:{model_cache[(name, o)]:7.2f}"
                        for o in sorted(pin['dev']))
        print(f"  {name}: {row}")

    e2_inversion(model_cache)
    e3_cycle_map(model_cache)
    e4_scan()


if __name__ == '__main__':
    main()
