---
record_type: versioned-software-documentation
source_role:
- technical-primary
- formal-mechanism
- qualifying-source
citation_style: chicago-notes-bibliography-18
metadata_status: verified
edition_status: selected
citation_status: citation-ready
quote_status: quotation-ready
chicago_ready: true
author:
- PyTorch Contributors
title_full: 'PyTorch 2.9 API Documentation: torch.nn.functional.softmax and torch.argmax'
publisher: PyTorch Foundation
year: 2025
version: '2.9'
url: https://docs.pytorch.org/docs/2.9/generated/torch.nn.functional.softmax.html
related_url: https://docs.pytorch.org/docs/2.9/generated/torch.argmax.html
accessed: '2026-07-14'
consumed_by_sections:
- §5
- 38-s5-p1-apoha-softmax
consumed_by_arguments:
- '[[Immutable Gap and Meta-Sign]]'
- '[[Paradox as Cross-Register Hinge]]'
tags:
- epi-logos/antikythera-essay
- source-bank/record
- source-bank/machine-learning
title: PyTorch — Softmax and Argmax API (v2.9)
aliases:
- PyTorch — Softmax and Argmax API (v2.9)
source_id: pytorch-2-9-softmax-argmax-api
primary_domain: computer-science-ml
node_type: source-house
ownership: canonical-source-house
schema_version: 1
passage_surface: '#passages'
main_source_for:
- §5 · exact softmax and argmax mechanism
---
# PyTorch — Softmax and Argmax API (v2.9)

## Chicago 18 forms

**Full note:** PyTorch Contributors, “torch.nn.functional.softmax” and “torch.argmax,” *PyTorch 2.9 API Documentation*, accessed July 14, 2026, https://docs.pytorch.org/docs/2.9/generated/torch.nn.functional.softmax.html and https://docs.pytorch.org/docs/2.9/generated/torch.argmax.html.

**Shortened note:** PyTorch Contributors, “Softmax and Argmax API.”

**Bibliography:** PyTorch Contributors. “torch.nn.functional.softmax” and “torch.argmax.” *PyTorch 2.9 API Documentation*. Accessed July 14, 2026. https://docs.pytorch.org/docs/2.9/generated/torch.nn.functional.softmax.html; https://docs.pytorch.org/docs/2.9/generated/torch.argmax.html.

## Essay use

The selected release-specific API pages define a normalising softmax operation and an index-selection argmax operator, including an explicit tie rule. They are a formal carrier for M38 only.

**Claim boundary:** these pages do not identify a deployed LLM runtime, establish sampling or greedy decoding in that runtime, make an index semantically meaningful, or support apoha, QL, or subjectivity.

## Passage preparation

