#!/usr/bin/env python3
"""Keep the S-whole capability matrix's derived surfaces equal to their sources.

Two surfaces are derived here, and nothing else in the matrix is written:

1. The `story-position` view of ProjectCentral/user/capability-matrix.{json,csv}:
   one row per story the experience compiler reads (scripts/experience_map.py),
   six columns for the six positions, which are also the six document tiers
   (O-I #710; docs/experience/STORY-PROFILE.md §1). A cell carries references,
   not a copy of the story: the row it comes from, the manual units it is
   carried at and the capability rows those units hold, the products named as
   owners, the starting world and port sources, the grade and proof refs.
   A cited unit with no capability row is named as absent.
2. The CAPABILITY_HOMES and SHELL_CAPABILITIES tables of
   packages/live-shell/ui/src/inhabitants/capabilityHomes.ts, from each matrix
   row's `extensions.capability_homes` (O-I #736).

`--check` (the default) exits 1 and names each surface that differs from its
derivation; `--write` rewrites them.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import importlib.util
import io
import json
import re
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
MATRIX_JSON = "ProjectCentral/user/capability-matrix.json"
MATRIX_CSV = "ProjectCentral/user/capability-matrix.csv"
MANUAL = "ProjectCentral/docs/1-vision/dlw/DLW.md"
STORIES = "docs/experience/STORIES.md"
CASES = "docs/experience/CASES.md"
HOMES_TS = "packages/live-shell/ui/src/inhabitants/capabilityHomes.ts"
VIEW_ID = "story-position"
GENERATOR = "scripts/shell_matrix_views.py"
BEGIN = "// BEGIN GENERATED: capability homes"
END = "// END GENERATED: capability homes"

POSITIONS = [
    ("p0", "0 Why: the owner's words it answers", "0-ground"),
    ("p1", "1 What: who, from which start, does what, and gets what", "1-vision"),
    ("p2", "2 How: the device, view and act that carry it; its capability rows", "2-design"),
    ("p3", "3 Who / Which / Whereby: the product operation that owns the effect, and the agent that acts", "3-architecture"),
    ("p4", "4 Where / When / Whither: its starting world, surface and machine; its port source; the code", "4-development"),
    ("p5", "5 Why-for / Why-not: the walk, the grade and the owner's EX", "5-evidence"),
]
# The names an owning-operation cell uses for a product, and the product's id.
PRODUCTS = [
    (re.compile(r"\bCentral\b"), "central"),
    (re.compile(r"\bActuation\b"), "actuation"),
    (re.compile(r"\bAIKit\b"), "ai-kit"),
    (re.compile(r"\b(?:Software )?Factory\b"), "software-factory"),
    (re.compile(r"\bWorkcell\b"), "workcell"),
    (re.compile(r"\bQuaternal Logic\b"), "quaternal-logic"),
    (re.compile(r"\b(?:[Tt]he shell|Shell)\b|O:I\b"), "o-i"),
]
# Where a Why line's citation lives: the owner's own words are tier 0.
WHY_REFS = [
    (re.compile(r"UX chat 27 Oct"), lambda m: "ProjectCentral/docs/0-ground/PROGRAMME.md#R10"),
    (re.compile(r"#(\d+)"), lambda m: f"O-I#{m.group(1)}"),
]
FAMILY_TS_NAMES = {
    "central": "CENTRAL", "software-factory": "SOFTWARE_FACTORY", "ai-kit": "AI_KIT",
    "workcell": "WORKCELL", "actuation": "ACTUATION", "quaternal-logic": "QUATERNAL_LOGIC_FAMILY_ID",
}
UNIT = re.compile(r"§\s?(\d+(?:\.\d+)?)(?:\s?(?:–|-|to)\s?(§?)(\d+(?:\.\d+)?))?")
STORY_REF = re.compile(r"\b([A-Z]{2})(\d{2})(?:\s?[–-]\s?([A-Z]{2})(\d{2}))?\b")


class Drift(Exception):
    pass


def experience_map(root: Path):
    spec = importlib.util.spec_from_file_location("experience_map", root / "scripts/experience_map.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def digest(text: str) -> str:
    return "sha256:" + hashlib.sha256(text.encode("utf-8")).hexdigest()


def unique(items):
    return list(dict.fromkeys(item for item in items if item))


def manual_units(text: str) -> set[str]:
    units = set()
    for line in text.splitlines():
        if m := re.match(r"## (\d+)\. ", line):
            units.add(m.group(1))
        elif m := re.match(r"### (\d+\.\d+) ", line):
            units.add(m.group(1))
    return units


def cited_units(text: str, known: set[str]) -> list[str]:
    """Manual units a cell cites; a range inside one chapter is expanded to the units the manual has."""
    units = []
    for m in UNIT.finditer(text):
        first, marked, last = m.group(1), m.group(2), m.group(3)
        units.append(first)
        if not last:
            continue
        chapter, _, low = first.rpartition(".") if "." in first else ("", "", first)
        # "§19.16–17" stays in chapter 19; "§10.2–§17" names chapter 17 itself.
        end_chapter, _, high = last.rpartition(".") if "." in last else ("" if marked else chapter, "", last)
        if end_chapter != chapter:
            units.append(last)
            continue
        prefix = f"{chapter}." if chapter else ""
        units.extend(f"{prefix}{n}" for n in range(int(low) + 1, int(high) + 1) if f"{prefix}{n}" in known)
    return unique(units)


def story_refs(text: str, known: set[str]) -> list[str]:
    refs = []
    for m in STORY_REF.finditer(text):
        prefix, low, end_prefix, high = m.groups()
        span = [f"{prefix}{low}"]
        if high and end_prefix == prefix:
            span = [f"{prefix}{n:02d}" for n in range(int(low), int(high) + 1)]
        refs.extend(ref for ref in span if ref in known)
    return unique(refs)


def family_headers(documents: dict) -> dict:
    """Each family heading's Why / Where / Sources lines, by (path, family id)."""
    headers = {}
    for path, document in documents.items():
        if not path.endswith(".md"):
            continue
        lines = document["text"].splitlines()
        for index, line in enumerate(lines):
            m = re.match(r"## ([A-Z]{2}) — ", line)
            if not m:
                continue
            found = {"line": index + 1}
            for following in lines[index + 1:]:
                if following.startswith("|") or following.startswith("## "):
                    break
                for key, prefix in (("why", "**Why:**"), ("where", "**Where:**"), ("sources", "Sources:")):
                    if following.startswith(prefix):
                        found[key] = following[len(prefix):].strip()
            headers[(path, m.group(1))] = found
    return headers


