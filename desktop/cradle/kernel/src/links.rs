//! Wikilink resolution and derived-link graph semantics — the O-I clean-room
//! implementation of the Obsidian 1.7.7 link contract.
//!
//! Contract of record: `campaign-evidence/2026-10-07-obsidian-relations` in
//! the O-I repository — `contracts/a3-graph.contract.md` (rules) and
//! `findings/a3-graph-links.md` (evidence). This module is pure: it owns no
//! IO, spawns nothing, reads no clock — callers hand it document contents and
//! receive deterministic structures. Parity with the pinned 1.7.7 target is
//! asserted by `kernel/tests/links_parity.rs` against the campaign's captured
//! oracle (the same fixture the campaign's `gate3-graph-parity.mjs` binds).
//!
//! Rule chain (contract §2), per link occurrence, in order:
//! 1. cut the target at the first `#` (subpath stripped before resolution);
//! 2. empty remainder → the source itself;
//! 3. lowercase; basename after the last `/`;
//! 4. basename with a dot → look up in the basename multimap (lowercased,
//!    extension included);
//! 5. miss (or no dot) → append `.md` to both and retry;
//! 6. no candidates → unresolved;
//! 7. unique candidate and no folder part → wins;
//! 8. `./`/`../` forms join to the source's folder, normalized; first full
//!    lowercased-path equality wins; miss → unresolved;
//! 9. leading `/` stripped; exact full-path equality wins (this beats
//!    same-folder preference);
//! 10. leading-`/` form with no exact match → unresolved;
//! 11. among candidates whose full path ends with the linktext, prefer those
//!     under the source's folder, then shortest full path first.
//!
//! Aliases never resolve. Everything is case-insensitive. Unresolved keys
//! keep the case as written, drop the subpath and alias, and strip a trailing
//! `.md` only when that is the extension.
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

/// One parsed link occurrence (frontmatter, body link or embed).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LinkOccurrence {
    /// The raw text as written, minus the embed marker (`[[Bravo|Bee]]`).
    pub original: String,
    /// Target with subpath and alias retained (resolution strips them).
    pub link: String,
}

/// Links parsed from one markdown document (contract §1).
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct DocumentLinks {
    pub links: Vec<String>,
    pub embeds: Vec<String>,
    /// Frontmatter string values whose entire text is `[[...]]` (arrays and
    /// objects recursed by the frontmatter walker).
    pub frontmatter_links: Vec<String>,
}

impl DocumentLinks {
    /// Every link occurrence in resolution order: frontmatter links, then
    /// body links, then embeds.
    pub fn occurrences(&self) -> impl Iterator<Item = &String> {
        self.frontmatter_links
            .iter()
            .chain(self.links.iter())
            .chain(self.embeds.iter())
    }
}

/// Parse the markdown links of one document. The scanner recognises
/// `[[target]]`, `[[target|alias]]`, `![[embed]]` and internal markdown
/// links `[text](href)` (href decoded, internal iff it names no URI scheme);
/// the frontmatter block is scanned separately so its `[[...]]` strings are
/// counted once, as frontmatter links.
pub fn parse_document(text: &str) -> DocumentLinks {
    let mut out = DocumentLinks::default();
    let (frontmatter, body) = split_frontmatter(text);
    if let Some(fm) = frontmatter {
        out.frontmatter_links = frontmatter_links(fm);
    }
    let bytes = body.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'!' if bytes[i..].starts_with(b"![[") => {
                if let Some((inner, next)) = read_wikilink(body, i + 3) {
                    out.embeds.push(split_alias(&inner));
                    i = next;
                    continue;
                }
                i += 1;
            }
            b'[' if bytes[i..].starts_with(b"[[") => {
                if let Some((inner, next)) = read_wikilink(body, i + 2) {
                    out.links.push(split_alias(&inner));
                    i = next;
                    continue;
                }
                i += 1;
            }
            b'[' => {
                if let Some((href, next)) = read_md_link(body, i) {
                    let href = decode_percent(&href);
                    // Internal iff it names no URI scheme and is not a bare
                    // in-page anchor (contract §1).
                    let has_scheme = href
                        .split_once(':')
                        .map(|(head, _)| is_uri_scheme(head))
                        .unwrap_or(false);
                    if !has_scheme && !href.starts_with('#') {
                        out.links.push(href);
                    }
                    i = next;
                    continue;
                }
                i += 1;
            }
            _ => i += 1,
        }
    }
    out
}

