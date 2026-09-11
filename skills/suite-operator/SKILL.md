---
name: oi-suite-operator
description: Compose and explain source-owned native product Skills as O:I Base/Root suite SkillSets without copying procedures or granting authority.
---

# O:I suite operator

Use this O:I-owned Skill to operate the installed suite as a composed whole. O:I owns the composition and explanation; each native product remains the authority for the procedure it teaches.

## Contract metadata

- Semantic ref: `oi:skill:suite-operator`
- Native owner: `EpiLogos/O-I`
- Suite manifest: `skills/suite-operator/skillset.toml`
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
3. **Choose the smallest profile.** Use `oi:skillset:base-guardian` for the shipped top-level SkillSet a fresh personal ground projects into its harnesses. Use `oi:skillset:base-suite-operation` for ordinary operation. Use `oi:skillset:root-metagentic-operation` only when the calling context independently proves Root position and the work genuinely needs the richer procedures.
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

## Continuous-work coding and verification

`oi:skillset:coding` and `oi:skillset:verifier` inherit the shipped guardian set and this required Skill. They are procedural roles, not new Agents, profiles of a person, grants or an installation claim. The ordinary bootstrap already embeds this exact Skill; native AIKit collection continues to own its subsequent projection. The test `continuous_work_governance` resolves both roles through the shipped resolver and checks the complete governance bytes through native projection, including disconnection and local-edit failures.

The block below preserves the supplied S4 source verbatim, including its draft standing. Source: https://github.com/EpiLogos/Factory/issues/195#issuecomment-5620708509. SHA-256 of the block including its final newline: `7aa3005900612ee79323bf61b466ed25e36ee5427649b1b53953a8a53983cd61`.

For this commissioned implementation, apply its completion discipline now. Publication or projection does not adopt a private governance draft, prove a harness loaded it, or impose a launch gate on other product lanes. Record those later facts separately through Central and the actual harness. Never run an installation or modify Control merely to make a test pass.

The executable acceptance and local campaign entry is `python3 scripts/caw_campaign.py --help`. It extends O:I #201/#202–#205 with P01–P28; a missing required operation stays pending and returns a nonzero acceptance status. A successful infrastructure suite is not a whole-feature verdict.

<!-- caw-governance-source:start -->
# Wayfinder Governance — Usable End-to-End Features

**Standing:** Draft for human validation.  
**Applies to:** Every Wayfinder and feature-level completion claim across the suite.

## 0 — Ground: preserve the intended experience

Begin from the original human commission and current authored positions. State what the person or Agent must actually be able to accomplish, why it matters, and the observable outcome. Keep that acceptance object available throughout development. A smaller implementation slice may advance it; it cannot silently replace it.

## 1 — Definition: make completion testable

Maintain one parent acceptance record connecting each required behaviour to its native owner, implementation, executable test, exact source basis and required evidence. Include the normal entry point, prerequisites, important refusal/recovery cases and final returned result. Keep implemented, merged, integrated and observed distinct. Child completion does not close an unmet parent requirement.

## 2 — Operation: exercise the complete path

Verify the feature through the public human or Agent operation that is meant to provide it, across the actual owner boundaries, through its state changes and back to an observable result. Exercise the deployed composition as well as isolated components. A schema, enum, mock response, journal append, receipt, screenshot or green unit suite proves only what it actually exercises. Essential integrations must run in the feature gate; an environment-gated test that did not run leaves its acceptance requirement open.

## 3 — Judgement: require independent verification

Before feature or Wayfinder closure, a fresh verification session or independent subagent that did not implement the slice must inspect the original commission, full parent acceptance record, current code and evidence. It must independently exercise the complete usable path and at least one consequential failure/recovery path. It must check that tests would fail when a required connection is missing, rather than merely confirming the implementation's own framing. An unavailable testing environment produces an explicit pending requirement, not an approval based on the implementer's account.

## 4 — Context: prove the feature in its intended world

Record exact source and installed executable revisions, World and Profile conditions, native providers, Workcell and relevant permissions. Include existing-user state, restart, concurrency, timing and privacy wherever they affect the promised experience. Automate deterministic and cross-product checks; obtain real-provider, material and human-experience evidence where the acceptance requires them. Agent judgement may vary, but contractual state transitions, attribution and verification must remain testable. Respect other active work and use native owner operations for repair.

## 5 — Return: close from demonstrated use

Return a plain-language account of what now works, how to use it, the evidence, independent verification result and any remaining limits. Feature closure requires the independent verdict:

> usable end-to-end feature.

That phrase is reserved for the full acceptance object at its required evidence level. Otherwise report the exact unfinished step, its owner and next executable action, and keep the parent open. Returned defects and useful observations feed the existing Factory evidence/learning path and regression suite. They do not automatically rewrite human-authored intent or substitute Agent assessment for required human Recognition.
<!-- caw-governance-source:end -->
