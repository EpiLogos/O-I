//! The Torus its owner hands over (QL-MEF `torus-native`, `ql.torus-native/v1`), read as the one
//! engine's Torus node takes it (O-I #849; feature `k8`): the continuation exactly as it stood at the
//! owner's cursor (`ql.continuous-handover/v1`: states, cursor, driver remainder, clock, samples, the
//! Carrier's drive, acts waiting for later samples) and the played-address law of the tuning in force
//! (`ql.torus-keys/v1`). The document reaches this host from the kernel, which kept it as the owner
//! handed it over (`native_expression.rs` `Field::torus_native`); the page carries only its digest.
//!
//! Nothing here adds to the field: every number is the owner's, read exactly — an exact integer from
//! its canonical decimal string, a double as the owner wrote it — and a document that is not whole
//! is refused in words, so the engine never sounds a field its owner did not hand over.

use live_engine::k8::{
    CoupledClock, K8Carrier, K8Continuation, K8Field, K8Input, K8Instrument, K8KeyLaw, K8KeyVoice,
    K8Mode, K8Pending, K8Sample, PhaseLift,
};
use serde_json::Value;
use std::str::FromStr;

pub const TORUS_NATIVE: &str = "ql.torus-native/v1";
const CONTINUOUS_HANDOVER: &str = "ql.continuous-handover/v1";
const TORUS_KEYS: &str = "ql.torus-keys/v1";

/// A Torus as its owner handed it over: the sample it stood at, the continuation and the law — none
/// while a form's body rings (QL hands over the body's modes and refuses the torus's key law, in the
/// words kept in `keys_refused`: a key strikes the form by its own exciter law).
#[derive(Debug, Clone, PartialEq)]
pub struct Handed {
    pub at_samples_elapsed: u64,
    pub continuation: K8Continuation,
    pub law: Option<K8KeyLaw>,
    pub keys_refused: Option<String>,
}

impl Handed {
    /// The Torus node made from what was handed over, as the host's `handover`-th hand-over (off the
    /// audio thread: it allocates), at the engine's rate or refused: the engine resamples nothing. It
    /// strikes the acts its owner lands after that hand-over, at the owner's samples, and no note of its
    /// own: a note on its part is its owner's to play (the host hands it over). Made again from the same
    /// document, it renders the same samples — what Export Audio renders again.
    pub fn node_handed(&self, engine_rate: u32, handover: u32) -> Result<K8Instrument, String> {
        Ok(self.torus(engine_rate)?.handed_over(handover))
    }

    fn torus(&self, engine_rate: u32) -> Result<K8Instrument, String> {
        let rate = self.continuation.input.sample_rate;
        if rate != engine_rate {
            return Err(format!(
                "The Torus was handed over at {rate} Hz and the engine plays at {engine_rate} Hz: it resamples nothing"
            ));
        }
        let mut field = K8Field::continue_from(&self.continuation)?;
        if let Some(law) = &self.law {
            field.set_law(law)?;
        }
        Ok(K8Instrument::new(field))
    }

    /// The index of the mode `reference` names in the continuation (an owner's act names its modes so).
    pub fn mode(&self, reference: &str) -> Option<usize> {
        self.continuation
            .input
            .modes
            .iter()
            .position(|m| m.reference == reference)
    }
}

fn at<'a>(value: &'a Value, key: &str, what: &str) -> Result<&'a Value, String> {
    value
        .get(key)
        .ok_or_else(|| format!("the handed-over Torus names no {what} ({key})"))
}

/// An exact integer, as the owner writes one: its canonical decimal string.
fn exact<T: FromStr + ToString>(value: &Value, key: &str, what: &str) -> Result<T, String> {
    let text = at(value, key, what)?
        .as_str()
        .ok_or_else(|| format!("the handed-over Torus's {what} ({key}) is not an exact decimal"))?;
    let n: T = text
        .parse()
        .map_err(|_| format!("the handed-over Torus's {what} ({key}) is not an exact decimal"))?;
    if n.to_string() != text {
        return Err(format!(
            "the handed-over Torus's {what} ({key}) is not a canonical decimal"
        ));
    }
    Ok(n)
}

fn exact_item<T: FromStr + ToString>(value: &Value, what: &str) -> Result<T, String> {
    let text = value
        .as_str()
        .ok_or_else(|| format!("the handed-over Torus's {what} is not an exact decimal"))?;
    let n: T = text
        .parse()
        .map_err(|_| format!("the handed-over Torus's {what} is not an exact decimal"))?;
    if n.to_string() != text {
        return Err(format!(
            "the handed-over Torus's {what} is not a canonical decimal"
        ));
    }
    Ok(n)
}

/// A JSON integer within `T`.
fn int<T: TryFrom<u64>>(value: &Value, what: &str) -> Result<T, String> {
    value
        .as_u64()
        .and_then(|n| T::try_from(n).ok())
        .ok_or_else(|| format!("the handed-over Torus's {what} is not a whole number in range"))
}

fn number(value: &Value, what: &str) -> Result<f64, String> {
    value
        .as_f64()
        .filter(|x| x.is_finite())
        .ok_or_else(|| format!("the handed-over Torus's {what} is not a finite number"))
}

fn text(value: &Value, key: &str, what: &str) -> Result<String, String> {
    at(value, key, what)?
        .as_str()
        .map(str::to_owned)
        .ok_or_else(|| format!("the handed-over Torus's {what} ({key}) is not text"))
}

fn list<'a>(value: &'a Value, what: &str) -> Result<&'a Vec<Value>, String> {
    value
        .as_array()
        .ok_or_else(|| format!("the handed-over Torus's {what} is not a list"))
}

fn pair(value: &Value, what: &str) -> Result<(f64, f64), String> {
    match list(value, what)?.as_slice() {
        [re, im] => Ok((number(re, what)?, number(im, what)?)),
        _ => Err(format!("the handed-over Torus's {what} is not a pair")),
    }
}

fn vec3(value: &Value, what: &str) -> Result<[f64; 3], String> {
    match list(value, what)?.as_slice() {
        [x, y, z] => Ok([number(x, what)?, number(y, what)?, number(z, what)?]),
        _ => Err(format!(
            "the handed-over Torus's {what} is not three numbers"
        )),
    }
}

fn phase(value: &Value, what: &str) -> Result<PhaseLift, String> {
    Ok(PhaseLift {
        turns: exact(value, "turns", what)?,
        half_degrees: int(at(value, "half_degrees", what)?, what)?,
    })
}

fn clock(value: &Value) -> Result<CoupledClock, String> {
    let fixed = |key: &str, n: usize| -> Result<&Vec<Value>, String> {
        list(at(value, key, "clock")?, "clock")
            .ok()
            .filter(|items| items.len() == n)
            .ok_or_else(|| format!("the handed-over Torus's clock {key} is not {n} values"))
    };
    let origins = fixed("grid_origins", 3)?;
    let rates = fixed("rate_numerators", 2)?;
    let rest = fixed("rate_remainders", 2)?;
    Ok(CoupledClock {
        inscription: phase(at(value, "inscription", "clock")?, "clock inscription")?,
        lensing: phase(at(value, "lensing", "clock")?, "clock lensing")?,
        grid_origin_half_degrees: [
            int(&origins[0], "clock grid origin")?,
            int(&origins[1], "clock grid origin")?,
            int(&origins[2], "clock grid origin")?,
        ],
        rate_numerators: [
            exact_item(&rates[0], "clock rate")?,
            exact_item(&rates[1], "clock rate")?,
        ],
        rate_denominator: int(at(value, "rate_denominator", "clock")?, "clock rate")?,
        rate_remainders: [
            exact_item(&rest[0], "clock remainder")?,
            exact_item(&rest[1], "clock remainder")?,
        ],
        generation: exact(value, "generation", "clock generation")?,
    })
}

