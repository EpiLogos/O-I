//! Nara answers from your pages (manual §24.1, §24.2; T-WORLDS §6, W4): the person's own writing, selected for a concern and
//! delivered to Nara with each passage's exact source identity. QL composes it — `nara.lived-context.compose` of the Epi-Logos
//! agent's Nara faculty (QL crates/ql-mef/src/nara/lived_context.rs, `ql.nara-lived-context/v1`) — from what the kernel reads
//! from its owners, never from what a renderer says a page holds:
//!
//! - a Day: Central's own `central.document-reading/v1` reading of that Day's native document, passed exactly as Central
//!   returned it (`central.day.read`, central.rs `day_document`);
//! - a Flow page (a journal, a dream journal, any flow): read through Central's file owner (files.rs). A Flow page is no native
//!   contribution document — Central reads it as a file — so its entries and journal pages go to QL as lived entries the host
//!   mapped (QL's `LivedEntry`), each under the page's source and file revision, the entry's id, who wrote it (a person or an
//!   agent, by the Flow's own participants) and when. A dream journal's passages are dreams (`MaterialKind::Dream`), a journal's
//!   journal; a correction names the passage it corrects, and both stay;
//! - a journey: the state its page keeps (nara_journey.rs), so its live cards and its basis select passages too.
//!
//! Nara keeps no second journal (QL K10 §1): this composes, it never writes. A Day that cannot be read is named as unread with
//! its owner's words; a page the person chose that cannot be read refuses the whole.
use crate::files::{self, Location};
use crate::flow::CentralClient;
use crate::page;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeSet;
use std::path::Path;

/// QL's bound on one passage's text (lived_context.rs `MAX_PASSAGE_TEXT`).
const MAX_PASSAGE: usize = 64 * 1024;
const MAX_PAGES: usize = 32;
const MAX_TERMS: usize = 32;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Concern {
    pub concern_ref: String,
    pub title: String,
    /// The words the person uses for it (QL selects a passage that uses one).
    #[serde(default)]
    pub terms: Vec<String>,
}

/// Which practice a page keeps: its passages' material kind (QL `MaterialKind`).
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Practice {
    #[default]
    Flow,
    Journal,
    Dreams,
}

