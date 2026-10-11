# Glue Compressor — parameter table (evidence)

Source: `evidence/devices/GlueCompressor/preset-gentle-limiter.xml`
(factory preset, written by Live 12.0.5d1), cross-checked against the app's
Schema tables (`10.0_326.txt` ff.) and the device panel shown in the running
app (screenshot, 2026-10-07 01:28).

| element | Manual (preset) | MidiControllerRange | UI name (observed) |
| --- | --- | --- | --- |
| On | true | – | device on |
| Threshold | −40 | −40..0 | Threshold (dB) |
| Range | 3 | 0..70 | Range (dB) |
| Makeup | 0 | 0..20 | Makeup (dB) |
| Attack | 2 | 0..6 | Attack |
| Ratio | 1 | 0..2 | Ratio |
| Release | 0 | 0..6 | Release |
| DryWet | 1 | 0..1 | Dry/Wet |
| PeakClipIn | true | – | Soft (clip) |

## Open semantics questions (the render matrix answers these)

1. **Range (0..70, dB-labeled)**: ceiling on gain reduction (limiting preset
   Range=3 supports this) vs ratio-in-tenths vs knee width. Discriminated by
   G3 (Range=10) vs G2/G4 (threshold sweep): a ceiling saturates GR at Range;
   a ratio law scales GR slope.
2. **Ratio (0..2)**: displayed ratio is likely stored+1 (0→1:1, 1→2:1,
   2→3:1) — preset Ratio=1 displayed ≈2:1 in the device panel. Cross-check:
   measured GR at 0 dBFS peak with Ratio=1/Range=30 was −7.89 dB ≈ the 3:1
   textbook value over the knee, which currently fits *Range/10 = ratio*
   better than Ratio=2:1 — the matrix decides.
3. **Attack (0..6) / Release (0..6)**: unit scale unknown (ms/0.1ms divisions
   TBD from the UI readout); G7 (Attack 10×) measures the envelope time
   constant shift.
4. **PeakClipIn=true** maps to the UI "Soft" clip button — element→UI naming
   evidence.

## Measurement anchors (run1.aif: Threshold −12, Range 30, Makeup 0)

in_peak −24→0.00, −18→−0.18, −12→−1.02, −6→−3.43, −3→−5.59, 0→−7.89 (dB,
RMS-referred, sine peak − 3.01 dB = RMS). Release tail −96.35 dBFS (16-bit
floor).
