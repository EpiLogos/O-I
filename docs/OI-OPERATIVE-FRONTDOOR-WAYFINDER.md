# O:I Operative Front Door Wayfinder

Status: pre-`#97` implementation contract

Primary Wayfinder: `EpiLogos/O-I#155`

Convergence gate: `EpiLogos/O-I#97`

General resolver owner: `EpiLogos/ai-kit#142`

Vāk / source-coordinate owner: `EpiLogos/QL-MEF#83` and PR `#84`

## 0. Ground

This document records the suite-level consumer work implied by the general O:I operative language. It does not create a second parser, search grammar, Action system, authority system, or product runtime in O:I.

The current authored position remains that O:I is the sparse shared Idea and composition layer around six product centres. Product semantics remain native. O:I is responsible for composing the installed whole and giving humans and Agents one first-hand way to enter it.

The operative relation is:

```text
World / Disclosure
   0       1
    \     /
      Agent
```

Search, address, relation-following, Method selection, Skill use, Action, encounter and Return are operations through which an Agent determines its present position in a World and acts from it. The software consequence is that suite search is not merely an information lookup utility: it is part of ordinary inhabitation.

## 1. Current implementation facts

### AIKit

Current AIKit main already contains the stronger search precedent in `crates/aikit-core/src/resource/search.rs`.

`ResourceSearchIndex` orders candidates lexicographically with:

```text
relevance
→ authored/context preference
→ learned accessibility / familiarity
→ stable identity
```

This preserves the crucial distinction that familiarity can make a known path easier to recover without overriding semantic relevance.

`aikit z` already carries the zoxide-style successful-use familiarity path.

Two compatibility surfaces still diverge from that current discipline:

- `crates/aikit-core/src/search.rs` retains an older blended capsule-ranking model and legacy query-prefix meanings;
- headless `AikitApplication::search()` in `crates/aikit-cli/src/app/mod.rs` uses a separate subsequence scorer.

AIKit `#142` therefore owns convergence onto one `ResolveExpression` / typed-ref / search / Explain / History / Method path rather than the creation of another ranking model.

### O:I

Current `cli/src/frontdoor.rs` routes the existing suite, development, trust, current-World and adoption commands. It does not yet expose the general AIKit resolver/@ language as the ordinary O:I front door.

Current suite installation already installs/registers the native AIKit executable. The missing O:I work is therefore a consumer/dispatch seam, not a local reimplementation of AIKit.

Current `skills/oi/SKILL.md` explicitly guarantees only:

```text
oi ctrl ... → ctrl ...
oi kit ...  → aikit ...
```

and otherwise routes the Agent to the product owner.

Current `skills/suite-operator/SKILL.md` already preserves the correct distinction:

```text
Skill available != Capability granted
Capability available != Action authorised
procedural competence != permission
```

That remains the authority foundation for the operative front door.

## 2. Ownership lock

```text
AIKit #142
  ResolveExpression
  typed semantic refs
  Search / Explain / History
  Method discovery
  learned navigation / familiarity
  structured Agent parity
        │
        ▼
O:I operative front door
  suite-level first-hand invocation
  installed-product composition
  canonical ref forwarding
  canonical ActionRef dispatch
        │
        ▼
native product owner
  Action definition
  Action implementation
  product semantics
        │
        +
        ▼
Actuation / native authority
  actor / Agency determination
  grant / capability / authority
  metagency where applicable
```

O:I must not acquire six copies of product Actions. AIKit must not acquire suite ownership. A successful resolve does not itself authorise an Action.

## 3. Operative language dependency

The general runtime floor remains AIKit `#142`.

The source-grounded horizons and operators are bound through the QL-MEF/Vāk work:

```text
@0  Library / knowing horizon
@1  Bimba / determining source and architecture
@2  Pratibimba / reading and interpretation
@3  Language / forms, code, documents and schemas
@4  Stories / Worlds / views / context
@5  Techne / Skills, Methods, Actions and capabilities

@#  potential / discover
-   negate / exclude / distinguish
+   affirm / admit / compose
x   dialogic cross-reference
/   contextual / dialectical traversal
=   expression / equivalence / determination
```

O:I consumes this accepted resolver contract. O:I does not freeze independent semantics for these symbols.

## 4. Suite front-door contract

Once the accepted AIKit resolver is present, `oi` becomes the ordinary human/Agent suite instrument.

Conceptually:

```text
human / Agent
      │
      ▼
     oi
      │
      ├── Resolve / Search / @ language
      ├── Explain / History / familiarity
      ├── Method discovery
      ├── Skill / Action discovery
      └── canonical Action invocation
                    │
                    ▼
             native product owner
                    +
             authority evaluation
```

