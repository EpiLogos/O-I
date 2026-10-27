# Editor bridge hardening packet

This is an integration patch for the assigned candidate, prepared by the internal Expressions-boundary child. It has not been applied by that child. The root owns active production files and applies the patch only after matching `EDITOR-BRIDGE-HARDENING-SOURCE.json`. The patch uses the `apply_patch` format, with absolute candidate file paths.

## Executed basis

The original source-bound audit exercised the actual ExpressionsHost, native editor client and receiver, canonical DocumentStore and retained editor read, with a genuine native owner inspection at `http://127.0.0.1:4180`. It passed five checks and reproduced six failures. No mutation port was entered and the complete native Document was identical before and after:

- Expression: `expression:authored-acb9d00d-e7e4-4f2f-948f-395914da17b1`.
- Observed native revision: 6.
- Document SHA-256: `e82d8283d5a2a6907691570b61240f4ec946ffeb39f7741874370c6b5a44635c`.
- Original audited client SHA-256: `277d03657088feb219b29b899169caa32a8167575ae2ccb03ce793379b56fb24`.
- Original audited receiver-source SHA-256: `210a0afad689711e922a5038be73a057872296c6753e5de2eb4565d3f5f054dc`.

The six reproduced faults were stale epoch reading adoption, older same-scene native revision adoption, a thrown validator for null entities, a stranded correlated acknowledgement after a subscriber exception, failed subscription cleanup after a disposal subscriber exception, and missing binding/epoch on receiver publications. Foreign-frame/origin refusal, pre-dispatch stale native basis refusal, pending-request retirement on replacement load, native retained reading identity and receiver authored-basis/human-gesture refusal passed.

The receiver source changed during the root integration. The patch preserves its current non-receiver prefix and is based on the three exact source hashes recorded in the adjacent JSON. This distinction is necessary: the original audit hashes are evidence of what failed; the patch hashes are the source to which the proposed repair applies.

## Proposed behavior

Request capture remains gated by an alive, ready, presented frame. The additive `host.readOutcomeTarget(capturedTarget)` only observes a previously captured surviving frame epoch. It gives no new write authority. A same-scene acknowledgement may complete after Audio hides the frame. A different selected scene blocks subscriber adoption while the exact owner reply still settles the original operation. A replaced host epoch leaves that outcome unresolved in this channel.

Both result and publication carriers include exact binding and epoch. An initial successful client read admits its subscriptions; the receiver requires an initial read before effects. Presentation accepts matching native subject/scene and monotonic native and authored revisions. Malformed readbacks refuse without throwing. Correlated replies settle independently of subscriber delivery, each subscriber is isolated, disposal removes subscriptions before notifications, and the first iframe load preserves requests when the host epoch survives.

The receiver has a bounded request history and a generation that retires asynchronous outcomes after disposal or replacement. An operation already sent to the native owner is not canceled or relabeled by this channel. NativeWorkspace and the owning persistence operations remain authoritative.

## Replay

From `/Users/admin/Central/worktrees/env-1/o-i/packages/expressions-boundary`:

```sh
node --experimental-strip-types --import ../../desktop/cradle/tests/ts-register.mjs tests/editor-bridge-native-audit.mjs --kernel-url http://127.0.0.1:4180 --expression-ref expression:authored-acb9d00d-e7e4-4f2f-948f-395914da17b1
```

The expanded audit adds Audio concealment, a different genuine Central scene, initial-read admission, authored-revision monotonicity and asynchronous retirement after disposal/new epoch. The last two exercise the real retained editor commit path through an explicit read-only denial port; they claim transport retirement of a denied outcome and never manufacture a native save acknowledgement. Native operations dispatched by the audit are inspections only. Malformed and stale carriers are deliberate protocol fault injection, not claims of observed native-owner faults.

The expanded test and loader passed JavaScript syntax checks. Production patch compilation, expanded replay and computer-use editor/save acceptance belong to the root after applying the patch. This packet does not claim audio playback, native save acceptance or completion of an instrument target.