/// A URI scheme is `[a-zA-Z][a-zA-Z0-9+.-]*`; anything else before a colon
/// is a relative path that happens to hold a colon.
fn is_uri_scheme(head: &str) -> bool {
    !head.is_empty()
        && head.chars().next().is_some_and(|c| c.is_ascii_alphabetic())
        && head
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '.' | '-'))
}

/// The alias splits off at the first `|` and never resolves (contract §1).
fn split_alias(inner: &str) -> String {
    inner.split('|').next().unwrap_or(inner).trim().to_string()
}

/// Read the inner text of a wikilink starting just past the `[[`; returns
/// the inner text and the offset just past `]]`.
fn read_wikilink(text: &str, content: usize) -> Option<(String, usize)> {
    let rest = &text[content..];
    let end = rest.find("]]")?;
    let inner = rest[..end].trim().to_string();
    if inner.is_empty() || inner.contains('[') {
        return None;
    }
    Some((inner, content + end + 2))
}

/// Read `[text](href)` starting at `[`; returns the href and the offset just
/// past `)`. The link text must be bracket-free for this simple contract.
fn read_md_link(text: &str, open: usize) -> Option<(String, usize)> {
    let close_text = text[open..].find(']')?;
    let text_part = &text[open + 1..open + close_text];
    if text_part.contains('[') || text_part.is_empty() {
        return None;
    }
    let after = open + close_text + 1;
    if !text[after..].starts_with('(') {
        return None;
    }
    let close_href = text[after..].find(')')?;
    let href = text[after + 1..after + close_href].trim().to_string();
    if href.is_empty() {
        return None;
    }
    Some((href, after + close_href + 1))
}

