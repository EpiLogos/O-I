#!/usr/bin/env python3
"""Prepare genuine Workcell material for the existing O:I installer tests.

Use the maintained owner checkout and its declared locked release build. The
second boundary is a real debug build of the same source, used only by negative
installer cases. This prerequisite grants no World, task or installation.
"""

import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import stat
import tempfile
import time


ROLES = {
    "workcell", "workcell-control-client", "workcell-control-service",
    "workcell-write-boundary",
}
PROCESS_HELPER = (
    Path(__file__).resolve().parents[1]
    / "desktop/cradle/tests/native-expression-local.py"
)


def fingerprint(path):
    def identity(state):
        return (state.st_dev, state.st_ino, state.st_mode, state.st_size,
                state.st_mtime_ns, state.st_ctime_ns)

    before = path.lstat()
    if not stat.S_ISREG(before.st_mode):
        raise ValueError(f"native material must be a regular file: {path}")
    descriptor = os.open(path, os.O_RDONLY | os.O_CLOEXEC | os.O_NOFOLLOW | os.O_NONBLOCK)
    digest = hashlib.sha256()
    with os.fdopen(descriptor, "rb") as stream:
        held = os.fstat(stream.fileno())
        if not stat.S_ISREG(held.st_mode) or identity(held) != identity(before):
            raise ValueError(f"native material changed before qualification: {path}")
        remaining = held.st_size
        while remaining:
            block = stream.read(min(remaining, 1024 * 1024))
            if not block:
                raise ValueError(f"native material ended during qualification: {path}")
            digest.update(block)
            remaining -= len(block)
        if stream.read(1) or identity(os.fstat(stream.fileno())) != identity(held):
            raise ValueError(f"native material changed during qualification: {path}")
    if identity(path.lstat()) != identity(held):
        raise ValueError(f"native material path changed during qualification: {path}")
    return {"path": str(path), "bytes": held.st_size, "sha256": digest.hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workcell-source", type=Path, required=True)
    parser.add_argument("--output-base", type=Path, required=True)
    args = parser.parse_args()
    source = args.workcell_source.resolve(strict=True)
    args.output_base.mkdir(parents=True, exist_ok=True)
    output = Path(tempfile.mkdtemp(prefix="native-workcell-current-main-", dir=args.output_base))
    receipt_path = output / "compiler-receipt.json"
    evidence = output / "native-installer-evidence"
    scratch = output / "scratch"
    evidence.mkdir()
    scratch.mkdir()
    receipt = {
        "scope": "genuine input for O:I installer regressions; no installed or World/agent acceptance",
        "source_checkout": str(source), "commands": [], "pass": False,
        "alternate_scope": "negative changed-companion, stale-CAS and conflicting-digest cases only",
    }

    def persist():
        receipt_path.write_text(json.dumps(receipt, indent=2) + "\n")

    def run(label, command, timeout, environment=None):
        log = output / f"{label}.raw.log"
        entry = {"label": label, "argv": command, "timeout_seconds": timeout,
                 "cwd": str(source), "state": "launching", "cleanup": {}}
        receipt["commands"].append(entry)
        persist()
        started = time.monotonic()
        try:
            with log.open("xb") as stream:
                result = custody.run_isolated(
                    command, cwd=source, env=environment or dict(os.environ),
                    stdout=stream, timeout=timeout, cleanup=entry["cleanup"],
                )
            entry["exit_code"] = result
            if (entry["cleanup"].get("cleanup_unknown")
                    or entry["cleanup"].get("owned_leader_reaped") is not True
                    or entry["cleanup"].get("owned_group_absent_at_readback") is not True):
                raise RuntimeError(f"unqualified prerequisite process retirement: {label}")
            if result:
                raise RuntimeError(f"native prerequisite {label} failed ({result}); see {log}")
            entry["state"] = "passed"
        except BaseException as error:
            entry["state"] = "failed"
            entry["error"] = f"{type(error).__name__}: {error}"
            raise
        finally:
            entry["duration_seconds"] = time.monotonic() - started
            if log.exists():
                entry["log"] = fingerprint(log)
            persist()
        return log

    def git(label, *arguments):
        log = run(label, ["git", "-C", str(source), *arguments], 30)
        if log.stat().st_size > 1024 * 1024:
            raise ValueError("owner Git observation exceeds the existing source receipt bound")
        return log.read_text().strip()

    def images(log, required):
        found = {}
        with log.open() as stream:
            for line in stream:
                if not line.startswith("{"):
                    continue
                row = json.loads(line)
                if (row.get("reason") != "compiler-artifact"
                        or row.get("profile", {}).get("test") is not False
                        or row.get("target", {}).get("kind") != ["bin"]
                        or not row.get("executable")):
                    continue
                name = row["target"]["name"]
                if name not in required:
                    continue
                if name in found:
                    raise ValueError(f"ambiguous actual compiler artifact: {name}")
                image = Path(os.path.abspath(row["executable"]))
                account = fingerprint(image)
                if not os.access(image, os.X_OK):
                    raise ValueError(f"compiled native role is not executable: {name}")
                found[name] = account
        if set(found) != required:
            raise ValueError(f"compiler did not emit the complete declared native roles: {sorted(found)}")
        return found

    try:
        specification = importlib.util.spec_from_file_location("oi_native_process_custody", PROCESS_HELPER)
        if specification is None or specification.loader is None:
            raise RuntimeError("maintained native process custody helper is unavailable")
        custody = importlib.util.module_from_spec(specification)
        specification.loader.exec_module(custody)
        receipt["process_custody_source"] = fingerprint(PROCESS_HELPER)
        origin = git("owner-origin", "remote", "get-url", "origin")
        if origin.lower().removesuffix(".git") not in (
                "https://github.com/epilogos/workcell", "git@github.com:epilogos/workcell"):
            raise ValueError("native input checkout is not the maintained Workcell owner")
        revision = git("owner-revision", "rev-parse", "HEAD")
        tree = git("owner-tree", "rev-parse", "HEAD^{tree}")
        if not re.fullmatch(r"[0-9a-f]{40}", revision) or not re.fullmatch(r"[0-9a-f]{40}", tree):
            raise ValueError("actual owner Source identity is unavailable")
        if git("owner-source-before", "status", "--porcelain", "--untracked-files=no"):
            raise ValueError("Workcell native source has tracked changes")
        receipt.update(source_revision=revision, source_tree=tree)
        environment = dict(os.environ, SUITE_BUILD_REVISION=revision, TMPDIR=str(scratch))
        primary_log = run("owner-release-compiler", [
            "cargo", "build", "--workspace", "--locked", "--release", "--message-format=json",
        ], 600, environment)
        primary = images(primary_log, ROLES)
        alternate_log = run("owner-debug-boundary-compiler", [
            "cargo", "build", "--locked", "--bin", "workcell-write-boundary", "--message-format=json",
        ], 300, environment)
        alternate = images(alternate_log, {"workcell-write-boundary"})["workcell-write-boundary"]
        if alternate["sha256"] == primary["workcell-write-boundary"]["sha256"]:
            raise ValueError("negative case needs genuinely different compiled boundary material")
        receipt.update(images=primary, alternate_write_boundary=alternate)
        probes = [
            ("main-version", "workcell", ["--version"]),
            ("main-help", "workcell", ["--help"]),
            ("boundary-capabilities", "workcell-write-boundary", ["capabilities"]),
            ("service-help", "workcell-control-service", ["--help"]),
            ("client-help", "workcell-control-client", ["--help"]),
        ]
        for label, role, arguments in probes:
            log = run(label, [primary[role]["path"], *arguments], 20, environment)
            if label == "main-version" and revision[:12] not in log.read_text():
                raise ValueError("actual primary image does not identify its captured owner Source")
        for account in [*primary.values(), alternate]:
            if fingerprint(Path(account["path"])) != account:
                raise ValueError("compiled role changed during native qualification")
        if git("owner-source-after", "status", "--porcelain", "--untracked-files=no"):
            raise ValueError("native preparation changed tracked owner Source")
        if (git("owner-revision-after", "rev-parse", "HEAD") != revision
                or git("owner-tree-after", "rev-parse", "HEAD^{tree}") != tree):
            raise ValueError("native preparation changed the actual owner Source identity")
        receipt.update({"pass": True, "evidence_root": str(evidence), "scratch_root": str(scratch)})
    except (Exception, KeyboardInterrupt) as error:
        receipt["error"] = f"{type(error).__name__}: {error}"
    finally:
        persist()
    if not receipt["pass"]:
        print(json.dumps({"pass": False, "receipt": str(receipt_path)}))
        return 1
    material_path = output / "native-material.json"
    material_path.write_text(json.dumps({
        "source_revision": revision, "source_tree": tree, "source_checkout": str(source),
        "compiler_receipt": fingerprint(receipt_path), "images": primary,
        "alternate_write_boundary": alternate,
    }, indent=2) + "\n")
    environment_path = os.environ.get("GITHUB_ENV")
    if not environment_path:
        raise ValueError("normal hosted prerequisite environment is unavailable")
    exports = {
        "OI_NATIVE_WORKCELL_CURRENT_MAIN_MATERIAL": str(material_path),
        "OI_NATIVE_WORKCELL_CURRENT_MAIN_EVIDENCE_ROOT": str(evidence),
        "TMPDIR": str(scratch),
    }
    with Path(environment_path).open("a") as stream:
        for key, value in exports.items():
            if "\n" in value or "\r" in value:
                raise ValueError("native prerequisite path must fit one environment line")
            stream.write(f"{key}={value}\n")
    print(json.dumps({"pass": True, "material": str(material_path), "receipt": str(receipt_path)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
