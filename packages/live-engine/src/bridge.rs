//! Document → graph bridging: a `live_set` summary becomes a renderable
//! [`Graph`].
//!
//! KNOWN devices instantiate their documented models (`GlueCompressor` →
//! `devices::GlueDevice`, `devices/glue-compressor.md`; `Echo` →
//! `devices::EchoDevice`, `devices/echo.md`; `Reverb` →
//! `devices::ReverbDevice`; `Compressor2` → `devices::CompressorDevice`).
//! From a summary (element names only) each stands at the factory-preset
//! stored values cited at their construction below; from the document
//! (`bridge_set`, O-I #849 round 15) each stands at the settings the set
//! stores for it, a device stored off passes its sound through as Live's
//! does, and what the set stores that a model does not take is named in a
//! warning. UNKNOWN device element names instantiate `BypassDevice` and
//! produce a warning. Samples are not read here: `bridge_set` names the
//! sample each arrangement audio clip wants ([`ClipSample`]) and the host
//! lays them with [`lay_samples`], unwarped clips first (warp playback is M5
//! territory).

use crate::devices::{
    AudioEffectRack, BypassDevice, CompressorDevice, DelayDevice, DelayParams, DynamicsDevice,
    DynamicsParams, EchoDevice, EchoParams, FilterDevice, FilterKind, FilterParams, GlueDevice,
    RackChain, ReverbDevice, RoomDevice, RoomParams, UtilityChannels, UtilityDevice,
};
use crate::engine::Part;
use crate::graph::{Clock, Graph, GroupTrack, Note, RackDevice, ReturnTrack, Track, MAX_GROUPS};
use crate::instruments::OperatorInstrument;
use live_dynamics::glue::GlueParams;
use live_dynamics::reverb::ReverbParams;
use live_set::model::{SetSummary, TrackKind};
use live_set::xml::Element;

/// One device the bridge could not model.
#[derive(Debug, Clone, PartialEq)]
pub struct BridgeWarning {
    pub track: String,
    /// Document element name of the device.
    pub device: String,
    pub message: String,
}

/// The bridged graph plus everything the bridge wants on record.
#[derive(Debug)]
pub struct BridgeResult {
    pub graph: Graph,
    pub warnings: Vec<BridgeWarning>,
    /// The sample each arrangement audio clip it plays wants laid ([`bridge_set`]): the host reads
    /// and lays them ([`lay_samples`]). Empty from a summary.
    pub samples: Vec<ClipSample>,
}

/// One arrangement audio clip of a part as the set stores it (`MainSequencer/Sample/ArrangerAutomation/
/// Events/AudioClip`, session-model.md §3 and §5), on the engine's timeline: the sample it plays, where
/// it sounds and from where in its sample, ready to be laid ([`lay_samples`], DLW build ruling 2026-11-05:
/// "one sample-playback source in live-engine. It is a decoded buffer laid at its clip's beats, unwarped
/// first").
#[derive(Debug, Clone, PartialEq)]
pub struct ClipSample {
    /// The part, by its index among the graph's tracks.
    pub track: usize,
    /// The clip's name, for the words.
    pub clip: String,
    /// `SampleRef/FileRef/RelativePath`, where the set stores one: read from the set's folder.
    pub relative: Option<String>,
    /// `SampleRef/FileRef/Path`, where the set stores one: the file where it stood when the set was saved.
    pub path: Option<String>,
    /// The frame it sounds from (its `Time`, in beats on the clock).
    pub at: u64,
    /// The frames it sounds for (`CurrentEnd − CurrentStart` beats).
    pub frames: u64,
    /// Where in its sample it plays from, in seconds (`Loop/LoopStart`: an unwarped clip keeps its markers
    /// in seconds, live-set `marker_scale`).
    pub from_seconds: f64,
    /// Its clip gain, linear (`SampleVolume`).
    pub gain: f32,
}

// devices/glue-compressor.md, "Preset stored values (unpinned)":
// Threshold −40, Range 3, Makeup 0 (ballistics pins live in the
// device's smoother defaults).
const GLUE_FACTORY: GlueParams = GlueParams {
    threshold_db: -40.0,
    range: 3.0,
    ratio: 1.0,
    makeup_db: 0.0,
};

// devices/echo.md E1 stored state (factory preset "Time Travel
// Echo", evidence/devices/Echo/preset-time-travel.xml): Delay_Time
// 0.1249999925 (stored unit = seconds; the synced-division mapping
// is not modeled — backlog), Feedback 0.5, DryWet 0.5873016119.
const ECHO_FACTORY: EchoParams = EchoParams {
    delay_time_s: 0.1249999925,
    feedback: 0.5,
    dry_wet: 0.5873016119,
};

// Reverb default-preset stored state (evidence/devices/Reverb/
// default.xml Manual: DecayTime 1200.00012 ms; the state carries
// no global DryWet element — the direct level is MixDirect 0.55,
// folded into the model's fitted constants — so the engine mix is
// the model response, 1.0).
const REVERB_FACTORY_DECAY_MS: f64 = 1200.00012;

/// Live's Reverb as the engine convolves it: by partitions (O-I #849 round 14), since a set's part may
/// sound every sample, and the scatter runs at 1.76 of real time on one at 2.4 s.
fn reverb_of(decay_ms: f64) -> Box<dyn crate::graph::Device> {
    Box::new(ReverbDevice::partitioned(ReverbParams { decay_ms }, 1.0))
}

/// The KNOWN devices of the engine: each instantiated at its
/// factory-preset stored values, cited from the measuring document.
fn known_device(element_name: &str) -> Option<Box<dyn crate::graph::Device>> {
    match element_name {
        "GlueCompressor" => Some(Box::new(GlueDevice::new(GLUE_FACTORY))),
        "Echo" => Some(Box::new(EchoDevice::new(ECHO_FACTORY))),
        "Reverb" => Some(reverb_of(REVERB_FACTORY_DECAY_MS)),
        // Live's Compressor (element Compressor2) at the corpus's stored
        // values, as a rack's chain has it (`rack_device`): never bypassed.
        "Compressor2" => Some(Box::new(CompressorDevice::new(
            live_dynamics::compressor::DEFAULTS,
        ))),
        _ => None,
    }
}

/// A setting of a device element as the set stores it (session-model.md §6: `<Id><Manual Value="…" /></Id>`; a setting
/// inside another element by its path, `SideChain/OnOff`): a number, a switch 1 for on and 0 for off. None where the
/// set stores none, or none a number.
fn stored(el: &Element, id: &str) -> Option<f64> {
    let mut at = el;
    for part in id.split('/') {
        at = at.child(part)?;
    }
    match manual(Some(at))? {
        "true" => Some(1.0),
        "false" => Some(0.0),
        v => v.parse().ok(),
    }
}

/// What the set stores for one device the engine models, as its model takes it (O-I #849 round 15): each setting
/// taken where the set stores it within the extent the corpus's surface gives it (live-dynamics `params::table`), and
/// what is not taken kept for the warnings.
struct Stored<'a> {
    el: &'a Element,
    taken: Vec<&'static str>,
    strays: Vec<String>,
}

impl<'a> Stored<'a> {
    fn of(el: &'a Element) -> Stored<'a> {
        Stored {
            el,
            taken: Vec::new(),
            strays: Vec::new(),
        }
    }

    /// The set's `id`, taken where it stands within the surface's extent; a value outside it is a stray and leaves
    /// the model's own.
    fn take(&mut self, id: &'static str) -> Option<f64> {
        self.taken.push(id);
        let v = stored(self.el, id)?;
        let (min, max) = live_holds(&self.el.name, id)?;
        if v.is_finite() && (min..=max).contains(&v) {
            Some(v)
        } else {
            self.strays.push(format!(
                "Live's {} holds its {id} within {min} to {max}, and the set stores {v}: the engine keeps its own",
                self.el.name
            ));
            None
        }
    }

    /// The warnings: each stray, then the settings of the surface the set stores and the model does not take.
    fn words(self) -> Vec<String> {
        let mut words = self.strays;
        let untaken: Vec<&str> = live_dynamics::params::table(&self.el.name)
            .unwrap_or_default()
            .iter()
            .map(|row| row.id)
            .filter(|id| *id != "On" && !self.taken.contains(id))
            .filter(|id| stored(self.el, id).is_some())
            .collect();
        if !untaken.is_empty() {
            words.push(format!(
                "the engine's model does not take its {} yet: they sound as the model's own",
                untaken.join(", ")
            ));
        }
        words
    }
}

/// What Operator's default patch stores for the settings the engine's model of it does not take
/// (`evidence/devices/Operator/default.xml`): the model sounds the default patch, so a set storing these sounds as
/// stored, and one storing another value is named in a warning.
const OPERATOR_DEFAULT_PATCH: [(&str, f64); 13] = [
    ("Operator.0/IsOn", 1.0),
    ("Operator.0/Tune/Coarse", 1.0),
    ("Operator.0/Tune/Fine", 0.0),
    ("Operator.0/Tune/VelCoarseScale", 0.0),
    ("Operator.0/WaveForm", 0.0),
    ("Operator.0/Phase", 0.0),
    ("Operator.0/Feedback", 0.0),
    ("Operator.0/VelScale", 50.0),
    ("Operator.0/KeyScale", 0.0),
    ("Operator.0/Envelope/AttackSlope", 0.0),
    ("Operator.0/Envelope/DecaySlope", 1.0),
    ("Operator.0/Envelope/ReleaseSlope", 1.0),
    ("Operator.0/Envelope/TimeVelScale", 0.0),
];

/// An Operator as the set stores it (O-I #849 round 16), as the engine's model of it takes it
/// (`live_dynamics::operator`, oscillator A and its amp envelope): A's level, the device's output level, and A's
/// envelope (its times in ms, as stored; the decay's time constant at the model's two-pin reading of 0.120 s per
/// stored second, `OscBModulator::factory`; one floor, where the attack starts and the release ends), each where the
/// set stores it within the extent the corpus's surface gives it; what the model does not take, named where the set
/// stores other than the default patch's (oscillator B too, which the surface gives no extent for).
fn operator_of(el: &Element, sample_rate: u32) -> (OperatorInstrument, Vec<String>) {
    use live_dynamics::operator::{fitted, stored as default, OperatorVoiceA};
    let mut s = Stored::of(el);
    let mut voice = OperatorVoiceA::default_patch(69, sample_rate);
    voice.osc_a_level = s.take("Operator.0/Volume").unwrap_or(voice.osc_a_level);
    voice.globals_volume = s.take("Globals/Volume").unwrap_or(voice.globals_volume);
    let e = &mut voice.envelope;
    if let Some(ms) = s.take("Operator.0/Envelope/AttackTime") {
        e.attack_s = ms / 1000.0;
    }
    if let Some(ms) = s.take("Operator.0/Envelope/DecayTime") {
        e.decay_time_s = ms / 1000.0;
        e.decay_tau_s = fitted::DECAY_TAU_S * e.decay_time_s;
    }
    e.decay_level_amp = s
        .take("Operator.0/Envelope/DecayLevel")
        .unwrap_or(e.decay_level_amp);
    e.sustain_amp = s
        .take("Operator.0/Envelope/SustainLevel")
        .unwrap_or(e.sustain_amp);
    if let Some(ms) = s.take("Operator.0/Envelope/ReleaseTime") {
        e.release_time_s = ms / 1000.0;
    }
    let attack_level = s.take("Operator.0/Envelope/AttackLevel");
    if let Some(floor) = s.take("Operator.0/Envelope/ReleaseLevel") {
        e.floor_amp = floor;
    }
    if let Some(level) = attack_level.filter(|level| *level != e.floor_amp) {
        s.strays.push(format!(
            "the engine's model of Live's Operator starts its attack where its release ends, and the set stores an AttackLevel of {level} and a ReleaseLevel of {}: the attack starts at {}",
            e.floor_amp, e.floor_amp
        ));
    }
    if let Some(level) =
        stored(el, "Operator.1/Volume").filter(|v| *v != default::OSC_B_LEVEL_FLOOR_AMP)
    {
        s.strays.push(format!(
            "its oscillator B stores a Volume of {level}, and the corpus's surface of Live's Operator gives it no extent: the engine keeps B at its floor"
        ));
    }
    for (id, value) in OPERATOR_DEFAULT_PATCH {
        if stored(el, id) == Some(value) {
            s.taken.push(id);
        }
    }
    (OperatorInstrument::new(voice), s.words())
}

/// One of the engine's models of Live's devices at the settings the set stores for `el` (O-I #849 round 15), each
/// one the set stores none of at the model's factory value ([`known_device`]), with the words for what it does not
/// take. None for a device the engine has no model of.
fn as_stored(el: &Element) -> Option<(Box<dyn crate::graph::Device>, Vec<String>)> {
    let mut s = Stored::of(el);
    let device: Box<dyn crate::graph::Device> = match el.name.as_str() {
        "GlueCompressor" => {
            let mut p = GLUE_FACTORY;
            p.threshold_db = s.take("Threshold").unwrap_or(p.threshold_db);
            p.range = s.take("Range").unwrap_or(p.range);
            p.ratio = s.take("Ratio").unwrap_or(p.ratio);
            // Live's Ratio is a menu of three curves (O-I #849 round 17, glue.rs `measured_curve_of`)
            if ![0.0, 1.0, 2.0].contains(&p.ratio) {
                let nearer = p.ratio.round().clamp(0.0, 2.0);
                s.strays.push(format!(
                    "Live's GlueCompressor stores its Ratio as one of its three curves, 0, 1 and 2, and the set stores {}: the engine sounds curve {nearer}",
                    p.ratio
                ));
                p.ratio = nearer;
            }
            p.makeup_db = s.take("Makeup").unwrap_or(p.makeup_db);
            Box::new(GlueDevice::new(p))
        }
        "Echo" => {
            let mut p = ECHO_FACTORY;
            // one hop, the shorter side's (devices/echo.md: measured hop = min(tL, tR))
            let times = [s.take("Delay_TimeL"), s.take("Delay_TimeR")];
            if let Some(hop) = times.into_iter().flatten().reduce(f64::min) {
                p.delay_time_s = hop;
            }
            // the tap train decays only below a feedback of 1 (EchoDevice: FB ≥ 1 cannot be represented faithfully)
            match s.take("Feedback") {
                Some(feedback) if feedback < 1.0 => p.feedback = feedback,
                Some(feedback) => s.strays.push(format!(
                    "the engine's model of Live's Echo decays its repeats only below a Feedback of 1, and the set stores {feedback}: it keeps its own {}",
                    p.feedback
                )),
                None => {}
            }
            p.dry_wet = s.take("DryWet").unwrap_or(p.dry_wet);
            Box::new(EchoDevice::new(p))
        }
        "Reverb" => reverb_of(s.take("DecayTime").unwrap_or(REVERB_FACTORY_DECAY_MS)),
        "Compressor2" => {
            let mut p = live_dynamics::compressor::DEFAULTS;
            let mut number = |id: &'static str, at: &mut f64| *at = s.take(id).unwrap_or(*at);
            number("Threshold", &mut p.threshold);
            number("Ratio", &mut p.ratio);
            number("ExpansionRatio", &mut p.expansion_ratio);
            number("Attack", &mut p.attack);
            number("Release", &mut p.release);
            number("Gain", &mut p.gain);
            number("DryWet", &mut p.dry_wet);
            number("Knee", &mut p.knee);
            number(
                "SideChain/RoutedInput/Volume",
                &mut p.side_chain.routed_input_volume,
            );
            number("SideChain/DryWet", &mut p.side_chain.dry_wet);
            number("SideChainEq/Freq", &mut p.side_chain_eq.freq);
            number("SideChainEq/Q", &mut p.side_chain_eq.q);
            number("SideChainEq/Gain", &mut p.side_chain_eq.gain);
            let mut switch = |id: &'static str, at: &mut bool| {
                if let Some(v) = s.take(id) {
                    *at = v != 0.0;
                }
            };
            switch(
                "AutoReleaseControlOnOff",
                &mut p.auto_release_control_on_off,
            );
            switch("GainCompensation", &mut p.gain_compensation);
            switch("LogEnvelope", &mut p.log_envelope);
            switch("SideListen", &mut p.side_listen);
            switch("SideChain/OnOff", &mut p.side_chain.on_off);
            switch("SideChainEq/On", &mut p.side_chain_eq.on);
            let mut menu = |id: &'static str, at: &mut i64| {
                if let Some(v) = s.take(id) {
                    *at = v as i64;
                }
            };
            menu("Model", &mut p.model);
            menu("LegacyModel", &mut p.legacy_model);
            menu("LegacyEnvFollowerMode", &mut p.legacy_env_follower_mode);
            menu("LookAhead", &mut p.look_ahead);
            menu("SideChainEq/Mode", &mut p.side_chain_eq.mode);
            Box::new(CompressorDevice::new(p))
        }
        "StereoGain" => {
            let gain = s.take("Gain").unwrap_or(1.0) as f32;
            let mut on = |id: &'static str| s.take(id).is_some_and(|v| v != 0.0);
            let (mute, invert) = (on("Mute"), [on("PhaseInvertL"), on("PhaseInvertR")]);
            let channels = match s.take("ChannelMode").map(|v| v.round() as i64) {
                Some(0) => UtilityChannels::Left,
                Some(2) => UtilityChannels::Right,
                _ => UtilityChannels::Stereo,
            };
            if channels != UtilityChannels::Stereo && invert.contains(&true) {
                s.strays.push("no clean-room source orders Live's Utility's Channel Mode and Phase Invert: the engine turns over the channels its mode gives".into());
            }
            // what sounds as stored at these: its laws are not attested (devices/utility-derivation.md §4), and at them each
            // leaves the sound as it is; what one of them gates goes with it
            for (id, leaves, gates) in UTILITY_AS_STORED {
                if stored(el, id).is_none_or(|v| v == leaves) {
                    s.taken.push(id);
                    s.taken.extend_from_slice(gates);
                }
            }
            Box::new(UtilityDevice {
                gain,
                mute,
                invert,
                channels,
            })
        }
        _ => return None,
    };
    Some((device, s.words()))
}

