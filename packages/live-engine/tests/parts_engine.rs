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
                        track: 1,
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
            8 => send(&mut handle, EngineEvent::Solo { track: 1, on: true }),
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
                    track: 1,
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
        track: 0,
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
