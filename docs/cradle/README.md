# Cradle — desktop design and architecture

The design and architecture of the O:I desktop application: the Cradle.

This set locks the intent of the desktop into durable documentation. It is
written from the founding positions and the native product visions of the six
centres — from what the system is *for*.

## Reading order

| Document | What it fixes |
|---|---|
| [01-DESIGN.md](01-DESIGN.md) | What the Cradle is, the human experience it serves, and the native intents it is bound to. |
| [02-ARCHITECTURE.md](02-ARCHITECTURE.md) | The application kernel, services, seams, state layers, events and focus model. |
| [03-UX-STATES.md](03-UX-STATES.md) | The complete UX state space, each state derived from intent. |
| [04-VERIFICATION.md](04-VERIFICATION.md) | What is true when the design exists — the conditions the app meets, and the build order. |
| [05-EXECUTION.md](05-EXECUTION.md) | The standing injunction for the orchestrator and subagents doing the development work. |
| [PROMPT.md](PROMPT.md) | The minimal dispatch prompt to hand a subagent at the start of a vertical. |

## Provenance class

These documents are **authored design and architecture commitments**, not
implementation facts. Per the provenance discipline (`docs/positions/FOUNDING-POSITIONS.md`
§5′): authored position → vision → design → architecture → implementation →
encounter → return. Claims about what exists today are made only in
02-ARCHITECTURE §11 (current build disposition).

Upstream sources this set derives from and must not contradict:

- `docs/positions/FOUNDING-POSITIONS.md` — authored positions
- `docs/VISION.md`, `docs/ARCHITECTURE.md`, `docs/FLOW.md`, `docs/SHARED-FIELD.md`
- O:I issues #97 (convergence cut), #103 (desktop programme), #154 (Agency
  Gateway), #155 (recursive Worlds, AgentSets, Journeys, Activity, Session
  Observatory), #158/#159 (Composable Inhabitation, Omarchy), #166 (Grok Bot
  case study)
- The native visions of the six centres in their own repositories

## Relation to the earlier desktop documents

The `OI-DESKTOP-*` contracts (P1–P4) and surface ledgers remain in `docs/` as
the implementation history of the earlier desktop work. This set is the design
and architecture of record going forward. Two laws hold across the whole
system:

1. **Authority law.** Reading ≠ Action. Surface ≠ Action. UI selection ≠ Agent
   Context disclosure. Presence ≠ authority. Masking ≠ missing.
2. **Native ownership.** The desktop composes and discloses; it never
   reimplements a product's semantics.
3. **Projection law.** The Cradle is a selected, provenance-preserving reading
   of the Central authored world — not a copy, not a profile database.
   Selection ≠ readability (omission is the default); refinement changes the
   Projection, never the source; a change returns to durable Central source
   only through explicit human authorship or an accepted proposal; human and
   Agent read the same Projection ref and revision.
