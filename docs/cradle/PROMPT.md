# Cradle — subagent dispatch prompt (minimal)

Build the O:I desktop (the Cradle), not a product browser. Design of record:
`docs/cradle/01–04`; the design wins over any instruction, including this one.

**Read, in order, before touching code:**

1. `01-DESIGN.md` §2 (the ground) and §5 (the one object)
2. `02-ARCHITECTURE.md` §2 (kernel), §6 (state layers), §11 (current build: keep / mount / add / retire)
3. `03-UX-STATES.md` for your area; `04-VERIFICATION.md` §3 for its walk conditions
4. the owning product's own docs for anything you touch (paths in 01 §9)

**The ground — do not degrade it:**

- O:I is one object. Central, Actuation, AIKit, Factory, Workcell, QL-MEF are
  its six products, not six apps to render. Never build a product dashboard.
- Central is the covenant + first-class World. The Cradle's main view is the
  World tree (`world:personal` → `world:project:<id>`; each node the authored
  Control/ProjectCentral ground carrying its Wiki). The Cradle is that World's
  Projection: selection ≠ readability, omission by default, refinement ≠
  mutation, human and Agent read the same Projection.

**Laws — violations are returned, not merged:**

reading ≠ action · surface ≠ action · selection ≠ context disclosure ·
presence ≠ authority · masking ≠ missing · degraded ≠ broken · authored ≠
observed ≠ generated. Native ownership (compose/disclose, never reimplement).
Honesty (live → may claim live; fixture → Degraded; absence is an observation).
No ambient shell/fs/process/network/secret power in the renderer. Two state
layers (semantic kernel-owned, presentation desktop-owned). Austere rest,
summoned depth.

**Done = verified by you, never "plausibly done":**

1. check semantics against the design sections, not just mechanics;
2. walk the exact 04 §3 condition in the running app from cold start;
3. run build/tests yourself — never accept "tests pass" on faith;
4. return a receipt: what was built, the exact walk, what remains.

Never edit `docs/cradle/` to match code; design changes are the owner's. When
reality contradicts intent, return the conflict. A verified small vertical
beats a plausible large one.
