# BULK corpus pin-quality audit

Offline audit of `harness/bulk/manifest.jsonl` pin entries against their device's same-signal default render (`*-default-impulse-wav` for audio devices; `*-default-m1-velocity` for instruments and MIDI FX, whose pin renders reuse the M1 clip). Frame delta, per channel, in 16-bit LSB; **dither-identical: max |delta| <= 2 LSB** (a real parameter change measures in the hundreds to thousands of LSB). Analyzer: `harness/analyze_bulk_pins.py` (pure stdlib, reads only committed renders).

**Totals: 273 pins — 168 live, 62 inert, 43 vacuous (dither-only silence), 0 not auditable.** Audit classes among live+inert pins: no-op 24, genuine 206, silent-carrier 43.

Inert pins by device: Analog (5), Auto Filter (3), Beat Repeat (2), Cabinet (1), Chorus (1), Chorus-Ensemble (1), Compressor (2), EQ Eight (1), Flanger (5), Glue Compressor (1), Grain Delay (1), Limiter (2), Looper (3), Meld (2), Multiband Dynamics (2), Phaser-Flanger (3), Redux (2), Resonators (2), Roar (4), Saturator (4), Shifter (2), Spectral Resonator (3), Tension (2), Utility (3), Vinyl Distortion (2), Wavetable (3)

## Per-device detail

### Amp (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-amp-pin-gain-min` | Gain=0 | 20846 | 20846/20846 | live |
| `BULK-amp-pin-volume-min` | Volume=0 | 20846 | 20846/20845 | live |
| `BULK-amp-pin-drywet-min` | DryWet=0 | 20847 | 20847/20846 | live |
| `BULK-amp-pin-gain-max` | Gain=10 | 10722 | 10722/10721 | live |
| `BULK-amp-pin-volume-max` | Volume=10 | 5476 | 5476/5476 | live |

### Analog (instrument)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-analog-pin-channelpressureamount1-min` | ChannelPressureAmount1=-1 | 2 | 2/2 | INERT (dither-identical) |
| `BULK-analog-pin-channelpressureamount2-min` | ChannelPressureAmount2=-1 | 2 | 2/2 | INERT (dither-identical) |
| `BULK-analog-pin-mpecc74amount1-min` | MpeCC74Amount1=-1 | 2 | 2/2 | INERT (dither-identical) |
| `BULK-analog-pin-channelpressureamount1-max` | ChannelPressureAmount1=1 | 2 | 2/2 | INERT (dither-identical) |
| `BULK-analog-pin-channelpressureamount2-max` | ChannelPressureAmount2=1 | 2 | 2/2 | INERT (dither-identical) |

### Arpeggiator (midi)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-arpeggiator-pin-freerate-min` | FreeRate=10 | 2 | 2/2 | vacuous (dither-only silence) |
| `BULK-arpeggiator-pin-syncedrate-min` | SyncedRate=4 | 2 | 2/2 | vacuous (dither-only silence) |
| `BULK-arpeggiator-pin-velocitydecay-min` | VelocityDecay=10 | 2 | 2/2 | vacuous (dither-only silence) |
| `BULK-arpeggiator-pin-freerate-max` | FreeRate=1000 | 2 | 2/2 | vacuous (dither-only silence) |
| `BULK-arpeggiator-pin-syncedrate-max` | SyncedRate=13 | 2 | 2/2 | vacuous (dither-only silence) |

### Auto Filter (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-auto-filter-pin-cutoff-min` | Cutoff=20 | 7774 | 7774/7774 | live |
| `BULK-auto-filter-pin-drive-min` | Drive=0 | 2 | 2/2 | INERT (dither-identical; no-op value = default) [set carries 0, manifest 12 — pending rebuild] |
| `BULK-auto-filter-pin-lfoamount-min` | LfoAmount=30 | 2 | 2/2 | INERT (dither-identical) |
| `BULK-auto-filter-pin-cutoff-max` | Cutoff=135 | 12481 | 12481/12481 | live |
| `BULK-auto-filter-pin-drive-max` | Drive=24 | 2 | 2/2 | INERT (dither-identical) |

### Auto Pan (audio)

- NOTE: no pins in manifest; defaults only (signals: impulse.wav, steps-1k.wav, sweep-20-20k.wav)

### Beat Repeat (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-beat-repeat-pin-bandwidth-min` | BandWidth=0.5 | 4568 | 4568/4568 | live |
| `BULK-beat-repeat-pin-dampvolume-min` | DampVolume=0.5 | 5267 | 5267/5265 | live |
| `BULK-beat-repeat-pin-midfreq-min` | MidFreq=50 | 2 | 2/2 | INERT (dither-identical) |
| `BULK-beat-repeat-pin-bandwidth-max` | BandWidth=9 | 12486 | 12486/12484 | live |
| `BULK-beat-repeat-pin-dampvolume-max` | DampVolume=1 | 2 | 2/2 | INERT (dither-identical) |

### Cabinet (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-cabinet-pin-drywet-min` | DryWet=0 | 16069 | 16069/16069 | live |
| `BULK-cabinet-pin-drywet-max` | DryWet=1 | 2 | 2/2 | INERT (dither-identical; no-op value = default) [set carries 1, manifest 0.333333 — pending rebuild] |
| `BULK-cabinet-pin-drywet-mid` | DryWet=0.5 | 11396 | 11396/11396 | live |

- NOTE: BULK-cabinet-pin-drywet-max: length mismatch 352800 vs 441000 samples; min-length compare

### Channel EQ (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-channel-eq-pin-gain-min` | Gain=0.25 | 5191 | 5189/5191 | live |
| `BULK-channel-eq-pin-highshelfgain-min` | HighShelfGain=0.18 | 4387 | 4386/4387 | live |
| `BULK-channel-eq-pin-lowshelfgain-min` | LowShelfGain=0.18 | 829 | 829/829 | live |
| `BULK-channel-eq-pin-gain-max` | Gain=4 | 18953 | 18953/18952 | live |
| `BULK-channel-eq-pin-highshelfgain-max` | HighShelfGain=5.600001 | 39568 | 39567/39568 | live |

