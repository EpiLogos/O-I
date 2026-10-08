//! Typed parameter descriptions for the shell's device panels.
//!
//! Clean-room source rule (binding, mirrors the README): every table below is
//! written only from the behavior dossiers `devices/*.md` and the
//! parameter-table / preset-XML evidence under `evidence/devices/` — each
//! table constant names its sources in a comment. Nothing here derives from
//! binary decompilations.
//!
//! Conventions:
//! - `ParamDesc::id` is the XML/LOM element name exactly as it appears in the
//!   preset evidence (the document-model key a panel automates).
//! - `stored_min` / `stored_max` are the **stored** document-model extents:
//!   the element's `MidiControllerRange` for continuous parameters, the menu
//!   index extent for discrete parameters, and 0..1 (false..true) for toggles.
//! - `ui_name` for GlueCompressor is the **observed** device-panel name
//!   (parameter-table evidence, running-app screenshot column). Echo and
//!   Reverb have no observed-UI evidence; their `ui_name` is a mechanical
//!   display form of the element name (spaces at camel-case boundaries,
//!   L/R shown in parentheses).
//! - `unit` is the *stored* unit where the dossier pins one (dB, s, ms, Hz);
//!   empty where the stored semantic is unitless or unresolved. For the
//!   devices added 2026-10-07 (no behavior dossiers exist) the only unit
//!   claim is "Hz" on elements whose name says frequency/crossover — the
//!   ranges corroborate it; everything else stays empty.
//! - Nested parameters (EQ8 bands, AutoFilter/AutoPan LFO hub) use document
//!   **paths** as ids (`Bands.0/ParameterA/Freq`, `Lfo/Phase`), exactly as
//!   the preset XML nests them.
//! - Discrete menus: the factory XML stores bare integers with no menu
//!   structure and no labels, so a row is Discrete only with "?" labels and
//!   an extent equal to the highest stored value observed across the cited
//!   evidence — an explicit lower bound, noted per row. Integer steppers
//!   that carry a continuous `MidiControllerRange` (division selectors,
//!   character steppers) are modeled Continuous with a quantize note.
//! - The factory preset .adv files are gzip XML; every unpacked copy cited
//!   below lives under
//!   `docs/research/ableton-live-12.0.25/evidence/devices/<Device>/`.

/// How a parameter takes values.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ParamKind {
    /// Free value between `stored_min` and `stored_max`.
    Continuous,
    /// Menu with the given entry labels, indexed `stored_min..=stored_max`
    /// (labels.len() == (stored_max - stored_min) as usize + 1).
    Discrete { labels: &'static [&'static str] },
    /// On/off parameter; stored 0..1.
    Toggle,
}

/// One panel parameter: identity, stored range, unit, kind, semantics note.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct ParamDesc {
    /// XML/LOM element name (document-model key).
    pub id: &'static str,
    /// Display name for the panel (see the module provenance conventions).
    pub ui_name: &'static str,
    /// Stored document-model minimum (inclusive).
    pub stored_min: f64,
    /// Stored document-model maximum (inclusive).
    pub stored_max: f64,
    /// Stored unit ("dB", "s", "ms", "Hz", …); empty if unitless/unresolved.
    pub unit: &'static str,
    /// Continuous / menu / toggle.
    pub kind: ParamKind,
    /// Semantics and provenance note (dossier verdict the panel should honor).
    pub notes: &'static str,
}

/// Glue Compressor parameter table.
///
/// Sources: `evidence/devices/GlueCompressor/parameter-table.md`
/// (element names, Manual values, MidiControllerRange extents, observed UI
/// names — factory preset "Mastering - gentle limiter", cross-checked
/// against the running-app screenshot 2026-10-07) and
/// `devices/glue-compressor.md` (semantics: Range = soft GR ceiling — D1
/// verdict; Ratio = curve-family selector, no display-ratio law — D1-final;
/// Makeup additive — D2; Attack/Release menus and the ballistics caveat —
/// D6 and the dossier's parameter-law section).
pub const GLUE_COMPRESSOR: &[ParamDesc] = &[
    ParamDesc {
        id: "Threshold",
        ui_name: "Threshold",
        stored_min: -40.0,
        stored_max: 0.0,
        unit: "dB",
        kind: ParamKind::Continuous,
        notes: "stored in dB, used directly; curve is threshold-referenced \
                (threshold-shift invariance, high confidence)",
    },
    ParamDesc {
        id: "Range",
        ui_name: "Range",
        stored_min: 0.0,
        stored_max: 70.0,
        unit: "dB",
        kind: ParamKind::Continuous,
        notes: "semantic: soft gain-reduction ceiling in dB (D1 verdict, high \
                confidence) — asymptotic approach, never a hard clamp; R60 ≡ R30",
    },
    ParamDesc {
        id: "Ratio",
        ui_name: "Ratio",
        stored_min: 0.0,
        stored_max: 2.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["0", "1", "2"] },
        notes: "3-entry discrete menu; each stored index selects a curve \
                family, not an n:1 number — no display-ratio law exists \
                (D1-final refuted limiter asymptote and both fixed-ratio maps)",
    },
    ParamDesc {
        id: "Makeup",
        ui_name: "Makeup",
        stored_min: 0.0,
        stored_max: 20.0,
        unit: "dB",
        kind: ParamKind::Continuous,
        notes: "exactly additive feedforward gain (D2 verdict: MU5 = MU0 + 5 dB \
                at every measured point)",
    },
    ParamDesc {
        id: "Attack",
        ui_name: "Attack",
        stored_min: 0.0,
        stored_max: 6.0,
        unit: "ms",
        kind: ParamKind::Discrete {
            labels: &["0.082", "0.82", "2.7", "8.2", "27", "82", "270"],
        },
        notes: "menu table {82, 820, 2700, 8200, 27000, 82000, 270000} µs in \
                the dossier's parameter-law section, shown here in ms \
                (0.082..270); ballistics-aware — shifts the steady-state \
                transfer, not just transients (D6)",
    },
    ParamDesc {
        id: "Release",
        ui_name: "Release",
        stored_min: 0.0,
        stored_max: 6.0,
        unit: "",
        kind: ParamKind::Discrete {
            labels: &["170690", "249580", "340761", "478756", "643902", "880000", "91000"],
        },
        notes: "menu table exactly as stated in the dossier's parameter-law \
                section; stored 6 is a special case (extra constants); the µs \
                reading is pending reconciliation with the measured release τ = \
                80/160/302 ms at stored 0/2/4 (release-probe); shifts \
                steady-state GR (D6)",
    },
    ParamDesc {
        id: "DryWet",
        ui_name: "Dry/Wet",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "crossfade, not a sum (ramped per block)",
    },
    ParamDesc {
        id: "PeakClipIn",
        ui_name: "Soft (clip)",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "output clipper: measured ceiling −0.50 dBFS when on (G5 \
                forensics, flat tops); off = unclipped device output",
    },
];

/// Echo parameter table (delay core + Filter and Reverb sections).
///
/// Sources: `evidence/devices/Echo/preset-time-travel.xml` (element names,
/// Manual values, MidiControllerRange extents — factory preset "Time Travel
/// Echo") and `devices/echo.md` (stored `Delay_Time` unit = SECONDS,
/// free-mode verified E5/E6, high confidence; `Feedback` = linear gain,
/// one application per hop from tap 3; `ChannelMode=1` = pingpong L-first;
/// `DryWet=1` removes the direct — crossfade). Filter and Reverb sections
/// are included as present in the preset XML; their stored semantics beyond
/// the ranges are not measured (dossier limitations).
pub const ECHO: &[ParamDesc] = &[
    ParamDesc {
        id: "Delay_SyncL",
        ui_name: "Sync (L)",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "true = tempo-synced (Delay_SyncedDivision/Sixteenth/SyncMode \
                drive the time); false = free, Delay_TimeL in seconds",
    },
    ParamDesc {
        id: "Delay_TimeL",
        ui_name: "Delay Time (L)",
        stored_min: 0.001000000047,
        stored_max: 2.5,
        unit: "s",
        kind: ParamKind::Continuous,
        notes: "stored unit = SECONDS (dossier, high confidence: free-mode taps \
                land exactly at the stored values); inert while synced",
    },
    ParamDesc {
        id: "Delay_SyncR",
        ui_name: "Sync (R)",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "true = tempo-synced; false = free, Delay_TimeR in seconds",
    },
    ParamDesc {
        id: "Delay_TimeR",
        ui_name: "Delay Time (R)",
        stored_min: 0.001000000047,
        stored_max: 2.5,
        unit: "s",
        kind: ParamKind::Continuous,
        notes: "stored unit = SECONDS (dossier, high confidence); pingpong hop \
                = min(Delay_TimeL, Delay_TimeR), same-channel repeats at 2×hop",
    },
    ParamDesc {
        id: "Feedback",
        ui_name: "Feedback",
        stored_min: 0.0,
        stored_max: 1.5,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "linear gain (not dB), applied once per hop in the recirculating \
                path; taps 1–2 are first-pass (FB-invariant); >1.0 \
                (self-oscillation) untested",
    },
    ParamDesc {
        id: "ChannelMode",
        ui_name: "Channel Mode",
        stored_min: 0.0,
        stored_max: 2.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "PingPong", "?"] },
        notes: "only stored 1 is documented (pingpong, L-first alternation — \
                echo.md E-series, high confidence on the pattern); the 0..2 \
                extent and the other entries are NOT dossier-verified (the \
                preset XML carries no MidiControllerRange for discrete elements)",
    },
    ParamDesc {
        id: "DryWet",
        ui_name: "Dry/Wet",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "crossfade, not a sum: at 1 the dry path is removed entirely \
                (E8 — no direct signal)",
    },
    ParamDesc {
        id: "Filter_On",
        ui_name: "Filter On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "gates the HP/LP filter section; dominant level factor in the \
                measured impulse response (E8 decomposition)",
    },
    ParamDesc {
        id: "Filter_HighPassFrequency",
        ui_name: "Filter High Pass Frequency",
        stored_min: 20.0000706,
        stored_max: 20000.1035,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "section range from the preset XML; preset pin 49.9997 Hz",
    },
    ParamDesc {
        id: "Filter_HighPassResonance",
        ui_name: "Filter High Pass Resonance",
        stored_min: 0.0,
        stored_max: 0.3000000119,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored range from the preset XML; stored semantic unmeasured",
    },
    ParamDesc {
        id: "Filter_LowPassFrequency",
        ui_name: "Filter Low Pass Frequency",
        stored_min: 20.0000706,
        stored_max: 20000.1035,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "section range from the preset XML; preset pin 5000.026 Hz",
    },
    ParamDesc {
        id: "Filter_LowPassResonance",
        ui_name: "Filter Low Pass Resonance",
        stored_min: 0.0,
        stored_max: 0.3000000119,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored range from the preset XML; stored semantic unmeasured",
    },
    ParamDesc {
        id: "Reverb_Level",
        ui_name: "Reverb Level",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "Echo's internal reverb send; carries the between-tap tail (E8: \
                floor −54 vs −90 dBFS with it off)",
    },
    ParamDesc {
        id: "Reverb_Decay",
        ui_name: "Reverb Decay",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "normalized stored range from the preset XML; decay semantic \
                unmeasured (dossier limitation)",
    },
];

