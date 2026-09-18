# Nara speech experience v1 (desktop consumer)

**Standing:** OI-E desktop implementation contract for O:I #336. Branch lane: `thread4/nara-speech-experience`. Consumes Actuation #94/#91 (`actuation-adapters/src/speech.rs`, `actuation-runtime/src/{nara,speech_session}.rs`), QL-MEF #201 (`ql-mef/src/nara/dialogue.rs`), AIKit #317 (`docs/v2/24-MODEL-MODALITY-AND-REALTIME-SURFACES.md`), and the Expression substrate (#335, [EXPRESSION-APPLICATION-V1](EXPRESSION-APPLICATION-V1.md)). O:I is a consumer here: every schema name, spelling, receipt shape and refusal text mirrors the upstream owners; this document names what the desktop owns.

## Where the code lives

```text
desktop/cradle/src/nara/
    support.ts           shared wire vocabulary, four-state SpeechSupport, admission helpers
    constitution.ts      actuation.speech-constitution/v1 (+change receipt): validate, build from the
                         AIKit resolution (single-model ModelRuntimeReadModel or staged
                         StagedModelRuntimeReadModel), ConstitutionDelta, secret-material refusal
    dialogueContext.ts   ql.nara-dialogue-context/v1 (+deixis, +Epii delegation/enrichment):
                         validate, construct from live state, disclosed/selected/structural
                         admission law, bounded turn context, apply gate
    expressiveAct.ts     ExpressiveAct turn state (interrupt/resume/checkpoint restore) and the
                         reversible-choreography plan (hold-and-cancel-pending-choreography)
    session.ts           NaraSpeechBinding: turn phases, actuation.speech-session-read/v1,
                         actuation.nara-interruption/v1 (session_destroyed:false),
                         actuation.speech-tool-decision/v1 (authorised != executed),
                         delegation/enrichment receipts (applied:false)
    voiceBody.ts         ql.nara-voice-body/v1 mirror (verbatim, deny-unknown) + the caller-side
                         constitution→declaration reduction and QL dialogical floor satisfaction
    NaraSurface.tsx      the summoned "nara" surface: capability-adaptive presence, push-to-talk,
                         interrupt, reconnect, transcript expansion, authority proofs, Epii panel
```

## The laws this lane keeps

1. **Identity.** `NaraRef != AgentRef != AgentSessionRef != body != provider session`. A body
   change is an `actuation.speech-constitution-change/v1` receipt with the Agent/Agency preserved;
   a context update can never change the Nara or the session; reconnect continues the same
   dialogue (same Nara, subject, coordinate, Expression, profile standing) or refuses.
2. **Authority.** A speech-model tool request is a request. Refusal (stage `channel`,
   `denied`, `unauthorised`) happens before any effect; authorisation and execution are separate
   receipts, and execution dispatches through the real kernel seam (`expression` edit/invoke —
   the same authority path as every component). The audio layer never gains native Action
   authority.
3. **Honest capability.** Supported / degraded / unsupported / unknown stay four facts.
   A text-only body is a constituted body: the text composer is always available; hold-to-talk
   is disabled when the body declares no acoustic input; an unsupported interruption is refused
   with the owner's reason instead of faking a cancel; `session_destroyed:false` always.
4. **Disclosure is a fact.** A ref enters the bounded dialogue context only when it was
   disclosed (with a receipt), selected, or is structural. An undisclosed candidate is refused by
   name; nothing is invented in its place. An act whose basis is no longer the live Expression
   revision is released from the context, named in the notice.
5. **Interruption is material truth.** The Actuation receipt drives speech stop AND the
   correlated reversible choreography (hold-and-cancel-pending-choreography); only an
   already-running atomic-safe step may finish; "go back" restores the authored checkpoint only
   when the live Expression actually stands at its revision — never a claimed GPU rewind.
6. **Epii stays out of the foreground.** Delegation hands exactly the admitted scope; a returned
   enrichment is presented as a proposal with `applied:false`; stale application refuses at the
   apply gate.

## The QL voice-body floor (caller-side satisfaction)

The desktop reduces its constructed speech constitution to the QL
`ql.nara-voice-body/v1` declaration (`src/nara/voiceBody.ts`, mirrored
verbatim from `ql-mef/src/nara/voice.rs`) and evaluates the dialogical floor
at attach and at every body change. The floor's `context_refresh` slot is a
**requirement**, not a mechanism: `not-required | refreshable` — the
capability that the body's context can be refreshed from host truth while the
session lives. The declaration discloses a **mechanism**:
`push-on-change | tool-access | none`. `refreshable` is met by
`push-on-change` or `tool-access`; `none` fails with a named gap.

The desktop derives the disposition from its own composition, conservatively:
on the text/staged turn path the host recomposes the bounded context from
live application state each turn and pushes it — structural
`push-on-change`; on a proven realtime body host push rides the structured
event channel — `push-on-change` only when that channel is proven; anything
unproven stays `none`.

Rationale: the dialogical law supplies the bounded `NaraDialogueContext` from
the caller and the host adjudicates it, so what the floor demands is that the
body's context can be refreshed from host truth — host refresh is the floor.
Model-initiated tool pull (`tool-access`) is an acceptable, optional-stronger
mechanism, never the requirement. (2026-09-18 owner-commissioned correction:
the floor originally required the `tool-access` mechanism with strict
equality, which no host-pushed composition could satisfy; the requirement was
recast from mechanism to capability, contract version unchanged.)

## Evidence

```bash
cd desktop/cradle
node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/nara-speech-conformance.mjs
    # 33 tests: QL fixture round-trips, admission/deixis/delegation laws, constitution + receipt shapes
node tests/nara-presence-lifecycle.mjs
    # 24 checks: the real surface on a real kernel walk bridge; capture via the synthetic device
node walk/run.mjs nara-speech
    # 20 checks: the joined chain against the real kernel; receipt in walk/artifacts/nara-speech.json
```

## Honest remainders (owner-visible)

- **No live provider or live microphone in the walk.** The realtime body above is a
  resolution *document*; no provider session is opened and no audio is played. Live-mic capture
  is proven against chromium's synthetic device; a live OS-permission walk and a real
  provider body remain the owner's G3 acceptance (with ai-kit #317 and Actuation #91 joined).
- **No transcript content is manufactured.** Turn rows carry what actually happened; response
  content rides the canonical dialogue owner (agent session) when one is joined through the
  encounter seam.
- **Highlight/portal focus actions** are presented at surface level; wiring them into the live
  Expression stage presentation (the ES1 portal surface) is the next integration slice.