### Chord (midi)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-chord-pin-chance1-min` | Chance1=0 | 2 | 2/2 | vacuous (dither-only silence) |
| `BULK-chord-pin-chance2-min` | Chance2=0 | 2 | 2/2 | vacuous (dither-only silence) |
| `BULK-chord-pin-chance3-min` | Chance3=0 | 2 | 2/2 | vacuous (dither-only silence) |
| `BULK-chord-pin-chance1-max` | Chance1=1 | 2 | 2/2 | vacuous (dither-only silence) [set carries 1, manifest 0.5 — pending rebuild] |
| `BULK-chord-pin-chance2-max` | Chance2=1 | 2 | 2/2 | vacuous (dither-only silence) [set carries 1, manifest 0.5 — pending rebuild] |

### Chorus (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-legacy-chorus-pin-feedback-min` | Feedback=0 | 2 | 2/2 | INERT (dither-identical; no-op value = default) [set carries 0, manifest 0.475 — pending rebuild] |
| `BULK-legacy-chorus-pin-highpassfreq-min` | HighPassFreq=20 | 1176 | 1176/1100 | live |
| `BULK-legacy-chorus-pin-modamount-min` | ModAmount=0 | 6467 | 6467/6272 | live |
| `BULK-legacy-chorus-pin-feedback-max` | Feedback=0.95 | 6022 | 5130/6022 | live |
| `BULK-legacy-chorus-pin-highpassfreq-max` | HighPassFreq=15000 | 4875 | 4875/3681 | live |

### Chorus-Ensemble (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-chorus-ensemble-pin-amount-min` | Amount=0 | 18466 | 18466/18466 | live |
| `BULK-chorus-ensemble-pin-feedback-min` | Feedback=0 | 2 | 2/2 | INERT (dither-identical; no-op value = default) [set carries 0, manifest 0.495 — pending rebuild] |
| `BULK-chorus-ensemble-pin-highpassfrequency-min` | HighpassFrequency=2000 | 1979 | 1969/1979 | live |
| `BULK-chorus-ensemble-pin-amount-max` | Amount=1 | 9143 | 9143/8865 | live |
| `BULK-chorus-ensemble-pin-feedback-max` | Feedback=0.99 | 6915 | 6915/6453 | live |

### Collision (instrument)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-collision-pin-volume-min` | Volume=0.7047892213 | 4636 | 4636/3832 | live BUT no-op value = default (delta is render-side variance, not the pin) [set carries 0.7047892213, manifest 0 — pending rebuild] |
| `BULK-collision-pin-volume-max` | Volume=0.7047892213 | 31632 | 31632/28835 | live BUT no-op value = default (delta is render-side variance, not the pin) [set carries 0.7047892213, manifest 1 — pending rebuild] |
| `BULK-collision-pin-volume-mid` | Volume=0.7047892213 | 237 | 237/214 | live BUT no-op value = default (delta is render-side variance, not the pin) [set carries 0.7047892213, manifest 0.5 — pending rebuild] |

### Compressor (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-compressor-pin-expansionratio-min` | ExpansionRatio=1 | 2 | 2/2 | INERT (dither-identical) |
| `BULK-compressor-pin-gain-min` | Gain=-36 | 22546 | 22545/22546 | live |
| `BULK-compressor-pin-ratio-min` | Ratio=1 | 13 | 13/13 | live (marginal, <=16 LSB: at the noise floor) |
| `BULK-compressor-pin-expansionratio-max` | ExpansionRatio=2 | 2 | 2/2 | INERT (dither-identical) |
| `BULK-compressor-pin-gain-max` | Gain=36 | 31701 | 31701/31701 | live |

### Corpus (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-corpus-pin-ampfreq-min` | AmpFreq=-1 | 7 | 6/7 | live (marginal, <=16 LSB: at the noise floor) |
| `BULK-corpus-pin-drive-min` | Drive=0 | 25561 | 24164/25561 | live |
| `BULK-corpus-pin-filterbandwidth-min` | FilterBandWidth=0.5 | 28049 | 26518/28049 | live |
| `BULK-corpus-pin-ampfreq-max` | AmpFreq=1 | 8607 | 8137/8607 | live |
| `BULK-corpus-pin-drive-max` | Drive=1 | 77 | 73/77 | live |

### Delay (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-delay-pin-feedback-min` | Feedback=0 | 3116 | 3116/3116 | live |
| `BULK-delay-pin-filter-bandwidth-min` | Filter_Bandwidth=0.5 | 7217 | 7215/7217 | live |
| `BULK-delay-pin-filter-frequency-min` | Filter_Frequency=49.999996 | 7294 | 7292/7294 | live |
| `BULK-delay-pin-feedback-max` | Feedback=0.95 | 3583 | 3583/3582 | live |
| `BULK-delay-pin-filter-bandwidth-max` | Filter_Bandwidth=9 | 1508 | 1508/1508 | live |

### Drift (instrument)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-drift-pin-cyclingenvelope-ratio-min` | CyclingEnvelope_Ratio=0.25 | 3 | 3/3 | live (marginal, <=16 LSB: at the noise floor) |
| `BULK-drift-pin-filter-frequency-min` | Filter_Frequency=19.999998 | 4328 | 4328/4327 | live |
| `BULK-drift-pin-filter-hipassfrequency-min` | Filter_HiPassFrequency=20479.998 | 4858 | 4858/4857 | live |
| `BULK-drift-pin-cyclingenvelope-ratio-max` | CyclingEnvelope_Ratio=16 | 4 | 4/3 | live (marginal, <=16 LSB: at the noise floor) |
| `BULK-drift-pin-filter-frequency-max` | Filter_Frequency=10009.998049 | 347 | 345/347 | live |

### Drum Buss (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-drum-buss-pin-boomamount-min` | BoomAmount=0 | 6 | 6/5 | live BUT no-op value = default (delta is render-side variance, not the pin) [set carries 0, manifest 0.5 — pending rebuild] |
| `BULK-drum-buss-pin-boomfrequency-min` | BoomFrequency=30 | 4096 | 4096/4096 | live |
| `BULK-drum-buss-pin-crunchamount-min` | CrunchAmount=0 | 8853 | 8853/8852 | live |
| `BULK-drum-buss-pin-boomamount-max` | BoomAmount=1 | 159 | 157/159 | live |
| `BULK-drum-buss-pin-boomfrequency-max` | BoomFrequency=90 | 4932 | 4932/4931 | live |

