//! EQ Eight (Eq8) — typed parameter surface plus the closed-form coefficient
//! law layer (no fitted scalars, no behavioral claims).
//!
//! Surface source (official evidence, licensed app bundle copy):
//! `docs/research/ableton-live-12.0.25/evidence/devices/Eq8/default.xml` —
//! factory default dump (`evidence/devices/Eq8/default.xml`). App-bundle origin not applicable (unpacked copy already carried in evidence).
//!
//! Method: every automatable parameter is an XML element carrying a
//! `Manual` child; `RANGES` records each element's `MidiControllerRange`
//! Min/Max where the source declares one (discrete and boolean parameters
//! carry none). Value kinds are mechanical: `true`/`false` Manual -> `bool`,
//! declared range -> `f64`, bare integer -> `i64` (discrete). DEFAULTS hold
//! the `Manual` values exactly as stored in the cited file. `Freq` fields are Hz by the crate name rule; `GlobalGain`/`Gain` extents are symmetric dB-shaped but no unit is claimed.

use crate::params::{bool_from, f64_from, i64_from, lookup_manual, RawManual, SurfaceError};
/// EQ Eight surface: top level, 8 dual-section bands, analyzer switch.
///
/// Band XML nests as `Bands.<i>/ParameterA|B/{IsOn,Mode,Freq,Gain,Q}`
/// (document paths, matching the crate's nested-id convention).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Eq8Params {
    pub on: bool,
    pub global_gain: f64,
    pub scale: f64,
    pub bands: [Eq8Band; 8],
    /// `SpectrumAnalyzer/On`.
    pub spectrum_analyzer_on: bool,
    pub adaptive_q: bool,
}

/// One EQ band: the A/B filter sections.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Eq8Band {
    /// `Bands.<i>/ParameterA/*`.
    pub parameter_a: Eq8FilterParams,
    /// `Bands.<i>/ParameterB/*`.
    pub parameter_b: Eq8FilterParams,
}

/// One filter section (`IsOn`, `Mode` discrete, `Freq`/`Gain`/`Q` ranged).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Eq8FilterParams {
    pub is_on: bool,
    pub mode: i64,
    pub freq: f64,
    pub gain: f64,
    pub q: f64,
}

/// Defaults: `Manual` values exactly as stored in the source file.
pub const DEFAULTS: Eq8Params = Eq8Params {
    on: true,
    global_gain: 0.0,
    scale: 1.0,
    bands: [
        Eq8Band {
            parameter_a: Eq8FilterParams {
                is_on: true,
                mode: 2,
                freq: 30.0,
                gain: 0.0,
                q: 0.7071067691,
            },
            parameter_b: Eq8FilterParams {
                is_on: false,
                mode: 1,
                freq: 40.0,
                gain: 0.0,
                q: 0.7071067691,
            },
        },
        Eq8Band {
            parameter_a: Eq8FilterParams {
                is_on: true,
                mode: 3,
                freq: 200.0,
                gain: 0.0,
                q: 0.7071067691,
            },
            parameter_b: Eq8FilterParams {
                is_on: false,
                mode: 2,
                freq: 200.0,
                gain: 0.0,
                q: 0.7071067691,
            },
        },
        Eq8Band {
            parameter_a: Eq8FilterParams {
                is_on: true,
                mode: 3,
                freq: 1000.0,
                gain: 0.0,
                q: 0.7071067691,
            },
            parameter_b: Eq8FilterParams {
                is_on: true,
                mode: 3,
                freq: 100.0,
                gain: 0.0,
                q: 0.7071067691,
            },
        },
        Eq8Band {
            parameter_a: Eq8FilterParams {
                is_on: true,
                mode: 5,
                freq: 5000.0,
                gain: 0.0,
                q: 0.7071067691,
            },
            parameter_b: Eq8FilterParams {
                is_on: true,
                mode: 3,
                freq: 500.0,
                gain: 0.0,
                q: 0.7071067691,
            },
        },
        Eq8Band {
            parameter_a: Eq8FilterParams {
                is_on: false,
                mode: 3,
                freq: 100.0,
                gain: 0.0,
                q: 0.7071067691,
            },
            parameter_b: Eq8FilterParams {
                is_on: true,
                mode: 3,
                freq: 2000.0,
                gain: 0.0,
                q: 0.7071067691,
            },
        },
        Eq8Band {
            parameter_a: Eq8FilterParams {
                is_on: false,
                mode: 3,
                freq: 10000.0,
                gain: 0.0,
                q: 0.7071067691,
            },
            parameter_b: Eq8FilterParams {
                is_on: true,
                mode: 3,
                freq: 10000.0,
                gain: 0.0,
                q: 0.7071067691,
            },
        },
        Eq8Band {
            parameter_a: Eq8FilterParams {
                is_on: false,
                mode: 3,
                freq: 5000.0,
                gain: 0.0,
                q: 0.7071067691,
            },
            parameter_b: Eq8FilterParams {
                is_on: false,
                mode: 5,
                freq: 5000.0,
                gain: 0.0,
                q: 0.7071067691,
            },
        },
        Eq8Band {
            parameter_a: Eq8FilterParams {
                is_on: false,
                mode: 6,
                freq: 18000.0,
                gain: 0.0,
                q: 0.7071067691,
            },
            parameter_b: Eq8FilterParams {
                is_on: false,
                mode: 6,
                freq: 18000.0,
                gain: 0.0,
                q: 0.7071067691,
            },
        },
    ],
    spectrum_analyzer_on: true,
    adaptive_q: true,
};

