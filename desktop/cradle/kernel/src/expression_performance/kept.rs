//! What a Scene keeps of the Torus beside its takes (O-I #852; DLW manual §21.2 "Sounds and instruments";
//! QL-MEF #292: a saved sound persists through the Expression, its Scene and its Edition, never a new store):
//!
//! - a sound: every parameter of the Torus, its body, and its tuning with the sources the tuning was read
//!   from, as they stood — the checkpoint its owner gave (`ql.torus-checkpoint/v1`), sealed by this kernel
//!   from what it relayed under its lease, as a take is (`torus.rs`), under a name;
//! - an instrument: a body made from a form (its owner's `ql.physical-body-preparation/v1`) with the sounds
//!   made on it;
//! - a rack: the Torus with its note devices and effects, its macros and their variations.
//!
//! A sound opens as it was saved: its checkpoint is what the owner restores. If a source its tuning was read
//! from has changed since, it still opens as saved, and says what has moved (`TorusSound::moved`).
use super::torus::{self, value_sha256};
use super::{safe, text, Scalar};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeSet;

pub const SOUND_SCHEMA: &str = "oi.torus-sound/v1";
pub const INSTRUMENT_SCHEMA: &str = "oi.torus-instrument/v1";
pub const RACK_SCHEMA: &str = "oi.torus-rack/v1";
pub const OPENING_SCHEMA: &str = "oi.torus-sound-opening/v1";
pub const BODY_PREPARATION: &str = "ql.physical-body-preparation/v1";
pub const BODY_CONTRACT: &str = "ql.physical-body/v1";
pub const SOUND_LAW: &str = "A sound is the Torus as its owner kept it: every parameter, its body, and its tuning with the sources the tuning was read from, as they stood. It opens as it was saved; when a source has moved since, it still opens as saved and says what moved";
pub const MAX_SOUNDS: usize = 256;
pub const MAX_INSTRUMENTS: usize = 64;
pub const MAX_RACKS: usize = 64;
pub const MAX_RACK_DEVICES: usize = 64;
/// Live's rack: up to sixteen macros, each mapped to parameters of the chain.
pub const MAX_MACROS: usize = 16;
pub const MAX_MACRO_TARGETS: usize = 32;
pub const MAX_VARIATIONS: usize = 128;
const MAX_NAME: usize = 120;

fn name(value: &str, what: &str) -> Result<(), String> {
    if value.trim().is_empty()
        || value.chars().count() > MAX_NAME
        || value.chars().any(char::is_control)
    {
        return Err(format!(
            "A {what} is named in 1 to {MAX_NAME} characters with no control character"
        ));
    }
    Ok(())
}

/// What a sound rings on: the torus, or a form made a body.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case", deny_unknown_fields)]
pub enum SoundBody {
    Torus,
    /// The form's body as its owner prepared it.
    Form {
        prepared: Value,
    },
}
impl SoundBody {
    pub fn validate(&self) -> Result<(), String> {
        let Self::Form { prepared } = self else {
            return Ok(());
        };
        if prepared["schema"] != BODY_PREPARATION || prepared["contract"] != BODY_CONTRACT {
            return Err(format!(
                "A form's body is its owner's {BODY_PREPARATION} ({BODY_CONTRACT})"
            ));
        }
        safe(prepared, 0)?;
        self.preparation_ref()
            .ok_or("A form's body names the preparation it rings")?;
        Ok(())
    }
    /// The body a checkpoint (`ql.torus-checkpoint/v1`) says rang when it was taken: the torus when it keeps no
    /// body, else the form whose preparation it keeps (QL-MEF `torus-body`: `{request, prepared}`).
    pub fn rung_by(checkpoint: &Value) -> Result<Self, String> {
        let kept = match checkpoint.get("body") {
            None | Some(Value::Null) => return Ok(Self::Torus),
            Some(kept) => kept,
        };
        let prepared = kept
            .get("prepared")
            .ok_or("A checkpoint's body keeps the preparation it rang")?;
        let body = Self::Form {
            prepared: prepared.clone(),
        };
        body.validate()?;
        Ok(body)
    }
    /// The exact preparation a form body rings, which a stale body is refused by.
    pub fn preparation_ref(&self) -> Option<&str> {
        match self {
            Self::Torus => None,
            Self::Form { prepared } => prepared["request"]["preparation_ref"].as_str(),
        }
    }
}

/// One source a sound's tuning was read from, as it stood: what it is and the digest of its reading.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct SoundSource {
    pub source: String,
    pub reading: String,
}

/// A source that has moved since a sound was saved.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct SoundMove {
    pub source: String,
    pub saved: String,
    pub now: String,
    pub words: String,
}

