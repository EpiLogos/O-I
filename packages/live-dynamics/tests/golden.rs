//! Golden tests — activate when the render lane's outputs are present.
//! Run: cargo test -- --ignored

use live_dynamics::audio;
use live_dynamics::echo as taps_echo;
use live_dynamics::glue::{self, GlueParams};
use live_dynamics::operator;
use live_dynamics::wavetable;
use live_dynamics::reverb::{self, ReverbParams};
use live_dynamics::taps;
use live_dynamics::verify;

const RENDERS: &str =
    "../../docs/research/ableton-live-12.0.25/harness/renders";

fn have_renders() -> bool {
    std::path::Path::new(RENDERS)
        .join("G1_T-12_R30_MU0_v2.aif")
        .exists()
}

// ---------------------------------------------------------------------------
// Reverb gate (thresholds STATED before the model was fitted; they restate
// verify.rs consts and the backlog's reverb row):
//   - early taps: model tap times vs render peaks within ±1 ms
//   - per-band RT60 (broadband + 4 bands, floor-aware least squares):
//     ±10% at the default pin (the fit window is stated per render),
//     ±20% at the DecayTime scaling pins (backlog row)
//   - static spectrum: 48-band profile over [0, 4 s), mean ≤1.5 dB,
//     max band ≤3.0 dB (reverb row + common gate)

/// The model IR placed where the render's direct sits, so both sides see
/// identical analysis geometry (6 s: RT60 fits + floor windows).
fn model_buffer_at_direct(render: &audio::Audio, decay_ms: f64) -> Vec<f32> {
    let sr = render.sample_rate as f64;
    let ir = reverb::impulse_response(&ReverbParams { decay_ms }, render.sample_rate);
    let direct = verify::find_direct_sample(&render.samples, render.sample_rate);
    let len = ((6.0f64 * sr) as usize).min(render.samples.len());
    let mut buf = vec![0f32; len];
    for (i, v) in ir.into_iter().enumerate() {
        let j = direct + i;
        if j >= buf.len() {
            break;
        }
        buf[j] += v;
    }
    buf
}

fn read_render(name: &str) -> audio::Audio {
    let bytes = std::fs::read(format!("{RENDERS}/{name}")).unwrap();
    audio::read_aiff_i16(&bytes).unwrap()
}

fn rt60_table(label: &str, fits: &[verify::Rt60Fit]) {
    for f in fits {
        println!(
            "{label} {:>14}  {:>8.1} dB/s  RT60 {:6.3} s  ({} blocks)",
            f.name, f.slope_db_s, f.rt60_s, f.blocks
        );
    }
}

fn check_rt60(render: &audio::Audio, model_buf: &[f32], t0: f64, t1: f64, tol: f64) {
    let sr = render.sample_rate;
    let r_fits = verify::reverb_rt60_fits(&render.samples, sr, t0, t1);
    let m_fits = verify::reverb_rt60_fits(model_buf, sr, t0, t1);
    rt60_table("render", &r_fits);
    rt60_table("model ", &m_fits);
    let errors = verify::compare_rt60(&r_fits, &m_fits);
    assert_eq!(
        r_fits.len(),
        m_fits.len(),
        "fit coverage mismatch: a band fit the render but not the model"
    );
    for e in &errors {
        println!(
            "  {:>14}  render {:6.3}  model {:6.3}  err {:5.1}%  (tol {:.0}%)",
            e.name,
            e.render_rt60_s,
            e.model_rt60_s,
            e.err_frac * 100.0,
            tol * 100.0
        );
        assert!(
            e.err_frac <= tol,
            "{} RT60 off by {:.1}% (tol {:.0}%)",
            e.name,
            e.err_frac * 100.0,
            tol * 100.0
        );
    }
}

fn check_taps(render: &audio::Audio, model_buf: &[f32]) {
    let sr = render.sample_rate as f64;
    let direct = verify::find_direct_sample(&render.samples, render.sample_rate);
    let t0_s = direct as f64 / sr;
    let expected: Vec<f64> = reverb::EARLY_TAPS.iter().map(|(t, _)| t0_s + t).collect();
    let gate = taps::TapGate::default(); // ±1 ms
    // the render must show each model tap in its ±1 ms window
    let measured = taps::tap_table(&render.samples, render.sample_rate, &expected, gate.max_time_err_s);
    assert!(
        taps::tap_gate_passes(&expected, &measured, &gate),
        "render taps missing or displaced beyond ±1 ms"
    );
    // the model buffer must carry them too (self-check of the alignment)
    let model_taps = taps::tap_table(model_buf, render.sample_rate, &expected, gate.max_time_err_s);
    assert!(
        taps::tap_gate_passes(&expected, &model_taps, &gate),
        "model buffer taps misaligned"
    );
    for (e, m) in expected.iter().zip(measured.iter()) {
        println!(
            "  tap +{:7.3} ms  render {:7.2} dBFS at +{:.3} ms",
            (e - t0_s) * 1000.0,
            m.peak_dbfs,
            (m.time_s - t0_s) * 1000.0
        );
    }
}

fn check_spectral(render: &audio::Audio, model_buf: &[f32]) {
    let sr = render.sample_rate as usize;
    let win = (4.0 * sr as f64) as usize;
    let pa = live_dynamics::spectrum::band_profile(
        &render.samples[..win.min(render.samples.len())],
        render.sample_rate,
        48,
    );
    let pb = live_dynamics::spectrum::band_profile(
        &model_buf[..win.min(model_buf.len())],
        render.sample_rate,
        48,
    );
    let d = live_dynamics::spectrum::band_distance(&pa, &pb);
    println!(
        "spectral (48 bands, [0,4) s): mean {:.2} dB (tol {:.1}), max band {:.2} dB (tol {:.1})",
        d.mean_db,
        verify::REVERB_SPECTRAL_MEAN_TOL_DB,
        d.max_band_db,
        verify::REVERB_SPECTRAL_MAX_BAND_TOL_DB
    );
    // name the worst bands (evidence discipline: a gate failure must say where)
    let mut bands: Vec<(usize, f64)> =
        (0..48).map(|i| (i, (pb[i] - pa[i]).abs())).collect();
    bands.sort_by(|x, y| y.1.partial_cmp(&x.1).unwrap());
    for (i, e) in bands.iter().take(4) {
        println!("  band {i:2}: render {:7.2}  model {:7.2}  |Δ| {e:.2} dB", pa[*i], pb[*i]);
    }
    assert!(
        d.mean_db <= verify::REVERB_SPECTRAL_MEAN_TOL_DB,
        "spectral mean {:.2} dB > {:.1} dB",
        d.mean_db,
        verify::REVERB_SPECTRAL_MEAN_TOL_DB
    );
    assert!(
        d.max_band_db <= verify::REVERB_SPECTRAL_MAX_BAND_TOL_DB,
        "spectral max band {:.2} dB > {:.1} dB",
        d.max_band_db,
        verify::REVERB_SPECTRAL_MAX_BAND_TOL_DB
    );
}

#[test]
#[ignore]
fn reverb_golden_default_pin() {
    let render = read_render("R1_IMPULSE_default_v2.aif");
    let model_buf = model_buffer_at_direct(&render, 1200.0);
    check_taps(&render, &model_buf);
    // stated default-pin fit window (clean above the dither floor on all bands)
    check_rt60(&render, &model_buf, 0.25, 0.60, verify::REVERB_RT60_TOL_DEFAULT_PIN);
    check_spectral(&render, &model_buf);
}

#[test]
#[ignore]
fn reverb_golden_decay_scaling() {
    // D5 scaling pins: stated clean fit windows per render (the 600 ms
    // decay reaches the dither floor by ~0.5 s)
    for (file, decay_ms, t0, t1) in [
        ("R3_DECAY600.aif", 600.0, 0.10, 0.30),
        ("R4_DECAY2400.aif", 2400.0, 0.40, 1.20),
    ] {
        println!("== {file} (DecayTime {decay_ms})");
        let render = read_render(file);
        let model_buf = model_buffer_at_direct(&render, decay_ms);
        check_rt60(&render, &model_buf, t0, t1, verify::REVERB_RT60_TOL_SCALING);
    }
}

#[test]
fn glue_static_model_matches_measured_anchors() {
    let p = GlueParams { threshold_db: -12.0, range: 30.0, ratio: 1.0, makeup_db: 0.0 };
    for (input, measured) in glue::MEASURED_ANCHORS_R30_T12 {
        let predicted = glue::static_gain_change_db(*input, &p);
        assert!(
            (predicted - measured).abs() < 0.01,
            "at {input} dB peak: predicted {predicted}, measured {measured}"
        );
    }
}

#[test]
#[ignore]
fn glue_golden_render_static_gate() {
    if !have_renders() {
        panic!("golden renders not present at {RENDERS}");
    }
    // canonical clean-chain render (master chain stripped, unity staging)
    let bytes = std::fs::read(format!("{RENDERS}/G1_T-12_R30_MU0_v2.aif")).unwrap();
    let render = audio::read_aiff_i16(&bytes).unwrap();
    let p = GlueParams { threshold_db: -12.0, range: 30.0, ratio: 1.0, makeup_db: 0.0 };
    let result = verify::static_gate(&render, &p);
    println!("{result:?}");
    assert!(
        verify::static_gate_passes(&result),
        "static gate failed: max error {} dB",
        result.max_error_db
    );
}