impl Eq8Params {
    /// Parse-in: build a surface from raw `Manual` entries (see RAW_MANUAL).
    pub fn from_manual(raw: &[RawManual]) -> Result<Self, SurfaceError> {
        Ok(Self {
            on: bool_from(lookup_manual(raw, "On")?, "On")?,
            global_gain: f64_from(lookup_manual(raw, "GlobalGain")?, "GlobalGain")?,
            scale: f64_from(lookup_manual(raw, "Scale")?, "Scale")?,
            bands: [
                Eq8Band {
                    parameter_a: Eq8FilterParams {
                        is_on: bool_from(
                            lookup_manual(raw, "Bands.0/ParameterA/IsOn")?,
                            "Bands.0/ParameterA/IsOn",
                        )?,
                        mode: i64_from(
                            lookup_manual(raw, "Bands.0/ParameterA/Mode")?,
                            "Bands.0/ParameterA/Mode",
                        )?,
                        freq: f64_from(
                            lookup_manual(raw, "Bands.0/ParameterA/Freq")?,
                            "Bands.0/ParameterA/Freq",
                        )?,
                        gain: f64_from(
                            lookup_manual(raw, "Bands.0/ParameterA/Gain")?,
                            "Bands.0/ParameterA/Gain",
                        )?,
                        q: f64_from(
                            lookup_manual(raw, "Bands.0/ParameterA/Q")?,
                            "Bands.0/ParameterA/Q",
                        )?,
                    },
                    parameter_b: Eq8FilterParams {
                        is_on: bool_from(
                            lookup_manual(raw, "Bands.0/ParameterB/IsOn")?,
                            "Bands.0/ParameterB/IsOn",
                        )?,
                        mode: i64_from(
                            lookup_manual(raw, "Bands.0/ParameterB/Mode")?,
                            "Bands.0/ParameterB/Mode",
                        )?,
                        freq: f64_from(
                            lookup_manual(raw, "Bands.0/ParameterB/Freq")?,
                            "Bands.0/ParameterB/Freq",
                        )?,
                        gain: f64_from(
                            lookup_manual(raw, "Bands.0/ParameterB/Gain")?,
                            "Bands.0/ParameterB/Gain",
                        )?,
                        q: f64_from(
                            lookup_manual(raw, "Bands.0/ParameterB/Q")?,
                            "Bands.0/ParameterB/Q",
                        )?,
                    },
                },
                Eq8Band {
                    parameter_a: Eq8FilterParams {
                        is_on: bool_from(
                            lookup_manual(raw, "Bands.1/ParameterA/IsOn")?,
                            "Bands.1/ParameterA/IsOn",
                        )?,
                        mode: i64_from(
                            lookup_manual(raw, "Bands.1/ParameterA/Mode")?,
                            "Bands.1/ParameterA/Mode",
                        )?,
                        freq: f64_from(
                            lookup_manual(raw, "Bands.1/ParameterA/Freq")?,
                            "Bands.1/ParameterA/Freq",
                        )?,
                        gain: f64_from(
                            lookup_manual(raw, "Bands.1/ParameterA/Gain")?,
                            "Bands.1/ParameterA/Gain",
                        )?,
                        q: f64_from(
                            lookup_manual(raw, "Bands.1/ParameterA/Q")?,
                            "Bands.1/ParameterA/Q",
                        )?,
                    },
                    parameter_b: Eq8FilterParams {
                        is_on: bool_from(
                            lookup_manual(raw, "Bands.1/ParameterB/IsOn")?,
                            "Bands.1/ParameterB/IsOn",
                        )?,
                        mode: i64_from(
                            lookup_manual(raw, "Bands.1/ParameterB/Mode")?,
                            "Bands.1/ParameterB/Mode",
                        )?,
                        freq: f64_from(
                            lookup_manual(raw, "Bands.1/ParameterB/Freq")?,
                            "Bands.1/ParameterB/Freq",
                        )?,
                        gain: f64_from(
                            lookup_manual(raw, "Bands.1/ParameterB/Gain")?,
                            "Bands.1/ParameterB/Gain",
                        )?,
                        q: f64_from(
                            lookup_manual(raw, "Bands.1/ParameterB/Q")?,
                            "Bands.1/ParameterB/Q",
                        )?,
                    },
                },
                Eq8Band {
                    parameter_a: Eq8FilterParams {
                        is_on: bool_from(
                            lookup_manual(raw, "Bands.2/ParameterA/IsOn")?,
                            "Bands.2/ParameterA/IsOn",
                        )?,
                        mode: i64_from(
                            lookup_manual(raw, "Bands.2/ParameterA/Mode")?,
                            "Bands.2/ParameterA/Mode",
                        )?,
                        freq: f64_from(
                            lookup_manual(raw, "Bands.2/ParameterA/Freq")?,
                            "Bands.2/ParameterA/Freq",
                        )?,
                        gain: f64_from(
                            lookup_manual(raw, "Bands.2/ParameterA/Gain")?,
                            "Bands.2/ParameterA/Gain",
                        )?,
                        q: f64_from(
                            lookup_manual(raw, "Bands.2/ParameterA/Q")?,
                            "Bands.2/ParameterA/Q",
                        )?,
                    },
                    parameter_b: Eq8FilterParams {
                        is_on: bool_from(
                            lookup_manual(raw, "Bands.2/ParameterB/IsOn")?,
                            "Bands.2/ParameterB/IsOn",
                        )?,
                        mode: i64_from(
                            lookup_manual(raw, "Bands.2/ParameterB/Mode")?,
                            "Bands.2/ParameterB/Mode",
                        )?,
                        freq: f64_from(
                            lookup_manual(raw, "Bands.2/ParameterB/Freq")?,
                            "Bands.2/ParameterB/Freq",
                        )?,
                        gain: f64_from(
                            lookup_manual(raw, "Bands.2/ParameterB/Gain")?,
                            "Bands.2/ParameterB/Gain",
                        )?,
                        q: f64_from(
                            lookup_manual(raw, "Bands.2/ParameterB/Q")?,
                            "Bands.2/ParameterB/Q",
                        )?,
                    },
                },
                Eq8Band {
                    parameter_a: Eq8FilterParams {
                        is_on: bool_from(
                            lookup_manual(raw, "Bands.3/ParameterA/IsOn")?,
                            "Bands.3/ParameterA/IsOn",
                        )?,
                        mode: i64_from(
                            lookup_manual(raw, "Bands.3/ParameterA/Mode")?,
                            "Bands.3/ParameterA/Mode",
                        )?,
                        freq: f64_from(
                            lookup_manual(raw, "Bands.3/ParameterA/Freq")?,
                            "Bands.3/ParameterA/Freq",
                        )?,
                        gain: f64_from(
                            lookup_manual(raw, "Bands.3/ParameterA/Gain")?,
                            "Bands.3/ParameterA/Gain",
                        )?,
                        q: f64_from(
                            lookup_manual(raw, "Bands.3/ParameterA/Q")?,
                            "Bands.3/ParameterA/Q",
                        )?,
                    },
                    parameter_b: Eq8FilterParams {
                        is_on: bool_from(
                            lookup_manual(raw, "Bands.3/ParameterB/IsOn")?,
                            "Bands.3/ParameterB/IsOn",
                        )?,
                        mode: i64_from(
                            lookup_manual(raw, "Bands.3/ParameterB/Mode")?,
                            "Bands.3/ParameterB/Mode",
                        )?,
                        freq: f64_from(
                            lookup_manual(raw, "Bands.3/ParameterB/Freq")?,
                            "Bands.3/ParameterB/Freq",
                        )?,
                        gain: f64_from(
                            lookup_manual(raw, "Bands.3/ParameterB/Gain")?,
                            "Bands.3/ParameterB/Gain",
                        )?,
                        q: f64_from(
                            lookup_manual(raw, "Bands.3/ParameterB/Q")?,
                            "Bands.3/ParameterB/Q",
                        )?,
                    },
                },
                Eq8Band {
                    parameter_a: Eq8FilterParams {
                        is_on: bool_from(
                            lookup_manual(raw, "Bands.4/ParameterA/IsOn")?,
                            "Bands.4/ParameterA/IsOn",
                        )?,
                        mode: i64_from(
                            lookup_manual(raw, "Bands.4/ParameterA/Mode")?,
                            "Bands.4/ParameterA/Mode",
                        )?,
                        freq: f64_from(
                            lookup_manual(raw, "Bands.4/ParameterA/Freq")?,
                            "Bands.4/ParameterA/Freq",
                        )?,
                        gain: f64_from(
                            lookup_manual(raw, "Bands.4/ParameterA/Gain")?,
                            "Bands.4/ParameterA/Gain",
                        )?,
                        q: f64_from(
                            lookup_manual(raw, "Bands.4/ParameterA/Q")?,
                            "Bands.4/ParameterA/Q",
                        )?,
                    },
                    parameter_b: Eq8FilterParams {
                        is_on: bool_from(
                            lookup_manual(raw, "Bands.4/ParameterB/IsOn")?,
                            "Bands.4/ParameterB/IsOn",
                        )?,
                        mode: i64_from(
                            lookup_manual(raw, "Bands.4/ParameterB/Mode")?,
                            "Bands.4/ParameterB/Mode",
                        )?,
                        freq: f64_from(
                            lookup_manual(raw, "Bands.4/ParameterB/Freq")?,
                            "Bands.4/ParameterB/Freq",
                        )?,
                        gain: f64_from(
                            lookup_manual(raw, "Bands.4/ParameterB/Gain")?,
                            "Bands.4/ParameterB/Gain",
                        )?,
                        q: f64_from(
                            lookup_manual(raw, "Bands.4/ParameterB/Q")?,
                            "Bands.4/ParameterB/Q",
                        )?,
                    },
                },
                Eq8Band {
                    parameter_a: Eq8FilterParams {
                        is_on: bool_from(
                            lookup_manual(raw, "Bands.5/ParameterA/IsOn")?,
                            "Bands.5/ParameterA/IsOn",
                        )?,
                        mode: i64_from(
                            lookup_manual(raw, "Bands.5/ParameterA/Mode")?,
                            "Bands.5/ParameterA/Mode",
                        )?,
                        freq: f64_from(
                            lookup_manual(raw, "Bands.5/ParameterA/Freq")?,
                            "Bands.5/ParameterA/Freq",
                        )?,
                        gain: f64_from(
                            lookup_manual(raw, "Bands.5/ParameterA/Gain")?,
                            "Bands.5/ParameterA/Gain",
                        )?,
                        q: f64_from(
                            lookup_manual(raw, "Bands.5/ParameterA/Q")?,
                            "Bands.5/ParameterA/Q",
                        )?,
                    },
                    parameter_b: Eq8FilterParams {
                        is_on: bool_from(
                            lookup_manual(raw, "Bands.5/ParameterB/IsOn")?,
                            "Bands.5/ParameterB/IsOn",
                        )?,
                        mode: i64_from(
                            lookup_manual(raw, "Bands.5/ParameterB/Mode")?,
                            "Bands.5/ParameterB/Mode",
                        )?,
                        freq: f64_from(
                            lookup_manual(raw, "Bands.5/ParameterB/Freq")?,
                            "Bands.5/ParameterB/Freq",
                        )?,
                        gain: f64_from(
                            lookup_manual(raw, "Bands.5/ParameterB/Gain")?,
                            "Bands.5/ParameterB/Gain",
                        )?,
                        q: f64_from(
                            lookup_manual(raw, "Bands.5/ParameterB/Q")?,
                            "Bands.5/ParameterB/Q",
                        )?,
                    },
                },
                Eq8Band {
                    parameter_a: Eq8FilterParams {
                        is_on: bool_from(
                            lookup_manual(raw, "Bands.6/ParameterA/IsOn")?,
                            "Bands.6/ParameterA/IsOn",
                        )?,
                        mode: i64_from(
                            lookup_manual(raw, "Bands.6/ParameterA/Mode")?,
                            "Bands.6/ParameterA/Mode",
                        )?,
                        freq: f64_from(
                            lookup_manual(raw, "Bands.6/ParameterA/Freq")?,
                            "Bands.6/ParameterA/Freq",
                        )?,
                        gain: f64_from(
                            lookup_manual(raw, "Bands.6/ParameterA/Gain")?,
                            "Bands.6/ParameterA/Gain",
                        )?,
                        q: f64_from(
                            lookup_manual(raw, "Bands.6/ParameterA/Q")?,
                            "Bands.6/ParameterA/Q",
                        )?,
                    },
                    parameter_b: Eq8FilterParams {
                        is_on: bool_from(
                            lookup_manual(raw, "Bands.6/ParameterB/IsOn")?,
                            "Bands.6/ParameterB/IsOn",
                        )?,
                        mode: i64_from(
                            lookup_manual(raw, "Bands.6/ParameterB/Mode")?,
                            "Bands.6/ParameterB/Mode",
                        )?,
                        freq: f64_from(
                            lookup_manual(raw, "Bands.6/ParameterB/Freq")?,
                            "Bands.6/ParameterB/Freq",
                        )?,
                        gain: f64_from(
                            lookup_manual(raw, "Bands.6/ParameterB/Gain")?,
                            "Bands.6/ParameterB/Gain",
                        )?,
                        q: f64_from(
                            lookup_manual(raw, "Bands.6/ParameterB/Q")?,
                            "Bands.6/ParameterB/Q",
                        )?,
                    },
                },
                Eq8Band {
                    parameter_a: Eq8FilterParams {
                        is_on: bool_from(
                            lookup_manual(raw, "Bands.7/ParameterA/IsOn")?,
                            "Bands.7/ParameterA/IsOn",
                        )?,
                        mode: i64_from(
                            lookup_manual(raw, "Bands.7/ParameterA/Mode")?,
                            "Bands.7/ParameterA/Mode",
                        )?,
                        freq: f64_from(
                            lookup_manual(raw, "Bands.7/ParameterA/Freq")?,
                            "Bands.7/ParameterA/Freq",
                        )?,
                        gain: f64_from(
                            lookup_manual(raw, "Bands.7/ParameterA/Gain")?,
                            "Bands.7/ParameterA/Gain",
                        )?,
                        q: f64_from(
                            lookup_manual(raw, "Bands.7/ParameterA/Q")?,
                            "Bands.7/ParameterA/Q",
                        )?,
                    },
                    parameter_b: Eq8FilterParams {
                        is_on: bool_from(
                            lookup_manual(raw, "Bands.7/ParameterB/IsOn")?,
                            "Bands.7/ParameterB/IsOn",
                        )?,
                        mode: i64_from(
                            lookup_manual(raw, "Bands.7/ParameterB/Mode")?,
                            "Bands.7/ParameterB/Mode",
                        )?,
                        freq: f64_from(
                            lookup_manual(raw, "Bands.7/ParameterB/Freq")?,
                            "Bands.7/ParameterB/Freq",
                        )?,
                        gain: f64_from(
                            lookup_manual(raw, "Bands.7/ParameterB/Gain")?,
                            "Bands.7/ParameterB/Gain",
                        )?,
                        q: f64_from(
                            lookup_manual(raw, "Bands.7/ParameterB/Q")?,
                            "Bands.7/ParameterB/Q",
                        )?,
                    },
                },
            ],
            spectrum_analyzer_on: bool_from(
                lookup_manual(raw, "SpectrumAnalyzer/On")?,
                "SpectrumAnalyzer/On",
            )?,
            adaptive_q: bool_from(lookup_manual(raw, "AdaptiveQ")?, "AdaptiveQ")?,
        })
    }

