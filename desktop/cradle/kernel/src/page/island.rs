//! The island written as it stands (#793). A field write writes into the island's own text only what it changed; every other
//! byte (key order, spacing, number spellings, escapes, a duplicate key, integers no 64-bit number holds) stays as written, as
//! Central's append (#766) and the page's own save (#785) write it. serde_json reads a record into sorted keys, so serialising
//! what was read rewrites the whole island (D10 of #558). Its `preserve_order` feature would not do: it unifies onto every
//! crate this kernel links that reads JSON, it changes the bytes the kernel's digests hash (`serde_json::to_vec` of records in
//! decision.rs, nara_epii.rs, m3_reception.rs, nara_current.rs), and it still rewrites spacing, escapes and duplicate keys.
//!
//! Ported from `desktop/cradle/src/flow/plural.ts` `spliceIsland` (#785, :662-836), itself ported from Central's
//! `ctrl/src/flow_append.rs` (origin/main e951ebc). From flow_append.rs: the scanner `island_space`, `island_children` and
//! `island_value` (:109-185), a key decoded as `island_object` decodes it (:188-202), the reading and writing escapes
//! `flow_unescape` and `flow_island_escape` (:63-87), and the read-back guard of `flow_splice_append` (:295-301). From
//! plural.ts: what was read compared with what is held, so the members to write are found rather than named (:738-754), the
//! record and list splices (:770-816), a container written again with the separators it was written with (:756-769), and
//! the entry point (:826-836).
use serde_json::{Map, Value};

/// Where one JSON value sits in the island text, in bytes (flow_append.rs:95-100).
#[derive(Clone, Copy)]
struct Span {
    start: usize,
    end: usize,
}

/// One child of a record (with its key's span) or of a list (without) (flow_append.rs:103-104).
struct Child {
    key: Option<Span>,
    value: Span,
}

/// One child of a container written again: a child the island holds (by its index), or a new one, as text (plural.ts:678-679).
struct Piece {
    from: Option<usize>,
    text: String,
}

fn unlocated() -> String {
    "The page's island could not be located for the write: nothing was written".into()
}

/// The island's text as JSON: the legacy `<\/script` and `<\!--` escapes read back as written content (flow_append.rs:63-67).
pub(super) fn unescape(raw: &str) -> String {
    raw.replace(r"<\/script", "</script")
        .replace(r"<\!--", "<!--")
}

/// JSON written into the island: `</script`, in any case, and a comment opening must not survive in it, so the island can
/// never close itself or open a comment (flow_append.rs:73-87). One change from the source: the letters after `<\/` are kept
/// as written, so `</SCRIPT` reads back as itself; the source writes `<\/script`, which reads back lowercased.
fn escape(json: &str) -> String {
    let mut out = String::with_capacity(json.len());
    let lower = json.to_ascii_lowercase();
    let mut at = 0;
    while let Some(i) = lower[at..].find("</script") {
        out.push_str(&json[at..at + i]);
        out.push_str(r"<\/");
        at += i + "</".len();
    }
    out.push_str(&json[at..]);
    out.replace("<!--", r"<\u0021--")
}

/// A value the write adds, as the kernel's serialiser writes it, escaped for the island (plural.ts:687 `islandJson`).
fn json(value: &Value) -> Result<String, String> {
    serde_json::to_string(value)
        .map(|text| escape(&text))
        .map_err(|error| error.to_string())
}

fn read(text: &str) -> Result<Value, String> {
    serde_json::from_str(&unescape(text)).map_err(|_| unlocated())
}

fn island_space(text: &[u8], mut at: usize) -> usize {
    while text
        .get(at)
        .is_some_and(|b| matches!(b, b' ' | b'\t' | b'\n' | b'\r'))
    {
        at += 1;
    }
    at
}

/// The children of the record or list opening at `open` (a record's carry their key spans) and the end of the container
/// (flow_append.rs:118-152).
fn island_children(text: &[u8], open: usize) -> Result<(Vec<Child>, usize), String> {
    let close = match text.get(open) {
        Some(b'{') => b'}',
        Some(b'[') => b']',
        _ => return Err(unlocated()),
    };
    let mut children = Vec::new();
    let mut at = island_space(text, open + 1);
    if text.get(at) == Some(&close) {
        return Ok((children, at + 1));
    }
    loop {
        let key = if close == b'}' {
            let key = island_value(text, at)?;
            at = island_space(text, key.end);
            if text.get(at) != Some(&b':') {
                return Err(unlocated());
            }
            at = island_space(text, at + 1);
            Some(key)
        } else {
            None
        };
        let value = island_value(text, at)?;
        children.push(Child { key, value });
        at = island_space(text, value.end);
        match text.get(at) {
            Some(b',') => at = island_space(text, at + 1),
            Some(&b) if b == close => return Ok((children, at + 1)),
            _ => return Err(unlocated()),
        }
    }
}