/// The sources a checkpoint's tuning is read from, in this order: the event (its sky, its condition, its
/// M3 state), Vimarśā's seed, the shape the voices stand in, and the voices themselves.
const SOURCES: [(&str, &str, &str); 4] = [
    (
        "event",
        "/event",
        "The event the tuning was read from has moved: its sky, its M2 condition or its M3 state",
    ),
    (
        "seeds",
        "/seeds",
        "Vimarśā's seed the voices were read from has moved",
    ),
    (
        "shape",
        "/shape_ref",
        "The shape the voices stand in has moved",
    ),
    (
        "voices",
        "/voices",
        "The voices the tuning sounds have moved",
    ),
];

/// The sources of a checkpoint as it stands.
pub fn sources(checkpoint: &Value) -> Result<Vec<SoundSource>, String> {
    SOURCES
        .iter()
        .map(|(source, path, _)| {
            let value = checkpoint
                .pointer(path)
                .ok_or_else(|| format!("The checkpoint keeps no {source}"))?;
            Ok(SoundSource {
                source: (*source).into(),
                reading: value_sha256(value)?,
            })
        })
        .collect()
}

/// A sound as the kernel sealed it.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct TorusSound {
    pub schema: String,
    /// The sound's own digest: every field below but the seal.
    pub sound_ref: String,
    pub name: String,
    pub sample_rate: u32,
    pub checkpoint: Value,
    pub checkpoint_sha256: String,
    pub body: SoundBody,
    pub sources: Vec<SoundSource>,
    pub law: String,
    /// The kernel's seal over `sound_ref`, under the key it seals takes with.
    pub seal: String,
}
impl TorusSound {
    fn digest(&self) -> Result<String, String> {
        let unsealed = serde_json::to_value((
            &self.schema,
            &self.name,
            self.sample_rate,
            &self.checkpoint,
            &self.checkpoint_sha256,
            &self.body,
            &self.sources,
            &self.law,
        ))
        .map_err(|e| e.to_string())?;
        value_sha256(&unsealed)
    }
    /// Seals a sound from a checkpoint this kernel relayed (the witness hands it over, never a frame).
    pub(super) fn sealed(name: &str, checkpoint: &Value, body: SoundBody) -> Result<Self, String> {
        let (_, rate) = torus::checkpoint_at(checkpoint, "the sound's checkpoint")?;
        if torus::holds_personal_sky(checkpoint) {
            return Err(format!("The Torus stands on your own place's sky, and {}. Set the Sky's Observer to Shared and save the sound again", torus::PERSONAL_SKY_LAW));
        }
        let mut sound = Self {
            schema: SOUND_SCHEMA.into(),
            sound_ref: String::new(),
            name: name.trim().into(),
            sample_rate: rate,
            checkpoint: checkpoint.clone(),
            checkpoint_sha256: value_sha256(checkpoint)?,
            body,
            sources: sources(checkpoint)?,
            law: SOUND_LAW.into(),
            seal: String::new(),
        };
        sound.sound_ref = sound.digest()?;
        sound.seal = torus::seal_with_kernel_key(&sound.sound_ref)?;
        sound.validate()?;
        Ok(sound)
    }
    /// Everything a sound must be, without the seal's key: what a kept sound is checked by on every read.
    pub fn validate(&self) -> Result<(), String> {
        if self.schema != SOUND_SCHEMA || self.law != SOUND_LAW {
            return Err(format!("not a Torus sound ({SOUND_SCHEMA})"));
        }
        name(&self.name, "sound")?;
        let (_, rate) = torus::checkpoint_at(&self.checkpoint, "the sound's checkpoint")?;
        if rate != self.sample_rate {
            return Err("A sound's checkpoint runs at another sample rate".into());
        }
        if value_sha256(&self.checkpoint)? != self.checkpoint_sha256 {
            return Err("A sound's checkpoint is not the one it was saved with".into());
        }
        if sources(&self.checkpoint)? != self.sources {
            return Err("A sound's sources are not its checkpoint's".into());
        }
        self.body.validate()?;
        let rang = SoundBody::rung_by(&self.checkpoint)?;
        if rang != self.body {
            let words = match (&rang, &self.body) {
                (SoundBody::Torus, _) => "its checkpoint rang the torus, not a form",
                (_, SoundBody::Torus) => "its checkpoint rang a form, not the torus",
                _ => "its checkpoint rang another body than the form it names",
            };
            return Err(format!(
                "A sound is kept on the body its checkpoint rang: {words}"
            ));
        }
        if self.digest()? != self.sound_ref {
            return Err("A sound was altered after it was saved".into());
        }
        Ok(())
    }
    pub fn verify_seal(&self) -> Result<(), String> {
        self.validate()?;
        if torus::seal_with_kernel_key(&self.sound_ref)? != self.seal {
            return Err(
                "This sound was sealed by no kernel of this session: save it again from the Torus"
                    .into(),
            );
        }
        Ok(())
    }
    /// What the owner restores to open the sound: its checkpoint, as saved.
    pub fn opening(&self) -> &Value {
        &self.checkpoint
    }
    /// Open the sound against the Torus as its owner stands now (`now`, a checkpoint it gave): the restore
    /// its owner is sent, which is the checkpoint as saved, and what has moved since. A sound that is not
    /// what was kept opens nothing.
    pub fn open(&self, now: &Value) -> Result<SoundOpening, String> {
        self.validate()?;
        Ok(SoundOpening {
            schema: OPENING_SCHEMA.into(),
            sound_ref: self.sound_ref.clone(),
            restore: serde_json::json!({"operation": "torus-restore", "checkpoint": self.checkpoint}),
            moved: self.moved(now)?,
        })
    }
    /// The sources that have moved since the sound was saved, against a checkpoint of the Torus as it
    /// stands now. The sound still opens as saved.
    pub fn moved(&self, now: &Value) -> Result<Vec<SoundMove>, String> {
        let current = sources(now)?;
        Ok(self
            .sources
            .iter()
            .zip(&current)
            .zip(SOURCES)
            .filter(|((saved, now), _)| saved.reading != now.reading)
            .map(|((saved, now), (_, _, words))| SoundMove {
                source: saved.source.clone(),
                saved: saved.reading.clone(),
                now: now.reading.clone(),
                words: words.into(),
            })
            .collect())
    }
}

