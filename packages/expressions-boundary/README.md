# Expressions application boundary

This internal package hosts the existing O:I Expressions application and its
deep cut over one retained frame and native document. It carries refs,
selection readings, owner receipts and Action routes. It owns no document
store, lens/camera state or native authority.

The shell consumes it through `file:../../expressions-boundary`. Vite bundles
the package and its canonical O:I source imports; no copy of the Cradle's
save, Wiki, personal-dialogue or Action-routing model is installed here.

```ts
import {mountExpressionsApplication, reopenConfiguredWorks} from '@epilogos/expressions-boundary'
import {createCradleOwners} from '@epilogos/expressions-boundary/cradle'

const owners = createCradleOwners(
  {kind: 'bridge', url: explicitNativeHost},
  {project: 'O-I', onReceipts: receiveKernelReceipts},
)
const continued = await reopenConfiguredWorks(owners, startupContext, configuredWorks)
const selected = continued.works.find(work => work.expression_ref === selectedExpressionRef)
if (!selected) throw Error('Choose one configured native work')
const mounted = mountExpressionsApplication(container,
  `/__application/expressions/index.html?world=epi-logos&expression=${encodeURIComponent(selected.expression_ref)}`,
  {bindingId: 'world.expressions', owners, recoveryBindings: continued.works,
    initialRecoveryBinding: selected, onState: receiveSelectionReading},
)
mounted.host.setMode('techne')
mounted.host.selectInstrument('canvas')
// Keep mounted.frame and its src across all cut/view switches.
```

`host.openExpression(ref, bindingId)` accepts only the named presented host;
before readiness, it buffers the latest ref once. `captureTarget` and
`assertTarget` bind insertions/operations to the exact frame epoch, Expression,
revision and Scene. Unknown/malformed requests are refused by correlation id;
foreign frames and origins are ignored; old owner replies cannot enter a
reloaded frame. `resolveActionRoute` is the existing canonical routing-only
function, imported whole: an undisclosed Action or different subject never
routes, and a routed receipt is never an execution claim.

Recovery traffic requires host-selected `{scope,checkpoint_id,expression_ref}`
addresses from successful native continuation reads. The initial query and
every open/refresh carry that same refs-only binding; mode changes never alter
it. A selected checkpoint owner read proves the draft id before draft traffic
is admitted. Requested and returned scopes must agree. Unknown addresses and
generic duplicate-checkpoint discovery refuse without an owner operation.
See [RECOVERY-OWNERSHIP.md](./RECOVERY-OWNERSHIP.md) for the actual native bases,
remaining app integration and executed read-only acceptance.

Serve **this candidate's** `desktop/cradle/expressions-app/dist` at the shell's
same origin. `npm run build` in the application's own package creates those
bytes. The candidate backend's `/__application/expressions/` route has no
fallback to the primary tree. Same-origin serving also lets the imported
Nara/Epii facade dispose at pagehide before any navigation can receive private
late replies. For intentional cross-origin basic hosting, `personal:false`
omits that facade. The portable core always posts to an exact origin.

The optional Cradle adapter imports the real `kernelOp` transport, existing
`hostedCompositionFile` prepare/perform/inspect save family, source-file
readers, library reader, Wiki Scene/deep readers, constellation relation owner
and the bounded Nara/Epii facade. `techne-world` lists the native World's
registers and opens one through `ensureWikiNativeExpression`, which retains
already-authored native work. `onOutcome` preserves hosted-native receipts'
separate World/generation provenance; `onReceipts` reports the local kernel
stream. Constellation `open` requires `onOpenConstellation`; absent editors
return a named refusal.

Runtime:

```sh
# Existing candidate native host (same kernel as the desktop, dev-only):
cargo run --manifest-path desktop/cradle/kernel/Cargo.toml --bin walk-bridge -- --bind 127.0.0.1:4180
# Candidate API, application and shell assets:
LIVE_SHELL_BIND=127.0.0.1:8788 LIVE_SHELL_KERNEL_BRIDGE=http://127.0.0.1:4180 cargo run --manifest-path packages/live-shell/Cargo.toml -- '/absolute/real-set.als'
# UI development proxies the candidate API/assets under this same origin:
npm --prefix packages/live-shell/ui run dev -- --host 127.0.0.1 --port 5176 --strictPort
```

Checks: `npm test` exercises eleven transport/lifetime/identity/Action-routing
cases over real Node MessageChannels; it is protocol evidence, not native UI
acceptance. `npm run check` includes the canonical Cradle declarations.
`npm run test:native -- --kernel-url <explicit-host>` exercises this host
controller against real native list and missing-subject inspection, preserving
the native results/refusal unchanged (grade B). UI/save/craft acceptance still
requires operating the mounted candidate through the real application.

Acquisition classification: **B, existing O:I/native implementation**, adopted
through package imports. No step-C reference source or captured image entered
this package. Protocol orchestration is new integration code; native model,
save/CAS, deep readings and personal authority remain the existing owners'.

Source basis: PROGRAMME's 2026-10-07 owner amendment and lane-7 P1/P7,
candidate HEAD `03b021c952610c7a749ca71cd5f07b779d3281dc` before this lane's
uncommitted additions. Extraction references and SHA-256:

| Source | SHA-256 |
|---|---|
| `desktop/cradle/src/expressions/hostedApp.ts` | `a44e61d8cc8c26959c047776349ee1ae2af9ad28498c1fa0953134f7fe176173` |
| `desktop/cradle/src/expressions/nativeChannel.ts` | `4c622c3111c71d9fda8e23587303dff537ca3e99982db50c09b53ba5d97984f6` |
| `desktop/cradle/src/techne/m0m5/adapter.ts` | `5a4db93cbc56418a9e5127716d4e302180a4c79b793dd394658663b25122b4f5` |
| `desktop/cradle/src/expressions/hostedComposition.ts` | `d8a78d6ec27c2ca23ac4fad26c050004d37616a685b80c8109ec39c02ffb5489` |
| `desktop/cradle/src/expressions/naraChannel.ts` | `5974a73720180669d640bf408ea90a0d45aea2171d5defa54756936bf316e269` |

Pre-edit GitNexus: primary `relayKernelChannel` impact HIGH (PointCloudHost,
LibraryHost and five transitive callers; no named processes), index six commits
behind. Existing sources/callers were left intact. New `live-shell` paths are
absent from the index (`risk:UNKNOWN`); text/source review cannot turn that
absence into a low-risk graph verdict. The integration parent owns index
refresh/detect-changes before committing.
