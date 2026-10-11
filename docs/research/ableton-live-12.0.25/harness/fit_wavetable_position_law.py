#!/usr/bin/env python3
"""Fit the Wavetable INTERIOR position law + leave-one-out validation.

Hypothesis under test (from the pos→harmonics map, analyze_wavetable_position.py):
  "Basic Shapes" = FOUR frames at WavePosition {0, 1/3, 2/3, 1}:
      frame0 sine | frame1 triangle | frame2 saw | frame3 square
  each PEAK-normalized (±1), zero-phase (sine series with the shapes' natural
  signs: triangle's odd harmonics ALTERNATE sign), and an interior position
  reads the LINEAR AMPLITUDE mix of its segment's two bounding frames
  (coherent sum — validated by the phase map: demodulated residuals ≈0°,
  pos-0.25 h3/h7 inverted vs pos-0.5 exactly as the triangle signs require).

    x = 3·p;  i = min(floor(x), 2);  w = x − i
    partial_k(p) = (1−w)·F_i[k] + w·F_{i+1}[k]

Free parameters for the leave-one-out: per-frame gain scalars g1..g3
(ideal = 1.0), fitted by cyclic-coordinate least squares on the fold's
training positions (above-floor harmonics only; floor = −85.9 dBFS + 8 dB
guard, the golden gate's convention). frame0 is pinned (sine, gain 1 — the
RESIDUAL_GAIN calibration anchor). A gain with no training equation in its
fold stays at the ideal 1.0.

Leave-one-out: fit on two of the three interior positions, predict the third.
(pos 0 is not a fold: frame0 is pinned by construction — the prediction is
the sine itself.) STATED thresholds, fixed before the folds ran: held-out
harmonic-profile mean |Δ| ≤ 2.0 dB over above-floor harmonics; steady RMS
within ±0.5 dB.

Rejected alternatives are reported for the record.
"""
import json
import math

# --- measured map (analyze_wavetable_position.py output; note-1 steady) ----
# linear ratios rel pos-0 h1; dBFS; steady RMS dBFS per note (0..3)
MEASURED = {
    0.25: {
        "lin": [0.85797, 0.00113, 0.06572, 0.00069, 0.02456, 0.00053,
                0.01173, 0.00047],
        "dbfs": [-24.44, -82.06, -46.75, -86.28, -55.30, -88.68, -61.72,
                 -89.64],
        "steady": [-27.48, -27.36, -27.36, -27.36],
    },
    0.50: {
        "lin": [0.72342, 0.15295, 0.05755, 0.07785, 0.08079, 0.05370,
                0.03682, 0.03868],
        "dbfs": [-25.92, -39.41, -47.90, -45.28, -44.96, -48.51, -51.78,
                 -51.35],
        "steady": [-28.53, -28.43, -28.43, -28.43],
    },
    0.75: {
        "lin": [0.79538, 0.22951, 0.25333, 0.11677, 0.16109, 0.08045,
                0.11174, 0.05791],
        "dbfs": [-25.09, -35.89, -35.03, -41.76, -38.96, -44.99, -42.14,
                 -47.85],
        "steady": [-26.79, -26.72, -26.72, -26.72],
    },
}
POS0_H1_DBFS = -23.11         # M2 note-1 steady h1 (the linear unit anchor)
STEADY_POS0 = -26.06          # M2 notes 1..3 steady RMS
FLOOR_DBFS = -85.9            # dossier dither-floor estimate
FLOOR_GUARD = 8.0
POSITIONS = [0.25, 0.50, 0.75]


