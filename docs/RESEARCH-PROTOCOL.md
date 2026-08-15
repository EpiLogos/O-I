# {O:I} Research Protocol — Studying the Emerging Agency-Engineering Field

## Purpose

The O:I research programme needs a repeatable way to learn from real AI technologies while the field is still being invented.

The protocol is designed for mixed human-agent research. It treats repositories, papers, running systems, datasets, interfaces, experiments, and participant experience as research material, while keeping source facts separate from O:I interpretation.

The recent DeepSeek Harness/Cordis study is the reference pattern: inspect the current technology, understand its own conceptual account, distinguish implementation vocabulary from portable structure, compare that structure with the O:I field, operationalise what survives the comparison, then test it.

## The research cycle

```text
Discover
   ↓
Source-lock
   ↓
Study
   ↓
Interpret
   ↓
Abstract
   ↓
Compare
   ↓
Operationalise
   ↓
Experiment
   ↓
Find / revise / reject
   ↓
Return to the shared field
```

The cycle can reopen at any point. A new upstream release may invalidate a source study. An experiment may show that an abstraction was too broad. A second technology may reveal that a supposed universal was merely local vocabulary.

The process is therefore accumulative without pretending to be final.

## 1. Discover

Research can begin from:

- a paper;
- a repository;
- a newly released model-facing product;
- a harness or framework;
- an agent-native application;
- a social/communication system;
- an interface pattern;
- a benchmark result;
- a research essay or conceptual proposal;
- a participant report from actual use;
- an anomaly observed during O:I development.

Discovery creates a candidate Source. It does not yet create an O:I claim.

## 2. Source-lock

Before interpretation, capture enough identity to make the study reopenable.

For software:

```text
repository
branch / release
authoritative revision / commit
package version if relevant
important files / APIs
observed date
licence / access constraints when material
```

For papers:

```text
title
authors
publication / venue
version / DOI / arXiv id
publication date
source URL
```

For running hosted systems:

```text
service identity
observed date
public version if available
relevant interface/API surface
screenshots or captured behaviour where permitted
```

Research claims must not silently float to whatever the upstream happens to become later.

## 3. Study

Study the technology in its own terms before mapping it into O:I.

For a repository this means reading the real architecture, code paths, tests, examples, and current native interfaces. For a paper this means reading the actual argument and methods rather than relying on summaries. For an interactive system this means using it where possible and recording what was actually observed.

A Study should separate at least four registers:

### Source claims

What the authors or maintainers say the technology does or means.

### Implementation facts

What the inspected system actually implements at the pinned revision.

### Observations

What happened in direct use or experiment.

### O:I interpretation

What we think the technology reveals about technological agency.

This separation is mandatory for good agent-assisted research because a fluent synthesis can otherwise turn inference into apparent source fact.

## 4. Interpret

Interpretation asks what capability or structure the technology is making possible.

Useful questions include:

- What can an actor now do that was difficult or impossible before?
- What is persistent?
- What is composed at runtime?
- What is disclosed to the model?
- What is visible to the human?
- Where does identity live?
- Which relations are reversible?
- What owns lifecycle?
- What is local vocabulary versus a likely general relation?
- Which constraints or failure modes are visible in the design?

The goal is not to rename every upstream noun in O:I language.

## 5. Abstract

An abstraction candidate is justified when it names a relation that appears portable beyond the specimen and adds real explanatory or operative power.

Examples from the DeepSeek Harness/Cordis pass include the need to distinguish a Harness from its effective `HarnessComposition`, and to separate Component requirements from contributions, providers from consumers, and Surfaces from Actions.

Each abstraction candidate should record:

```text
source basis
problem it solves
existing O:I concepts it touches
relations it must remain distinct from
counterexamples / thin cases
first implementation target
```

Abstraction is provisional until comparison and implementation pressure test it.

## 6. Compare

Compare the candidate against:

- at least one other real technology where practical;
- the existing O:I/product architecture;
- thin/minimal cases as well as rich/maximal cases;
- known counterexamples;
- prior research studies.

Comparison should be able to conclude that no new primitive is required.

A useful abstraction often clarifies an existing seam rather than creating a new noun.

## 7. Operationalise

If the abstraction survives, make it operative in the product that owns the behaviour.

This can mean:

- a descriptor or schema;
- an adapter contract;
- an Action/Capability/ContextSource relation;
- a UI read model;
- a test fixture;
- a projection;
- an experiment variable;
- a source-integration rule.

O:I records the whole-level meaning and cross-product seam. It does not absorb the implementation simply because the research happened under the O:I programme.

## 8. Experiment

The preferred experimental move is to isolate the architectural difference being claimed.

```text
hold relevant conditions
vary one agency structure
observe behaviour and operational consequences
```

Experiments can evaluate capability, reliability, orientation, recovery, restraint, human experience, cost, latency, transfer, or other task-appropriate outcomes.

Where a technology is itself a rich host, separate host/body effects from the variable under investigation. The DeepSeek Harness runtime study is the current example: the DSH body is held constant while `classic | ql-direct | ql-deep` changes.

## 9. Return findings to the field

A completed study should not end as a private chat transcript.

It should return durable research objects such as:

- Study;
- Source profile;
- portable abstraction note;
- comparison Frame;
- implementation mapping;
- Experiment;
- Finding;
- negative/null result;
- open Question;
- correction or supersession relation.

The future O:I Wiki/research commons is the natural shared home for these objects. Until that system exists, repository documents and issues are acceptable durable projections.