    /// Stored numeric value for a ranged document path (None for bool/discrete).
    pub fn stored_f64(&self, path: &str) -> Option<f64> {
        match path {
            "GlobalGain" => return Some(self.global_gain),
            "Scale" => return Some(self.scale),
            _ => {}
        }
        if let Some(stripped) = path.strip_prefix("Bands.0/") {
            let band = &self.bands[0];
            return match stripped {
                "ParameterA/Freq" => Some(band.parameter_a.freq),
                "ParameterA/Gain" => Some(band.parameter_a.gain),
                "ParameterA/Q" => Some(band.parameter_a.q),
                "ParameterB/Freq" => Some(band.parameter_b.freq),
                "ParameterB/Gain" => Some(band.parameter_b.gain),
                "ParameterB/Q" => Some(band.parameter_b.q),
                _ => None,
            };
        }
        if let Some(stripped) = path.strip_prefix("Bands.1/") {
            let band = &self.bands[1];
            return match stripped {
                "ParameterA/Freq" => Some(band.parameter_a.freq),
                "ParameterA/Gain" => Some(band.parameter_a.gain),
                "ParameterA/Q" => Some(band.parameter_a.q),
                "ParameterB/Freq" => Some(band.parameter_b.freq),
                "ParameterB/Gain" => Some(band.parameter_b.gain),
                "ParameterB/Q" => Some(band.parameter_b.q),
                _ => None,
            };
        }
        if let Some(stripped) = path.strip_prefix("Bands.2/") {
            let band = &self.bands[2];
            return match stripped {
                "ParameterA/Freq" => Some(band.parameter_a.freq),
                "ParameterA/Gain" => Some(band.parameter_a.gain),
                "ParameterA/Q" => Some(band.parameter_a.q),
                "ParameterB/Freq" => Some(band.parameter_b.freq),
                "ParameterB/Gain" => Some(band.parameter_b.gain),
                "ParameterB/Q" => Some(band.parameter_b.q),
                _ => None,
            };
        }
        if let Some(stripped) = path.strip_prefix("Bands.3/") {
            let band = &self.bands[3];
            return match stripped {
                "ParameterA/Freq" => Some(band.parameter_a.freq),
                "ParameterA/Gain" => Some(band.parameter_a.gain),
                "ParameterA/Q" => Some(band.parameter_a.q),
                "ParameterB/Freq" => Some(band.parameter_b.freq),
                "ParameterB/Gain" => Some(band.parameter_b.gain),
                "ParameterB/Q" => Some(band.parameter_b.q),
                _ => None,
            };
        }
        if let Some(stripped) = path.strip_prefix("Bands.4/") {
            let band = &self.bands[4];
            return match stripped {
                "ParameterA/Freq" => Some(band.parameter_a.freq),
                "ParameterA/Gain" => Some(band.parameter_a.gain),
                "ParameterA/Q" => Some(band.parameter_a.q),
                "ParameterB/Freq" => Some(band.parameter_b.freq),
                "ParameterB/Gain" => Some(band.parameter_b.gain),
                "ParameterB/Q" => Some(band.parameter_b.q),
                _ => None,
            };
        }
        if let Some(stripped) = path.strip_prefix("Bands.5/") {
            let band = &self.bands[5];
            return match stripped {
                "ParameterA/Freq" => Some(band.parameter_a.freq),
                "ParameterA/Gain" => Some(band.parameter_a.gain),
                "ParameterA/Q" => Some(band.parameter_a.q),
                "ParameterB/Freq" => Some(band.parameter_b.freq),
                "ParameterB/Gain" => Some(band.parameter_b.gain),
                "ParameterB/Q" => Some(band.parameter_b.q),
                _ => None,
            };
        }
        if let Some(stripped) = path.strip_prefix("Bands.6/") {
            let band = &self.bands[6];
            return match stripped {
                "ParameterA/Freq" => Some(band.parameter_a.freq),
                "ParameterA/Gain" => Some(band.parameter_a.gain),
                "ParameterA/Q" => Some(band.parameter_a.q),
                "ParameterB/Freq" => Some(band.parameter_b.freq),
                "ParameterB/Gain" => Some(band.parameter_b.gain),
                "ParameterB/Q" => Some(band.parameter_b.q),
                _ => None,
            };
        }
        if let Some(stripped) = path.strip_prefix("Bands.7/") {
            let band = &self.bands[7];
            return match stripped {
                "ParameterA/Freq" => Some(band.parameter_a.freq),
                "ParameterA/Gain" => Some(band.parameter_a.gain),
                "ParameterA/Q" => Some(band.parameter_a.q),
                "ParameterB/Freq" => Some(band.parameter_b.freq),
                "ParameterB/Gain" => Some(band.parameter_b.gain),
                "ParameterB/Q" => Some(band.parameter_b.q),
                _ => None,
            };
        }
        None
    }
}
/// `Manual` values verbatim from the source XML, as `(path, value)`.
pub const RAW_MANUAL: &[RawManual] = &[
    RawManual::new("On", "true"),
    RawManual::new("GlobalGain", "0"),
    RawManual::new("Scale", "1"),
    RawManual::new("Bands.0/ParameterA/IsOn", "true"),
    RawManual::new("Bands.0/ParameterA/Mode", "2"),
    RawManual::new("Bands.0/ParameterA/Freq", "30"),
    RawManual::new("Bands.0/ParameterA/Gain", "0"),
    RawManual::new("Bands.0/ParameterA/Q", "0.7071067691"),
    RawManual::new("Bands.0/ParameterB/IsOn", "false"),
    RawManual::new("Bands.0/ParameterB/Mode", "1"),
    RawManual::new("Bands.0/ParameterB/Freq", "40"),
    RawManual::new("Bands.0/ParameterB/Gain", "0"),
    RawManual::new("Bands.0/ParameterB/Q", "0.7071067691"),
    RawManual::new("Bands.1/ParameterA/IsOn", "true"),
    RawManual::new("Bands.1/ParameterA/Mode", "3"),
    RawManual::new("Bands.1/ParameterA/Freq", "200"),
    RawManual::new("Bands.1/ParameterA/Gain", "0"),
    RawManual::new("Bands.1/ParameterA/Q", "0.7071067691"),
    RawManual::new("Bands.1/ParameterB/IsOn", "false"),
    RawManual::new("Bands.1/ParameterB/Mode", "2"),
    RawManual::new("Bands.1/ParameterB/Freq", "200"),
    RawManual::new("Bands.1/ParameterB/Gain", "0"),
    RawManual::new("Bands.1/ParameterB/Q", "0.7071067691"),
    RawManual::new("Bands.2/ParameterA/IsOn", "true"),
    RawManual::new("Bands.2/ParameterA/Mode", "3"),
    RawManual::new("Bands.2/ParameterA/Freq", "1000"),
    RawManual::new("Bands.2/ParameterA/Gain", "0"),
    RawManual::new("Bands.2/ParameterA/Q", "0.7071067691"),
    RawManual::new("Bands.2/ParameterB/IsOn", "true"),
    RawManual::new("Bands.2/ParameterB/Mode", "3"),
    RawManual::new("Bands.2/ParameterB/Freq", "100"),
    RawManual::new("Bands.2/ParameterB/Gain", "0"),
    RawManual::new("Bands.2/ParameterB/Q", "0.7071067691"),
    RawManual::new("Bands.3/ParameterA/IsOn", "true"),
    RawManual::new("Bands.3/ParameterA/Mode", "5"),
    RawManual::new("Bands.3/ParameterA/Freq", "5000"),
    RawManual::new("Bands.3/ParameterA/Gain", "0"),
    RawManual::new("Bands.3/ParameterA/Q", "0.7071067691"),
    RawManual::new("Bands.3/ParameterB/IsOn", "true"),
    RawManual::new("Bands.3/ParameterB/Mode", "3"),
    RawManual::new("Bands.3/ParameterB/Freq", "500"),
    RawManual::new("Bands.3/ParameterB/Gain", "0"),
    RawManual::new("Bands.3/ParameterB/Q", "0.7071067691"),
    RawManual::new("Bands.4/ParameterA/IsOn", "false"),
    RawManual::new("Bands.4/ParameterA/Mode", "3"),
    RawManual::new("Bands.4/ParameterA/Freq", "100"),
    RawManual::new("Bands.4/ParameterA/Gain", "0"),
    RawManual::new("Bands.4/ParameterA/Q", "0.7071067691"),
    RawManual::new("Bands.4/ParameterB/IsOn", "true"),
    RawManual::new("Bands.4/ParameterB/Mode", "3"),
    RawManual::new("Bands.4/ParameterB/Freq", "2000"),
    RawManual::new("Bands.4/ParameterB/Gain", "0"),
    RawManual::new("Bands.4/ParameterB/Q", "0.7071067691"),
    RawManual::new("Bands.5/ParameterA/IsOn", "false"),
    RawManual::new("Bands.5/ParameterA/Mode", "3"),
    RawManual::new("Bands.5/ParameterA/Freq", "10000"),
    RawManual::new("Bands.5/ParameterA/Gain", "0"),
    RawManual::new("Bands.5/ParameterA/Q", "0.7071067691"),
    RawManual::new("Bands.5/ParameterB/IsOn", "true"),
    RawManual::new("Bands.5/ParameterB/Mode", "3"),
    RawManual::new("Bands.5/ParameterB/Freq", "10000"),
    RawManual::new("Bands.5/ParameterB/Gain", "0"),
    RawManual::new("Bands.5/ParameterB/Q", "0.7071067691"),
    RawManual::new("Bands.6/ParameterA/IsOn", "false"),
    RawManual::new("Bands.6/ParameterA/Mode", "3"),
    RawManual::new("Bands.6/ParameterA/Freq", "5000"),
    RawManual::new("Bands.6/ParameterA/Gain", "0"),
    RawManual::new("Bands.6/ParameterA/Q", "0.7071067691"),
    RawManual::new("Bands.6/ParameterB/IsOn", "false"),
    RawManual::new("Bands.6/ParameterB/Mode", "5"),
    RawManual::new("Bands.6/ParameterB/Freq", "5000"),
    RawManual::new("Bands.6/ParameterB/Gain", "0"),
    RawManual::new("Bands.6/ParameterB/Q", "0.7071067691"),
    RawManual::new("Bands.7/ParameterA/IsOn", "false"),
    RawManual::new("Bands.7/ParameterA/Mode", "6"),
    RawManual::new("Bands.7/ParameterA/Freq", "18000"),
    RawManual::new("Bands.7/ParameterA/Gain", "0"),
    RawManual::new("Bands.7/ParameterA/Q", "0.7071067691"),
    RawManual::new("Bands.7/ParameterB/IsOn", "false"),
    RawManual::new("Bands.7/ParameterB/Mode", "6"),
    RawManual::new("Bands.7/ParameterB/Freq", "18000"),
    RawManual::new("Bands.7/ParameterB/Gain", "0"),
    RawManual::new("Bands.7/ParameterB/Q", "0.7071067691"),
    RawManual::new("SpectrumAnalyzer/On", "true"),
    RawManual::new("AdaptiveQ", "true"),
];

