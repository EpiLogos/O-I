"""P0-BIMBA-LIVE: read the live Bimba map and check every headline DLW-VISION binds.

Read only. Uses the owner's bimba-graph module
(/Users/admin/Central/Control/user/skills/bimba-graph/bimba_graph.py):
health(), resolve_coordinate() and cypher() with MATCH ... RETURN statements
only (neighborhood() is not needed: edges are read by MATCH ... RETURN). Every statement passes read_only() before it is sent.
It also reads (never writes) the QL ledger fixture
Work/Quaternal-Logic/fixtures/kernel/m-ledger-v1.json.

Run from the o-i seat root:
    python3 -I desktop/cradle/docs/world-shell/evidence/p0-bimba-live/read.py > read.out

Verdicts per row: confirmed | diverged | absent.
  confirmed  the node/field/edge exists and every expected fragment is in it
  diverged   the node/field exists but a fragment is missing or the value differs
  absent     the node, field or edge does not exist
The closing "content digest" is a sha256 over every value read (not the run
time), so two runs against an unchanged map print the same digest.
"""

from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime, timezone

sys.path.insert(0, "/Users/admin/Central/Control/user/skills/bimba-graph")
import bimba_graph as bg  # noqa: E402

LEDGER = "/Users/admin/Central/Work/Quaternal-Logic/fixtures/kernel/m-ledger-v1.json"
SKIP = {"embedding"}  # vectors are not prose; never printed or hashed
DIGEST = hashlib.sha256()
ROWS: list[dict] = []


def read_only(q: str) -> str:
    head = q.lstrip().upper()
    if not (head.startswith("MATCH ") or head.startswith("OPTIONAL MATCH ")) or " RETURN " not in f" {q.upper()} ":
        raise SystemExit(f"refused: not a MATCH ... RETURN read: {q!r}")
    return q


def q(stmt: str, params: dict | None = None) -> list[dict]:
    return bg.cypher(read_only(stmt), params or {})


def feed(obj) -> None:
    DIGEST.update(json.dumps(obj, ensure_ascii=False, sort_keys=True, default=str).encode())


def props(coord: str) -> dict | None:
    node = bg.resolve_coordinate(coord)
    if node is None:
        feed({"node": coord, "absent": True})
        return None
    p = {k: v for k, v in (node.get("properties") or {}).items() if k not in SKIP}
    feed({"node": coord, "props": p})
    return p


def norm(s: str) -> str:
    return " ".join(s.split()).casefold()


def row(rid: str, node: str, what: str, verdict: str, value, note: str = "") -> None:
    ROWS.append({"id": rid, "node": node, "what": what, "verdict": verdict})
    print(f"\n[{rid}] {node} :: {what}")
    print(f"  verdict: {verdict}" + (f"  ({note})" if note else ""))
    print("  value: " + json.dumps(value, ensure_ascii=False))


def field(rid: str, coord: str, key: str, fragments: list[str] | None = None) -> None:
    p = props(coord)
    if p is None:
        return row(rid, coord, key, "absent", None, "node absent")
    if key not in p or p[key] in (None, ""):
        return row(rid, coord, key, "absent", None, "field absent")
    val = p[key]
    text = val if isinstance(val, str) else json.dumps(val, ensure_ascii=False)
    missing, loose = [], []
    for f in fragments or []:
        if f in text:
            continue
        if norm(f) in norm(text):
            loose.append(f)
        else:
            missing.append(f)
    if missing:
        return row(rid, coord, key, "diverged", val, "missing: " + " | ".join(missing))
    note = ("matched after case/whitespace folding: " + " | ".join(loose)) if loose else ""
    note = ("fragments: " + " | ".join(fragments) + ("; " + note if note else "")) if fragments else note
    row(rid, coord, key, "confirmed", val, note)