#[test]
#[ignore]
fn render_determinism_within_bound() {
    if !have_renders() {
        panic!("golden renders not present");
    }
    // determinism pair: identical bypass renders (G6_BYPASS_v2 / v2b)
    let a = audio::read_aiff_i16(
        &std::fs::read(format!("{RENDERS}/G6_BYPASS_v2.aif")).unwrap(),
    )
    .unwrap();
    let b = audio::read_aiff_i16(
        &std::fs::read(format!("{RENDERS}/G6_BYPASS_v2b.aif")).unwrap(),
    )
    .unwrap();
    let d = verify::spectral_gate(&a, &b);
    println!("mean {} dB, max band {} dB", d.mean_db, d.max_band_db);
    assert!(verify::spectral_gate_passes(&d));
}

// ---------------------------------------------------------------------------
// Operator voice gate (M6, phase 1: oscillator A + amp envelope, default
// patch). Thresholds STATED before the probe renders were analyzed:
//   - steady-state RMS per note window (start+0.15..start+0.70):
//     ±0.5 dB vs render (M1 + law probes OP2/OP3/OP4)
//   - envelope release path: 20 ms windows from note-off while the render
//     window is above −80 dBFS: ±2.0 dB
//   - fundamental (Goertzel peak): ±0.5 dB level, ±1% frequency (OP5)
// Fitted constants under test: RESIDUAL_GAIN, RELEASE_RATE_DB_S, pitch law,
// level knobs as linear amplitude.

fn operator_steady_rms(render: &audio::Audio, note_start_s: f64) -> f64 {
    let sr = render.sample_rate as f64;
    let a = ((note_start_s + 0.15) * sr) as usize;
    let b = ((note_start_s + 0.70) * sr) as usize;
    audio::rms_db(&render.samples[a..b])
}

fn check_steady(label: &str, render: &audio::Audio, model: &[f32], notes: &[f64]) {
    for (i, t) in notes.iter().enumerate() {
        let got = operator_steady_rms(render, *t);
        let sr = render.sample_rate as f64;
        let a = ((*t + 0.15) * sr) as usize;
        let b = ((*t + 0.70) * sr) as usize;
        let pred = audio::rms_db(&model[a..b]);
        println!(
            "{label} note {i} @ {t:4.1}s: render {got:8.2}  model {pred:8.2}  Δ {:+.2} dB",
            pred - got
        );
        assert!(
            (pred - got).abs() <= verify::STATIC_TOLERANCE_DB,
            "{label} note {i}: model {pred:.2} vs render {got:.2} (±{} dB)",
            verify::STATIC_TOLERANCE_DB
        );
    }
}

#[test]
#[ignore]
fn operator_voice_golden_gate() {
    let sr = 44100u32;
    let note_starts = [0.0f64, 1.0, 2.0, 3.0];

    // --- M1: default patch, 4-note velocity ramp (velocity unrouted) ---
    let render = read_render("M1_OPERATOR.aif");
    let voice = operator::OperatorVoiceA::default_patch(48, sr);
    let mut model = vec![0f32; render.samples.len()];
    for t in note_starts {
        let note = voice.render_note(0.875, 5.0);
        for (i, v) in note.into_iter().enumerate() {
            let j = (t * sr as f64) as usize + i;
            if j < model.len() {
                model[j] += v;
            }
        }
    }
    check_steady("M1", &render, &model, &note_starts);

    // release path: 20 ms windows from note-0 off while render > −80 dBFS
    for k in 0..6 {
        let t0 = 0.875 + k as f64 * 0.020;
        let a = (t0 * sr as f64) as usize;
        let b = ((t0 + 0.020) * sr as f64) as usize;
        let got = audio::rms_db(&render.samples[a..b]);
        if got <= -80.0 {
            break;
        }
        let pred = audio::rms_db(&model[a..b]);
        println!(
            "M1 release t={t0:6.3}: render {got:8.2}  model {pred:8.2}  Δ {:+.2} dB",
            pred - got
        );
        assert!(
            (pred - got).abs() <= 2.0,
            "M1 release window {t0:.3}: model {pred:.2} vs render {got:.2}"
        );
    }

    // waveform: render h1 vs model h1 at ±0.5 dB; render h2 ≥60 dB below h1
    // (the model is a pure sine — h2..h10 sit at the dither floor in M1)
    let h1 = operator::goertzel_amp(&render.samples, sr, 130.81278265, 0.15, 0.70);
    let h2 = operator::goertzel_amp(&render.samples, sr, 261.6255653, 0.15, 0.70);
    let h1_db = operator::amp_to_db(h1);
    let h2_db = operator::amp_to_db(h2);
    println!("M1 harmonics: h1 {h1_db:.2} dBFS, h2 {h2_db:.2} dBFS");
    assert!(
        (h1_db - (-29.76)).abs() <= 0.5,
        "h1 peak {h1_db:.2} vs measured −29.76"
    );
    assert!(h1_db - h2_db >= 60.0, "h2 only {} dB below h1", h1_db - h2_db);

    // --- OP2: sustain pinned to −24 dB (level knob = linear amplitude) ---
    // Model revision (2026-10-08, probe analysis): the flat-sustain reading
    // is refuted by the render — the steady window reads −49.81 dBFS, not
    // the −56.77 a flat model predicts, because SustainLevel engages the
    // decay segment (attack→DecayLevel, exp-in-amp decay toward
    // SustainLevel). The envelope below now decays; thresholds unchanged.
    let render = read_render("OP2_SUSTAIN24.aif");
    let mut voice = operator::OperatorVoiceA::default_patch(48, sr);
    voice.envelope.sustain_amp = 0.06309572607;
    let note = voice.render_note(0.875, 5.0);
    let mut model = vec![0f32; render.samples.len()];
    for t in note_starts {
        for (i, v) in note.iter().enumerate() {
            let j = (t * sr as f64) as usize + i;
            if j < model.len() {
                model[j] += *v;
            }
        }
    }
    check_steady("OP2", &render, &model, &note_starts);

    // OP2 release path: leaves the decayed level at ≈115 dB/s
    // ((−24 + 70)/0.4) — the release rate is set by the note-off level
    for k in 0..6 {
        let t0 = 0.875 + k as f64 * 0.020;
        let a = (t0 * sr as f64) as usize;
        let b = ((t0 + 0.020) * sr as f64) as usize;
        let got = audio::rms_db(&render.samples[a..b]);
        if got <= -80.0 {
            break;
        }
        let pred = audio::rms_db(&model[a..b]);
        println!(
            "OP2 release t={t0:6.3}: render {got:8.2}  model {pred:8.2}  Δ {:+.2} dB",
            pred - got
        );
        assert!(
            (pred - got).abs() <= 2.0,
            "OP2 release window {t0:.3}: model {pred:.2} vs render {got:.2}"
        );
    }

    // --- OP3: oscillator A level 1.0 → 0.5 ---
    let render = read_render("OP3_OSCA050.aif");
    let mut voice = operator::OperatorVoiceA::default_patch(48, sr);
    voice.osc_a_level = 0.5;
    let note = voice.render_note(0.875, 5.0);
    let mut model = vec![0f32; render.samples.len()];
    for t in note_starts {
        for (i, v) in note.iter().enumerate() {
            let j = (t * sr as f64) as usize + i;
            if j < model.len() {
                model[j] += *v;
            }
        }
    }
    check_steady("OP3", &render, &model, &note_starts);

    // --- OP4: Globals/Volume ×0.25 (output trim law) ---
    let render = read_render("OP4_TRIM025.aif");
    let mut voice = operator::OperatorVoiceA::default_patch(48, sr);
    voice.globals_volume = 0.0314731337;
    let note = voice.render_note(0.875, 5.0);
    let mut model = vec![0f32; render.samples.len()];
    for t in note_starts {
        for (i, v) in note.iter().enumerate() {
            let j = (t * sr as f64) as usize + i;
            if j < model.len() {
                model[j] += *v;
            }
        }
    }
    check_steady("OP4", &render, &model, &note_starts);

    // --- OP5: key 60 (C4) — pitch law, level key-invariant ---
    let render = read_render("OP5_KEY60.aif");
    let voice = operator::OperatorVoiceA::default_patch(60, sr);
    let note = voice.render_note(0.875, 5.0);
    let mut model = vec![0f32; render.samples.len()];
    for (i, v) in note.into_iter().enumerate() {
        if i < model.len() {
            model[i] = v;
        }
    }
    // fundamental: Goertzel scan 200–330 Hz, 0.5 Hz steps (as analyze_vd.py)
    let (mut best_f, mut best_a) = (0.0f64, 0.0f64);
    let mut f = 200.0;
    while f <= 330.0 {
        let a = operator::goertzel_amp(&render.samples, sr, f, 0.15, 0.70);
        if a > best_a {
            best_a = a;
            best_f = f;
        }
        f += 0.5;
    }
    let got_rms = operator_steady_rms(&render, 0.0);
    let pred_rms = audio::rms_db(&model[..(0.70 * sr as f64) as usize]);
    println!(
        "OP5: fundamental {best_f:.2} Hz (C4 = 261.63), steady render {got_rms:.2} vs model {pred_rms:.2}"
    );
    assert!(
        (best_f - 261.6255653).abs() / 261.6255653 <= 0.01,
        "OP5 fundamental {best_f:.2} Hz off C4"
    );
    assert!(
        (pred_rms - got_rms).abs() <= verify::STATIC_TOLERANCE_DB,
        "OP5 steady: model {pred_rms:.2} vs render {got_rms:.2}"
    );
}

