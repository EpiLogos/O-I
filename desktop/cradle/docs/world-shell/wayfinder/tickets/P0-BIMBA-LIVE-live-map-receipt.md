# P0-BIMBA-LIVE — Read the live Bimba map and keep the receipt for every headline the vision binds

Label: wayfinder:task (Phase 0, conductor, read-only)
Claimed-by: —
Blocked-by: — (operational: oi-omarchy reachable on the tailnet, container
`bimba-neo4j`, HTTP :7474; CTRL/user/skills/bimba-graph/SKILL.md)
Source: DLW-VISION.md standing note on kernel cites (:71-82) and §5.3 item 25
(:1311-1327).

Zones: a new evidence directory
`desktop/cradle/docs/world-shell/evidence/p0-bimba-live/` (the query script,
its raw output, the headline table). Cite corrections in DLW-VISION.md go
through P0-V1's zone, not here. **Never write the map**: the module exposes
write tools (`bimba_admin`, `bimba_sync`); this ticket uses only `health`,
`resolve_coordinate`, `neighborhood` and read-only `MATCH … RETURN` Cypher
through `cypher()` (CTRL/user/skills/bimba-graph/bimba_graph.py:57-107).

## Question

The vision binds builders to kernel headlines and says the live map is the
authority: "The live Bimba map (Neo4j) is the authority; where a spec or table
disagrees, the map wins" (LAW:19). The `BMAP/` files are a generated
reflection, "not crystallised canon" (DLW-VISION.md:71-73). DLW-VISION records
a read on 12 Oct 2026 through the owner's `bimba-graph` module (3713 nodes /
13880 relations) and cites it as "live Bimba map (queried 12 Oct 2026)"
(DLW-VISION.md:74-82). The design pack holds no receipt of that read: at
12 Oct, `grep -rl P0-BIMBA desktop/cradle/docs` finds only DLW-VISION.md.

Does the live map, read now, still hold every headline the vision binds? And
can any builder re-run the read and get the same answer? The map is "the score
being read while also being written" (SEEDS/epi-logos-kernel-spec.md:28), so
the read carries its date and the map's revision. A citation without them is
not reproducible.

Headlines to confirm, node and field as the vision cites them:

- **Origin-return.** M0 `c_1_primary_designation` ("The Ever-Present
  Origin"); M5-5 `q_5_mobius_writeback_reopens` ("As ἀνάλογος it completes the
  return"; deposit "through review and Hen vault-write into M0's bimba node");
  edges M5-5 `RETURNS_TO` M5-0, M5-5 `DEMONSTRATES_THROUGH_ETYMOLOGY` M4.4.4,
  M4.4.4.5 `RECEIVES_ETYMOLOGICAL_EVIDENCE` M5-5, M5-5 `ENABLES_PRACTICE` M4;
  M4.4.4 `c_0_essence` ("Reduction - excavating to constitutional origins");
  M4.4.0 ("Gebser Lens") (DLW-VISION.md:140-157, 443-471).
- **Nara as encounter.** M4 `c_0_core_nature`, `c_1_description`,
  `c_1_primary_designation` ("Oracle Interface Between Personal and Universal
  Domains"), `q_1_the_oracle_interface`, `q_4_individuation_threshold` ("not
  providing answers but midwifing recognition"), `q_5_dialogical_consummation`;
  edge M4 `INVERTS_TO` M4′; M4.2 `c_0_essence`, `c_1_key_principles`; the names
  of M4.0–M4.5 (DLW-VISION.md:161-171, 496-533, 1045-1058).
- **Epii as encounter.** M4.5-0…M4.5-5 names (Curriculum Map … Logos Cycle
  Engine) and M4.5-1's "pedagogical compassion" (DLW-VISION.md:546-552).
- **Agentic seam.** M5-4 `c_1_coordinate_role`, `HAS_INTERNAL_COMPONENT`
  M5-4.0…M5-4.5, `MEDIATES_PROTOCOL_LAYER` (DLW-VISION.md:394-404).
- **M′ names.** M5′'s children M5-2′ "Backend Studio", M5-3′ "Frontend
  Studio", M5-4′ "Agentic Control Room", and the absence of M5-0′, M5-1′ and
  M5-5′; M4′ and M5′ as bare prime nodes (DLW-VISION.md:1009-1031).
- **Defects the vision records.** The orphan dash nodes M4-0…M4-5 (ledgered
  `k2-grammar-nesting-threshold:#4`, `proposed`); `M4.3-2.0…M4.3-2.2` (a dot
  after a 2, no ledger record); M5-0/2/3/4 placeholder descriptions; unnamed
  M4.5.0…5 (DLW-VISION.md:964-980, 1320-1324).

## Sources

- CTRL/user/skills/bimba-graph/SKILL.md and `bimba_graph.py` (read functions
  only).
- QL/skills/ql-law/SKILL.md:19-31 (authority, grammar); LAW:75 (superseded
  spellings); QL/fixtures/kernel/m-ledger-v1.json (nesting-threshold records).
- DLW-VISION.md :71-82, §3 (:945-1136), §5.3 item 25.

## Acceptance

Exercised: the live map on oi-omarchy, read-only. Channel: `scripted` (a
Python script run with `python3 -I` against the module, its stdout kept
verbatim). No UI leg.

1. `evidence/p0-bimba-live/read.py` (read functions only; a grep of it finds
   no `CREATE`, `MERGE`, `SET`, `DELETE`, `bimba_admin` or `bimba_sync`) and
   `read.out` (raw output) are kept. The output opens with `health()`: node
   count, relation count, and the map revision (the skill names
   `q-semantic-v2-3072`, revision 12).
2. `headlines.md`: one row per headline above, with node, field or edge, the
   quoted value as returned, and `confirmed` | `diverged` | `absent`.
3. Each `diverged` or `absent` row names the DLW-VISION line that cites it.
   The map wins (LAW:19): the correction is carried into P0-V1, or into a
   follow-up the conductor names here.
4. `M4.3-2.0…M4.3-2.2` is sent to the QL owner as a map defect (DLW-VISION.md:978-980,
   1323-1324). The send is a ref recorded here: a QL issue or a NOW return,
   never an edit to the map or to the ledger fixture.
5. The run is dated. DLW-VISION's "(queried 12 Oct 2026)" stays as written
   where the headline is confirmed; the receipt adds the re-read's date.

## Open — not this ticket's to answer

Whether the orphan M4-0…M4-5 nodes are deleted is the QL owner's (the ledger
record is `proposed`). The Nara identity decisions D1, D3–D6 are
"draft-for-review" (QL/docs/NARA-IDENTITY-COMPOSITION-DECISIONS.md:3,93-98);
the read does not adopt them.

## Resolution

Partly met before claim. DLW-VISION records the 12 Oct read and its
divergences (:74-82, :1311-1327). The receipt (acceptance 1–2) does not exist
in the pack, so builders cannot re-run the read. This ticket makes the read
reproducible.
