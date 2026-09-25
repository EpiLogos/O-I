---
record_type: conference-paper
source_role:
- technical-primary
- machine-learning
citation_style: chicago-notes-bibliography-18
metadata_status: verified
edition_status: not-applicable
citation_status: citation-ready
quote_status: quotation-ready
chicago_ready: true
author:
- Ashish Vaswani
- Noam Shazeer
- Niki Parmar
- Jakob Uszkoreit
- Llion Jones
- Aidan N. Gomez
- Łukasz Kaiser
- Illia Polosukhin
title_full: Attention Is All You Need
container_title: Advances in Neural Information Processing Systems 30
pages: 5998–6008
year: 2017
url: https://proceedings.neurips.cc/paper_files/paper/2017/hash/3f5ee243547dee91fbd053c1c4a845aa-Paper.pdf
publisher_record_url: https://proceedings.neurips.cc/paper_files/paper/2017/hash/3f5ee243547dee91fbd053c1c4a845aa-Abstract.html
accessed: '2026-07-14'
consumed_by_sections:
- §5
- 37-s5-p0-math-moves-meaning
- 38-s5-p1-apoha-softmax
consumed_by_arguments:
- '[[Artificial Hybrid Intelligence as Reflective Field]]'
- '[[Computational Process Ontology]]'
- '[[Immutable Gap and Meta-Sign]]'
- '[[Paradox as Cross-Register Hinge]]'
tags:
- epi-logos/antikythera-essay
- source-bank/record
- source-bank/machine-learning
title: Vaswani et al. — Attention Is All You Need (2017)
aliases:
- Vaswani et al. — Attention Is All You Need (2017)
source_id: vaswani-et-al-2017-attention
primary_domain: computer-science-ml
node_type: source-house
ownership: canonical-source-house
schema_version: 1
passage_surface: '#passages'
main_source_for:
- §5 · transformer and attention baseline
---
# Vaswani et al. — Attention Is All You Need (2017)

## Bibliographic identity

The NeurIPS proceedings page identifies the conference version and author list. The public proceedings object is the consulted version; its associated paper PDF is the stable text carrier for future locators.

## Chicago 18 forms

**Full note:** Ashish Vaswani et al., “Attention Is All You Need,” in *Advances in Neural Information Processing Systems 30* (2017): 5998–6008, {page}, https://proceedings.neurips.cc/paper_files/paper/2017/hash/3f5ee243547dee91fbd053c1c4a845aa-Paper.pdf.

**Shortened note:** Vaswani et al., “Attention Is All You Need,” {page}.

**Bibliography:** Vaswani, Ashish, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N. Gomez, Łukasz Kaiser, and Illia Polosukhin. “Attention Is All You Need.” In *Advances in Neural Information Processing Systems 30*, 5998–6008. 2017. https://proceedings.neurips.cc/paper_files/paper/2017/hash/3f5ee243547dee91fbd053c1c4a845aa-Paper.pdf.

## Essay use

### Source's relevant contribution

- Primary technical description of the Transformer architecture, offered as a source for actual attention-based token processing before the essay develops any QL analogy.

### Licensed essay use

- Establish the specific architectural claim that the paper proposes an attention-based sequence-transduction model without recurrence or convolution.
- Use as a technical precursor to §5's account of differentiated token relations. Subjectivity, phenomenality, and QL require separate evidence and argument.

### Claim boundary

- The paper describes a model architecture and empirical translation results. Any connection to apoha, differential fields, or `0/1` is the essay's argued interpretation and must remain labelled as such.

## Consumption

- **Stations:** §5.
- **Arguments:** [[section-rooms/arguments/A32-Reflective-Field-The-Mirror-That-Moves-First|Artificial Hybrid Intelligence as Reflective Field]]; [[section-rooms/arguments/A14-Computational-Process-Ontology|Computational Process Ontology]].
- **Exact claims:** attention-based sequence modelling; technical mechanism must precede metaphor in the account of LLM operations.

## Quote and excerpt ledger

