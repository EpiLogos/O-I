//! Document engine for the Live shell (M0 of shell/SHELL-BLUEPRINT.md).
//!
//! Reads and writes the Live document family (.als sets, .adv device
//! presets, .adg racks — all gzip'd XML) as a typed-enough tree, and
//! encodes the loader rules earned in session-model.md as library
//! functions. Clean-room: written from `session-model.md` and the Schema
//! vocabulary; no Ableton material.

pub mod model;
pub mod rules;
pub mod xml;

use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use std::io::{Read, Write};

#[derive(Debug)]
pub enum DocError {
    Io(std::io::Error),
    Parse(xml::ParseError),
}

impl std::fmt::Display for DocError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DocError::Io(e) => write!(f, "io: {e}"),
            DocError::Parse(e) => write!(f, "{e}"),
        }
    }
}

impl std::error::Error for DocError {}

impl From<std::io::Error> for DocError {
    fn from(e: std::io::Error) -> Self {
        DocError::Io(e)
    }
}

impl From<xml::ParseError> for DocError {
    fn from(e: xml::ParseError) -> Self {
        DocError::Parse(e)
    }
}

/// Read a gzip'd document (.als/.adv/.adg) into a tree.
pub fn open_gz(bytes: &[u8]) -> Result<xml::Element, DocError> {
    let mut s = String::new();
    GzDecoder::new(bytes).read_to_string(&mut s)?;
    Ok(xml::parse(&s)?)
}

/// Write a tree as a gzip'd document. Deterministic output: flate2's
/// default gzip header carries mtime 0 and no name field.
pub fn write_gz(root: &xml::Element) -> Result<Vec<u8>, DocError> {
    let xml = xml::serialize(root);
    let mut enc = GzEncoder::new(Vec::new(), Compression::default());
    enc.write_all(xml.as_bytes())?;
    Ok(enc.finish()?)
}

/// Read straight from a .als file path.
pub fn open_als(path: &std::path::Path) -> Result<xml::Element, DocError> {
    open_gz(&std::fs::read(path)?)
}
