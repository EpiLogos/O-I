//! Golden tests — activate when the render lane's outputs are present.
//! Run: cargo test -- --ignored

use live_dynamics::audio;
use live_dynamics::glue::{self, GlueParams};
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
