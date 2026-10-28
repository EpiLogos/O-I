//! The Live set's own edits, beside the device-parameter write: one clip read
//! whole (its markers, launch, follow actions, scale, notes and envelopes), a
//! clip's settings and notes written, a track's mixer row read and written,
//! and a track's take lanes and automation read. Tracks are addressed by
//! their place in the document (the order `SetDocument` lists them: the
//! `Tracks` members, then the Main track); a clip by its arrangement index
//! (the `Sample` lane, then the `ClipTimeable` lane, as `arrangement_clips`
//! walks them) or its session slot (the scene row).
//!
//! Every write names the revision it was made on (`sha256:` of the set's
//! bytes, the reading's own) and is refused when the file moved since —
//! Live may have saved it — so an edit never lands on a set nobody read.
//! The file is replaced atomically, as the device-parameter write does.
//!
//! The markers follow the document's own model, read off real Live 12 sets:
//! a looped clip keeps its loop brace in `LoopStart`/`LoopEnd`, its start at
//! `LoopStart + StartRelative` and its end at `OutMarker`; an unlooped clip
//! keeps its start and end in `LoopStart`/`LoopEnd` and its loop brace in
//! `HiddenLoopStart`/`HiddenLoopEnd`.
//!
//! Beside the clip: each track's sends (`Mixer/Sends/TrackSendHolder`, one
//! per return track, in the returns' order) read and written; a stretch of a
//! take lane comped into the main lane; and the set's Groove Pool read and
//! written. Comping follows Live 12's own record, read off a real comped set
//! (the template "Piano and voices mastering", 3-LABS): a comped main-lane
//! clip is a copy of its take's clip carrying the take's `TakeId`, its
//! `CurrentStart`/`CurrentEnd` the stretch and its `LoopStart`/`LoopEnd`
//! moved by the stretch's offset into the take; `OutMarker` and the hidden
//! loop stay the take's. The main lane names which take each stretch came
//! from by that `TakeId`, and the take lane's stretch is marked by the same.

use crate::xml::Element;
use serde_json::{json, Map, Value};

/// Where a clip stands on its track.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ClipAt {
    Arrangement(usize),
    Slot(usize),
}

impl ClipAt {
    /// `{"arrangement": j}` or `{"slot": scene}`.
    pub fn of(value: &Value) -> Result<ClipAt, String> {
        let index = |key: &str| value.get(key).and_then(Value::as_u64).map(|n| n as usize);
        match (index("arrangement"), index("slot")) {
            (Some(j), None) => Ok(ClipAt::Arrangement(j)),
            (None, Some(scene)) => Ok(ClipAt::Slot(scene)),
            _ => Err("A clip is named {\"arrangement\": index} or {\"slot\": scene}".into()),
        }
    }
}

/// The design's follow actions, in Live's own order (its `FollowActionA/B` index).
pub const FOLLOW_ACTIONS: &[&str] = &[
    "none", "stop", "again", "previous", "next", "first", "last", "any", "other", "jump",
];
/// Launch modes, in Live's `LaunchMode` order.
pub const LAUNCH_MODES: &[&str] = &["trigger", "gate", "toggle", "repeat"];
/// Launch quantization, in Live's `LaunchQuantisation` order.
pub const QUANTIZE: &[&str] = &[
    "global", "none", "8 bars", "4 bars", "2 bars", "1 bar", "1/2", "1/2t", "1/4", "1/4t", "1/8",
    "1/8t", "1/16", "1/16t", "1/32",
];
/// The seven modes the design names, and Live's own scale name for each.
pub const MODES: &[(&str, &str)] = &[
    ("ionian", "Major"),
    ("dorian", "Dorian"),
    ("phrygian", "Phrygian"),
    ("lydian", "Lydian"),
    ("mixolydian", "Mixolydian"),
    ("aeolian", "Minor"),
    ("locrian", "Locrian"),
];
/// Monitoring, in Live's `MonitoringEnum` order.
pub const MONITOR: &[&str] = &["in", "auto", "off"];
/// A groove's Base, in Live's `Grid` order: read off Live 12's own Quantize
/// grooves (Core Library `Grooves/Utility`: "Quantize 4" stores 0, "Quantize
/// 8" 1, "Quantize 8T" 2, "Quantize 16" 3, "Quantize 16T" 4, "Quantize 32" 5).
pub const GROOVE_BASE: &[&str] = &["1/4", "1/8", "1/8t", "1/16", "1/16t", "1/32"];
/// A groove's four amounts: the design's word and Live's own element.
const GROOVE_AMOUNTS: &[(&str, &str)] = &[
    ("quantize", "QuantizationAmount"),
    ("timing", "TimingAmount"),
    ("random", "RandomAmount"),
    ("velocity", "VelocityAmount"),
];

// ---------------------------------------------------------------------------- the document's values

fn value_of<'a>(element: &'a Element, child: &str) -> Option<&'a str> {
    element.child(child).and_then(|c| c.attr("Value"))
}
fn num(element: &Element, child: &str) -> Option<f64> {
    value_of(element, child).and_then(|v| v.parse().ok())
}
fn flag(element: &Element, child: &str) -> Option<bool> {
    value_of(element, child).map(|v| v == "true")
}
fn set_value(element: &mut Element, child: &str, value: &str) -> Result<(), String> {
    element
        .child_mut(child)
        .ok_or_else(|| format!("the clip carries no {child} in the document"))?
        .set_attr("Value", value);
    Ok(())
}
/// A number as the document writes one: integers plain, the rest in full.
fn number_text(value: f64) -> String {
    if value.fract() == 0.0 && value.abs() < 1e15 {
        format!("{}", value as i64)
    } else {
        format!("{value}")
    }
}

// ---------------------------------------------------------------------------- finding tracks and clips

fn tracks(root: &Element) -> Vec<&Element> {
    let Some(live_set) = root.find("LiveSet") else {
        return Vec::new();
    };
    let mut out: Vec<&Element> = live_set
        .child("Tracks")
        .map(|t| {
            t.children
                .iter()
                .filter(|track| {
                    matches!(
                        track.name.as_str(),
                        "AudioTrack" | "MidiTrack" | "ReturnTrack"
                    )
                })
                .collect()
        })
        .unwrap_or_default();
    if let Some(main) = live_set.child("MainTrack") {
        out.push(main);
    }
    out
}

fn track_at(root: &Element, index: usize) -> Result<&Element, String> {
    tracks(root)
        .into_iter()
        .nth(index)
        .ok_or_else(|| format!("the set has no track {index}"))
}

fn track_at_mut(root: &mut Element, index: usize) -> Result<&mut Element, String> {
    let live_set = root
        .find_mut("LiveSet")
        .ok_or("the document holds no LiveSet")?;
    let count = live_set
        .child("Tracks")
        .map(|t| {
            t.children
                .iter()
                .filter(|track| {
                    matches!(
                        track.name.as_str(),
                        "AudioTrack" | "MidiTrack" | "ReturnTrack"
                    )
                })
                .count()
        })
        .unwrap_or(0);
    if index == count {
        return live_set
            .child_mut("MainTrack")
            .ok_or_else(|| format!("the set has no track {index}"));
    }
    live_set
        .child_mut("Tracks")
        .and_then(|t| {
            t.children
                .iter_mut()
                .filter(|track| {
                    matches!(
                        track.name.as_str(),
                        "AudioTrack" | "MidiTrack" | "ReturnTrack"
                    )
                })
                .nth(index)
        })
        .ok_or_else(|| format!("the set has no track {index}"))
}

const CLIPS: [&str; 2] = ["AudioClip", "MidiClip"];

fn clip_at(track: &Element, at: ClipAt) -> Result<&Element, String> {
    let sequencer = track
        .child("DeviceChain")
        .and_then(|dc| dc.child("MainSequencer"))
        .ok_or("the track has no sequencer: it holds no clips")?;
    match at {
        ClipAt::Arrangement(j) => ["Sample", "ClipTimeable"]
            .iter()
            .filter_map(|holder| {
                sequencer
                    .child(holder)
                    .and_then(|h| h.child("ArrangerAutomation"))
                    .and_then(|a| a.child("Events"))
            })
            .flat_map(|events| events.children.iter())
            .filter(|clip| CLIPS.contains(&clip.name.as_str()))
            .nth(j)
            .ok_or_else(|| format!("the track has no arrangement clip {j}")),
        ClipAt::Slot(scene) => sequencer
            .child("ClipSlotList")
            .and_then(|list| list.children.get(scene))
            .and_then(|slot| slot.child("ClipSlot"))
            .and_then(|inner| inner.child("Value"))
            .and_then(|v| v.children.first())
            .filter(|clip| CLIPS.contains(&clip.name.as_str()))
            .ok_or_else(|| format!("the slot in scene {scene} holds no clip")),
    }
}

fn clip_at_mut(track: &mut Element, at: ClipAt) -> Result<&mut Element, String> {
    let sequencer = track
        .child_mut("DeviceChain")
        .and_then(|dc| dc.child_mut("MainSequencer"))
        .ok_or("the track has no sequencer: it holds no clips")?;
    match at {
        ClipAt::Arrangement(j) => {
            // Find the lane and place first, then borrow that one clip to change it.
            let mut seen = 0;
            let mut found = None;
            for holder in ["Sample", "ClipTimeable"] {
                let Some(events) = sequencer
                    .child(holder)
                    .and_then(|h| h.child("ArrangerAutomation"))
                    .and_then(|a| a.child("Events"))
                else {
                    continue;
                };
                for (place, clip) in events.children.iter().enumerate() {
                    if !CLIPS.contains(&clip.name.as_str()) {
                        continue;
                    }
                    if seen == j {
                        found = Some((holder, place));
                    }
                    seen += 1;
                }
                if found.is_some() {
                    break;
                }
            }
            let (holder, place) =
                found.ok_or_else(|| format!("the track has no arrangement clip {j}"))?;
            sequencer
                .child_mut(holder)
                .and_then(|h| h.child_mut("ArrangerAutomation"))
                .and_then(|a| a.child_mut("Events"))
                .and_then(|events| events.children.get_mut(place))
                .ok_or_else(|| format!("the track has no arrangement clip {j}"))
        }
        ClipAt::Slot(scene) => sequencer
            .child_mut("ClipSlotList")
            .and_then(|list| list.children.get_mut(scene))
            .and_then(|slot| slot.child_mut("ClipSlot"))
            .and_then(|inner| inner.child_mut("Value"))
            .and_then(|v| v.children.first_mut())
            .filter(|clip| CLIPS.contains(&clip.name.as_str()))
            .ok_or_else(|| format!("the slot in scene {scene} holds no clip")),
    }
}

// ---------------------------------------------------------------------------- automation targets

/// The name Live gives a track's send: "Send A" feeds the first return track,
/// "Send B" the next, in the returns' order.
fn send_name(index: usize) -> String {
    match u8::try_from(index).ok().filter(|i| *i < 26) {
        Some(i) => format!("Send {}", char::from(b'A' + i)),
        None => format!("Send {}", index + 1),
    }
}

/// A mixer's sends, in the document's order (one `TrackSendHolder` per return track).
fn send_holders(mixer: &Element) -> impl Iterator<Item = &Element> {
    mixer
        .child("Sends")
        .into_iter()
        .flat_map(|sends| sends.children_named("TrackSendHolder"))
}

/// Every `AutomationTarget` id in the document, with the parameter (its
/// holder) and the device (the holder's holder) it moves. A mixer's sends
/// are named as Live names them: device "Mixer", parameter "Send A" onward.
fn automation_targets(root: &Element) -> std::collections::HashMap<String, (String, String)> {
    fn walk(
        element: &Element,
        parent: Option<&Element>,
        out: &mut std::collections::HashMap<String, (String, String)>,
    ) {
        for child in &element.children {
            if child.name == "Sends" && element.name == "Mixer" {
                for (index, holder) in send_holders(element).enumerate() {
                    if let Some(id) = holder
                        .child("Send")
                        .and_then(|send| send.child("AutomationTarget"))
                        .and_then(|target| target.attr("Id"))
                    {
                        out.insert(id.to_string(), ("Mixer".into(), send_name(index)));
                    }
                }
                continue;
            }
            if child.name == "AutomationTarget" {
                if let Some(id) = child.attr("Id") {
                    out.insert(
                        id.to_string(),
                        (
                            parent.map(|p| p.name.clone()).unwrap_or_default(),
                            element.name.clone(),
                        ),
                    );
                }
            }
            walk(child, Some(element), out);
        }
    }
    let mut out = std::collections::HashMap::new();
    walk(root, None, &mut out);
    out
}

/// One envelope's reading: what it moves and its points `[[beat, value]…]`
/// (Live's −63072000 seed event, the value before the set starts, is dropped).
fn envelope_json(
    envelope: &Element,
    targets: &std::collections::HashMap<String, (String, String)>,
) -> Option<Value> {
    let pointee = envelope
        .child("EnvelopeTarget")
        .and_then(|t| value_of(t, "PointeeId"))?;
    let (device, parameter) = targets
        .get(pointee)
        .cloned()
        .unwrap_or_else(|| (String::new(), String::new()));
    let points: Vec<Value> = envelope
        .child("Automation")
        .and_then(|a| a.child("Events"))
        .map(|events| {
            events
                .children
                .iter()
                .filter_map(|event| {
                    let at: f64 = event.attr("Time")?.parse().ok()?;
                    if at < -1.0e6 {
                        return None;
                    }
                    let raw = event.attr("Value")?;
                    let value = match raw {
                        "true" => json!(1.0),
                        "false" => json!(0.0),
                        _ => json!(raw.parse::<f64>().ok()?),
                    };
                    Some(json!([at, value]))
                })
                .collect()
        })
        .unwrap_or_default();
    Some(json!({"target": pointee, "device": device, "parameter": parameter, "points": points}))
}

// ---------------------------------------------------------------------------- the clip

/// The clip's markers in the design's words: start, end, loop, position, length.
fn markers(clip: &Element) -> Value {
    let Some(lp) = clip.child("Loop") else {
        return json!({});
    };
    let get = |name: &str| num(lp, name).unwrap_or(0.0);
    if flag(lp, "LoopOn") == Some(true) {
        json!({"loop": true, "start": get("LoopStart") + get("StartRelative"), "end": get("OutMarker"),
               "position": get("LoopStart"), "length": get("LoopEnd") - get("LoopStart")})
    } else {
        json!({"loop": false, "start": get("LoopStart"), "end": get("LoopEnd"),
               "position": get("HiddenLoopStart"), "length": get("HiddenLoopEnd") - get("HiddenLoopStart")})
    }
}