/// `decodeURI`: `%XX` sequences become their bytes; reserved characters are
/// unaffected (the contract only needs `%20`-style spacing).
fn decode_percent(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Some(hex) = bytes.get(i + 1..i + 3) {
                if let Ok(value) = u8::from_str_radix(std::str::from_utf8(hex).unwrap_or(""), 16) {
                    out.push(value);
                    i += 3;
                    continue;
                }
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Split a leading `---` frontmatter block; returns `(Some(block), body)`.
fn split_frontmatter(text: &str) -> (Option<&str>, &str) {
    let Some(rest) = text.strip_prefix("---\n") else {
        return (None, text);
    };
    let Some(end) = rest.find("\n---") else {
        return (None, text);
    };
    (Some(&rest[..end]), &rest[end + 4..])
}

/// Frontmatter values that are entirely a wikilink: plain strings and string
/// array members (contract §1: arrays recurse; keys become dotted, which this
/// contract does not need — the occurrences are what resolution consumes).
fn frontmatter_links(block: &str) -> Vec<String> {
    let mut out = Vec::new();
    for line in block.lines() {
        let Some((_, value)) = line.split_once(':') else {
            continue;
        };
        let value = value.trim();
        if value.starts_with('[') && value.ends_with(']') {
            for member in value[1..value.len() - 1].split(',') {
                push_whole_wikilink(member.trim(), &mut out);
            }
        } else {
            push_whole_wikilink(value, &mut out);
        }
    }
    out
}

fn push_whole_wikilink(value: &str, out: &mut Vec<String>) {
    let value = value.trim();
    let inner = value
        .strip_prefix('"')
        .and_then(|v| v.strip_suffix('"'))
        .unwrap_or(value);
    let inner = inner.trim();
    if inner.starts_with("[[") && inner.ends_with("]]") && inner.len() >= 4 {
        let body = &inner[2..inner.len() - 2];
        if !body.is_empty() && !body.contains('[') {
            out.push(body.trim().to_string());
        }
    }
}

/// The resolution index: every indexed path plus the basename multimap keyed
/// by lowercased basename **including extension** (contract §2 step 4).
pub struct LinksIndex {
    paths: Vec<String>,
    by_base: BTreeMap<String, Vec<usize>>,
}

impl LinksIndex {
    /// Index a document set. Paths are the caller's identity spelling (file
    /// paths or owner source refs — resolution only relies on them being
    /// `/`-joined names with extensions).
    pub fn new<I: IntoIterator<Item = String>>(paths: I) -> Self {
        let paths: Vec<String> = paths.into_iter().collect();
        let mut by_base: BTreeMap<String, Vec<usize>> = BTreeMap::new();
        for (i, path) in paths.iter().enumerate() {
            let base = basename_lower(path);
            by_base.entry(base).or_default().push(i);
        }
        Self { paths, by_base }
    }

    pub fn path(&self, index: usize) -> &str {
        &self.paths[index]
    }

    pub fn len(&self) -> usize {
        self.paths.len()
    }

    pub fn is_empty(&self) -> bool {
        self.paths.is_empty()
    }

    /// The pipeline resolver: the subpath is stripped before lookup
    /// (contract §2 step 1). `strip_subpath = false` replays the raw
    /// destination lookup, where a `#…` text handed straight in must fail
    /// basename lookup (live-proven: `#Head → null`).
    pub fn resolve(&self, source: &str, linktext: &str) -> Option<String> {
        self.resolve_inner(source, linktext, true)
    }

    /// The raw destination lookup the pipeline feeds: no subpath strip. The
    /// campaign's 37 recorded `getFirstLinkpathDest` probes bind to this
    /// entry point (a `#…` linktext must fail basename lookup).
    pub fn resolve_raw(&self, source: &str, linktext: &str) -> Option<String> {
        self.resolve_inner(source, linktext, false)
    }

    fn resolve_inner(&self, source: &str, linktext: &str, strip_subpath: bool) -> Option<String> {
        let path = if strip_subpath {
            up_to_first_hash(linktext)
        } else {
            linktext.to_string()
        };
        if path.is_empty() {
            return Some(source.to_string()); // step 2: empty → self
        }
        let lower = path.to_lowercase();
        let folder = source.rsplit_once('/').map(|(f, _)| f.to_string());
        let has_folder = lower.contains('/');
        let base = basename_lower(&lower);
        let mut candidates: Vec<usize> = if base.contains('.') {
            self.by_base.get(&base).cloned().unwrap_or_default()
        } else {
            Vec::new()
        };
        let mut appended = false;
        if candidates.is_empty() || !base.contains('.') {
            candidates = self
                .by_base
                .get(&format!("{base}.md"))
                .cloned()
                .unwrap_or_default();
            appended = true;
        }
        if candidates.is_empty() {
            return None; // step 6
        }
        let eff = if appended {
            format!("{lower}.md")
        } else {
            lower.clone()
        };
        if !has_folder && candidates.len() == 1 {
            return Some(self.paths[candidates[0]].clone()); // step 7
        }
        if lower.starts_with("./") || lower.starts_with("../") {
            // step 8: joined to the source's folder; miss → unresolved
            let joined = normalize_relative(folder.as_deref().unwrap_or(""), &eff);
            return candidates
                .iter()
                .find(|i| self.paths[**i].to_lowercase() == joined)
                .map(|i| self.paths[*i].clone());
        }
        if path.starts_with('/') {
            // steps 9–10: exact full path or unresolved
            let full = eff.strip_prefix('/').unwrap_or(&eff);
            return candidates
                .iter()
                .find(|i| self.paths[**i].to_lowercase() == full)
                .map(|i| self.paths[*i].clone());
        }
        // step 9: exact full-path equality beats folder preference
        if let Some(i) = candidates
            .iter()
            .find(|i| self.paths[**i].to_lowercase() == eff)
        {
            return Some(self.paths[*i].clone());
        }
        // step 11: ends-with candidates, folder preference, then shortest
        let ends: Vec<usize> = candidates
            .iter()
            .filter(|i| {
                let c = self.paths[**i].to_lowercase();
                c.ends_with(&format!("/{eff}")) || c == eff
            })
            .copied()
            .collect();
        let in_folder: Vec<usize> = ends
            .iter()
            .filter(|i| {
                let cf = self.paths[**i].rsplit_once('/').map(|(f, _)| f.to_string());
                match (&folder, &cf) {
                    (None, None) => true,
                    (Some(f), Some(cf)) => cf.eq_ignore_ascii_case(f),
                    _ => false,
                }
            })
            .copied()
            .collect();
        let pool = if in_folder.is_empty() {
            ends
        } else {
            in_folder
        };
        pool.iter()
            .min_by_key(|i| self.paths[**i].len())
            .map(|i| self.paths[*i].clone())
    }
}

fn basename_lower(path: &str) -> String {
    let base = path.rsplit('/').next().unwrap_or(path);
    base.to_lowercase()
}

fn up_to_first_hash(text: &str) -> String {
    match text.find('#') {
        Some(at) => text[..at].to_string(),
        None => text.to_string(),
    }
}

/// Join `folder` and `joined`, resolving `.` and `..` segments.
fn normalize_relative(folder: &str, joined: &str) -> String {
    let joined_path = if folder.is_empty() {
        joined.to_string()
    } else {
        format!("{folder}/{joined}")
    };
    let mut stack: Vec<&str> = Vec::new();
    for segment in joined_path.split('/') {
        match segment {
            "" | "." => {}
            ".." => {
                stack.pop();
            }
            other => stack.push(other),
        }
    }
    stack.join("/")
}

/// Unresolved key normalization (contract §3): subpath and alias removed,
/// trailing `.md` stripped iff that is the extension, case as written.
pub fn unresolved_key(linktext: &str) -> String {
    let mut key = up_to_first_hash(linktext);
    if let Some(at) = key.find('|') {
        key.truncate(at);
    }
    if key.len() >= 3 && key[key.len() - 3..].eq_ignore_ascii_case(".md") {
        key.truncate(key.len() - 3);
    }
    key
}

/// The two cache shapes (contract §3): `resolved[source][target] = count`
/// and `unresolved[source][key] = count`, occurrence-counted; every document
/// is a key of both.
pub struct CacheShapes {
    pub resolved: BTreeMap<String, BTreeMap<String, usize>>,
    pub unresolved: BTreeMap<String, BTreeMap<String, usize>>,
}

/// Build the cache shapes over a document set (path → markdown content).
/// Every `.md`-suffixed document enters both maps (empty maps allowed);
/// attachment documents are indexed but are never link sources.
pub fn build_cache(docs: &BTreeMap<String, String>) -> CacheShapes {
    let index = LinksIndex::new(docs.keys().cloned());
    let mut cache = CacheShapes {
        resolved: BTreeMap::new(),
        unresolved: BTreeMap::new(),
    };
    for (source, content) in docs {
        if !is_markdown(source) {
            continue;
        }
        let parsed = parse_document(content);
        let resolved = cache.resolved.entry(source.clone()).or_default();
        let unresolved = cache.unresolved.entry(source.clone()).or_default();
        for link in parsed.occurrences() {
            match index.resolve(source, link) {
                Some(dest) => *resolved.entry(dest).or_default() += 1,
                None => *unresolved.entry(unresolved_key(link)).or_default() += 1,
            }
        }
    }
    cache
}

pub fn is_markdown(path: &str) -> bool {
    path.len() >= 3 && path[path.len() - 3..].eq_ignore_ascii_case(".md")
}

/// Graph-view options with the pinned 1.7.7 defaults (contract §4).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GraphOptions {
    pub show_tags: bool,
    pub show_attachments: bool,
    pub hide_unresolved: bool,
    /// `true` (default) keeps orphans; `false` prunes them.
    pub show_orphans: bool,
}

impl Default for GraphOptions {
    fn default() -> Self {
        Self {
            show_tags: false,
            show_attachments: false,
            hide_unresolved: false,
            show_orphans: true,
        }
    }
}

/// The derived graph per contract §4: nodes and unique-pair edges. Tags are
/// carried by the owner metadata and are not derived from document text
/// here; `show_tags` participates in the option set for contract fidelity
/// but yields no tag nodes from this text-only derivation.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct DerivedGraph {
    pub nodes: Vec<String>,
    pub edges: Vec<(String, String)>,
}

