# Canonical suite operator SkillSet

O:I composes and explains source-owned procedural competence; it does not become the owner of native product procedures, and it is not a Skill registry. Registration and set composition are AIKit functionality.

## What O:I ships

The shipped manifest (`skills/suite-operator/skillset.toml`, schema `oi.suite-skillset/v1`) declares exactly one profile and three O:I-owned Skills:

```text
oi:skillset:base-guardian
  oi:skill:operate-suite          (skills/oi/SKILL.md)
  oi:skill:suite-operator         (skills/suite-operator/SKILL.md)
  oi:skill:central-session-strap  (skills/central-session-strap/SKILL.md)
```

O:I holds and projects the Central session strap: `skills/central-session-strap/SKILL.md` is its authoritative source, and every harness copy is a receipt-gated derived projection.

All three Skills carry `revision_policy = "resolve_authoritative_installed_revision"`: O:I resolves each Skill's authoritative revision from the installed native owner rather than pinning one by hand. A projected copy carries its source revision in its receipt header; local edits never become authoritative.

A test guards this shape: `shipped_manifest_declares_only_oi_owned_skills` fails if the shipped manifest ever names another product's Skills again. That is deliberate. The manifest once pinned every suite product's Skills; that made it a second registry in a second format, and its silent path drift proved the point.

A bootstrap SkillSet is not an AgentSet. Product Guardian agents and their defaults retain their actual native Central/AIKit identities and source; the existence of these three procedural members neither creates nor starts agents. Explain and resolve selected Guardian/product repertoires through the real owner rather than inferring a roster from this manifest.

## How the rest of the suite is composed

Each product keeps its Skills as native files in its own repository (Central `skills/`, Quaternal Logic `skills/`, AIKit `registry/`). AIKit is the suite's normal resolver: `aikit source add-directory` discovers those trees, `sync` snapshots them, `aikit trust record` records review, `aikit set create` composes sets across products, and `aikit enable`/scopes project them. O:I routes refs and explains composition; it never registers or pins foreign Skills. Current native help and source contracts determine the actual operation syntax and set representation.

The governing path is:

```text
native repository authoritative Skill source
  -> AIKit source discovery / sync / trust / sets
  -> scope-enabled projection
  -> actual harness activation/loading and demonstrated use
  -> native Capability / Action / authority gate
```

For an agent already operating in a person's harness, use [Harness-first adoption](experience/HARNESS-FIRST-ADOPTION.md), registered in #65's existing source map. It carries the complete explained setup, native source adoption, hooks, reload/restart, useful first task and unsupported-target SDK route. Reading that source explicitly in a commissioned bootstrap is not a claim that normal discovery or live loading has already worked.

## Base versus Root

`oi:skillset:base-suite-operation` and `oi:skillset:root-metagentic-operation` remain real capabilities of the resolution machinery and are exercised by the test fixtures, but they are no longer shipped as registered sets. The resolver still rejects Root-scope profiles for `AgentScope::Ordinary`, and even for `AgentScope::RootWorld` the enum is projection eligibility/read-model input: Actuation must independently establish the real positional Root relation and native authority grants.

## Provenance and drift

`EffectiveSkillSet` carries expected and observed source revision independently. A mismatch degrades the view rather than silently substituting the new source. Surface records (`surfaces.json`, `suite/mainline.json`) continue to pin accepted-main revisions per product; those are acceptance records, not Skill registrations.

## Fallback

Without AIKit, direct projection remains limited in code to O:I/Central Skills. Foreign source-owned Skill bodies are never copied into O:I as a convenience path.

## Epi experience practices — pending H review

**Publication authorised; H ratification pending (Satya).** This new domain
practice guidance is available for review and provisional use against current
native contracts. Its publication does not ratify it or change the preceding
owner/resolver boundaries.

QL-MEF owns its foundations, bounded provider Method, evidence-report Skill,
experience-preparation and experience-walk Methods. Resolve those native files
through AIKit; no foreign membership is added to O:I's shipped manifest.
Their source/discovery/projection/loading/use distinction is specified in
[QL's pending practice account](https://github.com/EpiLogos/QL-MEF/blob/main/docs/kernel-rebuild/AGENT-PRACTICE-AND-BOOTSTRAP.md).

The actual installed AIKit command owns its materialisation format. Spec III
§§1–1.2 defines sets as folders with optional manifests. The source-pinned
projection probe uses a writable folder set with `members` created by native
`set create`; this need not be another hand-maintained TOML manifest. This
clarifies the earlier format shorthand without moving registration into O:I.
Membership does not enable a capability; explicit scope resolution governs
actual projection. Current-generation read-back proves delivery, not model
loading or successful use. The fresh-agent UX01/UX06 walks exercise those later
steps through the native host route; pending walk definitions do not claim
those steps have been exercised.
