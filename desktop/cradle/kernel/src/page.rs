//! The page owner op (T-WORLDS §4, W2; manual §18.1 "The clip"): a Being, a Thing or a Flow is a page, kept as one HTML file
//! whose fields live in its `ql-doc` island (desktop/cradle/src/document/identity.ts QL_DOC; personal/page.mjs, flow/instance.ts).
//! The kernel reads a page and lists a world's pages through Central's file owner (files.rs), and writes one field of a page on the
//! revision it was read at: the island is read, the field set by its own rule, the page's counter moved by one, only what changed
//! written into the island as it stands (island.rs), and the file written back with that revision — through the source owner's
//! CAS for a page in a project's human ground, else through `central.files.write` — refused, overwriting nothing, when the file
//! moved since. Every write answers with a receipt: the field, the revision it stood on and the one it now stands on.
//!
//! The fields (manual §18.1 "The Clip panel", the Being/Thing ties and the Flow's World; the tools' notes and highlights):
//! title, colour, world, subject, kind (a Being: person or agent), office (C1–C4), sources, place, anchor, expression, layout,
//! tone, a Flow's view and container (dialogue, circle or inquiry), how the page opens (launch), and a note or a highlight
//! added or taken away. A Day is no page here: it is the set, and its die is turned through the Day's own owner (central.rs).
//!
//! A page plays when launched (manual §18.1): Launch allocates the NOW clearing tied to the page, one per page, so launching it
//! again rejoins it; Stop closes it. The lifecycle act carries the person's native authority (`CentralClient::for_person`) and
//! nothing else does.
use crate::files::{self, Location};
use crate::flow::CentralClient;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};

mod island;

const ISLAND_OPEN: &str = r#"<script type="application/json" id="ql-doc">"#;
const ISLAND_CLOSE: &str = "</script>";
/// How many files a world's listing reads at most (each is one owner read).
pub const LIST_LIMIT: usize = 200;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(tag = "operation", rename_all = "snake_case")]
pub enum Request {
    Read {
        location: Location,
    },
    /// A world's pages: the `.html` files of its folder, each read and placed by its island.
    List {
        path: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        limit: Option<usize>,
    },
    MutateField {
        location: Location,
        expected_revision: String,
        field: String,
        value: Value,
    },
    /// A page played (manual §18.1 "A page plays when launched"): the NOW clearing tied to the page is allocated, or rejoined
    /// when it already stands, and stands active.
    Launch {
        location: Location,
    },
    /// A playing page stopped: its NOW clearing is closed on the revision read.
    Stop {
        now_ref: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        project: Option<String>,
    },
}

impl Request {
    pub fn is_write(&self) -> bool {
        matches!(
            self,
            Request::MutateField { .. } | Request::Launch { .. } | Request::Stop { .. }
        )
    }
}

/// The page's form, by its island: a reference page by its family, a Flow by its entries.
pub fn form_of(island: &Value) -> &'static str {
    if island["profile"] == "oi.page/v1" {
        return match island["meta"]["family"].as_str() {
            Some("beings") => "being",
            Some("things") => "thing",
            _ => "page",
        };
    }
    if island["entries"].is_array() && island["meta"].is_object() {
        return "flow";
    }
    "unknown"
}

/// The island's text span in the page (start and end of its JSON), or None when the file carries none.
pub fn island_span(html: &str) -> Option<(usize, usize)> {
    let open = html.find(ISLAND_OPEN)? + ISLAND_OPEN.len();
    let close = html[open..].find(ISLAND_CLOSE)? + open;
    Some((open, close))
}

/// The island, read: the page's own serialiser escapes `</script` and `<!--`, which JSON reads back.
pub fn read_island(html: &str) -> Result<Value, String> {
    let (start, end) =
        island_span(html).ok_or("This file is no page: it carries no ql-doc island")?;
    serde_json::from_str(&island::unescape(&html[start..end]))
        .map_err(|error| format!("The page's island does not read as JSON: {error}"))
}

/// The page with `island` written into its island as the page's own save writes it (flow/instance.ts `embedDocument`, plural.ts
/// `spliceIsland`, #785): only what `island` changed from what the island reads as is written, and every other byte (key order,
/// spacing, number spellings, escapes, integers no 64-bit number holds) stays as written (island.rs, #793). What it writes has
/// `</script` and `<!--` escaped, so the island can never close itself or open a comment.
pub fn embed_island(html: &str, island: &Value) -> Result<String, String> {
    let (start, end) =
        island_span(html).ok_or("This file is no page: it carries no ql-doc island")?;
    let text = island::splice(&html[start..end], island)?;
    Ok(format!("{}{}{}", &html[..start], text, &html[end..]))
}

fn text(value: &Value, what: &str, max: usize) -> Result<String, String> {
    let words = value.as_str().map(str::trim).unwrap_or("");
    if words.is_empty() || words.chars().count() > max || words.chars().any(char::is_control) {
        return Err(format!("{what} is 1 to {max} characters of text"));
    }
    Ok(words.to_string())
}

fn optional_ref(value: &Value, what: &str) -> Result<Value, String> {
    match value {
        Value::Null => Ok(Value::Null),
        Value::String(reference) if !reference.trim().is_empty() && reference.len() <= 2048 => {
            Ok(json!(reference.trim()))
        }
        _ => Err(format!("{what} is a reference, or none")),
    }
}

/// A palette colour: one of the shell's tokens or a six-digit hex, or none.
fn colour(value: &Value) -> Result<Value, String> {
    match value {
        Value::Null => Ok(Value::Null),
        Value::String(colour) => {
            let token = colour
                .strip_prefix("var(--")
                .and_then(|rest| rest.strip_suffix(')'))
                .is_some_and(|name| {
                    (1..=40).contains(&name.len())
                        && name
                            .bytes()
                            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
                });
            let hex = colour.len() == 7
                && colour.starts_with('#')
                && colour[1..].bytes().all(|b| b.is_ascii_hexdigit());
            if token || hex {
                Ok(json!(colour))
            } else {
                Err("A page's colour is a palette colour".into())
            }
        }
        _ => Err("A page's colour is a palette colour".into()),
    }
}

fn object<'a>(island: &'a mut Value, key: &str) -> Result<&'a mut Map<String, Value>, String> {
    if !island[key].is_object() {
        island[key] = json!({});
    }
    island[key]
        .as_object_mut()
        .ok_or_else(|| format!("The page's {key} is not a record"))
}

fn list<'a>(island: &'a mut Value, key: &str) -> Result<&'a mut Vec<Value>, String> {
    if !island[key].is_array() {
        island[key] = json!([]);
    }
    island[key]
        .as_array_mut()
        .ok_or_else(|| format!("The page's {key} is not a list"))
}

/// When a write's new note stands and the id it takes: the clock and a fresh id (a test passes its own).
#[derive(Clone, Debug, PartialEq)]
pub struct Stamp {
    pub at: String,
    pub id: String,
}

impl Stamp {
    pub fn now() -> Result<Self, String> {
        let mut bytes = [0u8; 16];
        getrandom::fill(&mut bytes).map_err(|error| format!("Cannot mint a note's id: {error}"))?;
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        let hex: String = bytes.iter().map(|byte| format!("{byte:02x}")).collect();
        let id = format!(
            "{}-{}-{}-{}-{}",
            &hex[0..8],
            &hex[8..12],
            &hex[12..16],
            &hex[16..20],
            &hex[20..]
        );
        Ok(Stamp {
            at: crate::factory::now_rfc3339(),
            id,
        })
    }
}

/// Words made safe to stand in the page's HTML (a note's text, a passage looked for in an entry).
fn escape(words: &str) -> String {
    words
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

/// An entry's words without its formatting, as the template reads them (ql-flow.html `plain`).
fn plain(html: &str) -> String {
    let mut words = String::with_capacity(html.len());
    let mut in_tag = false;
    for c in html.chars() {
        match c {
            '<' => in_tag = true,
            '>' if in_tag => in_tag = false,
            _ if !in_tag => words.push(c),
            _ => {}
        }
    }
    words
        .replace("&nbsp;", " ")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&amp;", "&")
}

/// Where `needle` stands in `html` within one run of words (never across a tag), or None.
fn in_words(html: &str, needle: &str) -> Option<usize> {
    let mut from = 0;
    while let Some(found) = html[from..].find(needle) {
        let at = from + found;
        let opened = html[..at].rfind('<');
        let closed = html[..at].rfind('>');
        let inside_tag = matches!((opened, closed), (Some(open), Some(close)) if open > close)
            || (opened.is_some() && closed.is_none());
        if !inside_tag {
            return Some(at);
        }
        from = at + needle.len();
    }
    None
}

fn entry_at<'a>(island: &'a mut Value, value: &Value) -> Result<&'a mut Value, String> {
    let id = value
        .get("entry")
        .and_then(Value::as_str)
        .ok_or("Name the entry by its id")?;
    island["entries"]
        .as_array_mut()
        .and_then(|entries| entries.iter_mut().find(|entry| entry["id"] == json!(id)))
        .ok_or_else(|| format!("The Flow holds no entry {id}"))
}

fn passage(value: &Value) -> Result<String, String> {
    let words = value
        .get("passage")
        .and_then(Value::as_str)
        .map(str::trim)
        .unwrap_or("");
    if words.is_empty() || words.chars().count() > 240 {
        return Err("A passage is 1 to 240 characters of the entry's words".into());
    }
    Ok(words.to_string())
}

