//! THE M1 GATE (shell/SHELL-BLUEPRINT.md, "M1 graph core").
//!
//! The engine renders a synthetic set — the harness steps signal
//! (`harness/signals/steps-1k.wav`, 48 kHz float32 stereo) as one stereo
//! track through a GlueDevice pinned to the canonical G1 gate pins
//! (Threshold −12, Range 30, Ratio 1, Makeup 0), all staging at unity —
//! and the OUTPUT RMS of every level step is gated against
//! `live-dynamics`' static predictions at 0.5 dB (the same
//! `verify::STATIC_TOLERANCE_DB` the DSP models are gated against, same
//! step windows as `verify::static_gate`). This validates graph, device
//! and mixer against the same golden truth that the DSP models are
//! gated on: the G1 gain map in `devices/glue-compressor.md`.

use live_dynamics::audio::rms_db;
use live_dynamics::glue::{self, GlueParams};
use live_dynamics::verify;
use live_engine::devices::{BypassDevice, GlueDevice};
use live_engine::wav::read_wav_f32;
use live_engine::{Graph, Track};

const SIGNAL: &str =
    "../../docs/research/ableton-live-12.0.25/harness/signals/steps-1k.wav";

const SR: u32 = 48_000;

/// The G1 canonical pins (devices/glue-compressor.md, point
/// G1_T-12_R30_MU0_v2): Threshold −12, Range 30, Ratio 1, Makeup 0.
fn gate_params() -> GlueParams {
    GlueParams { threshold_db: -12.0, range: 30.0, ratio: 1.0, makeup_db: 0.0 }
}

/// The same step table `verify::static_gate` measures: (input peak dB,
/// step start in seconds); content is 0.5 s per step
/// (harness/gen_signals.py).
const STEPS: [(f64, f64); 7] = [
    (-30.0, 0.25),
    (-24.0, 0.75),
    (-18.0, 1.25),
    (-12.0, 1.75),
    (-6.0, 2.25),
    (-3.0, 2.75),
    (0.0, 3.25),
];

fn load_signal() -> live_engine::wav::WavAudio {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(SIGNAL);
    let bytes = std::fs::read(&path)
        .unwrap_or_else(|e| panic!("harness signal missing at {}: {e}", path.display()));
    let wav = read_wav_f32(&bytes).expect("steps-1k.wav must parse");
    assert_eq!(wav.sample_rate, SR, "gate runs at the signal's own rate");
    assert_eq!(wav.channels, 2, "steps-1k.wav is stereo");
    wav
}

/// The synthetic set: one stereo track ("STIM") carrying the harness
/// buffer through `device`, master at unity, no other staging.
fn render_set(device: Box<dyn live_engine::Device>) -> Vec<f32> {
    let mut g = Graph::new(SR, 120.0);
    let mut t = Track::new("STIM", 2);
    t.source = load_signal().samples;
    t.devices.push(device);
    g.tracks.push(t);
    g.render(SR)
}

/// Measured RMS per step over the same windows `verify::static_gate`
/// uses ([t0+0.1, t0+0.4] inside each 0.5 s step). The render is
/// interleaved stereo; the signal is identical on both channels, so the
/// interleaved RMS equals the per-channel RMS.
fn step_rms(render: &[f32]) -> Vec<f64> {
    STEPS
        .iter()
        .map(|(_, t0)| {
            let f0 = ((t0 + 0.1) * SR as f64) as usize;
            let f1 = ((t0 + 0.4) * SR as f64) as usize;
            rms_db(&render[f0 * 2..f1 * 2]) // ×2: interleaved stereo
        })
        .collect()
}

#[test]
fn m1_gate_engine_matches_the_static_predictions() {
    let params = gate_params();
    let render = render_set(Box::new(GlueDevice::new(params.clone())));

    println!("M1 gate — engine render vs live-dynamics static predictions");
    println!("  set: STIM (stereo, steps-1k.wav) → GlueCompressor(T=-12 R=30 MU=0) → master unity");
    let mut max_err = 0f64;
    for ((db, _), measured) in STEPS.iter().zip(step_rms(&render)) {
        let predicted = glue::static_output_rms_db(*db, &params);
        let err = measured - predicted;
        max_err = max_err.max(err.abs());
        println!(
            "  in_peak {db:>6} dB  engine {measured:>8.2} dB  predicted {predicted:>8.2} dB  err {err:+.3} dB"
        );
    }
    println!("  max error {max_err:.3} dB (tolerance {} dB)", verify::STATIC_TOLERANCE_DB);
    assert!(
        max_err <= verify::STATIC_TOLERANCE_DB,
        "M1 gate FAILED: {max_err:.3} dB > {} dB",
        verify::STATIC_TOLERANCE_DB
    );
}

#[test]
fn m1_gate_bypass_reference_confirms_unity_staging() {
    // The G6 role: with the device bypassed the same set must come out at
    // exactly the input level — the mixer itself adds nothing.
    let render = render_set(Box::new(BypassDevice));
    for ((db, _), measured) in STEPS.iter().zip(step_rms(&render)) {
        let expected = db - 3.01; // harness sine: peak − 3.01 = RMS
        assert!(
            (measured - expected).abs() < 0.1,
            "staging not unity at {db} dB: {measured} vs {expected}"
        );
    }
}

#[test]
fn m1_gate_render_is_deterministic() {
    let a = render_set(Box::new(GlueDevice::new(gate_params())));
    let b = render_set(Box::new(GlueDevice::new(gate_params())));
    assert_eq!(a.len(), b.len());
    assert!(a.iter().zip(b.iter()).all(|(x, y)| x.to_bits() == y.to_bits()));
}