/// Every XML path on the surface, in source order.
pub const PATHS: &[&str] = &[
    "On",
    "GlobalGain",
    "Scale",
    "Bands.0/ParameterA/IsOn",
    "Bands.0/ParameterA/Mode",
    "Bands.0/ParameterA/Freq",
    "Bands.0/ParameterA/Gain",
    "Bands.0/ParameterA/Q",
    "Bands.0/ParameterB/IsOn",
    "Bands.0/ParameterB/Mode",
    "Bands.0/ParameterB/Freq",
    "Bands.0/ParameterB/Gain",
    "Bands.0/ParameterB/Q",
    "Bands.1/ParameterA/IsOn",
    "Bands.1/ParameterA/Mode",
    "Bands.1/ParameterA/Freq",
    "Bands.1/ParameterA/Gain",
    "Bands.1/ParameterA/Q",
    "Bands.1/ParameterB/IsOn",
    "Bands.1/ParameterB/Mode",
    "Bands.1/ParameterB/Freq",
    "Bands.1/ParameterB/Gain",
    "Bands.1/ParameterB/Q",
    "Bands.2/ParameterA/IsOn",
    "Bands.2/ParameterA/Mode",
    "Bands.2/ParameterA/Freq",
    "Bands.2/ParameterA/Gain",
    "Bands.2/ParameterA/Q",
    "Bands.2/ParameterB/IsOn",
    "Bands.2/ParameterB/Mode",
    "Bands.2/ParameterB/Freq",
    "Bands.2/ParameterB/Gain",
    "Bands.2/ParameterB/Q",
    "Bands.3/ParameterA/IsOn",
    "Bands.3/ParameterA/Mode",
    "Bands.3/ParameterA/Freq",
    "Bands.3/ParameterA/Gain",
    "Bands.3/ParameterA/Q",
    "Bands.3/ParameterB/IsOn",
    "Bands.3/ParameterB/Mode",
    "Bands.3/ParameterB/Freq",
    "Bands.3/ParameterB/Gain",
    "Bands.3/ParameterB/Q",
    "Bands.4/ParameterA/IsOn",
    "Bands.4/ParameterA/Mode",
    "Bands.4/ParameterA/Freq",
    "Bands.4/ParameterA/Gain",
    "Bands.4/ParameterA/Q",
    "Bands.4/ParameterB/IsOn",
    "Bands.4/ParameterB/Mode",
    "Bands.4/ParameterB/Freq",
    "Bands.4/ParameterB/Gain",
    "Bands.4/ParameterB/Q",
    "Bands.5/ParameterA/IsOn",
    "Bands.5/ParameterA/Mode",
    "Bands.5/ParameterA/Freq",
    "Bands.5/ParameterA/Gain",
    "Bands.5/ParameterA/Q",
    "Bands.5/ParameterB/IsOn",
    "Bands.5/ParameterB/Mode",
    "Bands.5/ParameterB/Freq",
    "Bands.5/ParameterB/Gain",
    "Bands.5/ParameterB/Q",
    "Bands.6/ParameterA/IsOn",
    "Bands.6/ParameterA/Mode",
    "Bands.6/ParameterA/Freq",
    "Bands.6/ParameterA/Gain",
    "Bands.6/ParameterA/Q",
    "Bands.6/ParameterB/IsOn",
    "Bands.6/ParameterB/Mode",
    "Bands.6/ParameterB/Freq",
    "Bands.6/ParameterB/Gain",
    "Bands.6/ParameterB/Q",
    "Bands.7/ParameterA/IsOn",
    "Bands.7/ParameterA/Mode",
    "Bands.7/ParameterA/Freq",
    "Bands.7/ParameterA/Gain",
    "Bands.7/ParameterA/Q",
    "Bands.7/ParameterB/IsOn",
    "Bands.7/ParameterB/Mode",
    "Bands.7/ParameterB/Freq",
    "Bands.7/ParameterB/Gain",
    "Bands.7/ParameterB/Q",
    "SpectrumAnalyzer/On",
    "AdaptiveQ",
];

