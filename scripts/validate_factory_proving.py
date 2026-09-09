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
ACTUATION_REVISION = "5eec4639f1c8727865373b27fdcde09fdcca2d53"
ACTUATION_USAGE_SHA256 = "04c94149fa5b9b666473e40bd312f50d10fd2d3fd6d10272bfc2503e51344551"
ACTUATION_USAGE_REPLAY_SHA256 = "0f968d47d8f49b2a3dd042c261c573f0d424c93673e8b3f0ac573d3e79ad6624"


def run(command: list[str], *, expect_success: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(command, text=True, capture_output=True, check=False)
    if expect_success and result.returncode != 0:
        raise AssertionError(f"command failed ({result.returncode}): {' '.join(command[:4])}")
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--factory-source", type=Path, required=True)
    parser.add_argument("--workcell-baseline", type=Path)
    parser.add_argument("--workcell-source", type=Path)
    parser.add_argument("--workcell-usage", type=Path)
    parser.add_argument("--actuation-source", type=Path)
    parser.add_argument("--actuation-usage", type=Path)
    parser.add_argument("--actuation-usage-replay", type=Path)
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

        if bool(args.workcell_source) != bool(args.workcell_usage):
            raise AssertionError("--workcell-source and --workcell-usage are a pair")
        if args.workcell_source:
            usage_state = temp / "usage-state.json"
            usage_snapshot_path = temp / "usage-snapshot.json"
            usage = run(command[:-4] + [
                "--state", str(usage_state),
                "--output", str(usage_snapshot_path),
                "--workcell-source", str(args.workcell_source.resolve()),
                "--workcell-usage", str(args.workcell_usage.resolve()),
            ])
            usage_snapshot = json.loads(usage.stdout)
            Draft202012Validator(SCHEMA).validate(usage_snapshot)
            usage_grades = {item["grade"]: item["standing"] for item in usage_snapshot["claims"]}
            assert usage_grades["M"] == "observed"
            assert usage_snapshot["workcellPin"]["revision"] == "fa47a29fa49a6636675d21309b00c269ac824abb"
            workcell = [item for item in usage_snapshot["evidence"] if item["operation"] == "instances.usage"]
            assert len(workcell) == 1
            receipt = workcell[0]["output"]
            assert receipt["schema"] == "workcell.resource-usage/v1"
            assert usage_snapshot["factoryRefs"]["runRef"] in receipt["external_correlation_refs"]
            assert receipt["provider"]["privacy"] == {"argv_collected": False, "environment_collected": False}

        actuation_values = [args.actuation_source, args.actuation_usage, args.actuation_usage_replay]
        if any(actuation_values) and not all(actuation_values):
            raise AssertionError("Actuation source, observation and replay are a required triple")
        if args.actuation_source:
            actuation_source = args.actuation_source.resolve()
            assert run(["git", "-C", str(actuation_source), "rev-parse", "HEAD"]).stdout.strip() == ACTUATION_REVISION
            assert not run(["git", "-C", str(actuation_source), "status", "--porcelain"]).stdout.strip()
            owner_schema = json.loads((actuation_source / "contracts/model-usage-v1.schema.json").read_text())
            observed_bytes = args.actuation_usage.resolve().read_bytes()
            replay_bytes = args.actuation_usage_replay.resolve().read_bytes()
            assert hashlib.sha256(observed_bytes).hexdigest() == ACTUATION_USAGE_SHA256
            assert hashlib.sha256(replay_bytes).hexdigest() == ACTUATION_USAGE_REPLAY_SHA256
            observed_input = json.loads(observed_bytes)
            replay_input = json.loads(replay_bytes)
            Draft202012Validator(owner_schema).validate(observed_input["event"]["model_usage"])
            Draft202012Validator(owner_schema).validate(replay_input["event"]["model_usage"])

            def actuation_command(label: str, observed_path: Path, replay_path: Path) -> list[str]:
                material_args = []
                if args.workcell_source:
                    material_args = [
                        "--workcell-source", str(args.workcell_source.resolve()),
                        "--workcell-usage", str(args.workcell_usage.resolve()),
                    ]
                return command[:-4] + [
                    "--state", str(temp / f"actuation-{label}-state.json"),
                    "--output", str(temp / f"actuation-{label}-snapshot.json"),
                    *material_args,
                    "--actuation-source", str(actuation_source),
                    "--actuation-usage", str(observed_path),
                    "--actuation-usage-replay", str(replay_path),
                ]

            incomplete = run(command[:-4] + [
                "--state", str(temp / "actuation-incomplete-state.json"),
                "--output", str(temp / "actuation-incomplete-snapshot.json"),
                "--actuation-source", str(actuation_source),
                "--actuation-usage", str(args.actuation_usage.resolve()),
            ], expect_success=False)
            assert incomplete.returncode == 2
            assert not (temp / "actuation-incomplete-state.json").exists()
            assert not (temp / "actuation-incomplete-snapshot.json").exists()

            actuation = run(actuation_command("valid", args.actuation_usage.resolve(), args.actuation_usage_replay.resolve()))
            actuation_snapshot = json.loads(actuation.stdout)
            Draft202012Validator(SCHEMA).validate(actuation_snapshot)
            actuation_grades = {item["grade"]: item["standing"] for item in actuation_snapshot["claims"]}
            assert actuation_grades["P"] == "observed"
            assert actuation_grades["M"] == ("observed" if args.workcell_source else "unavailable")
            assert actuation_snapshot["actuationPin"] == {
                "revision": ACTUATION_REVISION,
                "modelUsageSchemaPath": "contracts/model-usage-v1.schema.json",
                "modelUsageSchemaSha256": "42215b3f06dffe5bfba53b0f51db6400d5b8739098c4fb1275f7a006579615cb",
            }
            actuation_evidence = [item for item in actuation_snapshot["evidence"] if item["owner"] == "actuation"]
            assert [item["operation"] for item in actuation_evidence] == ["activity.model-usage", "activity.model-usage.replay"]
            assert actuation_evidence[0]["output"] == observed_input
            assert actuation_evidence[1]["output"] == replay_input
            for item in actuation_evidence:
                canonical = json.dumps(item["output"], separators=(",", ":"), sort_keys=True).encode()
                assert item["outputSha256"] == hashlib.sha256(canonical).hexdigest()
            assert observed_input["deduplicated"] is False and replay_input["deduplicated"] is True
            assert observed_input["event"] == replay_input["event"]
            usage = observed_input["event"]["model_usage"]
            assert actuation_snapshot["factoryRefs"]["runRef"] in usage["correlation"]["external_refs"]
            assert usage["tokens"] == {"standing": "normalized-from-native", "input": 20236, "output": 10}
            assert usage["cache"] == {"standing": "normalized-from-native", "read_input": 12288, "creation_input": 0}
            assert usage["provider"] == {"standing": "not-reported"}
            assert usage["model"] == {"standing": "not-reported"}
            assert usage["timing"]["latency"] == {"standing": "not-reported"}
            assert usage["cost"] == {"standing": "not-reported"}
            serialized = json.dumps(actuation_snapshot).lower()
            for forbidden in ['"prompt"', '"content"', '"messages"', '"argv"', '"environment"']:
                assert forbidden not in serialized

            adversarial = []
            missing_correlation = copy.deepcopy(observed_input)
            missing_correlation["event"]["model_usage"]["correlation"]["external_refs"] = ["external:unrelated"]
            adversarial.append(("foreign-correlation", missing_correlation, replay_input))
            content_bearing = copy.deepcopy(observed_input)
            content_bearing["event"]["model_usage"]["provider_facts"] = {"prompt": "must-not-be-retained"}
            adversarial.append(("content-bearing", content_bearing, replay_input))
            conflicting_replay = copy.deepcopy(replay_input)
            conflicting_replay["event"]["model_usage"]["tokens"]["output"] += 1
            adversarial.append(("conflicting-replay", observed_input, conflicting_replay))
            false_replay = copy.deepcopy(replay_input)
            false_replay["deduplicated"] = False
            adversarial.append(("false-replay", observed_input, false_replay))
            contradictory_unavailable = copy.deepcopy(observed_input)
            contradictory_unavailable["event"]["model_usage"]["provider"] = {
                "standing": "not-reported", "name": "invented-provider"
            }
            contradictory_unavailable["event"]["model_usage"]["timing"]["latency"] = {
                "standing": "not-reported", "milliseconds": 1
            }
            contradictory_unavailable["event"]["model_usage"]["cost"] = {
                "standing": "not-reported", "amount": 0, "currency": "USD"
            }
            adversarial.append(("contradictory-unavailable", contradictory_unavailable, replay_input))
            for label, bad_observed, bad_replay in adversarial:
                observed_path = temp / f"{label}-observed.json"
                replay_path = temp / f"{label}-replay.json"
                observed_path.write_text(json.dumps(bad_observed))
                replay_path.write_text(json.dumps(bad_replay))
                rejected = run(actuation_command(label, observed_path, replay_path), expect_success=False)
                assert rejected.returncode == 2
                state_path = temp / f"actuation-{label}-state.json"
                output_path = temp / f"actuation-{label}-snapshot.json"
                assert not state_path.exists()
                assert not state_path.with_name(f".{state_path.name}.lock").exists()
                assert not output_path.exists()

    print("O:I Factory proving floor: PASS")


if __name__ == "__main__":
    main()
