# Factory Run receiving — bounded local packet

This is the acceptance packet for O-I #421 and dependent #422, under Factory #195/#201/#221/#222/#241/#249 and O-I #220/#403/#409. It is not a new programme. Coordination remains O-I #375; #65 and the complete published corpus remain open.

## Revision and ownership boundary

The implementation basis is published O-I `a222c8bdf46a7b2146084770b704dfbe83ce5027`, not a claim about the integrated installed desk. #421 ends at `e5088e13e699db14c451486b36752d50522feb1c`. #422 is explicitly based on #421; obtain its exact current head from the PR before integration. Factory contracts were inspected at `f59368de67a4bac32d344099aa827c31a7e6107b`. The separate desk branch `agent/factory-desk-reading-20260918` at `6a450b7467c84f928c8806b2e9f880d520b4795d` must not be overwritten by this public-main cut.

The local reconciliation lead must publish the actual O-I/Factory/Central/AIKit/Actuation/Workcell revisions and dirty-source receipt at #65/#220. Do not substitute this packet's basis for that missing integrated receipt. Local integration owns merges, rebuilt candidates and installation. These changes never install themselves.

W4/D owns only Factory-specific adapters. W1/A mounts `FactoryRunReceiver` in the reconciled shell and supplies native-reference navigation. W3/C supplies the actual authority/Agency admission callback and dispatch. W5/F hosts the returned native Expression document through the shared runtime. Portable `binding.props` cannot supply those capabilities. An absent handler must remain visibly unavailable, not be filled with a specimen or synthetic success.

## Executable checks before installation

From the reconciled `desktop/cradle` directory, use the repository's locked dependencies:

```sh
npm ci --no-audit --no-fund
npm run build
node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/factory-run-*.test.mjs
npx playwright install --with-deps chromium webkit
node tests/factory-run-browser.mjs
node --experimental-strip-types --import ./tests/ts-register.mjs tests/factory-run-emit.mjs > /tmp/factory-native-document.json
cargo run --manifest-path kernel/Cargo.toml --example factory_run_receiving_probe < /tmp/factory-native-document.json
```

The browser tests use the real production React receiver/client with controlled owner responses. The Rust example uses the existing real Kernel and Unix socket with a test-only source document. They are executable integration checks, not installed Mac, live-provider or self-inhabitation evidence. All specimens are under tests/examples, not the production bundle. Retain every failing output as well as the successful rerun.

The general desktop CI also had an observed failure at `tests/theme-prepaint-csp.mjs:64`, “persisted dark overrides light system,” on the #421 head. Do not erase that receipt or infer that it was a baseline failure without a separate baseline execution. Source checks are not substitutes for the failed behaviour.

## Actual installed desktop round-trip

After the local integrator independently builds and installs the reconciled candidate, start the desktop through the person's normal native route. Do not start a second kernel, replace an active socket or run an unrelated agent to make this packet pass. Copy the actual binary, Factory state, Run, actor and socket addresses from native owners. The actor label below is attribution, not an authority grant.

```sh
node --experimental-strip-types --import ./tests/ts-register.mjs walk/factory-run-local.mjs \
  --factory-bin "$FACTORY_BIN" --state "$FACTORY_STATE" --run "$NATIVE_RUN_REF" \
  --expression "$EXPRESSION_REF" --actor "$ACTUAL_ACTOR_REF" \
  --socket "$OI_CRADLE_EXPRESSION_SOCKET" --desktop-executable "$RUNNING_CRADLE_EXECUTABLE" \
  --oi-root "$RECONCILED_OI_ROOT" --out "$NEW_PRIVATE_RECEIPT_DIRECTORY"
```

All nine arguments are required. The output directory must be new and have an existing parent. This script is intentionally Mac-only: it records actual OS/architecture, source head/dirty state and executable hashes, verifies the existing socket's owner and permissions, binds its PID to the specified running executable, reads the actual Factory Run/units/attempts, then opens and inspects through that socket. It never dispatches an Action, edits Factory/Central state, merges, installs, kills or relaunches anything. The only application effect is an explicit native presentation open. No request is automatically replayed after uncertain transport.

A different existing draft at the same Expression identity is a native conflict, not permission to overwrite authored work. A new presentation identity may be explicitly chosen, while the native Run identity remains unchanged. Shared-runtime revision reconciliation is still required for an authored evolving scene.

Keep `receipt.json`, `native-readings.json` and `expression.json` private. They may contain private source/context/owner evidence. Passing this command means **that existing desktop kernel received this same Run**. It does not prove shell placement, native mouse/keyboard interaction, successful Agency execution, completed repair or independent replay.

In the actual desktop, independently exercise source → unit → attempt → session/tool result → verification → every Return/artifact/receiving reference. Retain a native recording or screenshots with the candidate hash and operator occasion. Test Command-key navigation, keyboard focus after reference selection, pointer selection, refresh, interruption and returning to a held inspection. The live frontier must not steal held inspection. Disconnect the native reference opener, Run reader, Expression opener and Action admission/dispatch handlers one at a time in a controlled acceptance configuration; each dependent operation must refuse rather than pretend completion.

