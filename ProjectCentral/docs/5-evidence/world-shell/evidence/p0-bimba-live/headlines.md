# P0-BIMBA-LIVE — headline receipt

The live Bimba map, read only, checked against every headline DLW-VISION binds
(ticket `wayfinder/tickets/P0-BIMBA-LIVE-live-map-receipt.md`).

| | |
|---|---|
| Re-read | **2026-10-12T16:10:53Z** (`run_at_utc` in `read.out`) |
| Channel | scripted: `read.py` run with `python3 -I`, stdout kept verbatim as `read.out` |
| Map | `bimba-neo4j` on oi-omarchy, `http://100.92.62.101:7474`; 3713 nodes / 13880 relations |
| Map revision | GraphMeta `graph_revision` 12, `embedding_version` `q-semantic-v2-3072`, `updated_at` 2026-08-07T19:48:39.094Z, `kernel_source_hash` `94b9f0ea…5c4` (all hashes are in `read.out`) |
| Content digest | `1a4b75ce1660e89f104e7d8b24b35748eef7d0c0dcfb878a0bfaf08591ca6b6c`: sha256 over every value read, run time excluded. A second run printed the same digest |
| Ledger fixture read | `Work/Quaternal-Logic/fixtures/kernel/m-ledger-v1.json`, sha256 `cea0ff25…bfef`, `ledger_revision` `daecbea8…a5a6`, 19 `k2-grammar-nesting-threshold:*` records |
| Vision pinned at | `DLW-VISION.md` as committed in `13aaf5360` (unchanged in the seat at the time of the read). The line numbers below refer to that file |
| Result | **45 rows: 45 confirmed, 0 diverged, 0 absent** |

To re-run, from the o-i seat root:

```sh
grep -nE 'CREATE|MERGE|SET |DELETE|bimba_admin|bimba_sync' ProjectCentral/docs/5-evidence/world-shell/evidence/p0-bimba-live/read.py   # prints nothing
python3 -I ProjectCentral/docs/5-evidence/world-shell/evidence/p0-bimba-live/read.py > ProjectCentral/docs/5-evidence/world-shell/evidence/p0-bimba-live/read.out
```

If the map is unchanged, the digest matches. If the digest differs, read the
row verdicts. The script sends only `MATCH … RETURN` statements, and each one
passes a guard first. It calls the module's `health`, `resolve_coordinate` and
`cypher` functions (edges are read by `MATCH … RETURN`, not `neighborhood`),
and no write tool.

Verdicts: **confirmed** means the node, field or edge exists and every
expected fragment is in it verbatim. The script also accepts a match after
case and whitespace folding and labels it in `read.out`; no row needed that.
**diverged** means the node or field exists but a fragment is missing.
**absent** means the node, field or edge does not exist. A scratch self-test
(not kept) confirmed that each check can fail: a wrong fragment returned
`diverged`; a missing field, a missing node, a missing edge and a missing
phrase each returned `absent`; and a statement that is not `MATCH … RETURN`
was refused.

## Headlines

Long register fields are quoted as the fragment the vision binds, with the
field's length. The full value is in `read.out` under the row id.

### Origin-return

| Id | Node · field / edge | Value as returned | Verdict | DLW-VISION |
|---|---|---|---|---|
| O1 | M0 · `c_1_primary_designation` | "Subsystem #0 - The Foundational Void - Proto-Logy - The Ever-Present Origin" | confirmed | :140, :443-445, :1434 |
| O2 | M5-5 · `q_5_mobius_writeback_reopens` (1137 chars) | "…As ἀνάλογος it completes the return: the many recognised in the one…" | confirmed | :145-146, :448 |
| O3 | M5-5 · `q_5_mobius_writeback_reopens` | "pulls #0 ground-material back into #5 visibility" · "through review and Hen vault-write into M0's bimba node" | confirmed | :146-148, :450-451 |
| O4 | M5-5 · `q_5_mobius_writeback_reopens` | "perfects itself by perishing into ground" · "its completion is the act of handing the whole back, enriched" · "The cycle completes by starting" | confirmed | :187-188 |
| O5 | M5-5 · `q_5_mobius_writeback_reopens` | "Logos Atelier" | confirmed | :449, :1021 |
| O6 | M5-5 `RETURNS_TO` M5-0 | edge present; M5-0 "Transcendent Identity" | confirmed | :153, :451, :1076 |
| O7 | M5-5 `DEMONSTRATES_THROUGH_ETYMOLOGY` M4.4.4 | edge present; M4.4.4 "Phenomenological Lens" | confirmed | :151-152, :462 |
| O8 | M4.4.4.5 `RECEIVES_ETYMOLOGICAL_EVIDENCE` M5-5 | edge present (M4.4.4.5 → M5-5) | confirmed | :462-463 |
| O9 | M4.4.4.5 · `c_1_name` | "Phenomenology of Pratyabhijna" | confirmed | :462-463 |
| O10 | M5-5 `ENABLES_PRACTICE` M4 | edge present; M4 "Nara" | confirmed | :550-551 |
| O11 | M4.4.4 · `c_0_essence` (690 chars) | "…(2) Reduction - excavating to constitutional origins…" | confirmed | :152-153, :459-460 |
| O12 | M4.4.4 · `c_1_name` | "Phenomenological Lens" | confirmed | :459 |
| O13 | M4.4.0 · `c_1_name` | "Gebser Lens" | confirmed | :457-458 |

