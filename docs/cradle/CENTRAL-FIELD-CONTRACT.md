# Central field — the small shared contract (EF0)

Status: **published 6 October 2026 by the lead, revised as the first vertical lands.**
Parent: O:I #592 · Map: `.wayfinder/maps/epi-logos-field.md` · Repair ledger: O:I #598.
Branch: `feat/central-field-base` (seat `env-2/o-i`). Names below describe meaning; where a
type already exists it is named by its file, and nothing here mints a competing store.

## 0 — The binding decision

The site's field becomes a **hosted surface contribution of the Base arrangement**, not an
Epi-Logos-only surface and not a new `WorkspaceMode`.

| Question | Decision | Native owner |
|---|---|---|
| Where does the field live? | A hosted surface `oi.surface/field` (kind `field`) admitted through the existing compile-time registry (`oi contribution compile-registry` → `src/contributions/generated.ts`). Base (`MODE_CURATION.base`, labelled Central) opens it as its default centre. | `src/contributions/*`, new `src/field/` |
| What does the field read? | A `FieldSource` adapter (below). A linked local corpus gets the generic adapter (kernel material/files/knowledge reads). Epi-Logos supplies its own adapter through the existing Epi world context (`context.world`, footer toggle). | `src/field/source.ts`; `src/epilogos/sources.ts` |
| Where does presentation state live? | One typed `FieldEncounter` reducer in `src/field/model.ts`, persisted as the surface binding's `view.field` (extends `SurfaceBinding.view`, `src/surface/types.ts`), restored with the layout. It is not a source database, an agent session or a cache. | host (presentation) |
| How do agent and human operate it? | Both call the **same** pure operations `fieldApply(state, op)`. The agent reaches them through an admitted native host operation (extend the Expressions native host relay admission list in `kernel/src/native_expression.rs` or the existing `oi:*` host event route — whichever the first vertical proves; record which). No DOM or screenshot dependence. | host + kernel admission |
| Where does domain meaning stay? | Source reads, relation authoring, QL computation, Expression/Technē acts and agency stay at their owners (Central source reads, QL-MEF, Expression owner, Actuation/AIKit). The field only holds refs + presentation. | owners |
| Epi mode | Not a mode of the field: the Epi world swaps the adapter and adds domain tools/praxis. Mode-off must work with any linked corpus. | `src/epilogos/*` |

## 1 — The six relations (what exists, what is added)

| Relation | Basis today | Added by this line |
|---|---|---|
| **Encounter** | `SurfaceBinding` (`ref`, `address`, `view`, `engine`, `presentation`), `LayoutState.accompanying`, `context.world`, Epi place/passage store (`src/epilogos/places.ts`) | `FieldEncounter`: `{world_ref, primary:{ref,revision,span?}, tangent?:{ref,revision,span?,kind:"page"\|"expression"}, selected?:ref, constellation?:{refs[]}, scene?:{expression_ref,scene_id}, emphasis:"essay"\|"split"\|"field"\|"library", generation:n}` |
| **Presentation actions** | Workbench open/focus/pin/close/split (`src/surface/engine.ts`), keyboard map (`keys.ts`) | ops: `select(ref)`, `open-main(ref)`, `open-preview(ref)`, `keep`, `promote`, `back`, `set-emphasis`, `enter-constellation(refs)`. Distinct effects; `select` never navigates; `keep`/`promote` never discard dirty editable work. |
| **Prepared turn** | `PreparedContextView`, `SituationView`, `context/*`, AIKit prepared context | the active `FieldEncounter` (primary + tangent + selected + constellation) is a context contribution; the turn records the exact `generation` it was prepared against. |
| **Domain action** | `ActionDisclosure`, native Actions, `KernelOp` (`kernel/src/lib.rs`) | none. The field invokes owners; results keep their refs/revisions. |
| **Continuity** | `LayoutState` persistence (`src/surface/persist.ts`), drafts, encounter session ref | `view.field` restored with the layout; reader-owned notes/constructions saved through the Expression/wiki owners, never into the publication. |
| **Contribution** | `HostedSurfaceDescriptor` / `RegisteredHostedSurface` (`src/contributions/contracts.ts`) | `oi.contribution/field`; a small non-essay specimen (conformance) is added through the same path. |