### Dynamic Tube (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-dynamic-tube-pin-postdrive-min` | PostDrive=-15 | 8157 | 8157/8156 | live |
| `BULK-dynamic-tube-pin-predrive-min` | PreDrive=-15 | 31286 | 31286/31285 | live |
| `BULK-dynamic-tube-pin-autobiasattack-min` | AutoBiasAttack=1 | 212 | 211/212 | live |
| `BULK-dynamic-tube-pin-postdrive-max` | PostDrive=15 | 26668 | 26667/26668 | live |
| `BULK-dynamic-tube-pin-predrive-max` | PreDrive=15 | 619 | 618/619 | live |

### EQ Eight (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-eq-eight-pin-globalgain-min` | GlobalGain=-12 | 12095 | 12095/12095 | live |
| `BULK-eq-eight-pin-globalgain-max` | GlobalGain=12 | 16615 | 16615/16615 | live |
| `BULK-eq-eight-pin-globalgain-mid` | GlobalGain=0 | 2 | 2/2 | INERT (dither-identical; no-op value = default) [set carries 0, manifest -4 — pending rebuild] |

### EQ Three (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-eq-three-pin-freqhi-min` | FreqHi=200 | 11091 | 11091/11091 | live |
| `BULK-eq-three-pin-freqlo-min` | FreqLo=50 | 2250 | 2250/2250 | live |
| `BULK-eq-three-pin-gainhi-min` | GainHi=0.000316 | 22016 | 22016/22015 | live |
| `BULK-eq-three-pin-freqhi-max` | FreqHi=18000 | 29504 | 29504/29503 | live |
| `BULK-eq-three-pin-freqlo-max` | FreqLo=5000 | 21244 | 21244/21243 | live |

### Echo (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-echo-pin-ducking-threshold-min` | Ducking_Threshold=-60 | 3635 | 1785/3635 | live |
| `BULK-echo-pin-feedback-min` | Feedback=0 | 3635 | 1934/3635 | live |
| `BULK-echo-pin-filter-highpassfrequency-min` | Filter_HighPassFrequency=20.000071 | 4473 | 4473/3635 | live |
| `BULK-echo-pin-ducking-threshold-max` | Ducking_Threshold=0 | 3636 | 2713/3636 | live |
| `BULK-echo-pin-feedback-max` | Feedback=1.5 | 26001 | 18502/26001 | live |

### Electric (instrument)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-electric-pin-damperamount-min` | DamperAmount=0 | 63 | 63/63 | live |
| `BULK-electric-pin-forktinevolume-min` | ForkTineVolume=0 | 41 | 41/40 | live |
| `BULK-electric-pin-forktonebarvolume-min` | ForkToneBarVolume=0 | 350 | 350/350 | live |
| `BULK-electric-pin-damperamount-max` | DamperAmount=1 | 580 | 580/580 | live |
| `BULK-electric-pin-forktinevolume-max` | ForkTineVolume=1 | 587 | 586/587 | live |

### Envelope Follower (audio)

- NOTE: no pins in manifest; defaults only (signals: impulse.wav, steps-1k.wav, sweep-20-20k.wav)

### Envelope MIDI (midi)

- NOTE: no pins in manifest; defaults only (signals: m1-velocity)

### Erosion (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-erosion-pin-freq-min` | Freq=300 | 12737 | 9399/12737 | live |
| `BULK-erosion-pin-freq-max` | Freq=18000 | 11822 | 11822/11775 | live |
| `BULK-erosion-pin-freq-mid` | Freq=9150 | 12490 | 12490/7816 | live |

### Filter Delay (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-filter-delay-pin-bandwidth1-min` | BandWidth1=0.5 | 866 | 866/2 | live |
| `BULK-filter-delay-pin-bandwidth2-min` | BandWidth2=0.5 | 151 | 151/149 | live |
| `BULK-filter-delay-pin-bandwidth3-min` | BandWidth3=0.5 | 1947 | 2/1947 | live |
| `BULK-filter-delay-pin-bandwidth1-max` | BandWidth1=9 | 9351 | 9351/2 | live |
| `BULK-filter-delay-pin-bandwidth2-max` | BandWidth2=9 | 1320 | 1320/1320 | live |

### Flanger (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-legacy-flanger-pin-feedback-min` | Feedback=0 | 2 | 2/2 | INERT (dither-identical) |
| `BULK-legacy-flanger-pin-lfoamount-min` | LfoAmount=0 | 2 | 2/2 | INERT (dither-identical) |
| `BULK-legacy-flanger-pin-delaytime-min` | DelayTime=0.1 | 2 | 2/2 | INERT (dither-identical) |
| `BULK-legacy-flanger-pin-feedback-max` | Feedback=0.99 | 2 | 2/2 | INERT (dither-identical) |
| `BULK-legacy-flanger-pin-lfoamount-max` | LfoAmount=1 | 2 | 2/2 | INERT (dither-identical; no-op value = default) [set carries 1, manifest 0.5 — pending rebuild] |

### Frequency Shifter (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-legacy-frequency-shifter-pin-amount-min` | Amount=0 | 15762 | 15762/15719 | live |
| `BULK-legacy-frequency-shifter-pin-drive-min` | Drive=0 | 7494 | 2507/7494 | live |
| `BULK-legacy-frequency-shifter-pin-lfoamount-min` | LfoAmount=0 | 6104 | 1548/6104 | live |
| `BULK-legacy-frequency-shifter-pin-amount-max` | Amount=0.5 | 11330 | 11320/11330 | live |
| `BULK-legacy-frequency-shifter-pin-drive-max` | Drive=24 | 4595 | 17/4595 | live |

### Gate (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-gate-pin-gain-min` | Gain=-75 | 2 | 2/2 | vacuous (dither-only silence) [set carries -75, manifest -37.5 — pending rebuild] |
| `BULK-gate-pin-threshold-min` | Threshold=0.01 | 560 | 560/560 | live |
| `BULK-gate-pin-attack-min` | Attack=0.02 | 2 | 2/2 | vacuous (dither-only silence) |
| `BULK-gate-pin-gain-max` | Gain=0 | 15545 | 15545/15545 | live |
| `BULK-gate-pin-threshold-max` | Threshold=1.412538 | 2 | 2/2 | vacuous (dither-only silence) |

### Glue Compressor (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-glue-compressor-pin-ratio-min` | Ratio=0 | 22 | 22/21 | live |
| `BULK-glue-compressor-pin-threshold-min` | Threshold=-40 | 115 | 115/115 | live |
| `BULK-glue-compressor-pin-attack-min` | Attack=0 | 1194 | 1194/1193 | live |
| `BULK-glue-compressor-pin-ratio-max` | Ratio=2 | 2 | 2/2 | INERT (dither-identical) |
| `BULK-glue-compressor-pin-threshold-max` | Threshold=0 | 26 | 26/26 | live |

