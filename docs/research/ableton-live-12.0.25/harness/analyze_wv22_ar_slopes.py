#!/usr/bin/env python3
"""Attack/Release slope families: do the outer segments share the decay's
endpoint-pinned exponential warp v(u) = (exp(-k u) - exp(-k)) / (1 - exp(-k)),
k = C * slope (decay: C = 7.41, devices/wavetable-voice.md rev 4)?

Renders (M2 notes clip: attack 1 ms = 44.1 samples, decay 0.6 s,
sustain 0.5011875629, release 0.6 s; notes at 0/1/2/3 s; loop 5.875 s):
  M2_WAVETABLE    slopes A/D/R = 0/0.5/0.5 (defaults)   harness/renders
  WV22_ASLP0      attack pin 0.0 (= the default value; ET control)
  WV23_RSLP0      release pin 0.0                        harness/renders
  WV24_ASLP1      attack pin +1.0 (the informative A probe) harness/renders

Clean windows (same method discipline as analyze_wv20_slope_warp.py):
  ATTACK  note 0, samples 0..3600 — no predecessor; carrier phase starts at
          ~0 rad at file sample 0 (verified), so the 44-sample ramp is read
          sample-wise. Full-envelope LSQ (attack candidate x rev-4 decay law
          x free gain/phase) per family candidate; k fitted over both signs.
  RELEASE note 3 (off 3.875 s) — the ONLY note whose release has no
          successor (loop wraps at 5.875 s, far past 4.475 s); per-cycle
          peaks, plateau-normalized, fit window u in [0.02, 0.98] with a
          floor guard (points >55 dB below plateau dropped — dither peaks
          reach +-5 LSB there and read a fake tail).
Controls: WV22-vs-M2 sample diff (dither identity expected — the pin IS the
default value), WV24-vs-M2 diff (only the 4 attack ramps may differ),
note-0 decay cross-check of every render vs the rev-4 law (only the pinned
segment may move).
"""
import math
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_render import read_aiff

R = __file__.rsplit("/", 1)[0] + "/renders/"

F0 = 130.81278265
RATE = 44100.0
W0 = 2 * math.pi * F0 / RATE
TA = 0.001000000164            # stored attack time
TD = 0.5999999642              # stored decay/release time
S = 0.5011875629               # stored sustain (linear amplitude ratio)
K_DECAY = 7.41 * 0.5           # rev-4 decay law at slope 0.5
C_DECAY = 7.41                 # rev-4 fitted scalar

RENDERS = [
    ("0 (M2 default)", "M2_WAVETABLE.aif", 0.0),
    ("0.0 (WV22)", "WV22_ASLP0.aif", 0.0),
    ("1.0 (WV24)", "WV24_ASLP1.aif", 1.0),
]
# release pins: M2/WV22/WV24 store 0.5; WV23 stores 0.0
RELEASE = [
    ("0.5 (M2)", "M2_WAVETABLE.aif", 0.5),
    ("0.0 (WV23)", "WV23_RSLP0.aif", 0.0),
]


def expwarp(u, k):
    """remaining fraction; k -> 0 limit is 1 - u."""
    if abs(k) < 1e-9:
        return 1.0 - u
    return (math.exp(-k * u) - math.exp(-k)) / (1.0 - math.exp(-k))


def env_full(t, k_atk):
    """voice envelope model: attack candidate x rev-4 decay law."""
    if t < TA:
        return 1.0 - expwarp(t / TA, k_atk)     # rising 0 -> 1
    ud = (t - TA) / TD
    return S + (1.0 - S) * expwarp(ud, K_DECAY)


def lstsq2(basis, ys):
    s11 = s12 = s22 = b1 = b2 = 0.0
    for (p, q), y in zip(basis, ys):
        s11 += p * p; s12 += p * q; s22 += q * q
        b1 += p * y; b2 += q * y
    det = s11 * s22 - s12 * s12
    return (b1 * s22 - b2 * s12) / det, (b2 * s11 - b1 * s12) / det


def fit_attack(x, k_atk, n1=3600):
    """x = c1*env*sin + c2*env*cos LSQ -> (G, resid rms total/ramp/post)."""
    basis, ys = [], []
    for n in range(n1):
        e = env_full(n / RATE, k_atk)
        basis.append((e * math.sin(W0 * n), e * math.cos(W0 * n)))
        ys.append(float(x[n]))
    c1, c2 = lstsq2(basis, ys)
    G = math.hypot(c1, c2)
    res = [y - (c1 * p + c2 * q) for (p, q), y in zip(basis, ys)]
    r_atk = math.sqrt(sum(r * r for r in res[:45]) / 45)
    r_mid = math.sqrt(sum(r * r for r in res[45:500]) / 455)
    r_all = math.sqrt(sum(r * r for r in res) / len(res))
    return G, r_all, r_atk, r_mid