def earlier_places(text: str, known_stories: set[str]) -> dict:
    """STORIES.md "Where the earlier stories now happen": earlier ID → where it happens in the DLW."""
    places, inside = {}, False
    for line in text.splitlines():
        if line.startswith("## "):
            inside = line.strip() == "## Where the earlier stories now happen"
            continue
        m = re.match(r"- ([A-Z]{2}\d{2}) → (.+)$", line) if inside else None
        if m and m.group(1) in known_stories:
            places.setdefault(m.group(1), []).append(m.group(2).strip())
    return places


def case_links(text: str, known_stories: set[str]) -> dict:
    """CASES.md: story ID → the acceptance cases whose row names it."""
    links = {}
    for line in text.splitlines():
        m = re.match(r"\| \*\*([A-Z]{2,4}\d{1,3}[a-z]?)\b", line)
        if m:
            for ref in story_refs(line, known_stories):
                if ref != m.group(1):
                    links.setdefault(ref, []).append(m.group(1))
    return {ref: unique(cases) for ref, cases in links.items()}


def read_matrix(root: Path):
    manifest_text = (root / MATRIX_JSON).read_text(encoding="utf-8")
    csv_text = (root / MATRIX_CSV).read_bytes().decode("utf-8")
    rows = list(csv.reader(io.StringIO(csv_text), strict=True))
    return manifest_text, csv_text, rows[0], rows[1:]


def capability_index(header, rows):
    ix = {name: i for i, name in enumerate(header)}
    at_unit = {}
    for row in rows:
        if row[ix["record_type"]] != "capability":
            continue
        key = row[ix["id"]]
        documentation = json.loads(row[ix["extensions"]]).get("documentation", {})
        for ref in documentation.get("design_refs", []):
            path, _, unit = ref.partition("#")
            if path == MANUAL and unit:
                at_unit.setdefault(unit, []).append(key)
    return at_unit


def record(header, values: dict) -> list[str]:
    return [values.get(name, "") for name in header]


