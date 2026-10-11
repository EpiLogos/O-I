#!/usr/bin/env python3
"""Compressor corpus pinning — the applied-gain (GR) composition from BULK.

Offline analysis of the 2026-10-10 BULK corpus, gate wave 2026-10-11.
Reads only committed files: renders/*.aif, live/*.als, signals/*.wav.
Pure stdlib.

What it measures (and what the crate constants cite):

  1. The pin surface: every BULK-compressor-*.als carries the device XML
     Manual values; all eight sets hold exactly the crate DEFAULTS surface
     (Threshold 0.1791548878, Ratio 4, ExpansionRatio 1.14999998, Attack 30,
     Release 120, Gain 3, Knee 0.421875, LookAhead 1, Model 0, LegacyModel 1,
     DryWet 1, GainCompensation false). The pins: ratio-min (Ratio=1),
     gain-min/max (Gain 3 -> -36 / +36), expansionratio-min/max (1 / 2);
     all five pin renders are impulse-only.
  2. Impulse-instant checks: the gain-min impulse peak equals
     unity-chain-peak * 10^(-36/20) (staging unity, user makeup exact); the
     default impulse peak equals unity-chain-peak * 10^(+3/20) * g with
     g = -0.013 dB -> the applied reduction 1 ms after a full-scale spike
     (the lookahead) is ~zero. That pins the ballistic update form: the
     literal `s += exp(-1/tau)*(x-s)` (near-instant response) is refuted;
     the pole form `s = c*s + (1-c)*x`, c = exp(-1/(ms*sr_kHz)), is required
     (0x168/0x170 are the pole; the input weight is 1-c).
  3. The steps-1k static map (default pin): settled reductions per step
     (last 150 ms windows) and the four over-threshold onset trajectories
     paired against the crate's pre-LUT path (detector + closed-form curve,
     pole-form ballistics). The trajectories collapse onto one single-valued
     curve g(red) (shared-bin spread <= 0.05 dB mid-region) — the corpus-
     pinned composition emitted below as GR_TABLE.
  4. Cross-checks: expansionratio pins are dither-identical to the default
     impulse (inert in Model 0, slope select confirmed); the sweep render's
     steady applied gain near 1 kHz matches the steps -6 dBFS step
     (level-domain agreement across signals).

The table is the applied-gain composition (runtime GR LUT x makeup-comp
curve at the corpus pin, GainCompensation off) in dB versus the crate's
reduction in octaves. It pins the composition only; the device LUT's own
domain constants (c20/c24/cap) stay open (compressor-derivation.md s4).

Usage: python3 analyze_compressor_gr.py [renders_dir]
"""
import collections
import gzip
import math
import re
import struct
import sys
from pathlib import Path

LANE = Path(__file__).parent
RENDERS = LANE / "renders"
ALS = LANE / "live"
SIGNALS = LANE / "signals"

STEPS_RENDER = "BULK-compressor-default-steps-1k-wav.aif"
SWEEP_RENDER = "BULK-compressor-default-sweep-20-20k-wav.aif"
STEP_DBS = [-30, -24, -18, -12, -6, -3, 0]
ONSETS = [1.75, 2.25, 2.75, 3.25]  # the four over-threshold step onsets
UNITY_IMPULSE_PEAK = 0.4929  # unity-chain impulse render peak (saturator lane)
MAKEUP_DB = 3.0              # default Gain pin; exact below threshold

# device constants (crate DEFAULTS / compressor-derivation.md s3)
T_LIN = 0.1791548878
KNEE_DB = 0.421875
DB_TO_OCT = math.log2(10.0) / 20.0
SLOPE = -(1.0 - 1.0 / 4.0)

PINS = [
    ("default-impulse", "BULK-compressor-default-impulse-wav.aif"),
    ("ratio-min", "BULK-compressor-pin-ratio-min.aif"),
    ("gain-min", "BULK-compressor-pin-gain-min.aif"),
    ("gain-max", "BULK-compressor-pin-gain-max.aif"),
    ("expansionratio-min", "BULK-compressor-pin-expansionratio-min.aif"),
    ("expansionratio-max", "BULK-compressor-pin-expansionratio-max.aif"),
]


# ---------------------------------------------------------------- readers
def read_aiff_left(path):
    data = Path(path).read_bytes()
    assert data[:4] == b"FORM", path
    pos, rate, ssnd = 12, 0, None
    while pos + 8 <= len(data):
        cid, size = data[pos:pos + 4], struct.unpack(">I", data[pos + 4:pos + 8])[0]
        body = data[pos + 8:pos + 8 + size]
        if cid == b"COMM":
            expon = struct.unpack(">h", body[8:10])[0]
            mant = struct.unpack(">Q", body[10:18])[0]
            rate = int(mant * 2 ** (expon - 16383 - 63))
        elif cid == b"SSND":
            off = struct.unpack(">I", body[0:4])[0]
            ssnd = body[8 + off:]
        pos += 8 + size + (size & 1)
    n = len(ssnd) // 2
    s = struct.unpack(">%dh" % n, ssnd[:2 * n])
    return rate, [v / 32768.0 for v in s[0::2]]