### Grain Delay (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-grain-delay-pin-feedback-min` | Feedback=0 | 2877 | 2877/2002 | live |
| `BULK-grain-delay-pin-freq-min` | Freq=1 | 2 | 2/2 | INERT (dither-identical; no-op value = default) [set carries 1, manifest 75.5 — pending rebuild] |
| `BULK-grain-delay-pin-newdrywet-min` | NewDryWet=0 | 13546 | 13545/13546 | live |
| `BULK-grain-delay-pin-feedback-max` | Feedback=0.95 | 3614 | 3614/3473 | live |
| `BULK-grain-delay-pin-freq-max` | Freq=150 | 9176 | 8915/9176 | live |

### Hybrid Reverb (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-hybrid-reverb-pin-algorithm-prism-crossoverfrequency-min` | Algorithm_Prism_CrossoverFrequency=399.999969 | 155 | 155/119 | live |
| `BULK-hybrid-reverb-pin-algorithm-tidesamount-min` | Algorithm_TidesAmount=0 | 102 | 97/102 | live |
| `BULK-hybrid-reverb-pin-eq-highbandfrequency-min` | Eq_HighBandFrequency=19.999998 | 127 | 125/127 | live |
| `BULK-hybrid-reverb-pin-algorithm-prism-crossoverfrequency-max` | Algorithm_Prism_CrossoverFrequency=5499.99951 | 137 | 137/113 | live |
| `BULK-hybrid-reverb-pin-algorithm-tidesamount-max` | Algorithm_TidesAmount=1 | 83 | 83/80 | live |

### Impulse (instrument)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-impulse-pin-decaydrive-0-min` | DecayDrive.0=0 | 2 | 2/2 | vacuous (dither-only silence) [set carries 0, manifest 18 — pending rebuild] |
| `BULK-impulse-pin-decaydrive-1-min` | DecayDrive.1=0 | 2 | 2/2 | vacuous (dither-only silence) [set carries 0, manifest 18 — pending rebuild] |
| `BULK-impulse-pin-decaydrive-2-min` | DecayDrive.2=0 | 2 | 2/2 | vacuous (dither-only silence) [set carries 0, manifest 36 — pending rebuild] |
| `BULK-impulse-pin-decaydrive-0-max` | DecayDrive.0=36 | 2 | 2/2 | vacuous (dither-only silence) |
| `BULK-impulse-pin-decaydrive-1-max` | DecayDrive.1=36 | 2 | 2/2 | vacuous (dither-only silence) |

### LFO (audio)

- NOTE: no pins in manifest; defaults only (signals: impulse.wav, steps-1k.wav, sweep-20-20k.wav)

### Limiter (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-limiter-pin-gain-min` | Gain=-24 | 16089 | 16089/16089 | live |
| `BULK-limiter-pin-release-min` | Release=0.01 | 2 | 2/2 | INERT (dither-identical) |
| `BULK-limiter-pin-gain-max` | Gain=24 | 14548 | 14547/14548 | live |
| `BULK-limiter-pin-release-max` | Release=3000 | 2 | 2/2 | INERT (dither-identical) |
| `BULK-limiter-pin-gain-mid` | Gain=0 | 957 | 957/956 | live |

### Looper (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-looper-pin-feedback-min` | Feedback=0 | 2 | 2/2 | INERT (dither-identical) |
| `BULK-looper-pin-feedback-max` | Feedback=1 | 2 | 2/2 | INERT (dither-identical; no-op value = default) [set carries 1, manifest 0.333333 — pending rebuild] |
| `BULK-looper-pin-feedback-mid` | Feedback=0.5 | 2 | 2/2 | INERT (dither-identical) |

### MPE Control (midi)

- NOTE: no pins in manifest; defaults only (signals: m1-velocity)

### Meld (instrument)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-meld-pin-meldvoice-drive-min` | MeldVoice_Drive=0 | 2 | 2/2 | INERT (dither-identical; no-op value = default) [set carries 0, manifest 0.5 — pending rebuild] |
| `BULK-meld-pin-meldvoice-enginea-filter-frequency-min` | MeldVoice_EngineA_Filter_Frequency=19.999998 | 2297 | 2296/2297 | live |
| `BULK-meld-pin-meldvoice-enginea-volume-min` | MeldVoice_EngineA_Volume=-50 | 2175 | 2174/2175 | live |
| `BULK-meld-pin-meldvoice-drive-max` | MeldVoice_Drive=1 | 1732 | 1732/1732 | live |
| `BULK-meld-pin-meldvoice-enginea-filter-frequency-max` | MeldVoice_EngineA_Filter_Frequency=20479.998 | 2 | 2/2 | INERT (dither-identical; no-op value = default) [set carries 20479.998, manifest 10249.998999 — pending rebuild] |

### Multiband Dynamics (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-multiband-dynamics-pin-aboveratiohigh-min` | AboveRatioHigh=-1 | 767 | 767/767 | live |
| `BULK-multiband-dynamics-pin-aboveratiolow-min` | AboveRatioLow=-1 | 2 | 2/2 | INERT (dither-identical) |
| `BULK-multiband-dynamics-pin-aboveratiomid-min` | AboveRatioMid=-1 | 9 | 9/8 | live (marginal, <=16 LSB: at the noise floor) |
| `BULK-multiband-dynamics-pin-aboveratiohigh-max` | AboveRatioHigh=1 | 10892 | 10892/10891 | live |
| `BULK-multiband-dynamics-pin-aboveratiolow-max` | AboveRatioLow=1 | 2 | 2/2 | INERT (dither-identical) |

### Note Echo (midi)

- NOTE: no pins in manifest; defaults only (signals: m1-velocity)

### Note Length (midi)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-note-length-pin-decaykeyscale-min` | DecayKeyScale=-1 | 2 | 2/2 | vacuous (dither-only silence) |
| `BULK-note-length-pin-decaytime-min` | DecayTime=10 | 2 | 2/2 | vacuous (dither-only silence) |
| `BULK-note-length-pin-timelength-min` | TimeLength=10 | 2 | 2/2 | vacuous (dither-only silence) |
| `BULK-note-length-pin-decaykeyscale-max` | DecayKeyScale=1 | 2 | 2/2 | vacuous (dither-only silence) |
| `BULK-note-length-pin-decaytime-max` | DecayTime=60000 | 2 | 2/2 | vacuous (dither-only silence) [set carries 60000, manifest 30005 — pending rebuild] |

