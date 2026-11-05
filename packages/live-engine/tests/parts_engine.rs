//! The parts in one engine (O-I #849; manual §21.1, "The mixer row",
//! "The Main track" and the Rules): MIDI parts playing notes through an
//! instrument, each part with its own chain, volume, pan, activator, solo
//! and sends; return tracks taking what the parts send them; the Main
//! track; live events applied at a block; and Export Audio rendering the
//! samples the engine played. No corpus, no audio device: offline renders
//! and the audio thread's own pull.

use live_dynamics::audio::rms_db;
use live_dynamics::glue::{self, GlueParams};
use live_dynamics::operator::OperatorVoiceA;
use live_engine::bridge::bridge_set;
use live_engine::devices::{EchoDevice, EchoParams, GainDevice, GlueDevice};
use live_engine::graph::pan_weights;
use live_engine::{
    engine, Clock, Device, EngineEvent, Graph, GraphError, Note, OperatorInstrument, Part,
    Performance, Refusal, ReturnTrack, Track,
};

const SR: u32 = 48_000;

fn operator_part(name: &str, notes: &[Note]) -> Track {
    let mut t = Track::midi(name, Box::new(OperatorInstrument::default_patch(SR)));
    t.set_notes(notes);
    t
}

fn constant_part(name: &str, value: f32, frames: usize) -> Track {
    let mut t = Track::new(name, 1);
    t.source = vec![value; frames];
    t
}

/// The model's note placed at `at` in a buffer of `frames` samples.
fn model_note(key: u8, at: usize, hold: usize, frames: usize) -> Vec<f32> {
    let v = OperatorVoiceA::default_patch(key, SR);
    let mut out = vec![0f32; frames];
    let release_end = hold + (v.envelope.release_time_s * SR as f64).ceil() as usize + 1;
    for i in 0..release_end.min(frames - at) {
        out[at + i] = v.sample_at(i, hold as f64 / SR as f64);
    }
    out
}

fn left(render: &[f32]) -> Vec<f32> {
    render.chunks(2).map(|f| f[0]).collect()
}

#[test]
fn a_midi_part_plays_its_notes_at_their_frames() {
    let frames = 30_000;
    let mut g = Graph::new(SR, 120.0);
    g.tracks.push(operator_part(
        "Keys",
        &[Note {
            key: 69,
            start: 100,
            length: 2_000,
            velocity: 1.0,
        }],
    ));
    g.length_frames = Some(frames as u64);
    let out = g.render(SR);
    assert_eq!(out.len(), frames * 2);
    let want = model_note(69, 100, 2_000, frames);
    for (n, (got, w)) in left(&out).iter().zip(want.iter()).enumerate() {
        // value equality: exact, and blind only to the sign of a zero (the
        // mix sums from +0)
        assert!(
            got == w,
            "frame {n}: the part plays the model's note at its frame ({got} vs {w})"
        );
    }
    assert!(
        out[..200].iter().all(|v| *v == 0.0),
        "nothing sounds before the note"
    );
    assert!(out.iter().any(|v| *v != 0.0), "the note sounds");
}

#[test]
fn two_parts_play_at_once_each_with_its_own_chain_volume_and_pan() {
    let frames = 4_800;
    // each part alone, through its own chain, at unity and centre
    let alone = |track: Track| {
        let mut g = Graph::new(SR, 120.0);
        g.tracks.push(track);
        g.length_frames = Some(frames as u64);
        left(&g.render(SR))
    };
    let part_a = || {
        let mut t = operator_part(
            "A",
            &[Note {
                key: 57,
                start: 0,
                length: 3_000,
                velocity: 1.0,
            }],
        );
        t.devices.push(Box::new(GainDevice::new_db(6.0)));
        t
    };
    let part_b = || {
        let mut t = constant_part("B", 0.3, frames);
        t.devices.push(Box::new(GlueDevice::new(GlueParams {
            threshold_db: -20.0,
            range: 30.0,
            ratio: 1.0,
            makeup_db: 0.0,
        })));
        t
    };
    let (a, b) = (alone(part_a()), alone(part_b()));

    let mut g = Graph::new(SR, 120.0);
    let mut ta = part_a();
    ta.gain = 0.5;
    ta.pan = -0.5;
    let mut tb = part_b();
    tb.gain = 0.25;
    tb.pan = 0.75;
    g.tracks.push(ta);
    g.tracks.push(tb);
    g.length_frames = Some(frames as u64);
    let out = g.render(SR);
    let (al, ar) = pan_weights(-0.5);
    let (bl, br) = pan_weights(0.75);
    for n in 0..frames {
        let want_l = a[n] as f64 * 0.5 * al + b[n] as f64 * 0.25 * bl;
        let want_r = a[n] as f64 * 0.5 * ar + b[n] as f64 * 0.25 * br;
        assert!(
            (out[n * 2] as f64 - want_l).abs() < 1e-6,
            "L frame {n}: {} vs {want_l}",
            out[n * 2]
        );
        assert!(
            (out[n * 2 + 1] as f64 - want_r).abs() < 1e-6,
            "R frame {n}: {} vs {want_r}",
            out[n * 2 + 1]
        );
    }
    assert!(
        a.iter().any(|v| *v != 0.0) && b.iter().any(|v| *v != 0.0),
        "both parts sound"
    );
}

#[test]
fn a_send_feeds_its_return_and_the_return_reaches_the_main_track() {
    let mut g = Graph::new(SR, 120.0);
    let mut t = constant_part("A", 0.25, 8);
    t.gain = 0.5;
    t.sends = vec![0.5];
    g.tracks.push(t);
    let mut ret = ReturnTrack::new("A-Return");
    ret.devices.push(Box::new(GainDevice::new_linear(2.0)));
    ret.gain = 0.75;
    g.returns.push(ret);
    g.master.gain = 0.8;
    let out = g.render(SR);
    // direct 0.25·0.5 = 0.125; sent 0.125·0.5 = 0.0625, ×2 on the return's
    // chain, ×0.75 its volume = 0.09375; Main ×0.8
    let want = ((0.125 + 0.09375) * 0.8) as f32;
    assert_eq!(out.len(), 16);
    for (n, v) in out.iter().enumerate() {
        assert!((v - want).abs() < 1e-7, "sample {n}: {v} vs {want}");
    }
}

#[test]
fn the_return_chain_hears_only_what_is_sent() {
    // two parts send to A; A's chain doubles what reaches it; a part that
    // sends nothing reaches the return with nothing
    let mut g = Graph::new(SR, 120.0);
    let mut a = constant_part("A", 0.1, 4);
    a.sends = vec![1.0];
    let mut b = constant_part("B", 0.2, 4);
    b.sends = vec![0.5];
    let mut c = constant_part("C", 0.4, 4);
    c.sends = vec![0.0];
    g.tracks.extend([a, b, c]);
    let mut ret = ReturnTrack::new("A");
    ret.devices.push(Box::new(GainDevice::new_linear(2.0)));
    g.returns.push(ret);
    let out = g.render(SR);
    // direct 0.1 + 0.2 + 0.4; return (0.1·1 + 0.2·0.5 + 0)·2 = 0.4
    let want = 0.7f32 + 0.4;
    assert!((out[0] - want).abs() < 1e-6, "{} vs {want}", out[0]);
}

/// ENGINE DECISION under test (no dossier measures Live's send tap yet;
/// `tests/mixer_gate.rs` holds it to the SEND_* probe renders): a send
/// taps the part after its volume and its pan — the same stereo frame that
/// reaches the Main track.
#[test]
fn a_post_fader_send_follows_the_part_volume_and_pan() {
    let mut g = Graph::new(SR, 120.0);
    let mut t = constant_part("A", 0.5, 4);
    t.gain = 0.5;
    t.pan = -1.0;
    t.sends = vec![1.0];
    g.tracks.push(t);
    let mut ret = ReturnTrack::new("A");
    ret.gain = 1.0;
    g.returns.push(ret);
    // Main hears the part twice (direct + the return at unity), left only
    let out = g.render(SR);
    assert!((out[0] - 0.5).abs() < 1e-7, "L {}", out[0]);
    assert_eq!(
        out[1], 0.0,
        "hard left: nothing on the right, sent or direct"
    );
}

/// The set stores a pre/post flag per return (`SendsPre/SendPreBool`,
/// devices/racks-session-model.md §2.1). ENGINE DECISION under test: a
/// pre-fader send taps the part before its volume and its pan.
#[test]
fn a_pre_fader_send_taps_the_part_before_its_volume_and_pan() {
    let mut g = Graph::new(SR, 120.0);
    let mut t = constant_part("A", 0.5, 4);
    t.gain = 0.25;
    t.pan = -1.0;
    t.sends = vec![1.0];
    g.tracks.push(t);
    let mut ret = ReturnTrack::new("A");
    ret.pre_fader = true;
    g.returns.push(ret);
    let out = g.render(SR);
    // direct: 0.5·0.25 hard left; sent: the whole 0.5, centred
    assert!(
        (out[0] - (0.125 + 0.5)).abs() < 1e-7 && (out[1] - 0.5).abs() < 1e-7,
        "{:?}",
        &out[..2]
    );
}

/// `LiveSet/SoloInPlace` off: a solo hears only the soloed parts, and the
/// return tracks fall silent with the rest (ENGINE DECISION; on — the
/// default the template stores — the returns still sound).
#[test]
fn solo_without_solo_in_place_silences_the_returns_too() {
    let mut g = Graph::new(SR, 120.0);
    let mut a = constant_part("A", 0.25, 4);
    a.solo = true;
    a.sends = vec![1.0];
    g.tracks.push(a);
    g.returns.push(ReturnTrack::new("A"));
    g.solo_in_place = false;
    assert_eq!(g.render(SR)[0], 0.25, "only A's own sound");
}

#[test]
fn the_activator_silences_a_part_and_what_it_sends() {
    let mut g = Graph::new(SR, 120.0);
    let mut a = constant_part("A", 0.25, 4);
    a.sends = vec![1.0];
    a.active = false;
    let b = constant_part("B", 0.125, 4);
    let mut b = b;
    b.sends = vec![0.0];
    g.tracks.extend([a, b]);
    g.returns.push(ReturnTrack::new("A"));
    let out = g.render(SR);
    assert_eq!(
        out[0], 0.125,
        "only B sounds: A is off, and so is what it sends"
    );
}

#[test]
fn solo_hears_only_the_soloed_parts_and_the_returns_still_sound() {
    let mut g = Graph::new(SR, 120.0);
    let mut a = constant_part("A", 0.25, 4);
    a.solo = true;
    a.sends = vec![1.0];
    let mut b = constant_part("B", 0.125, 4);
    b.sends = vec![1.0];
    g.tracks.extend([a, b]);
    g.returns.push(ReturnTrack::new("A"));
    let out = g.render(SR);
    // A direct 0.25 + A through the return 0.25; B silent (and its send)
    assert!((out[0] - 0.5).abs() < 1e-7, "{}", out[0]);
}

