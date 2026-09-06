# Canonical suite operator SkillSet

O:I composes and explains source-owned procedural competence; it does not become the owner of native product procedures, and it is not a Skill registry. Registration and set composition are AIKit functionality.

## What O:I ships

The shipped manifest (`skills/suite-operator/skillset.toml`, schema `oi.suite-skillset/v1`, TOML because AIKit's authored sets are TOML) declares exactly one profile and three Skills — O:I's own guardian set:

```text
oi:skillset:base-guardian
  oi:skill:operate-suite          (skills/oi/SKILL.md)
  oi:skill:suite-operator         (skills/suite-operator/SKILL.md)
  oi:skill:central-session-strap  (skills/central-session-strap/SKILL.md)
```

Both entries carry `revision_policy = "resolve_authoritative_installed_revision"`: O:I resolves each Skill's authoritative revision from the installed native owner rather than pinning one by hand. A projected copy carries its source revision in its receipt header; local edits never become authoritative.

A test guards this shape: `shipped_manifest_declares_only_oi_owned_skills` fails if the shipped manifest ever names another product's Skills again. That is deliberate. The manifest once pinned every suite product's Skills; that made it a second registry in a second format, and its silent path drift proved the point.

## How the rest of the suite is composed

Each product keeps its Skills as native files in its own repository (Central `skills/`, Quaternal Logic `skills/`, AIKit `registry/`). AIKit is the suite's normal resolver: `aikit source add-directory` discovers those trees, `sync` snapshots them, `aikit trust record` records review, `aikit set create` composes TOML sets across products, and `aikit enable`/scopes project them. O:I routes refs and explains composition; it never registers or pins foreign Skills.

The governing path is now:

```text
native repository authoritative Skill source
  -> AIKit source discovery / sync / trust / TOML sets
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
