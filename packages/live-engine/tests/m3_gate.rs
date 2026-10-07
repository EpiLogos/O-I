//! THE M3 GATE (shell/SHELL-BLUEPRINT.md, "M3 device hosting").
//!
//! The engine hosts Echo and Reverb; the gates render the harness impulse
//! (`harness/signals/impulse.wav`, the same signal the golden lane used)
//! through the engine devices and compare against the golden renders with
//! the live-dynamics gate thresholds:
//!
//! - Echo vs `E8_BARE.aif` (devices/echo.md D8, the bare-line baseline):
//!   tap table via `live_dynamics::taps` — every tap time within ±1 ms of
//!   the measured k·hop grid, taps 1–2 first-pass, and the per-hop decay
//!   slope of the recirculated taps at 20·log10(FB) (engine exact; the
//!   golden render carries the documented settling residual).
//! - Reverb vs `R1_IMPULSE_default_v2.aif` / `R3_DECAY600.aif` /
//!   `R4_DECAY2400.aif` (devices/reverb.md): per-band RT60 (broadband +
//!   the four gate bands, floor-aware least squares, the stated fit
//!   windows) at ±10% (default pin) / ±20% (DecayTime scaling pins), and
//!   the 48-band static spectrum at mean ≤1.5 dB / max band ≤3.0 dB.
//!
//! #[ignore]-gated like `live-dynamics/tests/golden.rs`: they need the
//! render bytes under `harness/renders/`. Run: cargo test -- --ignored

use live_dynamics::audio;
use live_dynamics::echo;
use live_dynamics::reverb::ReverbParams;
use live_dynamics::spectrum;
use live_dynamics::taps;
use live_dynamics::verify;
use live_engine::devices::{EchoDevice, EchoParams, ReverbDevice};
use live_engine::wav::read_wav_f32;
use live_engine::{Graph, Track};

const RENDERS: &str =
    "../../docs/research/ableton-live-12.0.25/harness/renders";
const IMPULSE: &str =
    "../../docs/research/ableton-live-12.0.25/harness/signals/impulse.wav";

/// The golden export rate (devices/echo.md + reverb.md: 44.1 kHz / 16-bit).
const SR: u32 = 44_100;

/// The harness impulse: unit impulse at wav sample 100 (48 kHz), stereo
/// (gen_signals.py). The engine plays the buffer at the render rate, so
/// the impulse sits at frame 100 of an SR-rate render.
fn load_impulse() -> Vec<f32> {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(IMPULSE);
    let bytes = std::fs::read(&path)
        .unwrap_or_else(|e| panic!("harness impulse missing at {}: {e}", path.display()));
    let wav = read_wav_f32(&bytes).expect("impulse.wav must parse");
    assert_eq!(wav.channels, 2, "impulse.wav is stereo");
    wav.samples
}

/// One stereo track carrying `source` through `device`, master at unity —
/// rendered at the golden rate.
fn render_source_set(source: Vec<f32>, device: Box<dyn live_engine::Device>) -> Vec<f32> {
    let mut g = Graph::new(SR, 120.0);
    let mut t = Track::new("STIM", 2);
    t.source = source;
    t.devices.push(device);
    g.tracks.push(t);
    g.render(SR)
}

/// The impulse source aligned so the engine render's direct sits on the
/// golden render's direct sample (R1: sample 92 — the export's SRC/latency
/// position). The live-dynamics gate aligns its model buffer the same way
/// (`model_buffer_at_direct`) so both sides see identical analysis
/// geometry: in the tail-quiet top bands the direct's windowed energy
/// dominates, and an unaligned delta swings those bands by ~0.5–1.5 dB.
fn aligned_source(golden: &audio::Audio) -> Vec<f32> {
    let wav = load_impulse();
    let p0 = (0..wav.len() / 2)
        .max_by_key(|i| wav[i * 2].abs().to_bits())
        .unwrap_or(0); // impulse frame in the wav (sample 100)
    let direct_g = verify::find_direct_sample(&golden.samples, golden.sample_rate);
    let skip = p0.saturating_sub(direct_g);
    wav[skip * 2..].to_vec()
}

/// Mono mixdown — the analysis side of the gates (same as
/// `live_dynamics::audio`).
fn mixdown(render: &[f32]) -> Vec<f32> {
    render.as_chunks::<2>().0.iter().map(|f| (f[0] + f[1]) * 0.5).collect()
}

fn read_render(name: &str) -> audio::Audio {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(RENDERS).join(name);
    let bytes = std::fs::read(&path)
        .unwrap_or_else(|e| panic!("golden render missing at {}: {e}", path.display()));
    audio::read_aiff_i16(&bytes).unwrap()
}