#[test]
fn the_main_track_pan_places_the_whole_piece() {
    let mut g = Graph::new(SR, 120.0);
    g.tracks.push(constant_part("A", 0.5, 4));
    g.master.pan = 0.5;
    let out = g.render(SR);
    let (l, r) = pan_weights(0.5);
    assert!(
        (out[0] as f64 - 0.5 * l).abs() < 1e-7 && (out[1] as f64 - 0.5 * r).abs() < 1e-7,
        "{:?}",
        &out[..2]
    );
}

#[test]
fn a_part_with_more_sends_than_the_set_has_returns_is_refused() {
    // Live's loader: "(Track has more send knobs than set has return tracks.)"
    let mut g = Graph::new(SR, 120.0);
    let mut t = constant_part("A", 0.25, 4);
    t.sends = vec![0.5, 0.5];
    g.tracks.push(t);
    g.returns.push(ReturnTrack::new("A"));
    assert_eq!(
        g.validate(),
        Err(GraphError::SendCount {
            track: "A".into(),
            sends: 2,
            returns: 1
        })
    );
    assert!(engine(g).is_err(), "the engine refuses the graph whole");
    // fewer sends than returns loads (the harness sets clear them): an
    // absent send carries nothing
    let mut g = Graph::new(SR, 120.0);
    g.tracks.push(constant_part("A", 0.25, 4));
    g.returns.push(ReturnTrack::new("A"));
    assert_eq!(g.validate(), Ok(()));
    assert_eq!(g.render(SR)[0], 0.25);
}

#[test]
fn a_gated_live_dynamics_device_on_a_chain_changes_what_you_hear() {
    // (1) Echo (live_dynamics::echo's bare-line laws) after Operator on a
    // MIDI part: the chain's output IS the device applied to the dry part,
    // sample for sample, and differs from the dry part audibly.
    let frames = 24_000;
    let note = [Note {
        key: 69,
        start: 0,
        length: 2_400,
        velocity: 1.0,
    }];
    let echo = || {
        EchoDevice::new(EchoParams {
            delay_time_s: 0.1,
            feedback: 0.5,
            dry_wet: 0.5,
        })
    };
    let render = |with_echo: bool| {
        let mut g = Graph::new(SR, 120.0);
        let mut t = operator_part("Keys", &note);
        if with_echo {
            t.devices.push(Box::new(echo()));
        }
        g.tracks.push(t);
        g.length_frames = Some(frames as u64);
        g.render(SR)
    };
    let (dry, wet) = (render(false), render(true));
    let mut device = echo();
    device.prepare(SR, 2);
    let mut clock = Clock::start(SR, 120.0);
    for n in 0..frames {
        clock.sample = n as u64;
        let mut f = [dry[n * 2], dry[n * 2 + 1]];
        device.process(&mut f, &clock);
        assert!(
            f[0] == wet[n * 2] && f[1] == wet[n * 2 + 1],
            "frame {n}: {f:?} vs {:?}",
            &wet[n * 2..n * 2 + 2]
        );
    }
    // after the note's release, the dry part is silent and the echo rings
    let tail = (2_400 + 19_300) * 2..frames * 2;
    assert!(
        rms_db(&dry[tail.clone()]) < -140.0 && rms_db(&wet[tail]) > -80.0,
        "the echo is heard past the note"
    );

    // (2) Glue (live_dynamics::glue's gated static curve) on an audio
    // part: a 1 kHz sine at 0 dBFS peak comes out at the curve's
    // prediction, not at its input level.
    let p = GlueParams {
        threshold_db: -12.0,
        range: 30.0,
        ratio: 1.0,
        makeup_db: 0.0,
    };
    let sine = |with_glue: bool| {
        let mut g = Graph::new(SR, 120.0);
        let mut t = Track::new("Tone", 1);
        t.source = (0..SR as usize)
            .map(|i| (2.0 * std::f32::consts::PI * 1000.0 * i as f32 / SR as f32).sin())
            .collect();
        if with_glue {
            t.devices.push(Box::new(GlueDevice::new(p.clone())));
        }
        g.tracks.push(t);
        g.render(SR)
    };
    let window = (SR as usize / 2) * 2..(SR as usize * 9 / 10) * 2;
    let (dry, glued) = (
        rms_db(&sine(false)[window.clone()]),
        rms_db(&sine(true)[window]),
    );
    let predicted = glue::static_output_rms_db(0.0, &p);
    assert!(
        (glued - predicted).abs() <= 0.5,
        "glued {glued:.2} vs the gated curve {predicted:.2}"
    );
    assert!(
        dry - glued > 3.0,
        "the device changes what you hear: dry {dry:.2}, glued {glued:.2}"
    );
}

/// The engine of two MIDI parts, an audio part, a return with Echo and a
/// Main track: the set the realtime tests play.
fn two_part_set() -> Graph {
    let mut g = Graph::new(SR, 120.0);
    let mut a = operator_part(
        "Keys",
        &[Note {
            key: 60,
            start: 300,
            length: 4_000,
            velocity: 1.0,
        }],
    );
    a.sends = vec![0.3];
    a.pan = -0.25;
    let mut b = operator_part("Bass", &[]);
    b.sends = vec![0.0];
    b.devices.push(Box::new(GlueDevice::new(GlueParams {
        threshold_db: -30.0,
        range: 30.0,
        ratio: 1.0,
        makeup_db: 0.0,
    })));
    let mut c = Track::new("Tone", 1);
    c.source = (0..9_000).map(|i| (i as f32 * 0.05).sin() * 0.2).collect();
    c.sends = vec![0.5];
    c.gain = 0.7;
    g.tracks.extend([a, b, c]);
    let mut ret = ReturnTrack::new("A-Echo");
    ret.devices.push(Box::new(EchoDevice::new(EchoParams {
        delay_time_s: 0.01,
        feedback: 0.4,
        dry_wet: 1.0,
    })));
    g.returns.push(ret);
    g.master.gain = 0.9;
    g
}

#[test]
fn a_key_sounds_at_the_first_frame_of_the_block_that_takes_it() {
    let mut g = Graph::new(SR, 120.0);
    g.tracks.push(operator_part("Keys", &[]));
    let (mut core, mut handle) = engine(g).unwrap();
    let mut block = vec![0f32; 256 * 2];
    core.pull_block(&mut block);
    assert!(block.iter().all(|v| *v == 0.0), "nothing before the key");
    handle
        .send(EngineEvent::NoteOn {
            track: 0,
            key: 69,
            velocity: 1.0,
        })
        .unwrap();
    core.pull_block(&mut block);
    // the note's sample k is frame k of this block: zero frames late
    let model = OperatorVoiceA::default_patch(69, SR);
    for k in 0..256 {
        let want = model.sample_at(k, f64::INFINITY);
        assert!(
            block[k * 2] == want,
            "frame {k} of the block: {} vs {want}",
            block[k * 2]
        );
    }
    handle.collect();
    let perf = handle.performance();
    assert_eq!(
        perf.events[0].frame, 256,
        "applied at the block's first frame"
    );
    let latency = handle.latency();
    assert_eq!(latency.block_frames, 256);
    assert_eq!(
        latency.waits.iter().sum::<u64>(),
        1,
        "one key waited for one block"
    );
}

#[test]
fn export_renders_the_samples_the_engine_played() {
    let (mut core, mut handle) = engine(two_part_set()).unwrap();
    // the device picks the block size; events arrive between callbacks
    let blocks: [usize; 14] = [
        128, 61, 1, 256, 512, 7, 333, 128, 128, 64, 1024, 3, 900, 256,
    ];
    let mut played = Vec::new();
    for (i, n) in blocks.iter().enumerate() {
        let send = |handle: &mut live_engine::EngineHandle, e| handle.send(e).unwrap();
        match i {
            1 => send(
                &mut handle,
                EngineEvent::NoteOn {
                    track: 1,
                    key: 36,
                    velocity: 0.8,
                },
            ),
            2 => send(
                &mut handle,
                EngineEvent::Volume {
                    part: Part::Track(0),
                    gain: 0.6,
                },
            ),
            3 => {
                send(
                    &mut handle,
                    EngineEvent::Pan {
                        part: Part::Track(2),
                        pan: 0.4,
                    },
                );
                send(
                    &mut handle,
                    EngineEvent::Send {
                        part: Part::Track(1),
                        send: 0,
                        gain: 0.7,
                    },
                );
            }
            5 => send(
                &mut handle,
                EngineEvent::NoteOn {
                    track: 1,
                    key: 43,
                    velocity: 1.0,
                },
            ),
            6 => send(
                &mut handle,
                EngineEvent::Active {
                    part: Part::Track(2),
                    on: false,
                },
            ),
            7 => send(&mut handle, EngineEvent::NoteOff { track: 1, key: 36 }),
            8 => send(
                &mut handle,
                EngineEvent::Solo {
                    part: Part::Track(1),
                    on: true,
                },
            ),
            9 => send(
                &mut handle,
                EngineEvent::Volume {
                    part: Part::Return(0),
                    gain: 0.5,
                },
            ),
            10 => send(
                &mut handle,
                EngineEvent::Pan {
                    part: Part::Main,
                    pan: -0.2,
                },
            ),
            11 => send(
                &mut handle,
                EngineEvent::Solo {
                    part: Part::Track(1),
                    on: false,
                },
            ),
            12 => send(&mut handle, EngineEvent::Panic),
            _ => {}
        }
        let mut out = vec![0f32; n * 2];
        core.pull_block(&mut out);
        played.extend_from_slice(&out);
        if i % 4 == 0 {
            handle.collect(); // the control side collects when it likes
        }
    }
    let perf = handle.performance();
    assert!(perf.complete);
    assert_eq!(perf.frames as usize * 2, played.len());
    assert_eq!(perf.events.len(), 12);
    let exported = two_part_set().render_performance(SR, &perf);
    assert_eq!(exported.len(), played.len());
    for (n, (e, p)) in exported.iter().zip(played.iter()).enumerate() {
        assert_eq!(
            e.to_bits(),
            p.to_bits(),
            "sample {n}: Export Audio renders what the engine played"
        );
    }
    let untouched = two_part_set().render_performance(SR, &Performance::silent(perf.frames));
    assert!(
        untouched != played,
        "the performance was heard: it is not the untouched set"
    );
    // what a face reads is what the engine applied
    let m = handle.mixer();
    assert_eq!(
        (m.tracks[0].gain, m.tracks[2].pan, m.tracks[1].sends[0]),
        (0.6, 0.4, 0.7)
    );
    assert!(!m.tracks[2].active && !m.tracks[1].solo);
    assert_eq!((m.returns[0].gain, m.main.pan), (0.5, -0.2));
}

