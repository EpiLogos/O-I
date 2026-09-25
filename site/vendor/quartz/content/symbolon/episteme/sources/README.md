---
title: "Return of Zero Source Bank"
source_id: sources-readme
page_type: source-bank-protocol
status: governing
record_type: register-domain
register: episteme
domain: sources
---

# Return of Zero Source Bank

Each recoverable work has one canonical file:

```text
<primary_domain>/<author>/<source_id>/<source_id>.md
```

That file holds the work's bibliographic identity, Chicago forms, source scholarship, quotes and excerpts, passage provenance, essay uses, reading material, and open acquisition work. Do not create parallel files for any of those functions.

## Domain and author filing (reorganized 2026-07-22)

Sources are filed by `primary_domain` — the work's own epistemic discipline (`physics`, `psychology`, `mathematics-logic`, `indian-philosophy`, and so on) — and then by author, so every work by one author sits in a single folder. This axis is deliberately independent of `submission-package/essay/symbolon/episteme/histories/`, which groups sources by how the essay *uses* them across registers; a source's discipline and its essay-usage are different facts, and a work commonly serves several histories from one disciplinary home. `primary_domain` is recorded in each house file's frontmatter and is the source of truth; the folder placement is a generated convenience derived from it, not the other way around — reclassifying a source is a frontmatter edit plus a re-file, not folder surgery. `internal-corpus/taylor/` holds Frank's own working documents and the derivational chat, which are provenance, not domain-classified public scholarship. Conversation houses under `internal-corpus/taylor/chat-logs/` are typed **`dialogue-record`**: provenance of thinking, **never evidence**. A dialogue record carries no citation or quotation authority; quotations of a dialogue are quotations of the conversation, never of the named works, and assistant-provided statements inside it are verification leads until they resolve to a real source record. The citation and quotation gates apply to dialogue records only by their absence.

Never hardcode a source's path by concatenating `sources/<source_id>/`. Resolve it with `tools/source_resolver.py` (`resolve_source_house`, `build_source_index`, `iter_source_houses`), which looks the source up by `source_id` regardless of nesting depth.

An optional sibling `<source_id>-NOTES.md` is Frank's free-form surface for his own reading, copied passages, questions, intentions, and insights. It needs no frontmatter or schema. Agents read it whenever they work with the source and never create or modify it. Its links and unfinished quotations are not verification debts, and generated projections ignore it. A quotation becomes usable only after independent verification and promotion into the house file; the original note remains untouched.

## Source identity

A source is one identifiable work, edition, article, transcript, website, dataset, archival object, or internal manuscript. People, traditions, concepts, analogies, and essay claims belong in argument or concept nodes. Keep metadata, edition, citation, and quotation readiness separate.

Use Chicago 18 Notes and Bibliography. Cite the exact edition consulted. A source may be citation-ready while none of its wording is quotation-ready.

## Passage status

- `unverified`: a lead only; do not quote.
- `source-matched`: the source object is identified; wording or locator remains unchecked.
- `locator-verified`: the passage is located; exact wording or context still needs checking.
- `quotation-ready`: wording, context, edition or version, locator, and provenance are verified.
- `paraphrase-only`: the source can support paraphrase, but the captured wording should not be quoted.
- `rejected`: the passage is misleading, misattributed, unstable, or unnecessary.

A quotation-ready passage records exact transcription, locator, edition or stable version, transcription method, verifier and date, source relation, and named consumer. Search snippets, recollection, unchecked OCR, and unverified secondary quotation cannot satisfy that state.

## Source relations

- **Extracted:** the source states or demonstrates it.
- **Paraphrased:** the essay restates the source within its scope.
- **Argued from:** the essay makes a further inference in its own voice.
- **Resonant with:** a cross-domain relation is drawn without attributing either side to the other.

The source deepens and tests the essay's operation; it does not grant the essay permission to possess its own derivation.

## Working route

1. Put an unresolved lead in [`source-intake-queue.md`](source-intake-queue.md) or the [research inbox](research-intake-inbox.md).
2. Identify the exact recoverable object and edition.
3. Decide the work's `primary_domain` and author, then create `sources/<primary_domain>/<author>/<source_id>/<source_id>.md` from [`sources/SOURCE-TEMPLATE.md`](SOURCE-TEMPLATE.md).
4. Add bibliography, scholarship, passages, provenance, and consumers directly to that file.
5. Rebuild `MAIN-SOURCES.md`, `SOURCE-INDEX.md`, and `PASSAGE-LEDGER.md` with `python3 tools/build-source-projections.py --project-root .`.
6. Run the projection check and workspace doctor.

The three generated projections are locators. They contain no canonical passage transcription and can always be rebuilt from the source files.

## Project-agent protection and retrieval

The project hook snapshots source-house `<source_id>-NOTES.md` files around agent write-capable tool calls and restores any agent mutation. This supplements the standing rule; it does not turn notes into canonical evidence or prevent Frank from editing them outside an agent tool call. Inspect the active hook definition with `/hooks` in Codex.

Retrieve a complete passage card without separating its wording from provenance:

```bash
python3 tools/project-agent-harness.py passage <passage-id> --json
```

Run the real-corpus hook and source-work journeys with:

```bash
python3 tools/project-agent-harness.py evaluate --project-root . --json
```