/// Live's Utility's settings whose laws no clean-room source attests (devices/utility-derivation.md §4), each with the
/// value at which it leaves the sound as it is (its width at 100%, its balance centred, each switch off) and the settings
/// it gates: at those it sounds as the set stores it, and off them the bridge says the engine does not take it.
const UTILITY_AS_STORED: [(&str, f64, &[&str]); 7] = [
    ("StereoWidth", 1.0, &[]),
    ("MidSideBalanceOn", 0.0, &["MidSideBalance"]),
    ("Mono", 0.0, &[]),
    ("BassMono", 0.0, &["BassMonoAudition", "BassMonoFrequency"]),
    ("Balance", 0.0, &[]),
    ("DcFilter", 0.0, &[]),
    ("LegacyMode", 0.0, &["LegacyGain"]),
];

/// Live's Audio Effect Rack as the set stores it (O-I #849 item 5, a rack's own chains; devices/racks-session-model.md):
/// each chain (§1.3 `Branches/AudioEffectBranch`) with its devices made as a part's are ([`chain_device`]; what one does
/// not take said on its chain), at its chain mixer's Volume and Panorama (§2.2), sounding when its Speaker is on, when no
/// other chain is soloed or it is, and when the Chain Selector (§1.5, `ChainSelector`) stands within its zone
/// (`BranchSelectorRange` Min to Max). A chain whose zone fades where the selector stands is played at full and said
/// (§7: "ChainSelector crossfade curve" is not attested); the rack's return chains are said, and do not sound.
fn audio_effect_rack(
    el: &Element,
    track: &str,
    warnings: &mut Vec<BridgeWarning>,
) -> AudioEffectRack {
    let said = |warnings: &mut Vec<BridgeWarning>, message: String| {
        warnings.push(BridgeWarning {
            track: track.to_string(),
            device: el.name.clone(),
            message,
        })
    };
    let on = |e: Option<&Element>| value_attr(e) == Some("true");
    let int = |e: &Element, id: &str| value_attr(e.child(id)).and_then(|v| v.parse::<f64>().ok());
    let selector = stored(el, "ChainSelector").unwrap_or(0.0);
    let branches: Vec<&Element> = el
        .child("Branches")
        .map(|b| {
            b.children
                .iter()
                .filter(|c| c.name == "AudioEffectBranch")
                .collect()
        })
        .unwrap_or_default();
    if el
        .child("ReturnBranches")
        .is_some_and(|r| !r.children.is_empty())
    {
        said(
            warnings,
            "its return chains do not sound in the engine yet, nor what its chains send them"
                .into(),
        );
    }
    let soloing = branches.iter().any(|b| on(b.child("IsSoloed")));
    let mut chains = Vec::new();
    for (i, b) in branches.iter().enumerate() {
        let name = b
            .find("EffectiveName")
            .and_then(|n| n.attr("Value"))
            .filter(|n| !n.is_empty())
            .map_or_else(|| format!("{}", i + 1), str::to_string);
        let mixer = b.child("MixerDevice");
        let speaker = mixer.and_then(|m| stored(m, "Speaker")) != Some(0.0);
        let gain = mixer.and_then(|m| stored(m, "Volume")).unwrap_or(1.0);
        let pan = mixer.and_then(|m| stored(m, "Panorama")).unwrap_or(0.0);
        let zone = b.child("BranchSelectorRange");
        let range = |id: &str| zone.and_then(|z| int(z, id));
        let (min, max) = (range("Min").unwrap_or(0.0), range("Max").unwrap_or(127.0));
        let within = (min..=max).contains(&selector);
        let (fade_min, fade_max) = (
            range("CrossfadeMin").unwrap_or(min),
            range("CrossfadeMax").unwrap_or(max),
        );
        let fades = |from: f64, to: f64| from < to && selector > from && selector < to;
        // it rises across Min to CrossfadeMin and falls across CrossfadeMax to Max (§1.5: the zones tile the selector, each
        // chain's band overlapping its neighbour's)
        if within && (fades(min, fade_min) || fades(fade_max, max)) {
            said(warnings, format!(
                "its chain '{name}' fades where the Chain Selector stands ({selector}), by a curve no clean-room source gives: the engine plays it at full"
            ));
        }
        let at = warnings.len();
        let devices: Vec<Box<dyn crate::graph::Device>> = b
            .child("DeviceChain")
            .and_then(|c| c.child("AudioToAudioDeviceChain"))
            .and_then(|c| c.child("Devices"))
            .map(|ds| {
                ds.children
                    .iter()
                    .map(|d| chain_device(d, track, warnings))
                    .collect()
            })
            .unwrap_or_default();
        for w in &mut warnings[at..] {
            w.message = format!("on the Audio Effect Rack's chain '{name}', {}", w.message);
        }
        chains.push(RackChain {
            name,
            devices,
            gain,
            pan,
            sounds: speaker && (!soloing || on(b.child("IsSoloed"))) && within,
        });
    }
    AudioEffectRack { chains }
}

/// Live's Auto Filter's FilterType as the engine's model reads it, against the Torus's Filter's kinds:
/// the kinds the corpus's presets that store them are named for (params.rs `AUTOFILTER`: 0 the
/// default, 2 "Bandpass Spinner", 4 "Stereo Notch"), 1 for the high-pass. The corpus pins no labels;
/// 3 is none the model sounds.
pub const AUTO_FILTER_TYPES: [(FilterKind, f64); 4] = [
    (FilterKind::Lowpass, 0.0),
    (FilterKind::Highpass, 1.0),
    (FilterKind::Bandpass, 2.0),
    (FilterKind::Notch, 4.0),
];

/// Live's Auto Filter's Cutoff, as the engine's model reads it: a pitch, A 440 Hz at 69 and a
/// semitone a step, so Live's stored 20 to 135 is 26 Hz to 19.9 kHz. The corpus pins no unit for it
/// (params.rs: "NOT a Hz span — note/semitone-scale mapping unmeasured").
pub fn auto_filter_hz(cutoff: f64) -> f64 {
    440.0 * 2f64.powf((cutoff - 69.0) / 12.0)
}

/// The Cutoff of Live's Auto Filter at `hz`, the inverse of [`auto_filter_hz`].
pub fn auto_filter_cutoff(hz: f64) -> f64 {
    69.0 + 12.0 * (hz / 440.0).log2()
}

/// The extent Live's device `element` stores its setting `id` in, as the corpus's surface gives it
/// (live-dynamics params.rs `table`).
pub fn live_holds(element: &str, id: &str) -> Option<(f64, f64)> {
    live_dynamics::params::table(element)?
        .iter()
        .find(|row| row.id == id)
        .map(|row| (row.stored_min, row.stored_max))
}

/// The Torus's Dynamics and Reverb by the frame's keys for their settings, each within the frame's law
/// (effectsLaw.ts `EFFECT_LAW`): what [`rack_device`] makes the frame's own effects from.
pub const TORUS_DYNAMICS_LAW: [(&str, f64, f64); 5] = [
    ("threshold", -60.0, 0.0),
    ("ratio", 1.0, 20.0),
    ("attack", 0.01, 200.0),
    ("release", 5.0, 1000.0),
    ("makeup", 0.0, 24.0),
];
pub const TORUS_REVERB_LAW: [(&str, f64, f64); 5] = [
    ("size", 0.0, 100.0),
    ("decay", 0.2, 20.0),
    ("damping", 0.0, 100.0),
    ("predelay", 0.0, 250.0),
    ("mix", 0.0, 100.0),
];

