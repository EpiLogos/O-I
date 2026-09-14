#!/usr/bin/env python3
"""O:I #201/#220 acceptance runner. Runs owner commands; owns no runtime state.

Exit 0 = requested infrastructure command succeeded, 1 = observed failure,
2 = mandatory proof pending. `run` never turns a partial campaign into acceptance.
Raw process output stays in the private evidence directory. `export` allowlists
fingerprints only. A local recipe is an explicit command plan, not an API claim.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import signal
import subprocess
import sys
import time
import uuid
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / "tests/continuous-work"
GOVERNANCE_SHA = "7aa3005900612ee79323bf61b466ed25e36ee5427649b1b53953a8a53983cd61"
GRADES = {"D", "C", "P", "M", "H"}
MAX_CAPTURE = 8 * 1024 * 1024


class Pending(RuntimeError):
    pass


class Failure(RuntimeError):
    pass


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def store(path: Path, value: Any) -> None:
    # Exclusive final creation: do not overwrite an earlier run/receipt.
    with path.open("x", encoding="utf-8") as stream:
        os.chmod(path, 0o600)
        json.dump(value, stream, indent=2, sort_keys=True)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())


def inside(root: Path, name: str) -> Path:
    if not isinstance(name, str) or not name or Path(name).is_absolute():
        raise Failure("expected a nonempty relative evidence/fixture path")
    root = root.resolve()
    path = root / name
    if ".." in Path(name).parts or not path.resolve().is_relative_to(root):
        raise Failure("path escapes the controlled World")
    if any(p.is_symlink() for p in [path, *path.parents] if p != root.parent):
        raise Failure("symlink in evidence/fixture path")
    return path


def fresh_directory(path: Path) -> Path:
    if path.is_symlink() or path.exists():
        raise Failure("output must be a new directory; evidence is append-only")
    path.mkdir(parents=True, mode=0o700)
    os.chmod(path, 0o700)
    return path.resolve()


def governance() -> bytes:
    text = (ROOT / "skills/suite-operator/SKILL.md").read_bytes()
    start, end = b"<!-- caw-governance-source:start -->\n", b"<!-- caw-governance-source:end -->"
    if text.count(start) != 1 or text.count(end) != 1:
        raise Failure("missing or ambiguous maintained governance source")
    body = text.split(start, 1)[1].split(end, 1)[0]
    if sha(body) != GOVERNANCE_SHA:
        raise Failure("S4 source drift: reconcile the authored source, do not update a test to bless drift")
    return body


def matrix() -> list[dict[str, Any]]:
    cases = load(SPEC / "cases.json")["cases"]
    if [x["id"] for x in cases] != [f"P{i:02}" for i in range(1, 29)]:
        raise Failure("parent must retain exactly P01-P28 in order")
    for case in cases:
        if not case["requires"] or not case["grades"] or not set(case["grades"]) <= GRADES:
            raise Failure("empty acceptance or invalid evidence grade")
        if len(set(case["requires"])) != len(case["requires"]):
            raise Failure("duplicate acceptance obligation")
    return cases


def fingerprint_source(path: Path, expected: str) -> dict[str, str]:
    if not re.fullmatch(r"[0-9a-f]{40}", expected):
        raise Failure("source cut needs an exact 40-character Git revision")
    def git(*args: str) -> str:
        result = subprocess.run(["git", "-C", str(path), *args], capture_output=True,
                                text=True, timeout=30, check=False)
        if result.returncode:
            raise Failure("cannot inspect native source checkout")
        return result.stdout.strip()
    head = git("rev-parse", "HEAD")
    if head != expected or git("status", "--porcelain", "--untracked-files=normal"):
        raise Failure("source checkout is not the declared clean exact cut")
    return {"revision": head, "tree": git("rev-parse", "HEAD^{tree}")}


class Recorder:
    def __init__(self, output: Path, binaries: dict[str, dict[str, Any]], *, timeout: int = 120):
        self.output, self.binaries, self.timeout = output, binaries, timeout
        self.records: list[dict[str, Any]] = []
        self.sources: dict[str, Any] = {}
        self.pins: dict[str, str] = {}

    def bind(self, owner: str) -> Path:
        entry = self.binaries.get(owner)
        if not entry:
            raise Pending(f"{owner}: no declared native executable/source binding")
        path = Path(entry["path"])
        if not path.is_absolute() or path.is_symlink() or not path.is_file() or not os.access(path, os.X_OK):
            raise Pending(f"{owner}: executable must be an absolute regular executable (no PATH fallback)")
        digest = sha(path.read_bytes())
        if digest != entry["sha256"]:
            raise Failure(f"{owner}: executable changed from declared digest")
        # Reinspect on every call, not only before a multi-step campaign.
        source = fingerprint_source(Path(entry["source"]), entry["revision"])
        if owner in self.pins and self.pins[owner] != digest:
            raise Failure(f"{owner}: executable changed during campaign")
        self.pins[owner], self.sources[owner] = digest, source
        return path

    def execute(self, owner: str, args: list[str], cwd: Path, env: dict[str, str], label: str) -> tuple[int, bytes]:
        binary = self.bind(owner)
        if not all(isinstance(x, str) for x in args):
            raise Failure("argv must contain only strings; no shell interpolation")
        index = len(self.records)
        stdout_path = self.output / f"{index:04}.stdout"
        stderr_path = self.output / f"{index:04}.stderr"
        began = time.time_ns()
        # No inherited credentials/configs in controlled mode. Caller supplies
        # a deliberately constructed environment; it is never written to evidence.
        with stdout_path.open("xb") as out, stderr_path.open("xb") as err:
            os.chmod(stdout_path, 0o600)
            os.chmod(stderr_path, 0o600)
            proc = subprocess.Popen([str(binary), *args], cwd=cwd, env=env,
                                    stdin=subprocess.DEVNULL, stdout=out, stderr=err,
                                    start_new_session=True)
            timed_out = False
            try:
                code = proc.wait(timeout=self.timeout)
            except subprocess.TimeoutExpired:
                timed_out = True
                os.killpg(proc.pid, signal.SIGKILL)
                code = proc.wait()
        out_bytes, err_bytes = stdout_path.read_bytes(), stderr_path.read_bytes()
        record = {"id": index, "owner": owner, "label": label, "argv_sha256": sha(json.dumps(args).encode()),
                  "executable_sha256": self.pins[owner], "source": self.sources[owner],
                  "began_ns": began, "ended_ns": time.time_ns(), "exit": code, "timed_out": timed_out,
                  "stdout": {"file": stdout_path.name, "sha256": sha(out_bytes), "bytes": len(out_bytes)},
                  "stderr": {"file": stderr_path.name, "sha256": sha(err_bytes), "bytes": len(err_bytes)}}
        self.records.append(record)
        # Retain argv locally for reproducibility, but NEVER export it by default.
        store(self.output / f"{index:04}.invocation.json", {"argv": [str(binary), *args], "cwd": str(cwd), **record})
        if timed_out:
            raise Failure(f"{owner}: native command timed out; effects may be uncertain; no automatic retry")
        if len(out_bytes) + len(err_bytes) > MAX_CAPTURE:
            raise Failure("native output exceeded inspection limit; raw evidence retained locally")
        self.bind(owner)  # Source/binary TOCTOU is a failure, not a fresh pin.
        return code, out_bytes


def pointer(value: Any, path: str) -> Any:
    if path == "":
        return value
    if not path.startswith("/"):
        raise Failure("JSON pointer must be absolute")
    for key in path[1:].split("/"):
        key = key.replace("~1", "/").replace("~0", "~")
        value = value[int(key)] if isinstance(value, list) else value[key]
    return value


def matches(checks: list[dict[str, Any]], outputs: dict[str, tuple[int, bytes]], world: Path) -> bool:
    """Only real readbacks/files captured during this invocation are inspected."""
    if not checks:
        raise Failure("an operation with no postcondition is not a proof")
    for check in checks:
        if "file" in check:
            path = inside(world, check["file"])
            if "exists" in check and path.is_file() != check["exists"]:
                return False
            if "sha256" in check and (not path.is_file() or sha(path.read_bytes()) != check["sha256"]):
                return False
        else:
            code, data = outputs[check["step"]]
            if code != check.get("exit", 0):
                return False
            try:
                value = pointer(json.loads(data), check["pointer"])
            except (KeyError, IndexError, ValueError, TypeError):
                return False
            if "equals" not in check or value != check["equals"]:
                return False
    return True


def validate_recipe(recipe: dict[str, Any]) -> None:
    if recipe.get("schema") != "oi.caw-native-probe/v1":
        raise Failure("unknown native probe recipe")
    if recipe.get("max_grade") not in ("D", "C"):
        raise Failure("recipes may produce bounded D/C only; location cannot manufacture P/M/H")
    for key in ("id", "case", "obligation", "owner_contract", "source_basis"):
        if not recipe.get(key):
            raise Failure(f"recipe requires {key}")
    steps = recipe["steps"]
    ids = [step["id"] for step in steps]
    if not steps or len(set(ids)) != len(ids):
        raise Failure("empty or duplicate native operation steps")
    removed = next((s for s in steps if s["id"] == recipe["disconnect"]), None)
    if not removed or removed["kind"] != "operation":
        raise Failure("disconnection must remove an actual producer operation")
    if not any(s["kind"] == "readback" for s in steps):
        raise Failure("native readback is mandatory")
    for step in steps:
        if step["kind"] not in ("setup", "operation", "readback") or not isinstance(step["argv"], list):
            raise Failure("invalid native step")
        if not step["argv"] or not step.get("owner"):
            raise Failure("every native step needs an owner and operation argv")
    readbacks = {s["id"] for s in steps if s["kind"] == "readback"}
    for check in recipe["checks"]:
        if "file" not in check and check.get("step") not in readbacks:
            raise Failure("a producer receipt is not independent public readback")
        if "file" in check and not ({"exists", "sha256"} & check.keys()):
            raise Failure("file readback needs an actual predicate")
    if not recipe["checks"]:
        raise Failure("native postconditions are required")
    if recipe["max_grade"] == "C" and len({s["owner"] for s in steps}) < 2:
        raise Failure("one owner's native operation is not cross-owner C")


def run_recipe(recipe: dict[str, Any], recorder: Recorder, *, installed: bool = False) -> dict[str, Any]:
    validate_recipe(recipe)
    # Both runs get fresh controlled Worlds. Never omit a producer in a live
    # personal World: an installed-world campaign must use owner-approved
    # disposable canaries, not replay arbitrary personal mutations.
    if installed:
        raise Pending("installed operation requires its owner-approved disposable canary recipe; personal replay is forbidden")
    result: dict[str, Any] = {"id": recipe["id"], "case": recipe["case"], "obligation": recipe["obligation"],
                              "scope": "bounded-controlled-native", "recipe_sha256": sha(json.dumps(recipe, sort_keys=True).encode())}
    first = len(recorder.records)
    for broken in (False, True):
        world = fresh_directory(recorder.output / (recipe["id"] + ("-disconnected" if broken else "-connected")))
        for name, fixture in recipe.get("owner_fixtures", {}).items():
            recorder.bind(fixture["owner"])
            source = inside(Path(recorder.binaries[fixture["owner"]]["source"]), fixture["path"])
            data = source.read_bytes()
            if fixture.get("sha256") and sha(data) != fixture["sha256"]:
                raise Failure("owner fixture drift")
            target = inside(world, name)
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open("xb") as stream:
                stream.write(data)
        for name, content in recipe.get("fixtures", {}).items():
            path = inside(world, name)
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open("x", encoding="utf-8") as stream:
                stream.write(content)
        if recipe.get("initial_checks") and not matches(recipe["initial_checks"], {}, world):
            raise Failure("controlled World does not match its initial state")
        home = fresh_directory(world / "isolated-home")
        env = {"HOME": str(home), "XDG_CONFIG_HOME": str(home / ".config"),
               "XDG_DATA_HOME": str(home / ".local/share"), "XDG_STATE_HOME": str(home / ".local/state"),
               "PATH": "/usr/bin:/bin", "LANG": "C.UTF-8", "TZ": "UTC"}
        outputs: dict[str, tuple[int, bytes]] = {}
        for step in recipe["steps"]:
            if broken and step["id"] == recipe["disconnect"]:
                continue
            args = [a.replace("{world}", str(world)) for a in step["argv"]]
            code, data = recorder.execute(step["owner"], args, world, env, step["id"])
            outputs[step["id"]] = code, data
            if step["kind"] != "readback" and code != step.get("exit", 0):
                raise Failure("setup/operation failed; not a disconnection success")
        passed = matches(recipe["checks"], outputs, world)
        if not broken and not passed:
            raise Failure("connected native path failed its public readback/filesystem postcondition")
        if broken and passed:
            raise Failure("disconnected operation still passes: observer is not proving the connection")
    result.update(standing="observed", grade=recipe["max_grade"], disconnected="detected",
                  record_ids=list(range(first, len(recorder.records))))
    return result


def assess(cases: list[dict[str, Any]], observations: list[dict[str, Any]]) -> dict[str, Any]:
    # Each observed obligation is bounded. A JSON `status:passed` or an absent
    # test/grade is never substituted for an actual required observation.
    rows = []
    for case in cases:
        relevant = [o for o in observations if o.get("case") == case["id"]]
        passed = {(o.get("obligation"), o.get("grade")) for o in relevant
                  if o.get("standing") == "observed" and o.get("disconnected") == "detected" and o.get("record_ids")}
        missing = [{"obligation": requirement, "grade": grade}
                   for requirement in case["requires"] for grade in case["grades"]
                   if (requirement, grade) not in passed]
        failed = any(o.get("standing") == "failed" for o in relevant)
        rows.append({"case": case["id"], "title": case["title"],
                     "standing": "failed" if failed else "pending" if missing else "observed",
                     "missing": missing, "owner_joins": case["owner_joins"]})
    state = "failed" if any(r["standing"] == "failed" for r in rows) else "pending" if any(r["standing"] == "pending" for r in rows) else "observed"
    # Independent full-path verification and H are not supplied by this runner.
    return {"standing": state, "whole_feature_verdict": None, "cases": rows,
            "independent_verification": "pending-fresh-non-implementer", "human_recognition": "not-inferred"}


def export_evidence(directory: Path, target: Path) -> None:
    report = load(directory / "report.json")
    for record in report["commands"]:
        for channel in ("stdout", "stderr"):
            artifact = record[channel]
            data = inside(directory, artifact["file"]).read_bytes()
            if sha(data) != artifact["sha256"]:
                raise Failure("raw evidence was changed after capture")
    # No stdout, stderr, argv, private paths, World source, or provider secrets.
    store(target, {"schema": "oi.caw-redacted-evidence/v1", "run_id": report["run_id"],
                   "report_sha256": sha((directory / "report.json").read_bytes()),
                   "test_source_sha256": report["test_source_sha256"],
                   "matrix_sha256": report["matrix_sha256"], "acceptance": report["acceptance"],
                   "observations": [{k: v for k, v in o.items() if k in
                       {"id", "case", "obligation", "standing", "grade", "scope", "recipe_sha256", "disconnected", "record_ids", "sha256"}}
                       for o in report["observations"]], "commands": report["commands"]})


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    plan = sub.add_parser("plan", help="write the complete P01-P28 obligation and owner-join plan")
    plan.add_argument("--output", type=Path, required=True)
    run = sub.add_parser("run", help="execute checked native probes, capture evidence and evaluate the entire parent")
    run.add_argument("--output", type=Path, required=True)
    run.add_argument("--bindings", type=Path, help="explicit native executable digests and clean source revisions")
    run.add_argument("--recipes", type=Path, help="reviewed local native command plan; no shell strings")
    run.add_argument("--case", action="append", default=[], help="execute a subset; never narrows the parent gate")
    run.add_argument("--timeout", type=int, default=120)
    export = sub.add_parser("export", help="verify captured artifacts and export fingerprint-only evidence")
    export.add_argument("--evidence", type=Path, required=True)
    export.add_argument("--output", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        if args.command == "export":
            export_evidence(args.evidence, args.output)
            return 0
        cases = matrix()
        if args.command == "plan":
            store(args.output, {"schema": "oi.caw-campaign-plan/v1", "cases": cases,
                                "local_proof": load(SPEC / "joins.json"), "standing": "plan-not-proof"})
            return 0
        if not 1 <= args.timeout <= 3600:
            raise Failure("timeout must be 1..3600 seconds")
        unknown = set(args.case) - {c["id"] for c in cases}
        if unknown:
            raise Failure("unknown case selection")
        output = fresh_directory(args.output)
        recorder = Recorder(output, load(args.bindings) if args.bindings else {}, timeout=args.timeout)
        observations = []
        try:
            governance()
            observations.append({"case": "P01", "obligation": "governance-source", "standing": "source-verified",
                                 "sha256": GOVERNANCE_SHA, "scope": "source-bytes-only-not-loaded"})
        except Failure as error:
            observations.append({"case": "P01", "standing": "failed", "detail": str(error)})
        recipes = load(args.recipes) if args.recipes else load(SPEC / "native-probes.json")
        seen = set()
        for recipe in recipes:
            ident = recipe.get("id", "")
            if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,79}", ident) or ident in seen:
                raise Failure("invalid or duplicate native probe id")
            seen.add(ident)
            case = next((c for c in cases if c["id"] == recipe.get("case")), None)
            if case is None or recipe.get("obligation") not in case["requires"]:
                raise Failure("recipe cannot invent or replace parent acceptance obligations")
            if args.case and recipe["case"] not in args.case:
                continue
            try:
                observations.append(run_recipe(recipe, recorder))
            except (Pending, Failure, OSError, ValueError, KeyError) as error:
                observations.append({"id": ident, "case": recipe["case"], "obligation": recipe["obligation"],
                                     "standing": "pending" if isinstance(error, Pending) else "failed",
                                     "detail": str(error)})
        acceptance = assess(cases, observations)
        report = {"schema": "oi.caw-campaign-evidence/v1", "run_id": str(uuid.uuid4()),
                  "test_source_sha256": sha(Path(__file__).read_bytes()),
                  "matrix_sha256": sha((SPEC / "cases.json").read_bytes()),
                  "recipe_source_sha256": sha(json.dumps(recipes, sort_keys=True).encode()),
                  "commands": recorder.records, "observations": observations, "acceptance": acceptance}
        store(output / "report.json", report)
        print(json.dumps({"standing": acceptance["standing"], "report": str(output / "report.json"),
                          "observed_commands": len(recorder.records), "whole_feature_verdict": None}))
        return 1 if acceptance["standing"] == "failed" else 2 if acceptance["standing"] == "pending" else 0
    except (Failure, OSError, ValueError, KeyError, subprocess.TimeoutExpired) as error:
        print(f"caw: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