def phrase(rid: str, coord: str, fragment: str) -> None:
    """Find a fragment in any string field of a node (for headlines cited without a field)."""
    p = props(coord)
    if p is None:
        return row(rid, coord, f'any field ~ "{fragment}"', "absent", None, "node absent")
    hits = {k: v for k, v in p.items() if isinstance(v, str) and fragment in v}
    if not hits:
        hits = {k: v for k, v in p.items() if isinstance(v, str) and norm(fragment) in norm(v)}
        note = "matched after case/whitespace folding" if hits else ""
    else:
        note = ""
    if hits:
        row(rid, coord, f'any field ~ "{fragment}"', "confirmed", hits, ("fields: " + ", ".join(sorted(hits)) + ("; " + note if note else "")))
    else:
        row(rid, coord, f'any field ~ "{fragment}"', "absent", None, "no field holds the fragment")


def edge(rid: str, a: str, rel: str, b: str) -> None:
    rows = q(
        "MATCH (a:Bimba {coordinate: $a})-[r]->(b:Bimba {coordinate: $b}) "
        "WHERE type(r) = $t RETURN type(r) AS rel, a.coordinate AS from, b.coordinate AS to, "
        "coalesce(b.c_1_name, b.name) AS to_name",
        {"a": a, "b": b, "t": rel},
    )
    feed({"edge": [a, rel, b], "rows": rows})
    row(rid, f"{a} -[{rel}]-> {b}", "edge", "confirmed" if rows else "absent", rows)


def names(rid: str, coords: list[str], expected: list[str] | None) -> None:
    got = []
    for c in coords:
        p = props(c)
        got.append({"coordinate": c, "c_1_name": None if p is None else p.get("c_1_name"), "exists": p is not None})
    if any(not g["exists"] for g in got):
        verdict, note = "absent", "missing: " + ", ".join(g["coordinate"] for g in got if not g["exists"])
    elif expected is not None and [g["c_1_name"] for g in got] != expected:
        verdict, note = "diverged", "expected names: " + " | ".join(expected)
    else:
        verdict, note = "confirmed", ("names as expected" if expected else "nodes exist")
    row(rid, f"{coords[0]}…{coords[-1]}", "c_1_name", verdict, got, note)