/// Stored extents (`MidiControllerRange` Min/Max) for the parameters
/// that declare one; paths are document paths (see crate conventions).
pub const RANGES: &[(&str, f64, f64)] = &[
    ("GlobalGain", -12.0, 12.0),
    ("Scale", -2.0, 2.0),
    ("Bands.0/ParameterA/Freq", 30.0, 22000.0),
    ("Bands.0/ParameterA/Gain", -15.0, 15.0),
    ("Bands.0/ParameterA/Q", 0.1000000015, 18.0),
    ("Bands.0/ParameterB/Freq", 30.0, 22000.0),
    ("Bands.0/ParameterB/Gain", -15.0, 15.0),
    ("Bands.0/ParameterB/Q", 0.1000000015, 18.0),
    ("Bands.1/ParameterA/Freq", 30.0, 22000.0),
    ("Bands.1/ParameterA/Gain", -15.0, 15.0),
    ("Bands.1/ParameterA/Q", 0.1000000015, 18.0),
    ("Bands.1/ParameterB/Freq", 30.0, 22000.0),
    ("Bands.1/ParameterB/Gain", -15.0, 15.0),
    ("Bands.1/ParameterB/Q", 0.1000000015, 18.0),
    ("Bands.2/ParameterA/Freq", 30.0, 22000.0),
    ("Bands.2/ParameterA/Gain", -15.0, 15.0),
    ("Bands.2/ParameterA/Q", 0.1000000015, 18.0),
    ("Bands.2/ParameterB/Freq", 30.0, 22000.0),
    ("Bands.2/ParameterB/Gain", -15.0, 15.0),
    ("Bands.2/ParameterB/Q", 0.1000000015, 18.0),
    ("Bands.3/ParameterA/Freq", 30.0, 22000.0),
    ("Bands.3/ParameterA/Gain", -15.0, 15.0),
    ("Bands.3/ParameterA/Q", 0.1000000015, 18.0),
    ("Bands.3/ParameterB/Freq", 30.0, 22000.0),
    ("Bands.3/ParameterB/Gain", -15.0, 15.0),
    ("Bands.3/ParameterB/Q", 0.1000000015, 18.0),
    ("Bands.4/ParameterA/Freq", 30.0, 22000.0),
    ("Bands.4/ParameterA/Gain", -15.0, 15.0),
    ("Bands.4/ParameterA/Q", 0.1000000015, 18.0),
    ("Bands.4/ParameterB/Freq", 30.0, 22000.0),
    ("Bands.4/ParameterB/Gain", -15.0, 15.0),
    ("Bands.4/ParameterB/Q", 0.1000000015, 18.0),
    ("Bands.5/ParameterA/Freq", 30.0, 22000.0),
    ("Bands.5/ParameterA/Gain", -15.0, 15.0),
    ("Bands.5/ParameterA/Q", 0.1000000015, 18.0),
    ("Bands.5/ParameterB/Freq", 30.0, 22000.0),
    ("Bands.5/ParameterB/Gain", -15.0, 15.0),
    ("Bands.5/ParameterB/Q", 0.1000000015, 18.0),
    ("Bands.6/ParameterA/Freq", 30.0, 22000.0),
    ("Bands.6/ParameterA/Gain", -15.0, 15.0),
    ("Bands.6/ParameterA/Q", 0.1000000015, 18.0),
    ("Bands.6/ParameterB/Freq", 30.0, 22000.0),
    ("Bands.6/ParameterB/Gain", -15.0, 15.0),
    ("Bands.6/ParameterB/Q", 0.1000000015, 18.0),
    ("Bands.7/ParameterA/Freq", 30.0, 22000.0),
    ("Bands.7/ParameterA/Gain", -15.0, 15.0),
    ("Bands.7/ParameterA/Q", 0.1000000015, 18.0),
    ("Bands.7/ParameterB/Freq", 30.0, 22000.0),
    ("Bands.7/ParameterB/Gain", -15.0, 15.0),
    ("Bands.7/ParameterB/Q", 0.1000000015, 18.0),
];
#[test]
fn defaults_parse_in_and_ranges_are_sane() {
    use crate::params::check_exact_paths;

    // Parse-in: the verbatim Manual entries build exactly the DEFAULTS surface.
    let parsed = Eq8Params::from_manual(RAW_MANUAL).expect("raw entries parse");
    assert_eq!(parsed, DEFAULTS);
    // Exact coverage: RAW_MANUAL and PATHS describe the same entry set.
    check_exact_paths(RAW_MANUAL, PATHS).expect("raw covers the surface exactly");
    // Range sanity: each declared extent is ordered and holds its default.
    for (path, lo, hi) in RANGES {
        assert!(lo <= hi, "{path}: extent unordered");
        let v = parsed
            .stored_f64(path)
            .unwrap_or_else(|| panic!("{path}: ranged param missing from surface"));
        assert!(
            *lo <= v && v <= *hi,
            "{path}: default {v} outside [{lo}, {hi}]"
        );
    }
}

// ===========================================================================
// Coefficient law layer — closed-form records only (derivation lane)
//
// Implements devices/eq8-derivation.md §3 [D]/[B] claims: the cascade
// builder's type-case Q laws, the 9-float closed-form section record
// (tan prewarp, q = 1/Q, A = 10^(dB/40)), the 5 ms coefficient-crossfade
// length law and the M/S decode/global-gain laws. NO per-sample layer:
// the record -> b0/b1/b2/a1/a2 numerator partition and the NEON lane
// algebra are [H] in the derivation (§4, "what a render pins first") and
// are deliberately absent here. Nothing below claims parity; per the
// derivation's closing rule every claim awaits the golden-render gate.
// ===========================================================================

/// UI band modes (8 enum slots, 7 menu strings) [B: `__cstring` 0x5176ba4;
/// 1/2/3/5/6 pinned by presets + case grouping, the 0<->7 order and the
/// UI-4 notch identity are [H] in the derivation §3 — the cut-law PAIR is
/// certain]. Type clamp `>7 -> 3` [D].
pub const HIGH_PASS_48: i64 = 0;
pub const HIGH_PASS_12: i64 = 1;
pub const LOW_SHELF: i64 = 2;
pub const BELL: i64 = 3;
pub const NOTCH: i64 = 4;
pub const HIGH_SHELF: i64 = 5;
pub const LOW_PASS_12: i64 = 6;
pub const LOW_PASS_48: i64 = 7;

/// Internal section types of the closed-form builder `FUN_1019b1c0c` [D, §3].
pub const SECTION_LP: i32 = 0;
pub const SECTION_HP: i32 = 1;
pub const SECTION_LOW_SHELF: i32 = 2;
pub const SECTION_HIGH_SHELF: i32 = 3;
pub const SECTION_LP48: i32 = 4;
pub const SECTION_NOTCH: i32 = 5;
pub const SECTION_BELL: i32 = 6;

/// Band mode -> internal section (LUT 0x104cc96cc) [D]:
/// HP12 -> HP, LowShelf -> low shelf, Bell -> peak, Notch -> notch,
/// HighShelf -> high shelf, LP12 -> LP; the 48 dB cuts -> HP / LP48-section
/// cascades (case grouping).
pub const SECTION_LUT: [i32; 8] = [
    SECTION_HP,
    SECTION_HP,
    SECTION_LOW_SHELF,
    SECTION_BELL,
    SECTION_NOTCH,
    SECTION_HIGH_SHELF,
    SECTION_LP,
    SECTION_LP48,
];