def story_view(root: Path, header, rows):
    em = experience_map(root)
    reading = em.load_sources(root)
    documents = reading["source_documents"]
    stories = reading["stories"]
    known_stories = {story["id"] for story in stories}
    known_units = manual_units((root / MANUAL).read_text(encoding="utf-8"))
    at_unit = capability_index(header, rows)
    headers = family_headers(documents)
    earlier = earlier_places(documents[STORIES]["text"], known_stories)
    cases = case_links(documents[CASES]["text"] if CASES in documents else (root / CASES).read_text(encoding="utf-8"),
                       known_stories)

    members, records = [], []
    for story in stories:
        key, family = story["id"], story["parent_ref"]
        ext = story["extensions"]
        locator = ext["source_locator"]
        path = locator["path"]
        row_ref = f"{path}#{key}"
        line_text = documents[path]["text"].splitlines()[locator["line"] - 1]
        six = ext.get("ux")
        agent = ext["agent_ux"]
        config = ext["source_family"]
        head = headers.get((path, family), {})
        members.append({"id": key, "label": story["story"], "source_ref": row_ref})
        base = {"record_type": "relation", "view_id": VIEW_ID, "row_id": key, "capability_refs": "[]",
                "standing": "agent-inference"}

        def cell(position: str, relation: str, sources: list[str], ux: dict, coverage: str = "referenced", **fields):
            values = dict(base, id=f"story.{key}.{position}", column_id=position, relation=relation,
                          source_refs=";".join(unique(sources)), coverage=coverage, **fields)
            values["extensions"] = json.dumps({"ux": ux}, ensure_ascii=False)
            records.append(record(header, values))

        # 0 Why: the owner's words the story answers.
        family_ref = f"{path}#{family}"
        if "why" in head:
            why = unique(make(m) for pattern, make in WHY_REFS for m in pattern.finditer(head["why"]))
            cell("p0", f"Answers the owner's words quoted in family {family}'s Why line.", [family_ref, *why],
                 {"family": family})
        else:
            cell("p0", f"Answers the sources family {family} declares (earlier record form).",
                 [family_ref, *config["source_refs"]], {"family": family})

        # 1 What: the story itself.
        cell("p1", "The story as written.", [row_ref],
             {"story_ref": key, "story_revision": digest(line_text), "record_form": "six-cell" if six else "earlier"},
             need=story["story"], outcome=story["experienced_outcome"], account_ref=f"../../{row_ref}")

        # 2 How: where it is carried, and the capability rows at those manual units.
        carried, port_from_row = None, None
        if six:
            carried, _, port_from_row = story["surface_refs"][0].partition("Source:")
            carried, port_from_row = carried.strip().rstrip(".").strip(), port_from_row.strip() or None
            places = [carried]
        else:
            places = earlier.get(key, [])
        candidates = agent["capability_requirements"]["candidates"]
        external = unique(f"{c['repository']}:{c['capability_id']}" for c in candidates)
        cell2_refs = []
        if places or external:
            text = " | ".join(places)
            units = cited_units(text, known_units)
            cell2_refs = unique(ref for unit in units for ref in at_unit.get(unit, []))
            absent = [unit for unit in units if not at_unit.get(unit)]
            ux = {"relation_kind": "requires", "manual_units": units, "absent_units": absent,
                  "binding_status": "source-bound" if cell2_refs else "binding-required"}
            if not_in_manual := [unit for unit in units if unit not in known_units]:
                ux["not_in_manual"] = not_in_manual
            if places and not units:
                ux["absent_units"] = ["no manual unit cited"]
            if not six and places:
                ux["now_happens_in"] = story_refs(text, known_stories)
            if external:
                ux["external_capability_refs"] = external
                ux["external_binding_status"] = unique(c["binding_status"] for c in candidates)
            coverage = ("bound" if cell2_refs and not absent else "partly-bound" if cell2_refs else "unbound")
            relation = (f"Carried at: {carried}." if six else
                        f"Earlier record; in the DLW it happens at: {text}." if places else
                        "Earlier record with no DLW place named; its module names native capability candidates.")
            cell("p2", relation, [row_ref] + ([f"{STORIES}#where-the-earlier-stories-now-happen"] if not six and places else []),
                 ux, coverage=coverage, capability_refs=json.dumps(cell2_refs))

        # 3 Who / Which / Whereby: the operation that owns the effect, and the agent.
        statement = agent["determining_conditions"]
        if six:
            products = unique(product for pattern, product in PRODUCTS if pattern.search(statement))
            cell("p3", f"Owning operation and agent: {statement.rstrip('.')}.", [row_ref],
                 {"products_named": products, "family_owners": config["owners"],
                  "binding_status": "binding-required"})
        else:
            practices = [practice["id"] for practice in agent["practice_requirements"]]
            cell("p3", f"Agent work under practice conditions {', '.join(practices)}.",
                 [row_ref, *(f"docs/experience/PRACTICE-CONDITIONS.md#{p}" for p in practices)],
                 {"practice_refs": practices, "family_owners": config["owners"], "relation_kind": "practised-by"})

        # 4 Where / When / Whither: starting world and port sources; the code is
        # carried by the p2 capability rows' own code_refs, not copied here.
        if six:
            ports = unique([*six["port_sources"], port_from_row])
            cell("p4", f"Starts from {six['starting_world']}; port sources: {'; '.join(ports) or 'none named'}.",
                 [row_ref, "docs/experience/LOCAL-CAMPAIGN.md#2.2"],
                 {"relation_kind": "conditions", "starting_world": six["starting_world"], "port_sources": ports})

        # 5 Why-for / Why-not: the grade, the proof refs, the walk and the owner's EX.
        proofs = ext["existing_proof_refs"]
        case_refs = cases.get(key, [])
        named = f" Acceptance cases naming it: {', '.join(case_refs)}." if case_refs else ""
        sources = [row_ref, *(f"{CASES}#{case}" for case in case_refs)]
        ux = {"relation_kind": "tested-by", **({"case_refs": case_refs} if case_refs else {})}
        if six:
            grade = six["grade"] + (" (core)" if six["core"] else "")
            cell("p5", f"Grade {grade} declared; no walk or owner EX is recorded in the story source.{named}",
                 sources, {**ux, "grade": six["grade"], "core": six["core"]},
                 coverage="grade-declared", test_refs=";".join(proofs))
        else:
            cell("p5", f"No grade declared (earlier record form); its proof refs are named.{named}",
                 sources, ux, coverage="no-grade", test_refs=";".join(proofs))

    view = {
        "id": VIEW_ID,
        "title": "Stories · story × position (the six cells)",
        "semantics": (
            "Each intersection asks: what does this story's cell at this position refer to? A row is one story of "
            "docs/experience, read by scripts/experience_map.py; its id is the story's row locator. A column is one of "
            "the six positions, which are also the six document tiers (O-I #710; STORY-PROFILE §1). A cell carries "
            "references, not a copy: p0 the Why line's citations (the owner's words, tier 0) or, for an earlier-form "
            "family, the sources it declares; p1 the row, with its act as need and its completion as outcome; p2 where "
            "it is carried, with capability_refs naming the rows of this matrix whose documentation.design_refs hold a "
            "manual unit the cell cites (extensions.ux.absent_units names a cited unit with no capability row yet; "
            "external_capability_refs names native candidates, never copied here); p3 the owning operation and agent as "
            "written, with the products it names (the native operation stays binding-required); p4 the starting world, "
            "port sources (the code is the p2 rows' own code_refs); p5 the declared grade, with the proof refs as "
            "test_refs and the CASES.md acceptance cases whose row names the story. Empty means the story "
            "source leaves that cell open (an earlier-form story names no starting world, and no place unless "
            "'Where the earlier stories now happen' maps it); never complete or impossible. Placements are derived, "
            "agent-inference; a walk, a grade reached or the owner's EX is recorded only by its own evidence."),
        "row_axis": {"id": "stories", "label": "Stories (docs/experience), in source order", "members": members},
        "column_axis": {"id": "positions", "label": "The six positions and their document tiers", "members": [
            {"id": key, "label": label, "source_ref": f"ProjectCentral/docs/{tier}", "tier": tier}
            for key, label, tier in POSITIONS]},
        "derivation": {
            "generator": f"python3 {GENERATOR} --write",
            "check": f"python3 {GENERATOR} --check",
            "story_reader": "scripts/experience_map.py load_sources (campaign.json and its modules)",
            "decision": "O-I#710", "ticket": "O-I#736",
        },
    }
    return view, records