### Operator (instrument)

- NOTE: no pins in manifest; defaults only (signals: m1-velocity)

### Overdrive (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-overdrive-pin-bandwidth-min` | BandWidth=0.5 | 6522 | 6522/6522 | live |
| `BULK-overdrive-pin-drive-min` | Drive=0 | 4288 | 4288/4287 | live |
| `BULK-overdrive-pin-midfreq-min` | MidFreq=50 | 5883 | 5883/5883 | live |
| `BULK-overdrive-pin-bandwidth-max` | BandWidth=9 | 789 | 787/789 | live |
| `BULK-overdrive-pin-drive-max` | Drive=100 | 3432 | 3431/3432 | live |

### Pedal (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-pedal-pin-gain-min` | Gain=0 | 1041 | 1041/1041 | live |
| `BULK-pedal-pin-drywet-min` | DryWet=0 | 6660 | 6660/6660 | live |
| `BULK-pedal-pin-output-min` | Output=-20 | 1724 | 1723/1724 | live |
| `BULK-pedal-pin-gain-max` | Gain=1 | 1682 | 1682/1682 | live |
| `BULK-pedal-pin-drywet-max` | DryWet=1 | 6661 | 6660/6661 | live |

### Phaser (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-legacy-phaser-pin-centerfrequency-min` | CenterFrequency=70 | 7261 | 6154/7261 | live |
| `BULK-legacy-phaser-pin-feedback-min` | Feedback=0 | 2845 | 2845/2435 | live |
| `BULK-legacy-phaser-pin-lfoamount-min` | LfoAmount=0 | 3968 | 3045/3968 | live |
| `BULK-legacy-phaser-pin-centerfrequency-max` | CenterFrequency=18500 | 9062 | 9058/9062 | live |
| `BULK-legacy-phaser-pin-feedback-max` | Feedback=0.99 | 698 | 599/698 | live |

### Phaser-Flanger (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-phaser-flanger-pin-centerfrequency-min` | CenterFrequency=70 | 2 | 2/2 | INERT (dither-identical) |
| `BULK-phaser-flanger-pin-feedback-min` | Feedback=0 | 2 | 2/2 | INERT (dither-identical; no-op value = default) [set carries 0, manifest 0.495 — pending rebuild] |
| `BULK-phaser-flanger-pin-modulation-amount-min` | Modulation_Amount=0 | 8012 | 8012/8010 | live |
| `BULK-phaser-flanger-pin-centerfrequency-max` | CenterFrequency=18500 | 2 | 2/2 | INERT (dither-identical) |
| `BULK-phaser-flanger-pin-feedback-max` | Feedback=0.99 | 15518 | 15516/15518 | live |

### Pitch (midi)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-pitch-pin-stepwidth-min` | StepWidth=1 | 2 | 2/2 | vacuous (dither-only silence) |
| `BULK-pitch-pin-stepwidthscaledegrees-min` | StepWidthScaleDegrees=1 | 2 | 2/2 | vacuous (dither-only silence) |
| `BULK-pitch-pin-stepwidth-max` | StepWidth=48 | 2 | 2/2 | vacuous (dither-only silence) |
| `BULK-pitch-pin-stepwidthscaledegrees-max` | StepWidthScaleDegrees=30 | 2 | 2/2 | vacuous (dither-only silence) |
| `BULK-pitch-pin-stepwidth-mid` | StepWidth=24.5 | 2 | 2/2 | vacuous (dither-only silence) |

### Random (midi)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-random-pin-chance-min` | Chance=0 | 2 | 2/2 | vacuous (dither-only silence) |
| `BULK-random-pin-choices-min` | Choices=1 | 2 | 2/2 | vacuous (dither-only silence) [set carries 1, manifest 12.5 — pending rebuild] |
| `BULK-random-pin-scale-min` | Scale=1 | 2 | 2/2 | vacuous (dither-only silence) [set carries 1, manifest 24 — pending rebuild] |
| `BULK-random-pin-chance-max` | Chance=1 | 2 | 2/2 | vacuous (dither-only silence) |
| `BULK-random-pin-choices-max` | Choices=24 | 2 | 2/2 | vacuous (dither-only silence) |

### Redux (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-redux-pin-bitdepth-min` | BitDepth=1 | 2 | 2/2 | INERT (dither-identical; no-op value = default) [set carries 1, manifest 8.5 — pending rebuild] |
| `BULK-redux-pin-drywet-min` | DryWet=0 | 16153 | 16152/16153 | live |
| `BULK-redux-pin-postfiltervalue-min` | PostFilterValue=-4 | 3696 | 3696/3694 | live |
| `BULK-redux-pin-bitdepth-max` | BitDepth=16 | 5560 | 5560/5559 | live |
| `BULK-redux-pin-drywet-max` | DryWet=1 | 2 | 2/2 | INERT (dither-identical; no-op value = default) [set carries 1, manifest 0.5 — pending rebuild] |

### Redux Legacy (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-legacy-redux-legacy-pin-bitdepth-min` | BitDepth=1 | 32761 | 32761/32760 | live |
| `BULK-legacy-redux-legacy-pin-bitdepth-max` | BitDepth=16 | 9 | 9/9 | live (marginal, <=16 LSB: at the noise floor) |
| `BULK-legacy-redux-legacy-pin-bitdepth-mid` | BitDepth=8.5 | 145 | 145/145 | live |

### Resonators (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-resonators-pin-globalgain-min` | GlobalGain=-15 | 1261 | 1196/1261 | live |
| `BULK-resonators-pin-infilterfreq-min` | InFilterFreq=50 | 2 | 2/2 | INERT (dither-identical; no-op value = default) [set carries 50, manifest 4025 — pending rebuild] |
| `BULK-resonators-pin-resgain1-min` | ResGain1=0.000316 | 1138 | 1137/1138 | live |
| `BULK-resonators-pin-globalgain-max` | GlobalGain=15 | 2898 | 2755/2898 | live |
| `BULK-resonators-pin-infilterfreq-max` | InFilterFreq=8000 | 2 | 2/2 | INERT (dither-identical) |

