# Native instrument editors

Bound compact and full editors for Project / Graph, Canvas, Timeline, Journey,
Places and Palace, plus the unclaimed Modulation editor. The package adopts the
current O:I editor and native owners. It does not own the Browser, rack, Clip
engine, field renderer, workspace store or window runtime.

`src/index.ts` exports components, instrument constraints and receiving adapters.
The development entrance at `http://127.0.0.1:4298/` retains every opened editor;
switching editors does not replace its binding or discard pending input.

From the O:I seat, with the existing dependencies and compiled kernel:

```sh
OI_HOME="$PWD/packages/instrument-editors/evidence/native" OI_EXPRESSION_HOME="$PWD/packages/instrument-editors/evidence/native" desktop/cradle/kernel/target/debug/walk-bridge 127.0.0.1:4186
npm --prefix packages/instrument-editors test
OI_EDITOR_BRIDGE=http://127.0.0.1:4186 npm --prefix packages/instrument-editors dev
```

The native test home and Expressions are controlled test material, explicitly
labelled in the entrance. The Graph reads the actual root Wiki. Research editors
use the production source reader and disclose unavailable source/provider/native
admission rather than substituting geographic or dated facts. The entrance does
not run a field engine or admit native detached contributions.

The functional checks exercise native composition, exact native material writes,
CAS conflicts, retained input, history, source-qualified integral navigation and
recovery through the actual current owners. Browser checks are
`tests/visual.mjs`, `tests/native-visual.mjs` and `tests/research-visual.mjs`.
Run browser checks after functional checks: functional checks replace their
controlled native fixture references, which Vite observes.

Run `node packages/instrument-editors/tests/restart-run.mjs capture`, restart
only the isolated 4186 bridge with the same native home, then run
`node packages/instrument-editors/tests/restart-run.mjs verify` and
`node packages/instrument-editors/tests/restart-visual.mjs`. Recovery requires
a different owner PID, initially unopened Expressions, exact disk journals,
and retained pending input with no operation replay.

[RETURN.html](RETURN.html) shows seven compact/full pairs and executed results;
`RESULT.json` is the structured result. Native fullscreen/detached-window
acceptance remains open. The running controlled work includes a refused research
proposal retained after restart. Whole-document saves may refuse until the
native research validator admits the current schema.

The shipped bridge used for these checks predates `OI_EXPRESSION_HOME`; it
honours `OI_HOME`. Both are supplied above for actual disk isolation. The
initial missed override and exact native-CAS migration/cleanup of this packet's
33 journals are recorded in `evidence/isolation-result.json`. All 163 unrelated
recovery records retained identical hashes. Verification uses that shipped
binary; no claim is made that the newest kernel source was rebuilt.

See [SOURCE-TARGETS.md](SOURCE-TARGETS.md) for adopted sources and original target
identifiers, [RECEIVING.md](RECEIVING.md) for the exact additive integration ports,
and `evidence/` for native receipts and local captures. Imported implementations
and green component tests are not acceptance of every target in the programme.
