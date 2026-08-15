# {O:I} Agent Skill

## Purpose

Use this skill when a user asks you to understand, install, inspect, compose, or enter a {O:I} system.

{O:I} is the sparse shared Idea and composition layer around six product surfaces. It is not the place to reimplement the products. Your first job is to disclose the field clearly and route work to the surface that owns it.

## Functional field

- persistent personal ground — Central;
- agent actuation — Agent Runtime;
- capability and context resolution — AIKit;
- developmental agency — Software Factory;
- material execution — Workcell;
- recursive formal intelligence — Quaternal Logic (`EpiLogos/QL-MEF`).

The six functions are centres of responsibility, not mandatory stages in one runtime pipeline.

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

Use the Agent Runtime for loop/harness/runtime-session behavior.

Use AIKit for capabilities, context sources, models, harnesses, profiles, sessions, and local capability/context resolution.

Use the Software Factory for Projects, Runs, Run Maps, Agents, Agencies, Artifacts, Claims, Evidence, Decisions, Candidates, and developmental work.

Use Workcell for execution demands, workspaces, providers, project runtimes, services, bindings, capacity, placement, and material lifecycle.

Use Quaternal Logic for QL/MEF formal operations and related research machinery.

## Aliases

Only use aliases backed by verified native CLIs:

```text
oi ctrl ...  ->  ctrl ...
oi kit ...   ->  aikit ...
```

Alias dispatch is transparent. Native arguments, input/output, signal behavior, and exit status remain authoritative.

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

Before adding code to this repository, ask whether the change is shared disclosure, setup, installation/registration, status, documentation, safe work placement, compatibility, or aliasing. If it changes what a native product can actually do, implement it in that product instead.
