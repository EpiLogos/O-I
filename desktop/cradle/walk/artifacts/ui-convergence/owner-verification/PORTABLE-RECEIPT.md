# O:I UI verification — portable evidence

2026-09-15. Native source unchanged. Exact basis and hashes: `basis.json`, `performance-basis.json`, `oi-current.patch`.

| Scope | Basis | Executed result |
|---|---|---|
| Factory UI | `fb854dede9876a0ea008afd62422ef9150fe5203` | TypeScript, 32 tests, production build passed; real built component in light/dark, semantic/live/trajectory depths, isolated host styles and unchanged owner Action refs. 639px fits. |
| QL/Nara | `3a3d7dbcf6a898ce88a9093f858b8f254fff3cfe` | Actual calculated sky → native M2/C++ → coupled/personal examples passed. Nara browser test preserves eight partitions, seven distinct loci, targets/seeds and refuses stale generations/leases. |
| O:I baseline | `5c7582e09f6d84b3e4a7372a73643177025d0e2c` | Settled after welcome release: zero presentations, 150 RAF callbacks/2.5s in both repetitions. |
| O:I current | `be172a109f2f5e307cc34a8c0f62cfdc6e5825b1` + recorded parent delta | Settled idle: zero RAF callbacks in both repetitions; live=false, scheduled=false, production frame counters unchanged. |

Same-machine renderer CPU: **2.63–2.98% → 0.35–0.53%** (~84% lower median). Enabled field retains exactly one engine WebGL2 context; disabled has zero engine canvases/contexts. One shared 2D overlay remains. A single late window callback occurred in one early settle window; neither final settled window had a callback.

Explicit-disabled startup script transfer: **823,976 → 167,392 bytes**. Shell/channel ready in 206/137ms baseline versus 84/83ms current; renderer task CPU 132.8/64.9ms versus 53.6/53.4ms. Enabled welcome startup was shader/cache-sensitive and does not support an overall startup speed claim.

Measurements use actual production WALK bundles and the same real native kernel binary, fresh processes, alternating baseline/current/current/baseline, 1280×820 Chromium headless ANGLE/SwiftShader. Ambient agent/application work may be active. CPU is CDP renderer TaskDuration, not whole-machine CPU; no physical GPU measurement. Heap snapshots are unforced-GC observations, not leak proof. All owned browsers/previews/bridges were closed.

The accepted Factory fixture corrections are checked at their owner: source parity has three shared-agency lanes; null SessionSpace and actual Surface refs stay declared; unproduced SessionSpace revision/lifecycle fields and the obsolete duplicate SSSF JSON were removed; portable-only missing-detail rendering now has coverage. Package specimen data remains controlled fixture evidence, not a live commissioned Run.

QL output is from the actual native acceptance examples and calculated sky provider, with their declared controlled subject/receiver geometry. No private personal data was fabricated. The macOS C++ worker needed SDK system headers and arm64 json-c from /opt/homebrew; native warnings remained enabled. No source was patched to bypass host configuration errors.

`available-actuation.json` locates the runnable native release for the next agency walk: `/Users/admin/Central/Work/Actuation/target/release/actuation`. Its SHA256 is `09c32c3d3fcd8eeffb00c77ce253af4285b088258862cd04a0e19a5aa9bfbe2a`. Checkout HEAD is `27492df53e1d4933eacfe791c278785092dd4c56`; that is not embedded binary build provenance. The older installed binary has an attested install receipt for `90041d5f81331b636893d772c3288c062ad0e13b`.

`portable-files.json` gives the exact relative files and hashes to copy. It excludes complete archives, node_modules, virtualenvs, and binaries. `VERIFICATION-RECEIPT.md` has the full executed command/context account. These results do not constitute #65 human experience acceptance.
