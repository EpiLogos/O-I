# Canonical suite operator SkillSet

O:I composes and explains source-owned procedural competence; it does not become the owner of native product procedures, and it is not a Skill registry. Registration and set composition are AIKit functionality.

## What O:I ships

The shipped manifest (`skills/suite-operator/skillset.toml`, schema `oi.suite-skillset/v1`, O:I's own TOML envelope) declares exactly one profile and three Skills — O:I's own guardian set:

```text
oi:skillset:base-guardian
  oi:skill:operate-suite          (skills/oi/SKILL.md)
  oi:skill:suite-operator         (skills/suite-operator/SKILL.md)
  oi:skill:central-session-strap  (skills/central-session-strap/SKILL.md)
```

All three entries carry `revision_policy = "resolve_authoritative_installed_revision"`: O:I resolves each Skill's authoritative revision from the installed native owner rather than pinning one by hand. A projected copy carries its source revision in its receipt header; local edits never become authoritative.

A test guards this shape: `shipped_manifest_declares_only_oi_owned_skills` fails if the shipped manifest ever names another product's Skills again. That is deliberate. The manifest once pinned every suite product's Skills; that made it a second registry in a second format, and its silent path drift proved the point.

## How the rest of the suite is composed

Each product keeps its Skills as native files in its own repository (Central `skills/`, Quaternal Logic `skills/`, AIKit `registry/`). AIKit is the suite's normal resolver: `aikit source add-directory` discovers those trees, `sync` snapshots them, `aikit trust record` records review, `aikit set create` composes native sets across products, and `aikit enable`/scopes project them. O:I routes refs and explains composition; it never registers or pins foreign Skills.

The governing path is now:

```text
native repository authoritative Skill source
  -> AIKit source discovery / sync / review / native sets
  -> scope-enabled projection
  -> Agent procedural competence
  -> native Capability / Action / authority gate
```

## Base versus Root

`oi:skillset:base-suite-operation` and `oi:skillset:root-metagentic-operation` remain real capabilities of the resolution machinery and are exercised by the test fixtures, but they are no longer shipped as registered sets. The resolver still rejects Root-scope profiles for `AgentScope::Ordinary`, and even for `AgentScope::RootWorld` the enum is projection eligibility/read-model input: Actuation must independently establish the real positional Root relation and native authority grants.

## Provenance and drift

`EffectiveSkillSet` carries expected and observed source revision independently. A mismatch degrades the view rather than silently substituting the new source. Surface records (`surfaces.json`, `suite/mainline.json`) continue to pin accepted-main revisions per product; those are acceptance records, not Skill registrations.

## Fallback

Without AIKit, direct projection remains limited in code to O:I/Central Skills. Foreign source-owned Skill bodies are never copied into O:I as a convenience path.

## Epi experience practices

QL-MEF owns its foundations, bounded provider Method, evidence-report Skill,
experience-preparation and experience-walk Methods. Resolve those native files
through AIKit; no foreign membership is added to the shipped O:I manifest.
Their complete source/discovery/projection/loading/use distinction is specified
in [QL's practice account](https://github.com/EpiLogos/QL-MEF/blob/main/docs/kernel-rebuild/AGENT-PRACTICE-AND-BOOTSTRAP.md).

AIKit `docs/SPEC-III-SKILLSETS-AND-FRECENCY.md` §§1–1.2 defines sets as folders with optional manifests. The native CLI is the authoritative authoring interface for its supported set
format. The tested AIKit revision creates writable folder sets with a `members`
file through `aikit set create`; that native command owns the materialisation
and no additional manifest is required. Membership still does not
enable a capability: explicit native scope resolution governs actual projection.
A controlled current-generation read-back proves delivery, not model loading or
successful use. The latter is exercised by the fresh-agent UX01/UX06 walk.
