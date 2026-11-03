//! THE MIXER GATE (O-I #849: "sends and returns, and Live's pan law, each
//! gated against Live's renders like M1/M3").
//!
//! No render in the corpus measures Live's pan law or its sends: every
//! harness set is centre-panned with its sends cleared. The probe sets
//! that do are built by `build_mixer_probes.py` (the lane's return carries
//! it) from the harness's own steps set — one audio track playing
//! `harness/signals/steps-1k.wav` at unity, the device removed — with ONE
//! mixer value changed per probe: the track pan (PAN_*), a send to an empty
//! return at unity, −6 dB, post- and pre-fader, after a hard pan (SEND_*),
//! the return's pan (RET_PAN_R100), the Main track's pan (MAIN_PAN_R50).
//! Their renders are made in Live through the harness's guarded export.
//!
//! Thresholds, stated before any probe is rendered: per channel and per
//! level step at or below −12 dBFS peak (the sums stay clear of the 16-bit
//! ceiling), the engine's RMS over the step window ([t0+0.1, t0+0.4], the
//! M1 gate's) is within ±0.25 dB of the render's; a channel the render
//! leaves below −80 dBFS must be below −80 dBFS in the engine too. Teeth:
//! the engine output at −1 dB must fail each probe.
//!
//! A probe without its render is NOT measured: the gate names it and skips
//! it with a notice (the pan law stays the M1 placeholder in
//! `graph::pan_weights`, the send taps stay engine decisions, until it is).
//! Run: `LIVE_RE_CORPUS=<corpus> cargo test --test mixer_gate -- --ignored`;
//! `LIVE_MIXER_PROBES` names the directory of the probe sets when they are
//! not yet in the corpus's `harness/live`.

mod corpus;

use live_dynamics::audio::{self, rms_db};
use live_engine::bridge::bridge_set;
use live_engine::wav::read_wav_f32;
use std::path::PathBuf;

const PROBES: [&str; 12] = [
    "PAN_C",
    "PAN_L50",
    "PAN_L100",
    "PAN_R50",
    "PAN_R100",
    "SEND_A_UNITY",
    "SEND_A_M6",
    "SEND_POST_M6",
    "SEND_PRE_M6",
    "SEND_POST_PAN",
    "RET_PAN_R100",
    "MAIN_PAN_R50",
];

/// The steps signal's level steps at or below −12 dBFS peak: (peak dB,
/// step start s) — harness/gen_signals.py, as the M1 gate reads them.
const STEPS: [(f64, f64); 4] = [(-30.0, 0.25), (-24.0, 0.75), (-18.0, 1.25), (-12.0, 1.75)];

const ENGINE_SR: u32 = 48_000;

fn sets_dir() -> PathBuf {
    std::env::var_os("LIVE_MIXER_PROBES")
        .map(PathBuf::from)
        .unwrap_or_else(|| corpus::path("harness/live"))
}

/// Per-channel RMS (dB) of each step window of one channel at `sr`.
fn steps_db(channel: &[f32], sr: u32) -> Vec<f64> {
    STEPS
        .iter()
        .map(|(_, t0)| {
            let a = ((t0 + 0.1) * sr as f64) as usize;
            let b = (((t0 + 0.4) * sr as f64) as usize).min(channel.len());
            rms_db(&channel[a.min(b)..b])
        })
        .collect()
}

fn check(
    name: &str,
    render: (&[f32], &[f32]),
    render_sr: u32,
    engine: (&[f32], &[f32]),
) -> Result<(), String> {
    for (side, r, e) in [("L", render.0, engine.0), ("R", render.1, engine.1)] {
        for (((peak, _), got), pred) in STEPS
            .iter()
            .zip(steps_db(r, render_sr))
            .zip(steps_db(e, ENGINE_SR))
        {
            println!(
                "{name} {side} step {peak:>5} dB: render {got:8.2}  engine {pred:8.2}  Δ {:+.2} dB",
                pred - got
            );
            let ok = if got < -80.0 {
                pred < -80.0
            } else {
                (pred - got).abs() <= 0.25
            };
            if !ok {
                return Err(format!(
                    "{name} {side} at the {peak} dB step: engine {pred:.2} vs render {got:.2} dB"
                ));
            }
        }
    }
    Ok(())
}

