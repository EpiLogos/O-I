# O:I Skill / SDK Conformance

Status: adopted working contract, first conformance harness 2026-09-15.

O:I owns suite-level conformance between what a product's Skill material teaches and what the product's public command surface actually serves. This is the skill-side companion to `CLI-SURFACE-CONFORMANCE.md`, which owns the command surfaces themselves.

## The conjugate law

A good Skill and a good public SDK are conjugate expressions of the same product faculty. A Skill carries six parts:

```text
recognition            when does this faculty apply?
native distinctions    what things actually exist here?
public faculty         the CLI/SDK operations and how to discover them
procedure              the smallest reliable operation: read -> preserve -> change -> validate/reload
verification           how returned reality is known
recovery               how a failed or partial mutation is handled
```

Two failure directions, both drift:

- **Under-expressed SDK.** The Skill must explain hidden internals or memorise unstable implementation paths because the CLI does not expose (or does not disclose) the operation. Fix the SDK, not the Skill.
- **Over-specified Skill.** The Skill re-types command details the discovery surface already carries, so it rots on every product revision. Fix the Skill to point at discovery.

The reference standard is Omarchy's native Skill plus `omarchy commands --json`: the agent asks the product what exists, and the product's own tests keep that answer true. Version-sensitive operations are conformance-tested against the product revision that provides them.

## Discovery surfaces

Every product CLI must offer a machine-readable inventory of its commands. Current accepted surfaces:

```text
ctrl        ctrl actions --json (Action registry), ctrl capabilities --json, ctrl system --json
actuation   actuation capabilities --json, actuation system --json, actuation help
aikit       aikit --help graph; aikit system --json at origin/main 8ef8a4f (settings disclosure, not a command inventory)
factory     factory capabilities --json ("commands" array), factory system --json
workcell    workcell system --json (actions array) at origin/main 0c3ad1e; workcell --help graph
ql          ql capabilities --json (families), ql system --json; ql --help graph
oi          oi --help graph, oi products --json, oi capabilities --json
```

A `system --json` settings disclosure and a command inventory are different contracts; having one does not satisfy the other.

## The rules

Automated where checking is possible; the rest is a listed manual residual, never a fake green. The harness enforces the automated subset.

- **R1 Frontmatter (automated).** Every `SKILL.md` starts with `---` frontmatter carrying `name` and a substantive `description` (40+ characters).
- **R2 Recognition (automated).** The body states its trigger within the opening lines ("Use this Skill when...", "Use when...", "Use at...", "Required for..."). Frontmatter description states scope; the body states when to route here.
- **R3 Command existence (automated).** Every command a Skill names for its own binary must exist in that binary's discovery inventory. Commands are read from code spans and fenced blocks only; prose mention is not an invocation.
- **R4 Named paths exist (automated).** A backticked repository-relative path must exist in the product repository (Actuation's `scripts/verify-native-skills.sh` truth layer, generalised).
- **R5 Verification (automated).** The Skill names how reality is checked back: a verify/doctor command, a test command, or a Verification section.
- **R6 Recovery (automated minimum, manual residual).** A Skill whose procedure can mutate state names its recovery path (undo, rollback, recover, backup-first, refusal). The harness checks for recovery vocabulary and reports absence as a residual for owner review, because what counts as adequate recovery is a judgement.
- **R7 Ownership and writable-location claims (manual residual).** Structural minimum is R4; whether a claimed boundary matches the product's actual contract is judged by the owner, informed by the harness report.
- **R8 Revision recording (automated).** A conformance run records the exact `--version` of every binary it tested and the discovery surface each product actually served. A run against a stale binary is a run against that revision, nothing more.

## Harness

`cli/tests/skill_conformance.rs` is the deterministic harness, in the style of `six_product_command_parity.rs`:

- O:I's own Skills (`skills/`) are always checked against the `oi` binary built by the test run — hermetic, runs in `verify.yml`.
- The six product checkouts are checked when the workspace root is present (default `../..` relative to the `cli` crate, or `OI_CONFORMANCE_WORK_ROOT`); sibling binaries are located on `PATH` or in the checkout's `target/release/`, overridable per product with `OI_CONFORMANCE_BIN_<PRODUCT>`. Per the CI law, sibling material is a cross-product concern; when the workspace is absent the test prints an explicit skip.
- A product whose richest inventory command is absent from the served binary (an older revision) falls back to its help graph, and the run records both the binary revision and the surface actually served. A product with no parseable surface at all is a failure, not a skip.
- Manual residuals are printed, itemised per product: pending/branch material, intentionally absent paths, diagram paths, cross-product paths, mutating Skills without a named recovery, Skills with no direct invocations. They are visible, not green.

Products keep their own in-repo skill verification (for example Actuation's `scripts/verify-native-skills.sh`, Factory's `scripts/validate_factory_skills.py`); those run in the product's own gate. This harness is the suite-level net over all of them.
