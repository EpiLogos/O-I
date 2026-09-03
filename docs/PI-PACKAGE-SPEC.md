# O:I-for-Pi package — build spec (handoff to the Pi agent)

Status: working spec for the #97 local phase. Ground-preparation only — the code
is still being done; nothing here overrides native contracts or pre-empts the
#97 rebase.

## 1. What this is

The **O:I-for-Pi package** is the Pi-side half of the O:I Self-Development
World's human-facing Surface. In the composition:

```text
Actuation — Agent / Agency (identity, authority, bounds, Return)
     │ realised through
     ▼
AIKit — HarnessComposition (constitutional owner of provisioning/disclosure)
     ├── Pi      → principal human-facing orchestration Surface + package host
     └── DSH     → optional supporter (adapter on `agent/dsh-adapter-main`, see §8)
     │
     ▼
Workcell — material actuality (workcell:local ← Control/machines/current.json)
```

This package is an **O:I Surface contribution**, not a Pi-specific semantic
subsystem. Its views are into O:I/AIKit application models, not private Pi
state. Pi remains the package host and interactive TUI; it does not become the
source of truth for World/Run/Activity/Attention.

## 2. Contracts to satisfy

### 2a. AIKit component-surface contract

`aikit:component-surface-authoring`:

1. Use the existing Component/Surface/SessionSpace contribution contract; do
   not add a UI-private configuration path.
2. Declare stable identity, provider/source provenance, target/surface
   semantics and eligibility. Keep presentation separate from the semantic
   application operation.
3. Stage the contribution and inspect the resulting SessionSpace view before
   activation.
4. Pass trust/policy/platform/target and real provider-process authority
   gates. A visible Surface or available Component must not imply activation
   authority.
5. Prove lifecycle: contribution/discovery, preview/resolution, activation
   when authorised, withholding when unauthorised, removal/reconciliation.
6. Verify the same semantic object is consumable from human and Agent
   surfaces without duplicating its domain meaning.

The accepted provider containment seam is the authority boundary; do not
bypass it from a TUI adapter.

### 2b. O:I package envelope

The package is described by an `oi.package-v1` descriptor
(`schemas/oi.package-v1.schema.json`). The descriptor owns only:

- package identity, version, source and revision;
- suite/native contract compatibility requirements;
- whole-package permission/effect disclosure;
- the list of independently identified native contributions;
- each contribution's target product/contract, artifact and native
  verification declaration.

It does **not** define SessionSpace/Surface/Agent/Action/Project semantics —
those remain native contracts. See `packages/README.md`.

## 3. Deliverables

### 3a. Compact below-editor widget

Normal state, persistent above the prompt:

```text
O:I  World:self-dev · Agent:Epii · Run:184 · WC:local
Activity: 3 active · Evidence: 7 · Attention: 1
```

### 3b. Toggleable right Observatory overlay (`/oi`)

Open via a shortcut or `/oi`. Use `ctx.ui.custom()` overlays anchored as a
responsive right-hand panel with independent visibility/focus. Content:

```text
SESSION OBSERVATORY
Activity
Context
Capabilities
Actions
Runtime
Workcell
Factory / Evidence
Guardians
[raw] [semantic]
```

Layout policy for now (do **not** patch Pi's renderer for a permanent column):

1. compact below-editor widget;
2. toggleable right Observatory overlay;
3. full-screen dedicated views for deep inspection.

### 3c. Commands

`/activity`, `/context`, `/capabilities`, `/runtime`, `/evidence`,
`/guardians` — each a view into O:I/AIKit application models, never private
Pi state.

### 3d. `needs_attention`

Derived from owner semantics (Activity → Notification → Attention), not
prose guessing.

### 3e. open / detach

Open/detach to canonical desktop and **herdr/tmux** Surfaces (herdr is the
current multiplexer; tmux is the fallback).

### 3f. Embedded ResourceLoader

Embed Pi's SDK with an explicit `ResourceLoader`
(`packages/coding-agent/src/core/sdk.ts`); no uncontrolled ambient resource
discovery.

## 4. Ownership laws (must not)

- Do not add a semantic subsystem specific to Pi.
- Do not make Pi the source of truth for World/Run/Activity/Attention state.
- Do not let a visible Surface imply activation authority.
- Do not store process/endpoint/provider identity as semantic identity.
- Do not re-forward or double-load Skills DSH already owns.

## 5. Acceptance criteria

- `/capabilities` is first-class: the capability census
  (eligible → selected → loaded → granted → invoked → realised) is generated
  from the live AIKit/native owner registries at test time, not pasted into a
  static file.
- Common O:I objects/actions are operable without leaving the terminal, with
  the same refs and authority as the desktop.
- Pi stays fluent: target activation and degradation are explainable.
- No desktop-only semantic state.
- The same semantic object is consumable by a human (Pi TUI) and by an Agent
  (structured projection).

## 6. Out of scope until #97

- Permanent column-reserving side panel (Pi renderer change).
- Deep QL operators / MEF.
- Gateway / Telegram / remote-Workcell surfaces.

## 7. Suggested source layout

```text
Work/O-I/packages/oi-pi/
  oi-pi.package.json      # oi.package-v1 descriptor
  contrib/                # Pi-native extension source
  README.md
```

plus the native Pi extension installable into Pi's own package host.

## 8. References

- `Work/O-I/skills/oi/SKILL.md` — agent-facing orientation to the whole.
- `Work/O-I/packages/README.md` — package envelope boundary.
- `schemas/oi.package-v1.schema.json` — descriptor schema.
- `Work/ai-kit/skills/registry/capsules/skill/aikit/component-surface-authoring/payload/SKILL.md`
- DSH adapter (parallel work): `Work/ai-kit` branch `agent/dsh-adapter-main`
  (`crates/aikit-adapters/src/clients/dsh.rs`, PR EpiLogos/ai-kit#170).
- Pi SDK: `earendil-works/pi` `packages/coding-agent/src/core/sdk.ts`.
