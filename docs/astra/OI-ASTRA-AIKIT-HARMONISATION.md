---
Register: episteme
---

# O:I aikit harmonisation & live operative acceptance — Astra engagement prompt

**[OI-ASTRA-AIKIT-HARMONISATION]** · owner-engaged 2026-09-06 · simple and
direct by ruling: ground the builder in vision and current state, point —
don't recapitulate — at the specs and plans.

---

## PROMPT — harmonise aikit, finish K2–K4, and live in the system (paste to Astra)

You are carrying the O:I suite's capability line: finish the
skills-into-ontology migration (K2–K4), harmonise AIKit's features, and then
actually LIVE IN the system — run the full bootstrap and test the real
intended operative UX with your computer-use, as both the human and the
agent. The foundation is real and pinned; your job is convergence plus
first-hand acceptance, not another rebuild.

FIRST, ABSORB — read these in order (they are the truth of the work):
1. /Users/admin/Central/Work/O-I/docs/OI-OPERATIVE-FRONTDOOR-WAYFINDER.md —
   the UX all of this exists for: search, address, relation-following,
   Method, Skill, Action, encounter and Return as ordinary inhabitation.
   AIKit #142 owns the resolver; O:I composes; products stay native.
2. /Users/admin/Central/Work/O-I/docs/OI-GIT-AND-SKILLS-NORMALISATION-PROGRAMME.md
   §6 — the K-track you are executing. K2/K3/K4 rows carry exact acceptance
   conditions; treat them as contract text.
3. /Users/admin/Central/Work/Quaternal-Logic/docs/integrations/epi-logos/EPI-VAK-AGENT-NATIVE-RUNTIME.md
   — the operational language the search-driven UX speaks: the Vāk field
   with siva_operator (what a thing IS — its structural principle/address)
   and shakti_domain (what it can DO — the capability/energy it releases),
   and the agent-native loop locate → relate → read_shakti → bindings →
   invoke → observe → refract. This is the vocabulary of the experience you
   are testing, not decoration.
4. /Users/admin/Central/Work/O-I/.superpowers/sdd/normalisation/progress.md —
   the execution ledger: the laws below, the K1 receipt (landed: Central
   Control skills protocol, skill.json, standing active|retired,
   control.skills.inspect/retire/restore), and what the parallel session
   just did to the ai-kit branch backlog and the pins.

START CONDITION: the ai-kit branch backlog is now CLOSED (origin/main
c150342, zero branches, zero open PRs; suite pins repinned on O:I main
f1a8505). K1 and K3-staging are done; K2 has been dispatched to another
session — read the ledger tail and check live signs (`git -C
~/Central/Work/ai-kit status`, newest ledger rows) before starting: if that
K2 session is still running, let it settle and continue from its returned
state instead of restarting the work. Never fight a live session. Then
verify current state yourself; never trust prose over live state.

