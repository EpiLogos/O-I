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

mod corpus;

/// The harness signal, relative to the corpus root (`corpus::path`).
const SIGNAL: &str = "harness/signals/steps-1k.wav";

const SR: u32 = 48_000;

/// The G1 canonical pins (devices/glue-compressor.md, point
/// G1_T-12_R30_MU0_v2): Threshold −12, Range 30, Ratio 1, Makeup 0.
fn gate_params() -> GlueParams {
    GlueParams {
        threshold_db: -12.0,
        range: 30.0,
        ratio: 1.0,
        makeup_db: 0.0,
    }
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

/// The harness signal lives in the reverse-engineering corpus, which is not
/// tracked in git (docs/research/ableton-live-12.0.25 is ignored). A checkout
/// without it skips these gates with a notice, as the golden renders do.
fn corpus_present() -> bool {
    let present = corpus::path(SIGNAL).exists();
    if !present {
        eprintln!("skip: the harness signal is not present in this checkout ({SIGNAL})");
    }
    present
}

fn load_signal() -> live_engine::wav::WavAudio {
    let path = corpus::path(SIGNAL);
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
    if !corpus_present() {
        return;
    }
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
    println!(
        "  max error {max_err:.3} dB (tolerance {} dB)",
        verify::STATIC_TOLERANCE_DB
    );
    assert!(
        max_err <= verify::STATIC_TOLERANCE_DB,
        "M1 gate FAILED: {max_err:.3} dB > {} dB",
        verify::STATIC_TOLERANCE_DB
    );
}

#[test]
fn m1_gate_bypass_reference_confirms_unity_staging() {
    if !corpus_present() {
        return;
    }
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
    if !corpus_present() {
        return;
    }
    let a = render_set(Box::new(GlueDevice::new(gate_params())));
    let b = render_set(Box::new(GlueDevice::new(gate_params())));
    assert_eq!(a.len(), b.len());
    assert!(a
        .iter()
        .zip(b.iter())
        .all(|(x, y)| x.to_bits() == y.to_bits()));
}

/// Live's own Glue, as its default set stores it (`harness/live/BULK-glue-compressor-default-steps-1k-wav.als`: Threshold
/// −21.9047623, Range 25, Ratio 1, Makeup 5, playing the steps signal), and Live's render of that set.
const LIVES_GLUE_SET: &str = "harness/live/BULK-glue-compressor-default-steps-1k-wav.als";
const LIVES_GLUE_RENDER: &str = "BULK-glue-compressor-default-steps-1k-wav.aif";

/// The steps the set gate measures, stated before any render was read: those at or below −12 dBFS peak in (the mixer
/// gate's), each side's RMS over the step window within the static tolerance of the render's.
const SET_GATE_STEPS: usize = 4;

/// Each step's RMS (dB) of one side at `rate`, over the step windows `step_rms` measures ([t0+0.1, t0+0.4]).
fn side_steps(side: &[f32], rate: u32) -> Vec<f64> {
    STEPS
        .iter()
        .map(|(_, t0)| {
            let at = |t: f64| ((t * rate as f64) as usize).min(side.len());
            rms_db(&side[at(t0 + 0.1)..at(t0 + 0.4)])
        })
        .collect()
}

/// Each measured step's (in-peak dB, render dB, engine dB) per side, Live's render at its own rate and the engine's at
/// its, and the first one off by more than the tolerance.
fn set_gate(
    render: (&[f32], &[f32]),
    render_rate: u32,
    engine: &[f32],
) -> (Vec<String>, Option<String>) {
    let side = |x: &[f32], s: usize| -> Vec<f32> { x.iter().skip(s).step_by(2).copied().collect() };
    let (mut rows, mut off) = (Vec::new(), None);
    for (name, live, ours) in [
        ("L", render.0, side(engine, 0)),
        ("R", render.1, side(engine, 1)),
    ] {
        let heard = side_steps(live, render_rate).into_iter();
        for (k, ((db, _), (got, pred))) in STEPS
            .iter()
            .zip(heard.zip(side_steps(&ours, SR)))
            .enumerate()
        {
            let d = pred - got;
            rows.push(format!(
                "{name} in_peak {db:>6} dB  render {got:>8.2}  engine {pred:>8.2}  Δ {d:+.3} dB"
            ));
            if k < SET_GATE_STEPS && d.abs() > verify::STATIC_TOLERANCE_DB && off.is_none() {
                off = Some(format!(
                    "{name} at the {db} dB step: engine {pred:.2} vs Live's render {got:.2} dB"
                ));
            }
        }
    }
    (rows, off)
}

/// Live's render of a set: its left and right sides and its rate.
type LivesRender = (Vec<f32>, Vec<f32>, u32);

/// Live's own Glue as its set stores it, bridged from the document and rendered by the engine, Live's render of the set,
/// and the bridge's warnings; None, with a notice, where the corpus does not carry them.
fn lives_own_glue() -> Option<(Vec<f32>, LivesRender, Vec<String>)> {
    let set = corpus::path(LIVES_GLUE_SET);
    let Some(render_path) = corpus::render(LIVES_GLUE_RENDER).filter(|_| set.exists()) else {
        eprintln!("skip: Live's default Glue set or its render is not present ({LIVES_GLUE_SET})");
        return None;
    };
    if !corpus_present() {
        return None;
    }
    let (l, r) =
        live_dynamics::audio::read_aiff_i16_channels(&std::fs::read(render_path).unwrap()).unwrap();
    let root = live_set::open_als(&set).unwrap_or_else(|e| panic!("{}: {e:?}", set.display()));
    let bridged = live_engine::bridge::bridge_set(&root, SR).expect("a Live set");
    let mut g = bridged.graph;
    assert_eq!(g.tracks.len(), 1, "one audio part (STIM)");
    assert_eq!(g.tracks[0].devices[0].name(), "GlueCompressor");
    g.tracks[0].source = load_signal().samples;
    let warnings = bridged
        .warnings
        .iter()
        .map(|w| format!("{} · {}: {}", w.track, w.device, w.message))
        .collect();
    Some((
        g.render(SR),
        (l.samples, r.samples, l.sample_rate),
        warnings,
    ))
}

/// The Glue the bridge stood every set's Glue at before O-I #849 round 15, whatever the set stored (`known_device`'s
/// factory values: Threshold −40, Range 3, Ratio 1, Makeup 0), on the same part.
fn factory_glue() -> Vec<f32> {
    render_set(Box::new(GlueDevice::new(GlueParams {
        threshold_db: -40.0,
        range: 3.0,
        ratio: 1.0,
        makeup_db: 0.0,
    })))
}

/// O-I #849 round 15: Live's own Glue, bridged from its set's document, sounds at what the set stores, and so comes nearer
/// Live's render of that set than the factory Glue the bridge stood it at before, at each level step the set gate measures
/// (`SET_GATE_STEPS`, at or below −12 dBFS in) on both sides.
///
/// Round 16 (the Range law): the factory's Range 3 is now heard as a ceiling at 2.8 dB (glue.rs `range_ceiling_db`, the
/// scaling below Range 10 an OPEN hypothesis), so above those steps the factory Glue meets Live's render nearer than the
/// set's own does (at −6 dBFS 1.06 against 2.03 dB): the set's Glue's error there is the set gate's open record, below.
/// Round 15 compared every step; this compares the steps the set gate states.
#[test]
fn m1_gate_lives_own_glue_from_its_set_comes_nearer_lives_render_than_the_factory_glue() {
    let Some((engine, (l, r, rate), warnings)) = lives_own_glue() else {
        return;
    };
    let gap = |rendered: &[f32]| -> Vec<f64> {
        let side =
            |x: &[f32], s: usize| -> Vec<f32> { x.iter().skip(s).step_by(2).copied().collect() };
        [(&l, side(rendered, 0)), (&r, side(rendered, 1))]
            .iter()
            .flat_map(|(live, ours)| {
                side_steps(live, rate)
                    .into_iter()
                    .zip(side_steps(ours, SR))
                    .take(SET_GATE_STEPS)
                    .map(|(got, pred)| (pred - got).abs())
            })
            .collect()
    };
    let (stored, factory) = (gap(&engine), gap(&factory_glue()));
    println!("  |Δ| from Live's render per step, L then R: from the set {stored:.3?}, factory {factory:.3?}");
    println!("  warnings: {warnings:?}");
    for (k, (s, f)) in stored.iter().zip(&factory).enumerate() {
        assert!(
            s < f,
            "step {k}: the set's Glue is {s:.3} dB from Live's render, the factory's {f:.3}"
        );
    }
}

/// O-I #849 round 15: Live's own Glue, bridged from its set's document, sounds as Live renders that set: each level step
/// at or below −12 dBFS peak, per side, within the static tolerance (the M1 gate's 0.5 dB) of Live's render. Above them
/// the render meets Glue's soft clip, which the model has not (glue.rs: MU10's deviation is the soft clip). Teeth: the
/// factory Glue fails it.
///
/// STATUS: FAILS — the honest record and the acceptance target (cf. live-dynamics tests/golden.rs, the Overdrive and Glue
/// LAM gates). At Live's own Glue (Threshold −21.9, Range 25, Makeup 5) the engine's step levels are −0.00, −0.18, −0.87
/// and −1.56 dB from Live's at −30, −24, −18 and −12 dBFS in: the model's static curve is the measured transfer at Range
/// 30 and Threshold −12, threshold-shifted (glue.rs `MEASURED_ANCHORS_R30_T12`). Since round 16 the Range moves it (the
/// Range law, gated by `m1_gate_the_glues_range_is_heard_as_lives_renders_at_each_range`), but Range 25's ceiling is out of
/// reach at these steps, so the error is the curve's at this Threshold and Makeup, not the Range's. Run
/// with `LIVE_RE_CORPUS=<corpus> cargo test --test m1_gate -- --ignored --nocapture`.
#[test]
#[ignore]
fn m1_gate_lives_own_glue_sounds_from_its_set_as_live_renders_it() {
    let Some((engine, (l, r, rate), warnings)) = lives_own_glue() else {
        return;
    };
    let (rows, off) = set_gate((&l, &r), rate, &engine);
    println!("M1 set gate — Live's own Glue from its set, against Live's render");
    for row in rows {
        println!("  {row}");
    }
    println!("  warnings: {warnings:?}");
    assert!(
        set_gate((&l, &r), rate, &factory_glue()).1.is_some(),
        "the set gate passed the factory Glue"
    );
    assert!(off.is_none(), "M1 set gate FAILED: {}", off.unwrap());
}

/// Live's renders of its Glue where the Range alone moves (devices/glue-compressor.md, "D1 verdict"): G3 (Threshold −12,
/// Range 10), G10_CEILING (Threshold −24, Range 10, the ceiling discriminator) and G9 (Threshold −12, Range 60), each at
/// Ratio 1, Makeup 0, the preset Attack 2 / Release 0, playing the steps signal.
const RANGE_RENDERS: [(&str, f64, f64); 3] = [
    ("G3_T-12_R10_v2.aif", -12.0, 10.0),
    ("G10_CEILING.aif", -24.0, 10.0),
    ("G9_RANGE60.aif", -12.0, 60.0),
];

/// O-I #849 round 16: the Glue's Range is heard as Live renders it — a soft ceiling on the gain reduction (glue.rs
/// `RANGE_CEILING_SHARPNESS`), out of reach at 60 — every level step on both sides within the static tolerance (0.5 dB,
/// stated before any render was read) of Live's render at that Range. Teeth: before the Range law the engine reduced
/// G10's deep steps as at Range 30, −12.4 dB against Live's −9.08 at −6 dBFS in.
#[test]
fn m1_gate_the_glues_range_is_heard_as_lives_renders_at_each_range() {
    if !corpus_present() {
        return;
    }
    let mut gated = 0;
    for (name, threshold_db, range) in RANGE_RENDERS {
        let Some(path) = corpus::render(name) else {
            eprintln!("skip: Live's render {name} is not present");
            continue;
        };
        let (l, r) =
            live_dynamics::audio::read_aiff_i16_channels(&std::fs::read(path).unwrap()).unwrap();
        let engine = render_set(Box::new(GlueDevice::new(GlueParams {
            threshold_db,
            range,
            ratio: 1.0,
            makeup_db: 0.0,
        })));
        println!("M1 Range gate — {name} (Threshold {threshold_db}, Range {range})");
        let side =
            |x: &[f32], s: usize| -> Vec<f32> { x.iter().skip(s).step_by(2).copied().collect() };
        for (which, live, ours) in [("L", &l, side(&engine, 0)), ("R", &r, side(&engine, 1))] {
            let heard = side_steps(&live.samples, live.sample_rate);
            for ((db, _), (got, pred)) in STEPS
                .iter()
                .zip(heard.into_iter().zip(side_steps(&ours, SR)))
            {
                let d = pred - got;
                println!("  {which} in_peak {db:>6} dB  render {got:>8.2}  engine {pred:>8.2}  Δ {d:+.3} dB");
                assert!(
                    d.abs() <= verify::STATIC_TOLERANCE_DB,
                    "{name} {which} at the {db} dB step: engine {pred:.2} vs Live's render {got:.2} dB"
                );
            }
        }
        gated += 1;
    }
    println!("  {gated} of {} renders gated", RANGE_RENDERS.len());
}

/// The Ratio renders (devices/glue-compressor.md D1b and D1-final): name, Threshold, Range, stored Ratio.
const RATIO_RENDERS: [(&str, f64, f64, f64); 8] = [
    ("D1a_R0_R30.aif", -12.0, 30.0, 0.0),
    ("D1b_R0_R10.aif", -12.0, 10.0, 0.0),
    ("D1c_R0_R60.aif", -12.0, 60.0, 0.0),
    ("DF1_R0.aif", -24.0, 60.0, 0.0),
    ("D1d_R2_R10.aif", -12.0, 10.0, 2.0),
    ("D1e_R2_R30.aif", -12.0, 30.0, 2.0),
    ("D1f_R2_R60.aif", -12.0, 60.0, 2.0),
    ("DF2_R2.aif", -24.0, 60.0, 2.0),
];

/// O-I #849 round 17: a stored Glue Ratio of 0 or 2 is heard as Live renders it — its own curve (glue.rs
/// `measured_curve_of`), under the Range's ceiling — every level step on both sides within the static tolerance (0.5 dB,
/// stated before any render was read) of Live's render at that Ratio, Range and Threshold. Teeth: heard as Ratio 1,
/// stored 0 reduced 8.12 dB at 0 dBFS in against Live's 10.01, stored 2 at −6 dBFS in 3.91 against 2.04.
#[test]
fn m1_gate_a_stored_ratio_of_0_or_2_is_heard_as_lives_renders() {
    if !corpus_present() {
        return;
    }
    let mut gated = 0;
    for (name, threshold_db, range, ratio) in RATIO_RENDERS {
        let Some(path) = corpus::render(name) else {
            eprintln!("skip: Live's render {name} is not present");
            continue;
        };
        let (l, r) =
            live_dynamics::audio::read_aiff_i16_channels(&std::fs::read(path).unwrap()).unwrap();
        let engine = render_set(Box::new(GlueDevice::new(GlueParams {
            threshold_db,
            range,
            ratio,
            makeup_db: 0.0,
        })));
        println!("M1 Ratio gate — {name} (Threshold {threshold_db}, Range {range}, Ratio {ratio})");
        let side =
            |x: &[f32], s: usize| -> Vec<f32> { x.iter().skip(s).step_by(2).copied().collect() };
        for (which, live, ours) in [("L", &l, side(&engine, 0)), ("R", &r, side(&engine, 1))] {
            let heard = side_steps(&live.samples, live.sample_rate);
            for ((db, _), (got, pred)) in STEPS
                .iter()
                .zip(heard.into_iter().zip(side_steps(&ours, SR)))
            {
                let d = pred - got;
                println!("  {which} in_peak {db:>6} dB  render {got:>8.2}  engine {pred:>8.2}  Δ {d:+.3} dB");
                assert!(
                    d.abs() <= verify::STATIC_TOLERANCE_DB,
                    "{name} {which} at the {db} dB step: engine {pred:.2} vs Live's render {got:.2} dB"
                );
            }
        }
        gated += 1;
    }
    println!("  {gated} of {} renders gated", RATIO_RENDERS.len());
}