fn continuation(handed: &Value) -> Result<K8Continuation, String> {
    if handed["schema"] != CONTINUOUS_HANDOVER {
        return Err(format!(
            "the handed-over Torus's continuation is not QL's {CONTINUOUS_HANDOVER}"
        ));
    }
    let modes = list(at(handed, "modes", "modes")?, "modes")?
        .iter()
        .map(|m| {
            Ok(K8Mode {
                reference: text(m, "mode_ref", "mode")?,
                source_coordinate: text(m, "source_coordinate", "mode")?,
                frequency_hz: number(at(m, "frequency_hz", "mode")?, "mode frequency")?,
                damping_per_second: number(at(m, "damping_per_second", "mode")?, "mode damping")?,
                amplitude_metres: pair(at(m, "state_metres", "mode")?, "mode state")?,
                drive_metres_per_second: pair(
                    at(m, "drive_metres_per_second", "mode")?,
                    "mode drive",
                )?,
                audio_gain_per_metre: number(at(m, "audio_gain_per_metre", "mode")?, "mode gain")?,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;
    let samples = list(at(handed, "samples", "samples")?, "samples")?
        .iter()
        .map(|s| {
            Ok(K8Sample {
                identity: int(at(s, "identity", "sample")?, "sample identity")?,
                constituent: text(s, "constituent", "sample")?,
                attachment: int(at(s, "attachment", "sample")?, "sample attachment")?,
                rest_metres: vec3(at(s, "rest_metres", "sample")?, "sample rest")?,
                mode_shapes: list(at(s, "mode_shapes", "sample")?, "sample mode shapes")?
                    .iter()
                    .map(|shape| vec3(shape, "sample mode shape"))
                    .collect::<Result<_, _>>()?,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;
    let carrier = at(handed, "carrier", "Carrier's drive")?;
    let pending = list(at(handed, "pending", "acts waiting")?, "acts waiting")?
        .iter()
        .map(|act| {
            Ok(K8Pending {
                at_samples_elapsed: exact(act, "at_samples_elapsed", "waiting act's sample")?,
                impulses: list(at(act, "impulses", "waiting act")?, "waiting act")?
                    .iter()
                    .map(|one| {
                        Ok((
                            int(at(one, "mode", "waiting act")?, "waiting act's mode")?,
                            pair(
                                at(one, "amplitude", "waiting act")?,
                                "waiting act's amplitude",
                            )?,
                        ))
                    })
                    .collect::<Result<_, String>>()?,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;
    Ok(K8Continuation {
        input: K8Input {
            event_ref: text(handed, "event_ref", "event")?,
            subject_ref: text(handed, "subject_ref", "subject")?,
            geometry_ref: text(handed, "geometry_ref", "geometry")?,
            material_ref: text(handed, "material_ref", "material")?,
            model_ref: text(handed, "model_ref", "model")?,
            generation: exact(handed, "generation", "generation")?,
            sample_rate: int(at(handed, "sample_rate", "rate")?, "rate")?,
            clock: clock(at(handed, "clock", "clock")?)?,
            driver_numerator: int(at(handed, "driver_numerator", "driver")?, "driver")?,
            driver_denominator: int(at(handed, "driver_denominator", "driver")?, "driver")?,
            modes,
            samples,
        },
        samples_elapsed: exact(handed, "samples_elapsed", "cursor")?,
        driver_remainder: exact(handed, "driver_remainder", "driver remainder")?,
        last_unmuted_sample: number(
            at(handed, "last_unmuted_sample", "last unmuted sample")?,
            "last unmuted sample",
        )?,
        carrier: K8Carrier {
            steps_per_second: number(at(carrier, "steps_per_second", "pulse")?, "pulse")?,
            anchor_samples: exact(carrier, "anchor_samples", "pulse anchor")?,
            anchor_steps: number(at(carrier, "anchor_steps", "pulse anchor")?, "pulse anchor")?,
            reached: number(
                at(carrier, "reached", "Carrier's steps")?,
                "Carrier's steps",
            )?,
            impulses: list(
                at(carrier, "impulses", "Carrier's drive")?,
                "Carrier's drive",
            )?
            .iter()
            .map(|z| pair(z, "Carrier's drive"))
            .collect::<Result<_, _>>()?,
        },
        pending,
        heard_from: list(at(handed, "heard_from", "receiver")?, "receiver")?
            .iter()
            .map(|g| number(g, "receiver gain"))
            .collect::<Result<_, _>>()?,
    })
}

fn law(keys: &Value, modes: usize) -> Result<K8KeyLaw, String> {
    if keys["contract"] != TORUS_KEYS {
        return Err(format!(
            "the handed-over Torus's keys are not QL's {TORUS_KEYS}"
        ));
    }
    let arcs = list(at(keys, "arcs", "key arcs")?, "key arcs")?;
    let mut table = [0u8; 36];
    if arcs.len() != table.len() {
        return Err("the handed-over Torus's key arcs are not 36".into());
    }
    for (slot, arc) in table.iter_mut().zip(arcs) {
        *slot = int(arc, "key arc")?;
    }
    let voices = list(at(keys, "voices", "voices")?, "voices")?
        .iter()
        .map(|v| {
            let mode: usize = int(at(v, "mode", "voice")?, "voice's mode")?;
            if mode >= modes {
                return Err(format!(
                    "a voice of the handed-over Torus sounds through mode {mode}, and its field has {modes}"
                ));
            }
            Ok(K8KeyVoice {
                mode,
                longitude_radians: number(at(v, "longitude_radians", "voice")?, "voice")?,
                weight: number(at(v, "weight", "voice")?, "voice")?,
                phase_radians: number(at(v, "phase_radians", "voice")?, "voice")?,
                m: int(at(v, "m", "voice")?, "voice")?,
                n: int(at(v, "n", "voice")?, "voice")?,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;
    let pulse = at(keys, "pulse", "pulse")?;
    Ok(K8KeyLaw {
        arcs: table,
        voices,
        strike: number(at(keys, "strike", "Strike")?, "Strike")?,
        anchor_samples: exact(pulse, "anchor_samples", "pulse anchor")?,
        anchor_steps: number(at(pulse, "anchor_steps", "pulse anchor")?, "pulse anchor")?,
        steps_per_second: number(at(pulse, "steps_per_second", "pulse")?, "pulse")?,
        sample_rate: int(at(keys, "sample_rate", "keys' rate")?, "keys' rate")?,
        cap_metres: number(at(keys, "cap_metres", "material cap")?, "material cap")?,
    })
}

/// The Torus as its owner handed it over, or why the document is not one.
pub fn read(document: &Value) -> Result<Handed, String> {
    if document["schema"] != TORUS_NATIVE {
        return Err(format!(
            "This is not the Torus its owner hands over ({TORUS_NATIVE})"
        ));
    }
    let at_samples_elapsed: u64 = exact(document, "at_samples_elapsed", "sample")?;
    let continuation = continuation(at(document, "continuation", "continuation")?)?;
    let keys = at(document, "keys", "keys")?;
    // A form's body is handed over with no key law, and its owner's words for why (QL torus_native.rs TORUS_BODY_KEYS_REFUSED).
    let (law, keys_refused) = if keys.is_null() {
        let refused = document["keys_refused"]
            .as_str()
            .ok_or("The handed-over Torus has no key law and does not say why (keys_refused)")?;
        (None, Some(refused.to_owned()))
    } else {
        (Some(law(keys, continuation.input.modes.len())?), None)
    };
    let generation: u64 = exact(document, "generation", "generation")?;
    if continuation.samples_elapsed != at_samples_elapsed
        || continuation.input.generation != generation
        || document["event_ref"] != continuation.input.event_ref.as_str()
        || document["subject_ref"] != continuation.input.subject_ref.as_str()
    {
        return Err(
            "The handed-over Torus's continuation is not the field it names: another sample, generation or event".into(),
        );
    }
    if law
        .as_ref()
        .is_some_and(|law| law.sample_rate != continuation.input.sample_rate)
    {
        return Err("The handed-over Torus's keys are at another rate than its field".into());
    }
    Ok(Handed {
        at_samples_elapsed,
        continuation,
        law,
        keys_refused,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::live_engine_host::host::{EventIn, Opened, Takes, ENGINE_RATE};
    use live_engine::EngineCore;
    use oi_cradle_kernel::native_expression::Request;
    use serde_json::json;

    #[test]
    fn what_is_not_a_handed_over_torus_is_refused_in_words() {
        let refused = read(&json!({"schema":"ql.torus-checkpoint/v1"})).unwrap_err();
        assert!(
            refused.contains("is not the Torus its owner hands over"),
            "{refused}"
        );
    }

    /// One MIDI part with no device of its own, at unity and centre-panned, into a Main at unity: what
    /// the part's Torus plays is what Main plays, sample for sample (the engine's pan law keeps centre
    /// bit-transparent, graph.rs `pan_weights`).
    const SET: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<Ableton MajorVersion="5"><LiveSet>
  <Tracks>
    <MidiTrack Id="1"><Name><EffectiveName Value="Torus" /></Name>
      <DeviceChain>
        <Mixer><Sends /><Speaker><Manual Value="true" /></Speaker><Pan><Manual Value="0" /></Pan><Volume><Manual Value="1" /></Volume><SoloSink Value="false" /></Mixer>
        <MainSequencer><ClipTimeable><ArrangerAutomation><Events /></ArrangerAutomation></ClipTimeable></MainSequencer>
        <DeviceChain><Devices /></DeviceChain>
      </DeviceChain>
    </MidiTrack>
  </Tracks>
  <MainTrack><DeviceChain><Mixer><Tempo><Manual Value="120" /></Tempo><Volume><Manual Value="1" /></Volume><Pan><Manual Value="0" /></Pan></Mixer>
    <DeviceChain><Devices /></DeviceChain></DeviceChain></MainTrack>
</LiveSet></Ableton>"#;

    fn pull(core: &mut EngineCore, frames: usize) -> Vec<f32> {
        let mut out = vec![0f32; frames * 2];
        for block in out.chunks_mut(512) {
            core.pull_block(block);
        }
        out
    }

    /// What the shell does with the notes the host hands the owner (`oi:live-engine-torus-notes`): each act
    /// played on the owner as the frame's Jankó strike plays it (torus-play, at its sample when it has one)
    /// and the releases as its Jankó release (torus-release).
    fn play_due(due: &Value, exchange: &mut dyn FnMut(Value) -> Value) {
        for act in due["acts"].as_array().unwrap() {
            let mut command = json!({"operation":"torus-play","keys":act["keys"],"amplitude":[act["amplitude"],0]});
            if let Some(at) = act.get("at_samples_elapsed") {
                command["at_samples_elapsed"] = at.clone();
            }
            exchange(command);
        }
        let releases = &due["releases"];
        if releases.as_array().is_some_and(|keys| !keys.is_empty()) {
            exchange(json!({"operation":"torus-release","keys":releases}));
        }
    }

    /// The owner's own sound of a block (the field's `audio` an `advance` answers), as the engine's f32.
    fn owner_sound(reply: &Value, frames: usize) -> Vec<f32> {
        let audio = reply["field"]["audio"]
            .as_array()
            .expect("an advance answers its sound");
        assert_eq!(audio.len(), frames, "{reply}");
        audio.iter().map(|s| s.as_f64().unwrap() as f32).collect()
    }

    /// O-I #849 end to end, on QL's real companions and nothing prepared by hand: the kernel opens the
    /// scene's owner (`ql scene binding`, `ql-field-host`, `ql-field-worker`); the owner hands the Torus over
    /// (`torus-native`); the kernel keeps the document and the page is relayed only its digest; the host
    /// reads it, makes the Torus node and installs it on the set's part; a key act struck on the owner and
    /// on the engine sounds the same, sample for sample, through the part's mixer row to Main; a mixer move
    /// is heard; Export Audio renders what was played; Panic stills it. No audio device is opened.
    #[test]
    #[ignore = "requires QL's real companions (OI_QL_BIN, OI_QL_SKY_BIN, OI_QL_FIELD_HOST_BIN, OI_QL_FIELD_WORKER_BIN) and QL_MEF_PREFIX"]
    fn the_torus_its_owner_hands_over_sounds_in_the_one_engine_as_its_owner_sounds_it() {
        let client =
            oi_cradle_kernel::CentralClient::with("/nonexistent".into(), None, String::new());
        let field = oi_cradle_kernel::Kernel::new(client).native_field();
        let opened = field
            .apply(Request::Compose {
                request: json!({"texture":[8,8],"units_per_metre":120,"sky":"none"}),
            })
            .unwrap();
        let lease = opened["lease"].as_str().unwrap().to_owned();
        let mut current = opened["receipt"].clone();
        let mut exchange = |command: Value| {
            let id: u64 = current["last_request_id"]
                .as_str()
                .unwrap()
                .parse()
                .unwrap();
            let reply = field
                .apply(Request::Exchange {
                    lease: lease.clone(),
                    request: json!({"schema":"ql.field-host-request/v1",
                        "instance_ref":current["instance_ref"],
                        "event_ref":current["field"]["event_ref"],
                        "subject_ref":current["field"]["subject_ref"],
                        "request_id":(id + 1).to_string(),
                        "expected_generation":current["field"]["generation"],
                        "expected_samples_elapsed":current["field"]["samples_elapsed"],
                        "command":command}),
                })
                .unwrap();
            assert_eq!(reply["status"], "ok", "{reply}");
            current = reply.clone();
            reply
        };
        exchange(json!({"operation":"advance","frames":4800,"muted":false}));
        let relayed = exchange(json!({"operation":"torus-native"}));
        let digest = &relayed["torus_native"];
        assert!(
            digest.get("continuation").is_none(),
            "the page is relayed only the digest"
        );
        let sha256 = digest["sha256"].as_str().unwrap().to_owned();
        let document = field.torus_native(&lease, &sha256).unwrap();
        let handed = read(&document).unwrap();
        assert_eq!(handed.at_samples_elapsed, 4800);
        assert!(!handed.law.as_ref().unwrap().voices.is_empty());

        // What is not the field handed over is refused in words.
        for (what, mutate, words) in [
            (
                "schema",
                (|d: &mut Value| d["schema"] = json!("ql.torus-native/v0")) as fn(&mut Value),
                "is not the Torus",
            ),
            (
                "cursor",
                |d| d["at_samples_elapsed"] = json!("4801"),
                "not the field it names",
            ),
            (
                "canonical",
                |d| d["continuation"]["samples_elapsed"] = json!("04800"),
                "canonical",
            ),
            (
                "mode",
                |d| d["keys"]["voices"][0]["mode"] = json!(4096),
                "sounds through mode 4096",
            ),
            (
                "arcs",
                |d| {
                    d["keys"]["arcs"].as_array_mut().unwrap().pop();
                },
                "are not 36",
            ),
            (
                "state",
                |d| d["continuation"]["modes"][0]["state_metres"] = json!([0.0]),
                "is not a pair",
            ),
            (
                "clock",
                |d| d["continuation"]["clock"]["rate_numerators"] = json!([9, 8]),
                "exact decimal",
            ),
        ] {
            let mut mutant = document.clone();
            mutate(&mut mutant);
            let refused = read(&mutant).unwrap_err();
            assert!(refused.contains(words), "{what}: {refused}");
        }

        let dir = std::env::temp_dir().join(format!("oi-torus-native-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("torus.als");
        let root = live_set::xml::parse(SET).unwrap();
        std::fs::write(&path, live_set::write_gz(&root).unwrap()).unwrap();
        let mut engine = Opened::open(&path).unwrap();
        let mut core = engine.core.take().unwrap();
        let event = |json: Value| serde_json::from_value::<EventIn>(json).unwrap();
        let keys = json!([{"row":2,"column":3},{"row":4,"column":1}]);
        let strike = json!({"kind":"torus_play","track":0,"keys":keys,"amplitude":[0.3,0]});
        // A part holds no Torus until one is handed over to it.
        let refused = engine.send(event(strike.clone())).unwrap_err();
        assert!(refused.contains("holds no Torus"), "{refused}");
        let now = Takes::Instead(live_engine::Due::Now);
        assert_eq!(engine.hand_torus(0, &sha256, &document, now), Ok(1));
        let installed = engine.reading();
        assert_eq!(installed["toruses"][0]["sha256"], sha256);
        assert_eq!(installed["toruses"][0]["at_samples_elapsed"], "4800");
        // a hand the engine has not taken yet gives way to the next, and is kept nowhere: it never sounded
        assert_eq!(engine.hand_torus(0, &sha256, &document, now), Ok(2));
        let given_way = engine.reading();
        assert_eq!(given_way["toruses"].as_array().map(Vec::len), Some(1));
        assert_eq!(given_way["toruses"][0]["handover"], 2);
        engine.send(event(strike)).unwrap();
        exchange(json!({"operation":"torus-play","keys":keys,"amplitude":[0.3,0]}));
        const N: usize = 4096;
        let main = pull(&mut core, N);
        let owner = owner_sound(
            &exchange(json!({"operation":"advance","frames":N,"muted":false})),
            N,
        );
        assert!(owner.iter().any(|s| *s != 0.0), "the struck Torus sounds");
        for (n, sample) in owner.iter().enumerate() {
            for channel in 0..2 {
                assert_eq!(
                    main[2 * n + channel].to_bits(),
                    sample.to_bits(),
                    "frame {n}: Main plays the Torus its owner sounds"
                );
            }
        }
        assert_eq!(engine.reading()["toruses"][0]["sounding_from_frame"], 0);
        // Its mixer row is the part's: half its gain, half the sound.
        engine
            .send(event(
                json!({"kind":"volume","part":{"track":0},"gain":0.5}),
            ))
            .unwrap();
        let halved = pull(&mut core, N);
        let owner = owner_sound(
            &exchange(json!({"operation":"advance","frames":N,"muted":false})),
            N,
        );
        for (n, sample) in owner.iter().enumerate() {
            assert_eq!(
                halved[2 * n].to_bits(),
                (sample * 0.5).to_bits(),
                "frame {n}"
            );
        }
        engine.send(event(json!({"kind":"panic"}))).unwrap();
        let stilled = pull(&mut core, N);
        assert!(stilled.iter().all(|s| *s == 0.0), "Panic stills the Torus");
        let (bytes, exported) = engine.render_wav().unwrap();
        assert_eq!(exported["complete"], true);
        let wav = live_engine::wav::read_wav_f32(&bytes).unwrap();
        let played: Vec<f32> = [main, halved, stilled].concat();
        assert_eq!(wav.samples.len(), played.len());
        for (n, (e, p)) in wav.samples.iter().zip(&played).enumerate() {
            assert_eq!(
                e.to_bits(),
                p.to_bits(),
                "sample {n}: Export Audio is what was played"
            );
        }
        assert_eq!(ENGINE_RATE, handed.law.as_ref().unwrap().sample_rate);
        std::fs::remove_dir_all(dir).unwrap();
    }

    /// The bound part's Main against the owner's own sound of the same block, sample for sample.
    fn same(main: &[f32], owner: &[f32], what: &str) {
        assert_eq!(main.len(), owner.len() * 2, "{what}");
        assert!(owner.iter().any(|s| *s != 0.0), "{what}: the Torus sounds");
        for (n, sample) in owner.iter().enumerate() {
            for channel in 0..2 {
                assert_eq!(
                    main[2 * n + channel].to_bits(),
                    sample.to_bits(),
                    "{what}, frame {n}: Main plays the Torus its owner sounds"
                );
            }
        }
    }

    /// O-I #849 round 12 end to end, on QL's real companions: the engine follows the Torus's owner act for
    /// act. The kernel taps what the owner does (`Field::set_torus_tap`), and the host, bound to the owner's
    /// lease (`live_engine_torus`), strikes each act the owner lands — a key played before the part was bound,
    /// a touch and a singlet at later samples — at the owner's own sample with the impulses the owner's law gave
    /// each mode; a MIDI note on the part strikes the key the shell's pitch→key law gives it (`notes`) by the
    /// owner's played-address law; a setting changes the law, the owner hands the Torus over again, and the
    /// part takes it in the last one's place. Main is the owner's own sound throughout, sample for sample, and
    /// Export Audio renders it again. No audio device is opened.
    #[test]
    #[ignore = "requires QL's real companions (OI_QL_BIN, OI_QL_SKY_BIN, OI_QL_FIELD_HOST_BIN, OI_QL_FIELD_WORKER_BIN) and QL_MEF_PREFIX"]
    fn the_engine_follows_its_torus_owner_act_for_act_and_hand_over_for_hand_over() {
        use crate::live_engine_host::host::LiveEngineHost;
        let client =
            oi_cradle_kernel::CentralClient::with("/nonexistent".into(), None, String::new());
        let field = oi_cradle_kernel::Kernel::new(client).native_field();
        let (tap, tapped) = std::sync::mpsc::channel();
        field.set_torus_tap(tap).unwrap();
        let opened = field
            .apply(Request::Compose {
                request: json!({"texture":[8,8],"units_per_metre":120,"sky":"none"}),
            })
            .unwrap();
        let lease = opened["lease"].as_str().unwrap().to_owned();
        let mut current = opened["receipt"].clone();
        let mut exchange = |command: Value| {
            let id: u64 = current["last_request_id"]
                .as_str()
                .unwrap()
                .parse()
                .unwrap();
            let reply = field
                .apply(Request::Exchange {
                    lease: lease.clone(),
                    request: json!({"schema":"ql.field-host-request/v1",
                        "instance_ref":current["instance_ref"],
                        "event_ref":current["field"]["event_ref"],
                        "subject_ref":current["field"]["subject_ref"],
                        "request_id":(id + 1).to_string(),
                        "expected_generation":current["field"]["generation"],
                        "expected_samples_elapsed":current["field"]["samples_elapsed"],
                        "command":command}),
                })
                .unwrap();
            assert_eq!(reply["status"], "ok", "{reply}");
            current = reply.clone();
            reply
        };
        let kept = |lease: &str, sha256: &str| field.torus_native(lease, sha256);
        // the host's follow thread, run here in step
        let follow = |host: &LiveEngineHost| {
            for told in tapped.try_iter() {
                host.tapped(told, kept);
            }
        };

        let dir = std::env::temp_dir().join(format!("oi-torus-follow-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("torus.als");
        let root = live_set::xml::parse(SET).unwrap();
        std::fs::write(&path, live_set::write_gz(&root).unwrap()).unwrap();
        let host = LiveEngineHost::default();
        host.open(&path).unwrap();
        let mut core = host
            .0
            .lock()
            .unwrap()
            .as_mut()
            .unwrap()
            .core
            .take()
            .unwrap();

        exchange(json!({"operation":"advance","frames":4800,"muted":false}));
        let sha256 = exchange(json!({"operation":"torus-native"}))["torus_native"]["sha256"]
            .as_str()
            .unwrap()
            .to_owned();
        // a key played after the hand-over and before the part is bound: kept, and struck first
        exchange(
            json!({"operation":"torus-play","keys":[{"row":2,"column":3},{"row":4,"column":1}],"amplitude":[0.3,0]}),
        );
        follow(&host);
        let document = field.torus_native(&lease, &sha256).unwrap();
        let mut notes = [None; 128];
        notes[60] = Some((2u8, 3u16));
        let bound = host
            .bind_torus(&lease, 0, &sha256, &document, Some(notes), None, None, kept)
            .unwrap();
        assert_eq!(bound["torus_follow"]["handover"], 1, "{bound}");
        assert_eq!(bound["torus_follow"]["struck"], 1, "{bound}");
        // a touch and a singlet at later samples, landed by the owner and struck by the engine where it landed them
        let touch = exchange(
            json!({"operation":"strike-at","points":[{"theta":0.7,"phi":2.2,"amplitude":[0.3,0.0]}],"at_samples_elapsed":"5800"}),
        );
        assert_eq!(touch["strike_at"]["at_samples_elapsed"], "5800", "{touch}");
        exchange(
            json!({"operation":"torus-singlet","codon":5,"amplitude":[0.2,0.1],"at_samples_elapsed":"6300"}),
        );
        follow(&host);
        const N: usize = 4096;
        let mut played = Vec::new();
        let main = pull(&mut core, N);
        let owner = owner_sound(
            &exchange(json!({"operation":"advance","frames":N,"muted":false})),
            N,
        );
        same(&main, &owner, "a key, a touch and a singlet");
        played.extend(main);
        // a MIDI note on the part is its owner's: the host hands it over as its key by the pitch law, the
        // frame plays it on the owner, and the owner's act strikes the part
        let midi = |velocity: f32| {
            serde_json::from_value::<EventIn>(
                json!({"kind":"note_on","track":0,"key":60,"velocity":velocity}),
            )
            .unwrap()
        };
        host.send(midi(90.0)).unwrap();
        let due = host.torus_notes().unwrap();
        assert_eq!(
            due["acts"],
            json!([{"keys":[{"row":2,"column":3}],"amplitude":90.0 / 127.0}])
        );
        play_due(&due, &mut exchange);
        follow(&host);
        let main = pull(&mut core, N);
        let owner = owner_sound(
            &exchange(json!({"operation":"advance","frames":N,"muted":false})),
            N,
        );
        same(&main, &owner, "a MIDI note");
        played.extend(main);
        // a setting changes the law: the owner hands the Torus over again and the part takes it
        exchange(json!({"operation":"torus-set","edit":{"tuning":"sky"}}));
        let again = exchange(json!({"operation":"torus-native"}))["torus_native"]["sha256"]
            .as_str()
            .unwrap()
            .to_owned();
        assert_ne!(again, sha256);
        follow(&host);
        let reading = host.mixer().unwrap();
        assert_eq!(reading["torus_follow"]["handover"], 2, "{reading}");
        assert_eq!(reading["torus_follow"]["handed_again"], 1, "{reading}");
        assert_eq!(
            reading["torus_follow"]["sha256"],
            again.as_str(),
            "{reading}"
        );
        host.send(midi(100.0)).unwrap();
        play_due(&host.torus_notes().unwrap(), &mut exchange);
        follow(&host);
        let main = pull(&mut core, N);
        let owner = owner_sound(
            &exchange(json!({"operation":"advance","frames":N,"muted":false})),
            N,
        );
        same(&main, &owner, "a MIDI note by the law handed over again");
        played.extend(main);
        let reading = host.mixer().unwrap();
        assert_eq!(reading["torus_follow"]["struck"], 5, "{reading}");
        assert_eq!(reading["torus_follow"]["missed"], 0, "{reading}");
        assert_eq!(reading["toruses"][0]["handover"], 2, "{reading}");
        assert_eq!(
            reading["toruses"][0]["sounding_from_frame"],
            2 * N,
            "{reading}"
        );
        // Export Audio makes each Torus again with its hand-over and notes, and strikes each act where it was struck
        let (bytes, _) = host
            .0
            .lock()
            .unwrap()
            .as_mut()
            .unwrap()
            .render_wav()
            .unwrap();
        let wav = live_engine::wav::read_wav_f32(&bytes).unwrap();
        assert_eq!(wav.samples.len(), played.len());
        for (n, (e, p)) in wav.samples.iter().zip(&played).enumerate() {
            assert_eq!(
                e.to_bits(),
                p.to_bits(),
                "sample {n}: Export Audio is what was played"
            );
        }
        std::fs::remove_dir_all(dir).unwrap();
    }

    /// O-I #849 round 13 end to end, on QL's real companions: the part runs behind its owner (as the engine
    /// does behind the frame, which renders ahead of what it plays), and a setting moves the Torus while the
    /// part's Torus is 2048 samples behind the owner. The owner hands it over again at its sample; the part
    /// takes it when its Torus reaches that sample, so Main is the owner's own sound throughout, sample for
    /// sample, through the hand-over and a key struck on the law handed over again; Export Audio renders it
    /// again. No audio device is opened.
    #[test]
    #[ignore = "requires QL's real companions (OI_QL_BIN, OI_QL_SKY_BIN, OI_QL_FIELD_HOST_BIN, OI_QL_FIELD_WORKER_BIN) and QL_MEF_PREFIX"]
    fn a_hand_over_again_takes_the_part_at_its_owners_sample_so_the_part_sounds_on_without_a_jump()
    {
        use crate::live_engine_host::host::LiveEngineHost;
        let client =
            oi_cradle_kernel::CentralClient::with("/nonexistent".into(), None, String::new());
        let field = oi_cradle_kernel::Kernel::new(client).native_field();
        let (tap, tapped) = std::sync::mpsc::channel();
        field.set_torus_tap(tap).unwrap();
        let opened = field
            .apply(Request::Compose {
                request: json!({"texture":[8,8],"units_per_metre":120,"sky":"none"}),
            })
            .unwrap();
        let lease = opened["lease"].as_str().unwrap().to_owned();
        let mut current = opened["receipt"].clone();
        let mut exchange = |command: Value| {
            let id: u64 = current["last_request_id"]
                .as_str()
                .unwrap()
                .parse()
                .unwrap();
            let reply = field
                .apply(Request::Exchange {
                    lease: lease.clone(),
                    request: json!({"schema":"ql.field-host-request/v1",
                        "instance_ref":current["instance_ref"],
                        "event_ref":current["field"]["event_ref"],
                        "subject_ref":current["field"]["subject_ref"],
                        "request_id":(id + 1).to_string(),
                        "expected_generation":current["field"]["generation"],
                        "expected_samples_elapsed":current["field"]["samples_elapsed"],
                        "command":command}),
                })
                .unwrap();
            assert_eq!(reply["status"], "ok", "{reply}");
            current = reply.clone();
            reply
        };
        let kept = |lease: &str, sha256: &str| field.torus_native(lease, sha256);
        let follow = |host: &LiveEngineHost| {
            for told in tapped.try_iter() {
                host.tapped(told, kept);
            }
        };

        let dir = std::env::temp_dir().join(format!("oi-torus-again-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("torus.als");
        let root = live_set::xml::parse(SET).unwrap();
        std::fs::write(&path, live_set::write_gz(&root).unwrap()).unwrap();
        let host = LiveEngineHost::default();
        host.open(&path).unwrap();
        let mut core = host
            .0
            .lock()
            .unwrap()
            .as_mut()
            .unwrap()
            .core
            .take()
            .unwrap();

        exchange(json!({"operation":"advance","frames":4800,"muted":false}));
        let sha256 = exchange(json!({"operation":"torus-native"}))["torus_native"]["sha256"]
            .as_str()
            .unwrap()
            .to_owned();
        let document = field.torus_native(&lease, &sha256).unwrap();
        host.bind_torus(&lease, 0, &sha256, &document, None, None, None, kept)
            .unwrap();
        exchange(
            json!({"operation":"torus-play","keys":[{"row":2,"column":3},{"row":4,"column":1}],"amplitude":[0.3,0]}),
        );
        follow(&host);
        // the owner's sound from its sample 4800 on, and the part's from the frame its Torus took it at 4800
        let mut owner = owner_sound(
            &exchange(json!({"operation":"advance","frames":4096,"muted":false})),
            4096,
        );
        let mut main = pull(&mut core, 2048);
        // a setting moves the Torus while the part stands 2048 samples behind: the owner hands it over again
        exchange(json!({"operation":"torus-set","edit":{"tuning":"sky"}}));
        let again = exchange(json!({"operation":"torus-native"}))["torus_native"]["sha256"]
            .as_str()
            .unwrap()
            .to_owned();
        assert_ne!(again, sha256);
        follow(&host);
        // a key on the law handed over again, at the owner's cursor
        exchange(
            json!({"operation":"torus-play","keys":[{"row":3,"column":2}],"amplitude":[0.25,0]}),
        );
        follow(&host);
        owner.extend(owner_sound(
            &exchange(json!({"operation":"advance","frames":4096,"muted":false})),
            4096,
        ));
        main.extend(pull(&mut core, 6144));
        same(
            &main,
            &owner,
            "a hand-over again while the part runs 2048 samples behind its owner",
        );
        let reading = host.mixer().unwrap();
        assert_eq!(reading["toruses"][0]["handover"], 2, "{reading}");
        assert_eq!(
            reading["toruses"][0]["sounding_from_frame"], 4096,
            "taken when the part reached the owner's sample 8896: {reading}"
        );
        assert_eq!(reading["torus_follow"]["missed"], 0, "{reading}");
        let (bytes, _) = host
            .0
            .lock()
            .unwrap()
            .as_mut()
            .unwrap()
            .render_wav()
            .unwrap();
        let wav = live_engine::wav::read_wav_f32(&bytes).unwrap();
        assert_eq!(wav.samples.len(), main.len());
        for (n, (e, p)) in wav.samples.iter().zip(&main).enumerate() {
            assert_eq!(
                e.to_bits(),
                p.to_bits(),
                "sample {n}: Export Audio is what was played"
            );
        }
        std::fs::remove_dir_all(dir).unwrap();
    }

    /// O-I #849 round 13 end to end, on QL's real companions: the first hand-over in step with the frame.
    /// The frame names when it will play the sample its owner handed the Torus over at — here 50 ms from
    /// now, the engine having mixed nothing and its device reporting no latency; the part takes the Torus
    /// at the engine's frame heard then, 2400, so the part is silent until then and from then on is the
    /// owner's own sound, sample for sample, from the hand-over on: the engine sounds the Torus when the
    /// frame would have. No audio device is opened.
    #[test]
    #[ignore = "requires QL's real companions (OI_QL_BIN, OI_QL_SKY_BIN, OI_QL_FIELD_HOST_BIN, OI_QL_FIELD_WORKER_BIN) and QL_MEF_PREFIX"]
    fn the_first_hand_over_takes_the_part_at_the_frame_heard_when_the_frame_plays_its_sample() {
        use crate::live_engine_host::host::LiveEngineHost;
        let client =
            oi_cradle_kernel::CentralClient::with("/nonexistent".into(), None, String::new());
        let field = oi_cradle_kernel::Kernel::new(client).native_field();
        let (tap, tapped) = std::sync::mpsc::channel();
        field.set_torus_tap(tap).unwrap();
        let opened = field
            .apply(Request::Compose {
                request: json!({"texture":[8,8],"units_per_metre":120,"sky":"none"}),
            })
            .unwrap();
        let lease = opened["lease"].as_str().unwrap().to_owned();
        let mut current = opened["receipt"].clone();
        let mut exchange = |command: Value| {
            let id: u64 = current["last_request_id"]
                .as_str()
                .unwrap()
                .parse()
                .unwrap();
            let reply = field
                .apply(Request::Exchange {
                    lease: lease.clone(),
                    request: json!({"schema":"ql.field-host-request/v1",
                        "instance_ref":current["instance_ref"],
                        "event_ref":current["field"]["event_ref"],
                        "subject_ref":current["field"]["subject_ref"],
                        "request_id":(id + 1).to_string(),
                        "expected_generation":current["field"]["generation"],
                        "expected_samples_elapsed":current["field"]["samples_elapsed"],
                        "command":command}),
                })
                .unwrap();
            assert_eq!(reply["status"], "ok", "{reply}");
            current = reply.clone();
            reply
        };
        let kept = |lease: &str, sha256: &str| field.torus_native(lease, sha256);

        let dir = std::env::temp_dir().join(format!("oi-torus-heard-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("torus.als");
        let root = live_set::xml::parse(SET).unwrap();
        std::fs::write(&path, live_set::write_gz(&root).unwrap()).unwrap();
        let host = LiveEngineHost::default();
        host.open(&path).unwrap();
        let mut core = host
            .0
            .lock()
            .unwrap()
            .as_mut()
            .unwrap()
            .core
            .take()
            .unwrap();

        exchange(json!({"operation":"advance","frames":4800,"muted":false}));
        let sha256 = exchange(json!({"operation":"torus-native"}))["torus_native"]["sha256"]
            .as_str()
            .unwrap()
            .to_owned();
        let document = field.torus_native(&lease, &sha256).unwrap();
        host.bind_torus(&lease, 0, &sha256, &document, None, None, Some(50.0), kept)
            .unwrap();
        exchange(
            json!({"operation":"torus-play","keys":[{"row":2,"column":3},{"row":4,"column":1}],"amplitude":[0.3,0]}),
        );
        for told in tapped.try_iter() {
            host.tapped(told, kept);
        }
        let owner = owner_sound(
            &exchange(json!({"operation":"advance","frames":4096,"muted":false})),
            4096,
        );
        let main = pull(&mut core, 2400 + 4096);
        assert!(
            main[..2 * 2400].iter().all(|s| *s == 0.0),
            "the part is silent until the frame heard when the frame plays the hand-over"
        );
        same(
            &main[2 * 2400..],
            &owner,
            "the part from the frame heard when the frame plays the hand-over",
        );
        let reading = host.mixer().unwrap();
        assert_eq!(
            reading["toruses"][0]["sounding_from_frame"], 2400,
            "{reading}"
        );
        assert_eq!(reading["torus_follow"]["missed"], 0, "{reading}");
        std::fs::remove_dir_all(dir).unwrap();
    }

    /// O-I #849 round 14 end to end, on QL's real companions: a receiver's move is reached in the engine over the samples its
    /// owner reached it over, though the part's Torus renders a frame at a time in the engine's blocks of 256. Receiver On is
    /// asked before the first hand-over, so the Torus is handed over heard by the gains it leaves, and its owner's next block
    /// reaches the receiver's over its 512; a second place is asked while a setting waits 200 samples into the next block, so the
    /// owner reaches it over those 200 only; Receiver Off reaches the declared gains over the next 512. The owner names each part
    /// (`torus_heard`), the kernel taps it and the host reaches it on the part's Torus: Main is the owner's own sound throughout,
    /// sample for sample, and Export Audio renders it again. No audio device is opened.
    #[test]
    #[ignore = "requires QL's real companions (OI_QL_BIN, OI_QL_SKY_BIN, OI_QL_FIELD_HOST_BIN, OI_QL_FIELD_WORKER_BIN) and QL_MEF_PREFIX"]
    fn a_receivers_move_is_reached_in_the_engine_over_the_samples_its_owner_reached_it_over() {
        use crate::live_engine_host::host::LiveEngineHost;
        let client =
            oi_cradle_kernel::CentralClient::with("/nonexistent".into(), None, String::new());
        let field = oi_cradle_kernel::Kernel::new(client).native_field();
        let (tap, tapped) = std::sync::mpsc::channel();
        field.set_torus_tap(tap).unwrap();
        let opened = field
            .apply(Request::Compose {
                request: json!({"texture":[8,8],"units_per_metre":120,"sky":"none"}),
            })
            .unwrap();
        let lease = opened["lease"].as_str().unwrap().to_owned();
        let mut current = opened["receipt"].clone();
        let mut exchange = |command: Value| {
            let id: u64 = current["last_request_id"]
                .as_str()
                .unwrap()
                .parse()
                .unwrap();
            let reply = field
                .apply(Request::Exchange {
                    lease: lease.clone(),
                    request: json!({"schema":"ql.field-host-request/v1",
                        "instance_ref":current["instance_ref"],
                        "event_ref":current["field"]["event_ref"],
                        "subject_ref":current["field"]["subject_ref"],
                        "request_id":(id + 1).to_string(),
                        "expected_generation":current["field"]["generation"],
                        "expected_samples_elapsed":current["field"]["samples_elapsed"],
                        "command":command}),
                })
                .unwrap();
            assert_eq!(reply["status"], "ok", "{reply}");
            current = reply.clone();
            reply
        };
        let kept = |lease: &str, sha256: &str| field.torus_native(lease, sha256);
        let follow = |host: &LiveEngineHost| {
            for told in tapped.try_iter() {
                host.tapped(told, kept);
            }
        };
        // The parts a block names that reached a receiver's gains, as (first sample, length).
        let parts = |block: &Value| -> Vec<(u64, u64)> {
            block["torus_heard"]
                .as_array()
                .unwrap_or_else(|| {
                    panic!(
                        "the block names the part that reached the receiver's gains: {}",
                        block["torus_heard"]
                    )
                })
                .iter()
                .map(|p| {
                    (
                        p["at_samples_elapsed"].as_str().unwrap().parse().unwrap(),
                        p["frames"].as_u64().unwrap(),
                    )
                })
                .collect()
        };

        let dir = std::env::temp_dir().join(format!("oi-torus-receiver-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("torus.als");
        let root = live_set::xml::parse(SET).unwrap();
        std::fs::write(&path, live_set::write_gz(&root).unwrap()).unwrap();
        let host = LiveEngineHost::default();
        host.open(&path).unwrap();
        let mut core = host
            .0
            .lock()
            .unwrap()
            .as_mut()
            .unwrap()
            .core
            .take()
            .unwrap();

        exchange(json!({"operation":"advance","frames":4800,"muted":false}));
        // Receiver On before the hand-over: the owner holds the move unreached, and hands the Torus over so.
        let on =
            exchange(json!({"operation":"torus-receiver","receiver":{"at_metres":[2.5,0.0,0.3]}}));
        assert_eq!(on["torus_receiver"]["context"], "personal", "{on}");
        let sha256 = exchange(json!({"operation":"torus-native"}))["torus_native"]["sha256"]
            .as_str()
            .unwrap()
            .to_owned();
        let document = field.torus_native(&lease, &sha256).unwrap();
        host.bind_torus(&lease, 0, &sha256, &document, None, None, None, kept)
            .unwrap();
        exchange(
            json!({"operation":"torus-play","keys":[{"row":2,"column":3},{"row":4,"column":1}],"amplitude":[0.3,0]}),
        );
        follow(&host);
        let block = exchange(json!({"operation":"advance","frames":512,"muted":false}));
        assert_eq!(
            parts(&block),
            vec![(4800, 512)],
            "the move handed over unreached is reached over the owner's next block"
        );
        let mut owner = owner_sound(&block, 512);
        follow(&host);
        // Another place, asked while a setting waits 200 samples into the next block: reached over those 200 only.
        exchange(json!({"operation":"torus-receiver","receiver":{"at_metres":[0.0,3.5,-0.2]}}));
        exchange(
            json!({"operation":"torus-set","edit":{"polyphony":3},"at_samples_elapsed":"5512"}),
        );
        let block = exchange(json!({"operation":"advance","frames":512,"muted":false}));
        assert_eq!(parts(&block)[0], (5312, 200), "{}", block["torus_heard"]);
        owner.extend(owner_sound(&block, 512));
        follow(&host);
        // Off: the declared gains, reached over the next block's 512; then nothing more is reached.
        exchange(json!({"operation":"torus-receiver","receiver":null}));
        let block = exchange(json!({"operation":"advance","frames":512,"muted":false}));
        assert_eq!(parts(&block), vec![(5824, 512)]);
        owner.extend(owner_sound(&block, 512));
        follow(&host);
        let block = exchange(json!({"operation":"advance","frames":512,"muted":false}));
        assert!(
            block.get("torus_heard").is_none(),
            "{}",
            block["torus_heard"]
        );
        owner.extend(owner_sound(&block, 512));
        let main = pull(&mut core, 2048);
        same(
            &main,
            &owner,
            "the receiver's moves reached over the owner's samples, in the engine's blocks of 256",
        );
        let reading = host.mixer().unwrap();
        assert!(
            reading["torus_follow"]["heard"].as_u64().unwrap() >= 3,
            "{reading}"
        );
        assert_eq!(reading["torus_follow"]["missed"], 0, "{reading}");
        let (bytes, _) = host
            .0
            .lock()
            .unwrap()
            .as_mut()
            .unwrap()
            .render_wav()
            .unwrap();
        let wav = live_engine::wav::read_wav_f32(&bytes).unwrap();
        assert_eq!(wav.samples.len(), main.len());
        for (n, (e, p)) in wav.samples.iter().zip(&main).enumerate() {
            assert_eq!(
                e.to_bits(),
                p.to_bits(),
                "sample {n}: Export Audio is what was played"
            );
        }
        std::fs::remove_dir_all(dir).unwrap();
    }

    /// O-I #856 end to end (QL-MEF #289 packet N), on QL's real companions: where you stand sets what you hear in the
    /// engine, in each receiving context. A place shared under a reference is heard from that place and answered with
    /// its reference; one's own place is heard from it and never answered; returning to a context resumes it where it
    /// stood; the world's is every voice's declared gain. Each move is reached
    /// in the engine over the owner's next block, Main is the owner's own sound sample for sample, and the kernel
    /// relays every form of the act unchanged. No audio device is opened.
    #[test]
    #[ignore = "requires QL's real companions (OI_QL_BIN, OI_QL_SKY_BIN, OI_QL_FIELD_HOST_BIN, OI_QL_FIELD_WORKER_BIN) and QL_MEF_PREFIX"]
    fn each_receiving_context_is_heard_in_the_engine_from_where_it_stands_and_a_return_resumes_it()
    {
        use crate::live_engine_host::host::LiveEngineHost;
        let client =
            oi_cradle_kernel::CentralClient::with("/nonexistent".into(), None, String::new());
        let field = oi_cradle_kernel::Kernel::new(client).native_field();
        let (tap, tapped) = std::sync::mpsc::channel();
        field.set_torus_tap(tap).unwrap();
        let opened = field
            .apply(Request::Compose {
                request: json!({"texture":[8,8],"units_per_metre":120,"sky":"none"}),
            })
            .unwrap();
        let lease = opened["lease"].as_str().unwrap().to_owned();
        let mut current = opened["receipt"].clone();
        let mut exchange = |command: Value| {
            let id: u64 = current["last_request_id"]
                .as_str()
                .unwrap()
                .parse()
                .unwrap();
            let reply = field
                .apply(Request::Exchange {
                    lease: lease.clone(),
                    request: json!({"schema":"ql.field-host-request/v1",
                        "instance_ref":current["instance_ref"],
                        "event_ref":current["field"]["event_ref"],
                        "subject_ref":current["field"]["subject_ref"],
                        "request_id":(id + 1).to_string(),
                        "expected_generation":current["field"]["generation"],
                        "expected_samples_elapsed":current["field"]["samples_elapsed"],
                        "command":command}),
                })
                .unwrap();
            assert_eq!(reply["status"], "ok", "{reply}");
            current = reply.clone();
            reply
        };
        let kept = |lease: &str, sha256: &str| field.torus_native(lease, sha256);
        let follow = |host: &LiveEngineHost| {
            for told in tapped.try_iter() {
                host.tapped(told, kept);
            }
        };
        let heard = |block: &Value| -> Vec<(u64, u64)> {
            block["torus_heard"]
                .as_array()
                .map(|parts| {
                    parts
                        .iter()
                        .map(|p| {
                            (
                                p["at_samples_elapsed"].as_str().unwrap().parse().unwrap(),
                                p["frames"].as_u64().unwrap(),
                            )
                        })
                        .collect()
                })
                .unwrap_or_default()
        };

        let dir = std::env::temp_dir().join(format!("oi-torus-contexts-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("torus.als");
        let root = live_set::xml::parse(SET).unwrap();
        std::fs::write(&path, live_set::write_gz(&root).unwrap()).unwrap();
        let host = LiveEngineHost::default();
        host.open(&path).unwrap();
        let mut core = host
            .0
            .lock()
            .unwrap()
            .as_mut()
            .unwrap()
            .core
            .take()
            .unwrap();

        exchange(json!({"operation":"advance","frames":4800,"muted":false}));
        let sha256 = exchange(json!({"operation":"torus-native"}))["torus_native"]["sha256"]
            .as_str()
            .unwrap()
            .to_owned();
        let document = field.torus_native(&lease, &sha256).unwrap();
        host.bind_torus(&lease, 0, &sha256, &document, None, None, None, kept)
            .unwrap();
        exchange(
            json!({"operation":"torus-play","keys":[{"row":2,"column":3},{"row":4,"column":1}],"amplitude":[0.3,0]}),
        );
        follow(&host);
        let mut owner = Vec::new();
        let mut at = 4800;
        // each move asked, then the owner's next block: the move is reached in the engine over all of it
        let mut moved = |command: Value| -> Value {
            let answer = exchange(command)["torus_receiver"].clone();
            let block = exchange(json!({"operation":"advance","frames":512,"muted":false}));
            assert_eq!(
                heard(&block),
                vec![(at, 512)],
                "{answer}: {}",
                block["torus_heard"]
            );
            owner.extend(owner_sound(&block, 512));
            follow(&host);
            at += 512;
            answer
        };
        let shared = moved(json!({"operation":"torus-receiver",
            "receiver":{"at_metres":[0.0,3.5,-0.2],"shared":"shared-field:circle-7"}}));
        assert_eq!(shared["context"], "shared", "{shared}");
        assert_eq!(shared["shared"], "shared-field:circle-7");
        assert_eq!(shared["at_metres"], json!([0.0, 3.5, -0.2]));
        let own =
            moved(json!({"operation":"torus-receiver","receiver":{"at_metres":[2.5,0.0,0.3]}}));
        assert_eq!(own["context"], "personal", "{own}");
        assert!(
            own.get("at_metres").is_none() && own.get("shared").is_none(),
            "{own}"
        );
        assert_ne!(
            own["gains"], shared["gains"],
            "where you stand sets what you hear"
        );
        // the body turns by its clock, so a context resumed is heard from where it stood as the body now turns
        let back = moved(json!({"operation":"torus-receiver","context":"shared"}));
        assert_eq!(
            [&back["context"], &back["shared"], &back["at_metres"]],
            [&shared["context"], &shared["shared"], &shared["at_metres"]],
            "the shared context resumed where it stood"
        );
        let back = moved(json!({"operation":"torus-receiver","context":"personal"}));
        assert_eq!(back["context"], "personal", "{back}");
        assert!(
            back.get("at_metres").is_none(),
            "one's own resumed, never answered: {back}"
        );
        let world = moved(json!({"operation":"torus-receiver","context":"world"}));
        assert_eq!(world["context"], "world");
        let main = pull(&mut core, 512 * 5);
        same(
            &main,
            &owner,
            "each context heard in the engine as its owner sounds it",
        );
        let reading = host.mixer().unwrap();
        assert_eq!(reading["torus_follow"]["missed"], 0, "{reading}");
        std::fs::remove_dir_all(dir).unwrap();
    }

    /// The Torus part with a clip (120 bpm, a beat 24000 frames): key 60 at 3000, 62 at 6000 (velocity 80), and 60 with 64
    /// at 12000.
    const CLIPPED: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<Ableton MajorVersion="5"><LiveSet>
  <Tracks>
    <MidiTrack Id="1"><Name><EffectiveName Value="Torus" /></Name>
      <DeviceChain>
        <Mixer><Sends /><Speaker><Manual Value="true" /></Speaker><Pan><Manual Value="0" /></Pan><Volume><Manual Value="1" /></Volume><SoloSink Value="false" /></Mixer>
        <MainSequencer><ClipTimeable><ArrangerAutomation><Events>
          <MidiClip Id="2" Time="0"><CurrentStart Value="0" /><CurrentEnd Value="2" />
            <Loop><LoopStart Value="0" /><LoopEnd Value="2" /><StartRelative Value="0" /><LoopOn Value="false" /></Loop>
            <Notes><KeyTracks>
              <KeyTrack Id="3"><MidiKey Value="60" /><Notes>
                <MidiNoteEvent Time="0.125" Duration="0.125" Velocity="100" IsEnabled="true" />
                <MidiNoteEvent Time="0.5" Duration="0.125" Velocity="100" IsEnabled="true" />
              </Notes></KeyTrack>
              <KeyTrack Id="4"><MidiKey Value="62" /><Notes><MidiNoteEvent Time="0.25" Duration="0.25" Velocity="80" IsEnabled="true" /></Notes></KeyTrack>
              <KeyTrack Id="5"><MidiKey Value="64" /><Notes><MidiNoteEvent Time="0.5" Duration="0.125" Velocity="100" IsEnabled="true" /></Notes></KeyTrack>
            </KeyTracks></Notes>
          </MidiClip>
        </Events></ArrangerAutomation></ClipTimeable></MainSequencer>
        <DeviceChain><Devices /></DeviceChain>
      </DeviceChain>
    </MidiTrack>
  </Tracks>
  <MainTrack><DeviceChain><Mixer><Tempo><Manual Value="120" /></Tempo><Volume><Manual Value="1" /></Volume><Pan><Manual Value="0" /></Pan></Mixer>
    <DeviceChain><Devices /></DeviceChain></DeviceChain></MainTrack>
</LiveSet></Ableton>"#;

    /// O-I #849 round 13, on QL's real companions: the Torus part's clip notes are its owner's. The host hands the owner each
    /// note ahead of the engine, as its key by the pitch→key law at the owner's sample its frame falls on (the frame plays it
    /// there); the owner lands each at that sample and the engine strikes it from the tap where the owner landed it. Main is
    /// the owner's own sound, sample for sample, with the clip's notes in it; a hand-over again while a chord waits on the
    /// owner keeps it, because the owner holds it; Export Audio renders it again. No audio device is opened.
    #[test]
    #[ignore = "requires QL's real companions (OI_QL_BIN, OI_QL_SKY_BIN, OI_QL_FIELD_HOST_BIN, OI_QL_FIELD_WORKER_BIN) and QL_MEF_PREFIX"]
    fn the_torus_parts_clip_notes_sound_as_its_owner_plays_them_at_their_samples() {
        use crate::live_engine_host::host::LiveEngineHost;
        let client =
            oi_cradle_kernel::CentralClient::with("/nonexistent".into(), None, String::new());
        let field = oi_cradle_kernel::Kernel::new(client).native_field();
        let (tap, tapped) = std::sync::mpsc::channel();
        field.set_torus_tap(tap).unwrap();
        let opened = field
            .apply(Request::Compose {
                request: json!({"texture":[8,8],"units_per_metre":120,"sky":"none"}),
            })
            .unwrap();
        let lease = opened["lease"].as_str().unwrap().to_owned();
        let mut current = opened["receipt"].clone();
        let mut exchange = |command: Value| {
            let id: u64 = current["last_request_id"]
                .as_str()
                .unwrap()
                .parse()
                .unwrap();
            let reply = field
                .apply(Request::Exchange {
                    lease: lease.clone(),
                    request: json!({"schema":"ql.field-host-request/v1",
                        "instance_ref":current["instance_ref"],
                        "event_ref":current["field"]["event_ref"],
                        "subject_ref":current["field"]["subject_ref"],
                        "request_id":(id + 1).to_string(),
                        "expected_generation":current["field"]["generation"],
                        "expected_samples_elapsed":current["field"]["samples_elapsed"],
                        "command":command}),
                })
                .unwrap();
            assert_eq!(reply["status"], "ok", "{reply}");
            current = reply.clone();
            reply
        };
        let kept = |lease: &str, sha256: &str| field.torus_native(lease, sha256);
        let follow = |host: &LiveEngineHost| {
            for told in tapped.try_iter() {
                host.tapped(told, kept);
            }
        };
        let dir = std::env::temp_dir().join(format!("oi-torus-clip-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("torus.als");
        let root = live_set::xml::parse(CLIPPED).unwrap();
        std::fs::write(&path, live_set::write_gz(&root).unwrap()).unwrap();
        let host = LiveEngineHost::default();
        host.open(&path).unwrap();
        let mut core = host
            .0
            .lock()
            .unwrap()
            .as_mut()
            .unwrap()
            .core
            .take()
            .unwrap();
        let advance = |frames: usize, exchange: &mut dyn FnMut(Value) -> Value| {
            owner_sound(
                &exchange(json!({"operation":"advance","frames":frames,"muted":false})),
                frames,
            )
        };

        exchange(json!({"operation":"advance","frames":4800,"muted":false}));
        let sha256 = exchange(json!({"operation":"torus-native"}))["torus_native"]["sha256"]
            .as_str()
            .unwrap()
            .to_owned();
        let document = field.torus_native(&lease, &sha256).unwrap();
        let mut notes = [None; 128];
        notes[60] = Some((2u8, 3u16));
        notes[62] = Some((4, 1));
        notes[64] = Some((1, 5));
        host.bind_torus(&lease, 0, &sha256, &document, Some(notes), None, None, kept)
            .unwrap();
        // the engine takes the hand-over at its first block, from the owner's sample 4800
        let mut played = pull(&mut core, 512);
        same(
            &played,
            &advance(512, &mut exchange),
            "before the clip's first note",
        );
        let due = host.torus_notes().unwrap();
        assert_eq!(
            due["acts"],
            json!([
                {"keys":[{"row":2,"column":3}],"amplitude":100.0 / 127.0,"at_samples_elapsed":"7800"},
                {"keys":[{"row":4,"column":1}],"amplitude":80.0 / 127.0,"at_samples_elapsed":"10800"},
                {"keys":[{"row":2,"column":3},{"row":1,"column":5}],"amplitude":100.0 / 127.0,"at_samples_elapsed":"16800"}
            ]),
            "each note ahead of the engine, at the owner's sample its frame falls on"
        );
        play_due(&due, &mut exchange);
        follow(&host);
        const N: usize = 8192;
        let main = pull(&mut core, N);
        same(
            &main,
            &advance(N, &mut exchange),
            "the clip's notes at their samples",
        );
        played.extend(main);
        let due = host.torus_notes().unwrap();
        assert_eq!(due["acts"], json!([]));
        assert_eq!(
            due["releases"],
            json!([{"row":2,"column":3}]),
            "the release the engine reached"
        );
        play_due(&due, &mut exchange);
        // a setting changes the law while the chord waits on the owner: the owner hands the Torus over
        // again with the chord among its waiting acts, and the part takes it
        exchange(json!({"operation":"torus-set","edit":{"tuning":"sky"}}));
        exchange(json!({"operation":"torus-native"}));
        follow(&host);
        let main = pull(&mut core, N);
        same(
            &main,
            &advance(N, &mut exchange),
            "a hand-over again keeps the chord the owner holds",
        );
        played.extend(main);
        let reading = host.mixer().unwrap();
        assert_eq!(reading["torus_follow"]["handed_again"], 1, "{reading}");
        assert_eq!(reading["torus_follow"]["struck"], 3, "{reading}");
        assert_eq!(
            reading["torus_follow"]["notes_to_owner"],
            json!({"handed": 4, "unkeyed": 0, "before_torus": 0}),
            "{reading}"
        );
        // the Torus's effects stand after it on its part (rounds 13 to 15): the frame's Reverb as its own
        // room, from the frame's settings, and its Filter as Live's Auto Filter, built to the frame's Filter
        // from its settings, from the block that takes them. Main is the Torus its owner sounds, through
        // that room and that filter.
        let effects = json!({"chain": ["reverb", "filter"],
            "reverb": {"on": true, "size": 50, "decay": 0.6, "damping": 40, "predelay": 20, "mix": 22},
            "filter": {"on": true, "type": "lowpass", "cutoff": 8000, "resonance": 20, "drive": 0, "mix": 100}});
        let reading = host.torus_effects(&effects).unwrap();
        assert_eq!(
            reading["torus_effects"]["chain"][1]["sounds"], true,
            "{reading}"
        );
        let main = pull(&mut core, N);
        let mut chain = [
            live_engine::rack_device(
                "reverb",
                &[
                    ("size", 50.0),
                    ("decay", 0.6),
                    ("damping", 40.0),
                    ("predelay", 20.0),
                    ("mix", 22.0),
                ],
            )
            .unwrap(),
            live_engine::rack_device(
                "AutoFilter",
                &[
                    ("FilterType", 0.0),
                    ("Cutoff", live_engine::auto_filter_cutoff(8000.0)),
                    ("Resonance", 0.2),
                    ("Drive", 0.0),
                ],
            )
            .unwrap(),
        ];
        for d in &mut chain {
            d.device.prepare(ENGINE_RATE, 2);
        }
        let clock = live_engine::Clock::start(ENGINE_RATE, 120.0);
        let through: Vec<f32> = advance(N, &mut exchange)
            .iter()
            .flat_map(|s| {
                let mut frame = [*s; 2];
                for d in &mut chain {
                    d.device.process(&mut frame, &clock);
                }
                frame
            })
            .collect();
        assert!(through.iter().any(|s| *s != 0.0));
        for (n, (m, t)) in main.iter().zip(&through).enumerate() {
            assert_eq!(
                m.to_bits(),
                t.to_bits(),
                "sample {n}: Main is the Torus its owner sounds, through its reverb and its filter"
            );
        }
        played.extend(main);
        let (bytes, _) = host
            .0
            .lock()
            .unwrap()
            .as_mut()
            .unwrap()
            .render_wav()
            .unwrap();
        let wav = live_engine::wav::read_wav_f32(&bytes).unwrap();
        assert_eq!(wav.samples.len(), played.len());
        for (n, (e, p)) in wav.samples.iter().zip(&played).enumerate() {
            assert_eq!(
                e.to_bits(),
                p.to_bits(),
                "sample {n}: Export Audio is what was played"
            );
        }
        assert_eq!(
            host.mixer().unwrap()["toruses"][0]["counts"],
            json!({"late": 0, "refused": 0, "unrendered": 0}),
            "every act landed at its sample"
        );
        // an act the engine follows after it passed the act's sample lands at once, counted in the reading
        exchange(
            json!({"operation":"torus-play","keys":[{"row":2,"column":3}],"amplitude":[0.3,0]}),
        );
        pull(&mut core, 512);
        follow(&host);
        pull(&mut core, 512);
        let reading = host.mixer().unwrap();
        assert_eq!(
            reading["toruses"][0]["counts"],
            json!({"late": 1, "refused": 0, "unrendered": 0}),
            "{reading}"
        );
        assert_eq!(reading["torus_unplaced"], 0, "{reading}");
        std::fs::remove_dir_all(dir).unwrap();
    }

    /// A fold made a body, as QL's own tests prepare one (crates/ql-mef/tests/torus_native.rs `fold`).
    fn fold(field: &Value) -> Value {
        json!({
            "schema": "ql.form-body-request/v1",
            "event_ref": field["event_ref"], "subject_ref": field["subject_ref"], "source_generation": 7,
            "form": {"kind": "fold", "form_ref": "m3-prime:fold/valley-mountain-valley", "source_ref": "ql.psg-fold-progress/v1:controlled"},
            "samples": {"schema": "ql.psg-form-samples/v1", "prep_ref": "ta-onta:psg:fold-body", "treatment": "sheet-carrier",
                "layers": [{"layer_ref": "form:sheet", "rest_depth_w": 0.5}], "resolution": 12,
                "units": {"extent_units": 2.0, "depth_units": 0.1, "metres_per_unit": 0.25}},
            "crease_deg10": [900, -450, 0],
            "material": {"fibre": "earth", "q_factor": 40.0, "strike_share": 0.7, "source_ref": "declared"},
            "modes": 8, "sample_rate": 48000,
        })
    }

    /// O-I #849 round 12 with #376, on QL's real companions: a form chosen as the body is handed over as that body — the
    /// continuation of its modes as they stand, with no key law, its owner's words for why kept in the reading — and the part
    /// takes it in the torus's place. A touch on the body, landed by the owner, names the body's modes, and the engine strikes
    /// the owner's own impulses on them: Main is the owner's own sound, sample for sample. A MIDI note on the part is the
    /// owner's (round 13): handed over as its key, the owner strikes the form by its exciter law and the engine strikes the
    /// modes the owner names. The torus chosen again is handed over with its law.
    #[test]
    #[ignore = "requires QL's real companions (OI_QL_BIN, OI_QL_SKY_BIN, OI_QL_FIELD_HOST_BIN, OI_QL_FIELD_WORKER_BIN) and QL_MEF_PREFIX"]
    fn a_form_body_sounds_in_the_engine_as_its_owner_rings_it_and_its_keys_are_refused_in_words() {
        use crate::live_engine_host::host::LiveEngineHost;
        let client =
            oi_cradle_kernel::CentralClient::with("/nonexistent".into(), None, String::new());
        let field = oi_cradle_kernel::Kernel::new(client).native_field();
        let (tap, tapped) = std::sync::mpsc::channel();
        field.set_torus_tap(tap).unwrap();
        let opened = field
            .apply(Request::Compose {
                request: json!({"texture":[8,8],"units_per_metre":120,"sky":"none"}),
            })
            .unwrap();
        let lease = opened["lease"].as_str().unwrap().to_owned();
        let mut current = opened["receipt"].clone();
        let mut exchange = |command: Value| {
            let id: u64 = current["last_request_id"]
                .as_str()
                .unwrap()
                .parse()
                .unwrap();
            let reply = field
                .apply(Request::Exchange {
                    lease: lease.clone(),
                    request: json!({"schema":"ql.field-host-request/v1",
                        "instance_ref":current["instance_ref"],
                        "event_ref":current["field"]["event_ref"],
                        "subject_ref":current["field"]["subject_ref"],
                        "request_id":(id + 1).to_string(),
                        "expected_generation":current["field"]["generation"],
                        "expected_samples_elapsed":current["field"]["samples_elapsed"],
                        "command":command}),
                })
                .unwrap();
            assert_eq!(reply["status"], "ok", "{reply}");
            current = reply.clone();
            reply
        };
        let kept = |lease: &str, sha256: &str| field.torus_native(lease, sha256);
        let follow = |host: &LiveEngineHost| {
            for told in tapped.try_iter() {
                host.tapped(told, kept);
            }
        };
        let dir = std::env::temp_dir().join(format!("oi-torus-body-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("torus.als");
        let root = live_set::xml::parse(SET).unwrap();
        std::fs::write(&path, live_set::write_gz(&root).unwrap()).unwrap();
        let host = LiveEngineHost::default();
        host.open(&path).unwrap();
        let mut core = host
            .0
            .lock()
            .unwrap()
            .as_mut()
            .unwrap()
            .core
            .take()
            .unwrap();

        let advanced = exchange(json!({"operation":"advance","frames":960,"muted":false}));
        let sha256 = exchange(json!({"operation":"torus-native"}))["torus_native"]["sha256"]
            .as_str()
            .unwrap()
            .to_owned();
        let document = field.torus_native(&lease, &sha256).unwrap();
        let mut notes = [None; 128];
        notes[60] = Some((2u8, 3u16));
        host.bind_torus(&lease, 0, &sha256, &document, Some(notes), None, None, kept)
            .unwrap();
        follow(&host);
        // the body chosen (the frame hands the Torus over again on it, torusMoved): the part takes the body
        let body = fold(&advanced["field"]);
        exchange(json!({"operation":"torus-body","body":body}));
        let handed = exchange(json!({"operation":"torus-native"}));
        let form = field
            .torus_native(&lease, handed["torus_native"]["sha256"].as_str().unwrap())
            .unwrap();
        assert!(
            form["keys"].is_null(),
            "a form's body is handed over with no key law"
        );
        follow(&host);
        let reading = host.mixer().unwrap();
        assert_eq!(reading["torus_follow"]["handover"], 2, "{reading}");
        let refused = reading["toruses"][0]["keys_refused"]
            .as_str()
            .unwrap_or_default();
        assert!(
            refused.contains("body") && refused.contains("nearest"),
            "the owner's words stand: {reading}"
        );
        // a touch on the body names its modes; the engine strikes the owner's impulses on them
        let touch = exchange(
            json!({"operation":"strike-at","points":[{"theta":0.7,"phi":2.2,"amplitude":[0.3,0.0]}],"at_samples_elapsed":"1500"}),
        );
        assert!(
            touch["strike_at"]["voices"].is_null() && touch["strike_at"]["modes"].is_array(),
            "{touch}"
        );
        follow(&host);
        // a MIDI note on the body is its owner's (the engine holds no key law for it): handed over as
        // its key, the owner strikes the form at its nearest sample, and the engine strikes the modes
        // the owner names
        host.send(
            serde_json::from_value::<EventIn>(
                json!({"kind":"note_on","track":0,"key":60,"velocity":90}),
            )
            .unwrap(),
        )
        .unwrap();
        play_due(&host.torus_notes().unwrap(), &mut exchange);
        follow(&host);
        const N: usize = 4096;
        let mut played = pull(&mut core, N);
        let owner = owner_sound(
            &exchange(json!({"operation":"advance","frames":N,"muted":false})),
            N,
        );
        same(
            &played,
            &owner,
            "the body struck by its owner's touch and a MIDI note",
        );
        let reading = host.mixer().unwrap();
        assert_eq!(reading["torus_follow"]["struck"], 2, "{reading}");
        assert_eq!(
            reading["torus_follow"]["missed"], 0,
            "the body's modes are the ones handed over: {reading}"
        );
        // the torus chosen again is handed over with its law, and the part takes it
        exchange(json!({"operation":"torus-body","body":null}));
        let again = exchange(json!({"operation":"torus-native"}));
        assert_eq!(
            field
                .torus_native(&lease, again["torus_native"]["sha256"].as_str().unwrap())
                .unwrap()["keys"]["contract"],
            TORUS_KEYS
        );
        follow(&host);
        let reading = host.mixer().unwrap();
        assert_eq!(reading["torus_follow"]["handover"], 3, "{reading}");
        assert!(reading["toruses"][0]["keys_refused"].is_null(), "{reading}");
        let main = pull(&mut core, N);
        let owner = owner_sound(
            &exchange(json!({"operation":"advance","frames":N,"muted":false})),
            N,
        );
        same(&main, &owner, "the torus again");
        played.extend(main);
        let (bytes, _) = host
            .0
            .lock()
            .unwrap()
            .as_mut()
            .unwrap()
            .render_wav()
            .unwrap();
        let wav = live_engine::wav::read_wav_f32(&bytes).unwrap();
        assert_eq!(wav.samples.len(), played.len());
        for (n, (e, p)) in wav.samples.iter().zip(&played).enumerate() {
            assert_eq!(
                e.to_bits(),
                p.to_bits(),
                "sample {n}: Export Audio is what was played"
            );
        }
        std::fs::remove_dir_all(dir).unwrap();
    }
}