### Nara as encounter

| Id | Node · field / edge | Value as returned | Verdict | DLW-VISION |
|---|---|---|---|---|
| N1 | M4 · `c_0_core_nature` (406 chars) | "…where individual self awakens through compassionate sensitivity to origins…" | confirmed | :142-143, :466-467 |
| N2 | M4 · `c_1_description` (2000 chars) | "…through profound compassionate sensitivity to origins…" | confirmed | :467-469 |
| N3 | M4 · `c_1_primary_designation` | "Subsystem #4 - Oracle Interface Between Personal and Universal Domains" | confirmed | :524-526 |
| N4 | M4 · `q_1_the_oracle_interface` (451 chars) | present: "M4 is the contextual-application and personal-interface layer — the Oracle bridging universal archetypal pattern with the individual's unique conditions…" | confirmed | :526 |
| N5 | M4 · `q_4_individuation_threshold` (643 chars) | "…not providing answers but midwifing recognition…" | confirmed | :167-169, :501 |
| N6 | M4 · `q_5_dialogical_consummation` (402 chars) | "…Nara completes where the person, fully met, becomes a co-creator of meaning…" | confirmed | :501-504 |
| N7 | M4 `INVERTS_TO` M4′ | edge present; M4′ "Nara'" | confirmed | :167, :510-511, :1057-1058 |
| N8 | M4.2 · `c_0_essence` | "Translates cosmic patterns into comprehensible symbolic guidance through multiple divinatory languages" | confirmed | :527 |
| N9 | M4.2 · `c_1_key_principles` | list; fifth item "Ethical divination respects free will" | confirmed | :527-528, :1049 |
| N10 | M4.0–M4.5 · `c_1_name` | Mahamaya Identity Matrix · Sympathetic Medicine · Divinatory Frameworks · Mediating Transformation · Context & Lenses · Epii Integration | confirmed (all six exist) | :76 |
| N11 | M4 · `c_0_core_nature` | "Dialogical interface facilitating sacred conversation between universal archetypal patterns and particular manifestation…" | confirmed | :990 (cited to BMAP) |
| N12 | M4.3-2 · `c_0_core_nature` | "Process containers that mediate change through dialogue and inquiry, not oracles but transformation vessels" | confirmed | :1050 (cited to BMAP) |
| N13 | M4.4 · `c_0_core_nature` | "Context ledger and lens shelf that names, frames, and records transformation without performing it - …" | confirmed | :1051 (cited to BMAP) |
| N14 | M4.5 · `c_0_core_nature` | "Hosts epii consciousness in situ, running Logos Cycle over each Nara episode to distill insights…" | confirmed | :546-547, :1052 (cited to BMAP) |

### Epii as encounter

| Id | Node · field / edge | Value as returned | Verdict | DLW-VISION |
|---|---|---|---|---|
| E1 | M4.5-0…M4.5-5 · `c_1_name` | Curriculum Map · Core Epi-Logos Voice · Method Transparency Lab · Integration Lab · Pedagogy Lab · Logos Cycle Engine | confirmed | :547-550, :1052 |
| E2 | M4.5-1 · `c_1_description` | "Establishes consistent Epi-Logos voice characterized by ethical clarity, philosophical depth, and pedagogical compassion across all communications" | confirmed | :156, :472, :550 |

### Agentic seam

| Id | Node · field / edge | Value as returned | Verdict | DLW-VISION |
|---|---|---|---|---|
| A1 | M5-4 · `c_1_coordinate_role` | "System agentic protocols: mediation of S/S', M', S4/S5 review, runtime agency, and operational capacities." | confirmed | :396-397 |
| A2 | M5-4 `HAS_INTERNAL_COMPONENT` → | M5-4.0 Anuttara Agent · .1 Paramasiva Agent · .2 Parashakti Agent · .3 Mahamaya Agent · .4 Nara Agent · .5 Epii Agent | confirmed | :397-398 |
| A3 | M5-4 `MEDIATES_PROTOCOL_LAYER` → | 24 targets, S4.0 … S5-5′ (each with its prime) | confirmed | :398 |
| A4 | M5-4′ · `c_1_name` | "Agentic Control Room" | confirmed | :399 |

### M′ names