### Reverb (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-reverb-pin-allpassgain-min` | AllPassGain=0.001 | 273 | 166/273 | live |
| `BULK-reverb-pin-bandfreq-min` | BandFreq=49.999996 | 380 | 345/380 | live |
| `BULK-reverb-pin-bandwidth-min` | BandWidth=0.5 | 362 | 319/362 | live |
| `BULK-reverb-pin-allpassgain-max` | AllPassGain=0.96 | 247 | 140/247 | live |
| `BULK-reverb-pin-bandfreq-max` | BandFreq=18000.0059 | 541 | 541/495 | live |

### Roar (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-roar-pin-feedback-feedbackamount-min` | Feedback_FeedbackAmount=0 | 2 | 2/2 | INERT (dither-identical; no-op value = default) [set carries 0, manifest 0.5 — pending rebuild] |
| `BULK-roar-pin-feedback-feedbackbandwidth-min` | Feedback_FeedbackBandwidth=0.5 | 2 | 2/2 | INERT (dither-identical; no-op value = default) [set carries 0.5, manifest 4.75 — pending rebuild] |
| `BULK-roar-pin-feedback-feedbackfrequency-min` | Feedback_FeedbackFrequency=49.999996 | 2 | 2/2 | INERT (dither-identical; no-op value = default) [set carries 49.999996, manifest 18000.0059 — pending rebuild] |
| `BULK-roar-pin-feedback-feedbackamount-max` | Feedback_FeedbackAmount=1 | 22184 | 22184/22184 | live |
| `BULK-roar-pin-feedback-feedbackbandwidth-max` | Feedback_FeedbackBandwidth=9 | 2 | 2/2 | INERT (dither-identical) |

### Sampler (instrument)

- NOTE: no pins in manifest; defaults only (signals: m1-velocity)

### Saturator (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-saturator-pin-basedrive-min` | BaseDrive=-36 | 2 | 2/2 | INERT (dither-identical) |
| `BULK-saturator-pin-colordepth-min` | ColorDepth=-24 | 2 | 2/2 | INERT (dither-identical) |
| `BULK-saturator-pin-colorfrequency-min` | ColorFrequency=30 | 3 | 3/2 | live (marginal, <=16 LSB: at the noise floor) |
| `BULK-saturator-pin-basedrive-max` | BaseDrive=36 | 2 | 2/2 | INERT (dither-identical) |
| `BULK-saturator-pin-colordepth-max` | ColorDepth=24 | 2 | 2/2 | INERT (dither-identical) |

### Scale (midi)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-scale-pin-base-min` | Base=0 | 2 | 2/2 | vacuous (dither-only silence) [set carries 0, manifest 5.5 — pending rebuild] |
| `BULK-scale-pin-lowest-min` | Lowest=0 | 2 | 2/2 | vacuous (dither-only silence) [set carries 0, manifest 63.5 — pending rebuild] |
| `BULK-scale-pin-mapping-0-min` | Mapping.0=-1 | 2 | 2/2 | vacuous (dither-only silence) |
| `BULK-scale-pin-base-max` | Base=11 | 2 | 2/2 | vacuous (dither-only silence) |
| `BULK-scale-pin-lowest-max` | Lowest=127 | 2 | 2/2 | vacuous (dither-only silence) |

### Shaper (audio)

- NOTE: no pins in manifest; defaults only (signals: impulse.wav, steps-1k.wav, sweep-20-20k.wav)

### Shifter (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-shifter-pin-delay-feedback-min` | Delay_Feedback=0 | 1291 | 1291/1290 | live |
| `BULK-shifter-pin-envelopefollower-amounthz-min` | EnvelopeFollower_AmountHz=-5000 | 2 | 2/2 | INERT (dither-identical) |
| `BULK-shifter-pin-envelopefollower-amountpitch-min` | EnvelopeFollower_AmountPitch=-24 | 2730 | 2730/2730 | live |
| `BULK-shifter-pin-delay-feedback-max` | Delay_Feedback=1.5 | 28959 | 28959/28958 | live |
| `BULK-shifter-pin-envelopefollower-amounthz-max` | EnvelopeFollower_AmountHz=5000 | 2 | 2/2 | INERT (dither-identical) |

### Simpler (instrument)

- NOTE: no pins in manifest; defaults only (signals: m1-velocity)

### Spectral Resonator (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-spectral-resonator-pin-decaydamping-highfreqdamp-min` | DecayDamping_HighFreqDamp=0 | 35 | 35/34 | live |
| `BULK-spectral-resonator-pin-decaydamping-lowfreqdamp-min` | DecayDamping_LowFreqDamp=0 | 3 | 3/3 | live (marginal, <=16 LSB: at the noise floor) |
| `BULK-spectral-resonator-pin-global-unisonamount-min` | Global_UnisonAmount=0 | 2 | 2/2 | INERT (dither-identical) |
| `BULK-spectral-resonator-pin-decaydamping-highfreqdamp-max` | DecayDamping_HighFreqDamp=1 | 2 | 2/2 | INERT (dither-identical) |
| `BULK-spectral-resonator-pin-decaydamping-lowfreqdamp-max` | DecayDamping_LowFreqDamp=1 | 2 | 2/2 | INERT (dither-identical) |

### Spectral Time (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-spectral-time-pin-delay-feedback-min` | Delay_Feedback=0 | 4371 | 4135/4371 | live |
| `BULK-spectral-time-pin-delay-frequencyshift-min` | Delay_FrequencyShift=-400 | 5516 | 5068/5516 | live |
| `BULK-spectral-time-pin-inputsendgain-min` | InputSendGain=0 | 6055 | 5781/6055 | live |
| `BULK-spectral-time-pin-delay-feedback-max` | Delay_Feedback=1 | 2873 | 2766/2873 | live |
| `BULK-spectral-time-pin-delay-frequencyshift-max` | Delay_FrequencyShift=400 | 5193 | 4865/5193 | live |

### Spectrum (audio)

- NOTE: no pins in manifest; defaults only (signals: impulse.wav, steps-1k.wav, sweep-20-20k.wav)

