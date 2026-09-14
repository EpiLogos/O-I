# O:I Git & Skills Normalisation Programme

**[OI-GIT-NORM]** · chartered 2026-09-05 by owner ruling at the P0 gate ·
research-backed the same day · tracker: see ledger row.

A cross-suite programme between cradle phases: **P1 does not open until this
programme's gate passes.** It has two tracks, run concurrently:

- **Track G — git normalisation.** Every repo clean and current: main pushed,
  every branch either merged by ruling, quarried for knowledge then deleted,
  or explicitly kept live; no stray worktrees; law 13's loop keeps it so.
- **Track K — skills into the ontology.** The machine's top-level skills
  directory stops being a master. Skills become Central Control ground
  (personal / machine / project scopes), retirement becomes a standing, and
  all harness projections become derived surfaces via AIKit.

Execution form: the owner rules in two personal sessions (S-PRODUCTS,
S-DESKTOP below); subagents research and execute mechanically under this
programme's unit rows; every action is receipted.

---

## 1. Programme laws

Inherits cradle map §1 law 13 (git discipline) wholesale. Adds:

1. **Nothing unruled is deleted.** Research units propose verdicts as data;
   only an owner ruling (in-session or ledgered directive) converts a
   proposal into a delete/merge/rebase.
2. **Quarry, don't force-merge.** Branches whose target no longer exists
   (all pre-rebuild desktop branches target `desktop/{ui,core,src-tauri}`,
   removed at U0.7) are quarried for feature/function knowledge, then
   deleted. The current design is the bar; old code is reference, not truth.
3. **Every action receipts.** Push, merge, rebase, delete, retire — one row
   in the normalisation ledger (`.superpowers/sdd/normalisation/progress.md`)
   with the evidence.
4. **Masters become ground.** No skill's master copy lives in a projection
   path (`~/.agents/skills`, `~/.claude/skills`, `~/.codex/skills`). Masters
   are either native repo sources (product skills, pinned —
   `SUITE-OPERATOR-SKILLSET` law: O:I runs no second registry) or Central
   Control ground (machine/personal skills). Projections are derived, never
   edited by hand, and are rebuildable from ground.
5. **Retirement is a standing, not a folder.** A retired skill remains ground
   with standing `retired` + provenance (who, when, why) — auditable,
   reversible. The 2026-09-05 `skills-archive` rename becomes the first
   retirement record.

---

## 2. Inventory (researched 2026-09-05)

| repo | main vs origin | remote heads | unmerged | stray worktrees |
|---|---|---|---|---|
| O:I | clean (pushed at P0 gate) | 35 (was 60; 25 merged deleted) | 34 | 0 |
| Central | clean (pushed) | 35 | ~34 | 0 |
| ai-kit | clean (pushed) | 75 | ~74 (1 stale worktree removed) | 0 |
| Actuation | **ahead 2** | 10 | ~10 | 0 |
| Quaternal-Logic | **ahead 68** | 58 | ~58 | 0 |
| Software-Factory | **ahead 30** | 33 | ~33 | 0 |
| Workcell | **ahead 3** | 10 | ~10 | 0 |

Totals: **256 remote branches, 103 unpushed main commits.** Every unpushed
main is invisible to every parallel session and every CI run — the direct
cause of "we built against stale ground".

Skills surfaces today: `~/.agents/skills` 37 entries (the master that
must not be), `~/.claude/skills` 51 (mix of symlinks into it, hand-rsynced
cradle-execution, harness skills), `~/.codex/skills` 29. Superpowers was
moved 2026-09-05 to `~/.agents/skills-archive/superpowers` (interim; becomes
retirement record in K3). `~/Central/Control/machines/` already exists and
carries machine state (`current/oi-development.toml`) — the ground for K1 is
real and in use.

---

## 3. O:I branch classification (worked example — research, not rulings)

Full per-branch profiles gathered (ahead-count, tip date, files, desktop-file
share, top subjects). Classes:

**Class A — QUARRY-DESKTOP (13 branches, ~700 commits).** Pre-rebuild
desktop work targeting removed directories. Cannot merge; contains the
"how much of our app is sitting on branches" the owner asked about:
workbench layout engine, kernel-event UI model, session observatory, living
wiki surface, flow workbench, project-field, system workbench, explore
parity, Epi/Cosmic instrument surfaces — all with tests encoding real UX
semantics. **Action: quarry (N8) → owner confirms → delete.**
`feat/flow-desktop-138` (150), `agent/oi-desktop-p2-project-field-106` (104),
`feat/living-wiki-desktop-135` (103), `agent/oi-d-current-situated-cosmic`
(90), `agent/oi-epi-cosmic-123-instrument` (57),
`agent/oi-pre-d-personal-map-lineage` (46),
`agent/oi-epi-personal-450-return` (42),
`agent/oi-desktop-p6-explore-parity-110` (39),
`agent/oi-epi-personal-450-composed` (29),
`agent/oi-desktop-p5-system-109` (28), `agent/oi-desktop-p1-host-105` (21),
`converge/living-wiki-w7-main` (10), `feat/wiki-authored-relations` (2).