/// Build the derived graph with the given options (contract §4):
/// nodes = indexed md documents (+ attachments when shown) + phantom
/// unresolved keys (unless hidden); edges = unique source→target pairs where
/// both endpoints survive the filters, self-loops included as pairs.
/// Orphans have no surviving in- or out-edges (self-loops never count) and
/// are pruned only when `show_orphans` is false.
pub fn build_graph(
    cache: &CacheShapes,
    all_paths: &[String],
    options: &GraphOptions,
) -> DerivedGraph {
    let md: BTreeSet<String> = all_paths
        .iter()
        .filter(|p| is_markdown(p))
        .cloned()
        .collect();
    // Every indexed md document is a node from the start (contract §4) —
    // link-less documents are orphans, not absences.
    let mut nodes: BTreeSet<String> = md.clone();
    let mut edges: BTreeSet<(String, String)> = BTreeSet::new();
    for (source, targets) in &cache.resolved {
        for target in targets.keys() {
            if md.contains(target) {
                edges.insert((source.clone(), target.clone()));
            }
        }
    }
    if !options.hide_unresolved {
        for (source, keys) in &cache.unresolved {
            for key in keys.keys() {
                nodes.insert(key.clone());
                nodes.insert(source.clone());
                edges.insert((source.clone(), key.clone()));
            }
        }
    }
    if options.show_attachments {
        for path in all_paths {
            if !is_markdown(path) {
                nodes.insert(path.clone());
            }
        }
    }
    if !options.show_orphans {
        // Orphan = no in-edges and no out-edges among surviving nodes;
        // self-loops do not count as either.
        let mut linked: BTreeSet<&String> = BTreeSet::new();
        for (from, to) in &edges {
            if from != to {
                linked.insert(from);
                linked.insert(to);
            }
        }
        nodes.retain(|node| linked.contains(node));
        edges.retain(|(from, to)| nodes.contains(from) && nodes.contains(to));
    }
    DerivedGraph {
        nodes: nodes.into_iter().collect(),
        edges: edges.into_iter().collect(),
    }
}

