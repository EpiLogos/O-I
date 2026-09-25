# Desktop architecture conformance

This is the Lane A ratchet from the canonical
`desktop-agent-conformance-rectification-2026-09-23-1756.md` plan. Its laws come
from `docs/cradle/02-ARCHITECTURE.md` §5–6/§12 and the plan's individual
requirements. Existing behavior supplies **debt evidence**, not design authority.
The 23 September owner-authoritative UI consolidation overrides the older
scrollbar ruling; this suite does not resurrect the old scrollbar, worktree or
panel-close rules. The shell-law merge orienter was recovered read-only from
commit `8652e2fb`, at its original `ProjectCentral/now/flows/` path.

Run from `desktop/cradle`:

```
node --test tests/conformance/*.test.mjs
```

CI runs that exact command in `.github/workflows/desktop.yml`. It is a static
and contract gate, grade C, with explicit unresolved debt. Green here is not a
native-app walk, a screenshot, an inference test, or whole-feature acceptance.

- `state-registry.json` names every current browser-storage owner/access/key
  expression, key generators, and classification/rationale. Imported and
  caller-supplied key definitions are separately retained. Semantic-adjacent
  rows remain forbidden debt until Lane B ratifies or repairs them. The scan
  handles direct and aliased Storage methods and bracket method names; it is
  a TypeScript syntax ratchet, not a whole-program security proof. Dynamic
  key families are explicitly bounded by their owner definitions, not declared
  as arbitrary future keys. There is no accept/update-baseline command.
- `authority-registry.json` names exact existing egress/window call expressions,
  every registered native command, and the two narrow host filesystem duties.
  Existing local dictation egress and direct theme mutation are debt. Fullscreen,
  resize/focus observations and detached-window labels are native lifecycle
  projections, not semantic mutation or generic window authority. No file-level
  network or native-API wildcard is permitted.
- `op-walk-coverage.json` is an operation inventory, not an execution report.
  A direct scenario reference earns only `referenced`; other operations remain
  individually `unverified`. Neither label claims native proof. A new operation
  must mirror Rust and have its own declared verification obligation.
- `violation-baseline.json` retains the original eleven findings plus the exact
  additional storage/egress/event gaps found during this audit. The fixed ceiling
  in `debt.test.mjs` permits shrinkage, never silent growth. Removing a debt also
  requires removing/reclassifying any registry row referring to it.
- `receipt-law` distinguishes native events (`seq`, `schema`, `version`, `event`)
  from acceptance evidence (`spec_ref`, `grade`). It validates retained event
  observations and rejects malformed/corrupt receipt and evidence inputs.

The native runner uses the real kernel's development transport, with no browser
and no substituted owner. Start a candidate `walk-bridge` with disposable
`OI_HOME`, `AIKIT_HOME`, Central root and project storage; provide a real supported
owner setting request whose mutation is confined there. Then run:

```
OI_CONFORMANCE_DISPOSABLE=1 node tests/conformance/seam-conformance.mjs \
  http://127.0.0.1:PORT /absolute/request.json /absolute/evidence.json \
  /absolute/theme-operations.json
```

The last argument is omitted until Lane B supplies real typed theme operations.
Missing theme support is an explicit failure, never a skipped passing claim.
The assertions require actual Settings hold/apply kernel events and owner apply
receipts, a read-only plan, exact surface open/close events and event-log parity.
At initial Lane A landing, the Settings effects emit no events and theme ops do
not exist: this walk has **not passed**. Its strict assertions are the target for
Lane B; the static suite can pass with those exact debts still disclosed.
Deterministic protocol evidence remains grade D, `accepted:false`; a native-app
walk and visual evidence remain separate work.
