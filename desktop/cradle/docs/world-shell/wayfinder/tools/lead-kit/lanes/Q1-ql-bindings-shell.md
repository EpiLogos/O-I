# Lane Q1 — the instruments' gaps the shell can close now (B4, first part)

The QL deep capability matrices' NATIVE-GAP rows are the build list (QL-MEF `495e6c4`; manual §16.16 "Instruments of
the map", O:I `docs/dlw/DLW.md` lines 1893–1925). O:I issue #684 lists the readings the device lane's designs wait on
(`gh issue view 684 -R EpiLogos/O-I`). This lane takes the three items whose owner already answers, so only the
shell's binding is missing.

Seat: `/Users/admin/Central/worktrees/env-1/o-i` (branch `dlw/build`). Product: `packages/live-shell/ui`.

## 1. (done: folded into lane MR) The Resonator bank (`quaternal-logic:resonator-bank`)

#684: "Resonator bank (quaternal-logic:resonator-bank): the same `set-aperture` and `reciprocal-aperture` the M3 clock
binding writes." The design: `packages/live-shell/ui/src/inhabitants/catalogue/panels/quaternal-logic__resonator-bank.tsx`.
The M3 clock's binding, the pattern to copy: `packages/live-shell/ui/src/inhabitants/ql/devices/qlM3Clock.ts` (its reading
from the kernel's `m3_reception`, its writes, its absent keys with reasons). Read the manual's entry for the Resonator bank
(grep `Resonator bank` in O:I `docs/dlw/DLW.md`) and bind the design on the same owner: every key the owner reports is a
reading, every write goes through the same op the M3 clock uses, every other key absent with its reason. Register the
binding where the QL family's other designed bindings are registered (find how `qlM3Clock.ts` is registered —
`frame/devices/designs.ts` `loadDesign('<family>:<face>')` and the family manifest).

## 2. The Agent's Team cell (`team.space`, `team.row`, `team.question`, `team.depth`)

#684: "No binding reads `ql context-frame team-space` for the agent's place. Thread `ask` rows need the Decision helper's
answers on the thread." The kernel op exists: `team_space` (`desktop/cradle/kernel/src/team_space.rs`, landed with K5,
PATH.md §7 row K5), already read by the Decision helper binding (`packages/live-shell/ui/src/agent/devices/decisionHelperBinding.ts`).
Find the Agent design's team keys (grep `team.space` under `packages/live-shell/ui/src/inhabitants/catalogue/`) and the
Agent's binding (grep the agent devices for the binding that hosts `agent` / `custody.*` / `id.*`). Bind the four keys on
`team_space` for the agent's place (which team row the agent sits in — derive it from the reading and the agent's
identity; if the reading does not say which row is this agent's, leave `team.row` absent with that reason). The thread's
`ask` rows: only if the Decision helper's answers are already a reading the shell holds; otherwise leave them absent and
say so.

## 3. The family manifest's "waiting" (packages/live-shell/ui/src/inhabitants/quaternalLogicFamilyManifest.ts:62, :108)

The Torus is marked `admission: 'waiting'` and its note says its docking is "law". Read how the Torus is actually drawn
now (packages/live-shell/ui/src/live/TorusOnChain.tsx, live/torusDevice.ts, live/torusInstrument.ts, the catalogue's
`torus.tsx`, PATH.md §7's R1 row: "the Torus in all six views on its owner"). If every presentation the manifest declares
is hosted on its owner, admit it and rewrite the note to say what is true now, with file:line; if one is not, keep it
waiting and make the note name exactly what is missing. The M′ matrices (:108) stay waiting in this lane (another lane
gives them their kernel op): rewrite their note to name what they wait on now — the kernel op over `ql kernel m1
<request.json> --json` and their binding — instead of "#281's nine packets".

## 4. The nodal quartet as the owner gives it (a fault, measured by lane ME1)

`packages/live-shell/ui/src/inhabitants/ql/qlModulationSources.ts:113–128` requires `nodal_quartet[i].frequency_hz` and throws a
fatal error without it. The real owner gives no frequency there: QL-MEF `crates/ql-mef/src/m2_vimarsha.rs` `NodalConstraint
{ql_position, helix: bimba|pratibimba, m, n}` (`deny_unknown_fields`). Only the test fixture invents `frequency_hz`
(`native-expression-fixture.mjs:81`). The reader would throw on a real reading.

- Read the owner's shape exactly.
- The four nodes are still roles, not pitches (manual §22.1 M2′ position 1: "eight audible roles and four still ones, the
  nodes"). Each node's modulation source therefore reads absent, and its reason says so in words: the node is a still mode
  (m, n) on its helix and gives no frequency. Keep the octet's eight as they are.
- Correct the fixture so that it matches the owner's real output. Take one real `m2.vimarsha.reading`, through the QL CLI or
  the kernel op that serves it, and pin it as the fixture.
- Find every reader of NODAL_QUARTET sources and make sure none of them assumes a number.
- Test (red first): the real reading's shape no longer throws, the nodes read absent with the reason, and the octet routes are
  unchanged.

## Zone

Write only: `packages/live-shell/ui/src/inhabitants/ql/devices/qlResonatorBank.ts` (new), the registration line(s) for it,
`packages/live-shell/ui/src/agent/devices/**` for the Team cell (never `agent/AgentShellBrowser.tsx` or `agent/factoryChats*`
— another lane works there), `packages/live-shell/ui/src/inhabitants/quaternalLogicFamilyManifest.ts`, and new tests
`packages/live-shell/ui/tests/q1-resonator-bank.test.mjs`, `q1-agent-team-cell.test.mjs`, `q1-ql-manifest.test.mjs`
(+ fixtures under `tests/fixtures/q1/`). If the device gate (`npm run devices:validate` or whatever the package uses —
see package.json) needs a registry update, include it and name it.

## Tests (red first)

The resonator bank: a fixture `m3_reception` reading → its readings; a write → the same op/args the M3 clock sends
(counting fake); an absent key keeps its reason. The Team cell: a fixture `team_space` answer → the four keys or their
reasons. The manifest: the Torus's admission and notes match what the code hosts (the test reads the manifest and asserts
the note names files that exist).

## Done when

Tests pass and failed first; tsc 0 through the serial lock; the device gate passes; the whole UI suite once with no new
failures.
