# Placing existing work under Central

Central's normative Work model is ordinary filesystem material. A directory under `Work/` does not require a Central-specific Project format, identity record, or adoption Action.

For that reason, `oi migrate <path>` has one deliberately narrow meaning:

> Place this existing local work tree under the configured Central `Work` field while preserving what it already is.

## Operation

```text
oi migrate ~/code/foo
```

O:I resolves the configured personal ground, verifies it through native `ctrl doctor --json`, and previews:

- the existing source directory;
- the intended `<Central>/Work/<name>` target;
- identity/history preservation;
- the compatible native Central surface that validates the ground.

It then performs one same-filesystem directory rename. Moving the directory as a whole preserves `.git`, uncommitted files, nested data, and the work tree's existing identity. O:I does not create or rename a Factory `Project`, Run, AIKit registration, Workcell binding, or any other derived object.

## Safety boundary

The first implementation is intentionally conservative.

It:

- requires a real compatible Central surface and a doctor-valid personal ground;
- requires the source to be a directory and refuses a symlink source;
- returns success without mutation when the source is already at its intended Work target;
- refuses an existing target collision before mutation;
- on Unix, compares source and target-parent filesystem devices and refuses cross-filesystem placement;
- uses filesystem rename only; it does not implement copy-and-delete fallback;
- reports failure without deliberately deleting the original source;
- leaves all derived systems untouched.

A dirty Git work tree does not need special treatment because the operation does not edit Git or project files; the entire directory is moved intact.

On platforms where safe same-filesystem placement has not been proven, migration refuses rather than pretending to provide a migration framework.

## After placement

O:I reports that path-derived systems may need an explicit refresh. This can include AIKit registrations or indexes, Factory paths, Workcell materialisations, editor state, or other integrations that remember the old path. O:I does not perform those refreshes implicitly.

This is a one-shot composition handoff, not a project manager.