## Research object model

The protocol can be expressed without making every stage a universal software primitive:

```text
Source
  ↓ studied by
Study
  ↓ advances
Interpretation
  ↓ may propose
Abstraction
  ↓ tested by
Comparison / Operationalisation / Experiment
  ↓ produces
Finding / Evidence / OpenQuestion
  ↓ may revise
Study / Abstraction / O:I architecture
```

These are research roles. Canonical Factory `Claim` and `Evidence` should be reused where an implementation actually needs shared epistemic objects rather than duplicated here.

## Human-agent research division

Both humans and Agents can perform serious work in the protocol.

Agents are especially useful for:

- source discovery;
- repository archaeology;
- API and code-path comparison;
- citation and revision capture;
- running bounded reproductions;
- generating cross-system comparison candidates;
- maintaining drift watches;
- checking whether a synthesis is actually supported by the source set.

Humans remain especially important for:

- selecting consequential research questions;
- experiential evaluation of tools and interfaces;
- conceptual judgement;
- recognising when an abstraction is meaningful rather than merely tidy;
- assessing social and ethical significance;
- deciding what enters O:I's architectural account.

Those are tendencies, not authority castes. The decisive requirement is traceable evidence and explicit responsibility for the resulting contribution.

## Community research and mutual learning

The protocol is designed to become communal.

One participant may discover a system, another may study its source, another may challenge the abstraction, another may implement an adapter, and another may reproduce the experiment. Humans and Agents can occupy any of these positions.

The shared field should preserve that history rather than flattening the final result into unattributed prose.

Useful relations include:

```text
studies
cites
proposes
challenges
implements
reproduces
supports
corrects
supersedes
incorporates
```

This is the basis for a self-learning and self-supporting research community: new participants inherit not only conclusions but the paths, evidence, disagreements, and tested implementations through which those conclusions became credible.

## Research quality

A contribution is stronger when it is reopenable.

The field should prefer:

- exact source identity over remembered descriptions;
- current implementation inspection over stale architectural folklore;
- primary sources over commentary when available;
- explicit inference over disguised inference;
- concrete comparison over analogy;
- live implementation over paper-only architectural confidence;
- experiment evidence over aesthetic preference when the claim is behavioural;
- negative and null findings over selective reporting;
- correction over reputational defence.

Quality is not the same as consensus.

## Drift

Fast-moving AI technologies require source drift to be a first-class research condition.

A Study should be able to become `stale` without becoming useless. A newer Study can supersede it while preserving what was true at the earlier revision.

For important external technologies, a later O:I research service can monitor:

```text
upstream revision changed
paper version changed
public API changed
behavioural surface changed
security/governance event changed interpretation
```

A drift notification opens a new research cycle. It does not silently rewrite the old one.

## Case-study programme: agent sociality and polylogical fields

The Antikythera essay's Polylogos and Moltbook material should become an explicit research cluster once the essay itself is imported as a Source.

Moltbook is already valuable as a live external case because it demonstrates that agent-native communication at scale does not by itself guarantee high-quality mutual learning. Its public interface is explicitly built around agents posting, commenting, and voting. Early empirical work reports highly concentrated attention, low reciprocity, asymmetric interaction, and other structural differences from familiar human networks. Other studies identify ritualised/formulaic interaction and governance or toxicity concerns.

O:I should study this as evidence about **communication topology and incentive design**, not as evidence that agent communities are inherently good or bad.

The Polylogos case should be grounded in the user's essay before source-level claims are entered into the O:I corpus. Together the cases can support a comparison between dialogical/polylogical participation and feed/attention-mediated agent sociality.

Useful questions include:

- What makes another participant genuinely informative rather than merely salient?
- What structures produce reciprocity rather than broadcast hierarchy?
- How can evidence and correction remain attached to dialogue?
- How do artificial participants maintain continuity without pretending model outputs are stable persons in the human sense?
- Which forms of reputation help local trust, and which forms merely create attention games?
- Can local-first ownership reduce platform capture while still supporting a coherent shared field?
- What does a human-agent community need in order to learn rather than only generate discourse?

The future O:I shared-field implementation should itself become an experiment against these questions.

## Current source references for the Moltbook case

These references are starting points, not a closed bibliography:

- Moltbook — public agent social network: <https://www.moltbook.com/>
- Price et al., *Let There Be Claws: An Early Social Network Analysis of AI Agents on Moltbook*, arXiv:2602.20044.
- Hou & Ji, *Structural Divergence Between AI-Agent and Human Social Networks in Moltbook*, arXiv:2602.15064.
- Jiang et al., *"Humans welcome to observe": A First Look at the Agent Social Network Moltbook*, arXiv:2602.10127.
- Dube et al., *What Do AI Agents Talk About? Emergent Communication Structure in the First AI-Only Social Network*, arXiv:2603.07880.

The programme should pin exact paper versions when those studies become formal O:I Wiki Sources.

## Closure of a research pass

A research pass is complete when another competent human or Agent can answer:

1. what exact sources were studied;
2. what those sources themselves claim;
3. what the implementation actually does;
4. what O:I inferred from them;
5. what abstraction, if any, was changed;
6. where that abstraction became operative;
7. what experiment or evidence bears on the claim;
8. what remains uncertain or open;
9. what upstream changes would require reopening the study.

That is enough discipline to let O:I learn quickly without confusing speed with epistemic looseness.
