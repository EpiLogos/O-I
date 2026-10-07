//! Loader rules as library functions (session-model.md §4 — each rule was
//! enforced on us by the real loader; here they become the write path).

use crate::xml::Element;

/// Rules a device element must satisfy to sit in a set's `<Devices>` list
/// (as opposed to a preset, where it carries none of these):
/// - list members carry an `Id`
/// - `AutomationTarget`/`ModulationTarget`/`Pointee` reference allocated
///   pointee ids, allocated here from `next_pointee_id`
///
/// Returns the updated next pointee id.
pub fn prepare_device_for_set(
    device: &mut Element,
    device_id: u64,
    next_pointee_id: &mut u64,
) -> u64 {
    device.set_attr("Id", &device_id.to_string());
    let names = ["AutomationTarget", "ModulationTarget", "Pointee"];
    for_each_descendant_mut(device, &names, &mut |el| {
        if el.attr("Id").map(|v| v == "0").unwrap_or(true) || el.attr("Id").is_none() {
            el.set_attr("Id", &next_pointee_id.to_string());
            *next_pointee_id += 1;
        }
    });
    *next_pointee_id
}

/// Drop references that dangle after device removal: track automation,
/// signal modulations and clip envelopes all point into removed devices'
/// targets. Loader rule: "Invalid Pointee Id."
pub fn strip_dangling_references(track: &mut Element) {
    for container in &["AutomationEnvelopes", "SignalModulations"] {
        if let Some(c) = track.find_mut(container) {
            c.children.clear();
        }
    }
}

/// Clip envelopes live on the clip itself.
pub fn strip_clip_envelopes(clip: &mut Element) {
    if let Some(c) = clip.find_mut("Envelopes") {
        c.children.clear();
    }
}

/// Track sends must match the set's return-track count; pruning returns
/// requires pruning sends. Loader rule: "Track has more send knobs than set
/// has return tracks."
pub fn strip_track_sends(track: &mut Element) {
    if let Some(c) = track.find_mut("Sends") {
        c.children.clear();
    }
}

/// 32-bit audio files must be IEEE float; integer WAV is accepted only at
/// 8/16/24 bit. (Documented rule; enforced by Live with a named dialog.)
pub const AUDIO_RULE_32BIT_MUST_BE_FLOAT: &str =
    "32-bit integer WAV files are not supported; for 32 bit, only floating point samples";

fn for_each_descendant_mut<F: FnMut(&mut Element)>(
    el: &mut Element,
    names: &[&str],
    f: &mut F,
) {
    if names.contains(&el.name.as_str()) {
        f(el);
    }
    for c in &mut el.children {
        for_each_descendant_mut(c, names, f);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::xml;

    #[test]
    fn prepares_preset_device_for_set() {
        let mut doc = xml::parse(
            r#"<Ableton><GlueCompressor><Threshold><Manual Value="-40" />
            <AutomationTarget Id="0" /></Threshold>
            <Pointee Id="0" /></GlueCompressor></Ableton>"#,
        )
        .unwrap();
        let dev = doc.find_mut("GlueCompressor").unwrap();
        let mut next = 500u64;
        next = prepare_device_for_set(dev, 900, &mut next);
        assert_eq!(next, 502);
        assert_eq!(doc.find("GlueCompressor").unwrap().attr("Id"), Some("900"));
        assert_eq!(
            doc.find("AutomationTarget").unwrap().attr("Id"),
            Some("500")
        );
        assert_eq!(doc.find("Pointee").unwrap().attr("Id"), Some("501"));
    }

    #[test]
    fn keeps_already_allocated_pointees() {
        let mut doc = xml::parse(
            r#"<Ableton><GlueCompressor><AutomationTarget Id="77" /><Pointee Id="0" /></GlueCompressor></Ableton>"#,
        )
        .unwrap();
        let dev = doc.find_mut("GlueCompressor").unwrap();
        let mut next = 500u64;
        prepare_device_for_set(dev, 1, &mut next);
        assert_eq!(doc.find("AutomationTarget").unwrap().attr("Id"), Some("77"));
        assert_eq!(doc.find("Pointee").unwrap().attr("Id"), Some("500"));
    }
}
