# `oi` CLI — Disclosure and Composition Surface

`oi` is the command-line front door for a composed {O:I} installation. It is deliberately smaller than the products behind it.

Its current surface is:

```text
oi help
oi status [--json]
oi init [--personal-ground PATH]
oi register <module> [--executable PATH] [--root PATH] [--version TEXT]
oi install <module>
oi docs [topic|module]
oi migrate <path>

oi <module-alias> [native arguments...]
```

## Current native aliases

The six live repositories were inspected before the alias table was fixed. Only two currently publish user CLIs:

```text
ctrl  -> ctrl   # Central
kit   -> aikit  # AIKit
```

Software Factory, Workcell, Quaternal Logic, and the current Agent Runtime experiment are real surfaces but do not yet publish native user commands. `oi` therefore gives them no aliases.

## `oi status`

Status compares the live surface descriptors with the local composition and the machine's executable search path. Each surface is one of:

- **installed** — a native CLI is detected but has not been registered into {O:I};
- **registered** — the local composition points to a resolvable native executable or source root;
- **missing** — nothing is registered or detectable;
- **broken** — composition metadata exists, but its executable or source root no longer resolves.

`oi status --json` exposes the same information for agents and scripts, including the functional role, docs target, compatibility note, alias, version when known, and version-discovery source.

## Composition state

The local file contains only discovery and handoff metadata. It is not a second configuration system for the products.

The default path is:

```text
~/.config/oi/composition.json
```

`XDG_CONFIG_HOME` follows the usual XDG location, and `OI_HOME` can give tests or installations an explicit state directory.

A registration records module identity, native executable or source root, optional version, alias, docs entry, and optional skill entry. Product configuration remains where the product owns it.

## `oi init`

`oi init` creates the local composition and registers `ctrl` or `aikit` when those native commands are already available.

With `--personal-ground PATH`, setup prefers the native Central surface: if `ctrl` is available, `oi` delegates to `ctrl --root PATH init`. If Central is not yet installed, `oi` creates only the minimal `Control/` + `Work/` seed already carried by this repository and records the path for later composition.

## `oi register`

Registration wraps an existing installation rather than replacing it.

CLI surfaces can be registered by executable:

```text
oi register central --executable /path/to/ctrl
oi register ai-kit --executable /path/to/aikit
```

Non-CLI development surfaces can be disclosed from a source checkout:

```text
oi register workcell --root /path/to/Workcell
oi register quaternal-logic --root /path/to/QL-MEF
```

The registration keeps the product's own repository and docs visible and does not create a parallel runtime configuration.

## `oi install`

Installation always checks for an existing native command first and registers it rather than reinstalling it.

AIKit currently has a verified generic install recipe in its live README, so `oi install ai-kit` can clone the current source and run its documented locked Cargo installation before registration.

Other surfaces currently return an explicit register-after-native-install result rather than guessing an installer that the product has not published.

## `oi docs`

`oi docs` prints the {O:I} documentation entry points. A topic such as `architecture`, `surfaces`, `install`, or `migration` resolves to the corresponding {O:I} document. A module name resolves to its current native documentation, preferring a registered local checkout when the expected docs file exists.

## Transparent dispatch

For a real alias, `oi` resolves the native executable and passes all remaining arguments through unchanged.

On Unix, the implementation uses process replacement. The native command therefore receives the original stdin/stdout/stderr and signal relationship and becomes the process whose exit status the caller observes. The wrapper does not parse or reproduce product commands.

Missing or broken native surfaces fail before dispatch with a direct `oi status` / `oi register` recovery path. Alias collisions in composition state are rejected explicitly.

## `oi migrate`

Migration is an entry and handoff, not a project implementation.

The current live Central CLI has no project-adoption Action/command. `oi migrate` therefore discloses the intended source, target work tree, identity/history preservation, and native control surface, then exits without changing files.

This command becomes an actual delegation only when Central exposes the missing native contract.

## Success criterion

A new human or agent should be able to inspect the field, establish or register what exists, reach documentation, and invoke the native surface that owns an operation without first learning six unrelated entry conventions—and without {O:I} becoming a seventh product that reimplements them.
