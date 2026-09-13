#!/usr/bin/env python3
"""Planning-only projection of #65 story source; never executes or certifies a feature.

Uses the existing UX fields and ql-capability-matrix/1 relation carrier. It does
not mutate native matrices, private context, source standing or test evidence.
"""
from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import io
import json
import re
import sys
from pathlib import Path
from typing import Any

BASE = Path(__file__).resolve().parents[1]
STORY_ID = re.compile(r"[A-Z]{2}[0-9]{2}\Z")
PRACTICE_ID = re.compile(r"P[0-9]{2}\Z")
COLUMNS = [
    "id", "record_type", "view_id", "row_id", "column_id", "capability_refs",
    "need", "operation", "outcome", "implementation_status", "standing",
    "source_refs", "code_refs", "test_refs", "account_ref", "relation",
    "coverage", "extensions",
]


def digest(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def table_rows(text: str, pattern: re.Pattern[str], width: int) -> list[tuple[int, list[str]]]:
    rows = []
    for number, line in enumerate(text.splitlines(), 1):
        if not line.startswith("|"):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        first = cells[0].split()[0] if cells and cells[0] else ""
        if not pattern.fullmatch(first):
            continue
        if len(cells) != width or not all(cells):
            raise ValueError(f"malformed source row {first} at line {number}")
        rows.append((number, cells))
    return rows


def load_sources(root: Path) -> dict[str, Any]:
    config = read_json(root / "docs/experience/campaign.json")
    source = (root / config["story_source"]).read_bytes()
    practice_bytes = (root / config["practice_source"]).read_bytes()
    practices: dict[str, Any] = {}
    for line, cells in table_rows(practice_bytes.decode("utf-8"), PRACTICE_ID, 4):
        key = cells[0].split()[0]
        if key in practices:
            raise ValueError(f"duplicate practice {key}")
        practices[key] = {"id": key, "label": cells[0], "trigger_and_near_miss": cells[1],
                          "context": cells[2], "procedure_and_readback": cells[3],
                          "source_path": config["practice_source"], "line": line,
                          "source_digest": digest(practice_bytes)}
    expected: dict[str, dict[str, Any]] = {}
    for family in config["families"]:
        if not family["source_refs"] or not family["proof_refs"]:
            raise ValueError(f"family has no source/proof basis: {family['id']}")
        for key in family["ids"]:
            if key in expected or not STORY_ID.fullmatch(key) or not key.startswith(family["id"]):
                raise ValueError(f"duplicate or malformed declared story {key}")
            expected[key] = family
    stories = []
    seen = set()
    for line, cells in table_rows(source.decode("utf-8"), STORY_ID, 5):
        key, human, agent, outcome, failure = cells
        # QL owns its own full record. The local two-column summaries are not
        # parsed as substitute stories; malformed five-column imports are refused.
        if key not in expected:
            raise ValueError(f"undeclared local story {key}")
        if key in seen:
            raise ValueError(f"duplicate story {key}")
        seen.add(key)
        family = expected[key]
        refs = list(dict.fromkeys(re.findall(r"\bP[0-9]{2}\b", agent)))
        if not refs or any(ref not in practices for ref in refs):
            raise ValueError(f"unresolved practice relation for {key}: {refs}")
        stories.append({
            "id": key, "kind": "ux", "parent_ref": family["id"],
            "actor": "person and situated agent/operator as specified in the source row",
            "story": human, "entry_state": human, "act": human,
            "experienced_outcome": outcome, "return_state": outcome,
            "branch_condition": failure, "surface_refs": [],
            "source_refs": [config["story_source"], *family["source_refs"]],
            "standing": "specified", "extensions": {
                "source_locator": {"path": config["story_source"], "row_id": key,
                                   "line": line, "digest": digest(source)},
                "agent_ux": {"trigger": human, "determining_conditions": agent,
                    "context_requirements": [practices[ref]["context"] for ref in refs],
                    "practice_requirements": [copy.deepcopy(practices[ref]) for ref in refs],
                    "capability_requirements": {"owners": family["owners"],
                        "binding_status": "binding-required", "native_refs": []},
                    "steps": {"source_statement": agent,
                        "episode_binding": "Expand meaningful handoffs with actual actors, inputs, contracts and readback; do not infer from this projection."},
                    "failure_and_reentry": failure},
                "existing_proof_refs": family["proof_refs"],
                "runtime_readiness": "not-assessed", "execution_evidence": [],
                "human_experience": None,
                "projection_note": "Shared source cells are repeated losslessly, not inferred into new state semantics. Actual step/entry/surface bindings belong to a selected episode."
            }
        })
    if seen != set(expected):
        raise ValueError(f"missing stories: {sorted(set(expected) - seen)}")
    return {"planning_only": True, "feature_verdict": None,
            "source_digest": digest(source), "practice_digest": digest(practice_bytes),
            "config": config, "practices": practices, "stories": stories,
            "external_ql": {"binding_status": "source-root-required"},
            "capability_inventory": [], "capability_bindings": []}


def include_ql(result: dict[str, Any], root: Path) -> None:
    spec = result["config"]["delegated_ql"]
    trace_bytes = (root / spec["trace_path"]).read_bytes()
    standing_bytes = (root / spec["standing_path"]).read_bytes()
    trace, standing = json.loads(trace_bytes), json.loads(standing_bytes)
    ids = [item["id"] for item in trace["stories"]]
    if len(ids) != len(set(ids)) or not set(spec["known_ids"]).issubset(ids):
        raise ValueError("QL trace is duplicate or omits a source-declared story; reconcile native source explicitly")
    result["external_ql"] = {"binding_status": "source-read-not-runtime-proof",
        "repository": spec["repository"], "path": spec["trace_path"],
        "trace_digest": digest(trace_bytes), "standing_digest": digest(standing_bytes),
        "trace": trace, "publication_standing": standing}


def read_matrix(owner: str, path: Path) -> list[dict[str, Any]]:
    data = path.read_bytes()
    reader = csv.DictReader(io.StringIO(data.decode("utf-8-sig")))
    if not {"id", "record_type"}.issubset(reader.fieldnames or []):
        raise ValueError(f"{owner}: not a native capability CSV: {path}")
    result, seen = [], set()
    for row in reader:
        if row.get("record_type") != "capability":
            continue
        key = row.get("id", "").strip()
        if not key or key in seen:
            raise ValueError(f"{owner}: empty/duplicate native capability {key}")
        seen.add(key)
        result.append({"repository": owner, "capability_id": key,
                       "source_path": str(path), "source_digest": digest(data),
                       "native_record": row, "coverage_disposition": "uncovered"})
    if not result:
        raise ValueError(f"{owner}: no capability definitions read from {path}; use its actual source-specific inventory")
    return result


def apply_bindings(result: dict[str, Any], bindings: list[dict[str, Any]]) -> None:
    inventory = {(row["repository"], row["capability_id"]): row for row in result["capability_inventory"]}
    if len(inventory) != len(result["capability_inventory"]):
        raise ValueError("ambiguous native capability identity across supplied matrices")
    stories = {row["id"]: row for row in result["stories"]}
    ql_ids = {"QL-MEF:" + row["id"] for row in result["external_ql"].get("trace", {}).get("stories", [])}
    allowed = {"direct", "transitive", "deferred", "not-applicable", "retired", "uncovered"}
    for binding in bindings:
        key = (binding["repository"], binding["capability_id"])
        if key not in inventory:
            raise ValueError(f"binding target not read from native source: {key}")
        native = inventory[key]
        if binding["source_digest"] != native["source_digest"]:
            raise ValueError(f"stale native capability basis: {key}")
        disposition = binding["disposition"]
        if disposition not in allowed:
            raise ValueError(f"unsupported coverage disposition {disposition}")
        ids = binding.get("story_ids", [])
        if any(key not in stories and key not in ql_ids for key in ids):
            raise ValueError("binding contains unknown or unread QL story")
        if disposition in {"direct", "transitive"} and not ids:
            raise ValueError("coverage relation requires a named story")
        if disposition == "transitive" and not binding.get("support_path"):
            raise ValueError("transitive coverage requires the actual support path")
        if disposition in {"deferred", "not-applicable", "retired"} and not binding.get("reason"):
            raise ValueError("non-executed disposition requires its reason")
        if disposition == "deferred" and not (binding.get("owner") and binding.get("reentry_condition")):
            raise ValueError("deferment requires owner and re-entry condition")
        native.setdefault("coverage_relations", []).append(copy.deepcopy(binding))
        native["coverage_disposition"] = "relations-recorded-not-executed"
        result["capability_bindings"].append(copy.deepcopy(binding))
        for key in ids:
            if key in stories and disposition in {"direct", "transitive"}:
                req = stories[key]["extensions"]["agent_ux"]["capability_requirements"]
                req["native_refs"].append(copy.deepcopy(binding))
                # One link is not evidence that every required capability is bound.
                req["binding_status"] = "partial-source-links-require-episode-review"


def relation_projection(result: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, str]]]:
    practices = result["practices"]
    manifest = {"protocol": "ql-capability-matrix/1", "matrix_id": "oi-experience-practice-relations",
        "anchor_ref": "docs/experience/STORIES.md", "default_view": "story-practice",
        "views": [{"id": "story-practice", "title": "Which conditions require this practice?",
            "semantics": "Declared practice requirements, not execution. Omitted cells make no assertion and are not proof that no relation exists.",
            "row_axis": {"id": "stories", "label": "Intended activities", "members": [
                {"id": row["id"], "label": row["story"], "source_ref": "docs/experience/STORIES.md"}
                for row in result["stories"]]},
            "column_axis": {"id": "practices", "label": "Source-qualified practice conditions", "members": [
                {"id": key, "label": row["label"], "source_ref": row["source_path"]}
                for key, row in practices.items()]}}],
        "extensions": {"planning_only": True, "source_digest": result["source_digest"],
                       "profile": "docs/experience/STORY-PROFILE.md", "feature_verdict": None}}
    rows = []
    for story in result["stories"]:
        agent = story["extensions"]["agent_ux"]
        for practice in agent["practice_requirements"]:
            row = dict.fromkeys(COLUMNS, "")
            row.update({"id": f"rel.{story['id']}.{practice['id']}", "record_type": "relation",
                "view_id": "story-practice", "row_id": story["id"], "column_id": practice["id"],
                "capability_refs": "[]", "need": story["story"],
                "operation": agent["determining_conditions"], "outcome": story["experienced_outcome"],
                "implementation_status": "not-assessed; source relation only", "standing": "specified",
                "source_refs": json.dumps(story["source_refs"], ensure_ascii=False),
                "test_refs": json.dumps(story["extensions"]["existing_proof_refs"]),
                "account_ref": "docs/experience/STORIES.md", "relation": "requires situated practice",
                "coverage": "unexercised", "extensions": json.dumps({"ux": {
                    "story_ref": story["id"], "story_revision": result["source_digest"],
                    "perspective": "human-and-agent", "relation_kind": "practised-by",
                    "practice_refs": [practice], "external_capability_refs": agent["capability_requirements"]["native_refs"],
                    "binding_status": "binding-required" if not agent["capability_requirements"]["native_refs"] else "source-bound-not-executed",
                    "failure_and_reentry": story["branch_condition"]}}, ensure_ascii=False)})
            rows.append(row)
    return manifest, rows


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=BASE)
    parser.add_argument("--output-dir", type=Path, help="New directory for derived planning files; never overwrites")
    parser.add_argument("--ql-root", type=Path, help="Read the complete current QL trace and publication standing")
    parser.add_argument("--matrix", action="append", default=[], metavar="OWNER=PATH", help="Read native capability CSV; repeat for real owner inventories")
    parser.add_argument("--bindings", type=Path, help="Explicit reviewed source-qualified coverage links; not test results")
    args = parser.parse_args(argv)
    try:
        result = load_sources(args.root)
        if args.ql_root:
            include_ql(result, args.ql_root)
        for item in args.matrix:
            owner, sep, path = item.partition("=")
            if not sep or not owner or not path:
                raise ValueError("--matrix requires OWNER=PATH")
            result["capability_inventory"].extend(read_matrix(owner, Path(path)))
        if args.bindings:
            apply_bindings(result, read_json(args.bindings))
        manifest, rows = relation_projection(result)
        if args.output_dir:
            args.output_dir.mkdir(parents=True, exist_ok=False)
            for name, value in [("ux-reading.json", result), ("matrix.json", manifest)]:
                (args.output_dir / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            with (args.output_dir / "matrix.csv").open("w", encoding="utf-8", newline="") as target:
                writer = csv.DictWriter(target, fieldnames=COLUMNS)
                writer.writeheader()
                writer.writerows(rows)
        print(json.dumps({"planning_source_valid": True, "local_stories": len(result["stories"]),
            "practice_relations": len(rows), "ql": result["external_ql"]["binding_status"],
            "native_capabilities_read": len(result["capability_inventory"]),
            "uncovered_native_capabilities": sum(row["coverage_disposition"] == "uncovered" for row in result["capability_inventory"]),
            "feature_verdict": None, "runtime_readiness": "not-assessed"}))
        return 0  # Valid planning source only, explicitly not product acceptance.
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(json.dumps({"planning_source_valid": False, "error": str(error), "feature_verdict": None}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