#[test]
fn the_engine_refuses_what_the_set_does_not_have_in_words() {
    let (_core, mut handle) = engine(two_part_set()).unwrap();
    let invalid = |r: Result<(), Refusal>| match r {
        Err(Refusal::Invalid(why)) => why,
        other => panic!("refusal expected, got {other:?}"),
    };
    assert!(invalid(handle.send(EngineEvent::NoteOn {
        track: 2,
        key: 60,
        velocity: 1.0
    }))
    .contains("audio part"));
    assert!(invalid(handle.send(EngineEvent::NoteOn {
        track: 9,
        key: 60,
        velocity: 1.0
    }))
    .contains("no part 9"));
    assert!(invalid(handle.send(EngineEvent::Send {
        part: Part::Track(0),
        send: 3,
        gain: 0.5
    }))
    .contains("no send 3"));
    assert!(invalid(handle.send(EngineEvent::Pan {
        part: Part::Track(0),
        pan: 2.0
    }))
    .contains("pan"));
    assert!(invalid(handle.send(EngineEvent::Volume {
        part: Part::Return(4),
        gain: 0.5
    }))
    .contains("no return 4"));
    assert!(invalid(handle.send(EngineEvent::Volume {
        part: Part::Main,
        gain: f64::NAN
    }))
    .contains("level"));
    assert!(invalid(handle.send(EngineEvent::Active {
        part: Part::Main,
        on: false
    }))
    .contains("Main"));
}

#[test]
fn the_mixer_reading_moves_only_when_the_engine_applied_the_change() {
    let (mut core, mut handle) = engine(two_part_set()).unwrap();
    handle
        .send(EngineEvent::Volume {
            part: Part::Track(0),
            gain: 0.25,
        })
        .unwrap();
    handle.collect();
    assert_eq!(handle.mixer().tracks[0].gain, 1.0, "asked is not applied");
    core.pull_block(&mut [0f32; 64]);
    assert_eq!(
        handle.mixer().tracks[0].gain,
        1.0,
        "applied but not yet collected"
    );
    handle.collect();
    assert_eq!(handle.mixer().tracks[0].gain, 0.25);
}

const SET: &str = r#"<Ableton MajorVersion="5"><LiveSet>
  <Tracks>
    <MidiTrack Id="1"><Name><EffectiveName Value="Keys" /></Name>
      <DeviceChain>
        <Mixer>
          <Sends><TrackSendHolder Id="0"><Send><Manual Value="0.5" /></Send></TrackSendHolder></Sends>
          <Speaker><Manual Value="true" /></Speaker>
          <Pan><Manual Value="-0.5" /></Pan>
          <Volume><Manual Value="0.70794576" /></Volume>
          <SoloSink Value="false" />
        </Mixer>
        <MainSequencer><ClipTimeable><ArrangerAutomation><Events>
          <MidiClip Id="2" Time="1"><CurrentStart Value="1" /><CurrentEnd Value="5" />
            <Loop><LoopStart Value="0" /><LoopEnd Value="4" /><StartRelative Value="0" /><LoopOn Value="false" /></Loop>
            <Notes><KeyTracks><KeyTrack Id="3"><MidiKey Value="57" /><Notes>
              <MidiNoteEvent Time="0" Duration="1" Velocity="100" IsEnabled="true" />
              <MidiNoteEvent Time="2" Duration="0.5" Velocity="90" IsEnabled="true" />
              <MidiNoteEvent Time="3" Duration="1" Velocity="90" IsEnabled="false" />
            </Notes></KeyTrack></KeyTracks></Notes>
          </MidiClip>
        </Events></ArrangerAutomation></ClipTimeable></MainSequencer>
        <DeviceChain><Devices><Operator Id="4" /><Echo Id="5" /></Devices></DeviceChain>
      </DeviceChain>
    </MidiTrack>
    <AudioTrack Id="6"><Name><EffectiveName Value="Drums" /></Name>
      <DeviceChain><Mixer><Speaker><Manual Value="false" /></Speaker><SoloSink Value="true" />
        <Sends><TrackSendHolder Id="0"><Send><Manual Value="0.0003162277571" /></Send></TrackSendHolder></Sends></Mixer></DeviceChain>
    </AudioTrack>
    <ReturnTrack Id="7"><Name><EffectiveName Value="A-Reverb" /></Name>
      <DeviceChain><Mixer><Volume><Manual Value="0.5" /></Volume></Mixer>
        <DeviceChain><Devices><Reverb Id="8" /></Devices></DeviceChain></DeviceChain>
    </ReturnTrack>
  </Tracks>
  <SendsPre><SendPreBool Id="0" Value="true" /></SendsPre>
  <SoloInPlace Value="false" />
  <MainTrack><DeviceChain><Mixer><Tempo><Manual Value="120" /></Tempo><Volume><Manual Value="0.8" /></Volume><Pan><Manual Value="0.1" /></Pan></Mixer>
    <DeviceChain><Devices><GlueCompressor Id="9" /></Devices></DeviceChain></DeviceChain></MainTrack>
</LiveSet></Ableton>"#;

#[test]
fn a_set_document_bridges_its_parts_mixer_returns_and_notes() {
    let root = live_set::xml::parse(SET).unwrap();
    let r = bridge_set(&root, SR).unwrap();
    assert!(r.warnings.is_empty(), "{:?}", r.warnings);
    let g = &r.graph;
    assert_eq!(g.tracks.len(), 2);
    let keys = &g.tracks[0];
    assert!(keys.is_midi());
    assert_eq!(keys.instrument.as_ref().unwrap().name(), "Operator");
    assert_eq!(
        keys.devices.iter().map(|d| d.name()).collect::<Vec<_>>(),
        ["Echo"]
    );
    assert_eq!(
        (keys.gain, keys.pan, keys.active, keys.solo),
        (0.70794576, -0.5, true, false)
    );
    assert_eq!(keys.sends, [0.5]);
    let drums = &g.tracks[1];
    assert!(!drums.is_midi() && !drums.active && drums.solo);
    assert_eq!(g.returns.len(), 1);
    assert_eq!(
        (g.returns[0].name.as_str(), g.returns[0].gain),
        ("A-Reverb", 0.5)
    );
    assert_eq!(g.returns[0].devices[0].name(), "Reverb");
    assert!(g.returns[0].pre_fader, "SendsPre/SendPreBool 0 is true");
    assert!(!g.solo_in_place, "SoloInPlace is false");
    assert_eq!((g.master.gain, g.master.pan), (0.8, 0.1));
    assert_eq!(g.master.devices[0].name(), "GlueCompressor");
    // the clip anchors at beat 1 (0.5 s at 120 BPM): its two enabled notes
    // sound at 0.5 s and 1.5 s; the disabled one never does
    let notes = live_engine::bridge::arrangement_notes(
        root.find("MidiTrack").unwrap(),
        &Clock::start(SR, 120.0),
    );
    assert_eq!(
        notes,
        [
            Note {
                key: 57,
                start: 24_000,
                length: 24_000,
                velocity: 100.0
            },
            Note {
                key: 57,
                start: 72_000,
                length: 12_000,
                velocity: 90.0
            },
        ]
    );
    assert_eq!(
        g.frames(),
        84_000,
        "the arrangement ends with its last note"
    );
}

/// Thread CPU time in nanoseconds (the timing law: CPU time, not the wall
/// clock). `CLOCK_THREAD_CPUTIME_ID` is 16 on macOS and 3 on Linux.
fn thread_cpu_ns() -> u64 {
    #[repr(C)]
    struct Timespec {
        sec: i64,
        nsec: i64,
    }
    extern "C" {
        fn clock_gettime(clock: i32, tp: *mut Timespec) -> i32;
    }
    #[cfg(target_os = "macos")]
    const THREAD_CPU: i32 = 16;
    #[cfg(not(target_os = "macos"))]
    const THREAD_CPU: i32 = 3;
    let mut ts = Timespec { sec: 0, nsec: 0 };
    // SAFETY: clock_gettime writes one timespec into the pointer it gets.
    let rc = unsafe { clock_gettime(THREAD_CPU, &mut ts) };
    assert_eq!(rc, 0, "clock_gettime");
    ts.sec as u64 * 1_000_000_000 + ts.nsec as u64
}

/// The realtime budget, measured headless in CPU time: two MIDI parts
/// holding a chord each (eight Operator voices), an audio part, a return
/// with Echo and a Main track with Glue, pulled in 128-frame blocks at
/// 48 kHz (2.67 ms each). The ceiling — a quarter of the block's deadline
/// in an unoptimised test build — was set against the first measured
/// baseline (printed), before any tuning.
#[test]
fn a_block_of_the_two_part_set_costs_under_a_quarter_of_its_deadline() {
    let mut g = two_part_set();
    g.master.devices.push(Box::new(GlueDevice::new(GlueParams {
        threshold_db: -12.0,
        range: 30.0,
        ratio: 1.0,
        makeup_db: 0.0,
    })));
    let (mut core, mut handle) = engine(g).unwrap();
    for (track, keys) in [(0usize, [60u8, 64, 67, 71]), (1, [36, 43, 48, 52])] {
        for key in keys {
            handle
                .send(EngineEvent::NoteOn {
                    track,
                    key,
                    velocity: 1.0,
                })
                .unwrap();
        }
    }
    let mut block = vec![0f32; 128 * 2];
    core.pull_block(&mut block); // warm
    let blocks = 200u64;
    let t0 = thread_cpu_ns();
    for _ in 0..blocks {
        core.pull_block(&mut block);
    }
    let per_block = (thread_cpu_ns() - t0) / blocks;
    let deadline = 128 * 1_000_000_000 / SR as u64;
    println!("two-part set: {per_block} ns CPU per 128-frame block (deadline {deadline} ns)");
    assert!(
        per_block * 4 < deadline,
        "{per_block} ns per block is over a quarter of the {deadline} ns deadline"
    );
}

/// O-I #849: an instrument made off the audio thread (the Torus its owner hands over) is handed to a MIDI
/// part while the engine plays. It takes the part from the first frame of the block that takes it, every
/// event after it reaches it, the instrument it replaced is given back to the control side (never dropped on
/// the audio thread), and Export Audio renders the hand at the frame the engine took it.
#[test]
fn an_instrument_handed_to_a_part_sounds_from_the_block_that_takes_it_and_export_renders_it_there()
{
    let build = || {
        let mut g = Graph::new(SR, 120.0);
        g.tracks.push(Track::midi(
            "Torus",
            Box::new(live_engine::SilentInstrument),
        ));
        g
    };
    let (mut core, mut handle) = engine(build()).unwrap();
    let key = EngineEvent::NoteOn {
        track: 0,
        key: 69,
        velocity: 1.0,
    };
    let mut block = vec![0f32; 256 * 2];
    let mut played = Vec::new();
    handle.send(key).unwrap();
    core.pull_block(&mut block);
    played.extend_from_slice(&block);
    assert!(
        block.iter().all(|v| *v == 0.0),
        "the silent part plays its key silently"
    );
    handle
        .install(0, Box::new(OperatorInstrument::default_patch(SR)))
        .unwrap();
    assert!(
        handle
            .install(0, Box::new(OperatorInstrument::default_patch(SR)))
            .is_err(),
        "one hand at a time: the next waits until the engine has taken this one"
    );
    handle.send(key).unwrap();
    core.pull_block(&mut block);
    played.extend_from_slice(&block);
    let model = OperatorVoiceA::default_patch(69, SR);
    for k in 0..256 {
        let want = model.sample_at(k, f64::INFINITY);
        assert!(
            block[k * 2] == want,
            "frame {k}: {} vs {want}",
            block[k * 2]
        );
    }
    for _ in 0..3 {
        core.pull_block(&mut block);
        played.extend_from_slice(&block);
    }
    handle.collect();
    assert_eq!(
        handle.installs(),
        &[(256, 0)],
        "taken at the block's first frame"
    );
    let perf = handle.performance();
    let exported = build().render_performance_with(
        SR,
        &perf,
        vec![(
            256,
            0,
            Box::new(OperatorInstrument::default_patch(SR)) as Box<dyn live_engine::Instrument>,
        )],
    );
    assert_eq!(exported.len(), played.len());
    for (n, (e, p)) in exported.iter().zip(&played).enumerate() {
        assert_eq!(e.to_bits(), p.to_bits(), "sample {n}");
    }
    assert!(
        build().render_performance(SR, &perf) != played,
        "without the hand, Export would not render what was heard"
    );
}

