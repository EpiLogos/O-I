#!/usr/bin/env python3
# PROVENANCE: owner-private analysis companion for
# docs/research/ableton-live-12.0.25/devices/glue-absolute-threshold.md.
# Exact Python port of packages/live-dynamics/src/glue.rs CircuitModel::step
# (ledger constants, [K#] kernel lines cited in glue.rs). NOT FOR
# REDISTRIBUTION. Never enters product source.
#
# Purpose: measure the model's own threshold-shift invariance under
# IDENTICAL signal and windows (the committed evidence compared the LAM
# gate's T-24 run against the envelope gate's T-12 run — different windows),
# and scan candidate mechanisms for the device's extra deepening.
import math
import struct

_f32 = struct.Struct('f')
def npfloat32(x):
    return _f32.unpack(_f32.pack(x))[0]

TAU = 2.0 * math.pi
ATTACK_MENU_US = [82.0, 820.0, 2700.0, 8200.0, 27000.0, 82000.0, 270000.0]
RELEASE_MENU_US = [170689.66, 249579.84, 340760.88, 478756.47, 643902.44, 880000.0, 91000.0]
TAU_PER_MENU_US = 0.4701
DETECTOR_SCALE = 7.8
CEIL_SCALE = 0.128205
G_LAW_OFFSET_DB = 18.0
OVER_M = 6.8132e-9
OVER_B = 19.23077
U_MAX = 0.38866684
U_MAX_ATT0 = 0.40361890
STAGE2_RATE = 1.1
CEIL_LIN = 1.2
CEIL_CONST = 0.01
LUT_SCALE = 510.99976

def f32(x):
    return npfloat32(x)

# Ratio-1 LUT (DAT_104cd1280) — embedded from glue.rs RATIO_LUTS[1].
RATIO1 = None  # loaded from the rust source below

def load_ratio1():
    import re
    src = open('/Users/admin/Central/Work/O-I/packages/live-dynamics/src/glue.rs').read()
    m = re.search(r'// DAT_104cd1280\n\s*\[(.*?)\n\s*\],\n\s*// DAT_104cd1a80', src, re.S)
    body = m.group(1)
    vals = [float(v) for v in re.findall(r'-?\d+\.?\d*(?:_?\d+)*e?-?\d*', body.replace('_', ''))]
    # the regex above can mangle; use a simpler split
    vals = []
    for tok in body.replace('\n', ' ').split(','):
        tok = tok.strip().replace('_0', '.0').replace('_', '')
        if not tok:
            continue
        vals.append(float(tok))
    assert len(vals) == 512, len(vals)
    return vals

def lut_lookup(table, delta):
    v = f32(delta * LUT_SCALE + 0.5)
    i = int(v)  # trunc toward zero like Rust `as i32`
    ic = max(-255, min(255, i))
    frac = f32(v - f32(ic))
    lo = table[255 + ic]
    hi = table[256 + ic]
    return lo * (1.0 - frac) + hi * frac

def db_smoother_coeffs(n, s1e8):
    d = 15900.0 * TAU / n * s1e8
    w = min(d, math.pi / 2)
    a = 1.0 / (1.0 + w * w / (d * d))
    b = 1.0 / (1.0 + math.pi * math.pi / (d * d))
    c = math.cos(w)
    num = 2.0 * ((b - a) + c * (a - b) + math.sqrt((1.0 - c * c) * (a - b) * (1.0 - a)))
    den = (c + b - 2.0 * a + 1.0) - c * b
    g = 1.0 if abs(den) < 1e-30 else min(num / den, 1.0)
    if abs(g) < 1e-30:
        return (1.0, 0.0, 1.0)
    h = (math.sqrt(g * g * (g - 2.0) ** 2 * b) / (g * g) + 1.0) / 2.0
    return (g * h, g * (1.0 - h), 1.0 - g)

def cubic_soft_clip(u):
    u3 = u * u * u
    return u + u3 * -0.25 + abs(u) * u3 * 0.0625