// ---------------------------------------------------------------------------
// Wavetable voice gate (M2, default patch). Thresholds STATED in the lane
// brief before the model was fitted (devices/wavetable-voice.md records the
// measured residuals against them):
//   - steady RMS per note window (start+0.15..start+0.70): ±1.0 dB
//   - release: the −40 dB-below-plateau crossing (20 ms RMS windows,
//     plateau = the settled [3.60, 3.87] region) within ±25% of the
//     render's, plus 20 ms release windows ±2.5 dB over the first 300 ms
//     (later windows approach the dither floor and straddle the tail plunge)
//   - harmonic profile h1..h8 (note-1 steady window, Goertzel): mean |Δ|
//     ≤3.0 dB, floor-aware — harmonics the render reads within 8 dB of the
//     ≈−78 dBFS dither floor are noise, not profile: the model must only sit
//     at or below (floor + 8 dB) there, and they do not enter the mean. On
//     M2 every h2..h8 is floor (the default patch is a pure sine), so the
//     profile reduces to h1 + the floor guard.
#[test]
#[ignore]
fn wavetable_voice_golden_gate() {
    const STEADY_TOL_DB: f64 = 1.0;
    const RELEASE_FRAC: f64 = 0.25;
    const HARMONIC_MEAN_TOL_DB: f64 = 3.0;
    const RELEASE_WIN_TOL_DB: f64 = 2.5;
    let sr = 44100u32;
    let note_starts = [0.0f64, 1.0, 2.0, 3.0];

    let render = read_render("M2_WAVETABLE.aif");
    let voice = wavetable::WavetableVoice::default_patch(48, sr);
    let mut model = vec![0f32; render.samples.len()];
    for t in note_starts {
        // held 0.875 s; the render tail extends 1.0 s past the hold (the
        // next note masks it after ~0.12 s, matching the render geometry)
        let note = voice.render_note(0.875, 1.875);
        for (i, v) in note.into_iter().enumerate() {
            let j = (t * sr as f64) as usize + i;
            if j < model.len() {
                model[j] += v;
            }
        }
    }

    // --- steady RMS per note, ±1 dB ---
    for (i, t) in note_starts.iter().enumerate() {
        let a = ((t + 0.15) * sr as f64) as usize;
        let b = ((t + 0.70) * sr as f64) as usize;
        let got = audio::rms_db(&render.samples[a..b]);
        let pred = audio::rms_db(&model[a..b]);
        println!(
            "M2-WT note {i} @ {t:4.1}s: render {got:8.2}  model {pred:8.2}  Δ {:+.2} dB",
            pred - got
        );
        assert!(
            (pred - got).abs() <= STEADY_TOL_DB,
            "M2-WT note {i}: model {pred:.2} vs render {got:.2} (±{STEADY_TOL_DB} dB)"
        );
    }

    // --- release: −40 dB crossing ±25%, windows ±2.5 dB to +300 ms ---
    let plateau = |buf: &[f32]| {
        audio::rms_db(&buf[(3.60 * sr as f64) as usize..(3.87 * sr as f64) as usize])
    };
    let crossing = |buf: &[f32], plateau_db: f64| -> f64 {
        let mut t = 3.875;
        while t < 4.8 {
            let a = (t * sr as f64) as usize;
            let b = a + (0.020 * sr as f64) as usize;
            if b >= buf.len() {
                break;
            }
            if audio::rms_db(&buf[a..b]) < plateau_db - 40.0 {
                return t - 3.875;
            }
            t += 0.005;
        }
        f64::NAN
    };
    let got_plateau = plateau(&render.samples);
    let got_cross = crossing(&render.samples, got_plateau);
    let model_cross = crossing(&model, plateau(&model));
    println!(
        "M2-WT release: render −40 dB crossing {got_cross:.3}s, model {model_cross:.3}s \
         (plateau {got_plateau:.2} dBFS)"
    );
    assert!(
        !got_cross.is_nan() && !model_cross.is_nan(),
        "a side never crosses −40 dB below plateau"
    );
    assert!(
        (model_cross - got_cross).abs() / got_cross <= RELEASE_FRAC,
        "M2-WT release crossing {model_cross:.3}s vs render {got_cross:.3}s (±25%)"
    );
    for k in 2..15usize {
        let t0 = 3.875 + k as f64 * 0.020;
        let a = (t0 * sr as f64) as usize;
        let b = ((t0 + 0.020) * sr as f64) as usize;
        let got = audio::rms_db(&render.samples[a..b]);
        let pred = audio::rms_db(&model[a..b]);
        if got <= got_plateau - 40.0 {
            break;
        }
        println!(
            "M2-WT release t={t0:6.3}: render {got:8.2}  model {pred:8.2}  Δ {:+.2} dB",
            pred - got
        );
        assert!(
            (pred - got).abs() <= RELEASE_WIN_TOL_DB,
            "M2-WT release window {t0:.3}: model {pred:.2} vs render {got:.2}"
        );
    }

    // --- harmonic profile: mean |Δ| ≤3 dB over above-floor harmonics ---
    let f0 = 130.81278265;
    let floor_guard_db = 8.0;
    // the render's dither floor estimate: median of h3..h8
    let mut floor_samples = vec![];
    for k in 3..=8 {
        floor_samples.push(operator::amp_to_db(operator::goertzel_amp(
            &render.samples,
            sr,
            f0 * k as f64,
            1.15,
            1.70,
        )));
    }
    floor_samples.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let floor_db = floor_samples[2]; // median of 6
    println!("M2-WT dither floor estimate: {floor_db:.2} dBFS");
    let mut sum = 0.0;
    let mut count = 0;
    for k in 1..=8u32 {
        let got = operator::amp_to_db(operator::goertzel_amp(
            &render.samples,
            sr,
            f0 * k as f64,
            1.15,
            1.70,
        ));
        let pred = operator::amp_to_db(operator::goertzel_amp(
            &model,
            sr,
            f0 * k as f64,
            1.15,
            1.70,
        ));
        println!("M2-WT h{k}: render {got:8.2}  model {pred:8.2} dBFS");
        if got <= floor_db + floor_guard_db {
            assert!(
                pred <= got + floor_guard_db,
                "M2-WT h{k}: model {pred:.2} pokes above the floor guard (render {got:.2})"
            );
        } else {
            sum += (pred - got).abs();
            count += 1;
        }
    }
    let mean = if count > 0 { sum / count as f64 } else { 0.0 };
    println!("M2-WT harmonic mean |Δ| over {count} above-floor harmonics: {mean:.2} dB");
    assert!(
        mean <= HARMONIC_MEAN_TOL_DB,
        "M2-WT harmonic mean {mean:.2} dB (≤{HARMONIC_MEAN_TOL_DB})"
    );
}