impl Practice {
    fn kind(self) -> &'static str {
        match self {
            Practice::Flow => "flow",
            Practice::Journal => "journal",
            Practice::Dreams => "dream",
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct PageSelection {
    pub location: Location,
    #[serde(default)]
    pub practice: Practice,
    /// Only these entries (an entry's id, or `journal:<id>` for a journal page); none: every passage of the page.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub entries: Option<Vec<String>>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct DaySelection {
    /// A Day by its ref; none: today's.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub day_ref: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Budget {
    pub max_passages: usize,
    pub max_chars: usize,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(tag = "operation", rename_all = "snake_case", deny_unknown_fields)]
pub enum Request {
    Compose {
        subject_ref: String,
        concern: Concern,
        #[serde(default)]
        pages: Vec<PageSelection>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        day: Option<DaySelection>,
        /// A journey's page: its state joins the composition (its concern must be the concern asked).
        #[serde(default, skip_serializing_if = "Option::is_none")]
        journey: Option<Location>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        budget: Option<Budget>,
        /// The person's consent receipt the passages are disclosed through.
        disclosed_via_ref: String,
    },
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as u64)
        .unwrap_or(0)
}

/// An entry's words without its formatting (QL lived_context.rs `strip_html`: a tag is a space, entities read, runs of space
/// one).
pub(crate) fn plain(html: &str) -> String {
    let mut out = String::with_capacity(html.len());
    let mut in_tag = false;
    for c in html.chars() {
        match c {
            '<' => in_tag = true,
            '>' if in_tag => {
                in_tag = false;
                out.push(' ');
            }
            _ if !in_tag => out.push(c),
            _ => {}
        }
    }
    let decoded = out
        .replace("&nbsp;", " ")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&amp;", "&");
    decoded.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn ms(at: &Value) -> u64 {
    at.as_str()
        .and_then(|at| at.parse::<jiff::Timestamp>().ok())
        .map(|at| at.as_millisecond().max(0) as u64)
        .unwrap_or(0)
}

/// Who wrote an entry, by the Flow's own participants (flow/plural.ts `authorOf`, instance.ts `participantOf`): its author key
/// exactly, else its initial as the form reads it — a declared participant, else F the person and any other initial an agent.
/// A person's writing is human, an agent's an agent's; the ref is the participant's bound identity, else the participant.
fn author(island: &Value, entry: &Value) -> (&'static str, String) {
    let participants = island["meta"]["participants"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    let initial = entry["author"].as_str().unwrap_or("F");
    let found = match entry["authorKey"].as_str() {
        Some(key) => participants.iter().find(|p| p["key"] == key),
        None => participants.iter().find(|p| p["initial"] == initial),
    };
    match found {
        Some(p) => {
            let actor = if p["kind"] == "agent" {
                "agent"
            } else {
                "human"
            };
            let bound = [&p["binding"]["ref"], &p["ref"]]
                .into_iter()
                .find_map(|r| r.as_str().filter(|r| !r.trim().is_empty()))
                .map(str::to_owned);
            let named = p["key"].as_str().unwrap_or(initial);
            (
                actor,
                bound.unwrap_or_else(|| format!("participant:{named}")),
            )
        }
        None if initial == "F" => ("human", "participant:F".into()),
        None => ("agent", format!("participant:{initial}")),
    }
}

/// QL's passage identity (`LivedEntry::key`): source, document-local address, revision.
fn key(source_ref: &str, document: Option<&str>, entry: &str, revision: &str) -> String {
    let mut address = String::new();
    for part in [document, Some(entry)].into_iter().flatten() {
        address.push('/');
        address.push_str(part);
    }
    format!("{source_ref}{address}@{revision}")
}

/// A passage of a page before it is mapped: its address in the page (an entry's id, or `journal:<id>`), its HTML, when it was
/// written, who wrote it (actor and ref), and the entry it corrects.
type Candidate = (
    String,
    String,
    Value,
    (&'static str, String),
    Option<String>,
);

/// One page's passages as QL's lived entries: its entries and its journal pages, each under the page's source and revision.
fn page_entries(
    reading: &files::Reading,
    island: &Value,
    selection: &PageSelection,
    skipped: &mut Vec<Value>,
) -> Result<Vec<Value>, String> {
    let source_ref = reading
        .source
        .as_ref()
        .map(|source| source.source_ref.clone())
        .unwrap_or_else(|| reading.location.ref_id.clone());
    let revision = reading.revision.as_str();
    let document = island["meta"]["documentId"]
        .as_str()
        .filter(|id| !id.is_empty());
    let kind = selection.practice.kind();
    let entries = island["entries"].as_array().cloned().unwrap_or_default();
    let journal = island["journal"].as_array().cloned().unwrap_or_default();
    let person = island["meta"]["participants"]
        .as_array()
        .and_then(|ps| {
            ps.iter()
                .find(|p| p["kind"] == "person" && p["left"].is_null())
        })
        .cloned();
    let mut candidates: Vec<Candidate> = Vec::new();
    for entry in &entries {
        let Some(id) = entry["id"].as_str() else {
            continue;
        };
        let corrects = entry["relations"].as_array().and_then(|relations| {
            relations
                .iter()
                .find(|r| r["type"] == "correct")
                .and_then(|r| r["entryId"].as_str().map(str::to_owned))
        });
        candidates.push((
            id.to_owned(),
            entry["html"].as_str().unwrap_or_default().to_owned(),
            entry["at"].clone(),
            author(island, entry),
            corrects,
        ));
    }
    for leaf in &journal {
        let Some(id) = leaf["id"].as_str() else {
            continue;
        };
        let writer = match &person {
            Some(p) => author(
                island,
                &json!({"authorKey": p["key"], "author": p["initial"]}),
            ),
            None => ("human", "participant:F".into()),
        };
        candidates.push((
            format!("journal:{id}"),
            leaf["html"].as_str().unwrap_or_default().to_owned(),
            leaf["at"].clone(),
            writer,
            None,
        ));
    }
    if let Some(only) = &selection.entries {
        for wanted in only {
            if !candidates.iter().any(|candidate| &candidate.0 == wanted) {
                return Err(format!(
                    "The page {} holds no entry {wanted}",
                    reading.location.path
                ));
            }
        }
        candidates.retain(|candidate| only.contains(&candidate.0));
    }
    let included: BTreeSet<String> = candidates.iter().map(|c| c.0.clone()).collect();
    let mut lived = Vec::new();
    for (address, html, at, (actor, author_ref), corrects) in candidates {
        let text = plain(&html);
        if text.is_empty() {
            continue;
        }
        let passage = key(&source_ref, document, &address, revision);
        if text.len() > MAX_PASSAGE {
            skipped
                .push(json!({"key": passage, "why": "longer than one passage QL reads (64 KiB)"}));
            continue;
        }
        let at = ms(&at);
        lived.push(json!({"source_ref": source_ref, "revision": revision, "document_id": document,
            "entry_id": address, "contribution_id": null, "selector": null, "kind": kind, "actor": actor,
            "author_ref": author_ref, "mode": "current", "text": text, "day_ref": null,
            "occurred_at_unix_ms": at, "received_at_unix_ms": at,
            "corrects": corrects.filter(|target| included.contains(target)).map(|target| key(&source_ref, document, &target, revision)),
            "unreviewed_revision": false}));
    }
    Ok(lived)
}

fn check(
    subject_ref: &str,
    concern: &Concern,
    pages: &[PageSelection],
    day: &Option<DaySelection>,
    budget: &Budget,
    disclosed_via_ref: &str,
) -> Result<(), String> {
    if subject_ref.trim().is_empty() || disclosed_via_ref.trim().is_empty() {
        return Err("Nara reads your pages only for you, through your consent: name both".into());
    }
    if concern.concern_ref.trim().is_empty() || concern.title.trim().is_empty() {
        return Err("Name what Nara is asked about: its concern and its title".into());
    }
    if concern.terms.len() > MAX_TERMS
        || concern
            .terms
            .iter()
            .any(|term| term.trim().is_empty() || term.chars().count() > 240)
    {
        return Err(format!(
            "A concern carries at most {MAX_TERMS} words, each 1 to 240 characters"
        ));
    }
    if pages.is_empty() && day.is_none() {
        return Err("Choose the pages, or the Day, Nara answers from".into());
    }
    if pages.len() > MAX_PAGES {
        return Err(format!("Nara reads at most {MAX_PAGES} pages at once"));
    }
    if !(1..=64).contains(&budget.max_passages) || !(1..=64_000).contains(&budget.max_chars) {
        return Err("A budget is 1 to 64 passages and 1 to 64,000 characters".into());
    }
    Ok(())
}

/// The op, on the installed QL.
pub fn execute(client: &CentralClient, request: &Request) -> Result<Value, String> {
    execute_with(client, None, request)
}

/// The op, on a selected QL executable (`None`: the installed suite).
pub(crate) fn execute_with(
    client: &CentralClient,
    owner: Option<&Path>,
    request: &Request,
) -> Result<Value, String> {
    let Request::Compose {
        subject_ref,
        concern,
        pages,
        day,
        journey,
        budget,
        disclosed_via_ref,
    } = request;
    let budget = budget.clone().unwrap_or(Budget {
        max_passages: 12,
        max_chars: 20_000,
    });
    check(subject_ref, concern, pages, day, &budget, disclosed_via_ref)?;
    let mut entries = Vec::new();
    let mut skipped = Vec::new();
    let mut sources = Vec::new();
    let mut unread = Vec::new();
    for selection in pages {
        let reading = files::read(client, &selection.location)?;
        let island = page::read_island(&reading.content)?;
        if page::form_of(&island) != "flow" {
            return Err(format!(
                "Nara answers from your Flow pages: {} is no Flow",
                selection.location.path
            ));
        }
        entries.extend(page_entries(&reading, &island, selection, &mut skipped)?);
        sources.push(
            json!({"location": selection.location, "revision": reading.revision,
            "practice": selection.practice, "title": island["meta"]["title"]}),
        );
    }
    let mut documents = Vec::new();
    if let Some(day) = day {
        match crate::central::day(client, None, day.day_ref.as_deref())
            .and_then(|reading| crate::central::day_document(&reading).cloned())
        {
            Ok(document) => {
                sources.push(
                    json!({"day_ref": document["document"]["day_ref"], "source": document["source"],
                    "revision": document["revision"]}),
                );
                documents.push(document);
            }
            Err(why) => unread.push(json!({"day_ref": day.day_ref, "why": why})),
        }
    }
    let journey = match journey {
        Some(location) => {
            let reading = files::read(client, location)?;
            let island = page::read_island(&reading.content)?;
            let held = island["meta"]["journey"].clone();
            if !held.is_object() {
                return Err(format!(
                    "The page {} holds no journey to answer within",
                    location.path
                ));
            }
            sources.push(json!({"location": location, "revision": reading.revision, "journey_ref": held["journey_ref"]}));
            held
        }
        None => Value::Null,
    };
    let input = json!({"subject_ref": subject_ref, "concern": concern, "occasion": null, "documents": documents,
        "entries": entries, "journey": journey, "budget": budget, "disclosed_via_ref": disclosed_via_ref,
        "composed_at_unix_ms": now_ms()});
    let context =
        crate::nara_identity::run_ql_epi_agent(owner, "nara.lived-context.compose", &input)?;
    if context["schema"] != "ql.nara-lived-context/v1" || context["subject_ref"] != *subject_ref {
        return Err("QL composed another person's context, or none".into());
    }
    Ok(
        json!({"schema": "oi.nara-lived-context/v1", "context": context, "sources": sources, "unread": unread,
        "skipped": skipped}),
    )
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use crate::nara_journey::stub::{flow_page, Stub};

    fn concern() -> Concern {
        Concern {
            concern_ref: "concern:move".into(),
            title: "What the move asks".into(),
            terms: vec!["move".into()],
        }
    }

    fn journal() -> Value {
        json!({"meta": {"documentId": "doc-j", "title": "Journal", "revision": 4,
            "participants": [{"key": "p-f", "initial": "F", "kind": "person", "name": "Frank", "binding": {"owner": "document", "ref": "", "basis": "unknown"}},
                {"key": "p-n", "initial": "N", "kind": "agent", "name": "Nara", "ref": "agent-session/nara-1"}]},
            "entries": [
                {"id": "e1", "author": "F", "authorKey": "p-f", "at": "2026-10-17T07:00:00Z", "html": "<p>The <b>move</b> &amp; the river.</p>"},
                {"id": "e2", "author": "N", "authorKey": "p-n", "at": "2026-10-17T07:05:00Z", "html": "<p>What does the river carry?</p>"},
                {"id": "e3", "author": "F", "authorKey": "p-f", "at": "2026-10-17T08:00:00Z", "html": "<p>Not the river: the road.</p>",
                    "relations": [{"type": "correct", "entryId": "e1"}]},
                {"id": "e4", "author": "F", "authorKey": "p-f", "at": "2026-10-17T09:00:00Z", "html": "<p> </p>"}],
            "journal": [{"id": "j1", "at": "2026-10-18T06:30:00Z", "html": "<p>Woke early.</p>"}],
            "notes": []})
    }

    fn compose(pages: Vec<PageSelection>, day: Option<DaySelection>) -> Request {
        Request::Compose {
            subject_ref: "person:frank".into(),
            concern: concern(),
            pages,
            day,
            journey: None,
            budget: None,
            disclosed_via_ref: "consent:answer-this".into(),
        }
    }

    #[test]
    fn a_page_s_passages_reach_ql_under_its_revision_with_their_writers_and_corrections() {
        let stub = Stub::new("lived-page");
        let at = stub.put("Control/user/flows/journal.html", &flow_page(journal()));
        let revision = stub.revision(&at);
        let answer = execute_with(
            &stub.client,
            Some(&stub.owner),
            &compose(
                vec![PageSelection {
                    location: at.clone(),
                    practice: Practice::Journal,
                    entries: None,
                }],
                None,
            ),
        )
        .unwrap();
        assert_eq!(answer["schema"], "oi.nara-lived-context/v1");
        assert_eq!(answer["sources"][0]["revision"], json!(revision));
        let asked = stub.asked("nara.lived-context.compose");
        let lived = asked["entries"].as_array().unwrap();
        assert_eq!(
            lived.len(),
            4,
            "three entries with words and one journal page; the empty entry is no passage"
        );
        assert_eq!(lived[0]["text"], "The move & the river.");
        assert_eq!(lived[0]["kind"], "journal");
        assert_eq!(lived[0]["actor"], "human");
        assert_eq!(
            lived[0]["author_ref"], "participant:p-f",
            "an unbound person is named by their seat"
        );
        assert_eq!(lived[0]["revision"], json!(revision));
        assert_eq!(
            lived[0]["source_ref"],
            "ref:Control/user/flows/journal.html"
        );
        assert_eq!(lived[1]["actor"], "agent");
        assert_eq!(lived[1]["author_ref"], "agent-session/nara-1");
        assert_eq!(
            lived[2]["corrects"],
            json!(format!(
                "ref:Control/user/flows/journal.html/doc-j/e1@{revision}"
            )),
            "a correction names what it corrects; both stay"
        );
        assert_eq!(lived[3]["entry_id"], "journal:j1");
        assert_eq!(
            lived[3]["occurred_at_unix_ms"],
            json!(1_792_305_000_000_u64)
        );
        assert_eq!(asked["documents"], json!([]));
        assert_eq!(
            asked["budget"],
            json!({"max_passages": 12, "max_chars": 20000})
        );
        assert_eq!(
            answer["context"]["passages"][0]["key"],
            json!(format!(
                "ref:Control/user/flows/journal.html/doc-j/e1@{revision}"
            ))
        );
    }

    #[test]
    fn a_dream_journal_s_passages_are_dreams_and_a_chosen_entry_narrows_the_page() {
        let stub = Stub::new("lived-dreams");
        let at = stub.put("Control/user/flows/dreams.html", &flow_page(journal()));
        execute_with(
            &stub.client,
            Some(&stub.owner),
            &compose(
                vec![PageSelection {
                    location: at.clone(),
                    practice: Practice::Dreams,
                    entries: Some(vec!["e3".into()]),
                }],
                None,
            ),
        )
        .unwrap();
        let lived = stub.asked("nara.lived-context.compose")["entries"].clone();
        assert_eq!(lived.as_array().unwrap().len(), 1);
        assert_eq!(lived[0]["kind"], "dream");
        assert_eq!(
            lived[0]["corrects"],
            Value::Null,
            "a correction of a passage not chosen names nothing QL cannot find"
        );
        let missing = execute_with(
            &stub.client,
            Some(&stub.owner),
            &compose(
                vec![PageSelection {
                    location: at,
                    practice: Practice::Dreams,
                    entries: Some(vec!["e9".into()]),
                }],
                None,
            ),
        );
        assert!(missing.unwrap_err().contains("holds no entry e9"));
    }

    #[test]
    fn the_day_goes_to_ql_exactly_as_central_read_it_or_is_named_unread() {
        let stub = Stub::new("lived-day");
        let document = json!({"schema": "central.document-reading/v1", "source": {"ref": "central:source:control:root:Control/user/day/2026-10-18/day.md", "path": "Control/user/day/2026-10-18/day.md"},
            "revision": {"revision": "d-1"}, "document_id": "doc:day", "document": {"document_id": "doc:day", "kind": "day", "day_ref": "central:day:control:root:2026-10-18", "contributions": []},
            "unreviewed_external_revision": false});
        std::fs::write(stub.home.join("day.json"), json!({"schema": "central.day-reading/v1", "automatic_agent_or_model_invocation": false,
            "day_ref": "central:day:control:root:2026-10-18", "temporal": {"civil_date": "2026-10-18"}, "document_state": "ready",
            "source": {"ref": "central:source:control:root:Control/user/day/2026-10-18/day.md"}, "revision": {"revision": "d-1"}, "document": document}).to_string()).unwrap();
        let answer = execute_with(
            &stub.client,
            Some(&stub.owner),
            &compose(vec![], Some(DaySelection::default())),
        )
        .unwrap();
        assert_eq!(
            stub.asked("nara.lived-context.compose")["documents"],
            json!([document]),
            "verbatim"
        );
        assert_eq!(answer["unread"], json!([]));
        std::fs::write(stub.home.join("day.json"), json!({"schema": "central.day-reading/v1", "automatic_agent_or_model_invocation": false,
            "day_ref": "central:day:control:root:2026-10-18", "temporal": {"civil_date": "2026-10-18"}, "document_state": "uninitialised"}).to_string()).unwrap();
        let at = stub.put("Control/user/flows/journal.html", &flow_page(journal()));
        let answer = execute_with(
            &stub.client,
            Some(&stub.owner),
            &compose(
                vec![PageSelection {
                    location: at,
                    practice: Practice::Flow,
                    entries: None,
                }],
                Some(DaySelection::default()),
            ),
        )
        .unwrap();
        assert!(answer["unread"][0]["why"]
            .as_str()
            .unwrap()
            .contains("no native document"));
        assert_eq!(
            stub.asked("nara.lived-context.compose")["documents"],
            json!([])
        );
    }

    #[test]
    fn a_request_without_pages_consent_or_a_bounded_concern_is_refused_before_any_owner_is_asked() {
        let stub = Stub::new("lived-refused");
        for (request, said) in [
            (compose(vec![], None), "pages, or the Day"),
            (
                Request::Compose {
                    subject_ref: "person:frank".into(),
                    concern: concern(),
                    pages: vec![],
                    day: Some(DaySelection::default()),
                    journey: None,
                    budget: None,
                    disclosed_via_ref: " ".into(),
                },
                "through your consent",
            ),
            (
                Request::Compose {
                    subject_ref: "person:frank".into(),
                    concern: Concern {
                        terms: vec!["".into()],
                        ..concern()
                    },
                    pages: vec![],
                    day: Some(DaySelection::default()),
                    journey: None,
                    budget: None,
                    disclosed_via_ref: "consent:x".into(),
                },
                "1 to 240",
            ),
        ] {
            let error = execute_with(&stub.client, Some(&stub.owner), &request).unwrap_err();
            assert!(error.contains(said), "{error}");
        }
        assert_eq!(stub.log(), "", "no owner was asked");
        assert_eq!(plain("<p>a&nbsp;<i>b</i></p>\n<p>c</p>"), "a b c");
    }
}