## Real provider and microphone/audio checks

A bounded optional provider readiness check is executable separately:

```sh
node walk/factory-run-provider.mjs --endpoint "$ACTUAL_CHAT_COMPLETIONS_ENDPOINT" \
  --model "$ACTUAL_MODEL" --token-env "$TOKEN_ENVIRONMENT_VARIABLE_NAME" \
  --out "$NEW_PROVIDER_RECEIPT_FILE"
```

Omit `--token-env` only for an explicitly unauthenticated local provider. The endpoint must implement the selected chat-completions request shape; refusal by a different API is recorded as failure, not worked around with invented output. The script makes one bounded request for a fresh nonce, retains actual model/usage fields when supplied, never records the token, refuses redirects and remote cleartext credentials, and never retries an uncertain effect. This proves only that endpoint's readiness. The Factory episode still requires the actual W3/C-native session/provider/tool receipts; this direct HTTP smoke test cannot substitute for them.

Serve only the `walk` source directory locally and open `factory-run-audio.html` through the installed O:I WebView under test. For example, `python3 -m http.server 8765 --bind 127.0.0.1 --directory walk`; stop that operator-started server after testing. Do not place private receipts in its served directory. Enter the existing Run reference, explicitly allow or deny the microphone, sample live input, request the quiet tone and separately confirm whether it was audible. Export the observation JSON. No sound is recorded or uploaded. Permission denial, zero signal, an interrupted capture and inaudible playback remain separate outcomes. A JavaScript Tauri marker or browser-only test is not native installed proof; retain the socket/process receipt and actual WebView interaction evidence alongside it.

## The genuine self-inhabitation episode

**Commission candidate, not yet an admitted or executed Commission:** carry the real #409 receiving discrepancy through the reconciled O:I desktop into Factory, complete its missing native receiving, and replay it in the rebuilt application. The native Commission/Journey/Run refs are allocated by Factory during actual local admission; this document allocates none and does not fabricate Day/NOW/source/authority refs.

The source discrepancy is concrete: on the recovered #409 basis, the Run root can be overwritten by a node named `run`, distinct refs such as `a:b` and `a/b` alias after punctuation replacement, only the first Return was presented, and essential receiving failures could prevent or falsely simplify navigation. The #421 regressions preserve the original assertion failure. #422 supplies the Factory receiver and trusted-host seam, but shell/runtime/Agency integration still has to be completed against the actual local cut.

The local episode must use that concern, not an unrelated terminal task:

1. From the actual desktop, create the native Commission for this receiving repair. Bind the original discrepancy/evidence, exact current source basis, Central's actual Day/root NOW/child NOW/context, native authority, receiving destination and stop conditions. Record missing relations as missing and stop before effects requiring them.
2. Have Factory author/compile the ordinary native workflow, with implementation, verification, rebuild and independent replay units. Preserve source locators, dependencies, forks, gates and required barriers. QL/Vāk remains optional. Partition source files with W1/A, W3/C and W5/F before admitting writers; no conflicting claim grants ownership.
3. Admit the implementation through actual Agency, AIKit session/harness and Workcell environment. Incorporate the reviewed Factory repairs and resolve the real receiving differences in the integrated desk under that authority. Capture the actual source diff and tests from the native attempt, not a manually attached mock patch. A queued Run or accepted dispatch does not establish this step.
4. Run the original failing regression against its original basis in an isolated verification worktree, then the current regression against the proposed source. Retain both command exits and outputs. The repair's Candidate must point to the new source revision, not merely this PR URL.
5. Under local integration's separate authority, rebuild the actual application from that Candidate. Record build command/results, exact input revisions, dirty state, bundle/binary hashes and the running socket owner. Do not claim CI's macOS compile check is an installed rebuilt application.
6. Use an independent replay session/agent, with its own native authority and current source basis, to reproduce the original desktop concern in that rebuilt application. Traverse all required source/attempt/tool/Return links and exercise essential-handler disconnection, denied, interrupted, duplicate, late, stale and contrary results. A test of source presence is not replay.
7. Return the resulting source/test/build/replay artifacts to the original Commission and native receiving address. Factory owns Candidate/Return/Recognition; Central owns Day/NOW/source closure. Preserve every failed attempt, retry, stale source and contrary verification. Barriers release only when all required legs have attributable evidence.
8. Independent recognition compares the observed result to the original discrepancy. Only then can this bounded episode be recognised as self-inhabiting repair. One episode never closes #65, ordinary workflow authoring, all provider/harness paths, multi-machine operation or the complete published corpus.

The evidence chain is: **original discrepancy → Commission/Journey/Run → retained source/unit → native attempt/disposition/authority/session → tools/results → source diff and tests → Candidate → rebuilt executable → independent replay → Return → original receiving relation**. Every arrow needs an owner ref, revision/occasion and actual evidence. This packet and controlled tests deliberately do not manufacture missing arrows.