// ---------------------------------------------------------------------------
// Wavetable law gates (WV2..WV5 probes). These renders live on the probe
// lane branch (feat/live-re-lane-15min-workload, commit 37b4daff4); the
// gates activate wherever the renders are checked out and print a skip
// notice otherwise. Thresholds: law deltas ±0.5 dB (steady windows) and
// ±0.3 dB (per-harmonic), harmonic profile mean ≤3.0 dB at pos 0.5.
#[test]
#[ignore]
fn wavetable_law_gates() {
    const LAW_TOL_DB: f64 = 0.5;
    const HARM_TOL_DB: f64 = 0.3;
    const HARM_MEAN_TOL_DB: f64 = 3.0;
    let sr = 44100u32;
    let note_starts = [0.0f64, 1.0, 2.0, 3.0];
    let f0 = 130.81278265;

    let render_exists =
        |name: &str| std::path::Path::new(RENDERS).join(name).exists();

    let steady = |buf: &[f32], t: f64| {
        let a = ((t + 0.15) * sr as f64) as usize;
        let b = ((t + 0.70) * sr as f64) as usize;
        audio::rms_db(&buf[a..b])
    };
    let baseline = read_render("M2_WAVETABLE.aif");
    let render_model = |voice: &wavetable::WavetableVoice| {
        let mut model = vec![0f32; baseline.samples.len()];
        for t in note_starts {
            let note = voice.render_note(0.875, 1.875);
            for (i, v) in note.into_iter().enumerate() {
                let j = (t * sr as f64) as usize + i;
                if j < model.len() {
                    model[j] += v;
                }
            }
        }
        model
    };

    // The LAW lives in the renders (probe − baseline); the MODEL is checked
    // against the probe render separately (agreement ≈ the calibration bias
    // the M2 gate measures, +0.13 dB).
    let bias = {
        let m = render_model(&wavetable::WavetableVoice::default_patch(48, sr));
        steady(&m, 1.0) - steady(&baseline.samples, 1.0)
    };
    println!("calibration bias (model − render, baseline steady): {bias:+.2} dB");
    let law_harmonics = |probe: &audio::Audio| -> Vec<f64> {
        (1..=8)
            .map(|k| {
                operator::amp_to_db(operator::goertzel_amp(
                    &probe.samples,
                    sr,
                    f0 * k as f64,
                    1.15,
                    1.70,
                )) - operator::amp_to_db(operator::goertzel_amp(
                    &baseline.samples,
                    sr,
                    f0 * k as f64,
                    1.15,
                    1.70,
                ))
            })
            .collect()
    };
    let law_steady = |probe: &audio::Audio| -> Vec<f64> {
        note_starts
            .iter()
            .map(|t| steady(&probe.samples, *t) - steady(&baseline.samples, *t))
            .collect()
    };
    let agree_harmonics = |render: &audio::Audio, model: &[f32]| -> Vec<f64> {
        (1..=8)
            .map(|k| {
                operator::amp_to_db(operator::goertzel_amp(
                    model,
                    sr,
                    f0 * k as f64,
                    1.15,
                    1.70,
                )) - operator::amp_to_db(operator::goertzel_amp(
                    &render.samples,
                    sr,
                    f0 * k as f64,
                    1.15,
                    1.70,
                ))
            })
            .collect()
    };
    let agree_steady = |render: &audio::Audio, model: &[f32]| -> Vec<f64> {
        note_starts
            .iter()
            .map(|t| steady(model, *t) - steady(&render.samples, *t))
            .collect()
    };

    // --- WV3: osc gain ×0.5 → every harmonic −6.02 dB (linear amplitude) ---
    if !render_exists("WV3_OSCGAIN.aif") {
        println!("skip WV3_OSCGAIN: render not present in this checkout");
        return;
    }
    let render = read_render("WV3_OSCGAIN.aif");
    let law = law_harmonics(&render);
    println!("WV3 law deltas (render − baseline): {law:?}");
    for (k, v) in law.iter().enumerate() {
        assert!(
            (v - (-6.0206)).abs() <= HARM_TOL_DB,
            "WV3 h{}: law Δ {v:+.2} dB vs −6.02", k + 1
        );
    }
    let mut voice = wavetable::WavetableVoice::default_patch(48, sr);
    voice.osc1.gain = 0.5;
    let model = render_model(&voice);
    for (k, v) in agree_harmonics(&render, &model).iter().enumerate() {
        assert!(
            (v - bias).abs() <= LAW_TOL_DB,
            "WV3 h{}: model−render {v:+.2} dB (bias {bias:+.2})", k + 1
        );
    }

    // --- WV5: osc2 on (identical stored params) → coherent +6.02 dB ---
    let render = read_render("WV5_OSC2ON.aif");
    let law = law_harmonics(&render);
    println!("WV5 law deltas (render − baseline): {law:?}");
    for (k, v) in law.iter().enumerate() {
        assert!(
            (v - 6.0206).abs() <= HARM_TOL_DB,
            "WV5 h{}: law Δ {v:+.2} dB vs coherent +6.02", k + 1
        );
    }
    let mut voice = wavetable::WavetableVoice::default_patch(48, sr);
    voice.osc2.on = true;
    let model = render_model(&voice);
    for (k, v) in agree_harmonics(&render, &model).iter().enumerate() {
        assert!(
            (v - bias).abs() <= LAW_TOL_DB,
            "WV5 h{}: model−render {v:+.2} dB (bias {bias:+.2})", k + 1
        );
    }

    // --- WV4: sustain 0.5012 → 0.25 → plateau −6.04 dB (linear amplitude) ---
    let render = read_render("WV4_SUSTAIN.aif");
    let late = |buf: &[f32]| {
        audio::rms_db(&buf[(3.60 * sr as f64) as usize..(3.87 * sr as f64) as usize])
    };
    let law_delta = late(&render.samples) - late(&baseline.samples);
    println!("WV4 law plateau delta: {law_delta:+.2} dB (−6.04)");
    assert!(
        (law_delta - (-6.0412)).abs() <= LAW_TOL_DB,
        "WV4 law plateau Δ {law_delta:+.2} dB vs −6.04"
    );
    let mut voice = wavetable::WavetableVoice::default_patch(48, sr);
    voice.envelope.sustain_amp = 0.25;
    let model = render_model(&voice);
    let agree = late(&model) - late(&render.samples);
    println!("WV4 model−render plateau: {agree:+.2} dB");
    assert!((agree - bias).abs() <= LAW_TOL_DB, "WV4 plateau agreement {agree:+.2}");

    // --- WV2: position 0 → 0.5 reads the 0.5·triangle + 0.5·saw segment
    // mix (census law, rev 3; timbre + −2.43 dB RMS) ---
    let render = read_render("WV2_POS50.aif");
    let law = law_harmonics(&render);
    let law_s = law_steady(&render);
    println!("WV2 law harmonic deltas: {law:?}  law steady deltas: {law_s:?}");
    let mut voice = wavetable::WavetableVoice::default_patch(48, sr);
    voice.osc1.wave_position = 0.5;
    let model = render_model(&voice);
    let agree = agree_harmonics(&render, &model);
    let agree_s = agree_steady(&render, &model);
    let mean: f64 = agree.iter().map(|v| v.abs()).sum::<f64>() / agree.len() as f64;
    println!("WV2 model−render harmonic deltas: {agree:?} (mean {mean:.2})  steady: {agree_s:?}");
    for v in &agree_s[1..] {
        assert!((*v - bias).abs() <= LAW_TOL_DB, "WV2 steady agreement {v:+.2}");
    }
    assert!(
        mean <= HARM_MEAN_TOL_DB,
        "WV2 harmonic mean |Δ| {mean:.2} dB (≤{HARM_MEAN_TOL_DB})"
    );
}