/// The clip's notes: `{id, p, at, len, vel, chance, on}`, at and len in beats,
/// chance 0–1, sorted by time then pitch.
fn notes_json(clip: &Element) -> Vec<Value> {
    let mut notes = Vec::new();
    let Some(key_tracks) = clip.child("Notes").and_then(|n| n.child("KeyTracks")) else {
        return notes;
    };
    for key_track in &key_tracks.children {
        let Some(pitch) = num(key_track, "MidiKey") else {
            continue;
        };
        let Some(events) = key_track.child("Notes") else {
            continue;
        };
        for event in events.children_named("MidiNoteEvent") {
            let attr = |name: &str| event.attr(name).and_then(|v| v.parse::<f64>().ok());
            notes.push(json!({
                "id": attr("NoteId").unwrap_or(0.0) as i64,
                "p": pitch as i64,
                "at": attr("Time").unwrap_or(0.0),
                "len": attr("Duration").unwrap_or(0.0),
                "vel": attr("Velocity").unwrap_or(100.0),
                "chance": attr("Probability").unwrap_or(1.0),
                "on": event.attr("IsEnabled") != Some("false"),
            }));
        }
    }
    notes.sort_by(|a, b| {
        let key = |n: &Value| {
            (
                n["at"].as_f64().unwrap_or(0.0),
                n["p"].as_i64().unwrap_or(0),
            )
        };
        key(a)
            .partial_cmp(&key(b))
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    notes
}

fn groove_names(root: &Element) -> std::collections::HashMap<String, String> {
    root.find("GroovePool")
        .and_then(|pool| pool.child("Grooves"))
        .map(|grooves| {
            grooves
                .children
                .iter()
                .filter_map(|groove| {
                    Some((
                        groove.attr("Id")?.to_string(),
                        value_of(groove, "Name").unwrap_or("").to_string(),
                    ))
                })
                .collect()
        })
        .unwrap_or_default()
}

/// One clip, whole, in the design's words.
fn clip_reading(root: &Element, clip: &Element) -> Value {
    let word = |list: &[&str], index: Option<f64>| {
        index
            .and_then(|i| list.get(i as usize))
            .map(|w| json!(w))
            .unwrap_or(Value::Null)
    };
    let follow = clip.child("FollowAction");
    let follow_num = |name: &str| follow.and_then(|f| num(f, name));
    let signature = clip
        .child("TimeSignature")
        .and_then(|t| t.child("TimeSignatures"))
        .and_then(|t| t.children.first());
    let scale = clip.child("ScaleInformation");
    let scale_name = scale.and_then(|s| value_of(s, "Name"));
    let groove = clip
        .child("GrooveSettings")
        .and_then(|g| value_of(g, "GrooveId"))
        .filter(|id| *id != "-1")
        .map(|id| {
            groove_names(root)
                .get(id)
                .cloned()
                .unwrap_or_else(|| id.to_string())
        });
    let targets = automation_targets(root);
    let envelopes: Vec<Value> = clip
        .child("Envelopes")
        .and_then(|e| e.child("Envelopes"))
        .map(|e| {
            e.children
                .iter()
                .filter_map(|env| envelope_json(env, &targets))
                .collect()
        })
        .unwrap_or_default();
    let mut reading = json!({
        "kind": if clip.name == "MidiClip" { "midi" } else { "audio" },
        "name": value_of(clip, "Name").unwrap_or(""),
        "colourIndex": num(clip, "Color"),
        "active": flag(clip, "Disabled").map(|d| !d),
        "sig": signature.map(|s| json!({"num": num(s, "Numerator"), "den": num(s, "Denominator")})),
        "groove": groove,
        "scale": flag(clip, "IsInKey"),
        "root": scale.and_then(|s| num(s, "RootNote")),
        "mode": scale_name.and_then(|name| MODES.iter().find(|(_, live)| *live == name).map(|(mode, _)| *mode)),
        "scaleName": scale_name,
        "follow": follow.and_then(|f| flag(f, "FollowActionEnabled")),
        "followA": word(FOLLOW_ACTIONS, follow_num("FollowActionA")),
        "followB": word(FOLLOW_ACTIONS, follow_num("FollowActionB")),
        "chance": follow_num("FollowChanceA"),
        "linked": follow.and_then(|f| flag(f, "IsLinked")),
        "multiplier": follow_num("LoopIterations"),
        "launch": word(LAUNCH_MODES, num(clip, "LaunchMode")),
        "legato": flag(clip, "Legato"),
        "quantize": word(QUANTIZE, num(clip, "LaunchQuantisation")),
        "launchVelocity": num(clip, "VelocityAmount"),
        "envelopes": envelopes,
    });
    if let Value::Object(fields) = markers(clip) {
        reading.as_object_mut().expect("object").extend(fields);
    }
    if clip.name == "MidiClip" {
        reading["notes"] = Value::Array(notes_json(clip));
    }
    reading
}

fn beat(field: &str, value: &Value) -> Result<f64, String> {
    value
        .as_f64()
        .filter(|v| v.is_finite() && (0.0..=1.0e6).contains(v))
        .ok_or_else(|| format!("{field} is a place in beats, from 0"))
}
fn whole(field: &str, value: &Value, low: i64, high: i64) -> Result<i64, String> {
    value
        .as_f64()
        .filter(|v| v.fract() == 0.0 && (low as f64..=high as f64).contains(v))
        .map(|v| v as i64)
        .ok_or_else(|| format!("{field} is a whole number from {low} to {high}"))
}
fn boolean(field: &str, value: &Value) -> Result<bool, String> {
    value
        .as_bool()
        .ok_or_else(|| format!("{field} is on or off (true or false)"))
}
fn index_of(field: &str, value: &Value, list: &[&str]) -> Result<usize, String> {
    value
        .as_str()
        .map(str::to_lowercase)
        .and_then(|word| list.iter().position(|w| *w == word))
        .ok_or_else(|| format!("{field} takes one of {}", list.join(", ")))
}

/// Move one marker, keeping the others where they stand.
fn set_marker(clip: &mut Element, field: &str, value: f64) -> Result<(), String> {
    let Value::Object(now) = markers(clip) else {
        return Err("the clip carries no loop markers in the document".into());
    };
    let get = |key: &str| now.get(key).and_then(Value::as_f64).unwrap_or(0.0);
    let looped = now.get("loop") == Some(&json!(true));
    let (mut start, mut end, mut position, mut length) =
        (get("start"), get("end"), get("position"), get("length"));
    match field {
        "start" => start = value,
        "end" => end = value,
        "position" => position = value,
        "length" => length = value,
        _ => unreachable!("only markers"),
    }
    if end <= start {
        return Err("The clip's end lies after its start".into());
    }
    if length <= 0.0 {
        return Err("The loop's length is more than nothing".into());
    }
    let lp = clip
        .child_mut("Loop")
        .ok_or("the clip carries no loop markers in the document")?;
    let mut put = |name: &str, v: f64| set_value(lp, name, &number_text(v));
    if looped {
        put("LoopStart", position)?;
        put("LoopEnd", position + length)?;
        put("StartRelative", start - position)?;
        put("OutMarker", end)?;
    } else {
        put("LoopStart", start)?;
        put("LoopEnd", end)?;
        put("OutMarker", end)?;
        put("HiddenLoopStart", position)?;
        put("HiddenLoopEnd", position + length)?;
    }
    Ok(())
}

/// Turn the loop on or off, keeping the start, end and loop brace.
fn set_loop(clip: &mut Element, on: bool) -> Result<(), String> {
    let Value::Object(now) = markers(clip) else {
        return Err("the clip carries no loop markers in the document".into());
    };
    if now.get("loop") == Some(&json!(on)) {
        return Ok(());
    }
    let get = |key: &str| now.get(key).and_then(Value::as_f64).unwrap_or(0.0);
    let (start, end, position, length) = (get("start"), get("end"), get("position"), get("length"));
    let lp = clip
        .child_mut("Loop")
        .ok_or("the clip carries no loop markers in the document")?;
    set_value(lp, "LoopOn", if on { "true" } else { "false" })?;
    let mut put = |name: &str, v: f64| set_value(lp, name, &number_text(v));
    if on {
        put("LoopStart", position)?;
        put("LoopEnd", position + length.max(0.25))?;
        put("StartRelative", start - position)?;
        put("OutMarker", end)?;
    } else {
        put("HiddenLoopStart", position)?;
        put("HiddenLoopEnd", position + length)?;
        put("LoopStart", start)?;
        put("LoopEnd", end)?;
        put("OutMarker", end)?;
        put("StartRelative", 0.0)?;
    }
    Ok(())
}

/// Apply the design's settings to one clip, each validated against Live's own values.
fn apply_settings(
    root: &Element,
    clip: &mut Element,
    set: &Map<String, Value>,
) -> Result<(), String> {
    // The loop first: the markers that follow are read in the loop's state.
    if let Some(on) = set.get("loop") {
        set_loop(clip, boolean("Loop", on)?)?;
    }
    for (key, value) in set {
        match key.as_str() {
            "loop" => {}
            "name" => {
                let name = value
                    .as_str()
                    .filter(|n| n.chars().count() <= 256 && !n.chars().any(char::is_control))
                    .ok_or("A clip's name is text of at most 256 characters")?;
                set_value(clip, "Name", name)?;
            }
            "colourIndex" => set_value(
                clip,
                "Color",
                &whole("The colour", value, 0, 69)?.to_string(),
            )?,
            "active" => set_value(
                clip,
                "Disabled",
                if boolean("The clip activator", value)? {
                    "false"
                } else {
                    "true"
                },
            )?,
            "start" | "end" | "position" | "length" => set_marker(clip, key, beat(key, value)?)?,
            "sig.num" | "sig.den" => {
                let (field, low, high) = if key == "sig.num" {
                    ("Numerator", 1, 99)
                } else {
                    ("Denominator", 1, 16)
                };
                let n = whole("The signature", value, low, high)?;
                if key == "sig.den" && ![1, 2, 4, 8, 16].contains(&n) {
                    return Err("The signature's beat is 1, 2, 4, 8 or 16".into());
                }
                let signature = clip
                    .child_mut("TimeSignature")
                    .and_then(|t| t.child_mut("TimeSignatures"))
                    .and_then(|t| t.children.first_mut())
                    .ok_or("the clip carries no signature in the document")?;
                set_value(signature, field, &n.to_string())?;
            }
            "groove" => {
                let id = match value {
                    Value::Null => "-1".to_string(),
                    Value::String(name) if name == "none" => "-1".to_string(),
                    Value::String(name) => groove_names(root)
                        .into_iter()
                        .find(|(_, groove)| groove == name)
                        .map(|(id, _)| id)
                        .ok_or_else(|| {
                            format!("The set's groove pool holds no groove \"{name}\"")
                        })?,
                    _ => {
                        return Err(
                            "A groove is named by its name in the set's groove pool, or none"
                                .into(),
                        )
                    }
                };
                let groove = clip
                    .child_mut("GrooveSettings")
                    .ok_or("the clip carries no groove settings in the document")?;
                set_value(groove, "GrooveId", &id)?;
            }
            "scale" => set_value(
                clip,
                "IsInKey",
                if boolean("The clip's own mode", value)? {
                    "true"
                } else {
                    "false"
                },
            )?,
            "root" => {
                let root_note = whole("The root", value, 0, 11)?;
                let scale = clip
                    .child_mut("ScaleInformation")
                    .ok_or("the clip carries no scale in the document")?;
                set_value(scale, "RootNote", &root_note.to_string())?;
            }
            "mode" => {
                let name = value
                    .as_str()
                    .and_then(|mode| MODES.iter().find(|(m, _)| *m == mode))
                    .map(|(_, live)| *live)
                    .ok_or_else(|| {
                        format!(
                            "The mode is one of {}",
                            MODES.iter().map(|(m, _)| *m).collect::<Vec<_>>().join(", ")
                        )
                    })?;
                let scale = clip
                    .child_mut("ScaleInformation")
                    .ok_or("the clip carries no scale in the document")?;
                set_value(scale, "Name", name)?;
            }
            "follow" | "followA" | "followB" | "chance" | "linked" | "multiplier" => {
                let follow = clip
                    .child_mut("FollowAction")
                    .ok_or("the clip carries no follow actions in the document")?;
                match key.as_str() {
                    "follow" => set_value(
                        follow,
                        "FollowActionEnabled",
                        if boolean("Follow Action", value)? {
                            "true"
                        } else {
                            "false"
                        },
                    )?,
                    "followA" => set_value(
                        follow,
                        "FollowActionA",
                        &index_of("Action A", value, FOLLOW_ACTIONS)?.to_string(),
                    )?,
                    "followB" => set_value(
                        follow,
                        "FollowActionB",
                        &index_of("Action B", value, FOLLOW_ACTIONS)?.to_string(),
                    )?,
                    "chance" => {
                        let a = whole("Chance", value, 0, 100)?;
                        set_value(follow, "FollowChanceA", &a.to_string())?;
                        set_value(follow, "FollowChanceB", &(100 - a).to_string())?;
                    }
                    "linked" => set_value(
                        follow,
                        "IsLinked",
                        if boolean("Linked", value)? {
                            "true"
                        } else {
                            "false"
                        },
                    )?,
                    _ => set_value(
                        follow,
                        "LoopIterations",
                        &whole("Loops", value, 1, 64)?.to_string(),
                    )?,
                }
            }
            "launch" => set_value(
                clip,
                "LaunchMode",
                &index_of("Launch mode", value, LAUNCH_MODES)?.to_string(),
            )?,
            "legato" => set_value(
                clip,
                "Legato",
                if boolean("Legato", value)? {
                    "true"
                } else {
                    "false"
                },
            )?,
            "quantize" => set_value(
                clip,
                "LaunchQuantisation",
                &index_of("Quantize", value, QUANTIZE)?.to_string(),
            )?,
            "launchVelocity" => set_value(
                clip,
                "VelocityAmount",
                &whole("Velocity", value, 0, 100)?.to_string(),
            )?,
            other => return Err(format!("A clip has no setting {other}")),
        }
    }
    Ok(())
}

/// Replace a MIDI clip's notes. A note keeps its id when it names one the
/// clip holds; a new note takes the clip's next id.
fn apply_notes(clip: &mut Element, notes: &[Value]) -> Result<(), String> {
    if clip.name != "MidiClip" {
        return Err("An audio clip holds no notes".into());
    }
    if notes.len() > 20_000 {
        return Err("A clip holds at most 20000 notes here".into());
    }
    let holder = clip
        .child_mut("Notes")
        .ok_or("the clip carries no notes in the document")?;
    let mut next_id = holder
        .child("NoteIdGenerator")
        .and_then(|g| num(g, "NextId"))
        .unwrap_or(1.0) as i64;
    let mut used = std::collections::HashSet::new();
    let mut by_pitch: std::collections::BTreeMap<i64, Vec<Element>> =
        std::collections::BTreeMap::new();
    for note in notes {
        let field = |name: &str| note.get(name).and_then(Value::as_f64);
        let pitch = field("p")
            .filter(|p| p.fract() == 0.0 && (0.0..=127.0).contains(p))
            .ok_or("A note's pitch is 0 to 127")? as i64;
        // Live keeps notes before the clip's start too (real Live 12 sets hold MidiNoteEvent Time="-0.96…"), so a clip's
        // notes written back as read stand: a note's place is any beat of the clip's own time.
        let at = field("at")
            .filter(|t| t.is_finite() && t.abs() <= 1.0e6)
            .ok_or("A note starts at a beat of the clip's own time")?;
        // A real Live 12 set holds a note of Duration="0" too: a length from 0, as Live keeps it.
        let len = field("len")
            .filter(|l| l.is_finite() && *l >= 0.0)
            .ok_or("A note's length is a number of beats from 0")?;
        let vel = field("vel").unwrap_or(100.0);
        if !(1.0..=127.0).contains(&vel) {
            return Err("A note's velocity is 1 to 127".into());
        }
        let chance = field("chance").unwrap_or(1.0);
        if !(0.0..=1.0).contains(&chance) {
            return Err("A note's chance is 0 to 1".into());
        }
        let id = match field("id")
            .map(|id| id as i64)
            .filter(|id| *id > 0 && !used.contains(id))
        {
            Some(id) => id,
            None => {
                next_id += 1;
                next_id - 1
            }
        };
        used.insert(id);
        next_id = next_id.max(id + 1);
        let mut event = Element::new("MidiNoteEvent");
        for (name, value) in [
            ("Time", number_text(at)),
            ("Duration", number_text(len)),
            ("Velocity", number_text(vel)),
            ("VelocityDeviation", "0".into()),
            ("OffVelocity", "64".into()),
            ("Probability", number_text(chance)),
            (
                "IsEnabled",
                if note.get("on") == Some(&json!(false)) {
                    "false".into()
                } else {
                    "true".into()
                },
            ),
            ("NoteId", id.to_string()),
        ] {
            event.set_attr(name, &value);
        }
        by_pitch.entry(pitch).or_default().push(event);
    }
    let key_tracks = holder
        .child_mut("KeyTracks")
        .ok_or("the clip carries no key tracks in the document")?;
    key_tracks.children.clear();
    for (index, (pitch, mut events)) in by_pitch.into_iter().enumerate() {
        events.sort_by(|a, b| {
            let t = |e: &Element| {
                e.attr("Time")
                    .and_then(|v| v.parse::<f64>().ok())
                    .unwrap_or(0.0)
            };
            t(a).partial_cmp(&t(b)).unwrap_or(std::cmp::Ordering::Equal)
        });
        let mut key_track = Element::new("KeyTrack");
        key_track.set_attr("Id", &index.to_string());
        let mut list = Element::new("Notes");
        list.children = events;
        key_track.children.push(list);
        let mut key = Element::new("MidiKey");
        key.set_attr("Value", &pitch.to_string());
        key_track.children.push(key);
        key_tracks.children.push(key_track);
    }
    if let Some(generator) = holder.child_mut("NoteIdGenerator") {
        set_value(generator, "NextId", &next_id.to_string())?;
    }
    Ok(())
}

/// Replace the points of a clip's envelopes, each named by the device and
/// parameter it moves (`{device, parameter, points: [[beat, value]…]}`). An
/// envelope the clip lacks is made on the parameter's own automation target;
/// empty points remove the envelope.
/// The targets are the clip's own track's: every track has its own mixer.
fn apply_envelopes(track: &Element, clip: &mut Element, envelopes: &[Value]) -> Result<(), String> {
    let targets = automation_targets(track);
    let holder = clip
        .child_mut("Envelopes")
        .and_then(|e| e.child_mut("Envelopes"))
        .ok_or("the clip carries no envelopes in the document")?;
    for envelope in envelopes {
        let device = envelope
            .get("device")
            .and_then(Value::as_str)
            .ok_or("An envelope names its device")?;
        let parameter = envelope
            .get("parameter")
            .and_then(Value::as_str)
            .ok_or("An envelope names its parameter")?;
        let pointee = targets
            .iter()
            .filter(|(_, (d, p))| d == device && p == parameter)
            .map(|(id, _)| id.clone())
            .min_by_key(|id| id.parse::<u64>().unwrap_or(u64::MAX))
            .ok_or_else(|| format!("The set has no {device} {parameter} to move"))?;
        let points = envelope
            .get("points")
            .and_then(Value::as_array)
            .ok_or("An envelope's points are [[beat, value]…]")?;
        if points.len() > 4096 {
            return Err("An envelope holds at most 4096 points here".into());
        }
        let mut last = f64::NEG_INFINITY;
        let mut events = Vec::with_capacity(points.len());
        for (index, point) in points.iter().enumerate() {
            let pair = point
                .as_array()
                .filter(|p| p.len() == 2)
                .ok_or("Each point is [beat, value]")?;
            let at = pair[0]
                .as_f64()
                .filter(|t| t.is_finite() && *t >= 0.0 && *t >= last)
                .ok_or("The points lie at beats from 0, in order")?;
            let value = pair[1]
                .as_f64()
                .filter(|v| v.is_finite())
                .ok_or("A point's value is a number")?;
            last = at;
            let mut event = Element::new("FloatEvent");
            event.set_attr("Id", &(index + 1).to_string());
            event.set_attr("Time", &number_text(at));
            event.set_attr("Value", &number_text(value));
            events.push(event);
        }
        let standing = holder.children.iter().position(|env| {
            env.child("EnvelopeTarget")
                .and_then(|t| value_of(t, "PointeeId"))
                == Some(pointee.as_str())
        });
        match (standing, events.is_empty()) {
            (Some(at), true) => {
                holder.children.remove(at);
            }
            (None, true) => {}
            (Some(at), false) => {
                let list = holder.children[at]
                    .child_mut("Automation")
                    .and_then(|a| a.child_mut("Events"))
                    .ok_or("the envelope carries no events in the document")?;
                list.children = events;
            }
            (None, false) => {
                let id = holder
                    .children
                    .iter()
                    .filter_map(|env| env.attr("Id")?.parse::<u64>().ok())
                    .max()
                    .map_or(0, |n| n + 1);
                let mut env = Element::new("ClipEnvelope");
                env.set_attr("Id", &id.to_string());
                let mut target = Element::new("EnvelopeTarget");
                let mut pointee_id = Element::new("PointeeId");
                pointee_id.set_attr("Value", &pointee);
                target.children.push(pointee_id);
                let mut automation = Element::new("Automation");
                let mut list = Element::new("Events");
                list.children = events;
                automation.children.push(list);
                let mut view = Element::new("AutomationTransformViewState");
                let mut pending = Element::new("IsTransformPending");
                pending.set_attr("Value", "false");
                view.children.push(pending);
                view.children.push(Element::new("TimeAndValueTransforms"));
                automation.children.push(view);
                env.children.push(target);
                env.children.push(automation);
                holder.children.push(env);
            }
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------- the track

/// The set's return tracks' names, in the document's order: the order of
/// every track's sends.
fn return_names(root: &Element) -> Vec<String> {
    tracks(root)
        .into_iter()
        .filter(|track| track.name == "ReturnTrack")
        .map(|track| {
            track
                .child("Name")
                .and_then(|n| value_of(n, "EffectiveName"))
                .unwrap_or("")
                .to_string()
        })
        .collect()
}

/// A track's sends: each named by the return track it feeds and by Live's
/// letter, its level as the document keeps it (linear gain, Live's
/// `MidiControllerRange` beside it), and whether the send is on for this track
/// (`EnabledByUser`: a return's own sends are off until turned on in Live).
fn sends_json(mixer: &Element, returns: &[String]) -> Vec<Value> {
    send_holders(mixer)
        .enumerate()
        .map(|(index, holder)| {
            let send = holder.child("Send");
            let range = send.and_then(|s| s.child("MidiControllerRange"));
            json!({
                "name": returns.get(index).cloned().unwrap_or_else(|| send_name(index)),
                "send": send_name(index),
                "value": send.and_then(|s| num(s, "Manual")),
                "min": range.and_then(|r| num(r, "Min")),
                "max": range.and_then(|r| num(r, "Max")),
                "on": flag(holder, "EnabledByUser") != Some(false),
            })
        })
        .collect()
}

/// A track's mixer row: Activator, Solo, Arm, Monitor, its sends, and where
/// its input comes from and its output goes, in the routing's own words. A
/// control the track has no element for (Arm on a return, Solo or sends on the
/// Main track) is absent.
pub fn mixer_json(track: &Element, returns: &[String]) -> Value {
    let chain = track.child("DeviceChain");
    let mixer = chain.and_then(|c| c.child("Mixer"));
    let sequencer = chain.and_then(|c| c.child("MainSequencer"));
    let routing = |name: &str| {
        chain.and_then(|c| c.child(name)).map(|r| {
            let upper = value_of(r, "UpperDisplayString").unwrap_or("");
            let lower = value_of(r, "LowerDisplayString").unwrap_or("");
            json!(if lower.is_empty() {
                upper.to_string()
            } else {
                format!("{upper} · {lower}")
            })
        })
    };
    let input = if track.name == "MidiTrack" {
        routing("MidiInputRouting")
    } else {
        routing("AudioInputRouting")
    };
    let output = if track.name == "MidiTrack"
        && chain
            .and_then(|c| c.child("MidiOutputRouting"))
            .is_some_and(|r| value_of(r, "Target") != Some("MidiOut/None"))
    {
        routing("MidiOutputRouting")
    } else {
        routing("AudioOutputRouting")
    };
    let mut out = Map::new();
    if let Some(v) = mixer
        .and_then(|m| m.child("Speaker"))
        .and_then(|s| flag(s, "Manual"))
    {
        out.insert("activator".into(), json!(v));
    }
    if let Some(v) = mixer.and_then(|m| flag(m, "SoloSink")) {
        out.insert("solo".into(), json!(v));
    }
    if let Some(v) = sequencer
        .and_then(|s| s.child("Recorder"))
        .and_then(|r| flag(r, "IsArmed"))
    {
        out.insert("arm".into(), json!(v));
    }
    if let Some(v) = sequencer
        .and_then(|s| num(s, "MonitoringEnum"))
        .and_then(|i| MONITOR.get(i as usize))
    {
        out.insert("monitor".into(), json!(v));
    }
    if let Some(sends) = mixer
        .map(|m| sends_json(m, returns))
        .filter(|s| !s.is_empty())
    {
        out.insert("sends".into(), Value::Array(sends));
    }
    if let Some(v) = input {
        out.insert("input".into(), v);
    }
    if let Some(v) = output {
        out.insert("output".into(), v);
    }
    Value::Object(out)
}

fn apply_mixer(
    track: &mut Element,
    control: &str,
    value: &Value,
    index: Option<usize>,
) -> Result<(), String> {
    let missing = |what: &str| format!("This track has no {what} in the document");
    if control == "send" {
        let index = index.ok_or("A send is named by its index: 0 for Send A, 1 for Send B")?;
        let name = send_name(index);
        let holder = track
            .child_mut("DeviceChain")
            .and_then(|c| c.child_mut("Mixer"))
            .and_then(|m| m.child_mut("Sends"))
            .and_then(|sends| {
                sends
                    .children
                    .iter_mut()
                    .filter(|h| h.name == "TrackSendHolder")
                    .nth(index)
            })
            .ok_or_else(|| missing(&name))?;
        if flag(holder, "EnabledByUser") == Some(false) {
            return Err(format!(
                "{name} is off on this track: Live turns a return's own sends on from the send's menu"
            ));
        }
        let send = holder.child_mut("Send").ok_or_else(|| missing(&name))?;
        let range = send.child("MidiControllerRange");
        let (low, high) = range
            .and_then(|r| Some((num(r, "Min")?, num(r, "Max")?)))
            .ok_or_else(|| format!("{name} carries no range in the document"))?;
        let level = value
            .as_f64()
            .filter(|v| v.is_finite() && (low..=high).contains(v))
            .ok_or_else(|| {
                format!("{name} is a level from {low} to {high} (the gain Live keeps)")
            })?;
        return set_value(send, "Manual", &number_text(level));
    }
    if index.is_some() {
        return Err(format!("The {control} takes no index: only a send does"));
    }
    let chain = track
        .child_mut("DeviceChain")
        .ok_or_else(|| missing("chain"))?;
    match control {
        "activator" => {
            let speaker = chain
                .child_mut("Mixer")
                .and_then(|m| m.child_mut("Speaker"))
                .ok_or_else(|| missing("activator"))?;
            set_value(speaker, "Manual", if boolean("The activator", value)? { "true" } else { "false" })
        }
        "solo" => {
            let mixer = chain.child_mut("Mixer").ok_or_else(|| missing("solo"))?;
            if mixer.child("SoloSink").is_none() {
                return Err(missing("solo"));
            }
            set_value(mixer, "SoloSink", if boolean("Solo", value)? { "true" } else { "false" })
        }
        "arm" => {
            let recorder = chain
                .child_mut("MainSequencer")
                .and_then(|s| s.child_mut("Recorder"))
                .ok_or_else(|| missing("arm"))?;
            set_value(recorder, "IsArmed", if boolean("Arm", value)? { "true" } else { "false" })
        }
        "monitor" => {
            let index = index_of("Monitor", value, MONITOR)?;
            let sequencer = chain.child_mut("MainSequencer").ok_or_else(|| missing("monitor"))?;
            set_value(sequencer, "MonitoringEnum", &index.to_string())
        }
        "input" | "output" => Err(format!(
            "The {control} is read from the set; choosing another routing needs the routings Live offers on this machine, which the document does not list"
        )),
        other => Err(format!("A track's mixer has no control {other}")),
    }
}

/// The main lane's clips of a track (the `Sample` lane, then the
/// `ClipTimeable` lane, as `clip_at` walks them).
fn main_lane(track: &Element) -> Vec<&Element> {
    let sequencer = track
        .child("DeviceChain")
        .and_then(|dc| dc.child("MainSequencer"));
    ["Sample", "ClipTimeable"]
        .iter()
        .filter_map(|holder| {
            sequencer
                .and_then(|s| s.child(holder))
                .and_then(|h| h.child("ArrangerAutomation"))
                .and_then(|a| a.child("Events"))
        })
        .flat_map(|events| events.children.iter())
        .filter(|clip| CLIPS.contains(&clip.name.as_str()))
        .collect()
}

/// A track's take lanes: each lane's name and its takes' places on the
/// ruler; each take with its `TakeId` and the stretches of the main lane that
/// came from it (the main-lane clips carrying the same `TakeId`).
pub fn take_lanes_json(track: &Element) -> Value {
    let main: Vec<(Option<f64>, f64, f64)> = main_lane(track)
        .into_iter()
        .map(|clip| {
            (
                num(clip, "TakeId"),
                num(clip, "CurrentStart").unwrap_or(0.0),
                num(clip, "CurrentEnd").unwrap_or(0.0),
            )
        })
        .collect();
    let gave = |take: Option<f64>| -> Vec<Value> {
        main.iter()
            .filter(|(id, _, _)| take.is_some() && *id == take)
            .map(|(_, start, end)| json!({"start": start, "end": end}))
            .collect()
    };
    let lanes = track
        .child("TakeLanes")
        .and_then(|t| t.child("TakeLanes"))
        .map(|t| {
            t.children
                .iter()
                .filter(|lane| lane.name == "TakeLane")
                .map(|lane| {
                    let clips: Vec<Value> = lane
                        .child("ClipAutomation")
                        .and_then(|c| c.child("Events"))
                        .map(|events| {
                            events
                                .children
                                .iter()
                                .filter(|clip| CLIPS.contains(&clip.name.as_str()))
                                .map(|clip| {
                                    let take = num(clip, "TakeId");
                                    json!({"name": value_of(clip, "Name").unwrap_or(""),
                                        "start": num(clip, "CurrentStart").unwrap_or(0.0), "end": num(clip, "CurrentEnd").unwrap_or(0.0),
                                        "takeId": take, "gave": gave(take)})
                                })
                                .collect()
                        })
                        .unwrap_or_default();
                    json!({"name": value_of(lane, "Name").unwrap_or(""), "clips": clips})
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    Value::Array(lanes)
}

/// A track's automation: each envelope with the device and parameter it moves.
pub fn automation_json(root: &Element, track: &Element) -> Value {
    let targets = automation_targets(root);
    Value::Array(
        track
            .child("AutomationEnvelopes")
            .and_then(|a| a.child("Envelopes"))
            .map(|e| {
                e.children
                    .iter()
                    .filter_map(|env| envelope_json(env, &targets))
                    .collect()
            })
            .unwrap_or_default(),
    )
}

/// The mixer, take lanes and automation of every track, in document order.
pub fn tracks_extra_json(root: &Element) -> Vec<Value> {
    let returns = return_names(root);
    tracks(root)
        .into_iter()
        .map(|track| json!({"mixer": mixer_json(track, &returns), "takeLanes": take_lanes_json(track), "automation": automation_json(root, track)}))
        .collect()
}

// ---------------------------------------------------------------------------- the comp

/// The set's tempo when it stands still over the whole set: the Main track's
/// `Tempo`, unless an automation envelope moves it to more than one value.
fn steady_tempo(root: &Element) -> Option<f64> {
    let main = root.find("LiveSet")?.child("MainTrack")?;
    let tempo = main.child("DeviceChain")?.child("Mixer")?.child("Tempo")?;
    let manual = num(tempo, "Manual")?;
    let target = tempo.child("AutomationTarget").and_then(|t| t.attr("Id"));
    let mut values = main
        .child("AutomationEnvelopes")
        .and_then(|a| a.child("Envelopes"))
        .into_iter()
        .flat_map(|e| e.children.iter())
        .filter(|env| {
            target.is_some()
                && env
                    .child("EnvelopeTarget")
                    .and_then(|t| value_of(t, "PointeeId"))
                    == target
        })
        .flat_map(|env| {
            env.child("Automation")
                .and_then(|a| a.child("Events"))
                .into_iter()
                .flat_map(|events| events.children.iter())
        })
        .filter_map(|event| event.attr("Value")?.parse::<f64>().ok());
    match values.next() {
        None => Some(manual),
        Some(first) => values.all(|v| v == first).then_some(first),
    }
}

/// How far a clip's markers move for one beat on the ruler: one beat for a
/// MIDI clip or a warped audio clip; for an unwarped audio clip, whose markers
/// Live keeps in seconds (real sets: an unwarped clip's markers span its
/// length in beats × 60 / tempo), the seconds of one beat at the set's tempo.
fn marker_scale(clip: &Element, tempo: Option<f64>) -> Result<f64, String> {
    if clip.name == "AudioClip" && flag(clip, "IsWarped") == Some(false) {
        tempo
            .filter(|bpm| *bpm > 0.0)
            .map(|bpm| 60.0 / bpm)
            .ok_or_else(|| {
                "An unwarped audio clip keeps its markers in seconds, and this set's tempo moves: warp the clip to comp it".into()
            })
    } else {
        Ok(1.0)
    }
}

/// Cut a clip to `[from, to]` on the ruler (within its own span), its markers
/// moved so its material stays where it stood: unlooped, `LoopStart` moves by
/// the cut's offset and `LoopEnd` follows the length; looped, the play
/// position (`StartRelative`) moves within the loop. `OutMarker` and the
/// hidden loop stay, as Live's comped clips keep them.
fn crop(clip: &mut Element, from: f64, to: f64, scale: f64) -> Result<(), String> {
    let start = num(clip, "CurrentStart").ok_or("the clip carries no place in the document")?;
    let lp = clip
        .child_mut("Loop")
        .ok_or("the clip carries no loop markers in the document")?;
    fn get(lp: &Element, name: &str) -> Result<f64, String> {
        num(lp, name).ok_or_else(|| format!("the clip carries no {name} in the document"))
    }
    let shift = (from - start) * scale;
    if flag(lp, "LoopOn") == Some(true) {
        let span = get(lp, "LoopEnd")? - get(lp, "LoopStart")?;
        let moved = get(lp, "StartRelative")? + shift;
        let within = if span > 0.0 {
            moved.rem_euclid(span)
        } else {
            moved
        };
        set_value(lp, "StartRelative", &number_text(within))?;
    } else {
        let loop_start = get(lp, "LoopStart")? + shift;
        set_value(lp, "LoopStart", &number_text(loop_start))?;
        set_value(
            lp,
            "LoopEnd",
            &number_text(loop_start + (to - from) * scale),
        )?;
    }
    set_value(clip, "CurrentStart", &number_text(from))?;
    set_value(clip, "CurrentEnd", &number_text(to))?;
    clip.set_attr("Time", &number_text(from));
    Ok(())
}

/// Copy the stretch `[from, to]` of take lane `lane` into the track's main
/// lane, replacing what the main lane held there: a main-lane clip under the
/// stretch is removed, one across its edge is cut at it, one across the whole
/// stretch is split around it. Each copy is the take's clip, with its
/// `TakeId`, cut to the stretch.
fn comp(
    track: &mut Element,
    lane: usize,
    from: f64,
    to: f64,
    tempo: Option<f64>,
) -> Result<(), String> {
    let take = track
        .child("TakeLanes")
        .and_then(|t| t.child("TakeLanes"))
        .and_then(|t| t.children_named("TakeLane").nth(lane))
        .ok_or_else(|| format!("The track has no take lane {lane}"))?;
    let mut pieces = Vec::new();
    for clip in take
        .child("ClipAutomation")
        .and_then(|c| c.child("Events"))
        .into_iter()
        .flat_map(|events| events.children.iter())
        .filter(|clip| CLIPS.contains(&clip.name.as_str()))
    {
        let (start, end) = (
            num(clip, "CurrentStart").unwrap_or(0.0),
            num(clip, "CurrentEnd").unwrap_or(0.0),
        );
        let (a, b) = (from.max(start), to.min(end));
        if b > a {
            let mut copy = clip.clone();
            crop(&mut copy, a, b, marker_scale(clip, tempo)?)?;
            pieces.push(copy);
        }
    }
    if pieces.is_empty() {
        return Err(format!(
            "The take holds nothing between beat {} and beat {}",
            number_text(from),
            number_text(to)
        ));
    }
    let (holder, kind) = if track.name == "MidiTrack" {
        ("ClipTimeable", "MidiClip")
    } else {
        ("Sample", "AudioClip")
    };
    if pieces.iter().any(|piece| piece.name != kind) {
        return Err(format!(
            "A take of this track is no {kind}: it cannot stand in its main lane"
        ));
    }
    let mut next_id = main_lane(track)
        .iter()
        .filter_map(|clip| clip.attr("Id")?.parse::<u64>().ok())
        .max()
        .map_or(0, |id| id + 1);
    let events = track
        .child_mut("DeviceChain")
        .and_then(|dc| dc.child_mut("MainSequencer"))
        .and_then(|s| s.child_mut(holder))
        .and_then(|h| h.child_mut("ArrangerAutomation"))
        .and_then(|a| a.child_mut("Events"))
        .ok_or("the track keeps no main lane in the document")?;
    let mut kept = Vec::with_capacity(events.children.len() + pieces.len() + 1);
    for clip in std::mem::take(&mut events.children) {
        let place = (num(&clip, "CurrentStart"), num(&clip, "CurrentEnd"));
        let (Some(start), Some(end)) = place else {
            kept.push(clip);
            continue;
        };
        if !CLIPS.contains(&clip.name.as_str()) || end <= from || start >= to {
            kept.push(clip);
            continue;
        }
        let scale = marker_scale(&clip, tempo)?;
        if start < from {
            let mut before = clip.clone();
            crop(&mut before, start, from, scale)?;
            kept.push(before);
        }
        if end > to {
            let mut after = clip.clone();
            crop(&mut after, to, end, scale)?;
            if start < from {
                after.set_attr("Id", &next_id.to_string());
                next_id += 1;
            }
            kept.push(after);
        }
    }
    for mut piece in pieces {
        piece.set_attr("Id", &next_id.to_string());
        next_id += 1;
        kept.push(piece);
    }
    let at = |clip: &Element| num(clip, "CurrentStart").unwrap_or(f64::NEG_INFINITY);
    kept.sort_by(|a, b| {
        at(a)
            .partial_cmp(&at(b))
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    events.children = kept;
    Ok(())
}

/// A track's main lane and take lanes, as a comp leaves them: each main-lane
/// clip's name, place and the take it came from.
fn comp_json(track: &Element) -> Value {
    let clips: Vec<Value> = main_lane(track)
        .into_iter()
        .map(|clip| json!({"name": value_of(clip, "Name").unwrap_or(""), "start": num(clip, "CurrentStart").unwrap_or(0.0),
            "end": num(clip, "CurrentEnd").unwrap_or(0.0), "takeId": num(clip, "TakeId")}))
        .collect();
    json!({"clips": clips, "takeLanes": take_lanes_json(track)})
}

// ---------------------------------------------------------------------------- the groove pool

fn global_groove(root: &Element) -> Option<&Element> {
    root.find("LiveSet")?
        .child("MainTrack")?
        .child("DeviceChain")?
        .child("Mixer")?
        .child("GlobalGrooveAmount")
}

/// The set's Groove Pool: each groove's id, name, Base and its Quantize,
/// Timing, Random and Velocity amounts (Live's `Grid`, `QuantizationAmount`,
/// `TimingAmount`, `RandomAmount`, `VelocityAmount`), and the set's Global
/// Amount (the Main track's `GlobalGrooveAmount`) with the range Live keeps
/// beside it.
pub fn groove_pool_json(root: &Element) -> Value {
    let grooves: Vec<Value> = root
        .find("LiveSet")
        .and_then(|set| set.child("GroovePool"))
        .and_then(|pool| pool.child("Grooves"))
        .into_iter()
        .flat_map(|grooves| grooves.children_named("Groove"))
        .map(|groove| {
            let mut reading = json!({
                "id": groove.attr("Id").and_then(|id| id.parse::<u64>().ok()),
                "name": value_of(groove, "Name").unwrap_or(""),
                "base": num(groove, "Grid").and_then(|i| GROOVE_BASE.get(i as usize)).map(|w| json!(w)).unwrap_or(Value::Null),
            });
            for (word, element) in GROOVE_AMOUNTS {
                reading[*word] = json!(num(groove, element));
            }
            reading
        })
        .collect();
    let global = global_groove(root);
    let range = global.and_then(|g| g.child("MidiControllerRange"));
    json!({
        "grooves": grooves,
        "amount": global.and_then(|g| num(g, "Manual")),
        "amountRange": range.and_then(|r| Some(json!({"min": num(r, "Min")?, "max": num(r, "Max")?}))),
    })
}

/// Write one groove's setting, or (no groove named) the set's Global Amount.
fn apply_groove(
    root: &mut Element,
    groove: Option<u64>,
    field: &str,
    value: &Value,
) -> Result<(), String> {
    let Some(id) = groove else {
        if field != "amount" {
            return Err(format!(
                "The pool's own setting is its Global Amount (\"amount\"); a groove's {field} names its groove"
            ));
        }
        let global = root
            .find_mut("LiveSet")
            .and_then(|set| set.child_mut("MainTrack"))
            .and_then(|main| main.child_mut("DeviceChain"))
            .and_then(|dc| dc.child_mut("Mixer"))
            .and_then(|mixer| mixer.child_mut("GlobalGrooveAmount"))
            .ok_or("the set carries no Global Amount in the document")?;
        let (low, high) = global
            .child("MidiControllerRange")
            .and_then(|r| Some((num(r, "Min")?, num(r, "Max")?)))
            .ok_or("the set's Global Amount carries no range in the document")?;
        let amount = value
            .as_f64()
            .filter(|v| v.is_finite() && (low..=high).contains(v))
            .ok_or_else(|| {
                format!(
                    "Global Amount is from {} to {} percent",
                    number_text(low),
                    number_text(high)
                )
            })?;
        return set_value(global, "Manual", &number_text(amount));
    };
    let wanted = id.to_string();
    let groove = root
        .find_mut("LiveSet")
        .and_then(|set| set.child_mut("GroovePool"))
        .and_then(|pool| pool.child_mut("Grooves"))
        .and_then(|grooves| {
            grooves
                .children
                .iter_mut()
                .find(|g| g.name == "Groove" && g.attr("Id") == Some(wanted.as_str()))
        })
        .ok_or_else(|| format!("The set's groove pool holds no groove {id}"))?;
    if field == "base" {
        let index = index_of("Base", value, GROOVE_BASE)?;
        return set_value(groove, "Grid", &index.to_string());
    }
    let element = GROOVE_AMOUNTS
        .iter()
        .find(|(word, _)| *word == field)
        .map(|(_, element)| *element)
        .ok_or_else(|| {
            if field == "amount" {
                "Global Amount is the pool's, not a groove's: name no groove to write it".to_string()
            } else {
                format!("A groove has no setting {field}: it has base, quantize, timing, random and velocity")
            }
        })?;
    // Live's own grooves keep each amount from 0 to 100 (all 86 readable Core Library grooves, and the sets on this machine).
    let amount = value
        .as_f64()
        .filter(|v| v.is_finite() && (0.0..=100.0).contains(v))
        .ok_or_else(|| format!("A groove's {field} is from 0 to 100 percent"))?;
    set_value(groove, element, &number_text(amount))
}

// ---------------------------------------------------------------------------- the operations

fn revision(bytes: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    format!("sha256:{:x}", Sha256::digest(bytes))
}

fn open(path: &str) -> Result<(Vec<u8>, Element), String> {
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    let root = crate::open_gz(&bytes).map_err(|e| e.to_string())?;
    Ok((bytes, root))
}

/// Read, check the revision, change, write back atomically.
fn edit(
    path: &str,
    expected_revision: &str,
    change: impl FnOnce(&mut Element) -> Result<(), String>,
) -> Result<(Element, String), String> {
    let (bytes, mut root) = open(path)?;
    let standing = revision(&bytes);
    if standing != expected_revision {
        return Err("The set changed since it was read (Live may have saved it): read it again and make the change on what stands".into());
    }
    change(&mut root)?;
    let out = crate::write_gz(&root).map_err(|e| e.to_string())?;
    crate::api::replace_file_atomically(std::path::Path::new(path), &out)?;
    Ok((root, revision(&out)))
}

/// One clip, whole, with the set's revision.
pub fn clip_json(path: &str, track: usize, at: ClipAt) -> Result<Value, String> {
    let (bytes, root) = open(path)?;
    let part = track_at(&root, track)?;
    let clip = clip_at(part, at)?;
    Ok(
        json!({"clip": with_source(path, part, at, clip_reading(&root, clip)), "revision": revision(&bytes)}),
    )
}

/// Change one clip's settings and, for a MIDI clip, its notes; answer the
/// clip as it now stands and the set's new revision.
pub fn clip_write(
    path: &str,
    expected_revision: &str,
    track: usize,
    at: ClipAt,
    set: Option<&Map<String, Value>>,
    notes: Option<&[Value]>,
    envelopes: Option<&[Value]>,
) -> Result<Value, String> {
    if set.is_none_or(Map::is_empty) && notes.is_none() && envelopes.is_none_or(<[Value]>::is_empty)
    {
        return Err("Nothing to change".into());
    }
    let (root, new_revision) = edit(path, expected_revision, |root| {
        let reference = root.clone();
        let clip = clip_at_mut(track_at_mut(root, track)?, at)?;
        if let Some(set) = set {
            apply_settings(&reference, clip, set)?;
        }
        if let Some(notes) = notes {
            apply_notes(clip, notes)?;
        }
        if let Some(envelopes) = envelopes {
            apply_envelopes(track_at(&reference, track)?, clip, envelopes)?;
        }
        Ok(())
    })?;
    let part = track_at(&root, track)?;
    let clip = clip_at(part, at)?;
    Ok(
        json!({"clip": with_source(path, part, at, clip_reading(&root, clip)), "revision": new_revision}),
    )
}

/// The source the DLW's record keeps for one clip (`sources.rs`), set on its
/// reading as `source` (its constellation's ref, or null when it was made of
/// none); a record that cannot be read leaves `source` null and says why in
/// `sourceRefused`, so the clip still reads.
fn with_source(path: &str, track: &Element, at: ClipAt, mut reading: Value) -> Value {
    let found = track
        .attr("Id")
        .ok_or_else(|| {
            "the track carries no Id in the document, so no source is kept for its clips"
                .to_string()
        })
        .and_then(|id| crate::sources::source_of(std::path::Path::new(path), id, at));
    if let Value::Object(fields) = &mut reading {
        match found {
            Ok(source) => {
                fields.insert(
                    "source".into(),
                    source.map(Value::String).unwrap_or(Value::Null),
                );
            }
            Err(why) => {
                fields.insert("source".into(), Value::Null);
                fields.insert("sourceRefused".into(), Value::String(why));
            }
        }
    }
    reading
}

/// The longest clip made here, in beats.
const MADE_LENGTH_MAX: f64 = 4096.0;

/// A blank MIDI clip in the shape of `donor`, a MIDI clip the set already
/// holds: the document's own element names and nesting, as Live wrote them,
/// with everything the donor carried of its own cleared — its place, its
/// markers (the new clip loops from 0 to `length`), its name and info text,
/// its envelopes, its notes and their expression, and its follow action,
/// launch, groove and own mode set to a new clip's (Live's: trigger, global
/// quantize, no legato, no groove, no mode of its own, no follow action). It
/// wears its part's colour, as a new clip does in Live.
fn blank_clip(
    root: &Element,
    donor: &Element,
    track_colour: Option<&str>,
    length: f64,
) -> Result<Element, String> {
    let mut clip = donor.clone();
    clip.set_attr("Time", "0");
    let end = number_text(length);
    set_value(&mut clip, "CurrentStart", "0")?;
    set_value(&mut clip, "CurrentEnd", &end)?;
    let looped = clip
        .child_mut("Loop")
        .ok_or("the clip carries no Loop in the document")?;
    for (name, value) in [
        ("LoopStart", "0"),
        ("LoopEnd", end.as_str()),
        ("StartRelative", "0"),
        ("LoopOn", "true"),
        ("OutMarker", end.as_str()),
        ("HiddenLoopStart", "0"),
        ("HiddenLoopEnd", end.as_str()),
    ] {
        set_value(looped, name, value)?;
    }
    for name in ["Name", "Annotation"] {
        if clip.child(name).is_some() {
            set_value(&mut clip, name, "")?;
        }
    }
    if let Some(colour) = track_colour {
        if clip.child("Color").is_some() {
            set_value(&mut clip, "Color", colour)?;
        }
    }
    if let Some(list) = clip
        .child_mut("Envelopes")
        .and_then(|e| e.child_mut("Envelopes"))
    {
        list.children.clear();
    }
    if let Some(notes) = clip.child_mut("Notes") {
        if let Some(store) = notes
            .child_mut("PerNoteEventStore")
            .and_then(|s| s.child_mut("EventLists"))
        {
            store.children.clear();
        }
        if let Some(groups) = notes.child_mut("NoteProbabilityGroups") {
            groups.children.clear();
        }
    }
    let mut fresh = Map::new();
    for (key, value) in [
        ("active", json!(true)),
        ("follow", json!(false)),
        ("launch", json!("trigger")),
        ("legato", json!(false)),
        ("quantize", json!("global")),
        ("launchVelocity", json!(0)),
        ("groove", json!("none")),
        ("scale", json!(false)),
    ] {
        fresh.insert(key.into(), value);
    }
    apply_settings(root, &mut clip, &fresh)?;
    apply_notes(&mut clip, &[])?;
    Ok(clip)
}

/// The MIDI clip a new one takes its shape from: one of the part's own (its
/// slots, then its arrangement), else the first the set holds on any part.
fn shape_donor(root: &Element, track: usize) -> Option<Element> {
    let own = tracks(root).into_iter().nth(track);
    let of = |track: &Element| -> Option<Element> {
        let sequencer = track
            .child("DeviceChain")
            .and_then(|dc| dc.child("MainSequencer"))?;
        let slots = sequencer
            .child("ClipSlotList")
            .into_iter()
            .flat_map(|list| list.children.iter())
            .filter_map(|slot| {
                slot.child("ClipSlot")
                    .and_then(|inner| inner.child("Value"))
                    .and_then(|v| v.children.first())
            });
        let arranged = sequencer
            .child("ClipTimeable")
            .and_then(|h| h.child("ArrangerAutomation"))
            .and_then(|a| a.child("Events"))
            .into_iter()
            .flat_map(|events| events.children.iter());
        slots
            .chain(arranged)
            .find(|clip| {
                clip.name == "MidiClip"
                    && clip.child("Notes").is_some()
                    && clip.child("Loop").is_some()
            })
            .cloned()
    };
    own.and_then(of).or_else(|| {
        tracks(root)
            .into_iter()
            .filter(|t| t.name == "MidiTrack")
            .find_map(of)
    })
}

/// Make a MIDI clip in an empty session slot of a MIDI part (O-I #768; DLW
/// §21.2 What strikes the Torus: "drop the constellation on a part and Live
/// transcribes it into a clip"): in `scene`'s slot, or the part's first empty
/// slot, `length` beats long and looped, with `set`'s settings (the design's
/// words, as `clip_write` takes them) and `notes`; then keep `source` as its
/// source in the DLW's record beside the set (`sources.rs`). The clip is made
/// in the document's own shape, from a MIDI clip the set already holds
/// (`blank_clip`), so Live opens it as its own; a set that holds none is
/// refused in words. Answers the clip as it now stands with its source, where
/// it was made, and the set's new revision. The `.als` is written first: a
/// record that cannot be written leaves the clip made of nothing, and says so.
#[allow(clippy::too_many_arguments)]
pub fn clip_create(
    path: &str,
    expected_revision: &str,
    track: usize,
    scene: Option<usize>,
    length: f64,
    set: Option<&Map<String, Value>>,
    notes: &[Value],
    source: Option<&str>,
) -> Result<Value, String> {
    if !(length.is_finite() && length > 0.0 && length <= MADE_LENGTH_MAX) {
        return Err(format!(
            "A new clip's length is more than 0 and at most {} beats",
            number_text(MADE_LENGTH_MAX)
        ));
    }
    if let Some(source) = source {
        crate::sources::checked_ref(source)?;
    }
    let mut made_at = None;
    let (root, new_revision) = edit(path, expected_revision, |root| {
        let reference = root.clone();
        let part = track_at(&reference, track)?;
        if part.name != "MidiTrack" {
            return Err(
                "Live makes a clip of a constellation on a MIDI part, and this track is not one"
                    .into(),
            );
        }
        let colour = value_of(part, "Color").map(str::to_string);
        let donor = shape_donor(&reference, track).ok_or(
            "The set holds no MIDI clip whose shape a new one can take: make one clip in Live, save the set, then drop the constellation again",
        )?;
        let mut clip = blank_clip(&reference, &donor, colour.as_deref(), length)?;
        if let Some(set) = set {
            apply_settings(&reference, &mut clip, set)?;
        }
        apply_notes(&mut clip, notes)?;
        let slots = track_at_mut(root, track)?
            .child_mut("DeviceChain")
            .and_then(|dc| dc.child_mut("MainSequencer"))
            .and_then(|s| s.child_mut("ClipSlotList"))
            .ok_or("the part has no clip slots in the document")?;
        let held = |slot: &Element| {
            slot.child("ClipSlot")
                .and_then(|inner| inner.child("Value"))
                .is_none_or(|v| !v.children.is_empty())
        };
        let chosen = match scene {
            Some(scene) => {
                let slot = slots.children.get(scene).ok_or_else(|| format!("the part has no slot in scene {scene}"))?;
                if held(slot) {
                    return Err(format!("The slot in scene {} already holds a clip", scene + 1));
                }
                scene
            }
            None => slots
                .children
                .iter()
                .position(|slot| !held(slot))
                .ok_or("The part has no empty slot to make the clip in: add a scene, or clear a slot, then drop it again")?,
        };
        slots.children[chosen]
            .child_mut("ClipSlot")
            .and_then(|inner| inner.child_mut("Value"))
            .ok_or("the slot carries no value in the document")?
            .children = vec![clip];
        made_at = Some(chosen);
        Ok(())
    })?;
    let at = ClipAt::Slot(made_at.ok_or("the clip was not made")?);
    let part = track_at(&root, track)?;
    let mut refused = None;
    if let Some(source) = source {
        let kept = part
            .attr("Id")
            .ok_or_else(|| "the part carries no Id in the document".to_string())
            .and_then(|id| {
                crate::sources::set_source(std::path::Path::new(path), id, at, Some(source))
            });
        if let Err(why) = kept {
            refused = Some(format!(
                "The clip was made, but its source was not kept: {why}"
            ));
        }
    }
    let mut reading = with_source(path, part, at, clip_reading(&root, clip_at(part, at)?));
    if let (Some(why), Value::Object(fields)) = (refused, &mut reading) {
        fields.insert("sourceRefused".into(), Value::String(why));
    }
    let ClipAt::Slot(slot) = at else {
        unreachable!()
    };
    Ok(json!({"clip": reading, "at": {"slot": slot}, "revision": new_revision}))
}

/// Change one control of a track's mixer row (a send by its index); answer
/// the row and the new revision.
pub fn mixer_write(
    path: &str,
    expected_revision: &str,
    track: usize,
    control: &str,
    value: &Value,
    index: Option<usize>,
) -> Result<Value, String> {
    let (root, new_revision) = edit(path, expected_revision, |root| {
        apply_mixer(track_at_mut(root, track)?, control, value, index)
    })?;
    let returns = return_names(&root);
    Ok(json!({"mixer": mixer_json(track_at(&root, track)?, &returns), "revision": new_revision}))
}

/// Comp: copy the stretch `range` (`{start, end}` in beats) of a track's take
/// lane `take` into its main lane; answer the main lane and take lanes as they
/// now stand, and the new revision.
pub fn take_comp(
    path: &str,
    expected_revision: &str,
    track: usize,
    take: usize,
    range: &Value,
) -> Result<Value, String> {
    let from = beat(
        "The comp's start",
        range.get("start").unwrap_or(&Value::Null),
    )?;
    let to = beat("The comp's end", range.get("end").unwrap_or(&Value::Null))?;
    if to <= from {
        return Err("The comp's end lies after its start".into());
    }
    let (root, new_revision) = edit(path, expected_revision, |root| {
        let tempo = steady_tempo(root);
        comp(track_at_mut(root, track)?, take, from, to, tempo)
    })?;
    let mut reading = comp_json(track_at(&root, track)?);
    reading["revision"] = json!(new_revision);
    Ok(reading)
}

/// The set's Groove Pool, with the set's revision.
pub fn groove_pool_read(path: &str) -> Result<Value, String> {
    let (bytes, root) = open(path)?;
    let mut reading = groove_pool_json(&root);
    reading["revision"] = json!(revision(&bytes));
    Ok(reading)
}

/// Change one groove's setting (`base`, `quantize`, `timing`, `random`,
/// `velocity`), or with no groove the set's Global Amount (`amount`); answer
/// the pool as it now stands and the new revision.
pub fn groove_pool_write(
    path: &str,
    expected_revision: &str,
    groove: Option<u64>,
    field: &str,
    value: &Value,
) -> Result<Value, String> {
    let (root, new_revision) = edit(path, expected_revision, |root| {
        apply_groove(root, groove, field, value)
    })?;
    let mut reading = groove_pool_json(&root);
    reading["revision"] = json!(new_revision);
    Ok(reading)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A small set in Live 12's own shape (element names and nesting copied from real sets).
    const SET: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<Ableton MajorVersion="5" MinorVersion="12.0_12049">
<LiveSet>
<Tracks>
<MidiTrack Id="12">
<Name><EffectiveName Value="Keys"/><UserName Value=""/></Name>
<Color Value="26"/>
<AutomationEnvelopes><Envelopes>
<AutomationEnvelope Id="0"><EnvelopeTarget><PointeeId Value="900"/></EnvelopeTarget>
<Automation><Events><FloatEvent Id="1" Time="-63072000" Value="1"/><FloatEvent Id="2" Time="0" Value="1"/><FloatEvent Id="3" Time="8" Value="0.5"/></Events></Automation>
</AutomationEnvelope>
</Envelopes></AutomationEnvelopes>
<TakeLanes><TakeLanes>
<TakeLane Id="0"><ClipAutomation><Events><MidiClip Id="0" Time="0"><CurrentStart Value="0"/><CurrentEnd Value="16"/><Name Value="Take 1"/></MidiClip></Events></ClipAutomation><Name Value="Lane"/></TakeLane>
</TakeLanes></TakeLanes>
<DeviceChain>
<MidiInputRouting><Target Value="MidiIn/External.All/-1"/><UpperDisplayString Value="All Ins"/><LowerDisplayString Value="All Channels"/></MidiInputRouting>
<AudioOutputRouting><Target Value="AudioOut/Main"/><UpperDisplayString Value="Main"/><LowerDisplayString Value=""/></AudioOutputRouting>
<MidiOutputRouting><Target Value="MidiOut/None"/><UpperDisplayString Value="None"/><LowerDisplayString Value=""/></MidiOutputRouting>
<Mixer><Speaker><Manual Value="true"/></Speaker><SoloSink Value="false"/></Mixer>
<MainSequencer>
<MonitoringEnum Value="1"/>
<Recorder><IsArmed Value="false"/></Recorder>
<ClipSlotList>
<ClipSlot Id="0"><ClipSlot><Value><MidiClip Id="0" Time="0">
<CurrentStart Value="0"/><CurrentEnd Value="88"/>
<Loop><LoopStart Value="0"/><LoopEnd Value="88"/><StartRelative Value="0"/><LoopOn Value="false"/><OutMarker Value="88"/><HiddenLoopStart Value="0"/><HiddenLoopEnd Value="4"/></Loop>
<Name Value="E-Piano"/><Color Value="14"/><LaunchMode Value="0"/><LaunchQuantisation Value="0"/>
<TimeSignature><TimeSignatures><RemoteableTimeSignature Id="0"><Numerator Value="4"/><Denominator Value="4"/><Time Value="0"/></RemoteableTimeSignature></TimeSignatures></TimeSignature>
<Envelopes><Envelopes/></Envelopes>
<Legato Value="false"/>
<GrooveSettings><GrooveId Value="-1"/></GrooveSettings>
<Disabled Value="false"/>
<VelocityAmount Value="0"/>
<FollowAction><FollowTime Value="4"/><IsLinked Value="true"/><LoopIterations Value="1"/><FollowActionA Value="4"/><FollowActionB Value="0"/><FollowChanceA Value="100"/><FollowChanceB Value="0"/><JumpIndexA Value="1"/><JumpIndexB Value="1"/><FollowActionEnabled Value="false"/></FollowAction>
<Notes><KeyTracks>
<KeyTrack Id="0"><Notes><MidiNoteEvent Time="0" Duration="1" Velocity="100" VelocityDeviation="0" OffVelocity="64" Probability="1" IsEnabled="true" NoteId="1"/></Notes><MidiKey Value="60"/></KeyTrack>
<KeyTrack Id="1"><Notes><MidiNoteEvent Time="2" Duration="0.5" Velocity="80" VelocityDeviation="0" OffVelocity="64" Probability="0.5" IsEnabled="true" NoteId="2"/></Notes><MidiKey Value="64"/></KeyTrack>
</KeyTracks><NoteIdGenerator><NextId Value="3"/></NoteIdGenerator></Notes>
<ScaleInformation><RootNote Value="0"/><Name Value="Major"/></ScaleInformation>
<IsInKey Value="true"/>
</MidiClip></Value></ClipSlot></ClipSlot>
<ClipSlot Id="1"><ClipSlot><Value/></ClipSlot></ClipSlot>
</ClipSlotList>
</MainSequencer>
<DeviceChain><Devices><FilterEQ3 Id="1"><GainLo><Manual Value="1"/><AutomationTarget Id="900"/></GainLo></FilterEQ3></Devices></DeviceChain>
</DeviceChain>
</MidiTrack>
</Tracks>
<MainTrack><DeviceChain><Mixer><Speaker><Manual Value="true"/></Speaker></Mixer></DeviceChain></MainTrack>
<Scenes><Scene Id="0"/><Scene Id="1"/></Scenes>
<GroovePool><Grooves><Groove Id="7"><Name Value="Swing 16ths 57"/></Groove></Grooves></GroovePool>
</LiveSet>
</Ableton>"#;

    /// A set file of the test's own, removed when the guard drops.
    struct SetFile(std::path::PathBuf);
    impl Drop for SetFile {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }
    fn set_file() -> (SetFile, String) {
        set_file_of(SET)
    }
    fn set_file_of(xml: &str) -> (SetFile, String) {
        use std::sync::atomic::{AtomicUsize, Ordering};
        static NEXT: AtomicUsize = AtomicUsize::new(0);
        let dir = std::env::temp_dir().join(format!(
            "live-set-edit-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::SeqCst)
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("set.als");
        let root = crate::xml::parse(xml).unwrap();
        std::fs::write(&path, crate::write_gz(&root).unwrap()).unwrap();
        (SetFile(dir), path.to_str().unwrap().to_string())
    }
    const SLOT: ClipAt = ClipAt::Slot(0);

    #[test]
    fn a_clip_reads_whole_in_the_designs_words() {
        let (_dir, path) = set_file();
        let read = clip_json(&path, 0, SLOT).unwrap();
        let clip = &read["clip"];
        assert!(read["revision"].as_str().unwrap().starts_with("sha256:"));
        assert_eq!(clip["name"], "E-Piano");
        assert_eq!(clip["loop"], false);
        assert_eq!(
            (clip["start"].as_f64(), clip["end"].as_f64()),
            (Some(0.0), Some(88.0))
        );
        assert_eq!(
            (clip["position"].as_f64(), clip["length"].as_f64()),
            (Some(0.0), Some(4.0))
        );
        assert_eq!(clip["launch"], "trigger");
        assert_eq!(clip["quantize"], "global");
        assert_eq!(clip["followA"], "next");
        assert_eq!(clip["mode"], "ionian");
        assert_eq!(clip["scale"], true);
        assert_eq!(clip["sig"], json!({"num": 4.0, "den": 4.0}));
        assert_eq!(clip["notes"].as_array().unwrap().len(), 2);
        assert_eq!(
            clip["notes"][1],
            json!({"id": 2, "p": 64, "at": 2.0, "len": 0.5, "vel": 80.0, "chance": 0.5, "on": true})
        );
        assert!(clip_json(&path, 0, ClipAt::Slot(1))
            .unwrap_err()
            .contains("holds no clip"));
        assert!(clip_json(&path, 4, SLOT)
            .unwrap_err()
            .contains("no track 4"));
    }

    #[test]
    fn settings_write_against_the_revision_and_read_back() {
        let (_dir, path) = set_file();
        let rev = clip_json(&path, 0, SLOT).unwrap()["revision"]
            .as_str()
            .unwrap()
            .to_string();
        let set = json!({"name": "Rhodes", "launch": "gate", "quantize": "1/16", "followA": "again", "chance": 70,
            "follow": true, "multiplier": 4, "legato": true, "launchVelocity": 50, "mode": "dorian", "root": 2, "active": false,
            "sig.num": 7, "sig.den": 8, "groove": "Swing 16ths 57"});
        let wrote = clip_write(&path, &rev, 0, SLOT, set.as_object(), None, None).unwrap();
        let clip = &wrote["clip"];
        assert_eq!(clip["name"], "Rhodes");
        assert_eq!(clip["launch"], "gate");
        assert_eq!(clip["quantize"], "1/16");
        assert_eq!(clip["followA"], "again");
        assert_eq!(clip["chance"].as_f64(), Some(70.0));
        assert_eq!(clip["mode"], "dorian");
        assert_eq!(clip["root"].as_f64(), Some(2.0));
        assert_eq!(clip["active"], false);
        assert_eq!(clip["sig"], json!({"num": 7.0, "den": 8.0}));
        assert_eq!(clip["groove"], "Swing 16ths 57");
        assert_eq!(clip["launchVelocity"].as_f64(), Some(50.0));
        assert_ne!(wrote["revision"], json!(rev));
        // The same revision again is stale: the file moved.
        let stale = clip_write(
            &path,
            &rev,
            0,
            SLOT,
            json!({"name": "x"}).as_object(),
            None,
            None,
        )
        .unwrap_err();
        assert!(stale.contains("changed since it was read"), "{stale}");
        assert_eq!(
            clip_json(&path, 0, SLOT).unwrap()["clip"],
            *clip,
            "what the write answered is what the file holds"
        );
    }

    #[test]
    fn words_outside_lives_values_are_refused_and_nothing_is_written() {
        let (_dir, path) = set_file();
        let rev = clip_json(&path, 0, SLOT).unwrap()["revision"]
            .as_str()
            .unwrap()
            .to_string();
        for (set, said) in [
            (
                json!({"launch": "hold"}),
                "Launch mode takes one of trigger, gate, toggle, repeat",
            ),
            (json!({"quantize": "1/64"}), "Quantize takes one of"),
            (
                json!({"chance": 120}),
                "Chance is a whole number from 0 to 100",
            ),
            (json!({"sig.den": 3}), "1, 2, 4, 8 or 16"),
            (json!({"mode": "blues"}), "The mode is one of"),
            (json!({"groove": "Shuffle"}), "holds no groove \"Shuffle\""),
            (json!({"end": 0}), "end lies after its start"),
            (json!({"tempo": 1}), "A clip has no setting tempo"),
        ] {
            let refused =
                clip_write(&path, &rev, 0, SLOT, set.as_object(), None, None).unwrap_err();
            assert!(refused.contains(said), "{refused} lacks {said}");
        }
        assert_eq!(
            clip_json(&path, 0, SLOT).unwrap()["revision"],
            json!(rev),
            "a refusal writes nothing"
        );
    }

    #[test]
    fn the_loop_markers_move_by_the_documents_own_model() {
        let (_dir, path) = set_file();
        let mut rev = clip_json(&path, 0, SLOT).unwrap()["revision"]
            .as_str()
            .unwrap()
            .to_string();
        let mut write = |set: Value| {
            let wrote = clip_write(&path, &rev, 0, SLOT, set.as_object(), None, None).unwrap();
            rev = wrote["revision"].as_str().unwrap().to_string();
            wrote["clip"].clone()
        };
        // Loop on: the brace comes back from the hidden loop; start and end stay.
        let on = write(json!({"loop": true}));
        assert_eq!(
            (
                on["loop"].clone(),
                on["start"].as_f64(),
                on["end"].as_f64(),
                on["position"].as_f64(),
                on["length"].as_f64()
            ),
            (json!(true), Some(0.0), Some(88.0), Some(0.0), Some(4.0))
        );
        let moved = write(json!({"position": 8, "length": 16, "start": 10}));
        assert_eq!(
            (
                moved["position"].as_f64(),
                moved["length"].as_f64(),
                moved["start"].as_f64()
            ),
            (Some(8.0), Some(16.0), Some(10.0))
        );
        // Loop off: start and end stay, the brace is kept hidden.
        let off = write(json!({"loop": false}));
        assert_eq!(
            (
                off["start"].as_f64(),
                off["end"].as_f64(),
                off["position"].as_f64(),
                off["length"].as_f64()
            ),
            (Some(10.0), Some(88.0), Some(8.0), Some(16.0))
        );
    }

    #[test]
    fn notes_are_replaced_keeping_their_ids_and_new_ones_take_the_next() {
        let (_dir, path) = set_file();
        let rev = clip_json(&path, 0, SLOT).unwrap()["revision"]
            .as_str()
            .unwrap()
            .to_string();
        let notes = vec![
            json!({"id": 2, "p": 64, "at": 2.0, "len": 1.0, "vel": 90}),
            json!({"p": 67, "at": 3.0, "len": 0.5, "vel": 70, "chance": 0.25}),
        ];
        let wrote = clip_write(&path, &rev, 0, SLOT, None, Some(&notes), None).unwrap();
        let read = wrote["clip"]["notes"].as_array().unwrap();
        assert_eq!(read.len(), 2);
        assert_eq!(read[0]["id"], 2);
        assert_eq!(read[0]["len"].as_f64(), Some(1.0));
        assert_eq!(read[1]["id"], 3, "a new note takes the clip's next id");
        assert_eq!(read[1]["chance"].as_f64(), Some(0.25));
        let rev = wrote["revision"].as_str().unwrap();
        let bad = clip_write(
            &path,
            rev,
            0,
            SLOT,
            None,
            Some(&[json!({"p": 200, "at": 0, "len": 1})]),
            None,
        )
        .unwrap_err();
        assert!(bad.contains("pitch is 0 to 127"));
        // A note before the clip's start stands, as Live keeps it (real sets hold notes at negative times).
        let early = clip_write(
            &path,
            rev,
            0,
            SLOT,
            None,
            Some(&[json!({"p": 60, "at": -0.5, "len": 1})]),
            None,
        )
        .unwrap();
        assert_eq!(early["clip"]["notes"][0]["at"].as_f64(), Some(-0.5));
    }

    #[test]
    fn a_clip_envelope_is_made_on_its_parameters_target_replaced_and_removed() {
        let (_dir, path) = set_file();
        let rev = clip_json(&path, 0, SLOT).unwrap()["revision"]
            .as_str()
            .unwrap()
            .to_string();
        let gain = |points: Value| {
            vec![json!({"device": "FilterEQ3", "parameter": "GainLo", "points": points})]
        };
        let made = clip_write(
            &path,
            &rev,
            0,
            SLOT,
            None,
            None,
            Some(&gain(json!([[0, 1.0], [4, 0.25]]))),
        )
        .unwrap();
        assert_eq!(
            made["clip"]["envelopes"],
            json!([{"target": "900", "device": "FilterEQ3", "parameter": "GainLo", "points": [[0.0, 1.0], [4.0, 0.25]]}])
        );
        let rev = made["revision"].as_str().unwrap();
        let replaced = clip_write(
            &path,
            rev,
            0,
            SLOT,
            None,
            None,
            Some(&gain(json!([[2, 0.5]]))),
        )
        .unwrap();
        assert_eq!(
            replaced["clip"]["envelopes"][0]["points"],
            json!([[2.0, 0.5]])
        );
        let rev = replaced["revision"].as_str().unwrap();
        let removed = clip_write(&path, rev, 0, SLOT, None, None, Some(&gain(json!([])))).unwrap();
        assert_eq!(removed["clip"]["envelopes"], json!([]));
        let rev = removed["revision"].as_str().unwrap();
        let unknown =
            vec![json!({"device": "Reverb", "parameter": "DecayTime", "points": [[0, 1]]})];
        assert!(clip_write(&path, rev, 0, SLOT, None, None, Some(&unknown))
            .unwrap_err()
            .contains("no Reverb DecayTime"));
    }

    #[test]
    fn the_mixer_row_reads_and_writes_lives_own_elements() {
        let (_dir, path) = set_file();
        let (_, root) = open(&path).unwrap();
        let extra = tracks_extra_json(&root);
        assert_eq!(
            extra[0]["mixer"],
            json!({"activator": true, "solo": false, "arm": false, "monitor": "auto", "input": "All Ins · All Channels", "output": "Main"})
        );
        assert_eq!(
            extra[1]["mixer"],
            json!({"activator": true}),
            "the Main track has no solo, arm or monitor"
        );
        assert_eq!(
            extra[0]["takeLanes"],
            json!([{"name": "Lane", "clips": [{"name": "Take 1", "start": 0.0, "end": 16.0, "takeId": null, "gave": []}]}])
        );
        assert_eq!(
            extra[0]["automation"],
            json!([{"target": "900", "device": "FilterEQ3", "parameter": "GainLo", "points": [[0.0, 1.0], [8.0, 0.5]]}])
        );
        let mut rev = clip_json(&path, 0, SLOT).unwrap()["revision"]
            .as_str()
            .unwrap()
            .to_string();
        for (control, value) in [
            ("solo", json!(true)),
            ("arm", json!(true)),
            ("monitor", json!("in")),
            ("activator", json!(false)),
        ] {
            let wrote = mixer_write(&path, &rev, 0, control, &value, None).unwrap();
            assert_eq!(wrote["mixer"][control], value, "{control}");
            rev = wrote["revision"].as_str().unwrap().to_string();
        }
        assert!(mixer_write(&path, &rev, 1, "solo", &json!(true), None)
            .unwrap_err()
            .contains("no solo"));
        assert!(
            mixer_write(&path, &rev, 0, "monitor", &json!("always"), None)
                .unwrap_err()
                .contains("Monitor takes one of in, auto, off")
        );
        assert!(mixer_write(&path, &rev, 0, "output", &json!("Main"), None)
            .unwrap_err()
            .contains("routings Live offers"));
    }

    /// A comped set in Live 12's own shape: element names, nesting and values copied from real sets on this machine — the
    /// sends of `waddamaess.als` (two returns; a return's own sends off), the take lanes and `TakeId`s of the template "Piano and
    /// voices mastering" (3-LABS), its Groove Pool's two grooves, and an unwarped audio take whose markers are in seconds.
    const COMPED: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<Ableton MajorVersion="5" MinorVersion="12.0_12049">
<LiveSet>
<Tracks>
<MidiTrack Id="12">
<Name><EffectiveName Value="Keys"/><UserName Value=""/></Name>
<TakeLanes><TakeLanes>
<TakeLane Id="0"><Height Value="51"/><IsContentSelectedInDocument Value="false"/><ClipAutomation><Events>
<MidiClip Id="0" Time="0"><LomId Value="0"/><CurrentStart Value="0"/><CurrentEnd Value="16"/><Loop><LoopStart Value="0"/><LoopEnd Value="16"/><StartRelative Value="0"/><LoopOn Value="false"/><OutMarker Value="16"/><HiddenLoopStart Value="0"/><HiddenLoopEnd Value="16"/></Loop><Name Value="Keys"/><Color Value="9"/><Envelopes><Envelopes/></Envelopes><IsWarped Value="true"/><TakeId Value="1"/><Notes><KeyTracks><KeyTrack Id="0"><Notes><MidiNoteEvent Time="1" Duration="1" Velocity="100" VelocityDeviation="0" OffVelocity="64" Probability="1" IsEnabled="true" NoteId="1"/></Notes><MidiKey Value="60"/></KeyTrack></KeyTracks><NoteIdGenerator><NextId Value="2"/></NoteIdGenerator></Notes></MidiClip>
</Events></ClipAutomation><Name Value="Lane"/><Annotation Value=""/><Audition Value="false"/></TakeLane>
<TakeLane Id="1"><Height Value="51"/><IsContentSelectedInDocument Value="false"/><ClipAutomation><Events>
<MidiClip Id="0" Time="4"><LomId Value="0"/><CurrentStart Value="4"/><CurrentEnd Value="12"/><Loop><LoopStart Value="1"/><LoopEnd Value="9"/><StartRelative Value="0"/><LoopOn Value="false"/><OutMarker Value="9"/><HiddenLoopStart Value="1"/><HiddenLoopEnd Value="9"/></Loop><Name Value="Keys 2"/><Color Value="9"/><Envelopes><Envelopes/></Envelopes><IsWarped Value="true"/><TakeId Value="2"/><Notes><KeyTracks><KeyTrack Id="0"><Notes><MidiNoteEvent Time="3" Duration="0.5" Velocity="90" VelocityDeviation="0" OffVelocity="64" Probability="1" IsEnabled="true" NoteId="1"/><MidiNoteEvent Time="5" Duration="0.5" Velocity="90" VelocityDeviation="0" OffVelocity="64" Probability="1" IsEnabled="true" NoteId="2"/></Notes><MidiKey Value="64"/></KeyTrack></KeyTracks><NoteIdGenerator><NextId Value="3"/></NoteIdGenerator></Notes></MidiClip>
</Events></ClipAutomation><Name Value="Lane"/><Annotation Value=""/><Audition Value="false"/></TakeLane>
</TakeLanes><AreTakeLanesFolded Value="false"/></TakeLanes>
<DeviceChain>
<Mixer><Sends>
<TrackSendHolder Id="0"><Send><LomId Value="0"/><Manual Value="0.0003162277571"/><MidiControllerRange><Min Value="0.0003162277571"/><Max Value="1"/></MidiControllerRange><AutomationTarget Id="30"><LockEnvelope Value="0"/></AutomationTarget><ModulationTarget Id="31"><LockEnvelope Value="0"/></ModulationTarget></Send><EnabledByUser Value="true"/></TrackSendHolder>
<TrackSendHolder Id="1"><Send><LomId Value="0"/><Manual Value="0.0003162277571"/><MidiControllerRange><Min Value="0.0003162277571"/><Max Value="1"/></MidiControllerRange><AutomationTarget Id="32"><LockEnvelope Value="0"/></AutomationTarget><ModulationTarget Id="33"><LockEnvelope Value="0"/></ModulationTarget></Send><EnabledByUser Value="true"/></TrackSendHolder>
</Sends><Speaker><Manual Value="true"/></Speaker><SoloSink Value="false"/><Volume><Manual Value="1"/><AutomationTarget Id="40"><LockEnvelope Value="0"/></AutomationTarget></Volume></Mixer>
<MainSequencer>
<ClipTimeable><ArrangerAutomation><Events>
<MidiClip Id="5" Time="0"><LomId Value="0"/><CurrentStart Value="0"/><CurrentEnd Value="16"/><Loop><LoopStart Value="0"/><LoopEnd Value="16"/><StartRelative Value="0"/><LoopOn Value="false"/><OutMarker Value="16"/><HiddenLoopStart Value="0"/><HiddenLoopEnd Value="16"/></Loop><Name Value="Keys"/><Color Value="9"/><Envelopes><Envelopes/></Envelopes><IsWarped Value="true"/><TakeId Value="1"/><Notes><KeyTracks><KeyTrack Id="0"><Notes><MidiNoteEvent Time="1" Duration="1" Velocity="100" VelocityDeviation="0" OffVelocity="64" Probability="1" IsEnabled="true" NoteId="1"/></Notes><MidiKey Value="60"/></KeyTrack></KeyTracks><NoteIdGenerator><NextId Value="2"/></NoteIdGenerator></Notes></MidiClip>
</Events></ArrangerAutomation></ClipTimeable>
<Recorder><IsArmed Value="false"/><TakeCounter Value="3"/></Recorder>
</MainSequencer>
</DeviceChain>
</MidiTrack>
<AudioTrack Id="13">
<Name><EffectiveName Value="Voice"/><UserName Value=""/></Name>
<TakeLanes><TakeLanes>
<TakeLane Id="0"><Height Value="51"/><IsContentSelectedInDocument Value="false"/><ClipAutomation><Events>
<AudioClip Id="0" Time="0"><LomId Value="0"/><CurrentStart Value="0"/><CurrentEnd Value="8"/><Loop><LoopStart Value="0"/><LoopEnd Value="4"/><StartRelative Value="0"/><LoopOn Value="false"/><OutMarker Value="4"/><HiddenLoopStart Value="0"/><HiddenLoopEnd Value="4"/></Loop><Name Value="Voice"/><Color Value="22"/><Envelopes><Envelopes/></Envelopes><IsWarped Value="false"/><TakeId Value="1"/></AudioClip>
</Events></ClipAutomation><Name Value="Lane"/><Annotation Value=""/><Audition Value="false"/></TakeLane>
</TakeLanes><AreTakeLanesFolded Value="false"/></TakeLanes>
<DeviceChain>
<Mixer><Sends>
<TrackSendHolder Id="0"><Send><LomId Value="0"/><Manual Value="0.25"/><MidiControllerRange><Min Value="0.0003162277571"/><Max Value="1"/></MidiControllerRange><AutomationTarget Id="34"><LockEnvelope Value="0"/></AutomationTarget></Send><EnabledByUser Value="true"/></TrackSendHolder>
<TrackSendHolder Id="1"><Send><LomId Value="0"/><Manual Value="0.0003162277571"/><MidiControllerRange><Min Value="0.0003162277571"/><Max Value="1"/></MidiControllerRange><AutomationTarget Id="36"><LockEnvelope Value="0"/></AutomationTarget></Send><EnabledByUser Value="true"/></TrackSendHolder>
</Sends><Speaker><Manual Value="true"/></Speaker></Mixer>
<MainSequencer><Sample><ArrangerAutomation><Events/></ArrangerAutomation></Sample></MainSequencer>
</DeviceChain>
</AudioTrack>
<ReturnTrack Id="2">
<Name><EffectiveName Value="A-Reverb"/><UserName Value=""/></Name>
<DeviceChain><Mixer><Sends>
<TrackSendHolder Id="0"><Send><LomId Value="0"/><Manual Value="0.0003162277571"/><MidiControllerRange><Min Value="0.0003162277571"/><Max Value="1"/></MidiControllerRange><AutomationTarget Id="50"><LockEnvelope Value="0"/></AutomationTarget></Send><EnabledByUser Value="false"/></TrackSendHolder>
<TrackSendHolder Id="1"><Send><LomId Value="0"/><Manual Value="0.0003162277571"/><MidiControllerRange><Min Value="0.0003162277571"/><Max Value="1"/></MidiControllerRange><AutomationTarget Id="52"><LockEnvelope Value="0"/></AutomationTarget></Send><EnabledByUser Value="false"/></TrackSendHolder>
</Sends><Speaker><Manual Value="true"/></Speaker></Mixer></DeviceChain>
</ReturnTrack>
<ReturnTrack Id="3">
<Name><EffectiveName Value="B-Delay"/><UserName Value=""/></Name>
<DeviceChain><Mixer><Sends>
<TrackSendHolder Id="0"><Send><LomId Value="0"/><Manual Value="0.0003162277571"/><MidiControllerRange><Min Value="0.0003162277571"/><Max Value="1"/></MidiControllerRange><AutomationTarget Id="54"><LockEnvelope Value="0"/></AutomationTarget></Send><EnabledByUser Value="false"/></TrackSendHolder>
<TrackSendHolder Id="1"><Send><LomId Value="0"/><Manual Value="0.0003162277571"/><MidiControllerRange><Min Value="0.0003162277571"/><Max Value="1"/></MidiControllerRange><AutomationTarget Id="56"><LockEnvelope Value="0"/></AutomationTarget></Send><EnabledByUser Value="false"/></TrackSendHolder>
</Sends><Speaker><Manual Value="true"/></Speaker></Mixer></DeviceChain>
</ReturnTrack>
</Tracks>
<MainTrack>
<AutomationEnvelopes><Envelopes/></AutomationEnvelopes>
<DeviceChain><Mixer><Sends/><Speaker><Manual Value="true"/></Speaker>
<Tempo><LomId Value="0"/><Manual Value="120"/><MidiControllerRange><Min Value="60"/><Max Value="200"/></MidiControllerRange><AutomationTarget Id="8"><LockEnvelope Value="0"/></AutomationTarget></Tempo>
<GlobalGrooveAmount><LomId Value="0"/><Manual Value="100"/><MidiControllerRange><Min Value="0"/><Max Value="131.25"/></MidiControllerRange><AutomationTarget Id="11"><LockEnvelope Value="0"/></AutomationTarget></GlobalGrooveAmount>
</Mixer></DeviceChain>
</MainTrack>
<Scenes><Scene Id="0"/></Scenes>
<GroovePool><LomId Value="0"/><Grooves>
<Groove Id="0"><LomId Value="0"/><Name Value="2 Step Shuffled 16ths"/><Clip><Value><MidiClip Id="0" Time="0"><CurrentStart Value="0"/><CurrentEnd Value="4"/></MidiClip></Value></Clip><Grid Value="3"/><QuantizationAmount Value="0"/><TimingAmount Value="100"/><RandomAmount Value="0"/><VelocityAmount Value="100"/><Annotation Value=""/><Selection Value="false"/><SourceContext><SourceContext Id="1"/></SourceContext></Groove>
<Groove Id="1"><LomId Value="0"/><Name Value="Disco Live Feel 16ths"/><Clip><Value><MidiClip Id="0" Time="0"><CurrentStart Value="0"/><CurrentEnd Value="4"/></MidiClip></Value></Clip><Grid Value="3"/><QuantizationAmount Value="0"/><TimingAmount Value="100"/><RandomAmount Value="20"/><VelocityAmount Value="50"/><Annotation Value=""/><Selection Value="false"/><SourceContext><SourceContext Id="0"/></SourceContext></Groove>
</Grooves></GroovePool>
</LiveSet>
</Ableton>"#;

    fn revision_of(path: &str) -> String {
        groove_pool_read(path).unwrap()["revision"]
            .as_str()
            .unwrap()
            .to_string()
    }
    fn main_lane_of(reading: &Value) -> Vec<(String, f64, f64, Option<f64>)> {
        reading["clips"]
            .as_array()
            .unwrap()
            .iter()
            .map(|c| {
                (
                    c["name"].as_str().unwrap().to_string(),
                    c["start"].as_f64().unwrap(),
                    c["end"].as_f64().unwrap(),
                    c["takeId"].as_f64(),
                )
            })
            .collect()
    }

    #[test]
    fn each_send_reads_by_the_return_it_feeds_and_writes_on_the_revision() {
        let (_dir, path) = set_file_of(COMPED);
        let (_, root) = open(&path).unwrap();
        let extra = tracks_extra_json(&root);
        let floor = 0.0003162277571;
        assert_eq!(
            extra[0]["mixer"]["sends"],
            json!([{"name": "A-Reverb", "send": "Send A", "value": floor, "min": floor, "max": 1.0, "on": true},
                   {"name": "B-Delay", "send": "Send B", "value": floor, "min": floor, "max": 1.0, "on": true}])
        );
        assert_eq!(
            extra[2]["mixer"]["sends"][0]["on"], false,
            "a return's own sends are off until Live turns them on"
        );
        assert!(
            extra[4]["mixer"].get("sends").is_none(),
            "the Main track has no sends"
        );
        let rev = revision_of(&path);
        let wrote = mixer_write(&path, &rev, 0, "send", &json!(0.5), Some(1)).unwrap();
        assert_eq!(wrote["mixer"]["sends"][1]["value"].as_f64(), Some(0.5));
        assert_eq!(
            wrote["mixer"]["sends"][0]["value"].as_f64(),
            Some(floor),
            "only the named send moves"
        );
        assert_eq!(
            wrote["mixer"]["activator"], true,
            "the row's other controls stand"
        );
        let rev = wrote["revision"].as_str().unwrap();
        for (track, value, index, said) in [
            (0, json!(2.0), Some(0), "Send A is a level from"),
            (0, json!(0.5), None, "named by its index"),
            (0, json!(0.5), Some(2), "no Send C"),
            (2, json!(0.5), Some(1), "Send B is off on this track"),
        ] {
            let refused = mixer_write(&path, rev, track, "send", &value, index).unwrap_err();
            assert!(refused.contains(said), "{refused} lacks {said}");
        }
        assert!(mixer_write(&path, rev, 0, "solo", &json!(true), Some(0))
            .unwrap_err()
            .contains("takes no index"));
        assert!(
            mixer_write(&path, &rev_stale(), 0, "send", &json!(0.5), Some(0))
                .unwrap_err()
                .contains("changed since it was read")
        );
    }
    fn rev_stale() -> String {
        "sha256:0".into()
    }

    #[test]
    fn a_clip_envelope_moves_a_send_named_as_live_names_it() {
        let (_dir, path) = set_file_of(COMPED);
        let rev = revision_of(&path);
        let send_b =
            vec![json!({"device": "Mixer", "parameter": "Send B", "points": [[0, 0.5], [8, 1.0]]})];
        let wrote = clip_write(
            &path,
            &rev,
            0,
            ClipAt::Arrangement(0),
            None,
            None,
            Some(&send_b),
        )
        .unwrap();
        assert_eq!(
            wrote["clip"]["envelopes"],
            json!([{"target": "32", "device": "Mixer", "parameter": "Send B", "points": [[0.0, 0.5], [8.0, 1.0]]}]),
            "Send B is the track's own second send, resolved within the clip's track"
        );
        let rev = wrote["revision"].as_str().unwrap();
        let send_c = vec![json!({"device": "Mixer", "parameter": "Send C", "points": [[0, 1]]})];
        assert!(clip_write(
            &path,
            rev,
            0,
            ClipAt::Arrangement(0),
            None,
            None,
            Some(&send_c)
        )
        .unwrap_err()
        .contains("no Mixer Send C"));
    }

    #[test]
    fn a_comp_copies_the_takes_stretch_into_the_main_lane_and_names_its_take() {
        let (_dir, path) = set_file_of(COMPED);
        let rev = revision_of(&path);
        let comped = take_comp(&path, &rev, 0, 1, &json!({"start": 6, "end": 10})).unwrap();
        assert_eq!(
            main_lane_of(&comped),
            vec![
                ("Keys".into(), 0.0, 6.0, Some(1.0)),
                ("Keys 2".into(), 6.0, 10.0, Some(2.0)),
                ("Keys".into(), 10.0, 16.0, Some(1.0)),
            ],
            "the stretch replaces what the main lane held, the clip around it split"
        );
        assert_eq!(
            comped["takeLanes"][1]["clips"][0]["gave"],
            json!([{"start": 6.0, "end": 10.0}]),
            "the take lane marks the stretch it gave"
        );
        assert_eq!(
            comped["takeLanes"][0]["clips"][0]["gave"],
            json!([{"start": 0.0, "end": 6.0}, {"start": 10.0, "end": 16.0}])
        );
        // The copy is the take's own clip, its markers moved by the stretch's offset (Live's comp: LoopStart = the take's +
        // the offset, LoopEnd = LoopStart + the length, OutMarker and the hidden loop the take's), its notes the take's.
        let rev = comped["revision"].as_str().unwrap();
        let copy = clip_json(&path, 0, ClipAt::Arrangement(1)).unwrap();
        assert_eq!(copy["revision"], json!(rev));
        let copy = &copy["clip"];
        assert_eq!(
            (copy["start"].as_f64(), copy["end"].as_f64()),
            (Some(3.0), Some(7.0))
        );
        assert_eq!(copy["notes"].as_array().unwrap().len(), 2);
        let (_, root) = open(&path).unwrap();
        let track = track_at(&root, 0).unwrap();
        let lane = main_lane(track);
        let loop_of = |clip: &Element, name: &str| clip.child("Loop").and_then(|l| num(l, name));
        assert_eq!(loop_of(lane[1], "OutMarker"), Some(9.0));
        assert_eq!(
            (loop_of(lane[2], "LoopStart"), loop_of(lane[2], "LoopEnd")),
            (Some(10.0), Some(16.0)),
            "the piece after the stretch keeps its material where it stood"
        );
        assert_eq!(
            (lane[0].attr("Id"), lane[1].attr("Id"), lane[2].attr("Id")),
            (Some("5"), Some("7"), Some("6")),
            "the split piece and the copy take the main lane's next ids"
        );
        assert_eq!(lane[1].attr("Time"), Some("6"));
        // Comping the whole of take 1 again leaves its one stretch standing.
        let whole = take_comp(&path, rev, 0, 0, &json!({"start": 0, "end": 16})).unwrap();
        assert_eq!(
            main_lane_of(&whole),
            vec![("Keys".into(), 0.0, 16.0, Some(1.0))]
        );
    }

    #[test]
    fn a_comp_outside_the_take_or_on_a_moved_set_is_refused_and_writes_nothing() {
        let (_dir, path) = set_file_of(COMPED);
        let rev = revision_of(&path);
        for (lane, range, said) in [
            (
                1,
                json!({"start": 13, "end": 15}),
                "holds nothing between beat 13 and beat 15",
            ),
            (5, json!({"start": 0, "end": 4}), "no take lane 5"),
            (1, json!({"start": 8, "end": 6}), "end lies after its start"),
            (1, json!({"start": -1, "end": 6}), "a place in beats"),
        ] {
            let refused = take_comp(&path, &rev, 0, lane, &range).unwrap_err();
            assert!(refused.contains(said), "{refused} lacks {said}");
        }
        assert!(
            take_comp(&path, "sha256:0", 0, 1, &json!({"start": 6, "end": 10}))
                .unwrap_err()
                .contains("changed since it was read")
        );
        assert_eq!(revision_of(&path), rev, "a refusal writes nothing");
    }

    #[test]
    fn an_unwarped_audio_take_comps_in_seconds_at_a_steady_tempo_only() {
        let (_dir, path) = set_file_of(COMPED);
        let rev = revision_of(&path);
        let comped = take_comp(&path, &rev, 1, 0, &json!({"start": 2, "end": 6})).unwrap();
        assert_eq!(
            main_lane_of(&comped),
            vec![("Voice".into(), 2.0, 6.0, Some(1.0))]
        );
        let (_, root) = open(&path).unwrap();
        let lane = main_lane(track_at(&root, 1).unwrap());
        let loop_of = |name: &str| lane[0].child("Loop").and_then(|l| num(l, name));
        assert_eq!(
            (loop_of("LoopStart"), loop_of("LoopEnd")),
            (Some(1.0), Some(3.0)),
            "two beats at 120 BPM is one second"
        );
        let moving = COMPED.replace(
            "<AutomationEnvelopes><Envelopes/></AutomationEnvelopes>",
            r#"<AutomationEnvelopes><Envelopes><AutomationEnvelope Id="0"><EnvelopeTarget><PointeeId Value="8"/></EnvelopeTarget><Automation><Events><FloatEvent Id="1" Time="-63072000" Value="120"/><FloatEvent Id="2" Time="16" Value="90"/></Events></Automation></AutomationEnvelope></Envelopes></AutomationEnvelopes>"#,
        );
        let (_moving_dir, moving_path) = set_file_of(&moving);
        let rev = revision_of(&moving_path);
        assert!(
            take_comp(&moving_path, &rev, 1, 0, &json!({"start": 2, "end": 6}))
                .unwrap_err()
                .contains("tempo moves")
        );
        assert!(
            take_comp(&moving_path, &rev, 0, 1, &json!({"start": 6, "end": 10})).is_ok(),
            "a MIDI take keeps its markers in beats whatever the tempo"
        );
    }

    #[test]
    fn the_groove_pool_reads_and_writes_lives_own_elements() {
        let (_dir, path) = set_file_of(COMPED);
        let pool = groove_pool_read(&path).unwrap();
        assert_eq!(
            pool["grooves"][1],
            json!({"id": 1, "name": "Disco Live Feel 16ths", "base": "1/16", "quantize": 0.0, "timing": 100.0, "random": 20.0, "velocity": 50.0})
        );
        assert_eq!(pool["amount"].as_f64(), Some(100.0));
        assert_eq!(pool["amountRange"], json!({"min": 0.0, "max": 131.25}));
        let mut rev = pool["revision"].as_str().unwrap().to_string();
        for (groove, field, value) in [
            (Some(1), "base", json!("1/8t")),
            (Some(1), "random", json!(35)),
            (Some(0), "velocity", json!(12.5)),
            (None, "amount", json!(120)),
        ] {
            let wrote = groove_pool_write(&path, &rev, groove, field, &value).unwrap();
            rev = wrote["revision"].as_str().unwrap().to_string();
        }
        let pool = groove_pool_read(&path).unwrap();
        assert_eq!(pool["grooves"][1]["base"], "1/8t");
        assert_eq!(pool["grooves"][1]["random"].as_f64(), Some(35.0));
        assert_eq!(pool["grooves"][0]["velocity"].as_f64(), Some(12.5));
        assert_eq!(pool["amount"].as_f64(), Some(120.0));
        let (_, root) = open(&path).unwrap();
        assert_eq!(
            root.find("Grooves")
                .and_then(|grooves| value_of(&grooves.children[1], "Grid")),
            Some("2"),
            "Base is Live's Grid index"
        );
        for (groove, field, value, said) in [
            (Some(1), "velocity", json!(150), "velocity is from 0 to 100"),
            (
                Some(1),
                "base",
                json!("1/64"),
                "Base takes one of 1/4, 1/8, 1/8t, 1/16, 1/16t, 1/32",
            ),
            (
                None,
                "amount",
                json!(140),
                "Global Amount is from 0 to 131.25",
            ),
            (Some(9), "timing", json!(50), "holds no groove 9"),
            (Some(1), "swing", json!(50), "no setting swing"),
            (None, "timing", json!(50), "names its groove"),
            (Some(1), "amount", json!(50), "the pool's, not a groove's"),
        ] {
            let refused = groove_pool_write(&path, &rev, groove, field, &value).unwrap_err();
            assert!(refused.contains(said), "{refused} lacks {said}");
        }
        assert_eq!(revision_of(&path), rev, "a refusal writes nothing");
        // A set whose pool is empty reads no grooves ("Drop clips or grooves here"), and no Global Amount where it keeps none.
        let (_none_dir, none) = set_file_of(&SET.replace(
            r#"<Groove Id="7"><Name Value="Swing 16ths 57"/></Groove>"#,
            "",
        ));
        assert_eq!(groove_pool_read(&none).unwrap()["grooves"], json!([]));
        assert_eq!(groove_pool_read(&none).unwrap()["amount"], Value::Null);
    }

    // ------------------------------------------------------------ a clip made of a constellation (O-I #768)

    fn notes_of(clip: &Value) -> Vec<(i64, f64, f64, f64)> {
        let mut out: Vec<_> = clip["notes"]
            .as_array()
            .unwrap()
            .iter()
            .map(|n| {
                (
                    n["p"].as_i64().unwrap(),
                    n["at"].as_f64().unwrap(),
                    n["len"].as_f64().unwrap(),
                    n["vel"].as_f64().unwrap(),
                )
            })
            .collect();
        out.sort_by(|a, b| a.partial_cmp(b).unwrap());
        out
    }

    #[test]
    fn a_clip_is_made_in_the_first_empty_slot_of_a_midi_part_in_the_sets_own_shape_and_keeps_its_source(
    ) {
        let (_dir, path) = set_file();
        let read = clip_json(&path, 0, SLOT).unwrap();
        let revision = read["revision"].as_str().unwrap().to_string();
        assert_eq!(
            read["clip"]["source"],
            Value::Null,
            "a clip Live did not make of a constellation has none"
        );
        let mut set = Map::new();
        set.insert("name".into(), json!("The lived-in world"));
        let notes = [
            json!({"p": 62, "at": 0, "len": 4, "vel": 100}),
            json!({"p": 69, "at": 0, "len": 4, "vel": 100}),
        ];
        let made = clip_create(
            &path,
            &revision,
            0,
            None,
            4.0,
            Some(&set),
            &notes,
            Some("wiki:anchor:lived-in"),
        )
        .unwrap();
        assert_eq!(
            made["at"],
            json!({"slot": 1}),
            "the part's first empty slot"
        );
        assert_ne!(made["revision"], json!(revision));
        let clip = &made["clip"];
        assert_eq!(clip["kind"], "midi");
        assert_eq!(clip["name"], "The lived-in world");
        assert_eq!(clip["source"], "wiki:anchor:lived-in");
        assert_eq!(
            notes_of(clip),
            vec![(62, 0.0, 4.0, 100.0), (69, 0.0, 4.0, 100.0)]
        );
        assert_eq!(
            (clip["start"].as_f64(), clip["end"].as_f64()),
            (Some(0.0), Some(4.0))
        );
        assert_eq!(
            (clip["position"].as_f64(), clip["length"].as_f64()),
            (Some(0.0), Some(4.0))
        );
        assert_eq!(clip["loop"], true);
        assert_eq!(
            clip["follow"], false,
            "a new clip follows no action, whatever the clip it took its shape from"
        );
        assert_eq!(
            clip["scale"], false,
            "and has no mode of its own: it follows the set's mode in force"
        );
        assert_eq!(clip["groove"], Value::Null);
        assert_eq!(
            clip["colourIndex"].as_f64(),
            Some(26.0),
            "it wears its part's colour, as a new clip in Live does"
        );
        // Read back from the file: the clip and its source.
        let back = clip_json(&path, 0, ClipAt::Slot(1)).unwrap();
        assert_eq!(back["clip"]["source"], "wiki:anchor:lived-in");
        assert_eq!(back["clip"]["name"], "The lived-in world");
        assert_eq!(notes_of(&back["clip"]), notes_of(clip));
        // The clip it took its shape from stands as it was, made of nothing.
        let donor = clip_json(&path, 0, SLOT).unwrap();
        assert_eq!(donor["clip"]["name"], "E-Piano");
        assert_eq!(notes_of(&donor["clip"]).len(), 2);
        assert_eq!(donor["clip"]["source"], Value::Null);
        // An edit changes the clip, never its source.
        let mut rename = Map::new();
        rename.insert("name".into(), json!("Lived, again"));
        let edited = clip_write(
            &path,
            back["revision"].as_str().unwrap(),
            0,
            ClipAt::Slot(1),
            Some(&rename),
            None,
            None,
        )
        .unwrap();
        assert_eq!(edited["clip"]["source"], "wiki:anchor:lived-in");
        assert!(
            crate::sources::record_path(std::path::Path::new(&path)).exists(),
            "the source is kept in the DLW's record beside the set"
        );
    }

    #[test]
    fn a_clip_is_made_only_where_the_part_can_take_it_and_the_set_gives_its_shape() {
        let (_dir, path) = set_file();
        let standing = clip_json(&path, 0, SLOT).unwrap()["revision"]
            .as_str()
            .unwrap()
            .to_string();
        let none = Map::new();
        let notes = [json!({"p": 62, "at": 0, "len": 4})];
        assert!(clip_create(
            &path,
            "sha256:stale",
            0,
            None,
            4.0,
            Some(&none),
            &notes,
            None
        )
        .unwrap_err()
        .contains("changed since it was read"));
        assert!(
            clip_create(&path, &standing, 1, None, 4.0, Some(&none), &notes, None)
                .unwrap_err()
                .contains("MIDI part")
        );
        assert!(
            clip_create(&path, &standing, 0, Some(0), 4.0, Some(&none), &notes, None)
                .unwrap_err()
                .contains("already holds a clip")
        );
        assert!(
            clip_create(&path, &standing, 0, None, 0.0, Some(&none), &notes, None)
                .unwrap_err()
                .contains("length")
        );
        assert!(clip_create(
            &path,
            &standing,
            0,
            None,
            4.0,
            Some(&none),
            &notes,
            Some(" ")
        )
        .unwrap_err()
        .contains("constellation's ref"));
        assert_eq!(
            clip_json(&path, 0, SLOT).unwrap()["revision"],
            json!(standing),
            "a refusal writes nothing"
        );
        // Filled: no empty slot is left.
        let made = clip_create(&path, &standing, 0, None, 4.0, Some(&none), &notes, None).unwrap();
        assert_eq!(
            made["clip"]["source"],
            Value::Null,
            "a clip made of no constellation keeps none"
        );
        let full = clip_create(
            &path,
            made["revision"].as_str().unwrap(),
            0,
            None,
            4.0,
            Some(&none),
            &notes,
            None,
        )
        .unwrap_err();
        assert!(full.contains("no empty slot"), "{full}");
        // A set that holds no MIDI clip gives no shape to make one in.
        let bare = SET
            .replace(
                &SET[SET.find("<ClipSlot Id=\"0\">").unwrap()
                    ..SET.find("<ClipSlot Id=\"1\">").unwrap()],
                "<ClipSlot Id=\"0\"><ClipSlot><Value/></ClipSlot></ClipSlot>\n",
            )
            .replace(
                &SET[SET.find("<TakeLanes><TakeLanes>").unwrap()
                    ..SET.find("<DeviceChain>").unwrap()],
                "",
            );
        let (_bare_dir, bare_path) = set_file_of(&bare);
        let bare_revision = {
            let bytes = std::fs::read(&bare_path).unwrap();
            revision(&bytes)
        };
        let shapeless = clip_create(
            &bare_path,
            &bare_revision,
            0,
            None,
            4.0,
            Some(&none),
            &notes,
            None,
        )
        .unwrap_err();
        assert!(shapeless.contains("holds no MIDI clip"), "{shapeless}");
    }
}