| quote_id | exact text / excerpt file | locator | transcription | verification | consuming claim |
|---|---|---|---|---|---|
| `vaswani-et-al-2017-attention-q001` | [Quote Intake — Vaswani et al. (2017)](#passages) | PDF p. 1 / proceedings p. 5998, Abstract | direct | `quotation-ready` | §5/#0 architecture baseline |
| `vaswani-et-al-2017-attention-q002` | [Quote Intake — Vaswani et al. (2017)](#passages) | PDF p. 4 / proceedings p. 6001, §3.2.1 | direct | `quotation-ready` | §5/#1 softmax mechanism |

## Passage preparation

The verified passage cards below contain the exact text and the two scope-limiting cards checked against the official PDF.

## Provenance and acquisition

- **Metadata source:** NeurIPS proceedings record, URL above, checked 2026-07-14.
- **Text consulted:** official NeurIPS proceedings PDF; pp. 1 and 4 checked directly against the stable PDF on 2026-07-14.
- **Local copy:** none.
- **Last checked:** 2026-07-14.

## Research notes

This record is quotation-ready for the two passages listed above. Its licensed scope is attention-based sequence transformation. Claims about argmax, apoha, consciousness, or QL remain separately bounded and require their own sources.

<a id="passages"></a>
## Passages and excerpts

### Material metadata

- **Edition consulted:** Ashish Vaswani et al., ‘Attention Is All You Need,’ Advances in Neural Information Processing Systems 30 (2017): 5998–6008, official NeurIPS proceedings PDF.
- **Access provenance:** Official NeurIPS proceedings PDF; manually inspected 2026-07-14.

<a id="vaswani-et-al-2017-attention-q001"></a>
## Passage card — `vaswani-et-al-2017-attention-q001` — Attention-only sequence architecture
^vaswani-et-al-2017-attention-q001

> “We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.”

- **Locator:** Official NeurIPS PDF p. 1; proceedings p. 5998; Abstract.
- **Status:** quotation-ready.
- **Verification:** Luna acquisition agent and coordinator, 2026-07-14; manually transcribed and visually checked from official born-digital PDF; OCR uncertainty: none.
- **Source relation:** extracted primary technical formulation.
- **Evidential action:** supports.
- **Argument function:** attention-based architecture baseline.
- **Consumers:** [[37-s5-p0-math-moves-meaning]]; [[section-rooms/arguments/A14-Computational-Process-Ontology|Computational Process Ontology]].
- **Use boundary:** establishes the Transformer architecture only; it does not establish tool use, lived meaning, an external action field, QL, or a phenomenal subject.

<a id="vaswani-et-al-2017-attention-q002"></a>
## Passage card — `vaswani-et-al-2017-attention-q002` — Scaled softmax attention weights
^vaswani-et-al-2017-attention-q002

> “We compute the dot products of the query with all keys, divide each by √dk, and apply a softmax function to obtain the weights on the values.”

- **Locator:** Official NeurIPS PDF p. 4; proceedings p. 6001; §3.2.1 “Scaled Dot-Product Attention.”
- **Status:** quotation-ready.
- **Verification:** Luna acquisition agent and coordinator, 2026-07-14; manually transcribed and visually checked from official born-digital PDF; OCR uncertainty: none.
- **Source relation:** extracted primary technical formulation.
- **Evidential action:** supports.
- **Argument function:** attention normalisation mechanism.
- **Consumers:** [[38-s5-p1-apoha-softmax]]; [[section-rooms/arguments/A14-Computational-Process-Ontology|Computational Process Ontology]].
- **Use boundary:** establishes a specific attention weighting mechanism; it does not establish argmax, a deployed decoding policy, apoha, or QL.

<a id="vaswani-et-al-2017-attention-q003"></a>
## Passage card — `vaswani-et-al-2017-attention-q003` — Transformer evaluation scope
^vaswani-et-al-2017-attention-q003

> “Experiments on two machine translation tasks show these models to be superior in quality while being more parallelizable and requiring significantly less time to train.”

- **Locator:** Official NeurIPS PDF p. 1; proceedings p. 5998; Abstract.
- **Status:** quotation-ready.
- **Verification:** Luna acquisition agent and coordinator, 2026-07-14; manually transcribed and visually checked from official born-digital PDF; OCR uncertainty: none.
- **Source relation:** extracted primary technical formulation.
- **Evidential action:** qualifies.
- **Argument function:** empirical-scope limitation.
- **Consumers:** [[37-s5-p0-math-moves-meaning]]; [[section-rooms/arguments/A03-Immutable-Gap-Formal-Limit|Immutable Gap and Meta-Sign]]; [[section-rooms/arguments/concepts/C64-Paradox-Transforming-the-Containing-Field|Paradox as Cross-Register Hinge]].
- **Use boundary:** reports experiments on two machine-translation tasks; it does not establish general LLM tool use, operational meaning, or agent subjectivity.

<a id="vaswani-et-al-2017-attention-q004"></a>
## Passage card — `vaswani-et-al-2017-attention-q004` — Numerical limit of unscaled dot-product attention
^vaswani-et-al-2017-attention-q004

> “While for small values of dk the two mechanisms perform similarly, additive attention outperforms dot product attention without scaling for larger values of dk [3]. We suspect that for large values of dk, the dot products grow large in magnitude, pushing the softmax function into regions where it has extremely small gradients. To counteract this effect, we scale the dot products by 1/√dk.”

- **Locator:** Official NeurIPS PDF p. 4; proceedings p. 6001; §3.2.1, immediately after the scaled-dot-product formulation.
- **Status:** quotation-ready.
- **Verification:** Luna acquisition agent and coordinator, 2026-07-14; manually transcribed and visually checked from official born-digital PDF; OCR uncertainty: none.
- **Source relation:** extracted primary technical formulation.
- **Evidential action:** qualifies.
- **Argument function:** numerical scope limitation.
- **Consumers:** [[38-s5-p1-apoha-softmax]]; [[section-rooms/arguments/A03-Immutable-Gap-Formal-Limit|Immutable Gap and Meta-Sign]]; [[section-rooms/arguments/concepts/C64-Paradox-Transforming-the-Containing-Field|Paradox as Cross-Register Hinge]].
- **Use boundary:** limits a particular attention calculation; it does not license a semantic, soteriological, or ontological conclusion about softmax.
### Source intake

### Material metadata

- **Aliases:** Vaswani 2017 Verified Excerpts
- **Status:** quotation-ready

The official NeurIPS proceedings PDF is the fixed text carrier. These excerpts support only the technical mechanism stated below; the QL/apoha reading remains an essay-level inference.

### Additional context — `vaswani-et-al-2017-attention-q001`

> “We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.”

| Field | Value |
|---|---|
| `source_id` | `vaswani-et-al-2017-attention` |
| Locator | PDF p. 1; proceedings p. 5998; Abstract |
| Edition or version | *Advances in Neural Information Processing Systems* 30 (31st Conference on Neural Information Processing Systems, 2017), 5998–6008 |
| Text carrier | official fixed proceedings PDF |
| URL | https://proceedings.neurips.cc/paper_files/paper/2017/hash/3f5ee243547dee91fbd053c1c4a845aa-Paper.pdf |
| Access date | 2026-07-14 |
| Transcription | direct, visually checked against the PDF text layer |
| OCR uncertainty | none; publisher-supplied born-digital PDF text, with visual cross-check |
| Context checked | yes — entire abstract and the opening introduction page |
| Verified by | Codex source-gathering pass |
| Verification date | 2026-07-14 |
| Quote status | quotation-ready |
| Intended station | §5/#0 |
| Consuming argument | [[section-rooms/arguments/A14-Computational-Process-Ontology|Computational Process Ontology]] |
| Exact claim supported | Transformer architecture is proposed as attention-only and omits recurrence and convolution. |
| Public-use decision | quote or paraphrase |

### Context before and after

The abstract contrasts the proposed model with recurrent and convolutional sequence-transduction models, then reports translation experiments. It does not speak to phenomenality, semantic content in a philosophical sense, or QL.

### Analytical note

- **Extracted:** the architecture is attention-only and dispenses with recurrence and convolution.
- **Inferred:** such transformations may be read as an operationally inspectable differential field.
- **Relation:** supports the technical baseline; qualifies any claim that a Transformer thereby possesses subjectivity or vindicates QL.

### Chicago note with locator

Ashish Vaswani et al., “Attention Is All You Need,” in *Advances in Neural Information Processing Systems 30* (2017): 5998, https://proceedings.neurips.cc/paper_files/paper/2017/hash/3f5ee243547dee91fbd053c1c4a845aa-Paper.pdf.

### Additional context — `vaswani-et-al-2017-attention-q002`

> “We compute the dot products of the query with all keys, divide each by √dk, and apply a softmax function to obtain the weights on the values.”

| Field | Value |
|---|---|
| `source_id` | `vaswani-et-al-2017-attention` |
| Locator | PDF p. 4; proceedings p. 6001; §3.2.1, “Scaled Dot-Product Attention” |
| Edition or version | *Advances in Neural Information Processing Systems* 30 (31st Conference on Neural Information Processing Systems, 2017), 5998–6008 |
| Text carrier | official fixed proceedings PDF |
| URL | https://proceedings.neurips.cc/paper_files/paper/2017/hash/3f5ee243547dee91fbd053c1c4a845aa-Paper.pdf |
| Access date | 2026-07-14 |
| Transcription | direct, visually checked against the PDF text layer |
| OCR uncertainty | none; publisher-supplied born-digital PDF text, with visual cross-check |
| Context checked | yes — §3.2.1, including the ensuing equation and the explanation of scaling |
| Verified by | Codex source-gathering pass |
| Verification date | 2026-07-14 |
| Quote status | quotation-ready |
| Intended station | §5/#1 |
| Consuming argument | [[section-rooms/arguments/A14-Computational-Process-Ontology|Computational Process Ontology]] |
| Exact claim supported | Scaled dot-product attention produces value weights through softmax over query-key relations. |
| Public-use decision | quote or paraphrase |

### Context before and after

The immediately surrounding section defines an attention function as a query and key–value mapping, gives the matrix equation, and explains why scaling is used. It addresses attention weights; it neither defines argmax nor offers a theory of Buddhist exclusion.

### Analytical note

- **Extracted:** scaled query–key dot products are passed through softmax to produce attention weights.
- **Inferred:** an output-selection process can be compared, in a carefully bounded way, to differential determination.
- **Relation:** supports the technical softmax statement; qualifies the §5 analogy by excluding a claim of doctrinal identity with *apoha*.

### Chicago note with locator

Vaswani et al., “Attention Is All You Need,” 6001.
### Passage register

These source-specific fields were gathered before consolidation and remain part of this source's evidence record.

| `vaswani-et-al-2017-attention-q001` | `vaswani-et-al-2017-attention` | NeurIPS PDF p. 1; proceedings p. 5998; Abstract | quotation-ready | official NeurIPS PDF checked 2026-07-14: “based solely on attention mechanisms, dispensing with recurrence and convolutions entirely” | attention-only architecture baseline | §5/#0 | [[section-rooms/arguments/A14-Computational-Process-Ontology|Computational Process Ontology]] | yes |

| `vaswani-et-al-2017-attention-q002` | `vaswani-et-al-2017-attention` | NeurIPS PDF p. 4; proceedings p. 6001; §3.2.1 | quotation-ready | official NeurIPS PDF checked 2026-07-14: “apply a softmax function to obtain the weights on the values” | softmax attention normalisation mechanism | §5/#1 | [[section-rooms/arguments/A14-Computational-Process-Ontology|Computational Process Ontology]] | yes |

| `vaswani-et-al-2017-attention-q003` | `vaswani-et-al-2017-attention` | NeurIPS PDF p. 1; proceedings p. 5998; Abstract | quotation-ready | official NeurIPS PDF checked 2026-07-14: “superior in quality while being more parallelizable” | machine-translation-only empirical scope limitation | §5/#0 | [[section-rooms/arguments/A03-Immutable-Gap-Formal-Limit|Immutable Gap and Meta-Sign]] | yes |

| `vaswani-et-al-2017-attention-q004` | `vaswani-et-al-2017-attention` | NeurIPS PDF p. 4; proceedings p. 6001; §3.2.1 | quotation-ready | official NeurIPS PDF checked 2026-07-14: “pushing the softmax function into regions where it has extremely small gradients” | numerical scaling limitation of dot-product attention | §5/#1 | [[section-rooms/arguments/A03-Immutable-Gap-Formal-Limit|Immutable Gap and Meta-Sign]] | yes |
### Passage metadata register

These source-specific fields were gathered before consolidation and remain part of this source's evidence record.

| `vaswani-et-al-2017-attention-q001` | `vaswani-et-al-2017-attention` | official NeurIPS PDF p. 1; proceedings p. 5998, Abstract | quotation-ready | `37-s5-p0-math-moves-meaning` | [[section-rooms/arguments/A14-Computational-Process-Ontology|Computational Process Ontology]] | attention-only architecture baseline | [Quotes — Vaswani et al. Attention Is All You Need (2017)](#passages) |

| `vaswani-et-al-2017-attention-q002` | `vaswani-et-al-2017-attention` | official NeurIPS PDF p. 4; proceedings p. 6001, §3.2.1 | quotation-ready | `38-s5-p1-apoha-softmax` | [[section-rooms/arguments/A14-Computational-Process-Ontology|Computational Process Ontology]] | scaled softmax attention weights | [Quotes — Vaswani et al. Attention Is All You Need (2017)](#passages) |

| `vaswani-et-al-2017-attention-q003` | `vaswani-et-al-2017-attention` | official NeurIPS PDF p. 1; proceedings p. 5998, Abstract | quotation-ready | `37-s5-p0-math-moves-meaning` | [[section-rooms/arguments/A03-Immutable-Gap-Formal-Limit|Immutable Gap and Meta-Sign]]; [[section-rooms/arguments/concepts/C64-Paradox-Transforming-the-Containing-Field|Paradox as Cross-Register Hinge]] | empirical-scope limitation | [Quotes — Vaswani et al. Attention Is All You Need (2017)](#passages) |

| `vaswani-et-al-2017-attention-q004` | `vaswani-et-al-2017-attention` | official NeurIPS PDF p. 4; proceedings p. 6001, §3.2.1 | quotation-ready | `38-s5-p1-apoha-softmax` | [[section-rooms/arguments/A03-Immutable-Gap-Formal-Limit|Immutable Gap and Meta-Sign]]; [[section-rooms/arguments/concepts/C64-Paradox-Transforming-the-Containing-Field|Paradox as Cross-Register Hinge]] | numerical-scope limitation | [Quotes — Vaswani et al. Attention Is All You Need (2017)](#passages) |
