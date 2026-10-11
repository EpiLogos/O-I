//! Clean-room rebuilds of Ableton Live device dynamics.
//!
//! Written from behavior documents only — see README for the binding rule.
//!
//! Device parameter surfaces (`auto_filter`, `compressor`, `eq8`,
//! `filter_delay`, `erosion`, `overdrive`, `redux`, `saturator`, `utility`)
//! are typed file-format facts from the official evidence XML only — no
//! DSP, no behavior claims; each module cites its source file (`erosion`
//! cites its binary derivation document; no evidence XML is unpacked for
//! it yet). `compressor`, `overdrive`, `redux`, `erosion`, `gate` and
//! `limiter` in addition
//! carry a statically decodable per-sample layer (derivation doc-cited, no
//! fitted scalars, explicit LUT placeholders, no behavioral claims);
//! `eq8`, `auto_filter` and `filter_delay` carry the statically decodable
//! coefficient/law layer of their derivations under the same posture;
//! `utility`'s per-sample section (legacy calc bodies, DC blocker,
//! BassMono SVF) follows the same derivation-cited rule with the
//! gain/pan/width transfer fn-pointers marked corpus-pending;
//! `glue` is the render-gated exception.

pub mod audio;
pub mod phaser_flanger;
pub mod grain_delay;
pub mod eq_three;
pub mod drum_buss;
pub mod chorus_ensemble;
pub mod channel_eq;
pub mod beat_repeat;
pub mod auto_filter;
pub mod compressor;
pub mod echo;
pub mod eq8;
pub mod erosion;
pub mod filter_delay;
pub mod gate;
pub mod glue;
pub mod limiter;
pub mod operator;
pub mod overdrive;
pub mod params;
pub mod redux;
pub mod reverb;
pub mod saturator;
pub mod spectrum;
pub mod taps;
pub mod utility;
pub mod verify;
pub mod wavetable;
