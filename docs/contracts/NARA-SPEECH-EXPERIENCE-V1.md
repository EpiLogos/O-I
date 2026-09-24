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
    bodyState.ts         the three body states the surface may render (live / option / absent),
                         derived only from the constitution's disclosed facts; the hold-to-talk
                         affordance gate and its refusal words
    voiceBody.ts         ql.nara-voice-body/v1 mirror (verbatim, deny-unknown) + the caller-side
                         constitution→declaration reduction and QL dialogical floor satisfaction
    NaraSurface.tsx      the summoned "nara" surface: capability-adaptive presence, push-to-talk,
                         interrupt, reconnect, transcript expansion, authority proofs, Epii panel

```text
desktop/cradle/src/dictation/        the agent chat's LOCAL DICTATION — a separate desktop input aid,
    store.ts             the loopback endpoint stipulation (oi-cradle.dictation.v1; documented default
                         http://127.0.0.1:8080/inference; non-loopback refused by name)
    wav.ts               16 kHz mono PCM16 WAV encode + linear resample
    client.ts            probe-before-capture, one transcription attempt, named refusal mapping
    copy.ts              the rendered words, asserted verbatim by conformance and the walk
```

Dictation is listed here, not because it is Nara — the section below exists
to keep the two apart — but because this contract is where the desktop's
speech surfaces are named, and the separation IS the contract.

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
7. **The speech body is an option and a gap before any key exists.** The surface renders the
   constituted body in one of three states derived only from the constitution's disclosed facts
   (`src/nara/bodyState.ts`); no provider or model name is ever invented, and no state is
   rendered that the documents do not carry.

## The three body states (option + gap)