**Class B — QUARRY-EPI/FOG (5).** Epi/Nara/coordinate/lineage instrument
branches — semantics for the map's charted fog (Nara/Epi composition, §0).
Quarry into fog notes feeding the QL/Epi design line, then delete.
`agent/oi-epi-nara-coordinate-parity` (25), `agent/oi-epi-personal-return`
(22), `agent/oi-epi-nara-lived-vertical` (22),
`agent/oi-epi-mode-kernel-bridge` (6), `agent/ql-relational-field` (11).

**Class C — LIVE-RECENT (9).** Sep-dated, mostly non-desktop, small,
pinning current mains — recent unfinished integration lines, review-then-
rebase candidates: `feat/oi158-omarchy-reference-world` (32),
`feat/oi155-inhabitation` (24), `feat/oi157-versioned-world-integration`
(23), `feat/oi172-six-product-native-command-field` (18),
`feat/oi173-adapter-driven-world-recognition` (12),
`converge/oi97-exact-main-w12` (11), `fix/pre97-prelocal-build-channel` (8),
`converge/oi97-w12-routine-profile-current-mains` (6),
`converge/pre97-six-product-command-current-main` (4),
`converge/oi97-exact-main-context-reload` (4), `agent/oi97-local-prep` (1),
`converge/pre97-final-aikit-registry-repin` (1).

**Class D — TRIVIAL-DOCS (2).** `docs/flow-source-relation` (1),
`cursor/docs-six-product-command-field-db87` (1) — read, likely merge fast.

**Class E — SUPERSEDED-CANDIDATE (3).** Desktop-adjacent Aug lines whose
content the rebuild re-derives under a better contract:
`agent/oi-epi-personal-450-composed` overlaps Class A (counted there);
`converge/oi97-post-w7-desktop` (5) — retired materializer, likely delete
after quarry note; `agent/explore-projection-space` (47) — SpaceTimeDB/
Explore live-probe work, quarry (Encounter security line) then owner rules.

*(Classes overlap slightly; the ruling table in N8 is authoritative.)*

---

## 4. The two owner sessions (verbatim briefs)

**S-PRODUCTS** — *"Six product repos: rule the branches."* For each of
Central, ai-kit, Actuation, Quaternal-Logic, Software-Factory, Workcell:
read the research table produced by that repo's N-unit (branch, ahead, tip,
content summary, proposed verdict); rule each branch MERGE / REBASE-KEEP /
QUARRY / DELETE; push the unpushed mains after their pre-push verify (N0)
where you accept them. Your rulings are ledgered verbatim; executor
subagents do the mechanics.

**S-DESKTOP** — *"O:I branches: rule the quarry."* Read §3 above +
`quarry/oi-branches.md` (N8 output: per-branch feature/function inventory
mapped to cradle map units). Rule per branch: QUARRY-DELETE (knowledge kept,
branch deleted) / KEEP-LIVE (name the unit that will consume it) /
DELETE-NO-QUARRY (nothing worth keeping). Class C branches additionally:
MERGE-NOW (executor rebases onto main, verifies build+tests+walk suite,
merges) or DROP.

---

## 5. Subagent units (Track G)

| unit | repo(s) | operation | walk |
|---|---|---|---|
| **N0 push floors** | Actuation, QL, SF, Workcell | pre-push verify (build + tests per repo convention) then push main | each origin/main == local main; receipts |
| **N1 audit tooling** | O:I | `scripts/suite-git-audit.sh` (or `oi suite audit`): per repo — unpushed-main count, branch table (ahead, tip date, desktop-share, merged-by-ancestry, targets-removed heuristic), JSON+MD output | runs clean on all 7 repos; output matches §2 inventory |
| **N2–N7 repo research** ×6 | each product repo | read-only: profile every unmerged branch (subjects, files, dependency pins, cross-repo references), propose verdicts, note product-specific hazards | proposal table per repo committed to `quarry/<repo>-branches.md`; zero mutations |
| **N8 O:I quarry** | O:I | read-only deep quarry of Class A/B/E branches: per branch, feature/function inventory (models, algorithms, tests-as-spec, UX semantics) each mapped to the cradle map unit that will re-derive it (U1.x–U4.x) or the fog row it informs; commit `quarry/oi-branches.md` + `quarry/notes/<branch>.md` | every Class A/B/E branch has a note; every note cites files@commits; map-unit mapping present |
| **N9+ execution** | as ruled | post-ruling mechanics: merges (rebase → verify build/tests/walk → merge --no-ff), deletions (local+remote), receipts; O:I merges also run the cradle walk suite | per action: verification green before receipt; branch gone after; law 13 gate loop |