/// A note (the template's own: ql-flow.html `act('note')`): on an entry of a Flow, or on a Being's or Thing's page; on a passage
/// of its words or on the whole; during or after; F's or H's.
fn add_note(island: &mut Value, form: &str, value: &Value, stamp: &Stamp) -> Result<Value, String> {
    let anchor = match value.get("passage") {
        None | Some(Value::Null) => Value::Null,
        Some(_) => json!(passage(value)?),
    };
    let timing = match value
        .get("timing")
        .and_then(Value::as_str)
        .unwrap_or("during")
    {
        timing @ ("during" | "after") => timing.to_string(),
        _ => return Err("A note is made during or after".into()),
    };
    let author = match value.get("author").and_then(Value::as_str).unwrap_or("F") {
        author @ ("F" | "H") => author.to_string(),
        _ => return Err("A note is F's or H's".into()),
    };
    let words = value.get("text").and_then(Value::as_str).unwrap_or("");
    if words.chars().count() > 20_000 {
        return Err("A note is at most 20,000 characters".into());
    }
    let mut note = json!({"id": stamp.id, "anchor": anchor, "author": author, "timing": timing, "text": escape(words), "at": stamp.at, "replies": []});
    if form == "flow" {
        let entry = entry_at(island, value)?;
        if let Some(anchor) = note["anchor"].as_str() {
            if !plain(entry["html"].as_str().unwrap_or("")).contains(anchor) {
                return Err("The passage is not in that entry's words".into());
            }
        }
        note["entryId"] = entry["id"].clone();
    } else if let Some(part) = value.get("part").and_then(Value::as_str) {
        if !page_part_exists(island, part) {
            return Err(format!("The page has no part {part}"));
        }
        note["part"] = json!(part);
    }
    list(island, "notes")?.push(note.clone());
    Ok(note)
}

fn remove_note(island: &mut Value, value: &Value) -> Result<Value, String> {
    let id = value
        .get("id")
        .and_then(Value::as_str)
        .or_else(|| value.as_str())
        .ok_or("Name the note to take away by its id")?;
    let notes = list(island, "notes")?;
    let at = notes
        .iter()
        .position(|note| note["id"] == json!(id))
        .ok_or_else(|| format!("The page holds no note {id}"))?;
    Ok(notes.remove(at))
}

/// The highlight colours (manual §18.1 Highlight: yellow, green, blue, pink); yellow is the template's marker and is written bare.
const HIGHLIGHT_COLOURS: [&str; 4] = ["yellow", "green", "blue", "pink"];

fn highlight_colour(value: &Value) -> Result<&'static str, String> {
    let asked = value
        .get("colour")
        .and_then(Value::as_str)
        .unwrap_or("yellow");
    HIGHLIGHT_COLOURS
        .iter()
        .find(|colour| **colour == asked)
        .copied()
        .ok_or_else(|| "A highlight is yellow, green, blue or pink".into())
}

fn mark_open(colour: &str) -> String {
    if colour == "yellow" {
        "<mark>".into()
    } else {
        format!("<mark data-colour=\"{colour}\">")
    }
}

/// Every run of words in `html` wrapped in its own mark (the whole entry marked without crossing its formatting).
fn mark_every_run(html: &str, open: &str) -> String {
    let mut out = String::with_capacity(html.len() * 2);
    let mut run = String::new();
    let mut in_tag = false;
    let flush = |run: &mut String, out: &mut String| {
        if run.trim().is_empty() {
            out.push_str(run);
        } else {
            out.push_str(open);
            out.push_str(run);
            out.push_str("</mark>");
        }
        run.clear();
    };
    for c in html.chars() {
        match c {
            '<' if !in_tag => {
                flush(&mut run, &mut out);
                in_tag = true;
                out.push(c);
            }
            '>' if in_tag => {
                in_tag = false;
                out.push(c);
            }
            _ if in_tag => out.push(c),
            _ => run.push(c),
        }
    }
    flush(&mut run, &mut out);
    out
}

/// `html` with every mark taken away (its words kept).
fn unmark_all(html: &str) -> String {
    let mut out = String::with_capacity(html.len());
    let mut rest = html;
    while let Some(at) = rest.find("<mark") {
        out.push_str(&rest[..at]);
        let after = &rest[at..];
        let close = after.find('>').map(|i| i + 1).unwrap_or(after.len());
        rest = &after[close..];
    }
    out.push_str(rest);
    out.replace("</mark>", "")
}

/// A highlight on a Flow (the template's own: ql-flow.html `act('hl')`): the passage marked in the entry's words, or with no
/// passage the whole entry, in one of the four colours. An entry of H's that is marked counts as touched, as the template counts it.
/// Taken away: the passage's mark, or with no passage every mark in the entry.
fn highlight_entry(island: &mut Value, value: &Value, add: bool) -> Result<Value, String> {
    let words = match value.get("passage") {
        None | Some(Value::Null) => None,
        Some(_) => Some(passage(value)?),
    };
    let colour = highlight_colour(value)?;
    let entry = entry_at(island, value)?;
    let html = entry["html"].as_str().unwrap_or("").to_string();
    let next = match (&words, add) {
        (None, true) => mark_every_run(&unmark_all(&html), &mark_open(colour)),
        (None, false) => {
            if !html.contains("<mark") {
                return Err("That entry holds no highlight".into());
            }
            unmark_all(&html)
        }
        (Some(words), true) => {
            let escaped = escape(words);
            let at = in_words(&html, &escaped).ok_or("The passage is not one run of that entry's words (it may cross its formatting): highlight it on the page")?;
            format!(
                "{}{}{escaped}</mark>{}",
                &html[..at],
                mark_open(colour),
                &html[at + escaped.len()..]
            )
        }
        (Some(words), false) => {
            let escaped = escape(words);
            let found = HIGHLIGHT_COLOURS.iter().find_map(|colour| {
                let marked = format!("{}{escaped}</mark>", mark_open(colour));
                html.find(&marked).map(|at| (at, marked.len()))
            });
            let (at, len) = found.ok_or("That entry holds no highlight on the passage")?;
            format!("{}{escaped}{}", &html[..at], &html[at + len..])
        }
    };
    entry["html"] = json!(next);
    if add && entry["author"] == "H" {
        entry["touched"] = json!(true);
    }
    Ok(json!({"entry": entry["id"], "passage": words, "colour": colour, "marked": add}))
}

/// The parts of a Being's or Thing's page a highlight or a note may stand on: its title, subtitle, introduction and sections.
fn page_part_exists(island: &Value, part: &str) -> bool {
    ["title", "subtitle", "introduction"].contains(&part)
        || island["page"]["sections"]
            .as_array()
            .is_some_and(|sections| sections.iter().any(|section| section["id"] == json!(part)))
}

/// A highlight on a Being's or Thing's page: kept in the page's `highlights`, on a part of the page (and a passage of it, or the
/// whole part), in one of the four colours; the template draws it. Taken away by its id, or by the part (and passage) it stands on.
fn highlight_page(
    island: &mut Value,
    value: &Value,
    add: bool,
    stamp: &Stamp,
) -> Result<Value, String> {
    let part = value.get("part").and_then(Value::as_str).ok_or(
        "Name the part of the page by its id (title, subtitle, introduction or a section)",
    )?;
    if !page_part_exists(island, part) {
        return Err(format!("The page has no part {part}"));
    }
    let words = match value.get("passage") {
        None | Some(Value::Null) => Value::Null,
        Some(_) => json!(passage(value)?),
    };
    if add {
        let colour = highlight_colour(value)?;
        let mark = json!({"id": stamp.id, "part": part, "passage": words, "colour": colour, "at": stamp.at});
        list(island, "highlights")?.push(mark.clone());
        return Ok(mark);
    }
    let marks = list(island, "highlights")?;
    let at = marks
        .iter()
        .position(|mark| mark["part"] == json!(part) && mark["passage"] == words)
        .ok_or("That part of the page holds no such highlight")?;
    Ok(marks.remove(at))
}

/// How a page opens when it is launched (manual §18.1 "The Launch panel"): kept in the page's `meta.launch`.
fn launch_field(island: &mut Value, page: bool, value: &Value) -> Result<Value, String> {
    let asked = value
        .as_object()
        .ok_or("A page's launch is a record: opensAs, opensIn, seats")?;
    let ways: &[&str] = if page {
        &["page", "reading", "walk", "sky"]
    } else {
        &["dialogue", "flow", "journal"]
    };
    let mut kept = object(island, "meta")?
        .get("launch")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    for (key, chosen) in asked {
        match key.as_str() {
            "opensAs" => {
                let way = chosen
                    .as_str()
                    .filter(|way| ways.contains(way))
                    .ok_or_else(|| format!("This page opens as one of {}", ways.join(", ")))?;
                kept.insert(key.clone(), json!(way));
            }
            "opensIn" => {
                let place = chosen
                    .as_str()
                    .filter(|place| ["focused", "pane", "window"].contains(place))
                    .ok_or("A page opens in the focused pane, a new pane or its own window")?;
                kept.insert(key.clone(), json!(place));
            }
            "seats" if !page => {
                let on = chosen.as_bool().ok_or("Seats is on or off")?;
                kept.insert(key.clone(), json!(on));
            }
            other => return Err(format!("A page's launch keeps no {other}")),
        }
    }
    let kept = Value::Object(kept);
    object(island, "meta")?.insert("launch".into(), kept.clone());
    Ok(kept)
}

