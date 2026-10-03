#!/usr/bin/env python3
"""Publish only verified actual native fixture paths to existing kernel gates.

No shell evaluation, fallback fixture, source mutation or native execution.
The parent fixture preparer owns actual native producers and time admission.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import re
import shlex

KEYS = frozenset({
    "QL_RETAINED_PERFORMANCE_FIXTURE",
    "QL_RETAINED_SOURCE_PERFORMANCE_FIXTURE",
    "QL_RETAINED_PERFORMANCE_CONTEXT_FIXTURE",
    "QL_RETAINED_PERFORMANCE_WORKLOAD_DIRECTORY",
    "QL_RETAINED_SOURCE_WORKLOAD_DIRECTORY",
    "QL_RETAINED_PERFORMANCE_RESERVATION_DIRECTORY",
    "QL_RETAINED_PERFORMANCE_CHECKPOINT_FIXTURE",
    "QL_RETAINED_PERFORMANCE_MANAGEMENT_FIXTURE",
    "QL_RETAINED_PERFORMANCE_MANAGEMENT_DIRECTORY",
    "QL_RETAINED_PERFORMANCE_MANAGED_ORDER_DIRECTORY",
    "QL_CURRENT_RECEIVING_ARTIFACT_DIRECTORY",
    "OI_NATIVE_PERFORMANCE_DELIVERY_DIRECTORY",
    "OI_RETAINED_PERFORMANCE_TEST_HOME",
})
DIRECTORIES = frozenset(key for key in KEYS if key.endswith("DIRECTORY") or key.endswith("HOME"))

def required_fixture_paths() -> set[str]:
    """Exact outputs of the preparer's admitted native command family.

    Both complete 180-edition workloads are required. The SourceForm workload
    also carries its original source and opening checkpoint. Count admission
    must not discard those bodies to fit a guessed combined inventory budget.
    Optional offline outputs are absent at the preparer's actual command arity.
    """
    paths = {
        "retained-performance-fixture.json", "retained-source-performance-fixture.json",
        "retained-performance-context-fixture.json", "retained-performance-checkpoint-fixture.json",
        "retained-performance-management-fixture.json",
        "native-packets/baseline.packet.json", "native-packets/baseline.basis.json",
    }
    paths.update("current-receiving/" + kind + ".source-performance.json" for kind in ("world", "personal", "shared"))
    paths.update("native-management/" + name for name in (
        "baseline.pending.management.json", "baseline.basis.json", "baseline.applied-events.json",
        "baseline.input-journal.json", "baseline.current.management.json", "manifest.json"))
    paths.update("native-managed-order/" + kind + "." + name for kind in ("release", "panic") for name in (
        "restore.json", "restored-history.json", "restored-checkpoint.json", "original-queued-checkpoint.json",
        "original-score-admission.json", "pending-checkpoint.json", "score-admissions.json", "checkpoint.json",
        "history.json", "basis.json", "continued-checkpoint.json"))
    paths.update("native-score-reservations/" + name for name in (
        "cancel.before.json", "cancel.after.json", "cancel.ack.json", "lost.before.json", "lost.after.json", "basis.json"))
    for family in ("native-retained-workload", "native-retained-source-workload"):
        paths.update(family + "/" + name for name in ("basis.json", "manifest.json"))
        paths.update(family + "/edition-" + str(index) + "." + suffix
            for index in range(1, 181) for suffix in ("history.json", "checkpoint.json"))
    paths.update("native-retained-source-workload/" + name for name in ("source-performance.json", "initial.checkpoint.json"))
    return paths

def inside(raw: str, root: Path) -> Path:
    if not isinstance(raw, str) or not raw or len(raw) > 4096 or any(c in raw for c in "\r\n\x00"):
        raise ValueError("native fixture path is invalid")
    path = Path(raw)
    if not path.is_absolute():
        raise ValueError("native fixture path must be absolute")
    resolved = path.resolve(strict=True)
    if not resolved.is_relative_to(root):
        raise ValueError("native fixture escaped its unique admitted run")
    return resolved

def read_json(path: Path, limit: int) -> dict:
    if not path.is_file() or not 0 < path.stat().st_size <= limit:
        raise ValueError("native fixture receipt budget/file differs")
    value = json.loads(path.read_bytes())
    if not isinstance(value, dict):
        raise ValueError("native fixture receipt is not an object")
    return value

def verified_environment(result: Path, expected: str, output_root: Path) -> dict[str, str]:
    if not re.fullmatch(r"[0-9a-f]{40}", expected):
        raise ValueError("qualified QL source must be an exact revision")
    root = output_root.resolve(strict=True)
    if not root.is_dir():
        raise ValueError("native output root is not a directory")
    pointer = read_json(result, 16384)
    receipt_path = inside(pointer.get("receipt"), root)
    receipt = read_json(receipt_path, 1024 * 1024)
    run = inside(receipt.get("run"), root)
    if (receipt.get("schema") != "oi.retained-performance-fixture-preparation/v1"
        or receipt.get("status") != "ready"
        or receipt.get("actual_ql_head") != expected
        or receipt.get("expected_ql_head") != expected
        or run == root or receipt_path.parent != run
        or not re.fullmatch(r"native-performance-[0-9a-f]{32}", run.name)):
        raise ValueError("actual native fixture source/result/unique custody differs")
    environment_path = inside(pointer.get("environment_file"), run)
    if environment_path != inside(receipt.get("environment_file"), run):
        raise ValueError("native environment does not belong to actual result")
    if not environment_path.is_file() or not 0 < environment_path.stat().st_size <= 65536:
        raise ValueError("native fixture environment bound differs")
    commands = receipt.get("commands")
    if not isinstance(commands, list) or not commands or len(commands) > 32:
        raise ValueError("actual producer command receipts absent/excessive")
    for command in commands:
        if not isinstance(command, dict) or command.get("exit_code") != 0 or command.get("timed_out"):
            raise ValueError("actual native producer failed or timed out")
        log = inside(command.get("log"), run)
        if not log.is_file():
            raise ValueError("actual producer original log missing")
    records = receipt.get("fixtures")
    required = required_fixture_paths()
    if not isinstance(records, list) or len(records) != len(required):
        raise ValueError("actual native fixture inventory membership differs")
    if any(not isinstance(item, dict) for item in records):
        raise ValueError("actual native fixture inventory entry differs")
    declared = [inside(item.get("path"), run) for item in records]
    if len(set(declared)) != len(declared) or {path.relative_to(run).as_posix() for path in declared} != required:
        raise ValueError("actual native fixture inventory membership differs")
    inventory: set[Path] = set()
    for item in records:
        if not isinstance(item, dict):
            raise ValueError("actual native fixture inventory entry differs")
        path = inside(item.get("path"), run)
        if path in inventory or not path.is_file() or not 0 < path.stat().st_size <= 32 * 1024 * 1024:
            raise ValueError("actual native fixture missing/duplicated/excessive")
        if path.stat().st_size != item.get("bytes") or not re.fullmatch(r"[0-9a-f]{64}", item.get("sha256", "")):
            raise ValueError("native fixture byte/hash declaration differs")
        with path.open("rb") as stream:
            if hashlib.file_digest(stream, "sha256").hexdigest() != item["sha256"]:
                raise ValueError("actual native fixture changed after producer qualification")
        inventory.add(path)
    result_values: dict[str, str] = {}
    for line in environment_path.read_text().splitlines():
        words = shlex.split(line, comments=False)
        if len(words) != 2 or words[0] != "export" or "=" not in words[1]:
            raise ValueError("native environment contains non-path operations")
        key, value = words[1].split("=", 1)
        if key not in KEYS or key in result_values:
            raise ValueError("native environment has unknown/duplicate variable")
        path = inside(value, run)
        if key in DIRECTORIES:
            if not path.is_dir():
                raise ValueError("native fixture directory custody missing")
            # These two are the actual C owner's fresh output destinations.
            # Every native INPUT directory still needs qualified producer bytes.
            if key not in {"OI_RETAINED_PERFORMANCE_TEST_HOME", "OI_NATIVE_PERFORMANCE_DELIVERY_DIRECTORY"} and not any(p.is_relative_to(path) for p in inventory):
                raise ValueError("native fixture directory has no actual qualified artifacts")
        elif path not in inventory:
            raise ValueError("native fixture path is absent from actual inventory")
        result_values[key] = str(path)
    if result_values.keys() != KEYS:
        raise ValueError("native kernel fixture environment is incomplete")
    return result_values

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--result", type=Path, required=True)
    parser.add_argument("--expected-ql-head", required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--github-env", type=Path, required=True)
    args = parser.parse_args()
    values = verified_environment(args.result, args.expected_ql_head, args.output_root)
    # Publish only after ALL original source/artifact checks pass. Never source
    # generated shell code, reinterpret receipt text or repurpose HOME.
    with args.github_env.open("a") as out:
        out.write("".join(key + "=" + values[key] + "\n" for key in sorted(values)))
    print(json.dumps({"schema": "oi.retained-performance-ci-environment/v1",
        "actual_ql_head": args.expected_ql_head, "variables": sorted(values),
        "standing": "verified actual fixture paths; no native workflow/installed/hardware verdict"}, sort_keys=True))

if __name__ == "__main__":
    main()