/// Tan-prewarp clamp: `w = min(freq·π/rate, 1.5676547)` rad = 0.99·π/2
/// [D: const in the captured builder].
pub const PREWARP_MAX_RAD: f64 = 1.567_654_7;

/// Gain amplitude law: `A = 10^(gain·0.025)` = 10^(dB/40) — the
/// square-root gain [D, §3 section formula].
pub const GAIN_DB_TO_AMPLITUDE: f64 = 0.025;

/// Adaptive Q ships ON at factor 1.12 [D: ctor 0x88/0x8c]; kicks in beyond
/// ±6 dB effective gain, clamped at Q 50 (processor clamp pool) [D].
pub const ADAPTIVE_Q_DEFAULT: f64 = 1.12;
pub const ADAPTIVE_Q_THRESHOLD_DB: f64 = 6.0;
pub const QEFF_CLAMP: f64 = 50.0;

/// Cut law (types 0/7) log remap [D, §3]:
/// `Q' = (log10(Q·√2)/2.3335 + 0.70710677)·1.4142135`.
pub const CUT_LOG_DENOM: f64 = 2.3335;
pub const CUT_LOG_BIAS: f64 = 0.707_106_77;
pub const CUT_SCALE: f64 = 1.414_213_5;

/// The four cut-law section divisors [D]: `1/{0.509795, 0.601345, 0.899976,
/// 2.562839}` — the 8th-order Butterworth pole-Q set, so section Q =
/// Q'·Q_butterworth[k].
pub const BUTTERWORTH_DIVISORS: [f64; 4] = [1.961_570_5, 1.662_939_2, 1.111_140_4, 0.390_180_47];

/// Shelf-law perceptual Q remap constant [D, §3]:
/// `Qeff = min((log10(Q + 0.2928932) + 1 − 0.2928932)·qMul, 50)`.
pub const SHELF_REMAP_C: f64 = 0.292_893_2;

/// Legacy shelf Q split [D, §3]: `Qeff > 12 -> ×0.25` (legacy Q ≤ 3).
pub const LEGACY_Q_SPLIT: f64 = 12.0;
pub const LEGACY_Q_SCALE: f64 = 0.25;

/// Disabled band placeholder record parameters [D, §3]: ONE record at
/// (100 Hz, Q 1, gain 0) in the band's LUT section (flat, cheap to
/// crossfade on enable).
pub const DISABLED_BAND_FREQ: f64 = 100.0;
pub const DISABLED_BAND_Q: f64 = 1.0;

/// Coefficient crossfade length [D, §3]: 5 ms when the device is active,
/// else 0 (instant while bypassed).
pub const FADE_SECONDS: f64 = 0.005;

/// The closed-form 9-float section record [D, §3]:
/// `{t, −2(q+t)d, d, 2d, t²d, n0..n3}` with `q = 1/Q`,
/// `d = t/((q+t)·t + 1)` (denominator t² + qt + 1 normalized through d).
/// The record -> b-coefficient partition is [H] and NOT modeled.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct CoeffRecord {
    /// rec[0] = t (post prewarp, including the shelf √A shift).
    pub t: f64,
    /// rec[1..5] = the common c-part {−2(q+t)d, d, 2d, t²d}.
    pub c: [f64; 4],
    /// rec[5..9] = the type's n-part n0..n3.
    pub n: [f64; 4],
}

/// Closed-form section builder `FUN_1019b1c0c(out[9], freq, Q, gain, rate,
/// internalType)` [D, §3], transcribed as written (the shelf √A prewarp
/// modifies `t` before the shared denominator):
///
/// ```text
/// A = 10^(gain·0.025);  q = 1/Q;  w = min(freq·π/rate, 1.5676547);  t = tan(w)
///   0 LP:        n = {1, 0, 0, 0}
///   1 HP:        n = {1, 1, −q, −1}
///   2 low shelf: t ← t/√A;  n = {A−1, 1, q, A+1}
///   3 high shelf:t ← t·√A;  n = {A−1, A², −A·q, −(A+1)}
///   4 LP48:      n = {1, 0, 1, 0}
///   5 notch:     n = {1, 1, −q, 0}
///   6 bell:      q' = q/A;  n = {q'·(A²−1), 1, 1, 0}
/// d = t/((q+t)·t + 1)
/// rec = {t, −2(q+t)d, d, 2d, t²d, n0..n3}
/// ```
pub fn section_record(freq: f64, q: f64, gain_db: f64, rate: f64, internal_type: i32) -> CoeffRecord {
    let a = 10f64.powf(gain_db * GAIN_DB_TO_AMPLITUDE);
    let qi = 1.0 / q;
    let w = (freq * std::f64::consts::PI / rate).min(PREWARP_MAX_RAD);
    let mut t = w.tan();
    let n = match internal_type {
        SECTION_HP => [1.0, 1.0, -qi, -1.0],
        SECTION_LOW_SHELF => {
            t /= a.sqrt();
            [a - 1.0, 1.0, qi, a + 1.0]
        }
        SECTION_HIGH_SHELF => {
            t *= a.sqrt();
            [a - 1.0, a * a, -a * qi, -(a + 1.0)]
        }
        SECTION_LP48 => [1.0, 0.0, 1.0, 0.0],
        SECTION_NOTCH => [1.0, 1.0, -qi, 0.0],
        SECTION_BELL => {
            let qp = qi / a;
            [qp * (a * a - 1.0), 1.0, 1.0, 0.0]
        }
        // SECTION_LP and any out-of-range value fall to the LP section.
        _ => [1.0, 0.0, 0.0, 0.0],
    };
    let d = t / ((qi + t) * t + 1.0);
    CoeffRecord {
        t,
        c: [-2.0 * (qi + t) * d, d, 2.0 * d, t * t * d],
        n,
    }
}

/// Adaptive Q effective factor [D: OnAdaptiveQ/OnAdaptiveQFactor]: the
/// stored factor when on, else 1.0 (no-op).
pub fn adaptive_q_factor(on: bool, stored_factor: f64) -> f64 {
    if on {
        stored_factor
    } else {
        1.0
    }
}

/// Bell Q law [D, §3]: `Qeff = min(Q·adaptQ^(|g|−6), 50)`; no log-Q remap,
/// no legacy branch. `g = gain·scale`.
pub fn qeff_bell(q: f64, g: f64, adapt_q: f64) -> f64 {
    (q * adapt_q.powf(g.abs() - ADAPTIVE_Q_THRESHOLD_DB)).min(QEFF_CLAMP)
}

/// Shelf Q law, non-legacy [D, §3]: the perceptual remap
/// `Qeff = min((log10(Q + 0.2928932) + 1 − 0.2928932)·adaptQ^(|g|−6), 50)`.
pub fn qeff_shelf(q: f64, g: f64, adapt_q: f64) -> f64 {
    let q_mul = adapt_q.powf(g.abs() - ADAPTIVE_Q_THRESHOLD_DB);
    (((q + SHELF_REMAP_C).log10() + 1.0 - SHELF_REMAP_C) * q_mul).min(QEFF_CLAMP)
}

/// Shelf Q law, legacy (`Live8ShelfScaleLegacyMode`) [D, §3]:
/// `Qeff = min(Q·adaptQ^(|g|−6), 50)` then `>12 → ×0.25` (legacy Q ≤ 3).
/// (The legacy gain override `s·−0.4` under audition is [H] in the
/// derivation and NOT modeled.)
pub fn qeff_shelf_legacy(q: f64, g: f64, adapt_q: f64) -> f64 {
    let qeff = qeff_bell(q, g, adapt_q);
    if qeff > LEGACY_Q_SPLIT {
        qeff * LEGACY_Q_SCALE
    } else {
        qeff
    }
}

/// Cut-law shaped Q [D, §3]: `Q' = (log10(Q·√2)/2.3335 + 0.70710677)·1.4142135`.
/// (Gain is forced 0 in the cut law; the shaping only widens/narrows the
/// Butterworth pole spread with the user Q.)
pub fn cut_law_shaped_q(q: f64) -> f64 {
    ((q * std::f64::consts::SQRT_2).log10() / CUT_LOG_DENOM + CUT_LOG_BIAS) * CUT_SCALE
}