// ---------------------------------------------------------------------------
// Wavetable unison stereo golden gate (WV19_LONG_UNI — dossier rev 4,
// "Unison stereo layout + voice amplitudes"). Activates only when the
// render is present in harness/renders; skip-notice otherwise (the archive
// renders WV9B/WV12/WV13 are NOT gated — WV19 is the committed long-note
// re-probe whose stereo reading supersedes the D15 left-channel ladder).
//
// VoiceCount-3 unison law: voices at {−50, 0, +50} cents × Amount (equal
// gains), panned hard-L / centre / hard-R under an equal-power law;
// per-channel spectrum = low voice + centre(−3.01 dB); whole-voice detune
// (h2..h8 stay at the floor in both channels).
//
// Measured (dossier: Hann-weighted fine DTFT, steady window [1.0, 3.9] s):
// −3.724 Hz = −50.00 cents at −25.72 dBFS in L ONLY (R reads −105, the
// floor); centre +0.01 cents at −28.73 dBFS, identical in L and R;
// +3.833 Hz = +50.00 cents at −25.72 dBFS in R only (L −110).
//
// Thresholds STATED from that dossier section before this gate ran; the
// scan is the same Hann-weighted DTFT at 0.05 Hz steps (≈0.7 cents at
// f0 = 130.81 Hz — a bare rectangular Goertzel would leak ≈−27 dB across
// the channel-suppression check, hence the Hann weight):
//   - outer line within ±1.0 cent of ±50; centre within ±1.0 of 0
//   - absolute levels −25.72 / −28.73 dBFS within ±1.0 dB
//   - centre 3.01 ±0.5 dB below the same-channel outer (equal-power pan)
//   - opposite-channel outer suppression ≥ 60 dB (measured ≥ 80)
//   - centre identical in L and R within 0.2 dB
#[test]
#[ignore]
fn wavetable_unison_golden_gate() {
    const NAME: &str = "WV19_LONG_UNI.aif";
    if !std::path::Path::new(RENDERS).join(NAME).exists() {
        println!("skip {NAME}: render not present in this checkout");
        return;
    }
    const POS_TOL_CENTS: f64 = 1.0;
    const LEVEL_TOL_DB: f64 = 1.0;
    const CENTRE_DROP_DB: f64 = 3.01;
    const CENTRE_DROP_TOL_DB: f64 = 0.5;
    const CROSS_SUPPRESS_DB: f64 = 60.0;
    const CENTRE_LR_TOL_DB: f64 = 0.2;
    const T0: f64 = 1.0;
    const T1: f64 = 3.9;

    let bytes = std::fs::read(format!("{RENDERS}/{NAME}")).unwrap();
    let (left, right) = audio::read_aiff_i16_channels(&bytes).unwrap();
    let sr = left.sample_rate as f64;
    let f0 = 130.81278265;

    // Hann-weighted DTFT amplitude at `f`, coherent-sine dBFS scale
    let line_db = |buf: &[f32], f: f64| -> f64 {
        let n0 = (T0 * sr) as usize;
        let n1 = ((T1 * sr) as usize).min(buf.len());
        let n = n1 - n0;
        let w = 2.0 * std::f64::consts::PI * f / sr;
        // phasor rotation (no per-sample trig; orthogonal step, drift ≪ LSB)
        let (dc, ds) = (w.cos(), w.sin());
        let (mut c, mut s) = (1.0f64, 0.0f64);
        let mut re = 0.0f64;
        let mut im = 0.0f64;
        let mut wsum = 0.0f64;
        for (i, j) in (n0..n1).enumerate() {
            let win = 0.5 - 0.5 * (2.0 * std::f64::consts::PI * i as f64 / n as f64).cos();
            let x = buf[j] as f64 * win;
            re += x * c;
            im -= x * s;
            wsum += win;
            let nc = c * dc - s * ds;
            s = c * ds + s * dc;
            c = nc;
        }
        operator::amp_to_db(2.0 * (re * re + im * im).sqrt() / wsum)
    };
    // fine scan ±1.5 Hz around an expected line; returns (f_best, dBFS)
    let scan = |buf: &[f32], f_expect: f64| -> (f64, f64) {
        let mut best = (f_expect, f64::NEG_INFINITY);
        let mut f = f_expect - 1.5;
        while f <= f_expect + 1.5 {
            let db = line_db(buf, f);
            if db > best.1 {
                best = (f, db);
            }
            f += 0.05;
        }
        best
    };
    let cents = |f: f64| 1200.0 * (f / f0).log2();

    // expected lines from the crate's spread law: VC3, Amount 1.0 →
    // {−50, 0, +50} cents (hard-L / centre / hard-R)
    let v = wavetable::unison::voice_freqs_hz(f0, 3, 1.0);
    assert_eq!(v.len(), 3, "spread law must give three VC3 voices");
    let mut fails: Vec<String> = Vec::new();
    for (label, ch, outer_f, other_f) in [
        ("L", &left.samples, v[0], v[2]),
        ("R", &right.samples, v[2], v[0]),
    ] {
        let (f_outer, db_outer) = scan(ch, outer_f);
        let (f_centre, db_centre) = scan(ch, f0);
        let (_, db_cross) = scan(ch, other_f); // the other outer must be absent
        let suppress = db_outer - db_cross;
        println!(
            "{label}: outer {:+7.3} Hz ({:+6.2}¢) {db_outer:7.2} dBFS | \
             centre {:+7.3} Hz ({:+5.2}¢) {db_centre:7.2} dBFS | \
             opposite-outer {db_cross:7.2} dBFS ({suppress:5.1} dB down)",
            f_outer - f0,
            cents(f_outer),
            f_centre - f0,
            cents(f_centre),
        );
        let want_cents = if label == "L" { -50.0 } else { 50.0 };
        if (cents(f_outer) - want_cents).abs() > POS_TOL_CENTS {
            fails.push(format!(
                "{label} outer at {:+.2} cents (±{POS_TOL_CENTS})",
                cents(f_outer)
            ));
        }
        if cents(f_centre).abs() > POS_TOL_CENTS {
            fails.push(format!(
                "{label} centre at {:+.2} cents (±{POS_TOL_CENTS})",
                cents(f_centre)
            ));
        }
        if (db_outer - (-25.72)).abs() > LEVEL_TOL_DB {
            fails.push(format!(
                "{label} outer level {db_outer:.2} dBFS (−25.72 ±{LEVEL_TOL_DB})"
            ));
        }
        if (db_centre - (-28.73)).abs() > LEVEL_TOL_DB {
            fails.push(format!(
                "{label} centre level {db_centre:.2} dBFS (−28.73 ±{LEVEL_TOL_DB})"
            ));
        }
        let drop = db_outer - db_centre;
        if (drop - CENTRE_DROP_DB).abs() > CENTRE_DROP_TOL_DB {
            fails.push(format!(
                "{label} centre drop {drop:.2} dB (3.01 ±{CENTRE_DROP_TOL_DB})"
            ));
        }
        if suppress < CROSS_SUPPRESS_DB {
            fails.push(format!(
                "{label} opposite-channel outer only {suppress:.1} dB down (≥{CROSS_SUPPRESS_DB})"
            ));
        }
    }
    // centre voice is bit-identical in L and R (dossier) — same level here
    let cl = scan(&left.samples, f0).1;
    let cr = scan(&right.samples, f0).1;
    println!("centre L/R: {cl:.2} / {cr:.2} dBFS");
    if (cl - cr).abs() > CENTRE_LR_TOL_DB {
        fails.push(format!(
            "centre L/R split {:+.2} dB (±{CENTRE_LR_TOL_DB})",
            cl - cr
        ));
    }
    assert!(
        fails.is_empty(),
        "WV19 unison stereo gate failed:\n  {}",
        fails.join("\n  ")
    );
}

// ---------------------------------------------------------------------------
// Wavetable INTERIOR position law — leave-one-out gate (dossier rev 3).
//
// The law under test: "Basic Shapes" holds FOUR peak-normalized zero-phase
// frames {sine | triangle | saw | square} at WavePosition {0, 1/3, 2/3, 1};
// an interior position reads the LINEAR coherent amplitude mix of its
// segment's bounding frames (x = 3·pos; i = min(floor x, 2); w = x − i).
// Supersedes the 2-frame crossfade the depth probes refuted
// (wavetable-voice.md, "Interior interpolation law").
//
// Thresholds STATED BEFORE the folds ran: each fold fits per-frame gain
// scalars (ideal 1.0; LS over the training positions' above-floor
// harmonics, signed by the ideal mix) on TWO of the three probed interior
// positions and predicts the THIRD — held-out harmonic mean |Δ| ≤ 2.0 dB
// over above-floor harmonics (floor −85.9 dBFS + 8 dB guard, the golden
// gate's convention) and steady RMS within ±0.5 dB. Measured map: the
// M2/WV6/WV2/WV7 renders (analyze_wavetable_position.py — the four renders
// are identical except WavePosition). The gate embeds that map and needs no
// render files; it also pins the production `frame_harmonic` to the same
// ideal mix the folds predict with.
#[test]
#[ignore]
fn wavetable_position_leave_one_out() {
    const HARMONIC_MEAN_TOL_DB: f64 = 2.0;
    const RMS_TOL_DB: f64 = 0.5;
    const POS0_H1_DBFS: f64 = -23.11;
    const STEADY_POS0_DBFS: f64 = -26.06;
    const FLOOR_DBFS: f64 = -85.9;
    const FLOOR_GUARD_DB: f64 = 8.0;
    const POSITIONS: [f64; 3] = [0.25, 0.50, 0.75];
    // measured linear ratios rel pos-0 h1 / dBFS / note-1 steady RMS
    const LIN: [[f64; 3]; 8] = [
        [0.85797, 0.72342, 0.79538],
        [0.00113, 0.15295, 0.22951],
        [0.06572, 0.05755, 0.25333],
        [0.00069, 0.07785, 0.11677],
        [0.02456, 0.08079, 0.16109],
        [0.00053, 0.05370, 0.08045],
        [0.01173, 0.03682, 0.11174],
        [0.00047, 0.03868, 0.05791],
    ];
    const DBFS: [[f64; 3]; 8] = [
        [-24.44, -25.92, -25.09],
        [-82.06, -39.41, -35.89],
        [-46.75, -47.90, -35.03],
        [-86.28, -45.28, -41.76],
        [-55.30, -44.96, -38.96],
        [-88.68, -48.51, -44.99],
        [-61.72, -51.78, -42.14],
        [-89.64, -51.35, -47.85],
    ];
    const STEADY: [f64; 3] = [-27.36, -28.43, -26.72];

    let pi = std::f64::consts::PI;
    // reference frames (the law): signed partials of the four shapes
    let frame_partial = |frame: usize, k: usize| -> f64 {
        let kf = k as f64;
        match frame {
            0 => if k == 1 { 1.0 } else { 0.0 },
            1 => {
                if k % 2 == 1 {
                    (8.0 / (pi * pi)) / (kf * kf)
                        * (if ((k - 1) / 2).is_multiple_of(2) { 1.0 } else { -1.0 })
                } else {
                    0.0
                }
            }
            2 => 2.0 / (pi * kf),
            _ => if k % 2 == 1 { 4.0 / (pi * kf) } else { 0.0 },
        }
    };
    let segment = |pos: f64| -> (usize, f64) {
        let x = (3.0 * pos).clamp(0.0, 3.0);
        let i = (x as usize).min(2);
        (i, x - i as f64)
    };
    let ideal_partial = |pos: f64, k: usize| -> f64 {
        let (i, w) = segment(pos);
        (1.0 - w) * frame_partial(i, k) + w * frame_partial(i + 1, k)
    };
    // production path must BE this ideal mix
    for &p in &POSITIONS {
        for k in 1..=8 {
            assert!(
                (wavetable::frame_harmonic(p, k) - ideal_partial(p, k)).abs() < 1e-12,
                "frame_harmonic({p}, h{k}) diverges from the census law"
            );
        }
    }
    let above_floor = |col: usize| -> Vec<usize> {
        (0..8).filter(|&k| DBFS[k][col] > FLOOR_DBFS + FLOOR_GUARD_DB).collect()
    };
    // cyclic-coordinate LS on gains g1..g3 over the TRAINING positions only
    // (targets signed by the ideal mix; the pinned frame-0 share
    // subtracted) — exactly as the Python fit. Returns (gains, touched):
    // a gain with no training equation stays at the ideal 1.0.
    let fit_gains = |train: &[usize]| -> ([f64; 3], [bool; 3]) {
        let mut touched = [false; 3];
        for &col in train {
            let (i, _) = segment(POSITIONS[col]);
            if i >= 1 {
                touched[i - 1] = true;
            }
            touched[i] = true;
        }
        let mut g = [1.0f64; 3];
        let mut coef = [[0.0f64; 3]; 8];
        let mut target = [0.0f64; 8];
        for _ in 0..500 {
            let mut changed = false;
            for j in 0..3 {
                let mut num = 0.0;
                let mut den = 0.0;
                for &col in train {
                    let p = POSITIONS[col];
                    let (i, w) = segment(p);
                    for k in above_floor(col) {
                        let kh = k + 1;
                        let mut c = [0.0f64; 3];
                        if i == 0 {
                            c[0] = w * frame_partial(1, kh);
                        } else {
                            c[i - 1] += (1.0 - w) * frame_partial(i, kh);
                            c[i] += w * frame_partial(i + 1, kh);
                        }
                        let ideal = ideal_partial(p, kh);
                        let mag = LIN[k][col];
                        let signed = if ideal >= 0.0 { mag } else { -mag };
                        let pinned =
                            if i == 0 { (1.0 - w) * frame_partial(0, kh) } else { 0.0 };
                        target[k] = signed - pinned;
                        coef[k] = c;
                        let cj = c[j];
                        if cj.abs() < 1e-15 {
                            continue;
                        }
                        let rest: f64 =
                            (0..3).filter(|&m| m != j).map(|m| c[m] * g[m]).sum();
                        num += cj * (target[k] - rest);
                        den += cj * cj;
                    }
                }
                if den > 1e-20 {
                    let new = (num / den).max(1e-6);
                    if (new - g[j]).abs() > 1e-12 {
                        changed = true;
                    }
                    g[j] = new;
                }
            }
            if !changed {
                break;
            }
        }
        let gains = [
            if touched[0] { g[0] } else { 1.0 },
            if touched[1] { g[1] } else { 1.0 },
            if touched[2] { g[2] } else { 1.0 },
        ];
        (gains, touched)
    };
    let (g_full, _) = fit_gains(&[0, 1, 2]);
    println!(
        "WT position LOO: full-fit gains [tri {:.4}, saw {:.4}, sqr {:.4}] (ideal 1.0)",
        g_full[0], g_full[1], g_full[2]
    );
    let predict = |pos: f64, g: [f64; 3], k: usize| -> f64 {
        let (i, w) = segment(pos);
        let gi = if i == 0 { 1.0 } else { g[i - 1] };
        let gj = g[i];
        (1.0 - w) * gi * frame_partial(i, k) + w * gj * frame_partial(i + 1, k)
    };
    for held_col in 0..3 {
        let held = POSITIONS[held_col];
        let train: Vec<usize> = (0..3).filter(|&c| c != held_col).collect();
        let (fold_gains, _) = fit_gains(&train);
        // harmonic-profile prediction vs the measured map
        let idx = above_floor(held_col);
        let mut sum = 0.0;
        let mut row = Vec::new();
        for &k in &idx {
            let model_db = 20.0 * predict(held, fold_gains, k + 1).abs().max(1e-9).log10();
            let d = DBFS[k][held_col] - POS0_H1_DBFS - model_db;
            sum += d.abs();
            row.push(format!("h{}:{d:+.2}", k + 1));
        }
        let mean = sum / idx.len() as f64;
        // steady RMS through the production render path (ideal gains — the
        // model carries no frame gains; the LS gains are the fit's device)
        let sr = 44100u32;
        let steady = |pos: f64| {
            let mut v = wavetable::WavetableVoice::default_patch(48, sr);
            v.osc1.wave_position = pos;
            let s = v.render_note(0.875, 1.3);
            audio::rms_db(&s[(sr as f64 * 0.15) as usize..(sr as f64 * 0.70) as usize])
        };
        let pred_rms = steady(held) - steady(0.0);
        let meas_rms = STEADY[held_col] - STEADY_POS0_DBFS;
        println!(
            "WT position LOO hold-out pos {held:4.2}: gains [{:.4} {:.4} {:.4}] \
             per-hΔ {} mean |Δ| {mean:.2} dB (≤{HARMONIC_MEAN_TOL_DB}) | \
             RMS pred {pred_rms:+.2} meas {meas_rms:+.2} Δ {:+.2} dB (±{RMS_TOL_DB})",
            fold_gains[0], fold_gains[1], fold_gains[2],
            row.join(" "),
            meas_rms - pred_rms
        );
        assert!(
            mean <= HARMONIC_MEAN_TOL_DB,
            "WT LOO pos {held}: harmonic mean |Δ| {mean:.2} dB (≤{HARMONIC_MEAN_TOL_DB})"
        );
        assert!(
            (meas_rms - pred_rms).abs() <= RMS_TOL_DB,
            "WT LOO pos {held}: steady RMS Δ {:+.2} dB (±{RMS_TOL_DB})",
            meas_rms - pred_rms
        );
    }
}

