# Editor suite findings — 2026-09-08

## Implemented surface contract

- `EditorFrame` supplies one focus-aware command line and one footer for
  Central source, ordinary file and rendered-material surfaces.
- The command line collapses to an edge when its pane is unfocused and can be
  collapsed by the person while focused. The footer carries the owner path,
  useful view state and the existing save/history operations.
- Markdown wrappers, code indentation and JSON formatting change the actual
  held buffer. Preview zoom/reload acts on the mounted renderer. No control
  claims an operation that is absent from the owner reading.
- A real textarea selection dispatches `oi:context-candidate` with
  `{bindingId, kind: "text", text, sourceRef?, location?, start?, end?}`.
  Toolbar and selection-only right-click entry points share that seam. An
  unselected right-click remains available to the pane context menu.
- Source restoration no longer dereferences `buffer.path` before the buffer
  exists. This fixed the Tauri startup crash and the editor walk's initial
  open failure.

## Verification

`npm run walk -- editor` passes **33/33** against temporary, real
Central-owned project ground. It proves ten distinct document reads (maximum
open time 147 ms), exact bytes, independent dirty buffers, caret/selection
restoration, project-stable save routing, revision advance, stable source
identity, owner refusal without mutation, retained refused edits and return to
the writing canvas. Receipt: `walk/artifacts/editor.json`.

The first `npm run walk -- material` exposed two separate defects. The
installed `/Users/admin/.cargo/bin/ctrl` predates Central's current binary-safe
file-reading contract: it rejects `central.files.read` with
`encoding:"base64"` as “File is not UTF-8 text”. The current checked-out
Central source implements that input and its freshly built CLI returns the
expected base64 reading. O:I's installed suite route also selects the stale
registered CLI and does not override it from `OI_CENTRAL_CTRL_BIN`.

Running the same walk through an explicit suite wrapper over the freshly built
Central CLI cleared every asset, script, stylesheet, image, PDF and binary
disposition failure. That pass then exposed one owned presentation defect:
`MaterialSurface` persisted the transient Source view, so closing and reopening
Markdown did not return to Rendered. Source is no longer persisted; neutral
zoom remains persisted. The final material walk passes **26/26** with no page
errors. Receipt: `walk/artifacts/material.json`. The installed Central CLI and
O:I composition still need promotion/recomposition before the default command
inherits this passing binary contract.

The production TypeScript/Vite build passes. `git diff --check` passes for the
owned files.

## Git footer contract

The current Central desktop file reading discloses `write`, `history` and
`restore`; it does not disclose Git operations. The editor therefore renders
no branch, dirty count, stage or commit theatre.

A native owner increment should add read operations first:

1. Repository and branch/status reading based on the stable, machine-readable
   `git status --porcelain=v2 -z --branch` format.
2. Path-scoped working-tree and index comparisons corresponding to `git diff
   -- <path>` and `git diff --cached -- <path>`.
3. Path history corresponding to `git log -- <path>`, linked to the existing
   file-history disclosure rather than presented as the same history.

After those readings exist, owner-disclosed actions may add stage, unstage,
restore and commit. Every mutation must carry the repository ref, expected
state/revision and native result. Restore must disclose that it can discard
working-tree content and require a concrete confirmation. The renderer must
never spawn Git or derive status from file-save state.

Primary references:

- https://git-scm.com/docs/git-status
- https://git-scm.com/docs/git-diff
- https://git-scm.com/docs/git-log
- https://git-scm.com/docs/git-restore