/// Reverb parameter table (time, dry/wet family, shelving).
///
/// Sources: `devices/reverb.md` (stored `DecayTime` unit = ms,
/// RT60-referenced: RT60 ∝ stored value across the 600/1200/2400 pins — D5
/// verdict, high confidence; `PreDelay` unit = ms, first reverb energy ≈2.5 ms
/// after the direct — high confidence; single room lineage: everything except
/// DecayTime unswept) and `evidence/devices/Reverb/default.xml` (element
/// names, Manual defaults, MidiControllerRange extents).
pub const REVERB: &[ParamDesc] = &[
    ParamDesc {
        id: "PreDelay",
        ui_name: "Pre-Delay",
        stored_min: 0.5,
        stored_max: 249.999969,
        unit: "ms",
        kind: ParamKind::Continuous,
        notes: "stored unit = ms (dossier, high confidence: first reverb energy \
                ≈2.5 ms after the direct at the 2.5 default)",
    },
    ParamDesc {
        id: "DecayTime",
        ui_name: "Decay Time",
        stored_min: 199.999985,
        stored_max: 60000.0039,
        unit: "ms",
        kind: ParamKind::Continuous,
        notes: "stored unit = ms, RT60-referenced (D5 verdict, high confidence: \
                RT60 ∝ stored value; per-band coefficients k ≈ 0.80–0.94 in \
                src/reverb.rs)",
    },
    ParamDesc {
        id: "MixDirect",
        ui_name: "Mix Direct",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "direct-path level; measured −9.89 dBFS mono direct peak at the \
                stored default 0.55 (R1)",
    },
    ParamDesc {
        id: "MixReflect",
        ui_name: "Mix Reflect",
        stored_min: 0.02999999933,
        stored_max: 1.99530005,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored range from default.xml; semantic unswept (dossier: \
                early/late slope attribution low/open, single room lineage)",
    },
    ParamDesc {
        id: "MixDiffuse",
        ui_name: "Mix Diffuse",
        stored_min: 0.02999999933,
        stored_max: 1.99530005,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored range from default.xml; semantic unswept (dossier: \
                single room lineage)",
    },
    ParamDesc {
        id: "ShelfHighOn",
        ui_name: "Shelf High On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "gates the high shelf; stored default on (4500 Hz, gain 0.7 — \
                dossier pin, consistent with the tail's HF rolloff)",
    },
    ParamDesc {
        id: "ShelfHiFreq",
        ui_name: "Shelf Hi Freq",
        stored_min: 19.9999981,
        stored_max: 15999.998,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored default 4500.00146 Hz (default.xml / dossier pin)",
    },
    ParamDesc {
        id: "ShelfHiGain",
        ui_name: "Shelf Hi Gain",
        stored_min: 0.200000003,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored default 0.7; gain semantic (linear vs dB) unstated in \
                the dossier",
    },
    ParamDesc {
        id: "ShelfLowOn",
        ui_name: "Shelf Low On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "gates the low shelf; stored default off (dossier pin)",
    },
    ParamDesc {
        id: "ShelfLoFreq",
        ui_name: "Shelf Lo Freq",
        stored_min: 19.9999981,
        stored_max: 15000.001,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored default 90.0000076 Hz (default.xml)",
    },
    ParamDesc {
        id: "ShelfLoGain",
        ui_name: "Shelf Lo Gain",
        stored_min: 0.200000003,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored default 0.75 (default.xml); semantic unstated in the \
                dossier",
    },
];

/// Eq8 (EQ Eight) parameter table: global section + the 8-band structure.
///
/// Sources: `evidence/devices/Eq8/default.xml` (factory preset
/// `Core Library/Defaults/Audio Effects/EQ Eight.adv`, gunzip XML) and the
/// set evidence `evidence/sets/template-piano-voices-mastering.xml` +
/// `evidence/sets/rack-chunky-shine.xml` (wider band-Mode observations).
///
/// Live 12 stores each band as a flat `Bands.N` element holding TWO
/// parameter slots, `ParameterA` and `ParameterB` (B slots default off),
/// each with `IsOn` / `Mode` / `Freq` / `Gain` / `Q`. Ids are the document
/// paths (`Bands.0/ParameterA/Freq`); no behavior dossier exists for EQ8,
/// so every row documents the stored document model only.
/// View/state elements (SelectedBand, SpectrumAnalyzer) are not
/// parameterized here.
pub const EQ8: &[ParamDesc] = &[
    ParamDesc {
        id: "On",
        ui_name: "On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Precision",
        ui_name: "Precision",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "precision selector in the app (integer steps); only stored 0 observed across \
                the cited evidence — extent is an observed lower bound, labels not in evidence",
    },
    ParamDesc {
        id: "Mode",
        ui_name: "Mode",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "processing-mode selector (integer steps); only stored 0 observed across the \
                cited evidence — extent is an observed lower bound, labels not in evidence",
    },
    ParamDesc {
        id: "EditMode",
        ui_name: "Edit Mode",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "A/B band-edit switch; bool element in the preset XML",
    },
    ParamDesc {
        id: "GlobalGain",
        ui_name: "Global Gain",
        stored_min: -12.0,
        stored_max: 12.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent +/-12; the app displays dB — stored unit unresolved here",
    },
    ParamDesc {
        id: "Scale",
        ui_name: "Scale",
        stored_min: -2.0,
        stored_max: 2.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent -2..2; scaling semantics unmeasured",
    },
    ParamDesc {
        id: "Bands.0/ParameterA/IsOn",
        ui_name: "Band 1 A Is On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Bands.0/ParameterA/Mode",
        ui_name: "Band 1 A Mode",
        stored_min: 0.0,
        stored_max: 2.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (set 'chunky-shine'), 1 (set 'chunky-shine'), 2 (default); \
                extent is an observed lower bound (the app menu may extend it)",
    },
    ParamDesc {
        id: "Bands.0/ParameterA/Freq",
        ui_name: "Band 1 A Freq",
        stored_min: 30.0,
        stored_max: 22000.0,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.0/ParameterA/Gain",
        ui_name: "Band 1 A Gain",
        stored_min: -15.0,
        stored_max: 15.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.0/ParameterA/Q",
        ui_name: "Band 1 A Q",
        stored_min: 0.1000000015,
        stored_max: 18.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.0/ParameterB/IsOn",
        ui_name: "Band 1 B Is On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Bands.0/ParameterB/Mode",
        ui_name: "Band 1 B Mode",
        stored_min: 0.0,
        stored_max: 3.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 1 (default), 3 (set 'piano-voices-mastering'); extent is an \
                observed lower bound (the app menu may extend it)",
    },
    ParamDesc {
        id: "Bands.0/ParameterB/Freq",
        ui_name: "Band 1 B Freq",
        stored_min: 30.0,
        stored_max: 22000.0,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.0/ParameterB/Gain",
        ui_name: "Band 1 B Gain",
        stored_min: -15.0,
        stored_max: 15.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.0/ParameterB/Q",
        ui_name: "Band 1 B Q",
        stored_min: 0.1000000015,
        stored_max: 18.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.1/ParameterA/IsOn",
        ui_name: "Band 2 A Is On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Bands.1/ParameterA/Mode",
        ui_name: "Band 2 A Mode",
        stored_min: 0.0,
        stored_max: 3.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 2 (set 'chunky-shine'), 3 (default); extent is an observed \
                lower bound (the app menu may extend it)",
    },
    ParamDesc {
        id: "Bands.1/ParameterA/Freq",
        ui_name: "Band 2 A Freq",
        stored_min: 30.0,
        stored_max: 22000.0,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.1/ParameterA/Gain",
        ui_name: "Band 2 A Gain",
        stored_min: -15.0,
        stored_max: 15.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.1/ParameterA/Q",
        ui_name: "Band 2 A Q",
        stored_min: 0.1000000015,
        stored_max: 18.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.1/ParameterB/IsOn",
        ui_name: "Band 2 B Is On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Bands.1/ParameterB/Mode",
        ui_name: "Band 2 B Mode",
        stored_min: 0.0,
        stored_max: 3.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 2 (default), 3 (set 'piano-voices-mastering'); extent is an \
                observed lower bound (the app menu may extend it)",
    },
    ParamDesc {
        id: "Bands.1/ParameterB/Freq",
        ui_name: "Band 2 B Freq",
        stored_min: 30.0,
        stored_max: 22000.0,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.1/ParameterB/Gain",
        ui_name: "Band 2 B Gain",
        stored_min: -15.0,
        stored_max: 15.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.1/ParameterB/Q",
        ui_name: "Band 2 B Q",
        stored_min: 0.1000000015,
        stored_max: 18.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.2/ParameterA/IsOn",
        ui_name: "Band 3 A Is On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Bands.2/ParameterA/Mode",
        ui_name: "Band 3 A Mode",
        stored_min: 0.0,
        stored_max: 3.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 3 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Bands.2/ParameterA/Freq",
        ui_name: "Band 3 A Freq",
        stored_min: 30.0,
        stored_max: 22000.0,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.2/ParameterA/Gain",
        ui_name: "Band 3 A Gain",
        stored_min: -15.0,
        stored_max: 15.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.2/ParameterA/Q",
        ui_name: "Band 3 A Q",
        stored_min: 0.1000000015,
        stored_max: 18.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.2/ParameterB/IsOn",
        ui_name: "Band 3 B Is On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Bands.2/ParameterB/Mode",
        ui_name: "Band 3 B Mode",
        stored_min: 0.0,
        stored_max: 3.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 3 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Bands.2/ParameterB/Freq",
        ui_name: "Band 3 B Freq",
        stored_min: 30.0,
        stored_max: 22000.0,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.2/ParameterB/Gain",
        ui_name: "Band 3 B Gain",
        stored_min: -15.0,
        stored_max: 15.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.2/ParameterB/Q",
        ui_name: "Band 3 B Q",
        stored_min: 0.1000000015,
        stored_max: 18.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.3/ParameterA/IsOn",
        ui_name: "Band 4 A Is On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Bands.3/ParameterA/Mode",
        ui_name: "Band 4 A Mode",
        stored_min: 0.0,
        stored_max: 5.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 3 (set 'chunky-shine'), 5 (default); extent is an observed \
                lower bound (the app menu may extend it)",
    },
    ParamDesc {
        id: "Bands.3/ParameterA/Freq",
        ui_name: "Band 4 A Freq",
        stored_min: 30.0,
        stored_max: 22000.0,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.3/ParameterA/Gain",
        ui_name: "Band 4 A Gain",
        stored_min: -15.0,
        stored_max: 15.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.3/ParameterA/Q",
        ui_name: "Band 4 A Q",
        stored_min: 0.1000000015,
        stored_max: 18.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.3/ParameterB/IsOn",
        ui_name: "Band 4 B Is On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Bands.3/ParameterB/Mode",
        ui_name: "Band 4 B Mode",
        stored_min: 0.0,
        stored_max: 3.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 3 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Bands.3/ParameterB/Freq",
        ui_name: "Band 4 B Freq",
        stored_min: 30.0,
        stored_max: 22000.0,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.3/ParameterB/Gain",
        ui_name: "Band 4 B Gain",
        stored_min: -15.0,
        stored_max: 15.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.3/ParameterB/Q",
        ui_name: "Band 4 B Q",
        stored_min: 0.1000000015,
        stored_max: 18.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.4/ParameterA/IsOn",
        ui_name: "Band 5 A Is On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Bands.4/ParameterA/Mode",
        ui_name: "Band 5 A Mode",
        stored_min: 0.0,
        stored_max: 6.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?", "?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 3 (default), 6 (set 'piano-voices-mastering'); extent is an \
                observed lower bound (the app menu may extend it)",
    },
    ParamDesc {
        id: "Bands.4/ParameterA/Freq",
        ui_name: "Band 5 A Freq",
        stored_min: 30.0,
        stored_max: 22000.0,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.4/ParameterA/Gain",
        ui_name: "Band 5 A Gain",
        stored_min: -15.0,
        stored_max: 15.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.4/ParameterA/Q",
        ui_name: "Band 5 A Q",
        stored_min: 0.1000000015,
        stored_max: 18.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.4/ParameterB/IsOn",
        ui_name: "Band 5 B Is On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Bands.4/ParameterB/Mode",
        ui_name: "Band 5 B Mode",
        stored_min: 0.0,
        stored_max: 3.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 3 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Bands.4/ParameterB/Freq",
        ui_name: "Band 5 B Freq",
        stored_min: 30.0,
        stored_max: 22000.0,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.4/ParameterB/Gain",
        ui_name: "Band 5 B Gain",
        stored_min: -15.0,
        stored_max: 15.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.4/ParameterB/Q",
        ui_name: "Band 5 B Q",
        stored_min: 0.1000000015,
        stored_max: 18.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.5/ParameterA/IsOn",
        ui_name: "Band 6 A Is On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Bands.5/ParameterA/Mode",
        ui_name: "Band 6 A Mode",
        stored_min: 0.0,
        stored_max: 3.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 3 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Bands.5/ParameterA/Freq",
        ui_name: "Band 6 A Freq",
        stored_min: 30.0,
        stored_max: 22000.0,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.5/ParameterA/Gain",
        ui_name: "Band 6 A Gain",
        stored_min: -15.0,
        stored_max: 15.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.5/ParameterA/Q",
        ui_name: "Band 6 A Q",
        stored_min: 0.1000000015,
        stored_max: 18.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.5/ParameterB/IsOn",
        ui_name: "Band 6 B Is On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Bands.5/ParameterB/Mode",
        ui_name: "Band 6 B Mode",
        stored_min: 0.0,
        stored_max: 3.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 3 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Bands.5/ParameterB/Freq",
        ui_name: "Band 6 B Freq",
        stored_min: 30.0,
        stored_max: 22000.0,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.5/ParameterB/Gain",
        ui_name: "Band 6 B Gain",
        stored_min: -15.0,
        stored_max: 15.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.5/ParameterB/Q",
        ui_name: "Band 6 B Q",
        stored_min: 0.1000000015,
        stored_max: 18.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.6/ParameterA/IsOn",
        ui_name: "Band 7 A Is On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Bands.6/ParameterA/Mode",
        ui_name: "Band 7 A Mode",
        stored_min: 0.0,
        stored_max: 5.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 3 (default), 5 (set 'chunky-shine'); extent is an observed \
                lower bound (the app menu may extend it)",
    },
    ParamDesc {
        id: "Bands.6/ParameterA/Freq",
        ui_name: "Band 7 A Freq",
        stored_min: 30.0,
        stored_max: 22000.0,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.6/ParameterA/Gain",
        ui_name: "Band 7 A Gain",
        stored_min: -15.0,
        stored_max: 15.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.6/ParameterA/Q",
        ui_name: "Band 7 A Q",
        stored_min: 0.1000000015,
        stored_max: 18.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.6/ParameterB/IsOn",
        ui_name: "Band 7 B Is On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Bands.6/ParameterB/Mode",
        ui_name: "Band 7 B Mode",
        stored_min: 0.0,
        stored_max: 5.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 3 (set 'piano-voices-mastering'), 5 (default); extent is an \
                observed lower bound (the app menu may extend it)",
    },
    ParamDesc {
        id: "Bands.6/ParameterB/Freq",
        ui_name: "Band 7 B Freq",
        stored_min: 30.0,
        stored_max: 22000.0,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.6/ParameterB/Gain",
        ui_name: "Band 7 B Gain",
        stored_min: -15.0,
        stored_max: 15.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.6/ParameterB/Q",
        ui_name: "Band 7 B Q",
        stored_min: 0.1000000015,
        stored_max: 18.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.7/ParameterA/IsOn",
        ui_name: "Band 8 A Is On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Bands.7/ParameterA/Mode",
        ui_name: "Band 8 A Mode",
        stored_min: 0.0,
        stored_max: 6.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?", "?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 3 (set 'piano-voices-mastering'), 5 (set 'chunky-shine'), 6 \
                (default); extent is an observed lower bound (the app menu may extend it)",
    },
    ParamDesc {
        id: "Bands.7/ParameterA/Freq",
        ui_name: "Band 8 A Freq",
        stored_min: 30.0,
        stored_max: 22000.0,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.7/ParameterA/Gain",
        ui_name: "Band 8 A Gain",
        stored_min: -15.0,
        stored_max: 15.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.7/ParameterA/Q",
        ui_name: "Band 8 A Q",
        stored_min: 0.1000000015,
        stored_max: 18.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.7/ParameterB/IsOn",
        ui_name: "Band 8 B Is On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Bands.7/ParameterB/Mode",
        ui_name: "Band 8 B Mode",
        stored_min: 0.0,
        stored_max: 6.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?", "?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 3 (set 'piano-voices-mastering'), 6 (default); extent is an \
                observed lower bound (the app menu may extend it)",
    },
    ParamDesc {
        id: "Bands.7/ParameterB/Freq",
        ui_name: "Band 8 B Freq",
        stored_min: 30.0,
        stored_max: 22000.0,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.7/ParameterB/Gain",
        ui_name: "Band 8 B Gain",
        stored_min: -15.0,
        stored_max: 15.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Bands.7/ParameterB/Q",
        ui_name: "Band 8 B Q",
        stored_min: 0.1000000015,
        stored_max: 18.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Live8ShelfScaleLegacyMode",
        ui_name: "Live8 Shelf Scale Legacy Mode",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "legacy (Live 8) shelf-scaling compatibility switch; bool element in the preset \
                XML",
    },
    ParamDesc {
        id: "AuditionOnOff",
        ui_name: "Audition On Off",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off audition switch; bool element in the preset XML",
    },
    ParamDesc {
        id: "AdaptiveQFactor",
        ui_name: "Adaptive Q Factor",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?"] },
        notes: "adaptive-Q factor selector; stored 0 and 1 observed across the cited evidence — \
                extent is an observed lower bound, labels not in evidence",
    },
    ParamDesc {
        id: "AdaptiveQ",
        ui_name: "Adaptive Q",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off; gates the adaptive-Q behavior (name only — unmeasured)",
    },
];

/// AutoFilter parameter table: filter section + nested Lfo hub.
///
/// Sources: `evidence/devices/AutoFilter/default.xml` (factory preset
/// `Core Library/Defaults/Audio Effects/Auto Filter.adv`),
/// `evidence/devices/AutoFilter/preset-bandpass-spinner.xml` (factory
/// preset `Devices/Audio Effects/Auto Filter/Bandpass Spinner.adv`,
/// FilterType=2) and `evidence/devices/AutoFilter/preset-stereo-notch.xml`
/// (factory preset `Devices/Audio Effects/Auto Filter/Stereo Notch.adv`,
/// FilterType=4), all gunzip XML. No behavior dossier exists; rows
/// document the stored document model only. Live 12 nests an `Lfo`
/// modulation hub under the device element — ids are document paths
/// (`Lfo/Frequency`). Note the hub ranges differ from AutoPan's.
pub const AUTOFILTER: &[ParamDesc] = &[
    ParamDesc {
        id: "On",
        ui_name: "On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "LegacyMode",
        ui_name: "Legacy Mode",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "legacy-filter compatibility switch; bool element in the preset XML",
    },
    ParamDesc {
        id: "LegacyFilterType",
        ui_name: "Legacy Filter Type",
        stored_min: 0.0,
        stored_max: 3.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default), 3 ('Stereo Notch'); extent is an observed lower \
                bound (the app menu may extend it)",
    },
    ParamDesc {
        id: "FilterType",
        ui_name: "Filter Type",
        stored_min: 0.0,
        stored_max: 4.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default), 1 (set 'piano-voices-mastering'), 2 ('Bandpass \
                Spinner'), 4 ('Stereo Notch'); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "CircuitLpHp",
        ui_name: "Circuit Lp Hp",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "CircuitBpNoMo",
        ui_name: "Circuit Bp No Mo",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default), 1 ('Bandpass Spinner'); extent is an observed \
                lower bound (the app menu may extend it)",
    },
    ParamDesc {
        id: "Slope",
        ui_name: "Slope",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Cutoff",
        ui_name: "Cutoff",
        stored_min: 20.0,
        stored_max: 135.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored 20..135 is NOT a Hz span — note/semitone-scale mapping unmeasured; the \
                CutoffLimit element stores 135",
    },
    ParamDesc {
        id: "LegacyQ",
        ui_name: "Legacy Q",
        stored_min: 0.200000003,
        stored_max: 3.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Resonance",
        ui_name: "Resonance",
        stored_min: 0.0,
        stored_max: 1.25,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Morph",
        ui_name: "Morph",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Drive",
        ui_name: "Drive",
        stored_min: 0.0,
        stored_max: 24.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored 0..24; the app displays dB — stored unit unresolved here",
    },
    ParamDesc {
        id: "ModHub",
        ui_name: "Mod Hub",
        stored_min: -127.0,
        stored_max: 127.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored -127..127; modulation-hub routing depth, semantics unmeasured",
    },
    ParamDesc {
        id: "Attack",
        ui_name: "Attack",
        stored_min: 0.1000000015,
        stored_max: 30.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Release",
        ui_name: "Release",
        stored_min: 0.1000000015,
        stored_max: 400.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "LfoAmount",
        ui_name: "Lfo Amount",
        stored_min: 0.0,
        stored_max: 30.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Lfo/Type",
        ui_name: "LFO Type",
        stored_min: 0.0,
        stored_max: 2.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default), 2 ('Bandpass Spinner'); extent is an observed \
                lower bound (the app menu may extend it)",
    },
    ParamDesc {
        id: "Lfo/Frequency",
        ui_name: "LFO Frequency",
        stored_min: 0.009999999776,
        stored_max: 10.0,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Lfo/RateType",
        ui_name: "LFO Rate Type",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default), 1 (set 'piano-voices-mastering'); extent is an \
                observed lower bound (the app menu may extend it)",
    },
    ParamDesc {
        id: "Lfo/BeatRate",
        ui_name: "LFO Beat Rate",
        stored_min: 0.0,
        stored_max: 21.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Lfo/StereoMode",
        ui_name: "LFO Stereo Mode",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default), 1 ('Bandpass Spinner'); extent is an observed \
                lower bound (the app menu may extend it)",
    },
    ParamDesc {
        id: "Lfo/Spin",
        ui_name: "LFO Spin",
        stored_min: 0.0,
        stored_max: 0.5,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Lfo/Phase",
        ui_name: "LFO Phase",
        stored_min: 0.0,
        stored_max: 360.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Lfo/Offset",
        ui_name: "LFO Offset",
        stored_min: 0.0,
        stored_max: 360.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Lfo/IsOn",
        ui_name: "LFO Is On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Lfo/Quantize",
        ui_name: "LFO Quantize",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Lfo/BeatQuantize",
        ui_name: "LFO Beat Quantize",
        stored_min: 0.0,
        stored_max: 2.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 2 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Lfo/NoiseWidth",
        ui_name: "LFO Noise Width",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
];