// ---------------------------------------------------------------------------
// Glue circuit-model gates (circuit-model lane, 2026-10-08; integration redo
// same day — the corrected per-block-derivation mechanism)
//
// Thresholds STATED BEFORE the fitted closure was calibrated and before any
// envelope render was measured with the model (see verify.rs consts and the
// derivation section of devices/glue-compressor.md):
//   C1 static steady state: |model − render| ≤ 1.0 dB per step window
//      (4 steps) × every pin (G12_LONG, G13_LONG_A10, G14_LONG_R4,
//      G15_LONG_AR).
//   C2 release tail, on the RELEASE-PROBE trio (G17/G19/G18): (a) model
//      release τ within ±25% of the render's; (b) loud-segment steady level
//      within the same ±1.0 dB. The steps-long renders are NOT used for C2:
//      their tail is silence, which is blind to gain recovery — the
//      documented reason the release-probe signal exists
//      (harness/gen_signals.py #5).
//
// STATUS after the integration redo (2026-10-08 — the ledger-constants
// model of devices/glue-perblock-derivation.md, §"Integration result"): the
// two named residuals of the fitted closure are CLOSED.
//   - Attack coupling: the model now SHALLOWS with slow attack (the y
//     lowpass DC gain A/(A+R̂)); G13 flips FAIL→PASS (worst 0.56 dB) and G15
//     misses one step by 0.14 dB.
//   - Recovery: the under-branch (y, s38) 2-D system relaxes on the measured
//     release law; the gate's own τ metric reads model 100/180/320 ms vs
//     render 100/180/320 ms — exact; the 1.6× fast tail is gone.
// REMAINING residual (named, open): the fast-attack steady depth is
// ~1.9-2.1 dB shallow at attack menu index 1 (G12/G14 over-threshold steps,
// the C2 loud-segment level, and G15 step 2 at 1.14 dB), while the
// slow-attack pins are exact. The residual lives in the per-sample scale of
// the A·k feedback term of the over-branch x-solve — the term vanishes at
// attack index 5, which is why those pins are exact. This is precisely the
// open per-sample coefficient scaling of the per-block derivation (§4 there):
// the ledger's µs-magnitude reading is the model's stated choice and the
// gates keep it honest. The curve-based model (`static_gain_change_db`)
// remains the gate of record for static behavior.
// LAM OUTCOME (2026-10-08, glue_lam_lambda_discriminator_gate below): the
// idx-5 deep-over discriminator REFUTES the per-sample scale as the
// residual's home — the deep-over deficit is the same ≈2 dB at attack idx 5
// (where λ·A·k is ~100× smaller) as at idx 1, monotone in over-level. The
// deficit tracks solved depth, not the coefficient scale; verdict and
// residuals in devices/glue-compressor.md "LAM verdict". This gate stays
// failing under #[ignore] as the honest record and the acceptance target.
// CLOSURE (2026-10-08, equilibrium lane — devices/glue-compressor.md
// "Over-branch equilibrium closure"): the residual is closed by the
// equilibrium re-derivation's two findings, both now in the model:
//   1. the ATTACK PIN MAP was wrong — the setter switch has no case 2
//      (stored 2 → case 2/2700 µs via `default`), and the out-of-range
//      stored 20 is host-clamped to case 6 (the A20 renders pin case 6 at
//      0.01 dB);
//   2. the detector-feed trajectory carries a ×1.40 gain the captured
//      constants cannot supply (DETECTOR_TAP_GAIN in glue.rs — the writer
//      slot is the named open binary item).
// The gate table after closure (this run): C1 worst |Δ| 0.02 dB (all four
// pins), C2 τ exact 100/180/320 ms + loud ≤0.01 dB, LAM worst |Δ| 0.00 dB
// with the G13 re-check exact. The gates stay render-dependent under
// #[ignore] per this file's convention; they now PASS.

fn synth_steps_long(sr: u32) -> Vec<f32> {
    // harness/gen_signals.py spec #4: 0.5 s silence, 2.5 s steps at
    // −18/−12/−6/0 dBFS peak (1 kHz), 4 s tail.
    let n = (14.5 * sr as f64) as usize;
    let mut s = vec![0f32; n];
    let w = 2.0 * std::f64::consts::PI * 1000.0 / sr as f64;
    for (i, db) in [-18.0f64, -12.0, -6.0, 0.0].iter().enumerate() {
        let start = ((0.5 + 2.5 * i as f64) * sr as f64) as usize;
        let end = (start + (2.5 * sr as f64) as usize).min(n);
        let a = 10f64.powf(db / 20.0);
        for (k, slot) in s[start..end].iter_mut().enumerate() {
            *slot = (a * (w * (start + k) as f64).sin()) as f32;
        }
    }
    s
}

