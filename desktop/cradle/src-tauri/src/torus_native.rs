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

use crate::live_engine_host::host::Notes;
use live_engine::k8::{
    CoupledClock, K8Carrier, K8Continuation, K8Field, K8Input, K8Instrument, K8KeyLaw, K8KeyVoice,
    K8Mode, K8Pending, K8Sample, PhaseLift,
};
use live_engine::Instrument;
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
    /// strikes the acts its owner lands after that hand-over, at the owner's samples, and a MIDI note on
    /// its part at the key `notes` gives it, by the owner's played-address law. Made again from the same
    /// document, it renders the same samples — what Export Audio renders again.
    pub fn node_handed(
        &self,
        engine_rate: u32,
        handover: u32,
        notes: Option<&Notes>,
    ) -> Result<Box<dyn Instrument>, String> {
        let torus = self.torus(engine_rate)?.handed_over(handover);
        Ok(Box::new(match notes {
            Some(notes) => torus.with_notes(*notes),
            None => torus,
        }))
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
    use crate::live_engine_host::host::{EventIn, Opened, ENGINE_RATE};
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

    /// The end-to-end tests open QL's real companions one at a time: two kernels' fields in one process,
    /// composing in the same microsecond, would name the same lease (`native-expression-{pid}-{stamp}-1`).
    static COMPANIONS: std::sync::Mutex<()> = std::sync::Mutex::new(());

    fn pull(core: &mut EngineCore, frames: usize) -> Vec<f32> {
        let mut out = vec![0f32; frames * 2];
        for block in out.chunks_mut(512) {
            core.pull_block(block);
        }
        out
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
        let _one = COMPANIONS.lock().unwrap_or_else(|e| e.into_inner());
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
        assert_eq!(engine.hand_torus(0, &sha256, &document, None, false), Ok(1));
        let installed = engine.reading();
        assert_eq!(installed["toruses"][0]["sha256"], sha256);
        assert_eq!(installed["toruses"][0]["at_samples_elapsed"], "4800");
        let busy = engine
            .hand_torus(0, &sha256, &document, None, false)
            .unwrap_err();
        assert!(busy.contains("still on its way"), "{busy}");
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
        let _one = COMPANIONS.lock().unwrap_or_else(|e| e.into_inner());
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
            .bind_torus(&lease, 0, &sha256, &document, Some(notes), kept)
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
        // a MIDI note on the part strikes its key by the owner's law, as the owner strikes the key
        // (the owner's own act is set aside here, so the part is not struck twice)
        let midi = |velocity: f32| {
            serde_json::from_value::<EventIn>(
                json!({"kind":"note_on","track":0,"key":60,"velocity":velocity}),
            )
            .unwrap()
        };
        host.send(midi(90.0)).unwrap();
        exchange(
            json!({"operation":"torus-play","keys":[{"row":2,"column":3}],"amplitude":[90.0 / 127.0,0]}),
        );
        assert_eq!(tapped.try_iter().count(), 1);
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
        exchange(
            json!({"operation":"torus-play","keys":[{"row":2,"column":3}],"amplitude":[100.0 / 127.0,0]}),
        );
        assert_eq!(tapped.try_iter().count(), 1);
        let main = pull(&mut core, N);
        let owner = owner_sound(
            &exchange(json!({"operation":"advance","frames":N,"muted":false})),
            N,
        );
        same(&main, &owner, "a MIDI note by the law handed over again");
        played.extend(main);
        let reading = host.mixer().unwrap();
        assert_eq!(reading["torus_follow"]["struck"], 3, "{reading}");
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
    /// the owner's own impulses on them: Main is the owner's own sound, sample for sample. A MIDI note on the part strikes
    /// nothing (the body's exciter law is the owner's alone), and the torus chosen again is handed over with its law.
    #[test]
    #[ignore = "requires QL's real companions (OI_QL_BIN, OI_QL_SKY_BIN, OI_QL_FIELD_HOST_BIN, OI_QL_FIELD_WORKER_BIN) and QL_MEF_PREFIX"]
    fn a_form_body_sounds_in_the_engine_as_its_owner_rings_it_and_its_keys_are_refused_in_words() {
        use crate::live_engine_host::host::LiveEngineHost;
        let _one = COMPANIONS.lock().unwrap_or_else(|e| e.into_inner());
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
        host.bind_torus(&lease, 0, &sha256, &document, Some(notes), kept)
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
        // a MIDI note strikes nothing on the body: it has no key law here
        host.send(
            serde_json::from_value::<EventIn>(
                json!({"kind":"note_on","track":0,"key":60,"velocity":90}),
            )
            .unwrap(),
        )
        .unwrap();
        const N: usize = 4096;
        let mut played = pull(&mut core, N);
        let owner = owner_sound(
            &exchange(json!({"operation":"advance","frames":N,"muted":false})),
            N,
        );
        same(&played, &owner, "the body struck by its owner's touch");
        let reading = host.mixer().unwrap();
        assert_eq!(reading["torus_follow"]["struck"], 1, "{reading}");
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
