# Lane 3 RE targets — candidates, possession, choice

Commission: "3 already works for expressions but in general expressions
editing wants to attain to the quality of a real video/scene editing tool."
The target of study is the **editing model** of genuine scene editors —
timeline/sequence data model, trim and ripple semantics, keyframe channels
and interpolation, transitions, markers, nesting, undo, transport, snapping,
bins, saving — not their render engines (the cradle's render engine is its
own, and stays so).

## Candidates surveyed and possession status

| Candidate | Possession | Verification |
|---|---|---|
| DaVinci Resolve (Blackmagic) | **NOT installed** — app absent from `/Applications` (checked this session). Official Reference Manual and training books are freely published. | Manual URL live: `https://documents.blackmagicdesign.com/UserManuals/DaVinci_Resolve_19_Reference_Manual.pdf` (HTTP-verified accessible this session; 185,768,574 bytes). **Not downloaded or read in this lane** (size); recorded as documentation-only possession, no DRM issues. |
| Kdenlive (KDE) | **Open-source checkout**, read this session | Shallow sparse clone → `/tmp/techne-lane3-re/kdenlive` (`src/timeline2`, `src/doc`, `src/project`). GPL. |
| Shotcut + MLT | **Open-source checkouts**, read this session | `/tmp/techne-lane3-re/shotcut`, `/tmp/techne-lane3-re/mlt`. GPL/LGPL. |
| Olive | **Open-source checkout**, read this session | `/tmp/techne-lane3-re/olive`. GPL-3. |
| OpenShot (libopenshot) | **Open-source checkout**, read this session | `/tmp/techne-lane3-re/libopenshot`. LGPL-3. |
| Blender Video Sequence Editor (VSE) | **Open-source checkout** (sparse), read this session | `/tmp/techne-lane3-re/blender` (`source/blender/sequencer`, `makesdna`, `editors/space_sequencer`). GPL-2. |
| Final Cut Pro / Premiere / VEGAS | NOT installed; closed source; not possessed | Recorded blocked-with-reason; not studied. |

Guardrails held: scratch only under `/tmp/techne-lane3-re/` (nothing cloned
under `~/Central`); no target code or assets moved into any product tree;
recovered material appears here only as short quoted/paraphrased interface
facts with file paths; study/document only.

## What each candidate contributes (read, not assumed)

- **Blender VSE** — the cleanest *data model*. `Strip` separates content
  coordinates from timeline coordinates (`start`, `len`, `startofs/endofs`
  handles, `anim_startofs/endofs` media trim,
  `source/blender/makesdna/DNA_sequence_types.h:360-470`); channels;
  meta-strips as real nesting (`seqbase` inside a strip, `:420`); effect
  strips with typed inputs (`input1/input2`, `:417`); `blend_mode` +
  `blend_opacity` (`:446-447`); retiming keys per strip
  (`retiming_keys`, `:475-476`; `SEQ_retiming.hh`:
  `retiming_key_add_new_for_strip` :38 / `retiming_add_freeze_frame` :52 —
  offsets corrected this session); split with SOFT/HOLD methods (`SEQ_edit.hh:49-67`);
  gap removal (`SEQ_edit.hh:69-77`); overlap resolution and ripple modes
  (`SEQ_transform.hh`, `transform_handle_overlap`,
  `transform_strips_after_frame`).
- **Kdenlive timeline2** — the cleanest *editing operation architecture*.
  `TimelineModel` doc-comment: every mutation is a `requestX` function that
  applies the change and simultaneously accumulates undo/redo as lambda
  pairs; a failing composite operation reverts what it already did
  (`src/timeline2/model/timelinemodel.hpp:41-52`). `requestItemResize`
  (`:638-641`), `requestClipMove` with group semantics,
  `requestClipResizeAndTimeWarp` (`:679`), compositions (transitions) as
  model objects (`requestCompositionMove/Insertion`,
  `:463-471,823-840`). A real **SnapModel** (add/remove points,
  closest/next/previous — `snapmodel.hpp:15-42`), a **GroupsModel** tree
  (`groupsmodel.hpp:16-24`), trimming-mode UI naming slip/slide/ripple/roll
  (`timelinecontroller.h:656-722`), marker/guide models, `DocUndoStack`
  (`src/doc/docundostack.hpp:9-18`) with crash backup
  (`src/project/dialogs/backupwidget.*`, `temporarydata.*`) and a real
  **SnapModel** with closest/next/previous navigation
  (`snapmodel.hpp:15-49`; offsets corrected this session).
