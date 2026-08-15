# Installing {O:I}

{O:I} is composable. A user can begin with the minimum useful system and add other surfaces when they become useful.

The installation experience should support both humans and agents.

## Minimum

The minimal personal installation is:

```text
persistent personal ground
+
agent runtime
```

In the current product family, this means a Central working tree plus any supported LLM agent runtime.

The runtime can be installed independently. {O:I} does not require one canonical harness.

## Full composition

A fuller installation can add:

```text
capability and context resolution
+ developmental agency
+ material execution
+ recursive formal intelligence
```

Each module keeps its native installer and native CLI. The `oi` installer composes those surfaces and registers a common alias where appropriate.

## Intended entry

A future first-run experience should be close to:

```text
oi init
```

The command should discover existing compatible installations before offering to install anything again.

A user or agent can then add a module explicitly:

```text
oi install <module>
```

After installation, `oi status` should show the available surfaces and their aliases.

## Existing installations

A user who already has AIKit, Central, Workcell, or another module should be able to register that installation into {O:I} without replacing it.

The composition layer needs only the information required to find and describe the native surface:

```text
module identity
native executable
version
{O:I} alias
documentation entry
optional agent skill
```

The module continues to own its own configuration and runtime state.

## Agent-led setup

Agent-led setup is a primary use case.

A user should be able to clone this repository and ask an agent to install the desired system. The agent reads `skills/oi/SKILL.md`, inspects the machine, identifies existing modules, and performs the supported native installation steps.

The agent should ask the user only for decisions that materially affect the installation, such as which optional surfaces to add or where the personal ground should live.

At the end, it should report the commands that are now available.

## Default personal tree

The repository includes the minimal seed tree at:

```text
templates/Central/
├── Control/
└── Work/
```

The Central product owns the full semantics and lifecycle of this tree. The template exists only to give a new composed installation a clear initial shape.

## Foundational suite convergence and local acceptance

Installing selected modules and proving the first complete O:I suite are related but distinct operations.

Once the six native products have each reached an intentionally accepted foundational line, O:I should be able to record one exact **Suite Snapshot / Composition Receipt** containing their accepted native versions/commits, install/registration methods, entry points, aliases, documentation/Skills, verification declarations and relevant compatibility facts.

The acceptance path is:

```text
native foundational states on main
        ↓
exact O:I Suite Snapshot
        ↓
clean-environment install/register preflight
        ↓
physical install/register on the user's workstation
        ↓
native + declared cross-product verification
        ↓
known-good O:I suite state
        ↓ later
reference server / richer physical topology acceptance
```

O:I owns the receipt and whole-level composition evidence. Product failures return to the product that owns the behaviour.

A future `oi verify` may aggregate native self-checks and composition/alias integrity, but it must remain thin: it does not reinterpret native product health or manufacture physical evidence that the current environment did not observe.

See [`CONVERGENCE-AND-ACCEPTANCE.md`](CONVERGENCE-AND-ACCEPTANCE.md) and issue #17.

## Current state

The documentation and template are present now. The `oi` installer and alias registry are tracked as implementation work in GitHub Issues. The suite-convergence/local-acceptance protocol is tracked by #17 and becomes executable as the native install/verification surfaces mature.