/// A sound opened: the owner's restore, which is the sound as saved, and what has moved since.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct SoundOpening {
    pub schema: String,
    pub sound_ref: String,
    pub restore: Value,
    pub moved: Vec<SoundMove>,
}

/// A body made from a form, with the sounds made on it.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct KeptInstrument {
    pub schema: String,
    pub instrument_ref: String,
    pub name: String,
    /// The form's body as its owner prepared it.
    pub body: Value,
    /// The sounds made on it, by `sound_ref`, each kept in the same performance.
    pub sounds: Vec<String>,
}

/// One device of a rack's chain, as its device kept its state.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct RackDevice {
    pub device_ref: String,
    /// "note" before the Torus, "effect" after it.
    pub role: String,
    pub state: Value,
}

/// One parameter a macro turns, over its own range.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct MacroTarget {
    /// A device of the chain, or "torus" for the Torus itself.
    pub device_ref: String,
    pub parameter: String,
    pub min: Scalar,
    pub max: Scalar,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct RackMacro {
    pub name: String,
    /// Where the macro stands, 0 to 1.
    pub value: Scalar,
    pub targets: Vec<MacroTarget>,
}

/// A variation: a value for every macro, in macro order.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct RackVariation {
    pub name: String,
    pub values: Vec<Scalar>,
}

/// The Torus with its note devices and effects, its macros and their variations.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct KeptRack {
    pub schema: String,
    pub rack_ref: String,
    pub name: String,
    /// The sound the rack's Torus opens with, kept in the same performance.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sound: Option<String>,
    pub chain: Vec<RackDevice>,
    pub macros: Vec<RackMacro>,
    pub variations: Vec<RackVariation>,
}

fn share(value: Scalar, what: &str) -> Result<(), String> {
    if !(0.0..=1.0).contains(&value.value()) {
        return Err(format!("{what} stands between 0 and 1"));
    }
    Ok(())
}

impl KeptRack {
    pub fn validate(&self) -> Result<(), String> {
        if self.schema != RACK_SCHEMA {
            return Err(format!("not a Torus rack ({RACK_SCHEMA})"));
        }
        text(&self.rack_ref)?;
        name(&self.name, "rack")?;
        if self.chain.len() > MAX_RACK_DEVICES
            || self.macros.len() > MAX_MACROS
            || self.variations.len() > MAX_VARIATIONS
        {
            return Err(format!("A rack holds at most {MAX_RACK_DEVICES} devices, {MAX_MACROS} macros and {MAX_VARIATIONS} variations"));
        }
        let mut devices = BTreeSet::from(["torus"]);
        for device in &self.chain {
            text(&device.device_ref)?;
            if device.role != "note" && device.role != "effect" {
                return Err("A rack's device is a note device or an effect".into());
            }
            safe(&device.state, 0)?;
            if !devices.insert(device.device_ref.as_str()) {
                return Err(format!("The rack holds {} twice", device.device_ref));
            }
        }
        for item in &self.macros {
            name(&item.name, "macro")?;
            share(item.value, "A macro")?;
            if item.targets.len() > MAX_MACRO_TARGETS {
                return Err(format!(
                    "A macro turns at most {MAX_MACRO_TARGETS} parameters"
                ));
            }
            for target in &item.targets {
                text(&target.parameter)?;
                if !devices.contains(target.device_ref.as_str()) {
                    return Err(format!(
                        "Macro {} turns {} of {}, which is not on the rack's chain",
                        item.name, target.parameter, target.device_ref
                    ));
                }
            }
        }
        for variation in &self.variations {
            name(&variation.name, "variation")?;
            if variation.values.len() != self.macros.len() {
                return Err(format!(
                    "Variation {} holds {} values for {} macros: a variation holds one for every macro",
                    variation.name,
                    variation.values.len(),
                    self.macros.len()
                ));
            }
            for value in &variation.values {
                share(*value, "A variation's macro")?;
            }
        }
        Ok(())
    }
}

