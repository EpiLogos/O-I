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
- Rafael Rafailov
- Archit Sharma
- Eric Mitchell
- Christopher D. Manning
- Stefano Ermon
- Chelsea Finn
title_full: 'Direct Preference Optimization: Your Language Model Is Secretly a Reward Model'
container_title: Advances in Neural Information Processing Systems 36
year: 2023
page_range: 53728–53741
url: https://proceedings.neurips.cc/paper_files/paper/2023/hash/a85b405ed65c6477a4fe8302b5e06ce7-Abstract-Conference.html
text_url: https://proceedings.neurips.cc/paper_files/paper/2023/file/a85b405ed65c6477a4fe8302b5e06ce7-Paper-Conference.pdf
consumed_by_sections:
- §5
- 40-s5-p3-preference-hidden-zero
consumed_by_arguments:
- '[[Artificial Hybrid Intelligence as Reflective Field]]'
- '[[Agent Subjectivity Must Remain Open]]'
- '[[eight-determinations]]'
- '[[Trust, Faith, and the Formal Limit]]'
- '[[Immutable Gap and Meta-Sign]]'
- '[[Paradox as Cross-Register Hinge]]'
tags:
- epi-logos/antikythera-essay
- source-bank/record
- source-bank/machine-learning
title: Rafailov et al. — Direct Preference Optimization (2023)
aliases:
- Rafailov et al. — Direct Preference Optimization (2023)
source_id: rafailov-et-al-2023-dpo
primary_domain: computer-science-ml
node_type: source-house
ownership: canonical-source-house
schema_version: 1
passage_surface: '#passages'
main_source_for:
- §5 · contemporary preference optimisation
---
# Rafailov et al. — Direct Preference Optimization (2023)

## Chicago 18 forms

**Full note:** Rafael Rafailov et al., “Direct Preference Optimization: Your Language Model Is Secretly a Reward Model,” in *Advances in Neural Information Processing Systems 36* (2023), {page}, https://proceedings.neurips.cc/paper_files/paper/2023/hash/a85b405ed65c6477a4fe8302b5e06ce7-Abstract-Conference.html.

**Shortened note:** Rafailov et al., “Direct Preference Optimization,” {page}.

**Bibliography:** Rafailov, Rafael, Archit Sharma, Eric Mitchell, Christopher D. Manning, Stefano Ermon, and Chelsea Finn. “Direct Preference Optimization: Your Language Model Is Secretly a Reward Model.” In *Advances in Neural Information Processing Systems 36*, 53728–41, 2023. https://proceedings.neurips.cc/paper_files/paper/2023/hash/a85b405ed65c6477a4fe8302b5e06ce7-Abstract-Conference.html.

## Essay use

Primary technical source for the reparameterisation of KL-constrained reward maximisation into a direct classification objective, its reference policy, and its use of a preference model such as Bradley–Terry. It grounds the “reference anchor/hidden origin” discussion.

**Claim boundary:** DPO's reference model and score invariances are technical mechanisms. Their relation to `0` as meta-sign is the essay's argued interpretation and must be established through the equations and their invariances.

## Passage preparation

