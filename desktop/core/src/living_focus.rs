//! Stable-ref parsing for O:I Living Knowledge host commands.
//!
//! The renderer may identify already-selected semantic subjects by their stable
//! string refs; it does not supply provider/model/authority facts. AIKit remains
//! the owner of `ResourceRef` validity.

use aikit_core::ResourceRef;

pub fn parse_living_focus(raw: Vec<String>) -> Result<Vec<ResourceRef>, String> {
    raw.into_iter()
        .map(|value| ResourceRef::parse(&value).map_err(|error| error.to_string()))
        .collect()
}
