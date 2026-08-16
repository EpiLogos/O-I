# Suite operator SkillSet

The canonical suite composition lives at `skills/suite-operator/skillset.json` and is validated by `oi.suite-skillset/v1`.

## Ownership

A suite Skill relation identifies an authoritative product-owned Skill by semantic `skill_ref`, native owner, repository/path provenance, revision policy, compatibility, expected Actions/Capabilities and risk/permission class. O:I owns only this composition relation.

O:I does **not** embed native product Skill bodies in the manifest. At the live state in which this contract was implemented, publishable native Skills were verified in O:I and Central. Actuation, AIKit, Software Factory, Workcell and Quaternal Logic had not yet published canonical product Skills at stable native paths on their active implementation lines. Those relations therefore appear as `expected_native_skills` with `awaiting_native_publication`, not invented paths or copied procedures.

This is deliberate: an absent native Skill is a visible integration frontier, not permission for O:I to manufacture a second source of truth.

## Profiles and positional Root Agency

`oi:skillset:base-suite-operation` is the small operational profile. It composes O:I suite operation with Central authored-ground and machine-declaration competence when Central is installed.

`oi:skillset:root-metagentic-operation` inherits the base profile and adds Central connector authoring/hardening plus explicit publication gaps for product-owned root/metagentic procedures.

The profile's `root_world` scope is **projection eligibility, not an Agent kind**. `resolve_profile` rejects a root profile for an `ordinary` actor scope. The caller must derive `RootWorld` from the Actuation-owned positional relation established by a `WorldBinding`; choosing the profile neither establishes Root Agency nor grants metagency.

An ordinary worker should receive a task-fit product Skill or the base profile, not the root profile merely because root competence exists in the suite catalog.

## Three separate axes

The effective read model keeps these independent:

```text
Skill availability
    ≠ Capability granted
    ≠ Action authorised
```

`SkillObservation` records source availability/revision. `AuthorityObservation` separately records capability grants and Action authorisations. A Skill can therefore be present while a required capability is denied or an Action remains unauthorised. Side-effect approval remains native to the Action/policy contract beyond this composition layer.

## AIKit path

When AIKit is installed, O:I supplies the suite composition as source-owned references and the effective read model records `aikit_dynamic`. AIKit remains the owner of runtime capability/SkillSet resolution and harness projection; O:I does not reimplement Generation/Projection semantics here.

The second live-state sweep found AIKit PR #68 had published the current nested composition and Agent-connection/ACP tranche. O:I therefore does not invent ACP or connection types in this SkillSet contract. SessionSpace remains AIKit-owned post-#60 work and is likewise not invented here.

## Minimal direct path

For an O:I/Central-only installation, `materialise_direct_projection` can write an authoritative O:I- or Central-owned Skill body supplied by the caller into a supported harness-local destination while preserving:

- semantic Skill identity;
- native owner;
- canonical repository and native path;
- exact authoritative revision;
- a deterministic generated-copy fingerprint;
- a sidecar O:I projection receipt.

The manifest still contains only the source reference; source content is fetched/read from the owning product at materialisation time.

Update law:

- a destination without an O:I receipt is preserved as local/user-owned;
- an O:I-derived file whose content no longer matches its receipt is preserved as a local conflict;
- an untouched derived copy can be replaced when the authoritative revision changes;
- unchanged content/revision is a no-op;
- removal deletes only an unmodified projection whose receipt proves O:I ownership;
- the direct fallback rejects Skills whose native owner is not O:I or Central.

The fingerprint is for drift detection only, not security/trust. Encounter-security policy remains a separate authority/admission layer.

## Explainability

`EffectiveSkillSet` is intentionally serializable and UI-neutral. Desktop and TUI can consume the same model to explain:

- selected profile, positional scope and resolution mode;
- native owner and source path for every Skill;
- observed/expected revision and availability;
- capability and Action authority state;
- risk/permission metadata;
- currently missing native product Skills.

That shared read model can be projected through O:I/AIKit Surfaces without making a new desktop ontology.
