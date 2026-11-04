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
use live_engine::Instrument;
use serde_json::Value;
use std::str::FromStr;

pub const TORUS_NATIVE: &str = "ql.torus-native/v1";
const CONTINUOUS_HANDOVER: &str = "ql.continuous-handover/v1";
const TORUS_KEYS: &str = "ql.torus-keys/v1";

/// A Torus as its owner handed it over: the sample it stood at, the continuation and the law.
#[derive(Debug, Clone, PartialEq)]
pub struct Handed {
    pub at_samples_elapsed: u64,
    pub continuation: K8Continuation,
    pub law: K8KeyLaw,
}

impl Handed {
    /// The Torus node made from what was handed over (off the audio thread: it allocates), at the
    /// engine's rate or refused: the engine resamples nothing. Made again from the same document, it
    /// renders the same samples — what Export Audio renders again.
    pub fn node(&self, engine_rate: u32) -> Result<Box<dyn Instrument>, String> {
        let rate = self.continuation.input.sample_rate;
        if rate != engine_rate {
            return Err(format!(
                "The Torus was handed over at {rate} Hz and the engine plays at {engine_rate} Hz: it resamples nothing"
            ));
        }
        let mut field = K8Field::continue_from(&self.continuation)?;
        field.set_law(&self.law)?;
        Ok(Box::new(K8Instrument::new(field)))
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
    let law = law(
        at(document, "keys", "keys")?,
        continuation.input.modes.len(),
    )?;
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
    if law.sample_rate != continuation.input.sample_rate {
        return Err("The handed-over Torus's keys are at another rate than its field".into());
    }
    Ok(Handed {
        at_samples_elapsed,
        continuation,
        law,
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
        assert!(!handed.law.voices.is_empty());

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
        let installed = engine.install_torus(0, &sha256, &document).unwrap();
        assert_eq!(installed["toruses"][0]["sha256"], sha256);
        assert_eq!(installed["toruses"][0]["at_samples_elapsed"], "4800");
        let busy = engine.install_torus(0, &sha256, &document).unwrap_err();
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
        assert_eq!(ENGINE_RATE, handed.law.sample_rate);
        std::fs::remove_dir_all(dir).unwrap();
    }
}