#[test]
#[ignore]
fn mixer_gate_pan_law_and_sends_match_lives_renders() {
    let signal_path = corpus::path("harness/signals/steps-1k.wav");
    let signal = read_wav_f32(
        &std::fs::read(&signal_path).unwrap_or_else(|e| panic!("{}: {e}", signal_path.display())),
    )
    .expect("steps-1k.wav parses");
    assert_eq!((signal.sample_rate, signal.channels), (ENGINE_SR, 2));
    let mut measured = Vec::new();
    let mut unmeasured = Vec::new();
    for name in PROBES {
        let set = sets_dir().join(format!("{name}.als"));
        let (Some(render_path), true) = (corpus::render(&format!("{name}.aif")), set.exists())
        else {
            unmeasured.push(name);
            continue;
        };
        let (l, r) = audio::read_aiff_i16_channels(&std::fs::read(render_path).unwrap()).unwrap();
        let root = live_set::open_als(&set).unwrap_or_else(|e| panic!("{}: {e:?}", set.display()));
        let bridged = bridge_set(&root, ENGINE_SR).expect("a Live set");
        assert!(
            bridged.warnings.is_empty(),
            "{name}: {:?}",
            bridged.warnings
        );
        let mut g = bridged.graph;
        assert_eq!(g.tracks.len(), 1, "{name}: one audio part (STIM)");
        g.tracks[0].source = signal.samples.clone();
        let out = g.render(ENGINE_SR);
        let (el, er): (Vec<f32>, Vec<f32>) =
            out.as_chunks::<2>().0.iter().map(|f| (f[0], f[1])).unzip();
        check(name, (&l.samples, &r.samples), l.sample_rate, (&el, &er))
            .unwrap_or_else(|e| panic!("{e}"));
        let quieter = |c: &[f32]| {
            c.iter()
                .map(|v| v * 10f32.powf(-1.0 / 20.0))
                .collect::<Vec<_>>()
        };
        assert!(
            check(
                "−1 dB",
                (&l.samples, &r.samples),
                l.sample_rate,
                (&quieter(&el), &quieter(&er))
            )
            .is_err(),
            "{name}: the gate passed an engine 1 dB low"
        );
        measured.push(name);
    }
    if !unmeasured.is_empty() {
        eprintln!(
            "skip: {} of {} mixer probes have no Live render (or set) yet, so Live's pan law and send taps are NOT measured for them: {unmeasured:?}",
            unmeasured.len(),
            PROBES.len()
        );
    }
    println!("mixer gate: measured {measured:?}");
}

/// One probe set's stated mixer: (name, track pan, track volume, send A,
/// pre-fader, return pan, Main pan).
type ProbeSpec = (&'static str, f64, f64, Option<f64>, bool, f64, f64);

/// Each probe set states its one mixer value as the builder meant it, read
/// back through the engine's own bridge.
#[test]
#[ignore]
fn mixer_probe_sets_state_their_one_value() {
    const M6: f64 = 0.5011872336;
    let spec: [ProbeSpec; 12] = [
        ("PAN_C", 0.0, 1.0, None, false, 0.0, 0.0),
        ("PAN_L50", -0.5, 1.0, None, false, 0.0, 0.0),
        ("PAN_L100", -1.0, 1.0, None, false, 0.0, 0.0),
        ("PAN_R50", 0.5, 1.0, None, false, 0.0, 0.0),
        ("PAN_R100", 1.0, 1.0, None, false, 0.0, 0.0),
        ("SEND_A_UNITY", 0.0, 1.0, Some(1.0), false, 0.0, 0.0),
        ("SEND_A_M6", 0.0, 1.0, Some(M6), false, 0.0, 0.0),
        ("SEND_POST_M6", 0.0, M6, Some(1.0), false, 0.0, 0.0),
        ("SEND_PRE_M6", 0.0, M6, Some(1.0), true, 0.0, 0.0),
        ("SEND_POST_PAN", -1.0, 1.0, Some(1.0), false, 0.0, 0.0),
        ("RET_PAN_R100", 0.0, 1.0, Some(1.0), false, 1.0, 0.0),
        ("MAIN_PAN_R50", 0.0, 1.0, None, false, 0.0, 0.5),
    ];
    let mut seen = 0;
    for (name, pan, vol, send, pre, ret_pan, main_pan) in spec {
        let set = sets_dir().join(format!("{name}.als"));
        if !set.exists() {
            continue;
        }
        let g = bridge_set(&live_set::open_als(&set).unwrap(), ENGINE_SR)
            .unwrap()
            .graph;
        let t = &g.tracks[0];
        assert_eq!(
            (t.name.as_str(), t.pan, t.gain, t.devices.len()),
            ("STIM", pan, vol, 0),
            "{name}"
        );
        assert_eq!(t.sends.first().copied(), send, "{name}");
        assert_eq!(g.returns.len(), send.is_some() as usize, "{name}");
        if let Some(ret) = g.returns.first() {
            assert_eq!(
                (ret.pre_fader, ret.pan, ret.gain, ret.devices.len()),
                (pre, ret_pan, 1.0, 0),
                "{name}"
            );
        }
        assert_eq!(
            (g.master.pan, g.master.gain, g.master.devices.len()),
            (main_pan, 1.0, 0),
            "{name}"
        );
        seen += 1;
    }
    println!("{seen} probe sets checked in {}", sets_dir().display());
}

/// The check's teeth without the corpus: a reference passes against
/// itself, and the same reference 1 dB low, or with a hard-panned channel
/// that should be silent sounding, fails.
#[test]
fn the_mixer_check_passes_its_reference_and_fails_a_degraded_copy() {
    let frames = (2.5 * ENGINE_SR as f64) as usize;
    let tone = |i: usize| {
        let t = i as f64 / ENGINE_SR as f64;
        let peak_db = STEPS
            .iter()
            .rev()
            .find(|(_, t0)| t >= *t0)
            .map(|(db, _)| *db)
            .unwrap_or(-144.0);
        (10f64.powf(peak_db / 20.0) * (2.0 * std::f64::consts::PI * 1000.0 * t).sin()) as f32
    };
    let left: Vec<f32> = (0..frames).map(tone).collect();
    let silent = vec![0f32; frames];
    assert!(check("ref", (&left, &silent), ENGINE_SR, (&left, &silent)).is_ok());
    let low: Vec<f32> = left.iter().map(|v| v * 10f32.powf(-1.0 / 20.0)).collect();
    assert!(check("−1 dB", (&left, &silent), ENGINE_SR, (&low, &silent)).is_err());
    assert!(check("leak", (&left, &silent), ENGINE_SR, (&left, &low)).is_err());
}