/// Wire shape for callers that need the reading as JSON (the T7 gate
/// adapter emits this shape; it mirrors the campaign oracle's keys).
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct CacheShapesWire {
    pub resolved_links: BTreeMap<String, BTreeMap<String, usize>>,
    pub unresolved_links: BTreeMap<String, BTreeMap<String, usize>>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn docs() -> BTreeMap<String, String> {
        BTreeMap::from([
            ("Target.md".to_string(), "# Target (root)".to_string()),
            ("sub/Target.md".to_string(), "# Target (sub)".to_string()),
            ("Alpha.md".to_string(), "# Alpha".to_string()),
        ])
    }

    #[test]
    fn exact_path_beats_same_folder_and_relative_joins_folder() {
        let index = LinksIndex::new(docs().into_keys());
        // `[[Target]]` from sub/Sibling resolves to ROOT Target.md (step 9).
        assert_eq!(
            index.resolve("sub/Sibling.md", "Target").as_deref(),
            Some("Target.md")
        );
        // `[[./Target]]` from sub/Sibling resolves to sub/Target.md (step 8).
        assert_eq!(
            index.resolve("sub/Sibling.md", "./Target").as_deref(),
            Some("sub/Target.md")
        );
        // `[[../Alpha]]` climbs.
        assert_eq!(
            index.resolve("sub/Sibling.md", "../Alpha").as_deref(),
            Some("Alpha.md")
        );
        // A relative miss is unresolved (step 8 has no fallback).
        assert!(index.resolve("Target.md", "./Nothing").is_none());
    }

    #[test]
    fn aliases_never_resolve_and_keys_collapse_subpaths() {
        // The key normalizes the parsed occurrence (brackets already split).
        assert_eq!(unresolved_key("Missing#Head|Alias"), "Missing");
        assert_eq!(unresolved_key("Missing.md"), "Missing");
        assert_eq!(unresolved_key("ghost.png"), "ghost.png");
        let index = LinksIndex::new(docs().into_keys());
        assert_eq!(index.resolve("Alpha.md", "Bravo|Bee"), None);
    }

    #[test]
    fn raw_resolver_refuses_hash_texts_the_pipeline_strips() {
        let index = LinksIndex::new(docs().into_keys());
        // Pipeline: subpath stripped, empty → self.
        assert_eq!(
            index.resolve("Alpha.md", "#Section One").as_deref(),
            Some("Alpha.md")
        );
        // Raw (probe oracle): the `#…` text reaches lookup unstripped → null.
        assert_eq!(index.resolve_inner("Alpha.md", "#Head", false), None);
    }

    #[test]
    fn frontmatter_whole_wikilinks_count_and_partials_do_not() {
        let parsed =
            parse_document("---\nrelated: \"[[Alpha]]\"\nstatus: draft\n---\nbody [[Alpha]]");
        assert_eq!(parsed.frontmatter_links, vec!["Alpha".to_string()]);
        assert_eq!(parsed.links, vec!["Alpha".to_string()]);
        let partial = parse_document("---\nsee: text about [[Alpha]] inside\n---\n");
        assert!(partial.frontmatter_links.is_empty());
    }

    #[test]
    fn markdown_links_decode_and_reject_schemes() {
        let parsed = parse_document("[a](Alpha.md#Section%20One) [b](https://x.y) [c](Anchor)");
        assert_eq!(parsed.links.len(), 2);
        assert_eq!(parsed.links[0], "Alpha.md#Section One");
    }
}
