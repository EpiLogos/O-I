# O:I Suite Operator Skill

## Purpose

Use this O:I-owned Skill when operating the installed suite as a whole. It composes authoritative product Skills and public product contracts; it does not copy their business logic into O:I.

## Profiles

`oi.skillset/base` is the ordinary operating profile. `oi.skillset/root` is a distinct Root/world-bound profile and must only be projected for an Agency whose scope actually warrants it.

Root profile membership does not itself grant a Capability or authorize an Action.

```text
Skill available
  != Capability granted
  != Action authorised
  != authority to mutate authored Central source
```

AIKit is the normal resolver/projector when installed. If AIKit is absent, O:I may derive only the minimal O:I/Central Skill projection from already-resolved authoritative local source. Derived files must retain source owner/revision and remain replaceable; they are never a second authoritative Skill body.

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

## Desktop use

The desktop may render authoritative read models, canonical Action bindings and stable refs from native contributions. Selection propagation should carry the minimum stable subject ref required by the receiver rather than wholesale prompt/Context state.

Read-only hosting is preferred before mutation. If a native adapter is not landed, surface `pending_native_adapter` explicitly and continue with other contributions.

## Cross-product ownership

- Central owns authored personal ground, Work and its Actions/Connectors.
- Actuation owns Agent/Agency/WorldBinding/Determination/Return semantics.
- AIKit owns Component/Contract/Contribution/Surface/HarnessComposition and resolution/projection.
- Software Factory owns Project/Run/RunMap/Candidate/Claim/Evidence and Build semantics.
- Workcell owns material execution/provider lifecycle.
- Quaternal Logic owns QL/MEF formal semantics.
- O:I owns suite composition, placement, package envelope and whole-level disclosure.

Do not turn these boundaries into desktop-local substitutes.