# --- ideal frames, peak-normalized, signed sine-series partials ------------
def frame_partial(fi, k):
    """Signed amplitude of harmonic k (1-based) of frame fi, any k ≥ 1."""
    if fi == 0:                                   # sine
        return 1.0 if k == 1 else 0.0
    if fi == 1:                                   # triangle (signs alternate)
        return ((8 / math.pi ** 2) / k ** 2 * (-1) ** ((k - 1) // 2)
                if k % 2 == 1 else 0.0)
    if fi == 2:                                   # sawtooth
        return (2 / math.pi) / k
    return (4 / math.pi) / k if k % 2 == 1 else 0.0   # square


def segment(pos):
    x = 3.0 * max(0.0, min(1.0, pos))
    i = min(int(x), 2)
    return i, x - i


def mix_partial(pos, k, g=(1.0, 1.0, 1.0)):
    i, w = segment(pos)
    gi = 1.0 if i == 0 else g[i - 1]
    gj = g[i]
    return (1 - w) * gi * frame_partial(i, k) + w * gj * frame_partial(i + 1, k)


def mix_partials(pos, g=(1.0, 1.0, 1.0), kmax=8):
    return [mix_partial(pos, k, g) for k in range(1, kmax + 1)]


def above_floor(pos):
    return [k for k in range(8)
            if MEASURED[pos]["dbfs"][k] > FLOOR_DBFS + FLOOR_GUARD]


def rms_db_rel(pos, g=(1.0, 1.0, 1.0), kmax=48):
    """Steady RMS of the position's partial mix, rel the unit sine (0 dB)."""
    acc = 0.0
    for k in range(1, kmax + 1):
        a = mix_partial(pos, k, g)
        acc += a * a
    return 10 * math.log10(acc / 2 / 0.5)


def coef_row(pos):
    """partial_k(p) = Σ_j coef[k][j]·g[j]; g0..g2 = gains of frames 1..3."""
    i, w = segment(pos)
    coef = []
    for k in range(8):
        kh = k + 1  # harmonic number, 1-based
        row = [0.0, 0.0, 0.0]
        if i == 0:
            row[0] = w * frame_partial(1, kh)
        else:
            row[i - 1] += (1 - w) * frame_partial(i, kh)
            row[i] += w * frame_partial(i + 1, kh)
        coef.append(row)
    return coef


def pinned_partial(pos, k):
    """The frame-0 (pinned, gain-1) share of partial k at pos — nonzero only
    in segment 0, where the lower bounding frame is the sine itself."""
    i, w = segment(pos)
    return (1 - w) * frame_partial(0, k) if i == 0 else 0.0


def fit_gains(train_positions):
    """Cyclic-coordinate LS for (g1,g2,g3), init ideal 1.0, non-negative.

    The measurements are MAGNITUDES; the model partials are SIGNED (the
    shapes' natural signs are part of the hypothesis, confirmed by the
    phase map — not fitted). Each above-floor target therefore takes the
    sign the ideal mix prescribes for it, the pinned frame-0 share is
    subtracted, and the LS is linear in g.
    """
    g = [1.0, 1.0, 1.0]
    rows = []
    for p in train_positions:
        ideal = mix_partials(p, (1.0, 1.0, 1.0))
        target = [
            math.copysign(MEASURED[p]["lin"][k], ideal[k] or 1.0)
            - pinned_partial(p, k + 1)
            for k in range(8)
        ]
        rows.append((p, coef_row(p), target))
    for _ in range(500):
        changed = False
        for j in range(3):
            num = den = 0.0
            for p, coef, target in rows:
                for k in above_floor(p):
                    c = coef[k][j]
                    if abs(c) < 1e-15:
                        continue
                    rest = sum(coef[k][m] * g[m] for m in range(3) if m != j)
                    num += c * (target[k] - rest)
                    den += c * c
            if den > 1e-20:
                new = max(num / den, 1e-6)
                if abs(new - g[j]) > 1e-12:
                    changed = True
                g[j] = new
        if not changed:
            break
    return tuple(g)


def gains_touched(train_positions):
    """Which frame gains have at least one training equation (else ideal)."""
    touched = [False, False, False]
    for p in train_positions:
        i, _ = segment(p)
        if i >= 1:
            touched[i - 1] = True
        touched[i] = True
    return touched


def per_harmonic_deltas(pos, g):
    """measured − model, dB, rel pos-0 h1 (model partials are rel-unit)."""
    mix = mix_partials(pos, g)
    return [MEASURED[pos]["dbfs"][k] - POS0_H1_DBFS
            - 20 * math.log10(max(abs(mix[k]), 1e-9)) for k in range(8)]


def main():
    print("== FULL FIT (all three interior positions, gains free) ==")
    g_full = fit_gains(POSITIONS)
    print(f"   fitted gains g(triangle)={g_full[0]:.4f} "
          f"g(saw)={g_full[1]:.4f} g(square)={g_full[2]:.4f}  (ideal 1.0)")
    for p in POSITIONS:
        d = per_harmonic_deltas(p, g_full)
        idx = above_floor(p)
        mean = sum(abs(d[k]) for k in idx) / len(idx)
        rms_pred = rms_db_rel(p, g_full)
        rms_meas = MEASURED[p]["steady"][1] - STEADY_POS0
        print(f"   pos {p:4.2f}: per-hΔ(meas−model) "
              + " ".join(f"h{k+1}:{d[k]:+6.2f}" for k in idx)
              + f"  mean|Δ| {mean:.2f} dB | RMS pred {rms_pred:+.2f} "
                f"meas {rms_meas:+.2f} Δ {rms_meas - rms_pred:+.2f} dB")

    print("\n== LEAVE-ONE-OUT (thresholds: harmonic mean ≤2.0 dB, RMS ±0.5 dB) ==")
    for held in POSITIONS:
        train = [p for p in POSITIONS if p != held]
        g_fit = fit_gains(train)
        touched = gains_touched(train)
        g = tuple(g_fit[j] if touched[j] else 1.0 for j in range(3))
        d = per_harmonic_deltas(held, g)
        idx = above_floor(held)
        mean = sum(abs(d[k]) for k in idx) / len(idx)
        rms_pred = rms_db_rel(held, g)
        rms_meas = MEASURED[held]["steady"][1] - STEADY_POS0
        verdict_h = "PASS" if mean <= 2.0 else "FAIL"
        verdict_r = "PASS" if abs(rms_meas - rms_pred) <= 0.5 else "FAIL"
        print(f"   hold out pos {held:4.2f}  train {train}  gains "
              f"[{', '.join(f'{v:.4f}' for v in g)}]")
        print(f"      per-hΔ " + " ".join(f"h{k+1}:{d[k]:+6.2f}" for k in idx))
        print(f"      harmonic mean |Δ| {mean:.2f} dB (≤2.0) {verdict_h} | "
              f"RMS pred {rms_pred:+.2f} vs meas {rms_meas:+.2f} "
              f"Δ {rms_meas - rms_pred:+.2f} dB (±0.5) {verdict_r}")

    print("\n== rejected alternatives (for the record) ==")
    b = MEASURED[0.50]["lin"]
    for p in (0.25, 0.75):
        w = p * 2.0
        pred = [(1 - w) * (1.0 if k == 0 else 0.0) + w * b[k]
                for k in range(8)]
        d = [MEASURED[p]["dbfs"][k] - POS0_H1_DBFS
             - 20 * math.log10(max(pred[k], 1e-9)) for k in above_floor(p)]
        print(f"   2-frame crossfade pos {p}: per-hΔ "
              + " ".join(f"{v:+6.1f}" for v in d)
              + f"  mean|Δ| {sum(abs(v) for v in d) / len(d):.2f} dB")
    f1 = b
    pred = [0.5 * (1.0 if k == 0 else 0.0) + 0.5 * f1[k] for k in range(8)]
    d = [MEASURED[0.25]["dbfs"][k] - POS0_H1_DBFS
         - 20 * math.log10(max(pred[k], 1e-9)) for k in above_floor(0.25)]
    print("   3-frames-at-halves pos 0.25: per-hΔ "
          + " ".join(f"{v:+6.1f}" for v in d)
          + f"  mean|Δ| {sum(abs(v) for v in d) / len(d):.2f} dB")
    m = MEASURED[0.25]
    print(f"   5-frames-pure pos 0.25 read as a pure ideal triangle: "
          f"h3/h1 {20 * math.log10(m['lin'][2] / m['lin'][0]):.2f} dB "
          f"vs ideal −19.08; h5/h1 "
          f"{20 * math.log10(m['lin'][4] / m['lin'][0]):.2f} vs −27.96; "
          f"RMS rel pos0 {m['steady'][1] - STEADY_POS0:+.2f} vs pure-triangle "
          f"{rms_db_rel(1 / 3.0):+.2f}")

    with open("/tmp/wv-interp/fit_result.json", "w") as fh:
        json.dump({"gains_full": list(g_full)}, fh)


if __name__ == "__main__":
    main()