/// What the Scene's performance keeps of the Torus beside its takes. Bytes without any omit it.
#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct TorusKept {
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub sounds: Vec<TorusSound>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub instruments: Vec<KeptInstrument>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub racks: Vec<KeptRack>,
}
impl TorusKept {
    pub fn is_empty(&self) -> bool {
        self.sounds.is_empty() && self.instruments.is_empty() && self.racks.is_empty()
    }
    pub fn sound(&self, sound_ref: &str) -> Option<&TorusSound> {
        self.sounds
            .iter()
            .find(|sound| sound.sound_ref == sound_ref)
    }
    pub fn validate(&self, sample_rate: u32) -> Result<(), String> {
        if self.sounds.len() > MAX_SOUNDS
            || self.instruments.len() > MAX_INSTRUMENTS
            || self.racks.len() > MAX_RACKS
        {
            return Err(format!("A performance keeps at most {MAX_SOUNDS} sounds, {MAX_INSTRUMENTS} instruments and {MAX_RACKS} racks"));
        }
        let mut refs = BTreeSet::new();
        for sound in &self.sounds {
            sound.validate()?;
            if sound.sample_rate != sample_rate {
                return Err(format!(
                    "Sound {} was saved at {} Hz and the performance runs at {sample_rate} Hz",
                    sound.name, sound.sample_rate
                ));
            }
            if !refs.insert(sound.sound_ref.as_str()) {
                return Err(format!("Sound {} is kept twice", sound.name));
            }
        }
        let mut names = BTreeSet::new();
        for instrument in &self.instruments {
            if instrument.schema != INSTRUMENT_SCHEMA {
                return Err(format!("not a Torus instrument ({INSTRUMENT_SCHEMA})"));
            }
            text(&instrument.instrument_ref)?;
            name(&instrument.name, "instrument")?;
            if !names.insert(instrument.instrument_ref.as_str()) {
                return Err(format!("Instrument {} is kept twice", instrument.name));
            }
            let body = SoundBody::Form {
                prepared: instrument.body.clone(),
            };
            body.validate()
                .map_err(|e| format!("Instrument {}: {e}", instrument.name))?;
            for sound_ref in &instrument.sounds {
                let sound = self.sound(sound_ref).ok_or_else(|| {
                    format!(
                        "Instrument {} names a sound this performance does not keep",
                        instrument.name
                    )
                })?;
                if sound.body.preparation_ref() != body.preparation_ref() {
                    return Err(format!(
                        "Sound {} was made on another body than instrument {}",
                        sound.name, instrument.name
                    ));
                }
            }
        }
        let mut racks = BTreeSet::new();
        for rack in &self.racks {
            rack.validate()?;
            if !racks.insert(rack.rack_ref.as_str()) {
                return Err(format!("Rack {} is kept twice", rack.name));
            }
            if let Some(sound) = &rack.sound {
                self.sound(sound).ok_or_else(|| {
                    format!(
                        "Rack {} opens a sound this performance does not keep",
                        rack.name
                    )
                })?;
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::super::torus::tests::checkpoint;
    use super::*;
    use serde_json::json;

    fn prepared(preparation: &str) -> Value {
        json!({"schema":BODY_PREPARATION,"contract":BODY_CONTRACT,"event_ref":"event:e","subject_ref":"person:p",
            "source_generation":7,"request":{"preparation_ref":preparation,"state_ref":"ql:form-body-state:s",
            "body_revision":"ql.form-body-creased-lattice/v1","geometry":{},"material":{},"exciter":{},
            "pickup":{},"sample_rate":48000},"form":{"kind":"fold","form_ref":"m3-prime:fold/vmv",
            "source_ref":"fold"},"clock":{},"units":{}})
    }

    #[test]
    fn a_sound_keeps_its_checkpoint_body_and_sources_and_opens_as_saved() {
        let kept = checkpoint(4800);
        let sound = TorusSound::sealed("  Warm Logic ", &kept, SoundBody::Torus).unwrap();
        assert_eq!(sound.name, "Warm Logic");
        assert_eq!(sound.opening(), &kept, "a sound opens as it was saved");
        assert_eq!(
            sound
                .sources
                .iter()
                .map(|s| s.source.as_str())
                .collect::<Vec<_>>(),
            ["event", "seeds", "shape", "voices"]
        );
        sound.verify_seal().unwrap();
        // Saved, closed and reopened: the performance's bytes read back as the same sound.
        let text = serde_json::to_string(&sound).unwrap();
        let reopened: TorusSound = serde_json::from_str(&text).unwrap();
        assert_eq!(reopened, sound);
        reopened.verify_seal().unwrap();
        assert!(
            reopened.moved(&kept).unwrap().is_empty(),
            "nothing has moved"
        );
    }

    #[test]
    fn a_sound_whose_source_moved_opens_as_saved_and_says_what_moved() {
        let kept = checkpoint(4800);
        let sound = TorusSound::sealed("Sky voice", &kept, SoundBody::Torus).unwrap();
        let mut now = checkpoint(9600);
        now["seeds"] = json!({"tick12": 8});
        now["event"]["m2"] = json!({"sky":"2026-11-04"});
        // Parameters the sound sets itself are not sources: a new tuning or damping moves nothing.
        now["session"]["settings"]["tuning"] = json!("sky");
        now["damping_per_second"] = json!(0.25);
        let moved = sound.moved(&now).unwrap();
        assert_eq!(
            moved.iter().map(|m| m.source.as_str()).collect::<Vec<_>>(),
            ["event", "seeds"]
        );
        assert!(moved[0].words.contains("sky"), "{}", moved[0].words);
        assert_ne!(moved[1].saved, moved[1].now);
        assert_eq!(sound.opening(), &kept, "it still opens as saved");
    }

    /// A saved sound carries no personal data (O-I #856; DLW §21.2 Rules, §22.1 Rules; QL-MEF #289 packet N): the Torus standing on
    /// your own place's sky saves no sound, in words that name nothing of the place, wherever in its event the sky is kept; on the
    /// world's sky it saves one, with the sky its tuning was read from.
    #[test]
    fn a_sound_on_your_own_places_sky_is_refused_and_one_on_the_worlds_sky_is_kept() {
        use super::super::torus::tests::{on_sky, your_place};
        let worlds =
            TorusSound::sealed("World's sky", &on_sky(4800, None), SoundBody::Torus).unwrap();
        assert!(serde_json::to_string(&worlds)
            .unwrap()
            .contains("shared-geocentric"));
        let mine = on_sky(4800, Some(your_place()));
        let mut within = on_sky(4800, None);
        within["event"]["source_receipts"] = json!([{"schema":"ql.sky-m2-event/v1","scope":"observer-private",
            "sky":mine["event"]["source_receipts"][0].clone()}]);
        let mut unscoped = on_sky(4800, None);
        unscoped["event"]["source_receipts"][0]["request"]["observer"] = your_place();
        for (kept, case) in [
            (mine, "on the event"),
            (within, "within a receipt"),
            (unscoped, "named by its request"),
        ] {
            let refused = TorusSound::sealed("Mine", &kept, SoundBody::Torus).unwrap_err();
            assert!(
                refused.contains("your own place's sky"),
                "{case}: {refused}"
            );
            assert!(refused.contains("Observer to Shared"), "{case}: {refused}");
            for place in ["made-up-home", "41.875", "12.5"] {
                assert!(!refused.contains(place), "{case}: {place} in {refused}");
            }
        }
    }

    #[test]
    fn a_sound_altered_or_sealed_by_no_kernel_is_refused() {
        let sound = TorusSound::sealed("A", &checkpoint(0), SoundBody::Torus).unwrap();
        let mut renamed = sound.clone();
        renamed.name = "B".into();
        assert!(renamed.validate().unwrap_err().contains("altered"));
        let mut forged = sound.clone();
        forged.seal = "hmac-sha256:00".into();
        assert!(forged.verify_seal().unwrap_err().contains("no kernel"));
        let mut moved = sound.clone();
        moved.checkpoint["seeds"] = json!({"tick12": 1});
        assert!(moved.validate().is_err());
        assert!(TorusSound::sealed("", &checkpoint(0), SoundBody::Torus)
            .unwrap_err()
            .contains("named"));
        assert!(TorusSound::sealed("A", &json!({"schema":"other"}), SoundBody::Torus).is_err());
        let bad = SoundBody::Form {
            prepared: json!({"schema":"x"}),
        };
        assert!(TorusSound::sealed("A", &checkpoint(0), bad).is_err());
    }

    /// A checkpoint taken while the form `prepared` rang: QL keeps the body as its request and its preparation.
    fn rung(at: u64, prepared: &Value) -> Value {
        let mut kept = checkpoint(at);
        kept["body"] = json!({"request":{"schema":"ql.form-body-request/v1"},"prepared":prepared});
        kept
    }

    #[test]
    fn a_sound_rings_the_body_its_checkpoint_kept_and_no_other() {
        let body = prepared("ql:form-body:fold");
        let form = SoundBody::Form {
            prepared: body.clone(),
        };
        // What rang is read from the checkpoint: the torus when it keeps no body, else the form it keeps.
        assert_eq!(
            SoundBody::rung_by(&checkpoint(0)).unwrap(),
            SoundBody::Torus
        );
        assert_eq!(SoundBody::rung_by(&rung(0, &body)).unwrap(), form);
        let mut odd = rung(0, &body);
        odd["body"] = json!({"request":{}});
        assert!(SoundBody::rung_by(&odd)
            .unwrap_err()
            .contains("preparation"));
        odd["body"]["prepared"] = json!({"schema":"x"});
        assert!(SoundBody::rung_by(&odd).is_err());
        // A sound says the body it rang on: one its checkpoint did not ring is refused in words.
        let sealed = TorusSound::sealed("Fold", &rung(0, &body), form.clone()).unwrap();
        assert_eq!(sealed.body, form);
        assert!(TorusSound::sealed("Fold", &checkpoint(0), form.clone())
            .unwrap_err()
            .contains("rang the torus"));
        assert!(
            TorusSound::sealed("Torus", &rung(0, &body), SoundBody::Torus)
                .unwrap_err()
                .contains("rang a form")
        );
        let other = SoundBody::Form {
            prepared: prepared("ql:form-body:another"),
        };
        assert!(TorusSound::sealed("Other", &rung(0, &body), other)
            .unwrap_err()
            .contains("another body"));
        // A form sound whose checkpoint keeps no body opens nothing, even with its digests made good.
        let mut bodiless = sealed.clone();
        bodiless.checkpoint.as_object_mut().unwrap().remove("body");
        bodiless.checkpoint_sha256 = value_sha256(&bodiless.checkpoint).unwrap();
        bodiless.sources = sources(&bodiless.checkpoint).unwrap();
        bodiless.sound_ref = bodiless.digest().unwrap();
        let refused = bodiless.open(&checkpoint(0)).unwrap_err();
        assert!(refused.contains("rang the torus"), "{refused}");
        sealed.open(&checkpoint(0)).unwrap();
    }

    #[test]
    fn an_instrument_is_a_form_body_with_the_sounds_made_on_it() {
        let body = prepared("ql:form-body:fold");
        let on_fold = TorusSound::sealed(
            "Fold struck",
            &rung(0, &body),
            SoundBody::Form {
                prepared: body.clone(),
            },
        )
        .unwrap();
        let on_torus = TorusSound::sealed("Torus", &checkpoint(48), SoundBody::Torus).unwrap();
        let instrument = KeptInstrument {
            schema: INSTRUMENT_SCHEMA.into(),
            instrument_ref: "instrument:fold".into(),
            name: "Fold".into(),
            body: body.clone(),
            sounds: vec![on_fold.sound_ref.clone()],
        };
        let mut kept = TorusKept {
            sounds: vec![on_fold.clone(), on_torus.clone()],
            instruments: vec![instrument.clone()],
            racks: vec![],
        };
        kept.validate(48000).unwrap();
        let text = serde_json::to_string(&kept).unwrap();
        assert_eq!(serde_json::from_str::<TorusKept>(&text).unwrap(), kept);
        // A sound made on another body is not the instrument's.
        kept.instruments[0].sounds.push(on_torus.sound_ref.clone());
        assert!(kept.validate(48000).unwrap_err().contains("another body"));
        kept.instruments[0].sounds = vec!["sha256:none".into()];
        assert!(kept.validate(48000).unwrap_err().contains("does not keep"));
        kept.instruments[0].sounds.clear();
        kept.instruments[0].body = json!({"schema":"ql.torus-checkpoint/v1"});
        assert!(
            kept.validate(48000).is_err(),
            "an instrument's body is a form's"
        );
        assert!(TorusKept {
            sounds: vec![on_torus],
            ..Default::default()
        }
        .validate(44100)
        .unwrap_err()
        .contains("44100"));
    }

    fn scalar(value: f64) -> Scalar {
        Scalar::new(value).unwrap()
    }

    pub(crate) fn rack(sound: Option<String>) -> KeptRack {
        KeptRack {
            schema: RACK_SCHEMA.into(),
            rack_ref: "rack:torus/1".into(),
            name: "Breath rack".into(),
            sound,
            chain: vec![
                RackDevice {
                    device_ref: "arp".into(),
                    role: "note".into(),
                    state: json!({"rate":"1/8"}),
                },
                RackDevice {
                    device_ref: "echo".into(),
                    role: "effect".into(),
                    state: json!({"feedback":0.4}),
                },
            ],
            macros: vec![
                RackMacro {
                    name: "Ring".into(),
                    value: scalar(0.25),
                    targets: vec![MacroTarget {
                        device_ref: "torus".into(),
                        parameter: "damping".into(),
                        min: scalar(0.1),
                        max: scalar(40.0),
                    }],
                },
                RackMacro {
                    name: "Space".into(),
                    value: scalar(0.5),
                    targets: vec![MacroTarget {
                        device_ref: "echo".into(),
                        parameter: "feedback".into(),
                        min: scalar(0.0),
                        max: scalar(0.9),
                    }],
                },
            ],
            variations: vec![
                RackVariation {
                    name: "Dry".into(),
                    values: vec![scalar(0.1), scalar(0.0)],
                },
                RackVariation {
                    name: "Bloom".into(),
                    values: vec![scalar(0.9), scalar(0.8)],
                },
            ],
        }
    }

    #[test]
    fn a_rack_with_macros_and_variations_keeps_and_reads_back_whole() {
        let sound = TorusSound::sealed("Base", &checkpoint(0), SoundBody::Torus).unwrap();
        let kept = TorusKept {
            sounds: vec![sound.clone()],
            instruments: vec![],
            racks: vec![rack(Some(sound.sound_ref.clone()))],
        };
        kept.validate(48000).unwrap();
        let text = serde_json::to_string(&kept).unwrap();
        let reopened: TorusKept = serde_json::from_str(&text).unwrap();
        assert_eq!(reopened, kept);
        assert_eq!(reopened.racks[0].variations[1].values[0].value(), 0.9);
        let mut short = rack(None);
        short.variations[0].values.pop();
        assert!(short
            .validate()
            .unwrap_err()
            .contains("one for every macro"));
        let mut stray = rack(None);
        stray.macros[0].targets[0].device_ref = "reverb".into();
        assert!(stray
            .validate()
            .unwrap_err()
            .contains("not on the rack's chain"));
        let mut over = rack(None);
        over.macros[1].value = scalar(1.5);
        assert!(over.validate().is_err());
        let orphan = TorusKept {
            racks: vec![rack(Some("sha256:gone".into()))],
            ..Default::default()
        };
        assert!(orphan
            .validate(48000)
            .unwrap_err()
            .contains("does not keep"));
    }

    /// The edit the Expressions boundary writes to keep an instrument
    /// (packages/expressions-boundary/src/performanceBasis.ts
    /// `keepInstrumentChange`, O-I #852) is this performance's own
    /// operation, field for field; a key it does not hold is refused.
    #[test]
    fn the_boundary_keeps_an_instrument_by_the_performance_own_operation() {
        let body = prepared("ql:form-body:fold");
        let wire = json!({"operation":"keep_torus_instrument","instrument":{"schema":INSTRUMENT_SCHEMA,
            "instrument_ref":"instrument:ql:form-body:fold","name":"Folded sheet","body":body,"sounds":["sha256:a"]}});
        let operation: super::super::PerformanceOperation =
            serde_json::from_value(wire.clone()).unwrap();
        let super::super::PerformanceOperation::KeepTorusInstrument { instrument } = operation
        else {
            panic!("the boundary's edit is the instrument keep");
        };
        assert_eq!(instrument.instrument_ref, "instrument:ql:form-body:fold");
        assert_eq!(instrument.body, body);
        assert_eq!(instrument.sounds, vec!["sha256:a".to_string()]);
        let mut extra = wire;
        extra["instrument"]["kind"] = json!("form");
        assert!(serde_json::from_value::<super::super::PerformanceOperation>(extra).is_err());
    }

    /// The full edit (DLW build ruling, 4 November: "a kernel test runs the full edit, keeping a rack and an
    /// instrument with sealed sounds, not only the wire shape"): an Expression's Scene keeps two sounds this
    /// kernel sealed, an instrument and a rack through the kernel's own `scene_performance_edit`, each
    /// operation exactly as the Expressions boundary writes it (performanceBasis.ts keepSoundChange,
    /// keepInstrumentChange, keepRackChange). The document reads them back whole with each macro's range,
    /// a rack kept again by its ref replaces it, and a rack the kernel refuses leaves the Scene as it stood.
    #[test]
    fn a_scene_keeps_sealed_sounds_an_instrument_and_a_rack_by_the_full_edit() {
        use crate::expression::Application;
        let client = crate::CentralClient::with("/nonexistent/oi".into(), None, String::new());
        let mut app = Application::default();
        let decode = |v: Value| serde_json::from_value::<crate::expression::Request>(v).unwrap();
        app.apply(&client, decode(json!({"operation":"create","expression_ref":"expression:kept","title":"Kept","actor":"human:test"})))
            .unwrap();
        let edit = |revision: u64, operations: Value| {
            decode(
                json!({"operation":"edit","expression_ref":"expression:kept","expected_revision":revision,"actor":"human:test",
                "changes":[{"change":"scene_performance_edit","scene_ref":"expression:kept:scene:main","operations":operations}]}),
            )
        };
        let revision = |app: &Application| app.document("expression:kept").unwrap().revision;
        let performance = |app: &Application| {
            app.document("expression:kept").unwrap().scenes[0]
                .performance
                .clone()
                .unwrap()
        };

        let body = prepared("ql:form-body:fold");
        let on_torus = TorusSound::sealed("Breath rack", &checkpoint(0), SoundBody::Torus).unwrap();
        let on_fold = TorusSound::sealed(
            "Fold struck",
            &rung(48, &body),
            SoundBody::Form {
                prepared: body.clone(),
            },
        )
        .unwrap();
        let instrument = json!({"schema":INSTRUMENT_SCHEMA,"instrument_ref":"instrument:ql:form-body:fold",
            "name":"Folded sheet","body":body,"sounds":[on_fold.sound_ref]});
        let rack = |variation: f64, sound: &str, turns: &str| {
            json!({"schema":RACK_SCHEMA,"rack_ref":"rack:torus/Breath rack","name":"Breath rack","sound":sound,
                "chain":[{"device_ref":"delay","role":"effect","state":{"on":true,"time":375,"feedback":40,"mix":25}}],
                "macros":[{"name":"Rate","value":0.25,"targets":[{"device_ref":"torus","parameter":"rate","min":0.5,"max":20}]},
                    {"name":"Space","value":0.5,"targets":[{"device_ref":turns,"parameter":"feedback","min":0,"max":90}]}],
                "variations":[{"name":"Variation 1","values":[0.25,0.5]},{"name":"Variation 2","values":[variation,0]}]})
        };
        app.apply(
            &client,
            edit(
                revision(&app),
                json!([{"operation":"keep_torus_sound","sound":on_torus},
                    {"operation":"keep_torus_sound","sound":on_fold},
                    {"operation":"keep_torus_instrument","instrument":instrument},
                    {"operation":"keep_torus_rack","rack":rack(1.0, &on_torus.sound_ref, "delay")}]),
            ),
        )
        .unwrap();
        let kept = performance(&app);
        kept.validate().unwrap();
        let held = &kept.torus_kept;
        assert_eq!(
            held.sounds
                .iter()
                .map(|sound| sound.sound_ref.as_str())
                .collect::<Vec<_>>(),
            vec![on_torus.sound_ref.as_str(), on_fold.sound_ref.as_str()]
        );
        held.sounds[0].verify_seal().unwrap();
        assert_eq!(held.instruments[0].sounds, vec![on_fold.sound_ref.clone()]);
        let breath = &held.racks[0];
        assert_eq!(breath.sound.as_deref(), Some(on_torus.sound_ref.as_str()));
        assert_eq!(breath.chain[0].device_ref, "delay");
        let ranges: Vec<(f64, f64)> = breath
            .macros
            .iter()
            .map(|item| (item.targets[0].min.value(), item.targets[0].max.value()))
            .collect();
        assert_eq!(ranges, vec![(0.5, 20.0), (0.0, 90.0)]);
        assert_eq!(breath.variations[1].values[0].value(), 1.0);
        // The kept performance reads back whole from its bytes.
        let bytes = serde_json::to_string(&kept).unwrap();
        assert_eq!(
            serde_json::from_str::<super::super::Performance>(&bytes).unwrap(),
            kept
        );

        // Kept again by its ref, the rack is replaced, not added.
        app.apply(
            &client,
            edit(
                revision(&app),
                json!([{"operation":"keep_torus_rack","rack":rack(0.75, &on_torus.sound_ref, "delay")}]),
            ),
        )
        .unwrap();
        let replaced = performance(&app).torus_kept;
        assert_eq!(replaced.racks.len(), 1);
        assert_eq!(replaced.racks[0].variations[1].values[0].value(), 0.75);

        // A rack the kernel refuses changes nothing: a macro off its chain, a sound the Scene does not keep.
        let before = revision(&app);
        let off = app
            .apply(
                &client,
                edit(before, json!([{"operation":"keep_torus_rack","rack":rack(0.5, &on_torus.sound_ref, "echo")}])),
            )
            .unwrap_err();
        assert!(off.contains("not on the rack's chain"), "{off}");
        let orphan = app
            .apply(
                &client,
                edit(before, json!([{"operation":"keep_torus_rack","rack":rack(0.5, "sha256:gone", "delay")}])),
            )
            .unwrap_err();
        assert!(orphan.contains("does not keep"), "{orphan}");
        assert_eq!(revision(&app), before);
        assert_eq!(performance(&app).torus_kept, replaced);
    }
}
