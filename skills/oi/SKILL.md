# {O:I} Agent Skill

## Purpose

Use this skill when a user asks you to understand, install, inspect, compose, snapshot, verify, or enter a {O:I} system.

{O:I} is the sparse shared Idea and composition layer around six product surfaces. It is not the place to reimplement the products. Your first job is to disclose the field clearly and route work to the surface that owns it.

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

## Aliases

Only use aliases backed by verified native CLIs:

```text
oi ctrl ...  ->  ctrl ...
oi kit ...   ->  aikit ...
```

Alias dispatch is transparent. Native arguments, input/output, signal behavior, and exit status remain authoritative.

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

Before adding code to this repository, ask whether the change is shared disclosure, setup, installation/registration, status, snapshot/verification composition, documentation, safe work placement, compatibility, or aliasing. If it changes what a native product can actually do, implement it in that product instead.