#[test]
fn an_instrument_is_handed_only_to_a_part_that_plays_notes() {
    let mut g = Graph::new(SR, 120.0);
    g.tracks.push(constant_part("Tone", 0.25, 100));
    let (_core, mut handle) = engine(g).unwrap();
    let refused = handle
        .install(0, Box::new(OperatorInstrument::default_patch(SR)))
        .unwrap_err();
    assert!(refused.to_string().contains("plays no notes"), "{refused}");
    let refused = handle
        .install(3, Box::new(OperatorInstrument::default_patch(SR)))
        .unwrap_err();
    assert!(refused.to_string().contains("no part"), "{refused}");
}

/// O-I #849 round 13: the chain an owner puts after a part's instrument while the engine plays (the
/// Torus's effects on its rack's chain) sounds after the instrument from the block that takes it. Put
/// there again, a device made from the same keeps its state (an echo's line rings on) and a device made
/// from something else starts fresh; Export puts each chain there at the frame the engine did, so it
/// renders the samples played, bit for bit.
#[test]
fn a_chain_after_a_parts_instrument_sounds_keeps_its_unchanged_devices_and_exports_as_played() {
    use live_engine::RackDevice;
    let build = || {
        let mut g = Graph::new(SR, 120.0);
        g.tracks.push(operator_part("Keys", &[]));
        g
    };
    let echo = |made_from: &str| RackDevice {
        made_from: made_from.into(),
        device: Box::new(EchoDevice::new(EchoParams {
            delay_time_s: 0.002,
            feedback: 0.5,
            dry_wet: 0.5,
        })),
    };
    let (mut core, mut handle) = engine(build()).unwrap();
    let mut block = vec![0f32; 256 * 2];
    let mut played = Vec::new();
    let mut pull = |core: &mut live_engine::EngineCore, played: &mut Vec<f32>| {
        core.pull_block(&mut block);
        played.extend_from_slice(&block);
    };
    handle
        .send(EngineEvent::NoteOn {
            track: 0,
            key: 69,
            velocity: 1.0,
        })
        .unwrap();
    pull(&mut core, &mut played);
    handle.install_rack(0, vec![echo("Echo")]).unwrap();
    pull(&mut core, &mut played);
    pull(&mut core, &mut played);
    // the same echo again: it keeps its line
    handle.install_rack(0, vec![echo("Echo")]).unwrap();
    pull(&mut core, &mut played);
    pull(&mut core, &mut played);
    handle.collect();
    assert_eq!(
        handle.racks(),
        &[(256, 0), (768, 0)],
        "each chain taken at its block's first frame"
    );
    let perf = handle.performance();
    let export = |racks: Vec<(u64, usize, Vec<RackDevice>)>| {
        build().render_performance_racked(SR, &perf, Vec::new(), racks)
    };
    let exported = export(vec![
        (256, 0, vec![echo("Echo")]),
        (768, 0, vec![echo("Echo")]),
    ]);
    assert_eq!(exported.len(), played.len());
    for (n, (e, p)) in exported.iter().zip(&played).enumerate() {
        assert_eq!(
            e.to_bits(),
            p.to_bits(),
            "sample {n}: Export is what was played"
        );
    }
    assert_eq!(
        export(vec![(256, 0, vec![echo("Echo")])]),
        played,
        "put there again unchanged, the echo rang on as if it had never been put again"
    );
    assert_ne!(
        export(vec![
            (256, 0, vec![echo("Echo")]),
            (768, 0, vec![echo("Echo, again")])
        ]),
        played,
        "an echo made from something else starts with an empty line"
    );
    assert_ne!(
        build().render_performance(SR, &perf),
        played,
        "the chain is heard: without it Export would not render what was played"
    );
    assert_eq!(
        played[..512],
        build().render_performance(SR, &perf)[..512],
        "before the block that takes it, the part sounds as its instrument alone"
    );
}

#[test]
fn a_chain_stands_only_after_an_instrument() {
    let mut g = Graph::new(SR, 120.0);
    g.tracks.push(constant_part("Tone", 0.25, 100));
    let (_core, mut handle) = engine(g).unwrap();
    let refused = handle.install_rack(0, Vec::new()).unwrap_err();
    assert!(
        refused.to_string().contains("holds no instrument"),
        "{refused}"
    );
    let refused = handle.install_rack(2, Vec::new()).unwrap_err();
    assert!(refused.to_string().contains("no part"), "{refused}");
}

/// A Torus as far as its part's hand-overs see one (O-I #849 round 13): it sounds the sample of its
/// owner's continuation it stands at (a thousandth of it), and stands one further each frame.
#[derive(Debug)]
struct Continuing {
    cursor: u64,
    handover: u32,
}

impl live_engine::Instrument for Continuing {
    fn name(&self) -> &str {
        "Torus"
    }
    fn note_on(&mut self, _key: u8, _velocity: f32, _clock: &Clock) {}
    fn note_off(&mut self, _key: u8, _clock: &Clock) {}
    fn release_all(&mut self, _clock: &Clock) {}
    fn process(&mut self, frame_io: &mut [f32], _clock: &Clock) {
        frame_io.fill(self.cursor as f32 / 1000.0);
        self.cursor += 1;
    }
    fn torus_handover(&self) -> Option<u32> {
        Some(self.handover)
    }
    fn torus_cursor(&self) -> Option<u64> {
        Some(self.cursor)
    }
}

fn continuing_part(cursor: u64) -> Graph {
    let mut g = Graph::new(SR, 120.0);
    g.tracks.push(Track::midi(
        "Torus",
        Box::new(Continuing {
            cursor,
            handover: 1,
        }),
    ));
    g
}

/// The owner hands the Torus over again at its sample 1500 while the part's Torus stands at 1256 (the
/// part runs behind its owner, as the engine does behind the frame): the new one takes the part when the
/// part's reaches 1500, so the part sounds its owner's continuation without a jump, and Export Audio hands
/// it over at that frame again. Due at an engine frame, it takes the part at that frame; due at a sample
/// the part has passed or far past the longest wait, at the next block.
#[test]
fn a_hand_over_again_takes_its_part_at_the_owners_sample_it_continues_from() {
    use live_engine::Due;
    let run = |due: Due, cursor: u64| {
        let (mut core, mut handle) = engine(continuing_part(1000)).unwrap();
        let mut block = vec![0f32; 256 * 2];
        let mut played = Vec::new();
        core.pull_block(&mut block);
        played.extend_from_slice(&block);
        let again = Box::new(Continuing {
            cursor,
            handover: 2,
        });
        assert!(!handle.install_latest_due(0, again, due).unwrap());
        for _ in 0..3 {
            core.pull_block(&mut block);
            played.extend_from_slice(&block);
        }
        handle.collect();
        (played, handle.installs().to_vec(), handle.performance())
    };
    let (played, installs, perf) = run(Due::AtCursor(1500), 1500);
    assert_eq!(
        installs,
        vec![(500, 0)],
        "taken when the part's Torus reached the owner's sample"
    );
    let through = continuing_part(1000).render_performance(SR, &perf);
    for (n, (p, t)) in played.iter().zip(&through).enumerate() {
        assert_eq!(
            p.to_bits(),
            t.to_bits(),
            "sample {n}: the part sounds its owner's continuation without a jump"
        );
    }
    let exported = continuing_part(1000).render_performance_with(
        SR,
        &perf,
        vec![(
            500,
            0,
            Box::new(Continuing {
                cursor: 1500,
                handover: 2,
            }),
        )],
    );
    assert_eq!(
        exported, played,
        "Export Audio hands it over at the frame the engine did"
    );

    let (played, installs, _) = run(Due::AtFrame(300), 7000);
    assert_eq!(
        installs,
        vec![(300, 0)],
        "due at an engine frame, taken at that frame"
    );
    assert_eq!(played[2 * 299], 1299.0 / 1000.0);
    assert_eq!(played[2 * 300], 7000.0 / 1000.0);

    for (due, why) in [
        (Due::AtCursor(1200), "a sample the part has passed"),
        (
            Due::AtCursor(1256 + live_engine::HAND_HOLD_MAX + 1),
            "a sample past the longest wait",
        ),
        (Due::Now, "now"),
    ] {
        let (_, installs, _) = run(due, 1500);
        assert_eq!(
            installs,
            vec![(256, 0)],
            "{why}: taken at the next block's first frame"
        );
    }
}

/// A part whose instrument is not a Torus stands at no sample of an owner's: a hand-over due at one takes
/// it at the next block.
#[test]
fn a_hand_over_due_at_a_sample_takes_a_part_without_a_torus_at_once() {
    let mut g = Graph::new(SR, 120.0);
    g.tracks.push(operator_part("Keys", &[]));
    let (mut core, mut handle) = engine(g).unwrap();
    let mut block = vec![0f32; 256 * 2];
    core.pull_block(&mut block);
    let torus = Box::new(Continuing {
        cursor: 9000,
        handover: 1,
    });
    handle
        .install_latest_due(0, torus, live_engine::Due::AtCursor(9000))
        .unwrap();
    core.pull_block(&mut block);
    handle.collect();
    assert_eq!(handle.installs(), &[(256, 0)]);
    assert_eq!(block[0], 9.0);
}

/// A tenth of a second of 440 Hz at half scale from each key struck, then silence: a burst for a room to ring
/// after (O-I #849 round 16).
#[derive(Debug, Default)]
struct Burst {
    left: u32,
    at: u32,
}

impl live_engine::Instrument for Burst {
    fn name(&self) -> &str {
        "Burst"
    }
    fn note_on(&mut self, _key: u8, _velocity: f32, _clock: &Clock) {
        (self.left, self.at) = (SR / 10, 0);
    }
    fn note_off(&mut self, _key: u8, _clock: &Clock) {}
    fn release_all(&mut self, _clock: &Clock) {}
    fn process(&mut self, frame_io: &mut [f32], _clock: &Clock) {
        let v = if self.left > 0 {
            self.left -= 1;
            self.at += 1;
            0.5 * (2.0 * std::f32::consts::PI * 440.0 * self.at as f32 / SR as f32).sin()
        } else {
            0.0
        };
        frame_io.fill(v);
    }
}

