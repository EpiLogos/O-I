# T-LIVE-MODE-SCALES — scales in Live's grammar

**Source:** owner ruling, 13 Oct 2026 — DEVICE-SEMANTICS-LOCK §0.2 item 5;
QL-MEF #329 Wayfinder §0.4 item 5; DLW §9. The transport's meanings were
re-read in `shell/modeGrammar.ts` / `inhabitants/sdk/modes.ts` (13 Oct).

## Target

1. **Transport**: key/root/scale set the mode in force for the whole set —
   root, one of the 84 lens/CF modal instances or a source-defined scale
   (Ficino planetary, Shem, maqām — each with its own intervals and
   provenance), and tuning. The modes come from the kernel (packet K's
   operators), never a renderer-local table.
2. **Clip**: each clip may carry its own mode (Live's clip scale), so a piece
   modulates phrase by phrase; the piano roll folds to the mode or highlights
   it.
3. **Device**: note devices before the torus — a scale-mapping device, an
   exact-ratio tuning device, and the sky device that hands parameters to
   planetary modulation sources, each shown on the parameter it moves;
   stackable, reorderable, savable.
4. **Surface**: the Jankó surface recolours to the mode in force.

## Acceptance

- Scripted: all 84 lens/CF modes and each source scale resolve from the
  kernel with their exact intervals and provenance; a clip mode overrides the
  set's for that clip only; fold and highlight agree with the mode; note
  devices transform notes before the torus in chain order; no silent 12-TET
  coercion.
- Native: set a Ficino planetary scale in the transport; the Jankó surface
  recolours, the roll folds, and played notes land on the scale.

## Progress

- Leg 1 (8c4293b08): `live/modes.ts` resolves the mode in force, a clip's
  own mode, the pitch mask and fold/highlight rows from a served catalogue
  only; the transport names the seam while none is served.
- Leg 2: the owner serves the catalogue. QL-MEF #330 adds
  `ql music modes --json` (`ql.music-modes/v1`: 168 lens/CF tonic instances
  over the chromatic and fifths bases, 72 maqām rows in quarter-tone steps and
  cents, Shem and Ficino named as absent sources). The kernel reads it through
  one op, `music_modes_read` (`kernel/src/ql_music.rs`, stdin closed, bounded,
  refused by name: `ql-music.unavailable` / `.unsupported` / `.refused`). The
  shell parses it strictly (`parseQlMusicModes`) and the transport's Root
  picks the tonic. Scale lists the catalogued instances on that tonic,
  grouped by basis, plus the maqāmāt stated from the root. A lens instance
  is never transposed (its pitches are absolute); the key control keeps its
  established place.
- Open: the installed quaternal-logic predates #330, so the live transport
  refuses by name until it is rebuilt into O:I. The choice is held for the
  session only, because the Live set document has no owner write for a
  set-level mode. Ficino and Shem wait on their sources. Next: clip mode
  through `modeForClip`, the roll's fold and highlight, the note devices,
  and the Jankó recolour.
