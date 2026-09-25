# Placing existing work under Central

Central can read ordinary directories under `Work/` without adopting them. The O:I installation and migration bootstrap additionally prepares the native Central and Factory project surfaces so the person can begin work immediately. This distinction follows the 2026-09-22 owner commission under O:I #65/#201: Factory must not require a pre-existing Run to become usable.

## Operation

```text
oi migrate ~/code/foo
oi factory-projects --json
```

O:I verifies the configured Central ground through its native doctor, checks the source and target, then performs one same-filesystem directory rename. The move preserves `.git`, uncommitted files and nested data. An existing target or a symlink source refuses before the move; cross-filesystem copy-and-delete is not implemented.

When Factory is installed, bootstrap reconciles its native project placement for Central and the disclosed Work projects. Existing ProjectCentral identities are reused. An ordinary project without a manifest is initialized through Central's `projectcentral.init` Action; source is not adopted or rewritten to invent product purpose. Factory's `project setup` creates or reuses that project's `.factory` placement and native Project state with zero Runs. No Agent, provider, Workcell, Commission or execution is created by Factory setup.

A project already at its Work destination still receives the idempotent setup pass. A setup failure after a completed move is reported with its retained outcomes; it is not described as a rolled-back move. Repeating the same operation resumes setup without recreating Project identity or history.

## Native locations and preserved history

`oi factory-projects --json` is a read of Central's disclosed scopes and Factory's own location receipts. It returns each readable source plus per-project failures, including partial coverage. The desktop Desk consumes this route. Browser-local additional locations remain optional references to external Factory state, not the prerequisite for using a normal project.

`oi factory-projects --reconcile --json` performs the same native bootstrap explicitly. The personal-ground initialization and Factory-registration paths invoke it as part of setup. Factory state already present at its canonical location is validated and preserved. Setup never manufactures a Run to make a project appear ready.

When a linked project moves, Factory can relocate its Central link only if the native project reference and exact source digest are unchanged and the old source path is absent. The native state retains the original and relocated link as provenance. Changed source or identity requires its owning repair; existing Run/source/attempt history is not rewritten to force acceptance.

Other path-derived services retain their own refresh procedures. Factory setup is not authority to recreate AIKit identities, change providers or reset material data.

Implementation basis: `cli/src/factory_projects.rs`, `cli/src/bootstrap.rs`, native Factory `project_setup` and `FactoryDevelopmentalFileProvider::initialize_project`. Installed generation and campaign replay are recorded separately under the existing #65/#201 return.