/// The value starting at `at`. Only called on text that already read as JSON, so its nesting is within the reader's own
/// depth limit (flow_append.rs:153-185).
fn island_value(text: &[u8], at: usize) -> Result<Span, String> {
    let end = match text.get(at) {
        Some(b'"') => {
            let mut i = at + 1;
            loop {
                match text.get(i) {
                    Some(b'\\') => i += 2,
                    Some(b'"') => break i + 1,
                    Some(_) => i += 1,
                    None => return Err(unlocated()),
                }
            }
        }
        Some(b'{' | b'[') => island_children(text, at)?.1,
        Some(_) => {
            let mut i = at;
            while text
                .get(i)
                .is_some_and(|b| !matches!(b, b',' | b']' | b'}' | b' ' | b'\t' | b'\n' | b'\r'))
            {
                i += 1;
            }
            if i == at {
                return Err(unlocated());
            }
            i
        }
        None => return Err(unlocated()),
    };
    Ok(Span { start: at, end })
}

/// What makes a list's element the same element after a change: an entry's (or note's, page's, item's) `id`, a participant's
/// `key`; anything else is the same only when it is equal (plural.ts:745-754).
fn identity_of(value: &Value) -> Option<(&'static str, &str)> {
    let record = value.as_object()?;
    if let Some(id) = record.get("id").and_then(Value::as_str) {
        return Some(("id", id));
    }
    record
        .get("key")
        .and_then(Value::as_str)
        .map(|key| ("key", key))
}

fn same_element(a: &Value, b: &Value) -> bool {
    match (identity_of(a), identity_of(b)) {
        (None, None) => a == b,
        (x, y) => x == y,
    }
}

/// A container written again from its children: each kept child with the separator it was written with, a new one after a
/// comma; the container's leading and trailing space as written (plural.ts:756-769).
fn island_container(text: &str, span: Span, children: &[Child], pieces: &[Piece]) -> String {
    let start_of = |child: &Child| child.key.unwrap_or(child.value).start;
    let close = span.end - 1;
    let (lead, trail) = match (children.first(), children.last()) {
        (Some(first), Some(last)) => (
            &text[span.start + 1..start_of(first)],
            &text[last.value.end..close],
        ),
        _ => (&text[span.start + 1..close], ""),
    };
    let mut out = String::with_capacity(span.end - span.start);
    out.push_str(&text[span.start..span.start + 1]);
    out.push_str(lead);
    for (index, piece) in pieces.iter().enumerate() {
        if index > 0 {
            match piece.from {
                Some(from) if from > 0 => {
                    out.push_str(&text[children[from - 1].value.end..start_of(&children[from])])
                }
                _ => out.push(','),
            }
        }
        out.push_str(&piece.text);
    }
    out.push_str(trail);
    out.push_str(&text[close..span.end]);
    out
}

/// A record read as `before`, now `after`: a removed key goes in every occurrence, a kept one keeps its key's bytes and is
/// spliced in its last occurrence (the value a reader keeps), a new one goes after the last member (plural.ts:770-783).
fn splice_object(
    text: &str,
    span: Span,
    before: &Map<String, Value>,
    after: &Map<String, Value>,
) -> Result<String, String> {
    let (children, _) = island_children(text.as_bytes(), span.start)?;
    let mut names = Vec::with_capacity(children.len());
    for child in &children {
        let key = child.key.ok_or_else(unlocated)?;
        let name = serde_json::from_str::<String>(&unescape(&text[key.start..key.end]))
            .map_err(|_| unlocated())?;
        names.push((key, name));
    }
    let mut pieces = Vec::new();
    for (index, (child, (key, name))) in children.iter().zip(&names).enumerate() {
        let Some(now) = after.get(name) else {
            continue;
        };
        let last = names.iter().rposition(|(_, other)| other == name) == Some(index);
        let value = if last {
            let was = before.get(name).ok_or_else(unlocated)?;
            splice_value(text, child.value, was, now)?
        } else {
            text[child.value.start..child.value.end].to_string()
        };
        pieces.push(Piece {
            from: Some(index),
            text: format!("{}{value}", &text[key.start..child.value.start]),
        });
    }
    for (name, value) in after {
        if !before.contains_key(name) {
            pieces.push(Piece {
                from: None,
                text: format!("{}:{}", json(&Value::String(name.clone()))?, json(value)?),
            });
        }
    }
    Ok(island_container(text, span, &children, &pieces))
}