/// Least-squares slope (dB per hop) over the tap amps k = k0..=k1.
fn slope_per_hop(taps_db: &[(usize, f64)]) -> f64 {
    let n = taps_db.len() as f64;
    let sx: f64 = taps_db.iter().map(|(k, _)| *k as f64).sum();
    let sy: f64 = taps_db.iter().map(|(_, a)| *a).sum();
    let sxx: f64 = taps_db.iter().map(|(k, _)| (*k as f64) * (*k as f64)).sum();
    let sxy: f64 = taps_db.iter().map(|(k, a)| *k as f64 * *a).sum();
    (n * sxy - sx * sy) / (n * sxx - sx * sx)
}

fn rt60_table(label: &str, fits: &[verify::Rt60Fit]) {
    for f in fits {
        println!(
            "{label} {:>14}  {:>8.1} dB/s  RT60 {:6.3} s  ({} blocks)",
            f.name, f.slope_db_s, f.rt60_s, f.blocks
        );
    }
}

fn check_rt60(
    engine_mono: &[f32],
    golden: &audio::Audio,
    t0: f64,
    t1: f64,
    tol: f64,
) {
    let sr = golden.sample_rate;
    let g_fits = verify::reverb_rt60_fits(&golden.samples, sr, t0, t1);
    let e_fits = verify::reverb_rt60_fits(engine_mono, sr, t0, t1);
    rt60_table("golden", &g_fits);
    rt60_table("engine", &e_fits);
    assert_eq!(
        g_fits.len(),
        e_fits.len(),
        "fit coverage mismatch: a band fit the golden render but not the engine"
    );
    for e in verify::compare_rt60(&g_fits, &e_fits) {
        println!(
            "  {:>14}  golden {:6.3}  engine {:6.3}  err {:5.1}%  (tol {:.0}%)",
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

fn check_spectral(engine_mono: &[f32], golden: &audio::Audio) {
    let sr = golden.sample_rate as usize;
    let win = (4.0 * sr as f64) as usize;
    let pg = spectrum::band_profile(&golden.samples[..win.min(golden.samples.len())], golden.sample_rate, 48);
    let pe = spectrum::band_profile(&engine_mono[..win.min(engine_mono.len())], golden.sample_rate, 48);
    let d = spectrum::band_distance(&pg, &pe);
    println!(
        "spectral (48 bands, [0,4) s): mean {:.2} dB (tol {:.1}), max band {:.2} dB (tol {:.1})",
        d.mean_db,
        verify::REVERB_SPECTRAL_MEAN_TOL_DB,
        d.max_band_db,
        verify::REVERB_SPECTRAL_MAX_BAND_TOL_DB
    );
    // name the worst bands (a gate failure must say where)
    let mut bands: Vec<(usize, f64)> = (0..48).map(|i| (i, (pe[i] - pg[i]).abs())).collect();
    bands.sort_by(|x, y| y.1.partial_cmp(&x.1).unwrap());
    for (i, e) in bands.iter().take(4) {
        println!("  band {i:2}: golden {:7.2}  engine {:7.2}  |Δ| {e:.2} dB", pg[*i], pe[*i]);
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

// ---------------------------------------------------------------------------
// Echo vs E8_BARE

#[test]
#[ignore]
fn m3_gate_echo_bare_line_matches_the_e8_render() {
    // E8_BARE pins (devices/echo.md): sync-mode bare line at 120 BPM —
    // hop 0.1875 s — FB 0.5, DryWet 1 (no direct). The engine device is
    // the free-mode seconds law, so the gate pins the measured hop
    // directly.
    const HOP_S: f64 = 0.1875;
    const FB: f64 = 0.5;
    const N_TAPS: usize = 8; // the documented E8 tap table
    let device = EchoDevice::new(EchoParams {
        delay_time_s: HOP_S,
        feedback: FB,
        dry_wet: 1.0,
    });
    let engine_mono = mixdown(&render_source_set(load_impulse(), Box::new(device)));
    let golden = read_render("E8_BARE.aif");

    // tap grids: the impulse rides at wav sample 100 (gen_signals.py); the
    // golden export carries it at 100/48000 (E8 grid "exact to ≤0.5 ms"),
    // the engine render at 100/44100 (the buffer plays at the render rate)
    let t0g = 100.0 / 48_000.0;
    let t0e = 100.0 / SR as f64;
    let expected_g: Vec<f64> = (1..=N_TAPS).map(|k| t0g + k as f64 * HOP_S).collect();
    let expected_e: Vec<f64> = (1..=N_TAPS).map(|k| t0e + k as f64 * HOP_S).collect();

    let gate = taps::TapGate::default(); // ±1 ms
    let g_table = taps::tap_table(&golden.samples, golden.sample_rate, &expected_g, gate.max_time_err_s);
    let e_table = taps::tap_table(&engine_mono, SR, &expected_e, gate.max_time_err_s);
    assert_eq!(g_table.len(), N_TAPS, "golden E8 taps missing: {g_table:?}");
    assert_eq!(e_table.len(), N_TAPS, "engine taps missing: {e_table:?}");

    println!("M3 gate — engine bare line vs E8_BARE.aif (hop {HOP_S} s, FB {FB}, 100% wet)");
    println!("  tap  golden time   engine time   Δ ms   golden dB    engine dB");
    for (k, (g, e)) in g_table.iter().zip(e_table.iter()).enumerate() {
        let dt = (e.time_s - g.time_s) * 1000.0;
        println!(
            "  {:>3}  {:>11.4}  {:>11.4}  {:>6.2}  {:>9.2}  {:>10.2}",
            k + 1,
            g.time_s,
            e.time_s,
            dt,
            g.peak_dbfs,
            e.peak_dbfs
        );
        assert!(dt.abs() <= 1.0, "tap {} time off by {dt:.2} ms (tol ±1)", k + 1);
        assert!(
            (e.time_s - expected_e[k]).abs() <= gate.max_time_err_s,
            "engine tap {} off the k·hop grid",
            k + 1
        );
    }

    // amplitudes: the engine must realize the modeled law exactly
    // (mixdown halves each pingpong tap ⇒ first tap at −6.02 dBFS);
    let law = echo::tap_amplitudes_db(-6.0206, FB, N_TAPS);
    for (k, (e, l)) in e_table.iter().zip(law.iter()).enumerate() {
        assert!(
            (e.peak_dbfs - l).abs() < 0.05,
            "engine tap {} amp {:.2} vs law {l:.2}",
            k + 1,
            e.peak_dbfs
        );
    }
    // taps 1–2 first-pass: equal in the engine (the FB-invariance across
    // renders is asserted in the device unit tests)
    assert!(
        (e_table[0].peak_dbfs - e_table[1].peak_dbfs).abs() < 0.01,
        "engine taps 1–2 not first-pass"
    );

    // per-hop decay slope over the recirculated taps (3..=8): the engine
    // is one FB application per hop; the golden render carries the
    // documented D8 settling residual (first recirculation −3.5 dB), so
    // the tolerance absorbs it
    let g_pts: Vec<(usize, f64)> = (3..=N_TAPS).map(|k| (k, g_table[k - 1].peak_dbfs)).collect();
    let e_pts: Vec<(usize, f64)> = (3..=N_TAPS).map(|k| (k, e_table[k - 1].peak_dbfs)).collect();
    let g_slope = slope_per_hop(&g_pts);
    let e_slope = slope_per_hop(&e_pts);
    let law_slope = 20.0 * FB.log10();
    println!(
        "  per-hop slope k=3..8: golden {g_slope:.3}  engine {e_slope:.3}  law {law_slope:.3} dB/hop"
    );
    assert!(
        (e_slope - law_slope).abs() <= 0.25,
        "engine per-hop slope {e_slope:.3} off the law {law_slope:.3}"
    );
    assert!(
        (e_slope - g_slope).abs() <= 1.0,
        "engine vs golden per-hop slope: {e_slope:.3} vs {g_slope:.3} (residual > 1 dB/hop)"
    );
}

// ---------------------------------------------------------------------------
// Reverb vs the decay-pin renders

fn reverb_gate(file: &str, decay_ms: f64, t0: f64, t1: f64, rt60_tol: f64, check_spectrum: bool) {
    let golden = read_render(file);
    let device = ReverbDevice::new(ReverbParams { decay_ms }, 1.0);
    let engine_mono = mixdown(&render_source_set(aligned_source(&golden), Box::new(device)));
    assert_eq!(golden.sample_rate, SR, "golden render rate");
    println!("M3 gate — engine Reverb(decay {decay_ms} ms) vs {file}");
    check_rt60(&engine_mono, &golden, t0, t1, rt60_tol);
    if check_spectrum {
        check_spectral(&engine_mono, &golden);
    }
}

#[test]
#[ignore]
fn m3_gate_reverb_matches_the_default_render() {
    // stated default-pin fit window (the same one the live-dynamics
    // golden gate pins, clean above the dither floor on all bands)
    reverb_gate(
        "R1_IMPULSE_default_v2.aif",
        1200.00012, // stored DecayTime (evidence/devices/Reverb/default.xml)
        0.25,
        0.60,
        verify::REVERB_RT60_TOL_DEFAULT_PIN,
        true,
    );
}

#[test]
#[ignore]
fn m3_gate_reverb_decay_scaling_matches() {
    // D5 scaling pins with their stated clean fit windows (backlog row
    // tolerance ±20%)
    reverb_gate(
        "R3_DECAY600.aif",
        600.0,
        0.10,
        0.30,
        verify::REVERB_RT60_TOL_SCALING,
        false,
    );
    reverb_gate(
        "R4_DECAY2400.aif",
        2400.0,
        0.40,
        1.20,
        verify::REVERB_RT60_TOL_SCALING,
        false,
    );
}