/// Cascade builder `FUN_10166bd24(rate, scale, adaptQ, outBlock, bandParam,
/// legacy, audition)` — the [D] type-case laws, audition branch excluded
/// (type remap LUT 0x104cf32ec; summing topology [H]). Returns the band's
/// coefficient records: 1 record for types 1–6, 4 for the 48 dB cuts.
pub fn build_band_cascade(
    band: &Eq8FilterParams,
    scale: f64,
    adapt_q: f64,
    legacy: bool,
    rate: f64,
) -> Vec<CoeffRecord> {
    let mut mode = band.mode;
    if !(0..=7).contains(&mode) {
        mode = 3; // setter clamp `>7 -> 3` [D]
    }
    if !band.is_on {
        // Disabled band: ONE flat record in the band's LUT section [D].
        let internal = SECTION_LUT[mode as usize];
        return vec![section_record(
            DISABLED_BAND_FREQ,
            DISABLED_BAND_Q,
            0.0,
            rate,
            internal,
        )];
    }
    match mode {
        HIGH_PASS_48 | LOW_PASS_48 => {
            // Cut law [D]: gain forced 0; FOUR sections at Q'/divisor.
            let q_shaped = cut_law_shaped_q(band.q);
            let internal = SECTION_LUT[mode as usize];
            BUTTERWORTH_DIVISORS
                .iter()
                .map(|div| section_record(band.freq, q_shaped / div, 0.0, rate, internal))
                .collect()
        }
        LOW_SHELF | HIGH_SHELF => {
            let g = band.gain * scale;
            let qeff = if legacy {
                qeff_shelf_legacy(band.q, g, adapt_q)
            } else {
                qeff_shelf(band.q, g, adapt_q)
            };
            let internal = SECTION_LUT[mode as usize];
            vec![section_record(band.freq, qeff, g, rate, internal)]
        }
        BELL => {
            let g = band.gain * scale;
            let qeff = qeff_bell(band.q, g, adapt_q);
            vec![section_record(band.freq, qeff, g, rate, SECTION_BELL)]
        }
        // Gain-free types 1/4/6: gain 0, Q raw [D].
        _ => {
            let internal = SECTION_LUT[mode as usize];
            vec![section_record(band.freq, band.q, 0.0, rate, internal)]
        }
    }
}

/// Crossfade length in samples [D, §3]: `workingRate × 0.005` when the
/// device is active (0x38b0), else 0 (instant, inaudible while bypassed).
pub fn fade_len_samples(working_rate: f64, device_active: bool) -> f64 {
    if device_active {
        working_rate * FADE_SECONDS
    } else {
        0.0
    }
}

/// Record blend (crossfade unit): the linear mix of the old and new
/// records inside the state. Blend math is [H-linear] in the derivation
/// (§4: "both records in state, fade masks") — the 5 ms LENGTH is the [D]
/// law; this linear blend is the neutral reading, not a parity claim.
pub fn blend_records(old: &CoeffRecord, new: &CoeffRecord, x: f64) -> CoeffRecord {
    let mix = |a: f64, b: f64| a + (b - a) * x;
    CoeffRecord {
        t: mix(old.t, new.t),
        c: [
            mix(old.c[0], new.c[0]),
            mix(old.c[1], new.c[1]),
            mix(old.c[2], new.c[2]),
            mix(old.c[3], new.c[3]),
        ],
        n: [
            mix(old.n[0], new.n[0]),
            mix(old.n[1], new.n[1]),
            mix(old.n[2], new.n[2]),
            mix(old.n[3], new.n[3]),
        ],
    }
}

/// GlobalGain linear pair [D: OnGlobalGain/OnMode]: `exp10(dB·0.05)`,
/// ×0.5 per output when mode 2 (M/S).
pub fn global_gain_linear(db: f64, ms_mode: bool) -> f64 {
    let lin = 10f64.powf(db * 0.05);
    if ms_mode {
        lin * 0.5
    } else {
        lin
    }
}

/// M/S decode [D, §3 output tail 0x10167ab94]: `L = g·(M − S)`,
/// `R = g·(M + S)`; meters 0x48/0x4c = {M·g, S·g}. `g` carries the ×0.5
/// per-output law ([`global_gain_linear`]). The encode counterpart
/// M=(L+R)/2, S=(L−R)/2 is [H] and NOT modeled.
pub fn ms_decode(m: f64, s: f64, g: f64) -> (f64, f64, f64, f64) {
    (g * (m - s), g * (m + s), m * g, s * g)
}

#[cfg(test)]
mod coefficient_law_tests {
    use super::*;

    const RATE: f64 = 48000.0;

    /// Analytic 8th-order Butterworth pole-Q set: Q_k = 1/(2·cos((2k−1)π/16))
    /// for k = 1..4.
    fn butterworth_q8() -> [f64; 4] {
        let mut qs = [0.0f64; 4];
        for (i, q) in qs.iter_mut().enumerate() {
            let theta = (2.0 * i as f64 + 1.0) * std::f64::consts::PI / 16.0;
            *q = 1.0 / (2.0 * theta.cos());
        }
        qs
    }

    /// EQ8 48 dB LP at the default res (Q = 1/√2): the log remap gives
    /// Q' ≈ 1, so the four cascade sections sit AT the analytic 8th-order
    /// Butterworth pole-Q set [D §3 cut law; captured divisors are the f32
    /// reciprocals]. Section Q is recovered from each record via the
    /// c-part: c0/c1 = −2(q + t) with q = 1/Q. Also: gain forced 0.
    #[test]
    fn butterworth_pole_q_set_at_48db_lp() {
        let band = Eq8FilterParams {
            is_on: true,
            mode: LOW_PASS_48,
            freq: 1000.0,
            gain: 12.0, // must be ignored: cut law forces gain 0
            q: std::f64::consts::FRAC_1_SQRT_2,
        };
        let cascade = build_band_cascade(&band, 1.0, ADAPTIVE_Q_DEFAULT, false, RATE);
        assert_eq!(cascade.len(), 4, "48 dB cuts are 4 cascades");

        let qs_analytic = butterworth_q8();
        for (rec, expect_q) in cascade.iter().zip(qs_analytic.iter()) {
            // LP48 section n-part, gain-free (A = 10^0).
            assert_eq!(rec.n, [1.0, 0.0, 1.0, 0.0], "LP48 section n-part");
            // Recover q = 1/Q from the record: c0 = −2(q+t)·d, c1 = d.
            let qi = rec.c[0] / rec.c[1] / -2.0 - rec.t;
            let section_q = 1.0 / qi;
            let rel = ((section_q - expect_q) / expect_q).abs();
            assert!(
                rel < 2e-6,
                "section Q {section_q} vs analytic {expect_q} (rel {rel})"
            );
        }
        // Q' at the default res: log10(Q·√2) = log10(1) = 0 → Q' ≈ 1.
        let q_shaped = cut_law_shaped_q(std::f64::consts::FRAC_1_SQRT_2);
        assert!((q_shaped - 1.0).abs() < 1e-6, "Q'(1/√2) = {q_shaped}");
        // And the captured divisors are the reciprocals of the analytic set
        // (f32-rounded) — the derivation's "exact Butterworth pole-Q set".
        for (div, q) in BUTTERWORTH_DIVISORS.iter().zip(qs_analytic.iter()) {
            let rel = ((div - 1.0 / q) / (1.0 / q)).abs();
            assert!(rel < 2e-6, "divisor {div} vs 1/{q} (rel {rel})");
        }
        // Gain forced 0 even at +12 dB user gain: A = 1 leaves the LP48
        // record identical to the 0 dB build.
        let quiet = build_band_cascade(
            &Eq8FilterParams { gain: 0.0, ..band },
            1.0,
            ADAPTIVE_Q_DEFAULT,
            false,
            RATE,
        );
        assert_eq!(cascade, quiet, "cut law forces gain 0");
    }