/// AutoPan parameter table: all live parameters live in the nested `Lfo`
/// hub (Live 12 document model); the device level carries only `On`.
///
/// Source: `evidence/devices/AutoPan/preset-slow-steady.xml` (factory
/// preset `Devices/Audio Effects/Auto Pan/Slow & Steady.adv`, gunzip
/// XML). No behavior dossier exists; rows document the stored document
/// model only. Ids are document paths (`Lfo/Phase`).
pub const AUTOPAN: &[ParamDesc] = &[
    ParamDesc {
        id: "On",
        ui_name: "On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Lfo/Type",
        ui_name: "LFO Type",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 ('Slow & Steady'); extent is an observed lower bound (the \
                app menu may extend it)",
    },
    ParamDesc {
        id: "Lfo/Frequency",
        ui_name: "LFO Frequency",
        stored_min: 0.05000000075,
        stored_max: 90.0,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Lfo/RateType",
        ui_name: "LFO Rate Type",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (set 'piano-voices-mastering'), 1 ('Slow & Steady'); extent \
                is an observed lower bound (the app menu may extend it)",
    },
    ParamDesc {
        id: "Lfo/BeatRate",
        ui_name: "LFO Beat Rate",
        stored_min: 0.0,
        stored_max: 14.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Lfo/StereoMode",
        ui_name: "LFO Stereo Mode",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 ('Slow & Steady'); extent is an observed lower bound (the \
                app menu may extend it)",
    },
    ParamDesc {
        id: "Lfo/Spin",
        ui_name: "LFO Spin",
        stored_min: 0.0,
        stored_max: 0.5,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Lfo/Phase",
        ui_name: "LFO Phase",
        stored_min: 0.0,
        stored_max: 360.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Lfo/Offset",
        ui_name: "LFO Offset",
        stored_min: 0.0,
        stored_max: 360.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Lfo/IsOn",
        ui_name: "LFO Is On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Lfo/Quantize",
        ui_name: "LFO Quantize",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Lfo/BeatQuantize",
        ui_name: "LFO Beat Quantize",
        stored_min: 0.0,
        stored_max: 2.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 2 ('Slow & Steady'); extent is an observed lower bound (the \
                app menu may extend it)",
    },
    ParamDesc {
        id: "Lfo/NoiseWidth",
        ui_name: "LFO Noise Width",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Lfo/LfoAmount",
        ui_name: "LFO Lfo Amount",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Lfo/LfoInvert",
        ui_name: "LFO Lfo Invert",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Lfo/LfoShape",
        ui_name: "LFO Lfo Shape",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
];

/// Saturator parameter table.
///
/// Sources: `evidence/devices/Saturator/default.xml` (factory preset
/// `Core Library/Defaults/Audio Effects/Saturator.adv`),
/// `evidence/devices/Saturator/preset-analog-clip.xml` (factory preset
/// `Devices/Audio Effects/Saturator/Analog Clip.adv`, Type=0) and
/// `evidence/devices/Saturator/preset-digital-clip-center.xml` (factory
/// preset `Devices/Audio Effects/Saturator/Digital Clip Center.adv`,
/// Type=5), all gunzip XML. No behavior dossier exists; rows document
/// the stored document model only.
pub const SATURATOR: &[ParamDesc] = &[
    ParamDesc {
        id: "On",
        ui_name: "On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "DryWet",
        ui_name: "Dry Wet",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "PreDrive",
        ui_name: "Pre Drive",
        stored_min: -36.0,
        stored_max: 36.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored -36..36; the app displays dB — stored unit unresolved here",
    },
    ParamDesc {
        id: "PreDcFilter",
        ui_name: "Pre Dc Filter",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off input DC filter (name only — unmeasured)",
    },
    ParamDesc {
        id: "PostDrive",
        ui_name: "Post Drive",
        stored_min: -36.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored -36..0; the app displays dB — stored unit unresolved here",
    },
    ParamDesc {
        id: "Type",
        ui_name: "Type",
        stored_min: 0.0,
        stored_max: 5.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default), 2 (set 'piano-voices-mastering'), 4 (set \
                'piano-voices-mastering'), 5 ('Digital Clip Center'); extent is an observed \
                lower bound (the app menu may extend it)",
    },
    ParamDesc {
        id: "BaseDrive",
        ui_name: "Base Drive",
        stored_min: -36.0,
        stored_max: 36.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored -36..36; the app displays dB — stored unit unresolved here",
    },
    ParamDesc {
        id: "ColorOn",
        ui_name: "Color On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "ColorFrequency",
        ui_name: "Color Frequency",
        stored_min: 30.0,
        stored_max: 18500.0,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "ColorWidth",
        ui_name: "Color Width",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "ColorDepth",
        ui_name: "Color Depth",
        stored_min: -24.0,
        stored_max: 24.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored -24..24; the app displays dB — stored unit unresolved here",
    },
    ParamDesc {
        id: "PostClip",
        ui_name: "Post Clip",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Oversampling",
        ui_name: "Oversampling",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?"] },
        notes: "oversampling selector (integer steps); stored 0 and 1 observed (default preset \
                stores 1) — extent is an observed lower bound, labels not in evidence",
    },
    ParamDesc {
        id: "WaveShaper/Drive",
        ui_name: "Drive",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "waveshaper section (the app exposes it for the WAV-shaper curve types); stored \
                extent from the preset XML",
    },
    ParamDesc {
        id: "WaveShaper/Lin",
        ui_name: "Lin",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "waveshaper section (the app exposes it for the WAV-shaper curve types); stored \
                extent from the preset XML",
    },
    ParamDesc {
        id: "WaveShaper/Damp",
        ui_name: "Damp",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "waveshaper section (the app exposes it for the WAV-shaper curve types); stored \
                extent from the preset XML",
    },
    ParamDesc {
        id: "WaveShaper/Period",
        ui_name: "Period",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "waveshaper section (the app exposes it for the WAV-shaper curve types); stored \
                extent from the preset XML",
    },
    ParamDesc {
        id: "WaveShaper/Depth",
        ui_name: "Depth",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "waveshaper section (the app exposes it for the WAV-shaper curve types); stored \
                extent from the preset XML",
    },
];