### `FieldSource` (meaning, not a mandatory schema)

```text
nodes()/links()        the local neighbourhood of a ref (filterable by reach/registers/index pages)
tree()                 explorer + breadcrumb siblings, from native refs (paths are display only)
search(q)              titles/paths at once; deeper text only when asked
read(ref)              body + passages + figures + {sourceRef, sourceRevision}   (as EpiReading today)
expressionsFor(ref)    Expression refs the page is *about*, with scene ids
```

Rules: refs are native stable refs, never site ordinals/slugs; static indices
(`fieldIndex.json`, `expressions/index.json`) are derived, source-pinned projections; revision
travels with every read; a stale revision is refused, not coerced.

## 2 — First working encounter (the path every other piece joins)

`site passage → same passage in the new Base → select a relation (no navigation) → open it as a
tangent → the actual companion answers from this context → source depth → the real Expression
(scene) → return to the main passage.`

Pin the concrete passage, tangent page and Expression from the live site build
(`site/.public-edition/essay/static/fieldIndex.json`, `essay-expression-map.json`) and record
them in the table below on first run. Candidate: movement of `THE-RETURN-OF-ZERO`
(Expression `roz-essay-reading`) → an `arguments/A*` page (`roz-a-arguments`).

| Slot | Value (fill on first run) |
|---|---|
| main passage | `THE-RETURN-OF-ZERO` at movement M16 (`?m=16`, `section-rooms/02-return-of-zero/movements/16-s1-p3-crossed-zero`) — the site's own reader test locus |
| selected relation | `section-rooms/arguments/concepts/dimensional-reframing-at-zero-and-infinity` ("Dimensional Reframing at Zero and Infinity"), ref `central:source:project:Antykathera-Essay-Work:submission-package/essay/section-rooms/arguments/concepts/dimensional-reframing-at-zero-and-infinity.md`; selected by a graph-node click (no navigation, generation 3→4) — walk `walk/scenarios/field-first-encounter.mjs` |
| tangent | the same page, opened by double-click as an italic preview; replaced by the next tangent (M16 itself, via its connections), kept by double-click, a third opened beside it (M15 · The Empty Set Generates One); promoted → main, `Alt+←` back to the manuscript at M16 |
| Expression + scene | `roz-room-02-return-of-zero` (ref `expression:roz-room-02-return-of-zero`), scene `movement-15` (§1 · #2 — The Empty Set Generates One), then `movement-16` via the contents; opened from Library → Here as an Expression tab; played by the published renderer (`expression.html`, embed) in the tab |
| companion prepared-turn basis | **not joined yet.** `src/field/fieldHost.ts` publishes `fieldContextReading()` (primary, tangent, selected, constellation, scene, generation) and `fieldContextLines()`; the SituationFrame / prepared-context items do not read it yet |

## 3 — File claims (exclusive; the lead serializes git)

| Owner | Writes | Does not touch |
|---|---|---|
| Lead (EF0/#598) | `src/contributions/contracts.ts`, `src/contributions/factory/**`, Factory props in `CradleFrame.tsx`/`modeBodies.tsx`, `src/workspace/{mode,store}.ts` composition seams, `docs/cradle/CENTRAL-FIELD-*`, git, generated registry | `src/field/**` |
| Sonnet B (#593) | new `src/field/**`, `src/epilogos/*` (adapter binding), `site/` reads (no edits to site build), new tests under `desktop/cradle/tests/field-*`, `walk/scenarios/field-*` | contracts.ts, factory/**, Factory regions of CradleFrame |
| Sonnet A (#132/#78/#595) | `Work/Actuation` seat `env-1/actuation` (`feat/central-field-actuation`), `env-1/ai-kit` (`feat/central-field-ai-kit`), `desktop/cradle/package-bundle.sh`, `cli/src/{composition,configuration/profile,desktop_install}.rs` | `src/**` |

Anyone needing a file outside their claim asks the lead; nobody commits or pushes — the lead does.

## 4 — Site reference baseline (recorded 6 Oct 2026, lead)

Source basis: `site/` on main `ca603fb4e` (#600), built edition `site/.public-edition/essay` snapshotted to a scratch copy.
`python3 tests/essay-reader-controls.py` (root and `/O-I` bases; desktop + phone): **229/229 checks passed**, exit 0,
including 135 Expressions in the gallery and the "Here" narrowing. This is the behavioural reference the native
candidate is compared against (UX1–UX10); it is not a statement about the native candidate.

## 5 — Requests to lead (from Sonnet B, 6 Oct 2026)

1. **`HostedMountProps.onView(view)`** in `contributions/contracts.ts`. A hosted surface has no way to write its binding's `view`;
   the field persists `view.field` through a window event `oi:field-persist {binding_id, field}` that `CradleFrame` now answers
   (additive effect beside `oi:host-workspace-mode`, calls `workspace.surfaceView`). Replace the event with the prop when you can.
2. **Registry regeneration.** I ran `oi contribution compile-registry` for core, factory, automations **and field** and wrote
   `contributions/generated.ts` and `registered-kinds.mjs` (delta is exactly the one `oi.surface/field` entry; baseline
   regeneration without it reproduced the committed files byte-for-byte). The command to keep:
   `oi contribution compile-registry --root desktop/cradle/src/contributions <core|factory|automations|field>/contribution.json… > generated.ts`
   (and `--metadata … > registered-kinds.mjs`). Add `field/contribution.json` to the list in `docs/cradle/HOSTED-CONTRIBUTIONS.md`.
3. **Agent route.** `src/field/fieldHost.ts` registers every mounted field and runs one typed `FieldOp` through `fieldOperate`
   (window event `oi:field-operate {op, binding_id?, reply?}`). The kernel/native host-relay admission
   (`kernel/src/native_expression.rs` or the `oi:*` route) still has to forward an admitted `field.operate` to that event.
4. **Prepared turn.** To join the companion, `context/situation.ts` (`SituationFrame`) should carry `field: FieldContextReading`
   and the turn builder should record `field.generation`. I did not touch `context/*` (outside my claim).
5. **Base default centre.** `CradleFrame` opens the field (tab strip unpinned, left navigator `collapsed`) when a workspace
   first stands in Base with an empty tree (`fieldDefaulted` effect after `enterModeRef`). The existing `rest` walk assumes Rest
   at that moment and needs a start that opts out; I did not run or change it.
6. **Walk registry.** `walk/scenarios/field-first-encounter.mjs` and `field-site-parity.mjs` are standalone (they boot the
   prebuilt `kernel/target/debug/walk-bridge`, a static edition server and Chrome themselves); register them in `walk/run.mjs`
   if you want them in `npm run walk`.

## 6 — Decision D3 resolved: agent and human operate the field through the existing ExpressionWorld seam (lead, after reading the kernel)

The kernel already admits the generic world operations agents use (`oi desktop expression`, body schema
`oi.expression-world/v1`, `kernel/src/expression_world.rs`, renderer face `src/expression/world.ts`). The field does not
mint a parallel `field.operate` kernel route for what these already say:

| Field operation | Admitted native operation | Meaning kept |
|---|---|---|
| `select(ref)` | `selection_set {origin: graph\|page, subject_ref, kind, native_owner, revision}` | "Selection is inspection: it never invokes an Action." Agent reads it with `selection_read`; an agent `selection_set` moves the field's selection. |
| `open-preview(ref)` | `portal_open {placement: preview, target_ref, surface_id, …}` (+ `surface_open`) | tangent = a preview portal; canonical ref preserved. |
| `keep` / `promote` | `portal_open` re-place `beside` / `full` | re-placing never re-derives identity. |
| close tangent | `portal_close` | |
| `back`, `set-emphasis`, `enter-constellation`, tab focus | host-local presentation (`fieldApply`) | not domain meaning; admitted to agents only if the equivalence test shows a need (then a typed presentation request on the same seam, not a side channel). |

Consequences: `FieldEncounter.selected` and the tangent are *projections* of the shared selection and portal records
(kernel-owned), not a second store; the one global focus relation (`kernel/src/focus.rs`) is published, not copied.
`native_owner` for a corpus ref is its source owner (Central source refs for a linked corpus), never `field`.
Equivalence test: pointer select ≡ `selection_set` ≡ agent `selection_set` produce the same `selection_read`; an agent
`selection_set` moves the field's selected node without navigation; `portal_open preview` opens the same tangent a
double-click does.
