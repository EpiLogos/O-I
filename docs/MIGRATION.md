# Project Adoption and Migration

Many users will arrive with existing projects. {O:I} should meet that reality directly.

A repository does not become a new Project because its local path changes.

The migration path should therefore preserve project identity and repository history while changing the project's personal placement and refreshing derived local state.

## Example

A project currently lives at:

```text
~/code/foo
```

The user wants it under:

```text
~/Central/Work/foo
```

The intended operation is:

```text
existing Project
    ↓
adopt into personal ground
    ↓
move or link source
    ↓
refresh local bindings and indexes
    ↓
continue as the same Project
```

## Ownership

The {O:I} layer provides the system-level entry:

```text
oi migrate ~/code/foo
```

The actual project-control operation belongs to the registered personal-ground surface and its native CLI.

This keeps one clear responsibility split:

- `oi` identifies the installed surface and begins the handoff;
- the project-control surface validates the source, target, repository state, and Project metadata;
- capability indexes and other derived state refresh through their owning systems as needed.

## Preserve and refresh

Migration should preserve durable identity and history such as:

- Git history;
- Project identity;
- recognised project canon;
- durable Run history where present;
- source and external references.

Migration may need to refresh material or derived state such as:

- local path bindings;
- checkout paths;
- capability or source indexes;
- session references;
- runtime materialisations.

The exact refresh operations belong to the products that own those states.

## Safety

A migration command should show the source and target before mutation. It should detect path collisions and dirty repositories. It should not destroy an existing source tree until the native project-control surface has completed its own checks.

The first implementation should favour a small, inspectable adoption path over a large import framework.

## Fresh projects and remote repositories

The same personal work tree should support:

- new Projects;
- clones from remote repositories;
- adoption of existing local Projects.

These are different ways to enter the same Project world. The personal-ground surface should own their detailed workflows.