/// The Torus's Reverb as the host makes it (live-engine `rack_device`, by the frame's keys).
fn room(size: f64, decay: f64, damping: f64, predelay: f64, mix: f64) -> live_engine::RackDevice {
    live_engine::rack_device(
        "reverb",
        &[
            ("size", size),
            ("decay", decay),
            ("damping", damping),
            ("predelay", predelay),
            ("mix", mix),
        ],
    )
    .unwrap()
}

/// A burst struck on a part whose rack is `first`, then `again` put there at block `at` while the room rings,
/// pulled for `blocks` blocks of 256 frames: what was played.
fn ringing(
    first: live_engine::RackDevice,
    again: Option<live_engine::RackDevice>,
    at: usize,
    blocks: usize,
) -> Vec<f32> {
    let mut g = Graph::new(SR, 120.0);
    g.tracks
        .push(Track::midi("Keys", Box::new(Burst::default())));
    let (mut core, mut handle) = engine(g).unwrap();
    handle.install_rack(0, vec![first]).unwrap();
    handle
        .send(EngineEvent::NoteOn {
            track: 0,
            key: 69,
            velocity: 1.0,
        })
        .unwrap();
    let mut again = again;
    let mut block = vec![0f32; 256 * 2];
    let mut played = Vec::new();
    for b in 0..blocks {
        if b == at {
            if let Some(chain) = again.take() {
                handle.collect();
                handle.install_rack(0, vec![chain]).unwrap();
            }
        }
        core.pull_block(&mut block);
        played.extend_from_slice(&block);
    }
    played
}

fn energy(x: &[f32]) -> f64 {
    x.iter().map(|v| f64::from(*v) * f64::from(*v)).sum()
}

/// O-I #849 round 16: the Torus's Reverb put again for its dry/wet or its pre-delay keeps its room ringing (only
/// its size, decay and damping make the room), and one made again for another room rings the last one's tail
/// out whole: never a cut.
#[test]
fn a_room_put_again_while_it_rings_keeps_its_tail_and_one_made_again_rings_the_last_out() {
    // the burst ends at frame 4800; at block 40 (frame 10240) only the room sounds
    let (at, blocks) = (40, 120);
    let swap = at * 256 * 2;
    let still = ringing(room(50.0, 2.0, 40.0, 20.0, 30.0), None, at, blocks);
    assert!(
        energy(&still[swap..swap + 512]) > 1e-6,
        "the room rings at the block it is put again at"
    );
    // its dry/wet moved: the room rings on, heard at the new dry/wet once the move has settled
    let wetter = ringing(
        room(50.0, 2.0, 40.0, 20.0, 30.0),
        Some(room(50.0, 2.0, 40.0, 20.0, 60.0)),
        at,
        blocks,
    );
    assert_eq!(
        wetter[..swap],
        still[..swap],
        "before it is put again, nothing changed"
    );
    assert!(
        energy(&wetter[swap..swap + 512]) > 0.9 * energy(&still[swap..swap + 512]),
        "its dry/wet moved, the room's tail went on (it was cut: {} against {})",
        energy(&wetter[swap..swap + 512]),
        energy(&still[swap..swap + 512])
    );
    let settled = swap + 2 * 9600;
    for (n, (w, s)) in wetter[settled..].iter().zip(&still[settled..]).enumerate() {
        assert!(
            (w - 2.0 * s).abs() <= 1e-5 * s.abs() + 1e-9,
            "sample {}: at twice the dry/wet the tail is twice as loud ({w} against {s})",
            settled + n
        );
    }
    // its pre-delay moved: what was in the room rings on, unchanged, while the input is silent
    let later = ringing(
        room(50.0, 2.0, 40.0, 20.0, 30.0),
        Some(room(50.0, 2.0, 40.0, 120.0, 30.0)),
        at,
        blocks,
    );
    assert_eq!(
        later, still,
        "its pre-delay moved over silence, the room rang on as if nothing had moved"
    );
    // another room: the last rings its tail out whole, and the new one, given silence, adds none
    let longer = ringing(
        room(50.0, 2.0, 40.0, 20.0, 30.0),
        Some(room(80.0, 6.0, 10.0, 20.0, 30.0)),
        at,
        blocks,
    );
    assert_eq!(
        longer, still,
        "made again for another room over silence, the last room rang its tail out whole"
    );
}

/// O-I #849 round 17: a room two rebuilds back that is still fading is kept, fading on where it was, not dropped. The
/// burst rings room A; over silence it is made again for B, the next block for C (A, still ringing then, begins its
/// 15 ms fade), and the block after for D while A still fades: D adds nothing to silence, so what is played is what
/// stopping at C plays, sample for sample. Teeth: dropped, A's fade is cut to nothing at D, 464 frames early.
#[test]
fn a_room_two_rebuilds_back_still_fading_fades_on_where_it_was() {
    let rebuilt = |rooms: &[(f64, f64, f64)]| {
        let mut g = Graph::new(SR, 120.0);
        g.tracks
            .push(Track::midi("Keys", Box::new(Burst::default())));
        let (mut core, mut handle) = engine(g).unwrap();
        handle
            .install_rack(0, vec![room(50.0, 2.0, 40.0, 0.0, 100.0)])
            .unwrap();
        handle
            .send(EngineEvent::NoteOn {
                track: 0,
                key: 69,
                velocity: 1.0,
            })
            .unwrap();
        let mut rooms = rooms.iter();
        let mut block = vec![0f32; 256 * 2];
        let mut played = Vec::new();
        for b in 0..60 {
            if b >= 40 {
                if let Some(&(size, decay, damping)) = rooms.next() {
                    handle.collect();
                    handle
                        .install_rack(0, vec![room(size, decay, damping, 0.0, 100.0)])
                        .unwrap();
                }
            }
            core.pull_block(&mut block);
            played.extend_from_slice(&block);
        }
        played
    };
    let (b, c, d) = ((80.0, 6.0, 10.0), (20.0, 1.0, 70.0), (60.0, 3.0, 30.0));
    let at_c = rebuilt(&[b, c]);
    let at_d = rebuilt(&[b, c, d]);
    let from_d = 42 * 256 * 2;
    assert!(
        energy(&at_c[from_d..from_d + 2 * 464]) > 1e-9,
        "room A still fades when D is made"
    );
    assert_eq!(at_d, at_c, "A fades on where it was when D is made");
}

/// O-I #849 round 16: a room made again while sound goes into it takes that sound over a crossfade, the last
/// room taking less and less of it and ringing out, so nothing jumps.
#[test]
fn a_room_made_again_while_it_plays_crossfades_its_input_and_the_last_rings_out() {
    // a burst struck again at block 18 (frame 4608), the room made again two blocks in, while it sounds
    let played = |again: Option<live_engine::RackDevice>| {
        let mut g = Graph::new(SR, 120.0);
        g.tracks
            .push(Track::midi("Keys", Box::new(Burst::default())));
        let (mut core, mut handle) = engine(g).unwrap();
        handle
            .install_rack(0, vec![room(50.0, 2.0, 40.0, 0.0, 100.0)])
            .unwrap();
        let mut again = again;
        let mut block = vec![0f32; 256 * 2];
        let mut out = Vec::new();
        for b in 0..200 {
            if b == 18 {
                handle
                    .send(EngineEvent::NoteOn {
                        track: 0,
                        key: 69,
                        velocity: 1.0,
                    })
                    .unwrap();
            }
            if b == 20 {
                if let Some(chain) = again.take() {
                    handle.collect();
                    handle.install_rack(0, vec![chain]).unwrap();
                }
            }
            core.pull_block(&mut block);
            out.extend_from_slice(&block);
        }
        out
    };
    let still = played(None);
    let longer = played(Some(room(50.0, 6.0, 40.0, 0.0, 100.0)));
    let swap = 20 * 256 * 2;
    assert_eq!(longer[..swap], still[..swap]);
    // the room was building up under the burst; across the change it sounds on as the room it was, never
    // falling to a room that starts from nothing (the 5 ms after it, against the room left as it stood)
    let w = 2 * 240;
    let (after, stood) = (
        energy(&longer[swap..swap + w]),
        energy(&still[swap..swap + w]),
    );
    assert!(
        after >= 0.8 * stood,
        "the room fell away at the change: {after} after it against {stood} had it stood"
    );
    // the new room is heard: by its longer decay, the tail stands louder 0.8 s on
    let on = swap + 2 * (SR as usize * 4 / 5);
    assert!(
        energy(&longer[on..on + 4800]) > 2.0 * energy(&still[on..on + 4800]),
        "the longer room rings longer"
    );
    // nothing clicks: made again for a room of another size and damping, the sound bends no more sharply in
    // the 10 ms after the change than in the 10 ms before it (its largest second difference, one side)
    let other = played(Some(room(80.0, 6.0, 10.0, 0.0, 100.0)));
    let bend = |from: usize, to: usize| {
        let side: Vec<f32> = other[2 * from..2 * to].iter().step_by(2).copied().collect();
        side.windows(3)
            .map(|w| (w[2] - 2.0 * w[1] + w[0]).abs())
            .fold(0f32, f32::max)
    };
    let (before, after) = (
        bend(20 * 256 - 480, 20 * 256),
        bend(20 * 256 - 2, 20 * 256 + 480),
    );
    assert!(
        after <= 1.5 * before,
        "the room's change clicked: it bends by {after} after it against {before} before"
    );
}