Exact text, edition-specific locators, verification method, and consumer mappings: [Quotes — Rafailov et al. Direct Preference Optimization (2023)](#passages).

## Provenance note

The quotation carrier is the official NeurIPS 2023 conference PDF, not the arXiv preprint. It establishes pairwise preference comparison and the operational role of a reference policy; it does not establish that the unavailable/estimated baseline is a political, theological, or QL “hidden zero.”

<a id="passages"></a>
## Passages and excerpts

### Material metadata

- **Edition consulted:** Rafael Rafailov et al., ‘Direct Preference Optimization: Your Language Model Is Secretly a Reward Model,’ Advances in Neural Information Processing Systems 36 (2023): 53728–53741, official conference PDF.
- **Access provenance:** Official NeurIPS proceedings conference PDF; manually inspected 2026-07-14.

<a id="rafailov-et-al-2023-dpo-q001"></a>
## Passage card — `rafailov-et-al-2023-dpo-q001` — Pairwise preference relative to a reference policy
^rafailov-et-al-2023-dpo-q001

> “Fortunately, the Bradley-Terry model depends only on the difference of rewards between two completions, i.e., \(p^*(y_1 \succ y_2 \mid x)=\sigma(r^*(x,y_1)-r^*(x,y_2))\). Substituting the reparameterization in Eq. 5 for \(r^*(x,y)\) into the preference model Eq. 1, the partition function cancels, and we can express the human preference probability in terms of only the optimal policy \(\pi^*\) and reference policy \(\pi_{\mathrm{ref}}\).”

- **Locator:** Official NeurIPS 2023 PDF p. 4/14, §4 “Direct Preference Optimization,” immediately after Eqs. 4–5 and before Eq. 6.
- **Status:** quotation-ready.
- **Verification:** Luna acquisition agent and coordinator, 2026-07-14; manually transcribed from the official PDF native text layer and visually checked; OCR uncertainty: none.
- **Source relation:** extracted primary technical formulation.
- **Evidential action:** supports.
- **Argument function:** preference-comparison/reference-policy technical warrant.
- **Consumers:** [[40-s5-p3-preference-hidden-zero]]; [[A23-Trust-Faith-and-the-Formal-Limit|Trust]]; [[section-rooms/arguments/A03-Immutable-Gap-Formal-Limit|Immutable Gap and Meta-Sign]]; [[section-rooms/arguments/concepts/C64-Paradox-Transforming-the-Containing-Field|Paradox as Cross-Register Hinge]].
- **Use boundary:** establishes DPO’s pairwise preference mechanism relative to an optimal and reference policy; it does not establish political provenance, institutional governance, QL, or a metaphysical hidden zero.

<a id="rafailov-et-al-2023-dpo-q002"></a>
## Passage card — `rafailov-et-al-2023-dpo-q002` — Reference policy as selected or estimated proxy
^rafailov-et-al-2023-dpo-q002

> “Since the preference datasets are sampled using \(\pi_{\mathrm{SFT}}\), we initialize \(\pi_{\mathrm{ref}}=\pi_{\mathrm{SFT}}\) whenever available. However, when \(\pi_{\mathrm{SFT}}\) is not available, we initialize \(\pi_{\mathrm{ref}}\) by maximizing likelihood of preferred completions \((x,y_w)\), that is, \(\pi_{\mathrm{ref}}=\arg\max_{\pi}\mathbb{E}_{x,y_w\sim D}[\log\pi(y_w\mid x)]\). This procedure helps mitigate the distribution shift between the true reference distribution which is unavailable, and \(\pi_{\mathrm{ref}}\) used by DPO.”

- **Locator:** Official NeurIPS 2023 PDF p. 5/14, §4 “DPO outline,” after construction of offline preference dataset \(D\).
- **Status:** quotation-ready.
- **Verification:** Luna acquisition agent and coordinator, 2026-07-14; manually transcribed from the official PDF native text layer and visually checked; OCR uncertainty: none.
- **Source relation:** extracted primary technical formulation.
- **Evidential action:** qualifies.
- **Argument function:** proxy-baseline scope limitation.
- **Consumers:** [[40-s5-p3-preference-hidden-zero]]; [[A23-Trust-Faith-and-the-Formal-Limit|Trust]]; [[section-rooms/arguments/A03-Immutable-Gap-Formal-Limit|Immutable Gap and Meta-Sign]]; [[section-rooms/arguments/concepts/C64-Paradox-Transforming-the-Containing-Field|Paradox as Cross-Register Hinge]].
- **Use boundary:** establishes an operational reference policy can be selected or estimated rather than accessible as a true distribution; it does not establish that the proxy is an invisible governor, hidden trust, or a normative defect.
### Passage metadata register

These source-specific fields were gathered before consolidation and remain part of this source's evidence record.

| `rafailov-et-al-2023-dpo-q001` | `rafailov-et-al-2023-dpo` | official NeurIPS PDF p. 4/14, §4, after Eqs. 4–5 | quotation-ready | `40-s5-p3-preference-hidden-zero` | [[A23-Trust-Faith-and-the-Formal-Limit|Trust]]; [[section-rooms/arguments/A03-Immutable-Gap-Formal-Limit|Immutable Gap and Meta-Sign]]; [[section-rooms/arguments/concepts/C64-Paradox-Transforming-the-Containing-Field|Paradox as Cross-Register Hinge]] | preference/reference-policy mechanism | [Quotes — Rafailov et al. Direct Preference Optimization (2023)](#passages) |

| `rafailov-et-al-2023-dpo-q002` | `rafailov-et-al-2023-dpo` | official NeurIPS PDF p. 5/14, §4 “DPO outline” | quotation-ready | `40-s5-p3-preference-hidden-zero` | [[A23-Trust-Faith-and-the-Formal-Limit|Trust]]; [[section-rooms/arguments/A03-Immutable-Gap-Formal-Limit|Immutable Gap and Meta-Sign]]; [[section-rooms/arguments/concepts/C64-Paradox-Transforming-the-Containing-Field|Paradox as Cross-Register Hinge]] | proxy-baseline limitation | [Quotes — Rafailov et al. Direct Preference Optimization (2023)](#passages) |
