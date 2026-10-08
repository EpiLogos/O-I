#!/usr/bin/env python3
"""Lane-B batch-1 analysis: Wavetable voice-depth probes (WV6-WV9).

Compact successor of analyze_wavetable.py for this batch:
  - per-note steady RMS + h1..h8 Goertzel profile (note-1 steady window)
  - position law: WV6/WV7 harmonics vs the linear-crossfade prediction
    built from M2 (frame A, pos 0, pure sine) and WV2 (frame B, pos 0.5)
  - WV8: note-1 h1 decay track, fit one-pole tau and linear-ramp shapes
  - WV9: fine Goertzel scan around h1..h3 (unison sidebands) + AM beat rate
"""
import math
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from analyze_render import read_aiff, rms_db
from analyze_wavetable import amp_at, C3

R = __file__.rsplit("/", 1)[0] + "/renders/"


def profile(path, f0=C3):
    rate, bits, x = read_aiff(path)
    notes = []
    for start, vel in [(0.0, 127), (1.0, 96), (2.0, 64), (3.0, 32)]:
        s, e = int((start + 0.15) * rate), int((start + 0.70) * rate)
        notes.append(rms_db(x[s:e]))
    harm = []
    for k in range(1, 9):
        a = amp_at(x, rate, f0 * k, 1.15, 1.70)
        harm.append(20 * math.log10(a / 32768.0))
    return notes, harm


def decay_track(path, f0=C3):
    rate, bits, x = read_aiff(path)
    out = []
    for k in range(0, 141):
        t0 = 1.0 + k * 0.005
        a = amp_at(x, rate, f0, t0, t0 + 0.005)
        out.append(20 * math.log10(a / 32768.0) if a > 0 else -144.0)
    return out


def fit_onpole(track, sustain_db):
    """fit e(t)=s+(1-s)exp(-t/tau) in linear domain to note-1 decay."""
    s = 10 ** (sustain_db / 20.0)
    best = (None, 1e9)
    n0, n1 = 10, 130  # skip attack
    for i in range(1, 60):
        tau = i * 0.01
        err = 0.0
        for k in range(n0, n1):
            t = k * 0.005
            v = s + (1 - s) * math.exp(-t / tau)
            db = 20 * math.log10(max(v, 1e-9))
            err += (db - track[k]) ** 2
        if err < best[1]:
            best = (tau, err)
    return best[0], math.sqrt(best[1] / (n1 - n0))


def sideband_scan(path, f0=C3):
    """Goertzel scan around h1/h2/h3 to resolve unison sidebands."""
    rate, bits, x = read_aiff(path)
    t0, t1 = 1.20, 1.65  # 0.45 s -> 2.2 Hz resolution
    res = {}
    for h, f in ((1, f0), (2, 2 * f0), (3, 3 * f0)):
        peaks = []
        fr = f - 35.0
        while fr <= f + 35.0:
            a = amp_at(x, rate, fr, t0, t1)
            peaks.append((fr, 20 * math.log10(a / 32768.0) if a > 0 else -144))
            fr += 0.5
        # local maxima above (scanmax - 12 dB)
        mx = max(p[1] for p in peaks)
        out = []
        for i in range(1, len(peaks) - 1):
            fr, db = peaks[i]
            if db >= mx - 12 and db >= peaks[i - 1][1] and db >= peaks[i + 1][1]:
                if out and fr - out[-1][0] < 1.5:
                    if db > out[-1][1]:
                        out[-1] = (fr, db)
                else:
                    out.append((fr, db))
        res[h] = (mx, out)
    return res


def am_rate(path, f0=C3):
    """h1 amplitude in sliding 20 ms windows over the steady region."""
    rate, bits, x = read_aiff(path)
    amp = []
    t = 1.15
    while t + 0.02 <= 1.70:
        amp.append(amp_at(x, rate, f0, t, t + 0.02))
        t += 0.01
    mx = max(amp)
    mn = min(amp)
    # count maxima above midpoint
    mid = (mx + mn) / 2
    n = 0
    for i in range(1, len(amp) - 1):
        if amp[i] > mid and amp[i] >= amp[i - 1] and amp[i] >= amp[i + 1]:
            n += 1
    span = len(amp) * 0.01
    return mx, mn, n / span if n > 1 else 0.0


