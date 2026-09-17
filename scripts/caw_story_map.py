#!/usr/bin/env python3
"""Read the authored story map; emit UX readings or a source-linked matrix view.

This validates/compiles planning structure only. It does not launch Agents,
interpret authority, import passed receipts, or establish feature acceptance.
No network or third-party dependency is required. Native matrices, when supplied,
are read-only sources of capability identity; their contents are never mutated.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DOC_DIR = Path("docs/ux")
ROW = re.compile(r"^\| `(ux\.oi\.[a-z0-9-]+)`\s+—\s+(.+?)\s*\|")
CORE_COLUMNS = [
    "id", "record_type", "view_id", "row_id", "column_id", "capability_refs",
    "need", "operation", "outcome", "implementation_status", "standing",
    "source_refs", "code_refs", "test_refs", "account_ref", "relation",
    "coverage", "extensions", "question",
]


def story_rows(text: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for number, line in enumerate(text.splitlines(), 1):
        match = ROW.match(line)
        if not match:
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) != 5:
            raise ValueError(f"story {match.group(1)} at line {number}: expected five cells")
        if any(not cell for cell in cells):
            raise ValueError(f"story {match.group(1)} at line {number}: empty experience cell")
        rows.append({"id": match.group(1), "story": match.group(2),
                     "entry_state": cells[1], "agent_work": cells[2],
                     "outcome": cells[3], "branch": cells[4], "line": number})
    if not rows:
        raise ValueError("no authored child stories found")
    if len({r["id"] for r in rows}) != len(rows):
        raise ValueError("duplicate authored story identity")
    return rows


def validate_bindings(rows: list[dict[str, Any]], bindings: dict[str, Any]) -> dict[str, dict[str, Any]]:
    if bindings.get("native_matrix_protocol") != "ql-capability-matrix/1":
        raise ValueError("must retain the native capability matrix protocol")
    if bindings.get("runtime_support_claimed") is not False or bindings.get("executed_story_results") != []:
        raise ValueError("source map cannot claim runtime support or executed story results")
    if bindings.get("profile_revision") != 1:
        raise ValueError("unsupported source participation profile revision")
    sources = bindings.get("capability_sources", {})
    practices = bindings.get("practice_sources", {})
    if not sources or not practices:
        raise ValueError("native capability and practice sources must be explicit")
    expected = {r["id"] for r in rows}
    assigned: dict[str, dict[str, Any]] = {}
    family_ids: set[str] = set()
    for family in bindings.get("families", []):
        family_id = family.get("id", "")
        if not family_id or family_id in family_ids:
            raise ValueError("missing or duplicate family identity")
        family_ids.add(family_id)
        for field in ("stories", "capability_candidates", "practice_sources", "context_required", "conditions", "acceptance_refs"):
            value = family.get(field)
            if not isinstance(value, list) or not value or any(not isinstance(v, str) or not v.strip() for v in value):
                raise ValueError(f"{family_id}: nonempty explicit {field} required")
        for cap in family["capability_candidates"]:
            parts = cap.split(".", 2)
            if len(parts) != 3 or parts[0] != "cap" or parts[1] not in sources:
                raise ValueError(f"{family_id}: unknown native capability source for {cap}")
        for practice in family["practice_sources"]:
            if practice not in practices:
                raise ValueError(f"{family_id}: unregistered practice source {practice}")
        for story in family["stories"]:
            if story not in expected or story in assigned:
                raise ValueError(f"{family_id}: absent or multiply bound story {story}")
            assigned[story] = family
    missing = expected - assigned.keys()
    if missing:
        raise ValueError(f"stories without participation bindings: {sorted(missing)}")
    return assigned


def native_capability_check(bindings: dict[str, Any], paths: dict[str, Path]) -> dict[str, Any]:
    """Check only supplied native capability sources; absent sources stay unresolved."""
    candidates = sorted({cap for f in bindings["families"] for cap in f["capability_candidates"]})
    known: dict[str, set[str]] = {}
    bases: dict[str, str] = {}
    for owner, path in paths.items():
        if owner not in bindings["capability_sources"]:
            raise ValueError(f"unknown native matrix owner {owner}")
        data = path.read_bytes()
        bases[owner] = hashlib.sha256(data).hexdigest()
        with path.open(encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            if not {"id", "record_type"}.issubset(reader.fieldnames or []):
                raise ValueError(f"{owner}: native matrix lacks id/record_type")
            known[owner] = {r["id"] for r in reader if r["record_type"] == "capability"}
    checked, unresolved = [], []
    for cap in candidates:
        owner = cap.split(".", 2)[1]
        if owner not in known:
            unresolved.append(cap)
        elif cap not in known[owner]:
            raise ValueError(f"native {owner} source does not contain capability {cap}")
        else:
            checked.append(cap)
    return {"verified_identity_refs": checked, "unresolved_identity_refs": unresolved,
            "source_sha256": bases, "meaning_or_implementation_verified": False}


def compile_map(root: Path, matrices: dict[str, Path] | None = None) -> dict[str, Any]:
    path = root / DOC_DIR / "EXISTING-WORK-STORIES.md"
    source = path.read_text(encoding="utf-8")
    binding_bytes = (root / DOC_DIR / "participation-bindings.json").read_bytes()
    bindings = json.loads(binding_bytes)
    rows = story_rows(source)
    assigned = validate_bindings(rows, bindings)
    records = []
    for row in rows:
        family = assigned[row["id"]]
        records.append({
            "id": row["id"], "kind": "story", "parent_ref": family["id"],
            "actor": "person and authorised working Agent; actual participants bound per trial",
            "story": row["story"], "entry_state": row["entry_state"],
            "act": row["story"], "experienced_outcome": row["outcome"],
            "return_state": row["outcome"], "branch_condition": row["branch"],
            "surface_refs": [],
            "source_refs": [f"{DOC_DIR}/EXISTING-WORK-STORIES.md#L{row['line']}"],
            "standing": bindings["standing"],
            "extensions": {"participation": {
                "profile_revision": 1, "agent_work": row["agent_work"],
                "candidate_capability_refs": family["capability_candidates"],
                "practice_source_keys": family["practice_sources"],
                "context_requirements": family["context_required"],
                "determining_conditions": family["conditions"],
                "original_acceptance_refs": family["acceptance_refs"],
                "unresolved_bindings": family.get("unresolved_bindings", []),
                "source_family_extensions": {k: v for k, v in family.items() if k not in {"id", "stories", "capability_candidates", "practice_sources", "context_required", "conditions", "acceptance_refs", "unresolved_bindings"}},
                "binding_state": "source-bound-candidates; exact step/context/operation selection required",
                "trial_results": [], "human_ex_refs": []}}
        })
    return {
        "profile": str(DOC_DIR / "STORY-PARTICIPATION-PROFILE.md"),
        "reading_standing": "derived-source-reading-not-execution-evidence",
        "source_sha256": hashlib.sha256(source.encode()).hexdigest(),
        "bindings_sha256": hashlib.sha256(binding_bytes).hexdigest(),
        "story_count": len(records), "family_count": len(bindings["families"]),
        "capability_identity_check": native_capability_check(bindings, matrices or {}),
        "practice_sources": bindings["practice_sources"], "stories": records,
        "whole_feature_verdict": None,
    }


def matrix_files(reading: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, str]]]:
    """Derive a named-axis candidate relation view in the existing matrix form."""
    stories = reading["stories"]
    caps = sorted({cap for s in stories for cap in s["extensions"]["participation"]["candidate_capability_refs"]})
    view = "story-capability-candidates"
    manifest = {
        "protocol": "ql-capability-matrix/1", "matrix_id": "oi-experience-candidate-links",
        "anchor_ref": str(DOC_DIR / "EXISTING-WORK-CAMPAIGN.md"), "default_view": view,
        "views": [{"id": view, "title": "Stories and native capability candidates",
                   "semantics": "Source-bound family candidates to narrow per step; not implementation coverage, necessity of every cell or observed success.",
                   "row_axis": {"id": "stories", "label": "Intended activities", "members": [{"id": s["id"], "label": s["story"], "source_ref": s["source_refs"][0]} for s in stories]},
                   "column_axis": {"id": "native-capabilities", "label": "Native capability references", "members": [{"id": cap, "label": cap} for cap in caps]}}],
        "extensions": {"source_reading_sha256": reading["source_sha256"], "binding_sha256": reading["bindings_sha256"],
                       "external_capability_identity_check": reading["capability_identity_check"],
                       "capability_owner": "native source; no copied capability definitions", "whole_feature_verdict": None},
    }
    rows = []
    for story in stories:
        participation = story["extensions"]["participation"]
        for cap in participation["candidate_capability_refs"]:
            row = dict.fromkeys(CORE_COLUMNS, "")
            row.update({"id": f"rel.{story['id']}.{cap}", "record_type": "relation",
                        "view_id": view, "row_id": story["id"], "column_id": cap,
                        "capability_refs": json.dumps([cap]), "need": story["story"],
                        "operation": participation["agent_work"], "outcome": story["experienced_outcome"],
                        "implementation_status": "not-assessed-by-source-map", "standing": "source-grounded-candidate-relation",
                        "source_refs": ";".join(story["source_refs"]),
                        "account_ref": str(DOC_DIR / "EXISTING-WORK-CAMPAIGN.md"),
                        "relation": "candidate-support-requiring-step-resolution", "coverage": "unassessed",
                        "extensions": json.dumps({"ux_refs": [story["id"]], "participation": participation}, ensure_ascii=False),
                        "question": "Is this capability needed and operable for this exact story step and situation?"})
            rows.append(row)
    return manifest, rows


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--matrix", action="append", default=[], metavar="OWNER=CSV", help="optional actual native matrices for read-only identity validation")
    parser.add_argument("--output", type=Path, help="new JSON output file; existing files are never overwritten")
    parser.add_argument("--matrix-output", type=Path, help="new directory for derived matrix.csv and matrix.json; not a new canonical capability source")
    args = parser.parse_args()
    try:
        matrices: dict[str, Path] = {}
        for item in args.matrix:
            owner, separator, path = item.partition("=")
            if not separator or not owner or not path or owner in matrices:
                raise ValueError("--matrix requires a unique OWNER=CSV")
            matrices[owner] = Path(path)
        reading = compile_map(args.root, matrices)
        encoded = json.dumps(reading, ensure_ascii=False, indent=2) + "\n"
        if args.output:
            with args.output.open("x", encoding="utf-8") as handle:
                handle.write(encoded)
        else:
            print(encoded, end="")
        if args.matrix_output:
            manifest, rows = matrix_files(reading)
            args.matrix_output.mkdir(exist_ok=False)
            with (args.matrix_output / "matrix.json").open("x", encoding="utf-8") as handle:
                json.dump(manifest, handle, ensure_ascii=False, indent=2)
                handle.write("\n")
            with (args.matrix_output / "matrix.csv").open("x", encoding="utf-8", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=CORE_COLUMNS)
                writer.writeheader()
                writer.writerows(rows)
    except (ValueError, OSError, KeyError, TypeError) as error:
        parser.exit(2, f"story source check failed: {error}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