/// O-I #849 round 16: a device made again while it plays for settings it takes while it plays (put again with
/// the rest of its chain) sounds exactly as if they had been moved in place: each device follows the one it
/// replaces (the compressor's detector and gain, the filter's state, the lines' repeats, the room as it rings),
/// and moves each setting from where it stood.
#[test]
fn a_device_made_again_for_settings_it_takes_while_it_plays_sounds_as_if_moved_in_place() {
    use live_engine::{rack_device, DeviceAt};
    let moves: [(usize, &'static str, f64); 7] = [
        (0, "threshold", -40.0),
        (0, "makeup", 6.0),
        (1, "Cutoff", 70.0),
        (2, "DelayLine_TimeL", 0.2),
        (2, "DryWet", 0.8),
        (3, "predelay", 120.0),
        (3, "mix", 70.0),
    ];
    let moved = || {
        vec![
            rack_device(
                "dynamics",
                &[
                    ("threshold", -40.0),
                    ("ratio", 4.0),
                    ("attack", 3.0),
                    ("release", 250.0),
                    ("makeup", 6.0),
                ],
            )
            .unwrap(),
            rack_device(
                "AutoFilter",
                &[
                    ("FilterType", 0.0),
                    ("Cutoff", 70.0),
                    ("Resonance", 0.3),
                    ("Drive", 0.0),
                ],
            )
            .unwrap(),
            rack_device(
                "Delay",
                &[
                    ("DelayLine_TimeL", 0.2),
                    ("Feedback", 0.4),
                    ("Filter_Frequency", 6000.0),
                    ("DryWet", 0.8),
                ],
            )
            .unwrap(),
            room(50.0, 1.2, 40.0, 120.0, 70.0),
        ]
    };
    let run = |again: bool| {
        let mut g = Graph::new(SR, 120.0);
        g.tracks.push(operator_part(
            "Keys",
            &[Note {
                key: 57,
                start: 0,
                length: 40_000,
                velocity: 100.0,
            }],
        ));
        let (mut core, mut handle) = engine(g).unwrap();
        handle.install_rack(0, torus_chain()).unwrap();
        let mut block = vec![0f32; 256 * 2];
        let mut played = Vec::new();
        for b in 0..120 {
            if b == 30 {
                if again {
                    handle.collect();
                    handle.install_rack(0, moved()).unwrap();
                } else {
                    for (d, key, value) in moves {
                        handle
                            .set(Part::Track(0), DeviceAt::Rack(d), key, value)
                            .unwrap();
                    }
                }
            }
            core.pull_block(&mut block);
            played.extend_from_slice(&block);
        }
        handle.collect();
        assert_eq!(handle.racks().len(), if again { 2 } else { 1 });
        played
    };
    let (in_place, made_again) = (run(false), run(true));
    let at = 30 * 256 * 2;
    assert!(
        energy(&in_place[at..at + 4800]) > 1e-4,
        "the part sounds through the change"
    );
    for (n, (a, b)) in made_again.iter().zip(&in_place).enumerate() {
        assert_eq!(
            a.to_bits(),
            b.to_bits(),
            "sample {n}: the chain made again sounds as the one moved in place"
        );
    }
}

/// O-I #849 round 16: a room's pre-delay moved while it plays delays what goes in by the new pre-delay, within
/// the line it was made with: once the move has settled, it sounds as the room made at that pre-delay.
#[test]
fn a_rooms_pre_delay_moved_while_it_plays_delays_its_input_as_one_made_at_it() {
    use live_engine::DeviceAt;
    let run = |predelay: f64, moved: Option<f64>| {
        let mut g = Graph::new(SR, 120.0);
        g.tracks
            .push(Track::midi("Keys", Box::new(Burst::default())));
        let (mut core, mut handle) = engine(g).unwrap();
        handle
            .install_rack(0, vec![room(50.0, 2.0, 40.0, predelay, 100.0)])
            .unwrap();
        let mut block = vec![0f32; 256 * 2];
        let mut played = Vec::new();
        for b in 0..120 {
            if let Some(ms) = moved.filter(|_| b == 5) {
                handle
                    .set(Part::Track(0), DeviceAt::Rack(0), "predelay", ms)
                    .unwrap();
            }
            if b == 50 {
                handle
                    .send(EngineEvent::NoteOn {
                        track: 0,
                        key: 69,
                        velocity: 1.0,
                    })
                    .unwrap();
            }
            core.pull_block(&mut block);
            played.extend_from_slice(&block);
        }
        played
    };
    let (moved, made) = (run(0.0, Some(100.0)), run(100.0, None));
    let first = moved.iter().position(|v| *v != 0.0).map(|i| i / 2);
    assert!(
        first.is_some_and(|f| f >= 50 * 256 + 4800),
        "the room sounded before its new pre-delay: from frame {first:?}"
    );
    assert!(
        moved == made,
        "a pre-delay moved and settled sounds as the room made at it"
    );
}

/// The Torus's four effects as the host makes them (live-engine `rack_device`: the frame's Dynamics and Reverb,
/// Live's Auto Filter and Delay built to the Torus's).
fn torus_chain() -> Vec<live_engine::RackDevice> {
    use live_engine::rack_device;
    vec![
        rack_device(
            "dynamics",
            &[
                ("threshold", -24.0),
                ("ratio", 4.0),
                ("attack", 3.0),
                ("release", 250.0),
                ("makeup", 0.0),
            ],
        )
        .unwrap(),
        rack_device(
            "AutoFilter",
            &[
                ("FilterType", 0.0),
                ("Cutoff", 100.0),
                ("Resonance", 0.3),
                ("Drive", 0.0),
            ],
        )
        .unwrap(),
        rack_device(
            "Delay",
            &[
                ("DelayLine_TimeL", 0.05),
                ("Feedback", 0.4),
                ("Filter_Frequency", 6000.0),
                ("DryWet", 0.3),
            ],
        )
        .unwrap(),
        room(50.0, 1.2, 40.0, 10.0, 25.0),
    ]
}

/// O-I #849 round 16: a chain device's setting moved while the engine plays (a setting changed in the shell) is
/// heard from the next block, the part sounding on: no device is made again (and the audio thread allocates
/// nothing for it, tests/realtime_no_alloc.rs), and Export renders it as played.
#[test]
fn a_chain_devices_setting_moved_while_it_plays_is_heard_from_the_next_block_and_exports_as_played()
{
    use live_engine::DeviceAt;
    let build = || {
        let mut g = Graph::new(SR, 120.0);
        g.tracks.push(operator_part(
            "Keys",
            &[Note {
                key: 57,
                start: 0,
                length: 40_000,
                velocity: 100.0,
            }],
        ));
        g
    };
    let run = |moved: &[(usize, &'static str, f64)]| -> (Vec<f32>, Performance) {
        let (mut core, mut handle) = engine(build()).unwrap();
        handle.install_rack(0, torus_chain()).unwrap();
        let mut block = vec![0f32; 256 * 2];
        let mut played = Vec::new();
        for b in 0..60 {
            if b == 30 {
                for &(d, key, value) in moved {
                    handle
                        .set(Part::Track(0), DeviceAt::Rack(d), key, value)
                        .unwrap();
                }
            }
            core.pull_block(&mut block);
            played.extend_from_slice(&block);
            if b % 7 == 0 {
                handle.collect();
            }
        }
        handle.collect();
        assert_eq!(
            handle.racks(),
            &[(0, 0)],
            "the chain was put there once: no device was made again"
        );
        (played, handle.performance())
    };
    let (still, _) = run(&[]);
    let at = 30 * 256 * 2;
    for (d, key, value) in [
        (0, "threshold", -40.0),
        (0, "makeup", 6.0),
        (1, "Cutoff", 70.0),
        (1, "Drive", 12.0),
        (2, "DryWet", 0.8),
        (2, "DelayLine_TimeL", 0.2),
        (3, "mix", 70.0),
    ] {
        let (moved, perf) = run(&[(d, key, value)]);
        assert_eq!(
            moved[..at],
            still[..at],
            "{key}: before the block that takes it, nothing changed"
        );
        assert_ne!(
            moved[at..at + 512],
            still[at..at + 512],
            "{key}: heard from the next block"
        );
        let exported =
            build().render_performance_racked(SR, &perf, Vec::new(), vec![(0, 0, torus_chain())]);
        assert!(exported == moved, "{key}: Export renders what was played");
    }
    // a setting moves as the frame moves an edit, over 15 ms, never in one jump: the room's dry/wet
    let (moved, _) = run(&[(3, "mix", 70.0)]);
    let change = |from: usize, frames: usize| {
        let (a, b) = (at + 2 * from, at + 2 * (from + frames));
        let d: Vec<f32> = moved[a..b]
            .iter()
            .zip(&still[a..b])
            .map(|(m, s)| m - s)
            .collect();
        (energy(&d) / energy(&still[a..b]).max(1e-30)).sqrt()
    };
    let (first, settled) = (change(0, 32), change(2400, 32));
    assert!(
        first < 0.2 * settled,
        "the dry/wet moved at once: {first} of the sound changed in its first 32 frames, {settled} once settled"
    );
}

/// O-I #849 round 16: what a device does not take while it plays is refused in words, naming what it takes.
#[test]
fn a_setting_a_device_does_not_take_while_it_plays_is_refused_in_words() {
    use live_engine::DeviceAt;
    let mut g = Graph::new(SR, 120.0);
    g.tracks.push(operator_part("Keys", &[]));
    g.tracks.push(constant_part("Tone", 0.25, 100));
    let (_core, mut handle) = engine(g).unwrap();
    handle
        .install_rack(0, vec![room(50.0, 1.2, 40.0, 10.0, 25.0)])
        .unwrap();
    let refused = |handle: &mut live_engine::EngineHandle, part, at, key: &str, value| {
        handle.set(part, at, key, value).unwrap_err().to_string()
    };
    let words = refused(&mut handle, Part::Track(0), DeviceAt::Rack(0), "size", 60.0);
    assert!(
        words.contains("Reverb takes its predelay, mix while it plays, not its size"),
        "{words}"
    );
    let words = refused(&mut handle, Part::Track(0), DeviceAt::Rack(0), "mix", 140.0);
    assert!(
        words.contains("takes its mix within 0 to 100, not 140"),
        "{words}"
    );
    let words = refused(&mut handle, Part::Track(0), DeviceAt::Rack(2), "mix", 50.0);
    assert!(
        words.contains("holds 1 device on the rack after its instrument: there is no device 2"),
        "{words}"
    );
    let words = refused(&mut handle, Part::Track(1), DeviceAt::Chain(0), "mix", 50.0);
    assert!(
        words.contains("'Tone' holds no device on its chain"),
        "{words}"
    );
    let words = refused(&mut handle, Part::Track(4), DeviceAt::Chain(0), "mix", 50.0);
    assert!(words.contains("no part 4"), "{words}");
}

/// O-I #849 round 16: a group track is a bus. What stands in it (a part, or a group in it) sounds through its chain and
/// its row (gain, then pan) into the group it stands in or the Main track, and its sends feed the returns as a part's;
/// while something is soloed, a part or group sounds where it or a group it stands in is soloed, and a group passes what
/// it holds that is; a group switched off silences what stands in it; a group's level moves while it plays, and a group
/// the set does not hold is refused in words.
#[test]
fn a_group_track_is_a_bus_what_stands_in_it_sounds_through_its_chain_and_row() {
    use live_engine::GroupTrack;
    let build = || {
        let mut g = Graph::new(SR, 120.0);
        let mut a = constant_part("A", 0.25, 4096);
        a.group = Some(0);
        let mut b = constant_part("B", 0.125, 4096);
        b.group = Some(1);
        b.sends = vec![0.0];
        let c = constant_part("C", 0.0625, 4096);
        g.tracks = vec![a, b, c];
        let mut outer = GroupTrack::new("Outer");
        outer.gain = 0.5;
        outer.devices.push(Box::new(GainDevice::new_db(6.0)));
        let mut inner = GroupTrack::new("Inner");
        inner.group = Some(0);
        inner.pan = 0.5;
        inner.sends = vec![0.5];
        g.groups = vec![outer, inner];
        g.returns.push(ReturnTrack::new("A"));
        g.solo_in_place = true;
        g
    };
    let heard = |g: &mut Graph| {
        g.prepare();
        let f = g.mix_frame(&Clock::start(SR, 120.0));
        (f64::from(f[0]), f64::from(f[1]))
    };
    let up = f64::from(10f32.powf(6.0 / 20.0));
    let near = |got: (f64, f64), want: (f64, f64), what: &str| {
        assert!(
            (got.0 - want.0).abs() < 1e-6 && (got.1 - want.1).abs() < 1e-6,
            "{what}: {got:?}, not {want:?}"
        );
    };
    // B through Inner (half left) into Outer with A, Outer's chain and its half gain; Inner's send to the return
    let inner = (0.125 * 0.5, 0.125);
    let outer = ((0.25 + inner.0) * up * 0.5, (0.25 + inner.1) * up * 0.5);
    let ret = (inner.0 * 0.5, inner.1 * 0.5);
    near(
        heard(&mut build()),
        (0.0625 + outer.0 + ret.0, 0.0625 + outer.1 + ret.1),
        "every part through its groups",
    );
    // B soloed: it sounds through both groups; A and C do not
    let mut g = build();
    g.tracks[1].solo = true;
    near(
        heard(&mut g),
        (inner.0 * up * 0.5 + ret.0, inner.1 * up * 0.5 + ret.1),
        "a soloed part in a group",
    );
    // Outer soloed: what stands in it sounds, C does not
    let mut g = build();
    g.groups[0].solo = true;
    near(
        heard(&mut g),
        (outer.0 + ret.0, outer.1 + ret.1),
        "a soloed group",
    );
    // C soloed: the groups pass nothing, and their chains sound nothing
    let mut g = build();
    g.tracks[2].solo = true;
    near(
        heard(&mut g),
        (0.0625, 0.0625),
        "a soloed part outside the groups",
    );
    // Outer off: nothing in it reaches Main (Inner's send still feeds the return, as B's would)
    let mut g = build();
    g.groups[0].active = false;
    near(
        heard(&mut g),
        (0.0625 + ret.0, 0.0625 + ret.1),
        "a group switched off",
    );
    // the group's level moves while it plays
    let (mut core, mut handle) = engine(build()).unwrap();
    handle
        .send(EngineEvent::Volume {
            part: Part::Group(0),
            gain: 0.0,
        })
        .unwrap();
    let mut block = vec![0f32; 2];
    core.pull_block(&mut block);
    near(
        (f64::from(block[0]), f64::from(block[1])),
        (0.0625 + ret.0, 0.0625 + ret.1),
        "the group's level moved to nothing",
    );
    handle.collect();
    assert_eq!(handle.mixer().groups[0].gain, 0.0);
    let words = handle
        .send(EngineEvent::Active {
            part: Part::Group(2),
            on: false,
        })
        .unwrap_err()
        .to_string();
    assert!(
        words.contains("the set has no group 2 (it has 2)"),
        "{words}"
    );
}

/// O-I #849 round 17: a group's solo and its sends are followed while it plays, as a part's are. Outer soloed from
/// the next block, what stands in it sounds and C does not; Inner's send moved to nothing, the return hears nothing
/// of it; Outer's solo off, every part sounds again; Export renders it as played. A solo or a send of a return or
/// the Main track, and a send a group does not have, are refused in words.
#[test]
fn a_groups_solo_and_sends_are_followed_while_it_plays_and_export_as_played() {
    use live_engine::GroupTrack;
    let build = || {
        let mut g = Graph::new(SR, 120.0);
        let mut a = constant_part("A", 0.25, 4096);
        a.group = Some(0);
        let mut b = constant_part("B", 0.125, 4096);
        b.group = Some(1);
        let c = constant_part("C", 0.0625, 4096);
        g.tracks = vec![a, b, c];
        let mut outer = GroupTrack::new("Outer");
        outer.gain = 0.5;
        let mut inner = GroupTrack::new("Inner");
        inner.group = Some(0);
        inner.sends = vec![0.5];
        g.groups = vec![outer, inner];
        g.returns.push(ReturnTrack::new("A"));
        g.solo_in_place = true;
        g
    };
    let (mut core, mut handle) = engine(build()).unwrap();
    let mut played = Vec::new();
    let block = |core: &mut live_engine::EngineCore, played: &mut Vec<f32>| {
        let mut out = vec![0f32; 2];
        core.pull_block(&mut out);
        played.extend_from_slice(&out);
        (f64::from(out[0]), f64::from(out[1]))
    };
    let near = |got: (f64, f64), want: f64, what: &str| {
        assert!(
            (got.0 - want).abs() < 1e-6 && (got.1 - want).abs() < 1e-6,
            "{what}: {got:?}, not {want}"
        );
    };
    let (outer, ret) = ((0.25 + 0.125) * 0.5, 0.125 * 0.5);
    near(
        block(&mut core, &mut played),
        0.0625 + outer + ret,
        "every part",
    );
    handle
        .send(EngineEvent::Solo {
            part: Part::Group(0),
            on: true,
        })
        .unwrap();
    near(block(&mut core, &mut played), outer + ret, "Outer soloed");
    handle
        .send(EngineEvent::Send {
            part: Part::Group(1),
            send: 0,
            gain: 0.0,
        })
        .unwrap();
    near(block(&mut core, &mut played), outer, "Inner sends nothing");
    handle
        .send(EngineEvent::Solo {
            part: Part::Group(0),
            on: false,
        })
        .unwrap();
    near(
        block(&mut core, &mut played),
        0.0625 + outer,
        "Outer's solo off",
    );
    handle.collect();
    assert!(!handle.mixer().groups[0].solo);
    assert_eq!(handle.mixer().groups[1].sends, vec![0.0]);
    let exported = build().render_performance(SR, &handle.performance());
    assert_eq!(&exported[..played.len()], &played[..], "exported as played");
    for (event, words) in [
        (
            EngineEvent::Solo {
                part: Part::Return(0),
                on: true,
            },
            "return 0 has no solo and no sends",
        ),
        (
            EngineEvent::Send {
                part: Part::Main,
                send: 0,
                gain: 0.5,
            },
            "the Main track has no solo and no sends",
        ),
        (
            EngineEvent::Send {
                part: Part::Group(1),
                send: 2,
                gain: 0.5,
            },
            "'Inner' has 1 sends: there is no send 2",
        ),
        (
            EngineEvent::Solo {
                part: Part::Group(5),
                on: true,
            },
            "the set has no group 5 (it has 2)",
        ),
    ] {
        let refused = handle.send(event).unwrap_err().to_string();
        assert!(refused.contains(words), "{refused}");
    }
}

/// O-I #853: a MIDI part's pitch bend reaches its instrument while it plays. The engine's Operator bends every voice it
/// sounds by MIDI's default range, two semitones each way, from the next block, its phase going on unbroken, and back;
/// Export renders it as played. What an instrument does not take (Operator's channel pressure), a bend beyond its range
/// and a bend of an audio part are refused in words.
#[test]
fn a_parts_pitch_bend_bends_its_operator_from_the_next_block_and_exports_as_played() {
    use live_dynamics::operator::goertzel_amp;
    let build = || {
        let mut g = Graph::new(SR, 120.0);
        g.tracks.push(operator_part(
            "Keys",
            &[Note {
                key: 69,
                start: 0,
                length: 96_000,
                velocity: 100.0,
            }],
        ));
        g
    };
    let run = |bends: &[(usize, f32)]| {
        let (mut core, mut handle) = engine(build()).unwrap();
        let mut block = vec![0f32; 256 * 2];
        let mut played = Vec::new();
        for b in 0..300 {
            for &(at, amount) in bends {
                if at == b {
                    handle.send(EngineEvent::Bend { track: 0, amount }).unwrap();
                }
            }
            core.pull_block(&mut block);
            played.extend(block.iter().step_by(2).copied());
        }
        (played, handle.performance())
    };
    let (still, _) = run(&[]);
    let (bent, perf) = run(&[(100, 1.0), (200, 0.0)]);
    let at = 100 * 256;
    assert_eq!(
        bent[..at],
        still[..at],
        "before the block that takes it, nothing changed"
    );
    let up = 440.0 * 2f64.powf(2.0 / 12.0);
    let window = |x: &[f32], f: f64, from: usize| {
        goertzel_amp(
            x,
            SR,
            f,
            from as f64 / f64::from(SR) + 0.01,
            from as f64 / f64::from(SR) + 0.5,
        )
    };
    assert!(
        window(&bent, up, at) > 20.0 * window(&bent, 440.0, at),
        "bent a whole tone up: {} at {up} Hz against {} at 440",
        window(&bent, up, at),
        window(&bent, 440.0, at)
    );
    let back = 200 * 256;
    assert!(
        window(&bent, 440.0, back) > 20.0 * window(&bent, up, back),
        "and back to its key"
    );
    // its phase goes on: across each bend no sample moves by more than the tone moves in one at its higher pitch
    let peak = bent[at..].iter().fold(0f32, |m, v| m.max(v.abs()));
    let step = (2.0 * std::f64::consts::PI * up / f64::from(SR)) as f32 * peak;
    for edge in [at, back] {
        let most = bent[edge - 256..edge + 256]
            .windows(2)
            .map(|w| (w[1] - w[0]).abs())
            .fold(0f32, f32::max);
        assert!(
            most <= 1.01 * step,
            "the bend at {edge} jumped: {most} against {step}"
        );
    }
    let exported: Vec<f32> = build()
        .render_performance(SR, &perf)
        .iter()
        .step_by(2)
        .copied()
        .collect();
    assert!(exported == bent, "Export renders the bend as played");
    // what is not taken, in words
    let mut g = build();
    g.tracks.push(constant_part("Tone", 0.25, 100));
    let (_core, mut handle) = engine(g).unwrap();
    let refused =
        |handle: &mut live_engine::EngineHandle, e| handle.send(e).unwrap_err().to_string();
    let words = refused(
        &mut handle,
        EngineEvent::Pressure {
            track: 0,
            amount: 0.5,
        },
    );
    assert!(
        words.contains("'Keys' plays the engine's Operator, which takes no channel pressure: the corpus's surface of Live's Operator routes it nowhere"),
        "{words}"
    );
    let words = refused(
        &mut handle,
        EngineEvent::Bend {
            track: 0,
            amount: 1.5,
        },
    );
    assert!(
        words.contains("a pitch bend is −1 (down) to 1 (up), not 1.5"),
        "{words}"
    );
    let words = refused(
        &mut handle,
        EngineEvent::Bend {
            track: 1,
            amount: 0.5,
        },
    );
    assert!(
        words.contains("'Tone' is an audio part: it plays no notes"),
        "{words}"
    );
}

/// A mono part of `frames` samples of a 220 Hz sine at `amp`, through `chain`.
fn sine_part(amp: f32, frames: usize, chain: Vec<Box<dyn Device>>) -> Track {
    let mut t = Track::new("Drums", 1);
    let w = 2.0 * std::f32::consts::PI * 220.0 / SR as f32;
    t.source = (0..frames).map(|i| amp * (w * i as f32).sin()).collect();
    t.devices = chain;
    t
}

/// A mono part of `frames` samples, a 64-frame burst at its start and silence after it, through `chain`.
fn burst_part(frames: usize, chain: Vec<Box<dyn Device>>) -> Track {
    let mut t = Track::new("Drums", 1);
    t.source = (0..frames)
        .map(|i| if i < 64 { 0.5 } else { 0.0 })
        .collect();
    t.devices = chain;
    t
}

type MadeAgain = Vec<(Part, usize, Box<dyn Device>)>;
/// What a run played, its performance, and the devices it made again as (frame, count).
type Played = (Vec<f32>, Performance, Vec<(u64, u64)>);
/// A device of one kind made at a setting.
type MadeAt<'a> = &'a dyn Fn(f64) -> Box<dyn Device>;

/// `build`'s graph played 256 frames a block for `blocks`, the devices `made` makes again put there at block
/// `at_block`: what it played, its performance, and the devices it made again as (frame, count).
fn made_again_run(
    build: &dyn Fn() -> Graph,
    made: &dyn Fn() -> MadeAgain,
    at_block: usize,
    blocks: usize,
) -> Played {
    let (mut core, mut handle) = engine(build()).unwrap();
    let mut block = vec![0f32; 256 * 2];
    let mut played = Vec::new();
    for b in 0..blocks {
        if b == at_block {
            for (part, at, device) in made() {
                handle.make_again(part, at, device).unwrap();
            }
        }
        core.pull_block(&mut block);
        played.extend_from_slice(&block);
        if b % 5 == 0 {
            handle.collect();
        }
    }
    handle.collect();
    (played, handle.performance(), handle.remade().to_vec())
}

fn glue(threshold_db: f64, makeup_db: f64) -> Box<dyn Device> {
    Box::new(GlueDevice::new(GlueParams {
        threshold_db,
        range: 30.0,
        ratio: 1.0,
        makeup_db,
    }))
}

fn echo(feedback: f64, dry_wet: f64) -> Box<dyn Device> {
    Box::new(EchoDevice::new(EchoParams {
        delay_time_s: 0.05,
        feedback,
        dry_wet,
    }))
}

fn reverb(decay_ms: f64) -> Box<dyn Device> {
    Box::new(live_engine::ReverbDevice::partitioned(
        live_dynamics::reverb::ReverbParams { decay_ms },
        1.0,
    ))
}

/// O-I #849 round 17: a set's device edited while it plays is made again from what the set now stores and takes its
/// place on its part's chain (or the Main track's) at the next block's first frame: heard from that block, nothing
/// changed before it, and Export renders what was played. What is not there is refused in words.
#[test]
fn a_chain_device_made_again_while_it_plays_is_heard_from_its_block_and_exports_as_played() {
    let frames = 60 * 256;
    let build = || {
        let mut g = Graph::new(SR, 120.0);
        g.tracks.push(sine_part(
            0.9,
            frames,
            vec![glue(-30.0, 0.0), echo(0.5, 0.5), reverb(1200.0)],
        ));
        g.master.devices.push(glue(-20.0, 0.0));
        g
    };
    let made = || -> MadeAgain {
        vec![
            (Part::Track(0), 0, glue(-30.0, 1.0)),
            (Part::Track(0), 1, echo(0.5, 0.8)),
            (Part::Track(0), 2, reverb(2400.0)),
            (Part::Main, 0, glue(-10.0, 0.0)),
        ]
    };
    let (still, ..) = made_again_run(&build, &Vec::new, 30, 60);
    let (played, perf, remade) = made_again_run(&build, &made, 30, 60);
    let at = 30 * 256;
    assert_eq!(
        remade,
        [
            (at as u64, 1),
            (at as u64, 2),
            (at as u64, 3),
            (at as u64, 4)
        ],
        "each taken at its block's first frame"
    );
    assert_eq!(
        played[..2 * at],
        still[..2 * at],
        "before its block, nothing changed"
    );
    assert_ne!(
        played[2 * at..2 * at + 512],
        still[2 * at..2 * at + 512],
        "heard from its block"
    );
    let exported = build().render_performance_remade(
        SR,
        &perf,
        Vec::new(),
        Vec::new(),
        made()
            .into_iter()
            .map(|(part, place, device)| (at as u64, part, place, device))
            .collect(),
    );
    assert_eq!(exported.len(), played.len());
    for (n, (e, p)) in exported.iter().zip(&played).enumerate() {
        assert_eq!(
            e.to_bits(),
            p.to_bits(),
            "sample {n}: Export is what was played"
        );
    }
    assert_ne!(
        build().render_performance(SR, &perf),
        played,
        "without the devices made again, Export would not render what was played"
    );
    let (_, mut handle) = engine(build()).unwrap();
    for (part, place, words) in [
        (
            Part::Track(0),
            3,
            "'Drums' holds 3 devices on its chain: there is no device 3",
        ),
        (Part::Track(4), 0, "the set has no part 4 (it has 1)"),
        (Part::Return(0), 0, "the set has no return 0 (it has 0)"),
        (Part::Group(1), 0, "the set has no group 1 (it has 0)"),
    ] {
        assert_eq!(
            handle.make_again(part, place, glue(-30.0, 0.0)),
            Err(Refusal::Invalid(words.into())),
            "{part:?} {place}"
        );
    }
}

/// O-I #849 round 17: one made again for a place before the engine took the last gives way to it; those for other places
/// wait with it, and both stand.
#[test]
fn a_device_made_again_twice_before_its_block_stands_as_the_later_and_another_waits_with_it() {
    let build = || {
        let mut g = Graph::new(SR, 120.0);
        g.tracks
            .push(sine_part(0.9, 20 * 256, vec![glue(-30.0, 0.0)]));
        g.master.devices.push(glue(-20.0, 0.0));
        g
    };
    let made = || -> MadeAgain {
        vec![
            (Part::Track(0), 0, glue(-30.0, 1.0)),
            (Part::Main, 0, glue(-10.0, 0.0)),
            (Part::Track(0), 0, glue(-30.0, 2.0)),
        ]
    };
    let (played, perf, remade) = made_again_run(&build, &made, 10, 20);
    let at = 10 * 256u64;
    assert_eq!(
        remade,
        [(at, 2), (at, 3)],
        "the first gave way; Main's waited with the later"
    );
    let exported = build().render_performance_remade(
        SR,
        &perf,
        Vec::new(),
        Vec::new(),
        vec![
            (at, Part::Main, 0, glue(-10.0, 0.0)),
            (at, Part::Track(0), 0, glue(-30.0, 2.0)),
        ],
    );
    assert!(exported == played, "it sounds as the later alone");
}

/// O-I #849 round 17: a device made again for an edit sounds on from where the one it replaces stood: a Glue's and a
/// Compressor's gain move on from the reduction they stood at (so a makeup edit moves the sound by the makeup alone), an
/// Echo's repeats of what was played before ring on at its new settings, and a Reverb's room rings its tail out.
#[test]
fn a_device_made_again_sounds_on_from_where_the_one_it_replaces_stood() {
    let at = 30 * 256;
    let one_db = 10f64.powf(1.0 / 20.0);
    // the ratio of the moved part's left side to the still one's over `window` frames from the edit
    let ratio = |moved: &[f32], still: &[f32], window: std::ops::Range<usize>| -> f64 {
        let side = |x: &[f32]| -> f64 {
            window
                .clone()
                .map(|i| f64::from(x[2 * (at + i)]).powi(2))
                .sum::<f64>()
        };
        (side(moved) / side(still)).sqrt()
    };
    let compressor = |gain: f64| -> Box<dyn Device> {
        let mut p = live_dynamics::compressor::DEFAULTS;
        p.gain = gain;
        Box::new(live_engine::CompressorDevice::new(p))
    };
    let gains: [(&str, MadeAt); 2] = [
        ("Glue", &|db| glue(-30.0, db)),
        ("Compressor", &|db| compressor(3.0 + db)),
    ];
    for (name, made_at) in gains {
        let build = || {
            let mut g = Graph::new(SR, 120.0);
            g.tracks.push(sine_part(0.9, 60 * 256, vec![made_at(0.0)]));
            g
        };
        let (still, ..) = made_again_run(&build, &Vec::new, 30, 60);
        let made = || vec![(Part::Track(0), 0, made_at(1.0))];
        let (moved, ..) = made_again_run(&build, &made, 30, 60);
        let r = ratio(&moved, &still, 0..512);
        assert!(
            (r - one_db).abs() < 0.005 * one_db,
            "{name}: made again with 1 dB more makeup, its sound moved by {r} (1 dB is {one_db}): its gain started afresh"
        );
    }
    // an Echo's line: of the same length (another dry/wet) taken whole, of another (another feedback) copied
    let burst = |made_at: &'static dyn Fn() -> Box<dyn Device>| {
        move || {
            let mut g = Graph::new(SR, 120.0);
            g.tracks.push(burst_part(60 * 256, vec![made_at()]));
            g
        }
    };
    let (still, ..) = made_again_run(&burst(&|| echo(0.5, 0.5)), &Vec::new, 30, 60);
    let hop = 2400;
    for (feedback, dry_wet, want) in [(0.5, 0.8, 0.8 / 0.5), (0.7, 0.5, 0.49 / 0.25)] {
        let made = move || vec![(Part::Track(0), 0, echo(feedback, dry_wet))];
        let (moved, ..) = made_again_run(&burst(&|| echo(0.5, 0.5)), &made, 30, 60);
        // the burst's fourth repeat (4 hops on, its right side) and its fifth (its left), after the edit
        for (tap, side) in [(4usize, 1usize), (5, 0)] {
            let from = tap * hop;
            let level = |x: &[f32]| -> f64 {
                (from..from + 64)
                    .map(|i| f64::from(x[2 * i + side]).powi(2))
                    .sum::<f64>()
                    .sqrt()
            };
            let want = if tap == 5 && feedback == 0.7 {
                0.343 / 0.125
            } else {
                want
            };
            let r = level(&moved) / level(&still);
            assert!(
                (r - want).abs() < 1e-3 * want,
                "Echo made again at feedback {feedback} and dry/wet {dry_wet}: repeat {tap} came out at {r} of the still one's, not {want}: its line started empty"
            );
        }
    }
    // a Reverb's room: the burst's tail rings on after the edit, the new room hearing the silence after it
    let (still, ..) = made_again_run(&burst(&|| reverb(1200.0)), &Vec::new, 30, 60);
    let made = || vec![(Part::Track(0), 0, reverb(2400.0))];
    let (moved, ..) = made_again_run(&burst(&|| reverb(1200.0)), &made, 30, 60);
    let tail = energy(&still[2 * at..2 * (at + 4096)]);
    assert!(
        tail > 1e-6,
        "the burst's tail still rings at the edit: {tail}"
    );
    assert!(
        moved[2 * at..] == still[2 * at..],
        "the last room rang its tail out whole, as if never made again"
    );
}
