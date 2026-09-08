# 06 — System Settings surface

*UX design for the cradle's system surface: from census registry to the
working control room of the world. Supplements `01-DESIGN.md` (position),
`03-UX-STATES.md` (states), `05-EXECUTION.md` (walks are the acceptance).*

---

## 1. Position

Today's System surface (`src/workspace/SystemPanel.tsx`) is an honest census:
six product positions, availability, raw native records. It answers "what is
installed?" and deliberately refuses to answer anything else. That honesty is
load-bearing and stays.

This design grows the same surface into **the place the world is read,
configured, and maintained** — the settings page of the whole O:I world. Not
a UI skin over a registry: a projection of each product's *functional world*
(what it does here) and *configurational matter* (what is set, where it was
set, what is running) into one surface, with engagement crossing the owner
seam only where the owner discloses an operation.

The design serves four user needs, in this order of primacy:

1. **Is my world healthy?** — one glance: composition census, doctor/verify,
   drift. (maintenance)
2. **What is running, and where?** — instances, sessions, actors, receipts.
   (activity)
3. **What is configured, and by whom?** — authored / effective / active
   configuration with owner refs. (configuration)
4. **What can I do about it?** — only what owners disclose. (engagement)

Bootstrap is not a separate wizard bolted on: it is this same surface in
**empty-world state** (§6.2). Install, first-run configuration, and
day-2 maintenance are the same page reading different world states. This is
what makes the design do triple duty for bootstrap / install / maintenance
flows without forking the UX.

## 2. Law

Carried from the cradle's existing law, plus settings-specific additions:

- **L1 — Discovered ≠ ready.** Installation is discovery, never runtime
  readiness (BOOT-06/12). Every availability label keeps the honest form:
  `discovered — not verified ready`. Registration never stands in for
  health.
- **L2 — Owner refs on every value.** No value appears without its
  provenance: which owner disclosed it, and when observed. The observed-at
  stamp is freshness, never owner-carried revision (composition.rs law).
- **L3 — Empty is proof, not failure.** A product section with no disclosed
  settings and no disclosed actions renders its emptiness honestly. Nothing
  is fabricated to fill space (law 4 / D15 menu law, applied to settings).
