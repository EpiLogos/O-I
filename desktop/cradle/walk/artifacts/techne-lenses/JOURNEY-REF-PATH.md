# Journey (M3′) real-ref path — code-level receipt (T3, 2026-09-19)

Every ref Journey writes or reads is an oi.expression/v1 substrate ref, carried
verbatim through existing channels. There is no second scene store; Journey
persists nothing semantic (its position draft is localStorage presentation
state, `m0m5/journey/presence.ts`, keyed by subject ref).

## 1. Where the scene refs COME FROM (read path)

```
provider wire payload (registerTechneReadingProvider, ql.techne/v1)
  → TechneDisclosureState {standing:"read", reading, raw}   src/techne/techneReading.ts
  → bridgeReading(raw) — validateReading at the seam        src/techne/m0m5/reading.ts
  → beats(reading) — ONE beat per expressions[] entry with a scene_ref
    (scene_ref, expression_ref, revision verbatim; frame composed from the
    reading's own temporal/spatial/provenance facets)       src/techne/m0m5/journey/beats.ts
  → JourneyInstrument render + Studio material panel        src/techne/m0m5/journey/JourneyInstrument.tsx
```

Ref grammar read: `oi.expression/v1` document's `scenes[].scene_ref`, as bound
by the reading's `expressions[].scene_ref`. Refs are never re-keyed or
shortened (contract law; asserted in `tests/techne-m0m5.test.mjs`).

## 2. ENTER SCENE — the 4:2 → 3:3 crossing (write path)

```
JourneyInstrument.enterScene(beat)
  → crossToExpression(session, beat.scene_ref)              src/techne/m0m5/journey/crossing.ts
      · scene ref appended ONCE to selection.focus_refs (the contract's own
        focus field — no mirror extension, no second channel);
      · subject_ref / reading_ref / selection_ref / agent_session_ref
        asserted byte-identical (the TB0-1 crossing identity law);
  → disclosureSession.setSelection(carried)
  → disclosureSession.openInInstrument("expressions")       src/techne/session.ts
      · application_cut follows the instrument → "3:3-conjugate";
      · one navigation hop recorded; nothing else moves.
```

The channel is the ONE DisclosureSession store (`src/techne/session.ts`). The
Expressons side (T1's dual-mode HUD / hosted app) reads the crossed session's
scene focus from the same store — no Journey-owned scene state exists.

## 3. COMPOSE — authoring a NEW scene (write path)

```
JourneyInstrument.composeFromSelection()
  → composeSceneProposal({reading, selection, title})       src/techne/m0m5/journey/compose.ts
      · proposed scene ref follows the substrate's own grammar:
        `${expressionRef}:scene:<slug(title)>` — the same convention the
        Expressions bridge's composer uses (src/techne/expressions/cue.ts);
      · collision with a disclosed scene refused; CT materiality enforced;
      · the exact selected refs ride verbatim in `frame`
        (subject_ref, focus_refs, temporal facet refs, place refs, source refs);
  → route: TechneActionRoute {action_ref, subject_ref, selection_ref, input}
      · action_ref = the reading's disclosed scene-composition action, else
        "oi.expression.edit" (the substrate's ExpressionRequest edit with
        scene_create in its Change union — present in the cradle kernel
        grammar, src/expression/types.ts line ~30);
  → resolveActionRoute(reading, route)                      src/techne/m0m5/adapter.ts
      · receipt {routed, native_owner, authority, expected_effects} or an
        explicit unrouted reason. Nothing is executed here — the adapter
        routes; it never executes (QL-MEF wayfinder §1.2).
```

## 4. RETURN — exact restore

```
returnPosition(session, beats) — the LAST journey-named focus ref wins,
matched by scene_ref EQUALITY (never an index); a focus the reading no longer
discloses returns an honest miss.
```

## 5. Native-owner remainder (named precisely)

The routed `oi.expression.edit` proposal is NOT executed by the instrument —
by law it stops at the receipt. The cradle execution channel EXISTS in the
kernel grammar (`kernelOp(transport, {op:"expression", request:{operation:
"edit", expression_ref, expected_revision, actor, changes:[{change:
"scene_create", scene_ref, title}]}})` — the same channel WikiExpressionBody
edits its document through), but no lane currently submits Journey's composed
route to it. Wiring that submission (with the owner's authority discipline) is
native-owner work outside the adapter layer; until it lands, Journey composes
honestly routed proposals and the receipt names the owner, authority and
expected effects.

## Probe evidence

- `tests/techne-m0m5.test.mjs` — beats verbatim, compose grammar, collision
  refusal, crossing identity, return-by-exact-ref (10/10).
- `walk/techne-lenses-probe.mjs` — the journey Studio panel in a real browser
  naming the reading's own scene refs; screenshot `journey-lens-studio.png`.