/// The engine's own device for Live's device `class` on an Instrument Rack's chain (O-I #849 rounds
/// 13 and 14: the Torus's effects, as live-set `rack_place` places them), with the settings carried
/// onto it, by Live's document key, each within the extent Live's device stores it in (the corpus's
/// surface, live-dynamics params.rs); or, by the frame's name for it, one of the Torus's effects the
/// engine sounds as the frame runs it (round 15), from the frame's settings by the frame's keys, each
/// within the frame's law:
/// - `dynamics`, the Torus's Dynamics as its frame's compressor ([`DynamicsDevice`]: the browser's
///   DynamicsCompressorNode at a hard knee, then the frame's makeup), from its threshold (dB), ratio,
///   attack and release (ms) and makeup (dB), all five carried ([`TORUS_DYNAMICS_LAW`]);
/// - `reverb`, the Torus's Reverb as its frame's room ([`RoomDevice`]: the frame's generated room,
///   normalised as the browser's convolver normalises it, after the pre-delay, blended by Dry/wet),
///   from its size (%), decay (s), damping (%), pre-delay (ms) and dry/wet (%), all five carried
///   ([`TORUS_REVERB_LAW`]).
///
/// Live's devices:
/// - Live's Reverb as the gated model ([`ReverbDevice`], at its stored `DecayTime` in ms when
///   carried, the one setting the model takes), convolving by partitions since the part it stands
///   on sounds every sample;
/// - Live's Compressor as its model ([`CompressorDevice`]) at the corpus's stored values, and at
///   its Threshold (a level), Ratio, Attack and Release (ms), Gain (dB of makeup) and Knee (dB)
///   where carried, as the model reads them;
/// - Live's Auto Filter as the Torus's Filter ([`FilterDevice`]): its FilterType by
///   [`AUTO_FILTER_TYPES`], its Cutoff by [`auto_filter_hz`], its Resonance 0 to 1 as the Torus's 0
///   to 100 %, its Drive in dB, all four carried;
/// - Live's Delay as the Torus's Delay ([`DelayDevice`]): its DelayLine_TimeL in seconds on both
///   sides, its Feedback, its Filter_Frequency as the Tone's low-pass, its DryWet as the level the
///   repeats are heard at over the dry at full, all four carried.
///
/// What it was made from names the class and the settings. Refused in words for a class the engine
/// has no model of, for a setting its model does not take or Live's device does not hold, and for one
/// a model built to the Torus's effect needs and is not given.
pub fn rack_device(class: &str, carried: &[(&str, f64)]) -> Result<RackDevice, String> {
    let refuse_rest =
        |title: &str, takes: &[&str]| match carried.iter().find(|(id, _)| !takes.contains(id)) {
            Some((id, _)) => Err(format!(
                "the engine's model of Live's {title} does not take its {id} yet"
            )),
            None => Ok(()),
        };
    // a setting within the extent Live's device stores it in
    let held = |title: &str, element: &str, id: &str, value: f64| -> Result<f64, String> {
        let (min, max) = live_holds(element, id)
            .ok_or_else(|| format!("the corpus gives Live's {title} no {id}"))?;
        if value.is_finite() && (min..=max).contains(&value) {
            Ok(value)
        } else {
            Err(format!(
                "Live's {title} holds its {id} within {min} to {max}, not {value}"
            ))
        }
    };
    // the settings a model built to the Torus's effect needs, each carried and held
    let needs = |title: &str, element: &str, effect: &str, ids: &[&str; 4]| {
        let mut values = [0.0; 4];
        for (value, id) in values.iter_mut().zip(ids) {
            let carried = carried.iter().find(|(k, _)| k == id).ok_or_else(|| {
                format!(
                    "the engine's model of Live's {title} sounds the Torus's {effect} from its {}, and no {id} is carried",
                    ids.join(", ")
                )
            })?;
            *value = held(title, element, id, carried.1)?;
        }
        Ok::<_, String>(values)
    };
    // the frame's settings of one of the Torus's effects, each carried and within the frame's law
    let frame = |effect: &str, law: &[(&str, f64, f64); 5]| {
        if let Some((id, _)) = carried
            .iter()
            .find(|(id, _)| !law.iter().any(|(k, ..)| k == id))
        {
            return Err(format!("the frame's {effect} has no setting {id}"));
        }
        let mut values = [0.0; 5];
        for (value, (id, min, max)) in values.iter_mut().zip(law) {
            let (_, v) = carried.iter().find(|(k, _)| k == id).ok_or_else(|| {
                format!(
                    "the engine sounds the Torus's {effect} as its frame does from its {}, and no {id} is carried",
                    law.map(|(k, ..)| k).join(", ")
                )
            })?;
            if !(v.is_finite() && (*min..=*max).contains(v)) {
                return Err(format!(
                    "the frame's {effect} holds its {id} within {min} to {max}, not {v}"
                ));
            }
            *value = *v;
        }
        Ok::<_, String>(values)
    };
    let device: Box<dyn crate::graph::Device> = match class {
        "dynamics" => {
            let [threshold_db, ratio, attack_ms, release_ms, makeup_db] =
                frame("Dynamics", &TORUS_DYNAMICS_LAW)?;
            Box::new(DynamicsDevice::new(DynamicsParams {
                threshold_db,
                ratio,
                attack_ms,
                release_ms,
                makeup_db,
            }))
        }
        "reverb" => {
            let [size, decay_s, damping, predelay_ms, mix] = frame("Reverb", &TORUS_REVERB_LAW)?;
            Box::new(RoomDevice::new(RoomParams {
                size,
                decay_s,
                damping,
                predelay_ms,
                mix,
            }))
        }
        "Reverb" => {
            refuse_rest("Reverb", &["DecayTime"])?;
            let decay_ms = carried
                .iter()
                .find(|(id, _)| *id == "DecayTime")
                .map_or(1200.00012, |(_, ms)| *ms);
            if !(decay_ms.is_finite() && decay_ms > 0.0) {
                return Err(format!(
                    "Live's Reverb holds a DecayTime above 0 ms, not {decay_ms}"
                ));
            }
            Box::new(ReverbDevice::partitioned(
                live_dynamics::reverb::ReverbParams { decay_ms },
                1.0,
            ))
        }
        "Compressor2" => {
            refuse_rest(
                "Compressor",
                &["Threshold", "Ratio", "Attack", "Release", "Gain", "Knee"],
            )?;
            let mut params = live_dynamics::compressor::DEFAULTS;
            for (id, value) in carried {
                let value = held("Compressor", "Compressor2", id, *value)?;
                match *id {
                    "Threshold" => params.threshold = value,
                    "Ratio" => params.ratio = value,
                    "Attack" => params.attack = value,
                    "Release" => params.release = value,
                    "Gain" => params.gain = value,
                    _ => params.knee = value,
                }
            }
            Box::new(CompressorDevice::new(params))
        }
        "AutoFilter" => {
            const TAKES: [&str; 4] = ["FilterType", "Cutoff", "Resonance", "Drive"];
            refuse_rest("Auto Filter", &TAKES)?;
            let [kind, cutoff, resonance, drive] =
                needs("Auto Filter", "AutoFilter", "Filter", &TAKES)?;
            let kind = AUTO_FILTER_TYPES
                .iter()
                .find(|(_, stored)| *stored == kind)
                .map(|(k, _)| *k)
                .ok_or_else(|| {
                    format!("the engine's model of Live's Auto Filter sounds its FilterType 0, 1, 2 or 4 (low-pass, high-pass, band-pass, notch), not {kind}")
                })?;
            Box::new(FilterDevice::new(FilterParams {
                kind,
                cutoff_hz: auto_filter_hz(cutoff),
                resonance,
                drive_db: drive,
            }))
        }
        "Delay" => {
            const TAKES: [&str; 4] = ["DelayLine_TimeL", "Feedback", "Filter_Frequency", "DryWet"];
            refuse_rest("Delay", &TAKES)?;
            let [time_s, feedback, tone_hz, mix] = needs("Delay", "Delay", "Delay", &TAKES)?;
            Box::new(DelayDevice::new(DelayParams {
                time_s,
                feedback,
                tone_hz,
                mix,
            }))
        }
        other => return Err(format!("Live's {other} has no model in the engine yet")),
    };
    let mut made_from = class.to_string();
    for (id, value) in carried {
        made_from.push_str(&format!(" {id}={value}"));
    }
    Ok(RackDevice { made_from, device })
}

/// Bridge a summarized document into a graph at `sample_rate`.
///
/// Audio tracks become stereo engine tracks with empty sources (the host
/// fills them); MIDI and return tracks are recorded as warnings (M1
/// renders audio tracks only); the master's device chain lands on the
/// master. Track order is preserved — it is the document's mix order.
pub fn bridge(summary: &SetSummary, sample_rate: u32) -> BridgeResult {
    let mut graph = Graph::new(sample_rate, summary.tempo_bpm);
    let mut warnings = Vec::new();
    for info in &summary.tracks {
        match info.kind {
            TrackKind::Master => {
                for d in &info.devices {
                    if let Some(dev) = known_device(d) {
                        graph.master.devices.push(dev);
                    } else {
                        graph.master.devices.push(Box::new(BypassDevice));
                        warnings.push(BridgeWarning {
                            track: info.name.clone(),
                            device: d.clone(),
                            message: "unknown device on master: bypassed".into(),
                        });
                    }
                }
            }
            TrackKind::Audio => {
                let mut track = Track::new(&info.name, 2);
                for d in &info.devices {
                    if let Some(dev) = known_device(d) {
                        track.devices.push(dev);
                    } else {
                        track.devices.push(Box::new(BypassDevice));
                        warnings.push(BridgeWarning {
                            track: info.name.clone(),
                            device: d.clone(),
                            message: "unknown device: bypassed".into(),
                        });
                    }
                }
                graph.tracks.push(track);
            }
            TrackKind::Midi => warnings.push(BridgeWarning {
                track: info.name.clone(),
                device: String::new(),
                message: "MIDI track: the summary carries no notes or mixer (bridge the document with bridge_set)".into(),
            }),
            TrackKind::Return => warnings.push(BridgeWarning {
                track: info.name.clone(),
                device: String::new(),
                message: "return track: the summary carries no sends (bridge the document with bridge_set)".into(),
            }),
            TrackKind::Group => warnings.push(BridgeWarning {
                track: info.name.clone(),
                device: String::new(),
                message: "group track: not rendered in M1 (its members render on their own; no group bus yet)".into(),
            }),
        }
    }
    BridgeResult {
        graph,
        warnings,
        samples: Vec::new(),
    }
}

// ---------------------------------------------------------------- the set

fn manual(param: Option<&Element>) -> Option<&str> {
    param
        .and_then(|p| p.child("Manual"))
        .and_then(|m| m.attr("Value"))
}

fn num(param: Option<&Element>) -> Option<f64> {
    manual(param).and_then(|v| v.parse().ok())
}

fn value_attr(e: Option<&Element>) -> Option<&str> {
    e.and_then(|e| e.attr("Value"))
}

/// The group a part or a group sounds into as the set routes its output (`DeviceChain/AudioOutputRouting/Target`, O-I
/// #849 round 17), from the group it stands in (`group`, by its `TrackGroupId`): `AudioOut/GroupTrack`, Live's routing of
/// one in a group, or none stated, into that group; `AudioOut/Main` (`AudioOut/Master` in older sets) straight to the
/// Main track, though it stands in a group. ENGINE DECISION (the engine has no other output): any other target sounds
/// where Live's default would put it, named in words by Live's own name for it (`UpperDisplayString`).
fn routed_into(tr: &Element, group: Option<usize>, words: &mut Vec<String>) -> Option<usize> {
    let routing = tr
        .child("DeviceChain")
        .and_then(|d| d.child("AudioOutputRouting"));
    match value_attr(routing.and_then(|r| r.child("Target"))) {
        None | Some("AudioOut/GroupTrack") => group,
        Some("AudioOut/Main" | "AudioOut/Master") => None,
        Some(target) => {
            let named = value_attr(routing.and_then(|r| r.child("UpperDisplayString")))
                .filter(|n| !n.is_empty())
                .unwrap_or(target);
            words.push(format!(
                "its output goes to {named}, which the engine does not route: it sounds to {}",
                if group.is_some() {
                    "its group"
                } else {
                    "the Main track"
                }
            ));
            group
        }
    }
}

fn beats(e: &Element, name: &str) -> Option<f64> {
    value_attr(e.child(name)).and_then(|v| v.parse().ok())
}

/// A track's device list: `DeviceChain/DeviceChain/Devices` (session-model.md
/// §3), else the first `Devices` below it (the summary's reading).
fn devices_of(track: &Element) -> Vec<&Element> {
    track
        .child("DeviceChain")
        .and_then(|d| d.child("DeviceChain"))
        .and_then(|d| d.child("Devices"))
        .or_else(|| track.find("Devices"))
        .map(|ds| ds.children.iter().collect())
        .unwrap_or_default()
}

/// The mixer row as the document keeps it (session-model.md §3:
/// `DeviceChain/Mixer` — Volume, Pan, Speaker, SoloSink, Sends): (gain,
/// pan, active, solo, sends). Volume and sends are linear gains as stored;
/// absent values read as Live's defaults (unity, centre, on, unsoloed).
fn mixer_row(track: &Element) -> (f64, f64, bool, bool, Vec<f64>) {
    let mixer = track.child("DeviceChain").and_then(|d| d.child("Mixer"));
    let Some(m) = mixer else {
        return (1.0, 0.0, true, false, Vec::new());
    };
    let gain = num(m.child("Volume")).unwrap_or(1.0);
    let pan = num(m.child("Pan")).unwrap_or(0.0);
    let active = manual(m.child("Speaker"))
        .map(|v| v != "false")
        .unwrap_or(true);
    let solo = value_attr(m.child("SoloSink")) == Some("true");
    let sends = m
        .child("Sends")
        .map(|s| {
            s.children_named("TrackSendHolder")
                .map(|h| num(h.child("Send")).unwrap_or(0.0))
                .collect()
        })
        .unwrap_or_default();
    (gain, pan, active, solo, sends)
}

/// The arrangement MIDI notes of a track
/// (`MainSequencer/ClipTimeable/ArrangerAutomation/Events/MidiClip`,
/// session-model.md §7), on `clock`'s timeline. A clip anchors at its
/// `Time` attribute (absent: arrangement 0 — session-model.md §7, FA
/// probes) and covers `CurrentEnd − CurrentStart` beats; a note's clip
/// time is its `Time`. ENGINE DECISION (the loop semantics no dossier
/// measures yet): an unlooped clip plays the notes in `[LoopStart,
/// LoopStart + span)`; a looped clip repeats `[LoopStart, LoopEnd)` from
/// `StartRelative` until the span ends. Notes are cut at the clip's end;
/// disabled notes and disabled clips are skipped.
pub fn arrangement_notes(track: &Element, clock: &Clock) -> Vec<Note> {
    let mut notes = Vec::new();
    let Some(events) = track
        .child("DeviceChain")
        .and_then(|d| d.child("MainSequencer"))
        .and_then(|s| s.child("ClipTimeable"))
        .and_then(|c| c.child("ArrangerAutomation"))
        .and_then(|a| a.child("Events"))
    else {
        return notes;
    };
    for clip in events.children_named("MidiClip") {
        if value_attr(clip.child("Disabled")) == Some("true") {
            continue;
        }
        let anchor = clip
            .attr("Time")
            .and_then(|v| v.parse::<f64>().ok())
            .unwrap_or(0.0);
        let span =
            beats(clip, "CurrentEnd").unwrap_or(0.0) - beats(clip, "CurrentStart").unwrap_or(0.0);
        let lp = clip.child("Loop");
        let at = |name: &str| lp.and_then(|l| beats(l, name)).unwrap_or(0.0);
        let (loop_start, loop_end, start_rel) =
            (at("LoopStart"), at("LoopEnd"), at("StartRelative"));
        let looped = lp.and_then(|l| value_attr(l.child("LoopOn"))) == Some("true");
        let Some(key_tracks) = clip.child("Notes").and_then(|n| n.child("KeyTracks")) else {
            continue;
        };
        for kt in &key_tracks.children {
            let Some(key) = value_attr(kt.child("MidiKey")).and_then(|v| v.parse::<u8>().ok())
            else {
                continue;
            };
            let Some(list) = kt.child("Notes") else {
                continue;
            };
            for ev in list.children_named("MidiNoteEvent") {
                if ev.attr("IsEnabled") == Some("false") {
                    continue;
                }
                let get = |n: &str| ev.attr(n).and_then(|v| v.parse::<f64>().ok());
                let (Some(t), Some(dur)) = (get("Time"), get("Duration")) else {
                    continue;
                };
                let velocity = get("Velocity").unwrap_or(100.0) as f32;
                let mut push = |rel: f64, len: f64| {
                    if rel < 0.0 || rel >= span || len <= 0.0 {
                        return;
                    }
                    let len = len.min(span - rel);
                    let start = clock.frame_of_beat(anchor + rel);
                    let end = clock.frame_of_beat(anchor + rel + len);
                    notes.push(Note {
                        key,
                        start,
                        length: end.saturating_sub(start),
                        velocity,
                    });
                };
                if looped {
                    let l = loop_end - loop_start;
                    if l <= 0.0 || t < loop_start || t >= loop_end {
                        continue;
                    }
                    let first = (t - loop_start - start_rel).rem_euclid(l);
                    let mut rel = first;
                    while rel < span {
                        push(rel, dur.min(loop_end - t));
                        rel += l;
                    }
                } else {
                    push(t - loop_start, dur);
                }
            }
        }
    }
    notes.sort_by_key(|n| (n.start, n.key));
    notes
}

