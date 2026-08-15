# Project Adoption and Migration

Many users will arrive with existing projects. A repository does not become a new Project because its local path changes.

The intended operation remains:

```text
existing Project
    ↓
adopt into personal ground
    ↓
move or link source
    ↓
refresh product-owned derived state
    ↓
continue as the same Project
```

## Ownership

The {O:I} layer provides one system-level entry:

```text
oi migrate ~/code/foo
```

The actual project-control operation belongs to Central. The native control surface must validate source and target, preserve repository/project identity, perform any move/link/adoption, and expose enough evidence for other products to refresh their own derived bindings.

`oi` should never implement that workflow in parallel.

## Current live boundary

The Central Rust integration currently exposes `ctrl` commands for root/init/doctor, Work discovery/opening, Control access, machine management, Actions, and recovery. It does **not** yet expose a project-adoption Action or CLI command.

That makes the present `oi migrate` implementation intentionally non-mutating. It resolves the configured personal ground and Central executable and prints:

- the existing project source;
- the intended `Central/Work/<project>` target;
- the requirement to preserve Project identity;
- the requirement to preserve repository history;
- the native Central surface that must ultimately own the operation;
- the fact that the native adoption handoff is not yet available.

It then exits without changing the source or target.

This is the correct implementation state for O-I issue #5: the entry exists, but completion remains blocked on a real Central contract rather than being filled by wrapper behaviour.

## When Central exposes adoption

Once Central publishes the native operation, `oi migrate` should become a thin delegation:

1. resolve the registered Central executable;
2. show the source and intended target;
3. invoke the native adoption command with the original project path;
4. preserve native output and exit semantics;
5. report the resulting registered location;
6. leave capability indexes, sessions, Workcell bindings, and other derived state to their owning products.

## Safety

Until the native handoff exists, {O:I} performs no path mutation. After it exists, collision checks, dirty-repository policy, identity preservation, move/link semantics, and rollback belong to Central's own adoption contract.
