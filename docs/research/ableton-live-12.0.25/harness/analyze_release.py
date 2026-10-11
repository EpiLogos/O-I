#!/usr/bin/env python3
"""Release analysis for release-probe.wav renders (D6 release constants).

Signal (48k source, render 44.1k, timeline preserved):
  0-2 s   1 kHz at -6 dBFS peak  (in_rms -9.01; T=-12 -> ~+3 dB over)
  2-6 s   1 kHz at -36 dBFS peak (in_rms -39.01; 27 dB UNDER threshold)
  6-7 s   silence

The compressor releases from its loud-segment GR onto the quiet tone.
Per-100 ms RMS on the quiet segment shows GR(t) decaying exponentially;
least-squares fit of ln(GR) gives tau_release. The loud-segment steady GR
is reported too (Release is known to shift the steady state).
"""
import math
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_render import read_aiff, rms_db

QUIET_RMS = -39.01
LOUD_RMS = -9.01


def main(path):
    rate, bits, mono = read_aiff(path)
    print(f"{path}: rate={rate} samples={len(mono)} ({len(mono)/rate:.2f}s)")

    def win(t0, w):
        return rms_db(mono[int(t0 * rate):int((t0 + w) * rate)])

    print("\nloud segment (t=0.25..2.0, 250 ms windows), GR = out - (-9.01):")
    steadies = []
    for k in range(7):
        t = 0.25 + k * 0.25
        gr = win(t, 0.25) - LOUD_RMS
        steadies.append(gr)
        print(f"  t={t:5.2f}  GR {gr:7.2f}")
    loud_steady = sum(steadies[2:]) / len(steadies[2:])
    print(f"  -> loud steady GR (0.75-2.0 s mean): {loud_steady:.2f} dB")

    print("\nquiet segment (per-100 ms RMS windows), GR = out - (-39.01):")
    pts = []
    for k in range(40):
        t = 2.0 + k * 0.1
        gr = win(t, 0.1) - QUIET_RMS
        pts.append((t, gr))
    for i in range(0, len(pts), 2):
        t, gr = pts[i]
        print(f"  t={t:5.2f}  GR {gr:7.2f}")
    base = pts[-1][1]
    print(f"  -> end baseline GR (t=5.9): {base:.3f} dB")

    # tau fit: the recovery completes within ~0.5 s on this signal, so the
    # fit runs on fine 20 ms windows over the first 0.6 s after the step.
    fine = []
    for k in range(30):
        t = 2.0 + k * 0.02
        gr = win(t, 0.02) - QUIET_RMS
        fine.append((t, gr))
    print("\nfine decay (20 ms windows):")
    for i in range(0, 30, 10):
        t0 = fine[i][0]
        print("   t=+%.2fs: " % (t0 - 2.0)
              + " ".join("%5.2f" % g for _, g in fine[i:i + 10]))
    use = [(t, abs(gr)) for t, gr in fine
           if 2.02 <= t <= 2.6 and abs(gr) > 0.25 and abs(gr) < 0.97 * abs(loud_steady)]
    if len(use) < 4:
        print(f"  -> tau fit skipped (only {len(use)} usable points)")
        return
    n = len(use)
    sx = sum(t for t, _ in use)
    sy = sum(math.log(gr) for _, gr in use)
    sxx = sum(t * t for t, _ in use)
    sxy = sum(t * math.log(gr) for t, gr in use)
    denom = n * sxx - sx * sx
    slope = (n * sxy - sx * sy) / denom
    intercept = (sy - slope * sx) / n
    tau = -1.0 / slope
    gr0 = math.exp(intercept)
    # fit quality
    resid = [math.log(gr) - (intercept + slope * t) for t, gr in use]
    rms_resid = math.sqrt(sum(r * r for r in resid) / n)
    print(f"\ntau fit over {n} windows ({use[0][0]:.1f}..{use[-1][0]:.1f} s):")
    print(f"  GR0 (extrapolated to t=2) = {gr0:.2f} dB")
    print(f"  tau = {tau*1000:.0f} ms   (1/slope; ln-domain RMS residual {rms_resid:.3f})")
    for tq in (1.0, 2.0, 3.0):
        gr_t = gr0 * math.exp(-(tq) / tau)
        print(f"  model GR at t=2+{tq:.0f}s: {gr_t:.2f} dB")
    # measured crossings: GR halves
    t_half = None
    for i in range(1, len(pts)):
        if pts[i - 1][1] > gr0 * 0.5 >= pts[i][1]:
            t_half = pts[i][0]
            break
    if t_half is not None:
        print(f"  measured GR half-crossing: t = {t_half:.2f} s "
              f"(+{t_half-2.0:.2f} after step; ln2*tau = {tau*0.693:.2f} s)")


if __name__ == "__main__":
    main(sys.argv[1])