- **L4 — Writes cross the owner seam only.** A setting is mutable in this
  surface only when the owner discloses a mutation operation. Otherwise the
  setting is read-only here and names its native path ("set through
  `aikit profile`"). The cradle never reaches past an owner to edit its
  state.
- **L5 — Disclosure cleanliness.** The primary surface is human-readable:
  sections, values, provenance. Raw records stay behind an explicit
  `<details>`-grade disclosure for the integrator — never the main view.
- **L6 — The descriptor is product-owned.** Each product authors its own
  settings disclosure (schema in §4). The cradle only projects. Adding a
  section or setting to a product never requires cradle code changes — this
  is what "easy to update and refine" means structurally.

## 3. The world model

Seven positions: the O:I composition layer itself plus the six products.
For each: functional world (what it does in this world — disclosure-grade,
not marketing), configurational matter (the settings axes), live activity,
and today's engagement seam.

### 3.1 O:I — the composition layer (`oi`)

- **Functional world.** Installs, verifies, and doctored the suite; pins the
  manifest; adopts dev trees; updates; cleans the managed root. The world-
  keeper.
- **Configuration.** Personal ground binding (GroundChooser graduates
  here); managed root location; manifest pin set (per-product revision +
  artifact + sha256 + attestation — the freeze contract); suite channel.
- **Live activity.** Install receipts, verify/doctor results, drift
  between pinned and live.
- **Engagement today.** Read-only in the kernel (`composition_read`).
  Native engagement lives in the `oi` CLI (install / verify / doctor /
  update / cleanup). Settings-page engagement arrives when O:I discloses
  ops through the seam.

### 3.2 Central — the ground

- **Functional world.** The personal ground: ctrl Actions (NOW returns,
  rollover, promote, world/search/open/work lists, doctor), wiki returns
  through the promotion path, day-close law, governance.
- **Configuration.** Active ground path (authored vs effective); project
  registers and their NOW fields; day-close policy; profile selection.
- **Live activity.** Open returns, today's field state, doctor findings.
- **Engagement today.** Strongest seam of the six: ground ops, knowledge
  reads, file/source read-edit-save with CAS and receipts. The pattern the
  others should meet.

### 3.3 AIKit — resolution & composition

- **Functional world.** The resolution chain: sources (pinned skill repos)
  → skill → set → tree → profile → apply → session topology → compose.
  `aikit explain` audits the chain. Owns none of models/harnesses/session
  tools — resolves them.
- **Configuration.** `AIKIT_HOME`; skill sources and their revision pins;
  skill-sets and the harnesses they point at; profiles and project lenses;
  session providers (tmux / herdr / cmux / plain / stack); model provider
  credentials (presence, never values).
- **Live activity.** SessionSpace topology per project; provider census;
  working-environment bindings.
- **Engagement today.** `agency_read` + encounter providers (reads).
  Session up/attach/down are native CLI ops not yet disclosed through the
  gateway — named honestly as missing obligations, exactly as the current
  Agency Gateway section does.

### 3.4 Software Factory — build & trace

- **Functional world.** Bindings per project; intents and invocations;
  sessions and traces. Already projected into the cradle as the
  BuildSurface contribution.
- **Configuration.** Project bindings; build/test contracts.
- **Live activity.** Sessions, spans, trace waterfalls.
- **Engagement today.** The only product with full actuation through the
  seam: `factory_discover / snapshot / intent / invoke`. **This is the
  reference pattern every other product's engagement should meet** — the
  settings page generalizes it (§5).

### 3.5 Workcell — demand & placement

- **Functional world.** The demand contract (affordances, not offer refs);
  lifecycle plan → prepare → observe → collect → release; instances
  registry (M1/M2: registry model + live scanner).
- **Configuration.** `WORKCELL_HOME`; instance registry; worlds/sandboxes;
  placement policy.
- **Live activity.** Instances (pid-live), world receipts, scanner output.
- **Engagement today.** `material_read` only. Lifecycle ops are native CLI;
  the registry dovetail (workcell entry + Actuation receipt + ai-kit
  topology = one instance fact, three views) is the projection log the
  activity rail renders.

### 3.6 Actuation — agency

- **Functional world.** Actor bootstrap; instantiation receipts; ecology.
- **Configuration.** Actor definitions; ecology bindings; stream policies.
- **Live activity.** Instantiated actors, receipts.
- **Engagement today.** None through the seam. The current surface already
  names the missing native obligations — ecology read, attach, stream
  cursor/replay. The settings page renders these as an honest, dated
  absence (L3), not as disabled fake buttons.

### 3.7 Quaternal Logic — the field

- **Functional world.** QL coordinates, positions, lenses — the symbolic
  register of the world.
- **Configuration / activity / engagement.** No kernel seam today; the
  product appears in the census only. The section renders census + honest
  absence until QL discloses.

### 3.8 Engagement-seam summary

| product | reads | writes/acts | today |
|---|---|---|---|
| O:I | composition census | — | read-only |
| Central | ground/knowledge/files/sources | source save, ctrl acts | full |
| AIKit | agency, providers | — | read-only |
| Factory | bindings, snapshots | intent, invoke | full |
| Workcell | material | — | read-only |
| Actuation | — | — | none (obligations named) |
| QL | — | — | none |

The asymmetry is real and stays visible. The page's credibility comes from
showing it, not hiding it.

## 4. The disclosure contract

Each product discloses its settings surface as data. The cradle projects;
it never authors product configuration (L6).

### 4.1 Settings descriptor

```json
{
  "schema": "oi.product-settings-disclosure/v1",
  "product_id": "ai-kit",
  "disclosed_at_unix_ms": 1757324400000,
  "about": "Resolution and composition layer: sources → skills → sets → profiles → sessions.",
  "sections": [
    {
      "id": "resolution",
      "title": "Resolution chain",
      "settings": [
        {
          "key": "sources.pins",
          "title": "Skill source pins",
          "kind": "table",
          "axes": {
            "authored": {"source_count": 12},
            "effective": {"source_count": 12, "owner_ref": "aikit sources list"},
            "active": {"source_count": 12, "owner_ref": "aikit tree apply receipt"}
          },
          "mutable": false,
          "native_path": "aikit sources / aikit set"
        }
      ]
    }
  ],
  "actions": [
    {
      "action_ref": "aikit.session.attach",
      "title": "Attach to session",
      "args": [{"name": "space_ref", "kind": "string"}],
      "availability": "missing_native_obligation"
    }
  ]
}
```

### 4.2 The configuration axes

Three axes, always distinguished — this is the core of "configurational
matter" vs a registry:

- **authored** — what the human wrote (config files, pins, policy).
- **effective** — what the product actually resolved (with owner ref).
- **active** — what is running right now (with owner ref / receipt).

A setting where all three agree still shows all three — the agreement is
the information. A setting where they diverge is a **drift** and renders
as the page's primary maintenance signal (§6.3).

### 4.3 Setting kinds

`scalar` (string/bool/number/path), `select` (disclosed options),
`table` (rows with provenance), `presence` (credential/env presence —
never values), `reference` (a ref to another product's disclosed entity,
e.g. a Workcell instance bound to an Actuation receipt). New kinds extend
the schema version; the projection degrades to raw-with-label on unknown
kinds rather than dropping them.

### 4.4 Action disclosure

Actions carry `action_ref`, args, and `availability`:
`disclosed` (callable), `missing_native_obligation` (named, not callable —
renders as obligation, never as a disabled button), or `unavailable`
(owner said why). L3 applies: an empty `actions` array renders emptiness.

### 4.5 Source today

Until each product ships its descriptor natively, the page composes the
*projection* from what the kernel already reads (composition census,
agency, factory bindings, ground) and marks every composed section
`provenance: cradle-composed` — visibly cheaper than a native disclosure,
never passed off as one. Native disclosures replace composition one product
at a time; the page does not change when they do (L6).

## 5. Engagement model

Generalized from the Factory seam, which is the working proof:

```
descriptor discloses action → surface renders it → invoke crosses the
owner seam via the kernel op → owner executes natively → receipts return →
surface shows the receipt, not a simulation
```

- One kernel op shape per product family: `{product}_intent` (dry-run /
  what-would-happen) and `{product}_invoke` (act), as Factory already has.
- Every invoke returns receipts; the surface shows the receipt (revision,
  ids, observed-at) — the Factory BuildSurface is the visual precedent.
- Intents are how the page stays safe: every action's confirmation shows
  the intent's disclosed effect before invoke.
- Where no ops are disclosed, the section's action area renders the named
  obligations (Actuation today) or nothing (QL today).

## 6. Page architecture

### 6.1 Steady state

```
┌────────────────────────────────────────────────────────────┐
│ WORLD HEADER                                               │
│ ground: ~/Central (authored=effective)  suite: pre-local.2 │
│ health: doctor PASS · 6/6 discovered · drift: 0 · observed │
├──────────────┬─────────────────────────────────────────────┤
│ RAIL         │ PRODUCT SECTION (one of seven)              │
│ · Health     │ ┌─────────────────────────────────────────┐ │
│ · Activity   │ │ Central                    [discovered] │ │
│ · Config     │ │ The personal ground: ctrl actions,      │ │
│ · Bootstrap  │ │ wiki returns, day-close.                │ │
│              │ │                                         │ │
│ (needs, not  │ │ CONFIGURATION                           │ │
│  products —  │ │ Ground    ~/Central  a=e ✓ owner:ctrl   │ │
│  sections    │ │ Profiles  default    a=e ✓ owner:ctrl   │ │
│  nest under  │ │                                         │ │
│  needs)      │ │ ACTIVITY                                │ │
│              │ │ 3 open returns · today live             │ │
│              │ │                                         │ │
│              │ │ ACTIONS                                 │ │
│              │ │ · Doctor (ctrl)                         │ │
│              │ │ · Day close…                            │ │
│              │ └─────────────────────────────────────────┘ │
│              │ raw record ▸ (details-grade disclosure)     │
└──────────────┴─────────────────────────────────────────────┘
```

- **World header** — always visible: ground binding with authored/effective
  check, suite identity, health aggregate, drift count, observed-at.
- **Rail** — the four needs (Health / Activity / Config / Bootstrap). Each
  product section nests under the need it primarily serves, so the page
  answers "is my world ok?" before "what can I tweak?". Rail selection
  filters sections; default is Health.
- **Product section template** (uniform across all seven):
  header (name, availability chip with L1 label, version) → about
  (disclosure-grade functional summary, 2–3 lines) → Configuration →
  Activity → Actions → raw record behind disclosure (L5).
- Empty sections are honest (L3): QL renders census + absence; Actuation
  renders census + its named obligations.

### 6.2 Bootstrap state (empty world)

Same page, world header replaced by the bootstrap banner: no products
discovered, ground unbound. The Config and Activity rails are empty by
fact; **Bootstrap** becomes the rail:

1. Bind the ground (Central first — it is the world-keeper's anchor).
2. Install the suite (`oi install` engagement — the first disclosed
   actions of the O:I section come alive here).
3. Verify (doctor/verify run; the health rail populates from nothing —
   each product's discovery is a visible event, not a spinner).
4. First-run configuration walk: only settings whose authored value is
   absent and whose owner marks them `bootstrap: true` surface here.

Bootstrap is finished by the same page, not by leaving it. Day-2
maintenance is §6.3.

### 6.3 Drift & maintenance state

The page's maintenance duty is drift surfacing (authored ≠ effective,
pinned ≠ live, discovered ≠ ready):

- **Drift rows** in the world header and per-section config: each drift
  names both sides with owner refs and offers the disclosed remediation
  action (e.g. re-apply profile, re-install to pin, adopt tree). No
  remediation disclosed → the drift renders with its native path, not a
  fake fix button.
- **Doctor/verify results** render as first-class health cards per
  product, with the failing command and stderr kept behind disclosure.
- **Observed-at discipline**: every reading carries its stamp; staleness
  beyond the reading's own freshness policy renders as "last read N min
  ago — refresh", never as silently cached truth.

### 6.4 Degraded states

Owner executable missing/broken (the census `unavailable` state): section
renders with its last-known configuration marked stale, the native error
behind disclosure, and engagement removed — not greyed fake controls. A
product disappearing degrades only its relations (provider law): other
sections stay live.

## 7. Verification — the walk is the acceptance

Prose establishes no UX condition (`05-EXECUTION.md` §3). The extension of
`walk/scenarios/system.mjs` carries the acceptance:

| check | proves |
|---|---|
| Seven sections render (OI + six), census-backed | IA completeness |
| Every availability chip uses the L1 honest label | L1 |
| Every config value carries provenance (owner ref + observed-at) | L2 |
| Actuation section shows its obligations as obligations; QL shows absence | L3 |
| No mutable control renders where the descriptor says `mutable: false` | L4 |
| Primary view contains no raw JSON; raw records sit behind disclosure | L5 |
| Adding a section to a fixture descriptor changes the page with no cradle code change | L6 |
| Bootstrap state (empty fixture world) drives the full install sequence | §6.2 |
| Drift fixture renders both sides with refs and the disclosed remediation | §6.3 |
| Factory action runs intent→invoke→receipt through the seam | §5 |

Receipts + screenshots land in `walk/artifacts/` per existing law.

## 8. Phasing

- **P0 — this design + descriptor schema** (`oi.product-settings-disclosure/v1`)
  and fixture worlds (steady / empty / drifted) for the walk. No product
  code changes.
- **P1 — cradle projection.** SystemPanel restructured into the §6
  architecture over *existing* kernel reads only, cradle-composed
  provenance marked. Walk checks for L1–L5 land. The page is informative
  and honest before it is powerful.
- **P2 — native disclosures.** Each product ships its descriptor (product-
  repo work, one at a time): Central → AIKit → Workcell → O:I → Actuation
  → QL, ordered by seam maturity. Cradle code does not change per product
  (L6) — only the walk gains a check per native disclosure.
- **P3 — engagement.** Intent/invoke ops disclosed per product following
  the Factory pattern; bootstrap flow activates; maintenance remediations
  go live. Ordered by user need: install/verify (O:I) → session attach
  (AIKit) → lifecycle (Workcell) → ecology/attach/stream (Actuation).

Dependencies are explicit: P1 needs only P0; each P2 item needs only P1
plus that product's owner-side descriptor; each P3 item needs its P2
descriptor. Nothing blocks P1 except this design's acceptance.
