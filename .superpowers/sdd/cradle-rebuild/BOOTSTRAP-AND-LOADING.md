# Desktop bootstrap and loading — implementation contract

Owner addition, 6 September 2026. Extends the current execution programme;
canonical cradle/03 A0–A3/degraded states remain the semantic basis. This is a
full desktop lifecycle, not just a logo screen and not a six-product setup wizard.

## Two bootstraps with different owners

Developer provisioning selects/builds/installs product artifacts through O-I
native development contracts. End-user desktop bootstrap discovers an existing
installation and helps the person establish usable ground. The installed app
must never ask its user to run git, edit suite pins or compile the six repos.
Runtime recognition must not depend on the developer rolling-main mechanism.

The startup critical path is: mount host → observe available ground/runtime →
show usable Central workspace or actionable recognition state → progressively
resolve saved surfaces/products. All six products, credentials, an agent profile,
network and a wiki index are not prerequisites for a usable shell.

## State / ownership / exit matrix

| State | Truth and UI | Native seam / exit |
|---|---|---|
| BOOT-00 Host starting | Braced point-cloud mark only while shell is not yet usable; accessible operation label | Tauri host + kernel mount; ready immediately removes overlay, no minimum brand dwell |
| BOOT-01 Returning installation | Read saved presentation schema and selected ground; observe, don't trust yesterday's availability | O-I presentation persistence → Central/CurrentWorld recognition; proceed independently for available surfaces |
| BOOT-02 No recognized ground | One clear invitation to locate existing Central ground; explain that no files have been moved | Existing recognition/adoption inspect; native directory picker. Inspection never initializes or mutates a selected folder |
| BOOT-03 Existing candidate | Show selected location, recognized identity and relevant limits; use existing work without reorganizing it | Confirm binding through owner contract. If initialization is needed, separately disclose/confirm its actual writes through the native owner |
| BOOT-04 Ground inaccessible | Explain permission/missing-volume/read-only state for this ground; no opaque infinite loader | Real retry, choose another ground or read-only operation where supported; preserve original binding/drafts, no silent fallback write path |
| BOOT-05 Minimal inhabited | Central and projects usable; agents/provider/other products may be absent | Canonical A2. Enter desktop immediately; available actions only. Creation is an optional situated act, not compulsory onboarding |
| BOOT-06 Product discovery | Progressive composition reading separates missing, discovered, incompatible, unavailable, ready and degraded | O-I CurrentWorld + native descriptor/readiness. Missing product has a scoped install/recovery path if supported; unavailable is not an error blanket |
| BOOT-07 First agency | Intent → authored profile → resolve context/body/bounds → inspect determinations → explicit launch | Central authored Profile; AIKit composition/harness surface; Actuation agency. No invented model defaults, no setup-time inference or auto-created pretend agent |
| BOOT-08 Credential/provider need | Ask only when the chosen operation needs it; show provider and reason; keep other work available | Native provider authentication/settings and credential storage; no desktop credential shadow store or logged secrets. Cancel returns to usable work |
| BOOT-09 Workspace restoration | Restore pane tree/view state; validate each subject/session ref. Show exact missing/unavailable binding locally | Owner resolve/read/resume faculties. A saved ref is not saved authority. Retain drafts and original source route; never attach to a different session silently |
| BOOT-10 Corrupt/older presentation state | Preserve recoverable bytes and last-good presentation; offer safe fresh arrangement and explicit recovery | O-I versioned persistence/migration; never reset canonical ground, delete held writing or treat corrupt state as successful empty restore |
| BOOT-11 Offline/degraded runtime | Label last-observed readings and their age; preserve identity and working context; known absence is static | Owner health/reconnect/retry. Resume/attach only when natively supported and authorized; attach is not a new inference/commission |
| BOOT-12 Ready | Usable shell, contextual sidebar and surfaces, optional discovery can continue locally | Cancel window overlay as soon as critical shell/ground decision is usable. Optional absence remains inspectable in System |
| BOOT-13 Upgrade/restart | Preserve session/ref identity, hold active operation on its material version, migrate presentation safely | Reconnect negotiation and native install/update contracts; do not swap active binaries, lose drafts, or call updated source an updated running provider |
| BOOT-14 Runtime load/refresh | Loading belongs to the affected surface; retain known content with a freshness label where available | Central/AIKit/provider operation state; authoritative completion/failure/cancellation removes animation; retry only if a real Action exists |
| BOOT-15 Gateway/ecology | Name absent, incompatible, scope-denied, disconnected or degraded ecology and the encounters not reachable; retain authorised last-observed identity/age | AgencyService → native AIKit Gateway discovery/attach/replay + Workcell service observation. Real retry/setup only when owner-disclosed; no second registry, stored credentials or auto-start/inference. Local Central remains usable |

No percentage unless a native operation provides a meaningful denominator. A
network stall becomes a named recoverable state using the operation's real
failure/cancel semantics; no universal fake timeout is substituted for success.
Missing/cancelled/paused/error states are static, not perpetual animations.

## Focus, attention and accessible loading

Use package `tokens.css`, `point-cloud.css` and `./loading`. Full-window scope is
restricted to initial unready host/critical restoration. It is not a replacement
for A1's non-blocking recognition once controls are usable. Local operations use
surface or inline scope and never take focus or move layout. Status updates are
polite and semantic, not announced every animation frame. The logo is decorative;
the readable operation name and recovery action carry meaning.

The host owns `aria-busy` on the affected region, inertness of truly obscured
controls, keyboard focus, and restoration to the previous available control.
Don't make the entire app inert while an optional product is resolving. Honor
reduced motion and forced colours. Existing windows and drafts must remain
accessible during provider errors. Observe OS permission denial and keychain
cancellation as normal exits, not a reason to restart the entire wizard.

## Required real acceptance cases, by slice

- **Slice 1 foundation:** cold launch before any ground selection; recognize
  existing Central without mutation; missing native product; absent/inaccessible
  path; read-only refusal; no agents; cancel/retry; host crash and presentation
  recovery; stale/excluded source restored without redirect; keyboard/focus and
  reduced-motion/forced-colour rendering. No mandatory network/install wizard.
- **Slice 2 knowledge:** empty wiki/index, index warming, denied/excluded result,
  AIKit unavailable, progressive search, cancelled query and successful-use
  familiarity. Empty is not loading; ranking is never reimplemented in renderer.
- **Slice 3 agency:** missing harness/credential/profile, cancelled login, genuine
  composition failure, explicit first launch, resumed session, unsupported resume,
  disconnected provider, permission request arriving during another task. Include
  BOOT-15: absent Gateway, denied ecology/attach, stale authorised snapshot,
  reconnect/replay gap and restored same-session reachability through its real seam.
- **Slice 5 System:** optional product install/update/config through real owner
  operations; distinguish authored/effective/active, static absence and recoverable
  failure. No mandatory all-six installation before doing ordinary work.
- **Slices 6/7:** material placement unavailable, remote process loss, field offline,
  authentication cancellation, no admitted projections, partial subscriptions and
  source Return recovery. Local work remains intact.
- **Slice 8:** cross-product fresh-install and returning-user journeys on real
  native app, including update/restart, ordinary partial composition, offline
  work and recovery. Verify no auto agent run, publication or source mutation.

Test actual temporary native ground for first-use/permission/conflict cases.
A component visual reference proves loading presentation, not any of these
native bootstrap transitions. Put each case in the live acceptance ledger and
capture the actual observed owner operation/state/exits.