/// Set one field of a page's island by its rule; the page's own counter moves by one. Answers the field's value as it now stands.
pub fn apply_field(
    island: &mut Value,
    field: &str,
    value: &Value,
    stamp: &Stamp,
) -> Result<Value, String> {
    let form = form_of(island);
    if form == "unknown" {
        return Err(
            "This file is no page the shell writes: it is neither a reference page nor a Flow"
                .into(),
        );
    }
    let page = form != "flow";
    let set = match field {
        "title" => {
            let title = json!(text(value, "A page's title", 160)?);
            object(island, "meta")?.insert("title".into(), title.clone());
            title
        }
        "colour" => {
            let chosen = colour(value)?;
            object(island, "meta")?.insert("colour".into(), chosen.clone());
            chosen
        }
        "world" => {
            let world = optional_ref(value, "A page's world")?;
            if page {
                object(island, "bindings")?.insert("worldRef".into(), world.clone());
            } else {
                object(island, "meta")?.insert("world".into(), world.clone());
            }
            world
        }
        "subject" | "place" | "expression" if page => {
            let key = match field {
                "subject" => "subjectRef",
                "place" => "placeRef",
                _ => "expressionRef",
            };
            let reference = optional_ref(value, &format!("A page's {field}"))?;
            object(island, "bindings")?.insert(key.into(), reference.clone());
            reference
        }
        "kind" if form == "being" => {
            let kind = match value.as_str() {
                Some("person") | Some("agent") => json!(value),
                _ => return Err("A Being is a person or an agent".into()),
            };
            object(island, "bindings")?.insert("kind".into(), kind.clone());
            kind
        }
        "office" if page => {
            let offices = value
                .as_array()
                .filter(|offices| !offices.is_empty())
                .ok_or("A page takes up one or more of the offices C1 to C4")?;
            let mut seen = std::collections::BTreeSet::new();
            for office in offices {
                let name = office
                    .as_str()
                    .filter(|name| ["C1", "C2", "C3", "C4"].contains(name))
                    .ok_or("A page's offices are C1 to C4")?;
                if !seen.insert(name) {
                    return Err("A page names each office once".into());
                }
            }
            object(island, "bindings")?.insert("categories".into(), value.clone());
            value.clone()
        }
        "sources" if page => {
            let sources = value
                .as_array()
                .ok_or("A page's sources are a list, each at its revision")?;
            for source in sources {
                let ok = source["ref"].as_str().is_some_and(|r| !r.is_empty())
                    && source["revision"].as_str().is_some_and(|r| !r.is_empty());
                if !ok {
                    return Err("Each source names its ref and the revision it is read at".into());
                }
            }
            object(island, "bindings")?.insert("sources".into(), value.clone());
            value.clone()
        }
        "anchor" if page => {
            let anchor = match value {
                Value::Null => Value::Null,
                Value::Object(anchor) => {
                    let lat = anchor
                        .get("lat")
                        .and_then(Value::as_f64)
                        .filter(|lat| (-90.0..=90.0).contains(lat));
                    let lon = anchor
                        .get("lon")
                        .and_then(Value::as_f64)
                        .filter(|lon| (-180.0..=180.0).contains(lon));
                    if lat.is_none() || lon.is_none() {
                        return Err(
                            "An anchor is a real place on Earth: its latitude and longitude".into(),
                        );
                    }
                    value.clone()
                }
                _ => return Err("An anchor is a real place on Earth, or none".into()),
            };
            object(island, "bindings")?.insert("anchor".into(), anchor.clone());
            anchor
        }
        "layout" | "tone" if page => {
            let allowed: &[&str] = if field == "layout" {
                &["portrait", "editorial"]
            } else {
                &["paper", "ink"]
            };
            let chosen = value
                .as_str()
                .filter(|chosen| allowed.contains(chosen))
                .ok_or_else(|| format!("A page's {field} is one of {}", allowed.join(", ")))?;
            object(island, "appearance")?.insert(field.into(), json!(chosen));
            json!(chosen)
        }
        "container" if !page => {
            let meta = object(island, "meta")?;
            match value.as_str() {
                None | Some("none") if value.is_null() || value == "none" => {
                    meta.remove("container");
                    Value::Null
                }
                Some(chosen @ ("dialogue" | "circle" | "inquiry")) => {
                    meta.insert("container".into(), json!(chosen));
                    json!(chosen)
                }
                _ => {
                    return Err(
                        "A Flow's container is a dialogue, a circle or an inquiry, or none".into(),
                    )
                }
            }
        }
        "launch" => launch_field(island, page, value)?,
        "view" if !page => {
            let chosen = value
                .as_str()
                .filter(|chosen| ["flow", "dialogue", "journal"].contains(chosen))
                .ok_or("A Flow is shown as a flow, a dialogue or a journal")?;
            object(island, "meta")?.insert("view".into(), json!(chosen));
            json!(chosen)
        }
        // A journey's state as QL returned it (nara_journey.rs; T-WORLDS W4): kept whole in the Flow's meta, never edited here.
        "journey" if !page => {
            if !value.is_object() {
                return Err("A Flow's journey is a record: the state QL returned".into());
            }
            object(island, "meta")?.insert("journey".into(), value.clone());
            value.clone()
        }
        "note.add" => add_note(island, form, value, stamp)?,
        "note.remove" => remove_note(island, value)?,
        "highlight.add" | "highlight.remove" if !page => {
            highlight_entry(island, value, field == "highlight.add")?
        }
        "highlight.add" | "highlight.remove" => {
            highlight_page(island, value, field == "highlight.add", stamp)?
        }
        other
            if page
                || [
                    "subject",
                    "place",
                    "expression",
                    "office",
                    "sources",
                    "anchor",
                    "layout",
                    "tone",
                    "kind",
                ]
                .contains(&other) =>
        {
            return Err(format!(
                "A {form} has no field {other} the page owner writes"
            ));
        }
        other => return Err(format!("A Flow has no field {other} the page owner writes")),
    };
    let meta = object(island, "meta")?;
    // A count in any spelling JSON reads as one: a hand-written `3.0` is 3, as the page and host read it (#797). The kernel
    // keeps numbers as spelt (`arbitrary_precision`), so `as_u64` alone reads `3.0` as no count and starts the count again.
    let count = |n: &serde_json::Number| {
        n.as_u64().or_else(|| {
            n.as_f64()
                .filter(|f| f.fract() == 0.0 && (0.0..=9_007_199_254_740_992.0).contains(f))
                .map(|f| f as u64)
        })
    };
    let counter = match meta.get("revision") {
        Some(Value::Number(n)) => count(n).unwrap_or(0),
        _ => 0,
    } + 1;
    meta.insert("revision".into(), json!(counter));
    Ok(set)
}

/// One page, read: its form, title and island, on the revision its owner reports.
pub fn read(client: &CentralClient, location: &Location) -> Result<Value, String> {
    let reading = files::read(client, location)?;
    let island = read_island(&reading.content)?;
    Ok(
        json!({"schema": "oi.page-reading/v1", "location": location, "revision": reading.revision, "form": form_of(&island),
        "title": island["meta"]["title"], "island": island}),
    )
}

/// A world's pages: each `.html` file of its folder read and placed by its island; a file that is no page is named, not read as one.
pub fn list_pages(
    client: &CentralClient,
    path: &str,
    limit: Option<usize>,
) -> Result<Value, String> {
    let directory = files::list(client, path)?;
    let bound = limit.unwrap_or(LIST_LIMIT).min(LIST_LIMIT);
    let mut pages = Vec::new();
    let mut not_pages = Vec::new();
    let candidates: Vec<_> = directory
        .entries
        .iter()
        .filter(|entry| {
            entry.kind == "file" && entry.name.ends_with(".html") && entry.retrieval_allowed
        })
        .collect();
    let taken: Vec<_> = candidates.iter().take(bound).collect();
    let locations: Vec<Location> = taken.iter().map(|entry| entry.location.clone()).collect();
    for (entry, reading) in taken.into_iter().zip(files::read_many(client, &locations)) {
        match reading.and_then(|reading| read_island(&reading.content).map(|island| (reading, island))) {
            Ok((reading, island)) if form_of(&island) != "unknown" => {
                let mut row = json!({"location": entry.location, "name": entry.name,
                    "form": form_of(&island), "title": island["meta"]["title"], "revision": reading.revision,
                    "world": if island["profile"] == "oi.page/v1" { island["bindings"]["worldRef"].clone() } else { island["meta"]["world"].clone() }});
                // A Flow's browser row draws its title, its agents and its revision. They are in the island this reading already holds, so
                // the listing carries them (the shell parses them with rowWords.ts `flowReadingOf`) and the browser reads each Flow once,
                // to list it. A participant is cut to the three keys that parser reads.
                if form_of(&island) == "flow" {
                    let participants: Vec<Value> = island["meta"]["participants"]
                        .as_array()
                        .map(|list| {
                            list.iter()
                                .map(|participant| json!({"kind": participant["kind"], "name": participant["name"], "initial": participant["initial"]}))
                                .collect()
                        })
                        .unwrap_or_default();
                    row["flow"] = json!({"title": island["meta"]["title"], "revision": island["meta"]["revision"], "participants": participants});
                }
                pages.push(row);
            }
            Ok(_) => not_pages.push(json!({"name": entry.name, "why": "its island is neither a reference page nor a Flow"})),
            Err(why) => not_pages.push(json!({"name": entry.name, "why": why})),
        }
    }
    Ok(
        json!({"schema": "oi.page-list/v1", "path": directory.location.path, "pages": pages, "not_pages": not_pages,
        "more": candidates.len() > bound}),
    )
}

