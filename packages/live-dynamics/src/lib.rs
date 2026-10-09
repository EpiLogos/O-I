//! Clean-room rebuilds of Ableton Live device dynamics.
//!
//! Written from behavior documents only — see README for the binding rule.
//!
//! Device parameter surfaces (`auto_filter`, `compressor`, `eq8`,
//! `filter_delay`, `overdrive`, `redux`, `saturator`, `utility`) are typed
//! file-format facts from the official evidence XML only — no DSP, no
//! behavior claims; each module cites its source file. `compressor` in
//! addition carries a statically decodable per-sample layer (derivation
//! doc-cited, no fitted scalars, explicit LUT placeholders, no behavioral
//! claims); `glue` is the render-gated exception.

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
pub mod filter_delay;
pub mod glue;
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
