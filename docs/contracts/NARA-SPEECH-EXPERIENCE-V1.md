# Nara speech experience v1 (desktop consumer)

## Current execution standing — W6 / PR #442, 20 September 2026

This is the existing OI-E/#336 contract, updated after recovery of the integrated app. It consumes QL-MEF #201 (TA3/TA4), AIKit #317 and Actuation #91/#94; it does not replace their semantics or the wider personal/M4 programme. Founding positions remain upstream in `docs/positions/FOUNDING-POSITIONS.md`. Shared M1–M3/physics/stage and generic session composition retain their other writers.

The complete earlier OI-E contract, option/gap vocabulary, voice-floor rationale, dictation stipulation and historical receipts are retained at [the pre-review source](https://github.com/EpiLogos/O-I/blob/96f68ce1a9c4cf642b6d119f20ff86dcf558b774/docs/contracts/NARA-SPEECH-EXPERIENCE-V1.md). Its obligations are not retired. Its claims about the old surface, proof buttons, renderer-generated sessions and placeholder responses are not current implementation evidence. The current executable consumer is described below; the earlier helper and fixture coverage remains separately attributable.

### Source recovery

The installed non-QL snapshot on #65, comment 5743244181, explicitly preserved the then-dirty UI and did not certify the app. The published UI successor `060f0165a8ecbdc2fb3bece48c7c4d48d05e2610` included the complete Nara/dictation branch `4dd003eb9dbfe867d5513e9f7aa51324de50b64f`. After that app was integrated and its parent branch deleted, this lane's production changes were recovered onto main `112bdd0e2356d6c7a65fe8b3dd1e9e9cccd50ec9` in PR #442, without wholesale-merging a divergent branch. The original W6 branch and failed runs remain intact. Coordination remains #220 comments 5747135609 / 5751095786, not a new programme.

## 1. Native ownership and identity

Nara, Agent, Agency, AgentSession, SessionSpace, body, provider session, transport connection and Expression remain different identities. The application may retain their bindings, not manufacture replacements. Canonical QL/Ta-Onta context and the Actuation constitution must agree with the existing native AgentSession. A different Epii Agent and AgentSession are explicitly selected for delegated inquiry.

The current loading route is `source_open` for a saved, clean, revision-bound `oi.nara-attachment/v1` source. It selects the existing native documents; it is not their authority. Dirty, conflicting, oversized, identity-mismatched or stale Expression attachments refuse. Attaching reads an existing encounter; it never creates a native session or activates a microphone.

The attachment carries:

```text
context       QL NaraDialogueContext, exact Expression/source/occasion basis
constitution  Actuation speech constitution and native Agent/Agency/World relation
dialogue      Project, SessionSpace, AgentSession, provider, sender,
              expected binding revision and optional task
speech?       explicitly selected executable STT/text/TTS transport routes
              with provider/model/source/revision provenance
epii?         distinct native Epii Agent and session binding
```

`validateAttachment` in `nativeDialogue.ts` is the executable shape check. No fixture attachment is shipped as a production default. Automatic native composition-to-attachment production and an ordinary human setup selector remain required integration work; hand-authoring test JSON is not a substitute and is not assigned to local acceptance as a repair task.

Reopening a presentation retains the private encounter, draft, current context, delivery and review state for the current application lifetime. Reconnect preserves Nara, personal subject, World, Expression and native session; replacing the speech route revokes voice consent. Reconnection does not claim provider acoustic-history restoration. Full app-restart hydration and detached-window continuity need their own native proof; an in-memory remount test does not establish them.

## 2. Current production path

```text
explicit attach / native session read
    -> explicit voice-route consent
    -> native readiness check
    -> explicit microphone start and actual permission result
    -> captured WAV / explicitly selected STT service
    -> actual transcription
    -> addressed native encounter send, with permitted context
    -> same-delivery journal/result readback
    -> actual returned response text
    -> selected TTS service / validated returned WAV
    -> actual playback event
    -> manual stop, recovery or next explicit turn
```

`nativeDialogue.ts` uses the existing encounter `view`, `send`, `delivery`, journal and `reconnect` operations through the kernel seam. It never writes the ordinary human composer's draft. A response is assembled only from native provider message chunks attributed to the exact delivery and AgentSession. Provider thoughts and arbitrary tool payloads are not transcript or spoken output. Non-monotonic cursors, wrong sessions, wrong delivery identity and oversized response text refuse.

A lost acknowledgement has an uncertain outcome. The delivery reference is retained before send, and recovery reads that exact original delivery without resending, automatic speech or proposal application. Terminal refusal remains a failure but does not leave an impossible pending delivery blocking every future turn.

## 3. Speech body, consent and capability truth

The executable transport in this PR is specifically `http-stt-text-tts`: selected credential-free loopback STT and TTS endpoints around the existing native text session. It consumes the owner's actual local speech work, including the whisper.cpp multipart `/inference` route and Kokoro-compatible TTS JSON/WAV shape. Those are adapter examples and selected route facts, not universal provider defaults. The historical AIKit #317 local-provider receipt is comment 5743682682. No local service is installed or started by this PR.

The route validation refuses unknown transport kinds, remote endpoints, credential-bearing URLs, query/fragment material and unavailable acoustic bodies. HTTP redirects are refused rather than forwarding private audio or text. The audio adapter checks response formats and bounds. Routes retain explicit model/provider/source/revision and the selected TTS voice.

Enabling voice permits this route but does not capture. Actual capture follows a separate user act. A late permission grant after stop releases every arriving track; it cannot revive the interrupted turn. `listening` requires an acquired input stream, and `speaking` requires the playback notification, not merely request submission. Microphone denial, input loss, empty transcription, STT/TTS failure, malformed WAV and playback refusal stay visible failures. Text remains useful without an attached executable speech route.

The existing four-state support helpers, three-state body option/gap reading and QL voice-body satisfaction bridge remain source contracts:

- supported/degraded/unsupported/unknown are different; unknown never grants a capability;
- `naraBodyState` distinguishes a live declaration, a named option/gap and an absent acoustic body; a declaration is not an active transport;
- the QL floor distinguishes the requirement `refreshable` from mechanisms `push-on-change`, `tool-access`, or `none`; both real refresh mechanisms can satisfy it;
- a non-streaming HTTP cascade must not be presented as satisfying a full-duplex/realtime floor merely because the semantic validators accept its constitution.

Restoring the complete capability-floor/option discovery presentation over the actual native catalogue remains a UI/native-composition obligation. The new runtime's real audio path does not establish that catalogue-wide experience or replace the earlier contract with a hardcoded model list. WebSocket/WebRTC/realtime provider transport, automatic VAD and provider-wide acoustic barge-in are not implemented by this HTTP adapter. Missing live credentials do not turn those implementation obligations into completed local-only checks.

## 4. Exact attention and Expression operations

Moving the pointer or changing layout does not disclose private material. An explicit **Include current selection** reads the existing Expression and shared selection; it carries the exact subject/relation ref, source revision and current Expression/scene into permitted context. It does not fetch the selected source body. Malformed native world payloads cross the existing object validator and refuse rather than acquiring authority from a type assertion.

`presentation.ts` applies only the currently implemented exact-ref focus proposal. Before the first mutation it checks the complete reviewed context and maps every requested subject to a unique native entity/scene. No first-entity or EarthBody substitute and no relation inferred from visual proximity are allowed. Operations use the existing native `expression_world` `act_perform`, `act_interrupt`, `act_checkpoint` and `act_restore` path with expected revision. Returned focus, document identity and checkpoint identity/content are read back.

A legitimate unchanged focus or checkpoint restore is a native no-op. It does not invent a revision increment and does not hide a failed operation behind unchanged state. Additional peer edits are not proof that this step succeeded. Highlight/portal/profile/scene and consequential native Action proposals still need their own native handlers and authority review; none is silently converted to a focus command.

## 5. Interruption, uncertainty and checkpoint

Manual stop releases local capture/playback, aborts the pending acoustic request and signals the same encounter's pending Expression choreography. Already-sent atomic safe work may finish; later steps are cancelled. Only confirmed steps are recorded. An uncertain native mutation is not reset to an unapplied proposal.

The existing generic native cancellation operation is session-wide, not delivery-correlated. This consumer therefore does not race that cancel against a peer's next turn or claim a provider response was stopped because local audio stopped. An outstanding delivery remains explicitly recoverable. Adding genuinely supported delivery-scoped native cancellation remains an owner join.

Checkpoint and restore operate the actual native draft, not GPU particles, resonators, audio history or the provider conversation. The exact checkpoint/act/revision must be returned. A stale live basis refuses restoration. Hold failures are visible and must be reconciled before consequential continuation.

## 6. Epii inquiry and authorised acceptance

Nara remains foreground. Explicit inquiry sends the bounded question and admitted source refs to the selected distinct native Epii session, not the private Nara transcript. Real explanation is retained even when the reply does not supply a valid structured `ql.epii-enrichment/v1` proposal. An invalid/missing proposal never gets invented from prose.

Receiving enrichment mutates nothing. Rejection leaves native source and Expression unchanged. Acceptance checks the complete original context, not just its address or Expression revision: changed source revisions, selection, occasion or disclosure invalidate stale enrichment. An acceptance is reserved before dispatch, so duplicate application, rejection while applying, context replacement or forgetting the encounter cannot race a pending native effect. Failure distinguishes no-effect preflight refusal, confirmed partial work and uncertain outcome.

The implemented acceptance is **focus only**. Accepting it does not authorise other proposed native Actions, profile variants or scene changes. Consequential changes still belong to their actual Action/Factory owner. Source return, authorisation and publication are different acts.

## 7. Personal privacy and the complete M4 obligation

Renderer-held dialogue, drafts and inquiries are private application memory. They are not written to localStorage, public editions, shared search or the old unscoped enrichment ledger. Generic personal-enrichment publication is refused. Explicit source navigation uses the native source/Surface path without adding the body to dialogue. Audio URLs/tracks are released. Actual native journals remain governed by their owner; these consumer tests do not independently certify every generic owner diagnostic/export path.

The wider personal instrument is not a chat with six labels. All six M4 branches remain required: identity/authored sources; embodied EarthBody and receiving centres; oracle/consented cast; transformation/practice; contextual interpretation; integration/source return. Nara's **seven receiving centres remain distinct from cymatic stations** and from Anima's constitutional voices. No personal-state diagnosis is inferred from geometry or audio.

The complete personal journal/oracle/practice/identity/receiving-centre interactions, current personal/Ta-Onta matrix coverage and governed source return are not closed by this speech PR. Existing native capabilities must be recovered and connected, not reported absent because this consumer does not yet wire them. Ordinary no-QL work remains independent. Public canonical corpus, visitor annotations and private Nara material remain distinct. Both near-term programme outcomes—installable/self-inhabiting technology and the complete published corpus—remain required under #65; private dialogue is not corpus publication material.

## 8. Executable controlled checks

From the selected committed source:

```bash
cd desktop/cradle
npm ci --no-audit --no-fund
node --experimental-strip-types --import ./tests/ts-register.mjs --test \
  tests/nara-speech-conformance.mjs tests/dictation-conformance.mjs \
  tests/nara-runtime.test.mjs tests/nara-audio-contract.test.mjs \
  tests/nara-local-acceptance.test.mjs
npm run build
npx playwright install chromium
node --experimental-strip-types --import ./tests/ts-register.mjs \
  tests/nara-native-browser.mjs
```

The current browser replay uses the production Nara component with a controlled native owner and synthetic microphone. It checks attachment/no-auto-mic, consent, actual HTTP/WAV transport, delivery-attributed response, remount continuity, interruption/recovery, distinct Epii rejection/acceptance and real native-operation invocation/readback. This is controlled browser evidence, not the owner's microphone, model, installed Mac or human acceptance.

Original failures remain: baseline run 35484859654 omitted the TS loader; later run 35514030050 exposed the second-inquiry browser failure; run 35523765591 passed 97 contracts and 21 browser checks but failed three TypeScript errors. Commit `cade1c2997c200b4298238d5ec359cc3492e817a` repairs those errors; Nara run **35530391737** passed contracts, integrated build and browser replay, and OI Verify **35530391728** passed. New acceptance-argument regressions reproduced six failures before the bounded CLI repair and pass all eight in container execution afterward. Final-head hosted results belong in PR #442's receipt, not inherited from a prior SHA.

Historical `nara-presence-lifecycle`, `nara-speech`, `nara-stage-focus` and `agent-dictation` walks retain their old source/fixture standing. Their previous counts must not be quoted as current passes without execution on the new source. No test is weakened to preserve an obsolete simulated response.

## 9. Bounded local test packet

Local integration owns candidate merge/build/install and one computer-use driver at a time. Preserve the existing machines, native repos, private Control/Day/Nara source, active sessions and other lanes. Do not install from this remote session or create another local verifier tree.

Before a live walk, use the actual already-admitted native Nara attachment source, current provider/session readiness, real selected local STT/TTS services, current Expression basis and optional distinct Epii binding. Do not generate a fixture to make a missing native attachment producer look present. Missing production setup/handlers are repository follow-up, not a demand that the local tester redesign them.

The executable `tests/nara-local-acceptance.mjs` takes an existing loopback kernel bridge, exact saved source ref and a **new private output directory**. It never installs, starts a service, creates a session or opens the microphone. No `--allow-provider` means no new inference. Recovery, reconnect and new speech turns are separate episodes; incompatible flags refuse before source/network/output effects.

```bash
# In desktop/cradle; actual values are supplied by the local integration receipt.
# Each invocation requires its own NEW private output directory.
node --experimental-strip-types --import ./tests/ts-register.mjs \
  tests/nara-local-acceptance.mjs \
  --bridge "$NARA_BRIDGE" --source "$NARA_SOURCE_REF" --out "$NARA_READINESS_OUT"

# Explicit real STT -> native response -> TTS. Optional Mac playback is a
# separate --play-output flag; completion is not proof the human heard it.
node --experimental-strip-types --import ./tests/ts-register.mjs \
  tests/nara-local-acceptance.mjs \
  --bridge "$NARA_BRIDGE" --source "$NARA_SOURCE_REF" --out "$NARA_SPEECH_OUT" \
  --allow-provider --audio-file "$NARA_SELECTED_WAV"

# Original delivery only: no new inference, STT, TTS, replay or reconnect.
node --experimental-strip-types --import ./tests/ts-register.mjs \
  tests/nara-local-acceptance.mjs \
  --bridge "$NARA_BRIDGE" --source "$NARA_SOURCE_REF" --out "$NARA_RECOVERY_OUT" \
  --recover "$NARA_ORIGINAL_DELIVERY_REF"

# Explicit reconnect of that existing native session, with no subsequent turn.
node --experimental-strip-types --import ./tests/ts-register.mjs \
  tests/nara-local-acceptance.mjs \
  --bridge "$NARA_BRIDGE" --source "$NARA_SOURCE_REF" --out "$NARA_RECONNECT_OUT" \
  --reconnect
```

`--check-native-mac` reports only an actual System Events O-I window observation. It does not certify native UI operation. Receipts distinguish reading a session from observing ready native state; failed and absent readiness cannot be labelled success merely because a view exists. Output directories/files use 0700/0600 and exclusive creation. Failure retains the original delivery and private failure; nothing retries a send automatically. Never upload these private receipts, transcripts or WAVs to public CI, generic diagnostics, editions or shared search.

### Physical/native interaction episodes — not executed remotely

In the actual installed Mac app, separately record source/build/install/running cut and perform: enter personal Nara with microphone idle; attach the actual encounter; explicitly enable the route; start and deny permission once; recover; permit a short real utterance; observe real response/playback and transcript. Stop during input, synthesis and playback. Where a body declares barge-in, test actual acoustic interruption separately; this HTTP body must retain its honest manual-turn-taking limitation. Stop during a multi-step reviewed focus act and confirm only the already-sent atomic step may finish, later focus remains cancelled and native checkpoint restore preserves exact source basis.

For continuity, leave/reopen the presentation with an unsent draft and pending delivery; recover that original delivery, reconnect the same session, and confirm no new Nara/AgentSession, replay or stale proposal application. Exercise two separate personal attachments without shared dialogue. For Epii, request real source-bound inquiry, reject without mutation, then accept only an explicitly reviewed supported focus proposal; a changed source/context must refuse the stale result.

These physical/audio and human-experience episodes remain required and are **not yet automated by the local CLI packet**. The CLI's saved-WAV round trip and browser synthetic device are separate evidence. Full native-microphone automation, complete personal/M4 paths, setup/catalogue joins, realtime transport and broader proposal handlers remain open implementation/proving obligations of the existing owners, not reasons to promote fixtures to completion.