/// A list read as `before`, now `after`: the elements that stayed keep their bytes, in order (the unchanged ends, then the
/// longest common run of the middle); between two kept elements, as many removed as added with no identity among them are
/// those elements changed in place; anything else added is written new (plural.ts:784-816).
fn splice_array(
    text: &str,
    span: Span,
    before: &[Value],
    after: &[Value],
) -> Result<String, String> {
    let (children, _) = island_children(text.as_bytes(), span.start)?;
    if children.len() != before.len() {
        return Err(unlocated());
    }
    let keep = |i: usize, j: usize| -> Result<Piece, String> {
        Ok(Piece {
            from: Some(i),
            text: splice_value(text, children[i].value, &before[i], &after[j])?,
        })
    };
    let mut pieces = Vec::new();
    let mut head = 0;
    while head < before.len() && head < after.len() && same_element(&before[head], &after[head]) {
        head += 1;
    }
    let mut tail = 0;
    while tail < before.len() - head
        && tail < after.len() - head
        && same_element(
            &before[before.len() - 1 - tail],
            &after[after.len() - 1 - tail],
        )
    {
        tail += 1;
    }
    for k in 0..head {
        pieces.push(keep(k, k)?);
    }
    let (n, m) = (before.len() - head - tail, after.len() - head - tail);
    // Longest common subsequence over the middle; past a million cells the middle is written whole.
    let width = m + 1;
    let table = n.saturating_mul(m) <= 1_000_000;
    let mut run = vec![0u32; if table { (n + 1) * width } else { 0 }];
    if table {
        for i in (0..n).rev() {
            for j in (0..m).rev() {
                run[i * width + j] = if same_element(&before[head + i], &after[head + j]) {
                    run[(i + 1) * width + j + 1] + 1
                } else {
                    run[(i + 1) * width + j].max(run[i * width + j + 1])
                };
            }
        }
    }
    let settle = |pieces: &mut Vec<Piece>,
                  gone: &mut Vec<usize>,
                  added: &mut Vec<usize>|
     -> Result<(), String> {
        let anonymous = gone
            .iter()
            .map(|&i| &before[i])
            .chain(added.iter().map(|&j| &after[j]))
            .all(|value| identity_of(value).is_none());
        if gone.len() == added.len() && anonymous {
            for (&i, &j) in gone.iter().zip(added.iter()) {
                pieces.push(keep(i, j)?);
            }
        } else {
            for &j in added.iter() {
                pieces.push(Piece {
                    from: None,
                    text: json(&after[j])?,
                });
            }
        }
        gone.clear();
        added.clear();
        Ok(())
    };
    let (mut gone, mut added) = (Vec::new(), Vec::new());
    let (mut i, mut j) = (0, 0);
    while i < n || j < m {
        if i < n
            && j < m
            && table
            && same_element(&before[head + i], &after[head + j])
            && run[i * width + j] == run[(i + 1) * width + j + 1] + 1
        {
            settle(&mut pieces, &mut gone, &mut added)?;
            pieces.push(keep(head + i, head + j)?);
            i += 1;
            j += 1;
        } else if j >= m || (i < n && table && run[(i + 1) * width + j] >= run[i * width + j + 1]) {
            gone.push(head + i);
            i += 1;
        } else if i >= n || table {
            added.push(head + j);
            j += 1;
        } else {
            gone.push(head + i);
            i += 1;
        }
    }
    settle(&mut pieces, &mut gone, &mut added)?;
    for k in (1..=tail).rev() {
        pieces.push(keep(before.len() - k, after.len() - k)?);
    }
    Ok(island_container(text, span, &children, &pieces))
}

/// The text of the value at `span`, read as `before`, now `after`: as written when they read the same; a container that
/// changed keeps what stayed in it; anything else is written new (plural.ts:817-824).
fn splice_value(text: &str, span: Span, before: &Value, after: &Value) -> Result<String, String> {
    if before == after {
        return Ok(text[span.start..span.end].to_string());
    }
    match (text.as_bytes()[span.start], before, after) {
        (b'{', Value::Object(before), Value::Object(after)) => {
            splice_object(text, span, before, after)
        }
        (b'[', Value::Array(before), Value::Array(after)) => {
            splice_array(text, span, before, after)
        }
        _ => json(after),
    }
}

/// The island text (what stands between the `ql-doc` tags) with `island` written into it. Only what `island` changed from
/// what the text reads as is written; every other byte stays as written. The result must read as exactly `island`, or
/// nothing is written (plural.ts:826-836; the guard is flow_append.rs:295-301).
pub(super) fn splice(text: &str, island: &Value) -> Result<String, String> {
    let before = read(text)?;
    let root = island_value(text.as_bytes(), island_space(text.as_bytes(), 0))?;
    let spliced = format!(
        "{}{}{}",
        &text[..root.start],
        splice_value(text, root, &before, island)?,
        &text[root.end..]
    );
    match read(&spliced) {
        Ok(reread) if reread == *island => Ok(spliced),
        _ => Err(
            "The write could not be placed in the page's island as written: nothing was written"
                .into(),
        ),
    }
}