/// A device element on a chain (O-I #849 round 15): one the set stores off passes its sound through, as Live's does;
/// a known model at the settings the set stores for it ([`as_stored`]), with a warning for each thing it does not
/// take; else a bypass and a warning.
fn chain_device(
    el: &Element,
    track: &str,
    warnings: &mut Vec<BridgeWarning>,
) -> Box<dyn crate::graph::Device> {
    let mut warn = |message: String| {
        warnings.push(BridgeWarning {
            track: track.to_string(),
            device: el.name.clone(),
            message,
        })
    };
    if stored(el, "On") == Some(0.0) {
        return Box::new(BypassDevice);
    }
    if el.name == "AudioEffectGroupDevice" {
        return Box::new(audio_effect_rack(el, track, warnings));
    }
    match as_stored(el) {
        Some((device, words)) => {
            words.into_iter().for_each(&mut warn);
            device
        }
        None => {
            warn("unknown device: bypassed".into());
            Box::new(BypassDevice)
        }
    }
}

/// A device of the set as the engine makes it again for an edit (O-I #849 round 17, [`set_device`]).
pub struct SetDevice {
    /// The part it stands on, and its place on that part's own chain.
    pub part: Part,
    pub at: usize,
    /// The device, made as Play makes it from what the set now stores ([`chain_device`]).
    pub device: Box<dyn crate::graph::Device>,
    /// The device element it was made from, to make it again (Export Audio, [`set_device_made`]).
    pub element: Element,
}

/// The device `device` of the set's track `track` (O-I #849 round 17: a device the set's owner wrote a setting of, followed
/// while the set plays): the one the owner writes, on the chain of the first track of that name ("Master" the Main track,
/// `live_set::api` `device_place`) at its place `at` on that chain, the instrument counted (DLW build ruling 2026-11-05: so
/// the second of two devices of one name is itself), or the first of that element name when no place is named; made as
/// Play makes it ([`bridge_set`]) and placed as the engine holds it: a part's, a return's or a group's by its index among
/// them, its place on the chain past a MIDI part's instrument (its first Operator, which stands on no chain). Refused in
/// words for a track, a device or a place the set does not have, a place holding another device, and a part's instrument.
pub fn set_device(
    root: &Element,
    track: &str,
    device: &str,
    at: Option<usize>,
) -> Result<SetDevice, String> {
    let ls = root
        .find("LiveSet")
        .ok_or("the set document holds no LiveSet")?;
    let (part, tr) = if track == "Master" {
        let main = ls.child("MainTrack").ok_or("the set has no Main track")?;
        (Part::Main, main)
    } else {
        let (mut parts, mut returns, mut groups) = (0, 0, 0);
        let mut found = None;
        for tr in ls.child("Tracks").map(|t| &t.children[..]).unwrap_or(&[]) {
            let named = tr.find("EffectiveName").and_then(|n| n.attr("Value")) == Some(track);
            let (count, part): (&mut usize, fn(usize) -> Part) = match tr.name.as_str() {
                "AudioTrack" | "MidiTrack" => (&mut parts, Part::Track),
                "ReturnTrack" => (&mut returns, Part::Return),
                "GroupTrack" => (&mut groups, Part::Group),
                _ => continue,
            };
            if named {
                found = Some((part(*count), tr));
                break;
            }
            *count += 1;
        }
        found.ok_or_else(|| format!("the set has no track named '{track}'"))?
    };
    let devices = devices_of(tr);
    let a = |name: &str| {
        let article = if name.starts_with(['A', 'E', 'I', 'O', 'U']) {
            "an"
        } else {
            "a"
        };
        format!("{article} {name}")
    };
    let place = match at {
        Some(at) => match devices.get(at) {
            None => {
                return Err(format!(
                    "'{track}' holds no device at place {at} on its chain"
                ))
            }
            Some(d) if d.name != device => {
                return Err(format!(
                    "the device at place {at} on '{track}' is {}, not {}",
                    a(&d.name),
                    a(device)
                ))
            }
            Some(_) => at,
        },
        None => devices
            .iter()
            .position(|d| d.name == device)
            .ok_or_else(|| format!("'{track}' holds no {device} on its chain"))?,
    };
    let instrument = (tr.name == "MidiTrack")
        .then(|| devices.iter().position(|d| d.name == "Operator"))
        .flatten();
    if instrument == Some(place) {
        return Err(format!(
            "the {device} on '{track}' is its instrument, which the engine makes when the set is played: the edit is heard from the next Play"
        ));
    }
    let at = place - usize::from(instrument.is_some_and(|i| i < place));
    Ok(SetDevice {
        part,
        at,
        device: set_device_made(devices[place]),
        element: devices[place].clone(),
    })
}

/// A device element made as Play makes it ([`chain_device`]), its warnings left to the bridge's reading of the set.
pub fn set_device_made(el: &Element) -> Box<dyn crate::graph::Device> {
    chain_device(el, "", &mut Vec::new())
}

/// Bridge a parsed set document (`<Ableton>`) into a graph at
/// `sample_rate`: every part with its mixer row (volume, pan, activator,
/// solo, sends), MIDI parts with their instrument and arrangement notes,
/// the return tracks, and the Main track's volume, pan and chain.
///
/// A MIDI part's first `Operator` is its instrument, at the patch the set
/// stores for it as the engine's model takes it (O-I #849 round 16,
/// `operator_of`, as each effect's stored settings, `chain_device`); a MIDI part with no instrument the engine
/// models stays silent, with a warning. An audio part's arrangement clips
/// are named in [`BridgeResult::samples`], each the sample it wants laid
/// ([`arrangement_samples`]; the host lays them, [`lay_samples`]). A group track is a bus (O-I #849 round 16,
/// [`GroupTrack`]): with its chain, mixer row and sends, it takes the sound
/// of each part and group whose `TrackGroupId` names its `Id`, and sounds
/// into the group it stands in or the Main track, as the set routes each
/// one's output (round 17, [`routed_into`]: a part or a group routed to the
/// Main track skips the group it stands in).
pub fn bridge_set(root: &Element, sample_rate: u32) -> Option<BridgeResult> {
    let ls = root.find("LiveSet")?;
    let tempo_bpm = num(ls.child("MainTrack").and_then(|m| m.find("Tempo"))).unwrap_or(120.0);
    let mut graph = Graph::new(sample_rate, tempo_bpm);
    let clock = Clock::start(sample_rate, tempo_bpm);
    let mut warnings = Vec::new();
    let mut samples = Vec::new();
    // each group track's `Id`, in the set's order: its index among the graph's groups
    let group_ids: Vec<&str> = ls
        .child("Tracks")
        .map(|tracks| {
            tracks
                .children_named("GroupTrack")
                .filter_map(|g| g.attr("Id"))
                .collect()
        })
        .unwrap_or_default();
    let group_of = |tr: &Element| {
        value_attr(tr.child("TrackGroupId")).and_then(|id| group_ids.iter().position(|g| *g == id))
    };
    if let Some(tracks) = ls.child("Tracks") {
        for tr in &tracks.children {
            let name = tr
                .find("EffectiveName")
                .and_then(|n| n.attr("Value"))
                .unwrap_or("")
                .to_string();
            let (gain, pan, active, solo, sends) = mixer_row(tr);
            match tr.name.as_str() {
                "AudioTrack" | "MidiTrack" => {
                    let midi = tr.name == "MidiTrack";
                    let mut track = Track::new(&name, 2);
                    let mut instrument_seen = false;
                    for d in devices_of(tr) {
                        if midi && !instrument_seen && d.name == "Operator" {
                            let (operator, words) = operator_of(d, sample_rate);
                            warnings.extend(words.into_iter().map(|message| BridgeWarning {
                                track: name.clone(),
                                device: d.name.clone(),
                                message,
                            }));
                            track.instrument = Some(Box::new(operator));
                            instrument_seen = true;
                        } else {
                            track.devices.push(chain_device(d, &name, &mut warnings));
                        }
                    }
                    if midi {
                        if track.instrument.is_none() {
                            warnings.push(BridgeWarning {
                                track: name.clone(),
                                device: String::new(),
                                message: "MIDI part with no instrument the engine models: it plays its notes silently".into(),
                            });
                            track.instrument = Some(Box::new(crate::instruments::SilentInstrument));
                        }
                        track.set_notes(&arrangement_notes(tr, &clock));
                    } else {
                        samples.extend(arrangement_samples(
                            tr,
                            graph.tracks.len(),
                            &clock,
                            &name,
                            &mut warnings,
                        ));
                    }
                    track.gain = gain;
                    track.pan = pan;
                    track.active = active;
                    track.solo = solo;
                    track.sends = sends;
                    let mut words = Vec::new();
                    track.group = routed_into(tr, group_of(tr), &mut words);
                    warnings.extend(words.into_iter().map(|message| BridgeWarning {
                        track: name.clone(),
                        device: String::new(),
                        message,
                    }));
                    graph.tracks.push(track);
                }
                "ReturnTrack" => {
                    let mut ret = ReturnTrack::new(&name);
                    for d in devices_of(tr) {
                        ret.devices.push(chain_device(d, &name, &mut warnings));
                    }
                    ret.gain = gain;
                    ret.pan = pan;
                    ret.active = active;
                    graph.returns.push(ret);
                }
                "GroupTrack" => {
                    let mut group = GroupTrack::new(&name);
                    for d in devices_of(tr) {
                        group.devices.push(chain_device(d, &name, &mut warnings));
                    }
                    group.gain = gain;
                    group.pan = pan;
                    group.active = active;
                    group.solo = solo;
                    group.sends = sends;
                    let at = graph.groups.len();
                    let mut words = Vec::new();
                    group.group = routed_into(tr, group_of(tr), &mut words);
                    let mut warn = |message: String| {
                        warnings.push(BridgeWarning {
                            track: name.clone(),
                            device: String::new(),
                            message,
                        })
                    };
                    words.into_iter().for_each(&mut warn);
                    if group.group.is_some_and(|up| up >= at) {
                        warn("group track: it stands in a group after it in the set, so it sounds to the Main track".into());
                    }
                    if at >= MAX_GROUPS {
                        warn(format!("group track: the engine mixes at most {MAX_GROUPS} groups, so what stands in it sounds to the Main track"));
                    }
                    graph.groups.push(group);
                }
                _ => {}
            }
        }
    }
    // the per-return pre/post flags, in return order (devices/
    // racks-session-model.md §2.1: `SendsPre/SendPreBool Id=N Value=bool`)
    if let Some(pre) = ls.child("SendsPre") {
        for (ret, flag) in graph
            .returns
            .iter_mut()
            .zip(pre.children_named("SendPreBool"))
        {
            ret.pre_fader = flag.attr("Value") == Some("true");
        }
    }
    graph.solo_in_place = value_attr(ls.child("SoloInPlace")) != Some("false");
    if let Some(mt) = ls.child("MainTrack") {
        let (gain, pan, _, _, _) = mixer_row(mt);
        graph.master.gain = gain;
        graph.master.pan = pan;
        for d in devices_of(mt) {
            let dev = chain_device(d, "Main", &mut warnings);
            graph.master.devices.push(dev);
        }
    }
    Some(BridgeResult {
        graph,
        warnings,
        samples,
    })
}

