#!/usr/bin/env python3
"""Exact-owner D evidence for the Development Field; never installed-suite or C/P/M/H proof.

The cut is an evidence input, not a runtime selection catalogue. Commands come
from the tested owner's lifecycle descriptor, never the historical suite manifest.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
IDS = {"oi", "central", "actuation", "ai-kit", "software-factory", "workcell", "quaternal-logic"}


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def cut_owner(cut: Path, owner_id: str) -> dict:
    data = json.loads(cut.read_text())
    owners = data.get("owners", [])
    if data.get("schema") != "oi.development-field-cut/v1" or len(owners) != 7 or {x["id"] for x in owners} != IDS:
        raise ValueError("cut must contain exactly the seven distinct native owners")
    for owner in owners:
        if not re.fullmatch(r"[0-9a-f]{40}", owner["revision"]):
            raise ValueError("every owner needs an exact full commit SHA")
        if not re.fullmatch(r"EpiLogos/[A-Za-z0-9_.-]+", owner["repository"]):
            raise ValueError("invalid owner repository")
    return next(x for x in owners if x["id"] == owner_id)


def capture(command: list[str], cwd: Path | None = None) -> str:
    return subprocess.check_output(command, cwd=cwd, text=True, stderr=subprocess.STDOUT).strip()


def api(path: str) -> object:
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "oi-development-field-ci"}
    token = os.environ.get("GH_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    with urllib.request.urlopen(urllib.request.Request("https://api.github.com/" + path, headers=headers), timeout=45) as response:
        return json.load(response)


def prepare(args: argparse.Namespace, owner: dict) -> None:
    source, out = args.source.resolve(), args.out.resolve()
    if source.exists():
        raise ValueError("prepare requires a new isolated checkout")
    source.mkdir(parents=True)
    for command in (["git", "init", "-q"], ["git", "remote", "add", "origin", "https://github.com/" + owner["repository"] + ".git"], ["git", "fetch", "--depth=1", "origin", owner["revision"]], ["git", "checkout", "--detach", "FETCH_HEAD"]):
        subprocess.run(command, cwd=source, check=True)
    actual = capture(["git", "rev-parse", "HEAD"], source)
    if actual != owner["revision"]:
        raise ValueError("checkout does not match exact source cut")
    remote_main = capture(["git", "ls-remote", "--exit-code", "origin", "refs/heads/main"], source).split()[0]
    out.mkdir(parents=True, exist_ok=True)
    context = {"schema": "oi.development-field-source/v1", "owner": owner, "head": actual,
               "tree": capture(["git", "rev-parse", "HEAD^{tree}"], source),
               "remote_main_at_observation": remote_main, "still_current_main": remote_main == actual,
               "harness_revision": os.environ.get("GITHUB_SHA"), "cut_sha256": digest(args.cut),
               "evidence_grades_claimed": []}
    try:
        track = api(f"repos/{owner['repository']}/issues/{owner['track']}")
        context["track"] = {key: track.get(key) for key in ("number", "title", "state", "updated_at", "html_url")}
        runs, page = [], 1
        while True:
            response = api(f"repos/{owner['repository']}/actions/runs?head_sha={actual}&per_page=100&page={page}")
            batch = response.get("workflow_runs", [])
            runs.extend({key: run.get(key) for key in ("id", "name", "path", "head_sha", "event", "status", "conclusion", "run_attempt", "html_url")} for run in batch)
            if len(batch) < 100:
                break
            page += 1
        context["observed_owner_workflows"] = runs
    except Exception as error:
        context["metadata_observation_error"] = str(error)
    write(out / "source.json", context)
    paths = capture(["git", "ls-files"], source).splitlines()
    write(out / "tracked-files.json", paths)
    # Inspectable native source + workflow context. No .git, build output or credentials.
    suffixes = {".rs", ".mjs", ".js", ".ts", ".py", ".toml", ".json", ".yml", ".yaml", ".sh", ".md", ".h", ".c", ".cpp", ".tsv", ".csv"}
    with tarfile.open(out / "source-context.tar.gz", "w:gz") as archive:
        for relative in paths:
            path = source / relative
            if path.is_file() and not path.is_symlink() and (path.suffix in suffixes or path.name in {"Cargo.lock", "Makefile", "verify"}):
                archive.add(path, arcname=relative, recursive=False)


def native(args: argparse.Namespace, owner: dict) -> int:
    source, out = args.source.resolve(), args.out.resolve()
    actual = capture(["git", "rev-parse", "HEAD"], source)
    if actual != owner["revision"]:
        raise ValueError("native gate refuses a different owner revision")
    record = {"schema": "oi.development-field-native-evidence/v1", "owner": owner, "head": actual,
              "harness_revision": os.environ.get("GITHUB_SHA"), "cut_sha256": digest(args.cut),
              "status": "failed", "scope": "owner-lifecycle-source-command-and-rust-quality", "commands": [],
              "D": "not-established", "C": "not-established", "P": "not-exercised", "M": "not-exercised", "H": "not-exercised"}
    try:
        record["toolchain"] = {}
        for name, command in {"rust": ["rustc", "-Vv"], "cargo": ["cargo", "-V"], "node": ["node", "--version"], "python": [sys.executable, "--version"], "git": ["git", "--version"]}.items():
            try:
                record["toolchain"][name] = capture(command)
            except (OSError, subprocess.CalledProcessError) as error:
                record["toolchain"][name] = str(error)
        if owner["id"] == "oi":
            commands = [["cargo", "fmt", "--manifest-path", "cli/Cargo.toml", "--", "--check"],
                        ["cargo", "check", "--manifest-path", "cli/Cargo.toml", "--all-targets", "--locked"],
                        ["cargo", "clippy", "--manifest-path", "cli/Cargo.toml", "--all-targets", "--locked", "--", "-D", "warnings"],
                        ["cargo", "test", "--manifest-path", "cli/Cargo.toml", "--all-targets", "--locked"]]
            record["command_authority"] = ".github/workflows/verify.yml (locked dependency resolution added)"
            record["command_authority_sha256"] = digest(source / ".github/workflows/verify.yml")
        else:
            descriptor_path = source / ".oi/product.json"
            descriptor = json.loads(descriptor_path.read_text())
            if descriptor.get("id") != owner["id"]:
                raise ValueError("native descriptor identity differs from selected owner")
            command = descriptor.get("verify", {}).get("source_command")
            if not isinstance(command, list) or not command or any(not isinstance(x, str) or not x for x in command):
                raise ValueError("native lifecycle descriptor has no valid source_command")
            commands = []
            if (source / "Cargo.toml").is_file():
                commands.extend([["cargo", "fmt", "--all", "--", "--check"],
                                 ["cargo", "clippy", "--workspace", "--all-targets", "--locked", "--", "-D", "warnings"]])
            commands.append(command)
            record["command_authority"] = ".oi/product.json#verify.source_command"
            record["command_authority_sha256"] = digest(descriptor_path)
        for index, command in enumerate(commands):
            log = out / f"native-{index:02d}.log"
            print("+ " + " ".join(command), flush=True)
            with log.open("w") as handle:
                process = subprocess.run(command, cwd=source, stdout=handle, stderr=subprocess.STDOUT, check=False)
            entry = {"argv": command, "exit_code": process.returncode, "log": log.name, "sha256": digest(log)}
            record["commands"].append(entry)
            # Keep all independent native findings; one failed command does not suppress the others.
            print(log.read_text(errors="replace")[-16000:], flush=True)
        if all(x["exit_code"] == 0 for x in record["commands"]):
            record["status"], record["D"] = "passed", "passed-for-declared-scope"
            return 0
        return 1
    except Exception as error:
        record["error"] = str(error)
        return 1
    finally:
        write(out / "native.json", record)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=["prepare", "native"])
    parser.add_argument("--cut", type=Path, default=ROOT / "tests/development-field/cut.json")
    parser.add_argument("--owner", required=True, choices=sorted(IDS))
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    owner = cut_owner(args.cut, args.owner)
    if args.phase == "prepare":
        prepare(args, owner)
        return 0
    return native(args, owner)


if __name__ == "__main__":
    sys.exit(main())