def main() -> None:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print("P0-BIMBA-LIVE read of the live Bimba map (read only)")
    print(f"run_at_utc: {now}")
    h = bg.health()
    print("health: " + json.dumps(h))
    meta = q("MATCH (g:GraphMeta) RETURN g.graph_id AS graph_id, g.graph_revision AS graph_revision, "
             "g.embedding_version AS embedding_version, g.schema_version AS schema_version, "
             "g.q_schema_version AS q_schema_version, g.updated_at AS updated_at, "
             "g.kernel_source_hash AS kernel_source_hash, g.dataset_source_hash AS dataset_source_hash, "
             "g.seed_source_hash AS seed_source_hash, g.relation_registry_hash AS relation_registry_hash")
    print("map_revision: " + json.dumps(meta, ensure_ascii=False))
    feed({"health": {k: h[k] for k in ("nodes", "relationships")}, "meta": meta})
    m = meta[0] if meta else {}
    row("H0", "GraphMeta", "graph_revision / embedding_version (skill: q-semantic-v2-3072, revision 12)",
        "confirmed" if (m.get("graph_revision") == 12 and m.get("embedding_version") == "q-semantic-v2-3072") else "diverged",
        {"graph_revision": m.get("graph_revision"), "embedding_version": m.get("embedding_version"),
         "nodes": h["nodes"], "relationships": h["relationships"]},
        "vision records 3713 nodes / 13880 relations")

    print("\n== Origin-return")
    field("O1", "M0", "c_1_primary_designation", ["The Ever-Present Origin"])
    field("O2", "M5-5", "q_5_mobius_writeback_reopens", ["As ἀνάλογος it completes the return"])
    field("O3", "M5-5", "q_5_mobius_writeback_reopens",
          ["pulls #0 ground-material back into #5 visibility", "through review and Hen vault-write into M0's bimba node"])
    field("O4", "M5-5", "q_5_mobius_writeback_reopens",
          ["perfects itself by perishing into ground", "its completion is the act of handing the whole back, enriched",
           "The cycle completes by starting"])
    field("O5", "M5-5", "q_5_mobius_writeback_reopens", ["Logos Atelier"])
    edge("O6", "M5-5", "RETURNS_TO", "M5-0")
    edge("O7", "M5-5", "DEMONSTRATES_THROUGH_ETYMOLOGY", "M4.4.4")
    edge("O8", "M4.4.4.5", "RECEIVES_ETYMOLOGICAL_EVIDENCE", "M5-5")
    field("O9", "M4.4.4.5", "c_1_name", ["Phenomenology of Pratyabhijna"])
    edge("O10", "M5-5", "ENABLES_PRACTICE", "M4")
    field("O11", "M4.4.4", "c_0_essence", ["Reduction - excavating to constitutional origins"])
    field("O12", "M4.4.4", "c_1_name", ["Phenomenological Lens"])
    field("O13", "M4.4.0", "c_1_name", ["Gebser Lens"])

    print("\n== Nara as encounter")
    field("N1", "M4", "c_0_core_nature", ["individual self awakens through compassionate sensitivity to origins"])
    field("N2", "M4", "c_1_description", ["through profound compassionate sensitivity to origins"])
    field("N3", "M4", "c_1_primary_designation", ["Subsystem #4 - Oracle Interface Between Personal and Universal Domains"])
    field("N4", "M4", "q_1_the_oracle_interface")
    field("N5", "M4", "q_4_individuation_threshold", ["not providing answers but midwifing recognition"])
    field("N6", "M4", "q_5_dialogical_consummation", ["where the person, fully met, becomes a co-creator of meaning"])
    edge("N7", "M4", "INVERTS_TO", "M4'")
    field("N8", "M4.2", "c_0_essence", ["Translates cosmic patterns into comprehensible symbolic guidance"])
    field("N9", "M4.2", "c_1_key_principles", ["Ethical divination respects free will"])
    names("N10", [f"M4.{i}" for i in range(6)], None)
    phrase("N11", "M4", "Dialogical interface facilitating sacred conversation between universal archetypal patterns and particular manifestation")
    phrase("N12", "M4.3-2", "not oracles but transformation vessels")
    phrase("N13", "M4.4", "records transformation without performing it")
    phrase("N14", "M4.5", "running Logos Cycle over each Nara episode")

    print("\n== Epii as encounter")
    names("E1", [f"M4.5-{i}" for i in range(6)],
          ["Curriculum Map", "Core Epi-Logos Voice", "Method Transparency Lab", "Integration Lab",
           "Pedagogy Lab", "Logos Cycle Engine"])
    phrase("E2", "M4.5-1", "pedagogical compassion")

    print("\n== Agentic seam")
    field("A1", "M5-4", "c_1_coordinate_role",
          ["System agentic protocols: mediation of S/S', M', S4/S5 review, runtime agency, and operational capacities"])
    hic = q("MATCH (a:Bimba {coordinate: 'M5-4'})-[r:HAS_INTERNAL_COMPONENT]->(b) "
            "RETURN b.coordinate AS coordinate, b.c_1_name AS name ORDER BY coordinate")
    feed({"M5-4 HAS_INTERNAL_COMPONENT": hic})
    want = [f"M5-4.{i}" for i in range(6)]
    got = [r["coordinate"] for r in hic]
    row("A2", "M5-4 -[HAS_INTERNAL_COMPONENT]-> *", "edge set",
        "confirmed" if got == want else ("absent" if not got else "diverged"), hic, "expected M5-4.0…M5-4.5")
    mpl = q("MATCH (a:Bimba {coordinate: 'M5-4'})-[r:MEDIATES_PROTOCOL_LAYER]->(b) "
            "RETURN b.coordinate AS coordinate ORDER BY coordinate")
    feed({"M5-4 MEDIATES_PROTOCOL_LAYER": mpl})
    tg = [r["coordinate"] for r in mpl]
    row("A3", "M5-4 -[MEDIATES_PROTOCOL_LAYER]-> *", "edge set (vision: over S4.0…S5-5′)",
        "confirmed" if tg and all(str(c).startswith(("S4", "S5")) for c in tg) else ("absent" if not tg else "diverged"),
        {"count": len(tg), "first": tg[:1], "last": tg[-1:], "targets": tg})
    field("A4", "M5-4'", "c_1_name", ["Agentic Control Room"])

    print("\n== M′ names")
    kids = q("MATCH (p:Bimba {coordinate: \"M5'\"})-[:CONTAINS]->(c) "
             "RETURN c.coordinate AS coordinate, c.c_1_name AS name, c.c_1_description AS description "
             "ORDER BY coordinate")
    feed({"M5' CONTAINS": kids})
    exp = [("M5-2'", "Backend Studio"), ("M5-3'", "Frontend Studio"), ("M5-4'", "Agentic Control Room")]
    row("P1", "M5' -[CONTAINS]-> *", "children and names",
        "confirmed" if [(k["coordinate"], k["name"]) for k in kids] == exp else ("absent" if not kids else "diverged"),
        [{"coordinate": k["coordinate"], "name": k["name"]} for k in kids], "expected exactly M5-2′, M5-3′, M5-4′")
    bad = [k for k in kids if not str(k.get("description") or "").startswith("M' rendered affordance exposing")]
    row("P2", "M5-2′ / M5-3′ / M5-4′", "c_1_description starts \"M' rendered affordance exposing\"",
        "confirmed" if kids and not bad else ("absent" if not kids else "diverged"),
        [{"coordinate": k["coordinate"], "description": k["description"]} for k in kids])
    prime = q("MATCH (n:Bimba) WHERE n.coordinate IN [\"M5-0'\", \"M5-1'\", \"M5-5'\"] RETURN n.coordinate AS coordinate")
    feed({"absent primes": prime})
    row("P3", "M5-0′ / M5-1′ / M5-5′", "absence (the vision says no such nodes)",
        "confirmed" if not prime else "diverged", {"found": prime})
    for rid, c, nm in (("P4", "M4'", "Nara'"), ("P5", "M5'", "Epii'")):
        p = props(c)
        if p is None:
            row(rid, c, "bare prime node", "absent", None)
            continue
        descriptive = sorted(k for k in p if k.startswith(("c_0_", "q_", "l_", "t_")) or k in ("c_1_description", "c_1_primary_designation"))
        ok = p.get("c_1_name") == nm and p.get("m_0_owned_by_coordinate") == "M5-3" and not descriptive
        row(rid, c, f"bare prime node: c_1_name {nm}, m_0_owned_by_coordinate M5-3, no descriptive fields",
            "confirmed" if ok else "diverged",
            {"c_1_name": p.get("c_1_name"), "m_0_owned_by_coordinate": p.get("m_0_owned_by_coordinate"),
             "descriptive_fields": descriptive, "keys": sorted(p)})

    print("\n== Defects the vision records")
    orph = q("MATCH (n:Bimba) WHERE n.coordinate IN ['M4-0','M4-1','M4-2','M4-3','M4-4','M4-5'] "
             "OPTIONAL MATCH (n)-[r]-() RETURN n.coordinate AS coordinate, n.c_1_name AS name, count(r) AS relations "
             "ORDER BY coordinate")
    feed({"orphans": orph})
    row("D1", "M4-0…M4-5", "orphan dash duplicates, zero relations",
        "confirmed" if len(orph) == 6 and all(o["relations"] == 0 for o in orph) else ("absent" if not orph else "diverged"),
        orph)
    with open(LEDGER, "rb") as fh:
        raw = fh.read()
    ledger = json.loads(raw)
    nt = [d for d in ledger.get("discrepancies", []) if str(d.get("id", "")).startswith("k2-grammar-nesting-threshold:")]
    r4 = [d for d in nt if d["id"] == "k2-grammar-nesting-threshold:#4"]
    lmeta = {"path": LEDGER, "sha256": hashlib.sha256(raw).hexdigest(), "ledger_revision": ledger.get("ledger_revision"),
             "nesting_threshold_records": len(nt)}
    feed({"ledger": lmeta, "r4": r4})
    row("D2", "ledger k2-grammar-nesting-threshold:#4", "record for the orphans, state",
        "confirmed" if r4 and r4[0].get("state") == "proposed" else ("absent" if not r4 else "diverged"),
        {**lmeta, "state": r4[0].get("state") if r4 else None, "subjects": r4[0].get("subjects") if r4 else None})
    dots = q("MATCH (n:Bimba) WHERE n.coordinate STARTS WITH 'M4.3-2.' "
             "RETURN n.coordinate AS coordinate, n.c_1_name AS name ORDER BY coordinate")
    feed({"dot-after-2": dots})
    cover = [d["id"] for d in nt if any(s in json.dumps(d, ensure_ascii=False)
                                         for s in ("M4.3-2.", "#4.3-2.", "#4-3-2-", "#4.3-2-"))]
    row("D3", "M4.3-2.0…M4.3-2.2", "dot after a 2; no nesting-threshold ledger record covers them",
        "confirmed" if [d["coordinate"] for d in dots] == ["M4.3-2.0", "M4.3-2.1", "M4.3-2.2"] and not cover
        else ("absent" if not dots else "diverged"),
        {"nodes": dots, "ledger_records_covering": cover, "nesting_threshold_records": len(nt)})
    ph = []
    for c in ("M5-0", "M5-2", "M5-3", "M5-4"):
        p = props(c) or {}
        ph.append({"coordinate": c, "c_1_name": p.get("c_1_name"), "c_1_description": p.get("c_1_description"),
                   "q_fields": sum(1 for k in p if k.startswith("q_")),
                   "has_role": bool(p.get("c_1_coordinate_role")),
                   "m_3_rendered_affordance": p.get("m_3_rendered_affordance")})
    okph = all(str(x["c_1_description"] or "").startswith("Node with ID") and x["q_fields"] > 0 for x in ph)
    row("D4", "M5-0 / M5-2 / M5-3 / M5-4", "placeholder c_1_description over populated q-registers",
        "confirmed" if okph else "diverged", ph)
    un = []
    for i in range(6):
        p = props(f"M4.5.{i}")
        un.append({"coordinate": f"M4.5.{i}", "exists": p is not None,
                   "c_1_name": None if p is None else p.get("c_1_name"),
                   "s_4_role": None if p is None else p.get("s_4_role")})
    okun = all(u["exists"] and u["c_1_name"] is None and u["s_4_role"] for u in un)
    row("D5", "M4.5.0…M4.5.5", "unnamed dot-after-5 nodes carrying only roles",
        "confirmed" if okun else ("absent" if not any(u["exists"] for u in un) else "diverged"), un)

    print("\n== Node list the vision records as confirmed (DLW-VISION :76-77)")
    listed = (["M4"] + [f"M4.{i}" for i in range(6)] + ["M4.3-2", "M4.4.4", "M4.5"]
              + [f"M4.5-{i}" for i in range(6)] + ["M5-1", "M5-4", "M5-5"] + [f"M5-5-{i}" for i in range(6)])
    found = q("MATCH (n:Bimba) WHERE n.coordinate IN $cs RETURN n.coordinate AS coordinate, n.c_1_name AS name "
              "ORDER BY coordinate", {"cs": listed})
    feed({"listed": found})
    missing = sorted(set(listed) - {f["coordinate"] for f in found})
    row("C1", "listed nodes", f"{len(listed)} coordinates exist",
        "confirmed" if not missing else "absent", {"found": found, "missing": missing})

    print("\n== Summary")
    tally: dict[str, int] = {}
    for r in ROWS:
        tally[r["verdict"]] = tally.get(r["verdict"], 0) + 1
    for r in ROWS:
        print(f"  {r['id']:<4} {r['verdict']:<10} {r['node']} :: {r['what']}")
    print("tally: " + json.dumps(tally, sort_keys=True))
    print("content digest (sha256 over values read, run time excluded): " + DIGEST.hexdigest())


if __name__ == "__main__":
    main()