/// The arrangement audio clips of the part `track` (its element `tr`, named `name`), each as the sample
/// it wants laid ([`ClipSample`]), on `clock`'s timeline. A disabled clip is skipped, as its notes are. The
/// engine plays an unwarped clip at its sample's own rate (session-model.md §5); a warped clip is silent,
/// and what the engine does not play of a clip it plays is named, each in a warning: its loop (it plays
/// once), its transposition and its fades.
fn arrangement_samples(
    tr: &Element,
    track: usize,
    clock: &Clock,
    name: &str,
    warnings: &mut Vec<BridgeWarning>,
) -> Vec<ClipSample> {
    let mut samples = Vec::new();
    let Some(events) = tr
        .child("DeviceChain")
        .and_then(|d| d.child("MainSequencer"))
        .and_then(|s| s.child("Sample"))
        .and_then(|s| s.child("ArrangerAutomation"))
        .and_then(|a| a.child("Events"))
    else {
        return samples;
    };
    for clip in events.children_named("AudioClip") {
        if value_attr(clip.child("Disabled")) == Some("true") {
            continue;
        }
        let named = value_attr(clip.child("Name"))
            .filter(|n| !n.is_empty())
            .unwrap_or("an audio clip")
            .to_string();
        let mut warn = |message: String| {
            warnings.push(BridgeWarning {
                track: name.to_string(),
                device: String::new(),
                message: format!("its clip '{named}' {message}"),
            })
        };
        if value_attr(clip.child("IsWarped")) == Some("true") {
            warn("is warped, and the engine plays unwarped clips first: it is silent".into());
            continue;
        }
        let file = clip.child("SampleRef").and_then(|r| r.child("FileRef"));
        let stored = |field: &str| {
            value_attr(file.and_then(|f| f.child(field)))
                .filter(|v| !v.is_empty())
                .map(str::to_string)
        };
        let (relative, path) = (stored("RelativePath"), stored("Path"));
        if relative.is_none() && path.is_none() {
            warn("names no sample file: it is silent".into());
            continue;
        }
        let lp = clip.child("Loop");
        if lp.and_then(|l| value_attr(l.child("LoopOn"))) == Some("true") {
            warn("loops, and the engine plays an unwarped clip once".into());
        }
        let pitched = ["PitchCoarse", "PitchFine"]
            .iter()
            .any(|p| beats(clip, p).is_some_and(|v| v != 0.0));
        if pitched {
            warn("is transposed, and the engine plays it at its sample's own pitch".into());
        }
        let fades = clip.child("Fades");
        if ["FadeInLength", "FadeOutLength"]
            .iter()
            .any(|f| fades.and_then(|x| beats(x, f)).is_some_and(|v| v != 0.0))
        {
            warn("fades in or out, and the engine plays it without its fades".into());
        }
        let anchor = clip
            .attr("Time")
            .and_then(|v| v.parse::<f64>().ok())
            .unwrap_or(0.0);
        let span =
            beats(clip, "CurrentEnd").unwrap_or(0.0) - beats(clip, "CurrentStart").unwrap_or(0.0);
        let at = clock.frame_of_beat(anchor);
        samples.push(ClipSample {
            track,
            clip: named.clone(),
            relative,
            path,
            at,
            frames: clock
                .frame_of_beat(anchor + span.max(0.0))
                .saturating_sub(at),
            from_seconds: lp
                .and_then(|l| beats(l, "LoopStart"))
                .unwrap_or(0.0)
                .max(0.0),
            gain: beats(clip, "SampleVolume").unwrap_or(1.0) as f32,
        });
    }
    samples
}

/// Lay the samples the set's audio clips want ([`BridgeResult::samples`]) on `graph`'s parts, from the set
/// at `set`: each clip's file read beside the set first (its `RelativePath` from the set's folder), else
/// where the set stored it (its `Path`) — ENGINE DECISION: the set's own folder is the project the clip's
/// relative path is read from; decoded once for all the clips that play it ([`crate::wav::read_wav`]),
/// and laid from its start marker at its own rate (session-model.md §5: unwarped, "the sample at original
/// rate"). A clip whose sample is not found, cannot be read, or stands at another rate than the engine
/// runs at (it does not resample) is silent; each says so in a warning, as does a part whose clips
/// could not be laid. Returns the warnings.
pub fn lay_samples(
    graph: &mut Graph,
    samples: &[ClipSample],
    set: &std::path::Path,
) -> Vec<BridgeWarning> {
    use std::collections::BTreeMap;
    use std::path::PathBuf;
    use std::sync::Arc;
    let folder = set.parent().unwrap_or(std::path::Path::new(""));
    let rate = graph.sample_rate;
    /// A sample decoded once for every clip that plays it: its samples, channels and rate, or why not.
    type Decoded = Result<(Arc<[f32]>, usize, u32), String>;
    let mut decoded: BTreeMap<PathBuf, Decoded> = BTreeMap::new();
    let mut laid: BTreeMap<usize, Vec<crate::graph::LaidSample>> = BTreeMap::new();
    let mut warnings = Vec::new();
    for want in samples {
        let Some(track) = graph.tracks.get(want.track) else {
            continue;
        };
        let mut warn = |message: String| {
            warnings.push(BridgeWarning {
                track: track.name.clone(),
                device: String::new(),
                message: format!("its clip '{}' {message}", want.clip),
            })
        };
        let file = want
            .relative
            .iter()
            .map(|r| folder.join(r))
            .chain(want.path.iter().map(PathBuf::from))
            .find(|p| p.is_file());
        let Some(file) = file else {
            let named = want.relative.as_ref().or(want.path.as_ref()).cloned();
            warn(format!(
                "plays {}, which is neither beside the set nor where the set stored it: it is silent",
                named.unwrap_or_default()
            ));
            continue;
        };
        let read = decoded.entry(file.clone()).or_insert_with(|| {
            let bytes = std::fs::read(&file).map_err(|e| e.to_string())?;
            let wav = crate::wav::read_wav(&bytes).map_err(|e| e.0)?;
            Ok((wav.samples.into(), wav.channels, wav.sample_rate))
        });
        let (pcm, channels, at_rate) = match read {
            Ok(read) => read.clone(),
            Err(e) => {
                warn(format!(
                    "plays {}, which the engine cannot read ({e}): it is silent",
                    file.display()
                ));
                continue;
            }
        };
        if at_rate != rate {
            warn(format!(
                "plays {} at {at_rate} Hz, and the engine runs at {rate} Hz and does not resample: it is silent",
                file.display()
            ));
            continue;
        }
        laid.entry(want.track)
            .or_default()
            .push(crate::graph::LaidSample {
                at: want.at,
                from: (want.from_seconds * f64::from(rate)).round() as u64,
                frames: want.frames,
                gain: want.gain,
                channels,
                pcm,
            });
    }
    for (at, samples) in laid {
        let track = &mut graph.tracks[at];
        if let Err(words) = track.set_samples(samples) {
            warnings.push(BridgeWarning {
                track: track.name.clone(),
                device: String::new(),
                message: format!("its clips are silent: {words}"),
            });
        }
    }
    warnings
}

#[cfg(test)]
mod tests {
    use super::*;
    use live_set::xml;

    fn summary_of(xml_src: &str) -> SetSummary {
        let tree = xml::parse(xml_src).unwrap();
        SetSummary::of(&tree).unwrap()
    }

    #[test]
    fn bridges_known_unknown_and_warns() {
        let s = summary_of(
            r#"<Ableton MajorVersion="5"><LiveSet>
          <MainTrack><DeviceChain><DeviceChain><Devices>
            <GlueCompressor Id="9" />
          </Devices></DeviceChain></DeviceChain></MainTrack>
          <Tracks>
            <AudioTrack Id="8"><Name><EffectiveName Value="STIM" /></Name>
              <DeviceChain><DeviceChain><Devices>
                <GlueCompressor Id="1" />
                <VinylWarble Id="2" />
              </Devices></DeviceChain></DeviceChain>
            </AudioTrack>
            <MidiTrack Id="9"><Name><EffectiveName Value="SYNTH" /></Name></MidiTrack>
            <ReturnTrack Id="10"><Name><EffectiveName Value="Reverb" /></Name></ReturnTrack>
          </Tracks>
        </LiveSet></Ableton>"#,
        );
        let r = bridge(&s, 48_000);
        assert_eq!(r.graph.tempo_bpm, 120.0);
        assert_eq!(r.graph.tracks.len(), 1);
        let t = &r.graph.tracks[0];
        assert_eq!(t.name, "STIM");
        assert_eq!(t.devices.len(), 2);
        assert_eq!(t.devices[0].name(), "GlueCompressor");
        assert_eq!(t.devices[1].name(), "Bypass");
        assert_eq!(r.graph.master.devices.len(), 1);
        assert_eq!(r.graph.master.devices[0].name(), "GlueCompressor");
        // warnings: unknown device on STIM, MIDI track, return track
        assert_eq!(r.warnings.len(), 3, "{:?}", r.warnings);
        assert_eq!(r.warnings[0].device, "VinylWarble");
        assert!(r.warnings[1].message.contains("MIDI"));
        assert!(r.warnings[2].message.contains("return"));
    }

    #[test]
    fn bridged_graph_renders_silence_from_empty_sources() {
        let s = summary_of(
            r#"<Ableton MajorVersion="5"><LiveSet>
          <Tracks><AudioTrack Id="8"><Name><EffectiveName Value="A" /></Name></AudioTrack></Tracks>
        </LiveSet></Ableton>"#,
        );
        let r = bridge(&s, 48_000);
        assert!(r.warnings.is_empty(), "{:?}", r.warnings);
        assert!(r.graph.render(48_000).is_empty());
    }

    /// O-I #849 round 14: a set's Reverb convolves by partitions (equal to the scatter to float rounding, and
    /// real time on a part that sounds every sample), and its Compressor is the engine's model, never bypassed.
    #[test]
    fn a_sets_reverb_convolves_by_partitions_and_its_compressor_is_never_bypassed() {
        use crate::graph::Device;
        let s = summary_of(
            r#"<Ableton MajorVersion="5"><LiveSet>
          <Tracks><AudioTrack Id="8"><Name><EffectiveName Value="A" /></Name>
            <DeviceChain><DeviceChain><Devices>
              <Compressor2 Id="1" />
              <Reverb Id="2" />
            </Devices></DeviceChain></DeviceChain>
          </AudioTrack></Tracks>
        </LiveSet></Ableton>"#,
        );
        let mut r = bridge(&s, 48_000);
        assert!(r.warnings.is_empty(), "{:?}", r.warnings);
        let t = &mut r.graph.tracks[0];
        assert_eq!(
            t.devices.iter().map(|d| d.name()).collect::<Vec<_>>(),
            ["Compressor2", "Reverb"]
        );
        let clock = Clock::start(48_000, 120.0);
        let params = ReverbParams {
            decay_ms: 1200.00012,
        };
        let mut by_parts = ReverbDevice::partitioned(params.clone(), 1.0);
        let mut scatter = ReverbDevice::new(params, 1.0);
        let bridged = &mut t.devices[1];
        for d in [
            &mut by_parts as &mut dyn Device,
            &mut scatter,
            bridged.as_mut(),
        ] {
            d.prepare(48_000, 2);
        }
        let (mut same, mut rounded) = (true, false);
        for n in 0..4_096 {
            let x = ((n * 7919) % 211) as f32 / 211.0 - 0.5;
            let (mut a, mut b, mut c) = ([x; 2], [x; 2], [x; 2]);
            bridged.process(&mut a, &clock);
            by_parts.process(&mut b, &clock);
            scatter.process(&mut c, &clock);
            same &= a == b;
            rounded |= a != c;
            assert!(
                (a[0] - c[0]).abs() < 1e-4,
                "frame {n}: {} against the scatter's {}",
                a[0],
                c[0]
            );
        }
        assert!(
            same,
            "the set's Reverb is the partitioned one, sample for sample"
        );
        assert!(
            rounded,
            "and not the scatter, from which it differs only by rounding"
        );
    }

    #[test]
    fn bridges_echo_and_reverb_as_known_devices() {
        let s = summary_of(
            r#"<Ableton MajorVersion="5"><LiveSet>
          <Tracks><AudioTrack Id="8"><Name><EffectiveName Value="A" /></Name>
            <DeviceChain><DeviceChain><Devices>
              <Echo Id="1" />
              <Reverb Id="2" />
            </Devices></DeviceChain></DeviceChain>
          </AudioTrack></Tracks>
        </LiveSet></Ableton>"#,
        );
        let mut r = bridge(&s, 48_000);
        assert!(r.warnings.is_empty(), "{:?}", r.warnings);
        let t = &mut r.graph.tracks[0];
        assert_eq!(t.devices.len(), 2);
        assert_eq!(t.devices[0].name(), "Echo");
        assert_eq!(t.devices[1].name(), "Reverb");
        // both render without panicking (unknown devices bypass, these
        // must actually process — 0.2 s so the first echo hop lands)
        t.source = vec![0.0; 9_600];
        t.source[200] = 1.0;
        t.source[201] = 1.0;
        let out = r.graph.render(48_000);
        assert!(out.iter().any(|v| *v != 0.0));
    }

    /// A part of one audio track whose chain is `devices` (each a device element as a set stores it).
    fn set_of(devices: &str) -> Element {
        xml::parse(&format!(
            r#"<Ableton MajorVersion="5"><LiveSet><Tracks><AudioTrack Id="8"><Name><EffectiveName Value="A" /></Name>
              <DeviceChain><DeviceChain><Devices>{devices}</Devices></DeviceChain></DeviceChain>
            </AudioTrack></Tracks></LiveSet></Ableton>"#
        ))
        .unwrap()
    }