    /// Adaptive Q exponent law [D §3]: Q ×= adaptQ^(|gain·Scale|−6), clamped
    /// ≤ 50; inert at |g| ≤ 6 and when AdaptiveQ is off (factor 1.0). The
    /// shelf-only log remap at exponent 0 folds Q to itself.
    #[test]
    fn adaptive_q_exponent_law() {
        // Effective factor: ships ON at 1.12 [D ctor].
        assert_eq!(adaptive_q_factor(true, 1.12), 1.12);
        assert_eq!(adaptive_q_factor(false, 1.12), 1.0);

        // Bell: no change at |g| = 6 (exponent 0), ×1.12^10 at |g| = 16.
        assert!((qeff_bell(2.0, 6.0, 1.12) - 2.0).abs() < 1e-12);
        assert!((qeff_bell(2.0, -6.0, 1.12) - 2.0).abs() < 1e-12);
        let want = (2.0f64 * 1.12f64.powf(10.0)).min(QEFF_CLAMP);
        assert!((qeff_bell(2.0, 16.0, 1.12) - want).abs() < 1e-12);
        // Negative gains drive the exponent through |g| equally.
        assert!((qeff_bell(2.0, -16.0, 1.12) - want).abs() < 1e-12);
        // Scale multiplies into the effective gain: gain 8 × scale 2 = |g| 16.
        assert!((qeff_bell(2.0, 8.0 * 2.0, 1.12) - want).abs() < 1e-12);
        // Clamp at 50.
        assert_eq!(qeff_bell(40.0, 16.0, 1.12), QEFF_CLAMP);
        // Off (factor 1.0): any exponent is a no-op except the clamp.
        assert!((qeff_bell(18.0, 16.0, 1.0) - 18.0).abs() < 1e-12);

        // Shelf (non-legacy): the perceptual log-Q remap
        // (log10(Q + c) + 1 − c)·adaptQ^(|g|−6), clamped ≤ 50.
        let c = SHELF_REMAP_C;
        let want = (((2.0 + c).log10() + 1.0 - c) * 1.12f64.powf(4.0)).min(QEFF_CLAMP);
        assert!((qeff_shelf(2.0, 10.0, 1.12) - want).abs() < 1e-12);
        // At exponent 0 and Q = 1/√2 the remap folds to ≈ 0.7071 as well
        // (log10(1) = 0 shape at Q·√2 ≈ 1: (Q + c) → 1 within the remap).
        let remapped = qeff_shelf(std::f64::consts::FRAC_1_SQRT_2, 6.0, 1.12);
        assert!(remapped > 0.0 && remapped < 1.0, "remap keeps Q sub-unity: {remapped}");

        // Shelf legacy: bell-shaped law with the >12 → ×0.25 split.
        assert!((qeff_shelf_legacy(2.0, 6.0, 1.12) - 2.0).abs() < 1e-12);
        let over = qeff_shelf_legacy(13.0, 6.0, 1.0);
        assert!((over - 13.0 * LEGACY_Q_SCALE).abs() < 1e-12, "13 → ×0.25: {over}");
        let under = qeff_shelf_legacy(11.0, 6.0, 1.0);
        assert!((under - 11.0).abs() < 1e-12, "≤ 12 untouched: {under}");
        // After the split the legacy Q cannot exceed 3 (50 → 12.5 at worst
        // clamp path: 50·0.25 = 12.5 > 3 — the derivation's parenthetical
        // "legacy Q ≤ 3" holds only below the clamp; verify the captured
        // law, not the gloss).
        assert_eq!(qeff_shelf_legacy(50.0, 16.0, 1.12), QEFF_CLAMP * LEGACY_Q_SCALE);
    }

    /// Closed-form record arithmetic [D §3]: verify the shared c-part
    /// against the raw formula for an LP section, and the bell n-part's
    /// 0 dB degeneration (q'(A²−1) vanishes at A = 1).
    #[test]
    fn section_record_closed_form_matches_transcription() {
        let (freq, q, gain, rate) = (1000.0f64, 0.8f64, 3.0f64, RATE);
        let rec = section_record(freq, q, gain, rate, SECTION_LP);
        let qi = 1.0 / q;
        let w = (freq * std::f64::consts::PI / rate).min(PREWARP_MAX_RAD);
        let t = w.tan();
        let d = t / ((qi + t) * t + 1.0);
        assert!((rec.t - t).abs() < 1e-15);
        assert!((rec.c[0] - (-2.0 * (qi + t) * d)).abs() < 1e-15);
        assert!((rec.c[1] - d).abs() < 1e-15);
        assert!((rec.c[2] - 2.0 * d).abs() < 1e-15);
        assert!((rec.c[3] - t * t * d).abs() < 1e-15);
        assert_eq!(rec.n, [1.0, 0.0, 0.0, 0.0]);

        // Prewarp clamp: 24 kHz at 48 kHz gives w = π/2 > 0.99·π/2.
        let hot = section_record(24000.0, q, 0.0, rate, SECTION_LP);
        assert_eq!(hot.t, PREWARP_MAX_RAD.tan());

        // Bell at 0 dB: A = 1 kills the gain-shaped term.
        let flat_bell = section_record(1000.0, 2.0, 0.0, rate, SECTION_BELL);
        assert_eq!(flat_bell.n[0], 0.0, "q'(A²−1) → 0 at A = 1");

        // Low shelf prewarps t DOWN by √A, high shelf UP.
        let low = section_record(1000.0, 1.0, 12.0, rate, SECTION_LOW_SHELF);
        let a12 = 10f64.powf(0.3);
        assert!((low.t - (1000.0 * std::f64::consts::PI / rate).tan() / a12.sqrt()).abs() < 1e-12);
        let high = section_record(1000.0, 1.0, 12.0, rate, SECTION_HIGH_SHELF);
        assert!((high.t - (1000.0 * std::f64::consts::PI / rate).tan() * a12.sqrt()).abs() < 1e-12);
    }

    /// Cascade builder structure [D §3]: disabled band → ONE flat record at
    /// (100 Hz, Q 1, gain 0) in the band's LUT section; shelf/bell carry the
    /// scaled gain (A ≠ 1 at ±12 dB); gain-free types pass Q raw; out-of-range
    /// mode clamps to Bell; M/S decode + global gain laws.
    #[test]
    fn cascade_structure_and_ms_laws() {
        // Disabled: one record, 100 Hz prewarp, flat (A = 1) bell section.
        let off = Eq8FilterParams {
            is_on: false,
            mode: 3,
            freq: 2000.0,
            gain: 9.0,
            q: 4.0,
        };
        let recs = build_band_cascade(&off, 1.0, 1.12, false, RATE);
        assert_eq!(recs.len(), 1);
        assert_eq!(recs[0].n, [0.0, 1.0, 1.0, 0.0], "bell section");
        let expect_t = (DISABLED_BAND_FREQ * std::f64::consts::PI / RATE).tan();
        assert!((recs[0].t - expect_t).abs() < 1e-15, "100 Hz prewarp");

        // Bell at +12 dB × scale 1: A = 10^0.3 ≠ 1 shapes the n-part.
        let bell = Eq8FilterParams {
            is_on: true,
            mode: 3,
            freq: 1000.0,
            gain: 12.0,
            q: 2.0,
        };
        let recs = build_band_cascade(&bell, 1.0, 1.0, false, RATE);
        assert_eq!(recs.len(), 1);
        let a = 10f64.powf(0.3);
        assert!((recs[0].n[0] - (1.0 / 2.0 / a) * (a * a - 1.0)).abs() < 1e-12);

        // Gain-free type 1 (HP12): gain forced 0, Q raw.
        let hp = Eq8FilterParams {
            is_on: true,
            mode: 1,
            freq: 70.0,
            gain: 12.0,
            q: 3.0,
        };
        let recs = build_band_cascade(&hp, 2.0, 1.12, false, RATE);
        assert_eq!(recs.len(), 1);
        assert_eq!(recs[0].n, [1.0, 1.0, -1.0 / 3.0, -1.0], "HP section, q = 1/Q raw");

        // Out-of-range mode clamps to Bell (3).
        let wild = Eq8FilterParams { mode: 99, ..bell };
        let recs = build_band_cascade(&wild, 1.0, 1.0, false, RATE);
        let bell_recs = build_band_cascade(&bell, 1.0, 1.0, false, RATE);
        assert_eq!(recs[0].n, bell_recs[0].n);

        // Crossfade length law: 5 ms active, 0 bypassed.
        assert_eq!(fade_len_samples(RATE, true), RATE * 0.005);
        assert_eq!(fade_len_samples(RATE, false), 0.0);

        // GlobalGain linear: exp10(dB/20), halved per output in M/S.
        assert!((global_gain_linear(6.0, false) - 10f64.powf(0.3)).abs() < 1e-12);
        assert!((global_gain_linear(6.0, true) - 10f64.powf(0.3) * 0.5).abs() < 1e-12);

        // M/S decode: L = g(M−S), R = g(M+S), meters {Mg, Sg}.
        let (l, r, mg, sg) = ms_decode(0.8, -0.3, 0.5);
        assert!((l - 0.5 * 1.1).abs() < 1e-12);
        assert!((r - 0.5 * 0.5).abs() < 1e-12);
        assert!((mg - 0.4).abs() < 1e-12 && (sg - (-0.15)).abs() < 1e-12);

        // Record blend: identity at the endpoints, midpoint averages.
        let x = CoeffRecord { t: 1.0, c: [1.0; 4], n: [0.0; 4] };
        let y = CoeffRecord { t: 3.0, c: [3.0; 4], n: [2.0; 4] };
        let mid = blend_records(&x, &y, 0.5);
        assert_eq!(mid.t, 2.0);
        assert_eq!(mid.c, [2.0; 4]);
        assert_eq!(mid.n, [1.0; 4]);
        assert_eq!(blend_records(&x, &y, 0.0), x);
        assert_eq!(blend_records(&x, &y, 1.0), y);
    }
}