/// Write one field on the revision read: the owner refuses, overwriting nothing, when the file moved since. A page in a project's
/// human ground is a participating source and is written through the source owner's own CAS (`projectcentral.source.write`, as
/// document/hostSave.ts writes one); any other page through the file owner (`central.files.write`). Either way the answer names
/// the file revision the page now stands on, so the next write is made on it.
pub fn mutate_field(
    client: &CentralClient,
    location: &Location,
    expected_revision: &str,
    field: &str,
    value: &Value,
) -> Result<Value, String> {
    let reading = files::read(client, location)?;
    if reading.revision != expected_revision {
        return Err(format!("The page moved since it was read (the owner holds {}): nothing was written. Read it again and write on that revision.", reading.revision));
    }
    let mut island = read_island(&reading.content)?;
    let set = apply_field(&mut island, field, value, &Stamp::now()?)?;
    let content = embed_island(&reading.content, &island)?;
    if let Some(source) = &reading.source {
        let project = reading
            .project
            .as_ref()
            .map(|project| project.name.as_str());
        let owner = client
            .source_read(project, &source.source_ref)
            .map_err(|error| error.to_string())?;
        if owner.content != reading.content {
            return Err("The source owner's page differs from the file read: nothing was written. Read it again.".into());
        }
        let receipt = client
            .source_write(
                project,
                &source.source_ref,
                &owner.revision.revision,
                &content,
                "oi-desktop-user",
                "human",
            )
            .map_err(|error| error.to_string())?;
        let now = files::read(client, location)?;
        let outcome = if receipt.changed {
            "written"
        } else {
            "unchanged"
        };
        return Ok(
            json!({"schema": "oi.page-mutation/v1", "location": location, "field": field, "value": set,
            "before_revision": expected_revision, "revision": now.revision, "outcome": outcome, "receipt": receipt}),
        );
    }
    let written = files::operate(
        client,
        location,
        &files::Request::Write {
            expected_revision: expected_revision.to_string(),
            content,
        },
    )?;
    if written["outcome"] == "conflict" {
        return Err("The page moved while it was written (the owner refused the revision): nothing was overwritten. Read it again.".into());
    }
    Ok(
        json!({"schema": "oi.page-mutation/v1", "location": location, "field": field, "value": set,
        "before_revision": expected_revision, "revision": written["revision"], "outcome": written["outcome"],
        "receipt": written}),
    )
}

/// The task a page's moment is allocated under: one per page, so launching it again rejoins the same clearing.
pub fn page_task(location: &Location) -> String {
    format!("oi:page:{}", location.ref_id)
}

/// The purpose a page's clearing carries. It stays the same for the page's life (the allocator refuses a second purpose
/// for one task), so it names the page by its ref, not by its title.
pub fn page_purpose(location: &Location) -> String {
    format!("A page is open: {}", location.path)
}

fn policy_revision(client: &CentralClient, project: Option<&str>) -> Result<String, String> {
    let policy = client
        .run("central.work.policy", json!({ "project": project }))
        .map_err(|error| error.to_string())?;
    policy["revision"]
        .as_str()
        .map(str::to_owned)
        .ok_or_else(|| "Central's work policy names no revision".into())
}

/// Launch: the page is read (its project scopes the clearing), the clearing allocated (idempotent per page) and, when it
/// stood quiescent or closed, made active again on the revision read. `person` carries the host's native authority for the
/// lifecycle transition: the person pressed Launch.
pub fn launch(
    client: &CentralClient,
    person: &CentralClient,
    location: &Location,
) -> Result<Value, String> {
    let reading = files::read(client, location)?;
    let island = read_island(&reading.content)?;
    let form = form_of(&island);
    if form == "unknown" {
        return Err("This file is no page: only a Being, a Thing or a Flow plays".into());
    }
    let project = reading.project.as_ref().map(|project| project.name.clone());
    let policy = policy_revision(client, project.as_deref())?;
    let allocated = client
        .run(
            "central.now.allocate",
            json!({"project": project, "task_ref": page_task(location), "purpose": page_purpose(location),
                "expected_policy_revision": policy, "source_refs": [location.ref_id]}),
        )
        .map_err(|error| error.to_string())?;
    let now_ref = allocated["now_ref"]
        .as_str()
        .or_else(|| allocated["now"]["now_ref"].as_str())
        .ok_or("Central allocated no NOW for the page")?
        .to_string();
    let lifecycle = allocated["lifecycle"]
        .as_str()
        .or_else(|| allocated["now"]["lifecycle"].as_str())
        .unwrap_or("active");
    let rejoined = if lifecycle != "active" {
        let now = client
            .run(
                "central.now.read",
                json!({"project": project, "now_ref": now_ref}),
            )
            .map_err(|error| error.to_string())?;
        let revision = now["revision"]["revision"]
            .as_str()
            .ok_or("Central's NOW reading names no revision")?;
        Some(
            person
                .run(
                    "central.now.lifecycle",
                    json!({"project": project, "now_ref": now_ref, "expected_revision": revision,
                        "expected_policy_revision": policy, "lifecycle": "active"}),
                )
                .map_err(|error| error.to_string())?,
        )
    } else {
        None
    };
    Ok(
        json!({"schema": "oi.page-launch/v1", "location": location, "form": form, "title": island["meta"]["title"],
        "now_ref": now_ref, "allocated": allocated, "reopened": rejoined}),
    )
}