- **Olive** — the node-first data model: every clip is a `Block` node with
  rational in/out and two distinct trim directions — trim the *timeline
  length* vs trim the *media into the clip* (`set_length_and_media_out` /
  `set_length_and_media_in`, `app/node/block/block.h:63-64`,
  `block.cpp:62-77`); tracks are node arrays with ripple removal
  (`app/node/output/track/track.h`, `RippleRemoveBlock` `track.h:374`;
  path corrected this session); keyframes are first-class objects with
  `kLinear|kHold|kBezier` types and validated in/out bezier control points
  (`app/node/keyframe.h:44-49,104-121`).
- **OpenShot libopenshot** — the classic curve vocabulary:
  `InterpolationType {BEZIER, LINEAR, CONSTANT}`, `HandleType {AUTO,
  MANUAL}`, `Point {co, handle_left, handle_right}` with handles as 0..1
  percentages (`src/Point.h:28-68`); keyframes as callable curves
  (`src/KeyFrame.h:53-146`); a JSON-diff path into a running timeline with a
  published edit benchmark (`doc/JSON-KEYFRAME-BENCHMARK.md`).
- **Shotcut/MLT** — producer/playlist/tractor/field as the timeline
  ontology (`mlt/src/framework/mlt_types.h:291-293`, `mlt.h:53-69`) and a
  disciplined command/undo layer (`src/commands/timelinecommands.h`
  — MoveClipCommand, SplitCommand, markercommands, subtitlecommands) plus a
  dedicated **autosave file object** (`class AutoSaveFile : public QFile`,
`src/autosavefile.h:27`; offset corrected this session).

**DaVinci Resolve** remains the owner's quality bar ("a real video/scene
editing tool") and its published manual/training materials are legitimate
documentation targets for later passes; nothing in the target set below
needs Resolve internals — the open-source model families above cover every
target family, and where Resolve names a capability (cut page, ripple
trim/roll/slip/slide vocabulary) the open-source checkouts evidence the same
semantics directly.

## Chosen targets (this lane's RE basis)

1. **Kdenlive timeline2** — primary reference for the *operation + undo
   architecture*: request-functions that return success/failure, compose,
   and generate their own inverse; snap model; groups; trimming-mode
   vocabulary; crash backup discipline. Reason: its architecture maps
   almost 1:1 onto the cradle's kernel-Change receipt model (every mutation
   already is a kernel `Change`), so parity targets can be phrased as new
   Change-expressible operations rather than a parallel editor.
2. **Blender VSE** — primary reference for the *sequence data model*:
   content-vs-timeline coordinate split, handles, split soft/hard, gaps,
   nesting (meta), retiming keys, blend modes, modifiers, color tags.
   Reason: gives the honest, proven shape for making `oi.journey` scenes
   behave like first-class timeline objects without breaking the
   living-field nature of a Scene.
3. **Olive + libopenshot** — primary reference for *keyframe channels*:
   per-parameter tracks, linear/hold/bezier interpolation, validated bezier
   handles, curve editing. Reason: the app already has `propertyTracks`
   (linear only, `propertyTracks.ts:5-9`); these two sources are the
   smallest complete bridge to a real channel system.
4. **Shotcut/MLT** — secondary reference for *command separation* and
   autosave/recovery file discipline. Reason: small, legible examples of
   the same patterns (named undo commands; a dedicated autosave object).

Possession caveat repeated: none of these is installed as an application on
this machine; study is by source checkout in `/tmp` scratch. Reference
behavior claims in `TARGET-SET.md` cite these checkouts' files. No
behavioral claim is made about Resolve, and no DRM circumvention of any
kind was needed or performed.

## Version note

Checkouts are shallow `--depth 1` clones made 2026-10-07 (current HEADs at
clone time); file references are pinned to the working tree in
`/tmp/techne-lane3-re/` for this campaign. If a later lane re-studies them,
re-clone and re-verify offsets rather than trusting these lines.
