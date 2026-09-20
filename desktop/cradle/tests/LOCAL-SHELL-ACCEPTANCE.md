# W1 shell: bounded local acceptance packet

Owner: O:I #375 / #289. Delivery: the W1 successor linked from PR #416,
branch `agent/w1-shell-layout-finish-20260920` (base `b72d763`). Use the local reconciliation lead's existing
Mac checkout and candidate, not another verifier worktree. This packet never
installs, merges, configures a native owner, or modifies a person's machines
from a remote session. All local interaction below is explicitly initiated by
the person. Keep the integrated revision receipt beside these results.

## Source, build and controlled checks

In that existing checkout's `desktop/cradle`, record `git rev-parse HEAD` and
`git status --short`, then use that checkout's own `npm ci`. Do not borrow
another checkout's node_modules. Run:

```sh
npm run build
node --experimental-strip-types --import ./tests/ts-register.mjs --test \
  tests/shell-recovery.test.mjs tests/mode-workspaces.test.mjs \
  tests/configuration-setup.test.mjs tests/local-shell-acceptance.test.mjs \
  tests/verify-shell-evidence.test.mjs
npx playwright install chromium webkit
node tests/shell-recovery.browser.mjs
node tests/shell-setup.browser.mjs
node tests/visuals-preview-lifecycle.mjs
node tests/verify-shell-evidence.mjs
node tests/desktop-appearance.mjs
node tests/local-shell-acceptance.mjs facts
```

The browser driver mounts the actual Cradle shell, real editors, real settings
and real Factory navigation. The separate setup driver uses the actual #406
form/controller with a **test-only controlled C0 source** to exercise review,
Cancel/reopen and partial native-result presentation without credentials. Its
single write is a controlled-source operation, not a native apply. These tests
do not substitute for an installed WKWebView, live model or microphone.

Run the wider suite without deleting failures:

```sh
node documents/build-personal.mjs
node --experimental-strip-types --import ./tests/ts-register.mjs --test tests/*.test.mjs
```

At the published starting cut `a222c8b` and reconciled main `b72d763`, personal-web's legacy Day test already
expects four available forms while the real roster returns five. W1 reproduced
that same failure on the original source and independently on unchanged `b72d763`
(33/34 personal-web checks pass there). Do not reduce the real corpus or
change that assertion merely to turn W1 green; reconcile the roster with its
owning lane. Missing generated Beings/Things carriers are resolved by the real
build-personal generator, not replacement fixtures.

## One real model turn, only in a dedicated existing test session

Choose an already connected, idle native session with an **empty shared draft**.
Use the actual AIKit session-space binary, project root and configured provider
ID from the local source/candidate receipt. The check refuses a dirty draft,
active turn, undisclosed resident session, pending permission or fixture-named
provider. It performs one draft CAS and one short prompt, observes its fresh
nonce in the native assistant reading, and verifies the same native session
and provider. It neither reconnects nor replays, cancels or approves tools.
Sending the turn can incur the provider's normal cost.

```sh
node tests/local-shell-acceptance.mjs provider \
  --binary "$OI_AIKIT_SESSION_SPACE_BIN" --project "$OI_TEST_PROJECT" \
  --session "$OI_TEST_AGENT_SESSION" --provider "$OI_TEST_PROVIDER_ID" \
  --consent-test-turn --timeout 90
```

A timeout/transport failure remains uncertain and exits nonzero. Inspect the
native session before doing anything else; do not rerun automatically. A
successful result proves that one observed turn through that configured owner,
not every provider/model, Factory task completion or all installed capabilities.
The receipt keeps identity, hashes and nonce, not the personal transcript.

## Installed Mac interaction and exact visual sequence

Start one idle test window of the candidate already installed by local
integration, in Base mode. Accessibility permission must be granted deliberately
by the person; the script does not grant it. Use its real bundle path:

```sh
node tests/local-shell-acceptance.mjs mac --app "$OI_TEST_APP" --consent-native-keys
```

This verifies the expected bundle ID, running application path and executable
hash; enters Settings through the native keyboard shortcut; locates and presses
the real accessible **Back to work** button; and observes its disappearance.
It does not close content, resize windows, install/restart an application or
prove that document identity survived. Complete the following visual packet in
that same candidate using throwaway documents, not private source screenshots:

| Capture | Exact interaction and acceptance |
|---|---|
| M01 · nested light/dark | Left pane beside upper-right/lower-right panes, then the transposed split arrangement. Only the visible upper-right boundary pane has the right cutout; only upper-left owns the left reserve. Drag both dividers; ownership is unchanged. |
| M02 · maximise and close | Maximise lower-right, restore, maximise it again and close it. The remaining upper-right pane becomes visible with the cutout; no stale maximise mask. |
| M03 · final content | Close the remaining contents. Real resting actions appear, zero active tabs. Open New tab, start writing, verify exactly one visible draft tab, close it; repeat three times. No phantom New tab and no workspace reset. |
| M04 · retained document | Open a real HTML document and Markdown file; set scroll, selection and an unsaved edit. Enter Settings, then Back to work. Check the same arrangement, content, scroll and selection; no re-read/remount flash. Repeat in an already visited second workspace. Keep #410 C03/C04 continuity receipts. |
| M05 · restart/origin | Let the candidate checkpoint, quit and relaunch the **same installed origin**. Check nested layout, active tabs and theme. Record the actual app/source origin; browser localStorage reload is not this proof. |
| M06 · settings widths | At 1280, 760, 430 and native-minimum 360 px, inspect Settings, System and Visuals. Both side regions start collapsed. Fields and owner references wrap, one workspace scroll, no hidden rightmost data. Back returns to the preceding arrangement. |
| M07 · setup states | With Lane D's approved disposable target, inspect #406 discovery/configure/review/readback, native refusal and partial result. Cancel/reopen retains the draft. Do not apply real settings solely for screenshots; use a previously approved native receipt or the controlled browser driver for partial-failure layout. |
| M08 · theme and Expressions | Light/Dark/System follow the existing owner; change macOS appearance under System and restart. Visuals contains preferences only. Open Expressions goes to the actual application, with its corpus/scene functions retained. |
| M09 · Factory/sidebar | Desk/Tasks remain distinguishable in light/dark without inverted black/white icon blocks. Inspect existing Run, Agents and Context at 240/300/400 px, including expanded/refused/empty states. Chat/transcript/composer design and interactions remain unchanged. |

Record each observation independently (pass/fail/not-run), with the source,
installed binary hash, OS/architecture, viewport and theme. No pass on an
unexecuted row. Screenshots are review evidence, not a substitute for the
interaction or a new approval of the entire appearance programme.

## Real microphone, local transcription and audible output

The existing local speech server must already be running. This command opens a
fresh headed browser context; it does not reuse or change the app's preferences.
It uses the production DictationSession and endpoint validation. There are no
fake devices, prerecorded speech, permission auto-grants or canned transcripts.

```sh
node tests/local-audio-acceptance.mjs --consent-microphone-audio \
  http://127.0.0.1:8080/inference
```

Grant microphone permission yourself, read the fresh displayed phrase, stop,
and observe a matching real transcription. Play the quiet tone and confirm
hearing it. The receipt distinguishes observed phrase matching from the
human's audible-output confirmation. It never sends speech to an Agent.
A refused/missing microphone, absent server, timeout or failed phrase does not
pass. The browser closes and releases its devices when the check ends.

Finally repeat actual dictation in the installed Mac app's existing composer:
permission denied and granted, successful editable transcript, amend without
sending, stop/service-down. Check Nara voice separately under its owning lane;
local dictation is not Nara dialogue. Record native microphone permission,
audio-route and waveform/transcript observations rather than relabelling the
browser result as WKWebView proof.

## Source and evidence identity

The successor preserves the per-mode persistent stage slots from `b72d763` and
#425's `setupFlowController.ts` spelling. Do not transplant the earlier #416
CradleFrame over that successor. #408/#410 continuity and #406 setup behaviour
are prerequisites already delivered in this basis, not replacement work.

The three acceptance browser receipts must name the actual source revision,
clean tracked source/test state, driver SHA-256 and CI run. Run the independent
verifier above; a zero process exit is not enough. Reference captures are
labelled separately and never count as passing acceptance. Keep original red
run `35487741447` / artifact `10598422365`: it records the earlier compact-resize
and Expressions-route failures. The Mac packet adds installed evidence; it
cannot retroactively turn a controlled browser receipt into native proof.

## Handoff boundary

The full corpus/library/Expressions and installable, self-inhabiting Factory
remain required outcomes. W1 does not collapse either into a visual demo, infer
native absence from missing desktop wiring, or claim these outcomes merely
because shell checks pass. Local integration owns exact branch reconciliation,
merging, installed candidates and the outstanding observed rows above.