class Model:
    def __init__(self, threshold_db=-12.0, range_db=30.0, ratio_index=1,
                 attack_idx=1, release_idx=0, makeup_db=0.0, dry_wet=1.0,
                 peak_clip_in=True, block_size=128, sr=44100,
                 k_override=None, stage1_f_override=None):
        att_us = ATTACK_MENU_US[min(attack_idx, 6)]
        rel_us = RELEASE_MENU_US[min(release_idx, 6)]
        self.sr = sr
        tau_rel_smp = TAU_PER_MENU_US * rel_us * 1e-6 * sr
        n_blk = float(max(block_size, 1))
        f1 = 2.0 if stage1_f_override is None else stage1_f_override
        self.a_s1 = 1.0 - math.exp(-2.0 * TAU / n_blk) if stage1_f_override is None \
            else 1.0 - math.exp(-f1 * TAU / n_blk)
        self.a_s2 = 1.0 - math.exp(-STAGE2_RATE * TAU / n_blk)
        self.a_att_us = 1.0 / att_us
        self.a_rel_us = 1.0 / rel_us
        p_rel = (1.0 + math.exp(-1.0 / tau_rel_smp)) * 0.5
        self.k = p_rel * self.a_rel_us / (1.0 - p_rel) if k_override is None else k_override
        self.g_over = 1.0 / (self.a_att_us + self.k + self.a_rel_us)
        self.g_under = 1.0 / (self.k + self.a_rel_us)
        self.c4 = self.k + self.a_rel_us
        self.u_max = U_MAX_ATT0 if attack_idx == 0 else U_MAX
        s = -range_db
        neg_range = -106.0 if s < -80.0 else s
        wet_mapped = ((math.exp((1.0 - dry_wet) * 6.0) - 1.0) * -0.026197849 + 1.0) \
            if dry_wet > 0.5 else (math.exp(dry_wet * 6.0) - 1.0) * 0.026197849
        self.targets = [threshold_db, makeup_db, neg_range, wet_mapped, self.a_s1]
        self.smoother = db_smoother_coeffs(n_blk, 1.0)
        self.acc = list(self.targets)
        self.inc = [0.0] * 5
        self.fast = [0.0, 0.0]
        self.slow = [0.0, 0.0]
        self.x = 0.0
        self.y = 0.0
        self.s28 = 0.0
        self.s38 = 0.0
        self.det_db = 0.0
        self.app_db = 0.0
        self.det_raw_prev = 0.0
        self.app_raw_prev = 0.0
        self.clip_peak = 0.0
        self.table = RATIO_TABLES[min(ratio_index, 2)]
        self.peak_clip_in = peak_clip_in

    def step(self, in_l, in_r):
        il = max(-20.0, min(20.0, npfloat32(in_l)))
        ir = max(-20.0, min(20.0, npfloat32(in_r)))
        for i in range(5):
            self.acc[i] += self.inc[i]
        acc_thr, acc_makeup, acc_range, acc_wet = self.acc[0], self.acc[1], self.acc[2], self.acc[3]
        g = 10.0 ** ((DETECTOR_SCALE * self.det_db - acc_thr - G_LAW_OFFSET_DB) / 20.0)
        self.fast[0] += (il - self.fast[0]) * self.a_s1
        self.fast[1] += (ir - self.fast[1]) * self.a_s1
        e0 = (il - self.fast[0]) * g
        e1 = (ir - self.fast[1]) * g
        self.slow[0] += (e0 - self.slow[0]) * self.a_s2
        self.slow[1] += (e1 - self.slow[1]) * self.a_s2
        lut_l = lut_lookup(self.table, e0 - self.slow[0])
        lut_r = lut_lookup(self.table, e1 - self.slow[1])
        t = abs(acc_range * CEIL_LIN * CEIL_SCALE) + CEIL_CONST - 1.0
        for lut in ('l', 'r'):
            v = lut_l if lut == 'l' else lut_r
            if v < -t:
                u = max(-2.0, min(2.0, v + t))
                v = cubic_soft_clip(u) - t
            if lut == 'l':
                lut_l = v
            else:
                lut_r = v
        z = -self.k * (self.y - self.s28) - self.s38
        dvar16 = z
        y_state = self.y
        x_it = self.x
        for it in range(11):
            dl = x_it - lut_l
            dr = x_it - lut_r
            if dl > 0.0 or dr > 0.0:
                ul = max(0.0, min(self.u_max, dl))
                ur = max(0.0, min(self.u_max, dr))
                ebl = math.exp(OVER_B * ul)
                ebr = math.exp(OVER_B * ur)
                fpl = OVER_M * OVER_B * ebl
                fpr = OVER_M * OVER_B * ebr
                phi = (OVER_M * (ebl - 1.0) - ul * fpl - lut_l * fpl) \
                    + (OVER_M * (ebr - 1.0) - ur * fpr - lut_r * fpr)
                ssum = fpl + fpr
                denom = (ssum + self.a_att_us) * self.k + ssum * self.a_att_us \
                    + (ssum + self.a_att_us) * self.a_rel_us
                x_new = (-self.a_att_us * dvar16 - self.c4 * phi
                         + self.s28 * self.a_att_us * self.c4) / denom
                y_new = self.g_over * (self.k * (y_state - self.s28) + self.s38
                                       + x_new * self.a_att_us + self.s28 * self.c4)
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
        raw_det = y_new_
        raw_app = acc_makeup + DETECTOR_SCALE * y_new_
        s178, s17c, s180 = self.smoother
        self.det_db = s178 * raw_det + s17c * self.det_raw_prev + s180 * self.det_db
        self.app_db = s178 * raw_app + s17c * self.app_raw_prev + s180 * self.app_db
        self.det_raw_prev = raw_det
        self.app_raw_prev = raw_app
        gain_lin = (1.0 - acc_wet) + acc_wet * 10.0 ** (self.app_db / 20.0)
        outs = []
        for v0 in (il, ir):
            if self.peak_clip_in:
                v = v0 * gain_lin * 1.0592537
                if abs(v) > 0.84139514:
                    vn = max(-2.0, min(2.0, (v + 0.84139514) * 6.304977))
                    lo = cubic_soft_clip(vn) * 0.15860486 - 0.84139514
                    vp = max(-2.0, min(2.0, (v - 0.84139514) * 6.304977))
                    hi = cubic_soft_clip(vp) * 0.15860486 + 0.84139514
                    v = hi if v > 0.84139514 else lo
                v *= 0.94406086
            else:
                v = v0 * gain_lin
            outs.append(npfloat32(v))
        return outs[0], outs[1]

