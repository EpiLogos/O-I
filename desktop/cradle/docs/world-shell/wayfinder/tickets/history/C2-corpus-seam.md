# C2 — Corpus-neutral seam for the atlas port

Label: wayfinder:research (AFK)
Claimed-by: zcode:corpus-seam-c2 (dispatched by orchestrator zcode:world-shell-orchestrator, 9 Oct)

## Resolution — 2026-10-09 (zcode:corpus-seam-c2, converged by orchestrator)

Delivered `wayfinder/C2-CORPUS-SEAM.md` (413 lines). The seam is four
published contracts (field.json / history.json / corpus/ / symbols.json;
sky already non-corpus via the ephemeris sidecar — the multi-provider pattern
is proven in-repo). `CorpusProvider` = {id, name, field, images, history?,
corpus?, symbols?, ties?}; graph nodes/edges are derived (build.ts:70-160) —
the provider supplies five relations; liveness is derived, never supplied.
Amended `Occurrence` drops two corpus-named fields (`subject` unread,
`jung` → `cites`), adds `subject_ref?`, restates the lat/lon convention as
law. Every consumption site checked individually — no field the code reads
is uncovered; `locusType/subject/yearRange/occurrenceCount/subtype/synthesised`
declared but unread (providers may omit).

Amendment list: 28 — (a) 7 provider-shaped seams, (b) 14 hardcoded corpus
constants (TieBasis 'jung' literals, 'self' archetype slug, JUNG_AQUARIAN
event ids, Jung-labelled UI strings, hardcoded planet list), (c) 7
corpus-structure logic sites kept with named degradations + one honesty
guard to add (unplaced occurrences currently fly to 0,0). Vault slots back
as `providers/jung/` publishing today's ingest/curation set against the
amended contract; zero vault bytes in the atlas.

**Load-bearing correction:** the atlas HEAD is `fbdb9e9`, 19 commits past
the map's recorded `932b360` — L5 must re-diff `932b360..HEAD` before the
verbatim move (§0 of the deliverable). Static reading only; the executable
proof is L5's non-Jung fixture corpus (seed: `src/dev/fixture.ts`).

**Errata (L5 at its re-pin `606fbe6`, 9 Oct):** the amendment list was
computed partly against the curation lane's dirty working tree. The
corpus-passage trio C2 cited (`src/types/corpus.ts`, `src/data/corpus.ts`,
`src/ui/passage.ts` — amendment a3) is **untracked material, not in HEAD**;
at any pinned HEAD the site may be absent. Consumers record site-absent at
their own pin and carry the optional `corpus` bundle slot in the provider
interface so the trio slots in when the curation lane lands it. Verify
site existence at your pin for every amendment entry; L5 is the first
consumer and handled a3 exactly this way (endorsed by the orchestrator).
Status: resolved (C1 outstanding on L5's Blocked-by).
Blocked-by: —

## Question

How does `src/types/field.ts` (and the ingest/curation assumptions behind it)
generalise to a corpus-neutral binding contract, so the port carries **no Jung
corpus** and any corpus becomes a provider?

Deliverables:
- The binding contract proposal: what a corpus provider must supply
  (occurrences with place/time/image/subject_ref; families; graph nodes and
  edges; aion epochs; liveness; image refs).
- The amendment list: every site in the atlas code that hardcodes corpus
  assumptions and must be *amended* (not remade) — file:line, with the
  minimal change.
- Where the Jung vault slots back in as one provider.

## Evidence / acceptance

Contract proposal checked against the real consumption sites in globe/graph/
aion/state code. Amendment list with file:line. No code changed in this
ticket — it prepares L5 (Earth/Graph/Aion port).
