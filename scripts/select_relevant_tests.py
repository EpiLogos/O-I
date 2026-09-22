#!/usr/bin/env python3
"""Select the executable frontend tests relevant to a change, with a recorded
reason for every inclusion.

Explicit source/capability/test relations always include their tests. The
capability/document relations (campaign source_modules -> obligations ->
walk/scenario-bindings.json) determine the additional affected tests from
changed source. Where the Jev integration (AIKit #388) is available it may add
semantic candidate tests; it never excludes an explicitly related test and
never manufactures proof.

Output is data, not a scheduler: pipe --names into `node walk/run.mjs`.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

BASE = Path(__file__).resolve().parents[1]
WALK_ROOT = BASE / "desktop/cradle/walk"
# Paths whose change affects every walk test (the app under test and the
# harness that drives it).
GLOBAL_WALK_PREFIXES = (
    "desktop/cradle/src/",
    "desktop/cradle/index.html",
    "desktop/cradle/vite.config",
    "desktop/cradle/walk/lib/",
    "desktop/cradle/walk/run.mjs",
    "desktop/cradle/walk/run-support.mjs",
    "desktop/cradle/walk/client.ts",
    "desktop/cradle/kernel/",
)
RELATION_PREFIXES = (
    "scripts/experience_map.py",
    "desktop/cradle/walk/scenario-bindings.json",
    "docs/experience/campaign.json",
)


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def module_source_paths(root: Path, module: dict[str, Any], module_path: str) -> set[str]:
    """Every declared file this module's obligations answer to."""
    paths = {module_path, str((root / module_path).resolve())}
    for key in ("story_source", "document_operations_source"):
        if module.get(key):
            paths.add(module[key])
    for ref in (module.get("obligation_sources") or {}).values():
        if isinstance(ref, dict) and ref.get("source_ref"):
            paths.add(ref["source_ref"])
    return paths


def load_field(root: Path) -> tuple[dict[str, Any], dict[str, list[str]], dict[str, dict[str, Any]], set[str]]:
    """Return (bindings, module->obligation ids, obligation->record, campaign-wide source paths)."""
    config = read_json(root / "docs/experience/campaign.json")
    declared = config.get("executable_test_bindings") or {}
    if not declared.get("path"):
        raise SystemExit("campaign.json declares no executable_test_bindings")
    bindings = read_json(root / declared["path"])
    module_obligations: dict[str, list[str]] = {}
    obligation_record: dict[str, dict[str, Any]] = {}
    for module_path in config.get("source_modules", []):
        module = read_json(root / module_path)
        ids = [o["id"] for o in module.get("obligations", [])]
        module_obligations[module_path] = ids
        for o in module.get("obligations", []):
            obligation_record[o["id"]] = {"module": module_path, "obligation": o}
    # The campaign's own shared sources answer to every obligation.
    campaign_paths = {config[key] for key in
                      ("ux_contract", "profile", "story_source", "practice_source",
                       "operator_source", "document_operations_source") if config.get(key)}
    return bindings, module_obligations, obligation_record, campaign_paths


def collect_changed(args: argparse.Namespace) -> list[str]:
    if args.changed:
        changed: list[str] = []
        for item in args.changed:
            path = Path(item)
            if path.is_dir():
                changed.extend(str(p.relative_to(BASE)) for p in path.rglob("*") if p.is_file())
            else:
                changed.append(str(path if path.is_absolute() else path.relative_to(BASE) if path.is_relative_to(BASE) else path))
        return sorted(set(changed))
    if args.git_diff:
        diff = subprocess.run(["git", "diff", "--name-only", args.git_diff],
                              cwd=BASE, capture_output=True, text=True, check=True).stdout
        changed = [line for line in diff.splitlines() if line]
        if args.git_diff in {"HEAD", "main"}:
            others = subprocess.run(["git", "ls-files", "--others", "--exclude-standard"],
                                    cwd=BASE, capture_output=True, text=True, check=True).stdout
            changed += [line for line in others.splitlines() if line]
        return sorted(set(changed))
    raise SystemExit("provide --changed PATH… or --git-diff REV")


