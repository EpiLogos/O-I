# {O:I} Agent Skill

## Purpose

Use this skill when a user asks you to understand, install, inspect, compose, snapshot, verify, or enter a {O:I} system.

{O:I} is the sparse shared Idea and composition layer around six product surfaces. It is not the place to reimplement the products. Your first job is to disclose the active field clearly, use the installed suite front door where it is actually available, and preserve the native owner of every product operation.

## Functional field

- persistent personal ground — Central;
- agent actuation — Actuation;
- capability, context, model, profile, Skill/tool, HarnessComposition, session and Surface resolution — AIKit;
- developmental Project / Run / evidence / candidate / repair / ExecutionDisposition semantics — Software Factory;
- material execution, processes, services, storage, network/fabric and lifecycle — Workcell;
- formal QL/MEF system, operators, refraction and structural research — Quaternal Logic (`EpiLogos/QL-MEF`).

The six functions are centres of responsibility, not mandatory stages in one runtime pipeline.

The QL agent-runtime experiments have their canonical developmental/research home in Actuation. Do not route them to Software Factory merely because historical material remains in `agent-system-design`.

## First encounter

When this repository is present but `oi` is not installed, use its documented Rust installation helper. Then prefer this sequence for the base personal ground:

```text
oi install central
oi init --personal-ground $HOME/Central
oi status --json
oi ctrl doctor --json
oi ctrl action list --json
```

`oi install central` registers a compatible existing `ctrl` first. Otherwise it follows the pinned native Central source-install contract. `oi init --personal-ground` requires the real native surface; never create a partial Control/Work imitation when Central is absent.

A fresh Central root must contain `Control/user`, `Control/agents`, `Control/machines`, `.central`, and `Work`. The three Control roots initially remain empty.

## Control authorship

Do not generate default personal profiles, preferences, machine facts, or agent rules into Control.

Durable Control content is human-authored or explicitly adopted. An agent can use Central's Control-maintenance and Machine-declaration Skills to propose durable material, but human acceptance is required before authored Control mutation.

## Route by ownership

Use Central for human-authored Control, ordinary Work, machine intent, machine reconciliation/recovery, and canonical Central Actions/Connectors.

Use Actuation for first-class agency/actuation, model/harness/agent-instance research, and the QL runtime experiment programme.

Use AIKit for capabilities, context sources, models, harnesses, profiles, Skills/tools, HarnessComposition, sessions, Surfaces, and local capability/context resolution.

Use Software Factory for developmental Projects, Runs, evidence, Candidates, repair, ExecutionDisposition and related developmental semantics.

Use Workcell for material execution demands, workspaces, providers, project runtimes, services, storage, network/fabric, bindings, capacity, placement, and lifecycle.

Use Quaternal Logic for QL/MEF formal operations, refraction, operators and related structural research machinery.

## Product commands

All six native product centres have accepted commands composed into the `oi` namespace. Use the canonical namespace or, where available, the compatibility alias:

```text
oi central ...      -> ctrl ...        (alias: oi ctrl)
oi actuation ...    -> actuation ...
oi aikit ...        -> aikit ...       (alias: oi kit)
oi factory ...      -> factory ...
oi workcell ...     -> workcell ...    (alias: oi workcell)
oi ql ...           -> ql ...
```

`oi products [--json]` discloses the complete six-product command field.

Dispatch is transparent. On Unix the implementation uses process replacement, so native arguments, input/output, signal behavior and exit status remain authoritative.

## Operative praxis

The target pre-`#97` suite UX is one first-hand `oi` instrument backed by AIKit's accepted general resolver. The implementation Wayfinder is `docs/OI-OPERATIVE-FRONTDOOR-WAYFINDER.md`; AIKit `#142` remains the runtime owner of `ResolveExpression`, typed refs, Search/Explain/History, Method discovery and the operative address grammar.

**Do not pretend this resolver syntax exists when the installed AIKit/O:I composition does not expose the accepted contract.** On current compositions without that floor, use the verified aliases and native owner commands above.

When the installed composition does expose the accepted resolver/front-door contract, operate in this order:

1. **Resolve the present subject and World before inventory-scanning tools.** Use the semantic address/resolver to determine the canonical object, current context and relevant relations.
2. **Prefer a Method when the intention is already intelligible.** A Method is the situated operational pattern that can draw together the relevant knowledge, Skills and Actions. Do not manually inspect a broad Skill catalogue when a Method already expresses the work.
3. **Keep Skill, Capability and Action distinct.** A Skill explains reusable procedure. Capability says an operation is available. The native Action/authority seam decides whether it may actually happen.
4. **Use Explain when resolution surprises you.** A ranked result should remain inspectable: semantic relevance first, then authored/context preference, then successful learned accessibility/familiarity, then stable identity.
5. **Use History/familiarity to recover known paths, not to replace semantic identity.** A familiar alias or traversal may become easier to reach while the canonical ref remains authoritative.
6. **Record familiarity only from successful use.** Displaying, hovering, ranking or failing an operation must not teach a path as successful praxis.
7. **Dispatch canonical Actions through `oi` only when that front-door capability is present.** O:I forwards the selected canonical ActionRef to its native owner and preserves the real authority result; it does not guess shell commands or duplicate Action implementation.
8. **Preserve surface parity.** CLI, TUI/palette, structured Agent, Pi and desktop projections should operate the same typed refs and resolver evidence rather than inventing surface-local identities or scoring laws.

The intended relation is:

```text
present Focus / intention
        ↓
semantic address / ResolveExpression
        ↓
Method
        ↓
knowledge + Skills + Actions
        ↓
capability / authority
        ↓
Action / encounter
        ↓
Return
        ↓
revised World + successful familiarity
```

For Guardians, use this same ordinary instrument and broad tool ecology. Product differentiation comes from persistent product Focus, stewarded claims/dependencies, Wiki resonance, product-relative navigation history, attention over relevant Activity and unresolved Returns/Candidates. Do not create six private memory systems or six special tool inventories to simulate Guardian identity.

## Suite Snapshot

Use `oi snapshot` to represent one exact composition candidate. A snapshot is sparse composition metadata, not product configuration or a transitive dependency lockfile.

For a registered source checkout, O:I can observe the exact Git commit. For a registered native CLI, it can use the exact native version when available. Use `--select SURFACE=REVISION` only when that exact candidate revision has been established externally and must be represented without pretending it is the currently installed state.

Never infer accepted mainline status from a branch name, a PR, command reachability, or a green product check. `--accepted-mainline SURFACE=REVISION` is an explicit acceptance assertion and must match the selected revision. A full-suite freeze should use `--require-full`; before harmonisation, preserve partial/unaccepted state truthfully.

Record cross-product facts with `--accept-compatibility SURFACE=FACT` only after those facts have actually been accepted. Descriptor compatibility prose is context, not acceptance evidence.

## Whole-level verification

Use `oi verify` as a thin aggregator. It can inspect O:I composition metadata, compare current exact revisions with a Suite Snapshot, validate aliases/reachability, and invoke only the native verification operation declared in trusted O:I surface metadata.

Do not treat these states as interchangeable:

```text
unavailable
unsupported
skipped_physical_gated
failed
incompatible
passed
```

`failed` preserves a native operation's non-zero result. `incompatible` is an O:I composition/revision mismatch. `unavailable` means the declared operation cannot run here. `unsupported` means the owning product has not yet published the required self-check contract. `skipped_physical_gated` means the check requires an explicitly physical/provider environment.

Use `--receipt PATH` to emit the exact `oi.composition-receipt/v1` evidence for automation or later local acceptance. The pre-local receipt must not be described as physical acceptance. It can retain outstanding Workcell/reference-machine/provider requirements without choosing a provider or reinterpreting native evidence.

Do not:

- reproduce native product verification logic in O:I;
- execute commands supplied by an untrusted snapshot;
- silently repair another product;
- equate command reachability with acceptance;
- claim a branch-only revision is an accepted mainline revision;
- infer physical/provider acceptance that did not run.

## Existing Work placement

Treat `oi migrate <path>` as a conservative one-shot placement of an existing local work tree under the configured Central `Work` field. Central's normative Work model is ordinary filesystem material; there is no required Central Project identity to create.

The command previews source and target, validates the Central ground through native doctor, refuses target collisions, and on supported Unix hosts refuses cross-filesystem placement rather than copying and deleting. It moves the directory as a whole, preserving `.git` and ordinary files.

Do not create or rename Factory Project/Run objects, AIKit registrations, Workcell bindings, or other derived state. Report that path-derived systems may need an explicit refresh after a successful placement.

## Installation and registration

Prefer discovery and registration over reinstalling an existing product. Follow only installation mechanisms verified in the live surface descriptor. O:I stores composition/handoff metadata, not native product configuration.

After setup, report what was installed or registered, the native entry point, any `oi` alias, the docs entry, and remaining physical or product-specific acceptance where relevant.

## Communication

Write for the user's experience of the field. Use {O:I} as the canonical written form and `oi` for the CLI command. Use **Quaternal Logic** as the public product name; use `QL-MEF` when referring specifically to its repository or implementation vocabulary.

## Guardrail

Before adding code to this repository, ask whether the change is shared disclosure, setup, installation/registration, status, snapshot/verification composition, documentation, safe work placement, compatibility, aliasing, or thin suite-level resolver/Action dispatch. If it changes what a native product can actually do, implement it in that product instead.
