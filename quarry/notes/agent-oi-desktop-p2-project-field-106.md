# agent/oi-desktop-p2-project-field-106

`origin/agent/oi-desktop-p2-project-field-106` @ 325117e (2026-08-24) ·
104 commits · Class A QUARRY-DESKTOP (§3) · =
`feat/living-wiki-desktop-135` + one merge (`[LIVING-WIKI] Merge
change-aware workbench composition (#136)`). Contract of record already on
main: `docs/OI-DESKTOP-P2-PROJECT-FIELD-CONTRACT.md`.

## What it is

The P2 "project field" desktop: a project workbench that composes
ProjectCentral ground, AIKit knowledge readings, and the P1 shell selection
into one three-layer surface, plus the living-wiki composition from #135.
Its distinctive content is the **project field ontology discipline** — what
classes of thing may appear in a project view and what the desktop may NOT
own — encoded in `project-field.tsx` presentation tests as literal UI law.

## Feature/function inventory

- **Project field composition** — `desktop/core/src/project_field.rs`:
  `LocalProjectField::discover` builds `ProjectFieldSnapshot` from
  `NativeOwnerReading`s + `ProjectMapStatus`; methods `search_sources`,
  `read_source`, `explain_source`, `reflection` — all delegating to
  ProjectCentral/AIKit, never fabricating a tree.
- **Local project knowledge service** — `desktop/core/src/project_knowledge.rs`
  (490 lines): `LocalProjectKnowledge` exposes `living_status`,
  `living_preflight`, `flow_preflight`, `flow_contemplate`, `contemplate`,
  `search`, `read`, `relations`, `explain`, `history` — the full knowledge
  aperture surface over ProjectCentral binding + SemanticWiki index +
  FamiliarityContext + KnowledgeApplicationStore.
- **Source-class honesty (UX law)** —
  `desktop/ui/src/project-field-presentation.test.mjs`:
  `assert.match(projectFieldComposition, /Human-authored Ground/)`,
  `/Agent Wiki \/ Knowledge/`, `/NOW \/ DAY · temporal material/`,
  and `/Location alone is not authority/`… (actual string:
  "Location alone is not authorship"); `DesktopWiki` must not exist.
- **Selection/retrieval/disclosure separation** — same test:
  `/selection does not retrieve/`, `/Agent Context unchanged/`;
  core: `RetrievalTarget::Human`, `selected != retrieved`,
  `retrieved != disclosed-into-agent-context`; knowledge module:
  "Selection itself never calls" (an owner operation).
- **One selection, no second state** — `/P2 projects the one P1 canonical
  selection instead of owning a second selection state/`: workbench takes
  `selection` as a prop, `assert.doesNotMatch(workbench,
  /useState<WorkbenchSemanticRef/)`; navigator/canvas/living-wiki all
  consume the same prop.
- **CurrentWorld threading** — `assert.match(shell,
  /pub current_world: CurrentWorldReading/)`; main passes
  `currentWorld={snapshot.current_world}` — the navigator consumes the one
  ShellSnapshot CurrentWorld "without refetching or a machine model".
- **Workbench over native session spaces** —
  `desktop/ui/src/workbench-presentation.test.mjs`: workbench projects
  `aikit_session_spaces` / `aikit_session_space_read/focus`;
  `DesktopSessionSpace`, `OiSessionSpace`, `DesktopChat`, `model picker` all
  forbidden; AgentSession conversation inhabits Encounter via portal with
  `agent_surface_open/send/cancel` and `binding.native_session_id`.

## Map-unit mapping

- Project field snapshot + native-owner readings → **U1.1 Rooted-World
  navigator** (§5 P1): exactly the "renders Central's read models and
  fabricates no tree" row (§2.2).
- One-selection discipline + ShellSnapshot CurrentWorld → **U1.4 One global
  focus** (§5) and U1.5 workspace context.
- selected != retrieved != disclosed → **U3.2 Knowledge on selection**
  (§5 P3) aperture-discipline spec; search/read/relations/explain/history →
  **U3.1 Search/command aperture** row shape.
- NOW/DAY temporal material class → **U4.1**/#138 §2 Flow page semantics
  (W1.3).
- No model picker / no desktop session store → §1 laws 4/6 (no invented
  ontology; model selection harness-level).

## Quarry verdict

**KEEP-FOR-UNIT** — U1.1 + U1.4 (+ U3.1/U3.2 surface shape). The
presentation tests are concise, quotable UX law for the rebuild's navigator
and aperture; re-derive under the cradle contract, prove by walk.
