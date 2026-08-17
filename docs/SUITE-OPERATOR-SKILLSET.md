# Canonical suite operator SkillSet

O:I composes source-owned procedural competence; it does not become the owner of native product procedures.

The governing path is:

```text
native repository authoritative Skill source + revision
  -> O:I oi.suite-skillset/v1 composition
  -> AIKit effective Skill/SkillSet resolution and projection where installed
  -> Agent procedural competence
  -> native Capability / Action / authority gate
```

The manifest now contains **no `awaiting_native_publication` entries** on this integration line. It pins the live native publication review heads for AIKit, Actuation, Software Factory, Workcell and QL-MEF and the current Central main revision. These are exact integration revisions, not claims that the corresponding native PRs have already been merged/promoted. After native-owner merges, this manifest must be repinned to the accepted revisions before O:I #27 is closed.

## Base versus Root

`oi:skillset:base-suite-operation` contains the day-one operator floor for all installed products. An ordinary worker can therefore understand Actuation's bounded Agency operations without becoming Root.

`oi:skillset:root-metagentic-operation` inherits Base and adds native authoring/extension procedures. The resolver rejects this profile for `AgentScope::Ordinary`. Even for `AgentScope::RootWorld`, the enum is projection eligibility/read-model input: Actuation must independently establish the real positional Root relation and native authority grants.

## AIKit relation

AIKit #73 publishes `aikit:operator`, `aikit:project-author` and `aikit:extension-developer` as native source sets. O:I names the actual member Skill refs it needs so provenance remains inspectable per Skill; AIKit remains responsible for materialising/resolving those sets and applying trust/policy/platform/target gates. O:I does not implement a second Skill registry.

## Provenance and drift

Every external native Skill in the manifest has repository, source path and exact pinned source revision. `EffectiveSkillSet` carries expected and observed source revision independently. A mismatch degrades the view rather than silently substituting the new source.

## Fallback

Without AIKit, direct projection remains limited in code to O:I/Central Skills. Foreign source-owned Skill bodies are never copied into O:I as a convenience path.