def capability_homes(header, rows):
    ix = {name: i for i, name in enumerate(header)}
    ids = {row[ix["id"]] for row in rows if row[ix["record_type"]] == "capability"}
    homes, seen = [], set()
    for row in rows:
        if row[ix["record_type"]] != "capability":
            continue
        for home in json.loads(row[ix["extensions"]]).get("capability_homes", []):
            ref = home.get("ref")
            if ref in seen:
                raise Drift(f"{MATRIX_CSV}: {ref} is homed twice")
            if ref != row[ix["id"]] and ref in ids:
                raise Drift(f"{MATRIX_CSV}: {row[ix['id']]} homes {ref}, which has its own row")
            if not home.get("home") or not home.get("semantic") or type(home.get("order")) is not int:
                raise Drift(f"{MATRIX_CSV}: {ref} home needs home, semantic and an integer order")
            seen.add(ref)
            homes.append(home)
    homes.sort(key=lambda home: home["order"])
    if len({home["order"] for home in homes}) != len(homes):
        raise Drift(f"{MATRIX_CSV}: capability home orders repeat")
    return homes


def ts_string(value: str) -> str:
    if "'" in value and '"' not in value:
        return json.dumps(value, ensure_ascii=False)
    return "'" + value.replace("\\", "\\\\").replace("'", "\\'") + "'"