def refine(scan, step_pairs):
    """scan: fn(x)->rms; returns (argmin, rms) after two refine passes."""
    best_a, best_r = None, 1e18
    a = scan[0]
    while a <= scan[1] + 1e-9:
        r = scan[2](a)
        if r < best_r:
            best_a, best_r = a, r
        a += scan[3]
    for step in step_pairs:
        for d in (-step, 0.0, step):
            r = scan[2](best_a + d)
            if r < best_r:
                best_a, best_r = best_a + d, r
    return best_a, best_r


def cycle_peaks(x, t0, t1, f=F0):
    s, e = int(t0 * RATE), int(t1 * RATE)
    seg = x[s:e]
    zc = [i for i in range(1, len(seg)) if seg[i - 1] < 0 <= seg[i]]
    return [(((a + b) / 2) / RATE + t0, max(abs(v) for v in seg[a:b]))
            for a, b in zip(zc, zc[1:])]


def main():
    data = {}
    for label, fn, atk_sl in RENDERS:
        data[label] = (read_aiff(R + fn)[2], atk_sl)
    m2 = data["0 (M2 default)"][0]
    xw23 = read_aiff(R + "WV23_RSLP0.aif")[2]

    print("== controls ==")
    for label in ("0.0 (WV22)", "1.0 (WV24)"):
        x = data[label][0]
        n = min(len(x), len(m2))
        diffs = [abs(a - b) for a, b in zip(x[:n], m2[:n])]
        mx = max(diffs)
        gt1 = sum(1 for d in diffs if d > 1) / n * 100
        gt8 = sum(1 for d in diffs if d > 8) / n * 100
        big = [(i / RATE, d) for i, d in enumerate(diffs) if d > 8]
        if big:
            ts = sorted({round(t, 3) for t, _ in big})
            reg = f"{len(big)} samples >8 LSB around t={ts}"
        else:
            reg = "none"
        print(f"  {label} vs M2: max|d|={mx:.0f} LSB, >1 LSB {gt1:.2f}%, "
              f">8 LSB {gt8:.3f}%  ({reg})")

    print("\n== attack family fit (note 0, samples 0..3600, decay law held "
          f"at rev-4 k={K_DECAY:.3f}) ==")
    print("  candidate = 1 - expwarp(u, k), u = t / attack_stored; k fitted "
          "over both signs; residual floor = dither (~1.7 LSB rms)")
    for label in ("0 (M2 default)", "0.0 (WV22)", "1.0 (WV24)"):
        x, atk_sl = data[label]
        G0, r0, r_atk0, r_mid0 = fit_attack(x, 0.0)
        kf, rf = refine((-15.0, 15.0, lambda k: fit_attack(x, k)[1], 0.05),
                        (0.01, 0.002))
        Gb, rb, r_atkb, r_midb = fit_attack(x, kf)
        pk = C_DECAY * atk_sl
        Gp, rp, r_atkp, _ = fit_attack(x, pk)
        print(f"  slope {label}:")
        print(f"    linear (k=0):        resid {r0:7.2f} LSB "
              f"(ramp {r_atk0:7.2f}, post {r_mid0:5.2f}), G={G0:.0f}")
        if abs(pk) > 1e-9:
            print(f"    family k={pk:+.2f}:       resid {rp:7.2f} LSB "
                  f"(ramp {r_atkp:7.2f}), G={Gp:.0f}")
        print(f"    free  k={kf:+8.3f}:   resid {rb:7.2f} LSB "
              f"(ramp {r_atkb:7.2f}, post {r_midb:5.2f}), G={Gb:.0f}   "
              f"[family predicts k={pk:+.2f}]")

    print("\n== release family fit (note 3: off 3.875 s, plateau 3.65-3.87 s, "
          "per-cycle peaks, u in [0.02, 0.98], floor-trimmed at -55 dB) ==")
    for label, fn, rel_sl in RELEASE:
        x = m2 if label.endswith("(M2)") else xw23
        cp = cycle_peaks(x, 3.0, 5.0)
        plat = sum(pk for t, pk in cp if 3.65 <= t <= 3.87) / \
            sum(1 for t, pk in cp if 3.65 <= t <= 3.87)
        pts = [(t - 3.875, pk) for t, pk in cp if 3.875 <= t <= 4.475]
        pts = [(tt / TD, pk) for tt, pk in pts if 0.02 <= tt / TD <= 0.98]
        kept = [(u, pk) for u, pk in pts if 20 * math.log10(pk / plat) > -55.0]

        def rms_warp(k, p=kept):
            return math.sqrt(sum((20 * math.log10(pkk / (plat * expwarp(u, k)))) ** 2
                                 for u, pkk in p) / len(p))

        def rms_prod(c, p=kept):
            return math.sqrt(sum((20 * math.log10(
                pkk / (plat * (1 - u) * math.exp(-c * u)))) ** 2
                for u, pkk in p) / len(p))

        kw, rw = refine((-15.0, 15.0, rms_warp, 0.05), (0.01, 0.002))
        cp_, rc = refine((0.0, 8.0, rms_prod, 0.02), (0.005, 0.001))
        pk_fam = C_DECAY * rel_sl
        print(f"  release slope {label}: plateau {20*math.log10(plat/32768):.2f} dBFS "
              f"({len(kept)}/{len(pts)} cycles above floor guard)")
        print(f"    expwarp free k={kw:+7.3f}: resid {rw:.3f} dB   |   "
              f"at family k={pk_fam:+.2f}: resid {rms_warp(pk_fam):.3f} dB")
        print(f"    product (1-u)e^(-cu) free c={cp_:+7.3f}: resid {rc:.3f} dB"
              + (f"   |   at rev-1 c=2.43: resid {rms_prod(2.43):.3f} dB"
                 if rel_sl > 0 else ""))
        row = []
        for u in (0.1, 0.25, 0.5, 0.75, 0.9):
            cand = [pkk for uu, pkk in kept if abs(uu - u) < 0.02]
            if not cand:
                continue
            meas = 20 * math.log10(cand[0] / plat)
            m_w = 20 * math.log10(expwarp(u, kw))
            m_wf = 20 * math.log10(expwarp(u, pk_fam))
            m_c = 20 * math.log10((1 - u) * math.exp(-cp_ * u))
            row.append(f"u{u:.2f} meas{meas:+7.2f} | warp{meas - m_w:+6.2f} "
                       f"fam{meas - m_wf:+6.2f} prod{meas - m_c:+6.2f}")
        print("    residual profile (meas-model, dB):")
        for r in row:
            print(f"      {r}")
        # -40 dB crossing: measured (cycle-peak interpolation) + models
        mc = None
        for (u1, p1), (u2, p2) in zip(kept, kept[1:]):
            d1 = 20 * math.log10(p1 / plat)
            d2 = 20 * math.log10(p2 / plat)
            if d1 >= -40 > d2:
                frac = (d1 + 40) / (d1 - d2)
                mc = 3.875 + (u1 + frac * (u2 - u1)) * TD
                break
        print(f"    -40 dB crossing measured: "
              + (f"{mc:.4f} s" if mc else "not reached within window"))
        for name, val in (("expwarp(free)", kw), ("linear/expwarp(k=0)", 0.0)):
            lo, hi = 0.5, 0.99999
            for _ in range(60):
                mid = (lo + hi) / 2
                if expwarp(mid, val) > 0.01:
                    lo = mid
                else:
                    hi = mid
            print(f"    -40 dB crossing ({name}): {3.875 + (lo+hi)/2*TD:.4f} s")

    print("\n== note-0 decay cross-check (only the pinned segment may move) ==")
    PROBE_MS = (25, 75, 150, 325)
    for label in ("0 (M2 default)", "0.0 (WV22)", "1.0 (WV24)"):
        x, _ = data[label]
        cp = cycle_peaks(x, 0.0, 1.0)
        plat = sum(pk for t, pk in cp if 0.70 <= t <= 0.86) / \
            sum(1 for t, pk in cp if 0.70 <= t <= 0.86)
        row = []
        for ms in PROBE_MS:
            cand = [pk for t, pk in cp if abs(t - ms / 1000.0) <= 0.004]
            if cand:
                row.append(f"+{ms}:{20*math.log10(cand[0]/plat):+5.2f}")
        print(f"  {label:16s} plateau {20*math.log10(plat/32768):6.2f} dBFS  "
              + "  ".join(row))


if __name__ == "__main__":
    main()