def rms_db(x):
    r = math.sqrt(sum(v*v for v in x) / len(x))
    return 20.0 * math.log10(max(r, 1e-12))

def steps_1k(sr=44100):
    n = int(5.25 * sr)
    s = [0.0]*n
    w = TAU * 1000.0 / sr
    dbs = [-30.0, -24.0, -18.0, -12.0, -6.0, -3.0, 0.0]
    for i, db in enumerate(dbs):
        start = int((0.25 + 0.5 * i) * sr)
        end = min(start + int(0.5 * sr), n)
        a = 10.0 ** (db / 20.0)
        for j in range(start, end):
            s[j] = npfloat32(a * math.sin(w * j))
    return s

def window_gr(out, sr, k, peak_db):
    t0 = 0.25 + 0.5 * k
    a = int((t0 + 0.15) * sr)
    b = int((t0 + 0.45) * sr)
    return rms_db(out[a:b]) - (peak_db - 3.01)

RATIO_TABLES = None

def main():
    global RATIO_TABLES
    RATIO_TABLES = [None, load_ratio1(), None]
    # quick sanity: center read
    print("lut center (ratio 1):", lut_lookup(RATIO_TABLES[1], 0.0))  # expect 0.676386

    sr = 44100
    sig = steps_1k(sr)
    n = len(sig)

    def run(thr, rng, att, **kw):
        m = Model(threshold_db=thr, range_db=rng, attack_idx=att, **kw)
        out = []
        for i in range(n):
            o, _ = m.step(sig[i], sig[i])
            out.append(o)
        return out, m

    print("\n=== E1 validation: model at LAM pins (T-24/R60/idx5), mid-step windows")
    out, _ = run(-24.0, 60.0, 5)
    for i, (k, peak, over) in enumerate([(2, -18.0, 6), (3, -12.0, 12), (4, -6.0, 18), (6, 0.0, 24)]):
        print(f"  +{over:>2} over: model GR {window_gr(out, sr, k, peak):7.2f}   (committed: -1.38/-4.57/-8.31/-12.41)")

    print("\n=== E2 model invariance under identical signal+windows, idx 5")
    for (k, peak, over) in [(2, -18.0, 6), (3, -12.0, 12), (4, -6.0, 18), (6, 0.0, 24)]:
        o12, _ = run(-12.0, 30.0, 5)
        o24, _ = run(-24.0, 60.0, 5)
        g12 = window_gr(o12, sr, k, peak)
        g24 = window_gr(o24, sr, k, peak)
        print(f"  +{over:>2} over: T-12 {g12:7.2f}  T-24 {g24:7.2f}  deepening {g24-g12:+.2f}")

    print("\n=== E2b model invariance, idx 1")
    for (k, peak, over) in [(2, -18.0, 6), (3, -12.0, 12), (4, -6.0, 18), (6, 0.0, 24)]:
        o12, _ = run(-12.0, 30.0, 1)
        o24, _ = run(-24.0, 60.0, 1)
        g12 = window_gr(o12, sr, k, peak)
        g24 = window_gr(o24, sr, k, peak)
        print(f"  +{over:>2} over: T-12 {g12:7.2f}  T-24 {g24:7.2f}  deepening {g24-g12:+.2f}")

if __name__ == '__main__':
    main()