### Tension (instrument)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-tension-pin-bodylevel-min` | BodyLevel=0 | 8441 | 8441/8441 | live |
| `BULK-tension-pin-filtercutofffrequency-min` | FilterCutoffFrequency=0 | 8406 | 8406/8406 | live |
| `BULK-tension-pin-filtercutofffrequencyenvmod-min` | FilterCutoffFrequencyEnvMod=-1 | 2 | 2/2 | INERT (dither-identical) |
| `BULK-tension-pin-bodylevel-max` | BodyLevel=1 | 8431 | 8431/8430 | live |
| `BULK-tension-pin-filtercutofffrequency-max` | FilterCutoffFrequency=1 | 2 | 2/2 | INERT (dither-identical; no-op value = default) [set carries 1, manifest 0.5 — pending rebuild] |

### Utility (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-utility-pin-bassmonofrequency-min` | BassMonoFrequency=50 | 2 | 2/2 | INERT (dither-identical) |
| `BULK-utility-pin-gain-min` | Gain=0 | 16153 | 16151/16153 | live |
| `BULK-utility-pin-legacygain-min` | LegacyGain=-35 | 2 | 2/2 | INERT (dither-identical) |
| `BULK-utility-pin-bassmonofrequency-max` | BassMonoFrequency=500 | 2 | 2/2 | INERT (dither-identical) |
| `BULK-utility-pin-gain-max` | Gain=56.234131 | 32012 | 32012/32012 | live |

### Velocity (midi)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-velocity-pin-drive-min` | Drive=-1 | 2 | 2/2 | vacuous (dither-only silence) |
| `BULK-velocity-pin-compand-min` | Compand=-1 | 2 | 2/2 | vacuous (dither-only silence) |
| `BULK-velocity-pin-maxout-min` | MaxOut=1 | 2 | 2/2 | vacuous (dither-only silence) |
| `BULK-velocity-pin-drive-max` | Drive=1 | 2 | 2/2 | vacuous (dither-only silence) |
| `BULK-velocity-pin-compand-max` | Compand=1 | 2 | 2/2 | vacuous (dither-only silence) |

### Vinyl Distortion (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-vinyl-distortion-pin-bandfreq1-min` | BandFreq1=50 | 129 | 129/129 | live |
| `BULK-vinyl-distortion-pin-bandfreq2-min` | BandFreq2=50 | 2 | 2/2 | INERT (dither-identical) |
| `BULK-vinyl-distortion-pin-craclevolume-min` | CracleVolume=1 | 32767 | 4976/32767 | live |
| `BULK-vinyl-distortion-pin-bandfreq1-max` | BandFreq1=18000 | 4526 | 4526/4526 | live |
| `BULK-vinyl-distortion-pin-bandfreq2-max` | BandFreq2=18000 | 2 | 2/2 | INERT (dither-identical) |

### Vocoder (audio)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-vocoder-pin-filterbandwidth-min` | FilterBandWidth=0.1 | 287 | 287/274 | live |
| `BULK-vocoder-pin-highfrequency-min` | HighFrequency=199.999969 | 297 | 297/256 | live |
| `BULK-vocoder-pin-levelgate-min` | LevelGate=12 | 297 | 297/255 | live |
| `BULK-vocoder-pin-filterbandwidth-max` | FilterBandWidth=2 | 310 | 306/310 | live |
| `BULK-vocoder-pin-highfrequency-max` | HighFrequency=18000 | 8396 | 8396/5019 | live |

### Wavetable (instrument)

| pin | value | max|Δ| LSB | L/R LSB | verdict |
|---|---|---|---|---|
| `BULK-wavetable-pin-voice-filter1-drive-min` | Voice_Filter1_Drive=0 | 2 | 2/2 | INERT (dither-identical; no-op value = default) [set carries 0, manifest 12 — pending rebuild] |
| `BULK-wavetable-pin-voice-filter1-frequency-min` | Voice_Filter1_Frequency=19.999998 | 4826 | 4826/4826 | live |
| `BULK-wavetable-pin-voice-filter1-resonance-min` | Voice_Filter1_Resonance=1.25 | 13 | 13/13 | live (marginal, <=16 LSB: at the noise floor) |
| `BULK-wavetable-pin-voice-filter1-drive-max` | Voice_Filter1_Drive=24 | 2 | 2/2 | INERT (dither-identical) |
| `BULK-wavetable-pin-voice-filter1-frequency-max` | Voice_Filter1_Frequency=20479.998 | 2 | 2/2 | INERT (dither-identical; no-op value = default) [set carries 20479.998, manifest 10249.998999 — pending rebuild] |

## Devices with defaults but no pins (nothing auditable)

- Auto Pan (default signals: impulse.wav, steps-1k.wav, sweep-20-20k.wav)
- Envelope Follower (default signals: impulse.wav, steps-1k.wav, sweep-20-20k.wav)
- Envelope MIDI (default signals: m1-velocity)
- LFO (default signals: impulse.wav, steps-1k.wav, sweep-20-20k.wav)
- MPE Control (default signals: m1-velocity)
- Note Echo (default signals: m1-velocity)
- Operator (default signals: m1-velocity)
- Sampler (default signals: m1-velocity)
- Shaper (default signals: impulse.wav, steps-1k.wav, sweep-20-20k.wav)
- Simpler (default signals: m1-velocity)
- Spectrum (default signals: impulse.wav, steps-1k.wav, sweep-20-20k.wav)

## Diagnosis

