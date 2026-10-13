# T-LANE5-T1-T3 — The journey surface: beats, routed compose, routed reorder

Label: wayfinder:task (Phase 4 · lane 5)
Claimed-by: claude-code:dlw-lead (13 Oct 2026; builder haiku)
Source: `lanes/lane-5-journey-palace/TARGET-SET.md` T1–T3.

## Resolution

**Glue landed `a884d1385`.** `journeyBeats.ts` provides:
- the beat view: cards in binding order with verbatim scene_refs and facet
  chips; a reading with no scenes gives its disclosure reason, never a beat;
- `composeSceneRequest`: exactly one `scene_create`, CAS-gated on the
  disclosed revision, and refused on collision;
- `reorderSceneRequest`: exactly one `scene_reorder` naming every disclosed
  ref; pace is never routed.

The journey lens gains the compose form. Scripted: journey-beats 23/23.

**T1b (dispatched):** read the document-wide disclosure (today the reading
is scene-scoped, so it shows one binding). Also: beat cards with chips in
`journeyInstrument.tsx`, drag-to-reorder through the shared drag grammar, and
the `beats.ts` title split on ":".
