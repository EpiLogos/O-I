# `oi` CLI — Disclosure and Composition Surface

## Intent

`oi` is the command-line front door for a composed {O:I} installation.

It should be easy to remember and easy for an agent to discover. Its purpose is to make the system visible, install selected modules, and hand work to the native surfaces that own it.

The command should stay small.

## Two command layers

A module keeps its native command when it is installed alone.

When the same module is part of a {O:I} installation, `oi` can expose an alias for that command.

The user can therefore choose either form:

```text
ctrl projects list

oi ctrl projects list
```

or:

```text
aikit open my-project

oi kit open my-project
```

The alias must preserve the native surface. The {O:I} wrapper should not copy command semantics into a second implementation.

## Why the alias matters

A single namespace gives the whole system one easy point of recall.

For a human, `oi` answers: *what do I have, and where do I go next?*

For an agent, `oi` answers: *which installed surface owns this operation, and how do I invoke it?*

This makes the architecture easier to disclose without making the wrapper larger than it needs to be.

## Initial command families

The first implementation should stay close to the following surface:

```text
oi help
oi status
oi init
oi install <module>
oi docs [topic]
oi migrate <path>

oi <module-alias> [native arguments...]
```

The exact spelling can change during implementation. The responsibilities should remain narrow.

### `oi help`

Explain the field, the installed aliases, and the next useful command.

### `oi status`

Show the local {O:I} composition in a compact form. At minimum, report installed modules, native executables, aliases, versions where available, and the current personal-ground path.

### `oi init`

Create or adopt a local {O:I} composition. If the user requests the personal-ground surface, initialise the default directory shape and install or link the native CLI that owns it.

### `oi install <module>`

Install or register one module. The implementation should prefer the module's supported installation mechanism instead of copying its internal installer.

### `oi docs [topic]`

Open or print the relevant human-facing documentation. Topics should include the whole architecture and each installed module.

### `oi migrate <path>`

Enter the project-adoption path. The actual project operation should be delegated to the personal-ground / project-control surface.

### `oi <alias> ...`

Resolve an installed alias and dispatch to the native executable with the remaining arguments.

## Alias registry

Aliases should be explicit installation metadata.

Two aliases are already natural from the current surfaces:

```text
ctrl  -> ctrl
kit   -> aikit
```

The remaining aliases should be fixed only after the native CLIs for those products are inspected. {O:I} should not invent parallel terminology where a product already has a good command name.

A conceptual module record is enough for the first design:

```toml
id = "ai-kit"
alias = "kit"
executable = "aikit"
version = "..."
docs = "..."
skill = "..."
```

The record describes composition. It does not replace the module's own configuration.

## Dispatch contract

Alias dispatch should be transparent.

A first implementation should:

1. resolve the alias;
2. locate the registered executable;
3. pass through arguments and standard input;
4. connect standard output and standard error directly;
5. return the native exit status;
6. fail clearly when the module is missing or the executable cannot be found.

This is intentionally ordinary command-line behaviour.

## Installation disclosure

Many users will ask an agent to perform setup.

The CLI should therefore produce output that is useful to both a person and an agent. It should state what changed, which native surface was installed or linked, and which command is now available.

For example:

```text
Installed: AIKit
Native command: aikit
{O:I} alias: oi kit
Docs: ...
```

The output should avoid hidden state and avoid presenting the wrapper as the owner of the installed module.

## Migration disclosure

A migration command should explain the semantic operation before the physical move.

For example:

```text
Adopt existing project: ~/code/foo
Target work tree: ~/Central/Work/foo
Project identity: preserve
Repository history: preserve

Delegating project adoption to: ctrl ...
```

The native project-control surface can then perform its normal validation and mutation.

## Agent use

The `oi` skill should teach agents to begin with `oi status` when they do not know the installation state.

An agent should then route requests by functional ownership:

- personal ground and project control -> the registered control surface;
- tools, skills, Actions, and ContextSources -> the registered capability/context surface;
- developmental Runs and related work -> the developmental surface;
- material execution -> the Workcell surface;
- QL-MEF operations -> the formal/semantic surface;
- runtime-specific behaviour -> the configured agent runtime.

The `oi` command is the map and dispatcher. The native CLI remains the place where domain behaviour lives.

## Implementation principle

The first CLI should prefer a few reliable operations over a broad command taxonomy.

Its success criterion is simple:

> A new human or agent can inspect the system, install what is needed, and reach the correct native surface without first learning six unrelated command families.