def main():
    files = {"M2": "M2_WAVETABLE.aif",
             "WV6(p0.25)": "WV6_POS25.aif", "WV7(p0.75)": "WV7_POS75.aif",
             "WV8(slope0)": "WV8_SLOPE0.aif", "WV9(unison)": "WV9_UNISON.aif"}
    # WV2 lives only on the probe branch (licence discipline: renders are not
    # added to the main checkout) — git-recover to scratch like the dossier
    # provenance section documents
    import subprocess
    WV2_SCRATCH = "/tmp/laneb-wv2/WV2_POS50.aif"
    import os
    if not os.path.exists(WV2_SCRATCH):
        os.makedirs(os.path.dirname(WV2_SCRATCH), exist_ok=True)
        blob = "feat/live-re-lane-15min-workload:docs/research/ableton-live-12.0.25/harness/renders/WV2_POS50.aif"
        with open(WV2_SCRATCH, "wb") as fh:
            fh.write(subprocess.run(["git", "show", blob], cwd=__file__.rsplit("/", 3)[0] + "/../../..",
                                    capture_output=True, check=True).stdout)
    prof = {}
    for name, f in files.items():
        notes, harm = profile(R + f)
        prof[name] = (notes, harm)
        print(f"== {name} ({f})")
        print("   per-note RMS:", ", ".join(f"{v:7.2f}" for v in notes))
        print("   harmonics  :", ", ".join(f"h{k+1}:{v:7.2f}" for k, v in enumerate(harm)))
    notes, harm = profile(WV2_SCRATCH)
    prof["WV2"] = (notes, harm)
    print("== WV2(p0.5) (git-recovered scratch)")
    print("   per-note RMS:", ", ".join(f"{v:7.2f}" for v in notes))
    print("   harmonics  :", ", ".join(f"h{k+1}:{v:7.2f}" for k, v in enumerate(harm)))

    print("\n== position law: measured delta vs linear-crossfade prediction")
    m2 = prof["M2"][1]
    wv2 = prof["WV2"][1]
    for nm in ("WV6(p0.25)", "WV7(p0.75)"):
        p = 0.25 if "WV6" in nm else 0.75
        row = []
        for k in range(8):
            a0 = 10 ** (m2[k] / 20.0)          # frame A partial k (sine: k>1 ~ floor)
            a1 = 10 ** (wv2[k] / 20.0)         # frame B partial k (measured)
            lin_pred_db = 20 * math.log10((1 - p) * a0 + p * a1)
            meas_db = prof[nm][1][k]
            row.append(f"h{k+1}:{meas_db - lin_pred_db:+6.2f}")
        print(f"   {nm} (measured - predicted, dB):", ", ".join(row))

    print("\n== WV8 slope-0 decay: h1 track vs fits")
    tr8 = decay_track(R + "WV8_SLOPE0.aif")
    trm = decay_track(R + "M2_WAVETABLE.aif")
    tau8, r8 = fit_onpole(tr8, prof["WV8(slope0)"][0][1] - 20 * math.log10(
        10 ** (prof["M2"][0][1] / 20) / 10 ** (prof["WV8(slope0)"][0][1] / 20)) - 0)  # placeholder
    # simpler: fit each track with its own sustain level (note-1 plateau)
    tau8, r8 = fit_onpole(tr8, tr8[135])
    taum, rm = fit_onpole(trm, trm[135])
    print(f"   slope 0.0: best one-pole tau={tau8:.3f}s rms={r8:.2f} dB")
    print(f"   slope 0.5 (M2): tau={taum:.3f}s rms={rm:.2f} dB")
    print("   track samples every 50ms (dB): slope0 vs slope0.5")
    print("     ", [f"{tr8[k]-tr8[0]:6.1f}" for k in range(0, 141, 10)])
    print("     ", [f"{trm[k]-trm[0]:6.1f}" for k in range(0, 141, 10)])
    # linear-ramp hypothesis for slope 0: amplitude from 1 to s over 0.6s
    s8 = 10 ** ((tr8[135] - tr8[0]) / 20.0)
    errs = []
    for k in range(10, 130):
        t = k * 0.005
        v = max(1.0 + (s8 - 1.0) * min(t / 0.6, 1.0), 1e-9)
        errs.append((20 * math.log10(v) - (tr8[k] - tr8[0])) ** 2)
    print(f"   linear-ramp fit residual: {math.sqrt(sum(errs)/len(errs)):.2f} dB rms")

    print("\n== WV9 unison: fine scan + AM")
    for h, (mx, peaks) in sideband_scan(R + "WV9_UNISON.aif").items():
        print(f"   h{h}: peak {mx:6.2f} dBFS; peaks within -12 dB: "
              + ", ".join(f"{fr:.1f}Hz ({db:.1f})" for fr, db in peaks))
    for nm in ("M2", "WV9(unison)"):
        mx, mn, rate = am_rate(R + files[nm])
        print(f"   {nm}: h1 AM max-min {mx:.2f}/{mn:.2f} linear; "
              f"maxima rate {rate:.1f} Hz")


if __name__ == "__main__":
    main()