fn circuit_params(att: usize, rel: usize) -> glue::CircuitParams {
    glue::CircuitParams {
        threshold_db: -12.0,
        range_db: 30.0,
        ratio_index: 1,
        attack_idx: att,
        release_idx: rel,
        makeup_db: 0.0,
        dry_wet: 1.0,
        peak_clip_in: true,
        block_size: 128,
    }
}

#[test]
#[ignore]
fn glue_circuit_golden_envelope_gate() {
    let sr = 44100u32;
    let signal = synth_steps_long(sr);
    let pins: [(&str, usize, usize); 4] = [
        // Attack pin map (equilibrium lane, 2026-10-08): the setter switch
        // [S117-155] has NO case 2 — stored Attack 2 falls to `default`
        // (2700 µs = case 2), and stored 20 is clamped by the host parameter
        // layer to 6 (270000 µs) — the A20 renders' committed maps pin case 6
        // (the model there reproduces G13/G15 to 0.01 dB; cases 5/2 miss by
        // ≥0.9 dB). See glue.rs ATTACK_MENU_US.
        ("G12_LONG.aif", 2, 0), // Attack stored 2 → setter default → case 2
        ("G13_LONG_A10.aif", 6, 0), // Attack stored 20 → clamped → case 6
        ("G14_LONG_R4.aif", 2, 4),
        ("G15_LONG_AR.aif", 6, 4),
    ];
    let mut failures: Vec<String> = Vec::new();
    for (file, att, rel) in pins {
        println!("== {file} (attack idx {att}, release idx {rel})");
        let render = read_render(file);
        let got = glue::measure_envelope(&render.samples, render.sample_rate);
        let mut m = glue::CircuitModel::new(circuit_params(att, rel), glue::CircuitFit::default(), sr);
        let mut out = vec![0f32; signal.len()];
        let mut out_r = vec![0f32; signal.len()];
        m.process_block(&signal, &signal, &mut out, &mut out_r);
        let pred = glue::measure_envelope(&out, sr);

        let mut worst = 0.0f64;
        for (i, (g, p2)) in got.steady_state_db.iter().zip(&pred.steady_state_db).enumerate() {
            let d = p2 - g;
            worst = worst.max(d.abs());
            println!(
                "  step {i}: render {g:8.2}  model {p2:8.2}  Δ {d:+.2} dB (tol ±{:.1})",
                verify::CIRCUIT_STATIC_TOL_DB
            );
            if d.abs() > verify::CIRCUIT_STATIC_TOL_DB {
                failures.push(format!("{file} step {i}: model {p2:.2} vs render {g:.2}"));
            }
        }
        println!("  worst static Δ {worst:.2} dB");
    }
    assert!(
        failures.is_empty(),
        "C1 static gate failed:
  {}",
        failures.join("
  ")
    );
}

/// Release-τ measurement on the release-probe timeline (2 s at −6 dBFS peak,
/// then 4 s at −36 dBFS peak, 1 s tail): the remaining GR gap above the
/// recovered quiet-segment level decays single-pole; τ = first crossing of
/// 1/e of the initial gap (20 ms windows, matching the dossier's method).
/// Returns (τ s, loud-segment RMS, quiet-segment RMS).
fn release_probe_tau(samples: &[f32], sr: u32) -> (f64, f64, f64) {
    let q_final = audio::rms_db(&samples[(5.0 * sr as f64) as usize..(5.5 * sr as f64) as usize]);
    let loud = audio::rms_db(&samples[(1.0 * sr as f64) as usize..(1.9 * sr as f64) as usize]);
    let mut gap0 = f64::NAN;
    let mut tau = f64::NAN;
    let mut t = 2.0;
    while t < 5.5 {
        let a = (t * sr as f64) as usize;
        let b = ((t + 0.02) * sr as f64) as usize;
        let gap = q_final - audio::rms_db(&samples[a..b]);
        if gap0.is_nan() {
            gap0 = gap;
        }
        if gap <= gap0 / std::f64::consts::E {
            tau = t - 2.0;
            break;
        }
        t += 0.02;
    }
    (tau, loud, q_final)
}

#[test]
#[ignore]
fn glue_circuit_golden_release_gate() {
    let sr = 44100u32;
    // release-probe signal: 2 s at −6 dBFS peak, 4 s at −36 dBFS peak,
    // 1 s tail (harness/gen_signals.py #5)
    let n = (7.0 * sr as f64) as usize;
    let mut signal = vec![0f32; n];
    let w = 2.0 * std::f64::consts::PI * 1000.0 / sr as f64;
    for (i, slot) in signal.iter_mut().enumerate() {
        let db = if i < 2 * sr as usize {
            -6.0
        } else if i < 6 * sr as usize {
            -36.0
        } else {
            -144.0
        };
        *slot = if db < -140.0 {
            0.0
        } else {
            (10f64.powf(db / 20.0) * (w * i as f64).sin()) as f32
        };
    }
    let pins = [
        ("G17_REL0.aif", 0usize, 80.28f64), // measured τ, dossier table
        ("G19_REL2.aif", 2, 160.27),
        ("G18_REL4.aif", 4, 302.46),
    ];
    let mut failures: Vec<String> = Vec::new();
    for (file, rel, tau_dossier_ms) in pins {
        println!("== {file} (release idx {rel})");
        let render = read_render(file);
        let (tau_r, loud_r, _) = release_probe_tau(&render.samples, render.sample_rate);
        // Attack stored 2 → setter default → case 2 (see the envelope gate).
        let mut m = glue::CircuitModel::new(circuit_params(2, rel), glue::CircuitFit::default(), sr);
        let mut out = vec![0f32; n];
        let mut out_r = vec![0f32; n];
        m.process_block(&signal, &signal, &mut out, &mut out_r);
        let (tau_m, loud_m, _) = release_probe_tau(&out, sr);

        println!(
            "  release τ: render {:7.1} ms  model {:7.1} ms  (dossier {tau_dossier_ms:.1}; tol ±{:.0}%)",
            tau_r * 1000.0,
            tau_m * 1000.0,
            verify::CIRCUIT_RELEASE_TAU_TOL * 100.0
        );
        if (tau_m - tau_r).abs() / tau_r > verify::CIRCUIT_RELEASE_TAU_TOL {
            failures.push(format!(
                "{file}: release τ model {:.1} ms vs render {:.1} ms",
                tau_m * 1000.0,
                tau_r * 1000.0
            ));
        }
        // loud-segment steady level (the Release-shift on steady GR, dossier
        // −3.91/−4.03/−4.13 dB GR): same ±1.0 dB static tolerance
        let d = loud_m - loud_r;
        println!("  loud-segment RMS: render {loud_r:.2}  model {loud_m:.2}  Δ {d:+.2} dB");
        if d.abs() > verify::CIRCUIT_STATIC_TOL_DB {
            failures.push(format!("{file}: loud-segment Δ {d:.2} dB"));
        }
    }
    assert!(
        failures.is_empty(),
        "C2 release gate failed:\n  {}",
        failures.join("\n  ")
    );
}


// ---------------------------------------------------------------------------
// LAM λ discriminator — the CircuitModel against the deep-over slow-attack
// render (bounded comparison lane, 2026-10-08)
//
// The render `LAM_T24_A5_R60.aif` (T=−24, Range=60, Ratio 1, Attack menu
// idx 5, Release 0, Makeup 0, steps-1k, PeakClipIn inert — output peak
// ≈ −17.5 dBFS, far under the −0.50 dBFS clip ceiling) is the discriminator
// devices/glue-perblock-derivation.md §7 asks for: the over-branch x-solve's
// feedback term carries the per-sample scale λ·A·k, ~100× smaller at attack
// idx 5 than at idx 1 — where the model's pins are already exact. A pass
// here says the ledger model reproduces the measured deep-over curve family
// with NO new fitted constant, closing the mechanism; a fail names the
// residual structure.
//
// Thresholds STATED BEFORE the model was run against the render:
//   - per-step closure bar |model GR − render GR| ≤ 1.0 dB at all four
//     over-threshold steps (+6/+12/+18/+24), the C1 static tolerance;
//   - AND the G13 pin (idx 5's shallow case at T−12/R30 — the envelope
//     gate's one passing attack pin) stays within the same ±1.0 dB.
//   Both hold ⇒ the λ term is CONFIRMED-BY-SIMULATION at idx 5.
#[test]
#[ignore]
fn glue_lam_lambda_discriminator_gate() {
    const LAM_TOL_DB: f64 = verify::CIRCUIT_STATIC_TOL_DB; // ±1.0 dB, stated above
    let sr = 44100u32;

    // steps-1k: 0.25 s silence lead, 0.5 s steps at −30..0 dBFS peak (1 kHz),
    // 1.5 s tail (harness/gen_signals.py #1)
    let n = (5.25 * sr as f64) as usize;
    let mut signal = vec![0f32; n];
    let w = 2.0 * std::f64::consts::PI * 1000.0 / sr as f64;
    for (i, db) in [-30.0f64, -24.0, -18.0, -12.0, -6.0, -3.0, 0.0]
        .iter()
        .enumerate()
    {
        let start = ((0.25 + 0.5 * i as f64) * sr as f64) as usize;
        let end = (start + (0.5 * sr as f64) as usize).min(n);
        let a = 10f64.powf(db / 20.0);
        for (k, slot) in signal[start..end].iter_mut().enumerate() {
            *slot = (a * (w * (start + k) as f64).sin()) as f32;
        }
    }

    // the model at the exact LAM pins
    let mut m = glue::CircuitModel::new(
        glue::CircuitParams {
            threshold_db: -24.0,
            range_db: 60.0,
            ratio_index: 1,
            attack_idx: 5,
            release_idx: 0,
            makeup_db: 0.0,
            dry_wet: 1.0,
            peak_clip_in: true,
            block_size: 128,
        },
        glue::CircuitFit::default(),
        sr,
    );
    let mut out = vec![0f32; n];
    let mut out_r = vec![0f32; n];
    m.process_block(&signal, &signal, &mut out, &mut out_r);

    let render = read_render("LAM_T24_A5_R60.aif");

    // mid-step windows [t0+0.15, t0+0.45], t0 = 0.25 + k·0.5 — reproduces the
    // committed gain map to ≤0.01 dB (checked against analyze_render.py)
    let window_rms = |buf: &[f32], rate: u32, k: usize| -> f64 {
        let t0 = 0.25 + 0.5 * k as f64;
        let a = ((t0 + 0.15) * rate as f64) as usize;
        let b = ((t0 + 0.45) * rate as f64) as usize;
        audio::rms_db(&buf[a..b.min(buf.len())])
    };

    // steps −18/−12/−6/0 dBFS peak = +6/+12/+18/+24 over T=−24
    // (step index k = 2, 3, 4, 6 on the t0 = 0.25 + k·0.5 grid);
    // GR = out_rms − (peak − 3.01), the render's own gain-map arithmetic
    let over_k = [2usize, 3, 4, 6];
    let peak_db = [-18.0f64, -12.0, -6.0, 0.0];
    let over_db = [6.0f64, 12.0, 18.0, 24.0];
    let mut worst = 0.0f64;
    let mut failures: Vec<String> = Vec::new();
    println!("== LAM_T24_A5_R60: model (ledger constants, attack idx 5) vs render");
    for (i, k) in over_k.iter().enumerate() {
        let in_rms = peak_db[i] - 3.01;
        let gr_render = window_rms(&render.samples, render.sample_rate, *k) - in_rms;
        let gr_model = window_rms(&out, sr, *k) - in_rms;
        let d = gr_model - gr_render;
        worst = worst.max(d.abs());
        println!(
            "  +{:>2} over: render {gr_render:7.2}  model {gr_model:7.2}  Δ {d:+.2} dB (tol ±{LAM_TOL_DB:.1})",
            over_db[i]
        );
        if d.abs() > LAM_TOL_DB {
            failures.push(format!("+{} over: model {gr_model:.2} vs render {gr_render:.2}", over_db[i]));
        }
    }
    println!("  worst |Δ| {worst:.2} dB");

    // the closure condition's second leg: G13 (stored Attack 20 → case 6,
    // T−12/R30) must still pass — model vs G13_LONG_A10.aif on steps-long,
    // ±1.0 dB. (Pin per the setter switch + host clamp; see the envelope gate.)
    println!("== G13_LONG_A10 re-check (stored Attack 20 → case 6, T−12/R30)");
    let long = synth_steps_long(sr);
    let mut m13 = glue::CircuitModel::new(circuit_params(6, 0), glue::CircuitFit::default(), sr);
    let mut out13 = vec![0f32; long.len()];
    let mut out13_r = vec![0f32; long.len()];
    m13.process_block(&long, &long, &mut out13, &mut out13_r);
    let got13 = glue::measure_envelope(&read_render("G13_LONG_A10.aif").samples, sr);
    let pred13 = glue::measure_envelope(&out13, sr);
    for (i, (g, p)) in got13.steady_state_db.iter().zip(&pred13.steady_state_db).enumerate() {
        let d = p - g;
        println!("  step {i}: render {g:8.2}  model {p:8.2}  Δ {d:+.2} dB (tol ±{LAM_TOL_DB:.1})");
        if d.abs() > LAM_TOL_DB {
            failures.push(format!("G13 step {i}: model {p:.2} vs render {g:.2}"));
        }
    }

    assert!(
        failures.is_empty(),
        "LAM λ gate failed:\n  {}",
        failures.join("\n  ")
    );
}

// ---------------------------------------------------------------------------
// Echo E1 gate (circuit-model lane, 2026-10-08)
//
// Thresholds STATED BEFORE the model was run against the render: taps within
// ±1 ms of t0 + k×0.1875 s (k = 1..6, the six taps visible in E1 at FB 0.5);
// per-hop level slopes (5 successive deltas) within ±1.0 dB of the model tap
// table fitted to the E1 dossier table.

#[test]
#[ignore]
fn echo_e1_golden_gate() {
    // Per-channel measurement: the pingpong taps alternate L/R, so the mono
    // mixdown halves every tap and lets the reverb floor mask the late ones.
    let bytes = std::fs::read(format!("{RENDERS}/E1_IMPULSE_default_v2.aif")).unwrap();
    let (ch_l, ch_r) = audio::read_aiff_i16_channels(&bytes).unwrap();
    let sr = ch_l.sample_rate;
    let t0 = verify::find_direct_sample(&ch_l.samples, sr);
    let t0_s = t0 as f64 / sr as f64;
    let cfg = taps_echo::e1_config();
    let hop = cfg.hop_s();

    // expected tap times split by channel: odd taps L (k = 1, 3, 5), even R
    let l_times: Vec<f64> = [1usize, 3, 5].iter().map(|k| t0_s + *k as f64 * hop).collect();
    let r_times: Vec<f64> = [2usize, 4, 6].iter().map(|k| t0_s + *k as f64 * hop).collect();
    // Level extraction uses the dossier's own ±8 ms scan width
    // (harness/analyze_echo_taps.py); the ±1 ms TIME gate is asserted below
    // for the first-pass taps and relaxed to ±2 ms for the recirculated ones
    // because the evidence itself records ±1.5 ms of modulation wobble on
    // the E1 grid (devices/echo.md: "E1/E7 grids match within ±1.5 ms").
    let m_l = taps::tap_table(&ch_l.samples, sr, &l_times, 0.008);
    let m_r = taps::tap_table(&ch_r.samples, sr, &r_times, 0.008);
    assert_eq!(m_l.len(), 3, "missing L taps");
    assert_eq!(m_r.len(), 3, "missing R taps");
    // tap numbering follows the dossier table: odd taps L, even taps R;
    // collect per channel first, then interleave into global order 1..6
    let mut peaks_l = Vec::with_capacity(3);
    let mut peaks_r = Vec::with_capacity(3);
    for (ch, table, times, first_k) in
        [("L", &m_l, &l_times, 1usize), ("R", &m_r, &r_times, 2usize)]
    {
        for (i, m) in table.iter().enumerate() {
            let k = first_k + 2 * i; // global tap number (1-based)
            let expected = times[i];
            // ±1 ms on the first-pass taps; ±2 ms on the recirculated taps
            // (the evidence records ±1.5 ms of modulation wobble on the E1
            // grid — devices/echo.md "Sync mode")
            let tol = if k <= 2 { 0.001 } else { 0.002 };
            println!(
                "  tap {k} ({ch}) @ +{:8.3} ms (expected +{:8.3}): {:7.2} dBFS",
                (m.time_s - t0_s) * 1000.0,
                (expected - t0_s) * 1000.0,
                m.peak_dbfs
            );
            assert!(
                (m.time_s - expected).abs() <= tol,
                "tap {k} time off beyond ±{tol} s"
            );
            if ch == "L" {
                peaks_l.push(m.peak_dbfs);
            } else {
                peaks_r.push(m.peak_dbfs);
            }
        }
    }
    let mut measured_peaks = Vec::with_capacity(6);
    for k in 0..6usize {
        measured_peaks.push(if k % 2 == 0 { peaks_l[k / 2] } else { peaks_r[k / 2] });
    }

    // compare the five successive per-hop level slopes against the model tap
    // table (±1.0 dB, stated before the model was run against the render)
    let model_peaks = taps_echo::e1_family_tap_peaks_db(&cfg);
    let model_slopes: Vec<f64> = model_peaks.windows(2).map(|w| w[1] - w[0]).collect();
    let measured_slopes: Vec<f64> =
        measured_peaks.windows(2).map(|w| w[1] - w[0]).collect();
    for (k, (m, p)) in measured_slopes.iter().zip(&model_slopes).enumerate() {
        println!(
            "  slope tap{}→{}: render {m:+7.2}  model {p:+7.2}  Δ {:+.2} (tol ±1.0)",
            k + 1,
            k + 2,
            m - p
        );
        assert!((m - p).abs() <= 1.0, "E1 hop slope {}: render {m:.2} vs model {p:.2}", k + 1);
    }
}
