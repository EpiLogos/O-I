# O:I CLI Surface Conformance

Status: pre-#97 working contract.

O:I owns the installed whole-suite application experience: the desktop workbench, the `oi` command doorway, installation/composition disclosure, and whole-field routing across the six native product centres. Each product owns the semantics and application operations exposed through its native command surface.

## Native command field

The intended native command set is:

```text
Central          ctrl
Actuation        actuation
AIKit            aikit
Software Factory factory
Workcell         workcell
Quaternal Logic  ql
```

O:I exposes canonical product namespaces and may preserve short compatibility aliases:

```text
oi central ...     -> ctrl ...
oi actuation ...   -> actuation ...
oi aikit ...       -> aikit ...
oi factory ...     -> factory ...
oi workcell ...    -> workcell ...
oi ql ...          -> ql ...

compatibility aliases may include:
oi ctrl ...
oi kit ...
```

## One operation field, several projections

A product operation should have one native identity and meaning which can be projected through the surfaces that product supports:

```text
product application / Action / Reading
        ├─ native CLI
        ├─ structured --json/headless use
        ├─ O:I namespace dispatch
        ├─ O:I desktop workbench
        └─ agent/protocol projections where the owner supports them
```

The desktop and `oi` command therefore consume the same owner-native operation field. They are O:I-owned whole-suite experiences, not separate semantic implementations.

## Required native CLI qualities

Every native product CLI must provide:

- stable executable identity and `--version`;
- useful `help` with the product's supported public operation families;
- structured machine output for state/read/receipt operations (`--json` or an equivalent stable envelope);
- deterministic exit status and stderr/stdout behaviour suitable for composition;
- direct use of native application/Action/read-model handlers rather than CLI-local business logic;
- inspectable provenance/revision where the underlying operation carries it;
- native verification/doctor access appropriate to the product;
- tests proving command projection parity with the underlying handler;
- an install/package contract that O:I can register without duplicating product configuration.

A product may expose additional interactive/TUI behaviour, but the scriptable command contract must remain independently usable.

## O:I composition metadata

`surfaces.json` / current successor should be able to describe, per product:

```text
product id + public name
native executable
canonical O:I namespace
compatibility aliases
version command
native install/package contract
native verification command
structured-output capability
owner docs / Skills
current accepted revision
```

The descriptor is the source for O:I discovery/dispatch and desktop command/service registration. Command names must not be copied into several unrelated O:I tables when they can be derived from this owner metadata.

## Pre-#97 acceptance

Before physical #97 inhabitation:

1. all six product commands exist at accepted native mains;
2. Central/AIKit/Workcell existing CLIs are audited against this contract and any real gaps are fixed by their native owners;
3. Actuation, Factory and Quaternal Logic have native CLIs over their current application contracts;
4. O:I can install/register/discover all six and transparently dispatch canonical namespaces;
5. `oi status/current-world` reports all six executable relations;
6. the O:I desktop command/service field can resolve the same owner operations without maintaining a second semantic command catalogue;
7. exact-main CI proves native command + O:I alias parity for representative read and mutation operations;
8. `suite/mainline.json` / `surfaces.json` are recut only after owner-native CLI heads are accepted.