Method: for the inert pins, compare the pinned `<Manual>` in the built .als
against the device's .adv default, byte-diff pin .als vs default .als, check
the element path against the .adv structure and against Live's own writer
(evidence/sets/template-piano-voices-mastering.xml), and read the binary
capture for the setter bodies (evidence/binary/*). Then bound the causes
with live probes (bulk/run_repair_batch.sh, 2026-10-11, 17 renders; ledger
`bulk/run_ledger.jsonl`, status `repair-rendered`).

**Cause breakdown: of the 273 pins, 108 were dither-identical (max|Δ| ≤ 2 LSB)
in the original audit — 43 vacuous (silent carrier: nothing can be probed)
and 65 inert, which split into the no-op family (value = device default;
the builder pick defect — 41 such pins exist across all 273, repaired in
the manifest and re-rendered in part today) and the genuine causes in §1–§4
(section gates, excitation limits, the saturator colour defect, legacy
Flanger). Six further no-op pins measured "live" on render-side variance
alone (§7). After today's repairs the corpus stands at 168 live / 62
inert / 43 vacuous; of the 9 rebuilt no-op pins re-rendered, 8 measure
clearly live (3 flipped from inert, 5 from variance/marginal) and 1 stays
inert (excitation — Auto Filter's LFO).** (Post-repair totals in the
header.)

### 1. Saturator colour trio — cause class (d): stored colour/structural
state is not applied at load (the flagged case)

Pins: `basedrive-{min,max}`, `colordepth-{min,max}`, `colorfrequency-min`.

- (a) pin not written — **NO.** The pin .als differs from the default .als in
  exactly one line: `<BaseDrive><Manual Value="36" />` vs `"0"`; the render
  log (`bulk/logs/BULK-saturator-pin-basedrive-max.log`) confirms that file
  was the one rendered. Re-rendered today: still 2 LSB.
- (b) wrong element — **NO.** The element path is identical to the .adv and
  to Live's own writer: a real Live-saved set carries non-zero BaseDrive
  (−1.6875) and ColorDepth (1.14285719) at the same path
  (evidence/sets/template-piano-voices-mastering.xml), and our injected
  device's pointee layout (AutomationTarget/ModulationTarget/Pointee counts
  17/13/1) matches that set exactly.
- (c) device ignores the parameter — **NO per the binary.** `OnBaseDrive`
  (1019ad04c, evidence/binary/saturator-decompiles.txt) stores the raw value
  at 0x170 and recomputes the A/C 40 Hz shelf pair (d = 10^(±v/40)); at
  ±36 dB the colour stage would move the impulse render by hundreds of LSB.
- **Probes (rendered today):** `probe-predrive-max` (PreDrive=36) = **28148
  LSB — LIVE**: plain float parameters DO reach the DSP from stored state.
  `probe-postclip-on` (PostClip=true) = **2 LSB**; `probe-basedrive-env`
  (BaseDrive=36 applied by a transport-time automation envelope) = **2 LSB**.
- **Reading:** the colour values AND the structural toggles (ColorOn/
  PostClip) do not reach the running code in this corpus, while
  chain-invariant floats (DryWet — proven active by the default render
  itself; PreDrive) do. The engine runs its initial calc variant regardless
  of the stored colour/postclip state. Consequence: stored-state pins cannot
  pin the colour shelf laws in Live 12.0.25 as loaded here — those laws need
  a different route (UI-driven capture in a scratch Project, or the
  dB→linear/curve-LUT route). This sharpens the saturation-gate lane's §6
  defect note (devices/saturator-derivation.md) with the mechanism probes.

### 2. Legacy Flanger — the device produced passthrough audio

All five pins AND the default render are bit-equal to the dry signal
(max|Δ| = 2 vs the Utility-gain-1 anchor): the flanged signal never appears
at any setting (peak stays at the dry impulse position). Cause is
device/loader-side, not a path bug. Not previously stated in
legacy-derivations.md (which makes no behavioral claims); recorded here first.

### 3. Section-gate family — right path, section off in the carried state

- Resonators `infilterfreq` ±8000: `InFilterOn=false` at the factory state
  (the final dispatch selects on it — resonators-derivation.md).
- Vinyl Distortion `bandfreq2` ±18000/50: `Band2On=false` (band 2 is the
  tracing model — vinyldistortion-derivation.md).
- Tension `filtercutofffrequencyenvmod` −1: the filter-envelope toggle is off.
- Roar `feedback_*` band shape at FeedbackAmount=0 (contrast: amount=1 is
  LIVE — the section must be engaged first).

### 4. Excitation family — right path, this signal cannot show it

- Analog `channelpressureamount1/2` ±1, `mpecc74amount1`: the M1 clip has no
  channel-pressure/MPE data.
- Utility `bassmonofrequency` ±: all corpus signals are identical L/R; Bass
  Mono is the identity on dual-mono.
- Auto Filter `lfoamount` (repaired 0 → 30 today): still 2 LSB — a one-sample
  impulse at t≈0 cannot show a low-rate time-varying modulation.
- Ballistics (detector paths; a one-sample impulse never completes
  attack/release ramps): Compressor ExpansionRatio, Glue Ratio, Limiter
  Release, Multiband AboveRatioLow, Gate Attack/Threshold. Pins for these
  need the steps/sweep lineage.
- Looper Feedback 0/0.5: nothing is recorded in the loop; feedback has no
  content to cycle.
- Remaining impulse-excitation limits: Wavetable Voice_Filter1_Drive=24,
  Phaser-Flanger CenterFrequency, Shifter EnvelopeFollower_AmountHz, Spectral
  Resonator damping maxima, Beat Repeat MidFreq/DampVolume=1.

### 5. Vacuous (43 pins)

MIDI FX (35 — silent lineage, no downstream instrument; gaps.md) + Impulse
(5 — empty sample slots) + the remaining silent defaults. These probe nothing
until their lineages gain a carrier (the sampler-loaded probes are the
precedent, gaps.md).

### 6. No-op pins (41 found; repaired + 9 re-rendered today)

The min/max/mid round-robin landed on the device default (min often equals
it; symmetric ranges put mid on it). `build_bulk_manifest.py` now adjusts
those values off the default in place — labels and params unchanged
(`adjust_defaults`). Rebuilt + re-rendered 2026-10-11: 9 pins; 8 now measure
clearly live (3 were inert before — chorus-ensemble HighpassFrequency 1969,
vinyl CracleVolume 4976, wavetable Resonance 13; 5 were variance/marginal —
drift HiPass 4858, drift Frequency 345, vocoder LevelGate 297, beat-repeat
DampVolume 5267, legacy-fs Amount 11320 LSB); 1 is still inert: Auto Filter
LfoAmount=30 (excitation, §4). Remaining 20 no-op pins (mostly vacuous
devices and params with a live sibling) carry the repaired values in the
manifest; their .als/render pairs still hold the old value until the next
bounded rebuild pass (queue: `bulk/queue_repair.jsonl` shows the pattern;
labels are stable).

### 7. Render-side variance (flagged, not a pin effect)

No-op pins whose .als is byte-identical to the default's still measured
2–9837 LSB apart from the default render, concentrated in the first ~0.3 s
(beat-repeat: one repeated-burst block; legacy frequency shifter: first
100 ms). This is render non-reproducibility at export start (engine state),
not the pin — and quiet/noise-dominated renders (vocoder) need the 2-LSB
rule read with care. legacy-fs `amount-max` re-rendered with a real change
(1 → 0.5): 11320 LSB, LIVE — the device is fine; only the value was a no-op.
