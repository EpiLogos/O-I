# O:I Suite Operator Skill

## Purpose

Use this O:I-owned Skill when operating the installed suite as a whole. It composes authoritative product Skills and public product contracts; it does not copy their business logic into O:I.

## Profiles

`oi:skillset:base-suite-operation` is the ordinary operating profile. `oi:skillset:root-metagentic-operation` is the expanded world-bound/metagentic operating profile.

The Root profile is **projection eligibility, not an Agent kind**. It may be selected only after the calling context supplies an Actuation-owned positional root determination: an ordinary Agency is root for a scope because its `WorldBinding` binds it to that scope's enclosing Objective Internality. The SkillSet profile neither establishes Root Agency nor grants metagency.

```text
Skill available
  != Capability granted
  != Action authorised
  != authority to mutate authored Central source
```

An ordinary worker receives the smallest task-fit/native Skill or the base profile. Do not project the Root profile merely because it exists in the suite catalog.

## Native Skill ownership and gaps

Every canonical procedural Skill remains owned by the product whose operation it teaches. The suite manifest points to authoritative native sources; it does not embed their bodies.

If an installed product has not yet published the expected canonical Skill, keep that absence explicit as `awaiting_native_publication`. Do not invent an O:I source path, infer competence from an Action catalog, or copy product documentation into an O:I-owned replacement Skill.

AIKit is the normal dynamic resolver/projector when installed. Its runtime/resource contracts remain AIKit-owned. O:I supplies suite composition, not a parallel capability resolver.

## Minimal no-AIKit projection

If AIKit is absent, O:I may derive only the minimum O:I/Central projection from authoritative native content already resolved by the caller.

A derived projection records native owner, repository/path, exact source revision and a sidecar projection receipt. Update law is strict:

1. a destination with no O:I receipt is local/user-owned and is never overwritten;
2. an untouched O:I-derived copy may be replaced when its authoritative source revision/body changes;
3. a locally edited derived copy is preserved and reported as conflict rather than overwritten;
4. unchanged source/content is a no-op;
5. removal deletes only an unmodified O:I-owned file/receipt pair.

The local drift fingerprint is not a trust or security primitive. Encounter/admission/security authority remains separate.

## Extension workflow

When an Agent is asked to extend the suite:

1. identify the native product that owns the desired semantic operation;
2. use that product's public Component/Provider/Connector/Action extension contract;
3. package/install through `oi.package/v1` only when a distributable suite envelope is needed;
4. keep `package_ref`, native `contribution_ref`, target-native Component/Provider identity and `ActionRef` distinct;
5. request native registration from the owning product and retain its returned registration/verification ref;
6. let O:I record the lifecycle envelope only after the native outcome exists;
7. never patch a private registry, hidden desktop state or browser-only handler to simulate installation.

A package permission declaration is disclosure/consent input. It is not a Capability grant. A rendered component is not a native bridge principal.

## Cross-product ownership

- Central owns authored personal ground, Work and its Actions/Connectors.
- Actuation owns Agent/Agency/WorldBinding/Determination/Return semantics.
- AIKit owns Component/Contract/Contribution/Surface/HarnessComposition and resolution/projection.
- Software Factory owns Project/Run/RunMap/Candidate/Claim/Evidence and Build semantics.
- Workcell owns material execution/provider lifecycle.
- Quaternal Logic owns QL/MEF formal semantics.
- O:I owns suite composition, placement, package envelope and whole-level disclosure.

Do not turn these boundaries into O:I-local substitutes.