Exact text and consumer mappings: [Quotes — PyTorch Softmax and Argmax API (v2.9)](#passages).

<a id="passages"></a>
## Passages and excerpts

### Material metadata

- **Edition consulted:** PyTorch 2.9 API Documentation, torch.nn.functional.softmax and torch.argmax, version-fixed official HTML pages.
- **Access provenance:** Official PyTorch 2.9 rendered API documentation; manually inspected 2026-07-14.

<a id="pytorch-2-9-softmax-argmax-api-q001"></a>
## Passage card — `pytorch-2-9-softmax-argmax-api-q001` — Softmax normalises a selected dimension
^pytorch-2-9-softmax-argmax-api-q001

> “It is applied to all slices along dim, and will re-scale them so that the elements lie in the range [0, 1] and sum to 1.”

- **Locator:** PyTorch 2.9 `torch.nn.functional.softmax`, function description immediately after displayed definition.
- **Status:** quotation-ready.
- **Verification:** Luna acquisition agent and coordinator, 2026-07-14; manually transcribed from official rendered HTML; OCR uncertainty: none.
- **Source relation:** extracted primary software documentation.
- **Evidential action:** supports.
- **Argument function:** softmax normalisation mechanism.
- **Consumers:** [[38-s5-p1-apoha-softmax]]; [[section-rooms/arguments/A03-Immutable-Gap-Formal-Limit|Immutable Gap and Meta-Sign]].
- **Use boundary:** establishes a tensor operation only; it does not establish that an LLM uses PyTorch, uses this operation at decoding, or has meaning, apoha, or subjectivity.

<a id="pytorch-2-9-softmax-argmax-api-q002"></a>
## Passage card — `pytorch-2-9-softmax-argmax-api-q002` — Argmax returns maximum indices
^pytorch-2-9-softmax-argmax-api-q002

> “Returns the indices of the maximum values of a tensor across a dimension.”

- **Locator:** PyTorch 2.9 `torch.argmax`, `torch.argmax(input, dim, keepdim=False)` description.
- **Status:** quotation-ready.
- **Verification:** Luna acquisition agent and coordinator, 2026-07-14; manually transcribed from official rendered HTML; OCR uncertainty: none.
- **Source relation:** extracted primary software documentation.
- **Evidential action:** supports.
- **Argument function:** deterministic index-selection operation.
- **Consumers:** [[38-s5-p1-apoha-softmax]]; [[section-rooms/arguments/concepts/C64-Paradox-Transforming-the-Containing-Field|Paradox as Cross-Register Hinge]].
- **Use boundary:** establishes a library operator only; it does not establish that a named model uses greedy argmax rather than sampling, or that output is a meaningful mark.

<a id="pytorch-2-9-softmax-argmax-api-q003"></a>
## Passage card — `pytorch-2-9-softmax-argmax-api-q003` — Tie-handling limit
^pytorch-2-9-softmax-argmax-api-q003

> “If there are multiple maximal values then the indices of the first maximal value are returned.”

- **Locator:** PyTorch 2.9 `torch.argmax`, note directly after the all-elements form.
- **Status:** quotation-ready.
- **Verification:** Luna acquisition agent and coordinator, 2026-07-14; manually transcribed from official rendered HTML; OCR uncertainty: none.
- **Source relation:** extracted primary software documentation.
- **Evidential action:** qualifies.
- **Argument function:** tie-handling scope limitation.
- **Consumers:** [[38-s5-p1-apoha-softmax]]; [[section-rooms/arguments/A03-Immutable-Gap-Formal-Limit|Immutable Gap and Meta-Sign]]; [[section-rooms/arguments/concepts/C64-Paradox-Transforming-the-Containing-Field|Paradox as Cross-Register Hinge]].
- **Use boundary:** establishes a deterministic library tie rule; it does not establish preference, semantic exclusion, or a specific system’s decode policy.
### Passage metadata register

These source-specific fields were gathered before consolidation and remain part of this source's evidence record.

| `pytorch-2-9-softmax-argmax-api-q001` | `pytorch-2-9-softmax-argmax-api` | PyTorch 2.9 softmax page, function description | quotation-ready | `38-s5-p1-apoha-softmax` | [[section-rooms/arguments/A03-Immutable-Gap-Formal-Limit|Immutable Gap and Meta-Sign]] | softmax normalisation | [Quotes — PyTorch Softmax and Argmax API (v2.9)](#passages) |

| `pytorch-2-9-softmax-argmax-api-q002` | `pytorch-2-9-softmax-argmax-api` | PyTorch 2.9 argmax page, dim form | quotation-ready | `38-s5-p1-apoha-softmax` | [[section-rooms/arguments/concepts/C64-Paradox-Transforming-the-Containing-Field|Paradox as Cross-Register Hinge]] | deterministic index selection | [Quotes — PyTorch Softmax and Argmax API (v2.9)](#passages) |

| `pytorch-2-9-softmax-argmax-api-q003` | `pytorch-2-9-softmax-argmax-api` | PyTorch 2.9 argmax page, tie note | quotation-ready | `38-s5-p1-apoha-softmax` | [[section-rooms/arguments/A03-Immutable-Gap-Formal-Limit|Immutable Gap and Meta-Sign]]; [[section-rooms/arguments/concepts/C64-Paradox-Transforming-the-Containing-Field|Paradox as Cross-Register Hinge]] | tie-handling limitation | [Quotes — PyTorch Softmax and Argmax API (v2.9)](#passages) |