`naraBodyState(constitution)` derives the state; `NaraSurface` renders it
(`data-nara-body-state`). The fields consumed are the constitution's own:
`input_modalities` / `output_modalities`, `conditions` (each
`condition:"degraded"|"unavailable"`, its verbatim `reason`, and the read
model's which-seam `field` when carried), `provider_binding.facts`
credential scalars (`credential_condition:"not-required"|"required"|"satisfied"`,
`credential_hint`, `credential_binding_ref` — refs and presence only,
never material), `body_ref` and `provider_binding.provider_ref`, and the
session read's `speech_capable` / `text_capable`.

- **live** — usable acoustic path both directions and no named condition.
  The capability chips render as usual; no body-state banner appears.
- **option** — the body declares toward speech but names why it is not
  plainly live: a credential it does not have bound, a degraded or
  unavailable surface, or a one-sided acoustic declaration. The body shows
  as a visible OPTION with the gap named exactly as the document discloses
  it — e.g. for a credential-gated body:
  `speech body present as an option (not usable today); when the named
  condition closes — or the body is swapped — Nara continues unchanged`,
  the gap line
  `unavailable (modality-credential): the surface needs a credential it
  does not have bound: provider:voice inference credential` (the reason is
  the AIKit read model's own wording, verbatim), and the credential fact
  `credential condition required — provider:voice inference credential`.
  A usable-but-degraded body renders `(usable with named reductions)` with
  the degraded condition named beside it.
- **absent** — no acoustic modality declared in either direction (the
  text-capable Nara): `speech body absent (text-capable Nara); a speech
  body may be constituted or swapped later without changing Nara`.

**The affordance law.** Hold-to-talk is a speech act: it presents as live
(`holdToTalkLive`) only on a body that can hear and speak today. Gated,
degraded-to-unusable, one-sided and absent bodies disable it, and the
refusal is named in the button title and notice (`holdToTalkRefusal`).

**The named seam: catalogue-wide option discovery.** The surface knows only
the constituted body's facts. Whether OTHER constitutable speech bodies
exist — the full set of options a key could unlock — is a catalogue question
(the AIKit model catalogue and its route/credential join), and no desktop
read model carries that seam today. The option state above is therefore the
constituted-but-gated body, honestly shown; a catalogue-wide option list is
not fabricated. Wiring that discovery in would be a new read-model seam
(AIKit catalogue → desktop), not a change to this surface's vocabulary.

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

## Dictation is not Nara voice (2026-09-19, owner-commissioned separation)

The desktop now carries TWO speech inputs, and keeping them distinct is the
law, not a naming preference:

```text
agent-chat microphone   DICTATION (LOCAL) — a generic voice-INPUT aid, owned by the
                        desktop. src/dictation/. Click to record, click to
                        transcribe; the transcript lands in the AIKit-owned
                        shared draft as EDITABLE text. It never auto-sends.
Nara surface            NARA VOICE — its own dialogue MODE. Push-to-talk on a
                        constituted speech body, the Actuation speech
                        constitution, the QL voice-body floor, interrupts,
                        ExpressiveAct choreography. src/nara/. Untouched by
                        dictation.
```

**Bring your own.** Nara voice requires the person to bring one of:

- **their own provider credential** — bind it and the gated body renders as
  the OPTION state (the condition named verbatim from the disclosure); or
- **their own adapter** — AIKit's swap path: a speech body is constituted or
  swapped without changing Nara. The machine's local speech stack
  (`~/.local-speech`: whisper.cpp on `127.0.0.1:8080`, Kokoro on
  `127.0.0.1:8880`) is the worked EXAMPLE of a body the user brought, not a
  built-in dependency of this surface.

The agent-chat mic is **not** a piece of that story: it is local dictation
against the stipulated loopback STT endpoint, an input aid on the same
footing as the keyboard. No provider name is hardcoded anywhere in either
path; the only endpoint dictation knows is the one the stipulation record
names, default `http://127.0.0.1:8080/inference` (this whisper.cpp build
serves the OpenAI-shaped multipart call on `/inference`, not
`/v1/audio/transcriptions`).

**The SDK check (owner question):** the agent invocation path — the AIKit
encounter owner's disclosed actions (`start`, `open`, `read`, `view`,
`draft`, `prompt`, `cancel`, `status`, `permission`, `send`, `send-group`,
`delivery`, `reconnect`) — has NO voice-input hook on this cut; audio is not
an encounter currency, and the ACP wire carries no audio channel here.
Dictation therefore rides the door typed text already uses: the transcript
lands through the owner's `draft` action and leaves through the person's own
`prompt` send. The new seam is desktop-local input surface
(`src/dictation/`); no owner operation was added, renamed, or bypassed.

**The lawful home of the STT endpoint.** Not a settings-page product
setting: the settings page projects product-owned descriptors
(docs/cradle/06-SYSTEM-SETTINGS.md L4/L6) and the composition plane's
setting refs belong to real product owners (docs/cradle/09-CONFIGURATION-PLANE.md)
— no product owns a local speech stack, and inventing an owner would
misattribute one. Dictation is desktop-owned input matter, the same class as
the Visuals layer ("the appearance and expression layer owned by the desktop
itself"), so the stipulation belongs to the native desktop kernel. **Conformance commission,
2026-09-24:** this supersedes the earlier browser-localStorage prescription in
this paragraph. `dictation_read` / `dictation_configure` retain a versioned,
validated native record with compare-and-swap revision checks. Invalid saved
configuration is refused visibly; it is never silently defaulted. No browser
record is silently imported. The documented default above applies only when
no native record exists. Remote endpoints, embedded credentials and redirects
are refused; localhost resolves to loopback in the native transport.

`dictation_probe` must succeed before the renderer requests microphone access.
It issues a short-lived, single-use capture reference bound to the current
endpoint revision. `dictation_transcribe` accepts bounded 16 kHz mono PCM16 WAV
only under that reference, and performs local HTTP in the native kernel.
Endpoint changes cannot retarget a recording in progress. Capture lasts at
most five minutes and transcription has a bounded timeout. The renderer owns
microphone permission and editable text landing, never direct HTTP or an
endpoint authority. Disposal cancels capture; neither path auto-sends text.
An eventual desktop input settings slot uses this same native store door.

**Honest states, both directions.** Up → dictation works. Down → the mic
probes BEFORE touching the microphone, so the named gap renders without a
permission prompt: `Local speech is not running — start it with
~/.local-speech/start.sh. Dictation expected a local transcription server at
<url>.` Mic refused, mic unreachable, transcription failure and an empty
transcript each render their own named line; no state ever invents text.
Dictation is disabled exactly where the composer is (no draft authority, no
reading) and its transcript is never the only copy of anything — it is draft
text like typed text.

## Evidence

```bash
cd desktop/cradle
node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/nara-speech-conformance.mjs
    # 38 tests: QL fixture round-trips, admission/deixis/delegation laws, constitution + receipt
    # shapes, and the three body states (option+gap, absent, live) with the exact rendered strings
node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/dictation-conformance.mjs
    # Production WAV encoder, named capture refusals and rendered words.
    # Native ownership/refusal/restart coverage: tests/dictation-native.test.mjs (explicit opt-in).
node tests/nara-presence-lifecycle.mjs
    # 30 checks: the real surface on a real kernel walk bridge; capture via the synthetic device;
    # the gated body rendered as an option and the text-only body as absent, in the real component
node walk/run.mjs nara-speech
    # 22 checks: the joined chain against the real kernel, including the credential-gated and
    # text-only body states; receipt in walk/artifacts/nara-speech.json
node walk/run.mjs agent-dictation
    # 16 checks: the agent-chat mic end to end on the real encounter owner — synthetic-mic capture,
    # a walk-served whisper.cpp-wire STT fixture, the editable landing, a real amended send through
    # the owner, and the service-down / failure / empty states; receipt in
    # walk/artifacts/agent-dictation.json
```

## Honest remainders (owner-visible)

- **Dictation is loopback-only by law.** The stipulation record refuses a
  non-loopback endpoint by name; a remote STT product would be a different
  surface, not a silent retarget of this one.
- **No live OS microphone in the dictation walk.** The agent-chat walk uses
  chromium's synthetic device, exactly like the Nara lifecycle proof; a live
  OS-permission walk and a live whisper round-trip remain the owner's
  acceptance (the local services were live on this machine at implementation
  time; the fixture speaks their byte-identical wire contract).
- **The endpoint stipulation has no settings slot yet.** The lawful home is
  the desktop-owned store (`src/dictation/store.ts`); a desktop input
  settings view, when one exists, binds to the same door. Until then the
  seam is the record and the dictation section above.
- **Historical CSP observation, superseded for dictation by the 2026-09-24 native migration.** `connect-src` gained
  `http://127.0.0.1:* http://localhost:*` for the stipulated speech server;
  non-loopback hosts stay refused. (Observation, owned elsewhere: the A2A
  exchange's arbitrary peer endpoints are NOT covered and will be
  CSP-blocked in the installed app — a pre-existing condition this lane did
  not change.)
- **No live provider or live microphone in the walk.** The realtime body above is a
  resolution *document*; no provider session is opened and no audio is played. Live-mic capture
  is proven against chromium's synthetic device; a live OS-permission walk and a real
  provider body remain the owner's G3 acceptance (with ai-kit #317 and Actuation #91 joined).
- **Catalogue-wide option discovery is a seam, not a feature.** The option state shows the
  constituted-but-gated body because that is the only body the desktop lawfully knows. The set
  of constitutable bodies needs the AIKit model catalogue/route join wired into a desktop read
  model; until then the surface names the gap instead of listing options it cannot see.
- **No transcript content is manufactured.** Turn rows carry what actually happened; response
  content rides the canonical dialogue owner (agent session) when one is joined through the
  encounter seam.
- **Highlight/portal focus actions** are presented at surface level; wiring them into the live
  Expression stage presentation (the ES1 portal surface) is the next integration slice.