def read_wav_left(path):
    data = Path(path).read_bytes()
    pos, rate, ch, off = 12, 0, 0, None
    while pos + 8 <= len(data):
        cid, size = data[pos:pos + 4], struct.unpack("<I", data[pos + 4:pos + 8])[0]
        body = data[pos + 8:pos + 8 + size]
        if cid == b"fmt ":
            ch = struct.unpack("<H", body[2:4])[0]
            rate = struct.unpack("<I", body[4:8])[0]
        elif cid == b"data":
            off = pos + 8
        pos += 8 + size + (size & 1)
    n = struct.unpack("<I", data[off - 4:off])[0] // 4
    v = list(struct.unpack("<%df" % n, data[off:off + 4 * n]))
    return rate, (v if ch == 1 else v[0::2])


def rms_db(buf):
    if not buf:
        return -144.0
    m = sum(x * x for x in buf) / len(buf)
    return 10 * math.log10(m) if m > 0 else -144.0


def win_rms_db(buf, rate, t0, t1):
    return rms_db(buf[int(t0 * rate):int(t1 * rate)])


def median(vals):
    v = sorted(vals)
    return v[len(v) // 2]


# ------------------------------------------------------- crate pre-LUT path
class PreLutPath:
    """compressor.rs InternalCalc path with the corpus-pinned ballistics:
    pole form `s = c*s + (1-c)*x`, c = exp(-1/(ms*sr_kHz)) [D coefficient
    law 0x168/0x170/0x180, pole reading pinned by this analyzer's impulse +
    plateau evidence]. MAD detector and closed-form soft knee [D s3].
    """

    def __init__(self, sr, attack_ms=30.0, release_ms=120.0):
        srk = float(sr) * 0.001
        self.ca = math.exp(-1.0 / (attack_ms * srk))
        self.cr = math.exp(-1.0 / (release_ms * srk))
        self.cf = math.exp(-1.0 / (attack_ms / 6.0 * srk))
        self.t_oct = math.log2(T_LIN)
        self.k_oct = KNEE_DB * DB_TO_OCT
        self.s1 = self.s2 = 0.0

    def red(self, det):
        self.s1 += (1.0 - (self.ca if det > self.s1 else self.cr)) * (det - self.s1)
        self.s2 += (1.0 - self.cf) * (self.s1 - self.s2)
        env = math.log2(self.s2 + 1e-28)
        lo = self.t_oct - self.k_oct
        if env <= lo:
            return 0.0
        hi = self.t_oct + self.k_oct
        if env > hi:
            return (env - self.t_oct) * SLOPE
        e = 1.0 / (2.0 * self.k_oct)
        t = (env - lo) * e
        return ((self.k_oct + lo + (env - lo) * 0.5) * t
                + self.t_oct * (1.0 - t) - self.t_oct) * SLOPE


# ------------------------------------------------------------------- pins
def parse_als_manual(path):
    x = gzip.open(path, "rb").read().decode("utf-8", "replace")
    i = x.find("<Compressor2 ")
    j = x.find("</Compressor2>", i)
    stack, vals = [], {}
    for m in re.finditer(r"<(/?)([A-Za-z0-9_]+)((?:\s[^>]*?)?)(/?)>", x[i:j]):
        close, name, attrs, selfclose = m.groups()
        if close:
            if stack:
                stack.pop()
            continue
        if selfclose:
            if name == "Manual":
                vm = re.search(r'Value="([^"]*)"', attrs or "")
                vals["/".join(stack)] = vm.group(1) if vm else None
            continue
        stack.append(name)
    return {k.split("/", 1)[1] if "/" in k else k: v for k, v in vals.items()}


def report_pins():
    print("== pin surface (als Manual values; the crate DEFAULTS surface + pins)")
    keys = ["Threshold", "Ratio", "ExpansionRatio", "Attack", "Release", "Gain",
            "Knee", "LookAhead", "DryWet", "Model", "LegacyModel",
            "GainCompensation"]
    for f in sorted(ALS.glob("BULK-compressor-*.als")):
        v = parse_als_manual(f)
        print("  %-44s" % f.stem.replace("BULK-compressor-", ""))
        print("      " + "  ".join("%s=%s" % (k, v.get(k)) for k in keys))


# ------------------------------------------------------------------ checks
def impulse_checks(renders):
    print("\n== impulse-instant checks (peak in first 1 s)")
    bufs = {}
    for label, name in PINS:
        p = Path(renders) / name
        if not p.exists():
            print("  MISSING", name)
            continue
        sr, y = read_aiff_left(p)
        mx = max(range(sr), key=lambda i: abs(y[i]))
        bufs[label] = (y, y[mx])
        print("  %-20s peak %+.6f at %d (%.4f s)" % (label, y[mx], mx, mx / sr))
    if "gain-min" in bufs:
        r = bufs["gain-min"][1] / (UNITY_IMPULSE_PEAK * 10 ** (-36.0 / 20.0))
        print("  gain-min / (unity * 10^-36/20) = %.6f (%+.4f dB) -> staging unity, "
              "user makeup exact" % (r, 20 * math.log10(r)))
    if "default-impulse" in bufs and "gain-min" in bufs:
        r = (bufs["default-impulse"][1] / bufs["gain-min"][1]) / 10 ** (39.0 / 20.0)
        print("  default / gain-min (expect +39 dB) residual %+.4f dB"
              % (20 * math.log10(r)))
    if "gain-max" in bufs:
        print("  gain-max peak %+.4f (render ceiling: +39 dB clips, as expected)"
              % bufs["gain-max"][1])
    d = bufs.get("default-impulse")
    if d:
        g = d[1] / (UNITY_IMPULSE_PEAK * 10 ** (MAKEUP_DB / 20.0))
        print("  default impulse / (unity * 10^+3/20) = %.5f (%+.4f dB) -> reduction "
              "at +1 ms lookahead is ~zero" % (g, 20 * math.log10(g)))
        for other in ("ratio-min", "expansionratio-min", "expansionratio-max"):
            if other in bufs:
                mx = max(abs(a - b) for a, b in zip(d[0], bufs[other][0]))
                print("  %-20s vs default impulse max |d| = %.6f -> %s"
                      % (other, mx, "INERT (dither)" if mx < 1.2e-4 else "LIVE"))


def steps_analysis(renders):
    sr, y = read_aiff_left(Path(renders) / STEPS_RENDER)
    sr_in, x = read_wav_left(SIGNALS / "steps-1k.wav")
    print("\n== steps-1k static map (render %d Hz, input %d Hz, 1:1 timeline)" % (sr, sr_in))
    settled = {}
    for k, db in enumerate(STEP_DBS):
        t0 = 0.25 + 0.5 * k
        g = win_rms_db(y, sr, t0 + 0.35, t0 + 0.50) - (db - 3.0103) - MAKEUP_DB
        settled[k] = g
        print("  step %+3d dBFS: settled reduction %7.3f dB" % (db, g))

    # crate red track (pole form) on the same staircase synthesized at sr
    path = PreLutPath(sr)
    w = 2 * math.pi * 1000.0 / sr
    nlead = int(0.25 * sr)
    step_len = int(0.5 * sr)
    step_span = 7 * step_len
    amps = [10 ** (db / 20.0) for db in STEP_DBS]
    n = len(y)
    red = [0.0] * n
    for i in range(n):
        idx = i - nlead
        det = amps[idx // step_len] * abs(math.sin(w * idx)) if 0 <= idx < step_span else 0.0
        red[i] = path.red(det)

    # trajectory pairing at the four over-threshold onsets
    W = int(0.004 * sr)
    pts = []
    for t0 in ONSETS:
        for a in range(int((t0 - 0.04) * sr), int((t0 + 0.45) * sr), W // 2):
            b = a + W
            if b >= n:
                break
            ta, tb = a / sr, b / sr
            if ta < t0 - 0.001 < tb or ta < t0 < tb:
                continue
            gain = win_rms_db(y, sr, ta, tb) - win_rms_db(x, sr_in, ta, tb)
            pts.append((sum(red[a:b]) / W, gain))
    print("  trajectory points: %d across onsets %s" % (len(pts), ONSETS))

    bins = collections.defaultdict(list)
    for r, g in pts:
        if -1.60 < r < -0.15:
            bins[round(r, 1)].append(g)
    worst = max(((k, max(v) - min(v), len(v)) for k, v in sorted(bins.items())),
                key=lambda s: s[1])
    print("  collapse: worst 0.1-oct bin spread in (-1.60,-0.15) = %.3f dB "
          "(bin %s, n=%d)" % (worst[1], worst[0], worst[2]))

    # anchors: settled crate red (last 150 ms) + settled reductions
    anchors = []
    for k in range(3, 7):
        t0 = 0.25 + 0.5 * k
        rr = sum(red[int((t0 + 0.35) * sr):int((t0 + 0.50) * sr)]) / int(0.15 * sr)
        anchors.append((round(-rr, 4), round(settled[k], 4)))
        print("  anchor: red %+.4f -> gain %7.3f dB" % (rr, settled[k]))

    # table: explicit nonuniform nodes; in-between = medians of nearby points.
    # Node values EXCLUDE the user makeup (+3 dB here): the crate multiplies
    # user makeup separately (0x2ac); the table is the composition only.
    nodes = [(0.0, 0.0)]
    for r0 in (0.02, 0.04, 0.06, 0.08, 0.10, 0.12):
        cand = [g - MAKEUP_DB for r, g in pts if abs(-r - r0) <= 0.012]
        nodes.append((r0, round(median(cand), 4) if cand else None))
    for r0 in (0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60,
               0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 1.00, 1.05, 1.10,
               1.15, 1.20, 1.30, 1.35, 1.40, 1.45, 1.50, 1.55, 1.60):
        cand = [g - MAKEUP_DB for r, g in pts if abs(-r - r0) <= 0.015]
        lo = next((a[0] for a in anchors if a[0] > r0), None)
        if lo is not None:
            cand = [g - MAKEUP_DB for r, g in pts
                    if abs(-r - r0) <= 0.015 and -r < lo - 0.01]
        nodes.append((r0, round(median(cand), 4) if cand else None))
    nodes += anchors  # exact settled points (measured, makeup-free)
    # terminal slope from the last two anchors; extend the table to 1.70
    slope = (anchors[3][1] - anchors[2][1]) / (anchors[3][0] - anchors[2][0])
    nodes.append((1.70, round(anchors[3][1] + slope * (1.70 - anchors[3][0]), 4)))

    nodes = sorted(set(nodes), key=lambda t: t[0])
    filled = [list(p) for p in nodes]
    for i, node in enumerate(filled):
        if node[1] is None:
            lo = next(filled[j] for j in range(i - 1, -1, -1) if filled[j][1] is not None)
            hi = next(filled[j] for j in range(i + 1, len(filled)) if filled[j][1] is not None)
            t = (node[0] - lo[0]) / (hi[0] - lo[0])
            node[1] = round(lo[1] + t * (hi[1] - lo[1]), 4)
    for i in range(1, len(filled)):
        if filled[i][1] > filled[i - 1][1]:
            filled[i][1] = filled[i - 1][1]

    print("\n== GR_TABLE (red->gain nodes; red octaves negative, gain dB) — paste")
    print("   as (red, gain_db) pairs; node 0 is the unit reference")
    print("   terminal slope beyond the last node: %.3f dB/oct" % slope)
    for r, g in filled:
        print("    (-%.2f, %.4f)," % (r, g))

    # gate preview: model = resampled input delayed 1 ms * 10^(table+3 / 20)
    def table(r_oct):
        if r_oct >= 0.0:
            return 0.0
        mag = -r_oct
        prev = filled[0]
        for node in filled[1:]:
            if mag <= node[0]:
                t = (mag - prev[0]) / (node[0] - prev[0]) if node[0] > prev[0] else 0.0
                return prev[1] + t * (node[1] - prev[1])
            prev = node
        return filled[-1][1] + slope * (mag - filled[-1][0])

    la = int(0.001 * sr)  # LookAhead 1 -> 1.0 ms at LegacyModel 1
    model = [0.0] * n
    for i in range(n):
        j = int((i - la) / sr * sr_in)
        src = x[j] if 0 <= i - la and 0 <= j < len(x) else 0.0
        model[i] = src * 10 ** ((table(red[i]) + MAKEUP_DB) / 20.0)
    print("\n== gate preview (render vs model, [t0+0.10, t0+0.40] windows)")
    worst_err = 0.0
    for k, db in enumerate(STEP_DBS):
        t0 = 0.25 + 0.5 * k
        mr = win_rms_db(y, sr, t0 + 0.10, t0 + 0.40)
        mo = win_rms_db(model, sr, t0 + 0.10, t0 + 0.40)
        worst_err = max(worst_err, abs(mo - mr))
        print("  step %+3d : render %7.2f  model %7.2f  err %+6.3f dB" % (db, mr, mo, mo - mr))
    print("  worst |err| = %.3f dB (tol %.1f)" % (worst_err, 0.5))
    return filled, settled


def sweep_crosscheck(renders):
    sr, y = read_aiff_left(Path(renders) / SWEEP_RENDER)
    sr_in, x = read_wav_left(SIGNALS / "sweep-20-20k.wav")
    noff = next(i for i in range(len(y)) if abs(y[i]) > 2e-3)
    g = (win_rms_db(y, sr, noff / sr + 1.5, noff / sr + 2.0)
         - win_rms_db(x, sr_in, 1.5, 2.0))
    print("\n== sweep cross-check: applied gain over [1.5, 2.0) s (640-2450 Hz): "
          "%+.3f dB" % g)


def main():
    renders = Path(sys.argv[1]) if len(sys.argv) > 1 else RENDERS
    report_pins()
    impulse_checks(renders)
    steps_analysis(renders)
    sweep_crosscheck(renders)


if __name__ == "__main__":
    main()
