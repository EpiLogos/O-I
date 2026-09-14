# O:I-for-Pi (`oi-pi`)

The Pi-side half of the O:I Self-Development World's human-facing Surface.

Pi is the package host and interactive TUI. It is **not** the source of truth for
World / Run / Activity / Attention state — those remain O:I/AIKit application
models. Every view in this package is a projection of native-owner state read
from `oi`, `aikit` and `ctrl` at runtime.

## What it provides

- **Compact below-editor widget** — persistent, above the prompt:

  ```text
  O:I  World:self-dev · Agent:Epii · Run:live · WC:local
  Activity: 3 active · Evidence: 7 · Attention: 1
  ```

- **`/oi`** — toggleable right Observatory overlay (responsive right-hand panel,
  independent visibility/focus) with a `[raw] [semantic]` toggle and detach (`o`).
- **Commands** — `/activity`, `/context`, `/capabilities`, `/runtime`,
  `/evidence`, `/guardians`, `/oi-detach`. Each is a view into O:I/AIKit
  application models, never private Pi state.
- **`needs_attention`** — derived from owner semantics
  (Activity → Notification → Attention), not prose guessing.
- **Open / detach** — to the canonical desktop and herdr/tmux Surfaces
  (herdr is the current multiplexer; tmux is the fallback).
- **Embedded SDK entry** — `contrib/sdk.ts` exposes an explicit `ResourceLoader`
  for programmatic embedding; no uncontrolled ambient resource discovery.

## Layout policy

1. compact below-editor widget;
2. toggleable right Observatory overlay;
3. full-screen dedicated views for deep inspection.

Pi's renderer is **not** patched for a permanent column; a permanent
column-reserving side panel is out of scope until `#97`.

## Contracts

### AIKit component-surface contract (`aikit:component-surface-authoring`)

- Uses the existing Component/Surface/SessionSpace contribution contract; there
  is no UI-private configuration path.
- Declares stable identity, provider/source provenance, target/surface semantics
  and eligibility; presentation stays separate from the semantic operation
  (`contrib/lib/component-surface.ts`).
- Stages the contribution and inspects the resulting SessionSpace view
  write-free before any activation is considered.
- Activation authority is owned by the AIKit provider process (`aikit enable`).
  A visible Surface never implies activation authority; `classifyActivation`
  only ever reports what the native owner observed.
- Lifecycle (discovery → preview/resolution → activation → withholding →
  removal/reconciliation) is proven with evidence refs
  (`proveLifecycle`).

### O:I package envelope (`oi.package-v1`)

`oi-pi.package.json` is the descriptor. It owns only identity, version, source,
compatibility, permission/effect disclosure and the list of native
contributions. It does **not** define SessionSpace/Surface/Agent/Action/Project
semantics — those remain native contracts.

## Capability census

`/capabilities` is first-class. The ladder
(eligible → selected → loaded → granted → invoked → realised) is generated from
live native-owner registries at run/test time:

- `aikit tree --all --json` — registries (eligible) and sets (selected/withheld);
- `aikit status --json` — the live active set (loaded);
- `aikit recent --json` — grant/invoke/realise events;
- `aikit stats --json` — catalogued count.

Nothing is pasted into a static file.

## Ownership laws

- No Pi-specific semantic subsystem.
- Pi is not the source of truth for World/Run/Activity/Attention.
- A visible Surface does not imply activation authority.
- Process/endpoint/provider identity is never stored as semantic identity.
- The package contributes no skills and does not re-forward or double-load
  Skills the DSH engine already owns.

## Install

```bash
pi install /absolute/path/to/Work/O-I/packages/oi-pi
```

or for a quick run without installing:

```bash
pi -e Work/O-I/packages/oi-pi/contrib/index.ts
```

## Verify

```bash
node --test Work/O-I/packages/oi-pi/tests/
```

The census test builds the census from the live `aikit` registries and skips
cleanly when `aikit` is not on `PATH`.