/// Stop: the page's clearing closed on the revision read, with the host's native authority (the person pressed Stop).
pub fn stop(
    client: &CentralClient,
    person: &CentralClient,
    now_ref: &str,
    project: Option<&str>,
) -> Result<Value, String> {
    let now = client
        .run(
            "central.now.read",
            json!({"project": project, "now_ref": now_ref}),
        )
        .map_err(|error| error.to_string())?;
    if now["lifecycle"] == "closed" {
        return Ok(
            json!({"schema": "oi.page-stop/v1", "now_ref": now_ref, "outcome": "unchanged"}),
        );
    }
    let revision = now["revision"]["revision"]
        .as_str()
        .ok_or("Central's NOW reading names no revision")?;
    let policy = policy_revision(client, project)?;
    let closed = person
        .run(
            "central.now.lifecycle",
            json!({"project": project, "now_ref": now_ref, "expected_revision": revision,
                "expected_policy_revision": policy, "lifecycle": "closed"}),
        )
        .map_err(|error| error.to_string())?;
    Ok(
        json!({"schema": "oi.page-stop/v1", "now_ref": now_ref, "outcome": "closed", "receipt": closed}),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn page(island: Value) -> String {
        format!(
            "<!doctype html><title>t</title>{ISLAND_OPEN}{}{ISLAND_CLOSE}<p>body</p>",
            serde_json::to_string(&island).unwrap()
        )
    }
    fn being() -> Value {
        json!({"profile": "oi.page/v1", "meta": {"title": "", "revision": 0, "family": "beings"}, "bindings": {"worldRef": null, "categories": ["C2"], "sources": []},
            "appearance": {"layout": "portrait", "tone": "paper"}, "page": {}, "notes": [], "extensions": {}})
    }
    fn flow() -> Value {
        json!({"meta": {"title": "Untitled exchange", "revision": 3, "view": "dialogue"}, "entries": [], "notes": []})
    }

    #[test]
    fn a_page_s_island_reads_and_embeds_back_with_its_escapes() {
        let mut island = being();
        island["page"]["introduction"] = json!("a </script> and a <!-- in the words");
        let html = embed_island(&page(json!({})), &island).unwrap();
        assert!(
            html.contains(r"<\/script>") && html.contains(r"<\u0021--") && !html.contains("a <!--"),
            "{html}"
        );
        assert_eq!(read_island(&html).unwrap(), island);
        assert!(
            html.ends_with("<p>body</p>"),
            "the page around the island stays"
        );
        assert!(read_island("<html></html>")
            .unwrap_err()
            .contains("no ql-doc island"));
    }

    /// A hand-written island (plural-flow.test.mjs, the spliceIsland cases of #785): spacing, number spellings, an escape, a
    /// duplicate key, an integer-like key and integers no 64-bit number holds.
    const WRITTEN: &str = concat!(
        r#"{ "meta": {"revision": 1.0, "2": "integer-like", "big": 18446744073709551617, "view": "dialogue", "view": "flow"},"#,
        "\n",
        r#"  "entries": [ {"id": "a", "html": "<p>one<\/p>", "n": 1e2}, {"id": "b", "html": "x"} ,{"id": "c", "html": "y", "t": 9007199254740993} ],"#,
        "\n",
        r#"  "notes": [ 1, 2.50, 3 ], "x-kept": {"z": 1, "a": [true, null]} }"#
    );

    fn page_of(island: &str) -> String {
        format!("<!doctype html><title>t</title>{ISLAND_OPEN}{island}{ISLAND_CLOSE}<p>body</p>")
    }

    #[test]
    fn a_write_that_changes_nothing_writes_the_island_back_byte_for_byte() {
        let html = page_of(WRITTEN);
        assert_eq!(
            embed_island(&html, &read_island(&html).unwrap()).unwrap(),
            html
        );
    }

    #[test]
    fn a_write_replaces_only_the_values_it_changed_where_they_stand() {
        let html = page_of(WRITTEN);
        let mut island = read_island(&html).unwrap();
        island["meta"]["revision"] = json!(2);
        island["meta"]["view"] = json!("journal");
        island["entries"][1]["html"] = json!("</script></SCRIPT><!--");
        island["notes"][1] = json!(4);
        let written = embed_island(&html, &island).unwrap();
        assert_eq!(
            written,
            page_of(
                &WRITTEN
                    .replace(r#""revision": 1.0"#, r#""revision": 2"#)
                    .replace(r#""view": "flow""#, r#""view": "journal""#)
                    .replace(
                        r#""html": "x""#,
                        r#""html": "<\/script><\/SCRIPT><\u0021--""#
                    )
                    .replace("2.50", "4")
            )
        );
        let (start, end) = island_span(&written).unwrap();
        let text = written[start..end].to_ascii_lowercase();
        assert!(
            !text.contains("</script") && !text.contains("<!--"),
            "the island can neither close itself nor open a comment: {text}"
        );
        assert_eq!(
            read_island(&written).unwrap(),
            island,
            "an island-closing tag in any case is escaped and reads back as written"
        );
    }

    #[test]
    fn a_write_removes_what_it_removed_and_adds_what_it_added_keeping_the_bytes_of_what_stayed() {
        let html = page_of(WRITTEN);
        let mut island = read_island(&html).unwrap();
        island["meta"].as_object_mut().unwrap().remove("big");
        island["meta"]["current"] = json!("c");
        island.as_object_mut().unwrap().remove("x-kept");
        let entries = island["entries"].as_array_mut().unwrap();
        entries.remove(1);
        entries[0]["html"] = json!("<p>won</p>");
        entries.insert(0, json!({"id": "o", "html": "w"}));
        entries.push(json!({"id": "d", "html": "z"}));
        // What the write adds is the kernel's own, written as its serialiser writes it; what stayed keeps its bytes.
        assert_eq!(
            embed_island(&html, &island).unwrap(),
            page_of(concat!(
                r#"{ "meta": {"revision": 1.0, "2": "integer-like", "view": "dialogue", "view": "flow","current":"c"},"#,
                "\n",
                r#"  "entries": [ {"html":"w","id":"o"},{"id": "a", "html": "<p>won</p>", "n": 1e2} ,{"id": "c", "html": "y", "t": 9007199254740993},{"html":"z","id":"d"} ],"#,
                "\n",
                r#"  "notes": [ 1, 2.50, 3 ] }"#
            ))
        );
    }

    #[test]
    fn the_form_is_read_from_the_island() {
        assert_eq!(form_of(&being()), "being");
        let mut thing = being();
        thing["meta"]["family"] = json!("things");
        assert_eq!(form_of(&thing), "thing");
        assert_eq!(form_of(&flow()), "flow");
        assert_eq!(form_of(&json!({"die": {}})), "unknown");
    }

    fn stamp() -> Stamp {
        Stamp {
            at: "2026-10-18T12:00:00Z".into(),
            id: "n1".into(),
        }
    }

    #[test]
    fn each_field_is_set_by_its_rule_and_moves_the_page_s_counter() {
        let mut island = being();
        let s = stamp();
        assert_eq!(
            apply_field(&mut island, "title", &json!("  Hildegard "), &s).unwrap(),
            json!("Hildegard")
        );
        assert_eq!(island["meta"]["revision"], json!(1));
        apply_field(&mut island, "colour", &json!("var(--w-satya)"), &s).unwrap();
        apply_field(&mut island, "world", &json!("central:wiki:project:O-I"), &s).unwrap();
        apply_field(&mut island, "kind", &json!("agent"), &s).unwrap();
        apply_field(&mut island, "office", &json!(["C1", "C3"]), &s).unwrap();
        apply_field(
            &mut island,
            "anchor",
            &json!({"lat": 51.5, "lon": -0.12, "label": "London"}),
            &s,
        )
        .unwrap();
        apply_field(&mut island, "layout", &json!("editorial"), &s).unwrap();
        assert_eq!(
            island["bindings"]["worldRef"],
            json!("central:wiki:project:O-I")
        );
        assert_eq!(island["bindings"]["kind"], json!("agent"));
        assert_eq!(island["bindings"]["categories"], json!(["C1", "C3"]));
        assert_eq!(island["appearance"]["layout"], json!("editorial"));
        assert_eq!(island["meta"]["revision"], json!(7));
        let mut exchange = flow();
        apply_field(
            &mut exchange,
            "world",
            &json!("central:wiki:project:O-I"),
            &s,
        )
        .unwrap();
        apply_field(&mut exchange, "container", &json!("circle"), &s).unwrap();
        apply_field(&mut exchange, "view", &json!("journal"), &s).unwrap();
        assert_eq!(exchange["meta"]["world"], json!("central:wiki:project:O-I"));
        assert_eq!(exchange["meta"]["view"], json!("journal"));
        assert_eq!(exchange["meta"]["revision"], json!(6));
    }

    #[test]
    fn a_value_out_of_its_rule_is_refused_in_words_and_changes_nothing() {
        let mut island = being();
        let s = stamp();
        for (field, value, said) in [
            ("title", json!(""), "1 to 160"),
            ("colour", json!("red"), "palette colour"),
            ("office", json!([]), "C1 to C4"),
            ("office", json!(["C2", "C2"]), "each office once"),
            ("kind", json!("cat"), "person or an agent"),
            (
                "anchor",
                json!({"lat": 120, "lon": 0}),
                "latitude and longitude",
            ),
            ("tone", json!("grey"), "paper, ink"),
            ("sources", json!([{"ref": "x"}]), "revision"),
            (
                "highlight.add",
                json!({"part": "section-9", "passage": "x"}),
                "no part section-9",
            ),
            (
                "launch",
                json!({"opensAs": "dialogue"}),
                "page, reading, walk, sky",
            ),
            ("bpm", json!(1), "no field bpm"),
        ] {
            let error = apply_field(&mut island, field, &value, &s).unwrap_err();
            assert!(error.contains(said), "{field}: {error}");
        }
        assert_eq!(island, being(), "nothing changed");
        let mut exchange = flow();
        assert!(apply_field(&mut exchange, "kind", &json!("agent"), &s)
            .unwrap_err()
            .contains("no field kind"));
        assert!(apply_field(&mut exchange, "container", &json!("panel"), &s)
            .unwrap_err()
            .contains("dialogue, a circle or an inquiry"));
    }

    #[test]
    fn a_note_is_the_template_s_own_on_an_entry_or_its_passage() {
        let mut exchange = flow();
        exchange["entries"] = json!([{"id": "e1", "author": "H", "html": "<p>Which <b>automation</b> carries the bee?</p>"}]);
        let note = apply_field(
            &mut exchange,
            "note.add",
            &json!({"entry": "e1", "passage": "automation carries", "text": "a <b>?"}),
            &stamp(),
        )
        .unwrap();
        assert_eq!(
            note,
            json!({"id": "n1", "anchor": "automation carries", "author": "F", "timing": "during", "text": "a &lt;b&gt;?",
            "at": "2026-10-18T12:00:00Z", "replies": [], "entryId": "e1"})
        );
        assert!(apply_field(
            &mut exchange,
            "note.add",
            &json!({"entry": "e1", "passage": "the river"}),
            &stamp()
        )
        .unwrap_err()
        .contains("not in that entry"));
        assert!(
            apply_field(&mut exchange, "note.add", &json!({"entry": "e9"}), &stamp())
                .unwrap_err()
                .contains("no entry e9")
        );
        assert!(apply_field(
            &mut exchange,
            "note.add",
            &json!({"entry": "e1", "timing": "before"}),
            &stamp()
        )
        .unwrap_err()
        .contains("during or after"));
        apply_field(&mut exchange, "note.remove", &json!({"id": "n1"}), &stamp()).unwrap();
        assert_eq!(exchange["notes"], json!([]));
        assert!(
            apply_field(&mut exchange, "note.remove", &json!("n9"), &stamp())
                .unwrap_err()
                .contains("no note n9")
        );
        let mut page = being();
        let on_page = apply_field(
            &mut page,
            "note.add",
            &json!({"text": "on the whole page"}),
            &stamp(),
        )
        .unwrap();
        assert_eq!(on_page["anchor"], Value::Null);
        assert!(on_page.get("entryId").is_none());
    }

    #[test]
    fn a_highlight_marks_one_run_of_an_entry_s_words_and_is_taken_away_by_it() {
        let mut exchange = flow();
        exchange["entries"] = json!([{"id": "e1", "author": "H", "html": "<p class=\"a\">A &amp; B, then <i>c</i></p>"}]);
        apply_field(
            &mut exchange,
            "highlight.add",
            &json!({"entry": "e1", "passage": "A & B"}),
            &stamp(),
        )
        .unwrap();
        assert_eq!(
            exchange["entries"][0]["html"],
            json!("<p class=\"a\"><mark>A &amp; B</mark>, then <i>c</i></p>")
        );
        assert_eq!(exchange["entries"][0]["touched"], json!(true));
        assert!(apply_field(
            &mut exchange,
            "highlight.add",
            &json!({"entry": "e1", "passage": "then c"}),
            &stamp()
        )
        .unwrap_err()
        .contains("one run"));
        assert!(
            apply_field(
                &mut exchange,
                "highlight.add",
                &json!({"entry": "e1", "passage": "class"}),
                &stamp()
            )
            .unwrap_err()
            .contains("one run"),
            "never inside a tag"
        );
        apply_field(
            &mut exchange,
            "highlight.remove",
            &json!({"entry": "e1", "passage": "A & B"}),
            &stamp(),
        )
        .unwrap();
        assert_eq!(
            exchange["entries"][0]["html"],
            json!("<p class=\"a\">A &amp; B, then <i>c</i></p>")
        );
        assert!(apply_field(
            &mut exchange,
            "highlight.remove",
            &json!({"entry": "e1", "passage": "then"}),
            &stamp()
        )
        .unwrap_err()
        .contains("no highlight"));
    }

    #[test]
    fn a_whole_entry_is_marked_run_by_run_in_its_colour_and_unmarked_whole() {
        let mut exchange = flow();
        exchange["entries"] =
            json!([{"id": "e1", "author": "F", "html": "<p>Which <b>automation</b> carries</p>"}]);
        apply_field(
            &mut exchange,
            "highlight.add",
            &json!({"entry": "e1", "colour": "green"}),
            &stamp(),
        )
        .unwrap();
        assert_eq!(
            exchange["entries"][0]["html"],
            json!("<p><mark data-colour=\"green\">Which </mark><b><mark data-colour=\"green\">automation</mark></b><mark data-colour=\"green\"> carries</mark></p>")
        );
        assert_eq!(
            plain(exchange["entries"][0]["html"].as_str().unwrap()),
            "Which automation carries"
        );
        apply_field(
            &mut exchange,
            "highlight.remove",
            &json!({"entry": "e1"}),
            &stamp(),
        )
        .unwrap();
        assert_eq!(
            exchange["entries"][0]["html"],
            json!("<p>Which <b>automation</b> carries</p>")
        );
        assert!(apply_field(
            &mut exchange,
            "highlight.remove",
            &json!({"entry": "e1"}),
            &stamp()
        )
        .unwrap_err()
        .contains("no highlight"));
        apply_field(
            &mut exchange,
            "highlight.add",
            &json!({"entry": "e1", "passage": "carries", "colour": "pink"}),
            &stamp(),
        )
        .unwrap();
        apply_field(
            &mut exchange,
            "highlight.remove",
            &json!({"entry": "e1", "passage": "carries"}),
            &stamp(),
        )
        .unwrap();
        assert_eq!(
            exchange["entries"][0]["html"],
            json!("<p>Which <b>automation</b> carries</p>")
        );
    }

    #[test]
    fn a_page_keeps_its_highlights_and_notes_on_its_parts_and_its_launch() {
        let mut island = being();
        island["page"]["sections"] =
            json!([{"id": "section-1", "heading": "Life", "text": "Born 1098."}]);
        let mark = apply_field(
            &mut island,
            "highlight.add",
            &json!({"part": "section-1", "passage": "1098", "colour": "blue"}),
            &stamp(),
        )
        .unwrap();
        assert_eq!(mark["colour"], "blue");
        assert_eq!(island["highlights"][0]["part"], "section-1");
        apply_field(
            &mut island,
            "highlight.remove",
            &json!({"part": "section-1", "passage": "1098"}),
            &stamp(),
        )
        .unwrap();
        assert_eq!(island["highlights"], json!([]));
        let note = apply_field(
            &mut island,
            "note.add",
            &json!({"part": "introduction", "text": "check"}),
            &stamp(),
        )
        .unwrap();
        assert_eq!(note["part"], "introduction");
        assert_eq!(
            apply_field(
                &mut island,
                "launch",
                &json!({"opensAs": "reading"}),
                &stamp()
            )
            .unwrap(),
            json!({"opensAs": "reading"})
        );
        apply_field(&mut island, "launch", &json!({"opensIn": "pane"}), &stamp()).unwrap();
        assert_eq!(
            island["meta"]["launch"],
            json!({"opensAs": "reading", "opensIn": "pane"})
        );
        assert!(
            apply_field(&mut island, "launch", &json!({"seats": true}), &stamp())
                .unwrap_err()
                .contains("no seats")
        );
        let mut exchange = flow();
        apply_field(&mut exchange, "container", &json!("inquiry"), &stamp()).unwrap();
        assert_eq!(
            apply_field(&mut exchange, "container", &json!("none"), &stamp()).unwrap(),
            Value::Null
        );
        assert!(exchange["meta"].get("container").is_none());
    }

    #[test]
    fn a_flow_keeps_its_journey_whole_and_refuses_a_non_record() {
        let mut exchange = flow();
        let journey = json!({"schema": "ql.nara-oracle-journey/v1", "journey_ref": "journey:d", "revision": 2,
            "shuffle": {"order": [3, 1, 2]}, "placements": []});
        assert_eq!(
            apply_field(&mut exchange, "journey", &journey, &stamp()).unwrap(),
            journey
        );
        assert_eq!(exchange["meta"]["journey"], journey, "kept whole");
        assert_eq!(exchange["meta"]["revision"], json!(4));
        for wrong in [json!("journey:d"), json!([1]), Value::Null] {
            assert!(apply_field(&mut exchange, "journey", &wrong, &stamp())
                .unwrap_err()
                .contains("is a record"));
        }
        assert_eq!(
            exchange["meta"]["journey"], journey,
            "a refusal changes nothing"
        );
        let mut island = being();
        assert!(apply_field(&mut island, "journey", &journey, &stamp())
            .unwrap_err()
            .contains("no field journey"));
    }

    /// A Central stand-in holding real files in a temporary folder: `central.files.read`/`write` with the owner's CAS, and
    /// `projectcentral.source.read`/`write` for the one page under `Work/P/ProjectCentral/user`.
    #[cfg(unix)]
    const STUB_OWNER: &str = r#"#!/usr/bin/env python3
import json, sys, os, hashlib
action = sys.argv[4]
payload = json.loads(sys.argv[5]) if len(sys.argv) > 5 else {}
home = os.environ["PAGE_STUB_HOME"]
def ok(data): print(json.dumps({"ok": True, "data": data}))
def rev(text): return "r-" + hashlib.sha256(text.encode()).hexdigest()[:12]
def loc(path): return {"schema": "central.path-ref/v1", "ref": "ref:" + path, "root": "R", "path": path}
def source(path): return {"ref": "central:source:project:P:" + path, "path": path, "exists": True} if "ProjectCentral" in path else None
with open(os.path.join(home, "log"), "a") as log: log.write(action + (" person" if os.environ.get("CENTRAL_NATIVE_TOKEN") else "") + "\n")
def refuse(message): print(json.dumps({"ok": False, "status": "refused", "error": {"message": message}})); sys.exit(1)
def now_file(ref): return os.path.join(home, "now-" + hashlib.sha256(ref.encode()).hexdigest()[:12] + ".json")
if action == "central.files.read":
    path = payload["location"]["path"]; text = open(os.path.join(home, path.replace("/", "_"))).read()
    ok({"schema": "central.file-reading/v1", "location": loc(path), "revision": rev(text), "byte_len": len(text), "content_encoding": "utf-8",
        "content": text, "project": {"name": "P", "path": "Work/P"} if source(path) else None, "source": source(path), "automatic_agent_or_model_invocation": False})
elif action == "central.files.list":
    path = payload["path"]
    names = sorted(n.split("_")[-1] for n in os.listdir(home) if n.startswith(path.replace("/", "_") + "_"))
    ok({"schema": "central.directory-reading/v1", "automatic_agent_or_model_invocation": False, "location": loc(path),
        "entries": [{"name": n, "kind": "file", "byte_len": 1, "retrieval_allowed": True, "location": loc(path + "/" + n)} for n in names]})
elif action == "central.files.write":
    path = payload["location"]["path"]; file = os.path.join(home, path.replace("/", "_")); text = open(file).read()
    if source(path) or payload["expected_revision"] != rev(text):
        ok({"schema": "central.file-mutation/v1", "outcome": "conflict", "location": payload["location"]}); sys.exit(0)
    open(file, "w").write(payload["content"])
    ok({"schema": "central.file-mutation/v1", "outcome": "written", "revision": rev(payload["content"]), "location": payload["location"]})
elif action in ("projectcentral.source.read", "projectcentral.source.write"):
    path = payload["source_ref"].split(":", 4)[4]; file = os.path.join(home, path.replace("/", "_")); text = open(file).read()
    binding = source(path)
    if action == "projectcentral.source.read":
        ok({"schema": "central.project-world-source-reading/v1", "world_ref": "central:project:P", "source": binding,
            "revision": {"revision": "s-" + rev(text), "byte_len": len(text)}, "content": text, "content_encoding": "utf-8", "automatic_agent_or_model_invocation": False})
    else:
        assert payload["expected_revision"] == "s-" + rev(text) and payload["actor_kind"] == "human"
        open(file, "w").write(payload["content"])
        ok({"receipt": {"schema": "central.project-world-source-write-receipt/v1", "world_ref": "central:project:P", "source": binding,
            "previous_revision": "s-" + rev(text), "revision": {"revision": "s-" + rev(payload["content"]), "byte_len": 1}, "changed": True,
            "actor": payload["actor"], "actor_kind": payload["actor_kind"], "automatic_agent_or_model_invocation": False}})
elif action == "central.work.policy":
    ok({"schema": "central.work-policy/v1", "revision": "policy-1"})
elif action == "central.now.allocate":
    assert payload["expected_policy_revision"] == "policy-1"
    ref = "central:now:control:root:" + hashlib.sha256(payload["task_ref"].encode()).hexdigest()[:12]
    created = not os.path.exists(now_file(ref))
    if created: json.dump({"now_ref": ref, "lifecycle": "active", "task_ref": payload["task_ref"], "purpose": payload["purpose"], "n": 1}, open(now_file(ref), "w"))
    record = json.load(open(now_file(ref)))
    if record["purpose"] != payload["purpose"]: refuse("allocation id already has a different task/purpose/relationship basis")
    ok({"now_ref": ref, "lifecycle": record["lifecycle"], "created": created})
elif action == "central.now.read":
    record = json.load(open(now_file(payload["now_ref"])))
    ok({"now_ref": record["now_ref"], "lifecycle": record["lifecycle"], "revision": {"revision": "now-%d" % record["n"], "byte_len": 1}})
elif action == "central.now.lifecycle":
    if os.environ.get("CENTRAL_NATIVE_TOKEN") != "person-token": refuse("native action authority is required for central.now.lifecycle")
    record = json.load(open(now_file(payload["now_ref"])))
    if payload["expected_revision"] != "now-%d" % record["n"]: refuse("the NOW moved since it was read")
    record["lifecycle"] = payload["lifecycle"]; record["n"] += 1
    json.dump(record, open(now_file(payload["now_ref"]), "w"))
    ok({"now_ref": record["now_ref"], "lifecycle": record["lifecycle"], "revision": {"revision": "now-%d" % record["n"], "byte_len": 1}})
else:
    ok({})
"#;

    #[cfg(unix)]
    struct Stub {
        home: std::path::PathBuf,
        client: CentralClient,
    }

    #[cfg(unix)]
    impl Stub {
        fn new(test: &str) -> Self {
            use std::os::unix::fs::PermissionsExt;
            let home = std::env::temp_dir().join(format!("oi-page-{}-{test}", std::process::id()));
            let _ = std::fs::remove_dir_all(&home);
            std::fs::create_dir_all(&home).unwrap();
            let script = home.join("owner.py");
            let wrapper = home.join("owner.sh");
            std::fs::write(&script, STUB_OWNER).unwrap();
            std::fs::write(
                &wrapper,
                format!(
                    "#!/bin/sh\nPAGE_STUB_HOME={} exec python3 {} \"$@\"\n",
                    home.display(),
                    script.display()
                ),
            )
            .unwrap();
            std::fs::set_permissions(&wrapper, std::fs::Permissions::from_mode(0o755)).unwrap();
            crate::test_stub::settle_stub(&wrapper);
            let client = CentralClient::with(wrapper, None, "test".into());
            Stub { home, client }
        }
        fn put(&self, path: &str, html: &str) -> Location {
            std::fs::write(self.home.join(path.replace('/', "_")), html).unwrap();
            Location {
                schema: "central.path-ref/v1".into(),
                ref_id: format!("ref:{path}"),
                root: "R".into(),
                path: path.into(),
            }
        }
        fn held(&self, path: &str) -> Value {
            read_island(&std::fs::read_to_string(self.home.join(path.replace('/', "_"))).unwrap())
                .unwrap()
        }
    }

    #[cfg(unix)]
    #[test]
    fn a_field_is_written_through_the_kernel_on_the_revision_read_and_a_stale_one_is_refused() {
        let stub = Stub::new("write");
        let at = stub.put("Control/user/flows/beings-1.html", &page(being()));
        let mut kernel = crate::Kernel::new(stub.client.clone());
        let read = kernel
            .apply(crate::KernelOp::Page {
                request: Request::Read {
                    location: at.clone(),
                },
            })
            .unwrap();
        let crate::KernelOpResult::PageReading { data } = read.result else {
            panic!("a page reading")
        };
        assert_eq!(data["form"], "being");
        let revision = data["revision"].as_str().unwrap().to_string();
        let written = kernel
            .apply(crate::KernelOp::Page {
                request: Request::MutateField {
                    location: at.clone(),
                    expected_revision: revision.clone(),
                    field: "title".into(),
                    value: json!("Hildegard"),
                },
            })
            .unwrap();
        let crate::KernelOpResult::PageReading { data } = written.result else {
            panic!("a page mutation")
        };
        assert_eq!(data["outcome"], "written");
        assert_ne!(
            data["revision"],
            json!(revision),
            "the receipt names the revision the page now stands on"
        );
        assert_eq!(
            stub.held("Control/user/flows/beings-1.html")["meta"]["title"],
            "Hildegard"
        );
        assert!(
            written
                .receipts
                .iter()
                .any(|receipt| format!("{receipt:?}").contains("FileChanged")),
            "one FileChanged: {:?}",
            written.receipts
        );
        let stale = kernel.apply(crate::KernelOp::Page {
            request: Request::MutateField {
                location: at,
                expected_revision: revision,
                field: "title".into(),
                value: json!("Other"),
            },
        });
        assert!(stale.unwrap_err().contains("moved since it was read"));
        assert_eq!(
            stub.held("Control/user/flows/beings-1.html")["meta"]["title"],
            "Hildegard",
            "nothing overwritten"
        );
    }

    #[cfg(unix)]
    #[test]
    fn a_project_page_is_written_through_the_source_owner() {
        let stub = Stub::new("source");
        let at = stub.put("Work/P/ProjectCentral/user/flow-1.html", &page(flow()));
        let revision = read(&stub.client, &at).unwrap()["revision"]
            .as_str()
            .unwrap()
            .to_string();
        let data = mutate_field(
            &stub.client,
            &at,
            &revision,
            "world",
            &json!("central:wiki:project:P"),
        )
        .unwrap();
        assert_eq!(data["outcome"], "written");
        assert_eq!(data["receipt"]["actor_kind"], "human");
        assert_eq!(
            stub.held("Work/P/ProjectCentral/user/flow-1.html")["meta"]["world"],
            "central:wiki:project:P"
        );
        let log = std::fs::read_to_string(stub.home.join("log")).unwrap();
        assert!(
            log.contains("projectcentral.source.write") && !log.contains("central.files.write"),
            "{log}"
        );
    }

    /// The shared case with keys out of order and integers past 2^53 and 2^64 (D10 of #558, #766; plural-flow.md, the notes of
    /// 28 Oct): each field write through the kernel leaves every island byte it did not change exactly as written (#793).
    #[cfg(unix)]
    #[test]
    fn a_flow_field_write_keeps_every_island_byte_it_does_not_change() {
        let cases: Value = serde_json::from_str(include_str!(
            "../../documents/fixtures/plural-flow-cases.json"
        ))
        .unwrap();
        let case = cases["cases"]
            .as_array()
            .unwrap()
            .iter()
            .find(|case| case["name"] == "an-append-keeps-every-island-byte-it-does-not-own")
            .unwrap();
        let island = case["island"].as_str().unwrap();
        let stub = Stub::new("island-bytes");
        let path = "Control/user/flows/flow-island.html";
        let at = stub.put(path, &page_of(island));
        let held = || std::fs::read_to_string(stub.home.join(path.replace('/', "_"))).unwrap();
        let mut kernel = crate::Kernel::new(stub.client.clone());
        let mut revision = read(&stub.client, &at).unwrap()["revision"]
            .as_str()
            .unwrap()
            .to_string();
        let mut write = |field: &str, value: Value| -> Value {
            let done = kernel
                .apply(crate::KernelOp::Page {
                    request: Request::MutateField {
                        location: at.clone(),
                        expected_revision: revision.clone(),
                        field: field.into(),
                        value,
                    },
                })
                .unwrap();
            let crate::KernelOpResult::PageReading { data } = done.result else {
                panic!("a page mutation")
            };
            assert_eq!(data["outcome"], "written");
            revision = data["revision"].as_str().unwrap().to_string();
            data["value"].clone()
        };

        // A title is replaced where it stands, and the page's counter with it.
        write("title", json!("Kept bytes"));
        let titled = island
            .replace(r#""title":"Exact bytes""#, r#""title":"Kept bytes""#)
            .replace(r#""revision":3"#, r#""revision":4"#);
        assert_ne!(titled, island);
        assert_eq!(held(), page_of(&titled));

        // A member the record lacks goes after its last member.
        write("container", json!("circle"));
        let contained = titled
            .replace(
                r#""role":"contributor"}]},"entries""#,
                r#""role":"contributor"}],"container":"circle"},"entries""#,
            )
            .replace(r#""revision":4"#, r#""revision":5"#);
        assert_eq!(held(), page_of(&contained));

        // A note joins the notes as the kernel writes it; taken away, the list is as it was.
        let note = write("note.add", json!({"entry": "e-q", "text": "kept"}));
        let noted = contained
            .replace(
                r#""notes":[]"#,
                &format!(r#""notes":[{}]"#, serde_json::to_string(&note).unwrap()),
            )
            .replace(r#""revision":5"#, r#""revision":6"#);
        assert_eq!(held(), page_of(&noted));
        write("note.remove", json!({"id": note["id"]}));
        assert_eq!(
            held(),
            page_of(&contained.replace(r#""revision":5"#, r#""revision":7"#))
        );
    }

    /// The shared case with an island-closing tag in mixed case (#797): a field write keeps the `<\/SCRIPT>` and `<\/Script>`
    /// the island holds as written, and what it writes escapes `</SCRIPT` and `</Script` with their letters, so it reads back
    /// as itself. Central's append and the page's and host's saves run the same case.
    #[cfg(unix)]
    #[test]
    fn a_flow_field_write_keeps_the_letters_of_an_escaped_island_closing_tag() {
        let cases: Value = serde_json::from_str(include_str!(
            "../../documents/fixtures/plural-flow-cases.json"
        ))
        .unwrap();
        let case = cases["cases"]
            .as_array()
            .unwrap()
            .iter()
            .find(|case| case["name"] == "an-escaped-island-closing-tag-keeps-its-letters")
            .unwrap();
        let island = case["island"].as_str().unwrap();
        let stub = Stub::new("island-letters");
        let path = "Control/user/flows/flow-letters.html";
        let at = stub.put(path, &page_of(island));
        let held = || std::fs::read_to_string(stub.home.join(path.replace('/', "_"))).unwrap();
        let mut kernel = crate::Kernel::new(stub.client.clone());
        let mut revision = read(&stub.client, &at).unwrap()["revision"]
            .as_str()
            .unwrap()
            .to_string();
        let mut write = |field: &str, value: Value| {
            let done = kernel
                .apply(crate::KernelOp::Page {
                    request: Request::MutateField {
                        location: at.clone(),
                        expected_revision: revision.clone(),
                        field: field.into(),
                        value,
                    },
                })
                .unwrap();
            let crate::KernelOpResult::PageReading { data } = done.result else {
                panic!("a page mutation")
            };
            assert_eq!(data["outcome"], "written");
            revision = data["revision"].as_str().unwrap().to_string();
        };

        // A title holding the tag in two cases is written with both escaped, letters kept.
        write("title", json!("A </SCRIPT> and a </Script>"));
        let titled = island
            .replace(
                r#""title":"Kept letters""#,
                r#""title":"A <\/SCRIPT> and a <\/Script>""#,
            )
            .replace(r#""revision":3"#, r#""revision":4"#);
        assert_eq!(held(), page_of(&titled));
        assert_eq!(
            read_island(&held()).unwrap()["meta"]["title"],
            "A </SCRIPT> and a </Script>"
        );

        // An entry the write changes keeps, as written, the member holding the tags.
        write("highlight.add", json!({"entry": "e-q", "passage": "Does"}));
        let marked = titled
            .replace(
                r#""html":"<p>Does an escaped tag keep its letters?</p>""#,
                r#""html":"<p><mark>Does</mark> an escaped tag keep its letters?</p>""#,
            )
            .replace(r#""revision":4"#, r#""revision":5"#);
        assert_ne!(marked, titled);
        assert_eq!(held(), page_of(&marked));
        write(
            "highlight.remove",
            json!({"entry": "e-q", "passage": "Does"}),
        );
        assert_eq!(
            held(),
            page_of(&titled.replace(r#""revision":4"#, r#""revision":6"#))
        );
    }

    /// #797: a hand-written island may spell its counter with a zero fraction (`"revision": 1.0`, WRITTEN). JSON has one kind of
    /// number and the page and host read it as 1 (plural.ts `appendContribution`, `doc.meta.revision + 1`), so the kernel counts
    /// on from it too, rather than starting the count again.
    #[test]
    fn a_counter_written_with_a_zero_fraction_counts_on_from_its_value() {
        let mut island = read_island(&page_of(WRITTEN)).unwrap();
        apply_field(&mut island, "title", &json!("Counted"), &stamp()).unwrap();
        assert_eq!(island["meta"]["revision"], json!(2));
        for (written, next) in [("3.0", 4), ("3e0", 4), ("30e-1", 4), ("0.0", 1), ("-0", 1)] {
            let mut island = read_island(&page_of(&format!(
                r#"{{"meta": {{"revision": {written}}}, "entries": []}}"#
            )))
            .unwrap();
            apply_field(&mut island, "view", &json!("journal"), &stamp()).unwrap();
            assert_eq!(island["meta"]["revision"], json!(next), "{written}");
        }
    }

    #[cfg(unix)]
    #[test]
    fn a_world_s_pages_are_listed_by_their_form_and_a_file_that_is_no_page_is_named() {
        let stub = Stub::new("list");
        stub.put("Control/user/flows/beings-1.html", &page(being()));
        stub.put("Control/user/flows/flow-1.html", &page(flow()));
        stub.put("Control/user/flows/plain.html", "<html>no island</html>");
        let listing = list_pages(&stub.client, "Control/user/flows", None).unwrap();
        let forms: Vec<_> = listing["pages"]
            .as_array()
            .unwrap()
            .iter()
            .map(|page| page["form"].as_str().unwrap().to_string())
            .collect();
        assert_eq!(forms, ["being", "flow"]);
        assert_eq!(listing["not_pages"][0]["name"], "plain.html");
        assert!(listing["not_pages"][0]["why"]
            .as_str()
            .unwrap()
            .contains("no ql-doc island"));
    }

    #[cfg(unix)]
    #[test]
    fn a_flow_is_listed_with_the_words_its_browser_row_draws() {
        let stub = Stub::new("list-flow-words");
        let mut island = flow();
        island["meta"]["participants"] = json!([
            {"kind": "agent", "name": "Fizz", "initial": "Z", "binding": {"ref": "codex:fizz"}},
            {"kind": "person", "initial": "F", "key": "p-1"}
        ]);
        stub.put("Control/user/flows/beings-1.html", &page(being()));
        stub.put("Control/user/flows/flow-1.html", &page(island));
        let listing = list_pages(&stub.client, "Control/user/flows", None).unwrap();
        let pages = listing["pages"].as_array().unwrap();
        let flow_row = pages.iter().find(|page| page["form"] == "flow").unwrap();
        assert_eq!(
            flow_row["flow"],
            json!({"title": "Untitled exchange", "revision": 3,
                "participants": [{"kind": "agent", "name": "Fizz", "initial": "Z"}, {"kind": "person", "name": null, "initial": "F"}]})
        );
        let being_row = pages.iter().find(|page| page["form"] == "being").unwrap();
        assert!(
            being_row.get("flow").is_none(),
            "only a Flow carries a Flow's words"
        );
    }

    #[cfg(unix)]
    #[test]
    fn a_page_plays_in_one_now_clearing_and_stop_closes_it_with_the_person_s_authority_only() {
        let stub = Stub::new("launch");
        let at = stub.put("Control/user/flows/flow-1.html", &page(flow()));
        let person = stub.client.with_person_token("person-token");
        let launched = launch(&stub.client, &person, &at).unwrap();
        assert_eq!(launched["form"], "flow");
        let now_ref = launched["now_ref"].as_str().unwrap().to_string();
        assert!(
            launched["reopened"].is_null(),
            "a first launch allocates an active clearing"
        );
        let again = launch(&stub.client, &person, &at).unwrap();
        assert_eq!(
            again["now_ref"],
            json!(now_ref),
            "launching it again rejoins the same clearing"
        );
        assert_eq!(again["allocated"]["created"], json!(false));
        let refused = stop(&stub.client, &stub.client, &now_ref, None).unwrap_err();
        assert!(
            refused.contains("native action authority"),
            "the kernel's own client carries no authority: {refused}"
        );
        let stopped = stop(&stub.client, &person, &now_ref, None).unwrap();
        assert_eq!(stopped["outcome"], "closed");
        assert_eq!(
            stop(&stub.client, &person, &now_ref, None).unwrap()["outcome"],
            "unchanged"
        );
        let reopened = launch(&stub.client, &person, &at).unwrap();
        assert_eq!(
            reopened["reopened"]["lifecycle"], "active",
            "a closed page launched again plays again"
        );
        let log = std::fs::read_to_string(stub.home.join("log")).unwrap();
        assert!(
            !log.contains("central.now.allocate person")
                && !log.contains("central.files.read person"),
            "only the lifecycle act carries the person's token: {log}"
        );
        assert!(log.contains("central.now.lifecycle person"));
    }

    #[cfg(unix)]
    #[test]
    fn a_file_that_is_no_page_does_not_play() {
        let stub = Stub::new("no-page");
        let at = stub.put("Control/user/flows/plain.html", "<html>no island</html>");
        let refused = launch(&stub.client, &stub.client, &at).unwrap_err();
        assert!(refused.contains("no ql-doc island"), "{refused}");
    }
}