def homes_block(homes) -> str:
    lines = [BEGIN + f" from {MATRIX_CSV} (each row's extensions.capability_homes).",
             f"// Edit the matrix, then run `python3 {GENERATOR} --write`.",
             "", "/** Family homes, in the matrix's home order. */",
             "export const CAPABILITY_HOMES: readonly CapabilityHome[] = ["]
    basis = None
    for home in (h for h in homes if h["home"] != "shell"):
        if home["basis"][0] != basis:
            basis = home["basis"][0]
            lines.append(f"  // {basis}")
        family = FAMILY_TS_NAMES.get(home["home"], ts_string(home["home"]))
        lines.append(f"  {{ref: {ts_string(home['ref'])}, family: {family}, semantic: {ts_string(home['semantic'])}}},")
    lines += ["]", "", "/** Shell-homed capabilities: ref → the shell surface it is. No device. */",
              "export const SHELL_CAPABILITIES: Readonly<Record<string, string>> = {"]
    basis = None
    for home in (h for h in homes if h["home"] == "shell"):
        if home["basis"][0] != basis:
            basis = home["basis"][0]
            lines.append(f"  // {basis}")
        lines.append(f"  {ts_string(home['ref'])}: {ts_string(home['semantic'])},")
    lines += ["}", END]
    return "\n".join(lines)


def derive(root: Path) -> dict[str, str]:
    """Every derived file's expected text, by path."""
    manifest_text, csv_text, header, rows = read_matrix(root)
    manifest = json.loads(manifest_text)
    view, records = story_view(root, header, rows)
    views = [v for v in manifest["views"] if v.get("id") != VIEW_ID]
    manifest["views"] = views + [view]
    kept = [row for row in rows if row[header.index("view_id")] != VIEW_ID]
    out = io.StringIO()
    csv.writer(out, lineterminator="\n").writerows([header, *kept, *records])

    ts_text = (root / HOMES_TS).read_text(encoding="utf-8")
    block = homes_block(capability_homes(header, rows))
    pattern = re.compile(re.escape(BEGIN) + r".*?" + re.escape(END), re.DOTALL)
    if not pattern.search(ts_text):
        raise Drift(f"{HOMES_TS}: the generated block's markers are missing")
    return {
        MATRIX_JSON: json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        MATRIX_CSV: out.getvalue(),
        HOMES_TS: pattern.sub(lambda _: block, ts_text, count=1),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--root", type=Path, default=BASE)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="exit 1 if a derived surface differs (default)")
    mode.add_argument("--write", action="store_true", help="rewrite the derived surfaces")
    args = parser.parse_args(argv)
    try:
        expected = derive(args.root)
    except Drift as error:
        print(f"shell matrix views: {error}", file=sys.stderr)
        return 1
    drifted = [path for path, text in expected.items()
               if (args.root / path).read_bytes() != text.encode("utf-8")]
    if args.write:
        for path in drifted:
            (args.root / path).write_bytes(expected[path].encode("utf-8"))
        print(json.dumps({"written": drifted}))
        return 0
    if drifted:
        for path in drifted:
            print(f"shell matrix views: {path} differs from its derivation", file=sys.stderr)
        print(f"Run `python3 {GENERATOR} --write` and review the diff.", file=sys.stderr)
        return 1
    print(json.dumps({"derived_surfaces_current": sorted(expected)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
