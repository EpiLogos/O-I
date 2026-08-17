---
name: oi-suite-operator
description: Compose and explain source-owned native product Skills as O:I Base/Root suite SkillSets without copying procedures or granting authority.
---

# O:I suite operator

Use this O:I-owned Skill to operate the installed suite as a composed whole. O:I owns the composition and explanation; each native product remains the authority for the procedure it teaches.

## Contract metadata

- Semantic ref: `oi:skill:suite-operator`
- Native owner: `EpiLogos/O-I`
- Suite manifest: `skills/suite-operator/skillset.json`
- Manifest schema: `oi.suite-skillset/v1`
- Effective read model: `oi.effective-skillset/v1`
- Normal resolver: AIKit when installed
- Direct fallback: O:I/Central-only derived projection

## Constitutional distinctions

```text
Skill available != Capability granted
Capability available != Action authorised
SkillSet selected != Root position / metagency
projected Skill copy != authoritative Skill source
procedural competence != permission
successful use != automatic Skill promotion
```

The Base profile is ordinary suite-operating competence. The Root/metagentic profile is a larger **procedural composition only**. An Actuation-owned positional `WorldBinding`/root determination must establish Root Agency independently; this Skill and the profile cannot do so.

## Procedure

1. **Ground in Central.** Resolve the authorised actor's durable authored Control/machine intent through Central's native Skills where Central is installed. Keep authored source distinct from learned/generated state.
2. **Inspect installed products.** Determine which suite products are actually installed and obtain their current native Skill/source revisions. Never infer an installed procedure from O:I documentation.
3. **Choose the smallest profile.** Use `oi:skillset:base-suite-operation` for ordinary operation. Use `oi:skillset:root-metagentic-operation` only when the calling context independently proves Root position and the work genuinely needs the richer procedures.
4. **Resolve through AIKit when available.** Feed the manifest's native refs into AIKit's existing Skill/SkillSet resolution. AIKit remains owner of trust, policy/platform/target gating and harness projection. A named set member may still be withheld.
5. **Inspect the `EffectiveSkillSet`.** Check owner, source repository/path, expected/observed revision, availability, requiredness, risk/permission metadata and any Capability/Action state supplied by authority observations. Missing installed-product Skills or revision drift must remain visible as degraded state.
6. **Route work to the native owner.** Use Actuation for Agent/Agency/authority/Return, AIKit for resolution/runtime/knowledge, Factory for developmental Runs/Claims/Evidence/Candidates, Workcell for materialisation/providers, QL-MEF for optional formal/refraction operations, and Central for durable authored ground. O:I does not duplicate their procedures.
7. **Fail closed on authority.** A Skill or Capability can explain what to request. The native Action/authority seam decides whether it may happen. Do not reinterpret an O:I effective read model as an authority token.
8. **Preserve source provenance and drift.** A pinned source revision must match the observed revision to be current. Source drift is reviewable state, not silent projected-source replacement.
9. **Use direct fallback narrowly.** If AIKit is absent, `materialise_direct_projection` may derive only O:I/Central Skills from already-resolved authoritative content. Foreign native Skills are never copied into O:I as fallback.
10. **Promote explicitly.** Native Skill improvements return to the native owner for review/Recognition. Factory evidence, repeated use, scoring or benchmark wins cannot promote source automatically.

## Installed-product degradation

`if_product_installed` means absence of the product is not falsified as competence. If the product is installed and its native Skill is missing or drifted, the effective suite view is degraded. Optional QL behaviour remains product-owned and no-QL-safe.

## Verification

Run `cargo test --manifest-path cli/Cargo.toml --test suite_skillset`. Acceptance proves a full-suite Root read model with all source-owned refs, ordinary Agency rejection of the Root profile, revision drift detection, and O:I/Central-only direct projection fallback.