/// DrumBuss parameter table.
///
/// Sources: `evidence/devices/DrumBuss/preset-drum-pumper.xml` (factory
/// preset `Devices/Audio Effects/Drum Buss/Drum Pumper.adv`),
/// `evidence/devices/DrumBuss/preset-boom-in-a.xml` (factory preset
/// `Devices/Audio Effects/Drum Buss/Boom in A.adv`, DriveType=0) and
/// `evidence/devices/DrumBuss/preset-compression-gate.xml` (factory
/// preset `Devices/Audio Effects/Drum Buss/Compression Gate.adv`,
/// DriveType=2), all gunzip XML. No behavior dossier exists; rows
/// document the stored document model only. Gain-like elements store
/// linear amplitudes, not dB.
pub const DRUMBUSS: &[ParamDesc] = &[
    ParamDesc {
        id: "On",
        ui_name: "On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "EnableCompression",
        ui_name: "Enable Compression",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "DriveAmount",
        ui_name: "Drive Amount",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "DriveType",
        ui_name: "Drive Type",
        stored_min: 0.0,
        stored_max: 2.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 ('Boom in A'), 2 ('Compression Gate'); extent is an observed \
                lower bound (the app menu may extend it)",
    },
    ParamDesc {
        id: "CrunchAmount",
        ui_name: "Crunch Amount",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "DampingFrequency",
        ui_name: "Damping Frequency",
        stored_min: 500.0,
        stored_max: 20000.0,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "TransientShaping",
        ui_name: "Transient Shaping",
        stored_min: -1.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "BoomFrequency",
        ui_name: "Boom Frequency",
        stored_min: 30.0,
        stored_max: 90.0,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "resonant boom frequency, stored Hz",
    },
    ParamDesc {
        id: "BoomAmount",
        ui_name: "Boom Amount",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "BoomDecay",
        ui_name: "Boom Decay",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "BoomAudition",
        ui_name: "Boom Audition",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "InputTrim",
        ui_name: "Input Trim",
        stored_min: 0.0003162277571,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored 0.0003162277571..1 — linear amplitude (10^(-35/20) at the floor), not dB",
    },
    ParamDesc {
        id: "OutputGain",
        ui_name: "Output Gain",
        stored_min: 0.009999999776,
        stored_max: 1.41253757,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored 0.009999999776..1.41253757 — linear amplitude, not dB",
    },
    ParamDesc {
        id: "DryWet",
        ui_name: "Dry Wet",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
];

/// Chorus-Ensemble parameter table (document element `Chorus2`).
///
/// Sources: `evidence/devices/ChorusEnsemble/preset-chorus-classic.xml`
/// (factory preset `Devices/Audio Effects/Chorus-Ensemble/Chorus
/// Classic.adv`, Mode=0), `evidence/devices/ChorusEnsemble/
/// preset-ensemble-deep.xml` (factory preset `.../Ensemble Deep.adv`,
/// Mode=1) and `evidence/devices/ChorusEnsemble/preset-vibrato-flutter.xml`
/// (factory preset `.../Vibrato Flutter.adv`, Mode=2), all gunzip XML.
/// No behavior dossier exists; rows document the stored document model
/// only.
pub const CHORUS_ENSEMBLE: &[ParamDesc] = &[
    ParamDesc {
        id: "On",
        ui_name: "On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Mode",
        ui_name: "Mode",
        stored_min: 0.0,
        stored_max: 2.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 ('Chorus Classic'), 1 ('Ensemble Deep'), 2 ('Vibrato \
                Flutter'); extent is an observed lower bound (the app menu may extend it)",
    },
    ParamDesc {
        id: "Shaping",
        ui_name: "Shaping",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Rate",
        ui_name: "Rate",
        stored_min: 0.1000000015,
        stored_max: 15.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Amount",
        ui_name: "Amount",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Feedback",
        ui_name: "Feedback",
        stored_min: 0.0,
        stored_max: 0.9900000095,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "InvertFeedback",
        ui_name: "Invert Feedback",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "VibratoOffset",
        ui_name: "Vibrato Offset",
        stored_min: 0.0,
        stored_max: 180.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "HighpassEnabled",
        ui_name: "Highpass Enabled",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "HighpassFrequency",
        ui_name: "Highpass Frequency",
        stored_min: 20.0,
        stored_max: 2000.0,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Width",
        ui_name: "Width",
        stored_min: 0.0,
        stored_max: 2.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Warmth",
        ui_name: "Warmth",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "OutputGain",
        ui_name: "Output Gain",
        stored_min: 0.0,
        stored_max: 2.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "DryWet",
        ui_name: "Dry Wet",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
];

/// Delay parameter table (the Live 12 "Delay" device, distinct from
/// the older "Echo").
///
/// Sources: `evidence/devices/Delay/default.xml` (factory preset
/// `Core Library/Defaults/Audio Effects/Delay.adv`),
/// `evidence/devices/Delay/preset-16th-ping-pong.xml` (factory preset
/// `Devices/Audio Effects/Delay/Clean Delay/16th Ping Pong.adv`) and
/// `evidence/devices/Delay/preset-4th-bandpass.xml` (factory preset
/// `.../Clean Delay/4th Bandpass.adv`), all gunzip XML; the
/// DelayLine_SmoothingMode extent also draws on the set evidence
/// `evidence/sets/template-piano-voices-mastering.xml` (stored 1
/// observed). No behavior dossier exists; rows document the stored
/// document model only.
pub const DELAY: &[ParamDesc] = &[
    ParamDesc {
        id: "On",
        ui_name: "On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "DelayLine_SmoothingMode",
        ui_name: "Delay Line  Smoothing Mode",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default), 1 (set 'chunky-shine'); extent is an observed \
                lower bound (the app menu may extend it)",
    },
    ParamDesc {
        id: "DelayLine_Link",
        ui_name: "Delay Line  Link",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "true = L/R times linked",
    },
    ParamDesc {
        id: "DelayLine_PingPong",
        ui_name: "Delay Line  Ping Pong",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "true = pingpong mode",
    },
    ParamDesc {
        id: "DelayLine_SyncL",
        ui_name: "Delay Line  Sync (L)",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "true = tempo-synced (DelayLine_SyncedSixteenthL drives the time); false = free",
    },
    ParamDesc {
        id: "DelayLine_SyncR",
        ui_name: "Delay Line  Sync (R)",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "true = tempo-synced (DelayLine_SyncedSixteenthR drives the time); false = free",
    },
    ParamDesc {
        id: "DelayLine_TimeL",
        ui_name: "Delay Line  Time (L)",
        stored_min: 0.001000000047,
        stored_max: 5.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored 0.001000000047..5; stored unit unresolved here (Echo's Delay_Time is \
                seconds — suspected, unverified for Delay)",
    },
    ParamDesc {
        id: "DelayLine_TimeR",
        ui_name: "Delay Line  Time (R)",
        stored_min: 0.001000000047,
        stored_max: 5.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored 0.001000000047..5; stored unit unresolved here (Echo's Delay_Time is \
                seconds — suspected, unverified for Delay)",
    },
    ParamDesc {
        id: "DelayLine_SimpleDelayTimeL",
        ui_name: "Delay Line  Simple Delay Time (L)",
        stored_min: 1.0,
        stored_max: 300.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "simple-mode time; stored 1..300, unit unresolved (ms suspected, unverified)",
    },
    ParamDesc {
        id: "DelayLine_SimpleDelayTimeR",
        ui_name: "Delay Line  Simple Delay Time (R)",
        stored_min: 1.0,
        stored_max: 300.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "simple-mode time; stored 1..300, unit unresolved (ms suspected, unverified)",
    },
    ParamDesc {
        id: "DelayLine_PingPongDelayTimeL",
        ui_name: "Delay Line  Ping Pong Delay Time (L)",
        stored_min: 1.0,
        stored_max: 999.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "pingpong-mode time; stored 1..999, unit unresolved (ms suspected, unverified)",
    },
    ParamDesc {
        id: "DelayLine_PingPongDelayTimeR",
        ui_name: "Delay Line  Ping Pong Delay Time (R)",
        stored_min: 1.0,
        stored_max: 999.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "pingpong-mode time; stored 1..999, unit unresolved (ms suspected, unverified)",
    },
    ParamDesc {
        id: "DelayLine_SyncedSixteenthL",
        ui_name: "Delay Line  Synced Sixteenth (L)",
        stored_min: 0.0,
        stored_max: 3.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 ('16th Ping Pong'), 1 (set 'chunky-shine'), 2 (default), 3 \
                ('4th Bandpass'); extent is an observed lower bound (the app menu may extend \
                it)",
    },
    ParamDesc {
        id: "DelayLine_SyncedSixteenthR",
        ui_name: "Delay Line  Synced Sixteenth (R)",
        stored_min: 0.0,
        stored_max: 3.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 ('4th Bandpass'), 1 (set 'chunky-shine'), 2 (set \
                'piano-voices-mastering'), 3 (default); extent is an observed lower bound (the \
                app menu may extend it)",
    },
    ParamDesc {
        id: "DelayLine_OffsetL",
        ui_name: "Delay Line  Offset (L)",
        stored_min: -0.3300000131,
        stored_max: 0.3300000131,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "DelayLine_OffsetR",
        ui_name: "Delay Line  Offset (R)",
        stored_min: -0.3300000131,
        stored_max: 0.3300000131,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "DelayLine_CompatibilityMode",
        ui_name: "Delay Line  Compatibility Mode",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "bare integer element; only stored 0 observed across the cited evidence — extent \
                and meaning unverified",
    },
    ParamDesc {
        id: "Feedback",
        ui_name: "Feedback",
        stored_min: 0.0,
        stored_max: 0.9499999881,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Freeze",
        ui_name: "Freeze",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Filter_On",
        ui_name: "Filter  On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Filter_Frequency",
        ui_name: "Filter  Frequency",
        stored_min: 49.9999962,
        stored_max: 18000.0059,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Filter_Bandwidth",
        ui_name: "Filter  Bandwidth",
        stored_min: 0.5,
        stored_max: 9.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Modulation_Frequency",
        ui_name: "Modulation  Frequency",
        stored_min: 0.01000000071,
        stored_max: 39.9999962,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Modulation_AmountTime",
        ui_name: "Modulation  Amount Time",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Modulation_AmountFilter",
        ui_name: "Modulation  Amount Filter",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "DryWet",
        ui_name: "Dry Wet",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "DryWetMode",
        ui_name: "Dry Wet Mode",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?"] },
        notes: "bare integer element; stored 0 and 1 observed (default preset stores 1) — \
                extent is an observed lower bound, labels not in evidence",
    },
    ParamDesc {
        id: "EcoProcessing",
        ui_name: "Eco Processing",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off (CPU economy switch, name only — unmeasured)",
    },
];

/// Hybrid Reverb parameter table (document element `Hybrid`).
///
/// Source: `evidence/devices/HybridReverb/default.xml` (factory preset
/// `Core Library/Defaults/Audio Effects/Hybrid Reverb.adv`, gunzip
/// XML). No behavior dossier exists; rows document the stored document
/// model only. The Algorithm_* rows cover the parameter superset of the
/// algorithm menu (Tides/Quartz/Prism groups are per-algorithm
/// sub-panels in the app); the XML stores them flat.
pub const HYBRID_REVERB: &[ParamDesc] = &[
    ParamDesc {
        id: "On",
        ui_name: "On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "PreDelay_Sync",
        ui_name: "Pre Delay  Sync",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "PreDelay_Time",
        ui_name: "Pre Delay  Time",
        stored_min: 0.0,
        stored_max: 4.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored 0..4; stored unit unresolved here (seconds suspected, unverified)",
    },
    ParamDesc {
        id: "PreDelay_Sixteenth",
        ui_name: "Pre Delay  Sixteenth",
        stored_min: 0.0,
        stored_max: 16.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "tempo-division selector in the app (integer steps); the XML stores a continuous \
                MidiControllerRange 0..16 — modeled Continuous per the table rules",
    },
    ParamDesc {
        id: "PreDelay_FeedbackTime",
        ui_name: "Pre Delay  Feedback Time",
        stored_min: 0.0,
        stored_max: 0.9499999881,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "PreDelay_FeedbackSixteenth",
        ui_name: "Pre Delay  Feedback Sixteenth",
        stored_min: 0.0,
        stored_max: 0.9499999881,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Convolution_IrPostProcessingOn",
        ui_name: "Convolution  Ir Post Processing On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off IR post-processing switch for the convolution side; bool element in the \
                preset XML",
    },
    ParamDesc {
        id: "Convolution_IrAttackTime",
        ui_name: "Convolution  Ir Attack Time",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "stored extent from the preset XML; unit unresolved (ms suspected, unverified)",
    },
    ParamDesc {
        id: "Convolution_IrDecayTime",
        ui_name: "Convolution  Ir Decay Time",
        stored_min: 0.0,
        stored_max: 20.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?"] },
        notes: "stored extent from the preset XML; unit unresolved (ms suspected, unverified)",
    },
    ParamDesc {
        id: "Convolution_IrSize",
        ui_name: "Convolution  Ir Size",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?"] },
        notes: "stored extent from the preset XML; semantics unmeasured",
    },
    ParamDesc {
        id: "Algorithm_Type",
        ui_name: "Algorithm  Type",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "algorithm selector; only stored 0 observed across the cited evidence — the app \
                exposes several algorithms; extent is an observed lower bound, labels not in \
                evidence",
    },
    ParamDesc {
        id: "Algorithm_Delay",
        ui_name: "Algorithm  Delay",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Algorithm_Freeze",
        ui_name: "Algorithm  Freeze",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Algorithm_FreezeIn",
        ui_name: "Algorithm  Freeze In",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Algorithm_Decay",
        ui_name: "Algorithm  Decay",
        stored_min: 0.1000000015,
        stored_max: 60.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored 0.1000000015..60; stored unit unresolved here (seconds suspected, \
                unverified)",
    },
    ParamDesc {
        id: "Algorithm_Size",
        ui_name: "Algorithm  Size",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Algorithm_Damping",
        ui_name: "Algorithm  Damping",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Algorithm_Diffusion",
        ui_name: "Algorithm  Diffusion",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Algorithm_Modulation",
        ui_name: "Algorithm  Modulation",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Algorithm_Shape",
        ui_name: "Algorithm  Shape",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Algorithm_BassMultiplier",
        ui_name: "Algorithm  Bass Multiplier",
        stored_min: 0.25,
        stored_max: 4.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Algorithm_BassCrossover",
        ui_name: "Algorithm  Bass Crossover",
        stored_min: 79.9999924,
        stored_max: 999.999878,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Algorithm_Shimmer",
        ui_name: "Algorithm  Shimmer",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Algorithm_PitchShift",
        ui_name: "Algorithm  Pitch Shift",
        stored_min: -12.0,
        stored_max: 12.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored -12..12 (semitone span per extent); unit unresolved here",
    },
    ParamDesc {
        id: "Algorithm_TidesAmount",
        ui_name: "Algorithm  Tides Amount",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Algorithm_TidesRate",
        ui_name: "Algorithm  Tides Rate",
        stored_min: 0.0,
        stored_max: 29.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Algorithm_TidesWaveform",
        ui_name: "Algorithm  Tides Waveform",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Algorithm_TidesPhaseOffset",
        ui_name: "Algorithm  Tides Phase Offset",
        stored_min: 0.0,
        stored_max: 180.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Algorithm_Quartz_LowDamping",
        ui_name: "Algorithm  Quartz  Low Damping",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Algorithm_Quartz_Distance",
        ui_name: "Algorithm  Quartz  Distance",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Algorithm_Prism_HighMultiplier",
        ui_name: "Algorithm  Prism  High Multiplier",
        stored_min: 0.1000000015,
        stored_max: 4.99999952,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Algorithm_Prism_LowMultiplier",
        ui_name: "Algorithm  Prism  Low Multiplier",
        stored_min: 0.1000000015,
        stored_max: 4.99999952,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Algorithm_Prism_CrossoverFrequency",
        ui_name: "Algorithm  Prism  Crossover Frequency",
        stored_min: 399.999969,
        stored_max: 5499.99951,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Algorithm_Prism_Sixth",
        ui_name: "Algorithm  Prism  Sixth",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Algorithm_Prism_Seventh",
        ui_name: "Algorithm  Prism  Seventh",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Eq_On",
        ui_name: "Eq  On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Eq_PreAlgo",
        ui_name: "Eq  Pre Algo",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Eq_LowBandType",
        ui_name: "Eq  Low Band Type",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Eq_LowBandFrequency",
        ui_name: "Eq  Low Band Frequency",
        stored_min: 19.9999981,
        stored_max: 19999.9961,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Eq_LowBandGain",
        ui_name: "Eq  Low Band Gain",
        stored_min: 0.25,
        stored_max: 4.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Eq_LowBandSlope",
        ui_name: "Eq  Low Band Slope",
        stored_min: 0.0,
        stored_max: 9.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Eq_Peak1Frequency",
        ui_name: "Eq  Peak1 Frequency",
        stored_min: 19.9999981,
        stored_max: 19999.9961,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Eq_Peak1Gain",
        ui_name: "Eq  Peak1 Gain",
        stored_min: 0.25,
        stored_max: 4.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Eq_Peak1Q",
        ui_name: "Eq  Peak1 Q",
        stored_min: 0.1000000015,
        stored_max: 4.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Eq_Peak2Frequency",
        ui_name: "Eq  Peak2 Frequency",
        stored_min: 19.9999981,
        stored_max: 19999.9961,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Eq_Peak2Gain",
        ui_name: "Eq  Peak2 Gain",
        stored_min: 0.25,
        stored_max: 4.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Eq_Peak2Q",
        ui_name: "Eq  Peak2 Q",
        stored_min: 0.1000000015,
        stored_max: 4.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Eq_HighBandType",
        ui_name: "Eq  High Band Type",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 1 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Eq_HighBandFrequency",
        ui_name: "Eq  High Band Frequency",
        stored_min: 19.9999981,
        stored_max: 19999.9961,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Eq_HighBandGain",
        ui_name: "Eq  High Band Gain",
        stored_min: 0.25,
        stored_max: 4.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Eq_HighBandSlope",
        ui_name: "Eq  High Band Slope",
        stored_min: 0.0,
        stored_max: 9.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Send",
        ui_name: "Send",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Routing",
        ui_name: "Routing",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 1 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "ConvoAlgoBlend",
        ui_name: "Convo Algo Blend",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Vintage",
        ui_name: "Vintage",
        stored_min: 0.0,
        stored_max: 4.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "integer character-stepper in the app (0..4 steps); the XML stores a continuous \
                MidiControllerRange — modeled Continuous per the table rules; panels should \
                quantize",
    },
    ParamDesc {
        id: "StereoWidth",
        ui_name: "Stereo Width",
        stored_min: 0.0,
        stored_max: 2.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "BassMono",
        ui_name: "Bass Mono",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "DryWet",
        ui_name: "Dry Wet",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
];

/// Multiband Dynamics parameter table: three bands x above/below
/// threshold/ratio/attack/release, gains, split frequencies.
///
/// Sources: `evidence/devices/MultibandDynamics/
/// preset-multiband-compression.xml` (factory preset `Devices/Audio
/// Effects/Multiband Dynamics/Multiband Compression.adv`),
/// `.../preset-flatline.xml` (factory preset `.../Flatline.adv`) and
/// `.../preset-ott.xml` (factory preset `.../OTT.adv`), all gunzip
/// XML. No behavior dossier exists; rows document the stored document
/// model only. Ratio rows store a signed mapping (negative = downward),
/// extent exactly as stored; the semantic mapping is unmeasured.
pub const MULTIBAND_DYNAMICS: &[ParamDesc] = &[
    ParamDesc {
        id: "On",
        ui_name: "On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "SplitLowMid",
        ui_name: "Split Low Mid",
        stored_min: 29.9999981,
        stored_max: 3000.0,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "SplitMidHigh",
        ui_name: "Split Mid High",
        stored_min: 300.000061,
        stored_max: 14999.998,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "SplitLowMidOn",
        ui_name: "Split Low Mid On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off; gates the SplitLowMid crossover; bool element in the preset XML",
    },
    ParamDesc {
        id: "SplitMidHighOn",
        ui_name: "Split Mid High On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off; gates the SplitMidHigh crossover; bool element in the preset XML",
    },
    ParamDesc {
        id: "SoftKnee",
        ui_name: "Soft Knee",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "EnvelopeIsPeak",
        ui_name: "Envelope Is Peak",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "OutputGain",
        ui_name: "Output Gain",
        stored_min: -24.0,
        stored_max: 24.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "GlobalAmount",
        ui_name: "Global Amount",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "GlobalTime",
        ui_name: "Global Time",
        stored_min: 0.1000000015,
        stored_max: 10.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored 0.1000000015..10; global time scaling factor, semantics unmeasured",
    },
    ParamDesc {
        id: "GainLow",
        ui_name: "Gain Low",
        stored_min: -24.0,
        stored_max: 24.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "GainMid",
        ui_name: "Gain Mid",
        stored_min: -24.0,
        stored_max: 24.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "GainHigh",
        ui_name: "Gain High",
        stored_min: -24.0,
        stored_max: 24.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "InputGainLow",
        ui_name: "Input Gain Low",
        stored_min: -24.0,
        stored_max: 24.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "InputGainMid",
        ui_name: "Input Gain Mid",
        stored_min: -24.0,
        stored_max: 24.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "InputGainHigh",
        ui_name: "Input Gain High",
        stored_min: -24.0,
        stored_max: 24.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "SoloLow",
        ui_name: "Solo Low",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off band solo; bool element in the preset XML",
    },
    ParamDesc {
        id: "SoloMid",
        ui_name: "Solo Mid",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off band solo; bool element in the preset XML",
    },
    ParamDesc {
        id: "SoloHigh",
        ui_name: "Solo High",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off band solo; bool element in the preset XML",
    },
    ParamDesc {
        id: "ActiveLow",
        ui_name: "Active Low",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "ActiveMid",
        ui_name: "Active Mid",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "ActiveHigh",
        ui_name: "Active High",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "AboveThresholdLow",
        ui_name: "Above Threshold Low",
        stored_min: -80.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "AboveThresholdMid",
        ui_name: "Above Threshold Mid",
        stored_min: -80.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "AboveThresholdHigh",
        ui_name: "Above Threshold High",
        stored_min: -80.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "BelowThresholdLow",
        ui_name: "Below Threshold Low",
        stored_min: -80.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "BelowThresholdMid",
        ui_name: "Below Threshold Mid",
        stored_min: -80.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "BelowThresholdHigh",
        ui_name: "Below Threshold High",
        stored_min: -80.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "AboveRatioLow",
        ui_name: "Above Ratio Low",
        stored_min: -1.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "signed stored ratio mapping (-1..1); semantic (which sign = which compression \
                direction) unmeasured",
    },
    ParamDesc {
        id: "AboveRatioMid",
        ui_name: "Above Ratio Mid",
        stored_min: -1.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "AboveRatioHigh",
        ui_name: "Above Ratio High",
        stored_min: -1.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "BelowRatioLow",
        ui_name: "Below Ratio Low",
        stored_min: -3.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "BelowRatioMid",
        ui_name: "Below Ratio Mid",
        stored_min: -3.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "BelowRatioHigh",
        ui_name: "Below Ratio High",
        stored_min: -3.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "AttackLow",
        ui_name: "Attack Low",
        stored_min: 0.1000000015,
        stored_max: 5000.00098,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "AttackMid",
        ui_name: "Attack Mid",
        stored_min: 0.1000000015,
        stored_max: 5000.00098,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "AttackHigh",
        ui_name: "Attack High",
        stored_min: 0.1000000015,
        stored_max: 5000.00098,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "ReleaseLow",
        ui_name: "Release Low",
        stored_min: 0.1000000015,
        stored_max: 5000.00098,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "ReleaseMid",
        ui_name: "Release Mid",
        stored_min: 0.1000000015,
        stored_max: 5000.00098,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "ReleaseHigh",
        ui_name: "Release High",
        stored_min: 0.1000000015,
        stored_max: 5000.00098,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "SideListen",
        ui_name: "Side Listen",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off sidechain listen; bool element in the preset XML",
    },
    ParamDesc {
        id: "ActiveEditMode",
        ui_name: "Active Edit Mode",
        stored_min: 0.0,
        stored_max: 2.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?"] },
        notes: "active-band edit-mode selector; stored 0..2 observed across the cited evidence \
                — extent is an observed lower bound, labels not in evidence",
    },
];

/// Utility parameter table (document element `StereoGain`).
///
/// Sources: `evidence/devices/Utility/preset-*.xml` — factory presets
/// `Devices/Audio Effects/Utility/{Mono,Mid Only,Sides Only,Left,Right,
/// Wide Stereo}.adv`, gunzip XML (ChannelMode stored 0 in `Left`, 1 in
/// `Mono`/`Mid Only`/`Sides Only`/`Wide Stereo`, 2 in `Right`). No
/// behavior dossier exists; rows document the stored document model
/// only. `Gain` stores linear amplitude 0..56.2341309; the legacy
/// `LegacyGain` element stores the same span in dB (-35..35:
/// 10^(35/20) = 56.2341).
pub const STEREO_GAIN: &[ParamDesc] = &[
    ParamDesc {
        id: "On",
        ui_name: "On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "PhaseInvertL",
        ui_name: "Phase Invert (L)",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "PhaseInvertR",
        ui_name: "Phase Invert (R)",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "ChannelMode",
        ui_name: "Channel Mode",
        stored_min: 0.0,
        stored_max: 2.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 ('Left'), 1 ('Mid Only'), 2 ('Right'); extent is an observed \
                lower bound (the app menu may extend it)",
    },
    ParamDesc {
        id: "StereoWidth",
        ui_name: "Stereo Width",
        stored_min: 0.0,
        stored_max: 4.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "MidSideBalance",
        ui_name: "Mid Side Balance",
        stored_min: 0.0,
        stored_max: 2.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "MidSideBalanceOn",
        ui_name: "Mid Side Balance On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off; gates the MidSideBalance element (name only — unmeasured)",
    },
    ParamDesc {
        id: "Mono",
        ui_name: "Mono",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "BassMono",
        ui_name: "Bass Mono",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "BassMonoAudition",
        ui_name: "Bass Mono Audition",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off audition switch (name only — unmeasured)",
    },
    ParamDesc {
        id: "BassMonoFrequency",
        ui_name: "Bass Mono Frequency",
        stored_min: 50.0,
        stored_max: 500.0,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Balance",
        ui_name: "Balance",
        stored_min: -1.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Gain",
        ui_name: "Gain",
        stored_min: 0.0,
        stored_max: 56.2341309,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored 0..56.2341309 = linear amplitude; 56.2341 = 10^(35/20), the dB twin of \
                LegacyGain's +35 ceiling",
    },
    ParamDesc {
        id: "LegacyGain",
        ui_name: "Legacy Gain",
        stored_min: -35.0,
        stored_max: 35.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored -35..35 dB (element name LegacyGain; the linear Gain element spans the \
                same range)",
    },
    ParamDesc {
        id: "Mute",
        ui_name: "Mute",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "DcFilter",
        ui_name: "Dc Filter",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "LegacyMode",
        ui_name: "Legacy Mode",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off compatibility switch (name only — unmeasured)",
    },
];

/// Drift instrument parameter table (top-level voice parameters).
///
/// Source: `evidence/devices/Drift/default.xml` (factory preset
/// `Core Library/Defaults/Instruments/Drift.adv`, gunzip XML). The
/// voice model is NOT yet rebuilt in live-dynamics (no drift synth):
/// these rows document the stored document model only — no behavior,
/// no signal claims. Element names carry their section prefixes
/// (`Filter_`, `Lfo_`, `Envelope1_`, ...) exactly as stored.
pub const DRIFT: &[ParamDesc] = &[
    ParamDesc {
        id: "On",
        ui_name: "On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Filter_Frequency",
        ui_name: "Filter  Frequency",
        stored_min: 19.9999981,
        stored_max: 19999.9961,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Filter_Resonance",
        ui_name: "Filter  Resonance",
        stored_min: 0.0,
        stored_max: 1.00999999,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Filter_Type",
        ui_name: "Filter  Type",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Filter_HiPassFrequency",
        ui_name: "Filter  Hi Pass Frequency",
        stored_min: 9.99999905,
        stored_max: 20479.998,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Filter_Tracking",
        ui_name: "Filter  Tracking",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Filter_ModAmount1",
        ui_name: "Filter  Mod Amount1",
        stored_min: -1.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Filter_ModAmount2",
        ui_name: "Filter  Mod Amount2",
        stored_min: -1.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Filter_ModSource1",
        ui_name: "Filter  Mod Source1",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 1 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Filter_ModSource2",
        ui_name: "Filter  Mod Source2",
        stored_min: 0.0,
        stored_max: 6.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?", "?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 6 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Filter_OscillatorThrough1",
        ui_name: "Filter  Oscillator Through1",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Filter_OscillatorThrough2",
        ui_name: "Filter  Oscillator Through2",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Filter_NoiseThrough",
        ui_name: "Filter  Noise Through",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Lfo_Mode",
        ui_name: "Lfo  Mode",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Lfo_Rate",
        ui_name: "Lfo  Rate",
        stored_min: 0.1700000018,
        stored_max: 1700.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Lfo_Ratio",
        ui_name: "Lfo  Ratio",
        stored_min: 0.25,
        stored_max: 16.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Lfo_Time",
        ui_name: "Lfo  Time",
        stored_min: 0.1000000015,
        stored_max: 60.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Lfo_SyncedRate",
        ui_name: "Lfo  Synced Rate",
        stored_min: 0.0,
        stored_max: 21.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "tempo-division selector in the app (integer steps); the XML stores a continuous \
                MidiControllerRange 0..21 — modeled Continuous per the table rules",
    },
    ParamDesc {
        id: "Lfo_Amount",
        ui_name: "Lfo  Amount",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Lfo_Shape",
        ui_name: "Lfo  Shape",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Lfo_ModSource",
        ui_name: "Lfo  Mod Source",
        stored_min: 0.0,
        stored_max: 5.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 5 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Lfo_ModAmount",
        ui_name: "Lfo  Mod Amount",
        stored_min: -1.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Lfo_Retrigger",
        ui_name: "Lfo  Retrigger",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Oscillator1_Type",
        ui_name: "Oscillator1  Type",
        stored_min: 0.0,
        stored_max: 4.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 4 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Oscillator1_Shape",
        ui_name: "Oscillator1  Shape",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Oscillator1_Transpose",
        ui_name: "Oscillator1  Transpose",
        stored_min: -2.0,
        stored_max: 3.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Oscillator1_ShapeModSource",
        ui_name: "Oscillator1  Shape Mod Source",
        stored_min: 0.0,
        stored_max: 7.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?", "?", "?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 7 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Oscillator1_ShapeMod",
        ui_name: "Oscillator1  Shape Mod",
        stored_min: -1.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Oscillator2_Type",
        ui_name: "Oscillator2  Type",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Oscillator2_Detune",
        ui_name: "Oscillator2  Detune",
        stored_min: -7.0,
        stored_max: 7.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Oscillator2_Transpose",
        ui_name: "Oscillator2  Transpose",
        stored_min: -3.0,
        stored_max: 2.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "PitchModulation_Source1",
        ui_name: "Pitch Modulation  Source1",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 1 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "PitchModulation_Source2",
        ui_name: "Pitch Modulation  Source2",
        stored_min: 0.0,
        stored_max: 2.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 2 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "PitchModulation_Amount1",
        ui_name: "Pitch Modulation  Amount1",
        stored_min: -1.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "PitchModulation_Amount2",
        ui_name: "Pitch Modulation  Amount2",
        stored_min: -1.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Mixer_OscillatorGain1",
        ui_name: "Mixer  Oscillator Gain1",
        stored_min: 0.0,
        stored_max: 1.99526799,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Mixer_OscillatorGain2",
        ui_name: "Mixer  Oscillator Gain2",
        stored_min: 0.0,
        stored_max: 1.99526799,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Mixer_OscillatorOn1",
        ui_name: "Mixer  Oscillator On1",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Mixer_OscillatorOn2",
        ui_name: "Mixer  Oscillator On2",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Mixer_NoiseLevel",
        ui_name: "Mixer  Noise Level",
        stored_min: 0.0,
        stored_max: 1.99526799,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Mixer_NoiseOn",
        ui_name: "Mixer  Noise On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Envelope1_Attack",
        ui_name: "Envelope1  Attack",
        stored_min: 0.0,
        stored_max: 60.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Envelope1_Decay",
        ui_name: "Envelope1  Decay",
        stored_min: 0.004999999888,
        stored_max: 60.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Envelope1_Release",
        ui_name: "Envelope1  Release",
        stored_min: 0.009999999776,
        stored_max: 60.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Envelope1_Sustain",
        ui_name: "Envelope1  Sustain",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Envelope2_Attack",
        ui_name: "Envelope2  Attack",
        stored_min: 0.0,
        stored_max: 60.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Envelope2_Decay",
        ui_name: "Envelope2  Decay",
        stored_min: 0.004999999888,
        stored_max: 60.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Envelope2_Release",
        ui_name: "Envelope2  Release",
        stored_min: 0.009999999776,
        stored_max: 60.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Envelope2_Sustain",
        ui_name: "Envelope2  Sustain",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "CyclingEnvelope_Mode",
        ui_name: "Cycling Envelope  Mode",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "CyclingEnvelope_Rate",
        ui_name: "Cycling Envelope  Rate",
        stored_min: 0.1700000018,
        stored_max: 1700.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "CyclingEnvelope_Ratio",
        ui_name: "Cycling Envelope  Ratio",
        stored_min: 0.25,
        stored_max: 16.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "CyclingEnvelope_Time",
        ui_name: "Cycling Envelope  Time",
        stored_min: 0.1000000015,
        stored_max: 60.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "CyclingEnvelope_SyncedRate",
        ui_name: "Cycling Envelope  Synced Rate",
        stored_min: 0.0,
        stored_max: 21.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "tempo-division selector in the app (integer steps); the XML stores a continuous \
                MidiControllerRange 0..21 — modeled Continuous per the table rules",
    },
    ParamDesc {
        id: "CyclingEnvelope_MidPoint",
        ui_name: "Cycling Envelope  Mid Point",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "CyclingEnvelope_Hold",
        ui_name: "Cycling Envelope  Hold",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "ModulationMatrix_Source1",
        ui_name: "Modulation Matrix  Source1",
        stored_min: 0.0,
        stored_max: 5.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 5 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "ModulationMatrix_Source2",
        ui_name: "Modulation Matrix  Source2",
        stored_min: 0.0,
        stored_max: 4.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 4 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "ModulationMatrix_Source3",
        ui_name: "Modulation Matrix  Source3",
        stored_min: 0.0,
        stored_max: 6.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?", "?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 6 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "ModulationMatrix_Amount1",
        ui_name: "Modulation Matrix  Amount1",
        stored_min: -1.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "ModulationMatrix_Amount2",
        ui_name: "Modulation Matrix  Amount2",
        stored_min: -1.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "ModulationMatrix_Amount3",
        ui_name: "Modulation Matrix  Amount3",
        stored_min: -1.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "ModulationMatrix_Target1",
        ui_name: "Modulation Matrix  Target1",
        stored_min: 0.0,
        stored_max: 8.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?", "?", "?", "?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 8 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "ModulationMatrix_Target2",
        ui_name: "Modulation Matrix  Target2",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "ModulationMatrix_Target3",
        ui_name: "Modulation Matrix  Target3",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Global_VolVelMod",
        ui_name: "Global  Vol Vel Mod",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Global_ResetOscillatorPhase",
        ui_name: "Global  Reset Oscillator Phase",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Global_Envelope2Mode",
        ui_name: "Global  Envelope2 Mode",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Global_VoiceMode",
        ui_name: "Global  Voice Mode",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "voice-mode selector; only stored 0 observed across the cited evidence — extent \
                is an observed lower bound, labels not in evidence",
    },
    ParamDesc {
        id: "Global_PolyVoiceDepth",
        ui_name: "Global  Poly Voice Depth",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Global_StereoVoiceDepth",
        ui_name: "Global  Stereo Voice Depth",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Global_UnisonVoiceDepth",
        ui_name: "Global  Unison Voice Depth",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Global_MonoVoiceDepth",
        ui_name: "Global  Mono Voice Depth",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Global_PitchBendRange",
        ui_name: "Global  Pitch Bend Range",
        stored_min: 0.0,
        stored_max: 2.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?"] },
        notes: "pitch-bend range in semitones (extent unverified); only stored 2 observed",
    },
    ParamDesc {
        id: "Global_DriftDepth",
        ui_name: "Global  Drift Depth",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Global_VoiceCount",
        ui_name: "Global  Voice Count",
        stored_min: 0.0,
        stored_max: 4.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?", "?"] },
        notes: "voice count (integer steps); only stored 4 observed across the cited evidence — \
                extent is an observed lower bound",
    },
    ParamDesc {
        id: "Global_Legato",
        ui_name: "Global  Legato",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Global_NotePitchBend",
        ui_name: "Global  Note Pitch Bend",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Global_Glide",
        ui_name: "Global  Glide",
        stored_min: 0.0,
        stored_max: 2.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Global_Volume",
        ui_name: "Global  Volume",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Global_Transpose",
        ui_name: "Global  Transpose",
        stored_min: -48.0,
        stored_max: 48.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
];

/// Wavetable instrument parameter table (top-level voice parameters;
/// the preset document element is `InstrumentVector`).
///
/// Source: `evidence/devices/Wavetable/default.xml` (factory preset
/// `Core Library/Defaults/Instruments/Wavetable.adv`, gunzip XML). The
/// voice model is NOT yet rebuilt in live-dynamics (no wavetable
/// synth): these rows document the stored document model only — no
/// behavior, no signal claims. Element names carry their section
/// prefixes (`Voice_Oscillator1_`, `Voice_Modulators_`, ...) exactly
/// as stored; wavetable content selection (SpriteName/UserSprite) is
/// sample data, not parameterized here.
pub const WAVETABLE: &[ParamDesc] = &[
    ParamDesc {
        id: "On",
        ui_name: "On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Voice_Oscillator1_On",
        ui_name: "Voice  Oscillator1  On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Voice_Oscillator1_Pitch_Transpose",
        ui_name: "Voice  Oscillator1  Pitch  Transpose",
        stored_min: -24.0,
        stored_max: 24.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Oscillator1_Pitch_Detune",
        ui_name: "Voice  Oscillator1  Pitch  Detune",
        stored_min: -0.5,
        stored_max: 0.5,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Oscillator1_Wavetables_WavePosition",
        ui_name: "Voice  Oscillator1  Wavetables  Wave Position",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Oscillator1_Effects_EffectMode",
        ui_name: "Voice  Oscillator1  Effects  Effect Mode",
        stored_min: 0.0,
        stored_max: 3.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 3 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Voice_Oscillator1_Effects_Effect1",
        ui_name: "Voice  Oscillator1  Effects  Effect1",
        stored_min: -1.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Oscillator1_Effects_Effect2",
        ui_name: "Voice  Oscillator1  Effects  Effect2",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Oscillator1_Pan",
        ui_name: "Voice  Oscillator1  Pan",
        stored_min: -1.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Oscillator1_Gain",
        ui_name: "Voice  Oscillator1  Gain",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Oscillator2_On",
        ui_name: "Voice  Oscillator2  On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Voice_Oscillator2_Pitch_Transpose",
        ui_name: "Voice  Oscillator2  Pitch  Transpose",
        stored_min: -24.0,
        stored_max: 24.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Oscillator2_Pitch_Detune",
        ui_name: "Voice  Oscillator2  Pitch  Detune",
        stored_min: -0.5,
        stored_max: 0.5,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Oscillator2_Wavetables_WavePosition",
        ui_name: "Voice  Oscillator2  Wavetables  Wave Position",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Oscillator2_Effects_EffectMode",
        ui_name: "Voice  Oscillator2  Effects  Effect Mode",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Voice_Oscillator2_Effects_Effect1",
        ui_name: "Voice  Oscillator2  Effects  Effect1",
        stored_min: -1.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Oscillator2_Effects_Effect2",
        ui_name: "Voice  Oscillator2  Effects  Effect2",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Oscillator2_Pan",
        ui_name: "Voice  Oscillator2  Pan",
        stored_min: -1.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Oscillator2_Gain",
        ui_name: "Voice  Oscillator2  Gain",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_SubOscillator_On",
        ui_name: "Voice  Sub Oscillator  On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Voice_SubOscillator_Tone",
        ui_name: "Voice  Sub Oscillator  Tone",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_SubOscillator_Gain",
        ui_name: "Voice  Sub Oscillator  Gain",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_SubOscillator_Transpose",
        ui_name: "Voice  Sub Oscillator  Transpose",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 1 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Voice_Filter1_On",
        ui_name: "Voice  Filter1  On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Voice_Filter1_Type",
        ui_name: "Voice  Filter1  Type",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Voice_Filter1_CircuitLpHp",
        ui_name: "Voice  Filter1  Circuit Lp Hp",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Voice_Filter1_CircuitBpNoMo",
        ui_name: "Voice  Filter1  Circuit Bp No Mo",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Voice_Filter1_Slope",
        ui_name: "Voice  Filter1  Slope",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Voice_Filter1_Frequency",
        ui_name: "Voice  Filter1  Frequency",
        stored_min: 19.9999981,
        stored_max: 20479.998,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Filter1_Resonance",
        ui_name: "Voice  Filter1  Resonance",
        stored_min: 0.0,
        stored_max: 1.25,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Filter1_Drive",
        ui_name: "Voice  Filter1  Drive",
        stored_min: 0.0,
        stored_max: 24.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Filter1_Morph",
        ui_name: "Voice  Filter1  Morph",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Filter2_On",
        ui_name: "Voice  Filter2  On",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Voice_Filter2_Type",
        ui_name: "Voice  Filter2  Type",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 1 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Voice_Filter2_CircuitLpHp",
        ui_name: "Voice  Filter2  Circuit Lp Hp",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Voice_Filter2_CircuitBpNoMo",
        ui_name: "Voice  Filter2  Circuit Bp No Mo",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Voice_Filter2_Slope",
        ui_name: "Voice  Filter2  Slope",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Voice_Filter2_Frequency",
        ui_name: "Voice  Filter2  Frequency",
        stored_min: 19.9999981,
        stored_max: 20479.998,
        unit: "Hz",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Filter2_Resonance",
        ui_name: "Voice  Filter2  Resonance",
        stored_min: 0.0,
        stored_max: 1.25,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Filter2_Drive",
        ui_name: "Voice  Filter2  Drive",
        stored_min: 0.0,
        stored_max: 24.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Filter2_Morph",
        ui_name: "Voice  Filter2  Morph",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_AmpEnvelope_Times_Attack",
        ui_name: "Voice  Modulators  Amp Envelope  Times  Attack",
        stored_min: 0.0,
        stored_max: 20.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored 0..20; stored unit unresolved here (seconds suspected, unverified)",
    },
    ParamDesc {
        id: "Voice_Modulators_AmpEnvelope_Times_Decay",
        ui_name: "Voice  Modulators  Amp Envelope  Times  Decay",
        stored_min: 0.001500000013,
        stored_max: 20.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored 0.001500000013..20; stored unit unresolved here (seconds suspected, \
                unverified)",
    },
    ParamDesc {
        id: "Voice_Modulators_AmpEnvelope_Times_Release",
        ui_name: "Voice  Modulators  Amp Envelope  Times  Release",
        stored_min: 0.001500000013,
        stored_max: 20.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored 0.001500000013..20; stored unit unresolved here (seconds suspected, \
                unverified)",
    },
    ParamDesc {
        id: "Voice_Modulators_AmpEnvelope_Slopes_Attack",
        ui_name: "Voice  Modulators  Amp Envelope  Slopes  Attack",
        stored_min: -1.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_AmpEnvelope_Slopes_Decay",
        ui_name: "Voice  Modulators  Amp Envelope  Slopes  Decay",
        stored_min: -1.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_AmpEnvelope_Slopes_Release",
        ui_name: "Voice  Modulators  Amp Envelope  Slopes  Release",
        stored_min: -1.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_AmpEnvelope_Sustain",
        ui_name: "Voice  Modulators  Amp Envelope  Sustain",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_AmpEnvelope_LoopMode",
        ui_name: "Voice  Modulators  Amp Envelope  Loop Mode",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Voice_Modulators_Envelope2_Times_Attack",
        ui_name: "Voice  Modulators  Envelope2  Times  Attack",
        stored_min: 0.0,
        stored_max: 20.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_Envelope2_Times_Decay",
        ui_name: "Voice  Modulators  Envelope2  Times  Decay",
        stored_min: 0.001500000013,
        stored_max: 20.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_Envelope2_Times_Release",
        ui_name: "Voice  Modulators  Envelope2  Times  Release",
        stored_min: 0.001500000013,
        stored_max: 20.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_Envelope2_Slopes_Attack",
        ui_name: "Voice  Modulators  Envelope2  Slopes  Attack",
        stored_min: -1.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_Envelope2_Slopes_Decay",
        ui_name: "Voice  Modulators  Envelope2  Slopes  Decay",
        stored_min: -1.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_Envelope2_Slopes_Release",
        ui_name: "Voice  Modulators  Envelope2  Slopes  Release",
        stored_min: -1.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_Envelope2_Values_Initial",
        ui_name: "Voice  Modulators  Envelope2  Values  Initial",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_Envelope2_Values_Peak",
        ui_name: "Voice  Modulators  Envelope2  Values  Peak",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_Envelope2_Values_Sustain",
        ui_name: "Voice  Modulators  Envelope2  Values  Sustain",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_Envelope2_Values_Final",
        ui_name: "Voice  Modulators  Envelope2  Values  Final",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_Envelope2_LoopMode",
        ui_name: "Voice  Modulators  Envelope2  Loop Mode",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Voice_Modulators_Envelope3_Times_Attack",
        ui_name: "Voice  Modulators  Envelope3  Times  Attack",
        stored_min: 0.0,
        stored_max: 20.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_Envelope3_Times_Decay",
        ui_name: "Voice  Modulators  Envelope3  Times  Decay",
        stored_min: 0.001500000013,
        stored_max: 20.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_Envelope3_Times_Release",
        ui_name: "Voice  Modulators  Envelope3  Times  Release",
        stored_min: 0.001500000013,
        stored_max: 20.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_Envelope3_Slopes_Attack",
        ui_name: "Voice  Modulators  Envelope3  Slopes  Attack",
        stored_min: -1.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_Envelope3_Slopes_Decay",
        ui_name: "Voice  Modulators  Envelope3  Slopes  Decay",
        stored_min: -1.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_Envelope3_Slopes_Release",
        ui_name: "Voice  Modulators  Envelope3  Slopes  Release",
        stored_min: -1.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_Envelope3_Values_Initial",
        ui_name: "Voice  Modulators  Envelope3  Values  Initial",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_Envelope3_Values_Peak",
        ui_name: "Voice  Modulators  Envelope3  Values  Peak",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_Envelope3_Values_Sustain",
        ui_name: "Voice  Modulators  Envelope3  Values  Sustain",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_Envelope3_Values_Final",
        ui_name: "Voice  Modulators  Envelope3  Values  Final",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_Envelope3_LoopMode",
        ui_name: "Voice  Modulators  Envelope3  Loop Mode",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Voice_Modulators_Lfo1_Retrigger",
        ui_name: "Voice  Modulators  Lfo1  Retrigger",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Voice_Modulators_Lfo1_Shape_Type",
        ui_name: "Voice  Modulators  Lfo1  Shape  Type",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Voice_Modulators_Lfo1_Shape_Amount",
        ui_name: "Voice  Modulators  Lfo1  Shape  Amount",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_Lfo1_Shape_Shaping",
        ui_name: "Voice  Modulators  Lfo1  Shape  Shaping",
        stored_min: -1.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_Lfo1_Shape_PhaseOffset",
        ui_name: "Voice  Modulators  Lfo1  Shape  Phase Offset",
        stored_min: 0.0,
        stored_max: 360.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_Lfo1_Time_Sync",
        ui_name: "Voice  Modulators  Lfo1  Time  Sync",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Voice_Modulators_Lfo1_Time_Rate",
        ui_name: "Voice  Modulators  Lfo1  Time  Rate",
        stored_min: 0.009999999776,
        stored_max: 30.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_Lfo1_Time_SyncedRate",
        ui_name: "Voice  Modulators  Lfo1  Time  Synced Rate",
        stored_min: 0.0,
        stored_max: 21.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "tempo-division selector in the app (integer steps); the XML stores a continuous \
                MidiControllerRange 0..21 — modeled Continuous per the table rules",
    },
    ParamDesc {
        id: "Voice_Modulators_Lfo1_Time_AttackTime",
        ui_name: "Voice  Modulators  Lfo1  Time  Attack Time",
        stored_min: 0.0,
        stored_max: 20.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_Lfo2_Retrigger",
        ui_name: "Voice  Modulators  Lfo2  Retrigger",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off, stored 0..1 (bool element in the preset XML)",
    },
    ParamDesc {
        id: "Voice_Modulators_Lfo2_Shape_Type",
        ui_name: "Voice  Modulators  Lfo2  Shape  Type",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Voice_Modulators_Lfo2_Shape_Amount",
        ui_name: "Voice  Modulators  Lfo2  Shape  Amount",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_Lfo2_Shape_Shaping",
        ui_name: "Voice  Modulators  Lfo2  Shape  Shaping",
        stored_min: -1.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_Lfo2_Shape_PhaseOffset",
        ui_name: "Voice  Modulators  Lfo2  Shape  Phase Offset",
        stored_min: 0.0,
        stored_max: 360.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_Lfo2_Time_Sync",
        ui_name: "Voice  Modulators  Lfo2  Time  Sync",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Voice_Modulators_Lfo2_Time_Rate",
        ui_name: "Voice  Modulators  Lfo2  Time  Rate",
        stored_min: 0.009999999776,
        stored_max: 30.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_Lfo2_Time_SyncedRate",
        ui_name: "Voice  Modulators  Lfo2  Time  Synced Rate",
        stored_min: 0.0,
        stored_max: 21.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "tempo-division selector in the app (integer steps); the XML stores a continuous \
                MidiControllerRange 0..21 — modeled Continuous per the table rules",
    },
    ParamDesc {
        id: "Voice_Modulators_Lfo2_Time_AttackTime",
        ui_name: "Voice  Modulators  Lfo2  Time  Attack Time",
        stored_min: 0.0,
        stored_max: 20.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_TimeScale",
        ui_name: "Voice  Modulators  Time Scale",
        stored_min: -1.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Modulators_Amount",
        ui_name: "Voice  Modulators  Amount",
        stored_min: 0.0,
        stored_max: 2.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Unison_Mode",
        ui_name: "Voice  Unison  Mode",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Voice_Unison_VoiceCount",
        ui_name: "Voice  Unison  Voice Count",
        stored_min: 0.0,
        stored_max: 3.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?"] },
        notes: "unison voice count; only stored values observed across the cited evidence bound \
                the extent — labels not in evidence",
    },
    ParamDesc {
        id: "Voice_Unison_Amount",
        ui_name: "Voice  Unison  Amount",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Global_Transpose",
        ui_name: "Voice  Global  Transpose",
        stored_min: -48.0,
        stored_max: 48.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Voice_Global_FilterRouting",
        ui_name: "Voice  Global  Filter Routing",
        stored_min: 0.0,
        stored_max: 0.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?"] },
        notes: "bare integer element — no menu structure or labels stored in the XML; stored \
                values observed: 0 (default); extent is an observed lower bound (the app menu \
                may extend it)",
    },
    ParamDesc {
        id: "Voice_Global_Glide",
        ui_name: "Voice  Global  Glide",
        stored_min: 0.0,
        stored_max: 20.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "stored extent = MidiControllerRange in the cited preset XML; behavior \
                unmeasured (no dossier)",
    },
    ParamDesc {
        id: "Volume",
        ui_name: "Volume",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Continuous,
        notes: "device output level, stored 0..1",
    },
    ParamDesc {
        id: "MonoPoly",
        ui_name: "Mono Poly",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?"] },
        notes: "mono/poly switch; bool element in the preset XML",
    },
    ParamDesc {
        id: "PolyVoices",
        ui_name: "Poly Voices",
        stored_min: 0.0,
        stored_max: 6.0,
        unit: "",
        kind: ParamKind::Discrete { labels: &["?", "?", "?", "?", "?", "?", "?"] },
        notes: "polyphony voice count; only stored values observed across the cited evidence \
                bound the extent — labels not in evidence",
    },
    ParamDesc {
        id: "HiQ",
        ui_name: "Hi Q",
        stored_min: 0.0,
        stored_max: 1.0,
        unit: "",
        kind: ParamKind::Toggle,
        notes: "on/off high-quality mode; bool element in the preset XML",
    },
];

/// Parameter table for a device, keyed by its XML/LOM **document element
/// name** (`"GlueCompressor"`, `"Echo"`, `"Reverb"`, `"Eq8"`, `"Delay"`, …).
/// Several product names differ from their document element: Chorus-Ensemble
/// stores as `Chorus2`, Hybrid Reverb as `Hybrid`, Utility as `StereoGain`,
/// and the Wavetable instrument's preset root element is `InstrumentVector`
/// (keyed here as `"Wavetable"`, its device name).
pub fn table(device: &str) -> Option<&'static [ParamDesc]> {
    match device {
        "GlueCompressor" => Some(GLUE_COMPRESSOR),
        "Echo" => Some(ECHO),
        "Reverb" => Some(REVERB),
        "Eq8" => Some(EQ8),
        "AutoFilter" => Some(AUTOFILTER),
        "AutoPan" => Some(AUTOPAN),
        "Saturator" => Some(SATURATOR),
        "DrumBuss" => Some(DRUMBUSS),
        "Chorus2" => Some(CHORUS_ENSEMBLE),
        "Delay" => Some(DELAY),
        "Hybrid" => Some(HYBRID_REVERB),
        "MultibandDynamics" => Some(MULTIBAND_DYNAMICS),
        "StereoGain" => Some(STEREO_GAIN),
        "Drift" => Some(DRIFT),
        "Wavetable" | "InstrumentVector" => Some(WAVETABLE),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn desc<'a>(table: &'a [ParamDesc], id: &str) -> &'a ParamDesc {
        table
            .iter()
            .find(|p| p.id == id)
            .unwrap_or_else(|| panic!("no param {id}"))
    }

    fn labels(p: &ParamDesc) -> Vec<f64> {
        match &p.kind {
            ParamKind::Discrete { labels } => labels
                .iter()
                .map(|l| l.parse::<f64>().unwrap_or_else(|_| panic!("label {l}")))
                .collect(),
            other => panic!("not discrete: {other:?}"),
        }
    }

    fn assert_toggle(p: &ParamDesc) {
        assert_eq!(p.kind, ParamKind::Toggle, "{}", p.id);
        assert_eq!(p.stored_min, 0.0);
        assert_eq!(p.stored_max, 1.0);
    }

    fn assert_continuous(p: &ParamDesc, min: f64, max: f64) {
        assert_eq!(p.kind, ParamKind::Continuous, "{}", p.id);
        assert_eq!(p.stored_min, min, "{} min", p.id);
        assert_eq!(p.stored_max, max, "{} max", p.id);
    }

    fn assert_range(p: &ParamDesc, min: f64, max: f64) {
        assert_eq!(p.stored_min, min, "{} min", p.id);
        assert_eq!(p.stored_max, max, "{} max", p.id);
    }

    /// Menu labels match the dossier numbers exactly
    /// (devices/glue-compressor.md parameter-law section: attack table
    /// {82, 820, 2700, 8200, 27000, 82000, 270000} µs → ms; release table
    /// {170690, 249580, 340761, 478756, 643902, 880000, 91000}; Ratio is a
    /// 3-entry discrete menu, D1-final).
    #[test]
    fn glue_menus_match_dossier() {
        let t = table("GlueCompressor").expect("glue table");

        let ratio = desc(t, "Ratio");
        assert_eq!(ratio.kind, ParamKind::Discrete { labels: &["0", "1", "2"] });
        assert_eq!(labels(ratio), vec![0.0, 1.0, 2.0]);
        assert_eq!(ratio.stored_min, 0.0);
        assert_eq!(ratio.stored_max, 2.0);

        let attack = desc(t, "Attack");
        assert_eq!(attack.unit, "ms");
        assert_eq!(
            labels(attack),
            vec![0.082, 0.82, 2.7, 8.2, 27.0, 82.0, 270.0]
        );

        let release = desc(t, "Release");
        assert_eq!(labels(release), vec![
            170690.0, 249580.0, 340761.0, 478756.0, 643902.0, 880000.0, 91000.0
        ]);
        assert_eq!(release.stored_min, 0.0);
        assert_eq!(release.stored_max, 6.0);
    }

    /// Stored ranges match the parameter-table evidence
    /// (evidence/devices/GlueCompressor/parameter-table.md, MidiControllerRange
    /// column; toggles stored 0..1).
    #[test]
    fn glue_ranges_match_parameter_table() {
        let t = table("GlueCompressor").expect("glue table");
        assert_eq!(t.len(), 8);

        assert_continuous(desc(t, "Threshold"), -40.0, 0.0);
        assert_continuous(desc(t, "Range"), 0.0, 70.0);
        assert_continuous(desc(t, "Makeup"), 0.0, 20.0);
        assert_continuous(desc(t, "DryWet"), 0.0, 1.0);
        assert_range(desc(t, "Attack"), 0.0, 6.0);
        assert_range(desc(t, "Release"), 0.0, 6.0);
        assert_range(desc(t, "Ratio"), 0.0, 2.0);
        assert_toggle(desc(t, "PeakClipIn"));

        // every menu length matches its stored index extent
        for p in t {
            if let ParamKind::Discrete { labels } = p.kind {
                assert_eq!(
                    labels.len() as f64,
                    p.stored_max - p.stored_min + 1.0,
                    "{} label count vs extent",
                    p.id
                );
            }
        }
    }

    /// Echo ranges match the preset XML
    /// (evidence/devices/Echo/preset-time-travel.xml, MidiControllerRange
    /// elements) and the dossier semantics (Delay_Time in SECONDS, Feedback
    /// linear 0..1.5, DryWet 0..1).
    #[test]
    fn echo_ranges_match_preset_xml() {
        let t = table("Echo").expect("echo table");
        assert_eq!(t.len(), 14);

        assert_toggle(desc(t, "Delay_SyncL"));
        assert_toggle(desc(t, "Delay_SyncR"));
        assert_continuous(desc(t, "Delay_TimeL"), 0.001000000047, 2.5);
        assert_continuous(desc(t, "Delay_TimeR"), 0.001000000047, 2.5);
        assert_eq!(desc(t, "Delay_TimeL").unit, "s");
        assert_eq!(desc(t, "Delay_TimeR").unit, "s");
        assert_continuous(desc(t, "Feedback"), 0.0, 1.5);
        assert_continuous(desc(t, "DryWet"), 0.0, 1.0);

        // Filter section as present in the XML
        assert_toggle(desc(t, "Filter_On"));
        assert_continuous(desc(t, "Filter_HighPassFrequency"), 20.0000706, 20000.1035);
        assert_continuous(desc(t, "Filter_HighPassResonance"), 0.0, 0.3000000119);
        assert_continuous(desc(t, "Filter_LowPassFrequency"), 20.0000706, 20000.1035);
        assert_continuous(desc(t, "Filter_LowPassResonance"), 0.0, 0.3000000119);

        // Reverb section as present in the XML
        assert_continuous(desc(t, "Reverb_Level"), 0.0, 1.0);
        assert_continuous(desc(t, "Reverb_Decay"), 0.0, 1.0);

        // ChannelMode: discrete, documented entry is stored 1 (pingpong)
        let cm = desc(t, "ChannelMode");
        assert!(matches!(cm.kind, ParamKind::Discrete { .. }));
        assert_eq!(cm.stored_min, 0.0);
        assert_eq!(cm.stored_max, 2.0);
    }

    /// Reverb ranges match the default preset XML
    /// (evidence/devices/Reverb/default.xml, MidiControllerRange elements)
    /// and the dossier units (PreDelay/DecayTime stored in ms).
    #[test]
    fn reverb_ranges_match_default_xml() {
        let t = table("Reverb").expect("reverb table");
        assert_eq!(t.len(), 11);

        assert_continuous(desc(t, "PreDelay"), 0.5, 249.999969);
        assert_continuous(desc(t, "DecayTime"), 199.999985, 60000.0039);
        assert_eq!(desc(t, "PreDelay").unit, "ms");
        assert_eq!(desc(t, "DecayTime").unit, "ms");

        assert_continuous(desc(t, "MixDirect"), 0.0, 1.0);
        assert_continuous(desc(t, "MixReflect"), 0.02999999933, 1.99530005);
        assert_continuous(desc(t, "MixDiffuse"), 0.02999999933, 1.99530005);

        assert_toggle(desc(t, "ShelfHighOn"));
        assert_toggle(desc(t, "ShelfLowOn"));
        assert_continuous(desc(t, "ShelfHiFreq"), 19.9999981, 15999.998);
        assert_continuous(desc(t, "ShelfHiGain"), 0.200000003, 1.0);
        assert_continuous(desc(t, "ShelfLoFreq"), 19.9999981, 15000.001);
        assert_continuous(desc(t, "ShelfLoGain"), 0.200000003, 1.0);
    }

    /// Lookup by XML element name; unknown devices return None; ids are
    /// unique within a table; every table entry has a provenance note.
    #[test]
    fn table_lookup_and_integrity() {
        assert_eq!(table("GlueCompressor").map(|t| t.len()), Some(8));
        assert_eq!(table("Echo").map(|t| t.len()), Some(14));
        assert_eq!(table("Reverb").map(|t| t.len()), Some(11));
        assert_eq!(table("Eq8").map(|t| t.len()), Some(90));
        assert_eq!(table("AutoFilter").map(|t| t.len()), Some(28));
        assert_eq!(table("AutoPan").map(|t| t.len()), Some(16));
        assert_eq!(table("Saturator").map(|t| t.len()), Some(18));
        assert_eq!(table("DrumBuss").map(|t| t.len()), Some(14));
        assert_eq!(table("Chorus2").map(|t| t.len()), Some(14));
        assert_eq!(table("Delay").map(|t| t.len()), Some(28));
        assert_eq!(table("Hybrid").map(|t| t.len()), Some(58));
        assert_eq!(table("MultibandDynamics").map(|t| t.len()), Some(42));
        assert_eq!(table("StereoGain").map(|t| t.len()), Some(17));
        assert_eq!(table("Drift").map(|t| t.len()), Some(81));
        assert_eq!(table("Wavetable").map(|t| t.len()), Some(101));
        assert_eq!(table("InstrumentVector").map(|t| t.len()), Some(101));
        assert_eq!(table("Compressor"), None);
        assert_eq!(table("reverb"), None); // exact element-name match only

        let all = [
            "GlueCompressor",
            "Echo",
            "Reverb",
            "Eq8",
            "AutoFilter",
            "AutoPan",
            "Saturator",
            "DrumBuss",
            "Chorus2",
            "Delay",
            "Hybrid",
            "MultibandDynamics",
            "StereoGain",
            "Drift",
            "Wavetable",
        ];
        for device in all {
            let t = table(device).unwrap();
            for (i, p) in t.iter().enumerate() {
                assert!(t[..i].iter().all(|q| q.id != p.id), "{device}: dup {}", p.id);
                assert!(!p.notes.is_empty(), "{device}: {} missing notes", p.id);
                assert!(!p.ui_name.is_empty(), "{device}: {} missing ui_name", p.id);
                assert!(
                    p.stored_min <= p.stored_max,
                    "{device}: {} inverted range",
                    p.id
                );
                if let ParamKind::Discrete { labels } = p.kind {
                    assert_eq!(
                        labels.len() as f64,
                        p.stored_max - p.stored_min + 1.0,
                        "{device}: {} label count vs extent",
                        p.id
                    );
                }
            }
        }
    }

    /// EQ8 ranges match the preset XML
    /// (evidence/devices/Eq8/default.xml, MidiControllerRange elements) and
    /// the 8-band A/B structure is fully present.
    #[test]
    fn eq8_ranges_match_preset_xml() {
        let t = table("Eq8").expect("eq8 table");
        assert_eq!(t.len(), 90);

        assert_continuous(desc(t, "GlobalGain"), -12.0, 12.0);
        assert_continuous(desc(t, "Scale"), -2.0, 2.0);
        assert_toggle(desc(t, "On"));
        assert_toggle(desc(t, "AdaptiveQ"));

        // every band carries both A and B slots; Freq/Gain/Q extents are
        // uniform, while band Mode extents are per-path observed maxima
        // across the cited evidence (band shape menu, labels not in evidence)
        let mode_max_a = [2.0, 3.0, 3.0, 5.0, 6.0, 3.0, 5.0, 6.0];
        let mode_max_b = [3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 5.0, 6.0];
        for band in 0..8 {
            for (slot, maxes) in [("ParameterA", &mode_max_a), ("ParameterB", &mode_max_b)] {
                let base = format!("Bands.{band}/{slot}");
                assert_toggle(desc(t, &format!("{base}/IsOn")));
                assert_continuous(desc(t, &format!("{base}/Freq")), 30.0, 22000.0);
                assert_continuous(desc(t, &format!("{base}/Gain")), -15.0, 15.0);
                assert_continuous(desc(t, &format!("{base}/Q")), 0.1000000015, 18.0);
                assert_eq!(desc(t, &format!("{base}/Freq")).unit, "Hz");
                let mode = desc(t, &format!("{base}/Mode"));
                assert!(matches!(mode.kind, ParamKind::Discrete { .. }));
                assert_range(mode, 0.0, maxes[band]);
            }
        }
    }

    /// AutoFilter ranges match the preset XML
    /// (evidence/devices/AutoFilter/default.xml + the two cited presets for
    /// the FilterType extent). The nested LFO hub has its own ranges,
    /// distinct from AutoPan's.
    #[test]
    fn autofilter_ranges_match_preset_xml() {
        let t = table("AutoFilter").expect("autofilter table");
        assert_eq!(t.len(), 28);

        // Cutoff is stored on a note/semitone-like scale, NOT Hz (20..135)
        let cutoff = desc(t, "Cutoff");
        assert_continuous(cutoff, 20.0, 135.0);
        assert_eq!(cutoff.unit, "");

        assert_continuous(desc(t, "Resonance"), 0.0, 1.25);
        assert_continuous(desc(t, "LegacyQ"), 0.200000003, 3.0);
        assert_continuous(desc(t, "Morph"), 0.0, 1.0);
        assert_continuous(desc(t, "Drive"), 0.0, 24.0);
        assert_continuous(desc(t, "ModHub"), -127.0, 127.0);
        assert_continuous(desc(t, "Attack"), 0.1000000015, 30.0);
        assert_continuous(desc(t, "Release"), 0.1000000015, 400.0);
        assert_continuous(desc(t, "LfoAmount"), 0.0, 30.0);

        // discrete filter selectors: observed lower-bound extents
        let ft = desc(t, "FilterType");
        assert!(matches!(ft.kind, ParamKind::Discrete { .. }));
        assert_range(ft, 0.0, 4.0); // 0 default, 2 'Bandpass Spinner', 4 'Stereo Notch'
        assert_range(desc(t, "LegacyFilterType"), 0.0, 3.0);
        assert_toggle(desc(t, "Slope"));

        // nested Lfo hub (ranges differ from AutoPan's)
        assert_continuous(desc(t, "Lfo/Frequency"), 0.009999999776, 10.0);
        assert_continuous(desc(t, "Lfo/BeatRate"), 0.0, 21.0);
        assert_continuous(desc(t, "Lfo/Phase"), 0.0, 360.0);
        assert_toggle(desc(t, "Lfo/IsOn"));
    }

    /// AutoPan: everything lives in the nested Lfo hub
    /// (evidence/devices/AutoPan/preset-slow-steady.xml).
    #[test]
    fn autopan_ranges_match_preset_xml() {
        let t = table("AutoPan").expect("autopan table");
        assert_eq!(t.len(), 16);
        assert_toggle(desc(t, "On"));

        assert_continuous(desc(t, "Lfo/Frequency"), 0.05000000075, 90.0);
        assert_eq!(desc(t, "Lfo/Frequency").unit, "Hz");
        assert_continuous(desc(t, "Lfo/BeatRate"), 0.0, 14.0);
        assert_continuous(desc(t, "Lfo/Spin"), 0.0, 0.5);
        assert_continuous(desc(t, "Lfo/Phase"), 0.0, 360.0);
        assert_continuous(desc(t, "Lfo/Offset"), 0.0, 360.0);
        assert_continuous(desc(t, "Lfo/NoiseWidth"), 0.0, 1.0);
        assert_continuous(desc(t, "Lfo/LfoAmount"), 0.0, 1.0);
        assert_continuous(desc(t, "Lfo/LfoShape"), 0.0, 1.0);
        assert_toggle(desc(t, "Lfo/IsOn"));
        assert_toggle(desc(t, "Lfo/Quantize"));
        assert_toggle(desc(t, "Lfo/LfoInvert"));
        assert_range(desc(t, "Lfo/RateType"), 0.0, 1.0); // observed 0..1
    }

    /// Saturator ranges match the preset XML
    /// (evidence/devices/Saturator/default.xml; Type extent from the cited
    /// presets: 5 in 'Digital Clip Center').
    #[test]
    fn saturator_ranges_match_preset_xml() {
        let t = table("Saturator").expect("saturator table");
        assert_eq!(t.len(), 18);

        let ty = desc(t, "Type");
        assert!(matches!(ty.kind, ParamKind::Discrete { .. }));
        assert_range(ty, 0.0, 5.0);

        assert_continuous(desc(t, "DryWet"), 0.0, 1.0);
        assert_continuous(desc(t, "PreDrive"), -36.0, 36.0);
        assert_continuous(desc(t, "PostDrive"), -36.0, 0.0);
        assert_continuous(desc(t, "BaseDrive"), -36.0, 36.0);
        assert_continuous(desc(t, "ColorFrequency"), 30.0, 18500.0);
        assert_eq!(desc(t, "ColorFrequency").unit, "Hz");
        assert_continuous(desc(t, "ColorWidth"), 0.0, 1.0);
        assert_continuous(desc(t, "ColorDepth"), -24.0, 24.0);
        assert_toggle(desc(t, "ColorOn"));
        assert_toggle(desc(t, "PostClip"));
        assert_toggle(desc(t, "PreDcFilter"));
        assert_range(desc(t, "Oversampling"), 0.0, 1.0); // observed 0..1

        // waveshaper section
        assert_continuous(desc(t, "WaveShaper/Drive"), 0.0, 1.0);
        assert_continuous(desc(t, "WaveShaper/Depth"), 0.0, 1.0);
        assert_continuous(desc(t, "WaveShaper/Period"), 0.0, 1.0);
    }

    /// DrumBuss ranges match the preset XML
    /// (evidence/devices/DrumBuss/preset-drum-pumper.xml; DriveType extent
    /// from the cited presets). Gain-like rows are linear, not dB.
    #[test]
    fn drumbuss_ranges_match_preset_xml() {
        let t = table("DrumBuss").expect("drumbuss table");
        assert_eq!(t.len(), 14);

        assert_continuous(desc(t, "DriveAmount"), 0.0, 1.0);
        assert_continuous(desc(t, "CrunchAmount"), 0.0, 1.0);
        assert_continuous(desc(t, "DampingFrequency"), 500.0, 20000.0);
        assert_eq!(desc(t, "DampingFrequency").unit, "Hz");
        assert_continuous(desc(t, "TransientShaping"), -1.0, 1.0);
        assert_continuous(desc(t, "BoomFrequency"), 30.0, 90.0);
        assert_eq!(desc(t, "BoomFrequency").unit, "Hz");
        assert_continuous(desc(t, "BoomAmount"), 0.0, 1.0);
        assert_continuous(desc(t, "BoomDecay"), 0.0, 1.0);
        assert_continuous(desc(t, "InputTrim"), 0.0003162277571, 1.0);
        assert_continuous(desc(t, "OutputGain"), 0.009999999776, 1.41253757);
        assert_continuous(desc(t, "DryWet"), 0.0, 1.0);
        assert_toggle(desc(t, "EnableCompression"));
        assert_toggle(desc(t, "BoomAudition"));
        assert_range(desc(t, "DriveType"), 0.0, 2.0); // observed 0..2
    }

    /// Chorus-Ensemble ranges match the preset XML
    /// (evidence/devices/ChorusEnsemble/preset-chorus-classic.xml; Mode 0/1/2
    /// each observed in a Chorus/Ensemble/Vibrato preset).
    #[test]
    fn chorus_ensemble_ranges_match_preset_xml() {
        let t = table("Chorus2").expect("chorus table");
        assert_eq!(t.len(), 14);

        let mode = desc(t, "Mode");
        assert!(matches!(mode.kind, ParamKind::Discrete { .. }));
        assert_eq!(
            mode.kind,
            ParamKind::Discrete { labels: &["?", "?", "?"] }
        );
        assert_range(mode, 0.0, 2.0);

        assert_continuous(desc(t, "Rate"), 0.1000000015, 15.0);
        // Rate's stored unit is unresolved (Hz suspected) — element name does
        // not declare a frequency, so no unit is claimed
        assert_eq!(desc(t, "Rate").unit, "");
        assert_continuous(desc(t, "Amount"), 0.0, 1.0);
        assert_continuous(desc(t, "Feedback"), 0.0, 0.9900000095);
        assert_continuous(desc(t, "VibratoOffset"), 0.0, 180.0);
        assert_continuous(desc(t, "HighpassFrequency"), 20.0, 2000.0);
        assert_eq!(desc(t, "HighpassFrequency").unit, "Hz");
        assert_continuous(desc(t, "Width"), 0.0, 2.0);
        assert_continuous(desc(t, "Warmth"), 0.0, 1.0);
        assert_continuous(desc(t, "OutputGain"), 0.0, 2.0);
        assert_continuous(desc(t, "DryWet"), 0.0, 1.0);
        assert_continuous(desc(t, "Shaping"), 0.0, 1.0);
        assert_toggle(desc(t, "InvertFeedback"));
        assert_toggle(desc(t, "HighpassEnabled"));
    }

    /// Delay ranges match the preset XML
    /// (evidence/devices/Delay/default.xml + the two cited Clean Delay
    /// presets). Time units are left unresolved — no dossier pins them.
    #[test]
    fn delay_ranges_match_preset_xml() {
        let t = table("Delay").expect("delay table");
        assert_eq!(t.len(), 28);

        assert_continuous(desc(t, "DelayLine_TimeL"), 0.001000000047, 5.0);
        assert_continuous(desc(t, "DelayLine_TimeR"), 0.001000000047, 5.0);
        assert_eq!(desc(t, "DelayLine_TimeL").unit, ""); // unresolved, noted
        assert_continuous(desc(t, "DelayLine_SimpleDelayTimeL"), 1.0, 300.0);
        assert_continuous(desc(t, "DelayLine_SimpleDelayTimeR"), 1.0, 300.0);
        assert_continuous(desc(t, "DelayLine_PingPongDelayTimeL"), 1.0, 999.0);
        assert_continuous(desc(t, "DelayLine_PingPongDelayTimeR"), 1.0, 999.0);
        assert_continuous(desc(t, "DelayLine_OffsetL"), -0.3300000131, 0.3300000131);

        assert_continuous(desc(t, "Feedback"), 0.0, 0.9499999881);
        assert_toggle(desc(t, "Freeze"));
        assert_toggle(desc(t, "DelayLine_Link"));
        assert_toggle(desc(t, "DelayLine_PingPong"));
        assert_toggle(desc(t, "DelayLine_SyncL"));
        assert_toggle(desc(t, "DelayLine_SyncR"));

        assert_toggle(desc(t, "Filter_On"));
        assert_continuous(desc(t, "Filter_Frequency"), 49.9999962, 18000.0059);
        assert_eq!(desc(t, "Filter_Frequency").unit, "Hz");
        assert_continuous(desc(t, "Filter_Bandwidth"), 0.5, 9.0);
        assert_continuous(desc(t, "Modulation_Frequency"), 0.01000000071, 39.9999962);
        assert_continuous(desc(t, "Modulation_AmountTime"), 0.0, 1.0);
        assert_continuous(desc(t, "Modulation_AmountFilter"), 0.0, 1.0);
        assert_continuous(desc(t, "DryWet"), 0.0, 1.0);

        // discrete rows with observed lower-bound extents
        let sync = desc(t, "DelayLine_SyncedSixteenthL");
        assert!(matches!(sync.kind, ParamKind::Discrete { .. }));
        assert_range(sync, 0.0, 3.0); // observed 0..3 across cited presets
        assert_range(desc(t, "DelayLine_SyncedSixteenthR"), 0.0, 3.0);
        assert_range(desc(t, "DelayLine_SmoothingMode"), 0.0, 1.0); // set evidence: 1 observed
        assert_range(desc(t, "DryWetMode"), 0.0, 1.0); // default preset stores 1
        assert_range(desc(t, "DelayLine_CompatibilityMode"), 0.0, 0.0);
        assert_toggle(desc(t, "EcoProcessing"));
    }

    /// Hybrid Reverb ranges match the default preset XML
    /// (evidence/devices/HybridReverb/default.xml, document element `Hybrid`).
    #[test]
    fn hybrid_reverb_ranges_match_preset_xml() {
        let t = table("Hybrid").expect("hybrid table");
        assert_eq!(t.len(), 58);

        assert_continuous(desc(t, "PreDelay_Time"), 0.0, 4.0);
        assert_continuous(desc(t, "PreDelay_Sixteenth"), 0.0, 16.0);
        assert_continuous(desc(t, "PreDelay_FeedbackTime"), 0.0, 0.9499999881);
        assert_continuous(desc(t, "Algorithm_Decay"), 0.1000000015, 60.0);
        assert_continuous(desc(t, "Algorithm_Size"), 0.0, 1.0);
        assert_continuous(desc(t, "Algorithm_Damping"), 0.0, 1.0);
        assert_continuous(desc(t, "Algorithm_Diffusion"), 0.0, 1.0);
        assert_continuous(desc(t, "Algorithm_BassMultiplier"), 0.25, 4.0);
        assert_continuous(desc(t, "Algorithm_BassCrossover"), 79.9999924, 999.999878);
        assert_eq!(desc(t, "Algorithm_BassCrossover").unit, "Hz");
        assert_continuous(desc(t, "Algorithm_PitchShift"), -12.0, 12.0);
        assert_continuous(desc(t, "Algorithm_TidesRate"), 0.0, 29.0);
        assert_continuous(
            desc(t, "Algorithm_Prism_CrossoverFrequency"),
            399.999969,
            5499.99951,
        );
        assert_continuous(desc(t, "ConvoAlgoBlend"), 0.0, 1.0);
        assert_continuous(desc(t, "Vintage"), 0.0, 4.0);
        assert_continuous(desc(t, "StereoWidth"), 0.0, 2.0);
        assert_continuous(desc(t, "Send"), 0.0, 1.0);
        assert_continuous(desc(t, "DryWet"), 0.0, 1.0);
        assert_toggle(desc(t, "Algorithm_Freeze"));
        assert_toggle(desc(t, "BassMono"));
        assert_toggle(desc(t, "Eq_On"));

        // EQ section
        assert_continuous(desc(t, "Eq_LowBandFrequency"), 19.9999981, 19999.9961);
        assert_continuous(desc(t, "Eq_LowBandGain"), 0.25, 4.0);
        assert_continuous(desc(t, "Eq_LowBandSlope"), 0.0, 9.0);
        assert_continuous(desc(t, "Eq_Peak1Q"), 0.1000000015, 4.0);
        assert_continuous(desc(t, "Eq_HighBandFrequency"), 19.9999981, 19999.9961);

        // discrete rows with observed lower-bound extents
        let algo = desc(t, "Algorithm_Type");
        assert!(matches!(algo.kind, ParamKind::Discrete { .. }));
        assert_range(algo, 0.0, 0.0); // only stored 0 observed
        assert_range(desc(t, "Routing"), 0.0, 1.0); // stored 1 in the preset
        assert_range(desc(t, "Eq_HighBandType"), 0.0, 1.0);
    }

    /// Multiband Dynamics ranges match the preset XML
    /// (evidence/devices/MultibandDynamics/preset-multiband-compression.xml).
    #[test]
    fn multiband_dynamics_ranges_match_preset_xml() {
        let t = table("MultibandDynamics").expect("mbd table");
        assert_eq!(t.len(), 42);

        assert_continuous(desc(t, "SplitLowMid"), 29.9999981, 3000.0);
        assert_eq!(desc(t, "SplitLowMid").unit, "Hz");
        assert_continuous(desc(t, "SplitMidHigh"), 300.000061, 14999.998);
        assert_eq!(desc(t, "SplitMidHigh").unit, "Hz");
        assert_continuous(desc(t, "OutputGain"), -24.0, 24.0);
        assert_continuous(desc(t, "GlobalAmount"), 0.0, 1.0);
        assert_continuous(desc(t, "GlobalTime"), 0.1000000015, 10.0);

        // per-band symmetry: same extents across Low/Mid/High
        for band in ["Low", "Mid", "High"] {
            assert_continuous(desc(t, &format!("Gain{band}")), -24.0, 24.0);
            assert_continuous(desc(t, &format!("InputGain{band}")), -24.0, 24.0);
            assert_continuous(desc(t, &format!("AboveThreshold{band}")), -80.0, 0.0);
            assert_continuous(desc(t, &format!("BelowThreshold{band}")), -80.0, 0.0);
            assert_continuous(desc(t, &format!("AboveRatio{band}")), -1.0, 1.0);
            assert_continuous(desc(t, &format!("BelowRatio{band}")), -3.0, 1.0);
            assert_continuous(
                desc(t, &format!("Attack{band}")),
                0.1000000015,
                5000.00098,
            );
            assert_continuous(
                desc(t, &format!("Release{band}")),
                0.1000000015,
                5000.00098,
            );
            assert_toggle(desc(t, &format!("Active{band}")));
        }
        assert_toggle(desc(t, "SoftKnee"));
        assert_toggle(desc(t, "EnvelopeIsPeak"));
        assert_toggle(desc(t, "SoloMid"));
        assert_range(desc(t, "ActiveEditMode"), 0.0, 2.0); // observed 0..2
    }

    /// Utility (StereoGain) ranges match the preset XML
    /// (evidence/devices/Utility/preset-*.xml; ChannelMode 0/1/2 observed in
    /// Left / Mono-family / Right).
    #[test]
    fn stereo_gain_ranges_match_preset_xml() {
        let t = table("StereoGain").expect("stereogain table");
        assert_eq!(t.len(), 17);

        let cm = desc(t, "ChannelMode");
        assert!(matches!(cm.kind, ParamKind::Discrete { .. }));
        assert_range(cm, 0.0, 2.0);

        assert_continuous(desc(t, "StereoWidth"), 0.0, 4.0);
        assert_continuous(desc(t, "MidSideBalance"), 0.0, 2.0);
        assert_continuous(desc(t, "BassMonoFrequency"), 50.0, 500.0);
        assert_eq!(desc(t, "BassMonoFrequency").unit, "Hz");
        assert_continuous(desc(t, "Balance"), -1.0, 1.0);
        // linear Gain and dB LegacyGain span the same range (10^(35/20))
        assert_continuous(desc(t, "Gain"), 0.0, 56.2341309);
        assert_continuous(desc(t, "LegacyGain"), -35.0, 35.0);
        assert_toggle(desc(t, "PhaseInvertL"));
        assert_toggle(desc(t, "PhaseInvertR"));
        assert_toggle(desc(t, "Mono"));
        assert_toggle(desc(t, "BassMono"));
        assert_toggle(desc(t, "Mute"));
        assert_toggle(desc(t, "DcFilter"));
        assert_toggle(desc(t, "LegacyMode"));
        assert_toggle(desc(t, "MidSideBalanceOn"));
        assert_toggle(desc(t, "BassMonoAudition"));
    }

    /// Drift top-level voice parameters match the default preset XML
    /// (evidence/devices/Drift/default.xml). The voice model is NOT rebuilt
    /// in live-dynamics — stored document model only.
    #[test]
    fn drift_ranges_match_preset_xml() {
        let t = table("Drift").expect("drift table");
        assert_eq!(t.len(), 81);

        assert_continuous(desc(t, "Filter_Frequency"), 19.9999981, 19999.9961);
        assert_eq!(desc(t, "Filter_Frequency").unit, "Hz");
        assert_continuous(desc(t, "Filter_Resonance"), 0.0, 1.00999999);
        assert_continuous(desc(t, "Filter_HiPassFrequency"), 9.99999905, 20479.998);
        assert_continuous(desc(t, "Filter_ModAmount1"), -1.0, 1.0);

        assert_continuous(desc(t, "Lfo_Rate"), 0.1700000018, 1700.0);
        assert_continuous(desc(t, "Lfo_Ratio"), 0.25, 16.0);
        assert_continuous(desc(t, "Lfo_Time"), 0.1000000015, 60.0);
        assert_continuous(desc(t, "Lfo_SyncedRate"), 0.0, 21.0); // division stepper, noted
        assert_continuous(desc(t, "Lfo_Amount"), 0.0, 1.0);

        assert_continuous(desc(t, "Oscillator1_Shape"), 0.0, 1.0);
        assert_continuous(desc(t, "Oscillator1_Transpose"), -2.0, 3.0);
        assert_continuous(desc(t, "Oscillator2_Detune"), -7.0, 7.0);
        assert_continuous(desc(t, "Oscillator2_Transpose"), -3.0, 2.0);

        assert_continuous(desc(t, "Mixer_OscillatorGain1"), 0.0, 1.99526799);
        assert_continuous(desc(t, "Mixer_NoiseLevel"), 0.0, 1.99526799);
        assert_toggle(desc(t, "Mixer_OscillatorOn1"));

        assert_continuous(desc(t, "Envelope1_Attack"), 0.0, 60.0);
        assert_continuous(desc(t, "Envelope1_Decay"), 0.004999999888, 60.0);
        assert_continuous(desc(t, "Envelope1_Release"), 0.009999999776, 60.0);
        assert_continuous(desc(t, "Envelope1_Sustain"), 0.0, 1.0);
        assert_continuous(desc(t, "Envelope2_Sustain"), 0.0, 1.0);

        assert_continuous(desc(t, "CyclingEnvelope_MidPoint"), 0.0, 1.0);
        assert_continuous(desc(t, "Global_Glide"), 0.0, 2.0);
        assert_continuous(desc(t, "Global_Volume"), 0.0, 1.0);
        assert_continuous(desc(t, "Global_Transpose"), -48.0, 48.0);
        assert_toggle(desc(t, "Global_Legato"));
        assert_toggle(desc(t, "Global_ResetOscillatorPhase"));

        // selectors: observed lower-bound extents
        let osc1 = desc(t, "Oscillator1_Type");
        assert!(matches!(osc1.kind, ParamKind::Discrete { .. }));
        assert_range(osc1, 0.0, 4.0); // stored 4 in the default preset
        assert_range(desc(t, "Oscillator2_Type"), 0.0, 0.0); // only 0 observed
        assert_range(desc(t, "Global_VoiceCount"), 0.0, 4.0); // stored 4
        assert_range(desc(t, "Global_PitchBendRange"), 0.0, 2.0); // stored 2
    }

    /// Wavetable top-level voice parameters match the default preset XML
    /// (evidence/devices/Wavetable/default.xml). The voice model is NOT
    /// rebuilt in live-dynamics — stored document model only.
    #[test]
    fn wavetable_ranges_match_preset_xml() {
        let t = table("Wavetable").expect("wavetable table");
        assert_eq!(t.len(), 101);

        assert_continuous(desc(t, "Voice_Oscillator1_Pitch_Transpose"), -24.0, 24.0);
        assert_continuous(desc(t, "Voice_Oscillator1_Pitch_Detune"), -0.5, 0.5);
        assert_continuous(
            desc(t, "Voice_Oscillator1_Wavetables_WavePosition"),
            0.0,
            1.0,
        );
        assert_continuous(desc(t, "Voice_Oscillator1_Effects_Effect1"), -1.0, 1.0);
        assert_continuous(desc(t, "Voice_Oscillator1_Effects_Effect2"), 0.0, 1.0);
        assert_continuous(desc(t, "Voice_Oscillator1_Pan"), -1.0, 1.0);
        assert_continuous(desc(t, "Voice_Oscillator1_Gain"), 0.0, 1.0);
        assert_toggle(desc(t, "Voice_Oscillator1_On"));
        assert_range(desc(t, "Voice_Oscillator1_Effects_EffectMode"), 0.0, 3.0);

        // oscillator 2 mirrors oscillator 1's extents
        assert_continuous(desc(t, "Voice_Oscillator2_Pitch_Transpose"), -24.0, 24.0);
        assert_continuous(desc(t, "Voice_Oscillator2_Gain"), 0.0, 1.0);
        assert_toggle(desc(t, "Voice_Oscillator2_On"));

        assert_continuous(desc(t, "Voice_SubOscillator_Tone"), 0.0, 1.0);
        assert_continuous(desc(t, "Voice_SubOscillator_Gain"), 0.0, 1.0);
        assert_toggle(desc(t, "Voice_SubOscillator_On"));

        assert_continuous(desc(t, "Voice_Filter1_Frequency"), 19.9999981, 20479.998);
        assert_eq!(desc(t, "Voice_Filter1_Frequency").unit, "Hz");
        assert_continuous(desc(t, "Voice_Filter1_Resonance"), 0.0, 1.25);
        assert_continuous(desc(t, "Voice_Filter1_Drive"), 0.0, 24.0);
        assert_continuous(desc(t, "Voice_Filter2_Frequency"), 19.9999981, 20479.998);
        assert_toggle(desc(t, "Voice_Filter1_On"));
        // filter-type extents are per-path observed maxima: Filter1 only
        // stores 0, Filter2 stores 1 in the default preset
        assert_range(desc(t, "Voice_Filter1_Type"), 0.0, 0.0);
        assert_range(desc(t, "Voice_Filter2_Type"), 0.0, 1.0);
        assert_range(desc(t, "Voice_Filter1_Slope"), 0.0, 0.0);

        assert_continuous(
            desc(t, "Voice_Modulators_AmpEnvelope_Times_Attack"),
            0.0,
            20.0,
        );
        assert_continuous(
            desc(t, "Voice_Modulators_AmpEnvelope_Times_Decay"),
            0.001500000013,
            20.0,
        );
        assert_continuous(
            desc(t, "Voice_Modulators_AmpEnvelope_Slopes_Decay"),
            -1.0,
            1.0,
        );
        assert_continuous(desc(t, "Voice_Modulators_AmpEnvelope_Sustain"), 0.0, 1.0);
        assert_continuous(desc(t, "Voice_Modulators_Envelope2_Values_Peak"), 0.0, 1.0);
        assert_continuous(
            desc(t, "Voice_Modulators_Lfo1_Time_Rate"),
            0.009999999776,
            30.0,
        );
        assert_continuous(
            desc(t, "Voice_Modulators_Lfo1_Time_SyncedRate"),
            0.0,
            21.0,
        );
        assert_continuous(desc(t, "Voice_Modulators_Lfo1_Shape_PhaseOffset"), 0.0, 360.0);
        assert_continuous(desc(t, "Voice_Modulators_TimeScale"), -1.0, 1.0);
        assert_continuous(desc(t, "Voice_Modulators_Amount"), 0.0, 2.0);

        assert_continuous(desc(t, "Voice_Unison_Amount"), 0.0, 1.0);
        assert_continuous(desc(t, "Voice_Global_Transpose"), -48.0, 48.0);
        assert_continuous(desc(t, "Voice_Global_Glide"), 0.0, 20.0);
        assert_continuous(desc(t, "Volume"), 0.0, 1.0);
        assert_toggle(desc(t, "HiQ"));
    }
}
