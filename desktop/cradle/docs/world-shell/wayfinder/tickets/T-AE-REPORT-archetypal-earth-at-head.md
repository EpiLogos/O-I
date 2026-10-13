# T-AE-REPORT — Re-port Archetypal-Earth at HEAD, pinned, with a drift check

Label: wayfinder:task (lead — judgment; a builder only for mechanical copy batches)
Claimed-by: claude-code:dlw-lead (13 Oct 2026; lead-led, no builder)
Blocked-by: —

Zones: `packages/live-shell/ui/src/projections/atlas/` (the port), its tests,
and the atlas family manifest/mount where host bindings must adapt.

## Question

DEVICE-SEMANTICS-LOCK §7.4.1. The port holds 66 of AE's 119 modules from a
9 Oct snapshot; 53 are missing and 51 differ. Re-port verbatim at AE HEAD
(`Work/Archetypal-Earth`, pin the commit), keeping the C2 corpus seam
(corpus-neutral, the vault re-attaches as one provider — no Jung corpus in
the port), then adapt hosts/bindings. Record the pinned AE commit in the
port and add a test that lists every module differing from it.

## Acceptance

- Every AE `src/` module present (or named as host-only and excluded, with
  the reason); content equals AE at the pin except recorded host adaptations.
- Host adaptations follow lock §8.4: material through the C2 provider seam
  and native owners (refs, revisions), settings in the workspace, modes
  through the shell's spine — never AE's `public/data` fetches, browser
  storage or mode flags.
- Corpus neutrality holds (no Jung corpus bytes; the C2 amendments kept).
- tsc zero; the atlas and timeline suites green; the drift test green.
- UI legs (the atlas in the native app): UNVERIFIED until the screen pass.

## Resolution

**Landed (13 Oct 2026, lead, lane `dlw/phase1-semantics-20261013`).** The port
is re-ported at AE `5fe5117` (HEAD; read from git — AE's working tree carries
the curation lane's uncommitted `src/` edits, which are not ported).

- Method: a three-way merge per module — the port's own adaptations (port vs
  its old pin `606fbe6`) re-applied onto AE `606fbe6 → 5fe5117`; AE's C2
  modules (`types/corpus.ts`, `data/corpus.ts`, `ui/passage.ts`, upstreamed
  since) merged from their base `15e3851`; 41 conflict hunks resolved by hand.
  58 new modules copied verbatim (aion walk, chronology, dynamics, redbook,
  lenses, shell, astro, practice, sky wheel/zodiac/orbits/cards/camera/compose…);
  `sky/birth.ts`, `sky/card.ts` retired as AE retired them.
- Pin and drift: `src/projections/atlas/PORT-PIN.json` (commit, sha-256 of all
  128 AE modules, 40 recorded adaptations each naming its law, 1 port-new,
  2 host-only: `main.ts` → `mount.ts`, `dev/fixture.ts`).
  `scripts/atlas-port-pin.mjs --check` (CI-safe) and
  `tests/atlas-port-pin.test.mjs` refuse any unrecorded difference;
  `--drift` names AE modules changed since the pin (0 today).
- §8.4 host adaptations: AE's `public/data` fetches (redbook, dynamics,
  dynamics-route, aionbook, sky-cards, every lens file) go through one door,
  `data/published.ts`, bound by `mount.ts` from `CorpusBundle.published`
  (absent ⇒ each mode's own absent state); graph settings, practice store and
  the landing flag go to host-bound stores, never browser storage (the test
  refuses `localStorage`/`sessionStorage`/`indexedDB`); tie forces and settings
  key on the provider's basis tiers (C2-b5/b6); the site is named by the
  provider (C2-b8); AE's shell chrome mounts in the pane root.
- `astronomy-engine@2.1.19` added (AE's own pin; the natal chart).
- Checks (scripted): `tsc --noEmit` 0; `vite build` ok;
  `node --test` agent-native-p0, atlas-port-pin, timeline-time-spine,
  ql-musical-timeline → 36/36; `atlas-port-pin.mjs --check` exit 0.

**Unverified / carried:**
- UI legs — the re-ported atlas (Earth, Graph, Aion, the new lenses) in the
  native app: `UNVERIFIED: needs-computer-use` (screen gate red).
- The host stores are unbound: graph settings and practice records are not
  yet kept in the workspace (they behave as AE's private-window path, and
  say so); the landing never shows. Carry **T-ATLAS-WORKSPACE-STORES**.
- The fixture provider publishes no named material, so Red Book, dynamics,
  lenses and sky cards show their absent states until the vault provider
  publishes them. Carry with T-ATLAS-WORKSPACE-STORES (vault provider's
  `publishedBase`).
- C2 wording: 42 modules still name Jung in UI copy (lens blurbs, landing
  line, basis titles). No corpus bytes are ported (no CW/¶ quotations in
  code), but under C2-b8 the words belong in provider labels. Carry
  **T-AE-C2-WORDING**.
- `aionTimeline.ts` has no test; T-TIMELINE-WALKS re-projects it.
- AE's shell modules use `document.body` for chrome state (53 sites);
  containment inside a pane is checked at the screen pass.