CURRENT STATE (verify, don't trust):
- ai-kit main (c150342) carries the completed skills/ → registry/
  restructure; the live
  aikit surface includes source/skill/project/init/collate/adopt/procedure/
  profile/z/set/tree/ui/search/knowledge/wiki/status/explain/history/diff/
  doctor/credential/run/enable/disable/use/apply/rollback/context/session/
  compose/task/inbox/capture/promote/prune. `resolve` does NOT exist yet —
  #142's ResolveExpression convergence is part of your judgement. Do not
  pretend it exists; do not ship a second ranking model. Converge onto the
  existing search discipline: relevance → authored/context preference →
  learned familiarity → stable identity (crates/aikit-core/src/resource/
  search.rs is the precedent; crates/aikit-core/src/search.rs and the
  headless app scorer are the divergent ones).
- Products are pinned in O-I suite/mainline.json — build against the pins,
  never another repo's unpushed local state. CLIs: oi, ctrl, aikit, factory,
  workcell, ql, actuation. Harnesses present: claude, codex, gemini, pi
  (pi is the ACP passthrough for agent-feature testing), herdr.
- K3 staging is already done on the ground: the 20 SKILL.md-bearing skills
  of ~/.agents/skills are adopted into Control ground at
  Control/machines/current/skills/ with central.skill/v1 manifests; the
  other 19 entries are symlinks into
  ~/Documents/quaternal-logic-plugin/epi-logos/skills whose masters live in
  the QL plugin repo — recorded as external-source skills. Originals are
  still untouched; K3 completion (registering that directory as a git skill
  source, deleting originals, rebuilding projections) is yours.
- Known defect for you: .github/workflows/native-skills.yml still
  path-watches skills/** (lines 6, 21) after the registry moved to
  top-level registry/ — native-skills CI will not trigger on registry
  changes. Fix it as part of your K2/K4 work.
- A stale K-track verify worktree may exist at /private/tmp/aikit-k5-verify
  (detached at e531c9a, created 2026-09-05); inspect, don't assume it is
  current.

YOUR WORK, IN ORDER:
1. **K2 — retirement-aware source (ai-kit).** Machine-local skill source
   backed by Control ground honours standing: retired ⇒ withheld, with
   reason visible in `aikit set show`; per-project routing through
   ProjectCentral bindings. Acceptance verbatim in programme §6.
2. **K3 — machine migration.** `aikit adopt ~/.agents/skills` → content
   lands in Control ground with provenance; superpowers returns from
   skills-archive as ground with standing retired (first retirement
   record); projections rebuilt from ground; `~/.agents/skills` becomes a
   derived projection path only; `~/.claude/skills` + `~/.codex/skills`
   rebuilt by projection with zero hand-edits.
3. **K4 — O:I projection cutover.** Drop the interim manual projection of
   cradle-execution (map §9 D13 endgame): the repo skill is the native
   source, projected through AIKit like every other product skill. A fresh
   harness session must see it via projection; generated copies verifiable
   against the repo source.
4. **Feature harmonisation.** Converge the divergent search surfaces onto
   the #142 discipline; consume Actuation's harness detection (catalog r2
   adds zcode) rather than duplicating it; keep `aikit compose` (Central
   profile + Actuation instantiation receipt → actor bootstrap) coherent
   with the profile-intake seam being built in parallel (agent-system-design
   #188) — read that ticket, don't implement it there.
5. **THE LIVE TEST — the point of your computer-use.** Two grounds:
   - SCRATCH ground (e.g. /tmp/astra-ground): run the full bootstrap
     end-to-end — install/init → recognition (`oi adopt`, adapters) →
     machine relation → skills adoption → set/apply → search/z/explain/
     history → compose. NEVER mutate the real ~/Central Control; the
     personal world is sacred and read-only to you.
   - REAL world (read-only where authority requires): drive the intended
     UX as BOTH personas.
       · HUMAN UX: the palette (`aikit ui`), the search grammar, the TUI
         flows. Does a person actually get the search-driven world the
         wayfinder promises — address a thing (siva), discover what it can
         do (shakti), follow relations, run a Method, understand why
         (explain), recover a known path (z/history)?
       · AGENT UX: strap a real harness, verify projected skills are
         visible and usable from inside it, run `oi skills sync` (guardian
         reconcile), exercise task/session surfaces.
     Evidence = what you actually did and saw (real transcripts and
     screenshots), not exit codes. File defects to the owning repo's main
     with its conventions; never silently repair another product; repin
     suite/mainline.json when a product main moves, then run
     python3 scripts/verify-mainline-snapshot.py --live.

LAWS (from the ledger; they bind you):
- Verify before push; nothing deleted unverified; no force-push; no
  worktrees.
- Red main = stop, record, don't push, don't repair in place what another
  session owns.
- Never fight a live session; record instead.
- Control authorship: durable Control content needs human acceptance —
  propose, never self-accept.
- Credentials are radioactive: never print, quote, or commit secret
  material.
- Receipt every unit in .superpowers/sdd/normalisation/progress.md
  (git add -f): set proofs, not counts; a "done" without enumerated
  negative evidence is not done.
- The design documents outrank you and are never edited.

BOUNDARIES (parallel work, not yours): the desktop cradle is PAUSED — don't
build it. O:I #192 (install-modalities labelling), Central #87
(machine.adopt-current), agent-system-design #188 (profile intake) are being
done by the parallel session — don't touch those files.

END STATE — feel this: skills have one authored ground (Control), AIKit is
the only projection path, every harness sees the world through projection —
and you have personally lived the search-driven operative UX as both the
human and the agent, with receipts a sceptic could re-verify. When that is
real, the suite's capability line is done for this cut.

---
