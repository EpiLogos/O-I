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
//! `glue`, `saturator` and `compressor` carry corpus-pinned (and
//! render-gated) layers — Glue anchors, the Saturator Analog Clip curve,
//! the Compressor GR composition (`compressor::GR_TABLE`) — and `reverb`,
//! `echo`, `operator` and `wavetable` also gate against the render corpus.

// Constants and loops here are transcribed from Live's binaries and evidence
// XML: a pinned literal keeps the exact digits and grouping the derivation
// document cites (CUT_SCALE is Live's f32 constant, not SQRT_2; the Erosion
// mask is the 27-bit one the binary uses), and per-channel index loops mirror
// the derived signal flow. Clippy's rewrites would obscure that citation.
#![allow(
    clippy::approx_constant,
    clippy::excessive_precision,
    clippy::unusual_byte_groupings,
    clippy::needless_range_loop,
    clippy::type_complexity
)]
// Tests pin derived constants with assertions over consts on purpose.
#![cfg_attr(test, allow(clippy::assertions_on_constants))]

pub mod audio;
pub mod auto_filter;
pub mod beat_repeat;
pub mod channel_eq;
pub mod chorus_ensemble;
pub mod compressor;
pub mod drum_buss;
pub mod echo;
pub mod eq8;
pub mod eq_three;
pub mod erosion;
pub mod filter_delay;
pub mod gate;
pub mod glue;
pub mod grain_delay;
pub mod limiter;
pub mod operator;
pub mod overdrive;
pub mod params;
pub mod phaser_flanger;
pub mod redux;
pub mod reverb;
pub mod saturator;
pub mod spectrum;
pub mod taps;
pub mod utility;
pub mod verify;
pub mod wavetable;
