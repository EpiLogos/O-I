#!/usr/bin/env python3
"""Produce the real native FIELD input required by the existing kernel tests.

This qualifies codec input, not a World, Scene, installed instrument or the
complete QL owner suite. The owner retains the producer and all its assertions.
"""

import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import tempfile
import time


PRODUCER = (
    "continuous::host::dense_field_source_tests::"
    "actual_dense_field_source_keeps_all_65000_original_samples_and_later_basis"
)
PRODUCER_SOURCE = "crates/ql-mef/src/continuous/dense_field_source_tests.rs"
PROCESS_HELPER = Path(__file__).resolve().parents[1] / "desktop/cradle/tests/native-expression-local.py"


def fingerprint(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return {"path": str(path), "bytes": path.stat().st_size, "sha256": digest.hexdigest()}


def export(name, value, destination):
    if "\n" in value or "\r" in value:
        raise ValueError("native prerequisite path must fit one environment line")
    if destination:
        with Path(destination).open("a", encoding="utf-8") as stream:
            stream.write(f"{name}={value}\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ql-source", type=Path, required=True)
    parser.add_argument("--expected-revision", required=True)
    parser.add_argument("--output-base", type=Path, required=True)
    args = parser.parse_args()
    if not re.fullmatch(r"[0-9a-f]{40}", args.expected_revision):
        parser.error("--expected-revision must be an exact owner Git commit")
    source = args.ql_source.resolve(strict=True)
    args.output_base.mkdir(parents=True, exist_ok=True)
    output = Path(tempfile.mkdtemp(prefix="native-dense-field-source-", dir=args.output_base)).resolve()
    native = output / "native"
    artifact = output / "original-current-native-source.json"
    receipt_path = output / "receipt.json"
    receipt = {
        "schema": "oi.native-dense-field-source-prerequisite/v1",
        "scope": "genuine native codec input; no World/Scene/installed or whole-owner qualification",
        "expected_owner_revision": args.expected_revision,
        "producer": PRODUCER,
        "commands": [],
        "pass": False,
    }

    def persist():
        receipt_path.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")

    def run(label, command, timeout, environment=None):
        log = output / f"{label}.log"
        started = time.monotonic()
        command_receipt = {
            "label": label, "argv": command, "cwd": str(source),
            "timeout_seconds": timeout, "state": "launching", "log_path": str(log),
            "exit_code": None, "cleanup": {},
        }
        receipt["commands"].append(command_receipt)
        # Retain ownership and command evidence before starting any child.
        persist()
        try:
            with log.open("xb") as stream:
                returncode = custody.run_isolated(
                    command, cwd=source, env=environment or dict(os.environ),
                    stdout=stream, timeout=timeout, cleanup=command_receipt["cleanup"],
                )
            command_receipt["exit_code"] = returncode
            cleanup = command_receipt["cleanup"]
            if (cleanup.get("cleanup_unknown")
                    or cleanup.get("owned_leader_reaped") is not True
                    or cleanup.get("owned_group_absent_at_readback") is not True):
                raise RuntimeError(f"native prerequisite {label} retirement is unqualified; see {receipt_path}")
            if returncode:
                raise RuntimeError(f"native prerequisite {label} failed ({returncode}); see {log}")
            command_receipt["state"] = "passed"
        except BaseException as error:
            command_receipt["state"] = "failed"
            command_receipt["error"] = f"{type(error).__name__}: {error}"
            raise
        finally:
            command_receipt["duration_seconds"] = time.monotonic() - started
            if log.exists():
                command_receipt["log"] = fingerprint(log)
            persist()
        return log

    def git(label, *args):
        log = run(label, ["git", "-C", str(source), *args], 30)
        if log.stat().st_size > 1024 * 1024:
            raise ValueError("owner Git reading exceeded its bounded source receipt")
        return log.read_text().strip()

    try:
        receipt["process_custody_source"] = fingerprint(PROCESS_HELPER)
        specification = importlib.util.spec_from_file_location("oi_native_process_custody", PROCESS_HELPER)
        if specification is None or specification.loader is None:
            raise RuntimeError("the maintained native process custody helper is unavailable")
        custody = importlib.util.module_from_spec(specification)
        specification.loader.exec_module(custody)
        revision = git("owner-revision", "rev-parse", "HEAD")
        receipt["owner_revision"] = revision
        if revision != args.expected_revision:
            raise ValueError("actual QL checkout differs from the pinned producer revision")
        if git("owner-source-before", "status", "--porcelain", "--untracked-files=no"):
            raise ValueError("QL producer checkout contains tracked changes")
        receipt["producer_source"] = fingerprint(source / PRODUCER_SOURCE)
        run("native-c-build", ["make", "-C", str(source / "c"), "all"], 180)
        worker = native / "ql-field-worker"
        run("native-worker-build", [
            "make", "-C", str(source / "cpp"), f"BUILD_DIR={native}", str(worker), "-j1",
        ], 240)
        receipt["worker"] = fingerprint(worker)
        environment = dict(os.environ)
        environment["QL_NATIVE_FIELD_WORKER"] = str(worker)
        environment["QL_NATIVE_DENSE_FIELD_SOURCE_ARTIFACT"] = str(artifact)
        log = run("genuine-field-host-producer", [
            "cargo", "test", "-p", "ql-mef", "--locked", "--lib", PRODUCER,
            "--", "--exact", "--ignored", "--nocapture",
        ], 480, environment)
        with log.open(encoding="utf-8", errors="replace") as stream:
            if not any(f"test {PRODUCER} ... ok" in line for line in stream):
                raise ValueError("the exact genuine native producer did not report an executed passing test")
        # The native producer creates this file, preserves the original 65000
        # samples and exercises later M1/M2 bases. Never substitute authored JSON.
        receipt["artifact"] = fingerprint(artifact)
        value = json.loads(artifact.read_bytes())
        if value.get("schema") != "ql.native-held-field-source/v1":
            raise ValueError("native producer returned an unsupported FIELD source")
        count = len(value["original_field"]["samples"])
        if count != 65000:
            raise ValueError(f"native producer returned {count} original samples, expected 65000")
        receipt["original_sample_count"] = count
        if git("owner-source-after", "status", "--porcelain", "--untracked-files=no"):
            raise ValueError("native generation changed tracked QL owner source")
        receipt["pass"] = True
    except (Exception, KeyboardInterrupt) as error:
        receipt["error"] = f"{type(error).__name__}: {error}"
    finally:
        persist()
    print(json.dumps({"pass": receipt["pass"], "receipt": str(receipt_path), "artifact": str(artifact)}))
    if not receipt["pass"]:
        return 1
    export("OI_NATIVE_DENSE_FIELD_SOURCE_ARTIFACT", str(artifact), os.environ.get("GITHUB_ENV"))
    export("OI_NATIVE_DENSE_FIELD_SOURCE_RECEIPT", str(receipt_path), os.environ.get("GITHUB_ENV"))
    export("artifact", str(artifact), os.environ.get("GITHUB_OUTPUT"))
    export("receipt", str(receipt_path), os.environ.get("GITHUB_OUTPUT"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
