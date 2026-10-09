//! EQ Eight (Eq8) — typed parameter surface (file-format facts only, no DSP).
//!
//! Source (official evidence, licensed app bundle copy):
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
