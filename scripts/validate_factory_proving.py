#!/usr/bin/env python3
"""Exercise O:I's proving floor through the exact accepted Factory binary."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

from jsonschema import Draft202012Validator


ROOT = Path(__file__).resolve().parents[1]
SCHEMA = json.loads((ROOT / "schemas/oi.factory-proving-snapshot-v1.schema.json").read_text())
FACTORY_REVISION = "12a721dbbb51e3c70d52ef00220efa859ef930fd"


def run(command: list[str], *, expect_success: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(command, text=True, capture_output=True, check=False)
    if expect_success and result.returncode != 0:
        raise AssertionError(f"command failed ({result.returncode}): {' '.join(command[:4])}")
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--factory-source", type=Path, required=True)
    parser.add_argument("--workcell-baseline", type=Path)
    args = parser.parse_args()
    checked_in = json.loads((ROOT / "suite/factory-proving-floor.json").read_text())
    Draft202012Validator(SCHEMA).validate(checked_in)
    checked_in_grades = {item["grade"]: item["standing"] for item in checked_in["claims"]}
    assert checked_in_grades == {"C": "observed", "D": "observed", "P": "unavailable", "M": "unavailable", "H": "unavailable"}
    assert all(item["owner"] == "factory" for item in checked_in["evidence"])
    factory_source = args.factory_source.resolve()
    observed_revision = run(["git", "-C", str(factory_source), "rev-parse", "HEAD"]).stdout.strip()
    assert observed_revision == FACTORY_REVISION
    assert not run(["git", "-C", str(factory_source), "status", "--porcelain"]).stdout.strip()

    run(["cargo", "build", "--locked", "--manifest-path", str(factory_source / "factory/Cargo.toml"), "--bin", "factory"])
    run(["cargo", "build", "--locked", "--manifest-path", str(ROOT / "cli/Cargo.toml"), "--bin", "oi"])
    factory = factory_source / "target/debug/factory"
    oi = ROOT / "cli/target/debug/oi"
    fixture_root = factory_source / "contracts/factory/fixtures"

    with tempfile.TemporaryDirectory(prefix="oi-factory-proving-") as directory:
        temp = Path(directory)
        state = temp / "factory-state.json"
        snapshot_path = temp / "snapshot.json"
        command = [
            str(oi), "prove", "factory",
            "--factory", str(factory),
            "--factory-source", str(factory_source),
            "--request", str(fixture_root / "oi-self-hosting-commission-request.json"),
            "--workflow-mutation", str(fixture_root / "oi-self-hosting-workflow-mutation.json"),
            "--state", str(state),
            "--output", str(snapshot_path),
        ]
        result = run(command)
        snapshot = json.loads(result.stdout)
        assert snapshot == json.loads(snapshot_path.read_text())
        Draft202012Validator(SCHEMA).validate(snapshot)
        assert snapshot["factoryRevision"] == FACTORY_REVISION
        assert snapshot["factoryRefs"]["runRef"].startswith("run:")
        operations = [item["operation"] for item in snapshot["evidence"]]
        assert operations == [
            "development.commission", "development.commission.replay",
            "development.mutate", "development.mutate.replay",
            "development.commission-read", "development.project",
            "development.journey", "development.run", "development.workflow-units",
        ]
        for item in snapshot["evidence"]:
            canonical = json.dumps(item["output"], separators=(",", ":"), sort_keys=True).encode()
            # serde_json's default map is key-ordered; Python's sorted form matches its output hash.
            assert item["outputSha256"] == hashlib.sha256(canonical).hexdigest()
        grades = {item["grade"]: item["standing"] for item in snapshot["claims"]}
        assert grades == {"C": "observed", "D": "observed", "P": "unavailable", "M": "unavailable", "H": "unavailable"}
        units = next(item["output"] for item in snapshot["evidence"] if item["operation"] == "development.workflow-units")
        assert {item["key"] for item in units["units"]} >= {"factory-guardian-owner-surface", "aikit-guardian-consumer"}
        assert all(item["currentCorrelation"]["lowerCorrelationStatus"] == "not-owner-established" for item in units["units"])

        before_state = state.read_bytes()
        before_snapshot = snapshot_path.read_bytes()
        refused = run(command, expect_success=False)
        assert refused.returncode == 2
        assert state.read_bytes() == before_state
        assert snapshot_path.read_bytes() == before_snapshot

        invalid_mutation = json.loads((fixture_root / "oi-self-hosting-workflow-mutation.json").read_text())
        invalid_mutation["mutation"]["runRef"] = "run:00000000000000000000000000"
        invalid_mutation_path = temp / "invalid-mutation.json"
        invalid_mutation_path.write_text(json.dumps(invalid_mutation))
        rollback_state = temp / "rollback-state.json"
        rollback_output = temp / "rollback-snapshot.json"
        late_failure = run([
            str(oi), "prove", "factory",
            "--factory", str(factory),
            "--factory-source", str(factory_source),
            "--request", str(fixture_root / "oi-self-hosting-commission-request.json"),
            "--workflow-mutation", str(invalid_mutation_path),
            "--state", str(rollback_state),
            "--output", str(rollback_output),
        ], expect_success=False)
        assert late_failure.returncode == 2
        assert not rollback_state.exists()
        assert not rollback_state.with_name(f".{rollback_state.name}.lock").exists()
        assert not rollback_output.exists()

        invalid = copy.deepcopy(snapshot)
        next(item for item in invalid["claims"] if item["grade"] == "P")["standing"] = "observed"
        # The floor intentionally cannot claim provider evidence: C/D and unavailable P/M/H are fixed here.
        errors = list(Draft202012Validator(SCHEMA).iter_errors(invalid))
        assert errors

        if args.workcell_baseline:
            material_state = temp / "material-state.json"
            material_snapshot_path = temp / "material-snapshot.json"
            material = run(command[:-4] + [
                "--state", str(material_state),
                "--output", str(material_snapshot_path),
                "--workcell-baseline", str(args.workcell_baseline.resolve()),
            ])
            material_snapshot = json.loads(material.stdout)
            Draft202012Validator(SCHEMA).validate(material_snapshot)
            material_grades = {item["grade"]: item["standing"] for item in material_snapshot["claims"]}
            assert material_grades["M"] == "provisional-unaccepted"
            workcell = [item for item in material_snapshot["evidence"] if item["owner"] == "workcell"]
            assert len(workcell) == 1
            assert workcell[0]["output"]["schema"] == "workcell.registry/v1"

    print("O:I Factory proving floor: PASS")


if __name__ == "__main__":
    main()
