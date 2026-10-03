#!/usr/bin/env python3
"""Counterprove publication with the actual ready native producer corpus.

Requires real preparer output: never synthesises a native fixture or reruns a
producer. Every case privately relocates path metadata and hardlinks actual
bytes; byte corruption replaces only its private link. Original receipts and
native files are left unchanged. The same public publisher CLI is exercised.
"""
from __future__ import annotations
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys
import tempfile
import unittest
import uuid

sys.dont_write_bytecode = True
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--result", required=True, type=Path)
parser.add_argument("--expected-ql-head", required=True)
parser.add_argument("--output-root", required=True, type=Path)
args = parser.parse_args()
pointer = json.loads(args.result.read_bytes())
original = json.loads(Path(pointer["receipt"]).read_bytes())
original_run = Path(original["run"]).resolve(strict=True)
assert original["status"] == "ready", "Counterproofs need actual successful producer output"
assert original["actual_ql_head"] == original["expected_ql_head"] == args.expected_ql_head
publisher = Path(__file__).with_name("retained-performance-ci-environment.py")
sentinel = b"EXISTING_RECEIVER=preserved\n"


class ActualPublication(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory(prefix="publisher-counterproof-", dir=args.output_root)
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.run = self.root / ("native-performance-" + uuid.uuid4().hex)
        self.run.mkdir()
        self.receipt = copy.deepcopy(original)

        def relocate(raw: str) -> Path:
            return self.run / Path(raw).relative_to(original_run)

        for row in self.receipt["fixtures"]:
            source = Path(row["path"])
            target = relocate(row["path"])
            target.parent.mkdir(parents=True, exist_ok=True)
            os.link(source, target)
            row["path"] = str(target)
        for command in self.receipt["commands"]:
            source = Path(command["log"])
            target = relocate(command["log"])
            if not target.exists():
                target.parent.mkdir(parents=True, exist_ok=True)
                os.link(source, target)
            command["log"] = str(target)
        environment = {}
        for line in Path(original["environment_file"]).read_text().splitlines():
            words = shlex.split(line, comments=False)
            assert len(words) == 2 and words[0] == "export"
            key, raw = words[1].split("=", 1)
            target = relocate(raw)
            if Path(raw).is_dir() or key.endswith("DIRECTORY") or key.endswith("HOME"):
                target.mkdir(parents=True, exist_ok=True)
            environment[key] = str(target)
        self.environment = environment
        self.environment_file = self.run / "environment.sh"
        self.environment_file.write_text("".join("export " + key + "=" + shlex.quote(value) + "\n" for key, value in environment.items()))
        self.receipt.update(run=str(self.run), environment_file=str(self.environment_file))
        self.receipt_file = self.run / "receipt.json"
        self.result = self.root / "result.json"
        self.result.write_text(json.dumps({"receipt": str(self.receipt_file), "environment_file": str(self.environment_file)}))
        self.github_env = self.root / "github-env"
        self.github_env.write_bytes(sentinel)

    def invoke(self, expected_head: str | None = None) -> subprocess.CompletedProcess:
        self.receipt_file.write_text(json.dumps(self.receipt))
        return subprocess.run([sys.executable, "-B", str(publisher), "--result", str(self.result),
            "--expected-ql-head", expected_head or args.expected_ql_head,
            "--output-root", str(self.root), "--github-env", str(self.github_env)], capture_output=True, text=True, check=False)

    def refused(self, message: str, expected_head: str | None = None) -> None:
        result = self.invoke(expected_head)
        self.assertNotEqual(result.returncode, 0, "Invalid actual corpus must be refused before publication")
        self.assertIn(message, result.stderr)
        self.assertEqual(self.github_env.read_bytes(), sentinel, "Refusal must preserve the existing receiving environment")

    def test_complete_actual_corpus_publishes_all_original_receiving_paths(self) -> None:
        result = self.invoke()
        self.assertEqual(result.returncode, 0, result.stderr)
        expected = sentinel + "".join(key + "=" + self.environment[key] + "\n" for key in sorted(self.environment)).encode()
        self.assertEqual(self.github_env.read_bytes(), expected)
        self.assertEqual(json.loads(result.stdout)["variables"], sorted(self.environment))

    def test_omitted_sourceform_body_and_opening_checkpoint_are_refused(self) -> None:
        missing = {"native-retained-source-workload/source-performance.json", "native-retained-source-workload/initial.checkpoint.json"}
        self.receipt["fixtures"] = [row for row in self.receipt["fixtures"] if str(Path(row["path"]).relative_to(self.run)) not in missing]
        self.refused("actual native fixture inventory membership differs")

    def test_missing_last_native_edition_is_refused(self) -> None:
        missing = "native-retained-workload/edition-180.history.json"
        self.receipt["fixtures"] = [row for row in self.receipt["fixtures"] if str(Path(row["path"]).relative_to(self.run)) != missing]
        self.refused("actual native fixture inventory membership differs")

    def test_missing_actual_postpulse_native_cuts_refuse_publication(self) -> None:
        original_fixtures = copy.deepcopy(self.receipt["fixtures"])
        for kind in ("release", "panic"):
            for suffix in ("pulse-checkpoint", "pending-pulse-checkpoint", "pending-pulse-history"):
                missing = "native-managed-order/" + kind + "." + suffix + ".json"
                with self.subTest(actual_native_member=missing):
                    self.assertEqual(sum(str(Path(row["path"]).relative_to(self.run)) == missing
                        for row in original_fixtures), 1, "Counterproof requires this actual native-produced cut")
                    self.receipt["fixtures"] = [row for row in original_fixtures
                        if str(Path(row["path"]).relative_to(self.run)) != missing]
                    self.refused("actual native fixture inventory membership differs")
        self.receipt["fixtures"] = original_fixtures

    def test_duplicate_actual_native_body_is_refused(self) -> None:
        self.receipt["fixtures"].append(copy.deepcopy(self.receipt["fixtures"][0]))
        self.refused("actual native fixture inventory membership differs")

    def test_changed_actual_native_bytes_are_refused(self) -> None:
        path = Path(self.receipt["fixtures"][0]["path"])
        body = path.read_bytes()
        path.unlink()
        path.write_bytes(bytes([body[0] ^ 1]) + body[1:])
        self.refused("actual native fixture changed after producer qualification")

    def test_failed_actual_command_receipt_is_refused(self) -> None:
        self.receipt["commands"][0]["exit_code"] = 1
        self.refused("actual native producer failed or timed out")

    def test_wrong_exact_source_is_refused(self) -> None:
        wrong = ("0" if args.expected_ql_head[0] != "0" else "1") + args.expected_ql_head[1:]
        self.refused("actual native fixture source/result/unique custody differs", wrong)


suite = unittest.defaultTestLoader.loadTestsFromTestCase(ActualPublication)
result = unittest.TextTestRunner(verbosity=2).run(suite)
print(json.dumps({"schema": "oi.actual-native-publication-counterproof/v1", "tests": result.testsRun,
    "failures": len(result.failures), "errors": len(result.errors), "actual_ql_head": args.expected_ql_head,
    "actual_fixture_records": len(original["fixtures"]), "original_receipt_sha256": hashlib.sha256(Path(pointer["receipt"]).read_bytes()).hexdigest(),
    "scope": "Actual prepared native bytes through the public receiving CLI; no native reexecution, full kernel or installed verdict"}, sort_keys=True))
sys.exit(0 if result.wasSuccessful() else 1)