| Id | Node · field / edge | Value as returned | Verdict | DLW-VISION |
|---|---|---|---|---|
| P1 | M5′ `CONTAINS` → | exactly M5-2′ "Backend Studio", M5-3′ "Frontend Studio", M5-4′ "Agentic Control Room" | confirmed | :1010-1013 |
| P2 | M5-2′/3′/4′ · `c_1_description` | "M' rendered affordance exposing the M5-2 S/S' system spine." · "…the M5-3 M' expression plane." · "…the M5-4 agentic protocol seam." | confirmed | :1012 |
| P3 | M5-0′, M5-1′, M5-5′ | no such nodes | confirmed | :1013, :1020 |
| P4 | M4′ | `c_1_name` "Nara'", `m_0_owned_by_coordinate` "M5-3", no `c_0_*`/`q_*`/`l_*`/`t_*`/description fields | confirmed | :1028-1030 |
| P5 | M5′ | `c_1_name` "Epii'", `m_0_owned_by_coordinate` "M5-3", no descriptive fields | confirmed | :1028-1030 |

### Defects the vision records

| Id | Node · field / edge | Value as returned | Verdict | DLW-VISION |
|---|---|---|---|---|
| D1 | M4-0…M4-5 | six nodes, 0 relations each (names duplicate M4.0…M4.5) | confirmed | :973-977, :1322-1323 |
| D2 | ledger `k2-grammar-nesting-threshold:#4` | state "proposed"; subjects #4-0…#4-5 | confirmed | :975-976, :1323 |
| D3 | M4.3-2.0…M4.3-2.2 | nodes "Bohmian Dialogue", "Native Talking Circle", "Diamond Approach Inquiry"; 0 of the 19 nesting-threshold records cover them | confirmed | :978-980, :1323-1324 |
| D4 | M5-0/2/3/4 · `c_1_description` | "Node with ID 18" / "20" / "21" / "22"; q-fields 7 / 6 / 6 / 12; M5-2/3/4 carry `c_1_coordinate_role` and `m_3_rendered_affordance`, M5-0 neither | confirmed | :568-570, :964-966, :1320 |
| D5 | M4.5.0…M4.5.5 | all six exist with no `c_1_name`; each carries an `s_4_role` (e.g. M4.5.0 "Curriculum Path Manager") | confirmed | :570-571, :965, :1321 |
| C1 | the node list the vision records as confirmed | all 25 coordinates exist (M4, M4.0–M4.5, M4.3-2, M4.4.4, M4.5, M4.5-0…5, M5-1, M5-4, M5-5, M5-5-0…5) | confirmed | :76-77, :1312-1313 |
| H0 | GraphMeta | `graph_revision` 12, `embedding_version` "q-semantic-v2-3072" (the revision the skill names) | confirmed | :75 (counts) |

## Diverged or absent (acceptance 3)

None. No correction needs to be carried into P0-V1.

**Re-cite candidates (optional, P0-V1's zone, not divergences).** These
phrases are cited to the BMAP reflection. The live map holds the same words,
so under the standing note (:71-82) the live map could be the cite:

- :990 → M4 `c_0_core_nature` (N11);
- :1050 → M4.3-2 `c_0_core_nature` (N12);
- :1051 → M4.4 `c_0_core_nature` (N13);
- :546-547 and :1052 → M4.5 `c_0_core_nature` (N14);
- :156 and :472 → M4.5-1 `c_1_description` (E2).

## The M4.3-2.0…2.2 defect to the QL owner (acceptance 4)

**Sent by the conductor as a NOW return** to the QL project register (the
builder did not post; the return was written outside this evidence zone). A search of QL-MEF issues for "M4.3-2" and
for "nesting threshold" (state: all) found no existing issue. The proposed
migration `migration/bimba-map/2026-09-29-nesting-threshold.cypher` does not
touch these three nodes. The send must not edit the map or
`fixtures/kernel/m-ledger-v1.json`.

Body as drafted by the builder (the sent return carries the same facts and
cites SKILL.md:26, the nesting-threshold line):

> Bimba map defect (read only, 2026-10-12T16:10:53Z, graph_revision 12,
> digest 1a4b75ce…6b6c). `M4.3-2.0` Bohmian Dialogue, `M4.3-2.1` Native
> Talking Circle and `M4.3-2.2` Diamond Approach Inquiry put a `.` after a
> position-2 segment. The QL law allows a dot only after a 4 (ql-law
> SKILL.md:25-31). None of the 19 `k2-grammar-nesting-threshold:*` records
> in `fixtures/kernel/m-ledger-v1.json` covers them. Receipt:
> `o-i/ProjectCentral/docs/5-evidence/world-shell/evidence/p0-bimba-live/read.out`
> row D3. The respelling is the QL owner's decision.

Send ref: **NOW return `bimba-map-defect-m4320-m4321-m4322-2026-10-12`**
(kind `question`, status `active`, 2026-10-12), at
`Work/Quaternal-Logic/ProjectCentral/now/agents/bimba-map-defect-m4320-m4321-m4322-2026-10-12.json`,
written through `ctrl action run projectcentral.now.return`. No QL-MEF issue
was filed. Neither the map nor the ledger fixture was edited.

## Dating (acceptance 5)

DLW-VISION's "(queried 12 Oct 2026)" stays as written. Every headline it
dates is confirmed. This receipt adds the re-read at
**2026-10-12T16:10:53Z**, at map revision 12 with content digest
`1a4b75ce…6b6c`.