    /// A setting as a set stores it.
    fn m(id: &str, value: &str) -> String {
        format!(r#"<{id}><LomId Value="0" /><Manual Value="{value}" /></{id}>"#)
    }

    /// Whether `a` and `b` sound alike, sample for sample, over a second of a tone with a step down in it.
    fn sound_alike(a: &mut dyn crate::graph::Device, b: &mut dyn crate::graph::Device) -> bool {
        let clock = Clock::start(48_000, 120.0);
        a.prepare(48_000, 2);
        b.prepare(48_000, 2);
        let w = 2.0 * std::f32::consts::PI * 1000.0 / 48_000.0;
        (0..48_000).all(|i| {
            let level = if i < 24_000 { 0.7 } else { 0.05 };
            let x = level * (w * i as f32).sin();
            let (mut l, mut r) = ([x, 0.8 * x], [x, 0.8 * x]);
            a.process(&mut l, &clock);
            b.process(&mut r, &clock);
            l == r
        })
    }

    /// O-I #849 round 15: a part's chain sounds as the set stores it. Each of the engine's models of Live's devices stands at
    /// the settings the set holds for it, and one the set holds none of at the model's own; a device the set stores off,
    /// known or not, passes its sound through as Live's does.
    #[test]
    fn a_sets_devices_sound_at_their_stored_settings_and_a_device_stored_off_passes_its_sound() {
        let root = set_of(&format!(
            concat!(
                r#"<GlueCompressor Id="1">{}{}{}{}{}</GlueCompressor><Echo Id="2">{}{}{}{}</Echo><Reverb Id="3">{}</Reverb>"#,
                r#"<Compressor2 Id="4">{}{}{}{}{}{}<SideChain>{}</SideChain></Compressor2>"#,
                r#"<GlueCompressor Id="5">{}{}</GlueCompressor><VinylWarble Id="6">{}</VinylWarble><Echo Id="7" />"#
            ),
            m("On", "true"),
            m("Threshold", "-21.9047623"),
            m("Range", "25"),
            m("Ratio", "1"),
            m("Makeup", "5"),
            m("Delay_TimeL", "0.25"),
            m("Delay_TimeR", "0.3"),
            m("Feedback", "0.3"),
            m("DryWet", "0.4"),
            m("DecayTime", "3000"),
            m("Threshold", "0.5"),
            m("Ratio", "2"),
            m("Attack", "10"),
            m("Gain", "6"),
            m("LookAhead", "0"),
            m("GainCompensation", "true"),
            m("DryWet", "0.75"),
            m("On", "false"),
            m("Threshold", "-30"),
            m("On", "false"),
        ));
        let mut r = bridge_set(&root, 48_000).unwrap();
        assert!(r.warnings.is_empty(), "{:?}", r.warnings);
        let chain = &mut r.graph.tracks[0].devices;
        assert_eq!(
            chain.iter().map(|d| d.name()).collect::<Vec<_>>(),
            [
                "GlueCompressor",
                "Echo",
                "Reverb",
                "Compressor2",
                "Bypass",
                "Bypass",
                "Echo"
            ]
        );
        let stored_glue = GlueParams {
            threshold_db: -21.9047623,
            range: 25.0,
            ratio: 1.0,
            makeup_db: 5.0,
        };
        assert!(sound_alike(
            chain[0].as_mut(),
            &mut GlueDevice::new(stored_glue)
        ));
        assert!(
            !sound_alike(chain[0].as_mut(), &mut GlueDevice::new(GLUE_FACTORY)),
            "and not as the factory's Glue"
        );
        let stored_echo = EchoParams {
            delay_time_s: 0.25,
            feedback: 0.3,
            dry_wet: 0.4,
        };
        assert!(sound_alike(
            chain[1].as_mut(),
            &mut EchoDevice::new(stored_echo)
        ));
        assert!(sound_alike(chain[2].as_mut(), reverb_of(3000.0).as_mut()));
        let mut stored_compressor = live_dynamics::compressor::DEFAULTS;
        stored_compressor.threshold = 0.5;
        stored_compressor.ratio = 2.0;
        stored_compressor.attack = 10.0;
        stored_compressor.gain = 6.0;
        stored_compressor.look_ahead = 0;
        stored_compressor.gain_compensation = true;
        stored_compressor.side_chain.dry_wet = 0.75;
        assert!(sound_alike(
            chain[3].as_mut(),
            &mut CompressorDevice::new(stored_compressor)
        ));
        // stored with no settings: the model's own
        assert!(sound_alike(
            chain[6].as_mut(),
            &mut EchoDevice::new(ECHO_FACTORY)
        ));
    }

    /// O-I #849 round 15: what the set stores that the engine's model does not take is named, device by device: a setting
    /// outside the extent the corpus's surface gives it (the model keeps its own), a Feedback the Echo's model cannot decay
    /// from, and the settings of the surface the model does not take.
    #[test]
    fn what_a_set_stores_that_the_engines_model_does_not_take_is_named() {
        let root = set_of(&format!(
            r#"<GlueCompressor Id="1">{}{}</GlueCompressor><Echo Id="2">{}{}</Echo><Reverb Id="3">{}{}</Reverb>"#,
            m("Threshold", "10"),
            m("Makeup", "5"),
            m("Feedback", "1.2"),
            m("Filter_On", "true"),
            m("DecayTime", "2000"),
            m("PreDelay", "2.49999976"),
        ));
        let mut r = bridge_set(&root, 48_000).unwrap();
        let words: Vec<(&str, &str)> = r
            .warnings
            .iter()
            .map(|w| (w.device.as_str(), w.message.as_str()))
            .collect();
        assert_eq!(
            words,
            [
                ("GlueCompressor", "Live's GlueCompressor holds its Threshold within -40 to 0, and the set stores 10: the engine keeps its own"),
                ("Echo", "the engine's model of Live's Echo decays its repeats only below a Feedback of 1, and the set stores 1.2: it keeps its own 0.5"),
                ("Echo", "the engine's model does not take its Filter_On yet: they sound as the model's own"),
                ("Reverb", "the engine's model does not take its PreDelay yet: they sound as the model's own"),
            ]
        );
        assert!(r.warnings.iter().all(|w| w.track == "A"));
        let chain = &mut r.graph.tracks[0].devices;
        let mut glue = GLUE_FACTORY;
        glue.makeup_db = 5.0;
        assert!(sound_alike(chain[0].as_mut(), &mut GlueDevice::new(glue)));
        assert!(sound_alike(
            chain[1].as_mut(),
            &mut EchoDevice::new(ECHO_FACTORY)
        ));
        assert!(sound_alike(chain[2].as_mut(), reverb_of(2000.0).as_mut()));
    }

    /// A MIDI part holding `operator` (the element's children) as its instrument.
    fn operator_set(operator: &str) -> Element {
        xml::parse(&format!(
            r#"<Ableton MajorVersion="5"><LiveSet><Tracks><MidiTrack Id="8"><Name><EffectiveName Value="Keys" /></Name>
              <DeviceChain><DeviceChain><Devices><Operator Id="1">{operator}</Operator></Devices></DeviceChain></DeviceChain>
            </MidiTrack></Tracks></LiveSet></Ableton>"#
        ))
        .unwrap()
    }

    /// A shell's or the device's settings as Operator stores them, one element holding each.
    fn shell(name: &str, settings: &[(&str, &str)], envelope: &[(&str, &str)]) -> String {
        let of = |s: &[(&str, &str)]| s.iter().map(|(id, v)| m(id, v)).collect::<String>();
        let envelope = if envelope.is_empty() {
            String::new()
        } else {
            format!("<Envelope>{}</Envelope>", of(envelope))
        };
        format!("<{name}>{}{envelope}</{name}>", of(settings))
    }

    /// `a` played as `b` plays: a note held a quarter second and let go, sample for sample.
    fn plays_alike(
        a: &mut dyn crate::graph::Instrument,
        b: &mut dyn crate::graph::Instrument,
    ) -> bool {
        let mut clock = Clock::start(48_000, 120.0);
        a.prepare(48_000);
        b.prepare(48_000);
        (0..48_000u64).all(|n| {
            clock.sample = n;
            if n == 0 {
                a.note_on(60, 1.0, &clock);
                b.note_on(60, 1.0, &clock);
            }
            if n == 12_000 {
                a.note_off(60, &clock);
                b.note_off(60, &clock);
            }
            let (mut x, mut y) = ([0f32; 2], [0f32; 2]);
            a.process(&mut x, &clock);
            b.process(&mut y, &clock);
            x == y
        })
    }

    /// O-I #849 round 16: a MIDI part's Operator plays the patch the set stores for it, as the engine's model takes it
    /// (A's level, the device's level, A's envelope), and what the model does not take is named where the set stores
    /// other than the default patch's; the default patch as Live stores it sounds as the model's own, with no word.
    #[test]
    fn an_operator_plays_the_patch_the_set_stores_and_names_what_its_model_does_not_take() {
        use live_dynamics::operator::OperatorVoiceA;
        let default_envelope = [
            ("AttackTime", "0.1000000015"),
            ("AttackLevel", "0.0003162277571"),
            ("AttackSlope", "0"),
            ("DecayTime", "1000"),
            ("DecayLevel", "1"),
            ("DecaySlope", "1"),
            ("SustainLevel", "1"),
            ("ReleaseTime", "400"),
            ("ReleaseLevel", "0.0003162277571"),
            ("ReleaseSlope", "1"),
            ("TimeVelScale", "0"),
        ];
        let default_a = [
            ("IsOn", "true"),
            ("Volume", "1"),
            ("WaveForm", "0"),
            ("Phase", "0"),
            ("Feedback", "0"),
            ("VelScale", "50"),
            ("KeyScale", "0"),
        ];
        let tune = |coarse: &str| {
            format!(
                "<Tune>{}{}{}</Tune>",
                m("Coarse", coarse),
                m("Fine", "0"),
                m("VelCoarseScale", "0")
            )
        };
        let as_live_stores_it = format!(
            "{}{}{}",
            shell("Operator.0", &default_a, &default_envelope)
                .replace("</Operator.0>", &format!("{}</Operator.0>", tune("1"))),
            shell("Operator.1", &[("Volume", "0.0003162277571")], &[]),
            shell("Globals", &[("Volume", "0.1258925349")], &[]),
        );
        let mut r = bridge_set(&operator_set(&as_live_stores_it), 48_000).unwrap();
        assert!(r.warnings.is_empty(), "{:?}", r.warnings);
        assert!(plays_alike(
            r.graph.tracks[0].instrument.as_mut().unwrap().as_mut(),
            &mut OperatorInstrument::default_patch(48_000)
        ));
        // a patch of its own: A at half, the device 6 dB up from its default, a falling envelope, and what the model
        // does not take
        let mut a = default_a;
        a[1] = ("Volume", "0.5");
        a[2] = ("WaveForm", "3");
        let mut envelope = default_envelope;
        envelope[1] = ("AttackLevel", "0.1");
        envelope[3] = ("DecayTime", "500");
        envelope[6] = ("SustainLevel", "0.06309572607");
        envelope[7] = ("ReleaseTime", "200");
        let stored = format!(
            "{}{}{}",
            shell("Operator.0", &a, &envelope)
                .replace("</Operator.0>", &format!("{}</Operator.0>", tune("2"))),
            shell("Operator.1", &[("Volume", "1")], &[]),
            shell("Globals", &[("Volume", "0.2511886432")], &[]),
        );
        let mut r = bridge_set(&operator_set(&stored), 48_000).unwrap();
        let words: Vec<(&str, &str, &str)> = r
            .warnings
            .iter()
            .map(|w| (w.track.as_str(), w.device.as_str(), w.message.as_str()))
            .collect();
        assert_eq!(
            words,
            [
                ("Keys", "Operator", "the engine's model of Live's Operator starts its attack where its release ends, and the set stores an AttackLevel of 0.1 and a ReleaseLevel of 0.0003162277571: the attack starts at 0.0003162277571"),
                ("Keys", "Operator", "its oscillator B stores a Volume of 1, and the corpus's surface of Live's Operator gives it no extent: the engine keeps B at its floor"),
                ("Keys", "Operator", "the engine's model does not take its Operator.0/Tune/Coarse, Operator.0/WaveForm yet: they sound as the model's own"),
            ]
        );
        let mut voice = OperatorVoiceA::default_patch(69, 48_000);
        voice.osc_a_level = 0.5;
        voice.globals_volume = 0.2511886432;
        voice.envelope.decay_time_s = 0.5;
        voice.envelope.decay_tau_s = live_dynamics::operator::fitted::DECAY_TAU_S * 0.5;
        voice.envelope.sustain_amp = 0.06309572607;
        voice.envelope.release_time_s = 0.2;
        let instrument = r.graph.tracks[0].instrument.as_mut().unwrap().as_mut();
        assert!(plays_alike(instrument, &mut OperatorInstrument::new(voice)));
        assert!(
            !plays_alike(instrument, &mut OperatorInstrument::default_patch(48_000)),
            "and not as the default patch"
        );
    }

    /// O-I #849 round 16: a set's group tracks are the engine's group buses, each with its row and chain, in the set's
    /// order; each part and group stands in the group its `TrackGroupId` names, and a group naming one after it in the
    /// set sounds to the Main track, in words.
    #[test]
    fn a_sets_group_tracks_are_buses_and_what_stands_in_each_is_read() {
        let track = |kind: &str, id: u32, name: &str, group: i32, inner: &str| {
            format!(
                r#"<{kind} Id="{id}"><Name><EffectiveName Value="{name}" /></Name><TrackGroupId Value="{group}" />
                  <DeviceChain><Mixer>{}{}</Mixer><DeviceChain><Devices>{inner}</Devices></DeviceChain></DeviceChain></{kind}>"#,
                m("Volume", "0.5"),
                m("Pan", "-0.25"),
            )
        };
        let root = xml::parse(&format!(
            r#"<Ableton MajorVersion="5"><LiveSet><Tracks>{}{}{}{}{}{}</Tracks></LiveSet></Ableton>"#,
            track("GroupTrack", 20, "Drums", -1, &format!(r#"<Echo Id="1">{}</Echo>"#, m("DryWet", "0.4"))),
            track("GroupTrack", 21, "Kit", 20, ""),
            track("AudioTrack", 22, "Kick", 21, ""),
            track("MidiTrack", 23, "Keys", 20, "<Operator Id=\"2\" />"),
            track("AudioTrack", 24, "Bass", -1, ""),
            track("GroupTrack", 25, "Late", 26, ""),
        ))
        .unwrap();
        let r = bridge_set(&root, 48_000).unwrap();
        let g = &r.graph;
        assert_eq!(
            g.groups
                .iter()
                .map(|x| (x.name.as_str(), x.group, x.gain, x.pan, x.devices.len()))
                .collect::<Vec<_>>(),
            [
                ("Drums", None, 0.5, -0.25, 1),
                ("Kit", Some(0), 0.5, -0.25, 0),
                ("Late", None, 0.5, -0.25, 0)
            ]
        );
        assert_eq!(g.groups[0].devices[0].name(), "Echo");
        assert_eq!(
            g.tracks
                .iter()
                .map(|t| (t.name.as_str(), t.group))
                .collect::<Vec<_>>(),
            [("Kick", Some(1)), ("Keys", Some(0)), ("Bass", None)]
        );
        let words: Vec<(&str, &str)> = r
            .warnings
            .iter()
            .map(|w| (w.track.as_str(), w.message.as_str()))
            .collect();
        assert_eq!(
            words,
            [] as [(&str, &str); 0],
            "a group naming no group of the set stands in none"
        );
        // one naming a group after it in the set
        let root = xml::parse(&format!(
            r#"<Ableton MajorVersion="5"><LiveSet><Tracks>{}{}</Tracks></LiveSet></Ableton>"#,
            track("GroupTrack", 30, "First", 31, ""),
            track("GroupTrack", 31, "Second", -1, ""),
        ))
        .unwrap();
        let r = bridge_set(&root, 48_000).unwrap();
        assert_eq!(r.graph.groups[0].group, Some(1));
        let words: Vec<(&str, &str)> = r
            .warnings
            .iter()
            .map(|w| (w.track.as_str(), w.message.as_str()))
            .collect();
        assert_eq!(
            words,
            [("First", "group track: it stands in a group after it in the set, so it sounds to the Main track")]
        );
    }

    /// O-I #849 round 17: a Glue stored at Ratio 0 or 2 sounds that Ratio's own curve (glue.rs `measured_curve_of`), not
    /// Ratio 1's; one stored between Live's three curves sounds the nearer, in words.
    #[test]
    fn a_glue_stored_at_another_ratio_sounds_its_curve_and_one_between_curves_is_named() {
        let root = set_of(&format!(
            r#"<GlueCompressor Id="1">{}{}{}</GlueCompressor><GlueCompressor Id="2">{}{}{}</GlueCompressor>"#,
            m("Threshold", "-12"),
            m("Range", "30"),
            m("Ratio", "0"),
            m("Threshold", "-12"),
            m("Range", "30"),
            m("Ratio", "1.5"),
        ));
        let mut r = bridge_set(&root, 48_000).unwrap();
        let at = |ratio: f64| GlueParams {
            threshold_db: -12.0,
            range: 30.0,
            ratio,
            makeup_db: 0.0,
        };
        let chain = &mut r.graph.tracks[0].devices;
        assert!(sound_alike(
            chain[0].as_mut(),
            &mut GlueDevice::new(at(0.0))
        ));
        assert!(
            !sound_alike(chain[0].as_mut(), &mut GlueDevice::new(at(1.0))),
            "and not as Ratio 1"
        );
        assert!(sound_alike(
            chain[1].as_mut(),
            &mut GlueDevice::new(at(2.0))
        ));
        let words: Vec<&str> = r.warnings.iter().map(|w| w.message.as_str()).collect();
        assert_eq!(
            words,
            ["Live's GlueCompressor stores its Ratio as one of its three curves, 0, 1 and 2, and the set stores 1.5: the engine sounds curve 2"]
        );
    }

    /// O-I #849 round 17: the device a set's owner wrote a setting of is found as the owner finds it (the first of its
    /// name on the first track of that name, "Master" the Main track), made as Play makes it from what the set stores, and
    /// placed as the engine holds it: a part's, a return's or a group's by its index among them, past a MIDI part's
    /// instrument. A part's instrument, and what the set does not have, is refused in words.
    #[test]
    fn a_device_the_sets_owner_wrote_is_made_as_play_makes_it_and_placed_as_the_engine_holds_it() {
        let track = |kind: &str, id: u32, name: &str, devices: &str| {
            format!(
                r#"<{kind} Id="{id}"><Name><EffectiveName Value="{name}" /></Name>
                  <DeviceChain><Mixer /><DeviceChain><Devices>{devices}</Devices></DeviceChain></DeviceChain></{kind}>"#
            )
        };
        let glue = |id: u32, threshold: &str| {
            format!(
                r#"<GlueCompressor Id="{id}">{}{}</GlueCompressor>"#,
                m("Threshold", threshold),
                m("Range", "30")
            )
        };
        let root = xml::parse(&format!(
            r#"<Ableton MajorVersion="5"><LiveSet><Tracks>{}{}{}{}{}</Tracks>
              <MainTrack><DeviceChain><Mixer /><DeviceChain><Devices><Compressor2 Id="40" /></Devices></DeviceChain></DeviceChain></MainTrack>
            </LiveSet></Ableton>"#,
            track("AudioTrack", 1, "Drums", &glue(2, "-20")),
            track("GroupTrack", 3, "Bus", &format!(r#"<Reverb Id="4">{}</Reverb>"#, m("On", "false"))),
            track(
                "MidiTrack",
                5,
                "Keys",
                &format!(r#"<Echo Id="6" /><Operator Id="7" />{}{}"#, glue(8, "-24"), glue(9, "-6"))
            ),
            track("ReturnTrack", 10, "A-Echo", r#"<Echo Id="11" />"#),
            track("MidiTrack", 12, "Keys", &glue(13, "-3")),
        ))
        .unwrap();
        let made = |track: &str, device: &str| set_device(&root, track, device, None);
        let placed = |track: &str, device: &str| {
            let d = made(track, device).unwrap_or_else(|e| panic!("{track} {device}: {e}"));
            (d.part, d.at, d.device.name().to_string())
        };
        assert_eq!(
            placed("Drums", "GlueCompressor"),
            (Part::Track(0), 0, "GlueCompressor".into())
        );
        assert_eq!(
            placed("Bus", "Reverb"),
            (Part::Group(0), 0, "Bypass".into()),
            "stored off, it passes its sound through"
        );
        assert_eq!(placed("Keys", "Echo"), (Part::Track(1), 0, "Echo".into()));
        assert_eq!(
            placed("Keys", "GlueCompressor"),
            (Part::Track(1), 1, "GlueCompressor".into()),
            "past the instrument, the first of its name on the first track of its name"
        );
        assert_eq!(
            placed("A-Echo", "Echo"),
            (Part::Return(0), 0, "Echo".into())
        );
        assert_eq!(
            placed("Master", "Compressor2"),
            (Part::Main, 0, "Compressor2".into())
        );
        // made at what the set stores: the Keys Glue's −24 dB threshold, and not the second one's −6
        let mut keys = made("Keys", "GlueCompressor").unwrap();
        let stored = |threshold_db: f64| {
            GlueDevice::new(GlueParams {
                threshold_db,
                range: 30.0,
                ..GLUE_FACTORY
            })
        };
        assert!(sound_alike(keys.device.as_mut(), &mut stored(-24.0)));
        assert!(!sound_alike(keys.device.as_mut(), &mut stored(-6.0)));
        assert_eq!(
            keys.element.attr("Id"),
            Some("8"),
            "the element it was made from, to make again"
        );
        for (track, device, words) in [
            ("Keys", "Operator", "the Operator on 'Keys' is its instrument, which the engine makes when the set is played: the edit is heard from the next Play"),
            ("Pads", "Echo", "the set has no track named 'Pads'"),
            ("Drums", "Echo", "'Drums' holds no Echo on its chain"),
        ] {
            assert_eq!(made(track, device).err().as_deref(), Some(words), "{track} {device}");
        }
        // DLW build ruling 2026-11-05: named at its place on the chain (the instrument counted, as the set's owner
        // writes it), the second of two Glues is itself, made at what it stores and placed past the instrument
        let at = |device: &str, at: usize| set_device(&root, "Keys", device, Some(at));
        let mut second = at("GlueCompressor", 3).unwrap();
        assert_eq!((second.part, second.at), (Part::Track(1), 2));
        assert_eq!(second.element.attr("Id"), Some("9"));
        assert!(sound_alike(second.device.as_mut(), &mut stored(-6.0)));
        let first = at("GlueCompressor", 2).unwrap();
        assert_eq!((first.at, first.element.attr("Id")), (1, Some("8")));
        assert_eq!(
            at("Echo", 0).unwrap().at,
            0,
            "before the instrument, its place is its own"
        );
        for (device, place, words) in [
            ("GlueCompressor", 1, "the device at place 1 on 'Keys' is an Operator, not a GlueCompressor"),
            ("Operator", 1, "the Operator on 'Keys' is its instrument, which the engine makes when the set is played: the edit is heard from the next Play"),
            ("GlueCompressor", 7, "'Keys' holds no device at place 7 on its chain"),
        ] {
            assert_eq!(at(device, place).err().as_deref(), Some(words), "{device} at {place}");
        }
    }

    /// O-I #849 round 17: each part's and group's output is read as the set routes it. One routed to its group sounds
    /// into it; one routed to the Main track skips the group it stands in; one routed elsewhere sounds where Live's
    /// default would put it, named in words by Live's own name for where it goes.
    #[test]
    fn a_parts_and_a_groups_output_routing_is_read() {
        let track = |kind: &str, id: u32, name: &str, group: i32, target: &str, shown: &str| {
            format!(
                r#"<{kind} Id="{id}"><Name><EffectiveName Value="{name}" /></Name><TrackGroupId Value="{group}" />
                  <DeviceChain><AudioOutputRouting><Target Value="{target}" /><UpperDisplayString Value="{shown}" />
                  <LowerDisplayString Value="" /></AudioOutputRouting><Mixer /></DeviceChain></{kind}>"#
            )
        };
        let root = xml::parse(&format!(
            r#"<Ableton MajorVersion="5"><LiveSet><Tracks>{}{}{}{}{}</Tracks></LiveSet></Ableton>"#,
            track("GroupTrack", 20, "Bus", -1, "AudioOut/Main", "Main"),
            track("GroupTrack", 21, "Inner", 20, "AudioOut/Main", "Main"),
            track("AudioTrack", 22, "Kick", 21, "AudioOut/GroupTrack", "Group"),
            track("MidiTrack", 23, "Keys", 20, "AudioOut/Master", "Master"),
            track(
                "AudioTrack",
                24,
                "Ext",
                20,
                "AudioOut/External/S2",
                "Ext. Out"
            ),
        ))
        .unwrap();
        let r = bridge_set(&root, 48_000).unwrap();
        let g = &r.graph;
        assert_eq!(
            g.groups
                .iter()
                .map(|x| (x.name.as_str(), x.group))
                .collect::<Vec<_>>(),
            [("Bus", None), ("Inner", None)],
            "a group routed to the Main track skips the group it stands in"
        );
        assert_eq!(
            g.tracks
                .iter()
                .map(|t| (t.name.as_str(), t.group))
                .collect::<Vec<_>>(),
            [("Kick", Some(1)), ("Keys", None), ("Ext", Some(0))]
        );
        let words: Vec<(&str, &str)> = r
            .warnings
            .iter()
            .filter(|w| !w.message.contains("MIDI part with no instrument"))
            .map(|w| (w.track.as_str(), w.message.as_str()))
            .collect();
        assert_eq!(
            words,
            [(
                "Ext",
                "its output goes to Ext. Out, which the engine does not route: it sounds to its group"
            )]
        );
    }

    /// Live's devices on a rack's chain as the engine's own (O-I #849 rounds 13 and 14): Reverb at a
    /// carried DecayTime; Compressor at the corpus's values and the settings carried; Auto Filter and
    /// Delay built to the Torus's effects from the settings they need; a setting a model does not take,
    /// one Live's device does not hold and one a model needs and is not given are refused, each in words.
    #[test]
    fn a_rack_chains_live_devices_are_the_engines_own_or_refused_in_words() {
        let reverb = rack_device("Reverb", &[("DecayTime", 2400.0)]).unwrap();
        assert_eq!(reverb.device.name(), "Reverb");
        assert_eq!(reverb.made_from, "Reverb DecayTime=2400");
        assert_eq!(rack_device("Reverb", &[]).unwrap().made_from, "Reverb");
        let clock = Clock::start(48_000, 120.0);
        // a chain's device sounds as the model made from what it was carried, sample for sample
        let same = |mut made: RackDevice, mut model: Box<dyn crate::graph::Device>| {
            made.device.prepare(48_000, 2);
            model.prepare(48_000, 2);
            (0..9_600u32).all(|n| {
                let x = ((n * 7919 % 211) as f32 / 211.0 - 0.5) * 0.8;
                let (mut a, mut b) = ([x, -x], [x, -x]);
                made.device.process(&mut a, &clock);
                model.process(&mut b, &clock);
                a[0].to_bits() == b[0].to_bits() && a[1].to_bits() == b[1].to_bits()
            })
        };
        let compressor = rack_device("Compressor2", &[]).unwrap();
        assert_eq!(compressor.device.name(), "Compressor2");
        let settings = [
            ("Threshold", 0.25),
            ("Ratio", 4.0),
            ("Attack", 1.0),
            ("Release", 100.0),
            ("Gain", 2.0),
            ("Knee", 0.0),
        ];
        let carried = rack_device("Compressor2", &settings).unwrap();
        assert_eq!(
            carried.made_from,
            "Compressor2 Threshold=0.25 Ratio=4 Attack=1 Release=100 Gain=2 Knee=0"
        );
        let model = live_dynamics::compressor::CompressorParams {
            threshold: 0.25,
            ratio: 4.0,
            attack: 1.0,
            release: 100.0,
            gain: 2.0,
            knee: 0.0,
            ..live_dynamics::compressor::DEFAULTS
        };
        assert!(same(carried, Box::new(CompressorDevice::new(model))));
        let unmoved = rack_device("Compressor2", &[]).unwrap();
        assert!(
            !same(unmoved, Box::new(CompressorDevice::new(model))),
            "the carried settings move the Compressor"
        );
        let filter = [
            ("FilterType", 2.0),
            ("Cutoff", auto_filter_cutoff(1500.0)),
            ("Resonance", 0.4),
            ("Drive", 6.0),
        ];
        let made = rack_device("AutoFilter", &filter).unwrap();
        assert_eq!(made.device.name(), "AutoFilter");
        assert!(same(
            made,
            Box::new(FilterDevice::new(FilterParams {
                kind: FilterKind::Bandpass,
                cutoff_hz: auto_filter_hz(auto_filter_cutoff(1500.0)),
                resonance: 0.4,
                drive_db: 6.0,
            }))
        ));
        assert!((auto_filter_hz(20.0) - 25.956_543_598_746_574).abs() < 1e-9);
        assert!((auto_filter_hz(135.0) - 19_912.126_958_213_175).abs() < 1e-6);
        let delay = [
            ("DelayLine_TimeL", 0.25),
            ("Feedback", 0.35),
            ("Filter_Frequency", 6000.0),
            ("DryWet", 0.25),
        ];
        let made = rack_device("Delay", &delay).unwrap();
        assert_eq!(made.device.name(), "Delay");
        assert!(same(
            made,
            Box::new(DelayDevice::new(DelayParams {
                time_s: 0.25,
                feedback: 0.35,
                tone_hz: 6000.0,
                mix: 0.25,
            }))
        ));
        for (class, carried, words) in [
            (
                "AutoFilter",
                &filter[..3],
                "the engine's model of Live's Auto Filter sounds the Torus's Filter from its FilterType, Cutoff, Resonance, Drive, and no Drive is carried",
            ),
            (
                "Delay",
                &[][..],
                "the engine's model of Live's Delay sounds the Torus's Delay from its DelayLine_TimeL, Feedback, Filter_Frequency, DryWet, and no DelayLine_TimeL is carried",
            ),
            (
                "AutoFilter",
                &[("FilterType", 3.0), ("Cutoff", 100.0), ("Resonance", 0.2), ("Drive", 0.0)][..],
                "the engine's model of Live's Auto Filter sounds its FilterType 0, 1, 2 or 4 (low-pass, high-pass, band-pass, notch), not 3",
            ),
            (
                "AutoFilter",
                &[("FilterType", 0.0), ("Cutoff", 140.0), ("Resonance", 0.2), ("Drive", 0.0)][..],
                "Live's Auto Filter holds its Cutoff within 20 to 135, not 140",
            ),
            (
                "Delay",
                &[("DelayLine_TimeL", 0.25), ("Feedback", 0.99), ("Filter_Frequency", 6000.0), ("DryWet", 0.25)][..],
                "Live's Delay holds its Feedback within 0 to 0.9499999881, not 0.99",
            ),
            (
                "Compressor2",
                &[("Threshold", 0.0)][..],
                "Live's Compressor holds its Threshold within 0.0003162277571 to 1.99526238, not 0",
            ),
            (
                "Compressor2",
                &[("DryWet", 0.5)][..],
                "the engine's model of Live's Compressor does not take its DryWet yet",
            ),
            (
                "Delay",
                &[("Freeze", 1.0)][..],
                "the engine's model of Live's Delay does not take its Freeze yet",
            ),
            ("Eq8", &[][..], "Live's Eq8 has no model in the engine yet"),
        ] {
            assert_eq!(rack_device(class, carried).unwrap_err(), words);
        }
        assert_eq!(
            rack_device("Reverb", &[("PreDelay", 20.0)]).unwrap_err(),
            "the engine's model of Live's Reverb does not take its PreDelay yet"
        );
        assert!(rack_device("Reverb", &[("DecayTime", 0.0)]).is_err());
        // the reverb rings what it is given, every sample, in real time: a dense second renders
        let mut r = rack_device("Reverb", &[("DecayTime", 600.0)]).unwrap();
        r.device.prepare(48_000, 2);
        let started = std::time::Instant::now();
        let mut heard = 0f32;
        for n in 0..48_000 {
            let mut frame = [((n % 97) as f32 / 97.0) - 0.5; 2];
            r.device.process(&mut frame, &clock);
            heard = heard.max(frame[0].abs());
        }
        assert!(heard > 0.0);
        assert!(
            started.elapsed() < std::time::Duration::from_secs(20),
            "{:?}",
            started.elapsed()
        );
    }

    /// The frame's measure input (lane BB's scratch measure, rounds 14 and 15): half a second of silence, then 0.6 s of 220 Hz with
    /// three overtones, faded 5 ms at each end, at 0.35; or, for `step`, at 0.5 for 0.3 s and then 12 dB down (over 1 ms).
    fn frame_measure_input(step: bool, seconds: f64) -> Vec<f32> {
        let mut x = vec![0f32; (seconds * 48_000.0) as usize];
        for i in 0..28_800usize {
            let t = i as f64 / 48_000.0;
            let fade = (i as f64 / 240.0).min((28_800 - i) as f64 / 240.0).min(1.0);
            let partials = [1.0, 0.5, 1.0 / 3.0, 0.25]
                .iter()
                .enumerate()
                .fold(0.0, |s, (h, a)| {
                    s + a * (2.0 * std::f64::consts::PI * 220.0 * (h + 1) as f64 * t).sin()
                });
            let level = if step {
                let down = ((i as f64 - 14_400.0) / 48.0).clamp(0.0, 1.0);
                0.5 - 0.375 * down
            } else {
                0.35
            };
            x[24_000 + i] = (level * fade * partials) as f32;
        }
        x
    }

    /// `input` on both sides through `device`, each side's output.
    fn through(device: &mut RackDevice, input: &[f32]) -> [Vec<f32>; 2] {
        let clock = Clock::start(48_000, 120.0);
        device.device.prepare(48_000, 2);
        let mut out = [
            Vec::with_capacity(input.len()),
            Vec::with_capacity(input.len()),
        ];
        for x in input {
            let mut frame = [*x; 2];
            device.device.process(&mut frame, &clock);
            out[0].push(frame[0]);
            out[1].push(frame[1]);
        }
        out
    }

    /// The level, dB RMS, of `sides` from `a` to `b` seconds, over `frames` frames (the window's own when none).
    fn level_db(sides: &[&[f32]], (a, b): (f64, f64), frames: Option<usize>) -> f64 {
        let (s, e) = (
            (a * 48_000.0).round() as usize,
            (b * 48_000.0).round() as usize,
        );
        let energy: f64 = sides
            .iter()
            .flat_map(|side| side[s..e].iter())
            .map(|v| f64::from(*v).powi(2))
            .sum();
        10.0 * (energy / (sides.len() * frames.unwrap_or(e - s)) as f64).log10()
    }

    /// The windows of the frame's measure (seconds): the onset, the held note (or its loud half), the step down and after it, the end.
    const FRAME_WINDOWS: [(f64, f64); 5] = [
        (0.5, 0.52),
        (0.52, 0.8),
        (0.8, 0.85),
        (0.85, 1.1),
        (1.1, 1.5),
    ];

    /// O-I #849 round 15: the Torus's Dynamics on a rack's chain, made by the frame's name for it from the frame's settings, is the
    /// frame's own compressor (the browser's DynamicsCompressorNode at a hard knee, then the frame's makeup), and comes to the frame's
    /// level within 0.1 dB in every case, over the whole render and window by window: at its opening values, hard, slow, gentle and
    /// deep, on a held note and on one that steps 12 dB down while it sounds (so the compressor lets go at its release). The reference
    /// is the frame's own render of the same input: presentationEffects.ts in headless Chromium, an OfflineAudioContext at 48 kHz, 4.5 s
    /// (lane BB's scratch measure, round 15); the browser's compressor ran from its reset state, as the engine's device does.
    #[test]
    fn the_torus_dynamics_comes_to_the_frames_level_in_every_case() {
        // (threshold dB, ratio, attack ms, release ms, makeup dB), and the frame's level over 4.5 s and in each window, held and stepped
        type Golden = (f64, [f64; 5]);
        let cases: [(&str, [f64; 5], Golden, Golden); 5] = [
            (
                "opening",
                [-12.0, 4.0, 1.0, 100.0, 2.0],
                (-22.0857, [-15.9045, -13.3041, -13.2920, -13.2902, -33.5274]),
                (-23.1904, [-15.0887, -12.4770, -18.1311, -17.6380, -38.0995]),
            ),
            (
                "hard",
                [-30.0, 10.0, 5.0, 250.0, 8.0],
                (-32.5591, [-25.0848, -23.8014, -23.8047, -23.8020, -43.5811]),
                (-33.2069, [-24.6685, -23.4189, -28.4293, -25.3833, -45.1154]),
            ),
            (
                "slow",
                [-18.0, 3.0, 30.0, 400.0, 4.0],
                (-22.8056, [-12.4695, -14.0679, -14.2240, -14.2238, -34.6866]),
                (-23.5258, [-10.1699, -12.8325, -19.5730, -19.4110, -38.3401]),
            ),
            (
                "gentle",
                [-8.0, 2.0, 10.0, 50.0, 2.0],
                (-18.3714, [-12.0924, -9.5898, -9.5784, -9.5782, -29.9426]),
                (-19.1672, [-10.2316, -7.8219, -14.1705, -17.5392, -38.0995]),
            ),
            (
                "deep",
                [-40.0, 20.0, 0.5, 1000.0, 20.0],
                (-31.9523, [-25.6437, -23.1716, -23.1615, -23.1598, -43.4604]),
                (-33.5195, [-25.4801, -23.0059, -29.4524, -27.2289, -44.8430]),
            ),
        ];
        let mut worst = 0f64;
        for (name, [threshold, ratio, attack, release, makeup], held, stepped) in cases {
            let settings = [
                ("threshold", threshold),
                ("ratio", ratio),
                ("attack", attack),
                ("release", release),
                ("makeup", makeup),
            ];
            for (step, (whole, windows)) in [(false, held), (true, stepped)] {
                let mut made = rack_device("dynamics", &settings).unwrap();
                assert_eq!(made.device.name(), "Dynamics");
                let out = through(&mut made, &frame_measure_input(step, 1.5));
                let sides = [&out[0][..], &out[1][..]];
                assert_eq!(
                    out[0], out[1],
                    "{name}: one input on both sides is one output"
                );
                // the frame's render is silent after its last window: the whole level is the 4.5 s one
                let at = [(
                    whole,
                    level_db(&sides, (0.0, 1.5), Some(4 * 48_000 + 24_000)),
                )]
                .into_iter()
                .chain(
                    windows
                        .iter()
                        .zip(FRAME_WINDOWS)
                        .map(|(frame, w)| (*frame, level_db(&sides, w, None))),
                );
                for (n, (frame, engine)) in at.enumerate() {
                    worst = worst.max((engine - frame).abs());
                    assert!(
                        (engine - frame).abs() < 0.1,
                        "{name}{}: window {n} at {engine:.4} dB, the frame's at {frame:.4} dB",
                        if step { " stepped" } else { "" }
                    );
                }
            }
        }
        eprintln!("the Torus's Dynamics, against the frame: at worst {worst:.4} dB");
    }

    /// O-I #849 round 15: the Torus's Reverb on a rack's chain, made by the frame's name for it from the frame's settings, is the
    /// frame's own room (presentationEffects.ts reverbImpulse, normalised as the browser's ConvolverNode normalises it, after the
    /// pre-delay's DelayNode, blended by Dry/wet), convolved by partitions, each side through its own half of the room; and comes to the
    /// frame's level within 0.1 dB, side by side and window by window, at its opening values, a wide room and a small one. The reference is
    /// the frame's own render (as for the Dynamics, above).
    #[test]
    fn the_torus_reverb_comes_to_the_frames_level_side_by_side() {
        // (size %, decay s, damping %, pre-delay ms, dry/wet %), and the frame's level of each side over 0–2 s and in each window to 2 s
        type Sides = [(f64, f64); 7];
        let cases: [(&str, [f64; 5], Sides); 3] = [
            (
                "opening",
                [50.0, 2.4, 40.0, 20.0, 22.0],
                [
                    (-18.1199, -18.2521),
                    (-13.3864, -13.3864),
                    (-12.8343, -12.8988),
                    (-12.6944, -13.1272),
                    (-13.0145, -13.1477),
                    (-34.0979, -37.5190),
                    (-48.7047, -45.5379),
                ],
            ),
            (
                "wide",
                [90.0, 6.0, 80.0, 100.0, 60.0],
                [
                    (-20.5401, -21.2847),
                    (-19.1871, -19.1871),
                    (-18.0493, -18.0732),
                    (-17.8610, -19.6994),
                    (-17.6450, -17.0284),
                    (-17.8660, -21.8182),
                    (-25.6024, -23.6640),
                ],
            ),
            (
                "small",
                [10.0, 0.4, 0.0, 0.0, 100.0],
                [
                    (-39.0930, -32.4162),
                    (-37.8991, -30.4267),
                    (-33.6288, -27.1515),
                    (-35.0762, -27.4071),
                    (-34.9828, -27.4108),
                    (-41.7263, -39.5572),
                    (-98.8151, -101.7916),
                ],
            ),
        ];
        let input = frame_measure_input(false, 2.0);
        let mut worst = 0f64;
        for (name, [size, decay, damping, predelay, mix], frame) in cases {
            let settings = [
                ("size", size),
                ("decay", decay),
                ("damping", damping),
                ("predelay", predelay),
                ("mix", mix),
            ];
            let mut made = rack_device("reverb", &settings).unwrap();
            assert_eq!(made.device.name(), "Reverb");
            let out = through(&mut made, &input);
            let windows = [(0.0, 2.0)]
                .into_iter()
                .chain(FRAME_WINDOWS)
                .chain([(1.5, 2.0)]);
            for (n, (w, (left, right))) in windows.zip(frame).enumerate() {
                for (side, frame) in [(0, left), (1, right)] {
                    let engine = level_db(&[&out[side][..]], w, None);
                    worst = worst.max((engine - frame).abs());
                    assert!(
                        (engine - frame).abs() < 0.1,
                        "{name}: side {side}, window {n} at {engine:.4} dB, the frame's at {frame:.4} dB"
                    );
                }
            }
        }
        eprintln!("the Torus's Reverb, against the frame: at worst {worst:.4} dB");
    }
}