N-units dispatch under `cradle-execution` discipline (brief/build/walk/
receipt) but commit on `main` under `CRADLE_ALLOW_MAIN=1` gate rules or on
`normalisation` branch per law 13 — research units commit ONLY their quarry/
proposal docs.

---

## 6. Skills into the ontology (Track K)

**Design (one paragraph).** A skill is authored ground. Its master lives
either in its native product repo (product skills: `cradle-execution`,
`oi`, `suite-operator` — pinned, projected, never copied; the
`SUITE-OPERATOR-SKILLSET` chain stays the governing path) or in Central
Control ground (machine/personal skills): `Control/user/skills/<name>`
(personal), `Control/machines/<machine>/skills/<name>` (machine-generic —
brandkit, design-taste, …), `ProjectCentral/user/skills/` (project-scoped)
— the Control protocol's recursive one-law shape
(`docs/Control/…/CONTROL-CONTENT-PROTOCOL.md` §0–2: roots
`user/ agents/ machines/`, human-authored source canonical, durability
test). **Retirement** = standing `retired` on that ground with provenance
(Central's standing/treatment model already expresses this — see ground
inspect's provenance/standing/roles/treatment fields). **Projection** is
AIKit's alone: the ground directory registers as a machine-local skill
source (`aikit source add-directory`), sets select members per scope
(`aikit set`, `aikit project` bindings give per-project routing — "the same
routing that makes ProjectCentral instances"), and only active skills
project (`OI-INHABITATION-FOUNDATIONS §3`: projection = inclusion, masking
= disable, no second catalogue). Retired standing never projects.

| unit | owner | operation | walk |
|---|---|---|---|
| **K1 Control skills protocol** | Central | extend the Control content protocol with the skills section: scopes, retirement standing, durability test application to skills; ground-reading discloses the skill surface (`ctrl` reads skills as ground sources with standing) | a skill authored under Control is disclosed by inspection with correct scope/standing; a retired skill is disclosed retired, never projected |
| **K2 retirement-aware source** | ai-kit | machine-local skill source backed by Control ground honors standing (retired ⇒ withheld, with reason in `set show`); per-project routing through ProjectCentral bindings | `aikit set show` lists a retired member as withheld-retired; per-project set projects only that project's scope |
| **K3 machine migration** | machine | `aikit adopt ~/.agents/skills` → content lands in Control ground with provenance; superpowers returns from `skills-archive` as ground with standing `retired` (first retirement record); projections rebuilt from ground; `~/.agents/skills` becomes a derived projection path only | every former master skill traceable to ground; `~/.claude/skills` + `~/.codex/skills` rebuilt by projection, zero hand-edits; superpowers visible as retired, projecting nowhere |
| **K4 O:I projection cutover** | O:I | drop the interim manual projection of `cradle-execution` (map §9 D13 endgame): the repo skill is the native source, projected through AIKit like every other product skill | a fresh harness session sees cradle-execution via projection; the `~/.claude/skills/cradle-execution` copy is generated, verifiable against the repo source |

Order: K1 → K2 → K3 → K4. K1/K2 are product increments under law 5
(map §1): owned by their products, walked in their own harnesses.

---

## 7. Gate

The programme closes when:

1. all seven repos: main pushed, zero unpushed commits;
2. branch count = main + explicitly-kept-live branches only, each carrying a
   ledgered reason;
3. quarry knowledge committed and cited by the relevant map/fog rows;
4. skills: zero masters in projection paths; retirement records exist;
   projections reproducible from ground;
5. `suite-git-audit` (N1) runs green across all repos and is wired into the
   phase-gate checklist (law 13).

Then P1 opens `cradle-p1` per the phase loop.

---

## 8. Records

Ledger: `.superpowers/sdd/normalisation/progress.md` (created by N1).
Quarry: `quarry/` in this repo. This doc is the plan of record; rulings that
change it are ledgered, never silently edited.
