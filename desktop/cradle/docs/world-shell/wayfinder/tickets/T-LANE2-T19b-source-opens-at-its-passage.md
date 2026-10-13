# T-LANE2-T19b — the source opens at its passage

**Follows:** lane-2 T19 (1732e5f82), which carries a temporal facet's
`temporal_provenance_selector` and decides the evidence control
(`src/techne/m0m5/timeline/navigationIdentity.ts` `evidenceAnchorOf` /
`evidenceOpenPlan`). The selector is then dropped at each step to the
reader; this ticket threads it through.

## The chain (each step drops the selector today)

1. `expressions-app/field-studies-journeys/src/researchInstruments.tsx` →
   `host.inspectSubject(ref,{node,relationField})`: add `anchor` (the
   `LocatableSelector` from `evidenceOpenPlan`) to the context.
2. `field-studies-journeys/src/app.ts:2139` `inspectSubject`: passes
   `context` through untouched (it already does).
3. `desktop/cradle/src/expressions/sourceHandoff.ts` `resolveHostedSource`:
   validate `context.anchor` with `isLocatableSelector` (refuse a malformed
   one by name); carry it on `HostedSourceTarget.anchor` only for a
   file-location target whose revision it just proved. A knowledge-address
   target carries no anchor (the wiki reader has no passage addressing) —
   say so in the returned target's `anchorRefusal`.
4. `src/CradleFrame.tsx` `sceneSourceOpen` → `openFileRef.current(location,
   {…, anchor})` → after the binding opens, dispatch the reveal.
5. `src/editor/TextEditor.tsx:314` reveal: today it requires `text` to equal
   the slice. Add a revision-checked form: `{bindingId, sourceRef, start,
   end, revision}` reveals when the editor's document revision equals the
   one the resolver proved, never by text guess. `text_span` counts
   characters (UTF-16 code units in CodeMirror — confirm against
   `src/knowledge/selection.ts:56` and the producer).
6. `timestamp_range` / `image_region`: no reader positions them today; the
   control's title names that, the source opens at the top.

## Acceptance

- Scripted: resolver carries / refuses the anchor; reveal fires only on
  revision match; the inspector control reads "Open source at its passage"
  only with a passage.
- Native: a timeline event with a disclosed text span opens its Markdown
  source with the span selected and centred.