def jev_candidates(changed: list[str], tests: dict[str, dict[str, Any]], limit: int) -> dict[str, Any]:
    """Optional semantic relevance instrument. The current integration is the
    AIKit knowledge faculty; it may only ADD candidates through recorded
    source refs. Absent or silent faculty is recorded, never simulated."""
    if not shutil.which("aikit"):
        return {"available": False, "used": False, "candidates": [], "note": "aikit CLI not on PATH"}
    candidates: list[str] = []
    queries = changed[:limit]
    for item in queries:
        result = subprocess.run(["aikit", "knowledge", "search", Path(item).name],
                                capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            continue
        try:
            payload = json.loads(result.stdout)
        except ValueError:
            continue
        for hit in payload.get("hits", []):
            ref = hit.get("path") or hit.get("source_ref") or ""
            for name, binding in tests.items():
                if ref and any(ref.endswith(s) or s in ref for s in binding.get("serves", [])):
                    candidates.append(name)
    return {"available": True, "used": True, "candidates": sorted(set(candidates)),
            "note": f"semantic candidates from {len(queries)} faculty queries; never excluding"}


def main(argv: list[str] | None = None) -> int:
    global BASE
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=BASE, help="repository root (defaults to this checkout)")
    parser.add_argument("--changed", nargs="*", default=[], help="changed paths (files or directories)")
    parser.add_argument("--git-diff", metavar="REV", help="take changed paths from git diff REV (HEAD also counts untracked files)")
    parser.add_argument("--use-jev", action="store_true", help="allow the Jev faculty to ADD semantic candidate tests")
    parser.add_argument("--names", action="store_true", help="print selected walk test names for `node walk/run.mjs`")
    args = parser.parse_args(argv)
    BASE = args.root.resolve()

    bindings, module_obligations, _, campaign_paths = load_field(BASE)
    tests = bindings.get("tests", {})
    obligation_to_tests: dict[str, list[str]] = {}
    for name, binding in tests.items():
        for ref in binding.get("serves", []):
            obligation_to_tests.setdefault(ref, []).append(name)

    changed = collect_changed(args)
    selected: dict[str, dict[str, Any]] = {}

    def include(name: str, reason: str) -> None:
        entry = selected.setdefault(name, {"test": name, "kind": tests[name].get("kind", "walk"), "reasons": []})
        if reason not in entry["reasons"]:
            entry["reasons"].append(reason)

    def include_obligation(obligation_id: str, reason: str) -> None:
        for name in obligation_to_tests.get(obligation_id, []):
            include(name, f"{reason} (obligation {obligation_id})")

    relation_changed = False
    module_paths = {module_path: module_source_paths(BASE, read_json(BASE / module_path), module_path)
                    for module_path in module_obligations}
    for path in changed:
        if path.startswith(RELATION_PREFIXES):
            relation_changed = True
        if path.startswith(GLOBAL_WALK_PREFIXES):
            for name in tests:
                include(name, f"application/harness source under test changed: {path}")
            continue
        test_hit = False
        for name, binding in tests.items():
            file = binding.get("file") or f"desktop/cradle/walk/scenarios/{name}.mjs"
            if path == file or (path.startswith("desktop/cradle/walk/scenarios/") and file.startswith(path)):
                include(name, f"test source changed: {path}")
                test_hit = True
        if test_hit:
            continue
        for module_path, paths in module_paths.items():
            if path in paths:
                for obligation_id in module_obligations[module_path]:
                    include_obligation(obligation_id, f"source module changed: {path}")
        if path in campaign_paths:
            for name in tests:
                include(name, f"campaign-wide source changed: {path}")
    if relation_changed:
        for name in tests:
            include(name, "the declared relation field or its compiler changed; every relation re-validated by running its test")

    jev = {"available": False, "used": False, "candidates": [], "note": "not requested"}
    if args.use_jev:
        jev = jev_candidates(changed, tests, limit=8)
        for name in jev["candidates"]:
            if name in tests:
                include(name, "jev semantic candidate (added, never excluding)")

    selected_names = sorted(selected)
    if args.names:
        print(" ".join(n for n in selected_names if tests[n].get("kind", "walk") == "walk"))
        return 0
    print(json.dumps({
        "changed": changed,
        "selected": [selected[name] for name in selected_names],
        "unbound_tests_not_selected": sorted(set(tests) - set(selected_names)),
        "jev": jev,
        "standing": "selection is inclusion-with-reasons only; empty selection means no declared relation to the changed set",
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