The front door must preserve canonical identity across aliases and familiar addresses. `@gw`, for example, may become a strong learned address for a canonical gateway object in a particular World/Focus without creating a second object or replacing its canonical ref.

The front door must consume structured resolver output. It must not parse human-formatted AIKit output in order to discover refs, Methods or Actions.

The front door must fail transparently when a product Action is unavailable, unsupported or unauthorised. It must not guess an owner command or silently fall back to arbitrary shell execution.

## 5. Method-first praxis

The normal Agent path is:

```text
present Focus / intention
        ↓
ResolveExpression / semantic address
        ↓
Method resonance
        ↓
Method follows relevant knowledge and relations
        ↓
Skills + Actions + capability / authority state
        ↓
Action / encounter
        ↓
Return
        ↓
revised World + successful familiarity
```

A Method is the situated operational pattern that recognises a kind of intention and draws together the relevant Skills, knowledge and Actions. A Skill remains reusable procedural competence.

Agents should therefore prefer resolving a Method over manually scanning a broad Skill inventory when the intention is already intelligible.

## 6. Learned navigation / resonance

The accepted navigation system should preserve a simple law:

```text
semantic relevance first
then authored/context preference
then successful learned accessibility
then stable identity
```

Familiarity is updated after successful use, not after display, hover, failed invocation or mere ranking.

The durable meaning of this history is a shared-World-relative resonance field: which canonical objects, relations, Methods and paths have repeatedly mattered from a situated Agency/Focus. It is not a hidden private memory substitute for the Wiki.

A Guardian can therefore develop a product-relative centre of gravity while using the same general tooling as any other capable Agent.

## 7. Guardian composition

The six product Guardians are persistent maintaining Agencies, not six special review prompts.

They share the same World, resolver, operative language and broad tool ecology. Their differentiation comes from situated relations:

```text
persistent product Focus
+ claims / dependencies stewarded
+ product Wiki resonance
+ product-relative navigation history
+ attention over relevant Activity
+ unresolved Returns / Candidates / tensions
```

Their characteristic centres remain:

- Central — authored Ground and continuity of the World;
- Actuation — actuality of Agency;
- AIKit — operative potentiation of Agents;
- Factory — development and warranted change;
- Workcell — material actuality;
- Quaternal Logic — formal coherence of the whole composition.

Cross-product work should therefore be ordinary semantic address and AgentSet cooperation over a common subject, not role switching or duplicated tool inventories.

## 8. Surface parity

CLI, TUI/palette, Pi/structured-Agent output, desktop and later compact command projections must consume the same semantic application object:

```text
ResolveExpression
→ typed refs
→ ranked candidates / determination
→ ResolvePath
→ Method / Skill / Action affordances
→ explanation / familiarity evidence
```

A UI Component is valuable when it lets either human or Agent operate a World object or relation. It is not a separate dashboard ontology.

## 9. Execution order into #97

```text
AIKit #142 resolver/runtime floor
        ↓
AIKit search/familiarity consumer convergence
        ↓
O:I operative front-door adapter
        ↓
source-owned suite / Guardian praxis
        ↓
O:I #97 exact-main local install
        ↓
physical human ↔ Agent inhabitation acceptance
```

The existing pre-local NOW/hooks, dynamic Skill disclosure, RTK/PreToolUse, Guardian delegation, Mantis proving and harness-fidelity work remains in the same causal gate. This Wayfinder supplies the ordinary instrument through which those hardened relations are exercised.

## 10. #97 acceptance

The target UX includes expressions of this shape after AIKit `#142` lands. These are acceptance examples, not claims about current-main CLI syntax:

```text
oi @4 oi
oi @0 gateway / @4 oi
oi - @2 stale
oi @1 gateway x @2 current-reading
oi @5 gateway
oi @# @5 gateway
```

Acceptance must prove:

- typed canonical semantic identity is preserved in results;
- ResolvePath / explanation is available to both human and Agent consumers;
- Method resolution leads to relevant knowledge, Skills and Actions;
- aliases/familiar addresses improve access without replacing identity;
- successful operation, and only successful operation, updates familiarity;
- headless and interactive surfaces do not disagree because of separate rank laws;
- selected Actions dispatch to their native owner;
- actual authority is evaluated by the native authority seam;
- Guardians use the same ordinary instrument while their persistent Focus/resonance fields produce different product-relative navigation.

## 11. Non-goals

This slice does not:

- create another operative-language parser in O:I;
- duplicate product Actions in the O:I CLI;
- make Skills confer capability or authority;
- make familiarity override semantic relevance;
- turn Guardian differentiation into six tool allowlists;
- block physical testing on the full eventual 109-node Vāk differentiation once the bounded #142 operative floor is accepted.
