#!/usr/bin/env python3
"""Planning-only projection of #65 source; never executes or certifies a feature.

Read the existing UX profile and ql-capability-matrix/1 relation carrier.
Native matrices, private context, source standing and evidence are never mutated.
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
STORY_ID = re.compile(r"(?!UX)[A-Z]{2}[0-9]{2}\Z")
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


def source_path(root: Path, relative: str) -> Path:
    base = root.resolve()
    target = (base / relative).resolve()
    if Path(relative).is_absolute() or not target.is_relative_to(base):
        raise ValueError(f"source path escapes its declared repository: {relative}")
    return target


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
    # Retain complete source, including family prose/negation/unknown metadata.
    # This is an operator's reading, not permission to disclose it all to actors.
    documents: dict[str, dict[str, str]] = {}

    def read(relative: str) -> bytes:
        data = source_path(root, relative).read_bytes()
        documents[relative] = {"digest": digest(data), "text": data.decode("utf-8")}
        return data

    config_bytes = read("docs/experience/campaign.json")
    config = json.loads(config_bytes)
    source_config = copy.deepcopy(config)
    primary_path = config["story_source"]
    primary = read(primary_path)
    practice_bytes = read(config["practice_source"])
    # These are declared dependencies, never optional if their locator exists.
    for key in ("profile", "operator_source", "document_operations_source"):
        if config.get(key):
            read(config[key])
    declared_bindings = config.get("executable_test_bindings") or {}
    if declared_bindings.get("path"):
        read(declared_bindings["path"])
    modules = []
    module_paths = config.get("source_modules", [])
    if len(module_paths) != len(set(module_paths)):
        raise ValueError("duplicate source module")
    for path in module_paths:
        module = json.loads(read(path))
        module["source_module_path"] = path
        modules.append(module)
        read(module["story_source"])
        if module.get("document_operations_source"):
            read(module["document_operations_source"])
        for family in module["families"]:
            expanded = copy.deepcopy(family)
            expanded["story_source"] = module["story_source"]
            config["families"].append(expanded)

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
    family_ids = set()
    for family in config["families"]:
        if family["id"] in family_ids:
            raise ValueError(f"duplicate family {family['id']}")
        family_ids.add(family["id"])
        if not family["source_refs"] or not family["proof_refs"]:
            raise ValueError(f"family has no source/proof basis: {family['id']}")
        for key in family["ids"]:
            if key in expected or not STORY_ID.fullmatch(key) or not key.startswith(family["id"]):
                raise ValueError(f"duplicate or malformed declared story {key}")
            expected[key] = family
    stories, seen = [], set()
    story_paths = list(dict.fromkeys([primary_path, *[m["story_source"] for m in modules]]))
    for path in story_paths:
        source = documents[path]
        for line, cells in table_rows(source["text"], STORY_ID, 5):
            key, human, agent, outcome, failure = cells
            if key not in expected:
                raise ValueError(f"undeclared local story {key}")
            if key in seen:
                raise ValueError(f"duplicate story {key}")
            seen.add(key)
            family = expected[key]
            if family.get("story_source", primary_path) != path:
                raise ValueError(f"story {key} is in the wrong declared source")
            refs = list(dict.fromkeys(re.findall(r"\bP[0-9]{2}\b", agent)))
            if not refs or any(ref not in practices for ref in refs):
                raise ValueError(f"unresolved practice relation for {key}: {refs}")
            stories.append({
                "id": key, "kind": "ux", "parent_ref": family["id"],
                "actor": "person and situated agent/operator as specified in the source row",
                "story": human, "entry_state": human, "act": human,
                "experienced_outcome": outcome, "return_state": outcome,
                "branch_condition": failure, "surface_refs": [],
                "source_refs": [path, *family["source_refs"]],
                "standing": "specified", "extensions": {
                    "source_locator": {"path": path, "row_id": key, "line": line,
                                       "digest": source["digest"]},
                    "source_family": copy.deepcopy(family),
                    "document_role": {"tier": config.get("ux_tier", 1),
                        "meaning": "intended experience / vision", "adoption": "not-conferred-by-projection"},
                    "agent_ux": {"trigger": human, "determining_conditions": agent,
                        "context_requirements": [practices[ref]["context"] for ref in refs],
                        "practice_requirements": [copy.deepcopy(practices[ref]) for ref in refs],
                        "capability_requirements": {"owners": family["owners"],
                            "binding_status": "binding-required", "native_refs": [], "candidates": []},
                        "steps": {"source_statement": agent,
                            "episode_binding": "Expand meaningful handoffs from the full family/source with actual actors, inputs, contracts and readback."},
                        "failure_and_reentry": failure},
                    "existing_proof_refs": copy.deepcopy(family["proof_refs"]),
                    "inherited_obligations": [],
                    "runtime_readiness": "not-assessed", "execution_evidence": [],
                    "human_experience": None,
                    "projection_note": "Row cells and complete source are retained, not inferred into runtime state. Bind actual steps/entry/surface in an episode."
                }
            })
    if seen != set(expected):
        raise ValueError(f"missing stories: {sorted(set(expected) - seen)}")
    obligations, candidates = [], []
    obligation_ids = set()
    by_id = {story["id"]: story for story in stories}
    for module in modules:
        required = module.get("required_obligation_ids", [])
        actual = [o["id"] for o in module.get("obligations", [])]
        if len(required) != len(set(required)) or len(actual) != len(set(actual)):
            raise ValueError("duplicate inherited obligation")
        if set(required) != set(actual):
            raise ValueError("inherited obligation coverage differs from declared source scope")
        for original in module.get("obligations", []):
            obligation = copy.deepcopy(original)
            key = obligation["id"]
            if key in obligation_ids:
                raise ValueError(f"duplicate inherited obligation {key}")
            obligation_ids.add(key)
            basis = module.get("obligation_sources", {}).get(obligation["source"])
            if not basis or not basis.get("source_ref") or not obligation.get("native_locator"):
                raise ValueError(f"inherited obligation lacks source: {key}")
            ids = obligation["story_ids"]
            if not ids or len(ids) != len(set(ids)) or any(s not in by_id for s in ids):
                raise ValueError(f"inherited obligation has unknown/duplicate/empty story binding: {key}")
            grades = obligation["required_evidence"]
            if not grades or not set(grades).issubset({"D", "C", "P", "M", "H"}):
                raise ValueError(f"invalid evidence requirement: {key}")
            obligation.update(source_basis=copy.deepcopy(basis),
                              source_module=module["source_module_path"],
                              mapping_status="specified-not-exercised")
            obligations.append(obligation)
            for story_id in ids:
                by_id[story_id]["extensions"]["inherited_obligations"].append(copy.deepcopy(obligation))
                by_id[story_id]["extensions"]["existing_proof_refs"].append(key)
        for candidate in module.get("capability_candidates", []):
            for field in ("repository", "matrix_path", "inspected_blob", "capability_id", "reason", "binding_status"):
                if not candidate.get(field):
                    raise ValueError(f"capability candidate missing {field}")
            ids = candidate.get("story_ids", [])
            if not ids or any(s not in by_id for s in ids):
                raise ValueError("capability candidate refers to unknown story")
            candidates.append(copy.deepcopy(candidate))
            for story_id in ids:
                by_id[story_id]["extensions"]["agent_ux"]["capability_requirements"]["candidates"].append(copy.deepcopy(candidate))
    source_basis = {path: row["digest"] for path, row in documents.items()}
    reading_digest = digest(json.dumps(source_basis, sort_keys=True).encode("utf-8"))
    return {"planning_only": True, "feature_verdict": None,
            "source_digest": digest(primary), "practice_digest": digest(practice_bytes),
            "reading_digest": reading_digest, "source_basis": source_basis,
            "source_documents": documents, "source_config": source_config,
            "source_modules": modules, "config": config, "practices": practices,
            "stories": stories, "inherited_obligations": obligations,
            "capability_candidates": candidates,
            "external_ql": {"binding_status": "source-root-required"},
            "capability_inventory": [], "capability_bindings": []}


def include_ql(result: dict[str, Any], root: Path) -> None:
    spec = result["config"]["delegated_ql"]
    trace_bytes = source_path(root, spec["trace_path"]).read_bytes()
    standing_bytes = source_path(root, spec["standing_path"]).read_bytes()
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
    if not isinstance(bindings, list):
        raise ValueError("bindings must be a reviewed list")
    # Validate the complete proposal before applying any of its source relations.
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
        if any(s not in stories and s not in ql_ids for s in ids):
            raise ValueError("binding contains unknown or unread QL story")
        if disposition in {"direct", "transitive"} and not ids:
            raise ValueError("coverage relation requires a named story")
        if disposition == "transitive" and not binding.get("support_path"):
            raise ValueError("transitive coverage requires the actual support path")
        if disposition in {"deferred", "not-applicable", "retired"} and not binding.get("reason"):
            raise ValueError("non-executed disposition requires its reason")
        if disposition == "deferred" and not (binding.get("owner") and binding.get("reentry_condition")):
            raise ValueError("deferment requires owner and re-entry condition")
    for binding in bindings:
        native = inventory[(binding["repository"], binding["capability_id"])]
        native.setdefault("coverage_relations", []).append(copy.deepcopy(binding))
        native["coverage_disposition"] = "relations-recorded-not-executed"
        result["capability_bindings"].append(copy.deepcopy(binding))
        for story_id in binding.get("story_ids", []):
            if story_id in stories and binding["disposition"] in {"direct", "transitive"}:
                req = stories[story_id]["extensions"]["agent_ux"]["capability_requirements"]
                req["native_refs"].append(copy.deepcopy(binding))
                req["binding_status"] = "partial-source-links-require-episode-review"


NEGATIVE_CLASSES = {
    "missing", "withheld", "denied", "stale", "conflicting", "interrupted",
    "duplicate", "late", "provider-unavailable", "reconnect", "changed-source",
    "unsupported-capability", "partial-return",
}
# #201 grade law: D deterministic, C cross-product conformance, P real
# provider/harness, M physical/material, H human UX/Recognition. A passed
# deterministic walk always earns at most D; C requires the receipt itself to
# carry live/native or real-kernel-bridge standing (receipt grade A/B).
AUTOMATION_GRADES = {"D", "C"}
CLAIMS_TO_RECEIPT_FLOOR = {"C": {"A", "B"}}


def load_coverage(result: dict[str, Any], root: Path) -> None:
    """Join declared executable-test bindings and committed walk receipts into
    the obligation field. Declared relations are validated against the source;
    receipts are read as latest performed evidence and never upgrade a grade:
    no automation earns P, M or H."""
    declared = result["config"].get("executable_test_bindings")
    if not declared:
        return
    bindings_path = source_path(root, declared["path"])
    root = root.resolve()  # /tmp is a symlink on some hosts; keep one resolved basis
    bindings_bytes = bindings_path.read_bytes()
    document = json.loads(bindings_bytes)
    if document.get("schema") != "oi.cradle.walk.bindings/v1":
        raise ValueError("executable_test_bindings: unknown schema")
    tests = document.get("tests", {})
    if not isinstance(tests, dict):
        raise ValueError("executable_test_bindings: tests must be an object")
    base = bindings_path.parent
    artifacts = base / "artifacts"

    obligation_ids = {o["id"] for o in result["inherited_obligations"]}
    story_ids = {s["id"] for s in result["stories"]}
    vocabulary = set(document.get("negative_vocabulary", []))
    if vocabulary - NEGATIVE_CLASSES:
        raise ValueError(f"unknown negative classes declared: {sorted(vocabulary - NEGATIVE_CLASSES)}")

    parsed = {}
    for name, entry in tests.items():
        kind = entry.get("kind", "walk")
        if kind == "walk":
            test_file = base / "scenarios" / f"{name}.mjs"
        elif kind == "node-test":
            test_file = source_path(root, entry["path"])
        else:
            raise ValueError(f"binding {name}: unknown kind {kind}")
        if not test_file.exists():
            raise ValueError(f"binding {name}: test file not found: {test_file}")
        serves = entry.get("serves", [])
        if not serves or len(serves) != len(set(serves)):
            raise ValueError(f"binding {name}: serves must be a non-empty list of distinct refs")
        unknown = [ref for ref in serves if ref not in obligation_ids and ref not in story_ids]
        if unknown:
            raise ValueError(f"binding {name}: serves unknown obligation/story refs: {unknown}")
        branches = entry.get("branches", {})
        for ref, indices in branches.items():
            if ref not in serves:
                raise ValueError(f"binding {name}: branch key {ref} is not in serves")
            if ref not in obligation_ids:
                raise ValueError(f"binding {name}: branches only attach to obligations, not {ref}")
            obligation = next(o for o in result["inherited_obligations"] if o["id"] == ref)
            required = obligation.get("required_branches", [])
            if any(not isinstance(i, int) or i < 0 or i >= len(required) for i in indices):
                raise ValueError(f"binding {name}: branch index out of range for {ref}")
        negatives = entry.get("negatives", [])
        if set(negatives) - vocabulary:
            raise ValueError(f"binding {name}: negative outside declared vocabulary: {sorted(set(negatives) - vocabulary)}")
        claims = entry.get("claims_grade", "D")
        if claims not in AUTOMATION_GRADES:
            raise ValueError(f"binding {name}: claims_grade {claims} outside what automation may earn ({sorted(AUTOMATION_GRADES)})")
        parsed[name] = {
            "test": name, "kind": kind,
            "file": str(test_file.relative_to(root)),
            "digest": digest(test_file.read_bytes()),
            "serves": list(serves),
            "branches": {ref: sorted(set(idx)) for ref, idx in branches.items()},
            "negatives": list(dict.fromkeys(negatives)),
            "claims_grade": claims,
            "note": entry.get("note", ""),
        }

    # Latest performed evidence: the committed receipt for a walk test. A
    # receipt binds its own recorded cut (head + dirty digest); the reading
    # reports that context rather than claiming currency.
    performed: dict[str, dict[str, Any]] = {}
    for name, binding in parsed.items():
        receipt_file = artifacts / f"{name}.json"
        if binding["kind"] != "walk" or not receipt_file.exists():
            continue
        receipt = json.loads(receipt_file.read_text())
        checks = receipt.get("checks", [])
        source = receipt.get("environment", {}).get("source", {})
        performed[name] = {
            "receipt": f"{declared['receipts']}{name}.json",
            "receipt_grade": receipt.get("grade"),
            "passed": receipt.get("passed") is True,
            "generated_at": receipt.get("generated_at"),
            "checks_passed": sum(1 for c in checks if c.get("ok")),
            "checks_total": len(checks),
            "recorded_head": source.get("repository_head"),
            "recorded_dirty_digest": source.get("dirty_digest"),
        }
        grade = receipt.get("grade")
        if performed[name]["passed"] and binding["claims_grade"] == "C":
            if grade not in CLAIMS_TO_RECEIPT_FLOOR["C"]:
                raise ValueError(
                    f"binding {name}: claims cross-product conformance (C) but its receipt grade is {grade}; "
                    "C requires native/real-kernel receipt standing (A/B)")

    for obligation in result["inherited_obligations"]:
        key = obligation["id"]
        bound = [b for b in parsed.values() if key in b["serves"]]
        receipts = [performed[b["test"]] for b in bound if b["test"] in performed]
        earned = set()
        for b in bound:
            record = performed.get(b["test"])
            if record and record["passed"]:
                earned.add(b["claims_grade"])
        covered = sorted({i for b in bound for i in b["branches"].get(key, []) if performed.get(b["test"], {}).get("passed")})
        required = list(obligation["required_evidence"])
        branches = obligation.get("required_branches", [])
        obligation["executable_coverage"] = {
            "tests": bound,
            "performed": receipts,
            "earned_grades": sorted(earned),
            "remaining_grades": [g for g in required if g not in earned],
            "covered_branches": covered,
            "unproved_branches": [t for i, t in enumerate(branches) if i not in covered],
            "negatives_exercised": sorted({n for b in bound for n in b["negatives"]}),
        }
    for story in result["stories"]:
        story["extensions"]["executable_tests"] = [
            b for b in parsed.values() if story["id"] in b["serves"]]

    result["executable_bindings"] = {
        "declared_path": declared["path"],
        "bindings_digest": digest(bindings_bytes),
        "tests": parsed,
        "performed": performed,
        "negative_vocabulary": sorted(vocabulary),
    }


def coverage_reading(result: dict[str, Any]) -> dict[str, Any]:
    """The one generated reading: which obligations have executable D/C
    coverage, which grades and branches remain, which walks prove what, and
    where the authoritative source lives. Not acceptance; source retains
    authority over product meaning."""
    bindings = result.get("executable_bindings")
    if not bindings:
        raise ValueError("coverage reading requested but no executable_test_bindings are declared")
    obligations = []
    for obligation in result["inherited_obligations"]:
        coverage = obligation["executable_coverage"]
        latest = max(coverage["performed"], key=lambda p: p["generated_at"] or "", default=None)
        obligations.append({
            "id": obligation["id"], "module": obligation["source_module"],
            "source_ref": obligation["source_basis"]["source_ref"],
            "native_locator": obligation["native_locator"],
            "requirement": obligation["requirement"],
            "story_ids": obligation["story_ids"],
            "required_evidence": obligation["required_evidence"],
            "branches_total": len(obligation.get("required_branches", [])),
            "earned_grades": coverage["earned_grades"],
            "remaining_grades": coverage["remaining_grades"],
            "covered_branches": coverage["covered_branches"],
            "unproved_branches": coverage["unproved_branches"],
            "tests": [{"test": b["test"], "kind": b["kind"], "file": b["file"],
                       "claims_grade": b["claims_grade"], "note": b["note"]} for b in coverage["tests"]],
            "latest_performed": latest,
            "negatives_exercised": coverage["negatives_exercised"],
        })
    negative = {name: sorted({b["test"] for b in bindings["tests"].values() if name in b["negatives"]})
                for name in bindings["negative_vocabulary"]}
    bound_ids = {o["id"] for o in obligations if o["tests"]}
    return {
        "schema": "oi.experience.coverage-reading/v1",
        "standing": "generated reading from declared source and committed receipts; planning-only; the source retains authority and no verdict is conferred",
        "grade_law": {
            "D": "deterministic (autonomous/CI)",
            "C": "cross-product conformance",
            "P": "real provider/harness — never earned by automation here",
            "M": "physical/material — never earned by automation here",
            "H": "human UX/Recognition — never earned by automation here",
        },
        "generated_from": {
            "reading_digest": result["reading_digest"],
            "source_basis": result["source_basis"],
            "bindings_path": bindings["declared_path"],
            "bindings_digest": bindings["bindings_digest"],
        },
        "summary": {
            "obligations_total": len(result["inherited_obligations"]),
            "obligations_with_executable_test": len(bound_ids),
            "obligations_with_passing_receipt": len({o["id"] for o in result["inherited_obligations"]
                                                     if any(p["passed"] for p in o["executable_coverage"]["performed"])}),
            "branches_total": sum(o["branches_total"] for o in obligations),
            "branches_covered_by_passing_receipt": sum(len(o["covered_branches"]) for o in obligations),
            "p_m_h_grades_remaining": sum(
                1 for o in result["inherited_obligations"]
                for g in o["executable_coverage"]["remaining_grades"] if g in {"P", "M", "H"}),
            "stories_with_executable_test": sum(1 for s in result["stories"] if s["extensions"]["executable_tests"]),
        },
        "unbound_obligations": sorted({o["id"] for o in obligations} - bound_ids),
        "negative_coverage": negative,
        "obligations": obligations,
    }


def write_coverage_reading(reading: dict[str, Any], prefix: Path) -> None:
    prefix.parent.mkdir(parents=True, exist_ok=True)
    prefix.with_suffix(".json").write_text(json.dumps(reading, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = [
        "# Executable frontend coverage reading (generated)",
        "",
        f"Generated from declared source and committed walk receipts — planning-only, not acceptance.",
        f"Bindings: `{reading['generated_from']['bindings_path']}` · reading digest `{reading['generated_from']['reading_digest'][:16]}…`",
        "",
        "| obligation | grades required | earned (automation) | remaining | branches covered | executable tests | latest receipt |",
        "|---|---|---|---|---|---|---|",
    ]
    for o in reading["obligations"]:
        latest = o["latest_performed"]
        tests = ", ".join(t["test"] for t in o["tests"]) or "—"
        when = f"{latest['passed'] and 'PASS' or 'FAIL'} {latest['generated_at'][:10]} ({latest['receipt_grade']})" if latest else "—"
        lines.append(
            f"| {o['id']} | {'/'.join(o['required_evidence'])} | {'/'.join(o['earned_grades']) or '—'} "
            f"| {'/'.join(o['remaining_grades']) or '—'} | {len(o['covered_branches'])}/{o['branches_total']} | {tests} | {when} |")
    lines += ["", "P (real provider/harness), M (physical/material) and H (human UX/Recognition) are never earned by deterministic frontend automation; they remain with their owning proving rounds (#201–#205).", ""]
    prefix.with_suffix(".md").write_text("\n".join(lines), encoding="utf-8")


def relation_projection(result: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, str]]]:
    practices = result["practices"]
    story_axis = {"id": "stories", "label": "Intended activities", "members": [
        {"id": row["id"], "label": row["story"],
         "source_ref": row["extensions"]["source_locator"]["path"]}
        for row in result["stories"]]}
    manifest = {"protocol": "ql-capability-matrix/1", "matrix_id": "oi-experience-practice-relations",
        "anchor_ref": "docs/experience/STORIES.md", "default_view": "story-practice",
        "views": [{"id": "story-practice", "title": "Which conditions require this practice?",
            "semantics": "Declared practice requirements, not execution. Empty cells are unassessed, never proof of absence or success.",
            "row_axis": copy.deepcopy(story_axis),
            "column_axis": {"id": "practices", "label": "Source-qualified practice conditions", "members": [
                {"id": key, "label": row["label"], "source_ref": row["source_path"]}
                for key, row in practices.items()]}}],
        "extensions": {"planning_only": True, "source_digest": result["source_digest"],
                       "reading_digest": result["reading_digest"], "source_basis": result["source_basis"],
                       "profile": "docs/experience/STORY-PROFILE.md", "feature_verdict": None}}
    rows = []
    for story in result["stories"]:
        agent = story["extensions"]["agent_ux"]
        locator = story["extensions"]["source_locator"]
        for practice in agent["practice_requirements"]:
            row = dict.fromkeys(COLUMNS, "")
            row.update({"id": f"rel.{story['id']}.{practice['id']}", "record_type": "relation",
                "view_id": "story-practice", "row_id": story["id"], "column_id": practice["id"],
                "capability_refs": "[]", "need": story["story"],
                "operation": agent["determining_conditions"], "outcome": story["experienced_outcome"],
                "implementation_status": "not-assessed; source relation only", "standing": "specified",
                "source_refs": ";".join(story["source_refs"]),
                "test_refs": ";".join(story["extensions"]["existing_proof_refs"]),
                "account_ref": locator["path"], "relation": "requires situated practice",
                "coverage": "unexercised", "extensions": json.dumps({"ux": {
                    "story_ref": story["id"], "story_revision": locator["digest"],
                    "reading_revision": result["reading_digest"],
                    "perspective": "human-and-agent", "relation_kind": "practised-by",
                    "practice_refs": [practice], "external_capability_refs": agent["capability_requirements"]["native_refs"],
                    "capability_candidates": agent["capability_requirements"]["candidates"],
                    "binding_status": "binding-required" if not agent["capability_requirements"]["native_refs"] else "source-bound-not-executed",
                    "failure_and_reentry": story["branch_condition"]}}, ensure_ascii=False)})
            rows.append(row)
    obligations = result["inherited_obligations"]
    if obligations:
        manifest["views"].append({"id": "story-obligation", "title": "Which original proving obligation constrains this activity?",
            "semantics": "Source-derived obligation links, not executed proof. Empty means unassessed. A brief local requirement does not replace its full native definition.",
            "row_axis": copy.deepcopy(story_axis), "column_axis": {"id": "obligations", "label": "Original source obligations",
                "members": [{"id": o["id"], "label": o["native_locator"], "source_ref": o["source_basis"]["source_ref"]} for o in obligations]}})
        story_map = {s["id"]: s for s in result["stories"]}
        for obligation in obligations:
            for story_id in obligation["story_ids"]:
                story = story_map[story_id]
                row = dict.fromkeys(COLUMNS, "")
                row.update({"id": f"rel.{story_id}.{obligation['id']}", "record_type": "relation",
                    "view_id": "story-obligation", "row_id": story_id, "column_id": obligation["id"],
                    "capability_refs": "[]", "need": story["story"], "outcome": story["experienced_outcome"],
                    "implementation_status": "not-assessed; source requirement only", "standing": "specified",
                    "source_refs": ";".join([story["extensions"]["source_locator"]["path"], obligation["source_basis"]["source_ref"]]),
                    "test_refs": obligation["id"], "account_ref": story["extensions"]["source_locator"]["path"],
                    "relation": obligation["requirement"], "coverage": "unexercised",
                    "extensions": json.dumps({"ux": {"story_ref": story_id,
                        "story_revision": story["extensions"]["source_locator"]["digest"],
                        "perspective": "human-and-agent", "relation_kind": "tested-by",
                        "binding_status": "binding-required", "existing_proof_refs": [copy.deepcopy(obligation)],
                        "evidence": []}}, ensure_ascii=False)})
                rows.append(row)
    return manifest, rows


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=BASE)
    parser.add_argument("--output-dir", type=Path, help="New directory for derived planning files; never overwrites")
    parser.add_argument("--ql-root", type=Path, help="Read the complete current QL trace and publication standing")
    parser.add_argument("--matrix", action="append", default=[], metavar="OWNER=PATH", help="Read native capability CSV; repeat for real owner inventories")
    parser.add_argument("--bindings", type=Path, help="Explicit reviewed source-qualified coverage links; not test results")
    parser.add_argument("--coverage-out", type=Path, help="Write the generated executable-coverage reading as PREFIX.json and PREFIX.md")
    args = parser.parse_args(argv)
    try:
        result = load_sources(args.root)
        if args.ql_root:
            include_ql(result, args.ql_root)
        load_coverage(result, args.root)
        for item in args.matrix:
            owner, sep, path = item.partition("=")
            if not sep or not owner or not path:
                raise ValueError("--matrix requires OWNER=PATH")
            result["capability_inventory"].extend(read_matrix(owner, Path(path)))
        if args.bindings:
            apply_bindings(result, read_json(args.bindings))
        manifest, rows = relation_projection(result)
        if args.coverage_out:
            write_coverage_reading(coverage_reading(result), args.coverage_out)
        if args.output_dir:
            args.output_dir.mkdir(mode=0o700, parents=True, exist_ok=False)
            for name, value in [("ux-reading.json", result), ("matrix.json", manifest)]:
                (args.output_dir / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            with (args.output_dir / "matrix.csv").open("w", encoding="utf-8", newline="") as target:
                writer = csv.DictWriter(target, fieldnames=COLUMNS)
                writer.writeheader()
                writer.writerows(rows)
        print(json.dumps({"planning_source_valid": True, "local_stories": len(result["stories"]),
            "practice_relations": sum(r["view_id"] == "story-practice" for r in rows),
            "inherited_obligations": len(result["inherited_obligations"]),
            "obligation_relations": sum(r["view_id"] == "story-obligation" for r in rows),
            "capability_candidates": len(result["capability_candidates"]),
            "ql": result["external_ql"]["binding_status"],
            "native_capabilities_read": len(result["capability_inventory"]),
            "uncovered_native_capabilities": sum(r["coverage_disposition"] == "uncovered" for r in result["capability_inventory"]),
            "executable_test_bindings": len(result.get("executable_bindings", {}).get("tests", {})),
            "obligations_with_passing_receipt": sum(
                1 for o in result["inherited_obligations"]
                if any(p["passed"] for p in o.get("executable_coverage", {}).get("performed", []))),
            "feature_verdict": None, "runtime_readiness": "not-assessed"}))
        return 0
    except (OSError, ValueError, KeyError, TypeError, csv.Error) as error:
        print(json.dumps({"planning_source_valid": False, "error": str(error), "feature_verdict": None}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
